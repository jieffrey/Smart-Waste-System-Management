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
| `PORT` | no | Default `4000` |
| `DB_POOL_MAX` | no | Max database connections (default `10`) |
| `ML_API_URL` | no* | Base URL of the ML API, e.g. `http://localhost:8000`. *Without it the server still starts (with a warning), but creating a report returns `503`. |
| `ML_API_KEY` | no | Sent to the ML API as the `X-API-Key` header, only when set (e.g. for a hosted ML API) |
| `AI_REVIEW_THRESHOLD` | no | Reports with AI confidence below this (0–1) "need review" until an admin confirms or corrects them. Default `0.70`; anything outside (0, 1] stops the server at startup |
| `ML_API_TIMEOUT_MS` | no | ML API request timeout in milliseconds: default `30000`, allowed `100`–`40000`. The server refuses to start outside that range, so the timeout stays below the mobile app's 45 s upload timeout |
| `TRUST_PROXY` | no | Number of reverse proxies in front of the API (e.g. `1` on Render/Railway). Needed so rate limits see each client's IP instead of the proxy's. Leave unset when clients connect directly. See [Rate limits](#rate-limits). |
| `WEB_ORIGIN` | no | Browser origins allowed to call the API (CORS), comma-separated, e.g. `http://localhost:3001,https://admin.example.com`. Empty = no CORS headers. See [CORS](#cors). |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | no | Optional override of the demo admin for `npm run seed` (local setup). See [Demo accounts](#demo-accounts-npm-run-seed-local-setup-only). |
| `SEED_USER_NAME`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | no | Optional override of the demo user for `npm run seed` |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (loads `.env`) |
| `npm start` | Start (env comes from the environment, e.g. Docker) |
| `npm test` | Run all tests (loads `.env`; needs the database) |
| `npm run db:check` | Check the database connection and tables |
| `npm run seed` | **Local development only:** create the demo admin and user (loads `.env`; safe to run again) |
| `npm run set-admin-password` | Set a new password for an existing admin, typed at a hidden prompt (loads `.env`) |
| `npm run seed-demo -- --dry-run` | Preview the **production demo data** (see [Production demo data](#production-demo-data-seed-demojs)); a real run needs `--confirm <database host>` |

### Demo accounts (`npm run seed`): local setup only

Public registration only ever creates role `user`, so the first admin comes from the seed script.
The seed is meant for **your local development database**. The credentials below are public (they are
in this repository) and **do not work on the deployed instance**: the deployed demo credentials are
provided in the submission email.

The demo accounts are defined at the top of [`scripts/seed.js`](scripts/seed.js):

| Role | Name | Email | Password |
|---|---|---|---|
| `admin` | Admin SWMS | `dimoya4077@macsnipe.com` | `Admin123!` |
| `user` | Demo User | `kaseg88634@macsnipe.com` | `Password123!` |

```bash
npm run seed
```

```
admin dimoya4077@macsnipe.com: created
user  kaseg88634@macsnipe.com: created
```

> **Warning:** these credentials are public. On any shared or deployed database, give the admin a
> real password with `npm run set-admin-password` (below). Re-running the seed never changes an
> existing password, so it can't reset the admin back to the demo password.

**Optional override:** a non-empty `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD`, `SEED_USER_NAME`, `SEED_USER_EMAIL` or `SEED_USER_PASSWORD` environment variable
replaces the matching value above. They are not in `.env.example`; add them to `.env` or the server's
environment only when needed.

It is **safe to run again**: an account that already exists (same email, any letter case) is never
duplicated and **its password is never changed** — only its role is set to the expected one and it is
made active again. Both accounts are checked with the registration rules first (name 2–100
characters, a valid email, password 8–72 characters); if anything is invalid, the script lists every
problem (never showing the values) and writes nothing.

### Production demo data (`seed-demo.js`)

[`scripts/seed-demo.js`](scripts/seed-demo.js) fills a deployed database with realistic demo data. It is separate
from the local `npm run seed`. It creates:
- **5 residents** (`@demo.swms.invalid`, a reserved domain that can never be a real mailbox), all with the
  password from `DEMO_RESIDENT_PASSWORD`;
- **48 reports** from [`scripts/demo/manifest.json`](scripts/demo/manifest.json):
  - 16 per category, created over the last 30 days (Asia/Jakarta), in Jakarta Selatan;
  - 14 `pending`, 12 `in_progress`, 15 `completed` and 7 `rejected`, with admin notes;
- **status history** that follows the allowed transitions; changes after the first are signed by the admin.

**The photos** are 48 test-split images from the Kaggle dataset (MIT), resized to ≤1024 px and stripped of all
metadata, in [`scripts/demo/photos/`](scripts/demo/photos/) with their
[attribution](scripts/demo/photos/ATTRIBUTION.md). `DEMO_PHOTOS_DIR` can point at another folder with the same
file names. Each photo is **classified by the real ML API** while seeding, so the AI fields are honest. Then, like
an admin would, reviewed reports (`in_progress`/`completed`) where the AI was wrong get the true category and a note
(*"Kategori dikoreksi dari … ke …"*). Pending and rejected reports keep the AI's category. Photos are stored with
the configured `STORAGE_DRIVER`.

**The dashboard's AI accuracy on demo data is optimistic.**
- **Possible training images:** only **9** of the 48 photos are confirmed test-split images: 6 the first model got
  wrong and the 3 parity samples. The other **39** come from a local re-run of the split, which can't reproduce
  the Colab file order, so they **may have been training images**.
- **Why that inflates the number:** a model does better on images it was trained on. The "AI accuracy" the
  dashboard shows for the demo reports (and how few corrections the admin had to make) overstates how the model
  does on new photos.
- **With the served Option B model**, 5 of the 6 confirmed mistakes are still wrong (the paper plate, `pap-02`,
  is now right). Expect about 5 category corrections in the demo data.
- **For an honest measure**, use reviewed reports from real users, or the test-set numbers in
  [`ml/README.md`](../ml/README.md#10-option-b-class-weights--fine-tuning-the-served-model).

**Safe by design:**
- **Re-runs:** each report's id is a UUID v5 of its manifest key, so a re-run skips existing reports (no new
  uploads) and creates only what's missing. Existing residents keep their password.
- **Admins:** the admin (`DEMO_ADMIN_EMAIL`) is only **read**. No admin row is ever written, and the script refuses
  to run if the admin doesn't exist or a resident email belongs to a non-`user` account.
- **Confirmation:** a real run needs `--confirm <host>` equal to the host in `DATABASE_URL` (the error message
  shows it). `--dry-run` writes nothing.
- **Failures:** each report is one transaction; if it fails, the uploaded photo is deleted. Nothing is ever deleted
  otherwise.

```bash
# from backend/, with the production env file (DATABASE_URL, ML_API_URL/ML_API_KEY, STORAGE_DRIVER/CLOUDINARY_*,
# DEMO_ADMIN_EMAIL, DEMO_RESIDENT_PASSWORD)
node --env-file=.env.production scripts/seed-demo.js --dry-run
node --env-file=.env.production scripts/seed-demo.js --confirm ep-xxxx-pooler.ap-southeast-1.aws.neon.tech
```

### Set an admin password (`npm run set-admin-password`)

Changes the password of an existing **admin** account in the database that `DATABASE_URL` points to
(for example the deployed Neon database). Run it from `backend/` in an interactive terminal
(PowerShell or Windows Terminal; in Git Bash use `winpty npm.cmd run set-admin-password`):

```bash
npm run set-admin-password
```

```
Admin email: admin@example.com
New password (hidden):
Repeat the new password:
Password updated for admin@example.com.
```

- The password is typed at a **hidden prompt**. It is never accepted as a command-line argument and
  never printed or logged.
- It must be at least 12 characters, use at least 6 different characters, and not contain common
  words (such as "password" or "admin") or the email address. If it doesn't qualify, nothing changes.
- It is hashed exactly like registration (bcrypt), and only accounts with role `admin` can be changed.
- Tokens issued before the change stay valid until they expire (`JWT_EXPIRES_IN`).

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
| `POST /api/auth/register` | `{ full_name, email, password }` → `201 { user, token }` (role is always `user`). Password: 8–72 characters and not one of the most common passwords |
| `POST /api/auth/login` | `{ email, password }` → `200 { user, token }` |
| `GET /api/auth/me` | `Authorization: Bearer <token>` → `200 { user }` |
| `PATCH /api/auth/me` | `{ full_name?, email? }` (at least one, same rules as registration) → `200 { user }`. An email of another account → `409 Email is already registered`. The token stays valid |
| `POST /api/auth/change-password` | `{ current_password, new_password }` → `200 { message: "Password changed" }`. Wrong current password → `400` with a `current_password` detail (not 401, so the apps don't sign out). The new password follows the registration rules and must differ from the current one. Existing tokens stay valid until they expire (stateless JWT) |

### Rate limits

Limited requests get `429` with a `Retry-After` header (seconds) and the usual error format, e.g.
`{ "error": { "message": "Too many login attempts. Please try again in 15 minutes.", "details": null } }`.

| Endpoint | Limit | Why this number |
|---|---|---|
| `POST /api/auth/login` | 20 per IP per 15 min | Plenty for typos or a shared office IP; far too few for password guessing |
| `POST /api/auth/login` | 5 **failed** attempts per email per 15 min | Stops guessing one account from many IPs. Successful logins don't count. Applies to any email, registered or not, so it reveals nothing |
| `POST /api/auth/register` | 10 per IP per hour | A group signing up together fits; mass account creation doesn't |
| `PATCH /api/auth/me` | 20 per user per hour | Enough to fix typos; stops probing which emails are registered |
| `POST /api/auth/change-password` | 5 **failed** attempts per user per 15 min | Same as login: stops guessing the current password with a stolen token or an unlocked phone |
| `POST /api/reports` | 20 per user per hour | A busy reporter fits; filling the disk with 5 MB photos doesn't (max ~100 MB per user per hour) |

The counters are kept **in memory**: they reset when the server restarts and only work correctly with a
single instance (use a shared store such as Redis for more). Behind a reverse proxy, set `TRUST_PROXY`.

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
curl -X POST http://localhost:4000/api/reports \
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
    "ai_model_version": "swms_mobilenetv2_option_b",
    "admin_note": null,
    "created_at": "…",
    "updated_at": "…"
  }
}
```

**When the ML API can't use the photo** — it answers `400` (corrupt, empty or too many pixels), `413`
(too large) or `415` (not a JPEG/PNG/WebP) — the request fails with `422` and an error on the `image`
field. **Nothing is saved**, and the ML API's own error text is never passed on:

```json
{ "error": { "message": "The photo couldn't be processed. Try another photo.", "details": [{ "field": "image", "message": "The photo couldn't be processed. Try another photo." }] } }
```

**When the ML API is unavailable** — `ML_API_URL` not set, the ML API is down, takes longer than
`ML_API_TIMEOUT_MS`, answers `5xx` or any other unexpected status, or returns an invalid result — the
request fails with `503` and **nothing is saved** (no image file, no database rows). The client can
simply try again:

```json
{ "error": { "message": "AI service unavailable, please try again later", "details": null } }
```

Order of work: validate the request → classify with the ML API → strip the photo's metadata → store the
image → insert the report and its first status-history row (`pending`) in one transaction. If the insert (or
getting a database connection) fails, the stored image is deleted again. The reason for an ML failure is
only logged on the server, never sent to the client.

| Status | When |
|---|---|
| `201` | Report created |
| `400` | Missing image, invalid fields, wrong upload field name, or a broken upload |
| `401` | No or invalid token |
| `403` | Not role `user` (e.g. an admin), or account deactivated |
| `413` | Image larger than 5 MB |
| `415` | Not a JPEG, PNG or WebP image |
| `422` | The ML API couldn't process the photo, or it can't be decoded for storage (error on the `image` field) |
| `429` | More than 20 new reports in an hour (see [Rate limits](#rate-limits)) |
| `503` | ML API unavailable (see above), or photo storage (Cloudinary) unavailable |

### List your own reports — `GET /api/reports/me`

Only role **`user`** (an admin gets `403`). Returns the signed-in user's reports, newest first.

| Query parameter | Default | Rules |
|---|---|---|
| `page` | `1` | whole number ≥ 1 |
| `limit` | `20` | 1–50 |
| `status` | all | `pending`, `in_progress`, `completed` or `rejected` |

```bash
curl "http://localhost:4000/api/reports/me?status=pending&page=1&limit=10" -H "Authorization: Bearer <token>"
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

All image handling goes through `src/modules/uploads/uploads.service.js`. `STORAGE_DRIVER` picks where
photos go:

| `STORAGE_DRIVER` | Stored in | `image_url` | Use |
|---|---|---|---|
| `local` (default) | `backend/uploads/` (gitignored), served at `/uploads/<uuid>.<ext>` | relative, `/uploads/<uuid>.jpg` | development, tests |
| `cloudinary` | Cloudinary, public id `<CLOUDINARY_FOLDER>/<uuid>` (needs `CLOUDINARY_URL`) | absolute, `https://res.cloudinary.com/…` | production (container disks are wiped on redeploy) |

With `cloudinary`, `/uploads` isn't mounted. The server refuses to start with an unknown driver, or with
`cloudinary` but no `CLOUDINARY_URL`.

**Metadata is stripped before storing (SEC-06).** The upload is classified as sent, then re-encoded with
`sharp` in the same format: the EXIF orientation is applied to the pixels, and all metadata is dropped
(EXIF including GPS, XMP, IPTC, ICC). An image that can't be decoded gets `422` on the `image` field.

Clients build the full URL like this: if `image_url` starts with `http`, use it as is; otherwise prefix it
with the API base URL (e.g. `http://192.168.1.10:4000` + `image_url`). The web and mobile helpers already do
this, so both drivers work without client changes.

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
| `needs_review` | `true`: only reports that need review (see below); `false` or absent: no filter |
| `page`, `limit` | Pagination |

```bash
curl "http://localhost:4000/api/admin/reports?status=pending&from=2026-11-01&q=bus%20stop" -H "Authorization: Bearer <admin token>"
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
  "reports_per_day": [{ "date": "2026-10-05", "count": 0, "completed_count": 0 }, "… 30 days, oldest first, today last …"],
  "ai_accuracy": { "reviewed": 6, "matching": 5, "accuracy": 0.8333 },
  "ai_flow": [{ "ai_category": "organic", "category": "organic", "count": 4 }, "… all 9 pairs …"],
  "needs_review": { "count": 2, "threshold": 0.7 }
}
```

- `reports_per_day`: the last 30 days including today, counted in **Asia/Jakarta**. `count` is the reports
  created that day; `completed_count` is the reports whose status became `completed` that day (from the
  status history). Days without any have `0`.
- `ai_accuracy`: over reports with status `in_progress` or `completed` that have an AI prediction —
  `matching` is how many still have `category == ai_predicted_category` (i.e. the admin did not
  correct it). `accuracy` = `matching / reviewed` (4 decimals), or `null` when `reviewed` is 0.
- `ai_flow`: for every report with an AI prediction (any status), how many go from each
  `ai_category` (what the AI said) to each current `category`. Always all 9 pairs, in the order
  organic, paper, plastic (AI) × organic, paper, plastic (current), with `count: 0` when none. Pairs
  where the two differ are admin corrections. Used for the dashboard's Sankey chart.
- `needs_review`: how many reports need review right now, and the `AI_REVIEW_THRESHOLD` in use.

#### "Needs review"

Every report payload (admin and resident) has a computed `needs_review` boolean: **true** when
`ai_confidence < AI_REVIEW_THRESHOLD` (default `0.70`) **and** no admin has confirmed or corrected the category
yet, i.e. `category = ai_predicted_category` **and** `status = 'pending'`. It is computed in SQL, not stored (no
migration). Correcting the category clears it. So does routing the report (in progress / completed /
rejected), because routing means an admin looked at it and kept the category. The one case this can't see is
an admin who saves only a note on a pending report: that still counts as unreviewed, which is the safe side.

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
