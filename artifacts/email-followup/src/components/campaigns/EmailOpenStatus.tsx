import { useEmailEvents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen } from "lucide-react";
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

  const initialEmail = events.find(e => !e.stepNumber || e.stepNumber === 0);
  
  if (!initialEmail) {
    return null;
  }

  if (initialEmail.opened) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none font-semibold flex items-center gap-1 w-fit">
              <MailOpen className="w-3 h-3" />
              Opened
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Email opened</p>
            {initialEmail.openedAt && (
              <p className="text-xs text-muted-foreground">{new Date(initialEmail.openedAt).toLocaleString()}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
