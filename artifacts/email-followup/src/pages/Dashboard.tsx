import * as React from "react";
import { customFetch } from "@workspace/api-client-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, CheckCircle2, Clock, ArrowUpRight, Inbox, MailOpen, MousePointerClick, X, RefreshCw, Activity, Settings2, ExternalLink, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAutoSync } from "@/hooks/useAutoSync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

function WebhookSetupDialog() {
  const origin = window.location.origin;
  const isDev = origin.includes('ais-dev');
  const publicOrigin = isDev ? origin.replace('ais-dev', 'ais-pre') : origin;
  const webhookUrl = `${publicOrigin}/w`;
  const validationUrl = `${publicOrigin}/public-health-check`;
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const verifyLocal = async () => {
    setLocalStatus("Checking...");
    try {
      const res = await fetch("/public-health-check");
      const text = await res.text();
      if (text === "OK-SERVER-IS-UP") {
        setLocalStatus("Server is active locally!");
        toast.success("Internal server is running!");
      } else {
        setLocalStatus("Server returned unexpected response.");
      }
    } catch (e: any) {
      setLocalStatus("Could not reach local server.");
      console.error(e);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard!");
  };

  const testPublicPost = async () => {
    toast.info("Sending test POST to public URL...");
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(webhookUrl + "/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "ping-test", 
          test: true,
          timestamp: new Date().toISOString() 
        }),
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 100)}`);
      }
      
      const data = await res.json();
      if (data.received) {
        toast.success("Public POST succeeded! Your app is fully open.");
        alert("✅ SUCCESS: The public URL responded correctly to a POST request.");
      } else {
        toast.error("Public POST failed. Received unexpected response.");
        alert("❌ FAILED: Received unexpected response from server.");
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Public POST failed: ${msg}`);
      console.error(e);
      alert(`❌ ERROR: Could not reach public URL via POST.\n\nPossible reasons:\n1. App is not Shared in AI Studio\n2. Browser CORS policy blocked the test (server will still work for Resend)\n\nError detail: ${msg}`);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold shadow-sm h-10"
        >
          <Settings2 className="w-4 h-4" />
          Configure Webhooks
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Webhook Configuration
          </DialogTitle>
          <DialogDescription>
            Live tracking for opens, clicks and replies requires a public webhook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">1</Badge>
              Verify App Sharing
            </h4>
            <div className="p-4 bg-muted/30 border rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Internal Server Status:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${localStatus === "Server is active locally!" ? "text-green-600" : "text-muted-foreground"}`}>
                    {localStatus || "Not checked"}
                  </span>
                  <Button size="xs" variant="ghost" onClick={verifyLocal} className="h-6 px-2 text-[10px]">
                    Check Now
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <p className="text-[11px] text-amber-800 font-medium">
                  Resend can ONLY reach your app if you have clicked <strong>"Share"</strong> in the top right of AI Studio.
                </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full gap-2 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 h-8"
                    onClick={() => window.open(validationUrl, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Test Public GET
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full gap-2 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 h-8"
                    onClick={testPublicPost}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Test Public POST
                  </Button>
                  <div className="bg-blue-50 border border-blue-100 p-2 rounded text-[10px] text-blue-800 space-y-1">
                    <p><strong>Note:</strong> If "Test Public POST" fails with "Failed to fetch", it is usually due to browser security (CORS) between Dev and Shared domains.</p>
                    <p>As long as <strong>Test Public GET</strong> shows "OK-SERVER-IS-UP", <strong>Resend webhooks will work perfectly.</strong></p>
                  </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">2</Badge>
              Copy Webhook URL
            </h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded border text-[11px] font-mono break-all line-clamp-1">
                {webhookUrl}
              </code>
              <Button size="sm" onClick={copyWebhook} className="shrink-0 gap-2">
                <Copy className="w-3 h-3" />
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">3</Badge>
              Update Resend Dashboard
            </h4>
            <p className="text-xs text-muted-foreground">
              Go to <a href="https://resend.com/webhooks" target="_blank" className="text-primary hover:underline">Resend Webhooks</a> and add this URL. Select <code>email.opened</code>, <code>email.clicked</code>, and <code>email.bounced</code>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [daysFilter, setDaysFilter] = useState(30);
  const [, setLocation] = useLocation();
  const [selectedDetailType, setSelectedDetailType] = useState<'replied' | 'opened' | 'clicked' | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const { isSyncing, handleSync } = useAutoSync();
  
  const { data: stats, isLoading: isLoadingStats } = useDashboardStats(daysFilter);
  const { data: activityData, isLoading: isLoadingActivity } = useRecentActivity(daysFilter);
  const activity = Array.isArray(activityData) ? activityData : [];

  const fetchDetail = useCallback(async (type: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await customFetch<any[]>(`/api/dashboard/activity-detail?type=${type}&days=${daysFilter}`);
      setDetailData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch detail:", err);
      setDetailData([]);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [daysFilter]);

  useEffect(() => {
    if (selectedDetailType) {
      fetchDetail(selectedDetailType);
    }
  }, [selectedDetailType, fetchDetail]);

  const handleStatClick = (type: 'replied' | 'opened' | 'clicked') => {
    setSelectedDetailType(type);
  };

  const statCards = [
    {
      title: "Open Rate",
      value: `${stats?.openRate ?? 0}%`,
      icon: MailOpen,
      trend: `${stats?.emailsOpened || 0} emails opened`,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      title: "Click Rate",
      value: `${stats?.clickRate ?? 0}%`,
      icon: MousePointerClick,
      trend: `${stats?.emailsClicked || 0} clicks`,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
    {
      title: "Reply Rate",
      value: `${stats?.replyRate ? Math.round(stats.replyRate) : 0}%`,
      icon: CheckCircle2,
      trend: `${stats?.totalReplied || 0} replies received`,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Active Campaigns",
      value: stats?.activeCampaigns || 0,
      icon: Mail,
      trend: "Currently active",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground text-lg">Here's what's happening with your outreach.</p>
        </div>
        
          <div className="flex flex-col gap-6">
            <div className="flex gap-2 flex-wrap items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Today", days: 1 },
                    { label: "Yesterday", days: 2 },
                    { label: "Last 3 days", days: 3 },
                    { label: "Last 7 days", days: 7 },
                    { label: "Last 30 days", days: 30 },
                    { label: "All time", days: 365 },
                  ].map((option) => (
                    <button
                      key={option.days}
                      onClick={() => setDaysFilter(option.days)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        daysFilter === option.days
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <WebhookSetupDialog />
              </div>

            <div className="flex items-center gap-4 bg-background/40 p-4 rounded-xl border">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Sync History</p>
                <p className="text-xs text-muted-foreground text-right font-medium">Force update analytics.</p>
              </div>
              <Button
                variant="default"
                size="lg"
                onClick={() => handleSync(false)}
                disabled={isSyncing}
                className="gap-2 font-bold shadow-lg shadow-primary/20 min-w-[140px]"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {isLoadingStats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px] mb-2" />
                <Skeleton className="h-3 w-[120px]" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, i) => {
            const detailType = stat.title === "Reply Rate" ? "replied" : 
                             stat.title === "Open Rate" ? "opened" : 
                             stat.title === "Click Rate" ? "clicked" : null;
            return (
              <motion.div key={i} variants={item}>
                <button
                  onClick={() => detailType && handleStatClick(detailType as any)}
                  className="w-full text-left"
                  disabled={!detailType}
                >
                  <Card className={`border-none shadow-md transition-all duration-300 relative overflow-hidden group ${
                    detailType ? 'hover:shadow-lg hover:scale-105 cursor-pointer' : ''
                  }`}>
                    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${stat.bg}`} />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="text-3xl font-display font-bold text-foreground">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-2 font-medium flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                        {stat.trend}
                        {detailType && <span className="text-primary">→</span>}
                      </p>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            );
          })
        )}
      </motion.div>

      <div className="grid gap-8">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Recent Activity</CardTitle>
            <CardDescription>Latest emails sent, opened, clicked, and replies received.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-6">
                {activity.map((item, i) => (
                  <div 
                    key={item.id} 
                    className="flex items-start gap-4 relative group cursor-pointer"
                    onClick={() => setLocation(`/campaigns/${item.campaignId}`)}
                  >
                    {i !== activity.length - 1 && (
                      <div className="absolute top-10 left-5 w-px h-full -ml-px bg-border group-hover:bg-primary/20 transition-colors" />
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-background ring-1 ring-border shadow-sm
                      ${item.type === 'replied' ? 'bg-emerald-100 text-emerald-600' : 
                        item.type === 'opened' ? 'bg-purple-100 text-purple-600' :
                        item.type === 'clicked' ? 'bg-pink-100 text-pink-600' :
                        item.type === 'followup_sent' ? 'bg-amber-100 text-amber-600' : 
                        'bg-blue-100 text-blue-600'}
                    `}>
                      {item.type === 'replied' ? <CheckCircle2 className="w-5 h-5" /> : 
                       item.type === 'opened' ? <MailOpen className="w-5 h-5" /> :
                       item.type === 'clicked' ? <MousePointerClick className="w-5 h-5" /> :
                       item.type === 'followup_sent' ? <Clock className="w-5 h-5" /> : 
                       <Mail className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0 bg-muted/30 p-3 rounded-xl border group-hover:border-primary/20 transition-colors">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{item.recipientName}</span>
                        {item.type === 'replied' ? ' replied to ' : 
                         item.type === 'opened' ? ' opened ' :
                         item.type === 'clicked' ? ' clicked ' :
                         ' received '}
                        <span className="font-medium text-primary">{item.campaignName}</span>
                      </p>
                      <p className="text-sm text-muted-foreground truncate mt-1">"{item.subject}"</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.occurredAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-xl border border-dashed">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No recent activity</h3>
                <p className="text-muted-foreground mt-1 max-w-sm">Create a campaign and add recipients to start tracking outreach.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <WebhookDebugSection />
      </div>

      {/* Detail Modal */}
      {selectedDetailType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-2xl shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
              <div>
                <CardTitle className="text-xl">
                  {selectedDetailType === 'replied' ? 'Who Replied' : 
                   selectedDetailType === 'opened' ? 'Who Opened' : 
                   'Who Clicked'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isLoadingDetail ? 'Loading...' : `${detailData.length} records found`}
                </CardDescription>
              </div>
              <button
                onClick={() => setSelectedDetailType(null)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 max-h-96 overflow-y-auto">
              {isLoadingDetail ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : detailData.length > 0 ? (
                <div className="space-y-4">
                  {detailData.map((item, idx) => (
                    <div 
                      key={item.id || idx} 
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-primary/20"
                      onClick={() => {
                        setSelectedDetailType(null);
                        setLocation(`/campaigns/${item.campaignId}`);
                      }}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                        ${item.type === 'replied' ? 'bg-emerald-100 text-emerald-600' : 
                          item.type === 'opened' ? 'bg-purple-100 text-purple-600' :
                          'bg-pink-100 text-pink-600'}
                      `}>
                        {item.type === 'replied' ? <CheckCircle2 className="w-5 h-5" /> : 
                         item.type === 'opened' ? <MailOpen className="w-5 h-5" /> :
                         <MousePointerClick className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.recipientName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.recipientEmail}</p>
                        {item.campaignName && <p className="text-xs text-muted-foreground mt-1">{item.campaignName}</p>}
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.occurredAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Inbox className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No {selectedDetailType}s recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function WebhookDebugSection() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await customFetch<any[]>('/api/dashboard/webhook-debug');
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(fetchLogs, 10000);
    return () => clearInterval(timer);
  }, []);

  const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setActionStatus({ message, type });
    setTimeout(() => setActionStatus(null), 5000);
  };

  return (
    <div className="mt-12 space-y-6 pt-8 border-t border-dashed">
      {actionStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg text-sm font-medium flex items-center shadow-sm border ${
            actionStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            actionStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
            'bg-blue-50 text-blue-700 border-blue-200'
          }`}
        >
          <Activity className="w-4 h-4 mr-2" />
          {actionStatus.message}
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Live Webhook Monitor
          </h3>
          <p className="text-sm text-muted-foreground">Monitor real-time events from Resend. Use this to verify your webhook connection.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              showStatus("Simulating event...");
              try {
                const res = await fetch("/api/webhooks/resend", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "email.opened",
                    created_at: new Date().toISOString(),
                    data: {
                      email_id: "test-debug-" + Math.random().toString(36).substring(7),
                      to: "test@example.com"
                    }
                  })
                });
                const data = await res.json();
                showStatus(`Simulate Success: ${data.status || 'OK'}`, 'success');
                setTimeout(fetchLogs, 500);
              } catch (e: any) {
                showStatus(`Simulate failed: ${e}`, 'error');
              }
            }}
            className="text-xs h-9 bg-primary/5 hover:bg-primary/10 border-primary/20"
          >
            Simulate Event
          </Button>
          <WebhookSetupDialog />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              showStatus("Verifying endpoint...");
              try {
                const res = await fetch("/p", { method: "GET" });
                const data = await res.json();
                showStatus(`Endpoint: ${data.message || 'Active'}`, 'success');
              } catch (e: any) {
                showStatus(`Verify failed: ${e}`, 'error');
              }
            }}
            className="text-xs h-9"
          >
            Test Connection
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchLogs} className="text-xs h-9">
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>
      
      <div className="bg-background rounded-2xl border shadow-sm overflow-hidden min-h-[200px]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            {isLoading ? (
              <RefreshCw className="w-8 h-8 text-muted-foreground/30 animate-spin mb-4" />
            ) : (
              <Activity className="w-8 h-8 text-muted-foreground/30 mb-4" />
            )}
            <h4 className="text-sm font-semibold text-foreground">No events received yet</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Waiting for Resend events. Send a test email and check your Resend dashboard logs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Time</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Event</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Message ID</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {logs.map((log: any) => {
                  let parsedPayload: any;
                  try {
                    parsedPayload = typeof log.payload === 'string' ? JSON.parse(log.payload) : (log.payload || {});
                  } catch (e: any) {
                    parsedPayload = { type: 'invalid_json' };
                  }
                  
                  const emailId = parsedPayload?.data?.email_id || parsedPayload?.email_id || 'N/A';
                  const eventTime = log.receivedAt || log.received_at;
                  
                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono">
                        {eventTime ? new Date(eventTime).toLocaleTimeString() : '--'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${
                          log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                          log.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          log.status === 'skipped' ? 'bg-gray-100 text-gray-700' :
                          log.status === 'orphan' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {log.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {parsedPayload?.type ? parsedPayload.type.replace('email.', '') : 'unknown'}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground truncate max-w-[150px]">
                        {emailId}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-muted-foreground italic">
                        {log.error || 'Successfully processed'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
