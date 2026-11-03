# SWMS Backend — Express API

Express 5 (CommonJS) API for the Smart Waste Management System, using PostgreSQL (Neon) with raw
parameterized SQL. Waste report photos are classified by the ML API in [`../ml`](../ml).

## Setup

Requires Node.js 22+. From `backend/`:

```bash
npm ci
cp .env.example .env   # then fill in the real values (never commit .env)
```

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (loads `.env`) |
| `npm start` | Start (env comes from the environment, e.g. Docker) |
| `npm test` | Run all tests (loads `.env`; needs the database) |
| `npm run db:check` | Check the database connection and tables |

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

### Images

Images are stored locally in `backend/uploads/` (gitignored) and served at `/uploads/<uuid>.<ext>`.
All file access goes through `src/modules/uploads/uploads.service.js`, so it can be swapped for
cloud storage later.

## Tests

`npm test` uses Node's built-in test runner against the real database: tests create temporary
users and reports and delete them afterwards. **No ML server is needed** — the tests start a fake
ML API (`tests/helpers/fake-ml-api.js`) to cover success, ML errors, invalid responses, timeouts
and the ML API being down.
