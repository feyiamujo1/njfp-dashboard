import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  makeCompletedByUser,
} from "@/lib/server/sharedData";

export const maxDuration = 60;

export async function GET() {
  try {
    const [students, courseModules, rawCompletions] = await Promise.all([
      getCachedStudents(),
      getCachedCourseModules(),
      getCachedRawCompletions(),
    ]);

    const total = students.length;
    const completedByUser = makeCompletedByUser(rawCompletions);
    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);
    const halfModules = Math.ceil(courseModules.length / 2);
    const midwayModuleIdx = Math.floor(courseModules.length / 2);

    // ── Per-module completion ──────────────────────────────────────────────────
    const moduleProgress = courseModules.map((mod) => {
      const completedCount =
        mod.activityIds.length === 0
          ? 0
          : students.filter((s) => {
              const done = completedByUser.get(s.id) ?? new Set<number>();
              return mod.activityIds.every((id) => done.has(id));
            }).length;
      return {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        completionPct: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        completedCount,
        totalFellows: total,
      };
    });

    // ── Scalar stats ───────────────────────────────────────────────────────────
    let startedCount = 0, midwayCount = 0, completedCount = 0, totalCompletionPctSum = 0;

    students.forEach((s) => {
      const done = completedByUser.get(s.id) ?? new Set<number>();
      const doneCount = courseModules.reduce(
        (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
        0
      );

      if (doneCount > 0) startedCount++;

      const midwayMod = courseModules[midwayModuleIdx];
      if (
        midwayMod &&
        midwayMod.activityIds.length > 0 &&
        midwayMod.activityIds.every((id) => done.has(id))
      ) {
        midwayCount++;
      }

      const modulesFinished = courseModules.filter(
        (m) => m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
      ).length;
      if (modulesFinished >= halfModules) completedCount++;

      totalCompletionPctSum += totalActivities > 0 ? (doneCount / totalActivities) * 100 : 0;
    });

    const startedPct = total > 0 ? Math.round((startedCount / total) * 100) : 0;
    const completedPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const avgCompletionRate = total > 0 ? Math.round(totalCompletionPctSum / total) : 0;

    // ── Funnel ─────────────────────────────────────────────────────────────────
    const midwayLabel = courseModules[midwayModuleIdx]
      ? `Midway (Module ${midwayModuleIdx + 1}+)`
      : "Midway";

    const funnel = [
      { stage: "Enrolled", count: total, pct: 100 },
      { stage: "Started", count: startedCount, pct: startedPct },
      {
        stage: midwayLabel,
        count: midwayCount,
        pct: total > 0 ? Math.round((midwayCount / total) * 100) : 0,
      },
      { stage: "Completed", count: completedCount, pct: completedPct },
    ];

    return NextResponse.json({
      totalEnrolled: total,
      startedPct,
      completedPct,
      avgCompletionRate,
      moduleProgress,
      funnel,
      dropOff: moduleProgress.map((m) => ({
        moduleId: m.moduleId,
        moduleName: m.moduleName,
        activePct: m.completionPct,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
