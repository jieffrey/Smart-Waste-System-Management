// Screenshots of every mobile screen at 390px wide (Playwright, Chromium), from the Expo WEB build of a throwaway
// copy of the app with mocked camera/GPS/storage (see mobile/prepare-mobile.sh) against the mock API.
// DEV TOOLING ONLY (fixture data). Usage: node capture-mobile.mjs <outDir>   (see README.md)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "screenshots-mobile";
const base = process.env.APP_URL || "http://localhost:8095";
const mock = `http://localhost:${process.env.MOCK_PORT || 4100}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "id-ID", timezoneId: "Asia/Jakarta" });
const page = await context.newPage();
page.on("pageerror", (err) => console.error("page error:", err.message));
const saved = [];

async function shot(name, { full = false, wait = 900 } = {}) {
  await page.waitForTimeout(wait); // enter animations
  const file = path.join(outDir, `${name}.png`);
  if (full) {
    // React Native Web scrolls inside the screen, so "full page" = a taller viewport for this one shot.
    await page.setViewportSize({ width: 390, height: 1500 });
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: file });
  if (full) await page.setViewportSize({ width: 390, height: 844 });
  saved.push(file);
}

// Front door
await page.goto(`${base}/login`);
await page.getByText("Lihat sampah?", { exact: false }).waitFor();
await shot("01-masuk");
await page.goto(`${base}/register`);
await page.getByText("Buat akun").first().waitFor();
await shot("02-daftar");

// Sign in as the fixture citizen
await page.goto(`${base}/login`);
await page.getByText("Lihat sampah?", { exact: false }).waitFor();
const inputs = page.locator("input");
await inputs.nth(0).fill("budi.santoso@mail.example");
await inputs.nth(1).fill("fixture-password");
await page.getByRole("button", { name: "Masuk" }).click();
await page.getByText("Laporan saya").first().waitFor();

// Laporan saya + filter
await page.getByText(/^\d+ laporan$/).waitFor(); // rows loaded, not mid-transition
await page.waitForLoadState("networkidle");
await shot("03-laporan-saya", { wait: 1500 });
await page.getByText("STATUS", { exact: false }).first().click();
await page.getByText("Tampilkan laporan").waitFor();
await shot("04-filter-status");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// Details (one closed, one rejected, one in progress) — ids from the mock with the citizen's token
const { token } = await (await fetch(`${mock}/api/auth/login`, { method: "POST", body: JSON.stringify({ email: "budi.santoso@mail.example" }) })).json();
const { reports } = await (await fetch(`${mock}/api/reports/me?limit=50`, { headers: { Authorization: `Bearer ${token}` } })).json();
for (const [name, status] of [["05-detail-selesai", "completed"], ["06-detail-ditolak", "rejected"], ["07-detail-diproses", "in_progress"]]) {
  const report = reports.find((r) => r.status === status);
  if (!report) { console.error(`no ${status} report in fixtures`); continue; }
  await page.goto(`${base}/reports/${report.id}`);
  await page.getByText("Riwayat", { exact: false }).first().waitFor();
  await page.waitForLoadState("networkidle");
  await shot(name, { wait: 1200 });
  await shot(`${name}-penuh`, { full: true, wait: 200 });
}

// Lapor: empty form, filled form, AI result
await page.goto(`${base}/new`);
await page.getByText("Ketuk untuk memotret").waitFor();
await page.getByText("Tugu, Cimanggis").waitFor();
await shot("08-lapor-kosong");
await page.getByText("Ketuk untuk memotret").click();
await page.getByText("Foto ulang").first().waitFor();
await page.locator("textarea").fill("Sisa makanan meluap dari tong sampah RT.");
await page.waitForLoadState("networkidle");
await shot("09-lapor-siap", { wait: 1200 });
await shot("09-lapor-siap-penuh", { full: true, wait: 200 });
await page.getByRole("button", { name: "Kirim laporan" }).click();
await page.getByText("Terdeteksi", { exact: false }).waitFor();
await shot("10-hasil-ai", { wait: 1500 });

// Akun + log-out dialog
await page.goto(`${base}/account`);
await page.getByText("budi.santoso@mail.example").waitFor();
await shot("11-akun");
await page.getByRole("button", { name: "Keluar" }).click();
await page.getByText("Keluar dari akun?").waitFor();
await shot("12-keluar-dialog");

await browser.close();
console.log(saved.join("\n"));
