import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetCampaign, 
  useSendCampaign, 
  useSendTestEmail,
  useMarkReplied, 
  useRemoveRecipient,
  useDeleteFollowUpStep,
  useUpdateCampaign,
  useListReasons,
  useCreateReason,
  getGetCampaignQueryKey,
  getListReasonsQueryKey
} from "@workspace/api-client-react";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ArrowLeft, Send, Mail, Users, Clock, CheckCircle2, Trash2, StopCircle, RefreshCw, Pencil, Loader2, Plus, Zap } from "lucide-react";
import { getStatusColor, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AddRecipientDialog } from "@/components/campaigns/AddRecipientDialog";
import { FollowUpStepDialog } from "@/components/campaigns/FollowUpStepDialog";
import { EmailOpenStatus } from "@/components/campaigns/EmailOpenStatus";
import { motion, AnimatePresence } from "framer-motion";
import { PREDEFINED_REASON_COLORS, getPredefinedColorName } from "@/lib/reasonColors";

const editCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  fromName: z.string().min(1, "Sender name is required"),
  fromEmail: z.string().email("Valid email required"),
});

type FollowUpStep = {
  id: number;
  stepNumber: number;
  delayValue: number;
  delayUnit: string;
  subject: string;
  body: string;
};

type SentEmail = {
  id: number;
  stepNumber: number;
  followUpStepId: number | null;
  status: string;
  sentAt: Date | string;
  subject: string;
};

type Recipient = {
  id: number;
  name: string;
  email: string;
  replied: boolean;
  repliedAt: Date | string | null;
  initialSentAt: Date | string | null;
  sentEmails: SentEmail[];
};

function RecipientTimeline({ recipient, followUpSteps }: { recipient: Recipient; followUpSteps: FollowUpStep[] }) {
  const sentStepIds = new Set(recipient.sentEmails.filter(e => e.followUpStepId).map(e => e.followUpStepId));
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 flex-wrap">
        {recipient.initialSentAt ? (
          <Tooltip>
            <TooltipTrigger>
              <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-200" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Initial email sent</p>
              <p className="text-xs text-muted-foreground">{formatDate(String(recipient.initialSentAt))}</p>
            </TooltipContent>
          </Tooltip>
        ) : null}

        {followUpSteps.map((step) => {
          const wasSent = sentStepIds.has(step.id);
          const sentEmail = recipient.sentEmails.find(e => e.followUpStepId === step.id);
          const isCancelled = !wasSent && recipient.replied;
          const isPending = !wasSent && !recipient.replied && !!recipient.initialSentAt;
          const notStarted = !wasSent && !recipient.replied && !recipient.initialSentAt;

          if (notStarted) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger>
                  <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">Follow-up {step.stepNumber} — not started</p>
                  <p className="text-xs text-muted-foreground">Campaign hasn't been sent yet</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          if (wasSent) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger>
                  <div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">Follow-up {step.stepNumber} sent</p>
                  {sentEmail?.sentAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(String(sentEmail.sentAt))}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }
          if (isCancelled) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger>
                  <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-dashed border-slate-400 opacity-60" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">Follow-up {step.stepNumber} cancelled</p>
                  <p className="text-xs text-muted-foreground">Recipient replied — no further follow-ups</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          if (isPending) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger>
                  <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-slate-400 animate-pulse" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">Follow-up {step.stepNumber} pending</p>
                  <p className="text-xs text-muted-foreground">Scheduled {step.delayValue} {step.delayUnit} after the prior step</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          return null;
        })}

        {recipient.replied && (
          <Tooltip>
            <TooltipTrigger>
              <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Replied</p>
              {recipient.repliedAt && (
                <p className="text-xs text-muted-foreground">{formatDate(String(recipient.repliedAt))}</p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function EditCampaignDialog({ campaign, campaignId, isOpen, onOpenChange }: { campaign: { name: string; subject: string; body: string; fromName: string; fromEmail: string }; campaignId: number; isOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalOpen(val);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateMutation = useUpdateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editCampaignSchema>>({
    resolver: zodResolver(editCampaignSchema),
    defaultValues: {
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
    }
  });

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      form.reset({ name: campaign.name, subject: campaign.subject, body: campaign.body, fromName: campaign.fromName, fromEmail: campaign.fromEmail });
    }
  };

  const onSubmit = async (values: z.infer<typeof editCampaignSchema>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    updateMutation.mutate({ id: campaignId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        setOpen(false);
        toast({ title: "Campaign updated" });
        setIsSubmitting(false);
      },
      onError: () => {
        toast({ title: "Failed to update campaign", variant: "destructive" });
        setIsSubmitting(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isOpen && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl gap-2 font-medium">
            <Pencil className="w-4 h-4" /> Edit Campaign
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl bg-card max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-display font-bold">Edit Campaign</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col overflow-hidden flex-1">
            <div className="space-y-5 pt-4 overflow-y-auto flex-1 px-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Campaign Name</FormLabel>
                    <FormControl>
                      <Input className="h-12 rounded-xl bg-muted/50 font-medium" {...field} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Sender Name</FormLabel>
                      <FormControl>
                        <Input className="h-12 rounded-xl bg-muted/50 font-medium" {...field} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
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
                      <FormLabel className="font-semibold">Sender Email</FormLabel>
                      <FormControl>
                        <Input type="email" className="h-12 rounded-xl bg-muted/50 font-medium" {...field} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">Your email service requires a verified sender domain. The connected account's verified address will be used for delivery.</p>
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
                    <FormLabel className="font-semibold">Subject Line</FormLabel>
                    <FormControl>
                      <Input className="h-12 rounded-xl bg-muted/50 font-medium" {...field} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
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
                    <FormLabel className="font-semibold">Email Body</FormLabel>
                    <FormControl>
                      <div>
                        <RichTextEditor
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4 px-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-medium">Cancel</Button>
              <Button 
                type="button"
                disabled={isSubmitting} 
                onClick={() => form.handleSubmit(onSubmit)()}
                className="rounded-xl font-bold bg-primary text-white shadow-md"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignDetail() {
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [newReasonName, setNewReasonName] = useState("");
  const [newReasonColor, setNewReasonColor] = useState(PREDEFINED_REASON_COLORS[0]);
  const { id } = useParams<{ id: string }>();
  const campaignId = parseInt(id, 10);
  const { data: campaign, isLoading } = useGetCampaign(campaignId, { 
    refetchInterval: 30000,
    refetchIntervalInBackground: true 
  });
  const { data: reasonsData } = useListReasons();
  const reasons = reasonsData || [];
  const createReasonMutation = useCreateReason();
  const sendMutation = useSendCampaign();
  const sendTestEmailMutation = useSendTestEmail();
  const replyMutation = useMarkReplied();
  const removeRecipientMut = useRemoveRecipient();
  const deleteStepMut = useDeleteFollowUpStep();
  const updateMutation = useUpdateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingStepNumber, setTestingStepNumber] = useState<number | undefined>(undefined);
  const [displayStepNumber, setDisplayStepNumber] = useState<number | undefined>(undefined);
  const [showEditCampaignDialog, setShowEditCampaignDialog] = useState(false);

  const handleSend = () => {
    if (confirm("Send initial emails to ALL recipients who haven't received it yet?")) {
      sendMutation.mutate({ id: campaignId }, {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          toast({ title: "Sending complete", description: res.message });
        },
        onError: () => toast({ title: "Failed to send", variant: "destructive" })
      });
    }
  };

  const handlePauseCampaign = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/campaigns/${campaignId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to pause campaign");
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      toast({ title: "Campaign paused", description: "All follow-ups have been paused" });
    } catch (error) {
      toast({ title: "Failed to pause campaign", variant: "destructive" });
    }
  }, [campaignId, queryClient, toast]);

  const handleResumeCampaign = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/campaigns/${campaignId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to resume campaign");
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      toast({ title: "Campaign resumed", description: "Emails will continue to be sent" });
    } catch (error) {
      toast({ title: "Failed to resume campaign", variant: "destructive" });
    }
  }, [campaignId, queryClient, toast]);

  const handleSendTestEmail = () => {
    if (!testEmail) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }
    const payload: any = { testEmail };
    if (testingStepNumber !== undefined) {
      payload.stepNumber = testingStepNumber;
    }
    sendTestEmailMutation.mutate({ id: campaignId, data: payload }, {
      onSuccess: () => {
        const stepLabel = testingStepNumber !== undefined ? ` (Step ${testingStepNumber})` : "";
        toast({ title: `Test email sent successfully!${stepLabel}` });
        setShowTestEmailDialog(false);
        setTestEmail("");
        setTestingStepNumber(undefined);
      },
      onError: (error) => toast({ title: error instanceof Error ? error.message : "Failed to send test email", variant: "destructive" })
    });
  };

  const openTestEmailDialog = (stepNumber?: number, displayNumber?: number) => {
    setTestingStepNumber(stepNumber);
    setDisplayStepNumber(displayNumber);
    setShowTestEmailDialog(true);
  };

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

  const handleReasonChange = (reasonId: number | null) => {
    if (!campaign) return;
    updateMutation.mutate(
      { id: campaignId, data: { reasonId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          toast({ title: "Reason updated" });
        },
        onError: () => toast({ title: "Failed to update reason", variant: "destructive" })
      }
    );
  };

  const toggleReply = (recipientId: number, currentStatus: boolean) => {
    replyMutation.mutate({ id: campaignId, recipientId, data: { replied: !currentStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      }
    });
  };

  const removeRecipient = (recipientId: number) => {
    if(confirm("Remove this recipient?")) {
      removeRecipientMut.mutate({ id: campaignId, recipientId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })
      });
    }
  };

  const deleteStep = (stepId: number) => {
    if(confirm("Delete this follow-up step? This affects future automated sends.")) {
      deleteStepMut.mutate({ id: campaignId, stepId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!campaign) return <div className="text-center py-20 text-muted-foreground">Campaign not found</div>;

  const nextStepNumber = campaign.followUpSteps.length > 0 
    ? Math.max(...campaign.followUpSteps.map(s => s.stepNumber)) + 1 
    : 1;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon" className="rounded-full bg-muted/50 hover:bg-muted border">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{campaign.name}</h1>
              {campaign.status !== "active" && (
                <Badge variant="outline" className={`px-3 py-1 font-bold text-xs uppercase tracking-widest border-2 ${getStatusColor(campaign.status)}`}>
                  {campaign.status}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4" /> {campaign.fromName} &lt;{campaign.fromEmail}&gt;
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          {campaign.status === "draft" && (
            <Button 
              size="lg" 
              onClick={handleSend}
              disabled={sendMutation.isPending || campaign.recipients.length === 0}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 font-bold px-8"
            >
              {sendMutation.isPending ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
              Start Campaign
            </Button>
          )}
          {campaign.status === "active" && (
            <>
              <Badge className="bg-green-100 text-green-700 border-green-200 border px-3 py-1.5 rounded-full font-semibold flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                Campaign Running
              </Badge>
              <Button
                size="lg"
                onClick={handlePauseCampaign}
                variant="outline"
                className="rounded-xl font-bold px-8 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <StopCircle className="w-5 h-5 mr-2" />
                Pause Campaign
              </Button>
            </>
          )}
          {campaign.status === "paused" && (
            <>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 border px-3 py-1.5 rounded-full font-semibold">
                Campaign Paused
              </Badge>
              <Button
                size="lg"
                onClick={handleResumeCampaign}
                variant="outline"
                className="rounded-xl font-bold px-8 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Send className="w-5 h-5 mr-2" />
                Resume Campaign
              </Button>
            </>
          )}
          {campaign.status === "completed" && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border px-3 py-1.5 rounded-full font-semibold">
              Campaign Completed
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="recipients" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl w-full max-w-md h-14">
          <TabsTrigger value="recipients" className="rounded-lg h-full text-base font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary flex-1">
            Recipients <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">{campaign.recipients.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sequence" className="rounded-lg h-full text-base font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary flex-1">
            Sequence <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">{campaign.followUpSteps.length + 1}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-8">
          <TabsContent value="recipients" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display font-bold">Contact List</h2>
              <AddRecipientDialog campaignId={campaign.id} />
            </div>

            {campaign.recipients.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-dashed">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No recipients yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6 mt-1">Add people to this campaign to start sending automated emails.</p>
                <AddRecipientDialog campaignId={campaign.id} />
              </div>
            ) : (
              <Card className="rounded-2xl border-none shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                      <tr>
                        <th className="px-6 py-4 font-semibold tracking-wider">Recipient</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">
                          Timeline
                          <span className="ml-2 text-xs font-normal normal-case text-muted-foreground/70">
                            ● sent &nbsp; ◌ pending &nbsp; ○ cancelled
                          </span>
                        </th>
                        <th className="px-6 py-4 text-right font-semibold tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {campaign.recipients.map((rec) => (
                          <motion.tr 
                            key={rec.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="border-b last:border-0 hover:bg-muted/10 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium text-foreground">
                              <div className="font-bold">{rec.name}</div>
                              <div className="text-muted-foreground font-normal">{rec.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                {rec.replied ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none font-semibold w-fit">Replied</Badge>
                                ) : rec.initialSentAt ? (
                                  <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 font-semibold w-fit">Active</Badge>
                                ) : (
                                  <Badge variant="secondary" className="font-semibold text-slate-500 bg-slate-100 w-fit">Pending</Badge>
                                )}
                                <EmailOpenStatus campaignId={parseInt(campaignId)} recipientId={rec.id} />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <RecipientTimeline recipient={rec as Recipient} followUpSteps={campaign.followUpSteps as FollowUpStep[]} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => toggleReply(rec.id, rec.replied)}
                                  className={`rounded-lg font-medium shadow-sm transition-colors ${rec.replied ? 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700' : 'text-slate-600'}`}
                                >
                                  {rec.replied ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <StopCircle className="w-4 h-4 mr-1.5 text-muted-foreground" />}
                                  {rec.replied ? 'Replied' : 'Mark Replied'}
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => removeRecipient(rec.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Campaign Reason Box - Below Recipients */}
            <Card className="border-2 border-dashed rounded-2xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Campaign Reason</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.reason ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: campaign.reason.color }}
                      />
                      <span className="font-medium">{campaign.reason.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReasonChange(null)}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No reason assigned yet</p>
                )}
                <div className="flex gap-2 pt-2">
                  {reasons.length > 0 && (
                    <select
                      className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-sm"
                      value={campaign.reason?.id || ""}
                      onChange={(e) => handleReasonChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                    >
                      <option value="">Select a reason...</option>
                      {reasons.map((reason) => (
                        <option key={reason.id} value={reason.id}>
                          {reason.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        New
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
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-sm mb-3 block">Choose Color</label>
                          <div className="grid grid-cols-5 gap-2">
                            {PREDEFINED_REASON_COLORS.map((color) => (
                              <button
                                key={color}
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
                        <DialogFooter>
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
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sequence" className="outline-none">
            <div className="max-w-3xl space-y-6">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-xl font-display font-bold">Automated Sequence</h2>
                  <p className="text-muted-foreground mt-1">If they don't reply, these emails will send automatically.</p>
                </div>
              </div>

              <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-border/60">
                
                {/* Initial Step */}
                <div className="relative pl-12">
                  <div className="absolute left-0 top-6 w-10 h-10 rounded-full bg-blue-100 border-4 border-background flex items-center justify-center shadow-sm z-10">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <Card className="rounded-2xl border shadow-sm hover:border-primary/20 transition-colors">
                    <CardHeader className="bg-muted/20 pb-3 border-b">
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <CardTitle className="text-base text-foreground font-bold">Initial Email</CardTitle>
                          <Badge variant="secondary" className="font-semibold text-blue-600 bg-blue-100 w-fit">Step 1</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/campaigns/${campaignId}/preview`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg gap-2 text-slate-600 border-slate-200"
                              title="Preview email"
                            >
                              <Mail className="w-4 h-4" />
                              <span className="hidden sm:inline text-sm">Preview</span>
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg gap-2 text-blue-600 border-blue-200"
                            onClick={() => openTestEmailDialog(0, 0)}
                            title="Send test email"
                          >
                            <Zap className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Test</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg gap-2 text-slate-600 border-slate-200"
                            onClick={() => setShowEditCampaignDialog(true)}
                            title="Edit initial email"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Edit</span>
                          </Button>
                        </div>
                        <CardDescription className="font-medium text-foreground text-sm">Subject: {campaign.subject}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 max-h-96 overflow-y-auto border-t">
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 font-sans"
                        dangerouslySetInnerHTML={{ __html: campaign.body.replace(/\n/g, "<br/>") }}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Follow ups */}
                {campaign.followUpSteps.map((step, idx) => {
                  // Count how many recipients have received this follow-up
                  const sentCount = campaign.recipients.filter(rec => 
                    rec.sentEmails?.some(email => email.followUpStepId === step.id)
                  ).length;
                  const totalRecipients = campaign.recipients.length;

                  return (
                    <div key={step.id} className="relative pl-12">
                      <div className="absolute left-0 top-6 w-10 h-10 rounded-full bg-amber-100 border-4 border-background flex items-center justify-center shadow-sm z-10">
                        {sentCount > 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <Card className="rounded-2xl border shadow-sm hover:border-amber-500/30 transition-colors group">
                        <CardHeader className="bg-muted/20 pb-3 border-b">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <CardTitle className="text-base text-foreground font-bold">Follow-up {idx + 1}</CardTitle>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded-md border border-amber-200 whitespace-nowrap">
                                  Wait {step.delayValue} {step.delayUnit}
                                </span>
                                <Badge variant="secondary" className="font-semibold text-amber-700 bg-amber-100 text-xs">Follow-up {step.stepNumber}</Badge>
                                {sentCount > 0 && (
                                  <Badge className="font-semibold text-emerald-700 bg-emerald-100 border-emerald-200 border text-xs">
                                    Sent {sentCount}/{totalRecipients}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link href={`/campaigns/${campaignId}/preview?step=${step.stepNumber}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg gap-2 text-slate-600 border-slate-200"
                                  title="Preview follow-up"
                                >
                                  <Mail className="w-4 h-4" />
                                  <span className="hidden sm:inline text-sm">Preview</span>
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg gap-2 text-blue-600 border-blue-200"
                                onClick={() => openTestEmailDialog(step.stepNumber, idx + 1)}
                                title="Send test email"
                              >
                                <Zap className="w-4 h-4" />
                                <span className="hidden sm:inline text-sm">Test</span>
                              </Button>
                              <FollowUpStepDialog
                                campaignId={campaign.id}
                                originalSubject={campaign.subject}
                                originalBody={campaign.body}
                                nextStepNumber={nextStepNumber}
                                editStep={step}
                              />
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="rounded-lg gap-2 text-destructive border-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteStep(step.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline text-sm">Delete</span>
                              </Button>
                            </div>
                            <CardDescription className="font-medium text-foreground text-sm">Subject: {step.subject}</CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 max-h-96 overflow-y-auto border-t">
                          <div 
                            className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 font-sans"
                            dangerouslySetInnerHTML={{ __html: step.body.replace(/\n/g, "<br/>") }}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}

                {/* Add new */}
                <div className="relative pl-12 pt-2">
                  <div className="absolute left-[0.875rem] top-6 w-3 h-3 rounded-full bg-border border-4 border-background z-10" />
                  <FollowUpStepDialog 
                    campaignId={campaign.id} 
                    originalSubject={campaign.subject}
                    originalBody={campaign.body}
                    nextStepNumber={nextStepNumber}
                  />
                </div>

              </div>
            </div>
          </TabsContent>

        </div>
      </Tabs>

      {/* Edit Campaign Dialog */}
      {showEditCampaignDialog && campaign && (
        <EditCampaignDialog 
          campaign={campaign} 
          campaignId={campaignId}
          isOpen={showEditCampaignDialog}
          onOpenChange={setShowEditCampaignDialog}
        />
      )}

      {/* Test Email Dialog */}
      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Send test email to:
              </label>
              <Input
                placeholder="example@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                {displayStepNumber === 0 ? "Testing Initial Email" : displayStepNumber !== undefined ? `Testing Follow-up ${displayStepNumber}` : ""}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTestEmailDialog(false)}
              disabled={sendTestEmailMutation.isPending}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={!testEmail.trim() || sendTestEmailMutation.isPending}
              className="rounded-lg gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {sendTestEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Test Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
