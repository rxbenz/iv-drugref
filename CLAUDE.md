# IV DrugRef PWA v5.0 — Project Context

## What This Is
IV Drug Quick Reference PWA for healthcare professionals. Thai-language UI.
Single-page modules: drug lookup, IV compatibility, renal dosing, calculators, TDM, admin panel.

> **Communication**: Reply to the user (project owner) in **Thai**. The product
> UI and user-facing strings are Thai; keep code comments/commit messages in
> English unless an existing string is already Thai.

## Architecture

### Single Source → Auto Build → Deploy
```
v5.0-modular/          ← ONLY working directory (this repo)
├── *.html             ← Source HTML (references external css/js) — 8 pages
├── css/*.css          ← Modular stylesheets (per-page + shared.css, theme.css)
├── js/*.js            ← Modular JavaScript
├── i18n.js, translations-en.js, drugs-data.json, version.json, sw.js, manifest.json
│                      ← Root-level static files (copied as-is, NOT inlined)
├── build.js           ← Inlines CSS/JS into HTML for production (PAGES config)
├── .github/workflows/deploy.yml  ← GitHub Actions auto-deploy
└── dist/              ← Built output (gitignored)
```

> **Current version: 5.11.1** (see `package.json` / `version.json`). When
> shipping a release, bump the version string in `package.json`, `version.json`,
> `sw.js`, and the per-page footers so the force-update path fires.

**Deploy flow**: `git push main` → GitHub Actions → `node build.js --prod` → inline CSS/JS → deploy to GitHub Pages

**Auto features on every deploy**:
- Backup tag `deploy/YYYYMMDD-HHMMSS` created automatically
- `drugCacheVer` set to git commit hash (forces browser cache clear)
- CSS minified via clean-css; JS NOT minified (preserves obfuscated code)

**Local push**: Pre-push hook creates `local/YYYYMMDD-HHMMSS` backup tag

### Pages (8 total)
`index` (drug lookup) · `calculator` · `renal-dosing` · `compatibility` ·
`tdm` · `vanco-tdm` · `admin` · `dashboard` (analytics). Each page = one
`*.html` + its `css/*.css` + `js/*.js`, wired together in the `PAGES` object
of `build.js` (CSS/JS load order matters there).

### Key Files
| File | Purpose |
|------|---------|
| `js/core.js` | Shared utilities, GAS API calls, theme, i18n bootstrap, cache normalization |
| `js/index.js` | Drug lookup page — DRUGS array, search/filter (line 7 is minified — see below) |
| `js/compatibility.js` | IV compatibility checker — CURATED_PAIRS, DRUGS array, normKey() |
| `js/admin.js` | Admin panel — CRUD for compatibility pairs + drug data via GAS, diff/review modal |
| `js/renal-admin-block.js` | Admin panel — renal-dosing CRUD (loaded inside admin context) |
| `js/renal-dosing.js` | Renal dosing page — 26 drugs with GFR-based dosing tables |
| `js/curated-renal-drugs.js` | `CURATED_RENAL_DRUGS` hardcoded reference data (26 drugs) for bulk import |
| `js/calculator.js` | Clinical calculators (CrCl, BSA, IBW, drip rate) + unit toggles |
| `js/tdm.js` | TDM calculations — multi-drug Bayesian (`VancoTDM` lives here too) |
| `js/vanco-tdm.js` | Vancomycin AUC-based TDM (standalone page) |
| `js/pediatric-guard.js` | Centralized age-gated safety guard (`enforce(pt, context, opts)`) |
| `js/dashboard.js` | Analytics dashboard v6.1 — cross-filter engine, Chart.js, GAS analytics data |
| `js/quick-actions.js` | Cross-page floating action button (FAB): quick search / compat / drip rate |
| `js/onboarding.js` | First-run tutorial overlay (per-page step definitions) |
| `js/share-export.js` | Clipboard copy, LINE share, print-to-PDF for results |
| `js/error-tracker.js` | Error logging to GAS |
| `i18n.js` / `translations-en.js` | Root-level i18n (NOT inlined — copied static to `dist/`) |
| `drugs-data.json` | Static fallback drug dataset (166 drugs); copied static to `dist/` |
| `sw.js` | Service worker — PWA cache, push notifications, force-update logic |
| `version.json` | `{version, forceUpdate}` — fetched network-only by `sw.js` for cache busting |
| `gas-complete.js` | Google Apps Script backend (NOT deployed via git — copy manually to GAS editor) |
| `gas-update-rating-nps.js` | GAS snippet to add (drug rating + NPS endpoints) — paste into existing GAS |
| `build.js` | Build script: inlines CSS/JS per `PAGES`, injects cache version |

### Two GAS Deployments (Same Code, Different Spreadsheets)
Both use `gas-complete.js` but bound to different Google Sheets:

| GAS | Spreadsheet | URL |
|-----|------------|-----|
| **Admin** | Admin data (compatibility pairs, renal drugs, users) | `https://script.google.com/macros/s/AKfycbwJhLwY34rKpVVBE4aFRMOee6-lldazO64uOk0EXEA0Yvwgz6SA3kjeWt7-R6BSsNZT/exec` |
| **Analytics** | Analytics + drug data (ID: `1WWXRocEfhLSZRvuWPbDZ7uKlW60wGB3HIGF_4vjkIeE`) | `https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec` |

**IMPORTANT**: When updating `gas-complete.js`, you must manually copy to BOTH GAS editors and create new deployments.

### GitHub
- **Repo**: `https://github.com/rxbenz/iv-drugref.git`
- **Branch**: `main`
- **Live site**: `https://rxbenz.github.io/iv-drugref/`
- **Pages source**: GitHub Actions (NOT "deploy from branch")

## Key Technical Details

### normKey() — Drug Name Matching
Used in compatibility.js to match CURATED pair names to DRUGS array entries.
- Takes first alphabetical word: `"20% Mannitol"` → `"mannitol"`, `"Potassium chloride (KCl)"` → `"potassium"`
- Splits on spaces, commas, parentheses, slashes
- **Known collision**: Calcium gluconate & Calcium chloride both → `"calcium"`; similarly potassium, sodium variants

### drugCacheVer — Cache Busting
- Source code has placeholder `drugCacheVer` value
- `build.js` replaces it with git commit hash during production build
- On every deploy, users' browsers auto-clear stale localStorage drug data

### Service worker + version.json — force-update path
`sw.js` is a PWA service worker (offline cache, push notifications, urgent
alert background sync). It caches everything **except** `version.json`, which
is always fetched network-only. `version.json` = `{version, forceUpdate}`:
when `forceUpdate` is true (or the version changes), the client busts the SW
cache and reloads. The SW header carries its own version string (currently
`v5.11.1`), and its top-of-file changelog is a useful release log.

**Release checklist when bumping version**: update `package.json`,
`version.json`, the `sw.js` version constant + changelog, and the per-page
footer version strings together — otherwise the force-update won't trigger
consistently.

### CURATED_PAIRS / CURATED_RENAL_DRUGS
Hardcoded reference data in `js/admin.js` for bulk importing to Google Sheets via admin panel.
- 257 compatibility pairs
- 26 renal dosing drugs (in `js/curated-renal-drugs.js`)

## Build System Rules

### HTML must use `css/` and `js/` prefix for local files
`build.js` uses regex to find and remove `<link href="css/...">` and `<script src="js/...">` tags before inlining. If HTML uses bare paths (e.g., `href="shared.css"` instead of `href="css/shared.css"`), the build will:
- Fail to remove external refs
- Inject inlined content alongside broken external refs
- Result in 404 errors when served from `dist/`

**Correct** (build.js can find and replace):
```html
<link rel="stylesheet" href="css/shared.css">
<script src="js/core.js"></script>
```

**Wrong** (build.js regex won't match):
```html
<link rel="stylesheet" href="shared.css">
<script src="core.js"></script>
```

**Exception**: Files at root level (`i18n.js`, `translations-en.js`) are NOT part of the build's inline config — keep them without prefix. They get copied as static files to `dist/`.

### Google Sheets column names ≠ GAS code field names
The `DrugData` sheet uses **human-readable** column headers (`Generic Name`, `Trade Name`, `Reconst: Solvent`, etc.) while the GAS code uses **lowercase** keys (`generic`, `trade`, `reconst` as JSON object). The `normalizeDrugRow()` function maps between them. When adding new columns to the sheet, use the **lowercase** key name (e.g., `previousData`) — the code looks up columns by `headers.indexOf('previousData')`.

### GAS returns all data as strings — normalize after loading
Google Sheets stores everything as text. When drug data comes back from GAS, fields like `categories` and `monitoring` arrive as comma-separated strings (`"Antibiotic, Critical"`) or JSON strings (`"[\"Antibiotic\",\"Critical\"]"`), and nested objects like `reconst`, `dilution`, `admin`, `stability`, `compat` arrive as JSON strings (`"{\"solvent\":\"NSS\",...}"`). Frontend code (e.g., `openDrugModal()`) expects arrays and objects — calling `.join()` on a string throws `TypeError`.

**Fix**: `normalizeDrugFields()` in `js/admin.js` runs on every drug after loading (both API and cache paths) and converts:
- `categories`/`monitoring` → parsed to arrays
- `reconst`/`dilution`/`admin`/`stability`/`compat` → parsed to objects

**Rule**: Any new code that reads drug fields must NOT assume correct JS types. Always go through `normalizeDrugFields()` or check types before using array/object methods.

### index.js line 7 is minified — extend via monkey-patching
The main drug logic on line 7 of `js/index.js` is minified/obfuscated. To add features, append new code **after line 143** and monkey-patch existing global functions (e.g., `renderDrugCard`, `toggleCard`, `updateList`). Register new actions via a second `IVDrugRef.delegate()` call — multiple delegate calls on the same container work fine.

### Quick Access Zone — Favorites, Most Used, Recent (v5.1.0)
localStorage keys for the quick access feature:
- `drugFavorites` — `number[]` of bookmarked drug IDs
- `drugViewHistory` — `{id,ts}[]` of last 20 viewed drugs
- `drugViewCounts` — `{[id]: count}` view count per drug

The `#quickAccessZone` div sits between `#resultsInfo` and `#drugList` in `index.html`. It renders 3 sections (favorites, most used, recent) only when search is empty and filter is "all".

### Pediatric vancomycin via Colin 2019 (v5.11.0) — unblock peds 1-17
Closes the loop on the v5.9.3 pediatric guard (which temporarily blocked all
peds vanco Bayesian). Vancomycin now has an age-routed pediatric model:

- **Age routing** (both `vanco-tdm.js` + `tdm.js` VancoTDM): `<1` still BLOCKED
  by guard (no neonate PMA/GA infra yet); **1-17 → Colin 2019** (single model);
  `≥18` → adult 5-model path (v5.10.0, unchanged — no regression).
- **Guard change** (`pediatric-guard.js`): `VANCO_BAYESIAN` removed from the
  1-17 block list (vanco has a peds-validated model now). The `isInfant` (<1)
  branch still blocks ALL contexts including vanco. Other Bayesian drugs
  (aminoglycoside/phenytoin/…) remain adult-only (still in BLOCK_CONTEXTS).
- **Colin model** (Clin Pharmacokinet 2019;58:767-80, verified vs Table 3 +
  Eq 5-13): `CL = θCL·FSize^0.75·FMat·FDecline·FSCR·(×1.294 if heme)`,
  `Vss = (42.9+41.7)·WGT/70` (2-comp → single V for the 1-comp engine).
  **Unit traps:** FMat uses PMA in **weeks**, FDecline/SCRstd use PMA in
  **years**; SCr in **mg/dL** (no μmol conversion); FDecline exponents BOTH
  negative (`PMA^-γ2 / (PMA^-γ2 + AGE50^-γ2)`). PMA(yr)=age+40/52.
  Golden verified: 35yo/70kg/SCr0.83 → CL 4.10; 60yo/65kg/SCr0.97 → CL 2.55.
- **Level policy:** peds without a measured level → population estimate shown
  as a **starting reference only** (no AUC-based dose recommendation, per
  ASHP/IDSA 2020); a measured level enables full Bayesian AUC dosing.
- **SCr sanity warning** (peds, non-blocking): SCr<0.2 mg/dL (FSCR sensitive)
  or SCr high-for-age.
- **Priors** (Colin Table 3, verified): ω_CL 0.279 (27.9% CV); ω_Vss 0.586
  (lognormal combine of V1 27.3% + V2 97.9% IIV — size-invariant, one value
  for all ages); residual proportional 0.215. Engine is proportional-only →
  paper's additive error term (1.23 mg/L SD) NOT modeled (backlog, tied to the
  2-comp engine that would carry separate V1/V2 IIV).

Still duplicated across the two files (shared `PK_MODELS`/peds module = future PR).

**Peak/trough disclaimer (v5.11.1)**: peds results (Colin path, `modelId==='colin'`)
append a bilingual amber info-box after the CI block stating peak/trough are
1-comp approximations and AUC₂₄ is the reliable peds target — because ω_Vss
is a lognormal approximation of V1+V2 (V2 IIV 97.9%), so AUC is robust but the
V-derived peak/trough are less reliable. UI-only (`_pedsPkTroughDisclaimer()` in
both files, via `IVDrugRefI18n.getCurrentLang()`); no calc/equation change.

### Vancomycin PK coefficient correction (v5.10.0) — clinical calc change
Phase 2b fix for inflated AUC (root cause: wrong `clFn` clearance slopes →
CL 2–10× too low → AUC 2–3× too high → under-dosing). All 5 vanco PK
models in `js/vanco-tdm.js` and `js/tdm.js` (VancoTDM) re-derived from
primary papers:

- Engine stays **1-compartment** (Option B). `AUC24,ss = daily_dose / CL`
  is exact and compartment-independent, so correct CL = correct AUC.
  2-comp models (Llopis, Goti) use **Vss = Vc+Vp** as the single V (V only
  affects peak/trough shape, not interval AUC).
- Model interface changed: `clFn(crcl)` → **`clFn(pt)`**, plus per-model
  **`crclFn(pt)`** and `vdFn(pt)`, because each paper uses a different CrCl
  method (CG-plain / CG-LBW+cap120 / CG-truncate150+SCr-adj / CG-BSA-1.73 /
  Jelliffe). Engine call sites updated in `bayesianMAP` + `runMCMC` (both files).
- `roberts` (id+name) → **`llopis` / Llopis-Salvia 2006** (was mislabeled).
- Bourguignon: paper gives `kel`, not CL → `CL = kel × V`.
- Recommend logic: Adane trigger BMI≥40 (was ≥30), general default → **Goti ⭐**;
  startup model still `auto` (lowest OFV).
- Interim amber banner in both vanco UIs: "AUC calculation updated (v5.10.0)".

Verified (45M/70kg/170cm/SCr1.0, 1000mg q12h): Buelga CL 5.99 (AUC 324),
Goti CL 3.65 (AUC 535), Llopis CL 3.49 (AUC 561, CG-LBW). Old Goti 1167 → 535.

**Still duplicated** across the two files (shared `PK_MODELS` module = separate
PR). 2-comp engine + 4-param fit = future Option A if peak/trough fidelity needed.

### Pediatric Safety Guard (v5.9.3)
Centralized module `js/pediatric-guard.js` enforces age-gated access to
adult-only clinical decision support:

- **Block (age <18)** in all Bayesian TDM contexts (vanco/aminoglycoside/
  phenytoin/valproate/digoxin/tacrolimus/warfarin) — population PK models
  are derived from adult cohorts and are NOT validated for pediatrics.
- **Block (age <1)** in every context — both Schwartz and CG are invalid
  for infants.
- **Warn (age <18)** in `calculator.html` and `renal-dosing.html` because
  adult dose thresholds (mL/min absolute) don't map cleanly to Schwartz
  eGFR (mL/min/1.73m² indexed).

Integration points (single chokepoint per page):

| Page | Banner element | Trigger |
|---|---|---|
| `tdm.html` | `#tdmGuardBanner` | `updateCrCl()` + every `*Run` action |
| `vanco-tdm.html` | `#vancoGuardBanner` | `updateCrCl()` + `runBayesian()` |
| `calculator.html` | `#calcGuardBanner` | `updateCrCl()` |
| `renal-dosing.html` | `#renalGuardBanner` | `recalc()` |

Each `enforce(pt, context, opts)` call:
1. Computes guard status from `pt.age` + context type.
2. Renders/clears the banner (uses existing `.info-box.red`/`.amber`).
3. Disables run buttons via `opts.disableSelectors` (block-only).
4. Throttled analytics event `pediatric_guard` (5s rolling per context).

**Known limitation**: This is a guard layer only. The underlying silent
CG override in `tdm.js:294,353` and `vanco-tdm.js` (`bayesianMAP`/
`runMCMC` recompute CG even when display shows Schwartz) is intentionally
left for Phase 2 to keep the surface area of this safety fix small.

**Display consistency (v5.9.3 follow-up)**: `vanco-tdm.js` `updateCrCl()`
now shows Schwartz eGFR for age <18 (matching `tdm.js`), so the CrCl
field reads identically across both pages for the same pediatric patient.
This is display-only — the engine still computes CG internally (Phase 2),
which is safe because the guard blocks pediatric Bayesian calculation.

### `monitoring` field — GAS-cached data normalization (FIXED v5.3.6)
GAS returns `monitoring` and `categories` as comma-separated strings. Fixed with two-layer normalization:
1. `core.js` — normalizes `localStorage.drugData_v4` cache **before** `index.js` reads it (fixes initial render)
2. `index.js` — monkey-patches `renderDrugCard` to normalize each drug as safety net
Also normalizes `reconst`, `dilution`, `admin`, `stability`, `compat` from JSON strings to objects.

### Testing admin.html locally
- Admin page requires Google Sign-in — most features won't work in local preview
- Use `npm run build:prod` then serve from `dist/` (NOT `build:dev` — admin.html needs inlined CSS/JS)
- To test UI without auth: inject mock data via `localStorage.setItem('ivdrug_admin_drugsCache', JSON.stringify([...]))` and `localStorage.setItem('ivdrug_admin_myRole', 'admin')` then reload

## Common Tasks

### Add/Edit a page
1. Edit the HTML + `css/*.css` + `js/*.js` source files
2. If new page: add entry to `PAGES` object in `build.js`
3. `git push` — auto-builds and deploys

### Update GAS backend
1. Edit `gas-complete.js` locally
2. Copy entire file to **both** GAS editors (Admin + Analytics)
3. In each: Deploy → New deployment → Web app → Execute as Me → Anyone access
4. Update deployment URLs in `js/core.js` if URLs change

### Test locally
```bash
npm run build:dev    # Copy files to dist/ (external refs)
npm run build:prod   # Full production build (inline + minify)
npx http-server .    # Serve locally
```

> **Note**: `npm test` in `package.json` points to `test/clinical-formulas.test.js`,
> but that file/dir does **not** exist in the repo — there is currently no
> automated test suite. Verify clinical changes manually (or add the test file
> first). The `dependencies` block also lists `docx`/`terser`, but the live
> build only uses `clean-css` (JS is intentionally not minified).

### Rollback
```bash
git tag -l "deploy/*"       # List deploy backups
git tag -l "local/*"        # List local backups
git checkout deploy/20260405-090013  # Go to specific backup
```

## Pending Items
- [ ] Deploy latest `gas-complete.js` to BOTH GAS editors (has upsert bulk import + version endpoint + **previousData** diff support)
- [ ] Re-import CURATED compatibility pairs via admin panel after GAS deploy
- [ ] Delete Valproic+Meropenem pair manually from admin (PK interaction, not Y-site)
- [ ] Admin panel GAS version check UI (endpoint exists at `?action=version`, UI not built)
- [ ] Connect renal-dosing.html to fetch from Google Sheet instead of hardcoded data
- [x] Drug Data Diff / Change Review modal ใน admin panel (side-by-side diff ตอน approve pending drug)
