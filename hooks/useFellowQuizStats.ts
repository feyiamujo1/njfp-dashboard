import { useQuery } from "@tanstack/react-query";
import { fellowService } from "@/lib/services/fellowService";

export function useFellowQuizStats(id: number, completionPct: number, fellowReady = false) {
  return useQuery({
    queryKey: ["fellow-quiz", id],
    queryFn: () => fellowService.getFellowQuizStats(id, completionPct),
    // Only fire after the fast-path fellow data has loaded so completionPct
    // is the real value — not 0 from the initial render before fellow arrives.
    enabled: !!id && fellowReady,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
