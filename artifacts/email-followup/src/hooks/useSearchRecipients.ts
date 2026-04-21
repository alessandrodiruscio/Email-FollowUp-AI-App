import { useState, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";

export interface SearchResult {
  id: number;
  name: string;
  email: string;
  campaignId: number;
  campaignName: string;
  sentCount: number;
  initialSentAt: string | null;
}

export function useSearchRecipients() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await customFetch<SearchResult[]>(
        `/api/search/recipients?q=${encodeURIComponent(query)}`
      );
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Failed to search recipients");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}
