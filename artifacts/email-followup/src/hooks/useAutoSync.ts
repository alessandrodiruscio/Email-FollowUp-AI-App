import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";

export function useAutoSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async (silent = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const data = await customFetch<any>("/api/dashboard/sync-analytics", { method: "POST" });
      if (data.success) {
        // Invalidate all dashboard metrics and activity
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        // Also invalidate the generated recent activity key from the client library
        queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        
        if (!silent) {
          toast.success(`Sync complete! Found ${data.updatedCount} new engagement events.`);
        } else if (data.updatedCount > 0) {
          toast.success(`Auto-sync: Found ${data.updatedCount} new events.`);
        }
      } else if (!silent) {
        toast.error(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Sync failed:", err);
      if (!silent) {
        toast.error("Sync failed. Check console for details.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, handleSync };
}

// Global hook to trigger sync on app load
export function useGlobalAutoSync() {
  const { handleSync } = useAutoSync();
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!hasSynced) {
      handleSync(true);
      setHasSynced(true);
    }
  }, [handleSync, hasSynced]);
}
