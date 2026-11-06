# Smart Waste Management System (SWMS)

Residents are the eyes, the AI is the sorter, admins are the dispatchers. A resident sees waste lying around,
takes a photo in the Android app, and the app adds the GPS location. The backend sends the photo to an image
classifier that sorts it into **organic**, **paper** or **plastic**, and the report lands in the admin web panel.
An admin checks the AI's category (correcting it if needed), routes the report through
`pending → in_progress → completed` (or `rejected` with a note), and the resident follows that status in the app.
The problem it addresses: waste reports that arrive unsorted, without a location and without feedback to the
person who reported them.

## Live demo

| | |
|---|---|
| Admin web panel | https://smart-waste-system-management.vercel.app |
| Android APK | [GitHub Releases → latest](https://github.com/jieffrey/Smart-Waste-System-Management/releases/latest) |
| Backend health | <!-- TODO(owner): replace with the real Railway domain --> `https://<backend>.up.railway.app/api/health` → `{"status":"ok"}` |

Demo credentials (one admin, one resident) are in the submission email. They are not in this repository.

The ML API has no public URL: only the backend can reach it, over Railway's private network.

## Screenshots

<!-- TODO(owner): these web screenshots (docs/screenshots/polish-final/, 2026-11-06 14:01) predate the
     Plus Jakarta Sans font, the glass top bar and the needs-review / possible-duplicate markers. Recapture them
     with tools/screenshots when convenient. -->

| Dashboard | Reports list | Report detail |
|---|---|---|
| ![Admin dashboard](docs/screenshots/polish-final/dashboard-1440.png) | ![Admin reports list](docs/screenshots/polish-final/reports-1440.png) | ![Admin report detail](docs/screenshots/polish-final/report-detail-pending-1440.png) |

<!-- TODO(owner): add mobile screenshots. The only mobile captures (docs/screenshots/mobile/ and
     docs/screenshots/polish-final/mobile/) predate the glass tab bar, onboarding, handling guidance, the
     "Baru" update tag and the low-confidence message, so they are left out on purpose. Wanted:
     onboarding slide, AI result (with handling guidance), "Laporan saya" list (with a "Baru" tag). -->

## Features

### Resident (mobile app, Android; UI in Bahasa Indonesia)

- **Onboarding:** three animated slides on first launch, skippable (**Lewati**), replayable from settings.
- **Account:** register, log in, log out; the session is restored on start (token in `expo-secure-store`).
- **Email verification (OTP):** a 6-digit code screen with a resend countdown. Only active when the backend runs
  with `OTP_ENABLED=true` (off by default). In the live demo it is **TODO: on / off**.
  <!-- TODO(owner): fill in whether OTP_ENABLED is on in the deployed demo. -->
- **New report:** photo from camera or gallery (resized to 1600 px, JPEG), GPS location with an editable address,
  description. After submitting, the app shows the AI category and confidence.
- **Low-confidence message:** when the AI is unsure (see *needs review* below), the result says an officer will
  check it manually.
- **Handling guidance:** per category, what it is, how to handle it and where it can go (compost, waste bank,
  collector), on the AI result and the report detail.
- **Possible-duplicate note** after submitting, when a matching open report already exists nearby.
- **My reports:** status filter, pull to refresh, infinite scroll. Reports with an update the owner hasn't opened
  yet get a **Baru** ("new") tag, and the tab shows the count.
- **Report detail:** photo, status timeline with admin notes, AI category and confidence (and the AI's original
  guess if an admin corrected it), Open in Maps.
- **Account settings:** edit name and email, change password, replay the guide, log out.

### Admin (web panel)

- **Dashboard:** totals by status and category, reports and completions per day (30 days, Asia/Jakarta), AI
  accuracy on reviewed reports, a Sankey chart from AI category to current category, and the needs-review count.
- **Reports list:** filters for status, category, date range, text search, *needs review* and *possible
  duplicate*.
- **Report detail:** reporter, photo, location, AI result, status history with who changed what. Change status
  (only allowed transitions; a note is required to reject), correct the category (the original AI prediction is
  kept), add a note. Handling guidance for the category, and links between a report and its possible duplicates
  in both directions.
- **Users:** list and search users with their report count; activate or deactivate accounts (a deactivated
  user's token stops working at once; an admin can't deactivate their own account).
- **Settings:** edit profile, change password, log out.

### AI

- **Classification on upload:** every new report's photo is classified by the ML API before anything is stored.
  If the ML API is down, the report is not saved (`503`) and the app keeps the form filled in.
- **Needs review:** a report needs review when `ai_confidence < AI_REVIEW_THRESHOLD` (default `0.70`) and no
  admin has confirmed or corrected it yet (still `pending`, category unchanged). It is computed in SQL, not
  stored.
- **Possible duplicate:** on creation, the backend links a report to the nearest **open** report with the **same
  category**, created in the **last 24 hours**, within **50 m** (haversine). Nothing is blocked; the link is a hint
  for the admin.
- **AI accuracy:** the share of reviewed reports (`in_progress` / `completed`) whose category the admin left as
  the AI predicted it.

## Architecture

```mermaid
flowchart LR
  app["Mobile app<br/>(Android APK, Expo)"]
  web["Admin web<br/>(Next.js on Vercel)"]
  subgraph railway["Railway project (Singapore)"]
    api["Backend API<br/>(Express)"]
    ml["ML API<br/>(FastAPI + ONNX Runtime)<br/>no public domain"]
  end
  db[("Neon Postgres")]
  cdn["Cloudinary<br/>(report photos)"]

  app -- "HTTPS, Bearer token" --> api
  web -- "server-side HTTPS<br/>(token in httpOnly cookie)" --> api
  api -- "private network,<br/>X-API-Key" --> ml
  api -- "SQL over TLS" --> db
  api -- "upload / delete" --> cdn
  app -. "loads photos" .-> cdn
  web -. "loads photos" .-> cdn
```

| Component | Folder | Stack |
|---|---|---|
| Mobile app (residents) | [`Mobile/`](Mobile/) | Expo SDK 58, React Native 0.88, Expo Router, TypeScript, React Native Paper; APK built with EAS |
| Admin web | [`web/`](web/) | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui + Radix, Bklit charts (d3) |
| Backend API | [`backend/`](backend/) | Node.js 22, Express 5 (CommonJS), raw parameterized SQL with `pg`, zod, multer, sharp, bcryptjs, JWT |
| ML API | [`ml/`](ml/) | Python 3.12, FastAPI, ONNX Runtime (production) / TensorFlow-Keras (training, local default), Docker |
| Database | [`backend/db/`](backend/db/) | PostgreSQL on Neon; [`schema.sql`](backend/db/schema.sql) + numbered [migrations](backend/db/migrations/) |
| Photo storage | `backend/src/modules/uploads/` | Cloudinary in production (`STORAGE_DRIVER=cloudinary`), local disk in development |

The web panel never calls the backend from the browser: its Next.js server does, so production needs no CORS.

## ML summary

- **Model:** MobileNetV2 (ImageNet weights) with transfer learning, 224×224 RGB input, 3 classes. The served model
  is **Option B**: class weights plus fine-tuning the top of MobileNetV2 (`model_version`
  `swms_mobilenetv2_option_b`).
- **Data:** Kaggle *Garbage Classification V2* (its `biological`, `paper` and `plastic` classes; `biological` is
  used as `organic`), 701 test images.

Results on the test set (first model in brackets, from [`ml/results/option_b/`](ml/results/option_b/)):

| Metric | Option B |
|---|---|
| Test accuracy | **98.29%** (689 of 701) [97.72%] |
| Recall `organic` / `paper` / `plastic` | **0.9800** / **0.9881** / **0.9799** [0.9667 / 0.9881 / 0.9732] |
| Macro F1 | **0.9818** [0.9769] |
| `plastic` → `paper` errors (the main confusion) | **5** of 298 plastic images [8] |

The remaining `plastic` → `paper` errors are printed packaging and thin bags. Both models come from a single
training run each, so there is no variance estimate (see [Known limitations](#known-limitations)).

**Serving:** the Keras model is exported to ONNX (8.9 MB) and served with ONNX Runtime, so the always-on container
doesn't load TensorFlow. The export is only written if it matches Keras on all 4,661 images of the 3 classes (max
probability difference 2.9e-5, 0 label flips). Measured in the production image:

| | TensorFlow runtime | ONNX Runtime (served) |
|---|---|---|
| RAM after startup | 595 MB | **118 MB** |
| RAM after 20 predictions | 708 MB | **143 MB** |
| Docker image (uncompressed) | 3.14 GB | **444 MB** |

The full write-up (dataset, preprocessing, training setup, class imbalance, error analysis, limitations, Option B
comparison) is in the [ML Development Process](ml/README.md#ml-development-process).

## Security

In place:

- **Web session:** the JWT lives in an **httpOnly** cookie (`Secure` in production, `SameSite=Lax`); browser
  JavaScript never sees it. The mobile app keeps its token in `expo-secure-store`.
- **Rate limits** (`429` + `Retry-After`): login per IP and per email (failed attempts), registration, profile
  and password changes, OTP verify/resend, and report creation (20 per user per hour).
- **Passwords:** bcrypt, 8–72 characters, about 100 very common passwords rejected; login timing doesn't reveal
  whether an email exists.
- **Upload limits:** one file, max 5 MB, type checked from the file content (JPEG/PNG/WebP), multipart field
  limits. The ML API also refuses bodies over 5 MB before reading them and images over 24 million pixels before
  decoding.
- **EXIF stripping:** photos are re-encoded with `sharp` before storage, dropping all metadata (including GPS).
- **ML API key:** `/predict` requires `X-API-Key` (constant-time compare); `/docs` is disabled in the image.
- **Private ML network:** the ML service has no public domain; only the backend reaches it over Railway's private
  network.
- **Access control:** parameterized SQL everywhere, allowlisted request bodies, a resident can only see their own
  reports (others get `404`), admin routes need an active admin.

Not in place: HTTP security headers (SEC-07) and token revocation (see below). The full white-box review, with the
status of each finding, is in [`docs/security-audit.md`](docs/security-audit.md).
