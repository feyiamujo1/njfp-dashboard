import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";

export function useOverviewCompletion() {
  return useQuery({
    queryKey: ["overview-completion"],
    queryFn: () => dashboardService.getOverviewCompletion(),
    staleTime: 30 * 60 * 1000, // matches 30-min server cache TTL
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
