import { NextResponse } from "next/server";
import { getCachedCourseModules } from "@/lib/server/sharedData";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import type { RiskLevel } from "@/lib/types";

export const maxDuration = 120;

async function fetchSingleStudent(userId: number) {
  try {
    const users = await moodleCall<
      Array<{
        id: number;
        fullname: string;
        email: string;
        lastaccess: number;
        profileimageurl: string;
        customfields?: Array<{ shortname: string; value: string }>;
      }>
    >("core_user_get_users_by_field", {
      field: "id",
      "values[0]": userId,
    });
    const u = users?.[0];
    if (!u) return null;
    const cf = (u.customfields ?? []).reduce<Record<string, string>>((acc, f) => {
      acc[f.shortname] = f.value;
      return acc;
    }, {});
    return {
      id: u.id,
      fullname: u.fullname,
      email: u.email,
      lastaccess: u.lastaccess,
      profileimageurl: u.profileimageurl,
      gender: cf.gender ?? null,
      state: cf.state ?? null,
      lga: cf.lga ?? null,
      region: cf.region ?? null,
    };
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid learner ID" }, { status: 400 });
  }

  // Client passes lastcourseaccess from its fellows-list cache to avoid a bulk
  // enrolled-users fetch (which times out for 6000+ students).
  const lastcourseaccess = Number(
    new URL(req.url).searchParams.get("lastCourseAccess") ?? "0"
  );

  try {
    const [courseModules, completionStatus, student] =
      await Promise.all([
        getCachedCourseModules(),
        moodleCall<{
          statuses: Array<{ cmid: number; state: number; tracking: number }>;
        }>("core_completion_get_activities_completion_status", {
          courseid: COURSE_ID,
          userid: userId,
        }).catch(() => ({ statuses: [] })),
        fetchSingleStudent(userId),
      ]);

    if (!student) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }

    const done = new Set<number>(
      (completionStatus.statuses ?? [])
        .filter(({ tracking, state }) => tracking > 0 && state >= 1)
        .map(({ cmid }) => cmid)
    );

    // ── Per-module completion ─────────────────────────────────────────────
    const moduleProgress = courseModules.map((mod) => {
      const completedCount = mod.activityIds.filter((aid) => done.has(aid)).length;
      return {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        completionPct:
          mod.activityIds.length > 0
            ? Math.round((completedCount / mod.activityIds.length) * 100)
            : 0,
        completedCount,
        totalFellows: 0,
      };
    });

    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);
    const totalDone = courseModules.reduce(
      (sum, m) => sum + m.activityIds.filter((aid) => done.has(aid)).length,
      0
    );
    const completionPct =
      totalActivities > 0 ? Math.round((totalDone / totalActivities) * 100) : 0;

    // ── Scalar KPIs ───────────────────────────────────────────────────────
    // avgQuizScore comes from the separate /quiz route (slow, per-user cached).
    // Engagement here is completion-only until the quiz route responds.
    const engagementScore = Math.min(100, Math.round(completionPct * 0.7));

    // lastcourseaccess: prefer the URL param (course-specific, from the fellows
    // list cache). Fall back to the user's global lastaccess when navigating
    // directly without a cached param — avoids showing "Never" unnecessarily.
    const effectiveLastCourseAccess = lastcourseaccess || student.lastaccess || 0;

    const daysSinceActive = effectiveLastCourseAccess
      ? Math.floor((Date.now() / 1000 - effectiveLastCourseAccess) / 86400)
      : 999;
    const riskLevel: RiskLevel =
      !effectiveLastCourseAccess || daysSinceActive > 14
        ? "inactive"
        : daysSinceActive > 7 || completionPct < 25
        ? "at_risk"
        : "active";

    return NextResponse.json({
      ...student,
      lastcourseaccess: effectiveLastCourseAccess,
      completionPct,
      avgQuizScore: 0,
      engagementScore,
      riskLevel,
      daysSinceActive,
      moduleProgress,
      quizStats: [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
