-- ============================================================
-- NJFP Dashboard — Migration 002: Mentorship Groups
-- Run this in the Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

-- 8. Mentorship groups (from Moodle core_group_get_course_groups)
CREATE TABLE IF NOT EXISTS mentorship_groups (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  idnumber    TEXT    NOT NULL DEFAULT '',
  visibility  INTEGER NOT NULL DEFAULT 0,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Group memberships (from Moodle core_group_get_group_members)
--    No FK on user_id — groups may include non-student members (teachers, admins)
CREATE TABLE IF NOT EXISTS mentorship_group_members (
  group_id    INTEGER NOT NULL REFERENCES mentorship_groups(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS mentorship_group_members_user_id_idx
  ON mentorship_group_members (user_id);
