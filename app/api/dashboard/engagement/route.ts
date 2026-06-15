import { NextResponse } from "next/server";
import moment from "moment";
import { getCachedStudents, type CachedStudent } from "@/lib/server/sharedData";

function computeWeeklyActivity(students: CachedStudent[]) {
  return Array.from({ length: 52 }, (_, i) => {
    const weeksAgo = 51 - i;
    const start = moment().subtract(weeksAgo, "weeks").startOf("isoWeek");
    const end = moment().subtract(weeksAgo, "weeks").endOf("isoWeek");

    const logins = students.filter(
      (s) => s.lastaccess && moment.unix(s.lastaccess).isBetween(start, end, undefined, "[]")
    ).length;

    const interactions = students.filter(
      (s) =>
        s.lastcourseaccess &&
        moment.unix(s.lastcourseaccess).isBetween(start, end, undefined, "[]")
    ).length;

    return { week: start.format("MMM D"), ts: start.unix(), logins, interactions };
  });
}

function computeMonthlyActivity(students: CachedStudent[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthsAgo = 11 - i;
    const start = moment().subtract(monthsAgo, "months").startOf("month");
    const end = moment().subtract(monthsAgo, "months").endOf("month");

    const logins = students.filter(
      (s) => s.lastaccess && moment.unix(s.lastaccess).isBetween(start, end, undefined, "[]")
    ).length;

    const interactions = students.filter(
      (s) =>
        s.lastcourseaccess &&
        moment.unix(s.lastcourseaccess).isBetween(start, end, undefined, "[]")
    ).length;

    return { month: start.format("MMM YYYY"), ts: start.unix(), logins, interactions };
  });
}

export async function GET() {
  try {
    const students = await getCachedStudents();
    const now = Date.now() / 1000;

    const dau = students.filter((s) => s.lastcourseaccess && now - s.lastcourseaccess < 86400).length;
    const wau = students.filter((s) => s.lastcourseaccess && now - s.lastcourseaccess < 7 * 86400).length;
    const mau = students.filter((s) => s.lastcourseaccess && now - s.lastcourseaccess < 30 * 86400).length;

    const heatmapRaw = students
      .filter((s) => s.lastcourseaccess > 0)
      .map((s) => s.lastcourseaccess);

    const weekly = computeWeeklyActivity(students);
    const monthly = computeMonthlyActivity(students);

    console.log("[engagement/fast]", {
      totalStudents: students.length,
      dau, wau, mau,
      heatmapRawCount: heatmapRaw.length,
      weeklyRange: weekly.length > 0 ? `${weekly[0].week} → ${weekly[weekly.length - 1].week}` : "empty",
      monthlyRange: monthly.length > 0 ? `${monthly[0].month} → ${monthly[monthly.length - 1].month}` : "empty",
      weeklyLast3: weekly.slice(-3),
      monthlyLast3: monthly.slice(-3),
    });

    return NextResponse.json({
      dau,
      wau,
      mau,
      weeklyActivity: weekly,
      monthlyActivity: monthly,
      heatmapRaw,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? "Internal error" }, { status: 500 });
  }
}
