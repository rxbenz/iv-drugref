# IV DrugRef PWA v5.0 — Project Context

## What This Is
IV Drug Quick Reference PWA for healthcare professionals. Thai-language UI.
Single-page modules: drug lookup, IV compatibility, renal dosing, calculators, TDM, admin panel.

> **Communication**: Reply to the user (project owner) in **Thai**. The product
> UI and user-facing strings are Thai; keep code comments/commit messages in
> English unless an existing string is already Thai.

> **Working style — ผู้ใช้คือเภสัชกรที่เพิ่งเริ่มเขียนโปรแกรม** (เชี่ยวชาญเภสัชกรรม
> สูงมาก แต่ไม่คุ้นศัพท์ dev) ต้องปรับวิธีทำงานดังนี้ — ใช้กับทุก session:
> 1. **อธิบายก่อนทำ** — ก่อนรันคำสั่งหรือสร้าง/แก้ไฟล์สำคัญ บอกสั้น ๆ ว่ากำลังจะ
>    ทำอะไรและทำไม อย่าทำเงียบ ๆ
> 2. **ทำทีละขั้นเล็ก แล้วหยุด** ให้ผู้ใช้ถาม/ยืนยัน อย่ารวบหลายขั้นรวดเดียวจน
>    ตามไม่ทัน (งานใหญ่ → ซอยเป็นขั้น ๆ)
> 3. **อธิบายศัพท์ใหม่ครั้งแรกที่เจอ** — เช่น RLS, migration, environment variable,
>    branch, commit — ขยายความสั้น ๆ เป็นภาษาไทย
> 4. **เมื่อเกิด error อธิบายว่ามันแปลว่าอะไร + จะแก้ยังไง** ไม่ใช่แก้ให้เงียบ ๆ
>    เพื่อให้ผู้ใช้ได้เรียนรู้ไปด้วย
> 5. **เทียบกับงานเภสัชกรรมเมื่อช่วยให้เข้าใจ** เช่น foreign key เหมือนใบสั่งยา
>    ที่อ้าง HN, RLS เหมือนตู้ยาเสพติดที่ล็อกที่ตัวตู้, git branch เหมือนร่าง
>    ฉลากยาเวอร์ชันใหม่ที่ยังไม่แทนของจริงบนชั้น
> 6. **ภาษาไทยเป็นหลัก** ทับศัพท์อังกฤษได้เมื่อเป็นศัพท์เทคนิคที่ไม่มีคำไทยที่ดีกว่า

> **Before changing anything**: follow the development rules in
> [`CONTRIBUTING.md`](CONTRIBUTING.md) — `main` = production (push auto-deploys),
> so work on a feature branch, build clean, verify clinical changes against
> primary sources + golden values, then merge via PR. See
> [`ROADMAP.md`](ROADMAP.md) for prioritized backlog.

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

> **Current version: see `package.json` / `version.json`** (single source; don't
> hardcode a number here). When shipping a release, run **`npm run release --
> <version> --title "หัวข้อไทย" "โน้ต1" "โน้ต2"`** (`bump-version.js`) — it bumps
> `package.json`, `version.json` (+ `forceUpdate:true`), `sw.js` (header +
> `CACHE_NAME` + changelog line) and `core.js` `VERSION` **in lockstep** and
> prepends a Thai `RELEASE_NOTES` entry (the "What's New" popup content). Never
> hand-edit these version strings — a drift between `core.js VERSION` and
> `version.json` breaks force-update. Per-page footers auto-update from
> `[data-app-version]` (no edit needed).
> **App version is single-sourced**: `core.js` `VERSION` fills every
> `[data-app-version]` element (footers, header badges, the index `#versionInfo`
> footer, and the `showAbout` dialog) — don't hardcode version numbers in HTML/JS
> display strings, add `data-app-version` instead.

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
| `js/tdm.js` | TDM calculations — multi-drug Bayesian (`VancoTDM` lives here too; consumes `js/pk-models.js`) |
| `js/vanco-tdm.js` | Vancomycin AUC-based TDM (standalone page; consumes `js/pk-models.js`) |
| `js/pk-models.js` | **Shared** vanco PK models (5 adult + Colin 2019 peds) → `window.VancoPK`; used by both TDM pages |
| `js/pediatric-guard.js` | Centralized age-gated safety guard (`enforce(pt, context, opts)`) |
| `js/dashboard.js` | Analytics dashboard v6.1 — cross-filter engine, Chart.js, GAS analytics data |
| `js/quick-actions.js` | Cross-page floating action button (FAB): quick search / compat / drip rate |
| `js/onboarding.js` | First-run tutorial overlay (per-page step definitions) |
| `js/share-export.js` | Clipboard copy, LINE share, print-to-PDF for results |
| `js/error-tracker.js` | Error logging to GAS |
| `i18n.js` / `translations-en.js` | Root-level i18n (NOT inlined — copied static to `dist/`) |
| `drugs-data.json` | Offline/first-paint drug dataset (166 drugs); the committed copy is the fallback — `build.js` refreshes `dist/` from Supabase (see below) |
| `drug-snapshot.js` | Build-time snapshot refresh: fetch approved drugs from Supabase + `validateSnapshot()` (the guard that refuses bad data) |
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
| **Analytics** | Analytics + drug data (ID: `1WWXRocEfhLSZRvuWPbDZ7uKlW61wGB3HIGF_4vjkIeE` — as in `gas-complete.js` `DRUG_SPREADSHEET_ID`, the value the working deployment uses) | `https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec` |

**IMPORTANT**: When updating `gas-complete.js`, you must manually copy to BOTH GAS editors and create new deployments.

> **GAS editor: Run ≠ Deploy.** The maintenance functions in `gas-complete.js`
> (`inspectAnalytics`, `cleanSeed*`, `migrateToSupabase*`, `resetMigrationFlags`)
> run from the editor's **Run** button using the latest **saved (Ctrl+S)** code —
> no Deploy needed. **Deploy** only republishes the Web App (doGet/doPost) for the
> live site. Run the analytics maintenance/migration helpers from the **Analytics**
> GAS project (it's bound to the analytics spreadsheet).

### Analytics backend → Supabase (migrated v5.29.0–v5.30.0)
**Analytics now lives in Supabase Postgres, not Google Sheets.** GAS/Sheets was
the wrong tool for high-volume append-only analytics (write quotas, 6-min limit,
recurring "An unknown error has occurred" on bulk writes). Phase 1 migrated it:

- **Supabase project**: `iv-drugref` (ref `bzwbagojjpiazbeaahmg`, region Singapore).
  URL `https://bzwbagojjpiazbeaahmg.supabase.co`. The **publishable** key
  (`sb_publishable_…`, = anon role) is safe in the browser and is hardcoded in
  `core.js` + `dashboard.js`; the `sb_secret_…` key must NEVER ship to the client.
- **Schema** (`supabase/schema.sql`): one append-only table `public.events`
  `{id, ts (server now(), authoritative UTC), client_ts, type, session_id,
  user_id, app_version, data jsonb}` + indexes. **RLS**: anon may **INSERT** and
  **SELECT** only (no update/delete). Server-set `ts` permanently kills the old
  seed/timezone ambiguity (clients can't forge time).
- **Single events table** replaces the 17 Sheets tabs. `data` jsonb holds the
  event-specific fields; `type` is the canonical event name (UPPER_CASE like
  `SEARCH`, `VIEW_DRUG`, `SESSION_START`, plus lowercase `page_view`). The doPost
  router in `gas-complete.js` is the source of truth for the sheet↔type mapping;
  `SHEET_TO_TYPE` (migration) and `TYPE_TO_KEY` (dashboard) mirror it.
- **Write path** (`core.js` `sendToSupabase` inside `sendAnalytics`): reshapes each
  flat event into the table row (top-level columns + everything else under `data`)
  and POSTs via `fetch(..., {keepalive:true})` — `sendBeacon` can't set the
  `apikey`/`Authorization` headers. **Currently DUAL-WRITES** to both Supabase and
  GAS (legacy). **Phase 1 step 6 (pending, deferred as a safety net): remove the
  GAS write from `sendAnalytics` and route the offline IndexedDB queue to
  Supabase too** — then GAS is no longer in the analytics path.
- **Read path** (`dashboard.js` `fetchRaw`): pages the `events` table
  (`?select=…&order=ts.asc&limit=1000&offset=`), reshapes back into the per-type
  `RAW` arrays (`ev.ts → row.timestamp`, `data` fields spread to top level) so all
  existing charts/cross-filter work unchanged. No GAS URL needed.
- **CSP**: every page's `connect-src` includes the Supabase host (needed or the
  browser blocks the POST/GET). Add it when introducing new pages.
- **Historical backfill** (`gas-complete.js` `migrateToSupabase*`, run once from
  the Analytics GAS editor): copied **18,971** real rows (timestamp ends in `Z`;
  the `+07:00` seed rows dropped automatically) into `events`, tagged
  `data._src='sheets'`. Resumable via Script Properties offsets (`mig_off_<sheet>`)
  — re-run after a transient error and it skips what's sent (no dupes).
  `MIG_CUTOFF` (2026-06-22T05:00:00Z) excludes post-deploy rows already captured
  by the live dual-write. Full redo = wipe `data->>'_src'='sheets'` in SQL +
  `resetMigrationFlags()`.

**GAS is still used** for admin CRUD (compat pairs / drug data / renal / allergy),
urgent alerts, and drug-data sync — those are a future **Phase 2** (admin data →
Supabase). The Two-GAS-Deployments note above still applies to that non-analytics
backend.

### Reference data → Supabase (Phase 2 step 2, v5.32.0–v5.35.0)
**Admin-maintained reference data now READS from Supabase**, while the admin
panel keeps writing through GAS (unchanged) and GAS **dual-writes** each change
to Supabase — so reads/writes stay consistent with **no split-brain** and **no
admin-login rework**. Tables (all `id|key + data jsonb`, public-read /
admin-write RLS via `is_admin()`): `drugs`, `compat_pairs`, `renal_drugs`,
`allergy_groups`, `allergy_refs` (`supabase/refdata.sql`).

- **Read paths** now hit Supabase (public-read, anon key), each reshaping rows'
  `data` back to the app's existing shape; the hardcoded/`drugs-data.json`/cache
  fallbacks stay if offline/empty:
  - `index.js` — `window.fetchDrugsFromServer` override → `drugs?status=eq.approved`
  - `compatibility.js` `loadCompatPairsFromSheet` → `compat_pairs` → `[[a,b,result],…]`
  - `renal-dosing.js` `loadRemoteRenalDrugs` → `renal_drugs`
  - `allergy.js` `loadRemoteAllergyData` → `allergy_groups` + `allergy_refs`
- **Write path = GAS dual-write** (`gas-complete.js`, ADMIN GAS): each
  create/update/delete/bulk handler calls a best-effort `_sync*Safe()` that
  upserts the whole (small) table to Supabase via the **service key**, and delete
  also `_supaDelete`s the row. The service key is read from **Script Properties**
  (`SUPABASE_SERVICE_KEY`) — NEVER hardcoded (the repo is public). Uses the
  **legacy `service_role` JWT** (the new `sb_secret_…` key is blocked by
  Supabase's "no secret key in browser" guard even from UrlFetchApp).
- **One-time backfills** (run from the **ADMIN GAS** editor; drug data is reached
  via `getDrugSS()` openById, so it works from Admin too):
  `migrateRenalToSupabaseNow` / `migrateCompatToSupabaseNow` /
  `migrateDrugsToSupabaseNow` / `migrateAllergyToSupabaseNow`. Drug rows go
  through `normalizeDrugRow` (DrugData sheet uses human-readable headers).
- **After editing any `_sync*`/handler in `gas-complete.js` you must Deploy the
  ADMIN GAS** (Run only affects the editor; the live dual-write runs in the
  deployed web app). CSP `connect-src` already includes the Supabase host.
- **Still pending Phase 2**: the dashboard already requires Supabase Auth (admin
  is the `is_admin()` allowlist in `admins`); admin-panel writes still go through
  GAS (the dual-write bridge) rather than writing Supabase directly.

### Drug–Drug Interaction (DDI) engine — `js/drug-interactions.js`
Pharmacological interaction screening (SEPARATE from IV/Y-site compatibility),
its own page (`interactions.html` + `js/interactions.js`), shared drug list
(`window.COMPAT_DRUGS`). Hybrid model: (A) additive-risk **CLASS tags** per drug
(≥2 selected drugs share a class → auto-flag; 10 classes: QT, serotonergic,
nephrotoxic, bleeding, hyperK, ototoxic, cnsDepress, bradycardia, hypotension,
anticholinergic) + (B) **curated explicit pairs** for named interactions the
class model can't express (e.g. valproate+carbapenem). `CLASS_DEFS` (class
metadata: severity/mechanism/management) is code-only, NOT remote.

- **Admin edits via Supabase** (`ddi_pairs` / `ddi_class_rules`, public-read /
  admin-write; admin writes go direct via `AdminSupabase`, Phase B). "Import
  Defaults" (`admin.js importDDIDefaults`) seeds them from the code defaults
  (`DrugInteractions._CURATED` / `._CLASS_RULES_SEED` — the **pristine** arrays).
- **MERGE-OVER-DEFAULTS (v5.51.6, safety-critical — do NOT revert to replace):**
  `loadRemote()`→`_applyRemote()` MERGES the remote tables **over** the built-in
  code defaults; it never replaces them. **Class rules**: classes are **UNIONed**
  per keyword, so the code set is a guaranteed **floor** — an incomplete/stale
  Supabase table can never silently drop a vetted interaction (admin can ADD
  keywords/classes but not remove a code tag from the live screen). **Curated
  pairs**: code ∪ remote by **side-identity** (sorted sides, ignoring severity) —
  a same-identity remote pair OVERRIDES the code default (admin can edit
  severity/mechanism), new ones are added, untouched code pairs are always kept.
  To REMOVE/correct a wrong default tag → change the code + regenerate
  `docs/ddi-verify.html`, not Supabase. Locked by `test/drug-interactions.test.js`
  ("remote SAFETY FLOOR" / "UNIONs classes" / "OVERRIDES default" tests).
  *(This is why "Midazolam+Morphine shows no interaction" happened pre-fix: the
  remote ddi_class_rules was missing the cnsDepress tags and REPLACED the code
  floor.)*
- **Verify doc**: `docs/ddi-verify.html` (interactive checkboxes, localStorage
  progress) is generated from the code defaults by `node docs/gen-ddi-verify.js` —
  regenerate after any DDI data edit so the pharmacist can re-verify vs
  UpToDate/Lexicomp.

### GitHub
- **Repo**: `https://github.com/rxbenz/iv-drugref.git`
- **Branch**: `main`
- **Live site**: `https://rxbenz.github.io/iv-drugref/`
- **Pages source**: GitHub Actions (NOT "deploy from branch")

## Key Technical Details

### normKey() / keyCandidates() — Drug Name Matching
Used in compatibility.js to match CURATED pair names to DRUGS array entries.
- `normKey` takes the first alphabetical word: `"20% Mannitol"` → `"mannitol"`,
  `"Potassium chloride (KCl)"` → `"potassium"` (splits on spaces, commas,
  parentheses, slashes). Kept as the generic-key helper.
- **Salt-collision fix (P2.3)**: `normKey` alone collapsed every salt of a
  cation to one key (Calcium gluconate & Calcium chloride → `"calcium"`; the 4
  sodium salts → `"sodium"`), so one salt's curated pair leaked onto a different
  salt. `keyCandidates(name)` now returns most-specific-first keys: for a cation
  prefix (`CATION_PREFIXES` = calcium/potassium/sodium/magnesium/…) with a 2nd
  word it returns `[cation+anion, cation]` (e.g. `["calciumgluconate","calcium"]`),
  otherwise `[firstWord]`. `CURATED_MAP` stores each curated name under its
  most-specific key; `getCompatibility` probes specific→generic. Net effect:
  a salt-specific curated entry wins, a **bare-cation** entry (the DB's
  intentional generic, e.g. `"Potassium"` = KCl additive) still matches every
  salt as a fallback, and one salt's specific data **never** leaks to another
  salt of the same cation. Locked by 4 tests (`loadCompatibility` in the test
  helper slices the file's IIFE to expose the pure matchers).

### XSS hardening — `IVDrugRef.escHtml()` (ROADMAP P3.1)
Canonical HTML escaper in `core.js` (escapes `& < > " '`; nullish → `''`). **Any
user- or GAS/Sheet-derived string** put into `innerHTML` or a quoted attribute
must go through it (GAS/Sheet data is admin-authored → stored-XSS vector).
- `index.js` drug-card renderer is in the **obfuscated line-7 blob** (can't edit
  in place): the `renderDrugCard` monkey-patch hands `_origRenderCard` a
  **deep-escaped copy** (`_escDeep`) so the rendered HTML is safe while the raw
  `DRUGS` entry (used by search/filter) is untouched. Urgent alerts are escaped
  by wrapping the global `handleUrgentAlertsUpdate` (escape display fields on a
  copy, keep `id` for dismiss). Quick-access chips + star `data-name` escape
  inline.
- `admin.js` / `renal-admin-block.js` have their own (textContent-based)
  `escHtml`; both are XSS-routed except the few gaps fixed in P3.1.
- **Known 🟡 (not live today)**: `compatibility.js` + `renal-dosing.js` render
  developer-controlled **static** arrays unescaped — escape these when they're
  wired to GAS (P2.1/P2.4). `share-export.js printReport` is an HTML passthrough;
  never feed it raw user/GAS strings.

### drugCacheVer — Cache Busting
- Source code has placeholder `drugCacheVer` value
- `build.js` replaces it with git commit hash during production build
- On every deploy, users' browsers auto-clear stale localStorage drug data

### Service worker + version.json — force-update path
`sw.js` is a PWA service worker (offline cache, push notifications, urgent
alert background sync). It caches everything **except** `version.json`, which
is always fetched network-only. `version.json` = `{version, forceUpdate}`:
when `forceUpdate` is true (or the version changes), the client busts the SW
cache and reloads. The SW header carries its own version string, and its
top-of-file changelog is a useful release log.

**Force update EVERY session (v5.52.0)**: `core.js` `checkForUpdate()` seeds its
baseline from the **build-embedded `VERSION`** (not the first value fetched from
`version.json`). So on the very first check after load, a **stale cached build**
already sees `version.json.version !== VERSION` and force-reloads — the old code
adopted the server value and never compared, so a behind build was only caught if
the version changed while the tab stayed open. A per-session sessionStorage guard
(`ivdr_forced_<v>`) forces at most once per target version so a build/`version.json`
drift can't cause a reload loop (falls back to the dismissible SW toast).

**Release**: run `npm run release -- <version> --title "…" "โน้ต…"` — do NOT
hand-edit version strings (see the Architecture note above). It keeps
`core.js VERSION` and `version.json` in lockstep (a drift breaks force-update).

### "What's New" popup — `RELEASE_NOTES` in `core.js` (v5.52.0)
On app open, `maybeShowWhatsNew()` shows a **Thai** modal of what changed, **once
per version** (tracked in `localStorage.ivdr_lastSeenVersion`). Content = the
`RELEASE_NOTES` array in `core.js` (newest-first; `{v,date,title,items[]}`), which
`npm run release` prepends to automatically — so the popup is guaranteed to match
the running build (embedded, not fetched; works offline). Gating: brand-new
installs are seeded silently (no nag on first ever run) unless prior app state
exists (`anonUserId`/`drugData_v4`/…), in which case the current notes show once so
the rollout is visible to existing users. The modal is self-contained (built in
`core.js`, themed via the theme CSS vars → auto light/dark) so it works on all 8
pages with no per-page HTML/CSS. Re-open manually via `window.showWhatsNew()` /
`IVDrugRef.showWhatsNew()` (wire a menu/About link to it if desired).

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

### Large writes go by POST — `doPost` must route them (fixed v5.72.0)
`js/admin.js` `apiCall()` sends a write as a **GET** with the payload in the query
string, but switches to **POST** once that URL would exceed ~6 KB — which a drug
record with long Thai `precautions` does. Two things made that path lose data:

- **`doPost` didn't know the action.** It hand-listed only the bulk/allergy ops,
  so `updateDrug`/`createDrug`/`approveDrug` fell through to the analytics switch
  and were filed as a **Sessions row** — the drug was never written.
- **The client couldn't see the reply.** It sent `mode:'no-cors'` (opaque
  response) and returned a fabricated `{success:true}`.

Both fixed: `routeApiAction(action, user, data, e)` is now the **single routing
table shared by `doGet` and `doPost`** (add a new action there, never to one verb
only), and the POST is a plain readable request — `text/plain` + no custom
headers keeps it a "simple" request, so the browser skips the CORS preflight GAS
cannot answer and the redirected response's `Access-Control-Allow-Origin: *` lets
the client read `written`/`skipped`/errors exactly as on the GET path.
- Analytics events are told apart by their `type`/`event` field, so a
  `QUICK_ACTION` carrying its own `action` can never reach an API handler.
- If the reply is genuinely unreadable, `apiCall` **throws** rather than retrying:
  the request already left the browser, so a blind resend could duplicate a
  create. The Thai error tells the admin to refresh and check before re-saving.
- Locked by `test/gas-post-routing.test.js` (12 tests; 6 fail against pre-fix code).

### `drugs-data.json` is refreshed from Supabase at build time (v5.71.0)
`drugs-data.json` is what `index.js` renders on first paint and offline (cache →
this file → Supabase sync). It was committed once and then drifted: by v5.70.0 it
still flagged a drug as HIGH-ALERT that the admin panel had un-flagged months
earlier. `build.js` now overwrites **`dist/drugs-data.json`** (never the repo copy)
with the live approved drugs right after the static-file copy.

- **`drug-snapshot.js`** holds the two pure pieces: `fetchApprovedDrugs()` (same
  public-read query + publishable key the app uses; never throws — a build must
  not die on someone else's outage) and `validateSnapshot(rows, baselineCount)`.
- **The refusal is the feature.** The committed snapshot is already in `dist/`, so
  anything `validateSnapshot()` rejects leaves users on known-good data. It
  refuses a non-array, an empty response, rows with no usable `generic`, and —
  the important one — **any result below `MIN_RATIO` (90%) of the committed
  count**, which catches truncation/pagination and an emptied table. A rejected
  refresh logs the reason and the build still succeeds.
- **Order is by numeric `id`, not by name** — the committed file is in id order
  (1 = Abciximab … 166 = Pembrolizumab, newer drugs appended) and `index.js`
  renders `DRUGS` in array order, so sorting by name would push `20% Mannitol` /
  `3% NaCl` to the top of the app's first page. Locked by a test that feeds the
  committed file back through `validateSnapshot()` and asserts an unchanged
  refresh reproduces it byte-for-byte.
- `previousData`/`createdBy`/`updatedBy`/`updatedAt` are stripped — this artifact
  is public.
- **Offline builds**: `SKIP_DRUG_SNAPSHOT=1` skips the fetch;
  `DRUG_SNAPSHOT_ENDPOINT=<url>` points it elsewhere (used by the build test).
- Covered by `test/drug-snapshot.test.js` (20 tests, no network).

### Google Sheets column names ≠ GAS code field names (silent-write trap — fixed v5.69.0)
The `DrugData` sheet uses **human-readable** column headers (`Generic Name`, `Trade Name`,
`Reconst: Solvent`, `HAD`, …) while the GAS code uses **lowercase** keys (`generic`, `trade`,
`reconst` as JSON object). `normalizeDrugRow()` maps them on **read**.

**Writes must go through `_drugCol()` / `_drugCells()`** (`gas-complete.js`), never a bare
`headers.indexOf(<code key>)`. Until v5.69.0 they did exactly that, so on the production
sheet **every** field missed its column, `if (col >= 0)` skipped it, and the handler still
returned `{success:true}` — the admin panel showed a green toast for a drug edit that was
never saved (unchecking HIGH-ALERT stayed checked; `approveDrug` couldn't write `status`
either). Both conventions are now accepted:
- `DRUG_HEADER_ALIASES` — per code key, the header spellings that mean it (`had` →
  `['had','HAD']`). Keep it in sync with what `normalizeDrugRow()` reads.
- `DRUG_NESTED_HEADERS` — `reconst`/`dilution`/`admin`/`stability`/`compat` occupy one column
  **per sub-field** on the human sheet (`Reconst: Solvent`…), one JSON column on a
  code-created sheet. `_drugCells()` also formats arrays per column (comma for `Categories`,
  JSON for `categories`), so what is written is what the read path parses back.
- `handleUpdateDrug` returns `written[]` / `skipped[]`, and **fails** (`success:false`) when
  nothing matched; `handleCreateDrug` builds its row by resolved column position (a
  positional `appendRow` landed values in the wrong columns on the human sheet).
- **Diagnose a stuck edit**: Run `inspectDrugHeaders()` from the ADMIN GAS editor — it logs
  the sheet's real header row and flags every field whose writes have nowhere to go. The
  live layout (27 columns, verified 2026-07-27) is pinned as `HUMAN_HEADERS` in
  `test/helpers/load-gas.js`; its column ORDER differs from `DRUG_DEFAULT_HEADERS`, which is
  what the old positional `appendRow` got wrong.
- The sheet originally had **no `status` / `updatedAt` column at all**, so the draft →
  pending → approved workflow could never store anything and `normalizeDrugRow()` reported
  every row as `approved` (APPROVED=all / PENDING=0 / DRAFT=0). `addMissingDrugColumns()`
  (Run once from the ADMIN GAS editor) appends them and backfills `status='approved'` for
  rows holding a drug — behaviour-preserving, blank rows untouched, safe to re-run.
- Client side: `_throwIfApiRejected()` (`js/admin.js`) now treats `success:false` as an
  error, and `_warnIfFieldsSkipped()` warns on partial writes. **Never report a write as
  successful without checking the response** — a silently dropped clinical edit is worse
  than a visible failure.
- Locked by `test/gas-drug-columns.test.js` (12 tests, run the real handlers against an
  in-memory sheet via `test/helpers/load-gas.js`; 11 of them fail against the pre-fix code).

When adding a new column to the sheet, add its spelling to `DRUG_HEADER_ALIASES` **and** to
`normalizeDrugRow()` — or name it exactly like the lowercase code key.

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

As of P1.1 the Colin model + PK_MODELS live in the shared `js/pk-models.js`
(see below) — no longer duplicated across the two files. As of **P0.3a** the
1-compartment **engine** (`predictConc`/`calcAUC_ss`/`ssPeakTrough`/
`bayesianMAP`/`runMCMC`) is also there under `window.VancoPK.engine`; both pages
destructure it (runMCMC progress via an `onProgress(pct,n,target)` callback so
each page keeps its own bar IDs). The engine is compartment-agnostic (model
passed in), so a future 2-comp swap (P0.3b, blocked on per-paper Q + V1/V2 IIV)
lands once. Engine output is golden-locked in `test/clinical-formulas.test.js`.

**Peak/trough disclaimer (v5.11.1)**: peds results (Colin path, `modelId==='colin'`)
append a bilingual amber info-box after the CI block stating peak/trough are
1-comp approximations and AUC₂₄ is the reliable peds target — because ω_Vss
is a lognormal approximation of V1+V2 (V2 IIV 97.9%), so AUC is robust but the
V-derived peak/trough are less reliable. UI-only (`_pedsPkTroughDisclaimer()` in
both files, via `IVDrugRefI18n.getCurrentLang()`); no calc/equation change.
> Superseded by v5.12.0 (peak/trough now from a real 2-comp model); the
> disclaimer text was updated to keep AUC₂₄ primary (V2 IIV ~98%), not removed.

### Two-compartment vanco engine (v5.12.0 / P0.3b) — peak/trough fidelity
The 1-comp engine gives exact AUC₂₄ (`=dose/CL`, compartment-independent) but
only approximate peak/trough. v5.12.0 adds a **2-compartment path** for the 3
models that are actually 2-comp in their source papers — **Llopis / Goti /
Colin** — while Buelga/Adane/Bourguignon stay 1-comp (they have no peripheral
compartment). **AUC and the dose recommendation never change** — only the
displayed peak/trough (and the graph shape) get more accurate.

- **Verified params** (from primary PDFs, not secondary sources) live in a
  `tc:{}` sub-object on each 2-comp model in `js/pk-models.js`, leaving the
  1-comp fields untouched: `Q` (intercompartmental clearance), `vcFn`/`vpFn`
  (V1/V2), and per-compartment `omega_cl/omega_v1/omega_v2`. Headline values:
  Llopis Q=7.48 L/h (Table 3 θ4); Goti Q=6.5 L/h (Table 2); Colin
  Q2=3.22·(WGT/70)^**0.75** (allometric — paper: "exponent 1 for volume, 0.75
  for clearance terms"). **No IIV on Q in any of the three** → the fit varies
  CL/V1/V2 (3 params) with Q fixed.
- **`window.VancoPK.engine2c`** (in `pk-models.js`): `predictConc2c`
  (bi-exponential, macro-constant form + superposition), `ssPeakTrough2c`
  (analytic steady-state), `bayesianMAP2c` (grid + 3-param Nelder-Mead),
  `runMCMC2c` (3-param Metropolis), and `predictAuto`/`peakTroughAuto` that
  **dispatch by pk shape** (a 2-comp pk/sample carries `v1/v2/q`) so the two
  TDM pages' call sites stay compartment-agnostic.
- **Wiring** (`vanco-tdm.js` + `tdm.js`): model **ranking stays 1-comp**
  (objValue comparable across the panel); once a model is chosen, if it has
  `.tc` the engine re-fits it with `bayesianMAP2c`/`runMCMC2c` and the curve,
  MCMC band, peak/trough stats, and dose-optimization peak/trough all flow
  through `predictAuto`/`peakTroughAuto`. The proposed-regimen carryover now
  continues the old dose history (exact for 1- & 2-comp) instead of a 1-comp
  `exp(-ke·Δt)` tail. `method` reads "Bayesian MAP (2-comp)".
- **Verified by tests** (50 total): Q→∞ collapses `predictConc2c` exactly to
  the 1-comp engine (Vd=Vc+Vp); interval AUC stays `dose/CL`; analytic SS ==
  numeric superposition; 2-comp peak > 1-comp peak (the fidelity gain); MAP
  no-levels falls back to population CL/V1/V2; MAP recovers a perturbed CL from
  a simulated trough; higher trough → lower CL; runMCMC2c smoke; auto-dispatch
  routes correctly.
- **Same prior/residual convention as the 1-comp engine** (proportional
  residual + ω²/σ² variance divisor since v5.62.0) so the two behave
  consistently. The papers'
  **additive** residual term (Colin 1.23 / Goti 3.4 / Llopis r2 mg/L) is kept
  in `tc.sigma_add` but **not yet modeled** (engine is proportional-only, as on
  the 1-comp Colin path) — a documented backlog item.
- **Version bump pending**: bump 5.11.1→**5.12.0** (package.json / version.json
  / sw.js + changelog / per-page footers) **at merge to main**, per the P1.1
  precedent (this is a runtime-JS clinical change, not yet shipped).

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

Verified (45M/70kg/170cm/SCr1.0, 1000mg q12h): Buelga CL 5.99 (AUC 334),
Goti CL 3.65 (AUC 548), Llopis CL 3.49 (AUC 572, CG-LBW). Old Goti 1167 → 548.
> **AUC values corrected in v5.62.0.** The CL values are unchanged; the AUC24
> was previously computed by a numeric integrator that under-reported by 3–12%
> (worse for longer infusions). `calcAUC_ss` now returns the exact `dose/CL`
> (SS mass balance, compartment-independent), so the golden AUCs rose slightly
> (324→334 / 535→548 / 561→572). See "Vanco Bayesian engine correction" below.

**Now unified** in the shared `js/pk-models.js` (ROADMAP P1.1) — both `tdm.js`
(`VancoTDM`) and `vanco-tdm.js` consume `window.VancoPK`, so a coefficient fix
lands in one place. 2-comp engine + 4-param fit = future Option A if peak/trough
fidelity needed.

### Vanco Bayesian engine correction (v5.62.0) — TWO math fixes, adversarial review
An adversarial PK/stats review (on the `claude/fable-app-comprehensive-review-lo0m8d`
branch; cherry-picked to main in v5.62.0) found two localized defects in the engine
(`js/pk-models.js`) that corrupted the two numbers clinicians act on. Both fixed
+ regression-locked; **CL population values and 2-comp kinetics were already
correct and are unchanged**.

- **Bug 1 — `calcAUC_ss` under-reported AUC.** The 300-point numeric integrator
  used a malformed carry term (wrong exponent `-ke·(interval-infusion+t)` +
  `Math.max(cCarry,0)` clamp) → AUC biased **low 3% @1h → 12% @4h infusion**.
  Fixed: `calcAUC_ss` now returns the EXACT `dose/CL` (SS interval AUC by mass
  balance, compartment-independent). AUC24 is now infusion-independent.
- **Bug 2 — MAP/MCMC used ω/σ instead of ω²/σ².** `omega_cl`/`omega_vd`/`sigma`
  (and `tc.*`) are stored as the papers' **CV/SD** (e.g. Colin `omega_cl:0.279` =
  "27.9% CV"). A lognormal MAP penalty divides by the **variance**, so every
  objective now squares them via the shared `_v2(x)=x*x` helper — in ALL FOUR
  fitters (`bayesianMAP`, `runMCMC`, `bayesianMAP2c`, `runMCMC2c`; the 2-comp
  path is the default for Goti + every peds Colin fit). Before, measured levels
  were under-weighted → the individual estimate over-shrank toward population
  (opposite of Bayesian intent) and the 90% CIs were ~2.5× too wide. **When
  editing a model's `omega_*`/`sigma`/`tc.omega_*`/`tc.sigma_prop`, keep storing
  the CV/SD — the engine squares it.**
- Bonus: 1-comp `runMCMC` proposal step now uses `2.4/√2` (matches `runMCMC2c`'s
  `2.4/√3`); acceptance ≈0.45 (was over-stepping).
- Golden tests updated: exact AUC24 (Buelga 334 / Goti 548 / Llopis 572),
  an infusion-independence lock, and a MAP shrinkage-magnitude lock (cl/popCL
  ≈0.671 for a +50% trough — regresses to ≈0.74 if the divisors revert).

### Shared vanco PK models — `js/pk-models.js` (v-P1.1)
Single source of truth for the vancomycin population-PK models (5 adult +
Colin 2019 pediatric), the per-model CrCl helpers, and `isPedsVanco` age
routing. Exposes `window.VancoPK = { PK_MODELS, COLIN_MODEL, isPedsVanco }`.

- **Load order matters**: `pk-models.js` must load **after `core.js`** (models
  call `IVDrugRef.calcBSA`/`calcSchwartz` lazily) and **before `tdm.js` /
  `vanco-tdm.js`**. Wired in `index.html`/`vanco-tdm.html` script tags **and**
  in the `PAGES` js arrays of `build.js` (both must agree).
- **Consumers**: `tdm.js` does `const { PK_MODELS, COLIN_MODEL, isPedsVanco } =
  window.VancoPK;` inside the `VancoTDM` IIFE; `vanco-tdm.js` reads the same off
  `window.VancoPK`. Neither file defines the models anymore.
- **When editing a coefficient**: change it in `pk-models.js` only, then run
  `npm test` — `test/clinical-formulas.test.js` loads this module directly and
  asserts the golden CLs, so both pages are covered by one test.
- Engine integration (`bayesianMAP`/`runMCMC`) still lives in each page (uses
  the shared models). Extracting the engine too is a possible future step.

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

**Silent CG override — RESOLVED (was Phase 2 / ROADMAP P0.2)**: The v5.9.3 note
described `bayesianMAP`/`runMCMC` recomputing adult Cockcroft-Gault even when the
display showed Schwartz. That is no longer true. Both vanco engines now read
CrCl + clearance from `model.crclFn(pt)` / `model.clFn(pt)` (v5.10.0), and the
peds path routes to **Colin** whose `crclFn` is Schwartz and whose `clFn` is
SCr-driven (no CG) (v5.11.0). Verified: for a peds patient the engine CrCl
equals the displayed Schwartz, not adult CG. Locked by regression tests in
`test/clinical-formulas.test.js` ("display↔engine CrCl consistency (P0.2 guard)").

**Display consistency (v5.9.3 follow-up)**: `vanco-tdm.js` `updateCrCl()`
shows Schwartz eGFR for age <18 (matching `tdm.js`), so the CrCl field reads
identically across both pages for the same pediatric patient — and now the
engine agrees (see "RESOLVED" above).

**Non-vanco Bayesian drugs** (phenytoin/aminoglycoside/valproate/tacrolimus/
digoxin/warfarin) are safe-by-construction: each `run()` calls
`const pt = updateCrCl()` **once** and uses that same `pt` for both the display
and the engine (e.g. AG: `p.popKe(pt.crcl)`), so display and engine read the
identical `.crcl` — which `updateCrCl()` already routes as Schwartz for peds /
CG for adult. Plus the guard blocks <18 from these drugs entirely. No silent CG
override exists; no hardening warranted (see ROADMAP P0.2 investigation note).

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

> **Tests**: `npm test` runs `test/clinical-formulas.test.js` via `node --test`
> (Node 18+). It loads the **real** `core.js` + the shared `js/pk-models.js` in
> a `vm` sandbox (browser globals stubbed — see `test/helpers/load-clinical.js`)
> and asserts the golden values documented in this file (CG/Schwartz/IBW/ABW/
> BSA/CKD-EPI + the 5 adult vanco models + Colin 2019 + `isPedsVanco` routing).
> Because both TDM pages now consume `js/pk-models.js` (P1.1), this one test
> covers the models on both pages. CI gates deploy on it. When you change any
> dosing formula, update/extend these tests. The engine (MAP/MCMC) is now shared
> in `js/pk-models.js` (`VancoPK.engine`, ROADMAP P0.3a) and has integration
> golden tests. The only build dependency is `clean-css` — `docx`/`terser` were
> removed (ROADMAP P3.3) since the live build never used them (JS not minified).

### Rollback
```bash
git tag -l "deploy/*"       # List deploy backups
git tag -l "local/*"        # List local backups
git checkout deploy/20260405-090013  # Go to specific backup
```

## Pending Items
- [ ] **REQUIRED — deploy `gas-complete.js` 5.72.0 to the ADMIN GAS**: until then a drug edit
      whose payload exceeds ~6 KB is still discarded (POST routing, see the note above).
      Copy → Save → **Deploy → Manage deployments → Edit → New version**, then check
      ตั้งค่า → ตรวจสอบเวอร์ชัน reports 5.72.0.
      *(5.69.0 — column resolution — was deployed and verified on 2026-07-27:
      `addMissingDrugColumns()` added `status`/`updatedAt` and backfilled 166 rows,
      `inspectDrugHeaders()` resolves all 19 fields.)*
- [ ] Deploy latest `gas-complete.js` to BOTH GAS editors (has upsert bulk import + version endpoint + **previousData** diff support)
- [ ] Re-import CURATED compatibility pairs via admin panel after GAS deploy
- [ ] Delete Valproic+Meropenem pair manually from admin (PK interaction, not Y-site)
- [ ] Admin panel GAS version check UI (endpoint exists at `?action=version`, UI not built)
- [ ] Connect renal-dosing.html to fetch from Google Sheet instead of hardcoded data
- [x] Drug Data Diff / Change Review modal ใน admin panel (side-by-side diff ตอน approve pending drug)
