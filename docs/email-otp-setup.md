# Email verification (OTP) setup: EmailJS + Railway

Email verification is **off** until `OTP_ENABLED=true`. While it's off, registration and login work exactly as
before. Turn it on only after the steps below. Everything happens on the backend: the app only submits the
6-digit code, and the EmailJS private key never leaves Railway.

## How it works

1. `POST /api/auth/register` creates the account **unverified**, stores an HMAC of a random 6-digit code
   (never the code itself; 10-minute expiry; max 5 wrong tries) and emails the code through the EmailJS REST
   API. It answers `201 { user, verification_required: true }` with **no token**. If EmailJS fails, the
   account is removed again and the answer is `503`.
2. The app shows the code screen. `POST /api/auth/verify-email { email, code }` → `200 { user, token }`.
3. `POST /api/auth/resend-code { email }` sends a new code (resetting the attempts) at most once per 60 s (`429`
   with `Retry-After` otherwise). Unknown or already verified emails get the same `200` answer, and no email.
4. Login of an unverified account → `403 Email not verified` (the app opens the code screen).
5. Rate limits: verify 20/15 min per IP, resend 10/hour per IP, register 10/hour per IP (unchanged).

Migration **003** must run first. Existing accounts (demo, admin, every current user) are verified by it,
because the column defaults to `true`.

## 1. EmailJS (dashboard.emailjs.com)

1. **Email Services → Add New Service**: connect the mailbox that sends the codes (e.g. Gmail). Note the
   **Service ID** (`service_xxxxxxx`).
2. **Email Templates → Create New Template**. Note the **Template ID** (`template_xxxxxxx`). Settings:
   - **To Email:** `{{to_email}}` (important: otherwise every code goes to your own inbox)
   - **From Name:** `SWMS`
   - **Subject:** `Kode verifikasi SWMS: {{code}}`
   - **Content**, for example:

     ```
     Halo {{to_name}},

     Kode verifikasi akun SWMS kamu: {{code}}

     Berlaku {{expires_minutes}} menit. Jangan bagikan kode ini ke siapa pun.
     Kalau kamu tidak mendaftar di SWMS, abaikan email ini.
     ```

   Variables the backend sends: `to_email`, `to_name`, `code`, `expires_minutes`.
3. **Account → Security**: turn ON **"Allow EmailJS API for non-browser applications"**. Without it, EmailJS
   rejects server calls with 403 and registration answers 503. Also turn on **"Use Private Key"**, so calls
   need the private key.
4. **Account → General (API keys)**: copy the **Public Key** and the **Private Key**.

## 2. Railway (backend service → Variables)

| Variable | Value |
|---|---|
| `EMAILJS_SERVICE_ID` | `service_xxxxxxx` |
| `EMAILJS_TEMPLATE_ID` | `template_xxxxxxx` |
| `EMAILJS_PUBLIC_KEY` | the Public Key |
| `EMAILJS_PRIVATE_KEY` | the Private Key (secret) |
| `OTP_ENABLED` | `true`, **last**, after the four above are set and migration 003 has run |

With `OTP_ENABLED=true` and any of the four missing, the backend refuses to start, so a half-configured deploy
fails loudly instead of silently. To switch verification off again, set `OTP_ENABLED=false` (or delete it).
Accounts that never verified can then sign in normally.

## 3. Check

Register a new account in the app with a real inbox. The code should arrive within seconds. Enter it, and you're
signed in. Check Railway's logs for `EmailJS answered ...` if nothing arrives.
