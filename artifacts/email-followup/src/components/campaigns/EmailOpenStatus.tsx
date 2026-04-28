import { useEmailEvents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen, MousePointerClick } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type EmailOpenStatusProps = {
  campaignId: number;
  recipientId: number;
};

export function EmailOpenStatus({ campaignId, recipientId }: EmailOpenStatusProps) {
  const { data: events, isLoading } = useEmailEvents(campaignId, recipientId);

  if (isLoading) {
    return <div className="text-muted-foreground text-xs">Loading...</div>;
  }

  if (!events || events.length === 0) {
    return null;
  }

  const latestEmailWithEvent = [...events].reverse().find(e => e.opened || e.clicked);
  
  if (!latestEmailWithEvent) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`border-none font-semibold flex items-center gap-1 w-fit ${
            latestEmailWithEvent.clicked ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          }`}>
            {latestEmailWithEvent.clicked ? <MousePointerClick className="w-3 h-3" /> : <MailOpen className="w-3 h-3" />}
            {latestEmailWithEvent.clicked ? 'Clicked' : 'Opened'}
            {latestEmailWithEvent.stepNumber > 0 && <span className="ml-0.5 text-[10px] opacity-70">(S{latestEmailWithEvent.stepNumber})</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {latestEmailWithEvent.stepNumber === 0 ? 'Initial email' : `Follow-up ${latestEmailWithEvent.stepNumber}`} 
            {latestEmailWithEvent.clicked ? ' clicked' : ' opened'}
          </p>
          {latestEmailWithEvent.openedAt && (
            <p className="text-xs text-muted-foreground">Opened: {new Date(latestEmailWithEvent.openedAt).toLocaleString()}</p>
          )}
          {latestEmailWithEvent.clickedAt && (
            <p className="text-xs text-muted-foreground">Clicked: {new Date(latestEmailWithEvent.clickedAt).toLocaleString()}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
