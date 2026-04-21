import { useState } from "react";
import { Link } from "wouter";
import { useListCampaigns, useDeleteCampaign, getListCampaignsQueryKey, useListReasons, useGetCampaign, useMarkReplied, getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Users, 
  Reply,
  Trash2,
  Inbox,
  Clock,
  Edit2,
  Calendar,
  LayoutGrid,
  Filter,
  CheckCircle2,
  StopCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, getStatusColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { CampaignCalendarView } from "@/components/campaigns/CampaignCalendarView";

function RecipientsDialog({ campaignId }: { campaignId: number }) {
  const { data: campaign, isLoading } = useGetCampaign(campaignId);
  const markRepliedMutation = useMarkReplied();
  const queryClient = useQueryClient();

  const handleMarkReplied = (recipientId: number, currentStatus: boolean) => {
    markRepliedMutation.mutate({ id: campaignId, recipientId, replied: !currentStatus }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-lg">
          <Users className="w-4 h-4" />
          Recipients
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Recipients</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : campaign?.recipients && campaign.recipients.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {campaign.recipients.map((recipient) => (
              <div key={recipient.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-sm">{recipient.name}</p>
                  <p className="text-xs text-muted-foreground">{recipient.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkReplied(recipient.id, recipient.replied)}
                  className={recipient.replied ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-600 hover:bg-slate-50"}
                  disabled={markRepliedMutation.isPending}
                >
                  {recipient.replied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Replied
                    </>
                  ) : (
                    <>
                      <StopCircle className="w-4 h-4 mr-1.5" />
                      Mark Replied
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No recipients yet</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Campaigns() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { data: campaignsData, isLoading } = useListCampaigns();
  const campaigns = campaignsData || [];
  const { data: templatesData = [] } = useListReasons();
  const templates = templatesData || [];
  const deleteMutation = useDeleteCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filteredCampaigns = campaigns?.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesTemplate = selectedTemplateId === "all" || 
      (selectedTemplateId === "none" && !c.reason) ||
      (c.reason && c.reason.id === parseInt(selectedTemplateId, 10));
    return matchesSearch && matchesTemplate;
  });

  // Pagination logic
  const totalPages = filteredCampaigns ? Math.ceil(filteredCampaigns.length / itemsPerPage) : 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCampaigns = filteredCampaigns?.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Reset to page 1 when search or filter changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleTemplateChange = (value: string) => {
    setSelectedTemplateId(value);
    setCurrentPage(1);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({ title: "Campaign deleted" });
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" })
      });
    }
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {viewMode === "grid"
              ? "View all your email campaigns"
              : "View campaign activity timeline"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
              className="gap-2"
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === "calendar" ? "default" : "ghost"}
              onClick={() => setViewMode("calendar")}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>
          </div>
          <Link href="/campaigns/new">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 rounded-xl font-semibold px-6 hover-elevate active-elevate-2 transition-all">
              <Plus className="mr-2 h-5 w-5" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {viewMode === "grid" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 max-w-md relative">
            <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
            <Input 
              placeholder="Search campaigns..." 
              className="pl-10 rounded-xl h-12 bg-card border-muted shadow-sm focus-visible:ring-primary/20"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          
          <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-[200px] h-12 rounded-xl bg-card border-muted shadow-sm focus-visible:ring-primary/20">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <SelectValue placeholder="Filter by template..." />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Templates</SelectItem>
              <SelectItem value="none">No Template</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: template.color }}
                    />
                    {template.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex-1 relative">
        {viewMode === "calendar" ? (
          isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading calendar...</div>
            </div>
          ) : (
            <CampaignCalendarView />
          )
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-none shadow-md">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-4 pt-4 border-t">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : paginatedCampaigns && paginatedCampaigns.length > 0 ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paginatedCampaigns.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group h-full border-none shadow-md hover:shadow-xl transition-all duration-300 flex flex-col bg-card relative overflow-visible">
                  {/* Decorative line */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${campaign.status === 'active' ? 'bg-green-500' : campaign.status === 'completed' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                  
                  {/* Delete menu - positioned absolutely */}
                  <div className="absolute top-4 right-4 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full no-default-hover-elevate">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-muted">
                        <DropdownMenuItem className="text-destructive font-medium focus:bg-destructive/10 cursor-pointer" onClick={() => handleDelete(campaign.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Clickable card content */}
                  <Link href={`/campaigns/${campaign.id}`} className="flex-1 flex flex-col">
                    <CardContent className="p-6 flex-1 flex flex-col cursor-pointer">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Name</p>
                          <p className="text-sm font-medium text-foreground">{campaign.recipientName || "Unnamed"}</p>
                        </div>
                        <Badge variant="outline" className={`px-2.5 py-0.5 font-semibold text-xs border uppercase tracking-wider flex-shrink-0 ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </Badge>
                      </div>

                      <div className="mb-4 space-y-3">
                        {campaign.recipientEmail && (
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Email</p>
                            <p className="text-sm text-foreground truncate">{campaign.recipientEmail}</p>
                          </div>
                        )}
                        {campaign.reason && (
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Template</p>
                            <Badge 
                              style={{ backgroundColor: campaign.reason.color, color: '#fff' }}
                              className="text-xs font-medium"
                            >
                              {campaign.reason.name}
                            </Badge>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Created</p>
                          <p className="text-sm text-foreground">{formatDate(campaign.createdAt)}</p>
                        </div>
                      </div>

                    <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Recipients</span>
                        <div className="flex items-center gap-1.5 text-foreground font-bold">
                          <Users className="w-4 h-4 text-primary" />
                          {campaign.recipientCount}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Sent</span>
                        <div className="flex items-center gap-1.5 text-foreground font-bold">
                          <Mail className="w-4 h-4 text-blue-500" />
                          {campaign.sentCount}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Replies</span>
                        <div className="flex items-center gap-1.5 text-foreground font-bold">
                          <Reply className="w-4 h-4 text-emerald-500" />
                          {campaign.repliedCount}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Follow-ups</span>
                        <div className="flex items-center gap-1.5 text-foreground font-bold">
                          <Clock className="w-4 h-4 text-orange-500" />
                          {campaign.followUpCount ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border/50">
                      <RecipientsDialog campaignId={campaign.id} />
                    </div>
                  </CardContent>
                  </Link>
                </Card>
              </motion.div>
            ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredCampaigns?.length || 0)} of {filteredCampaigns?.length || 0} campaigns
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="min-w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center bg-card rounded-2xl border shadow-sm text-center px-4">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">No campaigns yet</h2>
            <p className="text-muted-foreground max-w-md mb-8">Create your first automated email sequence and start following up with contacts effortlessly.</p>
            <Link href="/campaigns/new">
              <Button size="lg" className="rounded-xl shadow-md">
                <Plus className="mr-2 h-5 w-5" />
                Create First Campaign
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
