# NJFP Programme Analytics Dashboard
## Delivery & Technical Status Report

**Prepared by:** Development Team  
**Date:** June 2026  
**Project:** NJFP Entrepreneurship Skills Training — Analytics Dashboard  
**Platform:** lms.njfp.ng (Moodle LMS)

---

## 1. Executive Summary

This report covers the current state of the NJFP Programme Analytics Dashboard — a web-based internal tool built to surface live data from the NJFP Moodle LMS. The dashboard provides programme administrators with visibility into fellow enrolment, course progress, engagement patterns, risk levels, and individual learner profiles.

The dashboard is functional and actively pulling live data from the Moodle platform. This report documents what has been delivered, known technical constraints affecting load performance, issues encountered during development, and what remains outstanding.

---

## 2. What Has Been Delivered

### 2.1 Landing Page

A programme home page that loads immediately and displays:

- **Live headline stats** (Fellows Enrolled, Active This Week, Active This Month, At Risk, Never Started) pulled from the Moodle platform
- Navigation cards linking to all available dashboard views
- No login required — internal access only

---

### 2.2 Programme Overview (`/dashboard`)

A high-level summary page providing a quick read of programme health. Comprises two loading tiers:

**Fast-loading (appears within seconds):**
- Total Fellows Enrolled
- Active Fellows count
- At-Risk Fellows count
- Fellows Who Have Never Started
- Weekly Active Fellows trend chart (last 12 weeks)
- Risk Distribution donut chart (Active / At-Risk / Inactive)

**Slower-loading (loads after):**
- Overall Completion Rate
- Average Completion Rate per Fellow
- Module Completion Progress bars (per module, with enrolled vs completed counts)
- Top 20 Learners by Engagement (ranked by activity score)
- Total Fellows Completed (shown in the Top Learners card header)

---

### 2.3 Course Progress (`/dashboard/modules`)

A detailed view of how far fellows have progressed through the course content. Includes:

- **KPI Cards:** Total Enrolled, % Started, % Fully Completed, Average Completion Rate
- **Module Completion Progress** — per-module bars showing completed count vs total enrolled, with exact numbers and percentage
- **Enrolment Funnel** — visual funnel from Enrolled → Started → Midway → Completed
- **Module Drop-Off Chart** — shows the % of fellows who engaged with each module in sequence, revealing where learners disengage
- **Enrolment Funnel by Demographics** (three separate breakdowns):
  - By Gender — grouped bar chart + table showing Started / Midway / Completed rates
  - By Geopolitical Region — horizontal bar chart + table across Nigeria's 6 zones
  - By State of Origin — bar chart with adjustable slider (top N states) + paginated table

---

### 2.4 Engagement (`/dashboard/engagement`)

Tracks when and how actively fellows engage with the course platform:

- **KPI Cards:** Daily Active Users (DAU), Weekly Active Users (WAU), Monthly Active Users (MAU), Total Content Views
- **Activity Trend Chart** — switchable between Weekly (52 weeks) and Monthly (12 months) views, with optional custom date range filter. Shows Logins vs Interactions per period.
- **Login Heatmap** — 7 days × 24 hours grid showing when fellows are most active. Hover any cell for exact count. Filterable by month range, with a default of "all time."
- **Risk & Intervention Section:**
  - Inactive > 7 Days count
  - Inactive > 14 Days count
  - No Activities Done count
  - Risk Distribution donut (Active / At-Risk / Inactive)
  - Cohort Breakdown (colour-coded headcount tiles)
  - Full Risk Overview table — all fellows with risk level, completion %, last activity; filterable by risk tier and searchable by name
- **Learning Performance Section:**
  - Most Viewed Modules (by fellow reach)
  - Top 20 Learners by Engagement
- **Activity by Demographics** (three breakdowns):
  - By Gender — grouped bar chart + table
  - By Geopolitical Region — stacked horizontal bar + table
  - By State — stacked bar with slider + paginated table

> **Note on demographics:** The Course Progress page shows *where* fellows are in the course (completion funnel). The Engagement page shows *how active* each demographic group is right now (risk-based). These are complementary, not duplicated.

---

### 2.5 Fellow Profiles (`/dashboard/learners`)

A searchable, filterable directory of all enrolled fellows:

- Search by name
- Filter by State, Geopolitical Region, and Gender
- Shows risk level tag, last activity date, and completion % per fellow in the list
- **Individual Profile** (`/dashboard/learners/[id]`):
  - Module-by-module completion progress
  - Quiz scores per module (computed individually — see constraints section)
  - Engagement score
  - Last activity

---

### 2.6 Course Structure (`/dashboard/course-structure`)

A read-only map of the course content pulled directly from Moodle showing all sections, modules, and activity types. Useful for cross-referencing completion data with the actual curriculum.

---

## 3. Technical Architecture

### 3.1 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI Components | Ant Design v6 |
| Charts | Recharts v3 |
| Data Fetching (client) | TanStack Query v5 |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| Data Source | Moodle Web Services REST API |

---

### 3.2 How Data Flows

The dashboard does not have its own database. All data is fetched live from the NJFP Moodle LMS (`lms.njfp.ng`) via the Moodle Web Services API using a service token.

**Every page load involves:**
1. The Next.js server making API calls to Moodle
2. Moodle querying its own database and returning JSON
3. The server processing and returning data to the browser

**Caching:** To avoid hammering Moodle on every visit, API responses are cached on the server for a fixed window:
- **Student roster** (names, enrolment, last access, demographics): 5-minute cache
- **Completion data** (which activities each fellow has finished): 60-minute cache

This means data shown in the dashboard is at most 5–60 minutes old depending on the section.

---

### 3.3 Fast / Slow Loading Split

Several pages are split into two loading tiers to avoid making users wait for everything at once:

| Tier | Data | Typical load time |
|---|---|---|
| **Fast** | Student roster only (names, last access, enrolment status) | 2–8 seconds |
| **Slow** | Completion records (who finished what activity) | 15–120 seconds |

Fast KPIs appear first. Heavier charts and completion-based figures load in behind them. Loading skeletons are shown while data is being fetched.

---

## 4. Why Loading Takes Time

### 4.1 Moodle API is Not Built for Analytics

Moodle's Web Services API is designed for LMS integrations (mobile apps, external tools), not bulk analytics queries. This creates several constraints:

**Constraint 1 — One request per student per quiz**  
To retrieve quiz scores for a single fellow, Moodle requires one separate API call per quiz. With ~1,000+ fellows and multiple quizzes per module, retrieving all quiz scores for all fellows would require thousands of sequential API calls — which would take hours and is not feasible. As a result, quiz scores are only shown on individual fellow profile pages, not in bulk tables.

**Constraint 2 — Large completion payloads**  
Fetching completion records for all activities across all fellows returns a very large payload (often 200–500KB of JSON). This takes 30–90 seconds on Moodle's servers before data even arrives.

**Constraint 3 — No aggregation endpoints**  
Moodle does not offer endpoints like "give me completion rates by module." Every aggregate (completion %, risk tier, enrolment funnel) must be computed in our server code after fetching raw data.

**Constraint 4 — Server load sensitivity**  
When Moodle's server is under load, it occasionally returns HTTP 500/502 errors or drops TCP connections mid-response (see Issues section). This affects the slower completion endpoints most.

---

### 4.2 Network Latency

The dashboard server makes requests to `lms.njfp.ng` (IP: 52.31.197.241) over HTTPS. Round-trip latency and Moodle's own query time add to load duration. Under normal conditions this is tolerable. Under Moodle server load it becomes the bottleneck.

---

## 5. Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| Quiz scores not available in bulk | Bulk tables show no quiz data | Available per-fellow on individual profile pages |
| Moodle caches mean data is 5–60 min old | Dashboard does not reflect changes in real-time | Acceptable for programme monitoring; cache TTL can be reduced if needed |
| Moodle server load causes occasional 500 errors | Slow routes may fail under peak load | Retry logic with backoff now handles transient failures | Fellows who have not filled in their profile show as "Not Specified" | Data quality is dependent on fellow profile completion |
| No dedicated database | Dashboard cannot store historical trend data or annotations | All data is computed live from Moodle on request |

---

## 9. Summary

| Area | Status |
|---|---|
| Landing page with live stats | ✅ Complete |
| Programme Overview | ✅ Complete |
| Course Progress with demographic breakdowns | ✅ Complete |
| Engagement with activity trend + heatmap filters | ✅ Complete |
| Fellow Profiles (list + individual) | ✅ Complete |
| Course Structure map | ✅ Complete |
| Moodle retry & error handling | ✅ Complete |
| Learning Performance / Assessments | ⏳ Pending |
| Risk & Intervention (dedicated page) | ⏳ Pending |
| Mentorship | ⏳ Pending |
| Bulk quiz score analytics | ⏳ Requires infrastructure decision |

---

*This document is intended for internal review and client handoff. All data displayed in the dashboard is sourced live from `lms.njfp.ng` and reflects the state of the NJFP Moodle platform at the time of each page load.*
