# SWMS security audit (white-box review)

- **Date:** 2026-11-04
- **Code audited:** `main` at `77df97f` (after the dashboard and reports-list merges)
- **Method:** manual white-box review of every source file, guided by the OWASP Top 10:2025 and the
  OWASP API Security Top 10 (2023), plus harmless live checks against **localhost only**
  (backend `:4000`, ML API `:8000`, web `:3000`) using the seeded accounts and one extra
  `SECURITY-TEST` user. Dependency scans: `npm audit` (backend, web, Mobile) and `pip-audit` (ML).
  Secret scan: the full git history of every branch.
- **Not used:** the Strix scanner itself (it needs Docker and an LLM API key, which aren't set up here).
  This report follows its methodology and its honesty rules instead.

## How to read this report

Each finding has:

- **Severity** with a one-line reason. Severity is ranked by **what was actually shown**, not by the
  theoretical worst case. Every finding says whether it was **proven live** or found by **code review only**.
- **Where:** `file:line`.
- **What's wrong** in plain language, **how it could be abused** (conceptually, no attack recipes),
  **how to fix it** with a small code sketch, and the **lesson** to carry into future projects.

| Severity | Meaning in this report |
|---|---|
| Critical | Exploitable now by anyone, with serious impact. *(None found.)* |
| High | Serious impact, proven, needs only a small and likely step (such as deploying) to be exploitable. |
| Medium | Real weakness with meaningful impact, but needs an account, a specific setup, or wasn't proven live. |
| Low | Defense-in-depth gap or limited impact. Worth fixing, not urgent. |
| Info | Good to know. No direct risk today. |

## Summary

No Critical findings. The core of the backend is solid: every SQL query is parameterized, object-level
access control works (a user can't read another user's report, and a user can't call admin routes),
request bodies are validated with allowlists (no mass assignment), and uploads are checked by their real
content. The main risks are **operational**: a published admin password that works against the real
database, no rate limiting, and an ML endpoint that a big image could exhaust.

| ID | Severity | Title | Area | OWASP 2025 / API 2023 | Evidence | Status |
|---|---|---|---|---|---|---|
| [SEC-01](#sec-01) | **High** | Published demo admin password works against the real database | Repo / backend | A07, A02 | Proven live | Fixed |
| [SEC-02](#sec-02) | Medium | No rate limiting on login, registration or report creation | Backend | A07, API4 | Proven live | Fixed |
| [SEC-03](#sec-03) | Medium | ML API can be made to use gigabytes of memory with one small image | ML | A10, API4 | Code review | Fixed |
| [SEC-04](#sec-04) | Low | Weak password policy (`12345678` is accepted) | Backend | A07 | Proven live | Fixed |
| [SEC-05](#sec-05) | Low | Account enumeration through login timing and the register error | Backend | A07 | Proven live | Partly fixed (timing) |
| [SEC-06](#sec-06) | Low | Uploaded photos are stored and served byte-for-byte (EXIF location kept) | Backend | A02, API3 | Proven live | Fixed |
| [SEC-07](#sec-07) | Low | Missing HTTP security headers (backend and web) | Backend / web | A02 | Proven live | Fixed (CSP: future work) |
| [SEC-08](#sec-08) | Low | Upload limits are checked late; multipart fields are unlimited | Backend / ML | API4 | Partly proven | Fixed |
| [SEC-09](#sec-09) | Low | ML `/predict` has no authentication; `/docs` is public | ML | A01, API2 | Proven live | Fixed |
| [SEC-10](#sec-10) | Low | No security event logging; category/note changes leave no history | Backend | A09 | Code review | Open |
| [SEC-11](#sec-11) | Low | 24-hour tokens that can't be revoked; no `iss`/`aud` claims | Backend / web | A07 | Proven live | Open |
| [SEC-12](#sec-12) | Low | Mobile app talks to the backend over plain HTTP | Mobile | A04 | Code review | Open |
| [SEC-13](#sec-13) | Low | Anyone can log an admin out with a link | Web | A01 | Proven live | Open |
| [SEC-14](#sec-14) | Low | Error-handling gaps: big JSON gives 500, a bad image gives 503 | Backend | A10 | Proven live | Fixed |
| [SEC-15](#sec-15) | Low | Any admin can deactivate every other admin | Backend | A06 | Code review | Open |
| [SEC-16](#sec-16) | Low | `keras 3.13.2` has known advisories (not reachable here) | ML | A03 | `pip-audit` | Open |
| [SEC-17](#sec-17) | Info | `npm audit`: moderate issues in dev tooling only | Web / Mobile | A03 | `npm audit` | Open |
| [SEC-18](#sec-18) | Info | "Deactivated" is detected from the error message text | Web | A10 | Code review | Open |
| [SEC-19](#sec-19) | Info | Small hardening notes (bcrypt cost, secret strength, gitignore, proxy) | Several | A02, A04 | Code review | Open |

Details and the fixing branch are at the top of each finding ("Status: fixed in ...").

Suggested fix order: SEC-01, then SEC-02 together with SEC-04, then SEC-03 and SEC-08 (they share a fix
area), then the Low items as time allows.

---

# Backend findings (Express API)

<a id="sec-01"></a>
## SEC-01: Published demo admin password works against the real database

- **Status: fixed in `security/fix-demo-admin-password`.** The seed is documented as local-only, a test
  proves that re-running it never resets an existing admin password, and `npm run set-admin-password` sets
  a strong password at a hidden prompt. **Action still needed:** run that script against the Neon database;
  until then, the existing admin still has the demo password.
- **Severity: High.** It's a working admin login for the real (cloud) database, written in the repo.
  The only thing between it and a full admin takeover is the backend being reachable on the internet.
- **Evidence:** proven live. `POST /api/auth/login` with the README credentials returned `role: "admin"`.
- **Where:** `backend/scripts/seed.js:18-19` (admin), `backend/scripts/seed.js:25-26` (user),
  `backend/README.md:63-64`, `Mobile/README.md:104`

**What's wrong.** The seed script creates an admin with a fixed password (`Admin123!`), and the READMEs
print it. The seed was run against the Neon database the backend uses, so this password really works.
The script warns about it, and it lets you override it with `SEED_ADMIN_PASSWORD`, but the
override is optional, and the account that exists today uses the default.

**How it could be abused.** Anyone who has read the repository (reviewers, classmates, or anyone at all
if the repo is public) can sign in to the admin panel as soon as the backend gets a public URL. They
could then read every report (with reporters' names, emails and exact locations), change or reject
reports, and deactivate users. Demo credentials are one of the first things attackers try, because
projects often ship with them.

**How to fix it.**
1. Change the admin password in the database now. Re-run the seed with a strong `SEED_ADMIN_PASSWORD`
   (the script never changes an existing password, so update the row or delete the account and re-seed).
2. Make the seed refuse to use the built-in password unless you explicitly ask for demo mode:

```js
// backend/scripts/seed.js
const allowDemoPasswords = process.env.SEED_ALLOW_DEMO_PASSWORDS === 'true';
if (!process.env.SEED_ADMIN_PASSWORD && !allowDemoPasswords) {
  console.error('Set SEED_ADMIN_PASSWORD (or SEED_ALLOW_DEMO_PASSWORDS=true for a local demo database).');
  process.exit(1);
}
```

3. In the READMEs, keep the demo user if you like, but say the admin password comes from your own `.env`.

**Lesson.** A password in a repository is public. Default credentials should only work in a throwaway
local setup, and the code should make that the explicit choice, not the default.

<a id="sec-02"></a>
## SEC-02: No rate limiting on login, registration or report creation

- **Status: fixed in `security/fix-rate-limiting`.** In-memory limits with `429` + `Retry-After` in the standard error format:
  login 20/IP/15 min and 5 failed attempts/email/15 min (same response for unknown emails), registration
  10/IP/hour, new reports 20/user/hour. Covered by `backend/tests/rate-limit.test.js`. `TRUST_PROXY` makes
  per-IP limits work behind a host proxy. **Known limitation:** web admin logins reach the API from the
  Next.js server, so they share that server's per-IP counter. The per-email limit still applies to each
  account; forward the client IP if that becomes a problem.
- **Severity: Medium.** Proven, and it enables password guessing (worse together with SEC-04) and
  resource abuse, but each attack needs many requests and does damage slowly.
- **Evidence:** proven live. 10 wrong passwords in a row for the SECURITY-TEST user all returned `401`,
  the 11th attempt with the right password returned `200`, and no `RateLimit`/`Retry-After` headers appeared.
- **Where:** `backend/src/app.js:20-28` (no limiter on any route), `backend/src/modules/auth/auth.routes.js:10-11`,
  `backend/src/modules/reports/reports.routes.js:11-18`

**What's wrong.** Nothing limits how often someone can call the API. That covers three endpoints:
- `POST /api/auth/login` accepts unlimited guesses.
- `POST /api/auth/register` lets anyone create unlimited accounts.
- `POST /api/reports` lets any account store unlimited 5 MB images and run unlimited ML predictions.

**How it could be abused.**
- **Guessing passwords:** a script tries common passwords against known emails (see SEC-05 for how
  emails can be discovered).
- **Filling up the server:** a script registers an account and uploads thousands of photos. Each one is
  saved to `backend/uploads/` and runs the CPU-heavy ML model, so disk space and CPU run out.

**How to fix it.** Add `express-rate-limit` with a strict limit on auth routes and a looser one on uploads:

```js
// backend/src/middlewares/rate-limit.js
const { rateLimit } = require('express-rate-limit');

// 10 login/register attempts per 15 minutes per IP
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
// 20 new reports per hour per IP
const reportLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

module.exports = { authLimiter, reportLimiter };

// auth.routes.js:    router.post('/login', authLimiter, validate(loginSchema), authController.login);
// reports.routes.js: router.post('/', authenticate, authorizeRole('user'), reportLimiter, uploadImage, ...)
```

Behind a reverse proxy (Render, Railway, nginx) also set `app.set('trust proxy', 1)`. Otherwise every
request seems to come from the proxy's IP, and one user's limit blocks everyone. For logins, a limit per
email address (in addition to per IP) stops guessing spread across many IPs.

**Lesson.** Any endpoint that checks a secret, creates something, or does expensive work needs a limit.
Add the limits when you write the endpoint, not after an incident.

<a id="sec-04"></a>
## SEC-04: Weak password policy

- **Status: fixed in `security/fix-rate-limiting`.** Registration rejects about 100 very common passwords in any letter case
  (`backend/src/modules/auth/common-passwords.js`), tested in `auth.test.js`. The local-only demo passwords
  (`Admin123!`, `Password123!`) still pass, so the seed keeps working.
- **Severity: Low.** Proven, but it only hurts users who pick weak passwords. With SEC-02 unfixed, it
  makes guessing those accounts realistic.
- **Evidence:** proven live. The SECURITY-TEST user was registered with the password `12345678` (`201 Created`).
- **Where:** `backend/src/modules/auth/auth.schema.js:12`

**What's wrong.** The only rule is "8 to 72 characters". `12345678`, `password` and `qwertyui` are all
accepted, and these are the first passwords any guessing script tries.

**How it could be abused.** Combined with SEC-02 and SEC-05, an attacker can find out which emails have
accounts, then try a short list of the most common passwords against each one.

**How to fix it.** Current guidance (NIST SP 800-63B, OWASP ASVS) says: keep the length minimum, skip
"must contain a symbol" rules, and **block known-common or breached passwords**. A small local blocklist
is enough for this project:

```js
// backend/src/modules/auth/auth.schema.js
const COMMON_PASSWORDS = new Set(require('./common-passwords.json')); // e.g. the top 10,000 list

const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), 'This password is too common. Choose another one');
```

Apply it only on registration (and a future "change password"), never on login, so existing users can
still sign in.

**Lesson.** A long password matters more than one full of symbols. The most useful check is rejecting
passwords attackers already have on their lists.

<a id="sec-05"></a>
## SEC-05: Account enumeration through login timing and the register error

- **Status: fixed in `security/fix-rate-limiting` (timing).** Login always runs one bcrypt comparison (proven by
  `auth-login-timing.test.js`; live median after the fix: 89 ms existing vs 90 ms unknown). The register
  409 message is kept as a deliberate trade-off and is now rate-limited.
- **Severity: Low.** Proven, but it only reveals whether an email has an account, which helps SEC-02-style
  guessing and phishing.
- **Evidence:** proven live.
  - **Login timing:** median response time over 5 tries was **81 ms** for an email that exists and
    **20 ms** for one that doesn't.
  - **Register error:** registering an email that's already taken returned `409 "Email is already registered"`.
- **Where:** `backend/src/modules/auth/auth.service.js:50` (bcrypt only runs when the user exists),
  `backend/src/modules/auth/auth.service.js:36-37` (409 on register)

**What's wrong.** The login *message* is correctly the same for both cases ("Invalid email or password").
But when the email doesn't exist, the slow bcrypt comparison is skipped, so the answer comes back about 4
times faster. The register endpoint also says plainly that an email is taken.

**How it could be abused.** A script sends a list of emails and sorts them by response time to learn who
uses the app. Then it can focus password guessing (SEC-02) or send convincing phishing messages to real users.

**How to fix it.** Always run one bcrypt comparison, even when there's no user:

```js
// auth.service.js
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', SALT_ROUNDS);

const found = rows[0];
const passwordMatches = await bcrypt.compare(password, found ? found.password_hash : DUMMY_HASH);
if (!found || !passwordMatches) {
  throw new HttpError(401, 'Invalid email or password');
}
```

The register message is a deliberate trade-off. Most apps tell users "this email is already registered"
because the alternative ("check your email to continue") needs an email-verification flow. Keep it, but
make sure SEC-02's rate limit also covers `/register`, so the answer can't be harvested in bulk.

**Lesson.** Identical error messages aren't enough. Response time, status codes and response size all have
to look the same, so an attacker can't tell "no such user" apart from "wrong password".

<a id="sec-06"></a>
## SEC-06: Uploaded photos are stored and served byte-for-byte (EXIF location kept)

- **Status: fixed in `feat/backend-cloud-storage`.** Every upload is re-encoded with `sharp` in its own format
  after the ML check and before storage: the EXIF orientation is applied, all metadata (EXIF incl. GPS, XMP,
  IPTC, ICC) and appended bytes are dropped, and an undecodable image gets `422`.
- **Severity: Low.** Proven, but the URLs are random UUIDs, so this mainly matters if a photo URL leaks.
  It's a privacy issue more than an attack.
- **Evidence:** proven live. The test JPEG contained an EXIF block (a camera tag plus GPS coordinates)
  and some HTML appended after the image data. After upload, the file at `/uploads/<uuid>.jpg` still
  contained the EXIF block and the appended HTML. It was served **without authentication**, as
  `image/jpeg`, **without** `X-Content-Type-Options: nosniff`.
- **Where:** `backend/src/modules/uploads/uploads.service.js:28` (writes the original bytes),
  `backend/src/modules/uploads/uploads.service.js:39` (public static serving)

**What's wrong.** The upload check correctly looks at the file's first bytes (JPEG/PNG/WebP only, SVG and
HTML are refused, and the client's filename and content type are ignored). But after that check, the
**original bytes** are saved. Phone photos usually contain EXIF metadata: precise GPS position, the time
taken, and the phone model. The mobile app happens to strip it (it re-encodes the photo with
ImageManipulator), but the API accepts uploads from any client.

**How it could be abused.**
- **Leaked photo URL:** anyone who gets hold of it (a screenshot, a log, a shared link) can download the
  photo and read where and when it was taken, and with what device, without logging in.
- **Hidden content:** data appended to an image can travel through the system unchanged. Modern browsers
  won't render an `image/jpeg` response as a web page, but without `nosniff` you're relying on that
  browser behavior rather than telling the browser explicitly.

**How to fix it.** Re-encode every upload on the server, which removes metadata and anything appended,
and add `nosniff`:

```js
// uploads.service.js (needs the `sharp` package)
const sharp = require('sharp');

async function saveImage(buffer) {
  // rotate() applies the EXIF orientation; re-encoding drops all metadata and trailing bytes
  const clean = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().jpeg({ quality: 85 }).toBuffer();
  const fileName = `${crypto.randomUUID()}.jpg`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), clean);
  return `${UPLOAD_URL_PREFIX}/${fileName}`;
}

const serveImages = express.static(UPLOAD_DIR, {
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
});
```

Whether `/uploads` should require login is a design choice. Random UUIDs are a reasonable protection for
a project like this, but say so in the README.

**Lesson.** Checking a file's type tells you what the file *says* it is, not what it *contains*. To make a
user's file safe to serve, decode it and save a fresh copy, so metadata and hidden extra data are dropped.

<a id="sec-07"></a>
## SEC-07: Missing HTTP security headers (backend and web)

- **Status: fixed in `security/http-headers`, except Content-Security-Policy (future work).** The backend uses
  `helmet` (nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, no `X-Powered-By`; CSP off and
  `Cross-Origin-Resource-Policy: cross-origin` so photos still load), covered by `security-headers.test.js`. The web
  app sets nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS and a
  `Permissions-Policy` blocking camera, microphone and geolocation in `next.config.ts`, with `poweredByHeader: false`.
  A script CSP needs nonces for Next.js and is not done yet.
- **Severity: Low.** Proven, but these headers are defense in depth. Each one makes a different class of
  bug harder to exploit; none is a vulnerability alone.
- **Evidence:** proven live.
  - **Backend** (`GET /api/health`): sends `X-Powered-By: Express`, and none of `X-Content-Type-Options`,
    `Referrer-Policy` or `Strict-Transport-Security`.
  - **Web** (`/login`, `/dashboard`): sends `X-Powered-By: Next.js`, and no `Content-Security-Policy`
    or `X-Frame-Options`.
- **Where:** `backend/src/app.js:13` (no `helmet`), `web/next.config.ts` (no `headers()` and no `poweredByHeader: false`)

**What's wrong.**
- **Technology advertised:** `X-Powered-By` tells attackers exactly which framework you run.
- **No Content Security Policy:** if an XSS bug ever appears, nothing limits which scripts can run.
- **No frame protection:** other sites can embed the admin panel in an iframe.

**How it could be abused.**
- **Clickjacking:** a hostile page loads the admin panel in an invisible iframe and tricks an admin into
  clicking a button. This is weaker here than usual, because the session cookie is `SameSite=Lax`, so it
  isn't sent inside a cross-site iframe and the framed panel would show the login page. Don't rely on that
  side effect, though.
- **Fingerprinting:** the framework name speeds up the search for a known bug in that framework.

**How to fix it.**

```js
// backend/src/app.js
const helmet = require('helmet');
app.disable('x-powered-by');
app.use(helmet()); // nosniff, frame-ancestors 'none', Referrer-Policy, HSTS (only matters over HTTPS), ...
// /uploads images are loaded by the web app from another origin:
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
```

```ts
// web/next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Start with frame-ancestors; a full script CSP with nonces can follow in the UI branch.
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; img-src 'self' http://localhost:4000 data:" },
      ],
    }];
  },
};
```

**Lesson.** Security headers cost almost nothing and turn many future bugs from exploitable into harmless.
Add them when you create the project.

<a id="sec-08"></a>
## SEC-08: Upload limits are checked late; multipart fields are unlimited

- **Status: fixed in `security/fix-ml-image-limits`.** The ML API refuses bodies over 5 MB from `Content-Length` before
  reading them, and stops chunked uploads as they pass the limit (live: a 20 MB upload now gets `413`
  after **0** body bytes, previously 20,000,197). The backend limits multipart text fields to 10 fields
  of 8 KB each. Tested in `ml/tests/test_limits.py` and `backend/tests/upload-limits.test.js`.
- **Severity: Low.** The file-size limits work, but a client can still make the server receive or hold
  much more data than it allows. Requires an account (backend) or direct access (ML).
- **Evidence:** partly proven live. A 20 MB upload got `413` from both services, but the client was allowed
  to send all 20 MB first. The unlimited form fields were found by **code review only**; I didn't send a
  memory-heavy request.
- **Where:** `backend/src/middlewares/upload.js:10` (only `fileSize` and `files` are limited),
  `ml/src/api/main.py:89-92` (size checked after FastAPI has parsed the whole form)

**What's wrong.**
- **Backend:** multer limits the file to 5 MB, but not the text fields. Busboy's defaults allow each text
  field up to 1 MB, with **no limit on how many** fields a request has, and they're all held in memory.
- **ML API:** FastAPI (via `python-multipart`) parses the whole multipart body, writing large parts to a
  temporary file, *before* `predict_image` runs and checks the 5 MB limit. A 1 GB upload is fully received
  and written to disk, then rejected.

**How it could be abused.** Sending a few requests with many large text fields (backend) or very large
bodies (ML) makes the server spend memory, disk and bandwidth on data it will throw away. That slows or
crashes the service.

**How to fix it.**

```js
// backend/src/middlewares/upload.js
limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10, fieldSize: 2_000, parts: 11 },
```

```python
# ml/src/api/main.py: reject by Content-Length before parsing (a reverse proxy limit is even better)
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if request.url.path == "/predict":
        length = request.headers.get("content-length")
        if length is None or int(length) > MAX_UPLOAD_BYTES + 64 * 1024:
            return error_response(413, "Image must be 5 MB or smaller")
    return await call_next(request)
```

In production, also set a body limit at the reverse proxy (for example nginx `client_max_body_size 6m;`),
which stops oversized requests before they reach Python or Node at all.

**Lesson.** Check a limit as early as you can: at the proxy, then from the request headers, then while
reading the body. Checking after the whole body has arrived doesn't protect anything.

<a id="sec-10"></a>
## SEC-10: No security event logging; category/note changes leave no history

- **Severity: Low.** Code review. It doesn't let anyone in, but if something goes wrong you can't see or
  reconstruct it. OWASP A09 can't be tested from outside; it can only be reviewed.
- **Where:**
  - `backend/src/middlewares/error-handler.js:23` (the only logging is for unexpected errors)
  - `backend/src/modules/auth/auth.service.js:50-55` (failed logins aren't logged)
  - `backend/src/modules/admin-reports/admin-reports.service.js:107-124` (a history row is written only when `status` changes)
  - `backend/src/modules/users/users.service.js:43` (deactivations aren't recorded)

**What's wrong.** Nothing records failed logins, 403 responses, or account deactivations. The report
status history is a good audit trail for status changes, but an admin can change a report's `category`
or `admin_note` without leaving any record of who changed it or when.

**How it could be abused.** Password guessing (SEC-02) or an admin misusing access would leave no trace.
If the AI-accuracy numbers on the dashboard look strange, there's no record of who changed the categories
behind them.

**How to fix it.** Log security events as structured lines, and record every admin change:

```js
// a tiny helper, e.g. backend/src/utils/security-log.js
function securityEvent(event, details) {
  console.log(JSON.stringify({ type: 'security', event, at: new Date().toISOString(), ...details }));
}
// auth.service.js:  securityEvent('login_failed', { email, ip });   (never log the password)
// users.service.js: securityEvent('user_active_changed', { userId, adminId, is_active });
```

For reports, either add a `report_changes` table (`report_id`, `changed_by`, `field`, `old_value`,
`new_value`, `created_at`), or let `report_status_history` also store category/note edits.

**Lesson.** Decide early which events you'd need to investigate an incident (logins, permission
denials, admin changes) and log them with who, what and when. Never log secrets.

<a id="sec-11"></a>
## SEC-11: 24-hour tokens that can't be revoked; no `iss`/`aud` claims

- **Severity: Low.** Proven. A stolen token stays valid for up to a day after logout, but stealing one
  needs another bug first (the web cookie is `httpOnly`, and mobile uses SecureStore).
- **Evidence:** proven live. The token header is `HS256`, the payload is `{ sub, role, iat, exp }`, and
  the lifetime is 24 h.
- **Where:** `backend/src/modules/auth/auth.service.js:11-16`, `backend/src/config/env.js:15`,
  `web/src/actions/auth.ts` (logout only deletes the cookie)

**What's wrong.** Tokens are stateless JWTs with no server-side list of revoked tokens. "Log out" removes
the token from the browser or phone, but the token itself keeps working until it expires. There are also
no `iss` (issuer) or `aud` (audience) claims, so if the same secret were ever reused by another service,
its tokens would be accepted here too.

Note what already limits the damage: `authenticate` loads the user from the database on every request,
so **deactivating an account works immediately** (proven by the existing tests). That's the most
important property, and it's already in place.

**How it could be abused.** If a token leaks (a shared device, a log line, a future XSS), whoever has it
can use it for the rest of the day, even after the real user logs out.

**How to fix it.** For this project, a shorter lifetime and pinned claims are enough:

```js
// auth.service.js
jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
  algorithm: 'HS256', expiresIn: '8h', issuer: 'swms-api', audience: 'swms-clients',
});
// middlewares/auth.js
jwt.verify(token, jwtSecret, { algorithms: ['HS256'], issuer: 'swms-api', audience: 'swms-clients' });
```

For real revocation, add a `token_version` integer column to `users`, put it in the token, compare it in
`authenticate` (the user is already loaded there), and increment it on logout or password change.

**Lesson.** A JWT is valid until it expires; there's no built-in way to cancel it. Keep tokens
short-lived, and if logout must really end a session, check something on the server for every request.

<a id="sec-14"></a>
## SEC-14: Error-handling gaps: big JSON gives 500, a bad image gives 503

- **Status: fixed in `security/fix-ml-error-mapping`.** ML `400`/`413`/`415` now become `422` with
  "The photo couldn't be processed. Try another photo." on the `image` field. Only network errors, timeouts, ML
  `5xx` and other unexpected statuses give `503` ("AI service unavailable"), and the ML API's own error text is
  never passed on. A JSON body over 100 KB now gets `413` instead of `500`. Tested in `ml.service.test.js`,
  `reports.test.js` and `error-handler.test.js`; the mobile app shows the photo message under the photo.
- **Severity: Low.** Proven. Nothing leaks (bodies stay generic), but the status codes are wrong, which
  confuses clients and hides attacks in the logs.
- **Evidence:** proven live.
  - **Big JSON:** a 120 KB JSON login body returned `500 Internal server error`.
  - **Bad image:** a file with JPEG magic bytes but no real image data returned
    `503 Classification service is unavailable`, while the ML API had answered `415 Unsupported file type`.
- **Where:** `backend/src/middlewares/error-handler.js:19-25`, `backend/src/modules/ml/ml.service.js:48-53`

**What's wrong.**
- **Big JSON:** `express.json()` correctly refuses bodies over 100 KB, but the error handler only
  recognizes the "bad JSON" error type, so "too large" falls through to the generic 500 path.
- **Bad image:** the ML client turns every non-OK response into "service unavailable", including the ML
  API saying "this isn't an image".

**How it could be abused.** Not directly. But someone sending oversized bodies on purpose shows up as
"server errors" in monitoring, and users who upload a broken photo are told to "try again", which can
never work.

**How to fix it.**

```js
// error-handler.js
if (err.type === 'entity.too.large') {
  return sendError(res, 413, 'Request body is too large');
}

// ml.service.js: pass the ML API's "bad image" answers through as 422
if (response.status === 400 || response.status === 415) {
  throw new HttpError(422, 'The photo could not be read as an image. Take a new photo and try again');
}
```

**Lesson.** Map each kind of failure to an accurate status code: 4xx means "your request is wrong",
5xx means "we failed". Correct codes make your logs and alerts useful.

<a id="sec-15"></a>
## SEC-15: Any admin can deactivate every other admin

- **Severity: Low.** Code review. Only an admin can do this, and there's only one admin today. It's a
  design gap, not a hole.
- **Where:** `backend/src/modules/users/users.service.js:39` (only self-deactivation is blocked)

**What's wrong.** `PATCH /api/admin/users/:id` stops an admin from deactivating themselves, but any admin
can deactivate any *other* admin. With two admins, one could lock out the other. If that admin's account
were compromised (see SEC-01), the attacker could lock out every real admin and keep control.

**How to fix it.** Decide on a rule and enforce it on the server, for example "admins can only manage
regular users":

```js
const { rows } = await query('SELECT role FROM users WHERE id = $1', [userId]);
if (rows[0]?.role === 'admin') {
  throw new HttpError(403, 'Admins cannot deactivate other admins');
}
```

**Lesson.** For every admin action, ask whether one admin could use it against another, and whether the
system can always recover (keep at least one working admin, or have a "break glass" procedure).

---

# ML API findings (FastAPI)

<a id="sec-03"></a>
## SEC-03: ML API can be made to use gigabytes of memory with one small image

- **Status: fixed in `security/fix-ml-image-limits`.** Dimensions are read from the header and checked before decoding (max
  24 million pixels), `Image.MAX_IMAGE_PIXELS` is set explicitly with its warning turned into an error, and
  broken files get a clean 400/415. Preprocessing is unchanged (the Colab parity tests still pass).
  Proven by `ml/tests/test_limits.py`; live, a 65-byte PNG claiming 30,000 × 30,000 now gets `400`.
  Through the backend this still shows as `503` until SEC-14 is fixed.
- **Severity: Medium.** Anyone can register an account and upload a photo, and the backend forwards it to
  the ML API, so any account can trigger this. Impact is a crash or an out-of-memory kill of the
  classifier (reports can't be created). **Not proven live:** I didn't send it, because running it would
  have meant exhausting this machine's memory.
- **Where:** `ml/src/api/main.py:65` (`Image.open` with Pillow's default limit),
  `ml/src/api/main.py:75` (`image.load()` decodes the full image), `ml/src/inference/predictor.py:26`
  (converts the full-size image to `float32`)

**What's wrong.** Image formats are compressed. A PNG that's mostly one color can be well under the 5 MB
upload limit and still claim to be, for example, 13,000 × 13,000 pixels. Pillow only *refuses* images over
about **179 million pixels**; between about 89M and 179M it only prints a warning. The code then:

1. decodes the whole image: 13,000 × 13,000 × 3 bytes ≈ **0.5 GB**
2. converts it to `float32` before resizing: four times bigger, ≈ **2 GB**
3. and only *then* resizes it to 224 × 224.

The model only needs 224 × 224 pixels, so almost all of that memory is wasted.

**How it could be abused.** A few such uploads at the same time (each about 1 MB) push the ML process into
gigabytes of memory, and the operating system kills it. Every report submission then fails with 503
until someone restarts the service. This is a "decompression bomb", a classic denial-of-service.

**How to fix it.** Limit pixels before decoding, and shrink the image *before* converting to floats:

```python
# ml/src/api/main.py
MAX_PIXELS = 40_000_000           # about 40 MP: more than any phone camera
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

def open_image(data: bytes) -> Image.Image:
    ...
    image = Image.open(BytesIO(data))          # reads only the header, cheap
    width, height = image.size
    if width * height > MAX_PIXELS:
        raise HTTPException(status_code=400, detail="Image dimensions are too large")
    image.draft("RGB", (448, 448))             # JPEG: decode at reduced size directly
    image.load()
    return image

# ml/src/inference/predictor.py: shrink first, then convert
image = ImageOps.exif_transpose(image).convert("RGB")
image.thumbnail((448, 448))                    # bounded size before numpy/float32
pixels = np.asarray(image, dtype=np.float32)
```

Also turn Pillow's warning into an error (`warnings.simplefilter("error", Image.DecompressionBombWarning)`),
and add a test with a small file that declares huge dimensions. Then the fix branch can *prove* the 400
without actually allocating gigabytes.

**Lesson.** Never trust the size an image (or archive) *declares* to match the size of its bytes. Check the
declared dimensions before decoding, and keep every intermediate buffer bounded.

<a id="sec-09"></a>
## SEC-09: ML `/predict` has no authentication; `/docs` is public

- **Status: fixed in `feat/ml-lite-runtime`.** With `ML_API_KEY` set, `/predict` requires a matching
  `X-API-Key` header (constant-time compare, checked before the body is read) or answers `401`; `ML_DISABLE_DOCS=1`
  removes `/docs`, `/redoc` and `/openapi.json`. In production the ML service also has no public domain.
- **Severity: Low.** Proven, but the documented start command binds to `127.0.0.1`, so only processes on
  the same machine can reach it. It becomes Medium if the ML API is ever deployed with a public URL.
- **Evidence:** proven live. `POST /predict` with no `X-API-Key` header returned a normal prediction, and
  `GET /docs` returned `200`.
- **Where:** `ml/src/api/main.py:88` (no dependency checking a key), `backend/src/modules/ml/ml.service.js:37`
  (the backend already sends `X-API-Key` when `ML_API_KEY` is set)

**What's wrong.** The backend supports sending an API key, but the ML API never checks one. The backend
README suggests `ML_API_KEY` "for a hosted ML API", which would give a false sense of protection: the key
is sent and ignored.

**How it could be abused.** If the ML API were deployed publicly, anyone could use it as a free
classification service (CPU cost) and send it decompression bombs (SEC-03) directly, with no account and
no rate limit.

**How to fix it.**

```python
# ml/src/api/main.py
import os, secrets
from fastapi import Depends, Header

API_KEY = os.environ.get("ML_API_KEY")  # unset = local development, no key required

def require_api_key(x_api_key: str | None = Header(default=None)):
    if API_KEY and not secrets.compare_digest(x_api_key or "", API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.post("/predict", dependencies=[Depends(require_api_key)], ...)
```

In production, also set `FastAPI(docs_url=None, redoc_url=None)`, or keep the ML API on a private network
that only the backend can reach.

**Lesson.** An internal service is only internal if the network makes it so. If it can ever be reached
from outside, it needs its own authentication. `secrets.compare_digest` compares keys without leaking
information through timing.

<a id="sec-16"></a>
## SEC-16: `keras 3.13.2` has known advisories (not reachable here)

- **Severity: Low.** `pip-audit` reports 15 advisory entries (8 unique) for `keras 3.13.2`. Every one needs
  the attacker to supply a **model file or archive** for Keras to load. This app only loads its own
  committed model at startup and never loads user files with Keras, so none of them is reachable.
- **Where:** `ml/requirements.txt` (`keras==3.13.2`)

**What's wrong.** The advisories (for example CVE-2026-11816, CVE-2026-12479, CVE-2026-12481, CVE-2026-12570)
cover path traversal while extracting archives, `Lambda`-layer and pickle deserialization that bypasses
`safe_mode`, HDF5 file reads, and a DoS in `load_model`. They matter for apps that load models from users
or the internet.

**How it could be abused.** Only if someone could replace `ml/models/swms_mobilenetv2_best.keras` (for
example a malicious pull request swapping the model file), and at that point they could already change the
code.

**How to fix it.** On the next retrain, move to `keras>=3.15.0` (it fixes all of them), re-save the model,
and run the existing ML tests. Until then, keep treating the model file like code: review changes to it.
The `requirements.txt` comment already explains why keras is pinned, which is good practice.

**Lesson.** Read each advisory to see whether *your* code can trigger it before you panic or ignore it.
Model files are code: loading an untrusted model is like running an untrusted script.

---

# Web admin findings (Next.js)

What was checked and **held up** (details under "Things done right"):
- **Cookie flags:** `HttpOnly; SameSite=Lax`, plus `Secure` in production (proven).
- **CSRF on Server Actions:** a Server Action posted with a foreign `Origin` was refused, with no cookie set (proven).
- **Open redirects:** none. `?reason=` only picks a message, there's no `next=` parameter, and `//host` paths stay on the site (proven).
- **XSS:** markup in a report's address and description was rendered as text (proven).
- **`NEXT_PUBLIC_*`:** only the API URL is in the browser bundle (proven).
- **`proxy.ts`:** forged cookies get past the proxy but are rejected by the backend (proven in the auth branch).

The proxy only reads the token's payload; it can't verify the signature, because the secret stays on the
backend. That's fine because the proxy is only a fast first filter: every admin page asks the backend
(`/api/auth/me`) to verify the token. Keep it that way. **Never** make an access decision based only on
what the proxy decoded.

<a id="sec-13"></a>
## SEC-13: Anyone can log an admin out with a link

- **Severity: Low.** Proven, but the worst outcome is an annoyance: the admin has to log in again. No data
  is exposed or changed.
- **Evidence:** proven live. `GET /login?reason=expired` sent with a valid admin cookie returned
  `Set-Cookie: swms_admin_token=; Expires=1970…`, which deletes the session.
- **Where:** `web/src/proxy.ts:13`

**What's wrong.** To handle sessions that end during a page render, the proxy deletes the cookie whenever
`/login` is opened with any `?reason=`. A plain link or image tag on any other website can trigger a GET
request, so any site can log the admin out. ("Logout CSRF".)

**How it could be abused.** A page the admin visits could keep logging them out, which is a nuisance. In
some apps, a forced logout is the first step of a login phishing trick ("your session expired, sign in
again" on a look-alike page).

**How to fix it.** Only clear the cookie for `?reason=` when the token is *actually* unusable, and keep
the real logout as the POST Server Action it already is:

```ts
// web/src/proxy.ts
if (pathname === "/login") {
  if (token !== undefined && !hasValidSession) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE); // expired or forged: always safe to clear
    return response;
  }
  if (hasValidSession && !searchParams.has("reason")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next(); // valid cookie + ?reason: show the page, keep the cookie
}
```

For the "backend said 401/403 during a render" case, redirect to a dedicated POST-only route handler
(for example `/api/session/end`) instead, or let the next Server Action clear the cookie.

**Lesson.** Any GET request can be triggered by another website, so GET requests must never change state:
not logout, not deletes, not settings.

<a id="sec-18"></a>
## SEC-18: "Deactivated" is detected from the error message text

- **Severity: Info.** Code review. It fails safely: if the message ever changes, the admin is still logged
  out; they just see "no longer has admin access" instead of "deactivated".
- **Where:** `web/src/lib/session.ts:35`

**What's wrong.** The backend uses `403` for two different situations, "account is deactivated" and "you
are not an admin". The web app tells them apart by looking for the word "deactivated" in the message. If
someone rewords or translates the message, the wrong explanation appears.

**How to fix it.** Give errors a stable, machine-readable code next to the human message:

```js
// backend: new HttpError(403, 'Account is deactivated', null, 'ACCOUNT_DEACTIVATED')
// error body: { error: { code: 'ACCOUNT_DEACTIVATED', message: '...', details: null } }
// web:        error.code === 'ACCOUNT_DEACTIVATED' ? 'deactivated' : 'forbidden'
```

**Lesson.** Messages are for people and codes are for programs. Don't write program logic that depends on
text a person might reword.

---

# Mobile findings (Expo)

What was checked and **held up**:
- **Token storage:** `expo-secure-store` (iOS Keychain / Android Keystore), not AsyncStorage
  (`Mobile/src/store/session.tsx:56`).
- **Secrets in the bundle:** none. The only build-time value is `EXPO_PUBLIC_API_URL`
  (`Mobile/src/constants/api.ts:3`), and there are no API keys or hardcoded backend URLs in the source.
  The only other URL is a Google Maps link.
- **Photo metadata:** photos are re-encoded with ImageManipulator before upload, which drops EXIF
  metadata. (The server should still do this itself; see SEC-06.)
- **Debug logging:** `console.warn` of request errors only runs in `__DEV__`
  (`Mobile/src/lib/api.ts:100`) and never logs the token.

Not checked: an actual release build (APK/IPA) was not built or decompiled. This review covers the source
and `app.json`.

<a id="sec-12"></a>
## SEC-12: Mobile app talks to the backend over plain HTTP

- **Severity: Low.** Code review. Today it's a development setup on a home network. It becomes High if a
  release ships with an `http://` backend URL.
- **Where:** `Mobile/.env.example:5` (`EXPO_PUBLIC_API_URL=http://192.168.1.10:4000`), and the backend has
  no HTTPS setup

**What's wrong.** The app sends the login password and the bearer token to `http://…`, so anyone on the
same Wi-Fi network can read them. Android release builds block plain-HTTP traffic by default (Android 9+),
so a release build would usually fail rather than leak, unless someone "fixes" that by turning on
`usesCleartextTraffic`.

**How it could be abused.** On shared Wi-Fi (a campus, a café), another device on the network can capture
traffic and read the password or token from a login request.

**How to fix it.** Use HTTPS for anything beyond your own desk: deploy the backend behind HTTPS (most hosts
do it automatically), or for testing on a phone, use an HTTPS tunnel. Make the app refuse `http://` in
production builds:

```ts
// Mobile/src/constants/api.ts
if (!__DEV__ && API_URL.startsWith("http://")) {
  throw new Error("EXPO_PUBLIC_API_URL must use https:// in release builds");
}
```

Never turn on `usesCleartextTraffic` / `NSAllowsArbitraryLoads` to "make it work".

**Lesson.** Encryption in transit isn't optional once real users and real networks are involved. Make the
secure setting the only one a release build accepts.

---

# Repository-wide findings (secrets, dependencies, configuration)

**Secret scan of the full git history (all branches): clean.**
- **Files:** the only env-style files ever committed are the three `.env.example` templates. No `.env`,
  key, certificate, keystore or credentials file appears in any commit.
- **Content:** searching every added line in history for connection strings with passwords, Neon
  `npg_` tokens, JWT secrets, private keys, AWS/GitHub/OpenAI/Slack/Google key formats and API-key
  assignments found only false positives (base64 images inside a notebook).
- **Passwords in code:** only test fixtures and the documented demo accounts (see SEC-01).

**Dependency scans** (2026-11-04):

| Project | Tool | Result |
|---|---|---|
| `backend/` | `npm audit` | **0** vulnerabilities |
| `web/` | `npm audit` | 16 moderate, all in ESLint tooling (SEC-17) |
| `Mobile/` | `npm audit` | 21 moderate, all in ESLint/Expo CLI tooling (SEC-17) |
| `ml/` | `pip-audit` (installed venv) | 15 entries, all in `keras 3.13.2` (SEC-16) |

<a id="sec-17"></a>
## SEC-17: `npm audit`: moderate issues in dev tooling only

- **Severity: Info.** None of the affected packages is in the code that runs for users: no Next.js server
  or client bundle, and no Expo app runtime. They run on a developer's machine during linting or builds.
- **Where:** `web/package.json` (`eslint`, `eslint-config-next`), `Mobile/package.json` (`eslint-config-expo`,
  `expo`/`@expo/cli` tooling)

**What's wrong.** The advisories are `minimatch` ReDoS (GHSA-g3hv-75wg-m249) and `glob` (GHSA-3g3m-2fjr-6pw4),
pulled in by ESLint plugins and the Expo CLI. `npm audit fix --force` would *downgrade* to ancient major
versions (`eslint@4`, `expo@51`), which is worse.

**How to fix it.** Don't force-fix. Update `eslint-config-next` and the Expo SDK when new versions ship,
and re-run `npm audit`. To keep the signal clean, check runtime dependencies separately:

```bash
npm audit --omit=dev
```

**Lesson.** Treat audit output like a to-do list you check, not an alarm. Ask "does this code run in
production, and can attacker input reach it?" A forced fix that downgrades major versions usually adds risk.

<a id="sec-19"></a>
## SEC-19: Small hardening notes

- **Severity: Info.** Code review. None is a vulnerability; each makes the project a bit sturdier.

1. **bcrypt cost 10** (`backend/src/modules/auth/auth.service.js:7`). Still acceptable (OWASP's minimum).
   Consider 12 when you next touch auth. Login gets about 4× slower, which is fine for a login, and
   guessing gets 4× more expensive.
2. **`JWT_SECRET` is only length-checked** (`backend/src/config/env.js:8`). A 32-character secret like
   `aaaaaaaa…` passes. Generate it the way `.env.example` says (`crypto.randomBytes(48)`); a startup check
   for obviously repeated characters is optional.
3. **`Mobile/.gitignore` only ignores `.env*.local`** (`Mobile/.gitignore:34`). `Mobile/.env` is
   protected only because the root `.gitignore` ignores `.env`. If `Mobile/` were ever copied into its own
   repo, `.env` would no longer be ignored. Add `.env` to `Mobile/.gitignore` too.
4. **`proxy.ts` decodes the JWT without verifying it** (`web/src/lib/token.ts`). That's by design (see the
   web section): it's a fast filter, and the backend is the real check. Keep a comment there so nobody
   later trusts its result for access decisions.

**Lesson.** Defense in depth is many small, cheap layers. Each one only has to catch what the others miss.

---

# Things done right (keep doing these)

These protections were **verified**, most of them live. They're the reason there are no Critical findings.

**Injection (A05)**
- **Every SQL query uses `$1, $2 …` placeholders**, never string concatenation (`backend/src/db/pool.js:16`
  states the rule). A search for `' OR 1=1 --` returned 0 results instead of everything.
- **LIKE wildcards are escaped** (`backend/src/utils/like-pattern.js`). A search for `%` matched 0 of 2
  reports instead of all of them. Most projects miss this one.

**Authentication (A07)**
- **The JWT algorithm is pinned** (`algorithms: ['HS256']`). Live checks: an `alg: none` token claiming
  admin got `401`, and a token whose payload was edited to `role: admin` got `401`.
- **`JWT_SECRET` must be at least 32 characters** or the server refuses to start.
- **The token payload is minimal** (`sub`, `role`, `iat`, `exp`), with no email or personal data.
- **The user is reloaded from the database on every request.** Deactivation and role changes take effect
  immediately, and the role used for permission checks comes from the database, not from the token.
- **bcrypt is used, with a 72-character maximum**, which avoids bcrypt's silent truncation of longer
  passwords. Login only says "deactivated" *after* a correct password, so that message doesn't reveal accounts.

**Access control (A01 / API1 / API5)**
- **Admin routers apply `authenticate` and `authorizeRole('admin')` to the whole router**, so a new admin
  route can't forget the check. Live: a user token got `403` on every admin route, and no token got `401`.
- **Object ownership is part of the SQL `WHERE`** (`user_id = $2 OR role = 'admin'`), and the API answers
  `404` rather than `403`, so report IDs can't be probed. Live: user B got `404` on the demo user's report,
  and the owner got `200`.
- **Users never see who changed their report** (`changed_by` is left out of the user view).

**Mass assignment and validation (API3)**
- **zod schemas allowlist fields and drop unknown keys.** Live:
  - Creating a report with extra `status`, `category`, `user_id`, `admin_note` and `ai_confidence` fields
    stored none of them.
  - An admin PATCH containing only `ai_predicted_category` and `user_id` was rejected.
  - A PATCH sending `role: admin` was rejected.
- **The category comes from the ML model**, and AI fields can never be edited.
- **Status changes follow server-side rules** with a `SELECT … FOR UPDATE` row lock, and final states are locked.
- **Lists are bounded:** `limit` is capped at 50 and searches at 100 characters (API4).

**File upload**
- **The file type comes from the file's first bytes**, not from the filename or the client's content type.
  Live: SVG was refused, and SVG renamed to `.jpg` with `image/jpeg` was refused.
- **Files get random UUID names with an extension chosen by the server.** The client's filename
  (`../../evil.html` in the test) is ignored. Deletes use `path.basename`, and `express.static` is safe
  against path traversal.
- **The upload is held in memory until it's validated**, `authenticate` runs **before** multipart parsing
  (anonymous users can't upload anything), and classification runs **before** saving, so a failed
  classification leaves no file or row. Live: with the ML API down, report creation got `503` and the
  report count was unchanged.

**Error handling and configuration (A02 / A10)**
- **Errors have one consistent shape** with generic messages. Live: no stack traces, SQL or file paths
  leaked for malformed JSON, unknown routes, bad UUIDs or ML outages. The ML failure reason is logged, not returned.
- **CORS uses an allowlist.** Live: a foreign `Origin` got no `Access-Control-Allow-Origin` header, and
  the configured origin was allowed.
- **No `.env` has ever been committed**, the templates document every variable, and the ML API binds to
  `127.0.0.1` by default.

**Web admin**
- **The token never reaches browser JavaScript:** the Next server calls the backend, and the session is an
  `HttpOnly; SameSite=Lax` cookie that expires with the token.
- **Server Actions** come with Next's built-in Origin check (live: a foreign Origin was refused). Non-admin
  accounts are rejected **before** any cookie is set, and `server-only` keeps server code out of the bundle.
- **No `dangerouslySetInnerHTML`.** React escaping was verified live with markup in report fields, and the
  only public environment variable is the API URL.

**Mobile, ML, dependencies and tests**
- **Mobile:** the token is in SecureStore, photos are re-encoded before upload, and logging is dev-only.
- **ML:** a format allowlist after decoding, a full decode to catch corrupt files, a generic 500 handler,
  pinned dependency versions with a reason, and Keras `safe_mode` loading (the default).
- **Dependencies:** the backend has **zero** known vulnerabilities, and lockfiles are committed.
- **Tests:** 98 backend tests, including authorization tests (`authorize-role.test.js`, `admin-*.test.js`).

---

# What was NOT covered

Following the "be honest about coverage" rule:

- **The real `JWT_SECRET` value.** I don't read `backend/.env`; only the length check in code was reviewed.
  Make sure it was generated randomly (SEC-19).
- **Memory denial-of-service tests weren't run live:** the decompression bomb (SEC-03) and many-fields
  multipart (SEC-08). Both are from code review and library defaults, because running them would mean
  exhausting this machine's memory.
- **Brute force at scale:** only 10 login attempts were made (by agreement), which proves there's no limit
  but doesn't measure how fast guessing could go.
- **Deployment and infrastructure:** nothing is deployed yet, so HTTPS/TLS, the reverse proxy, host
  hardening, Neon network rules, **database role privileges** (whether the app connects as the owner role),
  backups and secret management on the host were not reviewed.
- **Mobile release build:** no APK/IPA was built or decompiled, and nothing ran on a device. The deep-link
  scheme (`mobile`) wasn't explored.
- **Web pages not built yet:** `/reports/[id]` (including the status/category/note Server Action) and
  `/users`. Re-check authorization, input validation and `revalidatePath` when they're added.
- **Logging and alerting (A09):** there's no logging pipeline to review, only the code (SEC-10).
- **Race conditions:** reviewed in code (`FOR UPDATE`), not load-tested.
- **Supply chain beyond the audits:** there's no CI, so GitHub repository settings, branch protection,
  Actions permissions and lockfile integrity checks weren't reviewed.
- **ML training scripts, notebooks and the dataset:** offline tooling that never handles user input, so
  it was out of scope.
- **Timebox:** the audit finished within the ~1.5 hour timebox. The gaps above are scope limits, not time cuts.

---

# Test data created during this audit

Every record has `SECURITY-TEST` in a visible field. Nothing else was changed: every admin `PATCH`
attempt above failed validation, and the web login checks created no database rows.

| Type | ID | Visible marker |
|---|---|---|
| User (role `user`) | `be6002b7-f12a-4cfe-b4da-93bd625b322a` | name `SECURITY-TEST User B`, email `security-test-b@example.com` |
| Report | `97b77372-e7dd-4305-a609-74d1e2fa0823` | description `SECURITY-TEST mass-assignment + EXIF + polyglot`. Image `backend/uploads/e1ce1413-7797-4fd2-8116-263a6cbf5132.jpg` |
| Report | `39a62a7d-2a1a-44f3-9028-6e0fa8de407e` | description and address start with `SECURITY-TEST`. Image `backend/uploads/e5309096-ee2d-4d48-a3c8-60fce39e68a3.jpg` |
| Status history | one `pending` row per report above | removed automatically with the report (`ON DELETE CASCADE`) |

Clean-up SQL (**not run**; review it, then run it in the Neon SQL editor):

```sql
BEGIN;

-- The two SECURITY-TEST reports. Their report_status_history rows are deleted by ON DELETE CASCADE.
DELETE FROM waste_reports
WHERE id IN ('97b77372-e7dd-4305-a609-74d1e2fa0823', '39a62a7d-2a1a-44f3-9028-6e0fa8de407e')
  AND user_id = 'be6002b7-f12a-4cfe-b4da-93bd625b322a';

-- The SECURITY-TEST user (must come after the reports: users are ON DELETE RESTRICT).
DELETE FROM users
WHERE id = 'be6002b7-f12a-4cfe-b4da-93bd625b322a'
  AND email = 'security-test-b@example.com';

COMMIT;
```

Then delete the two image files listed above from `backend/uploads/`.
