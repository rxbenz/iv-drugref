'use strict';
// ============================================================
// Allergy cross-reactivity engine regression tests (Phase 2)
//
// Locks the beta-lactam cross-reactivity logic in js/allergy-data.js
// against the verified, pharmacist-approved tables in
//   docs/allergy-cross-reactivity.md
//
// A failure here means the structural rules, R1 clusters, overrides, or
// severity gating changed — re-verify against the doc + primary sources
// before touching an expectation.
//
// allergy-data.js is a plain CommonJS-compatible module (no DOM), so we
// require it directly (unlike the vm-sandboxed clinical files).
//
// Run: npm test   (node --test)
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/allergy-data.js');

// find the relation row for a given target drug inside a buildReport() result
function rel(allergenId, targetId) {
  return A.computeRelation(allergenId, targetId);
}
// tier of allergen->target
function tierOf(allergenId, targetId) {
  const r = rel(allergenId, targetId);
  return r && r.tier;
}

// ───────────────────────── data integrity ────────────────────────────────
test('every drug has a valid class and (cluster|null)', () => {
  const classes = new Set(['penicillin', 'cephalosporin', 'carbapenem', 'monobactam']);
  for (const d of A.DRUGS) {
    assert.ok(classes.has(d.class), `${d.id} has bad class ${d.class}`);
    assert.ok(d.cluster === null || A.CLUSTERS[d.cluster],
      `${d.id} references unknown cluster ${d.cluster}`);
  }
});

test('DRUG_BY_ID maps every drug id', () => {
  for (const d of A.DRUGS) assert.equal(A.DRUG_BY_ID[d.id], d);
});

// ───────────────────────── same-drug / penicillin class ──────────────────
test('same drug -> high (avoid)', () => {
  assert.equal(tierOf('amoxicillin', 'amoxicillin'), 'high');
});

test('penicillin <-> penicillin -> high (whole class)', () => {
  // amoxicillin allergy => every other penicillin is high
  for (const t of ['ampicillin', 'penicillinG', 'penicillinV', 'piperacillin', 'cloxacillin', 'dicloxacillin']) {
    assert.equal(tierOf('amoxicillin', t), 'high', `amoxicillin->${t}`);
  }
});

// ───────────────────────── shared R1 side chain -> high ───────────────────
test('amoxicillin (hydroxyaminobenzyl) -> cefadroxil/cefprozil = high (~16%)', () => {
  for (const t of ['cefadroxil', 'cefprozil']) {
    const r = rel('amoxicillin', t);
    assert.equal(r.tier, 'high', `amoxicillin->${t}`);
    assert.match(r.pct, /16/);
  }
});

test('ceftriaxone (methoxyimino) -> cefotaxime/cefepime/cefuroxime/cefpodoxime = high', () => {
  for (const t of ['cefotaxime', 'cefepime', 'cefuroxime', 'cefpodoxime']) {
    assert.equal(tierOf('ceftriaxone', t), 'high', `ceftriaxone->${t}`);
  }
});

test('cephalexin (aminobenzyl) -> ampicillin = high (shared cluster across classes)', () => {
  assert.equal(tierOf('cephalexin', 'ampicillin'), 'high');
});

// ───────────────────────── the ceftazidime <-> aztreonam edge case ────────
test('ceftazidime <-> aztreonam = high BOTH directions (identical R1)', () => {
  assert.equal(tierOf('ceftazidime', 'aztreonam'), 'high');
  assert.equal(tierOf('aztreonam', 'ceftazidime'), 'high');
});

test('ceftriaxone -> ceftazidime = low (alkoxyimino != methoxyimino)', () => {
  assert.equal(tierOf('ceftriaxone', 'ceftazidime'), 'low');
});

// ───────────────────────── negligible targets ────────────────────────────
test('any allergy -> carbapenems = negligible (~0.87%)', () => {
  for (const t of ['meropenem', 'imipenem', 'ertapenem']) {
    const r = rel('amoxicillin', t);
    assert.equal(r.tier, 'negligible', `amoxicillin->${t}`);
    assert.match(r.pct, /0\.87/);
  }
});

test('cefazolin as target = negligible from any beta-lactam allergy (unique R1)', () => {
  for (const a of ['amoxicillin', 'penicillinG', 'ceftriaxone', 'ceftazidime']) {
    assert.equal(tierOf(a, 'cefazolin'), 'negligible', `${a}->cefazolin`);
  }
});

test('aztreonam as target = negligible from penicillin allergy', () => {
  assert.equal(tierOf('amoxicillin', 'aztreonam'), 'negligible');
});

// ───────────────────────── penicillin G has no ceph cluster ───────────────
test('penicillin G -> all cephalosporins = low/negligible, never high', () => {
  for (const d of A.DRUGS) {
    if (d.class !== 'cephalosporin') continue;
    const tier = tierOf('penicillinG', d.id);
    assert.notEqual(tier, 'high', `penicillinG->${d.id} should not be high`);
  }
  // specifically: cefadroxil is NOT high from penG (different cluster than amox)
  assert.equal(tierOf('penicillinG', 'cefadroxil'), 'low');
});

// ───────────────────────── buildReport grouping + severity gating ─────────
test('buildReport(amoxicillin, mild): penicillins in avoid, carbapenems in safer', () => {
  const r = A.buildReport('amoxicillin', 'mild');
  const avoidIds = r.avoid.map((x) => x.drug.id);
  const saferIds = r.safer.map((x) => x.drug.id);
  assert.ok(avoidIds.includes('ampicillin'));
  assert.ok(avoidIds.includes('cefadroxil')); // shared R1
  assert.ok(saferIds.includes('meropenem'));
  assert.ok(saferIds.includes('cefazolin'));
  assert.equal(r.blocked, false);
});

test('buildReport avoid list is sorted high-risk first', () => {
  const r = A.buildReport('amoxicillin', 'mild');
  const orders = r.avoid.map((x) => A.TIERS[x.tier].order);
  for (let i = 1; i < orders.length; i++) {
    assert.ok(orders[i] >= orders[i - 1], 'avoid not sorted by tier order');
  }
});

test('SCAR severity blocks ALL beta-lactams (everything in avoid, safer empty)', () => {
  const r = A.buildReport('amoxicillin', 'scar');
  assert.equal(r.blocked, true);
  assert.equal(r.safer.length, 0);
  // every other drug (23) ends up in avoid
  assert.equal(r.avoid.length, A.DRUGS.length - 1);
});

test('unknown severity does not block (data-driven default)', () => {
  const r = A.buildReport('amoxicillin', 'unknown');
  assert.equal(r.blocked, false);
  assert.ok(r.safer.length > 0);
});

// ───────────────────────── non-beta-lactam: Sulfonamides (Phase 4.1) ──────
test('NBL: sulfonamide group exists with allergens indexed', () => {
  const g = A.NBL_GROUPS.find((x) => x.id === 'sulfonamide');
  assert.ok(g, 'sulfonamide group present');
  assert.ok(A.NBL_INDEX.cotrimoxazole, 'cotrimoxazole indexed as an allergen');
});

test('NBL: cotrimoxazole/IgE -> avoid sulfonamide antibiotics, safe non-antibiotics', () => {
  const r = A.buildReport('cotrimoxazole', 'ige');
  assert.equal(r.isNbl, true);
  assert.equal(r.blocked, false);
  const avoidG = r.avoid.map((x) => x.drug.generic);
  const saferG = r.safer.map((x) => x.drug.generic);
  assert.ok(avoidG.includes('Sulfadiazine'));
  assert.ok(saferG.includes('Celecoxib'));        // non-antibiotic -> safe
  assert.ok(saferG.includes('Furosemide'));
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  assert.ok(r.safer.every((x) => x.tier === 'negligible'));
});

test('NBL: cotrimoxazole excluded from its own avoid list', () => {
  const r = A.buildReport('cotrimoxazole', 'ige');
  assert.ok(!r.avoid.some((x) => /TMP-SMX|Cotrimoxazole/.test(x.drug.generic)),
    'patient drug should not be listed against itself');
});

test('NBL: SCAR -> non-antibiotic sulfonamides become caution (not safe, not blocked)', () => {
  const r = A.buildReport('cotrimoxazole', 'scar');
  assert.equal(r.blocked, false);                 // sulfonamide SCAR != block-all
  assert.equal(r.safer.length, 0);
  assert.ok(r.caution.length > 0);
  assert.ok(r.caution.every((x) => x.tier === 'moderate'));
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
});

test('NBL: report names safe options itself (no generic alternatives box)', () => {
  const r = A.buildReport('cotrimoxazole', 'ige');
  assert.equal(r.nonBetaLactam, null);
});

test('NBL: unknown allergen id returns null', () => {
  assert.equal(A.buildReport('not-a-drug', 'ige'), null);
});

test('beta-lactam report shape unchanged (has caution:[] + isNbl:false)', () => {
  const r = A.buildReport('amoxicillin', 'ige');
  assert.equal(r.isNbl, false);
  assert.deepEqual(r.caution, []);
  assert.ok(r.nonBetaLactam && r.nonBetaLactam.length > 0);
});

// ───────────────────────── overrides precedence ──────────────────────────
test('override beats structural rule (cefazolin target wins over low default)', () => {
  // cefazolin is a cephalosporin; without override a penicillin->ceph default
  // would be "low". The override must force "negligible".
  assert.equal(tierOf('penicillinV', 'cefazolin'), 'negligible');
});
