'use strict';
// ============================================================
// Renal-dosing page — band matching + remote (Supabase) reshape
// Locks the v5.52.0 safety fixes:
//   1. rdRangeHit: ≤/≥ are INCLUSIVE (a GFR exactly on a band
//      boundary must match its row — it used to match nothing).
//   2. applyRenalRemote getDosing(gfr): the "Recommended" headline
//      must be derived from the GFR band row, NOT the static
//      normal-renal dose (an ESRD patient used to see the normal
//      dose, and contraindication wording in the table was
//      invisible to the CDS scan).
//   3. Hardcoded vancomycin dose floor: never rounds to 0 mg.
// ============================================================

const test = require('node:test');
const assert = require('node:assert');
const { loadRenalDosing } = require('./helpers/load-clinical');

const { rdRangeHit, applyRenalRemote, RENAL_DRUGS } = loadRenalDosing();

// ---- rdRangeHit boundary semantics ----

test('rdRangeHit: "≤30" includes exactly 30 (inclusive)', () => {
  assert.equal(rdRangeHit('≤30', 30), true);
  assert.equal(rdRangeHit('≤30', 30.1), false);
  assert.equal(rdRangeHit('≤30', 29.9), true);
});

test('rdRangeHit: "<30" excludes exactly 30 (strict)', () => {
  assert.equal(rdRangeHit('<30', 30), false);
  assert.equal(rdRangeHit('<30', 29.9), true);
});

test('rdRangeHit: "≥80" and ">=80" include exactly 80; ">80" does not', () => {
  assert.equal(rdRangeHit('≥80', 80), true);
  assert.equal(rdRangeHit('>=80', 80), true);
  assert.equal(rdRangeHit('>80', 80), false);
  assert.equal(rdRangeHit('≥80', 79.9), false);
});

test('rdRangeHit: "26–50" (en dash) includes both ends', () => {
  assert.equal(rdRangeHit('26–50', 26), true);
  assert.equal(rdRangeHit('26–50', 50), true);
  assert.equal(rdRangeHit('26–50', 25.9), false);
  assert.equal(rdRangeHit('26–50', 50.1), false);
});

test('rdRangeHit: non-numeric labels ("HD", "CAPD") never match', () => {
  assert.equal(rdRangeHit('HD', 30), false);
  assert.equal(rdRangeHit('', 30), false);
  assert.equal(rdRangeHit(null, 30), false);
});

// ---- Remote (Supabase) drugs: GFR-aware headline ----

function makeRemoteMetformin() {
  return {
    drugs: [{
      id: 'metformin', name: 'Metformin', class: 'misc', sub: 'Biguanide',
      badges: ['misc', 'avoid'],
      recommended: '500-1000 mg BID (max 2000 mg/day)', // NORMAL dose (static)
      dosingTable: [
        { range: '≥60', dose: '500-1000 mg BID', freq: '', note: 'ขนาดปกติ' },
        { range: '30-59', dose: 'ลดขนาด 50%', freq: '', note: 'ไม่เริ่มยาใหม่' },
        { range: '<30', dose: '⚠ ห้ามใช้ (contraindicated)', freq: '', note: 'lactic acidosis' },
      ],
      info: 'x', infoType: 'blue', ref: 'test',
    }],
  };
}

test('remote getDosing: ESRD patient gets the GFR-band row, NOT the normal dose', () => {
  assert.equal(applyRenalRemote(makeRemoteMetformin()), true);
  const drug = RENAL_DRUGS.find((d) => d.id === 'metformin');
  assert.ok(drug, 'remote drug applied');
  const d8 = drug.getDosing(8); // dialysis-range GFR
  assert.ok(d8.recommended.includes('ห้ามใช้'),
    'headline must carry the <30 contraindication, got: ' + d8.recommended);
  assert.ok(!d8.recommended.startsWith('500-1000 mg BID'),
    'headline must not be the static normal dose');
  // the matched row is highlighted
  const hlRows = d8.table.filter((r) => r.hl);
  assert.equal(hlRows.length, 1);
  assert.equal(hlRows[0].range, '<30');
});

test('remote getDosing: normal-renal patient still gets the normal-dose row', () => {
  applyRenalRemote(makeRemoteMetformin());
  const drug = RENAL_DRUGS.find((d) => d.id === 'metformin');
  const d90 = drug.getDosing(90);
  assert.ok(d90.recommended.includes('500-1000 mg BID'));
});

test('remote getDosing: boundary GFR exactly 30 matches the 30-59 row (inclusive range)', () => {
  applyRenalRemote(makeRemoteMetformin());
  const drug = RENAL_DRUGS.find((d) => d.id === 'metformin');
  const d30 = drug.getDosing(30);
  assert.ok(d30.recommended.includes('ลดขนาด 50%'),
    'GFR 30 must land in 30-59, got: ' + d30.recommended);
});

test('remote getDosing: no dosingTable → static recommended (no false warning)', () => {
  applyRenalRemote({
    drugs: [{
      id: 'noadj', name: 'NoAdjDrug', recommended: '1 g q8h',
      dosingTable: [], info: '', infoType: 'blue', ref: '',
    }],
  });
  const drug = RENAL_DRUGS.find((d) => d.id === 'noadj');
  assert.equal(drug.getDosing(8).recommended, '1 g q8h');
});

test('remote getDosing: banded table with a GFR gap warns instead of claiming the normal dose', () => {
  applyRenalRemote({
    drugs: [{
      id: 'gappy', name: 'GappyDrug', recommended: '2 g q8h',
      dosingTable: [{ range: '≥60', dose: '2 g', freq: 'q8h', note: '' }],
      info: '', infoType: 'blue', ref: '',
    }],
  });
  const drug = RENAL_DRUGS.find((d) => d.id === 'gappy');
  const d20 = drug.getDosing(20);
  assert.ok(d20.recommended.includes('ไม่พบช่วง GFR'),
    'unmatched GFR must warn, got: ' + d20.recommended);
});

// ---- Hardcoded vancomycin: 250-mg floor ----

test('hardcoded vancomycin: dose never rounds to 0 mg (250 mg floor)', () => {
  const fresh = loadRenalDosing(); // re-load: earlier tests replaced RENAL_DRUGS
  const vanco = fresh.RENAL_DRUGS.find((d) => d.id === 'vancomycin');
  assert.ok(vanco, 'hardcoded vancomycin present');
  const out = vanco.getDosing(90, { wt: 7 }); // 7 kg → 105 mg → floor 250
  assert.ok(!/\b0 mg\b/.test(out.recommended),
    'recommended must not contain "0 mg": ' + out.recommended);
  assert.ok(out.recommended.includes('250'), 'floored to 250 mg');
});
