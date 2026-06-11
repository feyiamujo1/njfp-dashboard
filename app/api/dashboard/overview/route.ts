import { NextResponse } from "next/server";
import moment from "moment";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  getCachedGradeItems,
  getCachedAssignmentData,
  makeCompletedByUser,
  type CachedStudent,
} from "@/lib/server/sharedData";

export const maxDuration = 60;

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

function classifyRisk(s: CachedStudent, completionPct: number) {
  if (!s.lastcourseaccess) return "inactive";
  const daysSince = (Date.now() / 1000 - s.lastcourseaccess) / 86400;
  if (daysSince > 14) return "inactive";
  if (daysSince > 7 || completionPct < 25) return "at_risk";
  return "active";
}

export async function GET() {
  try {
    const [students, courseModules, rawCompletions, gradeItemsByUser, assignData] =
      await Promise.all([
        getCachedStudents(),
        getCachedCourseModules(),
        getCachedRawCompletions(),
        getCachedGradeItems(),
        getCachedAssignmentData(),
      ]);

    const total = students.length;
    const completedByUser = makeCompletedByUser(rawCompletions);
    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);
    const halfModules = Math.ceil(courseModules.length / 2);
    const now = Date.now() / 1000;

    // ── Module completion ──────────────────────────────────────────────────────
    const moduleCompletion = courseModules.map((mod) => {
      const completedCount = students.filter((s) => {
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

    // ── Scalar KPIs ────────────────────────────────────────────────────────────
    const activeFellows = students.filter(
      (s) => s.lastcourseaccess && now - s.lastcourseaccess < 7 * 86400
    ).length;

    let courseCompletedCount = 0;
    let activeCount = 0, atRiskCount = 0, inactiveCount = 0;

    students.forEach((s) => {
      const done = completedByUser.get(s.id) ?? new Set<number>();
      const doneCount = courseModules.reduce(
        (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
        0
      );
      const completionPct = totalActivities > 0 ? (doneCount / totalActivities) * 100 : 0;
      const modulesFinished = courseModules.filter(
        (m) => m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
      ).length;

      if (modulesFinished >= halfModules) courseCompletedCount++;

      const risk = classifyRisk(s, completionPct);
      if (risk === "active") activeCount++;
      else if (risk === "at_risk") atRiskCount++;
      else inactiveCount++;
    });

    // ── Avg quiz score from shared grade items ─────────────────────────────────
    const validQuizAvgs = students
      .map((s) => {
        const quizItems = (gradeItemsByUser[String(s.id)] ?? []).filter(
          (g) => g.itemmodule === "quiz" && g.graderaw !== null && g.grademax > 0
        );
        if (quizItems.length === 0) return null;
        return Math.round(
          quizItems.reduce((sum, g) => sum + (g.graderaw! / g.grademax) * 100, 0) /
            quizItems.length
        );
      })
      .filter((v): v is number => v !== null);

    const avgQuizScore =
      validQuizAvgs.length > 0
        ? Math.round(validQuizAvgs.reduce((a, b) => a + b, 0) / validQuizAvgs.length)
        : 0;

    // ── Assignment completion rate ─────────────────────────────────────────────
    const totalSubs = Object.values(assignData.submissionsByAssignment).reduce(
      (sum, subs) => sum + subs.filter((s) => s.status === "submitted").length,
      0
    );
    const assignmentCompletionRate =
      total > 0 && assignData.assignments.length > 0
        ? Math.round((totalSubs / (total * assignData.assignments.length)) * 100)
        : 0;

    return NextResponse.json({
      stats: {
        totalFellows: total,
        activeFellows,
        completionRate: total > 0 ? Math.round((courseCompletedCount / total) * 100) : 0,
        avgQuizScore,
        assignmentCompletionRate,
        atRiskCount,
      },
      weeklyActive: computeWeeklyActive(students),
      moduleCompletion,
      riskDistribution: { active: activeCount, atRisk: atRiskCount, inactive: inactiveCount },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
