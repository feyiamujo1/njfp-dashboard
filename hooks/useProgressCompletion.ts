import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import type { ProgressCompletionStats } from "@/lib/types";

export function useProgressCompletion(): UseQueryResult<ProgressCompletionStats, Error> {
  return useQuery({
    queryKey: ["progress-completion"],
    queryFn: (): Promise<ProgressCompletionStats> => dashboardService.getProgressCompletion(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
