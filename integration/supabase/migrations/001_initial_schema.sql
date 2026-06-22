-- ============================================================
-- NJFP Dashboard — Initial Supabase Schema
-- Run this in the Supabase SQL Editor (once).
-- ============================================================

-- 1. Students enrolled in the course
CREATE TABLE IF NOT EXISTS students (
  id                  INTEGER PRIMARY KEY,
  fullname            TEXT    NOT NULL,
  email               TEXT    NOT NULL,
  lastaccess          BIGINT  NOT NULL DEFAULT 0,  -- unix ts: global last login
  lastcourseaccess    BIGINT  NOT NULL DEFAULT 0,  -- unix ts: last time they touched the course
  profileimageurl     TEXT    NOT NULL DEFAULT '',
  gender              TEXT,
  state               TEXT,
  lga                 TEXT,
  region              TEXT,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_lastcourseaccess_idx ON students (lastcourseaccess);
CREATE INDEX IF NOT EXISTS students_region_idx            ON students (region);
CREATE INDEX IF NOT EXISTS students_state_idx             ON students (state);

-- 2. Course modules (lean: just what's needed for completion math)
--    activityIds are the cm-ids (course module ids) of tracked activities.
CREATE TABLE IF NOT EXISTS course_modules (
  module_id       INTEGER   PRIMARY KEY,
  module_name     TEXT      NOT NULL,
  activity_ids    INTEGER[] NOT NULL DEFAULT '{}',
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Per-user completion — which tracked cm-ids each student has completed
CREATE TABLE IF NOT EXISTS completions (
  user_id          INTEGER   PRIMARY KEY REFERENCES students (id) ON DELETE CASCADE,
  completed_cmids  INTEGER[] NOT NULL DEFAULT '{}',
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Quiz metadata — max grade per quiz instance
CREATE TABLE IF NOT EXISTS quiz_details (
  quiz_id     INTEGER PRIMARY KEY,
  grade_max   NUMERIC NOT NULL DEFAULT 0,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Quiz instances — maps each quiz to its parent module
CREATE TABLE IF NOT EXISTS quiz_instances (
  quiz_id         INTEGER PRIMARY KEY,
  module_section  INTEGER NOT NULL,
  module_name     TEXT    NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Full course structure (for the course-structure page)
--    Stored as JSONB so the existing API shape is preserved exactly.
CREATE TABLE IF NOT EXISTS course_structure (
  course_id   INTEGER     PRIMARY KEY,
  sections    JSONB       NOT NULL DEFAULT '[]',
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Sync log — one row per sync run
CREATE TABLE IF NOT EXISTS sync_log (
  id           BIGSERIAL   PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'running', -- 'running' | 'ok' | 'error'
  error        TEXT,
  details      JSONB
);

CREATE INDEX IF NOT EXISTS sync_log_started_at_idx ON sync_log (started_at DESC);
