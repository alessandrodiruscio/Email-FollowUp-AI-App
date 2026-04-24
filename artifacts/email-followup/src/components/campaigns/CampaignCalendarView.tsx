import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListCampaignsWithDetails } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Mail, Clock, ArrowRight, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Helper function to get local date string (YYYY-MM-DD) without timezone conversion
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function WeeklyView({ currentDate, events, getEventsForDate }: any) {
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Week of {weekDays[0].toLocaleDateString()} - {weekDays[6].toLocaleDateString()}
      </div>
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((date, idx) => {
          const dayEvents = getEventsForDate(date);
          const dateStr = getLocalDateString(date);
          const isToday = dateStr === getLocalDateString(new Date());
          
          return (
            <div
              key={idx}
              className={`rounded-lg border-2 p-4 flex flex-col min-h-52 overflow-hidden ${
                isToday
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              } ${dayEvents.length > 0 ? "bg-card" : "bg-muted/30"}`}
            >
              <div className={`font-bold mb-4 ${isToday ? "text-primary" : "text-foreground"}`}>
                <div className="text-sm">{WEEKDAYS[date.getDay()]}</div>
                <div className="text-lg">{date.getDate()}</div>
              </div>

              {dayEvents.length > 0 ? (
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {dayEvents.map((event, i) => (
                    <Link
                      key={i}
                      href={`/campaigns/${event.campaignId}`}
                    >
                      <div 
                        className={`p-3 rounded text-xs font-medium hover:shadow-md cursor-pointer transition-all border ${
                          event.type === "sent"
                            ? "bg-blue-50 text-blue-900 border-blue-200"
                            : "bg-amber-50 text-amber-900 border-amber-200"
                        }`}
                      >
                        <div className="font-semibold mb-2">
                          {event.type === "sent" ? "Initial email" : `Follow-up #${event.followUpDetails?.stepNumber}`}
                        </div>
                        {event.type === "sent" && (
                          <div className="text-xs opacity-85">
                            {event.count} recipient{event.count !== 1 ? 's' : ''}
                          </div>
                        )}
                        {event.type === "followup" && event.followUpDetails && (
                          <>
                            <div className="text-xs opacity-90">
                              {event.followUpDetails.recipientName}
                            </div>
                            <div className="text-xs opacity-75 break-words">
                              {event.followUpDetails.recipientEmail}
                            </div>
                          </>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                  No emails scheduled
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FollowUpEvent {
  stepNumber: number;
  subject: string;
  recipientCount?: number;
  recipientName?: string;
  recipientEmail?: string;
  campaignId: number;
}

interface CalendarEvent {
  date: string;
  campaignId: number;
  campaignName: string;
  type: "sent" | "scheduled" | "followup";
  count: number;
  reasonName?: string;
  reasonColor?: string;
  followUpDetails?: FollowUpEvent;
}

export function CampaignCalendarView() {
  const { data: campaigns = [] } = useListCampaignsWithDetails();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");

  // Group campaigns by dates, including follow-up scheduled dates
  const events = useMemo(() => {
    const eventMap: Record<string, CalendarEvent[]> = {};

    campaigns.forEach((campaign) => {
      // Add sent email event (initial email)
      if (campaign.sentCount > 0) {
        const dateStr = campaign.createdAt.split("T")[0];
        const key = dateStr;
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({
          date: dateStr,
          campaignId: campaign.id,
          campaignName: campaign.name,
          type: "sent",
          count: campaign.sentCount,
          reasonName: campaign.reason?.name,
          reasonColor: campaign.reason?.color,
        });
      }

      // Add follow-up scheduled events (one per recipient)
      if (campaign.recipients && campaign.followUpSteps && campaign.followUpSteps.length > 0) {
        campaign.recipients.forEach((recipient: any) => {
          if (recipient.initialSentAt && !recipient.replied) {
            const initialDate = new Date(recipient.initialSentAt);
            let accumulatedDelayMs = 0; // Accumulate delays across steps
            
            campaign.followUpSteps.forEach((step: any) => {
              // Calculate delay for this step and add to accumulated delay
              let stepDelayMs = 0;
              
              if (step.delayUnit === "minutes") {
                stepDelayMs = step.delayValue * 60 * 1000;
              } else if (step.delayUnit === "hours") {
                stepDelayMs = step.delayValue * 60 * 60 * 1000;
              } else if (step.delayUnit === "days") {
                stepDelayMs = step.delayValue * 24 * 60 * 60 * 1000;
              }
              
              // Accumulate the delay (each step adds to the previous)
              accumulatedDelayMs += stepDelayMs;
              const scheduledDate = new Date(initialDate.getTime() + accumulatedDelayMs);
              const dateStr = getLocalDateString(scheduledDate);
              
              if (!eventMap[dateStr]) eventMap[dateStr] = [];
              
              // Create individual event for each recipient's follow-up
              eventMap[dateStr].push({
                date: dateStr,
                campaignId: campaign.id,
                campaignName: campaign.name,
                type: "followup",
                count: 1,
                reasonName: campaign.reason?.name,
                reasonColor: campaign.reason?.color,
                followUpDetails: {
                  stepNumber: step.stepNumber,
                  subject: step.subject,
                  recipientName: recipient.name,
                  recipientEmail: recipient.email,
                  campaignId: campaign.id,
                },
              });
            });
          }
        });
      }
    });

    return eventMap;
  }, [campaigns]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    if (viewMode === "weekly") {
      // Navigate back by 1 week
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      // Navigate back by 1 month
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (viewMode === "weekly") {
      // Navigate forward by 1 week
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      // Navigate forward by 1 month
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const getDateString = (day: number) => {
    return getLocalDateString(new Date(year, month, day));
  };

  const getEventsForDate = (day: number): CalendarEvent[] => {
    const dateStr = getDateString(day);
    return events[dateStr] || [];
  };

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;
  const currentDay = today.getDate();

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary via-accent to-primary text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {MONTHS[month]} {year}
              </CardTitle>
              <p className="text-xs text-white/80 mt-1">Email campaign timeline</p>
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex gap-1 border border-white/30 rounded-lg p-1 bg-white/10 backdrop-blur">
                <Button
                  variant={viewMode === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("monthly")}
                  className={`h-8 ${viewMode === "monthly" ? "bg-white text-primary" : "text-white hover:bg-white/20"}`}
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "weekly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("weekly")}
                  className={`h-8 ${viewMode === "weekly" ? "bg-white text-primary" : "text-white hover:bg-white/20"}`}
                >
                  Week
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="text-white hover:bg-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {viewMode === "monthly" ? (
            <>
              {/* Monthly View */}
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-semibold text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days - larger boxes */}
              <div className="grid grid-cols-7 gap-3">
                {days.map((day, idx) => {
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-24 bg-muted/20 rounded-lg"
                      />
                    );
                  }

                  const dayEvents = getEventsForDate(day);
                  const isToday = isCurrentMonth && day === currentDay;

                  return (
                    <motion.div
                      key={day}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                      <div
                        className={`min-h-24 rounded-lg border-2 p-3 flex flex-col cursor-pointer transition-all hover:shadow-md overflow-hidden ${
                          isToday
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        } ${dayEvents.length > 0 ? "bg-card" : "bg-muted/30"}`}
                      >
                        <div
                          className={`text-sm font-bold mb-2 ${
                            isToday ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {day}
                        </div>

                        {dayEvents.length > 0 && (
                          <div className="flex-1 min-w-0 overflow-y-auto space-y-2">
                            {dayEvents.slice(0, 3).map((event, i) => (
                              <Link
                                key={`${day}-${i}`}
                                href={`/campaigns/${event.campaignId}`}
                              >
                                <div 
                                  className={`text-xs p-2 rounded font-medium hover:shadow-sm cursor-pointer transition-all ${
                                    event.type === "sent" 
                                      ? "bg-blue-50 text-blue-900 border border-blue-200" 
                                      : "bg-amber-50 text-amber-900 border border-amber-200"
                                  }`}
                                  title={event.type === "followup" && event.followUpDetails 
                                    ? `Follow-up #${event.followUpDetails.stepNumber} to ${event.followUpDetails.recipientName} (${event.followUpDetails.recipientEmail}): ${event.followUpDetails.subject}`
                                    : `Initial email - ${event.campaignName}${event.reasonName ? ` (${event.reasonName})` : ''}`}
                                >
                                  <div className="font-semibold mb-1">
                                    {event.type === "sent" ? "Initial email" : `Follow-up #${event.followUpDetails?.stepNumber}`}
                                  </div>
                                  {event.type === "sent" && (
                                    <div className="text-xs opacity-85">
                                      {event.count} recipient{event.count !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                  {event.type === "followup" && event.followUpDetails && (
                                    <>
                                      <div className="text-xs opacity-90 truncate">
                                        {event.followUpDetails.recipientName}
                                      </div>
                                      <div className="text-xs opacity-75 truncate">
                                        {event.followUpDetails.recipientEmail}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </Link>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-xs text-muted-foreground px-1 mt-1">
                                +{dayEvents.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Weekly View */}
              <WeeklyView currentDate={currentDate} events={events} getEventsForDate={(day) => {
                const dateStr = getLocalDateString(day);
                return events[dateStr] || [];
              }} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Events list */}
      {Object.entries(events).length > 0 && (
        <Card className="border-none shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(events)
                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                .slice(0, 10)
                .map(([date, dateEvents]) => (
                  <div key={date} className="flex items-start gap-4 pb-3 border-b last:border-0">
                    <div className="text-sm font-semibold text-muted-foreground min-w-[100px]">
                      {formatDate(date)}
                    </div>
                    <div className="flex-1 space-y-2">
                      {dateEvents.map((event, i) => (
                        <Link
                          key={i}
                          href={`/campaigns/${event.campaignId}`}
                          className="block"
                        >
                          <div className="flex flex-col gap-1 p-2 rounded-lg hover:bg-muted transition-colors border-l-4" style={{ borderLeftColor: event.type === "sent" ? '#3b82f6' : '#f59e0b' }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {event.type === "sent" ? (
                                  <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                ) : event.type === "followup" ? (
                                  <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-bold">
                                    {event.type === "sent" ? "Initial email" : `Follow-up #${event.followUpDetails?.stepNumber}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {event.campaignName}
                                  </span>
                                </div>
                                {event.reasonName && (
                                  <Badge 
                                    style={{ backgroundColor: event.reasonColor, color: '#fff' }}
                                    className="text-xs font-medium flex-shrink-0"
                                  >
                                    {event.reasonName}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="flex-shrink-0 text-xs">
                                {event.type === "sent" ? "sent" : "scheduled"}
                              </Badge>
                            </div>
                            {event.type === "followup" && event.followUpDetails && (
                              <div className="text-xs text-muted-foreground ml-6 space-y-1 bg-muted/40 p-2 rounded">
                                <div className="font-medium text-foreground">
                                  → {event.followUpDetails.recipientName}
                                </div>
                                <div className="font-mono text-xs text-muted-foreground">
                                  {event.followUpDetails.recipientEmail}
                                </div>
                                <div className="text-xs italic">"{event.followUpDetails.subject}"</div>
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
