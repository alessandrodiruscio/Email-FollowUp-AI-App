import * as React from "react";
import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ArrowLeft, Send, Mail, Users, Clock, CheckCircle2, Trash2, StopCircle, RefreshCw, Pencil, Loader2, Plus, Zap, ChevronDown, ChevronUp, MailOpen, MousePointerClick, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  includeFooter: z.boolean().default(true),
  footerName: z.string().optional(),
  footerTitle: z.string().optional(),
  footerImageUrl: z.string().optional(),
  footerWebsite: z.string().optional(),
  footerWebsiteUrl: z.string().optional(),
  footerFacebook: z.string().optional(),
  footerInstagram: z.string().optional(),
  footerYoutube: z.string().optional(),
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
  opened?: boolean;
  clicked?: boolean;
  openedAt?: Date | string;
  clickedAt?: Date | string;
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

function TimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6 p-5 rounded-2xl bg-muted/30 border border-border/50 text-xs font-semibold">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-blue-500 ring-2 ring-blue-100" />
        <span className="text-foreground/80">Initial Sent</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-amber-500 ring-2 ring-amber-100" />
        <span className="text-foreground/80">Follow-up Sent</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center bg-purple-500 ring-2 ring-purple-100">
          <MailOpen className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-foreground/80">Opened</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center bg-pink-500 ring-2 ring-pink-100">
          <MousePointerClick className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-foreground/80">Clicked</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-foreground/80">Replied</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300" />
        <span className="text-muted-foreground font-normal">Upcoming</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-slate-300 border-2 border-dashed border-slate-400 opacity-60" />
        <span className="text-muted-foreground font-normal">Cancelled</span>
      </div>
    </div>
  );
}

function RecipientTimeline({ recipient, followUpSteps }: { recipient: Recipient; followUpSteps: FollowUpStep[] }) {
  const sentStepIds = new Set(recipient.sentEmails.filter(e => e.followUpStepId).map(e => e.followUpStepId));
  const initialSent = recipient.sentEmails.find(e => e.stepNumber === 0);
  
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-2.5 flex-wrap">
        {recipient.initialSentAt ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ring-2 shadow-sm transition-all cursor-default ${
                initialSent?.clicked ? 'bg-pink-500 ring-pink-100' : 
                initialSent?.opened ? 'bg-purple-500 ring-purple-100' : 
                'bg-blue-500 ring-blue-100'
              }`}>
                {initialSent?.clicked ? <MousePointerClick className="w-3 h-3 text-white" /> : 
                 initialSent?.opened ? <MailOpen className="w-3 h-3 text-white" /> : null}
              </div>
            </TooltipTrigger>
            <TooltipContent className="p-0 border-none shadow-xl">
              <div className="bg-card rounded-lg overflow-hidden border">
                <div className="bg-blue-500 px-3 py-2 text-white text-xs font-bold flex items-center gap-2">
                   <Mail className="w-3.5 h-3.5" /> Initial Email
                </div>
                <div className="p-3 space-y-2 min-w-[180px]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground uppercase tracking-tight font-semibold">Sent</span>
                    <span className="font-medium">{formatDate(String(recipient.initialSentAt))}</span>
                  </div>
                  {initialSent?.opened && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-purple-600 uppercase tracking-tight font-bold">Opened</span>
                      <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{formatDate(String(initialSent.openedAt))}</span>
                    </div>
                  )}
                  {initialSent?.clicked && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-pink-600 uppercase tracking-tight font-bold">Clicked</span>
                      <span className="font-medium text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded">{formatDate(String(initialSent.clickedAt))}</span>
                    </div>
                  )}
                </div>
              </div>
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
                <TooltipTrigger asChild>
                  <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold cursor-default">
                    {step.stepNumber}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="p-3">
                  <p className="font-bold text-xs border-b pb-1 mb-1">Follow-up {step.stepNumber}</p>
                  <p className="text-[10px] text-muted-foreground italic">Campaign hasn't started yet</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          if (wasSent) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ring-2 shadow-sm transition-all cursor-default ${
                    sentEmail?.clicked ? 'bg-pink-500 ring-pink-100' : 
                    sentEmail?.opened ? 'bg-purple-500 ring-purple-100' : 
                    'bg-amber-500 ring-amber-100'
                  }`}>
                    {sentEmail?.clicked ? <MousePointerClick className="w-3 h-3 text-white" /> : 
                     sentEmail?.opened ? <MailOpen className="w-3 h-3 text-white" /> : 
                     <span className="text-white text-[10px] font-bold">{step.stepNumber}</span>}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="p-0 border-none shadow-xl">
                  <div className="bg-card rounded-lg overflow-hidden border">
                    <div className="bg-amber-500 px-3 py-2 text-white text-xs font-bold flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5" /> Follow-up {step.stepNumber}
                    </div>
                    <div className="p-3 space-y-2 min-w-[180px]">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground uppercase tracking-tight font-semibold">Sent</span>
                        <span className="font-medium">{sentEmail?.sentAt ? formatDate(String(sentEmail.sentAt)) : 'N/A'}</span>
                      </div>
                      {sentEmail?.opened && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-600 uppercase tracking-tight font-bold">Opened</span>
                          <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{formatDate(String(sentEmail.openedAt))}</span>
                        </div>
                      )}
                      {sentEmail?.clicked && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-pink-600 uppercase tracking-tight font-bold">Clicked</span>
                          <span className="font-medium text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded">{formatDate(String(sentEmail.clickedAt))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }
          if (isCancelled) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <div className="w-5 h-5 rounded-full bg-slate-300 border-2 border-dashed border-slate-400 opacity-60 flex items-center justify-center text-[10px] text-slate-500 font-bold cursor-default">
                    {step.stepNumber}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="p-3 max-w-[150px]">
                  <p className="font-bold text-xs border-b pb-1 mb-1 text-slate-500">Follow-up {step.stepNumber}</p>
                  <p className="text-[10px] text-muted-foreground italic">Cancelled: Recipient already replied</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          if (isPending) {
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-slate-300 animate-pulse flex items-center justify-center text-[10px] text-slate-500 font-bold cursor-default">
                    {step.stepNumber}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="p-3">
                  <p className="font-bold text-xs border-b pb-1 mb-1">Follow-up {step.stepNumber}</p>
                  <p className="text-[10px] font-medium text-amber-600">Pending</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Scheduled {step.delayValue} {step.delayUnit} after previous</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          return null;
        })}

        {recipient.replied && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-emerald-100 flex items-center justify-center shadow-sm cursor-default">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="p-0 border-none shadow-xl">
              <div className="bg-card rounded-lg overflow-hidden border">
                <div className="bg-emerald-500 px-3 py-2 text-white text-xs font-bold flex items-center gap-2">
                   <CheckCircle2 className="w-3.5 h-3.5" /> Replied
                </div>
                <div className="p-3 min-w-[180px]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground uppercase tracking-tight font-semibold font-semibold">Received</span>
                    <span className="font-bold text-emerald-700">{recipient.repliedAt ? formatDate(String(recipient.repliedAt)) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function EditCampaignDialog({ campaign, campaignId, isOpen, onOpenChange }: { campaign: any; campaignId: number; isOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalOpen(val);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFooterSettings, setShowFooterSettings] = useState(false);
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
      includeFooter: campaign.includeFooter ?? true,
      footerName: campaign.footerName || "",
      footerTitle: campaign.footerTitle || "",
      footerImageUrl: campaign.footerImageUrl || "",
      footerWebsite: campaign.footerWebsite || "",
      footerWebsiteUrl: campaign.footerWebsiteUrl || "",
      footerFacebook: campaign.footerFacebook || "",
      footerInstagram: campaign.footerInstagram || "",
      footerYoutube: campaign.footerYoutube || "",
    }
  });

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      form.reset({
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        includeFooter: campaign.includeFooter ?? true,
        footerName: campaign.footerName || "",
        footerTitle: campaign.footerTitle || "",
        footerImageUrl: campaign.footerImageUrl || "",
        footerWebsite: campaign.footerWebsite || "",
        footerWebsiteUrl: campaign.footerWebsiteUrl || "",
        footerFacebook: campaign.footerFacebook || "",
        footerInstagram: campaign.footerInstagram || "",
        footerYoutube: campaign.footerYoutube || "",
      });
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

              <div className="border-t pt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="includeFooter"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 bg-muted/30">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-semibold text-sm cursor-pointer">
                          Include email footer
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Add contact info and social links to this campaign
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("includeFooter") && (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFooterSettings(!showFooterSettings)}
                      className="text-xs gap-2"
                    >
                      {showFooterSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showFooterSettings ? "Hide" : "Edit"} Footer Details
                    </Button>

                    {showFooterSettings && (
                      <div className="space-y-4 p-4 border rounded-xl bg-muted/10">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="footerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Name</FormLabel>
                                <FormControl><Input className="h-9 text-sm rounded-lg" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="footerTitle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Title</FormLabel>
                                <FormControl><Input className="h-9 text-sm rounded-lg" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="footerImageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Profile Image URL</FormLabel>
                              <FormControl><Input className="h-9 text-sm rounded-lg" {...field} /></FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="footerWebsite"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Website Label</FormLabel>
                                <FormControl><Input className="h-9 text-sm rounded-lg" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="footerWebsiteUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Website URL</FormLabel>
                                <FormControl><Input className="h-9 text-sm rounded-lg" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <FormField
                            control={form.control}
                            name="footerFacebook"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px]">Facebook User</FormLabel>
                                <FormControl><Input className="h-8 text-xs rounded-lg" placeholder="username" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="footerInstagram"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px]">Instagram User</FormLabel>
                                <FormControl><Input className="h-8 text-xs rounded-lg" placeholder="username" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="footerYoutube"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px]">YouTube User</FormLabel>
                                <FormControl><Input className="h-8 text-xs rounded-lg" placeholder="username" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
  const reasons = Array.isArray(reasonsData) ? reasonsData : [];
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
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");

  const handleSend = () => {
    sendMutation.mutate({ id: campaignId }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        toast({ 
          title: res.sent > 0 ? "Sending complete" : "Sending failed", 
          description: res.message,
          variant: res.sent > 0 ? "default" : "destructive"
        });
      },
      onError: (err: any) => {
        const errorMessage = err?.data?.message || err?.data?.error || "Failed to send campaign";
        toast({ 
          title: "Error starting campaign", 
          description: errorMessage, 
          variant: "destructive" 
        });
      }
    });
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
    removeRecipientMut.mutate({ id: campaignId, recipientId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })
    });
  };

  const deleteStep = (stepId: number) => {
    deleteStepMut.mutate({ id: campaignId, stepId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })
    });
  };

  const filteredRecipients = useMemo(() => {
    if (!campaign?.recipients) return [];
    const search = recipientSearchQuery.toLowerCase();
    return campaign.recipients.filter(rec => 
      rec.name.toLowerCase().includes(search) || 
      rec.email.toLowerCase().includes(search)
    );
  }, [campaign?.recipients, recipientSearchQuery]);

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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="lg" 
                  disabled={sendMutation.isPending || campaign.recipients.length === 0}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 font-bold px-8"
                >
                  {sendMutation.isPending ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                  Start Campaign
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start Campaign</AlertDialogTitle>
                  <AlertDialogDescription>
                    Send initial emails to ALL recipients who haven't received it yet?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSend} className="rounded-xl bg-primary text-white font-bold">Start</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-display font-bold">Contact List</h2>
              <div className="flex items-center gap-3 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search recipients..."
                    className="pl-8 h-10 rounded-xl"
                    value={recipientSearchQuery}
                    onChange={(e) => setRecipientSearchQuery(e.target.value)}
                  />
                </div>
                <AddRecipientDialog campaignId={campaign.id} />
              </div>
            </div>

            {campaign.recipients.length > 0 && <TimelineLegend />}

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
                        </th>
                        <th className="px-6 py-4 text-right font-semibold tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredRecipients.map((rec) => (
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
                      {(campaign.includeFooter !== false && campaign.footerName) && (
                        <div className="mt-6 pt-6 border-t border-dashed grayscale opacity-50">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Email Footer Included</p>
                          <div className="flex gap-3 items-start">
                            {campaign.footerImageUrl && <img src={campaign.footerImageUrl} className="w-10 h-10 rounded-full object-cover" />}
                            <div>
                                <p className="font-bold text-sm">{campaign.footerName}</p>
                                {campaign.footerTitle && <p className="text-[10px]">{campaign.footerTitle}</p>}
                            </div>
                          </div>
                        </div>
                      )}
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
                          {(step.includeFooter !== false && campaign.footerName) && (
                            <div className="mt-6 pt-6 border-t border-dashed grayscale opacity-50">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Email Footer Included</p>
                              <div className="flex gap-3 items-start">
                                {campaign.footerImageUrl && <img src={campaign.footerImageUrl} className="w-10 h-10 rounded-full object-cover" />}
                                <div>
                                    <p className="font-bold text-sm">{campaign.footerName}</p>
                                    {campaign.footerTitle && <p className="text-[10px]">{campaign.footerTitle}</p>}
                                </div>
                              </div>
                            </div>
                          )}
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
