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

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500); // chart enter animations
}

const browser = await chromium.launch();
const saved = [];
for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  await page.goto(`${base}/login`);
  await settle(page);
  const loginFile = path.join(outDir, `login-${width}.png`);
  await page.screenshot({ path: loginFile, fullPage: true });
  saved.push(loginFile);

  await page.fill("#email", "dewi@swms.example");
  await page.fill("#password", "fixture-password");
  await Promise.all([page.waitForURL("**/dashboard"), page.click('button[type="submit"]')]);

  // Find one open and one closed report from the list to photograph their detail pages.
  const ids = await (await fetch(`${mock}/api/admin/reports?page=1`)).json();
  const pending = ids.reports.find((r) => r.status === "pending")?.id;
  const closed = ids.reports.find((r) => r.status === "completed")?.id;

  for (const [name, route] of PAGES) {
    const url = route === "PENDING" ? `/reports/${pending}` : route === "CLOSED" ? `/reports/${closed}` : route;
    await page.goto(base + url);
    await settle(page);
    const file = path.join(outDir, `${name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    saved.push(file);
  }
  await context.close();
}
await browser.close();
console.log(saved.join("\n"));
