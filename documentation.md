# NJFP Dashboard — Project Documentation

## Overview

A Next.js 15 analytics dashboard for the NJFP Entrepreneurship Training programme. It surfaces live Moodle LMS data across course progress, learner engagement, assessments, mentorship, and risk monitoring.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | Ant Design v6 |
| Charts | Recharts v3 |
| Data fetching | TanStack Query v5 |
| CSS | Tailwind CSS v4 |
| Runtime types | TypeScript |

---

## Environment Variables (`.env.local`)

```
NEXT_MOODLE_BASE_URL=https://lms.njfp.ng
NEXT_MOODLE_TOKEN=<token>
NEXT_COURSE_ID=6
```

---

## Course Structure

The LMS course (ID 6) has 7 modules in sections 1–7 of `core_course_get_contents`. Section 0 is the Course Introduction and is skipped in all computations.

| Module | Name |
|---|---|
| 1 | Entrepreneurial Mindset and Intention |
| 2 | Opportunity Identification & Innovation |
| 3 | Customers and Markets |
| 4 | Resources and Legality |
| 5 | Execution |
| 6 | Communication and Growth |
| 7 | Leadership and People Engagement |

Each module section contains `subsection` modname activities. A learner is considered to have **completed a module** when they have finished every `subsection` activity in that section.

---

## Total Enrolled Learners

Total enrolled is fetched dynamically via `core_enrol_get_enrolled_users` with pagination (1 000 per page), filtering to `roles[].shortname === "student"`. This is the authoritative count — it is **not** hardcoded.

---

## Moodle REST API Calls Reference

| Endpoint | Used For | Params |
|---|---|---|
| `core_enrol_get_enrolled_users` | Fetch all enrolled users (paginated) | `courseid`, `options[limitfrom]`, `options[limitnumber]` |
| `core_course_get_contents` | Fetch course structure (sections → activities) | `courseid` |
| `core_completion_get_activities_completion_status` | Per-user activity completion states | `courseid`, `userid` |
| `mod_assign_get_assignments` | List all assignments in the course | `courseids[0]` |
| `mod_assign_get_submissions` | Bulk: all users' submissions per assignment | `assignmentids[i]` |
| `gradereport_overview_get_course_grades` | Per-user overall grade in the course | `userid` |

---

## API Route Architecture

All data routes live under `/app/api/`. Next.js route handlers call Moodle server-side. Client pages call these routes — never Moodle directly.

### Caching

`moodleCall()` in `lib/moodle.ts` uses `next: { revalidate: 300 }` on each fetch. This caches every unique Moodle URL response in Next.js's data cache for **5 minutes**. Cold start (first request after cache expires) may take 15–25 s for large batches. Subsequent requests within 5 min are instant.

`export const maxDuration = 60` is set on aggregate routes that batch 5 000+ user calls.

### Concurrency Batching (`batchProcess`)

```typescript
async function batchProcess<In, Out>(
  items: In[],
  fn: (item: In) => Promise<Out>,
  concurrency = 50
): Promise<Out[]>
```

Runs `fn` over all items in chunks of `concurrency`, using `Promise.all` per chunk. Order is preserved. Used for per-user completion and grade calls.

---

## Route Implementations

### `/api/dashboard/overview` — Phase 2 complete

Returns `OverviewData`:

```typescript
{
  stats: {
    totalFellows: number;      // all enrolled students
    activeFellows: number;     // last course access < 7 days ago
    completionRate: number;    // % who finished ≥50% of modules
    avgQuizScore: number;      // average grade % (gradereport_overview)
    assignmentCompletionRate: number; // submitted / (total × assignments)
    atRiskCount: number;
  };
  weeklyActive: { week: string; active: number }[]; // 8 ISO weeks
  moduleCompletion: ModuleProgress[];
  riskDistribution: { active: number; atRisk: number; inactive: number };
}
```

**Risk classification:**
- `inactive`: no `lastcourseaccess`, OR `daysSince > 14`
- `at_risk`: `daysSince > 7` OR `completionPct < 25`
- `active`: otherwise

**Course completion threshold:** ≥ 50% of modules finished (`Math.ceil(moduleCount / 2)`).

---

### `/api/dashboard/mentorship` — Phase 2 partial (forums live; NATVIEW pending)

Returns `MentorshipStats`:

```typescript
{
  forumPosts: number;          // live — total posts + replies across all course forums
  forumByModule: { moduleId; moduleName; posts; replies }[];  // live — from mod_forum_get_forum_discussions
  leaderboard: FellowSummary[]; // live — top 20 active learners by engagementScore
  webinarAttendance: null;     // NATVIEW — not yet available
  mentorSessions: null;        // NATVIEW — not yet available
  podParticipation: null;      // NATVIEW — not yet available
}
```

Forum data source: `mod_forum_get_forums_by_courses` → per-forum `mod_forum_get_forum_discussions` (paginated, capped at 2 000 discussions per forum). `userDiscussionCount` map tracks discussions started per user — used for `forumPosts` on FellowSummary in the leaderboard. The page shows an informational Alert distinguishing live data from pending NATVIEW fields.

---

### `/api/dashboard/risk` — Phase 2 complete

Returns `RiskStats`:

```typescript
{
  inactiveOver7Days: number;        // daysSinceActive > 7
  inactiveOver14Days: number;       // daysSinceActive > 14
  lowQuizScore: number;             // users with avgQuizScore > 0 AND < 50%
  noMentorshipEngagement: number;   // users with 0 forum discussions started
  distribution: { active; atRisk; inactive };
  fellows: FellowSummary[];         // all enrolled learners (full table)
}
```

Shares all data with mentorship route via `sharedData` cache. The full `fellows` array powers the filterable/searchable RiskTable.

---

## Shared Server Data Cache (`lib/server/sharedData.ts`)

`unstable_cache` (Next.js, 5-minute TTL) wraps the five most expensive shared operations. Multiple route handlers that open within the same 5-minute window share the same processed result — no recomputation.

| Cached getter | Data | Cost (cold) |
|---|---|---|
| `getCachedStudents()` | All enrolled students | ~5 paginated Moodle calls |
| `getCachedCourseModules()` | Course sections → activityIds | 1 Moodle call |
| `getCachedRawCompletions()` | `userId → completedCmids[]` | ~5 000 batched calls @ 50 concurrent |
| `getCachedGradeItems()` | `userId → GradeItem[]` | ~5 000 batched calls @ 100 concurrent |
| `getCachedForumData()` | Posts/replies per module + per-user discussion count | N forums × paginated discussion calls |

**Hydration helper:** `makeCompletedByUser(raw)` reconstructs `Map<number, Set<number>>` from the serialised `Record<string, number[]>` stored in the cache (Maps/Sets are not JSON-serialisable).

Routes using sharedData: **mentorship**, **risk**. Existing routes (overview, progress, engagement, performance) use `next: { revalidate: 300 }` on individual moodleCall fetches — functionally equivalent caching at the HTTP level; they can be migrated to sharedData in a future pass.

---

### `/api/dashboard/engagement` — Phase 2 complete

Returns `EngagementStats`:

```typescript
{
  dau: number;          // last course access < 24 hours
  wau: number;          // last course access < 7 days
  mau: number;          // last course access < 30 days
  contentViews: number; // total completed activity instances across all users
  weeklyActivity: { week: string; logins: number; interactions: number }[]; // 12 ISO weeks
  heatmap: { day: number; hour: number; count: number }[];  // 7×24 grid (day 0=Mon)
  moduleViews: { moduleId: number; moduleName: string; views: number }[];
}
```

**Data sources (no log API required):**
- `dau`/`wau`/`mau`: computed from `lastcourseaccess` Unix timestamps on enrolled users
- `weeklyActivity.logins`: users whose general Moodle `lastaccess` falls in that ISO week
- `weeklyActivity.interactions`: users whose `lastcourseaccess` falls in that ISO week (course-specific; always ≤ logins)
- `heatmap`: extracts hour-of-day and day-of-week from each user's `lastcourseaccess` timestamp
- `contentViews`: sum of all completed activity instances across all users (from completion statuses)
- `moduleViews`: count of users with ≥1 completed activity in each module section

---

### `/api/dashboard/performance` — Phase 2 complete

Returns `PerformanceStats`:

```typescript
{
  avgQuizScore: number;      // mean quiz % across all users with a quiz grade
  submissionRate: number;    // submitted / (total × assignments)
  passRate: number;          // % of users with avg quiz score ≥ 50%
  failRate: number;          // 100 - passRate
  quizByModule: QuizStat[];
  assignmentByModule: { moduleId; moduleName; submitted; notSubmitted }[];
  topLearners: FellowSummary[]; // top 20 active learners by engagementScore
}
```

**Key Moodle call:** `gradereport_user_get_grade_items` (Moodle 3.2+) — fetches all grade items (quizzes, assignments) per user in one call. Batched at 100 concurrent. Each item includes `cmid`, `itemmodule`, `graderaw`, `grademax`.

- Quiz cmid → module section via `core_course_get_contents` cmid map
- `assignmentByModule`: uses `mod_assign_get_submissions` (bulk per-assignment) mapped to sections via assignment cmid
- `topLearners`: scored students filtered to `riskLevel === "active"`, sorted by `engagementScore` desc. `forumPosts` is 0 until mentorship phase wires in forum data.
- `engagementScore` = `min(100, forumPosts×3 + avgQuizScore×0.3 + completionPct×0.2)`

---

### `/api/dashboard/progress` — Phase 2 complete

Returns `ProgressStats`:

```typescript
{
  startedPct: number;        // % with ≥1 completed activity
  completedPct: number;      // % who finished ≥50% modules
  avgCompletionRate: number; // avg per-learner completion % across all activities
  totalEnrolled: number;     // raw headcount
  moduleProgress: ModuleProgress[];
  funnel: { stage: string; count: number; pct: number }[];
  dropOff: { moduleId: number; moduleName: string; activePct: number }[];
}
```

**Funnel stages:**
1. Enrolled — total students
2. Started — at least 1 completed tracked activity
3. Midway (Module 4+) — completed Module 4 (the halfway module)
4. Completed — finished ≥50% of modules

**Drop-off chart:** each module's `activePct` equals that module's `completionPct`, showing where learners leave the course.

---

### `/api/fellows` — Phase 2 complete

Returns `{ fellows: FellowSummary[] }`. Paginates `core_enrol_get_enrolled_users`, filters to students only.

### `/api/course/contents` — Phase 2 complete

Returns `{ sections: [...] }` with subsections, forums, labels per section.

---

## Phase 2 Integration Status

| Page | Route | Status |
|---|---|---|
| Overview `/dashboard` | `/api/dashboard/overview` | ✅ Live |
| Course Progress `/dashboard/modules` | `/api/dashboard/progress` | ✅ Live |
| Engagement `/dashboard/engagement` | `/api/dashboard/engagement` | ✅ Live |
| Assessments `/dashboard/assessments` | `/api/dashboard/performance` | ✅ Live |
| Learners `/dashboard/learners` | `/api/fellows` | ✅ Live |
| Learner Detail `/dashboard/learners/[id]` | `/api/fellows/[id]` | ✅ Live |
| Course Structure `/dashboard/course-structure` | `/api/course/contents` | ✅ Live |
| Mentorship `/dashboard/mentorship` | `/api/dashboard/mentorship` | ✅ Live (forums); NATVIEW pending |
| Risk `/dashboard/risk` | `/api/dashboard/risk` | ✅ Live |
| Learner Detail `/dashboard/learners/[id]` | `/api/fellows/[id]` (pending) | ⬜ Mock |

---

## Design System

### Color Rules (enforced across all pages)

| Color | Hex | Usage |
|---|---|---|
| Default dark | `#111827` | All KPI values unless semantic meaning applies |
| Blue | `#1D4ED8` | **One** highlight KPI per page (primary metric) |
| Red | `#DC2626` | Risk / Fail Rate KPIs only |
| Amber | `#D97706` | Inactive >7 days on Risk page only |

### Ant Design v6 Deprecation Fixes

- `valueStyle` on `<Statistic>` → `styles={{ value: {...} }}`
- `trailColor` on `<Progress>` → `styles={{ rail: { background: "..." } }}`
- Card body flex → `styles={{ body: { flex: 1 } }}` + `style={{ flex: 1, display: "flex", flexDirection: "column" }}` on Card

---

## Component Structure

```
components/
  cards/
    KPICard.tsx          — stat card with optional color + suffix
  charts/
    FunnelChart.tsx      — enrollment funnel
  fellow/
    FellowHeader.tsx     — learner profile header (avatar fallback: #f1f5f9)
  layout/
    DashboardLayout.tsx  — sidebar + header shell
    Sidebar.tsx          — nav (8 items; "Learners" not "Fellows")
    DashboardHeader.tsx  — top bar with collapse toggle
```

### Layout Fix (important)

Content must not push the sidebar. The fix:
```tsx
<Layout className="overflow-hidden">
  <DashboardHeader />
  <Content className="p-6 bg-[#F8FAFC] overflow-y-auto h-[calc(100vh-64px)]">
```

---

## Key Files

| File | Purpose |
|---|---|
| `lib/moodle.ts` | Moodle REST wrapper — all server-side Moodle calls go through here |
| `lib/constants.ts` | `COURSE_ID`, `STALE_TIME`, `CHART_COLORS`, `MODULES` |
| `lib/types.ts` | Shared TypeScript interfaces |
| `lib/services/dashboardService.ts` | Client-side service layer — hooks call these methods |
| `hooks/useOverview.ts` | TanStack Query hook for overview data |
| `hooks/useProgress.ts` | TanStack Query hook for course progress data |

---

## Pending Decisions

- **Course Structure + Course Progress merge**: Agreed to combine into a single "Course" tab at `/dashboard/course` with inner tabs (Structure | Progress). Engagement stays separate. Not yet implemented.
- **Multi-course support**: Currently single-course (`COURSE_ID` env var). Multi-course needs a course selector UI + API parameterisation.
- **Engagement API**: `report_log_get_log_records` may require elevated Moodle permissions. Verify before attempting Phase 2 for engagement page.
- **Mentorship**: Webinar and pod session data lives outside Moodle (NATVIEW integration TBD). Forum data is available via `mod_forum_get_forums_by_courses`.
