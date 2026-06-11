import { NextResponse } from "next/server";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  getCachedGradeItems,
  getCachedAssignmentData,
  makeCompletedByUser,
} from "@/lib/server/sharedData";

export const maxDuration = 60;

interface MoodleSection {
  id: number;
  section: number;
  modules: Array<{ id: number }>;
}

export async function GET() {
  try {
    // core_course_get_contents is HTTP-cached by moodleCall (revalidate: 300)
    const [students, courseModules, rawCompletions, gradeItemsByUser, assignData, sections] =
      await Promise.all([
        getCachedStudents(),
        getCachedCourseModules(),
        getCachedRawCompletions(),
        getCachedGradeItems(),
        getCachedAssignmentData(),
        moodleCall<MoodleSection[]>("core_course_get_contents", { courseid: COURSE_ID }),
      ]);

    const total = students.length;
    const completedByUser = makeCompletedByUser(rawCompletions);
    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);
    const totalAssignments = assignData.assignments.length;

    // cmid → section number (for mapping quiz/assign grades to modules)
    const cmidToSection = new Map<number, number>();
    sections.forEach((s) => s.modules.forEach((m) => cmidToSection.set(m.id, s.section)));

    // assignment id → section (via assignment cmid)
    const assignIdToSection = new Map<number, number>();
    assignData.assignments.forEach((a) => {
      const section = cmidToSection.get(a.cmid);
      if (section) assignIdToSection.set(a.id, section);
    });

    // ── Per-user quiz averages ─────────────────────────────────────────────────
    const userQuizAvg: Array<number | null> = students.map((s) => {
      const quizItems = (gradeItemsByUser[String(s.id)] ?? []).filter(
        (g) => g.itemmodule === "quiz" && g.graderaw !== null && g.grademax > 0
      );
      if (quizItems.length === 0) return null;
      return Math.round(
        quizItems.reduce((sum, g) => sum + (g.graderaw! / g.grademax) * 100, 0) /
          quizItems.length
      );
    });

    // userId → submitted assignment count
    const userSubmitCount = new Map<number, number>();
    Object.values(assignData.submissionsByAssignment).forEach((subs) => {
      subs
        .filter((s) => s.status === "submitted")
        .forEach((s) => {
          userSubmitCount.set(s.userid, (userSubmitCount.get(s.userid) ?? 0) + 1);
        });
    });

    // ── Quiz stats by module ───────────────────────────────────────────────────
    const moduleQuizScores = new Map<number, number[]>();
    courseModules.forEach((m) => moduleQuizScores.set(m.moduleId, []));

    students.forEach((s) => {
      (gradeItemsByUser[String(s.id)] ?? []).forEach((g) => {
        if (g.itemmodule !== "quiz" || g.graderaw === null || g.grademax === 0) return;
        const section = cmidToSection.get(g.cmid);
        if (!section || !moduleQuizScores.has(section)) return;
        moduleQuizScores.get(section)!.push(Math.round((g.graderaw / g.grademax) * 100));
      });
    });

    const quizByModule = courseModules.map((mod) => {
      const scores = moduleQuizScores.get(mod.moduleId) ?? [];
      const attemptCount = scores.length;
      const passCount = scores.filter((s) => s >= 50).length;
      const avgScore =
        attemptCount > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / attemptCount)
          : 0;
      return {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        avgScore,
        passCount,
        failCount: attemptCount - passCount,
        attemptCount,
      };
    });

    // ── Assignment stats by module ─────────────────────────────────────────────
    const moduleAssignData = new Map<number, { submitted: number; notSubmitted: number }>();
    courseModules.forEach((m) => moduleAssignData.set(m.moduleId, { submitted: 0, notSubmitted: 0 }));

    Object.entries(assignData.submissionsByAssignment).forEach(([assignIdStr, subs]) => {
      const assignId = Number(assignIdStr);
      const section = assignIdToSection.get(assignId);
      if (!section || !moduleAssignData.has(section)) return;

      const submitted = subs.filter((s) => s.status === "submitted").length;
      const entry = moduleAssignData.get(section)!;
      entry.submitted += submitted;
      entry.notSubmitted += total - submitted;
    });

    const assignmentByModule = courseModules.map((mod) => {
      const d = moduleAssignData.get(mod.moduleId) ?? { submitted: 0, notSubmitted: 0 };
      return { moduleId: mod.moduleId, moduleName: mod.moduleName, ...d };
    });

    // ── Scalar KPIs ────────────────────────────────────────────────────────────
    const validQuizAvgs = userQuizAvg.filter((v): v is number => v !== null);
    const avgQuizScore =
      validQuizAvgs.length > 0
        ? Math.round(validQuizAvgs.reduce((a, b) => a + b, 0) / validQuizAvgs.length)
        : 0;

    const totalSubs = Object.values(assignData.submissionsByAssignment).reduce(
      (sum, subs) => sum + subs.filter((s) => s.status === "submitted").length,
      0
    );
    const submissionRate =
      total > 0 && totalAssignments > 0
        ? Math.round((totalSubs / (total * totalAssignments)) * 100)
        : 0;

    const passCount = validQuizAvgs.filter((s) => s >= 50).length;
    const passRate =
      validQuizAvgs.length > 0
        ? Math.round((passCount / validQuizAvgs.length) * 100)
        : 0;

    // ── Top learners ───────────────────────────────────────────────────────────
    const topLearners = students
      .map((s, i) => {
        const done = completedByUser.get(s.id) ?? new Set<number>();
        const doneCount = courseModules.reduce(
          (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
          0
        );
        const completionPct =
          totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

        const modulesFinished = courseModules.filter(
          (m) => m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
        ).length;

        const avgQ = userQuizAvg[i] ?? 0;
        const assignmentsSubmitted = userSubmitCount.get(s.id) ?? 0;
        const forumPosts = 0;

        const engagementScore = Math.min(
          100,
          Math.round(forumPosts * 3 + avgQ * 0.3 + completionPct * 0.2)
        );

        const daysSinceActive = s.lastcourseaccess
          ? Math.floor((Date.now() / 1000 - s.lastcourseaccess) / 86400)
          : 999;

        const riskLevel: "active" | "at_risk" | "inactive" =
          !s.lastcourseaccess || daysSinceActive > 14
            ? "inactive"
            : daysSinceActive > 7 || completionPct < 25
            ? "at_risk"
            : "active";

        return {
          ...s,
          completionPct,
          avgQuizScore: avgQ,
          assignmentsSubmitted,
          assignmentsTotal: totalAssignments,
          forumPosts,
          engagementScore,
          riskLevel,
          daysSinceActive,
          modulesFinished,
        };
      })
      .filter((s) => s.riskLevel === "active")
      .sort((a, b) =>
        b.engagementScore !== a.engagementScore
          ? b.engagementScore - a.engagementScore
          : b.completionPct - a.completionPct
      )
      .slice(0, 20)
      .map(({ modulesFinished: _mf, ...rest }) => rest);

    return NextResponse.json({
      avgQuizScore,
      submissionRate,
      passRate,
      failRate: 100 - passRate,
      quizByModule,
      assignmentByModule,
      topLearners,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
