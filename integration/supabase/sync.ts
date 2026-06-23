/**
 * Moodle → Supabase sync service.
 *
 * Called by /api/sync, which is triggered by the cron job every 2 hours.
 * Steps run sequentially: students must be written before completions (FK).
 * core_course_get_contents is fetched once and shared across three steps.
 */

import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import { supabase } from "./server";

const BATCH = 500; // max rows per Supabase upsert call
const ts = () => new Date().toISOString();

// ── Moodle shapes ─────────────────────────────────────────────────────────────

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

interface MoodleModule {
  id: number;
  instance: number;
  name: string;
  modname: string;
  completion: number;
  visible: number;
  url?: string;
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  summary?: string;
  component?: string | null;
  itemid?: number | null;
  modules: MoodleModule[];
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function upsertBatch<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH) as unknown as object[];
    const { error } = await supabase
      .from(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any, { onConflict });
    if (error) throw new Error(`[sync] ${table} upsert failed: ${error.message}`);
  }
}

async function batchRun<In, Out>(
  items: In[],
  fn: (item: In) => Promise<Out>,
  concurrency = 50
): Promise<Out[]> {
  const results: Out[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    results.push(...await Promise.all(items.slice(i, i + concurrency).map(fn)));
  }
  return results;
}

// ── Step 1: Students ──────────────────────────────────────────────────────────

async function syncStudents(): Promise<number> {
  const batch = await moodleCall<MoodleUser[]>("core_enrol_get_enrolled_users", {
    courseid: COURSE_ID,
    "options[0][name]": "userfields",
    "options[0][value]":
      "id,fullname,email,lastaccess,lastcourseaccess,profileimageurl,roles,customfields",
  });

  const rows = (batch ?? [])
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
        lastaccess: lastaccess ?? 0,
        lastcourseaccess: lastcourseaccess ?? 0,
        profileimageurl: profileimageurl ?? "",
        gender: cf.gender ?? null,
        state: cf.state ?? null,
        lga: cf.lga ?? null,
        region: cf.region ?? null,
        synced_at: ts(),
      };
    });

  await upsertBatch("students", rows, "id");
  return rows.length;
}

// ── Step 2: Course contents (modules + quiz instances + course structure) ─────

function buildModuleRows(sections: MoodleSection[]) {
  const visible = sections.filter((s) => s.visible === 1);
  const topLevel = visible.filter((s) => s.component !== "mod_subsection" && s.section > 0);
  const lessonSections = visible.filter((s) => s.component === "mod_subsection");

  const instanceToParent = new Map<number, number>();
  topLevel.forEach((parent, idx) =>
    parent.modules
      .filter((m) => m.modname === "subsection")
      .forEach((m) => instanceToParent.set(m.instance, idx))
  );

  const activityIdsByParent: number[][] = topLevel.map(() => []);
  for (const lesson of lessonSections) {
    if (!lesson.itemid) continue;
    const idx = instanceToParent.get(lesson.itemid);
    if (idx === undefined) continue;
    activityIdsByParent[idx].push(
      ...lesson.modules.filter((m) => m.completion > 0).map((m) => m.id)
    );
  }

  return topLevel
    .map((s, idx) => ({
      module_id: s.section,
      module_name: s.name,
      activity_ids: activityIdsByParent[idx],
      synced_at: ts(),
    }))
    .filter((m) => m.activity_ids.length > 0);
}

function buildQuizInstanceRows(sections: MoodleSection[]) {
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

  const rows: Array<{ quiz_id: number; module_section: number; module_name: string; synced_at: string }> = [];
  sections
    .filter((s) => s.component === "mod_subsection" && !!s.itemid)
    .forEach((s) => {
      const parent = instanceToModule.get(s.itemid!);
      if (!parent) return;
      s.modules
        .filter((m) => m.modname === "quiz")
        .forEach((m) =>
          rows.push({
            quiz_id: m.instance,
            module_section: parent.section,
            module_name: parent.sectionName,
            synced_at: ts(),
          })
        );
    });

  return rows;
}

async function syncCourseContents(): Promise<{ modulesCount: number; quizInstancesCount: number }> {
  const sections = await moodleCall<MoodleSection[]>("core_course_get_contents", {
    courseid: COURSE_ID,
  });

  const moduleRows = buildModuleRows(sections);
  const quizInstanceRows = buildQuizInstanceRows(sections);

  await upsertBatch("course_modules", moduleRows, "module_id");

  if (quizInstanceRows.length) {
    await upsertBatch("quiz_instances", quizInstanceRows, "quiz_id");
  }

  // Raw sections stored as JSONB — the course-structure API route reprocesses them
  const { error } = await supabase
    .from("course_structure")
    .upsert({ course_id: COURSE_ID, sections, synced_at: ts() }, { onConflict: "course_id" });
  if (error) throw new Error(`[sync] course_structure upsert failed: ${error.message}`);

  return { modulesCount: moduleRows.length, quizInstancesCount: quizInstanceRows.length };
}

// ── Step 3: Completions ───────────────────────────────────────────────────────

async function syncCompletions(): Promise<number> {
  const { data: active, error } = await supabase
    .from("students")
    .select("id")
    .gt("lastcourseaccess", 0);

  if (error) throw new Error(`[sync] could not read active students: ${error.message}`);

  const ids = (active ?? []).map((s: { id: number }) => s.id);
  console.log(`[sync] completions: fetching for ${ids.length} active students`);

  const rows = await batchRun(
    ids,
    async (userId: number) => {
      try {
        // _attempt=3 disables retries — retrying per-user calls would triple load on Moodle
        const res = await moodleCall<{
          statuses: Array<{ cmid: number; state: number; tracking: number }>;
        }>("core_completion_get_activities_completion_status", { courseid: COURSE_ID, userid: userId }, 3);

        const done = (res.statuses ?? [])
          .filter(({ tracking, state }) => tracking > 0 && state >= 1)
          .map(({ cmid }) => cmid);

        return { user_id: userId, completed_cmids: done, synced_at: ts() };
      } catch {
        return { user_id: userId, completed_cmids: [], synced_at: ts() };
      }
    },
    50
  );

  await upsertBatch("completions", rows, "user_id");
  return rows.length;
}

// ── Step 4: Quiz details ──────────────────────────────────────────────────────

async function syncQuizDetails(): Promise<number> {
  const res = await moodleCall<{ quizzes: Array<{ id: number; grade: number }> }>(
    "mod_quiz_get_quizzes_by_courses",
    { "courseids[0]": COURSE_ID }
  ).catch(() => ({ quizzes: [] as Array<{ id: number; grade: number }> }));

  const rows = (res.quizzes ?? []).map((q) => ({
    quiz_id: q.id,
    grade_max: q.grade,
    synced_at: ts(),
  }));

  if (rows.length) await upsertBatch("quiz_details", rows, "quiz_id");
  return rows.length;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  durationMs: number;
  studentsCount?: number;
  modulesCount?: number;
  completionsCount?: number;
  quizDetailsCount?: number;
  quizInstancesCount?: number;
  error?: string;
}

export async function runFullSync(): Promise<SyncResult> {
  const t0 = Date.now();

  const { data: logRow } = await supabase
    .from("sync_log")
    .insert({ started_at: ts(), status: "running" })
    .select("id")
    .single();
  const logId = (logRow as { id: number } | null)?.id;

  const finalizeLog = (status: "ok" | "error", extra: Record<string, unknown> = {}) =>
    logId
      ? supabase.from("sync_log").update({ status, finished_at: ts(), ...extra }).eq("id", logId)
      : Promise.resolve();

  try {
    // Step 1 — students must complete before completions (FK constraint)
    const studentsCount = await syncStudents();
    console.log(`[sync] students: ${studentsCount}`);

    // Step 2 — one Moodle call covers modules, quiz instances, and course structure
    const { modulesCount, quizInstancesCount } = await syncCourseContents();
    console.log(`[sync] course_modules: ${modulesCount}, quiz_instances: ${quizInstancesCount}`);

    // Step 3 — slowest: one Moodle call per active student (~8 min for 1000+ students)
    const completionsCount = await syncCompletions();
    console.log(`[sync] completions: ${completionsCount}`);

    // Step 4 — single Moodle call for all quiz metadata
    const quizDetailsCount = await syncQuizDetails();
    console.log(`[sync] quiz_details: ${quizDetailsCount}`);

    const durationMs = Date.now() - t0;
    await finalizeLog("ok", {
      details: { studentsCount, modulesCount, completionsCount, quizDetailsCount, quizInstancesCount, durationMs },
    });

    return {
      success: true,
      durationMs,
      studentsCount,
      modulesCount,
      completionsCount,
      quizDetailsCount,
      quizInstancesCount,
    };
  } catch (err) {
    const error = (err as Error).message ?? "Unknown sync error";
    await finalizeLog("error", { error });
    return { success: false, durationMs: Date.now() - t0, error };
  }
}
