# GS Executive Search — Daily Automation (Phase 1)

## What it does

Every day at **11:00 UTC** (≈ 5:00 AM Mexico City), GitHub Actions fetches
Managing-Director-and-above roles from ~50 target firms (PE, infrastructure,
DFIs, sovereign wealth, pensions, fund-of-funds), merges them with your
hand-curated list, and opens a **pull request** you can review and merge.

**No Perplexity credits. No LLM API. Zero recurring cost.**

---

## Directory layout

```
data/
├── auto/           ← Machine-generated. OVERWRITTEN every run.
│   ├── jobs.json               (today's fetched jobs)
│   └── last_run_summary.json   (per-firm success/failure report)
└── manual/         ← Human-curated. NEVER touched by automation.
    ├── jobs.json               (jobs you add by hand; pinned forever)
    ├── exclude.json            (companies / source_ids to filter out)
    └── README.md

backups/            ← Last 7 daily snapshots of data/auto/jobs.json
scripts/
├── firms.json                     (list of target firms — edit freely)
├── refresh.js                     (fetch + filter MD+ + safety guard)
├── merge.js                       (auto + manual → data.js)
└── seed-manual-from-existing.js   (one-time seed of current data.js)
.github/workflows/daily-refresh.yml
```

---

## Safety guarantees

1. **Manual jobs never lost.** Everything in `data/manual/jobs.json` is
   preserved on every run. The seed script pinned every job from your
   original `data.js` into manual on first run.
2. **Sanity guard.** If a day's fetch returns < 70 % of the previous day's
   auto count, the workflow aborts without committing. You get an email.
3. **Exclude list.** Drop a company name into `data/manual/exclude.json` and
   it's filtered forever.
4. **Daily backups.** Last 7 days of `auto/jobs.json` kept in `backups/`.
5. **Human in the loop.** Every change lands as a pull request you merge.

---

## Operations

### Add a firm
Edit `scripts/firms.json`, commit. Next run picks it up.

### Remove a firm
Delete its entry in `scripts/firms.json`, commit.

### Exclude a company permanently
Edit `data/manual/exclude.json`:
```json
{ "companies": ["Acme PE"], "source_ids": ["greenhouse:acme:123"] }
```

### Add a job by hand
Append to `data/manual/jobs.json` (same schema as existing jobs). Set
`"pinned": true` to guarantee it survives every refresh.

### Trigger a run manually
**Actions → Daily job refresh → Run workflow.**

### Switch from "PR mode" to "auto-commit mode" (after the pipeline is trusted)
In `.github/workflows/daily-refresh.yml`, replace the
`peter-evans/create-pull-request` step with a direct commit step. (Phase 3.)

---

## Phase 2 (future)
- Custom adapters for EBRD / AfDB / ADB / FMO / Proparco / DEG / Norfund
  (they don't use standard ATS platforms).
- Optional cheap LLM audit pass (OpenAI gpt-4o-mini, ~$0.02/day) for
  richer `requirements` and `goldie_fit` fields.
- Expand firm coverage to 75–100 based on coverage gaps observed.
