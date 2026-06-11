import type { ProgressStats } from "@/lib/types";

export const progressMock: ProgressStats = {
  totalEnrolled: 5000,
  startedPct: 89,
  completedPct: 42,
  avgCompletionRate: 77,
  moduleProgress: [
    { moduleId: 1, moduleName: "Entrepreneurial Mindset and Intention", completionPct: 87, completedCount: 4350, totalFellows: 5000 },
    { moduleId: 2, moduleName: "Opportunity Identification & Innovation", completionPct: 82, completedCount: 4100, totalFellows: 5000 },
    { moduleId: 3, moduleName: "Customers and Markets", completionPct: 78, completedCount: 3900, totalFellows: 5000 },
    { moduleId: 4, moduleName: "Resources and Legality", completionPct: 74, completedCount: 3700, totalFellows: 5000 },
    { moduleId: 5, moduleName: "Execution", completionPct: 76, completedCount: 3800, totalFellows: 5000 },
    { moduleId: 6, moduleName: "Communication and Growth", completionPct: 73, completedCount: 3650, totalFellows: 5000 },
    { moduleId: 7, moduleName: "Leadership and People Engagement", completionPct: 72, completedCount: 3600, totalFellows: 5000 },
  ],
  funnel: [
    { stage: "Enrolled", count: 5000, pct: 100 },
    { stage: "Started", count: 4450, pct: 89 },
    { stage: "Midway (Module 4+)", count: 3600, pct: 72 },
    { stage: "Completed", count: 2100, pct: 42 },
  ],
  dropOff: [
    { moduleId: 1, moduleName: "Entrepreneurial Mindset", activePct: 89 },
    { moduleId: 2, moduleName: "Opportunity Identification", activePct: 84 },
    { moduleId: 3, moduleName: "Customers and Markets", activePct: 80 },
    { moduleId: 4, moduleName: "Resources and Legality", activePct: 74 },
    { moduleId: 5, moduleName: "Execution", activePct: 76 },
    { moduleId: 6, moduleName: "Communication and Growth", activePct: 73 },
    { moduleId: 7, moduleName: "Leadership and People", activePct: 72 },
  ],
};
