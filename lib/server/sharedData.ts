/**
 * Supabase-backed data layer.
 *
 * All functions that previously called Moodle via unstable_cache now read from
 * Supabase. Data is kept fresh by the /api/sync cron job (every 2 hours).
 * Public function names and return types are unchanged so route files need
 * no modifications.
 */

import { supabase } from "@/integration/supabase/server";
import type { FellowSummary, RiskLevel } from "@/lib/types";

// ─── Exported types ───────────────────────────────────────────────────────────

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

export interface CachedQuizDetail {
  quizId: number;
  gradeMax: number;
}

export interface QuizInstance {
  quizId: number;
  moduleSection: number;
  moduleName: string;
}

// ─── Supabase queries ─────────────────────────────────────────────────────────

export async function getCachedStudents(): Promise<CachedStudent[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, fullname, email, lastaccess, lastcourseaccess, profileimageurl, gender, state, lga, region");

  if (error) throw new Error(`getCachedStudents: ${error.message}`);

  return (data ?? []).map(s => ({
    id: s.id,
    fullname: s.fullname,
    email: s.email,
    lastaccess: s.lastaccess,
    lastcourseaccess: s.lastcourseaccess,
    profileimageurl: s.profileimageurl,
    gender: s.gender,
    state: s.state,
    lga: s.lga,
    region: s.region,
  }));
}

export async function getCachedCourseModules(): Promise<CachedCourseModule[]> {
  const { data, error } = await supabase
    .from("course_modules")
    .select("module_id, module_name, activity_ids")
    .order("module_id");

  if (error) throw new Error(`getCachedCourseModules: ${error.message}`);

  return (data ?? []).map(m => ({
    moduleId: m.module_id,
    moduleName: m.module_name,
    activityIds: m.activity_ids,
  }));
}

export async function getCachedRawCompletions(): Promise<Record<string, number[]>> {
  const { data, error } = await supabase
    .from("completions")
    .select("user_id, completed_cmids");

  if (error) throw new Error(`getCachedRawCompletions: ${error.message}`);

  const result: Record<string, number[]> = {};
  (data ?? []).forEach(r => { result[String(r.user_id)] = r.completed_cmids; });
  return result;
}

export async function getCachedQuizDetails(): Promise<CachedQuizDetail[]> {
  const { data, error } = await supabase
    .from("quiz_details")
    .select("quiz_id, grade_max");

  if (error) throw new Error(`getCachedQuizDetails: ${error.message}`);

  return (data ?? []).map(q => ({
    quizId: q.quiz_id,
    gradeMax: Number(q.grade_max),
  }));
}

export async function getCachedQuizInstances(): Promise<QuizInstance[]> {
  const { data, error } = await supabase
    .from("quiz_instances")
    .select("quiz_id, module_section, module_name");

  if (error) throw new Error(`getCachedQuizInstances: ${error.message}`);

  return (data ?? []).map(q => ({
    quizId: q.quiz_id,
    moduleSection: q.module_section,
    moduleName: q.module_name,
  }));
}

// ─── Hydration helpers ────────────────────────────────────────────────────────

export function makeCompletedByUser(
  raw: Record<string, number[]>
): Map<number, Set<number>> {
  return new Map(Object.entries(raw).map(([k, v]) => [Number(k), new Set(v)]));
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

export async function batchProcess<In, Out>(
  items: In[],
  fn: (item: In) => Promise<Out>,
  concurrency = 50
): Promise<Out[]> {
  const results: Out[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    results.push(...(await Promise.all(items.slice(i, i + concurrency).map(fn))));
  }
  return results;
}

// ─── Shared computation ───────────────────────────────────────────────────────

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
