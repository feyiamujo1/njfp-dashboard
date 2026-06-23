/**
 * Supabase-backed data layer.
 *
 * All functions that previously called Moodle via unstable_cache now read from
 * Supabase. Data is kept fresh by the /api/sync cron job (every 2 hours).
 * Public function names and return types are unchanged so route files need
 * no modifications.
 */

import { supabase } from "@/integration/supabase/server";
import { COURSE_ID } from "@/lib/constants";

// Supabase PostgREST default max_rows is 1000. This constant overrides it on
// every query and must match (or be under) the Max Rows setting in
// Supabase Dashboard → Settings → API. Set that to 50000 as well.
const MAX_ROWS = 50_000;
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
    .select("id, fullname, email, lastaccess, lastcourseaccess, profileimageurl, gender, state, lga, region")
    .limit(MAX_ROWS);

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
    .select("user_id, completed_cmids")
    .limit(MAX_ROWS);

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

// ─── Course structure: per-activity details per module ────────────────────────

interface RawMod { id: number; name: string; modname: string; completion: number; visible: number; instance: number }
interface RawSection { visible: 1 | 0; section: number; component?: string | null; itemid?: number | null; modules: RawMod[] }

export interface ActivityDetail {
  cmid: number;
  name: string;
  modname: string;
  completion: number;
}

export interface ModuleActivityDetails {
  moduleId: number;
  moduleName: string;
  activities: ActivityDetail[];
}

export async function getCachedModuleActivityDetails(): Promise<ModuleActivityDetails[]> {
  const { data, error } = await supabase
    .from("course_structure")
    .select("sections")
    .eq("course_id", COURSE_ID)
    .single();

  if (error || !data) return [];

  const sections = data.sections as unknown as (RawSection & { name: string })[];
  const visible = sections.filter(s => s.visible === 1);
  const topLevel = visible.filter(s => s.component !== "mod_subsection" && s.section > 0);
  const lessonSections = visible.filter(s => s.component === "mod_subsection");

  const instanceToParent = new Map<number, number>();
  topLevel.forEach((parent, idx) =>
    parent.modules
      .filter(m => m.modname === "subsection" && m.visible !== 0)
      .forEach(m => instanceToParent.set(m.instance, idx))
  );

  const activitiesByParent: ActivityDetail[][] = topLevel.map(() => []);
  for (const lesson of lessonSections) {
    if (!lesson.itemid) continue;
    const idx = instanceToParent.get(lesson.itemid);
    if (idx === undefined) continue;
    for (const m of lesson.modules) {
      if (m.visible !== 0 && m.completion > 0) {
        activitiesByParent[idx].push({ cmid: m.id, name: m.name, modname: m.modname, completion: m.completion });
      }
    }
  }

  return topLevel
    .map((s, idx) => ({
      moduleId: s.section,
      moduleName: (s as unknown as { name: string }).name,
      activities: activitiesByParent[idx],
    }))
    .filter(m => m.activities.length > 0);
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

    const engagementScore = completionPct;

    const daysSinceActive = s.lastcourseaccess
      ? Math.floor((Date.now() / 1000 - s.lastcourseaccess) / 86400)
      : 999;

    // Learners who have substantially completed the course (≥80%) are treated as
    // active regardless of last-access time — they've finished, not dropped out.
    const riskLevel: RiskLevel =
      completionPct >= 80
        ? "active"
        : !s.lastcourseaccess || daysSinceActive > 14
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
