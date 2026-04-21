import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRecipients: number;
  totalReplied: number;
  replyRate: number;
  pendingFollowUps: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  openRate: number;
  clickRate: number;
}

export function useDashboardStats(days: number = 30) {
  return useQuery({
    queryKey: ["dashboard", "stats", days],
    queryFn: async () => {
      const response = await customFetch<DashboardStats>(
        `/api/dashboard/stats?days=${days}`,
        {
          method: "GET",
        }
      );
      return response;
    },
  });
}
