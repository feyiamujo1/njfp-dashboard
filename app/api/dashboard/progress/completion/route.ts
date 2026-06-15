import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  makeCompletedByUser,
} from "@/lib/server/sharedData";
import type { DemCompletion } from "@/lib/types";
import { normalizeGender, normalizeRegion, normalizeState } from "@/lib/util";

export const maxDuration = 120;

type DemGroup = { total: number; started: number; midway: number; completed: number };

function groupToArray(map: Record<string, DemGroup>): DemCompletion[] {
  return Object.entries(map)
    .map(([label, g]) => ({
      label,
      total: g.total,
      started: g.started,
      startedPct: g.total > 0 ? Math.round((g.started / g.total) * 100) : 0,
      midway: g.midway,
      midwayPct: g.total > 0 ? Math.round((g.midway / g.total) * 100) : 0,
      completed: g.completed,
      completionPct: g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

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
    const midwayMod = courseModules[midwayModuleIdx];

    // Per-module strict completion (every activity done)
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

    // Single pass for scalar stats + demographic breakdowns
    let startedCount = 0, midwayCount = 0, completedCount = 0, totalCompletionPctSum = 0;
    const byGender: Record<string, DemGroup> = {};
    const byRegion: Record<string, DemGroup> = {};
    const byState: Record<string, DemGroup> = {};

    students.forEach((s) => {
      const done = completedByUser.get(s.id) ?? new Set<number>();
      const doneCount = courseModules.reduce(
        (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
        0
      );

      const isStarted = doneCount > 0;
      const isMidway =
        !!midwayMod?.activityIds.length &&
        midwayMod.activityIds.every((id) => done.has(id));
      const modulesFinished = courseModules.filter(
        (m) => m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
      ).length;
      const isCompleted = modulesFinished >= halfModules;

      if (isStarted) startedCount++;
      if (isMidway) midwayCount++;
      if (isCompleted) completedCount++;
      totalCompletionPctSum += totalActivities > 0 ? (doneCount / totalActivities) * 100 : 0;

      // Demographic tracking
      const g = normalizeGender(s.gender);
      const r = normalizeRegion(s.region);
      const st = normalizeState(s.state);

      for (const [map, key] of [
        [byGender, g],
        [byRegion, r],
        [byState, st],
      ] as [Record<string, DemGroup>, string][]) {
        if (!map[key]) map[key] = { total: 0, started: 0, midway: 0, completed: 0 };
        map[key].total++;
        if (isStarted) map[key].started++;
        if (isMidway) map[key].midway++;
        if (isCompleted) map[key].completed++;
      }
    });

    const startedPct = total > 0 ? Math.round((startedCount / total) * 100) : 0;
    const completedPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const avgCompletionRate = total > 0 ? Math.round(totalCompletionPctSum / total) : 0;

    const midwayLabel = midwayMod ? `Midway (M${midwayModuleIdx + 1}+)` : "Midway";
    const funnel = [
      { stage: "Enrolled", count: total, pct: 100 },
      { stage: "Started", count: startedCount, pct: startedPct },
      { stage: midwayLabel, count: midwayCount, pct: total > 0 ? Math.round((midwayCount / total) * 100) : 0 },
      { stage: "Completed", count: completedCount, pct: completedPct },
    ];

    // Drop-off: % of enrolled who started each module (≥1 activity done).
    const dropOff = courseModules.map((mod) => {
      const startedModuleCount = students.filter((s) => {
        const done = completedByUser.get(s.id) ?? new Set<number>();
        return mod.activityIds.some((id) => done.has(id));
      }).length;
      return {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        activePct: total > 0 ? Math.round((startedModuleCount / total) * 100) : 0,
      };
    });

    return NextResponse.json({
      startedPct, completedPct, avgCompletionRate,
      moduleProgress, funnel, dropOff,
      completionByGender: groupToArray(byGender),
      completionByRegion: groupToArray(byRegion),
      completionByState: groupToArray(byState),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? "Internal error" }, { status: 500 });
  }
}
