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
