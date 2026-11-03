# SWMS Mobile — waste reporting app

React Native app (Expo SDK 58, Expo Router, TypeScript) for **citizens (role `user`)**. Users take a
photo of waste, the app adds their GPS location, and the backend's AI classifies it as **organic,
paper or plastic**. Users can then follow the status of their reports.

Admins don't use this app — they use the web dashboard (an admin who logs in here gets a message
saying so).

## Features

- **Account:** register, log in, log out; the session is restored on app start (token stored in
  `expo-secure-store`). If the server can't be reached at start, the app shows "Try again" instead
  of logging you out.
- **New report:** photo from the camera or the gallery, GPS location (with permission handling),
  optional address (filled in automatically from the location, editable), description. After
  submitting, the app shows the **AI category and confidence**.
  - The photo is resized (longest side 1600 px) and saved as JPEG before upload, so it stays far
    below the 5 MB limit (iPhone HEIC photos are converted too).
  - If the AI service is unavailable (`503`), nothing is saved and the form keeps everything you
    entered — just tap **Submit report** again.
- **My reports:** your reports, newest first, with a status filter (All, Pending, In progress,
  Completed, Rejected), pull to refresh and loading more while scrolling.
- **Report detail:** photo, status, AI category and confidence (and the AI's original suggestion if
  an admin corrected the category), the admin's note, address and coordinates with **Open in Maps**,
  and the status timeline.

Every screen has loading, empty and error states. The app runs on **Android and iOS via Expo Go**;
the web version only shows "Please use the mobile app".

## Requirements

- Node.js 22+
- The **Expo Go** app (SDK 58) on your phone
- The SWMS **backend** running on your computer on **port 4000** (see [`../backend/README.md`](../backend/README.md)),
  and the **ML API** it uses (see [`../ml/README.md`](../ml/README.md)) — without it, submitting a
  report returns "classification service is unavailable"
- Phone and computer on the **same Wi-Fi network**

## Setup

From `Mobile/`:

```bash
npm ci
cp .env.example .env
```

Set your computer's **LAN IP** and the backend port in `Mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.51:4000
```

Then start Expo and scan the QR code with Expo Go (Android) or the Camera app (iOS):

```bash
npx expo start
```

After changing `.env`, restart Expo with a clean cache: `npx expo start -c`.

### The LAN IP — why not `localhost`?

The app runs **on your phone**, so `localhost` would mean the phone itself. Use your computer's
address on the Wi-Fi network:

- **Windows:** run `ipconfig` and use the **IPv4 Address** under **Wireless LAN adapter Wi-Fi**
  (e.g. `192.168.1.51`). Ignore addresses of virtual adapters such as `vEthernet (WSL)`.
- **macOS:** `ipconfig getifaddr en0`

The IP can change when you reconnect to Wi-Fi — if the app suddenly can't reach the server, check it
again.

**The backend must listen on port 4000:** set `PORT=4000` in `backend/.env` (the backend's default is
3000) and start it with `npm run dev` in `backend/`.

**Check from your phone first:** open `http://<your IP>:4000/api/health` in the phone's browser. You
should see `{"status":"ok"}`. If it doesn't load, it's a network or firewall problem, not the app.

### Windows Firewall (port 4000)

Windows blocks incoming connections to the backend by default, so the phone can't reach it.

1. Make sure your **home** Wi-Fi is set to **Private** (Settings → Network & internet → Wi-Fi → your
   network → Network profile type → Private). Don't open ports on public networks (cafés, campus).
2. Allow port 4000 on private networks only — run once in **PowerShell as Administrator**:

   ```powershell
   New-NetFirewallRule -DisplayName "SWMS backend (4000)" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private
   ```

   Remove it later with `Remove-NetFirewallRule -DisplayName "SWMS backend (4000)"`.

If Expo Go can't load the app itself (the QR code step), Windows may also be blocking Expo's port
**8081** — allow Node.js when Windows asks, or start Expo with `npx expo start --tunnel`.

## Demo account

The backend's seed script (`npm run seed` in `backend/`) creates this user:

| Role | Email | Password |
|---|---|---|
| `user` | `kaseg88634@macsnipe.com` | `Password123!` |

You can also create a new account with **Create one** on the login screen.

## Scripts

| Command | What it does |
|---|---|
| `npx expo start` | Start the dev server (scan the QR code with Expo Go) |
| `npm run lint` | ESLint (`expo lint`) |
| `npx tsc --noEmit` | Type check |

## Project structure

```
src/
  app/                         Expo Router screens (every file is a route)
    _layout.tsx                session + protected routes (logged in → (app), logged out → (auth))
    (auth)/login.tsx, register.tsx
    (app)/_layout.tsx          tabs: My reports | New report | Account
    (app)/(home)/index.tsx     My reports list
    (app)/(home)/reports/[id].tsx  report detail
    (app)/new.tsx              create a report
    (app)/account.tsx          account and log out
  components/ui/               Button, TextField, Screen, loading/error/empty states
  components/reports/          list item, status badge, status filter, status timeline
  constants/                   API URL (from EXPO_PUBLIC_API_URL) and theme
  lib/                         API client + error helper, location, photo resizing
  services/                    typed API calls (auth, reports)
  store/session.tsx            login state and secure token storage
  types/api.ts                 backend response types
  utils/                       labels and dates, image URL helper
```

Images from the backend come as a relative `image_url` (e.g. `/uploads/<uuid>.jpg`);
`utils/image-url.ts` puts `EXPO_PUBLIC_API_URL` in front (absolute URLs are used as they are).

## Manual test checklist

1. Phone browser shows `{"status":"ok"}` at `http://<your IP>:4000/api/health`.
2. Log in with the demo user → **My reports** opens. Log in with an admin → message "Admins use the
   web dashboard".
3. Close and reopen the app → still logged in. Stop the backend and reopen → "Can't reach the
   server" with **Try again**.
4. **New report:** allow location → coordinates (and usually an address) appear. Take a photo,
   write a description, submit → the AI category and confidence are shown.
5. Stop the ML API and submit again → "classification service is unavailable", and the form is
   still filled in. Start it again and resubmit → success.
6. Deny the location or camera permission → a clear message with **Try again** / **Open settings**.
7. **My reports:** the new report is at the top; the status filter, pull to refresh and scrolling
   work. Open a report → photo, AI result, **Open in Maps**, status timeline.
8. After an admin changes the status in the web dashboard, pull to refresh → the new status and the
   admin's note appear in the timeline.
9. **Account → Log out** → back to the login screen.
