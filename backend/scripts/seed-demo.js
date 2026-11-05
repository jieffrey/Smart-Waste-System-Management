// PRODUCTION DEMO DATA (separate from the local dev seed in seed.js).
//
// Creates the demo residents and 48 realistic reports from scripts/demo/manifest.json, with the photos in
// scripts/demo/photos/ (or DEMO_PHOTOS_DIR). Each photo is classified by the real ML API, so the AI fields are
// honest; the admin corrects the category on reviewed reports where the AI was wrong.
//
// Safe to re-run: report ids are derived from the manifest keys, so existing reports (and their photos) are
// skipped, and existing residents keep their password. It never writes an admin account: the admin is only read
// (DEMO_ADMIN_EMAIL) to sign the status changes. It never deletes anything.
//
// Run from backend/ with the production env file (see docs/deploy-plan.md, section 4.3):
//   node --env-file=.env.production scripts/seed-demo.js --dry-run
//   node --env-file=.env.production scripts/seed-demo.js --confirm <database host>
//
// Needs: DATABASE_URL, ML_API_URL (+ ML_API_KEY), storage settings (STORAGE_DRIVER, CLOUDINARY_URL, ...),
// DEMO_ADMIN_EMAIL, DEMO_RESIDENT_PASSWORD (not needed for --dry-run), optional DEMO_PHOTOS_DIR.

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEMO_DIR = path.join(__dirname, 'demo');
const MANIFEST_PATH = path.join(DEMO_DIR, 'manifest.json');
const DEFAULT_PHOTOS_DIR = path.join(DEMO_DIR, 'photos');
// Fixed namespace for the report ids (UUID v5 of the manifest key): same key → same id on every run.
const REPORT_ID_NAMESPACE = 'b7d1c2a4-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta is UTC+7 all year
const CATEGORIES = ['organic', 'paper', 'plastic'];
const CATEGORY_LABELS = { organic: 'organik', paper: 'kertas', plastic: 'plastik' };
// Same rules as the admin API (admin-reports.service.js).
const STATUS_TRANSITIONS = {
  pending: ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};
const REVIEWED_STATUSES = ['in_progress', 'completed'];

// RFC 4122 version 5 (SHA-1, name-based) UUID.
function uuidV5(name, namespace = REPORT_ID_NAMESPACE) {
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(name)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function finalStatus(report) {
  return report.history.length > 0 ? report.history.at(-1).status : 'pending';
}

// Returns a list of problems (empty = valid). Checks the photos exist when photosDir is given.
async function validateManifest(manifest, photosDir) {
  const problems = [];
  const residentKeys = new Set(manifest.residents.map((resident) => resident.key));
  const keys = new Set();

  for (const report of manifest.reports) {
    const where = `report ${report.key}`;
    if (keys.has(report.key)) {
      problems.push(`${where}: duplicate key`);
    }
    keys.add(report.key);
    if (!residentKeys.has(report.resident)) {
      problems.push(`${where}: unknown resident ${report.resident}`);
    }
    if (!CATEGORIES.includes(report.true_category)) {
      problems.push(`${where}: unknown category ${report.true_category}`);
    }
    if (!Number.isInteger(report.days_ago) || report.days_ago < 0 || report.days_ago > 29) {
      problems.push(`${where}: days_ago must be 0-29`);
    }
    let status = 'pending';
    let hours = 0;
    for (const step of report.history) {
      if (!STATUS_TRANSITIONS[status]?.includes(step.status)) {
        problems.push(`${where}: ${status} -> ${step.status} is not an allowed transition`);
      }
      if (!(step.hours_after_report > hours)) {
        problems.push(`${where}: history times must increase`);
      }
      status = step.status;
      hours = step.hours_after_report;
    }
    if (status === 'rejected' && !report.history.at(-1).note) {
      problems.push(`${where}: a rejection needs a note`);
    }
    if (photosDir) {
      await fs.access(path.join(photosDir, report.photo)).catch(() => problems.push(`${where}: photo ${report.photo} not found`));
    }
  }
  return problems;
}

// created_at = (today in Jakarta - days_ago) at the manifest time; status changes follow. If the last change would
// be in the future (a recent report with a long history), the whole report is moved back so it ends an hour ago.
function reportTimes(report, now) {
  const jakartaToday = Math.floor((now.getTime() + JAKARTA_OFFSET_MS) / 86_400_000) * 86_400_000;
  const [hour, minute] = report.time.split(':').map(Number);
  let created = jakartaToday - report.days_ago * 86_400_000 + (hour * 60 + minute) * 60_000 - JAKARTA_OFFSET_MS;
  const lastHours = report.history.length > 0 ? report.history.at(-1).hours_after_report : 0;
  const latestAllowed = now.getTime() - 60 * 60_000;
  if (created + lastHours * 3_600_000 > latestAllowed) {
    created = latestAllowed - lastHours * 3_600_000;
  }
  return {
    createdAt: new Date(created),
    steps: report.history.map((step) => ({ ...step, at: new Date(created + step.hours_after_report * 3_600_000) })),
  };
}

// The admin's note on the report: the last status note, with the category correction first when there was one.
function adminNoteFor(report, prediction, category) {
  const lastNote = [...report.history].reverse().find((step) => step.note)?.note ?? null;
  if (category === prediction.category) {
    return lastNote;
  }
  const correction = `Kategori dikoreksi dari ${CATEGORY_LABELS[prediction.category]} ke ${CATEGORY_LABELS[category]}.`;
  return lastNote ? `${correction} ${lastNote}` : correction;
}

async function findUser(query, email) {
  const { rows } = await query('SELECT id, role FROM users WHERE LOWER(email) = $1', [email.trim().toLowerCase()]);
  return rows[0] || null;
}

// deps: { query, pool, classify(buffer, mimeType), saveImage(buffer, ext), deleteImage(url), hashPassword(pw) }
async function seedDemo(deps, { manifest, photosDir, adminEmail, residentPassword, dryRun = false, now = new Date(), log = console.log }) {
  const { query, pool, classify, saveImage, deleteImage, hashPassword } = deps;

  const problems = await validateManifest(manifest, photosDir);
  if (problems.length > 0) {
    throw new Error(`Invalid demo manifest:\n  ${problems.join('\n  ')}`);
  }

  // Read-only checks first: nothing is written unless all of them pass.
  if (!adminEmail) {
    throw new Error('DEMO_ADMIN_EMAIL is not set');
  }
  const admin = await findUser(query, adminEmail);
  if (!admin || admin.role !== 'admin') {
    throw new Error('DEMO_ADMIN_EMAIL is not an existing admin account (create the admin first)');
  }
  const residents = new Map();
  for (const resident of manifest.residents) {
    const existing = await findUser(query, resident.email);
    if (existing && existing.role !== 'user') {
      throw new Error(`Resident ${resident.email} exists with role "${existing.role}": refusing to touch it`);
    }
    residents.set(resident.key, { ...resident, id: existing?.id ?? null });
  }

  const reportIds = manifest.reports.map((report) => uuidV5(report.key));
  const { rows: existingRows } = await query('SELECT id FROM waste_reports WHERE id = ANY($1::uuid[])', [reportIds]);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const toCreate = manifest.reports.filter((report) => !existingIds.has(uuidV5(report.key)));
  const newResidents = [...residents.values()].filter((resident) => !resident.id);

  const summary = {
    residentsCreated: 0,
    residentsExisting: residents.size - newResidents.length,
    reportsCreated: 0,
    reportsExisting: manifest.reports.length - toCreate.length,
    corrections: 0,
  };

  if (dryRun) {
    log(`Dry run: would create ${newResidents.length} resident(s) and ${toCreate.length} report(s); ` +
      `${summary.residentsExisting} resident(s) and ${summary.reportsExisting} report(s) already exist. Nothing written.`);
    return { ...summary, dryRun: true, wouldCreateResidents: newResidents.length, wouldCreateReports: toCreate.length };
  }

  if (newResidents.length > 0) {
    if (!residentPassword) {
      throw new Error('DEMO_RESIDENT_PASSWORD is not set');
    }
    const passwordHash = await hashPassword(residentPassword);
    for (const resident of newResidents) {
      // Insert only: a resident created in the meantime keeps its password.
      const { rows } = await query(
        `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'user')
         ON CONFLICT DO NOTHING RETURNING id`,
        [resident.full_name, resident.email.toLowerCase(), passwordHash]
      );
      resident.id = rows[0]?.id ?? (await findUser(query, resident.email)).id;
      summary.residentsCreated += rows.length;
    }
  }

  for (const report of toCreate) {
    const id = uuidV5(report.key);
    const resident = residents.get(report.resident);
    const buffer = await fs.readFile(path.join(photosDir, report.photo));
    const prediction = await classify(buffer, 'image/jpeg');

    // The admin corrects the category on reviewed reports when the AI was wrong; pending and rejected reports keep it.
    const status = finalStatus(report);
    const reviewed = REVIEWED_STATUSES.includes(status);
    const category = reviewed ? report.true_category : prediction.category;
    const { createdAt, steps } = reportTimes(report, now);
    const updatedAt = steps.length > 0 ? steps.at(-1).at : createdAt;

    const imageUrl = await saveImage(buffer, 'jpg');
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO waste_reports
           (id, user_id, description, category, status, image_url, latitude, longitude, address,
            ai_predicted_category, ai_confidence, ai_model_version, admin_note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, resident.id, report.description, category, status, imageUrl, report.latitude, report.longitude,
          report.address, prediction.category, prediction.confidence, prediction.modelVersion,
          adminNoteFor(report, prediction, category), createdAt, updatedAt]
      );
      if (inserted.rows.length === 0) {
        // Created by a parallel run in the meantime: keep that one.
        await client.query('ROLLBACK');
        await deleteImage(imageUrl);
        continue;
      }

      await client.query(
        `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by, note, created_at)
         VALUES ($1, NULL, 'pending', $2, NULL, $3)`,
        [id, resident.id, createdAt]
      );
      let previous = 'pending';
      for (const step of steps) {
        await client.query(
          `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by, note, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, previous, step.status, admin.id, step.note, step.at]
        );
        previous = step.status;
      }
      await client.query('COMMIT');
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK').catch(() => {});
      }
      await deleteImage(imageUrl).catch((deleteErr) => log(`Could not delete ${imageUrl}: ${deleteErr.message}`));
      throw new Error(`Report ${report.key} failed: ${err.message}`);
    } finally {
      client?.release();
    }

    summary.reportsCreated += 1;
    if (category !== prediction.category) {
      summary.corrections += 1;
    }
    log(`created ${report.key} (${status}, AI ${prediction.category}${category !== prediction.category ? ` → ${category}` : ''})`);
  }

  log(`Done: ${summary.residentsCreated} resident(s) and ${summary.reportsCreated} report(s) created ` +
    `(${summary.corrections} category correction(s)); ${summary.residentsExisting} resident(s) and ` +
    `${summary.reportsExisting} report(s) already existed.`);
  return summary;
}

function parseArgs(argv) {
  const args = { dryRun: false, confirm: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i] === '--confirm') {
      args.confirm = argv[i + 1] ?? '';
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

// A real run must name the database host it writes to, so the dev database can't be filled by accident.
function checkConfirmHost(args, databaseUrl) {
  const host = new URL(databaseUrl).hostname;
  if (!args.dryRun && args.confirm !== host) {
    throw new Error(`Refusing to write: pass --confirm ${host} to seed this database (or use --dry-run).`);
  }
  return host;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { databaseUrl } = require('../src/config/env');
  const host = checkConfirmHost(args, databaseUrl);
  console.log(`Database host: ${host}${args.dryRun ? ' (dry run)' : ''}`);

  const { pool, query } = require('../src/db/pool');
  const { classifyImage } = require('../src/modules/ml/ml.service');
  const { saveImage, deleteImage } = require('../src/modules/uploads/uploads.service');
  const { hashPassword } = require('../src/modules/auth/auth.service');
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));

  try {
    await seedDemo(
      { query, pool, classify: classifyImage, saveImage, deleteImage, hashPassword },
      {
        manifest,
        photosDir: process.env.DEMO_PHOTOS_DIR || DEFAULT_PHOTOS_DIR,
        adminEmail: process.env.DEMO_ADMIN_EMAIL,
        residentPassword: process.env.DEMO_RESIDENT_PASSWORD,
        dryRun: args.dryRun,
      }
    );
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Demo seed failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  seedDemo,
  validateManifest,
  reportTimes,
  uuidV5,
  parseArgs,
  checkConfirmHost,
  MANIFEST_PATH,
  DEFAULT_PHOTOS_DIR,
  STATUS_TRANSITIONS,
};
