import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Send, 
  Settings, 
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Users
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useListReasons, useDeleteReason, getListReasonsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ReasonTemplateDialog } from "@/components/campaigns/ReasonTemplateDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PREDEFINED_REASON_COLORS } from "@/lib/reasonColors";
import type { Reason } from "@workspace/api-client-react";
import { useCreateReason } from "@workspace/api-client-react";

function LogoHeader() {
  const [logoFile, setLogoFile] = useState<string>("/logo-custom.svg");

  useEffect(() => {
    const logos: Record<string, string> = {
      "custom": "/logo-custom.svg",
      "pulse": "/logo-ai-pulse.svg",
      "connect": "/logo-connect-ai.svg",
      "outreach": "/logo-smart-outreach.svg",
    };
    const selectedLogo = localStorage.getItem("selectedLogo") || "custom";
    setLogoFile(logos[selectedLogo] || logos["custom"]);
  }, []);

  return (
    <img src={logoFile} alt="Email FollowUp AI" className="w-full h-auto object-contain" />
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateColor, setNewTemplateColor] = useState(PREDEFINED_REASON_COLORS[0]);
  const [editingTemplate, setEditingTemplate] = useState<Reason | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: reasonsData } = useListReasons();
  const reasons = Array.isArray(reasonsData) ? reasonsData : [];
  const createReasonMutation = useCreateReason();
  const deleteReasonMutation = useDeleteReason();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) {
      toast({ title: "Please enter a template name", variant: "destructive" });
      return;
    }
    createReasonMutation.mutate(
      { data: { name: newTemplateName, color: newTemplateColor } },
      {
        onSuccess: () => {
          setNewTemplateName("");
          setNewTemplateColor(PREDEFINED_REASON_COLORS[0]);
          setShowNewTemplateDialog(false);
          queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
          toast({ title: "Template created successfully" });
        },
        onError: () => toast({ title: "Failed to create template", variant: "destructive" })
      }
    );
  };

  const handleDeleteTemplate = (id: number) => {
    if (confirm("Delete this template? This won't affect existing campaigns.")) {
      deleteReasonMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReasonsQueryKey() });
          toast({ title: "Template deleted successfully" });
        },
        onError: () => toast({ title: "Failed to delete template", variant: "destructive" })
      });
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Campaigns", href: "/campaigns", icon: Send },
    { name: "Recipients", href: "/recipients", icon: Users },
  ];

  const settings_nav = [
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center px-6 border-b">
        <LogoHeader />
      </SidebarHeader>
      <SidebarContent className="px-3 py-4 flex flex-col overflow-hidden">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`
                        w-full justify-start px-3 py-2.5 h-auto rounded-lg font-medium transition-all duration-200
                        ${isActive 
                          ? 'bg-primary/10 text-primary hover:bg-primary/15' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }
                      `}
                    >
                      <Link href={item.href}>
                        <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        {item.name}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Templates Section */}
        <SidebarGroup className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 mb-2">
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Templates
            </SidebarGroupLabel>
            <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
              <DialogTrigger asChild>
                <button className="p-1 hover:bg-muted rounded transition-colors">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="font-semibold text-sm block mb-2">Template Name</label>
                    <Input
                      placeholder="e.g., Follow-up, Networking, Pitch"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
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
                          onClick={() => setNewTemplateColor(color)}
                          className={`w-full h-10 rounded-lg border-2 transition-all ${
                            newTemplateColor === color
                              ? "border-foreground ring-2 ring-primary"
                              : "border-border hover:border-input"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewTemplateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCreateTemplate}
                      disabled={createReasonMutation.isPending}
                    >
                      {createReasonMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <SidebarGroupContent className="flex-1 overflow-y-auto">
            <SidebarMenu className="space-y-1">
              {reasons.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">No templates yet</p>
              ) : (
                reasons.map((template) => (
                  <SidebarMenuItem key={template.id} className="group">
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: template.color }}
                        />
                        <span className="text-sm font-medium truncate">{template.name}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowEditDialog(true);
                          }}
                          className="p-1 hover:bg-primary/10 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-1 hover:bg-destructive/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="border-t pt-4">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settings_nav.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        w-full justify-start px-3 py-2.5 h-auto rounded-lg font-medium transition-all duration-200
                        ${isActive
                          ? 'bg-primary/10 text-primary hover:bg-primary/15'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }
                      `}
                    >
                      <Link href={item.href}>
                        <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        {item.name}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Edit template dialog */}
      {editingTemplate && (
        <ReasonTemplateDialog
          reason={editingTemplate}
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </Sidebar>
  );
}
