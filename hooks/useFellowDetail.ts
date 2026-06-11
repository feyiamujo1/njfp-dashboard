import { useQuery } from "@tanstack/react-query";
import { fellowService } from "@/lib/services/fellowService";
import { STALE_TIME } from "@/lib/constants";

export function useFellowDetail(id: number) {
  return useQuery({
    queryKey: ["fellow", id],
    queryFn: () => fellowService.getFellowDetail(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  });
}
