import { useQuery } from "@tanstack/react-query";
import { fellowService } from "@/lib/services/fellowService";

export function useFellowDetail(id: number, lastCourseAccess?: number) {
  return useQuery({
    queryKey: ["fellow", id],
    queryFn: () => fellowService.getFellowDetail(id, lastCourseAccess),
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
