/**
 * Shared server-side data cache.
 *
 * Expensive Moodle calls (enrolled students, per-user completion, per-user
 * grade items, forum discussions) are wrapped in unstable_cache so the
 * processed result is stored for 5 minutes.  Multiple route handlers that
 * open within the same cache window pay the cost only once.
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
}

export interface CachedCourseModule {
  moduleId: number;
  moduleName: string;
  activityIds: number[];
}

export interface CachedGradeItem {
  itemmodule: string; // "quiz" | "assign" | ...
  cmid: number;
  graderaw: number | null;
  grademax: number;
}

export interface CachedForumData {
  /** section → { posts, replies } */
  bySection: Record<string, { posts: number; replies: number }>;
  /** userId → discussions started count */
  userDiscussionCount: Record<string, number>;
  /** userId → latest discussion Unix timestamp (for activity timeline) */
  userLatestDiscussion: Record<string, number>;
  totalPosts: number;
  totalReplies: number;
}

export interface CachedAssignment {
  id: number;
  name: string;
  cmid: number;
}

export interface CachedSubmission {
  userid: number;
  status: string;
  timemodified: number;
}

export interface CachedAssignmentData {
  assignments: CachedAssignment[];
  /** assignmentId (string) → submissions */
  submissionsByAssignment: Record<string, CachedSubmission[]>;
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
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  modules: Array<{ id: number; modname: string; completion: number }>;
}

interface MoodleCompletionStatus {
  statuses: Array<{ cmid: number; state: number; tracking: number }>;
}

interface MoodleUserGrades {
  usergrades: Array<{
    userid: number;
    gradeitems: Array<{
      itemmodule: string;
      cmid: number;
      graderaw: number | null;
      grademax: number;
    }>;
  }>;
}

interface MoodleForum {
  id: number;
  cmid: number;
  name: string;
  course: number;
}

interface MoodleDiscussion {
  userid: number;
  numreplies: number;
  timemodified: number;
}

interface MoodleAssignmentList {
  courses: Array<{ assignments: Array<{ id: number; name: string; cmid: number }> }>;
}

interface MoodleSubmissionsResponse {
  assignments: Array<{
    assignmentid: number;
    submissions: Array<{ userid: number; status: string; timemodified: number }>;
  }>;
}

interface MoodleDiscussionResult {
  discussions?: MoodleDiscussion[];
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
  const all: MoodleUser[] = [];
  let offset = 0;
  const perPage = 1000;
  while (true) {
    const batch = await moodleCall<MoodleUser[]>("core_enrol_get_enrolled_users", {
      courseid: COURSE_ID,
      "options[0][name]": "limitfrom",
      "options[0][value]": offset,
      "options[1][name]": "limitnumber",
      "options[1][value]": perPage,
    });
    all.push(...batch.filter((u) => u.roles.some((r) => r.shortname === "student")));
    if (batch.length < perPage) break;
    offset += perPage;
  }
  return all.map(({ id, fullname, email, lastaccess, lastcourseaccess, profileimageurl }) => ({
    id,
    fullname,
    email,
    lastaccess,
    lastcourseaccess,
    profileimageurl,
  }));
}

async function _fetchCourseModules(): Promise<CachedCourseModule[]> {
  const sections = await moodleCall<MoodleSection[]>("core_course_get_contents", {
    courseid: COURSE_ID,
  });
  return sections
    .filter((s) => s.visible === 1 && s.section > 0)
    .map((s) => ({
      moduleId: s.section,
      moduleName: s.name,
      activityIds: s.modules
        .filter((m) => m.modname === "subsection" && m.completion > 0)
        .map((m) => m.id),
    }))
    .filter((m) => m.activityIds.length > 0);
}

async function _fetchUserCompletion(userId: number): Promise<MoodleCompletionStatus> {
  try {
    return await moodleCall<MoodleCompletionStatus>(
      "core_completion_get_activities_completion_status",
      { courseid: COURSE_ID, userid: userId }
    );
  } catch {
    return { statuses: [] };
  }
}

async function _fetchRawCompletions(): Promise<Record<string, number[]>> {
  const students = await getCachedStudents();
  const completions = await batchProcess(
    students.map((s) => s.id),
    _fetchUserCompletion,
    50
  );
  const result: Record<string, number[]> = {};
  students.forEach((s, i) => {
    const done: number[] = [];
    (completions[i]?.statuses ?? []).forEach(({ cmid, state, tracking }) => {
      if (tracking > 0 && state >= 1) done.push(cmid);
    });
    result[String(s.id)] = done;
  });
  return result;
}

async function _fetchUserGradeItems(userId: number): Promise<CachedGradeItem[]> {
  try {
    const res = await moodleCall<MoodleUserGrades>("gradereport_user_get_grade_items", {
      courseid: COURSE_ID,
      userid: userId,
    });
    return (
      res.usergrades?.[0]?.gradeitems?.map(({ itemmodule, cmid, graderaw, grademax }) => ({
        itemmodule,
        cmid,
        graderaw,
        grademax,
      })) ?? []
    );
  } catch {
    return [];
  }
}

async function _fetchAllGradeItems(): Promise<Record<string, CachedGradeItem[]>> {
  const students = await getCachedStudents();
  const itemsByUser = await batchProcess(
    students.map((s) => s.id),
    _fetchUserGradeItems,
    100
  );
  const result: Record<string, CachedGradeItem[]> = {};
  students.forEach((s, i) => {
    result[String(s.id)] = itemsByUser[i] ?? [];
  });
  return result;
}

async function _fetchForumData(): Promise<CachedForumData> {
  try {
    const [forums, sections] = await Promise.all([
      moodleCall<MoodleForum[]>("mod_forum_get_forums_by_courses", {
        "courseids[0]": COURSE_ID,
      }),
      moodleCall<MoodleSection[]>("core_course_get_contents", { courseid: COURSE_ID }),
    ]);

    // Build cmid → section map
    const cmidToSection = new Map<number, number>();
    sections.forEach((s) => s.modules.forEach((m) => cmidToSection.set(m.id, s.section)));

    const bySection: Record<string, { posts: number; replies: number }> = {};
    const userDiscussionCount: Record<string, number> = {};
    const userLatestDiscussion: Record<string, number> = {};

    // Fetch discussions per forum (paginated, capped at 2 000 per forum)
    await Promise.all(
      forums.map(async (forum) => {
        const section = cmidToSection.get(forum.cmid);
        if (!section || section === 0) return;

        let page = 0;
        const perpage = 200;
        let forumPosts = 0;
        let forumReplies = 0;

        while (true) {
          let result: MoodleDiscussionResult = {};
          try {
            result = await moodleCall<MoodleDiscussionResult>(
              "mod_forum_get_forum_discussions",
              { forumid: forum.id, page, perpage }
            );
          } catch {
            break;
          }

          const discussions = result.discussions ?? [];
          forumPosts += discussions.length;
          discussions.forEach((d) => {
            forumReplies += d.numreplies ?? 0;
            const key = String(d.userid);
            userDiscussionCount[key] = (userDiscussionCount[key] ?? 0) + 1;
            if (!userLatestDiscussion[key] || d.timemodified > userLatestDiscussion[key]) {
              userLatestDiscussion[key] = d.timemodified;
            }
          });

          if (discussions.length < perpage) break;
          page++;
          if (page >= 10) break; // cap: 10 pages × 200 = 2 000 discussions per forum
        }

        const key = String(section);
        const prev = bySection[key] ?? { posts: 0, replies: 0 };
        bySection[key] = {
          posts: prev.posts + forumPosts,
          replies: prev.replies + forumReplies,
        };
      })
    );

    const totalPosts = Object.values(bySection).reduce((s, v) => s + v.posts, 0);
    const totalReplies = Object.values(bySection).reduce((s, v) => s + v.replies, 0);

    return { bySection, userDiscussionCount, userLatestDiscussion, totalPosts, totalReplies };
  } catch {
    return {
      bySection: {},
      userDiscussionCount: {},
      userLatestDiscussion: {},
      totalPosts: 0,
      totalReplies: 0,
    };
  }
}

async function _fetchAssignmentData(): Promise<CachedAssignmentData> {
  try {
    const { courses } = await moodleCall<MoodleAssignmentList>(
      "mod_assign_get_assignments",
      { "courseids[0]": COURSE_ID }
    );
    const assignments = courses[0]?.assignments ?? [];
    if (assignments.length === 0) return { assignments: [], submissionsByAssignment: {} };

    const idParams: Record<string, string | number> = {};
    assignments.forEach((a, i) => { idParams[`assignmentids[${i}]`] = a.id; });

    const { assignments: subs } = await moodleCall<MoodleSubmissionsResponse>(
      "mod_assign_get_submissions",
      idParams
    );

    const submissionsByAssignment: Record<string, CachedSubmission[]> = {};
    subs.forEach((a) => {
      submissionsByAssignment[String(a.assignmentid)] = a.submissions.map((s) => ({
        userid: s.userid,
        status: s.status,
        timemodified: s.timemodified,
      }));
    });

    return {
      assignments: assignments.map(({ id, name, cmid }) => ({ id, name, cmid })),
      submissionsByAssignment,
    };
  } catch {
    return { assignments: [], submissionsByAssignment: {} };
  }
}

// ─── Exported cached getters ──────────────────────────────────────────────────

export const getCachedStudents = unstable_cache(
  _fetchAllStudents,
  [`students-${COURSE_ID}`],
  { revalidate: 300 }
);

export const getCachedCourseModules = unstable_cache(
  _fetchCourseModules,
  [`course-modules-${COURSE_ID}`],
  { revalidate: 300 }
);

/** userId (string) → array of completed cmids */
export const getCachedRawCompletions = unstable_cache(
  _fetchRawCompletions,
  [`completions-${COURSE_ID}`],
  { revalidate: 300 }
);

/** userId (string) → grade items array */
export const getCachedGradeItems = unstable_cache(
  _fetchAllGradeItems,
  [`grade-items-${COURSE_ID}`],
  { revalidate: 300 }
);

/** Forum posts/replies per module section + per-user discussion count */
export const getCachedForumData = unstable_cache(
  _fetchForumData,
  [`forum-data-${COURSE_ID}`],
  { revalidate: 300 }
);

/** All assignments + submissions for the course */
export const getCachedAssignmentData = unstable_cache(
  _fetchAssignmentData,
  [`assignment-data-${COURSE_ID}`],
  { revalidate: 300 }
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
 */
export async function buildAllFellowSummaries(): Promise<FellowSummary[]> {
  const [students, courseModules, rawCompletions, gradeItemsByUser, forumData, assignData] =
    await Promise.all([
      getCachedStudents(),
      getCachedCourseModules(),
      getCachedRawCompletions(),
      getCachedGradeItems(),
      getCachedForumData(),
      getCachedAssignmentData(),
    ]);

  const completedByUser = makeCompletedByUser(rawCompletions);
  const totalActivities = courseModules.reduce((s, m) => s + m.activityIds.length, 0);

  return students.map((s) => {
    const done = completedByUser.get(s.id) ?? new Set<number>();

    const doneCount = courseModules.reduce(
      (sum, m) => sum + m.activityIds.filter((id) => done.has(id)).length,
      0
    );
    const completionPct =
      totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

    const quizItems = (gradeItemsByUser[String(s.id)] ?? []).filter(
      (g) => g.itemmodule === "quiz" && g.graderaw !== null && g.grademax > 0
    );
    const avgQuizScore =
      quizItems.length > 0
        ? Math.round(
            quizItems.reduce((sum, g) => sum + (g.graderaw! / g.grademax) * 100, 0) /
              quizItems.length
          )
        : 0;

    const assignmentsSubmitted = assignData.assignments.reduce((count, a) => {
      const sub = (assignData.submissionsByAssignment[String(a.id)] ?? []).find(
        (sub) => sub.userid === s.id && sub.status === "submitted"
      );
      return count + (sub ? 1 : 0);
    }, 0);

    const forumPosts = forumData.userDiscussionCount[String(s.id)] ?? 0;

    const engagementScore = Math.min(
      100,
      Math.round(forumPosts * 3 + avgQuizScore * 0.3 + completionPct * 0.2)
    );

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
      avgQuizScore,
      assignmentsSubmitted,
      assignmentsTotal: assignData.assignments.length,
      forumPosts,
      engagementScore,
      riskLevel,
      daysSinceActive,
    };
  });
}
