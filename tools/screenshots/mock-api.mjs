// DEV TOOLING ONLY. A fake SWMS backend that serves deterministic FIXTURE data (made-up people, reports and
// stats), so the admin web app and the mobile app can be photographed without a real account or database.
// Never imported by the app, the backend or any test. See README.md.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.MOCK_PORT || 4100);
const SAMPLES = process.env.SAMPLES_DIR || fileURLToPath(new URL("../../ml/tests/samples/", import.meta.url)); // sample JPEGs served as report photos
const CATEGORIES = ["organic", "paper", "plastic"];
const DAY = 86400000;
const now = new Date("2026-11-04T05:00:00Z").getTime(); // fixed "today" so screenshots are stable

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Random-looking but deterministic UUID v4 strings (like the real ones), so short IDs differ per record.
const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`;
const admin = { id: "6f1c2a9e-3b7d-4c21-9a5e-0d8b7f3e1c42", full_name: "Dewi Lestari", email: "dewi@swms.example", role: "admin", is_active: true, created_at: new Date(now - 90 * DAY).toISOString(), updated_at: new Date(now - 90 * DAY).toISOString() };
const names = ["Budi Santoso", "Siti Rahma", "Andi Wijaya", "Rina Kartika", "Agus Pratama", "Maya Sari", "Hendra Gunawan", "Lina Marlina", "Fajar Nugroho", "Tari Wulandari", "Yoga Saputra"];
const users = [admin, ...names.map((full_name, i) => ({
  id: uuid(), full_name,
  email: full_name.toLowerCase().replace(" ", ".") + "@mail.example", role: "user", is_active: i !== 4,
  created_at: new Date(now - (80 - i * 6) * DAY).toISOString(), updated_at: new Date(now - 3 * DAY).toISOString(),
}))];
const streets = ["Jl. Margonda Raya 112, Depok", "Jl. Kenanga 4, Cimanggis", "Jl. Sudirman 21, Jakarta Pusat", "Jl. Melati 8, Beji", "Pasar Kemiri Muka, Depok", "Jl. Juanda 45, Depok", null];

// 46 reports over 30 days; older ones are further along. Some AI categories were corrected by an admin.
const reports = [];
for (let i = 0; i < 46; i++) {
  const daysAgo = Math.floor(rand() * 30);
  const created = now - daysAgo * DAY - Math.floor(rand() * 10) * 3600000;
  const ai = CATEGORIES[Math.floor(rand() * 3)];
  let status = "pending";
  const r = rand();
  if (daysAgo > 2) status = r < 0.55 ? "completed" : r < 0.75 ? "in_progress" : r < 0.88 ? "rejected" : "pending";
  else if (daysAgo > 0) status = r < 0.4 ? "in_progress" : "pending";
  const corrected = status !== "pending" && rand() < 0.18;
  const category = corrected ? (ai === "plastic" ? "paper" : ai === "paper" ? "organic" : "plastic") : ai;
  const reporter = users[1 + Math.floor(rand() * names.length)];
  const history = [{ old_status: null, new_status: "pending", note: null, created_at: new Date(created).toISOString(), changed_by: reporter.id, changed_by_name: reporter.full_name }];
  let t = created;
  const step = (from, to, note) => { t += (0.4 + rand() * 1.8) * DAY; history.push({ old_status: from, new_status: to, note, created_at: new Date(Math.min(t, now)).toISOString(), changed_by: admin.id, changed_by_name: admin.full_name }); };
  if (status === "in_progress" || status === "completed") step("pending", "in_progress", "Crew assigned for pickup.");
  if (status === "completed") step("in_progress", "completed", "Collected and sorted.");
  if (status === "rejected") step("pending", "rejected", "Duplicate of an earlier report at the same spot.");
  reports.push({
    id: uuid(), user_id: reporter.id,
    description: ["Pile of bags next to the bus stop, starting to smell.", "Cardboard boxes dumped behind the market.", "Plastic bottles and cups along the river bank.", "Food waste overflowing from the community bin.", "Old newspapers soaked by the rain on the pavement."][i % 5],
    category, status, image_url: `/uploads/sample-${i % 3}.jpg`,
    latitude: -6.36 - rand() * 0.06, longitude: 106.80 + rand() * 0.06, address: streets[i % streets.length],
    ai_predicted_category: ai, ai_confidence: Number((0.62 + rand() * 0.37).toFixed(4)), ai_model_version: "swms_mobilenetv2_option_b",
    admin_note: status === "rejected" ? "Duplicate of an earlier report at the same spot." : status === "completed" ? "Collected and sorted." : null,
    created_at: new Date(created).toISOString(), updated_at: history.at(-1).created_at,
    reporter_name: reporter.full_name, reporter_email: reporter.email, status_history: history,
  });
}
reports.sort((a, b) => b.created_at.localeCompare(a.created_at));

// Newer fields, computed like the backend: "needs review" (AI confidence below 0.70, still pending, category
// unchanged) and "possible duplicate" (a later open report linked to an earlier one with the same category).
const REVIEW_THRESHOLD = 0.7;
const openReports = reports.filter((r) => r.status === "pending");
if (openReports[1]) openReports[1].ai_confidence = 0.5812; // at least one unsure AI result
for (const r of reports) {
  r.needs_review = r.status === "pending" && r.category === r.ai_predicted_category && r.ai_confidence < REVIEW_THRESHOLD;
  r.possible_duplicate_of = null;
  r.possible_duplicates = [];
}
for (const later of openReports.slice(0, 2)) {
  const earlier = reports.find((r) => r !== later && (r.status === "pending" || r.status === "in_progress") && r.category === later.category && r.created_at < later.created_at);
  if (!earlier) continue;
  later.possible_duplicate_of = earlier.id;
  earlier.possible_duplicates.push({ id: later.id, status: later.status, created_at: later.created_at });
}

// The MOBILE app (citizen) is photographed as one regular user with their own reports, in Indonesian, with
// full reverse-geocoded addresses like a phone produces. Copies, so the admin fixtures above don't change.
const citizen = users[1];
const idAddresses = [
  "Jl. Rtm No.50, RT.6/RW.10, Tugu, Kec. Cimanggis, Kota Depok, Jawa Barat 16451, Indonesia",
  "Jl. Margonda Raya No.112, Pondok Cina, Kec. Beji, Kota Depok, Jawa Barat 16424, Indonesia",
  "Gg. Kenanga 4, RT.2/RW.5, Kemiri Muka, Kec. Beji, Kota Depok, Jawa Barat 16423, Indonesia",
  "Jl. Juanda No.45, Bakti Jaya, Kec. Sukmajaya, Kota Depok, Jawa Barat 16418, Indonesia",
  null,
];
const idDescriptions = ["Tumpukan kantong sampah di samping halte, mulai bau.", "Kardus bekas dibuang di belakang pasar.", "Botol dan gelas plastik di pinggir kali.", "Sisa makanan meluap dari tong sampah RT.", "Koran bekas basah kena hujan di trotoar."];
// Photo and description that match the category shown (sample-0 organic, sample-1 paper, sample-2 plastic).
const byCategory = {
  organic: { image: "/uploads/sample-0.jpg", description: "Sisa makanan meluap dari tong sampah RT." },
  paper: { image: "/uploads/sample-1.jpg", description: "Kardus bekas dibuang di belakang pasar." },
  plastic: { image: "/uploads/sample-2.jpg", description: "Botol dan gelas plastik di pinggir kali." },
};
const idNotes = { "Crew assigned for pickup.": "Petugas sudah dijadwalkan mengangkut.", "Collected and sorted.": "Sudah diangkut dan dipilah.", "Duplicate of an earlier report at the same spot.": "Sudah dilaporkan sebelumnya di titik yang sama." };
const mine = reports.filter((_, i) => i % 5 === 1).slice(0, 9).map((r, i) => ({
  ...r, user_id: citizen.id, reporter_name: citizen.full_name, reporter_email: citizen.email,
  address: idAddresses[i % idAddresses.length], description: byCategory[r.category].description, image_url: byCategory[r.category].image,
  admin_note: r.admin_note ? idNotes[r.admin_note] : null,
  status_history: r.status_history.map((h) => ({ ...h, note: h.note ? idNotes[h.note] : null })),
}));

const jakartaDate = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(ms));
function stats() {
  const by_status = { pending: 0, in_progress: 0, completed: 0, rejected: 0 };
  const by_category = { organic: 0, paper: 0, plastic: 0 };
  for (const r of reports) { by_status[r.status]++; by_category[r.category]++; }
  const reports_per_day = [];
  for (let d = 29; d >= 0; d--) {
    const date = jakartaDate(now - d * DAY);
    reports_per_day.push({
      date,
      count: reports.filter((r) => jakartaDate(Date.parse(r.created_at)) === date).length,
      completed_count: reports.filter((r) => r.status_history.some((h) => h.new_status === "completed" && jakartaDate(Date.parse(h.created_at)) === date)).length,
    });
  }
  const reviewed = reports.filter((r) => r.status === "in_progress" || r.status === "completed");
  const matching = reviewed.filter((r) => r.category === r.ai_predicted_category).length;
  const ai_flow = CATEGORIES.flatMap((a) => CATEGORIES.map((c) => ({ ai_category: a, category: c, count: reports.filter((r) => r.ai_predicted_category === a && r.category === c).length })));
  const needs_review = { count: reports.filter((r) => r.needs_review).length, threshold: REVIEW_THRESHOLD };
  return { totals: { reports: reports.length, by_status, by_category }, reports_per_day, ai_accuracy: { reviewed: reviewed.length, matching, accuracy: reviewed.length ? Number((matching / reviewed.length).toFixed(4)) : null }, ai_flow, needs_review };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const tokenFor = (u) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, role: u.role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })}.mock-signature`;
const userFromToken = (req) => {
  try { const sub = JSON.parse(Buffer.from((req.headers.authorization || "").split(".")[1], "base64url")).sub; return users.find((u) => u.id === sub) || admin; } catch { return admin; }
};
// CORS for the Expo web build (a different origin than the mock).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json", ...CORS }); res.end(JSON.stringify(body)); };
const page = (list, url, limit = 20) => { const p = Math.max(1, Number(url.searchParams.get("page")) || 1); return { items: list.slice((p - 1) * limit, p * limit), pagination: { page: p, limit, total: list.length } }; };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname.startsWith("/uploads/")) {
      const file = path.join(SAMPLES, ["biological_102.jpg", "paper_1000.jpg", "plastic_101.jpg"][Number(url.pathname.match(/sample-(\d)/)?.[1] ?? 0)]);
      res.writeHead(200, { "Content-Type": "image/jpeg", ...CORS });
      return fs.createReadStream(file).pipe(res);
    }
    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      // The admin's email signs in as the admin (web); any other email as the citizen (mobile).
      let email = ""; try { email = JSON.parse(body).email; } catch {}
      const u = email === admin.email ? admin : citizen;
      return send(res, 200, { user: u, token: tokenFor(u) });
    }
    if (url.pathname === "/api/auth/register" && req.method === "POST") return send(res, 201, { user: citizen, token: tokenFor(citizen) });
    if (url.pathname === "/api/auth/me") return send(res, 200, { user: userFromToken(req) });
    // Mobile (citizen) endpoints.
    if (url.pathname === "/api/reports/me") {
      const list = mine.filter((r) => !url.searchParams.get("status") || r.status === url.searchParams.get("status"));
      const { items, pagination } = page(list, url, Number(url.searchParams.get("limit")) || 20);
      return send(res, 200, { reports: items.map(({ status_history, reporter_name, reporter_email, ...r }) => r), pagination });
    }
    if (url.pathname === "/api/reports" && req.method === "POST") {
      // A new report is always "organic, pending" (what the AI-result screenshot shows).
      const created = new Date(now).toISOString();
      const r = { ...mine[0], id: uuid(), category: "organic", ai_predicted_category: "organic", ai_confidence: 0.9412, status: "pending", admin_note: null, image_url: "/uploads/sample-0.jpg", address: idAddresses[0], latitude: -6.37712, longitude: 106.86094, description: idDescriptions[3], created_at: created, updated_at: created, status_history: [{ old_status: null, new_status: "pending", note: null, created_at: created, changed_by: citizen.id }] };
      mine.unshift(r);
      const { status_history, reporter_name, reporter_email, ...report } = r;
      return send(res, 201, { report });
    }
    const myOne = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (myOne) { const r = mine.find((x) => x.id === myOne[1]); if (!r) return send(res, 404, { error: { message: "Report not found", details: null } }); const { reporter_name, reporter_email, ...report } = r; return send(res, 200, { report }); }
    if (url.pathname === "/api/admin/stats") return send(res, 200, stats());
    if (url.pathname === "/api/admin/reports") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const list = reports.filter((r) => (!url.searchParams.get("status") || r.status === url.searchParams.get("status")) && (!url.searchParams.get("category") || r.category === url.searchParams.get("category")) && (!q || r.description.toLowerCase().includes(q) || (r.address || "").toLowerCase().includes(q))
        && (url.searchParams.get("needs_review") !== "true" || r.needs_review) && (url.searchParams.get("duplicate") !== "true" || r.possible_duplicate_of));
      const { items, pagination } = page(list, url);
      return send(res, 200, { reports: items.map(({ status_history, possible_duplicates, ...r }) => r), pagination });
    }
    const one = url.pathname.match(/^\/api\/admin\/reports\/(.+)$/);
    if (one) { const r = reports.find((x) => x.id === one[1]); return r ? send(res, 200, { report: r }) : send(res, 404, { error: { message: "Report not found", details: null } }); }
    if (url.pathname === "/api/admin/users") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const list = users.filter((u) => (!url.searchParams.get("role") || u.role === url.searchParams.get("role")) && (!url.searchParams.get("is_active") || String(u.is_active) === url.searchParams.get("is_active")) && (!q || u.full_name.toLowerCase().includes(q) || u.email.includes(q)))
        .map((u) => ({ ...u, report_count: reports.filter((r) => r.user_id === u.id).length }));
      const { items, pagination } = page(list, url);
      return send(res, 200, { users: items, pagination });
    }
    send(res, 404, { error: { message: "Route not found", details: null } });
  });
}).listen(PORT, () => console.log(`mock API on :${PORT} (${reports.length} reports)`));
