-- 001: when the report's owner last opened it, for the "Baru" (updated) marker in the app.
-- Idempotent: safe to run more than once. Existing reports stay valid; they are marked as seen now, so
-- nobody gets a "Baru" marker for changes made before this feature existed.
--
--   psql "<connection string>" -v ON_ERROR_STOP=1 -f db/migrations/001_report_seen.sql

BEGIN;

-- One row per report (a report has exactly one owner). Rows go away with their report.
CREATE TABLE IF NOT EXISTS report_seen (
    report_id  uuid                     PRIMARY KEY REFERENCES waste_reports (id) ON DELETE CASCADE,
    seen_at    timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO report_seen (report_id, seen_at)
SELECT id, updated_at FROM waste_reports
ON CONFLICT (report_id) DO NOTHING;

COMMIT;
