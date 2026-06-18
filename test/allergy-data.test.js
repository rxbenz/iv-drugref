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

// ───────────────────────── non-beta-lactam: NSAIDs (Phase 4.x) ────────────
test('NBL: nsaid group exists with allergens indexed', () => {
  const g = A.NBL_GROUPS.find((x) => x.id === 'nsaid');
  assert.ok(g, 'nsaid group present');
  assert.ok(A.NBL_INDEX.ibuprofen, 'ibuprofen indexed as an allergen');
  assert.ok(g.singleDrugCallout, 'nsaid group carries a single-drug callout');
});

test('NBL: ibuprofen/IgE -> avoid strong COX-1, safe COX-2/paracetamol, caution preferential COX-2', () => {
  const r = A.buildReport('ibuprofen', 'ige');
  assert.equal(r.isNbl, true);
  assert.equal(r.blocked, false);
  const avoidG = r.avoid.map((x) => x.drug.generic);
  const saferG = r.safer.map((x) => x.drug.generic);
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(avoidG.includes('Naproxen'));            // strong COX-1
  assert.ok(avoidG.includes('Diclofenac'));
  assert.ok(saferG.includes('Celecoxib'));           // COX-2 selective
  assert.ok(saferG.some((g) => /Paracetamol/.test(g)));
  assert.ok(cautionG.includes('Meloxicam'));         // preferential COX-2
  assert.ok(cautionG.includes('Nimesulide'));
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  assert.ok(r.safer.every((x) => x.tier === 'negligible'));
  assert.ok(r.caution.every((x) => x.tier === 'low'));
});

test('NBL: nsaid report carries calloutNote (single-drug scenario)', () => {
  const r = A.buildReport('ibuprofen', 'ige');
  assert.ok(r.calloutNote && /single-drug/.test(r.calloutNote));
});

test('NBL: ibuprofen excluded from its own avoid list', () => {
  const r = A.buildReport('ibuprofen', 'ige');
  assert.ok(!r.avoid.some((x) => /^Ibuprofen$/.test(x.drug.generic)),
    'culprit should not be listed against itself');
});

test('NBL: nsaid SCAR -> COX-2/paracetamol downgraded to caution, callout still present', () => {
  const r = A.buildReport('ibuprofen', 'scar');
  assert.equal(r.blocked, false);
  assert.equal(r.safer.length, 0);
  // caution now contains both the preferential-COX-2 items AND the downgraded safe ones
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(cautionG.includes('Celecoxib'));
  assert.ok(cautionG.includes('Meloxicam'));
  assert.ok(r.calloutNote);
});

test('NBL: nsaid callout names same-chemical-group siblings (piroxicam -> meloxicam)', () => {
  // selective piroxicam allergy: meloxicam is the same Oxicam chemical group,
  // so it must be flagged even though it sits in "caution" (preferential COX-2)
  const r = A.buildReport('piroxicam', 'ige');
  assert.match(r.calloutNote, /Oxicam/);
  assert.match(r.calloutNote, /เมล็อกซิแคม/);   // meloxicam (Thai)
});

test('NBL: nsaid callout groups propionic acids together (ibuprofen -> naproxen/ketoprofen)', () => {
  const r = A.buildReport('ibuprofen', 'ige');
  assert.match(r.calloutNote, /Propionic/);
  assert.match(r.calloutNote, /นาพรอกเซน/);     // naproxen
  assert.match(r.calloutNote, /คีโตโพรเฟน/);    // ketoprofen
  // ibuprofen itself must not appear in its own sibling list
  assert.ok(!/ไอบูโพรเฟน/.test(r.calloutNote));
});

test('NBL: sulfonamide group has NO callout (backward-compat)', () => {
  const r = A.buildReport('cotrimoxazole', 'ige');
  assert.equal(r.calloutNote, '');
});

// ───────────────────────── non-beta-lactam: Anticonvulsants ───────────────
test('NBL: anticonvulsant group exists with allergens indexed', () => {
  const g = A.NBL_GROUPS.find((x) => x.id === 'anticonvulsant');
  assert.ok(g, 'anticonvulsant group present');
  assert.ok(A.NBL_INDEX.carbamazepine, 'carbamazepine indexed as an allergen');
  assert.equal(g.keepSafeOnScar, true);
});

test('NBL: carbamazepine/IgE -> avoid aromatic AEDs, safe non-aromatic, caution zonisamide', () => {
  const r = A.buildReport('carbamazepine', 'ige');
  assert.equal(r.isNbl, true);
  const avoidG = r.avoid.map((x) => x.drug.generic);
  const saferG = r.safer.map((x) => x.drug.generic);
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(avoidG.includes('Oxcarbazepine'));        // aromatic
  assert.ok(avoidG.includes('Phenytoin'));
  assert.ok(avoidG.includes('Lamotrigine'));          // lamotrigine = avoid
  assert.ok(saferG.includes('Levetiracetam'));        // non-aromatic
  assert.ok(saferG.some((g) => /Valproic/.test(g)));
  assert.ok(cautionG.includes('Zonisamide'));         // sulfonamide-derivative
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
});

test('NBL: anticonvulsant carries HLA callout', () => {
  const r = A.buildReport('carbamazepine', 'ige');
  assert.match(r.calloutNote, /HLA-B\*15:02/);
});

test('NBL: anticonvulsant SCAR -> non-aromatic AEDs STAY safe (keepSafeOnScar)', () => {
  const r = A.buildReport('carbamazepine', 'scar');
  assert.equal(r.blocked, false);
  const saferG = r.safer.map((x) => x.drug.generic);
  assert.ok(saferG.includes('Levetiracetam'), 'non-aromatic must remain in safer at SCAR');
  assert.ok(r.safer.every((x) => x.tier === 'negligible'));
  // zonisamide stays caution; safe items are NOT downgraded into caution
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(cautionG.includes('Zonisamide'));
  assert.ok(!cautionG.includes('Levetiracetam'));
});

test('NBL: sulfonamide SCAR still downgrades safe (no keepSafeOnScar regression)', () => {
  const r = A.buildReport('cotrimoxazole', 'scar');
  assert.equal(r.safer.length, 0);
  assert.ok(r.caution.some((x) => x.drug.generic === 'Celecoxib'));
});

// ───────────────────────── non-beta-lactam: Fluoroquinolones ──────────────
test('NBL: fluoroquinolone group exists with flags', () => {
  const g = A.NBL_GROUPS.find((x) => x.id === 'fluoroquinolone');
  assert.ok(g, 'fluoroquinolone group present');
  assert.equal(g.crossClassCaution, true);
  assert.equal(g.keepSafeOnScar, true);
  assert.ok(A.NBL_INDEX.ciprofloxacin, 'ciprofloxacin indexed');
});

test('NBL: cipro/IgE -> other FQs are CAUTION (not avoid), non-FQ safe', () => {
  const r = A.buildReport('ciprofloxacin', 'ige');
  assert.equal(r.avoid.length, 0, 'no hard-avoid for non-SCAR FQ');
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(cautionG.includes('Levofloxacin'));
  assert.ok(cautionG.includes('Moxifloxacin'));
  assert.ok(r.caution.every((x) => x.tier === 'low'));
  // culprit excluded from its own list
  assert.ok(!cautionG.includes('Ciprofloxacin'));
  const saferG = r.safer.map((x) => x.drug.generic);
  assert.ok(saferG.some((g) => /Macrolide|Azithromycin/.test(g)));
});

test('NBL: cipro/SCAR -> ALL other FQs escalate to avoid (high), non-FQ stay safe', () => {
  const r = A.buildReport('ciprofloxacin', 'scar');
  assert.equal(r.blocked, false);
  const avoidG = r.avoid.map((x) => x.drug.generic);
  assert.ok(avoidG.includes('Levofloxacin'));
  assert.ok(avoidG.includes('Moxifloxacin'));
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  // non-FQ alternatives still safe at SCAR (keepSafeOnScar)
  assert.ok(r.safer.length > 0);
  assert.ok(r.safer.every((x) => x.tier === 'negligible'));
});

test('NBL: moxifloxacin flagged highest cross-reactivity (~5.3%)', () => {
  const r = A.buildReport('ciprofloxacin', 'ige');
  const moxi = r.caution.find((x) => x.drug.generic === 'Moxifloxacin');
  assert.ok(moxi && /5\.3/.test(moxi.pct));
});

// ──────────────── non-beta-lactam: Local anesthetics (ester/amide) ─────────
test('NBL: two LA groups exist with correct flags', () => {
  const e = A.NBL_GROUPS.find((x) => x.id === 'la-ester');
  const m = A.NBL_GROUPS.find((x) => x.id === 'la-amide');
  assert.ok(e && m, 'both LA groups present');
  assert.equal(e.crossClassCaution, undefined, 'esters cross-react (not caution)');
  assert.equal(e.keepSafeOnScar, true);
  assert.equal(m.crossClassCaution, true, 'amides = low cross (caution)');
  assert.equal(m.keepSafeOnScar, true);
  assert.ok(A.NBL_INDEX.procaine && A.NBL_INDEX.lidocaine);
});

test('NBL: ester allergy -> other esters AVOID (high), amides safe', () => {
  const r = A.buildReport('procaine', 'ige');
  const avoidG = r.avoid.map((x) => x.drug.generic);
  assert.ok(avoidG.includes('Tetracaine') && avoidG.includes('Benzocaine'));
  assert.ok(!avoidG.includes('Procaine'), 'culprit excluded');
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  const saferG = r.safer.map((x) => x.drug.generic);
  assert.ok(saferG.includes('Lidocaine') && saferG.includes('Bupivacaine'));
  // methylparaben preservative caveat surfaces as caution
  assert.ok(r.caution.some((x) => /methylparaben/i.test(x.drug.generic)));
});

test('NBL: amide allergy/IgE -> other amides CAUTION (low), esters safe', () => {
  const r = A.buildReport('lidocaine', 'ige');
  assert.equal(r.avoid.length, 0, 'no hard-avoid for non-SCAR amide');
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(cautionG.includes('Bupivacaine') && cautionG.includes('Articaine'));
  assert.ok(!cautionG.includes('Lidocaine'), 'culprit excluded');
  const saferG = r.safer.map((x) => x.drug.generic);
  assert.ok(saferG.includes('Procaine') && saferG.includes('Tetracaine'));
});

test('NBL: amide SCAR -> other amides escalate to avoid, esters stay safe', () => {
  const r = A.buildReport('lidocaine', 'scar');
  const avoidG = r.avoid.map((x) => x.drug.generic);
  assert.ok(avoidG.includes('Bupivacaine'));
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  assert.ok(r.safer.some((x) => x.drug.generic === 'Procaine'),
    'esters remain safe at SCAR (keepSafeOnScar, cross-class)');
});

// ──────────────── non-beta-lactam: Iodinated contrast media (clusterAware) ──
test('NBL: ICM group is clusterAware with side-chain clusters', () => {
  const g = A.NBL_GROUPS.find((x) => x.id === 'icm');
  assert.ok(g, 'icm group present');
  assert.equal(g.clusterAware, true);
  assert.equal(g.keepSafeOnScar, true);
  assert.equal(A.NBL_INDEX.iohexol.allergen.cluster, 'carbamoylA');
});

test('NBL: iohexol/IgE -> same side-chain cluster = avoid, different = caution', () => {
  const r = A.buildReport('iohexol', 'ige');
  const avoidG = r.avoid.map((x) => x.drug.generic);
  // same cluster A (iomeprol/ioversol/iodixanol) -> avoid high
  assert.ok(avoidG.includes('Iomeprol') && avoidG.includes('Ioversol') && avoidG.includes('Iodixanol'));
  assert.ok(!avoidG.includes('Iohexol'), 'culprit excluded');
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  // different clusters (iopamidol/iopromide/diatrizoate) -> caution low
  const cautionG = r.caution.map((x) => x.drug.generic);
  assert.ok(cautionG.includes('Iopamidol') && cautionG.includes('Iopromide') && cautionG.includes('Diatrizoate'));
  assert.ok(r.caution.filter((x) => x.drug.class && /Side chain/.test(x.drug.class))
    .every((x) => x.tier === 'low'));
  // gadolinium stays safe
  assert.ok(r.safer.some((x) => /Gadolinium/i.test(x.drug.generic)));
});

test('NBL: ICM SCAR -> ALL other ICM escalate to avoid, alternatives safe', () => {
  const r = A.buildReport('iopamidol', 'scar');
  const avoidG = r.avoid.map((x) => x.drug.generic);
  // every other ICM (both clusters) now avoid
  assert.ok(avoidG.includes('Iohexol') && avoidG.includes('Iobitridol') && avoidG.includes('Iopromide'));
  assert.ok(r.avoid.every((x) => x.tier === 'high'));
  assert.ok(r.safer.some((x) => /Gadolinium/i.test(x.drug.generic)),
    'GBCA stays safe at SCAR (keepSafeOnScar)');
});

test('NBL: clusterAware refactor leaves non-cluster groups unchanged', () => {
  // sulfonamide (default avoid) still avoids cross-reactive antibiotics
  const s = A.buildReport('cotrimoxazole', 'ige');
  assert.ok(s.avoid.length > 0 && s.avoid.every((x) => x.tier === 'high'));
  // fluoroquinolone (crossClassCaution) still caution non-SCAR
  const f = A.buildReport('ciprofloxacin', 'ige');
  assert.equal(f.avoid.length, 0);
  assert.ok(f.caution.some((x) => x.drug.generic === 'Levofloxacin'));
});

// ───────────────────────── overrides precedence ──────────────────────────
test('override beats structural rule (cefazolin target wins over low default)', () => {
  // cefazolin is a cephalosporin; without override a penicillin->ceph default
  // would be "low". The override must force "negligible".
  assert.equal(tierOf('penicillinV', 'cefazolin'), 'negligible');
});
