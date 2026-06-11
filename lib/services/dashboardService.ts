import { progressMock } from "@/lib/mock/progress.mock";
import { engagementMock } from "@/lib/mock/engagement.mock";
import { performanceMock } from "@/lib/mock/performance.mock";
import { mentorshipMock } from "@/lib/mock/mentorship.mock";
import { riskMock } from "@/lib/mock/risk.mock";
import { fellowsMock } from "@/lib/mock/fellows.mock";
import type {
  OverviewStats,
  ModuleProgress,
  ProgressStats,
  EngagementStats,
  PerformanceStats,
  MentorshipStats,
  RiskStats,
  FellowSummary,
} from "@/lib/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    return res.json() as Promise<OverviewData>;
  },

  async getProgress(): Promise<ProgressStats> {
    await delay(400);
    return progressMock;
  },

  async getEngagement(): Promise<EngagementStats> {
    await delay(400);
    return engagementMock;
  },

  async getPerformance(): Promise<PerformanceStats> {
    await delay(400);
    return performanceMock;
  },

  async getMentorship(): Promise<MentorshipStats> {
    await delay(400);
    return mentorshipMock;
  },

  async getRisk(): Promise<RiskStats> {
    await delay(400);
    return riskMock;
  },

  async getFellowList(): Promise<FellowSummary[]> {
    await delay(400);
    return fellowsMock;
  },
};
