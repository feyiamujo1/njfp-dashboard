import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  getCachedModuleActivityDetails,
  getCachedQuizInstances,
  makeCompletedByUser,
} from "@/lib/server/sharedData";
import { normalizeGender, normalizeRegion, normalizeState } from "@/lib/util";
import type {
  ModuleDetailStats,
  ModuleStudentSummary,
  ModuleDemBreakdown,
  ActivityBreakdownItem,
} from "@/lib/types";

export const maxDuration = 120;

type DemGroup = { total: number; completed: number };

function groupToArray(map: Record<string, DemGroup>, total: number): ModuleDemBreakdown[] {
  void total;
  return Object.entries(map)
    .map(([label, g]) => ({
      label,
      total: g.total,
      completed: g.completed,
      completionPct: g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId: moduleIdStr } = await params;
  const moduleId = Number(moduleIdStr);

  if (!Number.isFinite(moduleId) || moduleId < 1) {
    return NextResponse.json({ error: "Invalid module ID" }, { status: 400 });
  }

  try {
    const [students, courseModules, rawCompletions, activityDetails, quizInstances] =
      await Promise.all([
        getCachedStudents(),
        getCachedCourseModules(),
        getCachedRawCompletions(),
        getCachedModuleActivityDetails(),
        getCachedQuizInstances(),
      ]);

    const mod = courseModules.find((m) => m.moduleId === moduleId);
    if (!mod) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const modActivities = activityDetails.find((m) => m.moduleId === moduleId);
    const activityList = modActivities?.activities ?? [];
    const totalActivities = mod.activityIds.length;

    const completedByUser = makeCompletedByUser(rawCompletions);

    // Per-activity completion counters
    const cmidCount = new Map<number, number>();
    activityList.forEach((a) => cmidCount.set(a.cmid, 0));

    // Quiz detection for this module
    const moduleQuizInstances = quizInstances.filter((q) => q.moduleSection === moduleId);
    const hasQuiz = moduleQuizInstances.length > 0;
    const quizCmids = new Set(
      activityList.filter((a) => a.modname === "quiz").map((a) => a.cmid)
    );

    // Demographic accumulators
    const byGender: Record<string, DemGroup> = {};
    const byRegion: Record<string, DemGroup> = {};
    const byState: Record<string, DemGroup> = {};

    let notStartedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let quizParticipantCount = 0;

    const studentRows: ModuleStudentSummary[] = students.map((s) => {
      const done = completedByUser.get(s.id) ?? new Set<number>();

      const activitiesDone =
        totalActivities === 0
          ? 0
          : mod.activityIds.filter((id) => done.has(id)).length;

      // Count per-activity completions
      done.forEach((cmid) => {
        if (cmidCount.has(cmid)) cmidCount.set(cmid, (cmidCount.get(cmid) ?? 0) + 1);
      });

      // Quiz participation
      if (hasQuiz && quizCmids.size > 0) {
        const participatedInQuiz = [...quizCmids].some((cmid) => done.has(cmid));
        if (participatedInQuiz) quizParticipantCount++;
      }

      const completionPct =
        totalActivities > 0 ? Math.round((activitiesDone / totalActivities) * 100) : 0;

      const status: ModuleStudentSummary["status"] =
        activitiesDone === 0
          ? "not_started"
          : activitiesDone === totalActivities
          ? "completed"
          : "in_progress";

      if (status === "not_started") notStartedCount++;
      else if (status === "in_progress") inProgressCount++;
      else completedCount++;

      // Demographics
      const g = normalizeGender(s.gender);
      const r = normalizeRegion(s.region);
      const st = normalizeState(s.state);

      for (const [map, key] of [
        [byGender, g],
        [byRegion, r],
        [byState, st],
      ] as [Record<string, DemGroup>, string][]) {
        if (!map[key]) map[key] = { total: 0, completed: 0 };
        map[key].total++;
        if (status === "completed") map[key].completed++;
      }

      return {
        id: s.id,
        fullname: s.fullname,
        email: s.email,
        profileimageurl: s.profileimageurl,
        gender: s.gender,
        state: s.state,
        lga: s.lga,
        region: s.region,
        lastcourseaccess: s.lastcourseaccess,
        activitiesDone,
        totalActivities,
        completionPct,
        status,
      };
    });

    const total = students.length;

    const activities: ActivityBreakdownItem[] = activityList.map((a) => ({
      cmid: a.cmid,
      name: a.name,
      modname: a.modname,
      completedCount: cmidCount.get(a.cmid) ?? 0,
      completionPct:
        total > 0 ? Math.round(((cmidCount.get(a.cmid) ?? 0) / total) * 100) : 0,
    }));

    const result: ModuleDetailStats = {
      moduleId,
      moduleName: mod.moduleName,
      totalEnrolled: total,
      notStartedCount,
      inProgressCount,
      completedCount,
      completedPct: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      startedPct:
        total > 0
          ? Math.round(((inProgressCount + completedCount) / total) * 100)
          : 0,
      hasQuiz,
      quizParticipantCount,
      quizParticipationPct:
        total > 0 ? Math.round((quizParticipantCount / total) * 100) : 0,
      activities,
      completionByGender: groupToArray(byGender, total),
      completionByRegion: groupToArray(byRegion, total),
      completionByState: groupToArray(byState, total),
      students: studentRows,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
