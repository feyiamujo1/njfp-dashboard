/**
 * Shared server-side data cache.
 *
 * Expensive Moodle calls (enrolled students, per-user completion, forum
 * discussions, quiz details) are wrapped in unstable_cache so the processed
 * result is stored for 5 minutes.  Multiple route handlers that open within
 * the same cache window pay the cost only once.
 *
 * Return types are plain JSON-serialisable objects — no Map/Set.
 * Use the hydration helpers below to rebuild Maps inside route handlers.
 */

import { unstable_cache } from "next/cache";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import type { FellowSummary, RiskLevel } from "@/lib/types";

// ─── Internal Moodle shapes ───────────────────────────────────────────────────

export interface CachedStudent {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number;
  lastcourseaccess: number;
  profileimageurl: string;
  gender: string | null;
  state: string | null;
  lga: string | null;
  region: string | null;
}

export interface CachedCourseModule {
  moduleId: number;
  moduleName: string;
  activityIds: number[];
}

/** Quiz instance → max grade (for percentage calculation) */
export interface CachedQuizDetail {
  quizId: number;
  gradeMax: number;
}

// ─── Internal interfaces (not exported) ───────────────────────────────────────

interface MoodleUser {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number;
  lastcourseaccess: number;
  profileimageurl: string;
  roles: Array<{ shortname: string }>;
  customfields?: Array<{ shortname: string; value: string }>;
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  component?: string | null;
  itemid?: number | null;
  modules: Array<{ id: number; instance: number; modname: string; completion: number }>;
}

interface MoodleCompletionStatus {
  statuses: Array<{ cmid: number; state: number; tracking: number }>;
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

export async function batchProcess<In, Out>(
  items: In[],
  fn: (item: In) => Promise<Out>,
  concurrency = 50
): Promise<Out[]> {
  const results: Out[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

// ─── Raw fetchers (called inside unstable_cache wrappers) ─────────────────────

async function _fetchAllStudents(): Promise<CachedStudent[]> {
  const batch = await moodleCall<MoodleUser[]>("core_enrol_get_enrolled_users", {
    courseid: COURSE_ID,
    // Limit flat profile fields to reduce response payload.
    // roles and customfields are relational — Moodle includes them regardless
    // of this option, so omitting them here avoids silently dropping the data.
    "options[0][name]": "userfields",
    "options[0][value]":
      "id,fullname,email,lastaccess,lastcourseaccess,profileimageurl,roles,customfields",
  });
  return (batch ?? [])
    .filter((u) => u.roles.some((r) => r.shortname === "student"))
    .map(({ id, fullname, email, lastaccess, lastcourseaccess, profileimageurl, customfields }) => {
      const cf = (customfields ?? []).reduce<Record<string, string>>((acc, f) => {
        acc[f.shortname] = f.value;
        return acc;
      }, {});
      return {
        id,
        fullname,
        email,
        lastaccess,
        lastcourseaccess,
        profileimageurl,
        gender: cf.gender ?? null,
        state: cf.state ?? null,
        lga: cf.lga ?? null,
        region: cf.region ?? null,
      };
    });
}

async function _fetchCourseModules(): Promise<CachedCourseModule[]> {
  const sections = await moodleCall<MoodleSection[]>("core_course_get_contents", {
    courseid: COURSE_ID,
  });

  const visible = sections.filter((s) => s.visible === 1);

  // Split into top-level sections (component: null) and lesson sections (component: "mod_subsection").
  // The subsection nav modules inside top-level sections have completion: 0 and are NOT tracked.
  // The actual tracked activities (label, resource, folder, quiz) live inside the lesson sections.
  const topLevel = visible.filter((s) => s.component !== "mod_subsection" && s.section > 0);
  const lessonSections = visible.filter((s) => s.component === "mod_subsection");

  // Map: subsection module instance → parent section index (within topLevel)
  const instanceToParent = new Map<number, number>();
  topLevel.forEach((parent, idx) => {
    parent.modules
      .filter((m) => m.modname === "subsection")
      .forEach((m) => instanceToParent.set(m.instance, idx));
  });

  // Build activityIds per parent module using lesson section tracked activities
  const activityIdsByParent: number[][] = topLevel.map(() => []);
  for (const lesson of lessonSections) {
    if (!lesson.itemid) continue;
    const parentIdx = instanceToParent.get(lesson.itemid);
    if (parentIdx === undefined) continue;
    const tracked = lesson.modules
      .filter((m) => m.completion > 0)
      .map((m) => m.id);
    activityIdsByParent[parentIdx].push(...tracked);
  }

  return topLevel
    .map((s, idx) => ({
      moduleId: s.section,
      moduleName: s.name,
      activityIds: activityIdsByParent[idx],
    }))
    .filter((m) => m.activityIds.length > 0);
}

async function _fetchUserCompletion(
  userId: number
): Promise<MoodleCompletionStatus> {
  try {
    // Pass _attempt=3 to skip retries — this is called once per student so
    // retrying would multiply failed requests by 4× and hammer an already
    // struggling Moodle server. Errors are handled gracefully by the catch.
    return await moodleCall<MoodleCompletionStatus>(
      "core_completion_get_activities_completion_status",
      { courseid: COURSE_ID, userid: userId },
      3
    );
  } catch {
    return { statuses: [] };
  }
}

async function _fetchRawCompletions(): Promise<Record<string, number[]>> {
  const students = await getCachedStudents();

  // Students who have never accessed the course have zero completions by
  // definition — skip them entirely to avoid thousands of wasted API calls.
  const everActive = students.filter((s) => s.lastcourseaccess > 0);

  console.log(
    `[completions] fetching for ${everActive.length} / ${students.length} students (${students.length - everActive.length} never active, skipped)`
  );

  const completions = await batchProcess(
    everActive.map((s) => s.id),
    _fetchUserCompletion,
    50
  );

  const result: Record<string, number[]> = {};
  everActive.forEach((s, i) => {
    const done: number[] = [];
    (completions[i]?.statuses ?? []).forEach(({ cmid, state, tracking }) => {
      if (tracking > 0 && state >= 1) done.push(cmid);
    });
    result[String(s.id)] = done;
  });
  // Never-active students are intentionally absent — makeCompletedByUser
  // returns new Set() for any missing key, so callers see them as 0% complete.
  return result;
}

async function _fetchQuizDetails(): Promise<CachedQuizDetail[]> {
  try {
    const res = await moodleCall<{ quizzes: Array<{ id: number; grade: number }> }>(
      "mod_quiz_get_quizzes_by_courses",
      { "courseids[0]": COURSE_ID }
    );
    return (res.quizzes ?? []).map((q) => ({ quizId: q.id, gradeMax: q.grade }));
  } catch {
    return [];
  }
}

// ─── Exported cached getters ──────────────────────────────────────────────────

export const getCachedStudents = unstable_cache(
  _fetchAllStudents,
  [`students-${COURSE_ID}`],
  { revalidate: 3600 }
);

export const getCachedCourseModules = unstable_cache(
  _fetchCourseModules,
  [`course-modules-${COURSE_ID}`],
  { revalidate: 3600 }
);

/** userId (string) → array of completed cmids */
export const getCachedRawCompletions = unstable_cache(
  _fetchRawCompletions,
  [`completions-${COURSE_ID}`],
  { revalidate: 3600 } // 1-hour TTL — completions change slowly; cold fetch takes ~8 min
);

/** Quiz details: instance id → gradeMax (from mod_quiz_get_quizzes_by_courses) */
export const getCachedQuizDetails = unstable_cache(
  _fetchQuizDetails,
  [`quiz-details-${COURSE_ID}`],
  { revalidate: 3600 }
);

// ─── Quiz instances (shared between list route and per-user quiz route) ────────

export interface QuizInstance {
  quizId: number;
  moduleSection: number;
  moduleName: string;
}

async function _fetchQuizInstances(): Promise<QuizInstance[]> {
  const sections = await moodleCall<
    Array<{
      section: number;
      name: string;
      visible: 1 | 0;
      component?: string | null;
      itemid?: number | null;
      modules: Array<{ id: number; instance: number; modname: string }>;
    }>
  >("core_course_get_contents", { courseid: COURSE_ID });

  const instanceToModule = new Map<number, { section: number; sectionName: string }>();
  sections
    .filter((s) => s.component !== "mod_subsection")
    .forEach((s) =>
      s.modules
        .filter((m) => m.modname === "subsection")
        .forEach((m) =>
          instanceToModule.set(m.instance, { section: s.section, sectionName: s.name })
        )
    );

  const quizInstances: QuizInstance[] = [];
  sections
    .filter((s) => s.component === "mod_subsection" && !!s.itemid)
    .forEach((s) => {
      const parent = instanceToModule.get(s.itemid!);
      if (!parent) return;
      s.modules
        .filter((m) => m.modname === "quiz")
        .forEach((m) =>
          quizInstances.push({
            quizId: m.instance,
            moduleSection: parent.section,
            moduleName: parent.sectionName,
          })
        );
    });

  return quizInstances;
}

export const getCachedQuizInstances = unstable_cache(
  _fetchQuizInstances,
  [`quiz-instances-${COURSE_ID}`],
  { revalidate: 3600 }
);

// ─── Hydration helpers ────────────────────────────────────────────────────────

/** Reconstruct Map<userId, Set<cmid>> from the serialised cache format */
export function makeCompletedByUser(
  raw: Record<string, number[]>
): Map<number, Set<number>> {
  return new Map(Object.entries(raw).map(([k, v]) => [Number(k), new Set(v)]));
}

// ─── Shared computation ───────────────────────────────────────────────────────

/**
 * Build the full FellowSummary array for all enrolled students.
 * All underlying data is served from cache — subsequent calls within the
 * 5-minute window are CPU-only (no Moodle network I/O).
 *
 * Note: avgQuizScore is 0 for all summaries because mod_quiz_get_user_best_grade
 * requires one call per (user × quiz) — infeasible at bulk scale. Real quiz
 * scores are only computed on the individual learner detail page.
 */
export async function buildAllFellowSummaries(): Promise<FellowSummary[]> {
  const [students, courseModules, rawCompletions] = await Promise.all([
    getCachedStudents(),
    getCachedCourseModules(),
    getCachedRawCompletions(),
  ]);

  const completedByUser = makeCompletedByUser(rawCompletions);
  const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);

  return students.map(s => {
    const done = completedByUser.get(s.id) ?? new Set<number>();

    const doneCount = courseModules.reduce(
      (sum, m) => sum + m.activityIds.filter(id => done.has(id)).length,
      0
    );
    const completionPct =
      totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

    const engagementScore = Math.min(100, Math.round(completionPct * 0.7));

    const daysSinceActive = s.lastcourseaccess
      ? Math.floor((Date.now() / 1000 - s.lastcourseaccess) / 86400)
      : 999;

    const riskLevel: RiskLevel =
      !s.lastcourseaccess || daysSinceActive > 14
        ? "inactive"
        : daysSinceActive > 7 || completionPct < 25
          ? "at_risk"
          : "active";

    return {
      ...s,
      completionPct,
      avgQuizScore: 0,
      engagementScore,
      riskLevel,
      daysSinceActive,
    };
  });
}
