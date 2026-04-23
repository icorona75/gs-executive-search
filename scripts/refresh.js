#!/usr/bin/env node
/**
 * GS Executive Search — Daily Independent Refresh (Phase 1)
 *
 * Purpose
 * -------
 * Pull MD+ (Managing Director and above) roles from free, authoritative
 * job-board APIs. Runs inside GitHub Actions — NO Perplexity credits, NO
 * LLM API calls. Zero recurring cost.
 *
 * Safety model
 * ------------
 * 1. `data/manual/jobs.json`  → human-curated jobs. NEVER removed or modified
 *    by this script.  Pinned = true behaves identically.
 * 2. `data/auto/jobs.json`    → machine-written. Replaced on every run.
 * 3. `data/manual/exclude.json` → company/id exclusions. Applied after fetch.
 * 4. Sanity guard: if machine-output drops >30 % vs previous run, abort.
 * 5. Daily snapshot in `backups/auto-YYYY-MM-DD.json` (last 7 kept).
 * 6. Final `data.js` is written by merging manual (authoritative) with auto.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const AUTO_DIR = path.join(REPO_ROOT, "data", "auto");
const MANUAL_DIR = path.join(REPO_ROOT, "data", "manual");
const BACKUP_DIR = path.join(REPO_ROOT, "backups");

const TODAY = new Date().toISOString().slice(0, 10);
const UA = "GS-Executive-Search-Bot/1.0 (+https://github.com/icorona75/gs-executive-search)";

// --- MD+ title filter (inclusive on purpose; exclude list trims false positives) ---
const MD_PLUS_PATTERNS = [
  /\bmanaging director\b/i,
  /\bmd\b(?!\s*phd)/i,
  /\bpartner\b/i,
  /\bprincipal\b/i,
  /\bhead of\b/i,
  /\bchief [a-z ]+ officer\b/i,
  /\bc[eofito]o\b/i,
  /\bpresident\b/i,
  /\bexecutive (vice president|director)\b/i,
  /\bglobal head\b/i,
  /\bgeneral (counsel|manager)\b/i,
  /\bsenior managing director\b/i,
];

const MD_NEGATIVE_PATTERNS = [
  /\bassistant\b/i,
  /\bassociate\b/i,
  /\banalyst[e]?\b/i,              // English + French
  /\badjoint\b/i,                  // French "assistant"
  /\bconseiller\b/i,               // French "advisor"
  /\bd[ée]veloppeur\b/i,           // French "developer" (often "développeur principal" = senior dev)
  /\bconcepteur\b/i,               // French "designer"
  /\bingénieur\b/i,                // French "engineer"
  /\bchef de projet\b/i,           // French "project manager"
  /\bdeveloper\b/i,
  /\bengineer\b/i,
  /\barchitect\b/i,
  /\bscientist\b/i,
  /\bintern\b/i,
  /\bjunior\b/i,
  /\bstagiaire\b/i,                // French "intern"
  /\bvice president\b(?!.*executive)/i, // VP excluded unless Executive VP
  /\bvp\b(?!.*executive)/i,
];

// --- HTTP helper with timeout + basic retry ---
async function httpJSON(url, { retries = 2, timeoutMs = 20000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(t);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

// --- Adapters per ATS ---
const adapters = {
  async greenhouse(firm) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${firm.slug}/jobs?content=true`;
    const data = await httpJSON(url);
    return (data.jobs || []).map((j) => ({
      source_id: `greenhouse:${firm.slug}:${j.id}`,
      title: j.title,
      company: firm.name,
      location: j.location?.name || "",
      application_url: j.absolute_url,
      date_posted: j.updated_at?.slice(0, 10) || TODAY,
      source: `greenhouse:${firm.slug}`,
      raw_department: (j.departments || []).map((d) => d.name).join(" / "),
    }));
  },

  async lever(firm) {
    const url = `https://api.lever.co/v0/postings/${firm.slug}?mode=json`;
    const data = await httpJSON(url);
    return (data || []).map((j) => ({
      source_id: `lever:${firm.slug}:${j.id}`,
      title: j.text,
      company: firm.name,
      location: j.categories?.location || "",
      application_url: j.hostedUrl,
      date_posted: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : TODAY,
      source: `lever:${firm.slug}`,
      raw_department: j.categories?.team || "",
    }));
  },

  async ashby(firm) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${firm.slug}?includeCompensation=true`;
    const data = await httpJSON(url);
    return (data.jobs || []).map((j) => ({
      source_id: `ashby:${firm.slug}:${j.id}`,
      title: j.title,
      company: firm.name,
      location: j.locationName || "",
      application_url: j.jobUrl,
      date_posted: j.publishedAt?.slice(0, 10) || TODAY,
      source: `ashby:${firm.slug}`,
      raw_department: j.departmentName || "",
    }));
  },

  async teamtailor(firm) {
    const url = `https://${firm.slug}.teamtailor.com/jobs.json`;
    const data = await httpJSON(url);
    return (data.jobs || []).map((j) => ({
      source_id: `teamtailor:${firm.slug}:${j.id}`,
      title: j.title,
      company: firm.name,
      location: j.location || "",
      application_url: j.careersite_job_url || j.url,
      date_posted: j.pinned_until?.slice(0, 10) || TODAY,
      source: `teamtailor:${firm.slug}`,
    }));
  },

  async workday(firm) {
    // Workday CXS public JSON — paginated. Needs Origin/Referer on some tenants.
    const all = [];
    let offset = 0;
    const LIMIT = 20;
    const origin = firm.origin || new URL(firm.endpoint).origin;
    for (let page = 0; page < 10; page++) {
      const body = { appliedFacets: {}, limit: LIMIT, offset, searchText: "" };
      const res = await fetch(firm.endpoint, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Origin": origin,
          "Referer": origin + "/",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Workday ${firm.name}: ${res.status}`);
      const data = await res.json();
      const postings = data.jobPostings || [];
      if (postings.length === 0) break;
      for (const p of postings) {
        all.push({
          source_id: `workday:${firm.name}:${p.externalPath || p.bulletFields?.[0] || p.title}`,
          title: p.title,
          company: firm.name,
          location: p.locationsText || "",
          application_url: p.externalPath ? new URL(p.externalPath, firm.endpoint.replace("/wday/cxs/", "/en-US/")).href : "",
          date_posted: p.postedOn || TODAY,
          source: `workday:${firm.name}`,
        });
      }
      offset += LIMIT;
      if (postings.length < LIMIT) break;
    }
    return all;
  },

  async custom(_firm) {
    // Placeholder. Use specific platforms below.
    return [];
  },

  // --- Phase 2 adapters ---

  async successfactors_rmk(firm) {
    const decodeEntities = (s) => s
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");
    // SuccessFactors Recruiting Marketing (jobs2web / career sites like EBRD, GIC).
    // Strategy: fetch /search/ HTML page with high result count, parse anchor tags.
    const listURL = firm.endpoint; // e.g. https://jobs.ebrd.com/search/?q=
    const base = new URL(listURL).origin;
    const items = [];
    const seen = new Set();
    // Paginate by startrow
    for (let startrow = 0; startrow < 500; startrow += 25) {
      const pageURL = listURL + (listURL.includes("?") ? "&" : "?") + `startrow=${startrow}`;
      const res = await fetch(pageURL, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (!res.ok) break;
      const html = await res.text();
      const re = /<a[^>]+href="([^"]*\/job\/[^"]+)"[^>]*(?:class="[^"]*jobTitle[^"]*")?[^>]*>([^<]+)<\/a>/gi;
      let m, pageCount = 0;
      while ((m = re.exec(html)) !== null) {
        const href = m[1];
        const title = m[2].trim();
        if (!href.includes("/job/")) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        pageCount++;
        // Location often embedded in href: /job/London-Analyst%2C-QE... → first hyphen group
        const decoded = decodeURIComponent(href);
        const locMatch = decoded.match(/\/job\/([^-]+)-/);
        items.push({
          source_id: `sfrmk:${firm.name}:${href}`,
          title: decodeEntities(title),
          company: firm.name,
          location: locMatch ? decodeEntities(locMatch[1]) : "",
          application_url: href.startsWith("http") ? href : base + href,
          date_posted: TODAY,
          source: `successfactors:${firm.name}`,
        });
      }
      if (pageCount === 0) break;
    }
    return items;
  },

  async usajobs(firm) {
    // Federal jobs (DFC, other US agencies). Optional USAJOBS_API_KEY in env for higher limits.
    const key = process.env.USAJOBS_API_KEY || "";
    const hdrs = { "User-Agent": process.env.USAJOBS_USER_AGENT || "isaac.corona@gmail.com", Host: "data.usajobs.gov" };
    if (key) hdrs["Authorization-Key"] = key;
    // Build endpoint: prefer explicit URL, fall back to keyword+org search
    const url = firm.endpoint.includes("?") ? firm.endpoint : firm.endpoint + "&ResultsPerPage=100";
    const res = await fetch(url, { headers: hdrs });
    if (!res.ok) throw new Error(`USAJOBS ${res.status}`);
    const data = await res.json();
    const items = (data.SearchResult?.SearchResultItems || []).map((it) => {
      const j = it.MatchedObjectDescriptor;
      return {
        source_id: `usajobs:${j.PositionID}`,
        title: j.PositionTitle,
        company: firm.name,
        location: (j.PositionLocation || []).map((l) => l.LocationName).join("; "),
        application_url: j.PositionURI,
        date_posted: j.PublicationStartDate?.slice(0, 10) || TODAY,
        source: `usajobs:${firm.name}`,
        salary_range: j.PositionRemuneration?.[0]?.Description || "",
      };
    });
    return items;
  },
};

function isMDPlus(title = "") {
  if (!title) return false;
  if (MD_NEGATIVE_PATTERNS.some((re) => re.test(title))) return false;
  return MD_PLUS_PATTERNS.some((re) => re.test(title));
}

async function readJSON(p, fallback) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function loadManual() {
  const jobs = await readJSON(path.join(MANUAL_DIR, "jobs.json"), []);
  const exclude = await readJSON(path.join(MANUAL_DIR, "exclude.json"), { companies: [], ids: [], source_ids: [] });
  return { jobs, exclude };
}

function applyExclude(items, exclude) {
  const bannedCompanies = new Set((exclude.companies || []).map((c) => c.toLowerCase()));
  const bannedSourceIds = new Set(exclude.source_ids || []);
  return items.filter((it) => {
    if (bannedCompanies.has((it.company || "").toLowerCase())) return false;
    if (bannedSourceIds.has(it.source_id)) return false;
    return true;
  });
}

function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const key = it.source_id || `${it.company}|${it.title}|${it.location}`.toLowerCase();
    if (!seen.has(key)) seen.set(key, it);
  }
  return Array.from(seen.values());
}

function assignIds(autoItems, manualJobs) {
  // IDs: manual jobs keep their ids; auto jobs get ids starting after max(manual.id).
  const maxManualId = manualJobs.reduce((m, j) => Math.max(m, Number(j.id) || 0), 0);
  let next = maxManualId + 1;
  return autoItems.map((it) => ({ ...it, id: next++ }));
}

async function main() {
  const firmsCfg = JSON.parse(await fs.readFile(path.join(__dirname, "firms.json"), "utf8"));
  const firms = (firmsCfg.firms || []).filter((f) => f && f.name && f.platform);
  console.log(`[refresh] Starting daily refresh for ${firms.length} firms`);

  await ensureDir(AUTO_DIR);
  await ensureDir(MANUAL_DIR);
  await ensureDir(BACKUP_DIR);

  // Ensure manual files exist (first-run seed).
  for (const [file, seed] of [
    ["jobs.json", []],
    ["exclude.json", { companies: [], ids: [], source_ids: [] }],
    ["README.md", "# Manual data\n\nAnything you put here is NEVER overwritten by the daily refresh.\n\n- `jobs.json` — jobs you add by hand. Same schema as `data/auto/jobs.json`.\n- `exclude.json` — companies / source_ids to always filter out.\n"],
  ]) {
    const p = path.join(MANUAL_DIR, file);
    try { await fs.access(p); } catch { await fs.writeFile(p, typeof seed === "string" ? seed : JSON.stringify(seed, null, 2)); }
  }

  const { jobs: manualJobs, exclude } = await loadManual();
  console.log(`[refresh] Loaded ${manualJobs.length} manual jobs, ${exclude.companies?.length || 0} company exclusions`);

  // --- Fetch from every firm in parallel with per-firm error isolation ---
  const results = await Promise.allSettled(
    firms.map(async (firm) => {
      const fn = adapters[firm.platform];
      if (!fn) return { firm: firm.name, ok: false, count: 0, error: `Unknown platform ${firm.platform}` };
      try {
        const items = await fn(firm);
        return { firm: firm.name, ok: true, count: items.length, items };
      } catch (err) {
        return { firm: firm.name, ok: false, count: 0, error: err.message };
      }
    })
  );

  let allItems = [];
  const summary = [];
  for (const r of results) {
    const v = r.status === "fulfilled" ? r.value : { firm: "unknown", ok: false, error: String(r.reason) };
    summary.push(v);
    if (v.ok && v.items) allItems.push(...v.items);
    console.log(`[refresh] ${v.ok ? "OK" : "FAIL"}  ${v.firm.padEnd(50)} ${String(v.count || 0).padStart(4)}  ${v.error || ""}`);
  }

  const beforeFilter = allItems.length;
  allItems = allItems.filter((it) => isMDPlus(it.title));
  const afterMD = allItems.length;
  allItems = applyExclude(allItems, exclude);
  const afterExclude = allItems.length;
  allItems = dedupe(allItems);
  const afterDedupe = allItems.length;

  console.log(`[refresh] Filter funnel: raw=${beforeFilter} MD+=${afterMD} post-exclude=${afterExclude} deduped=${afterDedupe}`);

  // --- Enrich w/ defaults + last_scan_date ---
  allItems = allItems.map((it) => ({
    region: "Global",
    salary_range: "",
    application_method: "",
    contract_type: "Full-time",
    requirements: "",
    goldie_fit: "",
    suggested_recruiter: "",
    source_url: it.application_url || "",
    notes: "",
    industry: "",
    viewed: false,
    pinned: false,
    ...it,
    last_scan_date: TODAY,
  }));

  // --- Sanity guard (requires >=10 previous items to engage, so first runs never trip) ---
  const prev = await readJSON(path.join(AUTO_DIR, "jobs.json"), []);
  if (prev.length >= 10 && allItems.length < prev.length * 0.7) {
    const msg = `SANITY GUARD TRIPPED: auto jobs count dropped from ${prev.length} -> ${allItems.length} (>30% drop). Aborting commit.`;
    console.error(`[refresh] ${msg}`);
    // Write diagnostics and exit non-zero so Action fails & alerts.
    await fs.writeFile(path.join(AUTO_DIR, "last_run_summary.json"), JSON.stringify({ date: TODAY, aborted: true, reason: msg, summary }, null, 2));
    process.exit(2);
  }

  // --- ID assignment, keeping manual ids authoritative ---
  allItems = assignIds(allItems, manualJobs);

  // --- Backup today's auto output ---
  await fs.writeFile(path.join(BACKUP_DIR, `auto-${TODAY}.json`), JSON.stringify(allItems, null, 2));
  // Prune backups >7 days
  const backups = (await fs.readdir(BACKUP_DIR)).filter((n) => n.startsWith("auto-") && n.endsWith(".json")).sort();
  while (backups.length > 7) {
    const oldest = backups.shift();
    await fs.unlink(path.join(BACKUP_DIR, oldest));
  }

  // --- Write auto files ---
  await fs.writeFile(path.join(AUTO_DIR, "jobs.json"), JSON.stringify(allItems, null, 2));
  await fs.writeFile(
    path.join(AUTO_DIR, "last_run_summary.json"),
    JSON.stringify({ date: TODAY, total: allItems.length, funnel: { raw: beforeFilter, md_plus: afterMD, post_exclude: afterExclude, deduped: afterDedupe }, summary }, null, 2)
  );

  console.log(`[refresh] Wrote ${allItems.length} auto jobs for ${TODAY}`);
}

main().catch((err) => {
  console.error("[refresh] FATAL", err);
  process.exit(1);
});
