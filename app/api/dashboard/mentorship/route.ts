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

// ── Assignment submission count per user ──────────────────────────────────────

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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // All heavy data served from shared cache
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

    // ── Forum stats by module ─────────────────────────────────────────────
    const forumByModule = courseModules.map((mod) => {
      const entry = forumData.bySection[String(mod.moduleId)] ?? { posts: 0, replies: 0 };
      return {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        posts: entry.posts,
        replies: entry.replies,
      };
    });

    // ── Leaderboard (top 20 by engagementScore) ───────────────────────────
    const leaderboard = students
      .map((s) => {
        const done = completedByUser.get(s.id) ?? new Set<number>();

        const doneCount = courseModules.reduce(
          (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
          0
        );
        const completionPct =
          totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

        const modulesFinished = courseModules.filter(
          (m) => m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
        ).length;

        // Quiz avg from grade items
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
          ? Math.floor((Date.now() / 1000 - s.lastcourseaccess) / 86400)
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
          _modulesFinished: modulesFinished,
        };
      })
      .filter((s) => s.riskLevel === "active")
      .sort((a, b) =>
        b.engagementScore !== a.engagementScore
          ? b.engagementScore - a.engagementScore
          : b.completionPct - a.completionPct
      )
      .slice(0, 20)
      .map(({ _modulesFinished: _, ...rest }) => rest);

    return NextResponse.json({
      // ── From Moodle (live) ─────────────────────────────────────────────
      forumPosts: forumData.totalPosts + forumData.totalReplies,
      forumByModule,
      leaderboard,

      // ── NATVIEW / external — not yet available via API ─────────────────
      // webinarAttendance: 0,   // TODO: wire NATVIEW integration
      // mentorSessions: 0,      // TODO: wire NATVIEW integration
      // podParticipation: 0,    // TODO: wire NATVIEW integration
      webinarAttendance: null,
      mentorSessions: null,
      podParticipation: null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
