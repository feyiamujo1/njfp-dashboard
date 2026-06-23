import { NextResponse } from "next/server";
import {
  getCachedStudents,
  getCachedCourseModules,
  getCachedRawCompletions,
  makeCompletedByUser,
} from "@/lib/server/sharedData";

export const maxDuration = 120;

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

    let courseCompletedCount = 0;
    let totalCompletionPctSum = 0;

    const learnerStats = students.map((s) => {
      const done = completedByUser.get(s.id) ?? new Set<number>();
      const doneCount = courseModules.reduce(
        (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
        0
      );
      const completionPct = totalActivities > 0 ? (doneCount / totalActivities) * 100 : 0;
      totalCompletionPctSum += completionPct;

      const modulesFinished = courseModules.filter(
        (m) => m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
      ).length;
      if (modulesFinished >= halfModules) courseCompletedCount++;

      return { s, doneCount, completionPct };
    });

    const topLearners = learnerStats
      .filter(({ doneCount }) => totalActivities > 0 && doneCount === totalActivities)
      .sort((a, b) => (b.s.lastcourseaccess ?? 0) - (a.s.lastcourseaccess ?? 0))
      .map(({ s, doneCount }) => ({
        id: s.id,
        fullname: s.fullname,
        email: s.email,
        profileimageurl: s.profileimageurl,
        lastcourseaccess: s.lastcourseaccess,
        activitiesDone: doneCount,
        totalActivities,
        completionPct: 100,
      }));

    const avgCompletionPct = total > 0 ? Math.round(totalCompletionPctSum / total) : 0;
    const completionRate = total > 0 ? Math.round((courseCompletedCount / total) * 100) : 0;

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

    console.log("[overview/completion]", { completionRate, avgCompletionPct, topLearnersCount: topLearners.length, moduleCompletion: moduleCompletion.map(m => ({ name: m.moduleName, pct: m.completionPct + "%" })) });

    return NextResponse.json({ completionRate, avgCompletionPct, completedFellows: courseCompletedCount, moduleCompletion, topLearners });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
