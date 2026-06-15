import { useQuery } from "@tanstack/react-query";
import { fellowService } from "@/lib/services/fellowService";

export function useFellowQuizStats(id: number, completionPct: number) {
  return useQuery({
    queryKey: ["fellow-quiz", id],
    queryFn: () => fellowService.getFellowQuizStats(id, completionPct),
    enabled: !!id,
    staleTime: 60 * 60 * 1000, // 1 hour — matches server-side cache TTL
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
