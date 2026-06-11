import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  getCachedGradeItems,
  getCachedForumData,
  makeCompletedByUser,
} from "@/lib/server/sharedData";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";

export const maxDuration = 60;

interface MoodleAssignmentList {
  courses: Array<{ assignments: Array<{ id: number }> }>;
}
interface MoodleSubmissionsResponse {
  assignments: Array<{
    assignmentid: number;
    submissions: Array<{ userid: number; status: string }>;
  }>;
}

async function fetchUserSubmitCount(): Promise<{
  perUser: Record<string, number>;
  totalAssignments: number;
}> {
  try {
    const { courses } = await moodleCall<MoodleAssignmentList>(
      "mod_assign_get_assignments",
      { "courseids[0]": COURSE_ID }
    );
    const assignments = courses[0]?.assignments ?? [];
    if (assignments.length === 0) return { perUser: {}, totalAssignments: 0 };

    const idParams: Record<string, string | number> = {};
    assignments.forEach((a, i) => { idParams[`assignmentids[${i}]`] = a.id; });

    const { assignments: subs } = await moodleCall<MoodleSubmissionsResponse>(
      "mod_assign_get_submissions",
      idParams
    );

    const perUser: Record<string, number> = {};
    subs.forEach((a) => {
      a.submissions
        .filter((s) => s.status === "submitted")
        .forEach((s) => {
          perUser[String(s.userid)] = (perUser[String(s.userid)] ?? 0) + 1;
        });
    });

    return { perUser, totalAssignments: assignments.length };
  } catch {
    return { perUser: {}, totalAssignments: 0 };
  }
}

export async function GET() {
  try {
    const [students, courseModules, rawCompletions, gradeItemsByUser, forumData, assignData] =
      await Promise.all([
        getCachedStudents(),
        getCachedCourseModules(),
        getCachedRawCompletions(),
        getCachedGradeItems(),
        getCachedForumData(),
        fetchUserSubmitCount(),
      ]);

    const completedByUser = makeCompletedByUser(rawCompletions);
    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);
    const halfModules = Math.ceil(courseModules.length / 2);
    const now = Date.now() / 1000;

    // ── Build full FellowSummary for every student ────────────────────────
    const fellows = students.map((s) => {
      const done = completedByUser.get(s.id) ?? new Set<number>();

      const doneCount = courseModules.reduce(
        (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
        0
      );
      const completionPct =
        totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

      // Quiz avg
      const quizItems = (gradeItemsByUser[String(s.id)] ?? []).filter(
        (g) => g.itemmodule === "quiz" && g.graderaw !== null && g.grademax > 0
      );
      const avgQuizScore =
        quizItems.length > 0
          ? Math.round(
              quizItems.reduce((sum, g) => sum + (g.graderaw! / g.grademax) * 100, 0) /
                quizItems.length
            )
          : 0;

      const assignmentsSubmitted = assignData.perUser[String(s.id)] ?? 0;
      const forumPosts = forumData.userDiscussionCount[String(s.id)] ?? 0;

      const engagementScore = Math.min(
        100,
        Math.round(forumPosts * 3 + avgQuizScore * 0.3 + completionPct * 0.2)
      );

      const daysSinceActive = s.lastcourseaccess
        ? Math.floor((now - s.lastcourseaccess) / 86400)
        : 999;

      const riskLevel: "active" | "at_risk" | "inactive" =
        !s.lastcourseaccess || daysSinceActive > 14
          ? "inactive"
          : daysSinceActive > 7 || completionPct < 25
          ? "at_risk"
          : "active";

      return {
        ...s,
        completionPct,
        avgQuizScore,
        assignmentsSubmitted,
        assignmentsTotal: assignData.totalAssignments,
        forumPosts,
        engagementScore,
        riskLevel,
        daysSinceActive,
      };
    });

    // ── KPI counts ────────────────────────────────────────────────────────
    let activeCount = 0;
    let atRiskCount = 0;
    let inactiveCount = 0;
    let inactiveOver7 = 0;
    let inactiveOver14 = 0;
    let lowQuizScore = 0;
    let noMentorshipEngagement = 0;

    fellows.forEach((f) => {
      if (f.riskLevel === "active") activeCount++;
      else if (f.riskLevel === "at_risk") atRiskCount++;
      else inactiveCount++;

      if (f.daysSinceActive > 7) inactiveOver7++;
      if (f.daysSinceActive > 14) inactiveOver14++;
      if (f.avgQuizScore > 0 && f.avgQuizScore < 50) lowQuizScore++;
      if (f.forumPosts === 0) noMentorshipEngagement++;
    });

    return NextResponse.json({
      inactiveOver7Days: inactiveOver7,
      inactiveOver14Days: inactiveOver14,
      lowQuizScore,
      noMentorshipEngagement,
      distribution: {
        active: activeCount,
        atRisk: atRiskCount,
        inactive: inactiveCount,
      },
      fellows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
