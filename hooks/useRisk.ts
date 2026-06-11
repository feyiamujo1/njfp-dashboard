import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function useRisk() {
  return useQuery({
    queryKey: ["risk"],
    queryFn: () => dashboardService.getRisk(),
    staleTime: STALE_TIME,
  });
}
