import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function useProgress() {
  return useQuery({
    queryKey: ["progress"],
    queryFn: () => dashboardService.getProgress(),
    staleTime: STALE_TIME,
  });
}
