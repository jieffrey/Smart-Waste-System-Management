# Database migrations runbook

Production (Neon) gets schema changes **only** through the numbered files in `backend/db/migrations/`. Each one
is idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, safe defaults), runs in one transaction, and keeps
existing rows valid. `backend/db/schema.sql` already contains every migration, for fresh setups.

**Order of operations for a branch that needs a migration:**

1. Run the migration on production (below).
2. Run its verification query and check the result.
3. Only then merge the branch (Railway redeploys the backend from `main`; the new code expects the new schema).

Run everything from `backend/`, with the production connection string (the Neon pooled URL from Railway's
`DATABASE_URL`). Use `psql` 13+:

```bash
export PROD_DB="<Neon connection string, with ?sslmode=require>"
```

Running a migration twice is harmless (Postgres prints a `NOTICE ... already exists, skipping`).

---

## 001: `report_seen` (branch `feat/report-update-badge`)

When the owner of a report last opened it. Drives the "Baru" marker and the tab count in the app. Every existing
report is marked as seen at its current `updated_at`, so nobody gets a marker for changes made before the release.

```bash
psql "$PROD_DB" -v ON_ERROR_STOP=1 -f db/migrations/001_report_seen.sql
```

Verify: both numbers must be equal right after the migration.

```bash
psql "$PROD_DB" -c "SELECT (SELECT COUNT(*) FROM waste_reports) AS reports, (SELECT COUNT(*) FROM report_seen) AS seen;"
```
