# SWMS Backend — Express API

Express 5 (CommonJS) API for the Smart Waste Management System, using PostgreSQL (Neon) with raw
parameterized SQL. Waste report photos are classified by the ML API in [`../ml`](../ml).

## Setup

Requires Node.js 22+. From `backend/`:

```bash
npm ci
cp .env.example .env   # then fill in the real values (never commit .env)
```

### Database schema

The full schema — tables `users`, `waste_reports`, `report_status_history`, their constraints,
indexes and `updated_at` triggers — is in [`db/schema.sql`](db/schema.sql). It matches the live
database (generated from it with `pg_dump --schema-only`). To set up a **new, empty** database
(PostgreSQL 13+, e.g. a new Neon database or branch):

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f db/schema.sql
npm run db:check   # confirms the connection and that the 3 tables exist
```

The file runs in one transaction, so if anything fails nothing is created. It does not drop or
change existing tables — don't run it against a database that already has the schema.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string (keep `?sslmode=require`) |
| `JWT_SECRET` | yes | Random secret of **at least 32 characters** — the server refuses to start otherwise. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `24h`) |
| `PORT` | no | Default `3000` |
| `DB_POOL_MAX` | no | Max database connections (default `10`) |
| `ML_API_URL` | no* | Base URL of the ML API, e.g. `http://localhost:8000`. *Without it the server still starts (with a warning), but creating a report returns `503`. |
| `ML_API_KEY` | no | Sent to the ML API as the `X-API-Key` header, only when set (e.g. for a hosted ML API) |
| `ML_API_TIMEOUT_MS` | no | ML API request timeout in milliseconds (default `30000`) |
| `WEB_ORIGIN` | no | Browser origins allowed to call the API (CORS), comma-separated, e.g. `http://localhost:3001,https://admin.example.com`. Empty = no CORS headers. See [CORS](#cors). |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | for `npm run seed` | Demo admin account. See [Demo accounts](#demo-accounts-npm-run-seed). |
| `SEED_USER_NAME`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | for `npm run seed` | Demo user account |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (loads `.env`) |
| `npm start` | Start (env comes from the environment, e.g. Docker) |
| `npm test` | Run all tests (loads `.env`; needs the database) |
| `npm run db:check` | Check the database connection and tables |
| `npm run seed` | Create the demo admin and user (loads `.env`; safe to run again) |

### Demo accounts (`npm run seed`)

Public registration only ever creates role `user`, so the first admin comes from the seed script.
Set the six `SEED_*` variables in `.env` (same rules as registration: name 2–100 characters, a valid
email, password 8–72 characters), then run:

```bash
npm run seed
```

```
admin admin@example.com: created
user  user@example.com: created
```

It is **safe to run again**: an account that already exists (same email, any letter case) is never
duplicated and **its password is never changed** — only its role is set to the expected one and it is
made active again. Both accounts are validated first; if any `SEED_*` value is missing or invalid,
the script lists every problem (by variable name, never showing the value) and writes nothing.

### CORS

The admin web app runs on a different origin than the API, so the browser needs CORS headers.
Set `WEB_ORIGIN` to the web app's origin(s), comma-separated (spaces and a trailing `/` are ignored):

```
WEB_ORIGIN=http://localhost:3001,https://admin.example.com
```

Only these origins get `Access-Control-Allow-Origin`; preflight (`OPTIONS`) requests are answered
automatically. When `WEB_ORIGIN` is empty, no CORS headers are sent at all. CORS does not replace
authentication — every protected endpoint still needs a valid token. The mobile app does not use
CORS (it is not a browser), so it works with or without `WEB_ORIGIN`.

## API

All errors use the same format:

```json
{ "error": { "message": "Validation failed", "details": [{ "field": "latitude", "message": "Latitude is required" }] } }
```

### Auth — `/api/auth`

| Endpoint | Description |
|---|---|
| `POST /api/auth/register` | `{ full_name, email, password }` → `201 { user, token }` (role is always `user`) |
| `POST /api/auth/login` | `{ email, password }` → `200 { user, token }` |
| `GET /api/auth/me` | `Authorization: Bearer <token>` → `200 { user }` |

### Create a waste report — `POST /api/reports`

Only signed-in users with role **`user`** can create reports (`Authorization: Bearer <token>`).
Send `multipart/form-data`:

| Field | Required | Rules |
|---|---|---|
| `image` | yes | JPEG, PNG or WebP, max **5 MB** (type is checked from the file content, not the file name) |
| `description` | yes | 1–1000 characters |
| `latitude` | yes | −90 to 90 |
| `longitude` | yes | −180 to 180 |
| `address` | no | max 255 characters |

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token>" \
  -F "image=@bottles.jpg" \
  -F "description=Plastic bottles next to the bus stop" \
  -F "latitude=-6.2" -F "longitude=106.816666"
```

**The category is set automatically by the ML API.** The client does not send a category (a
`category` field is ignored). The backend sends the photo to `POST {ML_API_URL}/predict` and saves:

- `category` = the predicted category (`organic`, `paper` or `plastic`)
- `ai_predicted_category`, `ai_confidence`, `ai_model_version` = the raw ML result

`category` and `ai_predicted_category` are separate columns, so an admin can correct `category`
later while the original AI result is kept.

`201` response:

```json
{
  "report": {
    "id": "…",
    "user_id": "…",
    "description": "Plastic bottles next to the bus stop",
    "category": "plastic",
    "status": "pending",
    "image_url": "/uploads/<uuid>.jpg",
    "latitude": -6.2,
    "longitude": 106.816666,
    "address": null,
    "ai_predicted_category": "plastic",
    "ai_confidence": 0.9981,
    "ai_model_version": "swms_mobilenetv2_best",
    "admin_note": null,
    "created_at": "…",
    "updated_at": "…"
  }
}
```

**When the ML API is unavailable** — `ML_API_URL` not set, the ML API is down, takes longer than
`ML_API_TIMEOUT_MS`, returns an error, or returns an invalid result — the request fails with `503`
and **nothing is saved** (no image file, no database rows). The client can simply try again:

```json
{ "error": { "message": "Classification service is unavailable, please try again", "details": null } }
```

Order of work: validate the request → classify with the ML API → save the image → insert the report
and its first status-history row (`pending`) in one transaction. The reason for an ML failure is
only logged on the server, never sent to the client.

| Status | When |
|---|---|
| `201` | Report created |
| `400` | Missing image, invalid fields, wrong upload field name, or a broken upload |
| `401` | No or invalid token |
| `403` | Not role `user` (e.g. an admin), or account deactivated |
| `413` | Image larger than 5 MB |
| `415` | Not a JPEG, PNG or WebP image |
| `503` | ML API unavailable (see above) |

### List your own reports — `GET /api/reports/me`

Only role **`user`** (an admin gets `403`). Returns the signed-in user's reports, newest first.

| Query parameter | Default | Rules |
|---|---|---|
| `page` | `1` | whole number ≥ 1 |
| `limit` | `20` | 1–50 |
| `status` | all | `pending`, `in_progress`, `completed` or `rejected` |

```bash
curl "http://localhost:3000/api/reports/me?status=pending&page=1&limit=10" -H "Authorization: Bearer <token>"
```

```json
{
  "reports": [{ "id": "…", "status": "pending", "category": "plastic", "image_url": "/uploads/<uuid>.jpg", "…": "…" }],
  "pagination": { "page": 1, "limit": 10, "total": 1 }
}
```

`total` is the number of matching reports across all pages. An invalid `page`, `limit` or `status`
returns `400` with field details.

### Report detail — `GET /api/reports/:id`

Returns `200 { report }` with the same fields as above plus `status_history` (oldest first):

```json
{
  "report": {
    "id": "…",
    "status": "in_progress",
    "…": "…",
    "status_history": [
      { "old_status": null, "new_status": "pending", "note": null, "created_at": "…" },
      { "old_status": "pending", "new_status": "in_progress", "note": "Cleanup team assigned", "created_at": "…" }
    ]
  }
}
```

Only the **owner** or an **admin** can see a report. Everyone else — and unknown or malformed ids —
gets `404` "Report not found" (not `403`), so report ids cannot be probed. The history does not
include who made each change.

### Images

Images are stored locally in `backend/uploads/` (gitignored) and served at `/uploads/<uuid>.<ext>`.
All file access goes through `src/modules/uploads/uploads.service.js`, so it can be swapped for
cloud storage later.

`image_url` is **relative** (e.g. `/uploads/<uuid>.jpg`). Clients build the full URL from the API
base URL they already use: if `image_url` starts with `http`, use it as is; otherwise prefix it with
the API base URL (e.g. `http://192.168.1.10:3000` + `image_url`). This keeps working if storage later
moves to the cloud and returns absolute URLs.

## Admin API — `/api/admin`

Every admin endpoint requires `Authorization: Bearer <token>` of an **active admin**: no token → `401`,
any other role → `403`. Unknown or malformed ids → `404`. List endpoints use the same pagination as
`/api/reports/me` (`page`, `limit` 1–50) and return `{ <items>, pagination: { page, limit, total } }`.

### List reports — `GET /api/admin/reports`

All reports, newest first, each with `reporter_name` and `reporter_email`.

| Query parameter | Description |
|---|---|
| `status` | `pending`, `in_progress`, `completed` or `rejected` |
| `category` | `organic`, `paper` or `plastic` |
| `from`, `to` | Dates `YYYY-MM-DD` (Asia/Jakarta); `to` is inclusive and must not be before `from` |
| `q` | Case-insensitive search in `description` and `address` (`%` and `_` are matched literally) |
| `page`, `limit` | Pagination |

```bash
curl "http://localhost:3000/api/admin/reports?status=pending&from=2026-11-01&q=bus%20stop" -H "Authorization: Bearer <admin token>"
```

### Report detail — `GET /api/admin/reports/:id`

`200 { report }` with the reporter (`user_id`, `reporter_name`, `reporter_email`) and the full
`status_history`, including who made each change (`changed_by`, `changed_by_name`).

### Update a report — `PATCH /api/admin/reports/:id`

JSON body with at least one of:

| Field | Description |
|---|---|
| `status` | New status — only the allowed transitions below |
| `category` | Corrected category (`organic`, `paper`, `plastic`). `ai_predicted_category` is never changed, so the original AI result is kept. |
| `admin_note` | Note for the report (1–1000 characters). **Required when rejecting.** |

Status transitions (enforced by the backend):

```
pending      → in_progress | rejected
in_progress  → completed   | rejected
completed, rejected → final (no more changes of any kind)
```

- A status change writes a `report_status_history` row (`changed_by` = the admin, `note` = `admin_note`)
  in the same transaction as the update.
- Category or note changes without a status change are allowed on `pending` and `in_progress` reports
  and do not add a history row.
- Returns `200 { report }` (same shape as the detail endpoint).

| Status | When |
|---|---|
| `400` | Empty body, invalid values, or `status: "rejected"` without `admin_note` |
| `409` | Invalid or same-status transition (`details` lists the allowed statuses), or the report is already `completed`/`rejected` |

```json
{ "error": { "message": "Cannot change status from pending to completed", "details": [{ "field": "status", "message": "Allowed: in_progress, rejected" }] } }
```

### Dashboard stats — `GET /api/admin/stats`

```json
{
  "totals": {
    "reports": 12,
    "by_status": { "pending": 5, "in_progress": 3, "completed": 3, "rejected": 1 },
    "by_category": { "organic": 4, "paper": 3, "plastic": 5 }
  },
  "reports_per_day": [{ "date": "2026-10-05", "count": 0 }, "… 30 days, oldest first, today last …"],
  "ai_accuracy": { "reviewed": 6, "matching": 5, "accuracy": 0.8333 }
}
```

- `reports_per_day`: the last 30 days including today, counted in **Asia/Jakarta**; days without
  reports have `count: 0`.
- `ai_accuracy`: over reports with status `in_progress` or `completed` that have an AI prediction —
  `matching` is how many still have `category == ai_predicted_category` (i.e. the admin did not
  correct it). `accuracy` = `matching / reviewed` (4 decimals), or `null` when `reviewed` is 0.

### List users — `GET /api/admin/users`

Users newest first with `id`, `full_name`, `email`, `role`, `is_active`, `created_at`, `updated_at` and
`report_count` (never the password hash). Filters: `role` (`admin`/`user`), `is_active`
(`true`/`false`), `q` (search in name and email), `page`, `limit`.

### Activate / deactivate a user — `PATCH /api/admin/users/:id`

Body: `{ "is_active": false }` (a JSON boolean). Returns `200 { user }`. A deactivated user's token
stops working immediately (`403 Account is deactivated`). An admin cannot deactivate their own
account (`400`).

## Tests

`npm test` uses Node's built-in test runner against the real database: tests create temporary
users and reports and delete them afterwards, and never assume the database is empty (the stats
tests compare before/after counts). Test files run **one at a time** (`--test-concurrency=1`) so
that tests in different files cannot change each other's data mid-test. **No ML server is needed** —
the tests start a fake ML API (`tests/helpers/fake-ml-api.js`) to cover success, ML errors, invalid
responses, timeouts and the ML API being down.
