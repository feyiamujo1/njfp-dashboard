import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function useEngagement() {
  return useQuery({
    queryKey: ["engagement"],
    queryFn: () => dashboardService.getEngagement(),
    staleTime: STALE_TIME,
  });
}
