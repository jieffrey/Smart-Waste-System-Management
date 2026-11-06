-- 002: link a new report to an open report nearby that looks like the same pile ("possible duplicate").
-- Idempotent: safe to run more than once. Existing reports stay valid (the column is NULL for them).
--
--   psql "<connection string>" -v ON_ERROR_STOP=1 -f db/migrations/002_possible_duplicate.sql

BEGIN;

-- Set by the backend when the report is created; NULL when nothing similar was open nearby.
-- If the earlier report is ever deleted, the link is cleared instead of blocking the delete.
ALTER TABLE waste_reports
    ADD COLUMN IF NOT EXISTS possible_duplicate_of uuid REFERENCES waste_reports (id) ON DELETE SET NULL;

-- For "which reports point at this one" and the "Possible duplicate" filter.
CREATE INDEX IF NOT EXISTS waste_reports_possible_duplicate_of_idx
    ON waste_reports (possible_duplicate_of) WHERE possible_duplicate_of IS NOT NULL;

COMMIT;
