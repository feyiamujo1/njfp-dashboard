# NJFP Entrepreneurship Training Dashboard

A professional analytics dashboard for the **NJFP Entrepreneurship Skills Training** programme. Built for programme administrators to monitor enrolled fellows across course progress, engagement, risk levels, and completion.

---

## Architecture Overview

```
Moodle LMS (lms.njfp.ng)
        │
        │  every 2 hours (Supabase Edge Function + pg_cron)
        ▼
Supabase PostgreSQL  ◄──────────────────────────────┐
  ├── students                                        │
  ├── completions                                     │  sync job writes here
  ├── course_modules                                  │
  ├── quiz_details                                    │
  ├── quiz_instances                                  │
  ├── course_structure                                │
  └── sync_log                                        │
        │                                             │
        │  reads (fast, <500ms)          /api/sync ──┘
        ▼
Next.js API Routes  →  React Dashboard (TanStack Query)
```

All dashboard data reads from Supabase. Moodle is only contacted during the background sync (every 2 hours) and by the individual learner quiz score endpoint (which requires per-user live Moodle calls).

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | Ant Design v6 |
| Charts | Recharts v3 |
| Data fetching | TanStack Query v5 |
| Persistence | Supabase (PostgreSQL) |
| Styling | Tailwind CSS v4 |
| Date handling | Moment.js |
| Hosting | Netlify |
| Sync scheduling | Supabase Edge Functions + pg_cron |

---

## Data Flow

### Sync (background, every 2 hours)

A Supabase Edge Function (`functions/sync`) runs on a pg_cron schedule and:

1. Fetches all enrolled students from Moodle (`core_enrol_get_enrolled_users`)
2. Fetches course structure (`core_course_get_contents`) — shared across modules, quiz instances, and course structure
3. Fetches per-user activity completions (`core_completion_get_activities_completion_status`) — one call per active student, batched 50 at a time
4. Fetches quiz metadata (`mod_quiz_get_quizzes_by_courses`)
5. Upserts all data into Supabase tables
6. Writes a row to `sync_log` with status and duration

Each step is idempotent — re-running the sync is safe.

### Dashboard reads (per request)

All Next.js API routes read from Supabase via `lib/server/sharedData.ts`. Response times are typically 200–800ms.

Exception: `GET /api/fellows/[id]/quiz` still calls Moodle live for per-user quiz scores (no bulk API exists for per-user quiz grades).

---

## Project Structure

```
app/
  api/
    dashboard/        # analytics API routes (overview, engagement, progress, risk)
    fellows/          # individual learner routes
    sync/             # manual sync trigger endpoint
    course/           # course structure endpoint
  dashboard/          # page components (UI only, no data fetching)

components/
  cards/              # KPICard and reusable card components
  charts/             # Recharts wrappers (ModuleBarChart, RiskDonutChart, etc.)
  tables/             # FellowsTable, LeaderboardTable, RiskTable

hooks/                # TanStack Query data hooks (useOverview, useEngagement, etc.)

lib/
  server/
    sharedData.ts     # Supabase-backed data layer (getCachedStudents, etc.)
  export.ts           # CSV download utilities
  moodle.ts           # Moodle REST API client
  types.ts            # Shared TypeScript types
  constants.ts        # TABLE_PAGE_SIZE, CHART_COLORS, COURSE_ID

integration/
  supabase/
    server.ts         # Supabase service-role client
    sync.ts           # Sync service (called by /api/sync for manual triggers)
    migrations/       # SQL schema files
    functions/
      sync/
        index.ts      # Supabase Edge Function (Deno) — deployed to Supabase
```

---

## Database Schema

Seven tables in Supabase (see `integration/supabase/migrations/001_initial_schema.sql`):

| Table | Contents |
|---|---|
| `students` | All enrolled fellows with demographics |
| `completions` | Per-user completed activity IDs (active students only) |
| `course_modules` | Module IDs, names, tracked activity IDs |
| `quiz_details` | Quiz ID → max grade |
| `quiz_instances` | Quiz ID → parent module |
| `course_structure` | Full course JSONB for course-structure page |
| `sync_log` | Sync run history with status and duration |

All tables have RLS enabled. The service role key bypasses RLS — never expose it client-side.

**Important:** Supabase PostgREST caps queries at 1,000 rows by default. Go to **Settings → API → Max Rows** and set it to `50000`. The code uses a `MAX_ROWS = 50_000` constant in `sharedData.ts` to enforce this on every query.

---

## Running Locally

```bash
yarn install
yarn dev
```

Dashboard runs at `http://localhost:3000`. Supabase must already contain data (run the sync first, or have pg_cron running).

### Triggering a manual sync

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <SYNC_SECRET>"
```

Takes approximately 5 minutes (one Moodle completion call per active student).

---

## Sync Scheduling (Production)

The cron is configured inside Supabase using pg_cron. To view or manage:

```sql
-- List scheduled jobs
SELECT * FROM cron.job;

-- View recent run history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Unschedule
SELECT cron.unschedule('njfp-moodle-sync');
```

The Edge Function requires an `x-sync-secret` header matching `SYNC_SECRET`. JWT verification is disabled on this function — auth is handled by the secret header alone.

---

## Key Implementation Notes

### Why Supabase replaced unstable_cache

The original implementation used Next.js `unstable_cache` to cache Moodle API responses. Two critical problems:

1. **2MB per-item limit** — 7,000+ students with profile images exceeded the limit, causing silent cache failures and every request hitting Moodle directly
2. **Cold start latency** — a cache miss triggered the full Moodle completion fetch (~8 minutes for all active students), causing 504 timeouts

Supabase eliminates both: data is always in Postgres, reads are fast (~200ms), and Moodle is only called during the scheduled background sync.

### Risk classification

Computed from `lastcourseaccess` and `completionPct`:

| Level | Condition |
|---|---|
| `active` | Completion ≥ 80% (course substantially done), OR last access ≤ 7 days ago AND completion ≥ 25% |
| `at_risk` | Last access 7–14 days ago OR completion < 25% |
| `inactive` | No course access ever, or last access > 14 days ago AND completion < 80% |

Learners who have completed 80%+ of the course are always classified as `active` — they are done, not at risk.

### Engagement score

In list views (no per-user quiz data available): `engagementScore = completionPct`

On individual learner profiles, once quiz scores load: `engagementScore = round(completionPct × 0.5 + avgQuizScore × 0.5)`

### Profile images

Stored in the `students` Supabase table — avatars show real Moodle profile images.

### Course structure parsing

`core_course_get_contents` returns a flat array. Top-level sections (modules) contain `modname: "subsection"` navigation pointers. Actual lesson content lives in `component: "mod_subsection"` sections linked via `itemid ↔ instance`. Only activities with `completion > 0` are tracked.

---

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Overview: headcount KPIs, weekly active trend, risk donut, module completion, top learners |
| `/dashboard/engagement` | Activity trends, heatmap, top learners by engagement, demographic breakdowns, risk table |
| `/dashboard/modules` | Module completion rates, drop-off chart, demographic completion funnels |
| `/dashboard/learners` | Full learner directory with search, filters, geopolitical/state distribution |
| `/dashboard/learners/[id]` | Individual learner profile with module progress and quiz performance |
| `/dashboard/course-structure` | Course content map — modules, lessons, activities, tracked vs untracked |

---

## CSV Exports

Every data card has an export button. Downloads are generated client-side via `lib/export.ts` using `downloadCsv(filename, headers, rows)`. No server round-trip required.
