import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import type { MentorshipStats } from "@/lib/types";

export function useMentorship(): UseQueryResult<MentorshipStats, Error> {
  return useQuery({
    queryKey: ["mentorship"],
    queryFn: () => dashboardService.getMentorship(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
