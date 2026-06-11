import { fellowsMock } from "@/lib/mock/fellows.mock";
import { MODULES } from "@/lib/constants";
import type { FellowSummary, FellowDetail } from "@/lib/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fellowService = {
  async getFellowList(): Promise<FellowSummary[]> {
    await delay(400);
    return fellowsMock;
  },

  async getFellowDetail(id: number): Promise<FellowDetail | null> {
    await delay(500);
    const fellow = fellowsMock.find((f) => f.id === id);
    if (!fellow) return null;

    return {
      ...fellow,
      moduleProgress: MODULES.map((m, i) => ({
        moduleId: m.id,
        moduleName: m.name,
        completionPct: Math.max(
          0,
          Math.min(100, fellow.completionPct - i * 4 + (i % 3) * 2)
        ),
        completedCount: 1,
        totalFellows: 5000,
      })),
      quizStats: MODULES.map((m, i) => ({
        moduleId: m.id,
        moduleName: m.name,
        avgScore: Math.max(
          0,
          Math.min(100, fellow.avgQuizScore + (i % 5 - 2) * 4)
        ),
        passCount: fellow.avgQuizScore >= 50 ? 1 : 0,
        failCount: fellow.avgQuizScore < 50 ? 1 : 0,
        attemptCount: fellow.completionPct > (i / 7) * 100 ? 1 : 0,
      })),
      assignments: MODULES.map((m, i) => ({
        id: i + 1,
        name: `${m.name} — Assignment`,
        moduleId: m.id,
        moduleName: m.name,
        submitted: i < fellow.assignmentsSubmitted,
        submittedAt:
          i < fellow.assignmentsSubmitted
            ? fellow.lastcourseaccess - (6 - i) * 86400 * 2
            : undefined,
        grade:
          i < fellow.assignmentsSubmitted
            ? Math.max(
                0,
                Math.min(100, fellow.avgQuizScore + (i % 3 - 1) * 5)
              )
            : undefined,
      })),
      activityTimeline: [
        {
          id: 1,
          description: `Completed a lesson in ${MODULES[0].name}`,
          timestamp: fellow.lastcourseaccess,
          type: "completion" as const,
        },
        {
          id: 2,
          description: `Attempted quiz for ${MODULES[0].name}`,
          timestamp: fellow.lastcourseaccess - 86400,
          type: "quiz" as const,
        },
        {
          id: 3,
          description: "Posted in module forum discussion",
          timestamp: fellow.lastcourseaccess - 86400 * 2,
          type: "forum" as const,
        },
        {
          id: 4,
          description: "Logged in to the platform",
          timestamp: fellow.lastcourseaccess - 86400 * 3,
          type: "login" as const,
        },
        {
          id: 5,
          description: `Submitted assignment for ${MODULES[1].name}`,
          timestamp: fellow.lastcourseaccess - 86400 * 4,
          type: "assignment" as const,
        },
        {
          id: 6,
          description: `Started ${MODULES[2].name}`,
          timestamp: fellow.lastcourseaccess - 86400 * 5,
          type: "completion" as const,
        },
      ],
    };
  },
};
