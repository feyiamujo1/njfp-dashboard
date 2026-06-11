import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => dashboardService.getOverview(),
    staleTime: STALE_TIME,
  });
}
