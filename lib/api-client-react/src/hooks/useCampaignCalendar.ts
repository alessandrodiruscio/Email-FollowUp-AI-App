import { useQuery, type UseQueryResult, type QueryKey } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";
import type { Campaign } from "../generated/api.schemas";

export const getListCampaignsWithDetailsQueryKey = () => {
  return ["/api/campaigns", { include_details: "true" }] as const;
};

export const listCampaignsWithDetails = async (options?: RequestInit): Promise<Campaign[]> => {
  return customFetch<Campaign[]>("/api/campaigns?include_details=true", {
    ...options,
    method: "GET",
  });
};

/**
 * Custom hook to fetch all campaigns with full recipients and follow-up steps.
 * Designed specifically for the Calendar view.
 */
export function useListCampaignsWithDetails(): UseQueryResult<Campaign[], Error> & { queryKey: QueryKey } {
  const queryKey = getListCampaignsWithDetailsQueryKey() as unknown as QueryKey;
  
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => listCampaignsWithDetails({ signal }),
  }) as UseQueryResult<Campaign[], Error> & { queryKey: QueryKey };

  return { ...query, queryKey };
}
