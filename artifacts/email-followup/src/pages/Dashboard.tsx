import { useGetRecentActivity } from "@workspace/api-client-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, CheckCircle2, Users, Clock, ArrowUpRight, Inbox, MailOpen, MousePointerClick, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState } from "react";

export default function Dashboard() {
  const [daysFilter, setDaysFilter] = useState(30);
  const [selectedDetailType, setSelectedDetailType] = useState<'replied' | 'opened' | 'clicked' | null>(null);
  const { data: stats, isLoading: isLoadingStats } = useDashboardStats(daysFilter);
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();
  
  const filteredActivity = selectedDetailType 
    ? activity?.filter(item => item.type === selectedDetailType) || []
    : [];

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
        
        <div className="flex gap-2 flex-wrap items-center justify-between">
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
                  onClick={() => detailType && setSelectedDetailType(detailType as any)}
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
                  <div key={item.id} className="flex items-start gap-4 relative group">
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
                  {filteredActivity.length} {selectedDetailType} {selectedDetailType === 'replied' ? 'replies' : selectedDetailType === 'opened' ? 'opens' : 'clicks'}
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
              {filteredActivity.length > 0 ? (
                <div className="space-y-4">
                  {filteredActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
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
                        <p className="text-xs text-muted-foreground mt-1">{item.campaignName}</p>
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
