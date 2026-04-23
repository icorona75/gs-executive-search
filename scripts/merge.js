#!/usr/bin/env node
/**
 * GS Executive Search — Merge auto + manual into data.js
 *
 * Rules
 * -----
 * 1. Manual jobs win on conflict (same source_id or same id).
 * 2. Pinned jobs (pinned === true) from auto AND manual are always kept.
 * 3. If a live auto job shares source_id with a manual entry, we merge
 *    field-by-field: manual non-empty fields override auto fields,
 *    auto provides fields that manual leaves empty.
 * 4. `data.js` preserves the original `APP_DATA` shape (candidate, jobs,
 *    companies, recruiters, platforms, compensation, last_updated) and
 *    only replaces the `jobs` array + `last_updated`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const AUTO = path.join(REPO_ROOT, "data", "auto", "jobs.json");
const MANUAL = path.join(REPO_ROOT, "data", "manual", "jobs.json");
const DATA_JS = path.join(REPO_ROOT, "data.js");

async function readJSON(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return fallback; }
}

function mergeJob(manual, auto) {
  const out = { ...auto };
  for (const [k, v] of Object.entries(manual)) {
    if (v !== "" && v !== null && v !== undefined) out[k] = v;
  }
  out._merged = true;
  return out;
}

async function loadAppData() {
  const txt = await fs.readFile(DATA_JS, "utf8");
  const start = txt.indexOf("{");
  const jsonText = txt.slice(start).replace(/;?\s*$/, "");
  return { original: txt, data: JSON.parse(jsonText) };
}

async function main() {
  const [auto, manual, { data: appData }] = await Promise.all([
    readJSON(AUTO, []),
    readJSON(MANUAL, []),
    loadAppData(),
  ]);

  const manualBySource = new Map();
  const manualById = new Map();
  for (const m of manual) {
    if (m.source_id) manualBySource.set(m.source_id, m);
    if (m.id != null) manualById.set(String(m.id), m);
  }

  // Start with all auto jobs, overlay manual edits that match source_id
  const merged = auto.map((a) => {
    const m = a.source_id ? manualBySource.get(a.source_id) : null;
    return m ? mergeJob(m, a) : a;
  });

  // Add manual-only jobs (no source_id match in auto) — these are pure human additions
  const mergedSourceIds = new Set(merged.map((j) => j.source_id).filter(Boolean));
  for (const m of manual) {
    if (!m.source_id || !mergedSourceIds.has(m.source_id)) {
      merged.push({ ...m, _manual_only: true });
    }
  }

  // Re-number sequentially for the frontend
  merged.forEach((j, i) => { j.id = i + 1; });

  appData.jobs = merged;
  appData.last_updated = new Date().toISOString();

  const newContent = `window.APP_DATA = ${JSON.stringify(appData, null, 2)};\n`;
  await fs.writeFile(DATA_JS, newContent);
  console.log(`[merge] data.js now has ${merged.length} jobs (auto=${auto.length}, manual=${manual.length})`);
}

main().catch((err) => { console.error("[merge] FATAL", err); process.exit(1); });
