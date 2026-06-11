import type { OverviewStats, ModuleProgress } from "@/lib/types";

export const overviewStatsMock: OverviewStats = {
  totalFellows: 5000,
  activeFellows: 2900,
  completionRate: 72,
  avgQuizScore: 68,
  assignmentCompletionRate: 74,
  atRiskCount: 900,
};

export const weeklyActiveMock = [
  { week: "Wk 1", active: 2100 },
  { week: "Wk 2", active: 2250 },
  { week: "Wk 3", active: 2180 },
  { week: "Wk 4", active: 2400 },
  { week: "Wk 5", active: 2350 },
  { week: "Wk 6", active: 2620 },
  { week: "Wk 7", active: 2750 },
  { week: "Wk 8", active: 2900 },
];

export const overviewModuleCompletionMock: ModuleProgress[] = [
  { moduleId: 1, moduleName: "Entrepreneurial Mindset", completionPct: 87, completedCount: 4350, totalFellows: 5000 },
  { moduleId: 2, moduleName: "Opportunity Identification", completionPct: 82, completedCount: 4100, totalFellows: 5000 },
  { moduleId: 3, moduleName: "Customers and Markets", completionPct: 78, completedCount: 3900, totalFellows: 5000 },
  { moduleId: 4, moduleName: "Resources and Legality", completionPct: 74, completedCount: 3700, totalFellows: 5000 },
  { moduleId: 5, moduleName: "Execution", completionPct: 76, completedCount: 3800, totalFellows: 5000 },
  { moduleId: 6, moduleName: "Communication and Growth", completionPct: 73, completedCount: 3650, totalFellows: 5000 },
  { moduleId: 7, moduleName: "Leadership and People", completionPct: 72, completedCount: 3600, totalFellows: 5000 },
];

export const overviewRiskDistributionMock = {
  active: 3650,
  atRisk: 900,
  inactive: 450,
};
