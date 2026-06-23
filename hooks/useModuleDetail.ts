import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { dashboardService } from "@/lib/services/dashboardService";
import type { ModuleDetailStats } from "@/lib/types";

export function useModuleDetail(moduleId: number): UseQueryResult<ModuleDetailStats, Error> {
  return useQuery({
    queryKey: ["module-detail", moduleId],
    queryFn: () => dashboardService.getModuleDetail(moduleId),
    enabled: Number.isFinite(moduleId) && moduleId > 0,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
