-- OFFICE-BOUND WEB PUNCH SCHEMA
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Layers a geofence requirement onto web punch in/out for on-site employees who still
-- want to punch from the tracker website, as opposed to freelance/WFH employees (who
-- keep can_punch_web = true with this flag false — no location check).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS web_punch_office_bound BOOLEAN NOT NULL DEFAULT false;
