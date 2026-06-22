import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  getCachedCourseModules,
  getCachedQuizDetails,
  getCachedQuizInstances,
  type QuizInstance,
} from "@/lib/server/sharedData";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import type { QuizStat } from "@/lib/types";

export const maxDuration = 120;

async function fetchUserQuizGrades(
  userId: number,
  quizInstances: QuizInstance[],
  gradeMaxByQuizId: Map<number, number>
): Promise<Map<number, number[]>> {
  const results = await Promise.all(
    quizInstances.map(async (q) => {
      try {
        const res = await moodleCall<{
          hasgrade: boolean;
          grade: number;
          gradetopass: number;
        }>("mod_quiz_get_user_best_grade", { quizid: q.quizId, userid: userId });
        return { quiz: q, res };
      } catch {
        return { quiz: q, res: null };
      }
    })
  );

  const scoresByModule = new Map<number, number[]>();
  results.forEach(({ quiz, res }) => {
    if (!res || !res.hasgrade) return;
    const gradeMax = gradeMaxByQuizId.get(quiz.quizId);
    if (!gradeMax || gradeMax === 0) return;
    const pct = Math.round((res.grade / gradeMax) * 100);
    if (!scoresByModule.has(quiz.moduleSection)) scoresByModule.set(quiz.moduleSection, []);
    scoresByModule.get(quiz.moduleSection)!.push(pct);
  });

  return scoresByModule;
}

async function _computeUserQuizStats(userId: number): Promise<{
  quizStats: QuizStat[];
  avgQuizScore: number;
  engagementScore: number;
  completionPct: number;
}> {
  const [courseModules, quizDetails, quizInstances] = await Promise.all([
    getCachedCourseModules(),
    getCachedQuizDetails(),
    getCachedQuizInstances(),
  ]);

  const gradeMaxByQuizId = new Map(quizDetails.map((q) => [q.quizId, q.gradeMax]));
  const scoresByModule = await fetchUserQuizGrades(userId, quizInstances, gradeMaxByQuizId);

  const quizStats: QuizStat[] = courseModules.map((mod) => {
    const scores = scoresByModule.get(mod.moduleId) ?? [];
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

  const validScores = quizStats.filter((q) => q.attemptCount > 0).map((q) => q.avgScore);
  const avgQuizScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

  // completionPct is passed via URL param (from fast route) so we can compute
  // the real engagementScore here without re-fetching completion data.
  return { quizStats, avgQuizScore, engagementScore: 0, completionPct: 0 };
}

// Cache per user for 1 hour — quiz scores change rarely during an active course.
// Key includes userId so each user gets their own cache entry.
const computeUserQuizStats = (userId: number) =>
  unstable_cache(
    () => _computeUserQuizStats(userId),
    [`quiz-stats-${COURSE_ID}-${userId}`],
    { revalidate: 3600 }
  )();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid learner ID" }, { status: 400 });
  }

  const completionPct = Number(
    new URL(req.url).searchParams.get("completionPct") ?? "0"
  );

  try {
    const stats = await computeUserQuizStats(userId);
    const engagementScore = Math.min(
      100,
      Math.round(stats.avgQuizScore * 0.5 + completionPct * 0.5)
    );
    return NextResponse.json({ ...stats, completionPct, engagementScore });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
