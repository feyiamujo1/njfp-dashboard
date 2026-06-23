import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  getCachedModuleActivityDetails,
  makeCompletedByUser,
} from "@/lib/server/sharedData";
import { normalizeGender, normalizeRegion, normalizeState } from "@/lib/util";
import type {
  DemCompletion,
  CompletionBucket,
  ModuleActivityBreakdown,
  QuizParticipation,
} from "@/lib/types";

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

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "Not Started (0%)", min: 0,   max: 0   },
  { label: "1–25%",            min: 1,   max: 25  },
  { label: "26–50%",           min: 26,  max: 50  },
  { label: "51–75%",           min: 51,  max: 75  },
  { label: "76–99%",           min: 76,  max: 99  },
  { label: "Completed (100%)", min: 100, max: 100 },
];

function bucketIndex(pct: number): number {
  if (pct === 0)   return 0;
  if (pct <= 25)   return 1;
  if (pct <= 50)   return 2;
  if (pct <= 75)   return 3;
  if (pct < 100)   return 4;
  return 5;
}

export async function GET() {
  try {
    const [students, courseModules, rawCompletions, activityDetails] = await Promise.all([
      getCachedStudents(),
      getCachedCourseModules(),
      getCachedRawCompletions(),
      getCachedModuleActivityDetails(),
    ]);

    const total = students.length;
    const completedByUser = makeCompletedByUser(rawCompletions);
    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);
    const halfModules = Math.ceil(courseModules.length / 2);
    const midwayModuleIdx = Math.floor(courseModules.length / 2);
    const midwayMod = courseModules[midwayModuleIdx];

    // Per-activity completion counters (cmid → count)
    const cmidCount = new Map<number, number>();
    activityDetails.forEach(mod => mod.activities.forEach(a => cmidCount.set(a.cmid, 0)));

    // Per-module strict completion
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

    // Single pass over all students
    let startedCount = 0, midwayCount = 0, completedCount = 0, fullCompletedCount = 0;
    let totalCompletionPctSum = 0;
    const byGender: Record<string, DemGroup> = {};
    const byRegion: Record<string, DemGroup> = {};
    const byState: Record<string, DemGroup> = {};
    const bucketCounts = BUCKETS.map(b => ({ ...b, count: 0 }));

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
      const isFullyDone = totalActivities > 0 && doneCount === totalActivities;

      if (isStarted) startedCount++;
      if (isMidway) midwayCount++;
      if (isCompleted) completedCount++;
      if (isFullyDone) fullCompletedCount++;
      totalCompletionPctSum += totalActivities > 0 ? (doneCount / totalActivities) * 100 : 0;

      const pct = totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;
      bucketCounts[bucketIndex(pct)].count++;

      // Per-activity completion counts
      done.forEach(cmid => {
        if (cmidCount.has(cmid)) cmidCount.set(cmid, (cmidCount.get(cmid) ?? 0) + 1);
      });

      // Demographic tracking
      const g = normalizeGender(s.gender);
      const r = normalizeRegion(s.region);
      const st = normalizeState(s.state);
      for (const [map, key] of [
        [byGender, g], [byRegion, r], [byState, st],
      ] as [Record<string, DemGroup>, string][]) {
        if (!map[key]) map[key] = { total: 0, started: 0, midway: 0, completed: 0 };
        map[key].total++;
        if (isStarted)  map[key].started++;
        if (isMidway)   map[key].midway++;
        if (isCompleted) map[key].completed++;
      }
    });

    const startedPct = total > 0 ? Math.round((startedCount / total) * 100) : 0;
    const completedPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const avgCompletionRate = total > 0 ? Math.round(totalCompletionPctSum / total) : 0;

    const completionBuckets: CompletionBucket[] = bucketCounts.map(b => ({
      ...b,
      pct: total > 0 ? Math.round((b.count / total) * 100) : 0,
    }));

    // Activity breakdown per module — completion rate for each tracked activity
    const activityBreakdownByModule: ModuleActivityBreakdown[] = activityDetails.map(mod => ({
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      totalStudents: total,
      activities: mod.activities.map(a => {
        const completedCount = cmidCount.get(a.cmid) ?? 0;
        return {
          cmid: a.cmid,
          name: a.name,
          modname: a.modname,
          completedCount,
          completionPct: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        };
      }),
    }));

    // Quiz participation — filter to quiz-type activities only
    const quizParticipationByModule: QuizParticipation[] = activityDetails
      .map(mod => {
        const quizActs = mod.activities.filter(a => a.modname === "quiz");
        if (quizActs.length === 0) return null;
        // Sum across all quizzes in a module (usually 1, but guard for multiples)
        const participantCount = Math.max(...quizActs.map(a => cmidCount.get(a.cmid) ?? 0));
        return {
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          participantCount,
          participationPct: total > 0 ? Math.round((participantCount / total) * 100) : 0,
        };
      })
      .filter((x): x is QuizParticipation => x !== null);

    const midwayLabel = midwayMod ? `Midway (M${midwayModuleIdx + 1}+)` : "Midway";
    const funnel = [
      { stage: "Enrolled",    count: total,          pct: 100 },
      { stage: "Started",     count: startedCount,   pct: startedPct },
      { stage: midwayLabel,   count: midwayCount,    pct: total > 0 ? Math.round((midwayCount  / total) * 100) : 0 },
      { stage: "Completed",   count: completedCount, pct: completedPct },
    ];

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
      fullCompletedCount,
      moduleProgress, funnel, dropOff,
      completionBuckets,
      quizParticipationByModule,
      activityBreakdownByModule,
      completionByGender: groupToArray(byGender),
      completionByRegion: groupToArray(byRegion),
      completionByState: groupToArray(byState),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? "Internal error" }, { status: 500 });
  }
}
