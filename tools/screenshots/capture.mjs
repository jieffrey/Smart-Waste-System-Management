// Full-page screenshots of every admin page at 1440px and 390px wide (Playwright, Chromium).
// DEV TOOLING ONLY (fixture data). Usage: node capture.mjs <outDir>   (see README.md)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "screenshots";
const base = process.env.WEB_URL || "http://localhost:3100";
const mock = `http://localhost:${process.env.MOCK_PORT || 4100}`;
fs.mkdirSync(outDir, { recursive: true });

const PAGES = [
  ["dashboard", "/dashboard"],
  ["reports", "/reports"],
  ["reports-filtered-pending", "/reports?status=pending"],
  ["report-detail-pending", "PENDING"],
  ["report-detail-closed", "CLOSED"],
  ["report-not-found", "/reports/00000000-0000-4000-8000-000000000000"],
  ["users", "/users"],
];

// A full-page screenshot resizes the viewport while capturing, which makes the charts re-measure mid-shot.
// Instead: grow the viewport to the page height, let everything settle, take a normal screenshot, shrink back.
async function shoot(page, file) {
  const viewport = page.viewportSize();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file });
  await page.setViewportSize(viewport);
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  // Charts lay themselves out once they are in view: scroll through the page first, then back to the top.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0); // no chart tooltip in the picture
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch();
const saved = [];
for (const width of [1440, 390]) {
  // Reduced motion: charts render in their final state, also below the fold (in-view animations never start
  // in a full-page screenshot because the page isn't scrolled).
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();

  await page.goto(`${base}/login`);
  await settle(page);
  const loginFile = path.join(outDir, `login-${width}.png`);
  await shoot(page, loginFile);
  saved.push(loginFile);

  await page.fill("#email", "dewi@swms.example");
  await page.fill("#password", "fixture-password");
  await Promise.all([page.waitForURL("**/dashboard"), page.click('button[type="submit"]')]);

  // Find one open and one closed report from the list to photograph their detail pages.
  const ids = await (await fetch(`${mock}/api/admin/reports?page=1`)).json();
  // Prefer an open report that shows the newer markers (needs review / possible duplicate).
  const pending = (ids.reports.find((r) => r.status === "pending" && r.needs_review && r.possible_duplicate_of) ?? ids.reports.find((r) => r.status === "pending" && (r.needs_review || r.possible_duplicate_of)) ?? ids.reports.find((r) => r.status === "pending"))?.id;
  const closed = ids.reports.find((r) => r.status === "completed")?.id;

  for (const [name, route] of PAGES) {
    const url = route === "PENDING" ? `/reports/${pending}` : route === "CLOSED" ? `/reports/${closed}` : route;
    await page.goto(base + url);
    await settle(page);
    const file = path.join(outDir, `${name}-${width}.png`);
    await shoot(page, file);
    saved.push(file);
  }
  await context.close();
}
await browser.close();
console.log(saved.join("\n"));
