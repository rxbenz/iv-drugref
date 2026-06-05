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
const { loadCore, loadVancoModels } = require('./helpers/load-clinical');

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
const { models } = loadVancoModels();
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
