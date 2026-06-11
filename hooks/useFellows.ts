import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function useFellows() {
  return useQuery({
    queryKey: ["fellows"],
    queryFn: () => dashboardService.getFellowList(),
    staleTime: STALE_TIME,
  });
}
