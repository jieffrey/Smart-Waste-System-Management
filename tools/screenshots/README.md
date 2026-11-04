# Screenshot tooling (dev only, fake data)

**This is development tooling, not part of the product.** Nothing in `web/`, `backend/`, `Mobile/` or `ml/`
imports it, and it is never deployed.

- `mock-api.mjs`: a fake SWMS backend on port 4100 with **made-up fixture data** (46 reports, 12 people,
  stats). It accepts any login and returns an unsigned admin token, so it must never face a network.
- `capture.mjs`: logs in to the web app and takes full-page screenshots of every admin page at 1440px and
  390px wide with Playwright (Chromium).

## Use

```bash
cd tools/screenshots
npm install
npx playwright install chromium

# 1. Fake backend (port 4100)
npm run mock

# 2. In another terminal: build and start the web app against the fake backend (port 3100)
cd ../../web
NEXT_PUBLIC_API_URL=http://localhost:4100 npm run build
NEXT_PUBLIC_API_URL=http://localhost:4100 npx next start -p 3100

# 3. In a third terminal: capture
cd tools/screenshots
node capture.mjs ../../docs/screenshots/<folder>
```

`NEXT_PUBLIC_API_URL` is built into the web app, so rebuild it normally (without the variable) before using it
against the real backend again. Ports can be changed with `MOCK_PORT` and `WEB_URL`.

## Mobile app (Expo web, 390px)

The app itself is phone-only (camera, GPS, secure storage; the root layout shows a "phone only" message on web) and
does not ship web dependencies. To photograph it, `mobile/prepare-mobile.sh` builds a **throwaway** git worktree
of the app and, in that copy only:

- installs its own `node_modules` plus `react-dom` + `react-native-web`;
- adds `mobile/metro.config.js`, which swaps `expo-secure-store`, `expo-location`, `expo-image-picker`,
  `expo-image-manipulator` and `expo-file-system` for the fixture mocks in `mobile/mocks/` (a fixed spot in
  Depok, a sample photo as "the camera");
- lifts the web gate in `src/app/_layout.tsx`.

Nothing in `Mobile/` changes. The mock API serves the mobile endpoints (`/api/reports/me`, `/api/reports/:id`,
`POST /api/reports`, `/api/auth/register`) for one fixture citizen, with CORS for the web origin.

```sh
node mock-api.mjs                                           # :4100
sh mobile/prepare-mobile.sh /tmp/swms-mobile-shots design/mobile-screens
cd /tmp/swms-mobile-shots/Mobile && EXPO_PUBLIC_API_URL=http://localhost:4100 npx expo start --web --port 8095
node capture-mobile.mjs ../../docs/screenshots/mobile       # from tools/screenshots, Playwright installed
git worktree remove --force /tmp/swms-mobile-shots
```

Web rendering is close to, not identical with, a phone (fonts, safe areas, native header and dialogs differ
slightly); test on a real device before judging details.
