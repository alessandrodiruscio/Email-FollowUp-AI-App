import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import {
  useUpdateReason,
  useCreateReasonFollowUpTemplate,
  useUpdateReasonFollowUpTemplate,
  useDeleteReasonFollowUpTemplate,
  getListReasonsQueryKey,
  useListReasons,
} from "@workspace/api-client-react";
import type { Reason, ReasonFollowUpTemplate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Clock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { VariableHelper } from "./VariableHelper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const templateSchema = z.object({
  templateSubject: z.string().optional(),
  templateBody: z.string().optional(),
  templateFromName: z.string().optional(),
  templateFromEmail: z.string().optional(),
  templateIncludeFooter: z.boolean().default(true),
});

const followUpSchema = z.object({
  delayValue: z.coerce.number().min(1, "Must be at least 1"),
  delayUnit: z.enum(["minutes", "hours", "days"]),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  includeFooter: z.boolean().default(true),
});

type TemplateFormValues = z.infer<typeof templateSchema>;
type FollowUpFormValues = z.infer<typeof followUpSchema>;

type Props = {
  reason: Reason;
  open: boolean;
  onClose: () => void;
};

function FollowUpTemplateForm({
  reasonId,
  nextStepNumber,
  editTemplate,
  onDone,
}: {
  reasonId: number;
  nextStepNumber: number;
  editTemplate?: ReasonFollowUpTemplate;
  onDone: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useCreateReasonFollowUpTemplate();
  const updateMutation = useUpdateReasonFollowUpTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!editTemplate;

  const form = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpSchema),
    defaultValues: editTemplate
      ? {
          delayValue: editTemplate.delayValue,
          delayUnit: editTemplate.delayUnit as "minutes" | "hours" | "days",
          subject: editTemplate.subject,
          body: editTemplate.body,
          includeFooter: editTemplate.includeFooter,
        }
      : { delayValue: 3, delayUnit: "days", subject: "", body: "", includeFooter: true },
  });

  const handleSave = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    const values = form.getValues();
    if (isEditing && editTemplate) {
      updateMutation.mutate(
        { reasonId, tid: editTemplate.id, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
            toast({ title: "Follow-up template updated" });
            onDone();
            setIsSubmitting(false);
          },
          onError: () => {
            toast({ title: "Failed to update template", variant: "destructive" });
            setIsSubmitting(false);
          },
        }
      );
    } else {
      createMutation.mutate(
        { reasonId, data: { stepNumber: nextStepNumber, ...values } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
            toast({ title: "Follow-up template added" });
            onDone();
            setIsSubmitting(false);
          },
          onError: () => {
            toast({ title: "Failed to add template", variant: "destructive" });
            setIsSubmitting(false);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-4 p-4 bg-muted/40 rounded-xl border">
      <p className="text-sm font-semibold">
        {isEditing ? `Editing Follow-up ${editTemplate!.stepNumber}` : `New Follow-up (Step ${nextStepNumber})`}
      </p>

      <div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium w-16 shrink-0">Send after</label>
          <Input
            type="number"
            min={1}
            className="h-9 w-20 rounded-lg bg-background text-sm"
            {...form.register("delayValue")}
          />
          <Select
            value={form.watch("delayUnit")}
            onValueChange={(v) => form.setValue("delayUnit", v as "minutes" | "hours" | "days")}
          >
            <SelectTrigger className="h-9 w-28 rounded-lg bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          ⏱️ This follow-up will be sent {form.watch("delayValue")} {form.watch("delayUnit")} after the <strong>previous email</strong> {editTemplate?.stepNumber === 1 ? "(the initial email)" : ""}.
        </p>
      </div>
      {form.formState.errors.delayValue && (
        <p className="text-xs text-destructive">{form.formState.errors.delayValue.message}</p>
      )}

      <div>
        <label className="text-sm font-medium block mb-2">Subject</label>
        <Input
          placeholder="e.g. Re: {{original_subject}} or Just checking in, {{name}}!"
          className="h-9 rounded-lg bg-background text-sm font-mono"
          {...form.register("subject")}
        />
        <VariableHelper
          onInsert={(variable) => {
            const currentSubject = form.getValues("subject") || "";
            form.setValue("subject", currentSubject + variable);
          }}
        />
        {form.formState.errors.subject && (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.subject.message}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Body</label>
        <RichTextEditor
          value={form.watch("body")}
          onChange={(v) => form.setValue("body", v)}
          placeholder="Hi there, just following up..."
          minHeight="120px"
          showVariableHelper={true}
        />
        {form.formState.errors.body && (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.body.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`includeFooter-${editTemplate?.id ?? "new"}`}
          checked={form.watch("includeFooter")}
          onCheckedChange={(v) => form.setValue("includeFooter", Boolean(v))}
        />
        <label htmlFor={`includeFooter-${editTemplate?.id ?? "new"}`} className="text-sm cursor-pointer">
          Include footer signature
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {isEditing ? "Save Changes" : "Add Step"}
        </Button>
      </div>
    </div>
  );
}

export function ReasonTemplateDialog({ reason, open, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<ReasonFollowUpTemplate | null>(null);
  const updateReasonMutation = useUpdateReason();
  const deleteTemplateMutation = useDeleteReasonFollowUpTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all reasons to keep the current reason data in sync
  const { data: allReasons = [] } = useListReasons();
  
  // Get the current reason from the query data, falling back to the prop
  const currentReason = useMemo(() => {
    const updated = allReasons.find((r) => r.id === reason.id);
    return updated || reason;
  }, [allReasons, reason.id]);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      templateSubject: currentReason.templateSubject ?? "",
      templateBody: currentReason.templateBody ?? "",
      templateFromName: currentReason.templateFromName ?? "",
      templateFromEmail: currentReason.templateFromEmail ?? "",
      templateIncludeFooter: currentReason.templateIncludeFooter ?? true,
    },
  });

  // Update form when currentReason changes
  useEffect(() => {
    form.reset({
      templateSubject: currentReason.templateSubject ?? "",
      templateBody: currentReason.templateBody ?? "",
      templateFromName: currentReason.templateFromName ?? "",
      templateFromEmail: currentReason.templateFromEmail ?? "",
      templateIncludeFooter: currentReason.templateIncludeFooter ?? true,
    });
  }, [currentReason.id, currentReason.templateSubject, currentReason.templateBody, currentReason.templateFromName, currentReason.templateFromEmail, currentReason.templateIncludeFooter, form]);

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const values = form.getValues();
    updateReasonMutation.mutate(
      { id: currentReason.id, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
          toast({ title: "Template saved successfully" });
          setIsSubmitting(false);
          onClose();
        },
        onError: () => {
          toast({ title: "Failed to save template", variant: "destructive" });
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleDeleteTemplate = (tid: number) => {
    deleteTemplateMutation.mutate(
      { reasonId: currentReason.id, tid },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
          toast({ title: "Follow-up template removed" });
        },
        onError: () => {
          toast({ title: "Failed to remove template", variant: "destructive" });
        },
      }
    );
  };

  const followUpTemplates = currentReason.followUpTemplates ?? [];
  const nextStepNumber = followUpTemplates.length > 0
    ? Math.max(...followUpTemplates.map((t) => t.stepNumber)) + 1
    : 1;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentReason.color }} />
            Configure Template: {currentReason.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Set a default email and follow-up sequence for campaigns using this reason.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Initial Email Template */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
              Initial Email Template
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">From Name (optional override)</label>
                  <Input
                    placeholder="Your Name"
                    className="h-9 rounded-lg bg-muted/50 text-sm"
                    {...form.register("templateFromName")}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">From Email (optional override)</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="h-9 rounded-lg bg-muted/50 text-sm"
                    {...form.register("templateFromEmail")}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Subject Line</label>
                <Input
                  placeholder="e.g. Quick question about your project"
                  className="h-9 rounded-lg bg-muted/50 text-sm"
                  {...form.register("templateSubject")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Email Body</label>
                <RichTextEditor
                  value={form.watch("templateBody") ?? ""}
                  onChange={(v) => form.setValue("templateBody", v)}
                  placeholder="Hi {{name}},&#10;&#10;I wanted to reach out because..."
                  minHeight="140px"
                  showVariableHelper={true}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="templateIncludeFooter"
                  checked={form.watch("templateIncludeFooter")}
                  onCheckedChange={(v) => form.setValue("templateIncludeFooter", Boolean(v))}
                />
                <label htmlFor="templateIncludeFooter" className="text-sm cursor-pointer">
                  Include footer signature
                </label>
              </div>
            </div>
          </div>

          {/* Follow-up Sequence Template */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
              Follow-up Sequence Template
            </h3>

            {followUpTemplates.length === 0 && !addingFollowUp && (
              <p className="text-sm text-muted-foreground mb-3">
                No follow-up steps configured. Add steps below to auto-create a sequence for new campaigns.
              </p>
            )}

            <div className="space-y-2">
              {followUpTemplates.map((t) => (
                <div key={t.id}>
                  {editingFollowUp?.id === t.id ? (
                    <FollowUpTemplateForm
                      reasonId={reason.id}
                      nextStepNumber={t.stepNumber}
                      editTemplate={t}
                      onDone={() => setEditingFollowUp(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between p-3 bg-muted/40 rounded-xl border gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                          {t.stepNumber}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.subject}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            Send after {t.delayValue} {t.delayUnit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setAddingFollowUp(false); setEditingFollowUp(t); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteTemplate(t.id)}
                          disabled={deleteTemplateMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {addingFollowUp && !editingFollowUp && (
                <FollowUpTemplateForm
                  reasonId={reason.id}
                  nextStepNumber={nextStepNumber}
                  onDone={() => setAddingFollowUp(false)}
                />
              )}
            </div>

            {!addingFollowUp && !editingFollowUp && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-2 rounded-lg w-full border-dashed"
                onClick={() => setAddingFollowUp(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Follow-up Step
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
