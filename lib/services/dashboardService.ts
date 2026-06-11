import type {
  OverviewStats,
  ModuleProgress,
  ProgressStats,
  EngagementStats,
  PerformanceStats,
  MentorshipStats,
  RiskStats,
} from "@/lib/types";

export interface OverviewData {
  stats: OverviewStats;
  weeklyActive: { week: string; active: number }[];
  moduleCompletion: ModuleProgress[];
  riskDistribution: { active: number; atRisk: number; inactive: number };
}

export const dashboardService = {
  async getOverview(): Promise<OverviewData> {
    const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    console.log("The getOverview is  ", res?.json());
    return res.json() as Promise<OverviewData>;
  },

  async getProgress(): Promise<ProgressStats> {
    const res = await fetch("/api/dashboard/progress", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    console.log("The getProgress is  ", res?.json());
    return res.json() as Promise<ProgressStats>;
  },

  async getEngagement(): Promise<EngagementStats> {
    const res = await fetch("/api/dashboard/engagement", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    console.log("The getEngagement is  ", res?.json());
    return res.json() as Promise<EngagementStats>;
  },

  async getPerformance(): Promise<PerformanceStats> {
    const res = await fetch("/api/dashboard/performance", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    console.log("The getPerformance is  ", res?.json());
    return res.json() as Promise<PerformanceStats>;
  },

  async getMentorship(): Promise<MentorshipStats> {
    const res = await fetch("/api/dashboard/mentorship", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    return res.json() as Promise<MentorshipStats>;
  },

  async getRisk(): Promise<RiskStats> {
    const res = await fetch("/api/dashboard/risk", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    console.log("The getRisk is  ", res?.json());
    return res.json() as Promise<RiskStats>;
  },

};
