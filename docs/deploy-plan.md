# SWMS deploy plan

**Status: approved (revision 2, 2026-11-05).** Code changes are made on separate branches (A–E in
[section 10](#10-implementation-branches)). No accounts have been created and nothing has been deployed: those
steps are yours, in the order of [section 8.2](#82-step-by-step-deploy-order-with-a-smoke-test-after-each-step).

Targets: **backend** (Express) **and ML API** (FastAPI) as two services in one **Railway** project (Hobby plan,
Southeast Asia / Singapore), **web** (Next.js) on **Vercel**, **database** on **Neon**, **photos** on
**Cloudinary**, **mobile** as an Android APK from **EAS Build**. Railway is the only paid service.

Decisions in this revision:
1. **Hosting:** backend + ML both on Railway (existing Hobby subscription). No Render, no Hugging Face.
2. **Low usage:** the always-on ML service serves the model with a **lightweight runtime** instead of TensorFlow
   (training stays TensorFlow/Keras). Measured numbers are in [3.6](#36-measured-ram-image-size-and-monthly-estimate).
3. **Android:** package `com.jieffrey.swms`, Expo slug renamed to `swms` before `eas init`.
4. **Demo photos:** the Kaggle dataset is labelled **MIT**. 48 resized, EXIF-stripped test-split photos are
   committed under `backend/scripts/demo/photos/` with an `ATTRIBUTION.md`. `DEMO_PHOTOS_DIR` stays as an optional
   override.
5. **Web admin login rate limit:** the shared per-IP bucket behind Vercel is accepted and documented
   ([2.3](#23-trust_proxy-and-the-rate-limiters-behind-railways-edge)).

Provider facts were checked on 2026-11-05 against the providers' own docs where possible (sources at the end).
Pricing changes, so re-check numbers in the dashboards.

---

## 0. Current state (what the survey found)

| Area | Today | What matters for deploy |
|---|---|---|
| Photo storage | `backend/src/modules/uploads/uploads.service.js` writes `backend/uploads/<uuid>.<ext>` and serves it at `/uploads`. It is the only file that touches storage. | A Railway container's filesystem is wiped on every redeploy/restart (unless a volume is attached). Photos go to Cloudinary instead ([section 1](#1-photo-storage)). |
| Upload checks | `middlewares/upload.js`: multer memory storage, 5 MB, 1 file, field/part limits (SEC-08); type from magic bytes (JPEG/PNG/WebP). | Keep as is. |
| EXIF | Stored byte-for-byte, GPS EXIF kept (audit **SEC-06**, open). | Fixed by the sanitize step (branch B). |
| Report creation | classify → `saveImage` → transaction → on error `ROLLBACK` + `deleteImage`. | Already the order the Cloudinary flow needs. |
| ML call | `ml.service.js`: `POST {ML_API_URL}/predict`, sends `X-API-Key` when `ML_API_KEY` is set, timeout 30 s (hard-coded default, env override exists). | The ML API doesn't check the key yet (SEC-09); `/docs` is public. Fixed in branch A. |
| ML serving | `ml/src/inference/predictor.py` loads the `.keras` file with TensorFlow; resizing uses `tf.image.resize`. | TensorFlow alone is several hundred MB of RAM. Branch A adds a lite runtime. |
| Proxy / rate limits | `TRUST_PROXY` → `app.set('trust proxy', n)`; in-memory limiters. | Correct on one instance. See [2.3](#23-trust_proxy-and-the-rate-limiters-behind-railways-edge). |
| CORS | Only if `WEB_ORIGIN` is set. | The web app calls the backend only from the Next.js server, so production needs **no CORS**. |
| Web session | httpOnly cookie, `secure: NODE_ENV === "production"`, `sameSite: lax`. | Vercel sets `NODE_ENV=production`, so `Secure` is on. |
| Image URLs | Web `buildImageUrl` and mobile `resolveImageUrl` use absolute URLs as is. Web uses plain `<img>`. | **No change needed** for Cloudinary URLs. |
| Mobile | `EXPO_PUBLIC_API_URL` built in; request timeout 45 s. No `android.package`, no `eas.json`. | Branch D. |
| Database | `backend/db/schema.sql`: one transaction, for a new, empty database. Dev DB is Neon `ap-southeast-1`. | Production gets its own Neon project ([section 4](#4-database-neon)). |
| Scripts / tests | Dev `seed.js` has public demo credentials (SEC-01). `npm test` deletes the rows it creates. | Never run either against production with defaults. |

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

## 2. Railway project: backend + ML

### 2.1 Layout

One Railway **project** `swms`, one **environment** `production`, two **services** deployed from this GitHub repo
(monorepo, one root directory each):

```
Railway project "swms"  (region: Southeast Asia / Singapore for both services)
├── backend   root /backend   Railpack (Node)   public domain  → https://<backend>.up.railway.app
└── ml        root /ml        Dockerfile        NO public domain, private only: ml.railway.internal:8000
```

- **Why Singapore:** next to Neon `ap-southeast-1` (every backend request makes several queries) and close to
  Indonesian users.
- **Private networking:** services in the same project and environment reach each other at
  `<service>.railway.internal`. New environments (created after 2025-10-16) resolve that name to IPv4 and IPv6;
  older ones to IPv6 only. Railway recommends listening on `::` (dual stack), which the ML Dockerfile does. The ML
  service gets **no public domain**, so `/predict` isn't reachable from the internet at all. The API key stays as a
  second layer (SEC-09). Private networking isn't available during builds, which doesn't matter here.
- **No sleeping:** keep **Serverless (app sleeping) off** for both services. Railway doesn't stop them, so there are
  **no cold starts** and no warm-up pings are needed.
- **Volumes:** none. Photos live in Cloudinary, so both services are stateless.

### 2.2 Service settings

**`ml`** (`ml/railway.json` is committed with these settings; point *Settings → Config-as-code* to `/ml/railway.json`):

| Setting | Value |
|---|---|
| Source | GitHub repo, branch `main` |
| Root directory | `/ml` |
| Builder | Dockerfile (`ml/Dockerfile`, found automatically in the root directory) |
| Watch paths | `/ml/**` (a backend-only commit doesn't rebuild ML) |
| Region | Southeast Asia (Singapore) |
| Networking | **No** public domain. Private domain `ml.railway.internal` (the service name sets it) |
| Healthcheck path | `/health` |
| Restart policy | On failure |
| Replica limits (Settings → Deploy) | **Memory 1 GB, 1 vCPU.** Normal use is ~145 MB, but one maximum-size photo (24 MP) briefly peaks at 660 MB ([3.6](#36-measured-ram-image-size-and-monthly-estimate)) |
| Variables | see [8.1](#81-env-vars-per-service) (`PORT=8000`, `ML_API_KEY`, ...) |

**`backend`** (`backend/railway.json` committed; Config-as-code path `/backend/railway.json`):

| Setting | Value |
|---|---|
| Root directory | `/backend` |
| Builder | Railpack (auto: Node from `engines`, `npm ci`, start `npm start`) |
| Watch paths | `/backend/**` |
| Region | Southeast Asia (Singapore) |
| Networking | **Generate domain** → `https://<backend>.up.railway.app`. This is the URL for Vercel and the APK |
| Healthcheck path | `/api/health` |
| Replica limits | Memory 512 MB, 1 vCPU (measured 88 MB after startup) |
| Variables | see [8.1](#81-env-vars-per-service). The ML URL uses a reference variable: `ML_API_URL=http://${{ml.RAILWAY_PRIVATE_DOMAIN}}:${{ml.PORT}}` |

**Node and Bun:** Railpack picks the Node version from `"engines"` in `backend/package.json` (branch C adds
`>=22.9`, needed for `--env-file-if-exists` and global `fetch`/`FormData`). Bun would also work but isn't
needed; the backend is plain Node.

**Logs:** each deployment has build and deploy logs, and the service's *Observability* tab has searchable logs and
CPU/RAM graphs. That's where to read the real RAM use after deploy (to fine-tune the replica limit and the estimate).

### 2.3 TRUST_PROXY and the rate limiters behind Railway's edge

Public traffic to the backend passes through Railway's edge proxy, which sets `X-Forwarded-For` to the client IP.
`req.ip` drives the per-IP limiters:
- `TRUST_PROXY=0` → `req.ip` is the proxy, so **everyone shares one bucket**;
- too high → `req.ip` comes from client-controlled header values, so **the limit can be bypassed**.

Start with **`TRUST_PROXY=1`** (one proxy hop) and **verify by behaviour** after the first deploy:
1. **Not shared:** 21 failed logins from a laptop, each with a **different made-up email** (so the per-email
   limiter doesn't fire) → the 21st gets **429**. Right after, one failed login from a phone on mobile data →
   **401, not 429**.
2. **Not spoofable:** repeat from the laptop, sending a different `X-Forwarded-For: 203.0.113.<n>` on each request →
   the 21st must still be **429**. If it isn't, lower `TRUST_PROXY`.

Private-network calls (backend → ML) don't pass through the edge; the ML API has no IP-based limits.

**Accepted (decision 5):** the admin web app logs in from the **Vercel server** (Server Action), so the backend
sees a Vercel egress IP. Web logins therefore share per-IP buckets: a stranger failing 20 logins on the web form can
block web logins for 15 minutes. The per-email limit is unaffected. Documented here and in the README; the fix
(forwarding the client IP with a shared-secret header) is out of scope.

### 2.4 Usage limit (set by you)

Railway → **Workspace → Usage**:
1. **Custom email alert** (soft limit) for Compute, e.g. **$6**. You get an email; nothing stops.
2. **Hard limit** for Compute, e.g. **$10** (Railway's minimum hard limit is $10). At the hard limit **all workloads
   go offline** until the next billing period or a higher limit. Railway emails at 75% and 90% of it.
3. Per-service **replica limits** (2.2) cap RAM/CPU of a single service, so a runaway process can't use much. They
   don't lower the normal bill.

The Hobby plan includes **$5 of usage per month**; usage above that is billed on top of the subscription. Network
egress can't be capped separately, but it's tiny here (JSON plus small uploads; photos are served by Cloudinary).

---

## 3. ML API on Railway (lite runtime)

### 3.1 Training vs serving

- **Training, evaluation and the parity reference stay TensorFlow/Keras** (`src/training`, `src/evaluation`,
  notebooks, `requirements-train.txt`), and so does the default local run (`ML_RUNTIME=tf`).
- **Serving in production uses `ML_RUNTIME=lite`:** an exported copy of the **same** model (preprocessing included)
  run by a small inference runtime, from `requirements-lite.txt` **without TensorFlow**.
- **The resize step** (`tf.image.resize`, bilinear, no antialias, half-pixel centres) is re-implemented in NumPy
  for the lite path and tested against TensorFlow.

### 3.2 Runtime choice

Both candidates were exported and checked in branch A: **TFLite/LiteRT** (`ai-edge-litert` 2.3) and **ONNX**
(`onnxruntime` 1.31). **Chosen: ONNX Runtime.**
- **Parity:** equally perfect for both (numbers in 3.6).
- **RAM:** LiteRT uses ~30 MB less, about $0.30/month.
- **Export:** Keras 3.13's built-in ONNX exporter worked first time. LiteRT conversion depends on TensorFlow's
  `tf.lite` converter, which TF marks deprecated and scheduled for removal. One of its standard routes
  (`TFLiteConverter.from_concrete_functions`) silently produced a broken 200 KB model that output NaN.
- **Runtime:** ONNX Runtime is independent of TensorFlow's release cycle, which matters when Option B (or a model
  from a newer TF) is exported later.

Details are in `ml/README.md`. The export script (`python -m scripts.export_lite --model <file.keras>`) refuses to
write a model that fails parity. It already works on the Option B model: 8.9 MB `.onnx`, parity PASS. The 23 MB
of the Option B `.keras` file is mostly optimizer state, which the export drops.

### 3.3 Container

`ml/Dockerfile`:
- `python:3.12-slim` base, installs `requirements-lite.txt`, copies `src/` and the exported model, runs as a
  non-root user;
- sets `ML_RUNTIME=lite` and `ML_DISABLE_DOCS=1`;
- starts `python -m src.api.serve`, which opens **one dual-stack socket** (IPv4 + IPv6) on `$PORT`.
  **`uvicorn --host ::` is not enough:** branch A measured that it listens on IPv6 only (asyncio sets
  `IPV6_V6ONLY`), so IPv4 connections are refused. Railway's private DNS can return IPv4, so the launcher sets
  `IPV6_V6ONLY=0`. A test checks that both `127.0.0.1` and `::1` connect.

### 3.4 API key and docs

- `ML_API_KEY` set → `/predict` requires header `X-API-Key`, compared in constant time (`hmac.compare_digest`).
  Missing or wrong key → **401** in the usual error format, **before the upload body is read**.
- `ML_API_KEY` unset → no check (local dev/tests), as before.
- `/health` stays open (Railway healthcheck).
- `ML_DISABLE_DOCS=1` removes `/docs`, `/redoc` and `/openapi.json`.
- The backend already sends `X-API-Key`, and a 401 maps to 503 for the client. Set the **same value** on both
  services (the backend uses a reference variable `${{ml.ML_API_KEY}}`).

### 3.5 Smoke test (no public domain → from the backend)

The ML service is private, so check it through the backend:
- the `ml` service log shows `Uvicorn running on http://[::]:8000` and the healthcheck passing;
- `POST /api/reports` with `ml/tests/samples/plastic_101.jpg` on the public backend → 201,
  `ai_predicted_category: "plastic"`, `ai_confidence` ≈ 0.998.

To test the key itself, temporarily change `ML_API_KEY` on the **backend** only → `POST /api/reports` → 503, and the
ML log shows 401. Then change it back.

### 3.6 Measured RAM, image size and monthly estimate

Measured 2026-11-05/06 in Linux containers (`python:3.12-slim`, `node:22-slim`), RSS of the server process:

| | ML `tf` (TensorFlow 2.21) | ML `lite` (ONNX Runtime, **production**) | ML LiteRT (evaluated) | Backend (Node 22) |
|---|---|---|---|---|
| RSS after startup | 595 MB | **118 MB** | 98 MB | **88 MB** |
| RSS after 20 predictions | 708 MB | **143 MB** | 104 MB | — |
| Peak, one 24 MP upload | — | 660 MB (back to 156 MB after) | — | — |
| Image size (uncompressed) | 3.14 GB | **444 MB** | 483 MB | Railpack build |
| Parity vs Keras, 4,661 images | reference | max \|Δp\| **1.5e-5**, **0** label flips | 2.0e-5, 0 flips | — |

**Monthly usage estimate (both services always on).** Rates as reported for Railway: memory ≈ **$10 per GB-month**,
CPU ≈ **$20 per vCPU-month**, egress ≈ $0.05/GB (*third-party figures: check railway.com/pricing*). Railway bills
**actual** usage, not the replica limit:

| Item | Lite runtime (planned) | If ML ran TensorFlow |
|---|---|---|
| ML RAM | ~0.145 GB → **~$1.45** | ~0.71 GB → ~$7.10 |
| Backend RAM | ~0.09–0.15 GB → **~$0.90–1.50** | same |
| CPU (idle most of the time; one prediction is ~0.1 s of one core) | **~$0.20–0.60** | similar |
| Egress (JSON + uploads; photos are served by Cloudinary) | **< $0.05** | same |
| **Total usage** | **≈ $2.6–3.6 / month**: inside the **$5 included** in Hobby, so the bill stays at the $5 subscription | ≈ $8.5–9.5 / month: ~$4 over |

The demo seeding and a review week add little: a few hundred predictions. Check the real numbers on the
Usage page after the first days and adjust the alert and hard limit (2.4).

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
  backend server-side; Singapore keeps that next to the Railway backend.
- **Env vars:**
  - `NEXT_PUBLIC_API_URL=https://<backend>.up.railway.app`, no trailing slash (the code strips it anyway).
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

### 6.1 Config (branch D)

- **`app.json`:**
  - `"slug": "swms"` (renamed from `"Mobile"` **before** `eas init`, which links the slug to the EAS project);
  - `"android": { "package": "com.jieffrey.swms", "versionCode": 1 }`. The package name is permanent for the app.
- **`eas.json`:** a `preview` profile that builds an **APK** (`android.buildType: "apk"`, `distribution: "internal"`)
  with `EXPO_PUBLIC_API_URL` = the Railway backend URL. Not a secret: it ships inside the app.
- **`eas init`** (run by you) adds `extra.eas.projectId` and `owner` to `app.json`.
- **HTTPS:** the Railway domain is HTTPS, which closes **SEC-12** for the release build. Android blocks cleartext
  HTTP in release builds, so a stray `http://` URL fails visibly.
- **Timeout:** the mobile request timeout (45 s) stays above the backend's ML timeout. The backend refuses to start
  if `ML_API_TIMEOUT_MS` is set above 40 s (branch C), so the two can't drift apart.

### 6.2 Icon / splash check

| Asset | Found | Requirement | OK? |
|---|---|---|---|
| `icon.png` | 1024×1024 | 1024×1024 | ✓ |
| `android-icon-foreground.png` / `-background` / `-monochrome` | 1024×1024 each | 1024×1024, logo inside the central ~66% | Size ✓; check the safe zone on a round-mask launcher |
| `splash-icon.png` | 1024×1024, `imageWidth: 200`, background `#FBFBF8` | | ✓ |

After installing, look at the launcher icon (round and squircle masks), the themed icon on Android 13+, and the
splash screen.

### 6.3 Build and install

```bash
cd Mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build -p android --profile preview
```

- EAS prints a **build page URL with a QR code** and the `.apk`. Reviewers open it on an Android phone → download →
  allow "Install unknown apps" for the browser → install → open *SWMS*.
- Also attach the APK to a **GitHub Release** (`v1.0.0`) for a permanent link; EAS artifacts may expire.
- **README:** add the Release link, a QR code and the note on where the demo resident login is (submission notes,
  not the repo).

---

## 7. Production demo data (branch E)

`backend/scripts/seed-demo.js`, separate from the dev `seed.js`. Data in `backend/scripts/demo/`.

### 7.1 Content (48 reports)

| | Plan |
|---|---|
| Residents | 5 accounts with fixed emails on a non-mailbox domain (`@demo.swms.invalid`-style), Indonesian names. Passwords from `DEMO_RESIDENT_PASSWORD` (never committed). |
| Photos | **48 committed images** in `backend/scripts/demo/photos/` (1.2 MB in total), 16 per class, resized to ≤1024 px with **no metadata**, and an `ATTRIBUTION.md` (Kaggle *Garbage Classification V2* by sumn2u, version 8, **MIT**, full MIT text). 9 are confirmed Colab test-split images: 6 the current model gets wrong (2 per class, all on reviewed reports, so the corrections are real) and the 3 parity samples. The other 39 come from a local re-run of the split, which can't reproduce the Colab file order, so the attribution marks them. `DEMO_PHOTOS_DIR` optionally overrides the folder. |
| AI fields | From **calling the ML API** once per photo while seeding (honest predictions). `category` = the AI prediction, or the admin's correction. |
| Statuses | ~14 `pending`, ~12 `in_progress`, ~15 `completed`, ~7 `rejected`. History rows follow the allowed transitions. |
| Corrections | ~6 category corrections with an `admin_note`; rejected reports have a reason in the note. |
| Dates | `created_at` spread over the **last 30 days** (Asia/Jakarta), relative to the run; status changes hours to days later. |
| Places | Fixed coordinates and addresses in Jakarta Selatan. |

### 7.2 Safe to re-run, never touches the admin

- **Reports:** UUIDv5 ids from each manifest key, inserted with `ON CONFLICT (id) DO NOTHING`.
- **Photos:** deterministic image names/public ids (`<folder>/demo/<key>`); an already-uploaded photo is reused.
- **Residents:** inserted only if the email is new. Existing residents keep their password.
- **Admin:**
  - looked up **read-only** by `DEMO_ADMIN_EMAIL`, and only its `id` is used (`changed_by`);
  - the script never writes any `users` row with `role = 'admin'`;
  - it refuses to run if the admin is missing, or if a resident email belongs to an existing admin.
- **Guard rails:**
  - `--dry-run` prints the plan and writes nothing;
  - real runs need `--confirm <host>` equal to the host in `DATABASE_URL`;
  - the script never deletes anything.
- **One transaction per report** (report + history).
- **Tests** (dev DB, ML and storage stubbed):
  - a second run creates nothing;
  - the admin row is unchanged;
  - every history path is a legal transition;
  - `--dry-run` writes nothing;
  - a wrong `--confirm` host is refused.

---

## 8. Environment variables and deploy order

### 8.1 Env vars per service

**Railway `ml`**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `PORT` | `8000` | no | Set explicitly, so the backend's reference `${{ml.PORT}}` has a fixed value |
| `ML_API_KEY` | 64 hex chars | **yes** | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ML_RUNTIME` | `lite` | no | Already the Dockerfile default |
| `ML_DISABLE_DOCS` | `1` | no | Already the Dockerfile default |
| `MODEL_PATH` | *(unset)* | no | Default: the exported model in `models/` |

**Railway `backend`**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `NODE_ENV` | `production` | no | |
| `PORT` | *(set by Railway)* | no | Don't set |
| `DATABASE_URL` | `postgresql://…@ep-…-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | **yes** | Neon **prod**, pooled host |
| `DB_POOL_MAX` | `5` | no | |
| `JWT_SECRET` | 96 hex chars | **yes** | New value, not the dev one |
| `JWT_EXPIRES_IN` | `24h` | no | |
| `ML_API_URL` | `http://${{ml.RAILWAY_PRIVATE_DOMAIN}}:${{ml.PORT}}` | no | Reference variable → `http://ml.railway.internal:8000` |
| `ML_API_KEY` | `${{ml.ML_API_KEY}}` | **yes** | Reference variable, same value as `ml` |
| `ML_API_TIMEOUT_MS` | `30000` | no | Optional; 100–40000 allowed, the server refuses anything else (branch C) |
| `TRUST_PROXY` | `1` | no | Verify with [2.3](#23-trust_proxy-and-the-rate-limiters-behind-railways-edge) |
| `WEB_ORIGIN` | *(empty)* | no | Web calls are server-side |
| `STORAGE_DRIVER` | `cloudinary` | no | Branch B |
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@<cloud_name>` | **yes** | Branch B |
| `CLOUDINARY_FOLDER` | `swms/prod` | no | Branch B |

**Vercel (`web`, Production)**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<backend>.up.railway.app` | no (public) | Set at build time: redeploy after a change |

**EAS (`Mobile`, `preview` profile)**

| Name | Example | Secret | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<backend>.up.railway.app` | no (public) | In `eas.json`, or EAS env `preview` |

**Local only: `backend/.env.production`** (gitignored by `.env.*`; scripts run with
`node --env-file=.env.production …`)

| Name | Used by | Secret |
|---|---|---|
| `DATABASE_URL` (prod, pooled) | db-check, seed (first admin), set-admin-password, seed-demo | **yes** |
| `SEED_ADMIN_NAME` / `_EMAIL` / `_PASSWORD`, `SEED_USER_*` | first admin only, then removed | **yes** |
| `STORAGE_DRIVER`, `CLOUDINARY_URL`, `CLOUDINARY_FOLDER` | seed-demo | URL: **yes** |
| `ML_API_URL`, `ML_API_KEY` | seed-demo. The ML service is private, so run the ML container locally with the same image (`docker run -p 8000:8000 …`) and use `http://localhost:8000` | key: **yes** |
| `DEMO_ADMIN_EMAIL`, `DEMO_RESIDENT_PASSWORD`, `DEMO_PHOTOS_DIR` (optional) | seed-demo | password: **yes** |

### 8.2 Step-by-step deploy order, with a smoke test after each step

Before step 1, merge branches A–E to `main` ([section 10](#10-implementation-branches)).

| # | Step | Smoke test |
|---|---|---|
| 1 | **Neon:** new project `swms-prod` (AWS `ap-southeast-1`), apply `backend/db/schema.sql` with the **direct** URL | `\dt` shows 3 tables; `node --env-file=.env.production scripts/db-check.js` OK |
| 2 | **Cloudinary:** account, copy `CLOUDINARY_URL` | Upload one test image in the Media Library, open its `res.cloudinary.com` URL, delete it |
| 3 | **Railway:** project `swms`, **usage alert + hard limit** (2.4), service `ml` (2.2), variables | Deploy log: healthcheck `/health` passes; log shows `[::]:8000`; Metrics RAM ≈ the measured value |
| 4 | **Railway:** service `backend` (2.2), variables, generate domain | `GET https://<backend>/api/health` → ok. Then:<br>• register a test user; `POST /api/reports` with `plastic_101.jpg` → 201, `image_url` on `res.cloudinary.com`, photo opens and has **no EXIF**, `ai_predicted_category: plastic`<br>• 6 MB → 413; `.txt` renamed `.jpg` → 415<br>• the TRUST_PROXY checks from 2.3<br>• delete the test data by SQL |
| 5 | **First admin** (4.3) | `Admin123!` → 401; the real password → 200, role `admin` |
| 6 | **Vercel:** root `web`, region `sin1`, `NEXT_PUBLIC_API_URL` | Login; cookie `HttpOnly; Secure; SameSite=Lax`; dashboard/list/detail; photo shows; status change and category correction; logout |
| 7 | **Demo data:** `seed-demo.js --dry-run`, then the real run with `--confirm`, then **run it again** | Second run creates 0; dashboard shows 48 reports over 30 days, all statuses/categories; admin password still works |
| 8 | **APK:** `eas init`, `eas build --profile preview` | Install on a phone on mobile data; log in as the demo resident; photos load; new report → AI result → visible in the web admin |
| 9 | **README:** live links, APK Release + QR, demo-login note | Open each link logged out / on another phone |

---

## 9. Risks, and what to check before submitting

### 9.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Usage above the Hobby $5 | Extra cost | Lite runtime; replica limits; email alert + hard limit (2.4); estimate in 3.6 |
| Hard limit reached | **Everything goes offline** | Alert well below the hard limit; check the Usage page during review week |
| Lite model drifts from Keras (e.g. Option B export) | Wrong predictions in production | Export script verifies parity before writing; the parity test runs with `ML_RUNTIME=lite` |
| Private networking misconfigured (IPv6 / port) | Backend gets 503 "AI service unavailable" | Dual-stack launcher (`src.api.serve`, tested); fixed `PORT=8000`; reference variables; smoke test 4 |
| A very large photo uses a lot of ML memory | Memory spike to ~660 MB for one 24 MP image | Replica memory limit 1 GB; the mobile app sends ≤ 1600 px, so normal reports stay ~145 MB |
| `TRUST_PROXY` wrong | Shared lockout or spoofable limiter | Behavioural checks in 2.3 |
| Web admin logins share Vercel IP buckets | Web login can be blocked for 15 min | Accepted (decision 5), documented |
| In-memory rate limits reset on redeploy | Weaker limits | One instance; documented in `rate-limit.js` |
| Dev credentials reach production (SEC-01) | Public admin password | Separate prod DB; first-admin procedure; seed-demo never writes admins |
| `npm test` / dev seed run against prod | Data deleted / demo passwords | Prod scripts only via `--env-file=.env.production`; never `npm run` |
| Orphaned Cloudinary asset (crash between upload and insert) | Unused files | Rare; cleanup in the Media Library |
| Photos public by URL | Anyone with the link can see a photo | Random names; EXIF/GPS stripped |
| `NEXT_PUBLIC_…` / `EXPO_PUBLIC_…` set at build time | URL change needs a web redeploy and a new APK | Fix the Railway domain before building the APK |
| Demo photos: dataset partly web-scraped, MIT on Kaggle | Licence of individual images can't be fully verified | Attribution file, MIT text, resized copies only; easy to replace via `DEMO_PHOTOS_DIR` |

### 9.2 Pre-submission checklist

- [ ] Railway: both services healthy, region Singapore, `ml` has **no public domain**, usage alert + hard limit set,
      RAM in Metrics as expected.
- [ ] `GET <backend>/api/health` → ok. The ML API isn't reachable from the internet (no domain).
- [ ] Web: real admin login works, `Admin123!` → 401, cookie `Secure` + `HttpOnly`, logout works.
- [ ] Rate limits: the 21st failed login from one IP → 429 with `Retry-After`; another network not blocked.
- [ ] APK on a clean phone: install from the README link, register a new account, report with camera + location,
      AI result shown, visible in the web admin; change the status there and see the timeline in the app.
- [ ] Photos load from `res.cloudinary.com`; a downloaded photo has **no GPS EXIF**.
- [ ] Upload limits: 6 MB → 413, `.txt` as `.jpg` → 415.
- [ ] Dashboard reflects the demo data (48 reports, all statuses/categories, AI accuracy < 100%).
- [ ] Re-running `seed-demo.js` creates nothing; admin password unchanged.
- [ ] No secrets in git: `git grep -n "neon.tech\|cloudinary://"` shows only placeholders; `.env*` untracked.
- [ ] README: live URLs, APK link + QR, dataset credit, note on demo logins.
- [ ] Railway and Vercel logs show no unexpected errors after the walkthrough.

---

## 10. Implementation branches

Each branch is made from `main`, has its own tests, and is pushed without a PR.

| Branch | Content |
|---|---|
| A. `feat/ml-lite-runtime` | Export script (`.keras` → lite model, parity-checked), `ML_RUNTIME=lite\|tf`, NumPy resize, `requirements-lite.txt`, API key + docs switch, `Dockerfile` + `railway.json`, measurements |
| B. `feat/backend-cloud-storage` | `STORAGE_DRIVER=local\|cloudinary`, sharp sanitize (SEC-06), tests |
| C. `feat/deploy-timeouts` | Validated `ML_API_TIMEOUT_MS` (default 30 s, max 40 s, under the mobile 45 s), `engines`, `backend/railway.json` |
| D. `feat/mobile-eas-config` | `android.package`, slug `swms`, `versionCode`, `eas.json` preview APK |
| E. `feat/backend-seed-demo` | `seed-demo.js`, 48 committed photos + `ATTRIBUTION.md`, manifest, tests, README credits |

## Sources (checked 2026-11-05)

- Railway private networking: <https://docs.railway.com/private-networking>
- Railway cost control (usage alerts and hard limits): <https://docs.railway.com/pricing/cost-control>
- Railway plans: <https://docs.railway.com/reference/pricing/plans>, <https://railway.com/pricing>
- Railway right-sizing CPU/memory: <https://docs.railway.com/guides/right-size-cpu-memory>
- Neon free plan limits: <https://neon.com/faqs/free-plan-limits-and-quotas>
- Cloudinary plans and credits: <https://cloudinary.com/documentation/billing_and_plans>
- Dataset: <https://www.kaggle.com/datasets/sumn2u/garbage-classification-v2>
