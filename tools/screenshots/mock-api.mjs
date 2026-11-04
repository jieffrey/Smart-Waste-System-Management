// DEV TOOLING ONLY. A fake SWMS backend that serves deterministic FIXTURE data (made-up people, reports and
// stats), so the admin web app can be photographed without a real account or database.
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
    ai_predicted_category: ai, ai_confidence: Number((0.62 + rand() * 0.37).toFixed(4)), ai_model_version: "swms_mobilenetv2_best",
    admin_note: status === "rejected" ? "Duplicate of an earlier report at the same spot." : status === "completed" ? "Collected and sorted." : null,
    created_at: new Date(created).toISOString(), updated_at: history.at(-1).created_at,
    reporter_name: reporter.full_name, reporter_email: reporter.email, status_history: history,
  });
}
reports.sort((a, b) => b.created_at.localeCompare(a.created_at));

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
  return { totals: { reports: reports.length, by_status, by_category }, reports_per_day, ai_accuracy: { reviewed: reviewed.length, matching, accuracy: reviewed.length ? Number((matching / reviewed.length).toFixed(4)) : null }, ai_flow };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const TOKEN = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: admin.id, role: "admin", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })}.mock-signature`;
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const page = (list, url, limit = 20) => { const p = Math.max(1, Number(url.searchParams.get("page")) || 1); return { items: list.slice((p - 1) * limit, p * limit), pagination: { page: p, limit, total: list.length } }; };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (url.pathname.startsWith("/uploads/")) {
      const file = path.join(SAMPLES, ["biological_102.jpg", "paper_1000.jpg", "plastic_101.jpg"][Number(url.pathname.match(/sample-(\d)/)?.[1] ?? 0)]);
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      return fs.createReadStream(file).pipe(res);
    }
    if (url.pathname === "/api/auth/login" && req.method === "POST") return send(res, 200, { user: admin, token: TOKEN });
    if (url.pathname === "/api/auth/me") return send(res, 200, { user: admin });
    if (url.pathname === "/api/admin/stats") return send(res, 200, stats());
    if (url.pathname === "/api/admin/reports") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const list = reports.filter((r) => (!url.searchParams.get("status") || r.status === url.searchParams.get("status")) && (!url.searchParams.get("category") || r.category === url.searchParams.get("category")) && (!q || r.description.toLowerCase().includes(q) || (r.address || "").toLowerCase().includes(q)));
      const { items, pagination } = page(list, url);
      return send(res, 200, { reports: items.map(({ status_history, ...r }) => r), pagination });
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
