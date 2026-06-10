'use strict';
// ============================================================
// Clinical formula regression tests (ROADMAP P0.1)
//
// Guards the core dosing math that the whole app depends on:
//   core.js   — CrCl (Cockcroft-Gault), Schwartz, IBW/ABW, BSA, BMI,
//               CKD-EPI 2021, CKD staging
//   vanco-tdm — the 5 adult vanco PK models + Colin 2019 pediatric model
//               (the coefficients corrected in v5.10.0 / added in v5.11.0)
//
// Golden values are taken from the primary-source verifications recorded
// in CLAUDE.md. A failure here means a dosing-relevant formula changed —
// re-verify against the cited paper before touching the expectation.
//
// Run: npm test   (node --test)
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, loadVancoModels, loadCompatibility } = require('./helpers/load-clinical');

const { IVDrugRef } = loadCore();

// assert two floats are within `eps` (default 0.05 — golden values are 1-dp)
function near(actual, expected, eps = 0.05, msg) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `${msg || ''} expected ≈${expected}, got ${actual} (Δ${Math.abs(actual - expected).toFixed(4)})`
  );
}

// ───────────────────────── Cockcroft-Gault (raw, no obesity adj) ──────────
test('CG raw — male, golden 77.8', () => {
  // (140-60)*70 / (72*1.0) = 77.78
  near(IVDrugRef.calcCG_raw(60, 70, 1.0, 'M'), 77.8);
});

test('CG raw — female 0.85 factor', () => {
  // (140-40)*80 / (72*1.2) * 0.85 = 78.70
  near(IVDrugRef.calcCG_raw(40, 80, 1.2, 'F'), 78.7);
});

test('CG raw — female factor is exactly 0.85 of male', () => {
  const m = IVDrugRef.calcCG_raw(50, 75, 1.1, 'M');
  const f = IVDrugRef.calcCG_raw(50, 75, 1.1, 'F');
  near(f, m * 0.85, 0.1);
});

// ───────────────────────── Cockcroft-Gault (weight-adjusted) ──────────────
test('CG — non-obese uses TBW (matches raw)', () => {
  // ht 180 → IBW≈75; wt 70 < IBW*1.3 → no ABW adjustment
  near(IVDrugRef.calcCockcroftGault(60, 70, 1.0, 'M', 180),
       IVDrugRef.calcCG_raw(60, 70, 1.0, 'M'), 0.5);
});

test('CG — obese patient switches to ABW (lower than raw TBW result)', () => {
  // ht 170 → IBW≈66; wt 120 > IBW*1.3 → uses ABW < TBW → lower CrCl
  const adj = IVDrugRef.calcCockcroftGault(50, 120, 1.0, 'M', 170);
  const raw = IVDrugRef.calcCG_raw(50, 120, 1.0, 'M');
  assert.ok(adj < raw, `obese ABW path should reduce CrCl: adj ${adj} should be < raw ${raw}`);
});

test('CG — floor at 5 mL/min', () => {
  assert.ok(IVDrugRef.calcCockcroftGault(95, 40, 9.0, 'F', 150) >= 5);
});

// ───────────────────────── IBW (Devine) ──────────────────────────────────
test('IBW — male 180cm ≈ 75.0', () => {
  // 50 + 2.3*(70.866-60) = 74.99
  near(IVDrugRef.calcIBW(180, 'M'), 75.0, 0.1);
});

test('IBW — female 160cm ≈ 52.4', () => {
  // 45.5 + 2.3*(62.992-60) = 52.38
  near(IVDrugRef.calcIBW(160, 'F'), 52.4, 0.1);
});

test('IBW — guards zero/negative height', () => {
  assert.equal(IVDrugRef.calcIBW(0, 'M'), 0);
});

// ───────────────────────── ABW ───────────────────────────────────────────
test('ABW — overweight: IBW + 0.4*(TBW-IBW)', () => {
  // 70 + 0.4*(100-70) = 82
  near(IVDrugRef.calcABW(100, 70), 82, 0.01);
});

test('ABW — underweight returns TBW unchanged', () => {
  assert.equal(IVDrugRef.calcABW(55, 70), 55);
});

// ───────────────────────── BSA (Mosteller) ───────────────────────────────
test('BSA — 180cm/75kg ≈ 1.94 m²', () => {
  // sqrt(180*75/3600) = 1.9365
  near(IVDrugRef.calcBSA(180, 75), 1.94, 0.01);
});

test('BSA — standard 1.73 m² reference point (~166cm/65kg)', () => {
  near(IVDrugRef.calcBSA(166, 65), 1.73, 0.02);
});

// ───────────────────────── BMI ────────────────────────────────────────────
test('BMI — 70kg/180cm ≈ 21.6', () => {
  near(IVDrugRef.calcBMI(70, 180), 21.6, 0.1);
});

// ───────────────────────── Schwartz (pediatric eGFR) ──────────────────────
test('Schwartz — 0.413*ht/scr', () => {
  // 0.413*120/0.5 = 99.12
  near(IVDrugRef.calcSchwartz(120, 0.5), 99.1, 0.1);
});

// ───────────────────────── CKD-EPI 2021 ───────────────────────────────────
test('CKD-EPI 2021 — male 60yo SCr 1.0 ≈ 86.2', () => {
  near(IVDrugRef.calcCKDEPI2021(60, 1.0, 'M'), 86.2, 0.3);
});

test('CKD-EPI 2021 — female 60yo SCr 1.0 ≈ 64.5', () => {
  // At identical SCr the female kappa (0.7) yields lower eGFR than male —
  // expected for this equation (sex coefficient reflects muscle-mass).
  const f = IVDrugRef.calcCKDEPI2021(60, 1.0, 'F');
  near(f, 64.5, 0.3);
  assert.ok(f < IVDrugRef.calcCKDEPI2021(60, 1.0, 'M'), 'female < male at SCr 1.0');
});

test('CKD-EPI 2021 non-indexed — scales by BSA/1.73', () => {
  const indexed = IVDrugRef.calcCKDEPI2021(60, 1.0, 'M');
  const bsa = IVDrugRef.calcBSA(180, 90);
  near(IVDrugRef.calcCKDEPI2021_nonindexed(60, 1.0, 'M', bsa),
       indexed * bsa / 1.73, 0.2);
});

// ───────────────────────── CKD staging ───────────────────────────────────
test('CKD stage boundaries (G1/G2/G3a/G3b/G4/G5)', () => {
  assert.equal(IVDrugRef.getCKDStage(95).stage, 'G1');
  assert.equal(IVDrugRef.getCKDStage(90).stage, 'G1');
  assert.equal(IVDrugRef.getCKDStage(75).stage, 'G2');
  assert.equal(IVDrugRef.getCKDStage(50).stage, 'G3a');
  assert.equal(IVDrugRef.getCKDStage(35).stage, 'G3b');
  assert.equal(IVDrugRef.getCKDStage(20).stage, 'G4');
  assert.equal(IVDrugRef.getCKDStage(10).stage, 'G5');
});

// ═══════════════════════ Vancomycin PK models ════════════════════════════
// Golden CLs from CLAUDE.md (v5.10.0 correction), verified vs primary papers.
// Reference patient: 45yo M, 70kg, 170cm, SCr 1.0.
const { models, VancoPK } = loadVancoModels();
const REF = { age: 45, wt: 70, ht: 170, scr: 1.0, sex: 'M', heme: false, dialysis: 'none' };

test('Vanco/Buelga — CL 5.99 L/h (golden, v5.10.0)', () => {
  near(models.buelga.clFn(REF), 5.99, 0.02);
});

test('Vanco/Llopis — CL 3.49 L/h via CG-LBW (golden, v5.10.0)', () => {
  near(models.llopis.clFn(REF), 3.49, 0.02);
});

test('Vanco/Goti — CL 3.65 L/h (golden, v5.10.0)', () => {
  near(models.goti.clFn(REF), 3.65, 0.02);
});

test('Vanco/Goti — dialysis applies 0.7 CL factor', () => {
  const onHD = { ...REF, dialysis: 'hd' };
  near(models.goti.clFn(onHD), models.goti.clFn(REF) * 0.7, 0.05);
});

test('Vanco/Adane — finite positive CL (extreme-obese model)', () => {
  const obese = { ...REF, wt: 150, ht: 165 };
  const cl = models.adane.clFn(obese);
  assert.ok(cl > 0 && Number.isFinite(cl), `Adane CL should be finite positive, got ${cl}`);
});

test('Vanco/Bourguignon — CL = kel × V (elderly model, positive)', () => {
  const elderly = { ...REF, age: 82 };
  const cl = models.bourguignon.clFn(elderly);
  assert.ok(cl > 0 && Number.isFinite(cl), `Bourguignon CL should be finite positive, got ${cl}`);
});

// ═══════════════════════ Colin 2019 pediatric model ══════════════════════
// Golden CLs from CLAUDE.md (v5.11.0), verified vs paper Table 3 + Eq 5-13.
test('Colin 2019 — 35yo/70kg/SCr0.83 → CL 4.10 (golden)', () => {
  near(models.colin.clFn({ age: 35, wt: 70, scr: 0.83, heme: false }), 4.10, 0.02);
});

test('Colin 2019 — 60yo/65kg/SCr0.97 → CL 2.55 (golden)', () => {
  near(models.colin.clFn({ age: 60, wt: 65, scr: 0.97, heme: false }), 2.55, 0.02);
});

test('Colin 2019 — hematologic malignancy applies ×1.294', () => {
  const base = models.colin.clFn({ age: 10, wt: 30, scr: 0.4, heme: false });
  const heme = models.colin.clFn({ age: 10, wt: 30, scr: 0.4, heme: true });
  near(heme, base * 1.294, 0.02, 'heme factor');
});

test('Colin 2019 — Vss = 84.6 × (wt/70)', () => {
  near(models.colin.vdFn({ wt: 70 }), 84.6, 0.1);
  near(models.colin.vdFn({ wt: 35 }), 42.3, 0.1);
});

// ───────────────────────── model registry sanity ─────────────────────────
test('All 5 adult vanco models present with required fns + priors', () => {
  for (const id of ['buelga', 'llopis', 'goti', 'adane', 'bourguignon']) {
    const m = models[id];
    assert.ok(m, `missing model ${id}`);
    for (const fn of ['crclFn', 'clFn', 'vdFn']) {
      assert.equal(typeof m[fn], 'function', `${id}.${fn} must be a function`);
    }
    for (const p of ['omega_cl', 'omega_vd', 'sigma']) {
      assert.ok(m[p] > 0, `${id}.${p} must be a positive prior`);
    }
  }
});

// ───────────────────────── age routing boundary ──────────────────────────
// isPedsVanco gates which model path runs: <1 blocked (guard), 1-17 → Colin,
// ≥18 → adult. A wrong boundary = wrong PK model for a real patient.
test('isPedsVanco — routes only ages [1, 18) to the pediatric model', () => {
  const peds = (age) => !!VancoPK.isPedsVanco({ age }); // coerce (fn may short-circuit to null)
  assert.equal(peds(0.9), false, 'infant <1 not peds-routed (guard blocks)');
  assert.equal(peds(1), true);
  assert.equal(peds(10), true);
  assert.equal(peds(17.9), true);
  assert.equal(peds(18), false, 'adult boundary');
  assert.equal(peds(40), false);
  assert.ok(!VancoPK.isPedsVanco(null), 'null patient → falsy');
  assert.ok(!VancoPK.isPedsVanco({}), 'missing age → falsy');
});

// ──────────────── display↔engine CrCl consistency (P0.2 guard) ────────────
// Regression lock for the old "silent CG override": for a pediatric vanco
// patient, the engine's CrCl (model.crclFn — what the Colin path feeds/shows)
// must equal Bedside Schwartz (the displayed value), NOT the adult Cockcroft-
// Gault. v5.10.0 (model.crclFn/clFn) + v5.11.0 (Colin) closed this; these tests
// fail loudly if a future change reintroduces the adult-CG path for peds.
test('Peds vanco — engine CrCl uses Schwartz (display), not adult CG', () => {
  const peds = { age: 10, wt: 30, ht: 135, scr: 0.4, sex: 'M', heme: false, dialysis: 'none' };
  const schwartz = IVDrugRef.calcSchwartz(peds.ht, peds.scr);
  const adultCG = IVDrugRef.calcCockcroftGault(peds.age, peds.wt, peds.scr, peds.sex, peds.ht);
  assert.ok(Math.abs(schwartz - adultCG) > 0.5, 'precondition: Schwartz and CG differ enough to detect');
  // Colin is the model the peds path selects (isPedsVanco → [COLIN_MODEL])
  assert.ok(VancoPK.isPedsVanco(peds), 'age 10 routes to Colin');
  near(models.colin.crclFn(peds), schwartz, 0.05, 'engine CrCl == Schwartz');
  assert.ok(Math.abs(models.colin.crclFn(peds) - adultCG) > 0.5, 'engine CrCl is NOT adult CG');
});

test('Peds vanco — Colin clearance is SCr-driven, independent of adult CG', () => {
  // Identical covariates, only SCr differs: Colin CL must respond via its own
  // SCr maturation model (FSCR), confirming it does not route through CG.
  const base = { age: 8, wt: 25, ht: 128, scr: 0.4, heme: false };
  const higherScr = { ...base, scr: 0.8 };
  assert.ok(models.colin.clFn(higherScr) < models.colin.clFn(base),
    'higher SCr → lower Colin CL (SCr-driven maturation, no CG)');
});

// ═══════════════════ PK engine (shared, P0.3a) ════════════════════════════
// The 1-compartment engine (predictConc/calcAUC_ss/ssPeakTrough/bayesianMAP)
// was extracted verbatim from the two TDM pages into VancoPK.engine. These
// lock its end-to-end output so the extraction — and a future 2-comp swap
// (P0.3b) — cannot drift. bayesianMAP has no RNG → safe to golden-lock; runMCMC
// has RNG → smoke-tested only. Closes the P0.1 "engine integration test" item.
const engine = VancoPK.engine;
const ENG_REF = { age: 45, wt: 70, ht: 170, scr: 1.0, sex: 'M', dialysis: 'none', heme: false };
const ENG_DOSES = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 5, startTime: 0 }];

test('engine — exposes the 5 PK functions', () => {
  for (const fn of ['predictConc', 'calcAUC_ss', 'ssPeakTrough', 'bayesianMAP', 'runMCMC'])
    assert.equal(typeof engine[fn], 'function', fn + ' present');
});

test('engine calcAUC_ss — reproduces CLAUDE.md golden AUC24 (1000mg q12h)', () => {
  // AUC24 = calcAUC_ss(tau) × (24/tau); golden values documented in CLAUDE.md.
  const auc24 = (id) => engine.calcAUC_ss(models[id].clFn(ENG_REF), models[id].vdFn(ENG_REF), 1000, 12, 1) * 2;
  near(auc24('buelga'), 324, 1.0, 'Buelga AUC24');
  near(auc24('goti'),   535, 1.0, 'Goti AUC24');
  near(auc24('llopis'), 561, 1.0, 'Llopis AUC24');
});

test('engine calcAUC_ss — numeric AUC tracks exact daily_dose/CL (within ~4%)', () => {
  // At steady state AUC24 = daily_dose/CL exactly; the numeric integrator sits
  // slightly under due to carry-term clamping. Guards the integration math.
  const cl = models.goti.clFn(ENG_REF);
  const auc24 = engine.calcAUC_ss(cl, models.goti.vdFn(ENG_REF), 1000, 12, 1) * 2;
  const exact = 2000 / cl;
  assert.ok(auc24 <= exact && auc24 > exact * 0.96, `numeric ${auc24.toFixed(1)} just under exact ${exact.toFixed(1)}`);
});

test('engine ssPeakTrough — golden peak/trough, peak>trough, trough>0', () => {
  const pt = engine.ssPeakTrough(models.goti.clFn(ENG_REF), models.goti.vdFn(ENG_REF), 1000, 12, 1);
  near(pt.peak, 27.9, 0.2, 'Goti peak');
  near(pt.trough, 18.4, 0.2, 'Goti trough');
  assert.ok(pt.peak > pt.trough && pt.trough > 0, 'peak > trough > 0');
});

test('engine bayesianMAP — no levels returns the population estimate exactly', () => {
  const r = engine.bayesianMAP(ENG_REF, ENG_DOSES, [], models.goti);
  assert.equal(r.method, 'Population PK');
  near(r.cl, r.popCL, 1e-9, 'cl == popCL');
  near(r.vd, r.popVd, 1e-9, 'vd == popVd');
});

test('engine bayesianMAP — a higher-than-predicted trough lowers estimated CL', () => {
  // Single trough mostly informs CL (deterministic optimizer, no RNG).
  const popPred = engine.predictConc(54, models.goti.clFn(ENG_REF), models.goti.vdFn(ENG_REF), ENG_DOSES);
  const high = engine.bayesianMAP(ENG_REF, ENG_DOSES, [{ time: 54, value: popPred * 1.5 }], models.goti);
  assert.equal(high.method, 'Bayesian MAP');
  assert.ok(high.cl < high.popCL, `higher level → CL ${high.cl.toFixed(2)} < pop ${high.popCL.toFixed(2)}`);
});

test('engine runMCMC — produces samples and reports progress (smoke)', async () => {
  const lvls = [{ time: 54, value: 18 }];
  const map = engine.bayesianMAP(ENG_REF, ENG_DOSES, lvls, models.goti);
  let lastPct = -1;
  // runMCMC batches via setTimeout(0); wrap in a Promise so the test awaits the
  // final cb and the assertions actually run (otherwise they'd never fire).
  const { samples, accRate } = await new Promise((resolve) => {
    engine.runMCMC(ENG_REF, ENG_DOSES, lvls, models.goti, map, 500,
      (samples, accRate) => resolve({ samples, accRate }),
      (pct) => { lastPct = pct; });
  });
  assert.ok(samples.length > 0, 'returned samples');
  assert.ok(accRate >= 0 && accRate <= 1, 'acceptance rate in [0,1]');
  assert.ok(samples.every(s => s.cl > 0 && s.vd > 0 && isFinite(s.ke)), 'finite positive samples');
  assert.ok(lastPct >= 0, 'onProgress was called');
});

// ═══════════════════ 2-compartment engine (P0.3b) ═════════════════════════
// Verified vs primary PDFs (Llopis/Goti/Colin Tables). The bi-exponential
// engine must (1) collapse to the 1-comp engine when Q→∞ (V=Vc+Vp), (2) keep
// interval AUC = dose/CL (compartment-independent), (3) match numeric
// superposition for the analytic steady-state peak/trough. These lock the math
// before it is wired into the TDM pages.
const e2c = VancoPK.engine2c;
const TC_REF = { age: 45, wt: 70, ht: 170, scr: 1.0, sex: 'M', dialysis: 'none', heme: false };
const TC_DOSES = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 8, startTime: 0 }];

test('2-comp models — Llopis/Goti/Colin expose verified tc {vcFn,vpFn,qFn,ω}', () => {
  for (const id of ['llopis', 'goti', 'colin']) {
    const tc = models[id].tc;
    assert.ok(tc, id + ' has tc');
    for (const fn of ['vcFn', 'vpFn', 'qFn']) assert.equal(typeof tc[fn], 'function', id + '.' + fn);
    for (const k of ['omega_cl', 'omega_v1', 'omega_v2']) assert.ok(tc[k] > 0, id + '.' + k);
  }
  // spot-check the headline verified numbers (primary-PDF values)
  assert.equal(models.llopis.tc.qFn(TC_REF), 7.48, 'Llopis Q=7.48 L/h');
  assert.equal(models.goti.tc.qFn(TC_REF), 6.5, 'Goti Q=6.5 L/h');
  near(models.colin.tc.qFn({ wt: 70 }), 3.22, 1e-9, 'Colin Q=3.22 at 70kg');
  near(models.colin.tc.qFn({ wt: 35 }), 3.22 * Math.pow(0.5, 0.75), 1e-6, 'Colin Q allometric ^0.75');
});

test('2-comp predictConc2c — collapses to 1-comp exactly as Q→∞ (Vd=Vc+Vp)', () => {
  const cl = 3.65, v1 = 58.4, v2 = 38.4;
  for (const t of [1, 6, 12, 84, 90, 95.5]) {
    const twoC = e2c.predictConc2c(t, cl, v1, 1e7, v2, TC_DOSES);
    const oneC = VancoPK.engine.predictConc(t, cl, v1 + v2, TC_DOSES);
    near(twoC, oneC, 1e-3, `Q→∞ matches 1-comp at t=${t}`);
  }
});

test('2-comp — interval AUC at steady state still equals dose/CL', () => {
  // Numerically integrate the 2-comp curve over the last (near-SS) interval.
  const cl = 3.65, v1 = 58.4, q = 6.5, v2 = 38.4, tau = 12, start = 7 * 12;
  const N = 4000, dt = tau / N; let auc = 0;
  for (let i = 0; i < N; i++) auc += e2c.predictConc2c(start + i * dt + dt / 2, cl, v1, q, v2, TC_DOSES) * dt;
  // near steady state the interval AUC approaches dose/CL from below
  const exact = 1000 / cl;
  assert.ok(auc > exact * 0.95 && auc <= exact, `2-comp interval AUC ${auc.toFixed(1)} ≈ dose/CL ${exact.toFixed(1)}`);
});

test('2-comp ssPeakTrough2c — matches numeric superposition; peak>trough>0', () => {
  const cl = 3.65, v1 = 58.4, q = 6.5, v2 = 38.4;
  const longDoses = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 40, startTime: 0 }];
  const lastStart = 39 * 12;
  const numPeak = e2c.predictConc2c(lastStart + 1, cl, v1, q, v2, longDoses);
  const numTrough = e2c.predictConc2c(lastStart + 12 - 1e-6, cl, v1, q, v2, longDoses);
  const an = e2c.ssPeakTrough2c(cl, v1, q, v2, 1000, 12, 1);
  near(an.peak, numPeak, 0.02, 'analytic peak == numeric SS');
  near(an.trough, numTrough, 0.02, 'analytic trough == numeric SS');
  assert.ok(an.peak > an.trough && an.trough > 0, 'peak > trough > 0');
});

test('2-comp — Goti peak is higher than the 1-comp peak (fidelity gain)', () => {
  // The whole point: central-compartment peak exceeds the 1-comp approximation
  // while AUC is unchanged. Goti REF 1000mg q12h: 2-comp peak ~32, 1-comp ~28.
  const cl = models.goti.clFn(TC_REF);
  const two = e2c.ssPeakTrough2c(cl, models.goti.tc.vcFn(TC_REF), models.goti.tc.qFn(TC_REF), models.goti.tc.vpFn(TC_REF), 1000, 12, 1);
  const one = VancoPK.engine.ssPeakTrough(cl, models.goti.vdFn(TC_REF), 1000, 12, 1);
  assert.ok(two.peak > one.peak, `2-comp peak ${two.peak.toFixed(1)} > 1-comp ${one.peak.toFixed(1)}`);
  near(two.peak, 32.2, 0.6, '2-comp Goti peak ≈ 32');
});

// ── 2-comp Bayesian fit (P0.3b inc2): fit CL,V1,V2 with Q fixed ───────────
test('2-comp MAP — no levels falls back exactly to population CL/V1/V2', () => {
  const pt = { ...TC_REF };
  const r = e2c.bayesianMAP2c(pt, TC_DOSES, [], models.goti);
  near(r.cl, models.goti.clFn(pt), 1e-6, 'CL = population');
  near(r.v1, models.goti.tc.vcFn(pt), 1e-6, 'V1 = population');
  near(r.v2, models.goti.tc.vpFn(pt), 1e-6, 'V2 = population');
  assert.equal(r.method, 'Population PK (2-comp)');
  near(r.q, 6.5, 1e-9, 'Q fixed at population (6.5)');
});

test('2-comp MAP — recovers CL from a measured trough; method flagged', () => {
  // Forward-simulate a trough from known (perturbed) params, then fit it back.
  const pt = { ...TC_REF };
  const m = models.goti, tc = m.tc;
  const trueCL = m.clFn(pt) * 1.3, v1 = tc.vcFn(pt), v2 = tc.vpFn(pt), q = tc.qFn(pt);
  const doses = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 10, startTime: 0 }];
  const tTrough = 9 * 12 - 0.5;               // near end of 10th interval, ~SS
  const obs = e2c.predictConc2c(tTrough, trueCL, v1, q, v2, doses);
  const r = e2c.bayesianMAP2c(pt, doses, [{ time: tTrough, value: obs }], m);
  assert.ok(r.cl > m.clFn(pt) && r.cl < trueCL * 1.1, `fitted CL ${r.cl.toFixed(2)} moved toward truth ${trueCL.toFixed(2)}`);
  near(r.cl, trueCL, trueCL * 0.12, 'CL recovered within 12% from single trough');
  assert.equal(r.method, 'Bayesian MAP (2-comp)');
});

test('2-comp MAP — higher measured trough drives a lower fitted CL', () => {
  const pt = { ...TC_REF };
  const doses = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 8, startTime: 0 }];
  const t = 7 * 12 - 0.5;
  const lo = e2c.bayesianMAP2c(pt, doses, [{ time: t, value: 10 }], models.goti).cl;
  const hi = e2c.bayesianMAP2c(pt, doses, [{ time: t, value: 25 }], models.goti).cl;
  assert.ok(hi < lo, `higher trough (25) → lower CL ${hi.toFixed(2)} < ${lo.toFixed(2)} (trough 10)`);
});

test('2-comp runMCMC2c — smoke: samples finite, accRate in [0,1], progress fires', async () => {
  const pt = { ...TC_REF };
  const doses = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 8, startTime: 0 }];
  const levels = [{ time: 7 * 12 - 0.5, value: 15 }];
  const map = e2c.bayesianMAP2c(pt, doses, levels, models.goti);
  let lastPct = -1;
  const { samples, accRate } = await new Promise((res) => {
    e2c.runMCMC2c(pt, doses, levels, models.goti, map, 600,
      (s, a) => res({ samples: s, accRate: a }), (pct) => { lastPct = pct; });
  });
  assert.ok(samples.length > 0, 'returned samples');
  assert.ok(accRate >= 0 && accRate <= 1, 'acceptance rate in [0,1]');
  assert.ok(samples.every(s => s.cl > 0 && s.v1 > 0 && s.v2 > 0 && isFinite(s.ke)), 'finite positive samples');
  assert.ok(lastPct >= 0, 'onProgress was called');
});

test('2-comp auto-dispatch — predictAuto/peakTroughAuto route by pk shape', () => {
  const cl = 3.65, v1 = 58.4, q = 6.5, v2 = 38.4, vd = v1 + v2;
  const pk2 = { cl, v1, v2, q, vd };          // 2-comp pk → bi-exponential path
  const pk1 = { cl, vd };                       // 1-comp pk → single-exp path
  near(e2c.predictAuto(6, pk2, TC_DOSES), e2c.predictConc2c(6, cl, v1, q, v2, TC_DOSES), 1e-9, '2-comp predict routed');
  near(e2c.predictAuto(6, pk1, TC_DOSES), VancoPK.engine.predictConc(6, cl, vd, TC_DOSES), 1e-9, '1-comp predict routed');
  const pt2 = e2c.peakTroughAuto(pk2, 1000, 12, 1), pt1 = e2c.peakTroughAuto(pk1, 1000, 12, 1);
  near(pt2.peak, e2c.ssPeakTrough2c(cl, v1, q, v2, 1000, 12, 1).peak, 1e-9, '2-comp peak routed');
  near(pt1.peak, VancoPK.engine.ssPeakTrough(cl, vd, 1000, 12, 1).peak, 1e-9, '1-comp peak routed');
  assert.ok(pt2.peak !== pt1.peak, 'the two paths give different peaks (dispatch is real)');
});

// ═══════════ IV compatibility salt-key disambiguation (P2.3) ══════════════
// normKey collapsed every salt of a cation to one key (Calcium gluconate &
// Calcium chloride → "calcium"; the 4 sodium salts → "sodium"), so one salt's
// curated pair leaked onto a different salt. keyCandidates() now gives each
// specific salt its own key (cation+anion) with the bare cation as a fallback.
const compat = loadCompatibility();
const drug = (i, g, y = '-', x = '-') => ({ i, g, y, x, c: [] });

test('compat keyCandidates — specific salts distinct, bare cation generic', () => {
  // .join() to compare across the vm-sandbox realm (arrays aren't reference-equal)
  const kc = (n) => compat.keyCandidates(n).join('|');
  assert.equal(kc('Calcium gluconate'), 'calciumgluconate|calcium');
  assert.equal(kc('Calcium chloride 10%'), 'calciumchloride|calcium');
  assert.equal(kc('Potassium chloride (KCl)'), 'potassiumchloride|potassium');
  assert.equal(kc('Potassium phosphate'), 'potassiumphosphate|potassium');
  assert.equal(kc('Sodium nitroprusside'), 'sodiumnitroprusside|sodium');
  assert.equal(kc('Calcium'), 'calcium');   // bare cation = generic only
  assert.equal(kc('Heparin'), 'heparin');    // non-salt unchanged
});

test('compat — specific salt curated entries resolve to the right salt', () => {
  // Ceftriaxone + both calcium salts are curated incompatible (specific entries)
  assert.equal(compat.getCompatibility(drug(1, 'Calcium gluconate'), drug(2, 'Ceftriaxone')).status, 'incompatible');
  assert.equal(compat.getCompatibility(drug(1, 'Calcium chloride 10%'), drug(2, 'Ceftriaxone')).status, 'incompatible');
  // Calcium chloride + Dobutamine is curated compatible (chloride-specific)
  assert.equal(compat.getCompatibility(drug(1, 'Calcium chloride 10%'), drug(3, 'Dobutamine')).status, 'compatible');
});

test('compat — bare-cation curated entries still match every salt (fallback)', () => {
  // "Calcium" + "Sodium bicarbonate" curated incompatible → applies to gluconate too
  assert.equal(compat.getCompatibility(drug(1, 'Calcium gluconate'), drug(2, 'Sodium bicarbonate')).status, 'incompatible');
  // bare "Potassium" (KCl additive) curated compatible with Norepinephrine
  assert.equal(compat.getCompatibility(drug(1, 'Potassium chloride (KCl)'), drug(2, 'Norepinephrine')).status, 'compatible');
});

test('compat — NO cross-salt leak (the P2.3 safety fix) ⭐', () => {
  // Calcium chloride+Dobutamine is curated 'c' — must NOT leak to Calcium gluconate
  const r1 = compat.getCompatibility(drug(1, 'Calcium gluconate'), drug(3, 'Dobutamine'));
  assert.notEqual(r1.source, 'curated', 'gluconate must not inherit chloride curated data');
  // Sodium bicarbonate+Caspofungin is curated 'i' — must NOT leak to Sodium nitroprusside
  const r2 = compat.getCompatibility(drug(1, 'Sodium nitroprusside'), drug(4, 'Caspofungin'));
  assert.notEqual(r2.status, 'incompatible', 'nitroprusside must not inherit bicarbonate incompatibility');
  assert.notEqual(r2.source, 'curated', 'no curated match for a different sodium salt');
});

// ═══════════ IVDrugRef.escHtml — XSS escaper (P3.1) ══════════════════════════
test('escHtml escapes all five HTML-significant chars', () => {
  assert.equal(IVDrugRef.escHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(IVDrugRef.escHtml(`& < > " '`), '&amp; &lt; &gt; &quot; &#39;');
  // attribute-breakout payload is neutralised
  assert.ok(!IVDrugRef.escHtml('a" onmouseover="evil()').includes('"'));
});

test('escHtml: nullish → empty string (no literal "undefined"/"null")', () => {
  assert.equal(IVDrugRef.escHtml(undefined), '');
  assert.equal(IVDrugRef.escHtml(null), '');
  assert.equal(IVDrugRef.escHtml(0), '0');      // 0 is a value, not nullish
  assert.equal(IVDrugRef.escHtml('safe text'), 'safe text');
});

// ═══════════ Compatibility Check render functions (P2.5 redesign) ═════════════
test('renderPairDetail — status + both names + Y-site/incompat fields, escaped', () => {
  const a = { i: 1, g: 'Furosemide', y: 'Heparin', x: 'Midazolam' };
  const b = { i: 2, g: 'Dopamine', y: '-', x: '-' };
  const html = compat.renderPairDetail(a, b, { status: 'incompatible', source: 'curated' });
  assert.match(html, /INCOMPATIBLE/);
  assert.match(html, /compat-result incompatible/);
  assert.match(html, /Furosemide \+ Dopamine/);
  assert.match(html, /Trissel/);                 // source badge label
});

test('renderPairDetail — escapes hostile drug fields (no raw tag)', () => {
  const a = { i: 1, g: '<img src=x onerror=alert(1)>', y: '-', x: '-' };
  const b = { i: 2, g: 'Dopamine', y: '-', x: '-' };
  const html = compat.renderPairDetail(a, b, { status: 'compatible', source: 'none' });
  assert.ok(!html.includes('<img src=x'), 'raw injected tag must not appear');
  assert.match(html, /&lt;img src=x/);
});

test('renderGroupedResults — groups by status with counts (3+ drugs)', () => {
  const pairs = [
    { a: { g: 'A' }, b: { g: 'B' }, result: { status: 'incompatible', source: 'curated' } },
    { a: { g: 'A' }, b: { g: 'C' }, result: { status: 'compatible', source: 'curated' } },
    { a: { g: 'B' }, b: { g: 'C' }, result: { status: 'nodata', source: 'none' } }
  ];
  const html = compat.renderGroupedResults(pairs);
  assert.match(html, /3 คู่/);                    // summary count
  assert.match(html, /result-group i/);          // incompatible group present
  assert.match(html, /result-group c/);          // compatible group present
  assert.match(html, /A \+ B/);
});

// ═══════════ Drug × Fluid diluent compatibility (P2.4) ═══════════════════════
const fluidOf = (key) => compat.DRUGS.find(d => d.isFluid && d.key === key);
const drugOf = (g) => compat.DRUGS.find(d => !d.isFluid && d.g === g);

test('fluidKey — resolves aliases, fixes digit-strip (D5W≠D10W), non-fluid→null', () => {
  assert.equal(compat.fluidKey('D5W'), 'd5w');
  assert.equal(compat.fluidKey('NSS'), 'nss');
  assert.equal(compat.fluidKey('0.9% NaCl'), 'nss');
  assert.equal(compat.fluidKey('0.45% NaCl'), 'halfns');
  assert.equal(compat.fluidKey('LR'), 'rl');
  assert.equal(compat.fluidKey('D10W'), 'd10w');
  assert.notEqual(compat.fluidKey('D5W'), compat.fluidKey('D10W')); // digit-strip bug fixed
  assert.equal(compat.fluidKey('Dopamine'), null);
});

test('fluids are selectable entities (9 fluids, isFluid flagged)', () => {
  const fluids = compat.DRUGS.filter(d => d.isFluid);
  assert.equal(fluids.length, 9);
  assert.ok(fluidOf('d5w') && fluidOf('nss') && fluidOf('rl'));
});

test('drug×fluid CURATED — Phenytoin + D5W = incompatible (diluent, curated)', () => {
  const r = compat.getCompatibility(drugOf('Phenytoin'), fluidOf('d5w'));
  assert.equal(r.status, 'incompatible');
  assert.equal(r.kind, 'diluent');
  assert.equal(r.source, 'curated');
});

test('drug×fluid CURATED — Amphotericin B + NSS = incompatible (order-independent)', () => {
  const r = compat.getCompatibility(fluidOf('nss'), drugOf('Amphotericin B (conventional)'));
  assert.equal(r.status, 'incompatible');
  assert.equal(r.kind, 'diluent');
});

test('drug×fluid derived from .x field — Ertapenem + D5W = incompatible (drugfield)', () => {
  const r = compat.getCompatibility(drugOf('Ertapenem'), fluidOf('d5w'));
  assert.equal(r.status, 'incompatible');
  assert.equal(r.source, 'drugfield');
});

test('drug×fluid derived from .y field — Oxytocin + NSS = compatible', () => {
  const r = compat.getCompatibility(drugOf('Oxytocin'), fluidOf('nss'));
  assert.equal(r.status, 'compatible');
  assert.equal(r.kind, 'diluent');
});

test('drug×fluid no record → nodata "verify" (never guesses)', () => {
  const r = compat.getCompatibility(drugOf('Adenosine'), fluidOf('swfi'));
  assert.equal(r.status, 'nodata');
  assert.equal(r.kind, 'diluent');
  assert.match(r.detail, /Trissel/);
});

test('fluid + fluid → nodata (not a meaningful admixture question)', () => {
  assert.equal(compat.getCompatibility(fluidOf('nss'), fluidOf('d5w')).status, 'nodata');
});

test('"ns" alias does not false-match inside words like "solutions"', () => {
  const fake = { i: 1, g: 'TestDrug', y: '-', x: 'Alkaline solutions, Most drugs', c: [] };
  assert.equal(compat.getCompatibility(fake, fluidOf('nss')).status, 'nodata');
});

test('diluent render shows admixture badge + no Y-site CDS alternatives', () => {
  const r = compat.getCompatibility(drugOf('Phenytoin'), fluidOf('d5w'));
  const html = compat.renderPairDetail(drugOf('Phenytoin'), fluidOf('d5w'), r);
  assert.match(html, /Diluent \/ admixture/);
  assert.ok(!html.includes('ทางเลือกยาที่เข้ากันได้')); // CDS alt block absent for diluent
});

// ═══════════ Imported drug–fluid CURATED pairs (P2.4 pharmacist-reviewed) ═════
test('imported pairs: Amiodarone NSS=variable / D5W=compatible (D5W-only drug)', () => {
  const aN = compat.getCompatibility(drugOf('Amiodarone'), fluidOf('nss'));
  assert.equal(aN.status, 'variable');
  assert.equal(aN.source, 'curated');
  assert.equal(compat.getCompatibility(drugOf('Amiodarone'), fluidOf('d5w')).status, 'compatible');
});

test('imported pairs: Tenecteplase + D5W = incompatible (precipitation)', () => {
  assert.equal(compat.getCompatibility(drugOf('Tenecteplase'), fluidOf('d5w')).status, 'incompatible');
});

test('imported pairs: Albumin 20% + SWFI = incompatible (hemolysis)', () => {
  assert.equal(compat.getCompatibility(drugOf('Albumin 20%'), fluidOf('swfi')).status, 'incompatible');
});

test('imported pairs: RL incompatibilities (Nicardipine, K-phosphate, NaHCO3)', () => {
  assert.equal(compat.getCompatibility(drugOf('Nicardipine'), fluidOf('rl')).status, 'incompatible');
  assert.equal(compat.getCompatibility(drugOf('Potassium phosphate'), fluidOf('rl')).status, 'incompatible');
  assert.equal(compat.getCompatibility(drugOf('Sodium bicarbonate'), fluidOf('rl')).status, 'incompatible');
});

test('imported pairs: Norepinephrine + NSS = variable (dextrose preferred)', () => {
  const r = compat.getCompatibility(drugOf('Norepinephrine (Levophed)'), fluidOf('nss'));
  assert.equal(r.status, 'variable');
  assert.equal(r.kind, 'diluent');
});

// ═══════════ Drug-fluid pairs survive Google-Sheet sync (P2.4 fix, v5.15.1) ═══
// MUST be the last compat test — rebuildCuratedMap() mutates the shared CURATED_MAP.
test('drug-fluid CURATED pairs survive a sheet rebuildCuratedMap (sheet=drug-drug only)', () => {
  // Simulate the GAS sheet sync: drug-drug pairs only, NO fluid pairs.
  compat.rebuildCuratedMap([['Heparin','Vancomycin','i'], ['Calcium gluconate','Ceftriaxone','i']]);
  // fluid pairs must still be present (re-applied after rebuild)
  const aN = compat.getCompatibility(drugOf('Amiodarone'), fluidOf('nss'));
  assert.equal(aN.status, 'variable');
  assert.equal(aN.source, 'curated');
  assert.equal(compat.getCompatibility(drugOf('Tenecteplase'), fluidOf('d5w')).status, 'incompatible');
  // and the simulated sheet drug-drug pair is also active
  assert.equal(compat.getCompatibility(drugOf('Heparin'), drugOf('Vancomycin')).status, 'incompatible');
});

// ═══════════ C1: blank patient field must not be masked by a default ═════════
test('C1: validatePatientInput errors on present-but-blank (NaN), skips absent (undefined)', () => {
  const { IVDrugRef } = loadCore();
  // all present & valid
  assert.equal(IVDrugRef.validatePatientInput({age:55, wt:70, scr:1.0, ht:170}).allValid, true);
  // present but blank (NaN) → must error (the phantom-default bug)
  let v = IVDrugRef.validatePatientInput({age:55, wt:NaN, scr:1.0, ht:170});
  assert.equal(v.allValid, false);
  assert.ok(v.errors.length >= 1);
  assert.equal(IVDrugRef.validatePatientInput({age:55, wt:70, scr:NaN, ht:170}).allValid, false);
  // absent on this page (undefined) → not flagged, stays valid
  assert.equal(IVDrugRef.validatePatientInput({age:55, wt:70, scr:1.0, ht:undefined}).allValid, true);
});
