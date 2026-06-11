import { NextResponse } from "next/server";
import moment from "moment";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  makeCompletedByUser,
  type CachedStudent,
} from "@/lib/server/sharedData";

export const maxDuration = 60;

function computeWeeklyActivity(students: CachedStudent[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const weeksAgo = 11 - i;
    const start = moment().subtract(weeksAgo, "weeks").startOf("isoWeek");
    const end = moment().subtract(weeksAgo, "weeks").endOf("isoWeek");

    const logins = students.filter(
      (s) =>
        s.lastaccess &&
        moment.unix(s.lastaccess).isBetween(start, end, undefined, "[]")
    ).length;

    const interactions = students.filter(
      (s) =>
        s.lastcourseaccess &&
        moment.unix(s.lastcourseaccess).isBetween(start, end, undefined, "[]")
    ).length;

    return { week: start.format("MMM D"), logins, interactions };
  });
}

function computeHeatmap(students: CachedStudent[]) {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  students.forEach((s) => {
    if (!s.lastcourseaccess) return;
    const m = moment.unix(s.lastcourseaccess);
    const day = m.isoWeekday() - 1; // 0=Mon..6=Sun
    const hour = m.hour();
    grid[day][hour]++;
  });

  const result: { day: number; hour: number; count: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      result.push({ day: d, hour: h, count: grid[d][h] });
    }
  }
  return result;
}

export async function GET() {
  try {
    const [students, courseModules, rawCompletions] = await Promise.all([
      getCachedStudents(),
      getCachedCourseModules(),
      getCachedRawCompletions(),
    ]);

    const now = Date.now() / 1000;
    const completedByUser = makeCompletedByUser(rawCompletions);

    const dau = students.filter(
      (s) => s.lastcourseaccess && now - s.lastcourseaccess < 86400
    ).length;
    const wau = students.filter(
      (s) => s.lastcourseaccess && now - s.lastcourseaccess < 7 * 86400
    ).length;
    const mau = students.filter(
      (s) => s.lastcourseaccess && now - s.lastcourseaccess < 30 * 86400
    ).length;

    const contentViews = [...completedByUser.values()].reduce(
      (sum, set) => sum + set.size,
      0
    );

    const moduleViews = courseModules.map((mod) => {
      const views = students.filter((s) => {
        const done = completedByUser.get(s.id) ?? new Set<number>();
        return mod.activityIds.some((id) => done.has(id));
      }).length;
      return { moduleId: mod.moduleId, moduleName: mod.moduleName, views };
    });

    return NextResponse.json({
      dau,
      wau,
      mau,
      contentViews,
      weeklyActivity: computeWeeklyActivity(students),
      heatmap: computeHeatmap(students),
      moduleViews,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
