import { NextResponse } from "next/server";
import {
  buildAllFellowSummaries,
  getCachedCourseModules,
  getCachedRawCompletions,
  makeCompletedByUser,
} from "@/lib/server/sharedData";
import { normalizeGender, normalizeRegion, normalizeState } from "@/lib/util";
import type { ActivityDemBreakdown } from "@/lib/types";

export const maxDuration = 120;

type ActivityGroup = { active: number; atRisk: number; inactive: number };

function groupToArray(map: Record<string, ActivityGroup>): ActivityDemBreakdown[] {
  return Object.entries(map)
    .map(([label, g]) => ({
      label,
      active: g.active,
      atRisk: g.atRisk,
      inactive: g.inactive,
      total: g.active + g.atRisk + g.inactive,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function GET() {
  try {
    const [fellows, courseModules, rawCompletions] = await Promise.all([
      buildAllFellowSummaries(),
      getCachedCourseModules(),
      getCachedRawCompletions(),
    ]);

    const completedByUser = makeCompletedByUser(rawCompletions);

    const contentViews = [...completedByUser.values()].reduce((sum, set) => sum + set.size, 0);

    const moduleViews = courseModules.map((mod) => {
      const views = fellows.filter((f) => {
        const done = completedByUser.get(f.id) ?? new Set<number>();
        return mod.activityIds.some((id) => done.has(id));
      }).length;
      return { moduleId: mod.moduleId, moduleName: mod.moduleName, views };
    });

    const now = Date.now() / 1000;

    // Risk stats + demographic activity breakdowns — single pass
    let inactiveOver7 = 0, inactiveOver14 = 0, notStartedCount = 0;
    let activeNotStarted = 0, loginNotEngaged = 0, neverAccessedCourse = 0;
    let activeCount = 0, atRiskCount = 0, inactiveCount = 0;

    const byGender: Record<string, ActivityGroup> = {};
    const byRegion: Record<string, ActivityGroup> = {};
    const byState: Record<string, ActivityGroup> = {};

    fellows.forEach((f) => {
      if (f.riskLevel === "active") activeCount++;
      else if (f.riskLevel === "at_risk") atRiskCount++;
      else inactiveCount++;
      if (f.daysSinceActive > 7) inactiveOver7++;
      if (f.daysSinceActive > 14) inactiveOver14++;
      if (f.completionPct === 0) {
        notStartedCount++;
        if (!f.lastcourseaccess) neverAccessedCourse++;
        // accessed within 7 days but completed nothing — enrolled and showing up but not engaging
        if (f.lastcourseaccess && now - f.lastcourseaccess < 7 * 86400) activeNotStarted++;
      }
      // logged in to Moodle recently but hasn't opened this course in 14+ days
      if (f.lastaccess && now - f.lastaccess < 7 * 86400) {
        if (!f.lastcourseaccess || now - f.lastcourseaccess > 14 * 86400) loginNotEngaged++;
      }

      const g = normalizeGender(f.gender);
      const r = normalizeRegion(f.region);
      const st = normalizeState(f.state);

      for (const [map, key] of [
        [byGender, g],
        [byRegion, r],
        [byState, st],
      ] as [Record<string, ActivityGroup>, string][]) {
        if (!map[key]) map[key] = { active: 0, atRisk: 0, inactive: 0 };
        if (f.riskLevel === "active") map[key].active++;
        else if (f.riskLevel === "at_risk") map[key].atRisk++;
        else map[key].inactive++;
      }
    });

    const topLearners = fellows
      .filter((f) => f.riskLevel === "active")
      .sort((a, b) =>
        b.engagementScore !== a.engagementScore
          ? b.engagementScore - a.engagementScore
          : b.completionPct - a.completionPct
      )
      .slice(0, 20);

    console.log("[engagement/completion]", {
      fellows: fellows.length,
      contentViews,
      moduleViews: moduleViews.map((m) => ({ name: m.moduleName, views: m.views })),
      risk: { active: activeCount, atRisk: atRiskCount, inactive: inactiveCount, inactiveOver7, inactiveOver14, notStartedCount },
      activityByGender: groupToArray(byGender),
      activityByRegion: groupToArray(byRegion),
      activityByStateCount: groupToArray(byState).length,
    });

    return NextResponse.json({
      contentViews,
      moduleViews,
      risk: {
        inactiveOver7Days: inactiveOver7,
        inactiveOver14Days: inactiveOver14,
        notStartedCount,
        activeNotStarted,
        loginNotEngaged,
        neverAccessedCourse,
        distribution: { active: activeCount, atRisk: atRiskCount, inactive: inactiveCount },
        fellows,
      },
      topLearners,
      activityByGender: groupToArray(byGender),
      activityByRegion: groupToArray(byRegion),
      activityByState: groupToArray(byState),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? "Internal error" }, { status: 500 });
  }
}
