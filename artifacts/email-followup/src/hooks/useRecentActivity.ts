import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface ActivityItem {
  id: number;
  campaignId: number;
  type: "sent" | "replied" | "followup_sent" | "opened" | "clicked";
  campaignName: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  occurredAt: string;
}

export const getRecentActivityQueryKey = (days: number) => ["dashboard", "recent-activity", days];

export function useRecentActivity(days: number = 30) {
  return useQuery({
    queryKey: getRecentActivityQueryKey(days),
    queryFn: async () => {
      const response = await customFetch<ActivityItem[]>(
        `/api/dashboard/recent-activity?days=${days}`,
        {
          method: "GET",
        }
      );
      return response;
    },
  });
}
