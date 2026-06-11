import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import { STALE_TIME } from "@/lib/constants";

export function useMentorship() {
  return useQuery({
    queryKey: ["mentorship"],
    queryFn: () => dashboardService.getMentorship(),
    staleTime: STALE_TIME,
  });
}
