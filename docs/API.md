# SWMS API reference

Two HTTP APIs:

| API | Base URL | Who calls it |
|---|---|---|
| **Backend** (Express) | Production: `https://smart-waste-system-management-production-c94d.up.railway.app` · local: `http://localhost:4000` | The mobile app (residents) and the web panel's server (admins) |
| **ML API** (FastAPI) | No public URL in production (Railway private network, `http://ml.railway.internal:8000`) · local: `http://localhost:8000` | Only the backend |

Everything below is taken from the route files, the zod schemas and the tests in
[`backend/src/modules/`](../backend/src/modules/) and [`ml/src/api/`](../ml/src/api/). The backend README has the
same endpoints with more background: [`backend/README.md`](../backend/README.md#api).

- [Conventions](#conventions)
- [Quick start with curl](#quick-start-with-curl)
- Backend: [Health](#health) · [Auth](#auth-apiauth) · [Resident reports](#resident-reports-apireports) ·
  [Admin reports](#admin-reports-apiadminreports) · [Admin users](#admin-users-apiadminusers) ·
  [Admin stats](#admin-stats-apiadminstats)
- [ML API](#ml-api)

---

## Conventions

**Auth.** Protected endpoints need `Authorization: Bearer <token>`. The token is a JWT (HS256) from login,
registration or email verification, valid for `JWT_EXPIRES_IN` (default 24 h). On every request the backend loads
the user from the database, so role and active state are always current.

| Auth label | Meaning |
|---|---|
| none | No token needed |
| any | Any signed-in, active user (resident or admin) |
| resident | Role `user` only (an admin gets `403`) |
| admin | Role `admin` only (a resident gets `403`) |

**Errors.** Every error has the same body; `details` is a list of field errors or `null`:

```json
{ "error": { "message": "Validation failed", "details": [{ "field": "latitude", "message": "Latitude is required" }] } }
```

Errors that any endpoint can return:

| Status | `message` | When |
|---|---|---|
| `400` | `Validation failed` | Body or query fails its schema; `details` lists each field |
| `400` | `Request body must be valid JSON` | Malformed JSON |
| `401` | `Authentication required` | No `Bearer` token on a protected endpoint |
| `401` | `Invalid or expired token` | Bad signature, expired, or the user no longer exists |
| `403` | `Account is deactivated` | The user was deactivated by an admin (takes effect immediately) |
| `403` | `You do not have permission to perform this action` | Wrong role for the endpoint |
| `404` | `Route not found` | Unknown path |
| `413` | `Request body is too large` | JSON body over 100 KB |
| `429` | `Too many <action>. Please try again in N minute(s).` | Rate limit hit; the `Retry-After` header gives the seconds |
| `500` | `Internal server error` | Unexpected error (details only in the server log) |

**Rate limits** are kept in memory per backend instance (they reset on restart). Behind Railway, `TRUST_PROXY`
makes the per-IP limits see the client's IP.

**Pagination.** List endpoints take `page` (integer ≥ 1, default `1`) and `limit` (integer 1–50, default `20`) and
return `pagination: { page, limit, total }`, where `total` counts all matching rows.

**Types.** IDs are UUIDs. Timestamps are ISO 8601 strings (UTC). `latitude`, `longitude` and `ai_confidence` are
JSON numbers. Enums: status `pending | in_progress | completed | rejected`, category `organic | paper | plastic`,
role `admin | user`.

### Report object

Returned by every report endpoint:

| Field | Type | Notes |
|---|---|---|
| `id`, `user_id` | uuid | `user_id` = the reporter |
| `description` | string | 1–1000 chars |
| `category` | category | Current category (the AI's, or the admin's correction) |
| `status` | status | |
| `image_url` | string | `/uploads/<uuid>.<ext>` (local storage) or `https://res.cloudinary.com/...` (production) |
| `latitude`, `longitude` | number | |
| `address` | string \| null | |
| `ai_predicted_category` | category \| null | What the AI said; never changed by an admin |
| `ai_confidence` | number \| null | 0–1, 4 decimals |
| `ai_model_version` | string \| null | e.g. `swms_mobilenetv2_option_b` |
| `admin_note` | string \| null | |
| `possible_duplicate_of` | uuid \| null | Earlier open report this one may duplicate |
| `needs_review` | boolean | `ai_confidence < AI_REVIEW_THRESHOLD` (default 0.70), still `pending`, category unchanged |
| `created_at`, `updated_at` | timestamp | |

### User object

`{ id, full_name, email, role, is_active, created_at, updated_at }`. The password hash is never returned.

---

## Quick start with curl

```bash
BASE=https://smart-waste-system-management-production-c94d.up.railway.app

# 1. Is it up?
curl $BASE/api/health
# {"status":"ok"}

# 2. Sign in (demo credentials are in the submission email) and keep the token
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"<email>","password":"<password>"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')

# 3. Who am I?
curl $BASE/api/auth/me -H "Authorization: Bearer $TOKEN"

# 4. Resident: submit a report (the AI sets the category), then list your reports
curl -X POST $BASE/api/reports -H "Authorization: Bearer $TOKEN" \
  -F "image=@bottles.jpg" -F "description=Plastic bottles next to the bus stop" \
  -F "latitude=-6.2" -F "longitude=106.816666"
curl "$BASE/api/reports/me?status=pending" -H "Authorization: Bearer $TOKEN"

# 5. Admin (sign in with an admin account): reports that need review, and the dashboard stats
curl "$BASE/api/admin/reports?needs_review=true" -H "Authorization: Bearer $TOKEN"
curl $BASE/api/admin/stats -H "Authorization: Bearer $TOKEN"
```

Email verification is on in the live demo, so a newly registered account must verify its code (see
[`POST /api/auth/verify-email`](#post-apiauthverify-email)) before it can sign in.

---

## Health

### `GET /api/health`

Auth: none. `200 {"status":"ok"}`.

---

## Auth (`/api/auth`)

Shared field rules:

| Field | Rule |
|---|---|
| `full_name` | string, trimmed, 2–100 chars |
| `email` | string, trimmed, lower-cased, valid email, max 255 chars |
| new password | string, 8–72 chars, not one of ~100 very common passwords (any letter case) |

### `POST /api/auth/register`

Auth: none. Rate limit: **10 per IP per hour**. Public registration always creates role `user`.

Body: `{ "full_name": string, "email": string, "password": string }`

- OTP off: `201 { "user": User, "token": string }`
- OTP on (`OTP_ENABLED=true`, as in the live demo): `201 { "user": User, "verification_required": true }`, no token.
  A 6-digit code is emailed (10-minute expiry, 5 wrong tries).

| Status | When |
|---|---|
| `400` | Validation failed (`full_name`, `email`, `password`) |
| `409` | `Email is already registered` |
| `503` | `Could not send the verification email. Please try again later` (OTP on; the account is removed again) |

### `POST /api/auth/verify-email`

Auth: none. Rate limit: **20 per IP per 15 min** (and each code dies after 5 wrong tries).

Body: `{ "email": string, "code": "123456" }` (`code` = exactly 6 digits)

`200 { "user": User, "token": string }`

| Status | When |
|---|---|
| `400` | `Invalid or expired code` / `Too many wrong codes. Request a new code` / `Code expired. Request a new code` (each with a `code` field detail) |
| `404` | `Email verification is not enabled` (OTP off) |

### `POST /api/auth/resend-code`

Auth: none. Rate limit: **10 per IP per hour**, and **one code per account per 60 s**.

Body: `{ "email": string }`

`200 { "message": "If this account still needs verification, a new code has been sent" }`, the same answer for
unknown or already verified emails.

| Status | When |
|---|---|
| `404` | `Email verification is not enabled` (OTP off) |
| `429` | `Please wait N seconds before requesting a new code` (+ `Retry-After`) |
| `503` | The email could not be sent |

### `POST /api/auth/login`

Auth: none. Rate limits: **20 per IP per 15 min**, and **5 failed attempts per email per 15 min** (successful logins
don't count; applies to unknown emails too).

Body: `{ "email": string, "password": string }` (password: any non-empty string)

`200 { "user": User, "token": string }`

| Status | When |
|---|---|
| `401` | `Invalid email or password` (same answer and timing for unknown emails) |
| `403` | `Account is deactivated` |
| `403` | `Email not verified` (OTP on; the app opens the code screen) |

### `GET /api/auth/me`

Auth: any. `200 { "user": User }`.

### `PATCH /api/auth/me`

Auth: any. Rate limit: **20 per user per hour**.

Body: `{ "full_name"?: string, "email"?: string }`, at least one (same rules as registration).

`200 { "user": User }`. The token stays valid.

| Status | When |
|---|---|
| `400` | Validation failed, or `Provide at least one of: full_name, email` |
| `409` | `Email is already registered` (another account has it) |

### `POST /api/auth/change-password`

Auth: any. Rate limit: **5 failed attempts per user per 15 min**.

Body: `{ "current_password": string, "new_password": string }` (`new_password` follows the registration rules and
must differ from the current one).

`200 { "message": "Password changed" }`. Tokens issued earlier stay valid until they expire.

| Status | When |
|---|---|
| `400` | Validation failed (`new_password`), or `Current password is incorrect` with a `current_password` detail (400, not 401, so the apps don't sign out) |

---

## Resident reports (`/api/reports`)

### `POST /api/reports`

Auth: **resident**. Rate limit: **20 new reports per user per hour** (checked before the upload is read).

`multipart/form-data`:

| Field | Required | Rules |
|---|---|---|
| `image` | yes | One file, JPEG / PNG / WebP (checked from the file's bytes), max **5 MB** |
| `description` | yes | 1–1000 chars |
| `latitude` | yes | number, −90 to 90 |
| `longitude` | yes | number, −180 to 180 |
| `address` | no | max 255 chars |

Any `category` field is ignored: the category comes from the ML API. Order of work: validate → classify with the ML
API → strip all photo metadata (EXIF incl. GPS) → store the photo → insert the report and its first status-history
row in one transaction → link a possible duplicate (open report, same category, ≤ 50 m, last 24 h).

`201 { "report": Report }`, with `status: "pending"` and `category = ai_predicted_category`.

| Status | When |
|---|---|
| `400` | Missing image (`image` detail), invalid fields, `Upload the image in the "image" field`, `Too many form fields`, `A form field is too long`, `Invalid upload` |
| `413` | `Image must be 5 MB or smaller` |
| `415` | `Unsupported file type. Upload a JPEG, PNG or WebP image` |
| `422` | `The photo couldn't be processed. Try another photo.` (`image` detail): the ML API or the image re-encoder rejected it |
| `503` | `AI service unavailable, please try again later` (ML API down, slow, misconfigured or invalid answer), or `Photo storage unavailable, please try again later`. Nothing is saved |

### `GET /api/reports/me`

Auth: **resident**. Query: `page`, `limit`, `status` (optional).

```json
{
  "reports": [{ "id": "…", "status": "in_progress", "category": "plastic", "has_update": true, "…": "…" }],
  "pagination": { "page": 1, "limit": 20, "total": 12 },
  "unseen_updates": 1
}
```

Newest first. Each report is a [Report](#report-object) plus `has_update` (an admin changed it after the owner last
opened it). `unseen_updates` counts all of the user's reports with an update (any status), for the tab badge.

### `GET /api/reports/:id`

Auth: any (the **owner** or an **admin**). `200 { "report": Report + has_update + status_history }`:

```json
"status_history": [
  { "old_status": null, "new_status": "pending", "note": null, "created_at": "…" },
  { "old_status": "pending", "new_status": "in_progress", "note": "Cleanup team assigned", "created_at": "…" }
]
```

Opening by the owner marks the report as seen (clears `has_update`). Who made each change is not included here.

| Status | When |
|---|---|
| `404` | `Report not found`: unknown or malformed id, **or** someone else's report (so ids can't be probed) |

---

## Admin reports (`/api/admin/reports`)

All endpoints: auth **admin**.

### `GET /api/admin/reports`

Query:

| Param | Rule |
|---|---|
| `page`, `limit` | Pagination |
| `status` | status |
| `category` | category |
| `from`, `to` | `YYYY-MM-DD`, calendar days in Asia/Jakarta; `to` inclusive and not before `from` |
| `q` | max 100 chars; case-insensitive search in `description` and `address` (`%` and `_` match literally) |
| `needs_review` | `true` / `false` (`true` = only reports that need review) |
| `duplicate` | `true` / `false` (`true` = only reports linked as a possible duplicate) |

`200 { "reports": [Report + reporter_name + reporter_email], "pagination": {…} }`, newest first.

### `GET /api/admin/reports/:id`

`200 { "report": … }`: the [Report](#report-object) plus `reporter_name`, `reporter_email`, the full
`status_history` (each entry also has `changed_by` and `changed_by_name`), and `possible_duplicates`:
`[{ "id", "status", "created_at" }]`, the later reports linked to this one. `404 Report not found` for an unknown or
malformed id.

### `PATCH /api/admin/reports/:id`

JSON body, at least one of:

| Field | Rule |
|---|---|
| `status` | status, only an allowed transition (below) |
| `category` | category: corrects the AI; `ai_predicted_category` is kept |
| `admin_note` | 1–1000 chars; **required when `status` is `rejected`** |

Allowed transitions: `pending → in_progress | rejected`, `in_progress → completed | rejected`. `completed` and
`rejected` are final: nothing about the report can change any more. A status change writes a
`report_status_history` row (`changed_by` = this admin, `note` = `admin_note`) in the same transaction. Category or
note changes without a status change are allowed on `pending` and `in_progress` reports.

`200 { "report": … }` (same shape as the detail).

| Status | When |
|---|---|
| `400` | `Provide at least one of: status, category, admin_note`, `A note is required when rejecting a report`, or invalid values |
| `404` | `Report not found` |
| `409` | `Cannot change status from pending to completed` with detail `{ "field": "status", "message": "Allowed: in_progress, rejected" }` (also for the same status), or `Report is completed and can no longer be changed` |

---

## Admin users (`/api/admin/users`)

All endpoints: auth **admin**.

### `GET /api/admin/users`

Query: `page`, `limit`, `role` (`admin` / `user`), `is_active` (`true` / `false`), `q` (max 100 chars, searches
name and email).

`200 { "users": [User + report_count], "pagination": {…} }`, newest first.

### `PATCH /api/admin/users/:id`

Body: `{ "is_active": boolean }` (a JSON boolean).

`200 { "user": User + report_count }`. A deactivated user's token stops working immediately.

| Status | When |
|---|---|
| `400` | `is_active must be true or false`, or `You cannot deactivate your own account` |
| `404` | `User not found` (unknown or malformed id) |

---

## Admin stats (`/api/admin/stats`)

### `GET /api/admin/stats`

Auth: **admin**.

```json
{
  "totals": {
    "reports": 12,
    "by_status": { "pending": 5, "in_progress": 3, "completed": 3, "rejected": 1 },
    "by_category": { "organic": 4, "paper": 3, "plastic": 5 }
  },
  "reports_per_day": [{ "date": "2026-10-08", "count": 0, "completed_count": 0 }],
  "ai_accuracy": { "reviewed": 6, "matching": 5, "accuracy": 0.8333 },
  "ai_flow": [{ "ai_category": "organic", "category": "organic", "count": 4 }],
  "needs_review": { "count": 2, "threshold": 0.7 }
}
```

- `reports_per_day`: the last 30 days including today (Asia/Jakarta), oldest first; `completed_count` = reports
  whose status became `completed` that day.
- `ai_accuracy`: over `in_progress` / `completed` reports with an AI prediction; `matching` = category still equals
  the AI's; `accuracy` is `null` when `reviewed` is 0.
- `ai_flow`: always all 9 (AI category → current category) pairs, with `count: 0` when none.
- `needs_review`: how many reports need review now, and the threshold in use.

---

## ML API

FastAPI service ([`ml/src/api/main.py`](../ml/src/api/main.py)). Same error format as the backend
(`{ "error": { "message", "details" } }`). More detail: [`ml/README.md`](../ml/README.md#endpoints).

| Auth label | Meaning |
|---|---|
| X-API-Key | When `ML_API_KEY` is set (production), the request needs header `X-API-Key: <key>`, compared in constant time and checked before the body is read. Unset (local default): no key |

### `GET /health`

Auth: none.

```json
{ "status": "ok", "model_loaded": true, "model_version": "swms_mobilenetv2_option_b", "runtime": "lite" }
```

`runtime` is `lite` (ONNX Runtime, production) or `tf` (TensorFlow, the local default).

### `POST /predict`

Auth: **X-API-Key** (when configured).

`multipart/form-data` with one field `file`: JPEG, PNG or WebP, max **5 MB**, max **24 million pixels** (about
6000 × 4000). The type is checked by decoding, not from the file name.

```json
{
  "category": "plastic",
  "confidence": 0.9999,
  "probabilities": { "organic": 0.0, "paper": 0.0001, "plastic": 0.9999 },
  "model_version": "swms_mobilenetv2_option_b"
}
```

`confidence` is the probability of `category`; values are rounded to 4 decimals.

| Status | When |
|---|---|
| `400` | No `file` field (`Validation failed` with a `file` detail), empty file, corrupt / truncated image, or dimensions too large (checked from the header before decoding) |
| `401` | `X-API-Key` missing or wrong (when `ML_API_KEY` is set) |
| `413` | Body over 5 MB (refused from `Content-Length` before reading; chunked uploads are cut off at the limit) |
| `415` | Not a JPEG, PNG or WebP |
| `404` / `405` | Unknown route or wrong method |
| `500` | Unexpected error (no internal details) |

`/docs`, `/redoc` and `/openapi.json` (FastAPI's generated docs) exist locally and are removed in production with
`ML_DISABLE_DOCS=1`.

**How the backend maps ML errors:** ML `400` / `413` / `415` → backend `422` on the `image` field; anything else
(down, timeout after `ML_API_TIMEOUT_MS`, `5xx`, an invalid answer) → backend `503`. The ML API's own error text
is never passed on.
