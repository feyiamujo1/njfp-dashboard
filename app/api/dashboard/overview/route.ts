import { NextResponse } from "next/server";
import moment from "moment";
import { getCachedStudents, type CachedStudent } from "@/lib/server/sharedData";

export const maxDuration = 120;

function computeWeeklyActive(students: CachedStudent[]) {
  return Array.from({ length: 8 }, (_, i) => {
    const weeksAgo = 7 - i;
    const start = moment().subtract(weeksAgo, "weeks").startOf("isoWeek");
    const end = moment().subtract(weeksAgo, "weeks").endOf("isoWeek");
    const active = students.filter(
      (s) =>
        s.lastcourseaccess &&
        moment.unix(s.lastcourseaccess).isBetween(start, end, undefined, "[]")
    ).length;
    return { week: start.format("MMM D"), active };
  });
}

// Time-based only — completion data comes from the separate /completion endpoint.
// active   : accessed in the last 7 days
// at_risk  : accessed 7–30 days ago (disengaging but not gone)
// inactive : no access in 30+ days, or never logged in
function classifyRisk(s: CachedStudent): "active" | "at_risk" | "inactive" {
  if (!s.lastcourseaccess) return "inactive";
  const daysSince = (Date.now() / 1000 - s.lastcourseaccess) / 86400;
  if (daysSince <= 7) return "active";
  if (daysSince <= 30) return "at_risk";
  return "inactive";
}

export async function GET() {
  try {
    const students = await getCachedStudents();
    const total = students.length;
    const now = Date.now() / 1000;

    const activeFellows = students.filter(
      (s) => s.lastcourseaccess && now - s.lastcourseaccess < 7 * 86400
    ).length;

    const neverStarted = students.filter((s) => !s.lastcourseaccess).length;

    let activeCount = 0, atRiskCount = 0, inactiveCount = 0;
    students.forEach((s) => {
      const risk = classifyRisk(s);
      if (risk === "active") activeCount++;
      else if (risk === "at_risk") atRiskCount++;
      else inactiveCount++;
    });

    console.log("[overview/fast]", {
      total,
      activeFellows,
      neverStarted,
      activeCount,
      atRiskCount,
      inactiveCount,
    });

    return NextResponse.json({
      stats: { totalFellows: total, activeFellows, atRiskCount, neverStarted },
      weeklyActive: computeWeeklyActive(students),
      riskDistribution: { active: activeCount, atRisk: atRiskCount, inactive: inactiveCount },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
