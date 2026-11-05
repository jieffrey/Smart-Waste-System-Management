# SWMS deploy plan

**Status: proposal, waiting for approval.** Nothing in this document has been built, created or deployed
yet. No code was changed on this branch. Every code change listed here is a later step, done only after
approval and on its own branch.

Targets: **ML API** on Hugging Face Spaces (Docker), **backend** (Express) on a free/cheap host, **web**
(Next.js) on Vercel, **database** on Neon, **mobile** as an Android APK from EAS Build.

Provider limits below were checked on 2026-11-05 against the providers' own docs where possible (sources at
the end). Free tiers change often, so each one is marked *verify at sign-up* and should be re-checked in the
dashboard before relying on it.

> **Decision needed before step 3: Hugging Face Docker Spaces are no longer free.** Hugging Face's
> Spaces docs now say Gradio and Docker Spaces "require a paid plan to create" (PRO for a personal account),
> and forum threads from mid-2026 report the CLI refusing Docker Spaces on free CPU Basic. Options are in
> [section 3.1](#31-blocker-docker-spaces-now-need-a-paid-plan). My recommendation: **HF PRO for the review
> period**, which keeps the planned architecture unchanged.

---

## 0. Current state (what the survey found)

| Area | Today | What matters for deploy |
|---|---|---|
| Photo storage | `backend/src/modules/uploads/uploads.service.js` writes `backend/uploads/<uuid>.<ext>` and serves it at `/uploads`. Already the only file that touches storage ("so local storage can later be swapped"). | Free hosts have an ephemeral disk: photos would disappear on every restart, redeploy or (on Render Free) spin-down. |
| Upload checks | `middlewares/upload.js`: multer memory storage, 5 MB, 1 file, field/part limits (SEC-08); type from magic bytes (JPEG/PNG/WebP) in `detectImageType`. | Keep as is. |
| EXIF | Stored byte-for-byte, so GPS EXIF is kept (audit **SEC-06**, open). The mobile app re-encodes to JPEG (≤1600 px, `prepare-image.ts`), but the backend must not rely on the client. | Fix as part of the storage work. |
| Report creation | `reports.service.js`: classify → `saveImage` → transaction (insert report + history) → on error `ROLLBACK` + `deleteImage`. | This order is already exactly what the Cloudinary flow needs. |
| ML call | `ml.service.js`: `POST {ML_API_URL}/predict`, sends `X-API-Key` if `ML_API_KEY` is set, timeout `ML_API_TIMEOUT_MS` (30 s). 503 on failure, 422 when the image is rejected. | The ML API **doesn't check** the key yet (SEC-09, open); `/docs` is public. |
| Proxy / rate limits | `TRUST_PROXY` (number of hops) → `app.set('trust proxy', n)`. In-memory fixed-window limiters (login per IP and per email, register per IP, reports per user). | Fine on a single instance; counters reset on restart. See [2.3](#23-trust_proxy-and-the-rate-limiters-behind-the-proxy). |
| CORS | Only if `WEB_ORIGIN` is set. | The web app calls the backend **only from the Next.js server** (`lib/api.ts` is `server-only`), so production needs **no CORS**. |
| Web session | httpOnly cookie, `secure: NODE_ENV === "production"`, `sameSite: lax`. | Vercel sets `NODE_ENV=production`, so `Secure` is on over HTTPS automatically. |
| Image URLs | Web `lib/image.ts` `buildImageUrl` and mobile `utils/image-url.ts` `resolveImageUrl` both use absolute `http(s)://` URLs as is and prefix relative ones with the API URL. Web uses plain `<img>` (no `next/image`). | **No change needed** for Cloudinary URLs. |
| Mobile | `EXPO_PUBLIC_API_URL` built in; request timeout 45 s ("longer than the backend's 30 s ML timeout"). `app.json` has **no `android.package`** and there is **no `eas.json`**. | Both needed for EAS. The timeout must stay above the backend's ML timeout. |
| Database | `backend/db/schema.sql`: one transaction, for a **new, empty** database (plain `CREATE`, no `IF NOT EXISTS`). Dev DB is Neon in `ap-southeast-1` (Singapore). | Production gets its own empty database. |
| Scripts | `seed.js` = local dev only, **public demo credentials** (SEC-01). `set-admin-password.js` = hidden prompt, admin accounts only. | Never run the dev seed against production with defaults. |
| Tests | `npm test` uses `DATABASE_URL` and **deletes rows** (users/reports it created). | Never run the backend tests against production. |
| ML model | `ml/models/swms_mobilenetv2_best.keras`, 9,667,404 bytes. | Under 10 MB, but it is binary: track it with Git LFS/Xet in the Space repo. |

---

## 1. Photo storage

### 1.1 Storage abstraction with an env switch

Keep `uploads.service.js` as the single entry point and give it two small drivers, chosen by
`STORAGE_DRIVER`:

```
backend/src/modules/uploads/
  uploads.service.js      detectImageType, sanitizeImage, saveImage, deleteImage, serveImages (picks the driver)
  storage.local.js        today's code: write to backend/uploads, URL "/uploads/<uuid>.<ext>"
  storage.cloudinary.js   upload buffer → secure_url; destroy by public_id
```

- **Same interface for both:** `saveImage(buffer, extension) → imageUrl` and `deleteImage(imageUrl)`.
  `reports.service.js` doesn't change.
- **`STORAGE_DRIVER=local`** (default, dev and tests): exactly today's behaviour, `/uploads` stays mounted.
- **`STORAGE_DRIVER=cloudinary`** (production): `/uploads` is **not mounted** (nothing to serve). Startup fails
  fast if `CLOUDINARY_URL` is missing, like `DATABASE_URL` and `JWT_SECRET` do today. With
  `NODE_ENV=production` and the local driver, log a warning ("photos will be lost on restart").
- **Cloudinary upload:** official `cloudinary` Node SDK (it reads `CLOUDINARY_URL` itself), `upload_stream`
  from the in-memory buffer with:
  - `public_id: <uuid>`, `folder: CLOUDINARY_FOLDER` (e.g. `swms/prod`), `resource_type: "image"`,
    `type: "upload"`, `overwrite: false`, `unique_filename: false`
  - stored value: `secure_url` (always `https://res.cloudinary.com/...`) in `waste_reports.image_url`
    (already `text`, so **no schema change**)
- **Delete:** `public_id` is derived back from the stored URL (`<folder>/<uuid>`), so no extra column is
  needed. `uploader.destroy(publicId, { invalidate: true })`. Like the local driver, it ignores "not found", and
  it is only used for URLs under our own folder.
- **Privacy note:** delivery URLs are public but unguessable (random UUID), the same exposure as today's
  `/uploads/<uuid>.jpg`. Cloudinary "authenticated" delivery would need signed URLs in both apps; not proposed.

### 1.2 Order of operations in `createReport` (unchanged shape)

1. multer limits (5 MB, 1 file, field limits) → `detectImageType` (magic bytes) → 413/400/415 as today.
2. **ML check** on the original buffer (keeps API/Colab parity) → 503/422 as today. **Nothing stored yet.**
3. **`sanitizeImage`** (new, both drivers): `sharp(buffer).rotate()` applies the EXIF orientation, then
   re-encodes in the same format with **no metadata** (sharp drops EXIF/GPS/XMP unless `withMetadata()` is
   used). This fixes **SEC-06** for local and cloud storage alike. If sharp can't decode the image, return 422
   with the same "photo couldn't be processed" message.
4. **Upload** → `secure_url`. Upload failure → 503 "Storage unavailable, try again", nothing in the DB.
5. **DB transaction** (report + first history row). On any error: `ROLLBACK`, then **delete the Cloudinary
   asset**, then rethrow (today's `catch` already does this via `deleteImage`). A failed delete is logged with
   the public_id, never thrown over the original error.

Known gap, accepted: if the process dies between steps 4 and 5, one orphaned asset remains. It is rare and
cheap; it can be cleaned up by hand in the Cloudinary media library (folder `swms/prod`).

### 1.3 Tests (when implemented)

- Existing tests keep using `STORAGE_DRIVER=local`.
- New unit tests for the Cloudinary driver with the SDK stubbed: upload is called after the ML check, `destroy`
  is called when the insert fails, the stored URL is `secure_url`.
- A sanitize test: a JPEG with GPS EXIF comes out with no EXIF and the right orientation.

### 1.4 Web and mobile image URL helpers

**No change needed.** Both helpers already pass `https://…` URLs through untouched:
- web `buildImageUrl` ("absolute or relative to the API") and mobile `resolveImageUrl` ("an absolute URL (e.g.
  from cloud storage later) is used as is").
- Web uses plain `<img>`, so no `next/image` `remotePatterns` are needed. If `next/image` is adopted later, add
  `{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/<cloud-name>/**" }`.
- If a Content-Security-Policy is added later (SEC-07), `img-src` must include `https://res.cloudinary.com`.
- The production database starts empty, so there are no old relative `/uploads/...` URLs to migrate. Dev keeps
  relative URLs with the local driver.

**Cloudinary free plan** (*verify at sign-up*): 25 credits per rolling 30 days, covering storage, bandwidth and
transformations; no card needed. About 60 demo photos plus reviewer uploads use a tiny fraction of that.
Reported (not confirmed officially): going over the credits suspends delivery rather than billing.

---

## 2. Backend host

### 2.1 Comparison

| | **Render** (Free web service) | **Railway** (Hobby) | **Fly.io** (pay as you go) |
|---|---|---|---|
| Cost | $0 | 30-day trial with $5 credit, then **Hobby: $5/month minimum** usage | No free tier for new orgs; short trial, then usage billing (card required) |
| Free limits | 750 instance hours/month per workspace (enough for one service 24/7); ephemeral disk, no persistent disk | Usage-based within the plan | Small shared VMs, per-second billing |
| Sleeping / cold start | **Spins down after 15 min without inbound traffic**; wake-up takes **up to ~1 min** | Doesn't sleep by default (optional "serverless" sleeping) | Optional auto-stop/auto-start; restart in seconds |
| Node / Bun | Native Node runtime (pin with `engines`/`.node-version`); Bun via build command or Docker | Node and Bun auto-detected (Railpack), or Docker | Docker/`fly launch`; any runtime |
| Env vars | Dashboard / blueprint; secret files | Dashboard, shared variables | `fly secrets set` |
| Logs | Live logs in dashboard (short retention on Free) | Live + searchable logs | `fly logs`, dashboard |
| Region near Indonesia / Neon `ap-southeast-1` | **Singapore** offered for web services (*verify in the region dropdown*; search didn't confirm it for Free) | Southeast Asia (Singapore) region (*verify which regions Hobby gets*) | `sin` (Singapore) |
| Proxy in front | Yes (Render load balancer) | Yes (Railway edge) | Yes (Fly proxy) |

### 2.2 Recommendation: **Render Free, Singapore**

- **$0 and no card**, enough for an assessment demo.
- **Singapore** sits next to Neon `ap-southeast-1`, so the DB round trip stays small (each request makes
  several queries).
- **Plain `npm start`** works as is.
- **The ephemeral disk doesn't matter** once photos go to Cloudinary ([section 1](#1-photo-storage)).
- **The one real cost is the 15-minute spin-down.** It's handled by the warm-up plan in
  [3.5](#35-cold-starts-timeout-warm-up-pinging). If that's unacceptable during the review week, switching to
  **Railway Hobby (~$5/month, no sleeping)** is the same deploy with different env settings.
- **Single instance:** the in-memory rate limiters are correct on one instance (stated in `rate-limit.js`).
  Their counters reset on each spin-down/redeploy, which is acceptable here.

Render service settings (later):
- **Root directory** `backend`, **build** `npm ci`, **start** `npm start`, **health check path** `/api/health`.
- **Node version:** add `"engines": { "node": ">=22.9" }` to `backend/package.json`. The scripts use
  `--env-file-if-exists` and the global `fetch`/`FormData`/`Blob`.
- **Native dependency:** `sharp` ships prebuilt Linux binaries, so it needs no extra build step.

### 2.3 TRUST_PROXY and the rate limiters behind the proxy

`req.ip` drives the per-IP limiters (`login-ip`, `register-ip`). Behind a proxy:
- **`TRUST_PROXY=0` (unset):** `req.ip` is the proxy's address. **All clients share one bucket**, so 20 failed
  logins from anyone lock everyone out for 15 minutes.
- **Too high:** Express takes an address further left in `X-Forwarded-For`, which the client controls. **The
  limiter can be bypassed** by sending a fake header.
- **Correct:** the number of proxies Render puts in front. Start with **`TRUST_PROXY=1`** (one Render proxy, which
  appends the real client IP).

Because the hop count isn't documented clearly, **verify it by behaviour** after the first deploy, with no code
change:
1. **Not shared:** from a laptop, 21 failed logins with **different made-up emails** (so the per-email limiter
   doesn't fire) → the 21st gets **429**. Right after, one failed login from a phone on mobile data → **401, not
   429**. That proves clients aren't sharing a bucket.
2. **Not spoofable:** repeat step 1 from the laptop, but each request sends a different
   `X-Forwarded-For: 203.0.113.<n>` → the 21st must still be **429**. If it isn't, `TRUST_PROXY` is too high.

**Web admin login caveat:** the admin web app logs in **from the Vercel server** (Server Action), so the backend
sees a Vercel egress IP, not the admin's. Effects:
- **Per-IP login limit:** shared by everyone using the web login (all through Vercel IPs). A stranger failing 20
  logins on the web form could block web logins for 15 minutes.
- **Per-email limit:** still per account, as designed.

For an assessment with one or two admins this is **acceptable and documented**. The proper fix would be for
Next.js to forward the client IP with a shared-secret header that the backend trusts; that is a separate
decision, not part of this plan.

---

## 3. ML API on Hugging Face Spaces

### 3.1 Blocker: Docker Spaces now need a paid plan

According to the Hugging Face Spaces docs, Gradio and Docker Spaces need a paid plan to create (PRO for
personal accounts). Free accounts keep static Spaces and up to 2 ZeroGPU Gradio Spaces.

| Option | Cost | Change to the plan | Notes |
|---|---|---|---|
| **A. HF PRO** (recommended) | PRO subscription (*check the price on hf.co/pricing*), cancel after review | None: Docker Space on CPU Basic (2 vCPU, 16 GB RAM) | Keeps the stated target. TF + MobileNetV2 fits easily. |
| B. Add billing credits on HF | Pay per use | None | Forum reports say adding billing unlocks Docker Spaces; *verify*. |
| C. Second Render Free service for the ML API | $0 | Same Dockerfile, different host | **Risk:** Render Free has little RAM (512 MB class); TensorFlow + model may not fit, and it would also spin down after 15 min. Would need a memory test first. |
| D. Railway Hobby for backend **and** ML | ~$5/month minimum plus usage | Both services on Railway, no sleeping | Simplest operationally; ML RAM use drives the cost. |

The rest of this section assumes **A** (or B). The Dockerfile is the same for C and D, apart from the port.

### 3.2 Space layout

The Space is a **separate git repo** on huggingface.co. Push only what the API needs, built from `ml/`:

```
README.md          Space config (YAML front matter) + short description
Dockerfile
requirements.txt   = ml/requirements.txt (runtime only, Python 3.12, TF 2.21.0, Keras 3.13.2)
src/api/  src/inference/
models/swms_mobilenetv2_best.keras   (tracked with Git LFS/Xet)
```

`README.md` front matter:

```yaml
---
title: SWMS Waste Classifier
sdk: docker
app_port: 7860
pinned: false
---
```

`Dockerfile` (later, committed as `ml/Dockerfile` so the repo stays the source of truth):

```dockerfile
FROM python:3.12-slim
# Spaces run the container as user 1000
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH" PYTHONUNBUFFERED=1 TF_CPP_MIN_LOG_LEVEL=2
WORKDIR /home/user/app
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=user src ./src
COPY --chown=user models ./models
EXPOSE 7860
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

- **Port:** 7860 (the Spaces default). `app_port` must match the `--port`. The app must bind `0.0.0.0` (the
  README's local command binds `127.0.0.1`).
- **Model size / LFS:** 9.7 MB, under the 10 MB limit for plain git files on the Hub. The Hub still expects binary
  files via **LFS/Xet**, so: `git lfs install && git lfs track "*.keras"` in the Space repo before adding the model.
  If Option B is promoted later, check its size again: a `.keras` checkpoint saved while compiled includes the
  optimizer state, and Adam for 1.66 M trainable weights adds about 13 MB. Re-save with
  `load_model(..., compile=False)` → `save()` to drop it.
- **Deploy script (later):** `ml/scripts/sync-space.sh` copies those paths into a local clone of the Space repo and
  pushes. Keeps GitHub as the source of truth.

### 3.3 API key between backend and ML (fixes SEC-09)

- **ML side (code change, later):**
  - `ML_API_KEY` env var. When it's set, `/predict` requires header `X-API-Key` and compares it in constant time
    (`hmac.compare_digest`); wrong or missing key → **401** in the existing error format.
  - When it's unset (local dev, tests), there's no check, as today.
  - `/health` stays open: it's used for warm-up and returns only `status`/`model_loaded`/`model_version`.
  - `ML_DISABLE_DOCS=1` → `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)`.
- **Backend side:** already done. `ml.service.js` sends `X-API-Key` when `ML_API_KEY` is set, and a 401 is treated
  as "our fault" → 503 (it isn't one of the 400/413/415 image errors).
- **Where it's set:** a Space **secret** (`ML_API_KEY`), and the same value in Render's env. Generate it with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- **The Space stays public** (a private Space would need an HF token in an `Authorization` header, which is a
  different code change). The key protects `/predict`; the code itself is in a public repo anyway.

### 3.4 Smoke test

```bash
curl https://<user>-swms-classifier.hf.space/health
curl -F "file=@ml/tests/samples/plastic_101.jpg" https://<user>-swms-classifier.hf.space/predict              # → 401
curl -H "X-API-Key: $ML_API_KEY" -F "file=@ml/tests/samples/plastic_101.jpg" https://<…>.hf.space/predict  # → plastic ≈ 0.998
```

The probabilities must match `tests/samples/expected.json` within ±0.01, the same check as the parity test.

### 3.5 Cold starts: timeout, warm-up, pinging

There are three sleepers in the chain:

| Service | Sleeps after | Wake-up |
|---|---|---|
| Render Free | 15 min without traffic | up to ~1 min |
| HF Space, CPU Basic | **48 h** unused (free hardware) | container start + TensorFlow import + model load, roughly 30–90 s (*measure it*) |
| Neon Free | 5 min idle | usually under a second; the pool already allows 10 s (`connectionTimeoutMillis`) |

The worst case is a reviewer's first photo after two quiet days: backend wake-up, then an ML wake-up inside the
request.

Proposal:
1. **Backend ML timeout:** `ML_API_TIMEOUT_MS=90000` in production (env only; default stays 30 s).
2. **Mobile timeout must stay longer than that.** It is 45 s today, built on the 30 s assumption. Raise
   `REQUEST_TIMEOUT_MS` to **120 s for the report upload request only**; other requests keep 45 s. Small mobile
   change, later.
3. **Warm-up (code change, later):**
   - **Backend start:** a fire-and-forget `GET {ML_API_URL}/health` when the backend starts, so a Render wake-up
     also wakes the Space.
   - **Mobile:** when the "Lapor" (new report) screen opens, call `GET /api/health`; that wakes Render, and Render
     then wakes the Space. While the user takes the photo, both wake up.
   - The backend's own `/api/health` stays fast and DB-free, as now.
4. **Errors stay honest:** a sleeping Space can answer 503 while it boots. The backend already maps that to 503
   "AI service unavailable, please try again later", and nothing is saved, so retrying is safe.
5. **Periodic ping: not needed, and not proposed for the Space.**
   - The Space's 48 h window means it only sleeps after two quiet days.
   - Pinging only to defeat a provider's free-tier sleep goes against the intent of the free tier.
   - Instead: **warm up by hand before submitting** (open the web dashboard and do one test report), and put
     one line in the README: *"The first request after a quiet period can take up to ~2 minutes while the free
     servers wake up."*
   - For Render, an uptime monitor hitting `/api/health` every 10 min would stay within 750 h/month. Only use one
     during the review window if Render's current terms allow it (*check*); otherwise Railway Hobby avoids the
     issue.

---

## 4. Database (Neon)

### 4.1 Separate production database: **yes**

Keeping dev and production apart:
- stops test data and demo data from mixing,
- means the public **dev** demo credentials (SEC-01) never exist in production,
- keeps backend test runs (which insert and delete rows) away from the demo data.

**Recommended: a new Neon project `swms-prod` in `ap-southeast-1`** (Free plan: up to 100 projects, with 0.5 GB
storage and 100 CU-hours per project per month, according to Neon's FAQ; *verify*).
- Its own credentials and its own compute quota, independent of dev usage.
- A *branch* of the dev project would start as a **copy of the dev data** (test users and demo accounts) and share
  the project's settings, which is what we want to avoid.

Two roles help but are optional on Free:
- `swms_app`: used by the backend (`DATABASE_URL`, **pooled** `-pooler` host).
- The owner role: used only for migrations, over the **direct** (non-pooler) host.

### 4.2 Migration steps

1. **Create the project** `swms-prod` in AWS `ap-southeast-1` (Postgres 18, like dev). Copy **both** connection
   strings (pooled and direct).
2. **Apply the schema** with the direct URL (`schema.sql` is one transaction; it fails cleanly on a non-empty DB):
   ```bash
   psql "<direct prod url>" -v ON_ERROR_STOP=1 -f backend/db/schema.sql
   ```
   Without local `psql`: paste the file into Neon's **SQL Editor** for the prod project and run it.
3. **Check it:** `\dt` shows `users`, `waste_reports`, `report_status_history`. Then run `npm run db:check`
   with the prod env file (below), using the pooled URL.
4. **Future schema changes** go in as numbered files `backend/db/migrations/NNN_*.sql`, applied by hand with
   `psql` in a transaction and run on dev first. No migration tool is needed at this size.

### 4.3 Running scripts against production safely

- Put the prod values in **`backend/.env.production`**. It's already ignored by the root `.gitignore`
  (`.env.*`). It holds `DATABASE_URL` (prod, pooled) plus only what the script needs.
- Run scripts **explicitly with that file**, never via `npm run …`. The npm scripts load `backend/.env`, which is
  dev:
  ```bash
  cd backend
  node --env-file=.env.production scripts/db-check.js
  node --env-file=.env.production scripts/set-admin-password.js     # hidden prompt
  ```
- **Never** `npm test` against prod (the tests delete rows). **Never** run the dev `seed.js` against prod with
  its defaults (public passwords).

**Creating the first production admin** (there's no "create admin" script; `set-admin-password` only changes
an existing admin):
1. Run the existing seed once against prod with **overrides**:
   - `SEED_ADMIN_NAME`/`EMAIL`: the real admin.
   - `SEED_ADMIN_PASSWORD`: a random throwaway.
   - `SEED_USER_*`: a real resident account.
   Put them in `.env.production` temporarily, not on the command line:
   `node --env-file=.env.production scripts/seed.js`.
2. Immediately run `node --env-file=.env.production scripts/set-admin-password.js` and set the real password
   at the hidden prompt.
3. Remove the `SEED_*` lines from `.env.production`.
4. Check: logging in with `Admin123!` → 401; with the new password → OK.

---

## 5. Web on Vercel

- **Project:** import the GitHub repo, **Root Directory `web`**, framework Next.js (auto), build `next build`.
- **Function region: `sin1` (Singapore)**, in Project → Settings → Functions. Every page render calls the
  backend server-side; a US region would add a Pacific round trip to each call.
- **Env vars:**
  - `NEXT_PUBLIC_API_URL=https://<backend>.onrender.com`, no trailing slash (the code strips it anyway).
  - It's **inlined at build time**: after changing it, **redeploy**.
  - It's public by design (it's only the API base URL).
- **Cookie `Secure`:**
  - `setSession` uses `secure: process.env.NODE_ENV === "production"`. Vercel builds and runs with
    `NODE_ENV=production`, and `*.vercel.app` is HTTPS-only, so the cookie is **httpOnly + Secure +
    SameSite=Lax**.
  - Check in the browser's DevTools → Application → Cookies after logging in.
  - Preview deployments are also HTTPS, so the flag is on there too.
- **CORS:** leave the backend's `WEB_ORIGIN` **empty**. The browser never calls the backend directly. Admin
  data goes Vercel server → backend, and images load straight from Cloudinary (no CORS needed for `<img>`).
- **Image domains:** none needed (plain `<img>`, see [1.4](#14-web-and-mobile-image-url-helpers)).
- **Proxy:** `src/proxy.ts` (Next 16 "proxy", formerly middleware) runs on Vercel unchanged.
- **Preview deployments:** they point at the same production backend. Either disable them for `main`-only
  deploys, or accept that previews show production data (admin login required either way).

---

## 6. Mobile: Android APK via EAS Build

### 6.1 Changes needed (later)

- **`app.json`:**
  - Add `"android": { "package": "com.jieffrey.swms", "versionCode": 1 }`. A package name is required for any
    Android build, and it's permanent for that app.
  - Optionally set `"slug": "swms"`; today it's `"Mobile"`. Decide before `eas init`, which links the slug to
    the EAS project.
- **`eas init`:** adds `extra.eas.projectId` and `owner` to `app.json`. Needs a free Expo account.
- **`eas.json`:**

```json
{
  "cli": { "appVersionSource": "local" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://<backend>.onrender.com" }
    }
  }
}
```

  `EXPO_PUBLIC_API_URL` isn't a secret (it ships inside the app), so `eas.json` is fine. EAS environment
  variables (`eas env:create --environment preview`) work too.
- **HTTPS:** the production URL is HTTPS, which also closes **SEC-12** (plain HTTP) for the release build.
  Android blocks cleartext by default in release builds, so a stray `http://` URL would fail visibly.
- **Upload timeout:** see [3.5](#35-cold-starts-timeout-warm-up-pinging), item 2.

### 6.2 Icon / splash check

| Asset | Found | Requirement | OK? |
|---|---|---|---|
| `icon.png` | 1024×1024 | 1024×1024 | ✓ |
| `android-icon-foreground.png` / `-background` / `-monochrome` | 1024×1024 each | 1024×1024, logo inside the central ~66% safe zone | Size ✓; **check the safe zone** on a round-mask launcher |
| `splash-icon.png` | 1024×1024, `imageWidth: 200`, background `#FBFBF8` | | ✓ |

These are the project's own icons (commit `d93c326`), not the Expo template. Final check: install the APK and
look at the launcher icon (round and squircle masks), the themed (monochrome) icon on Android 13+, and the
splash screen in light mode.

### 6.3 Build and install

```bash
cd Mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build -p android --profile preview
```

- EAS prints a **build page URL with a QR code** and an `.apk` download.
- **Reviewers install it:** open the link on an Android phone → download → allow "Install unknown apps" for the
  browser when asked → install → open *SWMS*.
- **README:** add an "Install the Android app" section with:
  - the **GitHub Release** link (see the next bullet),
  - a **QR code** image,
  - the demo resident login (shared in the submission notes, not committed),
  - the cold-start note.
- **Upload the APK to a GitHub Release** (`v1.0.0`) as well as EAS. EAS internal-distribution artifacts may expire
  on the free plan (*verify the retention*), and a Release link is permanent.

---

## 7. Production demo data

A **new script `backend/scripts/seed-demo.js`**, separate from the dev `seed.js`, plus data files in
`backend/scripts/demo/`.

### 7.1 Content (~48 reports)

| | Plan |
|---|---|
| Residents | 5 accounts with fixed emails `@demo.swms.id`-style (*final domain to choose; must not be a real mailbox*), Indonesian names. One of them is the reviewer login. Passwords come from `DEMO_RESIDENT_PASSWORD` in `.env.production`, never committed. |
| Photos | 48 images from the ML **test split** (never seen in training): ~16 per class, resized to ≤1024 px and stripped of EXIF. They include a few that the model **gets wrong** (from the misclassified list), so admin corrections are real corrections. |
| Categories | All 3. `ai_predicted_category` / `ai_confidence` / `ai_model_version` come from **calling the real ML API** once per photo during seeding, so the AI fields are honest. `category` = AI prediction, or the admin's correction. |
| Statuses | ~14 `pending`, ~12 `in_progress`, ~15 `completed`, ~7 `rejected`. History rows follow the allowed transitions (`pending→in_progress→completed`, `pending→rejected`, `in_progress→rejected`). |
| Corrections | ~6 reports where the admin changed the category (mostly where the AI was wrong), each with an `admin_note`. Notes on rejected reports explain why ("Lokasi di luar wilayah layanan", "Foto bukan sampah"). |
| Dates | `created_at` spread over the **last 30 days** (`days_ago` + hour per item, Asia/Jakarta). Status changes follow hours to days later; `updated_at` = last change. |
| Places | Realistic coordinates and addresses in one city (e.g. Jakarta Selatan neighbourhoods), with small random-looking but **fixed** offsets. |

The data lives in `backend/scripts/demo/manifest.json` (one entry per report: `key`, `photo`, `resident`,
`description`, `address`, `lat`/`lng`, `days_ago`, `status_path`, optional `correct_to`, `admin_note`).

**Photos:** commit the 48 resized images (about 4 MB) under `backend/scripts/demo/photos/`, **after checking the
Kaggle dataset licence** allows redistribution. If it doesn't, keep the folder gitignored and read it from
`DEMO_PHOTOS_DIR`.

### 7.2 Safe to re-run, never touches the admin

- **Deterministic ids:** each report's UUID is a v5 UUID of its manifest `key`; inserts use
  `ON CONFLICT (id) DO NOTHING`.
- **Deterministic image ids:** Cloudinary `public_id` = `swms/prod/demo/<key>` with `overwrite: false`. An asset
  that already exists is reused (looked up first), never duplicated.
- **Residents:** `ON CONFLICT` on the email, insert only. Existing residents keep their password.
- **The admin:**
  - is looked up **read-only** by `DEMO_ADMIN_EMAIL`, and only its `id` is used as `changed_by` in history rows;
  - the script **never runs an `UPDATE`/`INSERT` on any user with `role = 'admin'`**;
  - the script **refuses to start** if a resident email equals the admin email or if the admin isn't found.
- **One transaction per report** (report + its history rows). A failure leaves no half report, and the uploaded
  asset is kept for the next run (deterministic id).
- **Guard rails:**
  - `--dry-run` prints what would be created;
  - the script requires `--confirm <neon host>` matching the host in `DATABASE_URL`;
  - it never deletes anything.
- **Optional, later:** `--refresh-dates`, which shifts only demo reports' timestamps so they stay inside "the last
  30 days" if the demo runs much later.
- **Tests:** a test against the dev DB with the ML service and storage stubbed:
  - running it twice gives the same row counts;
  - the admin's `password_hash`/`updated_at` are unchanged;
  - every history path is a legal transition.

---

## 8. Environment variables and deploy order

### 8.1 Env vars per service

**Backend (Render → Environment)**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `NODE_ENV` | `production` | no | |
| `PORT` | *(set by Render)* | no | Don't set by hand |
| `DATABASE_URL` | `postgresql://swms_app:…@ep-…-pooler.ap-southeast-1.aws.neon.tech/swms?sslmode=require` | **yes** | Pooled host |
| `DB_POOL_MAX` | `5` | no | Small instance |
| `JWT_SECRET` | 96 hex chars | **yes** | New value, not the dev one |
| `JWT_EXPIRES_IN` | `24h` | no | |
| `ML_API_URL` | `https://<user>-swms-classifier.hf.space` | no | |
| `ML_API_KEY` | 64 hex chars | **yes** | Same as the Space secret |
| `ML_API_TIMEOUT_MS` | `90000` | no | Cold-start headroom |
| `TRUST_PROXY` | `1` | no | Verify with [2.3](#23-trust_proxy-and-the-rate-limiters-behind-the-proxy) |
| `WEB_ORIGIN` | *(empty)* | no | Web calls are server-side |
| `STORAGE_DRIVER` | `cloudinary` | no | *new* |
| `CLOUDINARY_URL` | `cloudinary://<key>:<secret>@<cloud>` | **yes** | *new* |
| `CLOUDINARY_FOLDER` | `swms/prod` | no | *new* |

**ML API (HF Space → Settings → Variables and secrets)**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `ML_API_KEY` | 64 hex chars | **yes** (Space secret) | *new check* |
| `ML_DISABLE_DOCS` | `1` | no | *new* |
| `MODEL_PATH` | *(unset)* | no | Default `models/swms_mobilenetv2_best.keras` |

**Web (Vercel → Settings → Environment Variables, Production)**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<backend>.onrender.com` | no (public) | Build time: redeploy after a change |

**Mobile (`eas.json` preview profile, or EAS env "preview")**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<backend>.onrender.com` | no (public) | Built into the APK |

**Local only (`backend/.env.production`, gitignored)**

| Name | Used by | Secret |
|---|---|---|
| `DATABASE_URL` (prod) | db-check, set-admin-password, seed (first admin), seed-demo | **yes** |
| `SEED_ADMIN_NAME` / `_EMAIL` / `_PASSWORD`, `SEED_USER_*` | first admin only, then removed | **yes** |
| `CLOUDINARY_URL`, `CLOUDINARY_FOLDER`, `ML_API_URL`, `ML_API_KEY` | seed-demo | **yes** (URL/key) |
| `DEMO_ADMIN_EMAIL`, `DEMO_RESIDENT_PASSWORD`, `DEMO_PHOTOS_DIR` (opt.) | seed-demo | password: **yes** |

### 8.2 Step-by-step deploy order, with a smoke test after each step

Before step 1, the code changes from sections 1, 3.3, 3.5, 6.1 and 7 are merged to `main`. Each change is its own
branch and PR, with tests: storage + sharp; ML key + Dockerfile; warm-up + timeouts; EAS config; seed-demo.

| # | Step | Smoke test |
|---|---|---|
| 1 | **Neon:** create `swms-prod` (Singapore), apply `schema.sql` | `\dt` shows 3 tables; `node --env-file=.env.production scripts/db-check.js` OK |
| 2 | **Cloudinary:** create account, note `CLOUDINARY_URL`, create folder `swms/prod` | Upload one test image from the dashboard and open its `https://res.cloudinary.com/...` URL; delete it |
| 3 | **ML Space:** create (PRO), set `ML_API_KEY` secret + `ML_DISABLE_DOCS=1`, push files with LFS | [3.4](#34-smoke-test): `/health` OK; `/predict` without key → 401; with key → `plastic ≈ 0.998`; `/docs` → 404. Note the cold-start time after "Restart Space" |
| 4 | **Backend on Render** (Singapore), all env vars from 8.1 | `GET /api/health` → `{status:"ok"}`; register a test resident; `POST /api/reports` with `plastic_101.jpg` → 201, `image_url` starts with `https://res.cloudinary.com/`, the photo opens and **has no EXIF** (check with an EXIF viewer); the ML key is wrong in Render → 503 (then fix it back); 6 MB file → 413; `.txt` renamed `.jpg` → 415; TRUST_PROXY checks from 2.3; delete the test report/user by SQL |
| 5 | **First admin** (4.3) | Login `Admin123!` → 401; real password → 200, role `admin` |
| 6 | **Web on Vercel** (`web`, region `sin1`) | Log in; cookie is `HttpOnly; Secure; SameSite=Lax`; dashboard, reports list and detail load; the photo from step 4 shows; status change + category correction work; logout |
| 7 | **Demo data:** `seed-demo.js --dry-run`, then real run, then **run it again** | Second run creates 0; dashboard shows ~48 reports over 30 days, all statuses/categories, AI-accuracy number < 100%; admin password still works |
| 8 | **Mobile APK** (`preview` profile) | Install on a real phone (mobile data, not Wi-Fi), log in as the demo resident, list shows their reports with photos, **take a new photo → AI result**, it appears in the web admin; kill the app → still logged in |
| 9 | **README:** live links (web, API health, APK/Release + QR), demo logins in submission notes, cold-start note | Open every link from a logged-out browser / another phone |

---

## 9. Risks, and what to check before submitting

### 9.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **HF Docker Spaces need a paid plan** | Step 3 blocked on a free account | Decide option A–D in [3.1](#31-blocker-docker-spaces-now-need-a-paid-plan) first |
| Cold-start chain (Render 15 min, Space 48 h) | A reviewer's first report waits 1–2 min, or the mobile app times out | Longer timeouts (90 s backend, 120 s upload in mobile), warm-up calls, README note, manual warm-up before submitting; Railway Hobby if that isn't acceptable |
| Free-tier terms change (Render, Neon, Cloudinary, EAS) | Unexpected sleep, limits or suspension | Re-check each dashboard at sign-up; nothing depends on more than a few hundred requests |
| `TRUST_PROXY` wrong | Shared lockout or spoofable limiter | Behavioural checks in 2.3 |
| Web admin logins share the Vercel IP's rate-limit bucket | A stranger can block web admin logins for 15 min | Accepted, documented; the IP-forwarding fix is a separate decision |
| In-memory rate limits reset on spin-down / redeploy | Limits are weaker than they look | Documented in `rate-limit.js`; fine for one instance |
| Dev demo credentials reach production (SEC-01) | Public admin password | Separate prod DB; first-admin procedure in 4.3; seed-demo never touches admins |
| Running `npm test` or the dev seed with the prod URL | Rows deleted / demo passwords | Scripts run only with `--env-file=.env.production` explicitly; never `npm run` against prod |
| Orphaned Cloudinary asset (crash between upload and insert) | A few unused files | Rare; manual cleanup in the media library |
| Photos are public by URL | Anyone with the link can view a photo | Same as today; UUID names; EXIF/GPS stripped |
| `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL` set at build time | A changed backend URL needs a web redeploy and a new APK | Pick the final Render URL (or custom domain) before building the APK |
| Dataset image licence | Committing demo photos may not be allowed | Check the Kaggle licence; fallback `DEMO_PHOTOS_DIR` |
| EAS artifact retention | APK link breaks later | Also attach the APK to a GitHub Release |
| Option B model promoted later | Bigger file (optimizer state), new `model_version` | Re-save without optimizer; update the Space; the parity test |

### 9.2 Pre-submission checklist (on the deployed system)

- [ ] Warm everything up the day of submission (open the web dashboard, make one report on the phone), then delete
      the test report.
- [ ] `GET <backend>/api/health` and `GET <space>/health` → OK; `<space>/docs` → 404; `/predict` without key → 401.
- [ ] Web: login with the real admin; `Admin123!` → 401; cookie `Secure` + `HttpOnly`; logout works; another
      browser without a session is sent to `/login`.
- [ ] Rate limits: the 21st failed login from one IP → 429 with `Retry-After`; another network is not blocked.
- [ ] Mobile APK on a clean phone: install from the README link, register a **new** account, report with camera +
      location, see the AI result, see it in the web admin, change its status there, see the timeline update in the
      app.
- [ ] Photos load from `res.cloudinary.com` in web and app; a downloaded photo has **no GPS EXIF**.
- [ ] Upload limits: 6 MB → 413, `.txt` as `.jpg` → 415, a non-waste photo still gets a category (known
      limitation) and the admin can correct it.
- [ ] Dashboard: numbers match the demo data (≈48 reports, all statuses and categories); AI accuracy reflects the
      corrections.
- [ ] Re-run `seed-demo.js` once more → creates nothing; admin password unchanged.
- [ ] No secrets in the repo: `git grep -n "neon.tech\|cloudinary://\|hf_"` finds only placeholders; `.env*` files
      are untracked.
- [ ] README: live URLs, APK link + QR, cold-start note, where the demo logins are (submission notes, not the repo).
- [ ] Logs in Render and the Space show no unexpected errors after the walkthrough.

---

## Decisions needed from you

1. **ML hosting** given the HF change: A (HF PRO, recommended), B (HF billing credits), C (Render, risky on RAM) or
   D (Railway for backend + ML).
2. **Backend host:** Render Free (recommended) or Railway Hobby (no sleeping, ~$5/month).
3. **Android package name** (`com.jieffrey.swms`?) and whether to rename the Expo slug from `Mobile` before
   `eas init`.
4. **Demo photos:** commit 48 resized test-split images (if the licence allows) or keep them local.
5. **Web admin login rate limit** behind Vercel: accept as documented (recommended for now), or add trusted client-IP
   forwarding later.

## Sources (checked 2026-11-05)

- Render free tier: <https://render.com/docs/free>
- Railway pricing: <https://railway.com/pricing>
- Fly.io free trial / cost management: <https://fly.io/docs/about/free-trial/>, <https://fly.io/docs/about/cost-management/>
- Hugging Face Spaces overview (paid plan for Docker/Gradio, hardware, sleep): <https://huggingface.co/docs/hub/en/spaces-overview>
- HF Space runtime (48 h sleep on free cpu-basic): <https://huggingface.co/docs/huggingface_hub/package_reference/space_runtime>
- HF forum, Docker SDK marked paid: <https://discuss.huggingface.co/t/docker-sdk-now-marked-as-paid-when-creating-a-new-space/177580>
- Neon free plan limits: <https://neon.com/faqs/free-plan-limits-and-quotas>
- Cloudinary plans and credits: <https://cloudinary.com/documentation/billing_and_plans>, <https://cloudinary.com/documentation/developer_onboarding_faq_credits>
