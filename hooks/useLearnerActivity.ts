import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import type { LearnerActivityStats } from "@/lib/types";

export function useLearnerActivity(): UseQueryResult<LearnerActivityStats, Error> {
  return useQuery({
    queryKey: ["learner-activity"],
    queryFn: (): Promise<LearnerActivityStats> => dashboardService.getLearnerActivity(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
