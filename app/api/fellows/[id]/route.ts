import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  getCachedGradeItems,
  getCachedForumData,
  getCachedAssignmentData,
  makeCompletedByUser,
} from "@/lib/server/sharedData";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import type { ActivityEvent, RiskLevel } from "@/lib/types";

export const maxDuration = 60;

async function fetchCmidToSection(): Promise<
  Map<number, { section: number; sectionName: string }>
> {
  const sections = await moodleCall<
    Array<{
      section: number;
      name: string;
      visible: 1 | 0;
      modules: Array<{ id: number }>;
    }>
  >("core_course_get_contents", { courseid: COURSE_ID });

  const map = new Map<number, { section: number; sectionName: string }>();
  sections.forEach((s) => {
    s.modules.forEach((m) => map.set(m.id, { section: s.section, sectionName: s.name }));
  });
  return map;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid learner ID" }, { status: 400 });
  }

  try {
    const [
      students,
      courseModules,
      rawCompletions,
      gradeItemsByUser,
      forumData,
      assignData,
      cmidToSection,
    ] = await Promise.all([
      getCachedStudents(),
      getCachedCourseModules(),
      getCachedRawCompletions(),
      getCachedGradeItems(),
      getCachedForumData(),
      getCachedAssignmentData(),
      fetchCmidToSection(),
    ]);

    const student = students.find((s) => s.id === userId);
    if (!student) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }

    const completedByUser = makeCompletedByUser(rawCompletions);
    const done = completedByUser.get(userId) ?? new Set<number>();
    const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);

    // ── Per-module completion ─────────────────────────────────────────────
    const moduleProgress = courseModules.map((mod) => {
      const completedCount = mod.activityIds.filter((id) => done.has(id)).length;
      return {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        completionPct:
          mod.activityIds.length > 0
            ? Math.round((completedCount / mod.activityIds.length) * 100)
            : 0,
        completedCount,
        totalFellows: students.length,
      };
    });

    const totalDone = courseModules.reduce(
      (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
      0
    );
    const completionPct =
      totalActivities > 0 ? Math.round((totalDone / totalActivities) * 100) : 0;

    // ── Per-module quiz scores ────────────────────────────────────────────
    const userGradeItems = gradeItemsByUser[String(userId)] ?? [];
    const moduleQuizScores = new Map<number, number[]>();
    courseModules.forEach((m) => moduleQuizScores.set(m.moduleId, []));

    userGradeItems.forEach((g) => {
      if (g.itemmodule !== "quiz" || g.graderaw === null || g.grademax === 0) return;
      const loc = cmidToSection.get(g.cmid);
      if (!loc || !moduleQuizScores.has(loc.section)) return;
      moduleQuizScores.get(loc.section)!.push(Math.round((g.graderaw / g.grademax) * 100));
    });

    const quizStats = courseModules.map((mod) => {
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

    const validQuizScores = quizStats.filter((q) => q.attemptCount > 0).map((q) => q.avgScore);
    const avgQuizScore =
      validQuizScores.length > 0
        ? Math.round(validQuizScores.reduce((a, b) => a + b, 0) / validQuizScores.length)
        : 0;

    // ── Assignments ───────────────────────────────────────────────────────
    const assignments = assignData.assignments.map((a) => {
      const userSub = (assignData.submissionsByAssignment[String(a.id)] ?? []).find(
        (s) => s.userid === userId && s.status === "submitted"
      );
      const loc = cmidToSection.get(a.cmid);
      const gradeItem = userGradeItems.find(
        (g) => g.itemmodule === "assign" && g.cmid === a.cmid
      );
      const grade =
        gradeItem && gradeItem.graderaw !== null && gradeItem.grademax > 0
          ? Math.round((gradeItem.graderaw / gradeItem.grademax) * 100)
          : undefined;

      return {
        id: a.id,
        name: a.name,
        moduleId: loc?.section ?? 0,
        moduleName: loc?.sectionName ?? "Unknown",
        submitted: !!userSub,
        submittedAt: userSub?.timemodified,
        grade,
      };
    });

    const assignmentsSubmitted = assignments.filter((a) => a.submitted).length;

    // ── Activity timeline from real events ────────────────────────────────
    const timelineEvents: ActivityEvent[] = [];
    let eventId = 1;

    // Assignment submission events (up to 4 most recent)
    assignments
      .filter((a) => a.submitted && a.submittedAt)
      .sort((a, b) => b.submittedAt! - a.submittedAt!)
      .slice(0, 4)
      .forEach((a) => {
        timelineEvents.push({
          id: eventId++,
          description: `Submitted: ${a.name}`,
          timestamp: a.submittedAt!,
          type: "assignment",
        });
      });

    // Most recent forum discussion
    const latestForum = forumData.userLatestDiscussion[String(userId)];
    if (latestForum) {
      timelineEvents.push({
        id: eventId++,
        description: "Started a forum discussion",
        timestamp: latestForum,
        type: "forum",
      });
    }

    // Last course access
    if (student.lastcourseaccess) {
      timelineEvents.push({
        id: eventId++,
        description: "Accessed the course",
        timestamp: student.lastcourseaccess,
        type: "login",
      });
    }

    const activityTimeline = timelineEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);

    // ── Scalar KPIs ───────────────────────────────────────────────────────
    const forumPosts = forumData.userDiscussionCount[String(userId)] ?? 0;
    const engagementScore = Math.min(
      100,
      Math.round(forumPosts * 3 + avgQuizScore * 0.3 + completionPct * 0.2)
    );
    const daysSinceActive = student.lastcourseaccess
      ? Math.floor((Date.now() / 1000 - student.lastcourseaccess) / 86400)
      : 999;
    const riskLevel: RiskLevel =
      !student.lastcourseaccess || daysSinceActive > 14
        ? "inactive"
        : daysSinceActive > 7 || completionPct < 25
        ? "at_risk"
        : "active";

    return NextResponse.json({
      ...student,
      completionPct,
      avgQuizScore,
      assignmentsSubmitted,
      assignmentsTotal: assignData.assignments.length,
      forumPosts,
      engagementScore,
      riskLevel,
      daysSinceActive,
      moduleProgress,
      quizStats,
      assignments,
      activityTimeline,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
