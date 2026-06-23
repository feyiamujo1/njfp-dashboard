// Supabase Edge Function — Moodle → Supabase sync
// Deno runtime. Deploy via Supabase Dashboard → Edge Functions → Create function.
//
// Required secrets (set in Dashboard → Edge Functions → Manage secrets):
//   MOODLE_BASE_URL   e.g. https://lms.njfp.ng
//   MOODLE_TOKEN      your Moodle web service token
//   SYNC_SECRET       same value as in your .env.local (optional header check)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ────────────────────────────────────────────────────────────────────

const COURSE_ID = 6;
const BATCH = 500;
const CONCURRENCY = 50;
const ts = () => new Date().toISOString();

const MOODLE_BASE = Deno.env.get("MOODLE_BASE_URL")!;
const MOODLE_TOKEN = Deno.env.get("MOODLE_TOKEN")!;
const SYNC_SECRET = Deno.env.get("SYNC_SECRET");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Moodle helper ─────────────────────────────────────────────────────────────

async function moodleCall<T>(
  wsfunction: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const query = new URLSearchParams({
    wstoken: MOODLE_TOKEN,
    moodlewsrestformat: "json",
    wsfunction,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });

  const res = await fetch(`${MOODLE_BASE}/webservice/rest/server.php?${query}`);
  const data = await res.json();

  if (data?.exception) throw new Error(`Moodle [${wsfunction}]: ${data.message}`);
  return data as T;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function upsertBatch<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + BATCH), { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function batchRun<In, Out>(
  items: In[],
  fn: (item: In) => Promise<Out>,
  concurrency = CONCURRENCY
): Promise<Out[]> {
  const results: Out[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    results.push(...await Promise.all(items.slice(i, i + concurrency).map(fn)));
  }
  return results;
}

// ── Moodle shapes ─────────────────────────────────────────────────────────────

interface MoodleUser {
  id: number; fullname: string; email: string;
  lastaccess: number; lastcourseaccess: number; profileimageurl: string;
  roles: Array<{ shortname: string }>;
  customfields?: Array<{ shortname: string; value: string }>;
}

interface MoodleModule {
  id: number; instance: number; name: string;
  modname: string; completion: number; visible: number; url?: string;
}

interface MoodleSection {
  id: number; name: string; visible: 1 | 0; section: number;
  summary?: string; component?: string | null; itemid?: number | null;
  modules: MoodleModule[];
}

// ── Sync steps ────────────────────────────────────────────────────────────────

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
        id, fullname, email,
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

async function syncCourseContents(): Promise<{ modulesCount: number; quizInstancesCount: number }> {
  const sections = await moodleCall<MoodleSection[]>("core_course_get_contents", {
    courseid: COURSE_ID,
  });

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

  const moduleRows = topLevel
    .map((s, idx) => ({
      module_id: s.section,
      module_name: s.name,
      activity_ids: activityIdsByParent[idx],
      synced_at: ts(),
    }))
    .filter((m) => m.activity_ids.length > 0);

  // Quiz instances
  const instanceToModule = new Map<number, { section: number; sectionName: string }>();
  sections
    .filter((s) => s.component !== "mod_subsection")
    .forEach((s) =>
      s.modules
        .filter((m) => m.modname === "subsection")
        .forEach((m) => instanceToModule.set(m.instance, { section: s.section, sectionName: s.name }))
    );

  const quizRows: Array<{ quiz_id: number; module_section: number; module_name: string; synced_at: string }> = [];
  sections
    .filter((s) => s.component === "mod_subsection" && !!s.itemid)
    .forEach((s) => {
      const parent = instanceToModule.get(s.itemid!);
      if (!parent) return;
      s.modules
        .filter((m) => m.modname === "quiz")
        .forEach((m) =>
          quizRows.push({
            quiz_id: m.instance,
            module_section: parent.section,
            module_name: parent.sectionName,
            synced_at: ts(),
          })
        );
    });

  await upsertBatch("course_modules", moduleRows, "module_id");
  if (quizRows.length) await upsertBatch("quiz_instances", quizRows, "quiz_id");

  const { error } = await supabase
    .from("course_structure")
    .upsert({ course_id: COURSE_ID, sections, synced_at: ts() }, { onConflict: "course_id" });
  if (error) throw new Error(`course_structure upsert failed: ${error.message}`);

  return { modulesCount: moduleRows.length, quizInstancesCount: quizRows.length };
}

async function syncCompletions(): Promise<number> {
  const { data: active, error } = await supabase
    .from("students")
    .select("id")
    .gt("lastcourseaccess", 0);

  if (error) throw new Error(`could not read active students: ${error.message}`);

  const ids = (active ?? []).map((s: { id: number }) => s.id);
  console.log(`[sync] completions: ${ids.length} active students`);

  const rows = await batchRun(ids, async (userId: number) => {
    try {
      const res = await moodleCall<{
        statuses: Array<{ cmid: number; state: number; tracking: number }>;
      }>("core_completion_get_activities_completion_status", {
        courseid: COURSE_ID,
        userid: userId,
      });
      const done = (res.statuses ?? [])
        .filter(({ tracking, state }) => tracking > 0 && state >= 1)
        .map(({ cmid }) => cmid);
      return { user_id: userId, completed_cmids: done, synced_at: ts() };
    } catch {
      return { user_id: userId, completed_cmids: [], synced_at: ts() };
    }
  });

  await upsertBatch("completions", rows, "user_id");
  return rows.length;
}

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

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (SYNC_SECRET) {
    const auth = req.headers.get("x-sync-secret") ?? "";
    if (auth !== SYNC_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

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
    const studentsCount = await syncStudents();
    console.log(`[sync] students: ${studentsCount}`);

    const { modulesCount, quizInstancesCount } = await syncCourseContents();
    console.log(`[sync] modules: ${modulesCount}, quiz_instances: ${quizInstancesCount}`);

    const completionsCount = await syncCompletions();
    console.log(`[sync] completions: ${completionsCount}`);

    const quizDetailsCount = await syncQuizDetails();
    console.log(`[sync] quiz_details: ${quizDetailsCount}`);

    const durationMs = Date.now() - t0;
    await finalizeLog("ok", {
      details: { studentsCount, modulesCount, completionsCount, quizDetailsCount, quizInstancesCount, durationMs },
    });

    return new Response(
      JSON.stringify({ success: true, durationMs, studentsCount, modulesCount, completionsCount }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const error = (err as Error).message ?? "Unknown error";
    await finalizeLog("error", { error });
    return new Response(
      JSON.stringify({ success: false, durationMs: Date.now() - t0, error }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
