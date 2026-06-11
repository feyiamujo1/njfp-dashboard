import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function usePerformance() {
  return useQuery({
    queryKey: ["performance"],
    queryFn: () => dashboardService.getPerformance(),
    staleTime: STALE_TIME,
  });
}
