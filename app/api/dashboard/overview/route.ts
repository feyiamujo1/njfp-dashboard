import { NextResponse } from "next/server";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";
import moment from "moment";

// Allow up to 60 s — first cold load batches 5 000 completion calls.
// Subsequent requests within the 5-min fetch-cache window are instant.
export const maxDuration = 60;

// ─── Moodle response shapes ───────────────────────────────────────────────────

interface MoodleUser {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number;
  lastcourseaccess: number;
  profileimageurl: string;
  roles: Array<{ shortname: string }>;
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  modules: Array<{ id: number; modname: string; completion: number }>;
}

interface MoodleCompletionStatus {
  statuses: Array<{
    cmid: number;
    state: number;    // 0 = incomplete, ≥1 = complete
    tracking: number; // 0 = none, 1 = manual, 2 = auto
  }>;
}

interface MoodleAssignmentList {
  courses: Array<{
    assignments: Array<{ id: number }>;
  }>;
}

interface MoodleSubmissionsResponse {
  assignments: Array<{
    assignmentid: number;
    submissions: Array<{ status: string }>;
  }>;
}

interface MoodleCourseGrade {
  courseid: number;
  rawgrade: string;
  rawgrademax: string;
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchAllStudents(): Promise<MoodleUser[]> {
  const all: MoodleUser[] = [];
  let offset = 0;
  const perPage = 1000;

  while (true) {
    const batch = await moodleCall<MoodleUser[]>(
      "core_enrol_get_enrolled_users",
      {
        courseid: COURSE_ID,
        "options[0][name]": "limitfrom",
        "options[0][value]": offset,
        "options[1][name]": "limitnumber",
        "options[1][value]": perPage,
      }
    );
    all.push(
      ...batch.filter((u) => u.roles.some((r) => r.shortname === "student"))
    );
    if (batch.length < perPage) break;
    offset += perPage;
  }

  return all;
}

async function fetchCourseModules() {
  const sections = await moodleCall<MoodleSection[]>(
    "core_course_get_contents",
    { courseid: COURSE_ID }
  );

  // Skip section 0 (Course Introduction), take module sections 1–N
  return sections
    .filter((s) => s.visible === 1 && s.section > 0)
    .map((s) => ({
      moduleId: s.section,
      moduleName: s.name,
      activityIds: s.modules
        .filter((m) => m.modname === "subsection")
        .map((m) => m.id),
    }))
    .filter((m) => m.activityIds.length > 0);
}

/** Run fn concurrently over items in chunks, preserving order */
async function batchProcess<In, Out>(
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

async function fetchUserCompletion(userId: number): Promise<MoodleCompletionStatus> {
  try {
    return await moodleCall<MoodleCompletionStatus>(
      "core_completion_get_activities_completion_status",
      { courseid: COURSE_ID, userid: userId }
    );
  } catch {
    return { statuses: [] };
  }
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

async function computeCompletionStats(
  students: MoodleUser[],
  courseModules: Awaited<ReturnType<typeof fetchCourseModules>>
) {
  const total = students.length;

  const completions = await batchProcess(
    students.map((s) => s.id),
    fetchUserCompletion
  );

  // Build userId → Set of completed cmids
  const completedByUser = new Map<number, Set<number>>();
  students.forEach((s, i) => {
    const done = new Set<number>();
    (completions[i]?.statuses ?? []).forEach(({ cmid, state, tracking }) => {
      if (tracking > 0 && state >= 1) done.add(cmid);
    });
    completedByUser.set(s.id, done);
  });

  const moduleProgress = courseModules.map((mod) => {
    const completedCount =
      mod.activityIds.length === 0
        ? 0
        : students.filter((s) => {
            const done = completedByUser.get(s.id) ?? new Set();
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

  // Course "complete" = finished ≥ 50% of modules
  const halfModules = Math.ceil(courseModules.length / 2);
  const courseCompleted = students.filter((s) => {
    const done = completedByUser.get(s.id) ?? new Set();
    return (
      courseModules.filter(
        (m) =>
          m.activityIds.length > 0 && m.activityIds.every((id) => done.has(id))
      ).length >= halfModules
    );
  }).length;

  return {
    moduleProgress,
    completionRate: total > 0 ? Math.round((courseCompleted / total) * 100) : 0,
    completedByUser,
  };
}

async function computeAssignmentRate(totalFellows: number): Promise<number> {
  try {
    const { courses } = await moodleCall<MoodleAssignmentList>(
      "mod_assign_get_assignments",
      { "courseids[0]": COURSE_ID }
    );
    const assignments = courses[0]?.assignments ?? [];
    if (assignments.length === 0 || totalFellows === 0) return 0;

    const idParams: Record<string, string | number> = {};
    assignments.forEach((a, i) => {
      idParams[`assignmentids[${i}]`] = a.id;
    });

    const { assignments: subs } =
      await moodleCall<MoodleSubmissionsResponse>(
        "mod_assign_get_submissions",
        idParams
      );

    const submitted = subs.reduce(
      (sum, a) =>
        sum + a.submissions.filter((s) => s.status === "submitted").length,
      0
    );

    return Math.round(
      (submitted / (totalFellows * assignments.length)) * 100
    );
  } catch {
    return 0;
  }
}

async function computeAvgQuizScore(students: MoodleUser[]): Promise<number> {
  try {
    const scores = await batchProcess(
      students.map((s) => s.id),
      async (userId): Promise<number | null> => {
        try {
          const res = await moodleCall<{ grades: MoodleCourseGrade[] }>(
            "gradereport_overview_get_course_grades",
            { userid: userId }
          );
          const entry = res.grades?.find((g) => g.courseid === COURSE_ID);
          if (!entry) return null;
          const raw = parseFloat(entry.rawgrade);
          const max = parseFloat(entry.rawgrademax);
          if (isNaN(raw) || isNaN(max) || max === 0 || raw <= 0) return null;
          return Math.round((raw / max) * 100);
        } catch {
          return null;
        }
      },
      100 // lighter calls — higher concurrency
    );

    const valid = scores.filter((s): s is number => s !== null);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  } catch {
    return 0;
  }
}

function computeWeeklyActive(
  students: MoodleUser[]
): Array<{ week: string; active: number }> {
  const result: Array<{ week: string; active: number }> = [];

  for (let w = 7; w >= 0; w--) {
    const start = moment().subtract(w, "weeks").startOf("isoWeek");
    const end = moment().subtract(w, "weeks").endOf("isoWeek");

    const active = students.filter((s) => {
      if (!s.lastcourseaccess) return false;
      return moment.unix(s.lastcourseaccess).isBetween(start, end, undefined, "[]");
    }).length;

    result.push({ week: start.format("MMM D"), active });
  }

  return result;
}

function classifyRisk(
  user: MoodleUser,
  completionPct: number
): "active" | "at_risk" | "inactive" {
  if (!user.lastcourseaccess) return "inactive";
  const daysSince = (Date.now() / 1000 - user.lastcourseaccess) / 86400;
  if (daysSince > 14) return "inactive";
  if (daysSince > 7 || completionPct < 25) return "at_risk";
  return "active";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const students = await fetchAllStudents();
    const total = students.length;
    const courseModules = await fetchCourseModules();

    const [completionData, assignmentRate, avgQuizScore] = await Promise.all([
      computeCompletionStats(students, courseModules),
      computeAssignmentRate(total),
      computeAvgQuizScore(students),
    ]);

    const now = Date.now() / 1000;
    const activeFellows = students.filter(
      (s) => s.lastcourseaccess && now - s.lastcourseaccess < 7 * 86400
    ).length;

    const totalActivities = courseModules.reduce(
      (sum, m) => sum + m.activityIds.length,
      0
    );

    let activeCount = 0,
      atRiskCount = 0,
      inactiveCount = 0;

    students.forEach((s) => {
      const done = completionData.completedByUser.get(s.id) ?? new Set<number>();
      const doneCount = courseModules.reduce(
        (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
        0
      );
      const pct = totalActivities > 0 ? (doneCount / totalActivities) * 100 : 0;
      const risk = classifyRisk(s, pct);
      if (risk === "active") activeCount++;
      else if (risk === "at_risk") atRiskCount++;
      else inactiveCount++;
    });

    return NextResponse.json({
      stats: {
        totalFellows: total,
        activeFellows,
        completionRate: completionData.completionRate,
        avgQuizScore,
        assignmentCompletionRate: assignmentRate,
        atRiskCount,
      },
      weeklyActive: computeWeeklyActive(students),
      moduleCompletion: completionData.moduleProgress,
      riskDistribution: {
        active: activeCount,
        atRisk: atRiskCount,
        inactive: inactiveCount,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
