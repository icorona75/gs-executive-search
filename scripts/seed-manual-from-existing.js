#!/usr/bin/env node
/**
 * One-time seed: copy the current curated `data.js` jobs into `data/manual/jobs.json`.
 * This guarantees every existing hand-curated job (with goldie_fit narratives,
 * recruiter notes, etc.) is preserved forever and never overwritten.
 *
 * Re-running is safe: it will only seed if manual/jobs.json is empty.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_JS = path.join(REPO_ROOT, "data.js");
const MANUAL_DIR = path.join(REPO_ROOT, "data", "manual");
const MANUAL_JOBS = path.join(MANUAL_DIR, "jobs.json");

async function main() {
  await fs.mkdir(MANUAL_DIR, { recursive: true });
  const existing = await fs.readFile(MANUAL_JOBS, "utf8").catch(() => "[]");
  const arr = JSON.parse(existing);
  if (arr.length > 0) {
    console.log(`[seed] manual/jobs.json already has ${arr.length} jobs — skipping`);
    return;
  }

  const txt = await fs.readFile(DATA_JS, "utf8");
  const start = txt.indexOf("{");
  const data = JSON.parse(txt.slice(start).replace(/;?\s*$/, ""));
  const jobs = data.jobs || [];

  // Mark every seeded job as manual + pinned so it's never dropped.
  const seeded = jobs.map((j) => ({
    ...j,
    pinned: true,
    source: j.source || "seeded_manual",
    _seeded_on: new Date().toISOString().slice(0, 10),
  }));

  await fs.writeFile(MANUAL_JOBS, JSON.stringify(seeded, null, 2));
  console.log(`[seed] Seeded ${seeded.length} jobs into data/manual/jobs.json (all pinned)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
