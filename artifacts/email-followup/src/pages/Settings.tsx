import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { getSettings, saveSettings, type UserSettings } from "@/lib/settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, Trash2, Settings2, FileText, ListOrdered } from "lucide-react";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { useListReasons, useCreateReason, useDeleteReason, getListReasonsQueryKey } from "@workspace/api-client-react";
import type { Reason } from "@workspace/api-client-react";
import { PREDEFINED_REASON_COLORS, getPredefinedColorName } from "@/lib/reasonColors";
import { useQueryClient } from "@tanstack/react-query";
import { ReasonTemplateDialog } from "@/components/campaigns/ReasonTemplateDialog";

const settingsSchema = z.object({
  fromName: z.string().min(1, "Sender name is required"),
  fromEmail: z.string().email("Invalid email address"),
  footerName: z.string().optional(),
  footerTitle: z.string().optional(),
  footerImageUrl: z.string().optional(),
  footerWebsite: z.string().optional(),
  footerWebsiteUrl: z.string().optional(),
  footerFacebook: z.string().optional(),
  footerInstagram: z.string().optional(),
  footerYoutube: z.string().optional(),
});

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [newReasonName, setNewReasonName] = useState("");
  const [newReasonColor, setNewReasonColor] = useState(PREDEFINED_REASON_COLORS[0]);
  const [editingReason, setEditingReason] = useState<Reason | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string>("1");

  const logos = [
    { id: "custom", name: "Professional AI", file: "/logo-custom.svg" },
    { id: "pulse", name: "AI Pulse", file: "/logo-ai-pulse.svg" },
    { id: "connect", name: "Connect AI", file: "/logo-connect-ai.svg" },
    { id: "outreach", name: "Smart Outreach", file: "/logo-smart-outreach.svg" },
  ];

  const handleLogoSelect = (logoId: string) => {
    setSelectedLogo(logoId);
    localStorage.setItem("selectedLogo", logoId);
    toast({ title: `Logo changed to ${logos.find(l => l.id === logoId)?.name}` });
  };

  const { data: reasonsData } = useListReasons();
  const reasons = Array.isArray(reasonsData) ? reasonsData : [];
  const createReasonMutation = useCreateReason();
  const deleteReasonMutation = useDeleteReason();

  const form = useForm<UserSettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      fromName: "",
      fromEmail: "",
    },
  });

  useEffect(() => {
    const settings = getSettings();
    form.reset(settings);
    const savedLogo = localStorage.getItem("selectedLogo") || "custom";
    setSelectedLogo(savedLogo);
    setIsLoading(false);
  }, [form]);

  // Update editingReason when reasons query is refetched
  useEffect(() => {
    if (editingReason && reasons.length > 0) {
      const updatedReason = reasons.find((r) => r.id === editingReason.id);
      if (updatedReason) {
        setEditingReason(updatedReason);
      }
    }
  }, [reasons, editingReason?.id]);

  const onSubmit = (values: UserSettings) => {
    saveSettings(values);
    toast({ title: "Settings saved successfully!" });
  };

  const handleCreateReason = () => {
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

  const handleDeleteReason = (id: number) => {
    deleteReasonMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
          toast({ title: "Reason deleted successfully" });
        },
        onError: () => toast({ title: "Failed to delete reason", variant: "destructive" })
      }
    );
  };

  if (isLoading) {
    return <div className="text-center py-20">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your default email settings.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Sender Information */}
          <Card className="border-none shadow-lg rounded-2xl bg-card overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-primary via-accent to-primary" />
            <CardHeader className="border-b">
              <CardTitle>Default Sender Information</CardTitle>
              <CardDescription>These details will be pre-filled in all new campaigns.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <FormField
                control={form.control}
                name="fromName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Sender Name</FormLabel>
                    <FormControl>
                      <Input className="h-12 rounded-xl bg-muted/50 font-medium" placeholder="Your Name" {...field} />
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
                      <Input type="email" className="h-12 rounded-xl bg-muted/50 font-medium" placeholder="your.email@example.com" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Your email service requires a verified sender domain. The connected account's verified address will be used for delivery.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Email Footer */}
          <Card className="border-none shadow-lg rounded-2xl bg-card overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-green-500 via-green-400 to-green-500" />
            <CardHeader className="border-b">
              <CardTitle>Email Footer Template</CardTitle>
              <CardDescription>This footer will be available in all new campaigns.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="footerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="footerTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm">Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Title" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="footerImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Profile Image</FormLabel>
                    <FormControl>
                      <ImageUploadField
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="https://example.com/image.jpg"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Upload from your computer or paste a URL (HTTPS)</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-6">
                <p className="text-sm font-semibold mb-4">Website & Social Media</p>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="footerWebsite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs">Website Display</FormLabel>
                          <FormControl>
                            <Input placeholder="www.example.com" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="footerWebsiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs">Website URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.example.com" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="footerFacebook"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs">Facebook Username</FormLabel>
                          <FormControl>
                            <Input placeholder="facebook-handle" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="footerInstagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs">Instagram Username</FormLabel>
                          <FormControl>
                            <Input placeholder="instagram-handle" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="footerYoutube"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs">YouTube Channel</FormLabel>
                          <FormControl>
                            <Input placeholder="youtube-channel" className="h-10 rounded-lg bg-muted/50 text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo Selection */}
          <Card className="border-none shadow-lg rounded-2xl bg-card overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
            <CardHeader className="border-b">
              <CardTitle>App Logo</CardTitle>
              <CardDescription>Choose your preferred logo for the Email FollowUp AI app.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {logos.map((logo) => (
                  <div
                    key={logo.id}
                    onClick={() => handleLogoSelect(logo.id)}
                    className={`cursor-pointer p-6 rounded-xl border-2 transition-all ${
                      selectedLogo === logo.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <img src={logo.file} alt={logo.name} className="w-16 h-16 rounded-lg" />
                      <div className="text-center">
                        <p className="font-semibold text-sm">{logo.name}</p>
                        {selectedLogo === logo.id && <Badge className="mt-2">Selected</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Campaign Reasons Management */}
          <Card className="border-none shadow-lg rounded-2xl bg-card overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500" />
            <CardHeader className="border-b">
              <CardTitle>Campaign Reasons &amp; Templates</CardTitle>
              <CardDescription>Each reason can have a default email template and follow-up sequence. When you select a reason while creating a campaign, it will auto-fill the content.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {reasons.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {reasons.map((reason) => {
                    const hasTemplate = !!(reason.templateSubject || reason.templateBody);
                    const followUpCount = reason.followUpTemplates?.length ?? 0;
                    return (
                      <div
                        key={reason.id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50 hover:border-border transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: reason.color }}
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-sm block">{reason.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                              {hasTemplate ? (
                                <Badge variant="secondary" className="text-xs gap-1 h-5 px-1.5">
                                  <FileText className="w-2.5 h-2.5" />
                                  Email template
                                </Badge>
                              ) : null}
                              {followUpCount > 0 ? (
                                <Badge variant="secondary" className="text-xs gap-1 h-5 px-1.5">
                                  <ListOrdered className="w-2.5 h-2.5" />
                                  {followUpCount} follow-up{followUpCount !== 1 ? "s" : ""}
                                </Badge>
                              ) : null}
                              {!hasTemplate && followUpCount === 0 ? (
                                <span className="text-xs text-muted-foreground">No template</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingReason(reason as Reason)}
                            className="h-8 gap-1.5 text-xs rounded-lg"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            Template
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteReason(reason.id)}
                            disabled={deleteReasonMutation.isPending}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-6">No reasons created yet. Create one to get started.</p>
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

          {/* Reason Template Dialog */}
          {editingReason && (
            <ReasonTemplateDialog
              reason={editingReason}
              open={!!editingReason}
              onClose={() => setEditingReason(null)}
            />
          )}

          <div className="flex gap-3">
            <Link href="/campaigns">
              <Button variant="outline" className="rounded-xl font-medium">Cancel</Button>
            </Link>
            <Button type="submit" className="rounded-xl font-bold bg-primary text-white shadow-md gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
