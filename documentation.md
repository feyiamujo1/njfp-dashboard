# NJFP Dashboard — Project Documentation

## Overview

A Next.js 16 analytics dashboard for the NJFP Entrepreneurship Training programme. It surfaces data from the Moodle LMS across course progress, learner engagement, assessments, and risk monitoring.

Data is served from **Supabase** (PostgreSQL), kept fresh by a background sync job that runs every 2 hours. The dashboard never calls Moodle directly — all Moodle data flows through the sync pipeline.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Ant Design v6 |
| Charts | Recharts v3 |
| Data fetching | TanStack Query v5 |
| CSS | Tailwind CSS v4 |
| Runtime types | TypeScript |
| Persistence | Supabase (PostgreSQL) |
| Sync scheduling | Supabase Edge Functions + pg_cron |
| Hosting | Netlify |

---

## Environment Variables (`.env.local`)

```
NEXT_MOODLE_BASE_URL=https://your-moodle-domain.com
NEXT_MOODLE_TOKEN=<webservice-token>
NEXT_COURSE_ID=<course-id>

NEXT_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

SYNC_SECRET=<random-hex-string>
```

Never commit `.env.local`. Never expose these values in code, logs, or documentation.

---

## Architecture

```
Moodle LMS
    │  core_enrol_get_enrolled_users
    │  core_course_get_contents
    │  core_completion_get_activities_completion_status
    │  mod_quiz_get_quizzes_by_courses
    ▼
Supabase Edge Function (sync, every 2 hours via pg_cron)
    │  upserts all data
    ▼
Supabase PostgreSQL (7 tables)
    │  fast reads (~200ms)
    ▼
Next.js API Routes (/app/api/)
    │
    ▼
TanStack Query hooks → React UI
```

### Data layer: `lib/server/sharedData.ts`

All API routes read from Supabase through functions in `sharedData.ts`. These replaced the former `unstable_cache` + Moodle-call pattern. Function names and return types are unchanged so route files required no modification.

| Function | Source table | Notes |
|---|---|---|
| `getCachedStudents()` | `students` | Includes demographics (state, lga, region, gender) |
| `getCachedCourseModules()` | `course_modules` | Module → tracked activityIds mapping |
| `getCachedRawCompletions()` | `completions` | userId → completed cmids |
| `getCachedQuizDetails()` | `quiz_details` | quizId → gradeMax |
| `getCachedQuizInstances()` | `quiz_instances` | quizId → moduleSection |
| `buildAllFellowSummaries()` | All of above | Full FellowSummary[] for list/analytics views |

`MAX_ROWS = 50_000` is a constant used on every `.limit()` call. It must be ≤ the **Max Rows** setting in **Supabase Dashboard → Settings → API** (set that to 50000).

---

## Supabase Database Schema

### Tables

**`students`**
```
id             integer PRIMARY KEY
fullname       text
email          text
lastaccess     integer       (unix timestamp — general Moodle login)
lastcourseaccess integer     (unix timestamp — last access to this course)
profileimageurl text
gender         text
state          text
lga            text
region         text
```

**`completions`**
```
user_id          integer PRIMARY KEY
completed_cmids  integer[]     (JSONB array of completed course module IDs)
```
Only rows for students who have started the course exist here. A missing row = 0% completion.

**`course_modules`**
```
module_id    integer PRIMARY KEY
module_name  text
activity_ids integer[]    (tracked cmids — completion > 0 only)
```

**`quiz_details`**
```
quiz_id    integer PRIMARY KEY
grade_max  numeric
```

**`quiz_instances`**
```
quiz_id        integer PRIMARY KEY
module_section integer
module_name    text
```

**`course_structure`**
```
id       integer PRIMARY KEY    (always 1 — single row)
sections jsonb                  (raw core_course_get_contents response)
synced_at timestamptz
```

**`sync_log`**
```
id             serial PRIMARY KEY
started_at     timestamptz
finished_at    timestamptz
status         text ('success' | 'error')
students_count integer
completions_count integer
error_message  text
```

### RLS

All tables have RLS enabled with no permissive policies. Only the service role key can read/write. Never use the anon key for dashboard operations.

---

## Sync Service

### Entry points

- **`integration/supabase/sync.ts`** — Next.js compatible. Called by `POST /api/sync`. Use for manual triggers and local testing.
- **`integration/supabase/functions/sync/index.ts`** — Deno Edge Function. Deployed to Supabase. Identical logic but self-contained (no project imports, uses `https://esm.sh/` for dependencies).

### Sync steps (in order)

1. **Students** — `core_enrol_get_enrolled_users` paginated (1,000/page). Filter to `roles[].shortname === "student"`. Upsert into `students`.
2. **Course modules** — `core_course_get_contents` (fetched ONCE, shared across steps 2–4). Parse flat section list into 7 modules with tracked `activityIds`.
3. **Quiz instances** — derived from course contents (quiz cmids → parent module section).
4. **Course structure** — raw JSON stored in `course_structure` (single row, id=1).
5. **Quiz details** — `mod_quiz_get_quizzes_by_courses`. Upsert `quiz_details`.
6. **Completions** — `core_completion_get_activities_completion_status` per user. Batched 50 at a time. Only students with `lastcourseaccess > 0` are queried (active students). Uses `_attempt=3` to disable Moodle retries per-call.
7. **sync_log** — write status row.

Each step uses `upsertBatch()` with `BATCH = 500` and `onConflict` for idempotency.

### Manual sync trigger

```bash
# Local
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <SYNC_SECRET>"

# Production Edge Function
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync \
  -H "x-sync-secret: <SYNC_SECRET>"
```

`/api/sync` accepts both `GET` and `POST`. The Edge Function requires only `x-sync-secret` (JWT verification disabled on the function).

---

## Cron Schedule

pg_cron + pg_net inside Supabase fires the Edge Function every 2 hours:

```sql
SELECT cron.schedule(
  'njfp-moodle-sync',
  '0 */2 * * *',
  $$
    SELECT net.http_post(
      url      := 'https://<project-ref>.supabase.co/functions/v1/sync',
      headers  := '{"Content-Type":"application/json","x-sync-secret":"<SYNC_SECRET>"}'::jsonb,
      body     := '{}'::jsonb
    ) AS request_id;
  $$
);
```

Required extensions: `pg_cron` (schema: `pg_catalog`) and `pg_net` (schema: `extensions`). Enable both in **Supabase Dashboard → Database → Extensions** before running the SQL above.

To inspect runs:
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Course Structure

The LMS course has 7 modules in sections 1–7 of `core_course_get_contents`.

| Module | Name |
|---|---|
| 1 | Entrepreneurial Mindset and Intention |
| 2 | Opportunity Identification & Innovation |
| 3 | Customers and Markets |
| 4 | Resources and Legality |
| 5 | Execution |
| 6 | Communication and Growth |
| 7 | Leadership and People Engagement |

### Flat API → Hierarchy

`core_course_get_contents` returns a flat array. Two section types exist:

| `component` value | Type |
|---|---|
| `null` | Top-level section (Module 1–7, Course Introduction, etc.) |
| `"mod_subsection"` | Lesson section — actual content for one lesson |

**Parent → child linking:** Top-level module sections contain `modname: "subsection"` modules (navigation pointers only, `completion: 0`). They link to lesson sections via:
- `subsection_module.instance` ↔ `lesson_section.itemid`

**Tracked activities** inside each lesson section:

| Activity | `modname` | `completion` |
|---|---|---|
| Overview | `label` | `1` (manual) |
| Video | `label` | `1` (manual) |
| Slides | `resource` | `2` (auto on view) |
| Further Resources | `folder` | `2` (auto on view) |
| Quiz | `quiz` | `2` (auto on submit) |

Only activities with `completion > 0` are included in `activityIds` for completion tracking.

---

## API Routes

### `/api/sync`
- **Auth:** `Authorization: Bearer <SYNC_SECRET>` header
- **Methods:** GET, POST
- **maxDuration:** 900s
- Runs the full sync via `integration/supabase/sync.ts`

### `/api/fellows`
Returns `{ fellows: FellowSummary[] }` — all students with computed completion, risk, and engagement.

### `/api/fellows/[id]`
Returns full profile for one student. Reads directly from Supabase (`students` + `completions` tables). Fast path — no Moodle calls.

### `/api/fellows/[id]/quiz`
Calls Moodle live (`mod_quiz_get_user_best_grade` per quiz). Cached for 1 hour per user via `unstable_cache`. Returns quiz stats and computed engagement score.

**Query param:** `?completionPct=<number>` — passed from the fast-path route so engagement score can incorporate completion without re-fetching.

### `/api/course/contents`
Reads from `course_structure` Supabase table (stored JSONB). Re-applies the parsing algorithm to produce the nested section tree. Returns 503 if not yet synced.

### `/api/dashboard/overview`
### `/api/dashboard/engagement`
### `/api/dashboard/progress` (via `/api/dashboard/engagement/completion`)
### `/api/dashboard/performance`
### `/api/dashboard/risk`
All read from Supabase via `buildAllFellowSummaries()` in `sharedData.ts`.

---

## Learner Metrics

### Completion %

```
completionPct = round((completedActivities / totalTrackedActivities) × 100)
```

`completedActivities` = intersection of the learner's `completed_cmids` with all `activityIds` across all course modules.

### Risk Level

| Level | Condition |
|---|---|
| `active` | `completionPct >= 80` (substantially done), OR last access ≤ 7 days AND completion ≥ 25% |
| `at_risk` | last access 7–14 days ago OR completion < 25% (and completion < 80%) |
| `inactive` | no `lastcourseaccess`, or last access > 14 days ago (and completion < 80%) |

Learners who have completed ≥ 80% of the course are always `active` — they've finished, not dropped out.

### Engagement Score

**In list views** (overview, risk table, leaderboard — no per-user quiz data):
```
engagementScore = completionPct
```

**On individual learner profile** (after quiz data loads):
```
engagementScore = round(completionPct × 0.5 + avgQuizScore × 0.5)
```

### Active User Metrics (DAU/WAU/MAU)

Computed from `lastcourseaccess` Unix timestamps stored in the `students` table:
- **DAU** — last course access < 24 hours ago
- **WAU** — last course access < 7 days ago
- **MAU** — last course access < 30 days ago

---

## Moodle API Client

`lib/moodle.ts` — wraps all Moodle REST calls.

- **`cache: "no-store"`** — prevents Next.js from trying to cache large Moodle responses (which caused "Failed to set fetch cache" errors with 5MB+ responses)
- **Retry logic** — retries HTTP 5xx (non-JSON responses) up to 3 times with 3s/6s/9s backoff
- **`_attempt = 3` trick** — passing `3` as the third argument starts at max retry count, effectively disabling retries for per-user completion calls in the sync service

---

## Search Implementation

Search across learner names, emails, and states uses **word-splitting** to support multi-word queries (e.g. "Ambu Barnabas"):

```typescript
const words = search.trim().toLowerCase().split(/\s+/);
const haystack = [f.fullname, f.email, f.state ?? ""].join(" ").toLowerCase();
const matches = !words[0] || words.every(w => haystack.includes(w));
```

Applied in: `app/dashboard/learners/page.tsx` and `components/tables/RiskTable.tsx`.

---

## TypeScript Configuration

`integration/supabase/functions/` is excluded from `tsconfig.json` because it contains Deno code (`Deno.env.get()`, `https://` imports) that TypeScript's Node.js config doesn't understand:

```json
"exclude": ["node_modules", "integration/supabase/functions"]
```

---

## Design System

### Color Rules

| Color | Hex | Usage |
|---|---|---|
| Default dark | `#111827` | All KPI values unless semantic meaning applies |
| Blue | `#1D4ED8` | One highlight KPI per page (primary metric) |
| Green | `#16A34A` | Success / passing / active |
| Red | `#DC2626` | Risk / Fail Rate KPIs only |
| Amber | `#D97706` | At-risk / Inactive >7 days |

### Ant Design v6

- `valueStyle` on `<Statistic>` → `styles={{ value: {...} }}`
- `trailColor` on `<Progress>` → `styles={{ rail: { background: "..." } }}`
- Card body flex → `styles={{ body: { flex: 1 } }}`

---

## Key Files

| File | Purpose |
|---|---|
| `lib/server/sharedData.ts` | Supabase data layer — all shared queries |
| `integration/supabase/server.ts` | Service role Supabase client |
| `integration/supabase/sync.ts` | Sync service (Next.js compatible) |
| `integration/supabase/functions/sync/index.ts` | Deno Edge Function (deployed to Supabase) |
| `integration/supabase/migrations/001_initial_schema.sql` | Database schema with RLS |
| `lib/moodle.ts` | Moodle REST API client |
| `lib/constants.ts` | `COURSE_ID`, `TABLE_PAGE_SIZE`, `CHART_COLORS` |
| `lib/types.ts` | Shared TypeScript interfaces |
| `app/api/sync/route.ts` | Manual sync trigger |

---

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Overview: headcount KPIs, weekly active trend, risk donut, module completion |
| `/dashboard/engagement` | Activity trends, heatmap, top learners, demographic breakdowns, risk table |
| `/dashboard/modules` | Module completion rates, drop-off chart, completion funnels |
| `/dashboard/learners` | Full learner directory with search (multi-word), filters, state distribution |
| `/dashboard/learners/[id]` | Individual learner: module progress bars + quiz performance chart |
| `/dashboard/course-structure` | Course content map — modules, lessons, tracked vs untracked activities |

---

## Known Limitations

| Issue | Status |
|---|---|
| Mentorship data (webinar, pod sessions) | Not available — NATVIEW integration pending |
| Per-user quiz scores (individual profile) | Still calls Moodle live — no bulk API exists |
| Completions for inactive students | Skipped in sync — only students with `lastcourseaccess > 0` are queried |
