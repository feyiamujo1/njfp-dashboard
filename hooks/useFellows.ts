import { useQuery } from "@tanstack/react-query";
import { fellowService } from "@/lib/services/fellowService";
import { STALE_TIME } from "@/lib/constants";

export function useFellows() {
  return useQuery({
    queryKey: ["fellows"],
    queryFn: () => fellowService.getFellowList(),
    staleTime: STALE_TIME,
  });
}
