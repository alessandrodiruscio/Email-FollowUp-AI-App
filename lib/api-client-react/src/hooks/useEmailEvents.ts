import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";
import { GetEmailEventsResponse, EmailEventResponse } from "@workspace/api-zod";

const getEmailEventsUrl = (campaignId: number, recipientId: number) => {
  return `/api/campaigns/${campaignId}/recipients/${recipientId}/events`;
};

const getEmailEvents = async (
  campaignId: number,
  recipientId: number,
  options?: RequestInit,
) => {
  return customFetch<GetEmailEventsResponse>(
    getEmailEventsUrl(campaignId, recipientId),
    {
      ...options,
      method: "GET",
    },
  );
};

export const getEmailEventsQueryKey = (campaignId: number, recipientId: number) => {
  return [getEmailEventsUrl(campaignId, recipientId)] as const;
};

export function useEmailEvents(
  campaignId: number,
  recipientId: number,
  options?: {
    query?: UseQueryOptions<GetEmailEventsResponse>;
    request?: RequestInit;
  },
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};

  return useQuery({
    queryKey: getEmailEventsQueryKey(campaignId, recipientId),
    queryFn: async ({ signal }) => {
      return getEmailEvents(campaignId, recipientId, { signal, ...requestOptions });
    },
    enabled: campaignId > 0 && recipientId > 0,
    ...queryOptions,
  });
}

export type { EmailEventResponse };
