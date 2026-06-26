import type {
  OverviewStats,
  OverviewCompletionStats,
  ProgressStats,
  ProgressCompletionStats,
  EngagementStats,
  LearnerActivityStats,
  ModuleDetailStats,
  MentorshipStats,
} from "@/lib/types";

export interface OverviewData {
  stats: OverviewStats;
  weeklyActive: { week: string; active: number }[];
  riskDistribution: { active: number; atRisk: number; inactive: number };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const dashboardService = {
  getOverview: () => fetchJson<OverviewData>("/api/dashboard/overview"),
  getOverviewCompletion: () => fetchJson<OverviewCompletionStats>("/api/dashboard/overview/completion"),
  getProgress: () => fetchJson<ProgressStats>("/api/dashboard/progress"),
  getProgressCompletion: () => fetchJson<ProgressCompletionStats>("/api/dashboard/progress/completion"),
  getEngagement: () => fetchJson<EngagementStats>("/api/dashboard/engagement"),
  getLearnerActivity: () => fetchJson<LearnerActivityStats>("/api/dashboard/engagement/completion"),
  getModuleDetail: (moduleId: number) =>
    fetchJson<ModuleDetailStats>(`/api/dashboard/modules/${moduleId}`),
  getMentorship: () => fetchJson<MentorshipStats>("/api/dashboard/mentorship"),
};
