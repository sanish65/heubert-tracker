-- ATTENDANCE REMINDERS SCHEMA
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Adds admin-configurable reminder cutoffs and per-day dedup markers so the
-- notify-attendance-reminders cron (polling every 15 minutes) only emails once
-- per person per event per day.

ALTER TABLE office_settings
  ADD COLUMN IF NOT EXISTS checkin_reminder_time TEXT NOT NULL DEFAULT '10:00', -- HH:MM, Asia/Kathmandu
  ADD COLUMN IF NOT EXISTS checkout_reminder_time TEXT NOT NULL DEFAULT '18:30'; -- HH:MM, Asia/Kathmandu

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS checkin_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_reminder_sent_at TIMESTAMPTZ;
