import type { PerformanceStats } from "@/lib/types";
import { fellowsMock } from "./fellows.mock";

const topLearners = [...fellowsMock]
  .filter((f) => f.riskLevel === "active")
  .sort((a, b) => b.completionPct - a.completionPct)
  .slice(0, 20);

export const performanceMock: PerformanceStats = {
  avgQuizScore: 68,
  submissionRate: 74,
  passRate: 61,
  failRate: 39,
  quizByModule: [
    { moduleId: 1, moduleName: "Entrepreneurial Mindset", avgScore: 72, passCount: 3420, failCount: 930, attemptCount: 4350 },
    { moduleId: 2, moduleName: "Opportunity Identification", avgScore: 69, passCount: 3050, failCount: 1050, attemptCount: 4100 },
    { moduleId: 3, moduleName: "Customers and Markets", avgScore: 67, passCount: 2800, failCount: 1100, attemptCount: 3900 },
    { moduleId: 4, moduleName: "Resources and Legality", avgScore: 65, passCount: 2500, failCount: 1200, attemptCount: 3700 },
    { moduleId: 5, moduleName: "Execution", avgScore: 70, passCount: 2700, failCount: 1100, attemptCount: 3800 },
    { moduleId: 6, moduleName: "Communication and Growth", avgScore: 66, passCount: 2550, failCount: 1100, attemptCount: 3650 },
    { moduleId: 7, moduleName: "Leadership and People", avgScore: 68, passCount: 2520, failCount: 1080, attemptCount: 3600 },
  ],
  assignmentByModule: [
    { moduleId: 1, moduleName: "Entrepreneurial Mindset", submitted: 3900, notSubmitted: 1100 },
    { moduleId: 2, moduleName: "Opportunity Identification", submitted: 3600, notSubmitted: 1400 },
    { moduleId: 3, moduleName: "Customers and Markets", submitted: 3400, notSubmitted: 1600 },
    { moduleId: 4, moduleName: "Resources and Legality", submitted: 3100, notSubmitted: 1900 },
    { moduleId: 5, moduleName: "Execution", submitted: 3300, notSubmitted: 1700 },
    { moduleId: 6, moduleName: "Communication and Growth", submitted: 3050, notSubmitted: 1950 },
    { moduleId: 7, moduleName: "Leadership and People", submitted: 3000, notSubmitted: 2000 },
  ],
  topLearners,
};
