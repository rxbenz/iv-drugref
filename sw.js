// ============================================================================
// IV Drug Reference PWA — Service Worker v5.48.0
// Based on V4.7.1 with modular file structure support
// Added: Push notifications, urgent alert background sync, separate drug data cache
// Changed: version.json excluded from cache (always network) for force-update support
// v5.7.5: Global ESC key to close modals/sheets/overlays
// v5.9.3: Pediatric Safety Guard (blocks adult-only Bayesian TDM in <18 yr;
//         warns for calculator/renal-dosing). Reconciles version drift.
// v5.10.0: Vancomycin PK coefficient correction (Phase 2b) — all 5 models
//          re-derived from primary papers; fixes inflated AUC (under-dosing).
// v5.11.0: Pediatric vancomycin Bayesian unblocked for age 1-17 via Colin 2019
//          model (age-routed); infant <1 still blocked. Adult path unchanged.
// v5.11.1: Peds peak/trough disclaimer (1-comp approximation; AUC₂₄ is the
//          reliable peds target). UI-only; no calc change.
// v5.12.0: 2-comp PK engine (peak/trough fidelity); shared pk-models.js +
//          VancoPK.engine; compatibility salt-key disambiguation (no cross-salt
//          leak); XSS hardening (IVDrugRef.escHtml); prod console.log strip;
//          automated clinical test suite + CI.
// v5.13.0: Compatibility UI redesign — unified search-driven Check (typeahead +
//          chips; 2 drugs = pair detail, 3+ = grouped-by-status); replaces the
//          3-tab/dropdown layout. Mobile-first. Compat render now escaped.
// v5.14.0: IV fluids as selectable entities + drug–fluid DILUENT compatibility
//          (NSS/½NS/D5W/D5NSS/D5N2S/RL + D10W/SWFI/balanced). Derived only from
//          curated DB + drug .x/.y fields; no-data→verify. fluidKey fixes the
//          D5W/D10W digit-strip key collision. Badged as admixture (not Y-site).
// v5.15.0: Seed pharmacist-reviewed drug–fluid diluent pairs into CURATED
//          (32 pairs: amiodarone/nitroprusside/propofol D5W-only, tenecteplase &
//          hydralazine + dextrose = incompat, albumin+SWFI, RL incompatibilities,
//          furosemide/norepi/epi cautions). Sourced (docs/drug-fluid-compatibility.md).
// v5.15.1: Fix — drug–fluid pairs vanished after the Google-Sheet compat sync.
//          rebuildCuratedMap() rebuilt CURATED_MAP from sheet (drug-drug only),
//          wiping the code-side fluid pairs. Moved them to FLUID_CURATED +
//          re-applied (fill-if-missing) after every (re)build.
// v5.15.2: Version-display fix — stale header badges (TDM v1.0, Vanco v2.0,
//          Compat v5.0) + core.js VERSION (was 5.11.1) now driven by a single
//          source: core.js fills [data-app-version] from IVDrugRef.VERSION.
// v5.15.3: Safety + UX. C1: block calc on blank patient fields (validate raw
//          before defaulting; wired vanco-tdm). UX: answer-first drug cards
//          (diluent+rate line), "ตรวจ IV Compatibility" cross-link, and ?search=
//          /?drug= deep-link support (fixes the FAB quick-search link).
// v5.16.0: Allergy cross-reactivity feature + backend. Allergy page reads
//          admin-edited data from Google Sheet (cache+fallback); admin Allergy
//          tab (seed/CRUD); analytics→dashboard 🛡️ tab; fixed lowercase
//          analytics event names (dose_calc/tdm_usage/... now reach their
//          sheets); renal page reads from Sheet; admin Settings zero-config
//          (built-in Client ID + Apps Script URL defaults).
// v5.17.0: Navigation/footer redesign (P3.4). One shared collapsible left-rail
//          drawer (site-chrome.js/.css) across all 7 user pages — replaces the
//          per-page bottom-nav (open by default, swipe/scroll/tap to hide).
//          Removed index's redundant header tool-cards; compact footer + info
//          modal (disclaimer/license/refs) injected on sub-pages with version
//          single-sourced from IVDrugRef.VERSION. Allergen search starts empty
//          with a guide prompt.
// v5.17.1: Nav polish — left rail now PERSISTS open/closed across page nav
//          (sessionStorage; no more "disappears, press back"); content is pushed
//          right (no overlap); removed auto-hide-on-scroll + scrim (hide only via
//          ‹‹ / swipe-left / Esc). Forces SW cache refresh app-wide.
// v5.17.2: Allergy picker — live typeahead results list (shows matches as you
//          type, Enter picks the top, arrows navigate) + group chips that
//          filter & show the list. Replaces the native <select> that only
//          revealed results once opened.
// v5.17.3: Fix allergy group-chip flicker (chip rebuild detached the click
//          target so the outside-click handler closed the list) — now updates
//          chip state in place + stops propagation; the list stays open.
//          Sub-page headers decluttered: removed the back/cross-link buttons
//          that duplicated the left rail.
// v5.17.4: site-chrome nav/footer/About modal now render their own TH/EN text
//          (from IVDrugRefI18n) + marked data-i18n-done so the global i18n engine
//          no longer half-translates them; fixed the duplicated "Neurological
//          Institute of Thailand" in the About box.
// v5.17.5: Dashboard analytics fetch is now cache-busted (?_=ts + no-store) so
//          new Sheet rows show on Refresh instead of a stale cached response;
//          load toast shows backend GAS version + server time for diagnosis.
// v5.17.6: Dose Calculator no longer auto-scrolls to the result on every
//          parameter edit — it scrolls only when the result first appears.
// v5.18.0: Dose Calculator now uses an explicit "🧮 คำนวณ" button instead of
//          auto-calculating on every keystroke. Editing a value/drug keeps the
//          old result, shows a "ค่าเปลี่ยน — กดคำนวณใหม่" hint, and pulses the
//          button; CrCl still updates live. Result scrolls into view on press.
// v5.18.1: Calculator polish — fix primary button rendering grey ("disabled"-
//          looking) on light theme (shared.css specificity); patient fields now
//          use placeholders instead of pre-filled values, and validation no
//          longer flashes errors while all fields are still blank.
// v5.18.2: Calculator input fix — validation no longer fires on every keystroke
//          (typing "0" before "0.8" instantly flagged the field + shook it).
//          Errors now show on blur / on Calculate; mid-typing only updates CrCl
//          silently. Decimal fields get inputmode="decimal" for a usable mobile
//          keypad.
// v5.18.3: Calculator caret fix — the getPatientFromForm unit-conversion shim
//          wrote every patient field's value back on each read; on a type=number
//          field "0." reads as "0", so typing a decimal got rewritten and the
//          caret jumped. Now it only touches fields that actually need unit
//          conversion (none in default kg/cm/mg-dL units).
// v5.18.4: Renal page crash fix — once Sheet-authored renal data loaded, drugs
//          became static objects without getDosing(), so selecting any drug threw
//          "getDosing is not a function" (error toast, no recommended dose).
//          applyRenalRemote now wraps the Sheet's recommended/dosingTable in a
//          getDosing() shim (GFR-row highlight via best-effort range parsing).
// v5.19.0: Allergy pseudoallergy screening — Phase 1: NSAID phenotype selector
//          (EAACI/ENDA). Cross-reactive (NERD/NECD-NIUA, COX-1 pseudoallergy)
//          vs single-drug (selective, immunologic) now an explicit input that
//          re-routes the engine: single-drug avoids only the culprit's chemical
//          group, so other groups (even strong COX-1) become safe. SCAR routes
//          single-drug too. Locked by tests.
// v5.19.1: Fix — the NSAID phenotype selector never appeared once Sheet-authored
//          allergy data loaded: applyRemoteData rebuilt groups without the
//          code-defined `phenotypes` (and chemLabels/clusters). It now merges
//          Sheet CONTENT over the hardcoded group so clinical-logic fields
//          survive. Locked by test.
// v5.20.0: Allergy pseudoallergy — Phase 2: reaction-nature gate. A new
//          "ลักษณะปฏิกิริยา" selector lets the user mark the event as an
//          intolerance / side-effect (nausea, GI upset, headache…) rather than a
//          true immune allergy → the engine short-circuits with a "not an
//          allergy, drug usually still usable" advisory instead of running the
//          cross-reactivity avoidance lists. Default (allergy) unchanged.
// v5.21.0: Allergy pseudoallergy — Phase 3: make the non-immune path ACTIONABLE.
//          Groups can carry a `pseudo` management block; selecting non-immune for
//          ICM now shows actionable guidance (iodine/seafood myth, switch agent +
//          skin test, low/iso-osmolar) and a premedication protocol (ACR regimens)
//          with the ESUR-2025 "not routine" caveat — instead of a generic note.
//          Rendered in result + copy/LINE/PDF. Locked by tests.
// v5.22.0: Allergy pseudoallergy — Phase 4. (a) Vancomycin/Teicoplanin added as a
//          selectable Glycopeptide group: immune path = teicoplanin caution
//          (variable cross), linezolid/daptomycin safe; non-immune path = the
//          vancomycin flushing reaction ("red man") with rate management (≥60
//          min/g, ≤10 mg/min ± antihistamine) — NOT a contraindication. (b) Local
//          anesthetic groups gain a non-immune note (true allergy <1%;
//          preservative/sulfite; preservative-free + ester↔amide swap). (c)
//          applyRemoteData now UNION-merges so code-only groups (e.g. the new
//          glycopeptide group) survive a Sheet override that hasn't been
//          re-seeded. Locked by tests (148).
// v5.23.0: Allergy UX — after picking the culprit drug, show a prominent green
//          "selected drug" pill (✅ ยาที่เลือก: <name>) with a "เปลี่ยน" button to
//          clear + reopen the picker, so the chosen allergen is unmistakable.
// v5.24.0: PWA install guide (site-chrome, all user pages). Captures
//          beforeinstallprompt → "Install now" button (Android/Chrome/Edge);
//          iOS Safari + desktop get platform-specific manual steps. Entry points:
//          a "📲 ติดตั้ง" left-rail item + a one-time dismissible discovery banner.
//          Hidden when already installed (display-mode: standalone). TH/EN.
// v5.25.0: Renal page — the dosing recommendation now opens as a centered MODAL
//          popup on drug tap (backdrop + sticky header, close via ✕ / backdrop /
//          Esc, background scroll locked) instead of a bottom section that
//          auto-scrolled the page down (which felt disorienting). No page jump.
// v5.26.0: De-duplicate Vancomycin — it had a full implementation in BOTH the TDM
//          Hub (tdm.html) and the standalone Vanco page. The Hub's inline vanco
//          panel is removed and its "Vancomycin ↗" tab now redirects to
//          vanco-tdm.html (the single canonical vanco tool); the Hub defaults to
//          Phenytoin. Shared PK models/engine (pk-models.js) were already common;
//          the duplicated VancoTDM UI code in tdm.js is now unreachable (frozen,
//          to be deleted in a later cleanup). Other 6 TDM drugs untouched.
// v5.27.0: Dashboard analytics audit — fix every silently-broken chart + add
//          research instrumentation. Several charts only ever showed SEED data
//          because the client never sent the field they read:
//          • time_to_click_ms + drug_clicked (search→click; deferred SEARCH row)
//          • platform/standalone/screen on SESSION_START (Platform chart)
//          • filter_used on SEARCH (Filter chart)
//          • source on VIEW_DRUG: search/filter/browse/quick-access (Expand Source)
//          • dose_unit on dose_calc (calculator + inline drip widget) (Dose Unit)
//          New research views (existing data): usage by hour-of-day (UTC+7) +
//          day-of-week + searches/session (Overview); no-result searches (Drug
//          Usage). New tracking: FAB quick-actions + onboarding → FeatureUse
//          sheet + Journey "Feature Use" chart. New in-app survey (js/survey.js):
//          role/department + 5 satisfaction Likerts + 10-item SUS (auto-scored)
//          → SURVEY. GAS gains FeatureUse sheet + filter_used/dose_unit/source/
//          drug_clicked fallback columns (existing sheets need columns added +
//          GAS redeploy).
// v5.27.1: Dashboard research CSV export ("⬇ CSV วิจัย") — client-side export of
//          any/all datasets respecting the current date/cross-filter (so seed
//          rows can be excluded by date before export). GAS gains cleanSeedData()
//          + purgeAllAnalytics() manual cleanup utilities and GAS_VERSION 5.27.1
//          (so the dashboard load toast confirms the redeploy).
// v5.28.0: Respectful feedback engine (survey.js rewrite, loaded on all 7 user
//          pages). Replaces the always-on survey button with: (1) micro 👍/👎
//          after a dwell + interaction (optional 1-tap reason) → MICRO_FEEDBACK;
//          (2) progressive SUS — one item per returning-user session, answers
//          accumulate per user → cohort SUS → SUS_ITEM; (3) full survey kept but
//          NEVER pushed (only via IVSurvey.show / data-action="showSurvey").
//          Respect rules: never first visit, ≤1 prompt/session, 3-day cooldown,
//          skip already-answered, and OPT OUT FOREVER after 2 dismissals. GAS:
//          MicroFeedback + SusItems sheets (+ raw + CSV export + cleanup).
// v5.28.1: Surface the 5.28.0 research data — Dashboard v6.2 Survey tab gains
//          Micro 👍/👎 (helpful rate + 👎 reasons), an estimated cohort SUS from
//          progressive items, and a per-item 0-4 SUS bar. About modal (all 7
//          pages) gains an optional "take the full survey" link → IVSurvey.show.
// v5.29.0: Analytics migration Phase 1 — core.js dual-writes events to Supabase
//          (events table, anon insert-only RLS) alongside GAS; CSP connect-src
//          gains the Supabase project host. Legacy GAS dashboard untouched.
// v5.29.1: Fix stale index.html footer version label (was hardcoded 5.17.4) —
//          now uses [data-app-version] so it auto-tracks IVDrugRef.VERSION.
// v5.29.2: About dialog (showAbout) now pulls the version from IVDrugRef.VERSION
//          instead of a hardcoded 'v4.7.0' — single source, no per-release edit.
// v5.30.0: Analytics Phase 1 step 5 — Dashboard now reads the unified Supabase
//          `events` table (paginated) and reshapes it into the existing per-type
//          RAW arrays, so all charts work unchanged. anon SELECT RLS added.
//          GAS is now write-only (dual-write) pending shutdown.
// v5.31.0: Phase 2 step 1 — Dashboard is now admin-only (Supabase Auth / Google
//          sign-in + is_admin() RPC gate). Reads use the authenticated session;
//          events SELECT RLS will be locked to admins (anon keeps INSERT).
// v5.32.0: Phase 2 step 2 (renal pilot) — renal-dosing.js reads drugs from
//          Supabase renal_drugs (public read); GAS admin handlers dual-write
//          renal changes to Supabase (service key, server-side).
// v5.33.0: Phase 2 step 2 (compat) — compatibility.js reads compat pairs from
//          Supabase compat_pairs (public read); GAS admin handlers dual-write
//          compat changes to Supabase. Same pattern as renal.
// v5.34.0: Phase 2 step 2 (drugs) — index.js reads approved drugs from Supabase
//          drugs table (status=approved); GAS admin drug create/update/delete
//          (+approve/reject) dual-write to Supabase. Reference data fully on Supabase.
// v5.35.0: Phase 2 step 2 (allergy) — allergy.js reads groups+refs from Supabase
//          (allergy_groups/allergy_refs, public read); GAS admin allergy CRUD
//          dual-writes. All admin reference data (renal/compat/drug/allergy) on Supabase.
// v5.36.0: Drug cards gain a top "ขนาดยา (Usual Dose)" section (new `dosing`
//          field, Supabase + drugs-data.json). Batch 1 (neuro-critical/emergency,
//          12 drugs) seeded via importDosingBatch1; EBM drafts, pharmacist-reviewed.
// v5.37.0: Usual Dose readability redesign — the dense pre-line block is now
//          parsed into a scannable list (bold indication header + dose detail
//          per row, alternating rows, amber ⚠️ rows, 📌 note box); light+dark.
// v5.37.1: Fix — Usual Dose vanished once the app synced drugs from Supabase
//          (those rows lack the curated `dosing` field, maintained in
//          drugs-data.json not the admin panel). renderDrugCard now overlays
//          dosing from the static dataset (id+generic map) as a fallback, so it
//          shows regardless of data source. Loads async + forces one re-render.
// v5.38.0: Usual Dose data complete — `dosing` field now populated for ALL 166
//          drugs in drugs-data.json (was ~125). Adult IV/parenteral-focused
//          summaries (Thai) per UpToDate/Lexicomp/Micromedex/EMC SmPC + IDSA
//          guidance; oncology & immunoglobulin kept protocol-specific for
//          safety. Data-only release (no code/engine change).
// v5.38.1: Fix — primary action buttons (TDM "Calculate Phenytoin PK", Vanco
//          "Run Bayesian MAP + MCMC") rendered grey/disabled-looking on light
//          theme. They use the .btn-primary class, but shared.css only colored
//          .btn.primary (dot) — so the generic light .btn rule (higher
//          specificity) overrode the gradient. shared.css now covers BOTH
//          .btn.primary and .btn-primary (resting glow + light-theme guard).
// v5.38.2: Analytics fix — sub-page usage was undercounted on the dashboard.
//          Live pages emit LOWERCASE feature types (dose_calc, tdm_usage,
//          renal_dosing, compat_usage, calc_visit) which sendToSupabase stores
//          verbatim, but dashboard TYPE_TO_KEY only listed the UPPER_CASE
//          canonical names → `if (!key) continue;` dropped every live sub-page
//          event (only Allergy, already UPPER_CASE, matched). TYPE_TO_KEY now
//          maps both casings to the same buckets, so TDM/Calc/Renal/Compat/Vanco
//          usage is counted again (historical + live). Dashboard-only change.
// v5.39.0: Sub-page discovery/promotion (most traffic lands on drug search then
//          bounces). (1) Every drug card now shows a "เครื่องมือสำหรับยานี้" chip
//          row → IV Compatibility (deep-links ?drug=<generic>, pre-fills), Renal
//          dosing, Calculator, and TDM (only for vanco/phenytoin/AG/valproate/
//          digoxin/tacrolimus/warfarin). No new tracking — each sub-page's
//          trackPageView(from_page) already makes the cross-nav measurable.
//          (2) Left nav rail is viewport-aware: open+push on desktop, but on
//          phones it stays closed (content keeps full width) and opens as an
//          overlay via a more prominent filled-sky edge toggle. (3) Fix PWA
//          install banner wrapping ~1 char/line (fixed flex box had no width →
//          shrink-to-fit collapsed the space-less Thai text); now width-capped.
// v5.39.1: Fix — drug cards showed TWO IV Compatibility links: the new related-
//          tools chip (v5.39.0) plus the older standalone "🔗 ตรวจ IV Compatibility"
//          cross-link (_uxCrossLinks, v5.15.3). Both deep-linked the same
//          ?drug=<generic>, so the legacy one was removed; the answer-line
//          (diluent/rate) it shared a wrapper with is unchanged.
// v5.40.0: Live dose calculator — Phase 0 (connect, don't rebuild). The Dose
//          Calculator already computes a per-patient dose for 9 drugs (vanco,
//          amikacin, gentamicin, colistin, phenytoin/valproate/levetiracetam
//          loading, alteplase, tenecteplase). For those drugs the drug-card tool
//          chip now reads "🧮 คำนวณขนาดยา" and deep-links calculator.html?drug=<id>;
//          calculator.js parses the param and pre-selects the drug (patient fields
//          stay blank, result still explicit-trigger — no auto-dose). Non-calc
//          drugs keep the generic "คำนวณ (CrCl/หยด)" chip. Surfaces the existing
//          per-patient engine from the search flow with zero dosing-data changes.
// v5.41.0: Live dose calculator — Phase 1 (structured doseRule engine). A drug can
//          now declare a machine-computable `doseRule` (basis weight/flat/bsa,
//          single value or [low,high] range, per-dose & per-day caps, rounding,
//          renal-adjust caution) instead of a bespoke calc(); a generic engine
//          (_ruleCalc) renders the per-patient dose AND always prints the rule,
//          the math, the assumptions, and the source reference for verification.
//          Adult rules FAIL CLOSED for age <18 (numbers are adult-specific).
//          Wired through the same Calculate button → validation + pediatric guard
//          gate it (no auto-dose). 3 demo drugs added: Enoxaparin (1 mg/kg q12h),
//          Ceftriaxone (flat 1–2 g; meningitis 2 g q12h), Acyclovir HSV (10 mg/kg
//          q8h); their drug-card chip deep-links to the calculator. Golden-verified
//          (70 kg → enox 70 mg, acyclovir 700 mg). Next: author doseRule for more
//          weight-based drugs (manual pharmacist curation, verify at source).
// v5.42.0: Live dose calculator — Phase 1 batch 2. (1) UX: patient height is now
//          OPTIONAL for adults (Cockcroft-Gault falls back to actual body weight;
//          IBW/ABW/BSA paths already guard) — it stays REQUIRED for pediatrics
//          (Schwartz eGFR needs it). Removes the "must enter height" friction for
//          drugs that don't use it. (2) 8 more structured-doseRule drugs (standard
//          adult IV, sourced): Cefepime, Meropenem, Piperacillin/tazobactam,
//          Cefazolin, Ceftazidime, Metronidazole, Daptomycin, Paracetamol IV —
//          each with the drug-card "คำนวณขนาดยา" deep-link. Combination products
//          (Ceftazidime/Avibactam, non-pip tazobactam combos) are excluded from
//          the single-agent calc chip so they don't pull up the wrong calculator.
//          Golden-verified (70 kg → daptomycin 420 mg, pip/tazo 4.5 g q8h, etc.).
// v5.43.0: Live dose calculator — Phase 1 batch 3. 11 more structured-doseRule
//          drugs (standard adult IV, sourced): Ampicillin, Clindamycin,
//          Levofloxacin, Ciprofloxacin, Azithromycin, Fluconazole (12→6 mg/kg),
//          Ganciclovir (5 mg/kg q12h), Ertapenem, Linezolid, and BOTH amphotericin
//          B forms as SEPARATE calculators — Liposomal (3–5 mg/kg) vs conventional
//          (0.5–1 mg/kg) — since conflating them is a serious dosing error.
//          _calcIdFor disambiguates the two AmB cards (liposomal keyword checked
//          first) and now also excludes sulbactam combos (Ampicillin/Sulbactam no
//          longer maps to the ampicillin-only calc). Golden-verified (70 kg →
//          liposomal AmB 210–350 mg vs conventional 35–70 mg; ganciclovir 350 mg).
//          ~31 drugs now compute a per-patient dose from the drug card.
// v5.44.0: Live dose calculator — Phase 2 (automatic renal dose adjustment). The
//          doseRule engine now supports per-indication renalTiers:[{min,max,
//          interval,doseFactor,dose,avoid,note}]; it picks the CrCl tier for the
//          patient and shows the ADJUSTED dose in the headline — TRANSPARENTLY:
//          the standard (normal-renal) dose stays listed for reference and the
//          full tier table renders with the patient's CrCl row highlighted green
//          (same pattern as the vanco calc). renalTiers authored (standard
//          Sanford/Lexicomp) for Enoxaparin, Cefepime, Meropenem (×2), Ceftazidime,
//          Daptomycin (×2), Levofloxacin, Ciprofloxacin (×2), Fluconazole maint,
//          Ganciclovir (×2), Ertapenem. Golden-verified across CrCl: enox <30 →
//          q24h; meropenem CrCl 41 → 1 g q12h, CrCl 21 → 500 mg q12h; levofloxacin
//          CrCl 41 → 750 q48h; ganciclovir CrCl 41 → 175 mg q24h. Drugs without
//          renalTiers keep their free-text renal caution (no regression). Tests 148.
// v5.45.0: Drug–drug interaction (DDI) checker — Phase 0 (class-collision engine).
//          PHARMACOLOGICAL interaction screening, kept DISTINCT from the physical
//          (Y-site/admixture) compatibility: a new "💊 อันตรกิริยาระหว่างยา" tab on
//          the compatibility page reuses the same multi-drug picker but renders
//          only DDI findings (compat tab renamed "🧪 เข้ากันในสาย"; nothing mixed).
//          Engine (js/drug-interactions.js): hybrid model — additive-risk CLASS
//          tags (QT/serotonergic/nephrotoxic/bleeding/hyperK/ototoxic) flag when
//          ≥2 selected drugs share a class (scales without N² pairs) + a small set
//          of curated explicit pairs (valproate+carbapenem, linezolid+sympatho-
//          mimetic [MAOI], digoxin+K-wasting, methotrexate+NSAID). Each finding
//          shows severity badge + mechanism + management + reference; section
//          carries a "not exhaustive — verify at source" disclaimer. Decision
//          support only (NOT a full Lexicomp clone). Locked by 9 tests (157 total).
//          Discoverability: a dedicated left-rail entry "💊 อันตรกิริยา" deep-links
//          to compatibility.html?mode=ddi (opens straight on the DDI tab); the page
//          header/title updated to cover both functions ("เข้ากัน & อันตรกิริยายา").
// v5.46.0: Dashboard — DDI analytics. The ddi_check event (compatibility.js) is now
//          enriched with findings_count / classes / top_severity, and the dashboard
//          counts it (TYPE_TO_KEY ddi_check→ddiChecks, was dropped by the
//          if(!key)continue filter — same class of undercount bug as v5.38.2). New
//          "💊 Drug Interaction (DDI)" block on the Compat tab: stat cards (checks /
//          unique users / checks-with-findings / major-severity) + Top Interaction
//          Classes bar + Severity Mix doughnut. Dose-calc tracking unchanged (new
//          doseRule drugs already surface via the existing dose_calc event).
// v5.47.0: DDI Phase 1 — broader coverage (js/drug-interactions.js). +4 additive
//          classes: CNS/respiratory depression (opioid+benzo+barbiturate+propofol+
//          sedating antihistamine), bradycardia/AV block (β-blocker+non-DHP CCB+
//          digoxin+amiodarone+dexmedetomidine), hypotension/vasodilation (nitrate+
//          nitroprusside+hydralazine+DHP CCB+milrinone), anticholinergic burden
//          (atropine+glycopyrrolate+hyoscine+antihistamine+benztropine). Class tags
//          expanded ~40→~70 keywords (only dataset generics). +9 curated pairs:
//          ceftriaxone+IV-calcium (neonatal precipitation), digoxin+IV-calcium,
//          digoxin+amiodarone, digoxin+non-DHP-CCB, amiodarone+warfarin,
//          aminoglycoside+NMBA, magnesium+NMBA, MTX+cotrimoxazole, phenytoin+
//          valproate. Carbapenem/valproate stay untagged so the valproate+carbapenem
//          curated pair fires alone (no class leakage). Locked by +10 tests (167).
// v5.48.0: DDI admin-managed + dashboard polish. (1) Admin can now maintain DDI
//          data: new "💊 DDI" admin tab (curated pairs + keyword→class rules CRUD)
//          backed by GAS handlers (DDIPairs/DDIClassRules sheets) that dual-write
//          to Supabase (ddi_pairs / ddi_class_rules, supabase/ddi.sql). The live
//          screen reads these via drug-interactions.js loadRemote() with the
//          in-code defaults as offline fallback — no split-brain (same pattern as
//          compat_pairs). "Import Defaults" seeds the sheets from the engine.
//          (2) Dashboard: DDI moved to its OWN tab (split from Compat) — stat cards
//          + Top Interaction Classes + Severity Mix. (3) Admin Settings: backend
//          version-check (app vs deployed GAS_VERSION 5.47.0 + Supabase ddi_pairs
//          reachability). (4) Compat header drug count single-sourced from DRUGS.
//          NOTE: the DDI write path needs the user to run supabase/ddi.sql + copy
//          gas-complete.js to the ADMIN GAS and Deploy.
// ============================================================================

const CACHE_NAME = 'iv-drugref-v5.48.0';
const DRUG_DATA_CACHE = 'iv-drugref-data-v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Urgent alert polling config
const ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec';
const URGENT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let urgentPollTimer = null;

// Core assets (app shell) — cached on install
// Note: CSS and page-specific JS are inlined into HTML by the build system.
// Only list files that actually exist in the dist/ output.
const ASSETS_TO_CACHE = [
  // Pages (CSS & JS are inlined by build.js)
  './',
  './index.html',
  './calculator.html',
  './vanco-tdm.html',
  './tdm.html',
  './renal-dosing.html',
  './compatibility.html',
  './allergy.html',
  './dashboard.html',
  './admin.html',

  // Data & config
  './drugs-data.json',
  './manifest.json',

  // Standalone JS (not inlined — loaded separately)
  './error-tracker.js',
  './i18n.js',
  './translations-en.js',

  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// ─── Install: Cache core assets (wait for user prompt before activating) ───
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
    // No skipWaiting() — new SW waits until user accepts the update prompt
  );
});

// ─── Activate: Clean old caches + start urgent polling ───
self.addEventListener('activate', (e) => {
  const KEEP_CACHES = [CACHE_NAME, DRUG_DATA_CACHE, 'iv-drugref-urgent-meta'];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !KEEP_CACHES.includes(k))
          .map(k => {
            console.log('[SW] Removing old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => {
        startUrgentPolling();
        return self.clients.claim();
      })
  );
});

// ─── Fetch: Smart caching strategies ───
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip Google Apps Script & external API calls (never cache)
  if (url.hostname === 'script.google.com' ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // version.json must ALWAYS go to network (for force-update detection)
  if (e.request.url.includes('version.json')) {
    return;
  }

  // Strategy for drugs-data.json: Network-first with cache fallback
  // This ensures users get fresh data when online but still work offline
  if (e.request.url.includes('drugs-data.json')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DRUG_DATA_CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(e.request);
        })
    );
    return;
  }

  // Strategy for HTML pages: Stale-while-revalidate
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
              // Notify clients of new version
              self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                  client.postMessage({ type: 'NEW_VERSION' });
                });
              });
            }
            return response;
          })
          .catch(() => cached || new Response('Offline', { status: 503 }));

        return cached || networkFetch;
      })
    );
    return;
  }

  // Strategy for other assets: Cache-first with network fallback + stale check
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Check if cache is stale
        const dateHeader = cached.headers.get('date');
        if (dateHeader) {
          const age = Date.now() - new Date(dateHeader).getTime();
          if (age > CACHE_MAX_AGE_MS) {
            // Stale: try network, fallback to stale cache
            return fetch(e.request)
              .then(response => {
                if (response && response.status === 200) {
                  const clone = response.clone();
                  caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
              })
              .catch(() => cached);
          }
        }
        return cached;
      }

      // Not in cache: fetch from network and cache
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Push Notification Handler ───
// Receives push messages from server (or triggered by urgent alert polling)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: '⚠️ IV DrugRef Alert', body: 'มี urgent drug update', type: 'safety_alert', severity: 'high' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const severityIcons = {
    critical: '🚨',
    high: '⚠️',
    medium: 'ℹ️'
  };
  const icon = severityIcons[data.severity] || '⚠️';

  const options = {
    body: data.body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    tag: 'urgent-alert-' + (data.id || Date.now()),
    renotify: true,
    requireInteraction: data.severity === 'critical',
    vibrate: data.severity === 'critical' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: {
      url: './',
      alertId: data.id,
      type: data.type,
      drugName: data.drugName,
      severity: data.severity
    },
    actions: [
      { action: 'view', title: '📋 ดูรายละเอียด' },
      { action: 'dismiss', title: 'ปิด' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(`${icon} ${data.title}`, options)
  );
});

// ─── Notification Click Handler ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open app or focus existing window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Try to focus an existing window
        for (const client of clients) {
          if (client.url.includes('index.html') || client.url.endsWith('/')) {
            client.postMessage({
              type: 'URGENT_ALERT_CLICK',
              alertId: event.notification.data.alertId,
              drugName: event.notification.data.drugName
            });
            return client.focus();
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(event.notification.data.url || './');
      })
  );
});

// ─── Message Handler: Urgent alert commands from client ───
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'START_URGENT_POLL':
      startUrgentPolling();
      break;
    case 'STOP_URGENT_POLL':
      stopUrgentPolling();
      break;
    case 'CHECK_URGENT_NOW':
      checkUrgentAlerts();
      break;
    case 'SHOW_URGENT_NOTIFICATION':
      showUrgentNotification(event.data.alert);
      break;
  }
});

// ─── Urgent Alert Polling (Background) ───
function startUrgentPolling() {
  if (urgentPollTimer) clearInterval(urgentPollTimer);
  console.log('[SW] Starting urgent alert polling (every 5 min)');
  checkUrgentAlerts(); // check immediately
  urgentPollTimer = setInterval(() => checkUrgentAlerts(), URGENT_POLL_INTERVAL_MS);
}

function stopUrgentPolling() {
  if (urgentPollTimer) {
    clearInterval(urgentPollTimer);
    urgentPollTimer = null;
    console.log('[SW] Stopped urgent alert polling');
  }
}

async function checkUrgentAlerts() {
  try {
    // Read last check timestamp from a simple indexedDB-like approach via cache
    const lastCheck = await getLastUrgentCheck();
    const url = `${ANALYTICS_URL}?action=checkUrgentAlerts&since=${lastCheck}`;

    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return;

    const result = await response.json();
    if (!result.alerts || !result.alerts.length) return;

    // Save server time for next check
    if (result.serverTime) {
      await saveLastUrgentCheck(result.serverTime);
    }

    // Show notifications for NEW alerts only
    const newAlerts = result.alerts.filter(a => a.isNew);
    for (const alert of newAlerts) {
      await showUrgentNotification(alert);
    }

    // Notify all clients about active alerts (new or existing)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'URGENT_ALERTS_UPDATE',
        alerts: result.alerts,
        hasNew: result.hasNew
      });
    });

  } catch (err) {
    console.warn('[SW] Urgent alert check failed:', err.message);
  }
}

async function showUrgentNotification(alert) {
  const severityIcons = { critical: '🚨', high: '⚠️', medium: 'ℹ️' };
  const icon = severityIcons[alert.severity] || '⚠️';

  const typeLabels = {
    recall: '🔴 Drug Recall',
    safety_alert: '⚠️ Safety Alert',
    shortage: '📦 Drug Shortage',
    formulation_change: '💊 Formulation Change'
  };

  await self.registration.showNotification(
    `${icon} ${typeLabels[alert.type] || 'Drug Alert'}: ${alert.drugName || 'IV DrugRef'}`,
    {
      body: alert.title + (alert.message ? '\n' + alert.message : ''),
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-96x96.png',
      tag: 'urgent-' + alert.id,
      renotify: true,
      requireInteraction: alert.severity === 'critical',
      vibrate: alert.severity === 'critical' ? [300, 100, 300, 100, 300] : [200, 100, 200],
      data: {
        url: './',
        alertId: alert.id,
        type: alert.type,
        drugName: alert.drugName,
        severity: alert.severity
      },
      actions: [
        { action: 'view', title: '📋 ดูรายละเอียด' },
        { action: 'dismiss', title: 'ปิด' }
      ]
    }
  );
}

// ─── Simple timestamp storage via Cache API ───
async function getLastUrgentCheck() {
  try {
    const cache = await caches.open('iv-drugref-urgent-meta');
    const resp = await cache.match('last-check');
    if (resp) return parseInt(await resp.text()) || 0;
  } catch (e) {}
  return 0;
}

async function saveLastUrgentCheck(ts) {
  try {
    const cache = await caches.open('iv-drugref-urgent-meta');
    await cache.put('last-check', new Response(String(ts)));
  } catch (e) {}
}

// ─── Error Handling in Service Worker ───
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.message);
  // Notify all clients about SW error
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_ERROR',
        error: {
          message: event.message || 'Unknown SW error',
          filename: event.filename || 'sw.js',
          lineno: event.lineno || 0
        }
      });
    });
  });
});

self.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  console.error('[SW] Unhandled rejection:', reason);
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_ERROR',
        error: {
          message: reason ? (reason.message || String(reason)) : 'Unknown SW rejection',
          filename: 'sw.js',
          lineno: 0
        }
      });
    });
  });
});
