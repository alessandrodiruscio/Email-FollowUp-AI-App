import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useCreateCampaign, getListCampaignsQueryKey, useListReasons, useCreateReason, getListReasonsQueryKey } from "@workspace/api-client-react";
import type { Reason } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PREDEFINED_REASON_COLORS, getPredefinedColorName } from "@/lib/reasonColors";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, Sparkles, Wand2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Link } from "wouter";
import { AiGenerateDialog } from "@/components/campaigns/AiGenerateDialog";
import { getSettings } from "@/lib/settings";
import { EmailPreview } from "@/components/emails/EmailPreview";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

const formSchema = z.object({
  fromName: z.string().min(1, "Sender name is required"),
  fromEmail: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  emailFontSize: z.string().default("16"),
  emailFontFamily: z.string().default("sans-serif"),
  emailLineHeight: z.string().default("1.6"),
  includeFooter: z.boolean().default(false),
});

const recipientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
});

type Recipient = z.infer<typeof recipientSchema>;

type FollowUpDraft = {
  stepNumber: number;
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  subject: string;
  body: string;
  includeFooter: boolean;
};

export default function CreateCampaign() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateCampaign();
  const createReasonMutation = useCreateReason();
  const { data: reasonsData } = useListReasons();
  const reasons = reasonsData || [];
  const settings = getSettings();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientForm, setRecipientForm] = useState<Recipient>({ name: "", email: "", company: "" } as any);
  const [recipientError, setRecipientError] = useState("");
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [newReasonName, setNewReasonName] = useState("");
  const [newReasonColor, setNewReasonColor] = useState(PREDEFINED_REASON_COLORS[0]);
  const [selectedReasonId, setSelectedReasonId] = useState<number | undefined>(undefined);
  const [selectedReason, setSelectedReason] = useState<Reason | undefined>(undefined);
  const [templateApplied, setTemplateApplied] = useState<{ subject: boolean; body: boolean; followUps: number } | null>(null);
  const [followUpSteps, setFollowUpSteps] = useState<FollowUpDraft[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [activePreview, setActivePreview] = useState<"initial" | number>("initial");

  // Sync selectedReason with reasons array when data changes
  useEffect(() => {
    if (selectedReasonId && reasons.length > 0) {
      const updated = reasons.find((r) => r.id === selectedReasonId);
      if (updated) {
        setSelectedReason(updated);
      }
    }
  }, [reasons, selectedReasonId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      subject: "",
      body: "",
      emailFontSize: "16",
      emailFontFamily: "sans-serif",
      emailLineHeight: "1.6",
      includeFooter: false,
    },
  });

  const handleCreateReason = async () => {
    if (!newReasonName.trim()) {
      toast({ title: "Please enter a reason name", variant: "destructive" });
      return;
    }
    createReasonMutation.mutate(
      { data: { name: newReasonName, color: newReasonColor } },
      {
        onSuccess: () => {
          setNewReasonName("");
          setNewReasonColor(PREDEFINED_REASON_COLORS[0]);
          setShowReasonDialog(false);
          queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
          toast({ title: "Reason created successfully" });
        },
        onError: () => toast({ title: "Failed to create reason", variant: "destructive" })
      }
    );
  };

  const addRecipient = () => {
    setRecipientError("");
    try {
      recipientSchema.parse(recipientForm);
      const exists = recipients.some((r) => r.email.toLowerCase() === recipientForm.email.toLowerCase());
      if (exists) {
        setRecipientError("This email is already added");
        return;
      }
      setRecipients([...recipients, recipientForm]);
      setRecipientForm({ name: "", email: "" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setRecipientError(err.errors[0]?.message || "Invalid recipient");
      }
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r.email !== email));
  };

  const updateFollowUpStep = (index: number, updates: Partial<FollowUpDraft>) => {
    setFollowUpSteps((prev) => prev.map((step, i) => i === index ? { ...step, ...updates } : step));
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (recipients.length === 0) {
      toast({ title: "Please add at least one recipient", variant: "destructive" });
      return;
    }

    const campaignName = values.subject || "Email Campaign";

    const campaignData: any = {
      name: campaignName,
      subject: values.subject,
      body: values.body,
      fromName: values.fromName,
      fromEmail: values.fromEmail,
      reasonId: selectedReasonId || null,
      emailFontSize: values.emailFontSize,
      emailFontFamily: values.emailFontFamily,
      emailLineHeight: values.emailLineHeight,
      includeFooter: values.includeFooter,
    };

    // Only include footer if the user selected it AND we have footer data in settings
    if (values.includeFooter && settings.footerName) {
      campaignData.footerName = settings.footerName;
      campaignData.footerTitle = settings.footerTitle || "";
      campaignData.footerImageUrl = settings.footerImageUrl || "";
      campaignData.footerWebsite = settings.footerWebsite || "";
      campaignData.footerWebsiteUrl = settings.footerWebsiteUrl || "";
      campaignData.footerFacebook = settings.footerFacebook || "";
      campaignData.footerInstagram = settings.footerInstagram || "";
      campaignData.footerYoutube = settings.footerYoutube || "";
    }

    createMutation.mutate(
      { data: campaignData },
      {
        onSuccess: (campaign) => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });

          for (const recipient of recipients) {
            fetch(`${import.meta.env.BASE_URL}api/campaigns/${campaign.id}/recipients`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(recipient),
            }).catch(() => {});
          }

          for (const step of followUpSteps) {
            // Only include footer on steps if the campaign actually has footer data
            const stepIncludeFooter = step.includeFooter && !!campaign.footerName;
            fetch(`${import.meta.env.BASE_URL}api/campaigns/${campaign.id}/followups`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                delayValue: step.delayValue,
                delayUnit: step.delayUnit,
                subject: step.subject,
                body: step.body,
                includeFooter: stepIncludeFooter,
                stepNumber: step.stepNumber,
              }),
            }).catch(() => {});
          }

          const followUpMsg = followUpSteps.length > 0
            ? ` + ${followUpSteps.length} follow-up step${followUpSteps.length !== 1 ? "s" : ""} added`
            : "";
          toast({ title: `Campaign created with recipients${followUpMsg}!` });
          navigate(`/campaigns/${campaign.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create campaign", variant: "destructive" });
        },
      }
    );
  };

  const handleAiSuccess = (data: { subject: string; body: string }) => {
    form.setValue("subject", data.subject);
    form.setValue("body", data.body);
  };

  // Determine what the preview should show
  const previewSubject = activePreview === "initial"
    ? form.watch("subject")
    : (followUpSteps[activePreview as number]?.subject ?? "");
  const previewBody = activePreview === "initial"
    ? form.watch("body")
    : (followUpSteps[activePreview as number]?.body ?? "");
  const previewIncludeFooter = activePreview === "initial"
    ? form.watch("includeFooter")
    : (followUpSteps[activePreview as number]?.includeFooter ?? false);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Create Campaign</h1>
          <p className="text-muted-foreground mt-1 text-lg">Add recipients and set up your outreach email.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-8">

              {/* Campaign Reason */}
              <Card className="border-none shadow-lg overflow-hidden bg-card rounded-2xl">
                <div className="h-2 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Campaign Reason</CardTitle>
                  <p className="text-sm text-muted-foreground">Select a reason to auto-fill your email and follow-up sequence from its template.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {templateApplied && (
                    <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                      <Wand2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-primary">Template applied!</span>
                        <span className="text-muted-foreground ml-1">
                          {[
                            templateApplied.subject && "subject",
                            templateApplied.body && "body",
                          ].filter(Boolean).join(" & ")}
                          {(templateApplied.subject || templateApplied.body) && " pre-filled"}
                          {templateApplied.followUps > 0 && `, ${templateApplied.followUps} follow-up${templateApplied.followUps !== 1 ? "s" : ""} ready to edit below`}
                          . You can still edit everything.
                        </span>
                      </div>
                    </div>
                  )}
                  {reasons.length > 0 ? (
                    <Select
                      value={selectedReasonId ? String(selectedReasonId) : ""}
                      onValueChange={(value) => {
                        const parsed = parseInt(value, 10);
                        setSelectedReasonId(parsed);
                        const foundReason = reasons.find((r) => r.id === parsed) as Reason | undefined;
                        if (foundReason) {
                          const applied = { subject: false, body: false, followUps: 0 };
                          if (foundReason.templateFromName) form.setValue("fromName", foundReason.templateFromName);
                          if (foundReason.templateFromEmail) form.setValue("fromEmail", foundReason.templateFromEmail);
                          if (foundReason.templateSubject) { form.setValue("subject", foundReason.templateSubject); applied.subject = true; }
                          if (foundReason.templateBody) { form.setValue("body", foundReason.templateBody); applied.body = true; }
                          if (foundReason.templateIncludeFooter !== null && foundReason.templateIncludeFooter !== undefined) {
                            form.setValue("includeFooter", foundReason.templateIncludeFooter);
                          }
                          const steps = foundReason.followUpTemplates ?? [];
                          applied.followUps = steps.length;
                          setFollowUpSteps(steps.map((t) => ({
                            stepNumber: t.stepNumber,
                            delayValue: t.delayValue,
                            delayUnit: (t.delayUnit || "days") as "minutes" | "hours" | "days",
                            subject: t.subject,
                            body: t.body,
                            includeFooter: t.includeFooter ?? false,
                          })));
                          setExpandedStep(steps.length > 0 ? 0 : null);
                          setActivePreview("initial");
                          if (applied.subject || applied.body || applied.followUps > 0) {
                            setTemplateApplied(applied);
                          } else {
                            setTemplateApplied(null);
                            toast({ title: `Reason set to "${foundReason.name}"` });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-muted/50">
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {reasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: reason.color }}
                              />
                              {reason.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reasons yet. Create one below.</p>
                  )}

                  <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" className="w-full gap-2 rounded-lg">
                        <Plus className="w-4 h-4" />
                        Create New Reason
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>Create New Reason</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="font-semibold text-sm block mb-2">Reason Name</label>
                          <Input
                            placeholder="e.g., Follow-up, Networking, Pitch"
                            value={newReasonName}
                            onChange={(e) => setNewReasonName(e.target.value)}
                            className="h-10 rounded-lg bg-muted/50"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-sm mb-3 block">Choose Color</label>
                          <div className="grid grid-cols-5 gap-2">
                            {PREDEFINED_REASON_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setNewReasonColor(color)}
                                className={`w-full h-12 rounded-lg border-2 transition-all ${
                                  newReasonColor === color
                                    ? "border-foreground ring-2 ring-primary"
                                    : "border-border hover:border-input"
                                }`}
                                style={{ backgroundColor: color }}
                                title={getPredefinedColorName(color)}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowReasonDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleCreateReason}
                            disabled={createReasonMutation.isPending}
                          >
                            {createReasonMutation.isPending ? "Creating..." : "Create"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Recipients Section */}
              <Card className="border-none shadow-lg overflow-hidden bg-card rounded-2xl">
                <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500" />
                <CardHeader>
                  <CardTitle className="text-lg">Recipients</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4 border-b pb-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input
                          placeholder="John Smith"
                          value={recipientForm.name}
                          onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
                          className="h-10 rounded-lg bg-muted/50 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Email</label>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={recipientForm.email}
                          onChange={(e) => setRecipientForm({ ...recipientForm, email: e.target.value })}
                          className="h-10 rounded-lg bg-muted/50 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Company (Optional)</label>
                        <Input
                          placeholder="Acme Corp"
                          value={(recipientForm as any).company || ""}
                          onChange={(e) => setRecipientForm({ ...recipientForm, company: e.target.value } as any)}
                          className="h-10 rounded-lg bg-muted/50 mt-1"
                        />
                      </div>
                    </div>
                    {recipientError && <p className="text-sm text-destructive">{recipientError}</p>}
                    <Button
                      type="button"
                      onClick={addRecipient}
                      variant="outline"
                      className="w-full rounded-lg border-dashed"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Recipient
                    </Button>
                  </div>

                  {recipients.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{recipients.length} recipient(s) added</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {recipients.map((recipient) => (
                          <div
                            key={recipient.email}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">{recipient.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                              {(recipient as any).company && <p className="text-xs text-muted-foreground">{(recipient as any).company}</p>}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRecipient(recipient.email)}
                              className="text-destructive hover:bg-destructive/10 ml-2"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Content */}
              <Card className="border-none shadow-lg overflow-hidden bg-card rounded-2xl">
                <div className="h-2 w-full bg-gradient-to-r from-primary via-accent to-primary" />
                <CardHeader>
                  <CardTitle className="text-lg">Email Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fromName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-sm">Sender Name</FormLabel>
                          <FormControl>
                            <Input className="h-10 rounded-lg bg-muted/50 font-medium text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fromEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-sm">Sender Email</FormLabel>
                          <FormControl>
                            <Input type="email" className="h-10 rounded-lg bg-muted/50 font-medium text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="font-semibold text-sm">Subject Line</FormLabel>
                          <AiGenerateDialog
                            mode="initial"
                            onSuccess={handleAiSuccess}
                          />
                        </div>
                        <FormControl>
                          <Input
                            placeholder="e.g. Quick question about your project"
                            className="h-10 rounded-lg bg-muted/50 focus-visible:ring-primary/20 font-medium text-sm"
                            onFocus={() => setActivePreview("initial")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-sm">Email Body</FormLabel>
                        <FormControl>
                          <div onClick={() => setActivePreview("initial")}>
                            <RichTextEditor
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Hi there,&#10;&#10;I wanted to reach out because..."
                              showVariableHelper={true}
                              fontFamily={form.watch("emailFontFamily")}
                              onFontFamilyChange={(v) => form.setValue("emailFontFamily", v)}
                              fontSize={form.watch("emailFontSize")}
                              onFontSizeChange={(v) => form.setValue("emailFontSize", v)}
                              lineHeight={form.watch("emailLineHeight")}
                              onLineHeightChange={(v) => form.setValue("emailLineHeight", v)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Footer checkbox */}
                  <FormField
                    control={form.control}
                    name="includeFooter"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 bg-muted/30">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-semibold text-sm cursor-pointer">
                            Include footer from Settings
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Add your contact info and social links to all emails
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Follow-up Sequence */}
              {followUpSteps.length > 0 && (
                <Card className="border-none shadow-lg overflow-hidden bg-card rounded-2xl">
                  <div className="h-2 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500" />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Follow-up Sequence</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Review and edit your follow-up emails before creating the campaign.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {followUpSteps.map((step, index) => {
                      const isExpanded = expandedStep === index;
                      const isActivePrev = activePreview === index;
                      return (
                        <div
                          key={index}
                          className={`rounded-xl border transition-all ${
                            isActivePrev ? "border-orange-400 shadow-sm" : "border-border"
                          }`}
                        >
                          {/* Header */}
                          <button
                            type="button"
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 rounded-xl transition-colors"
                            onClick={() => {
                              const next = isExpanded ? null : index;
                              setExpandedStep(next);
                              setActivePreview(next !== null ? next : "initial");
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                                {step.stepNumber}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">
                                  {step.subject || <span className="text-muted-foreground italic">No subject</span>}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <p className="text-xs text-muted-foreground">
                                    Send after {step.delayValue} {step.delayUnit}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-4 border-t pt-4">
                              {/* Delay */}
                              <div className="flex gap-3 items-center">
                                <label className="text-xs font-semibold text-muted-foreground w-20 shrink-0">Send after</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={step.delayValue}
                                  onChange={(e) => updateFollowUpStep(index, { delayValue: parseInt(e.target.value) || 1 })}
                                  className="h-8 w-20 text-sm rounded-lg bg-muted/50"
                                />
                                <select
                                  value={step.delayUnit}
                                  onChange={(e) => updateFollowUpStep(index, { delayUnit: e.target.value as "minutes" | "hours" | "days" })}
                                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="minutes">minutes</option>
                                  <option value="hours">hours</option>
                                  <option value="days">days</option>
                                </select>
                                <span className="text-xs text-muted-foreground">after previous email</span>
                              </div>

                              {/* Subject */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Subject Line</label>
                                <Input
                                  value={step.subject}
                                  onChange={(e) => updateFollowUpStep(index, { subject: e.target.value })}
                                  placeholder="e.g. Re: {{original_subject}}"
                                  className="h-9 rounded-lg bg-muted/50 text-sm"
                                />
                              </div>

                              {/* Body */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Email Body</label>
                                <RichTextEditor
                                  value={step.body}
                                  onChange={(v) => updateFollowUpStep(index, { body: v })}
                                  placeholder="Hi {{name}}, just following up..."
                                  showVariableHelper={true}
                                  minHeight="160px"
                                />
                              </div>

                              {/* Include footer */}
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`footer-step-${index}`}
                                  checked={step.includeFooter}
                                  onCheckedChange={(v) => updateFollowUpStep(index, { includeFooter: !!v })}
                                />
                                <label htmlFor={`footer-step-${index}`} className="text-sm cursor-pointer">
                                  Include footer from Settings
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Email Preview */}
            <div className="lg:col-span-1">
              <Card className="border-none shadow-lg rounded-2xl overflow-hidden sticky top-8">
                <CardHeader className="bg-gradient-to-r from-primary via-accent to-primary text-white pb-3">
                  <CardTitle className="text-base">Email Preview</CardTitle>
                  {/* Preview tabs */}
                  {followUpSteps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <button
                        type="button"
                        onClick={() => setActivePreview("initial")}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                          activePreview === "initial"
                            ? "bg-white text-primary"
                            : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                      >
                        Initial
                      </button>
                      {followUpSteps.map((step, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setActivePreview(i);
                            setExpandedStep(i);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                            activePreview === i
                              ? "bg-white text-primary"
                              : "bg-white/20 text-white hover:bg-white/30"
                          }`}
                        >
                          Step {step.stepNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  <EmailPreview
                    subject={previewSubject}
                    body={previewBody}
                    fontSize={form.watch("emailFontSize")}
                    fontFamily={form.watch("emailFontFamily")}
                    lineHeight={form.watch("emailLineHeight")}
                    footerName={previewIncludeFooter ? settings.footerName : undefined}
                    footerTitle={previewIncludeFooter ? settings.footerTitle : undefined}
                    footerImageUrl={previewIncludeFooter ? settings.footerImageUrl : undefined}
                    footerWebsite={previewIncludeFooter ? settings.footerWebsite : undefined}
                    footerWebsiteUrl={previewIncludeFooter ? settings.footerWebsiteUrl : undefined}
                    footerFacebook={previewIncludeFooter ? settings.footerFacebook : undefined}
                    footerInstagram={previewIncludeFooter ? settings.footerInstagram : undefined}
                    footerYoutube={previewIncludeFooter ? settings.footerYoutube : undefined}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-xl border">
            <Link href="/campaigns">
              <Button variant="outline" className="rounded-lg font-medium">Cancel</Button>
            </Link>
            <Button
              type="submit"
              disabled={createMutation.isPending || recipients.length === 0}
              className="rounded-lg font-bold bg-primary text-white shadow-md gap-2 flex-1"
            >
              <Sparkles className="w-4 h-4" />
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
