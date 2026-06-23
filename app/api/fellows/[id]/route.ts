import { NextResponse } from "next/server";
import { getCachedCourseModules } from "@/lib/server/sharedData";
import { supabase } from "@/integration/supabase/server";
import type { RiskLevel } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid learner ID" }, { status: 400 });
  }

  try {
    const [courseModules, { data: student, error: studentErr }, { data: comp }] =
      await Promise.all([
        getCachedCourseModules(),
        supabase.from("students").select("*").eq("id", userId).single(),
        supabase
          .from("completions")
          .select("completed_cmids")
          .eq("user_id", userId)
          .single(),
      ]);

    if (studentErr || !student) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }

    const done = new Set<number>(comp?.completed_cmids ?? []);

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

    const daysSinceActive = student.lastcourseaccess
      ? Math.floor((Date.now() / 1000 - student.lastcourseaccess) / 86400)
      : 999;

    // Learners who have substantially completed the course (≥80%) are treated as
    // active regardless of last-access time — they've finished, not dropped out.
    const riskLevel: RiskLevel =
      completionPct >= 80
        ? "active"
        : !student.lastcourseaccess || daysSinceActive > 14
        ? "inactive"
        : daysSinceActive > 7 || completionPct < 25
        ? "at_risk"
        : "active";

    const engagementScore = completionPct;

    return NextResponse.json({
      id: student.id,
      fullname: student.fullname,
      email: student.email,
      lastcourseaccess: student.lastcourseaccess,
      profileimageurl: student.profileimageurl,
      gender: student.gender,
      state: student.state,
      lga: student.lga,
      region: student.region,
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
