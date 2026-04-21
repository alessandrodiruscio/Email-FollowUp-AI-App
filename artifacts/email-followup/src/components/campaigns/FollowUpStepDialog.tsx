import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useCreateFollowUpStep, useUpdateFollowUpStep, getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AiGenerateDialog } from "./AiGenerateDialog";
import { VariableHelper } from "./VariableHelper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  delayValue: z.coerce.number().min(1, "Must be at least 1"),
  delayUnit: z.enum(["minutes", "hours", "days"]),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  includeFooter: z.boolean().default(true),
});

type Props = {
  campaignId: number;
  originalSubject: string;
  originalBody: string;
  nextStepNumber: number;
  editStep?: { id: number; stepNumber: number; delayValue: number; delayUnit: string; subject: string; body: string; includeFooter: boolean };
};

export function FollowUpStepDialog({ campaignId, originalSubject, originalBody, nextStepNumber, editStep }: Props) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useCreateFollowUpStep();
  const updateMutation = useUpdateFollowUpStep();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!editStep;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: editStep
      ? { delayValue: editStep.delayValue, delayUnit: (editStep.delayUnit || "days") as "minutes" | "hours" | "days", subject: editStep.subject, body: editStep.body, includeFooter: editStep.includeFooter }
      : { delayValue: 3, delayUnit: "days", subject: "", body: "", includeFooter: true }
  });

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val && editStep) {
      form.reset({ delayValue: editStep.delayValue, delayUnit: (editStep.delayUnit || "days") as "minutes" | "hours" | "days", subject: editStep.subject, body: editStep.body, includeFooter: editStep.includeFooter });
    } else if (!val) {
      if (!isEditing) form.reset();
    }
  };

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (isEditing && editStep) {
      updateMutation.mutate({ id: campaignId, stepId: editStep.id, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          setOpen(false);
          toast({ title: "Follow-up step updated" });
          setIsSubmitting(false);
        },
        onError: () => {
          toast({ title: "Failed to update step", variant: "destructive" });
          setIsSubmitting(false);
        }
      });
    } else {
      createMutation.mutate({ id: campaignId, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          setOpen(false);
          form.reset();
          toast({ title: "Follow-up step added" });
          setIsSubmitting(false);
        },
        onError: () => {
          toast({ title: "Failed to add step", variant: "destructive" });
          setIsSubmitting(false);
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  const handleAiSuccess = (data: { subject: string, body: string }) => {
    form.setValue("subject", data.subject);
    form.setValue("body", data.body);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity">
            <Pencil className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="outline" className="border-dashed border-2 rounded-xl w-full h-20 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            <Plus className="w-5 h-5 mr-2" />
            Add Follow-up Step {nextStepNumber}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl bg-card max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <div className="flex justify-between items-center pr-6">
            <DialogTitle className="text-2xl font-display font-bold">
              {isEditing ? `Edit Follow-up ${editStep?.stepNumber ?? 1}` : `New Follow-up ${nextStepNumber}`}
            </DialogTitle>
            <AiGenerateDialog 
              mode="followup" 
              onSuccess={handleAiSuccess} 
              followUpContext={{
                originalSubject,
                originalBody,
                followUpNumber: isEditing ? (editStep?.stepNumber ?? 1) : nextStepNumber
              }}
            />
          </div>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col overflow-hidden flex-1">
            <div className="space-y-6 pt-4 overflow-y-auto flex-1 px-4">
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="delayValue"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="font-semibold">Wait how long?</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" className="h-12 rounded-xl bg-muted/50 text-lg font-bold" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delayUnit"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="font-semibold">Unit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-primary font-medium">
                ⏱️ This follow-up will be sent <strong>{form.watch("delayValue")} {form.watch("delayUnit")}</strong> after the <strong>previous email</strong>.
              </p>
            </div>
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Subject Line</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Re: {{original_subject}} or {{name}}, following up..." className="h-12 rounded-xl bg-muted/50 font-medium font-mono" {...field} />
                  </FormControl>
                  <VariableHelper
                    onInsert={(variable) => {
                      const currentSubject = form.getValues("subject") || "";
                      form.setValue("subject", currentSubject + variable);
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Email Body</FormLabel>
                  <FormControl>
                    <div>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Just floating this to the top of your inbox..."
                        showVariableHelper={true}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="includeFooter"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 bg-muted/30">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-base font-semibold cursor-pointer">Include footer from Settings</FormLabel>
                    <p className="text-sm text-muted-foreground">Add your profile image and contact info to the end of this email</p>
                  </div>
                </FormItem>
              )}
            />
            </div>
            <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4 px-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-medium">Cancel</Button>
              <Button 
                type="button" 
                disabled={isPending} 
                onClick={() => form.handleSubmit(onSubmit)()}
                className="rounded-xl font-bold bg-primary text-white shadow-md"
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Save Step"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
