'use strict';
// ============================================================
// Drug write path — sheet column resolution (gas-complete.js)
//
// Regression cover for the v5.69.0 fix: the DrugData sheet in production uses
// human-readable headers ('Generic Name', 'HAD', 'Reconst: Solvent', …), but
// drug WRITES resolved their target column with a bare headers.indexOf(<code
// key>), which only ever matches the lowercase spelling. Every field missed its
// column, `if (col >= 0)` skipped it, and the handler still returned success —
// so the admin panel showed a green toast for a clinical edit that was never
// saved (unchecking HIGH-ALERT on Abciximab stayed checked).
//
// These tests run the REAL handlers against an in-memory sheet.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGas, HUMAN_HEADERS, CODE_HEADERS } = require('./helpers/load-gas');

const USER = 'admin@test.local';
const ID = 1001;

/** One Abciximab row laid out for the human-readable header set. */
function humanRow(overrides = {}) {
  const base = {
    'ID': ID,
    'Generic Name': 'Abciximab',
    'Trade Name': 'Abciximab Inj. 10 mg/5 mL',
    'Strength': '2 mg/mL',
    'ED/NED': 'N',
    'HAD': true,
    'Categories': 'cardiovascular',
    'Reconst: Solvent': 'NSS',
    'Precautions': 'ระวังเลือดออก',
    'Monitoring': 'CBC, Platelet',
    'status': 'approved',
  };
  const cells = Object.assign({}, base, overrides);
  return HUMAN_HEADERS.map((h) => (h in cells ? cells[h] : ''));
}

function humanSheet(overrides) {
  return loadGas({ drugSheetRows: [HUMAN_HEADERS.slice(), humanRow(overrides)] });
}

const colOf = (headers, name) => headers.indexOf(name);

// ── The reported failure ────────────────────────────────────────────────────

test('unchecking HIGH-ALERT (had:false) reaches the sheet on a human-readable header row', () => {
  const g = humanSheet();
  const res = g.json(g.sandbox.handleUpdateDrug(USER, {
    id: ID, generic: 'Abciximab', had: false, status: 'draft',
  }));

  assert.equal(res.success, true);
  assert.equal(g.drugSheet.rows[1][colOf(HUMAN_HEADERS, 'HAD')], false,
    'HAD cell must be written — this is the cell that silently kept its old value');
  assert.equal(g.drugSheet.rows[1][colOf(HUMAN_HEADERS, 'status')], 'draft');
  assert.deepEqual(res.skipped, []);
});

test('the saved row reads back through normalizeDrugRow with had:false', () => {
  const g = humanSheet();
  g.sandbox.handleUpdateDrug(USER, { id: ID, generic: 'Abciximab', had: false });

  const drug = g.sandbox.normalizeDrugRow(g.rowObject(1));
  assert.equal(drug.had, false, 'read path must agree with what the write path stored');
  assert.equal(drug.generic, 'Abciximab');
});

test('a write with no matching column returns success:false instead of a silent no-op', () => {
  const g = loadGas({ drugSheetRows: [['id', 'Unrelated'], [ID, 'x']] });
  const res = g.json(g.sandbox.handleUpdateDrug(USER, { id: ID, generic: 'Abciximab', had: false }));

  assert.equal(res.success, false, 'an edit that lands nowhere must be reported as a failure');
  assert.match(res.error, /ไม่ได้บันทึก/);
});

test('fields with no column are reported in `skipped`, not dropped quietly', () => {
  const g = humanSheet();
  const res = g.json(g.sandbox.handleUpdateDrug(USER, {
    id: ID, generic: 'Abciximab', notAColumn: 'value',
  }));

  assert.equal(res.success, true);
  assert.deepEqual(res.written, ['generic']);
  assert.deepEqual(res.skipped, ['notAColumn']);
});

// ── Column resolution ───────────────────────────────────────────────────────

test('human-readable headers do not match the code keys at all (why the resolver exists)', () => {
  const g = humanSheet();
  ['generic', 'trade', 'strength', 'ed', 'had', 'categories', 'ref'].forEach((key) => {
    assert.equal(HUMAN_HEADERS.indexOf(key), -1, `plain indexOf('${key}') finds nothing here`);
    assert.ok(g.sandbox._drugCells(HUMAN_HEADERS, key, '').length > 0,
      `_drugCells must still resolve '${key}'`);
  });
});

test('_drugCol resolves both header conventions', () => {
  const g = humanSheet();
  assert.equal(g.sandbox._drugCol(HUMAN_HEADERS, 'had'), colOf(HUMAN_HEADERS, 'HAD'));
  assert.equal(g.sandbox._drugCol(CODE_HEADERS, 'had'), colOf(CODE_HEADERS, 'had'));
  assert.equal(g.sandbox._drugCol(HUMAN_HEADERS, 'generic'), colOf(HUMAN_HEADERS, 'Generic Name'));
  assert.equal(g.sandbox._drugCol(HUMAN_HEADERS, 'nope'), -1);
});

test('nested objects fan out to per-sub-field columns on the human sheet', () => {
  const g = humanSheet();
  g.sandbox.handleUpdateDrug(USER, {
    id: ID, reconst: { solvent: 'SWFI', volume: '5 mL', conc: '2 mg/mL' },
  });

  const row = g.drugSheet.rows[1];
  assert.equal(row[colOf(HUMAN_HEADERS, 'Reconst: Solvent')], 'SWFI');
  assert.equal(row[colOf(HUMAN_HEADERS, 'Reconst: Volume')], '5 mL');
  assert.equal(row[colOf(HUMAN_HEADERS, 'Reconst: Conc')], '2 mg/mL');
});

test('nested objects stay one JSON column on a code-created sheet', () => {
  const g = loadGas({ drugSheetRows: [CODE_HEADERS.slice(), CODE_HEADERS.map((h) => (h === 'id' ? ID : ''))] });
  g.sandbox.handleUpdateDrug(USER, { id: ID, reconst: { solvent: 'SWFI', volume: '5 mL' } });

  const cell = g.drugSheet.rows[1][colOf(CODE_HEADERS, 'reconst')];
  assert.deepEqual(JSON.parse(cell), { solvent: 'SWFI', volume: '5 mL' });
});

test('array fields are written in the form their own column is read back in', () => {
  const human = humanSheet();
  human.sandbox.handleUpdateDrug(USER, { id: ID, categories: ['antibiotic', 'critical'] });
  assert.equal(human.drugSheet.rows[1][colOf(HUMAN_HEADERS, 'Categories')], 'antibiotic, critical',
    "'Categories' is read back with .split(',') — it must stay comma-separated");
  assert.deepEqual(human.sandbox.normalizeDrugRow(human.rowObject(1)).categories,
    ['antibiotic', 'critical']);

  const code = loadGas({ drugSheetRows: [CODE_HEADERS.slice(), CODE_HEADERS.map((h) => (h === 'id' ? ID : ''))] });
  code.sandbox.handleUpdateDrug(USER, { id: ID, categories: ['antibiotic', 'critical'] });
  assert.deepEqual(JSON.parse(code.drugSheet.rows[1][colOf(CODE_HEADERS, 'categories')]),
    ['antibiotic', 'critical'], "the lowercase 'categories' column is read back as JSON");
});

// ── Create + approve ────────────────────────────────────────────────────────

test('createDrug places values by header name, not by argument order', () => {
  const g = loadGas({ drugSheetRows: [HUMAN_HEADERS.slice()] });
  const res = g.json(g.sandbox.handleCreateDrug(USER, {
    generic: 'Test Drug', trade: 'Test Inj.', had: true, ed: 'E',
    categories: ['antibiotic'], status: 'draft',
    reconst: { solvent: 'NSS' },
  }));

  assert.equal(res.success, true);
  const row = g.drugSheet.rows[1];
  assert.equal(row[colOf(HUMAN_HEADERS, 'Generic Name')], 'Test Drug');
  assert.equal(row[colOf(HUMAN_HEADERS, 'Trade Name')], 'Test Inj.');
  assert.equal(row[colOf(HUMAN_HEADERS, 'HAD')], true);
  assert.equal(row[colOf(HUMAN_HEADERS, 'ED/NED')], 'E');
  assert.equal(row[colOf(HUMAN_HEADERS, 'Categories')], 'antibiotic');
  assert.equal(row[colOf(HUMAN_HEADERS, 'Reconst: Solvent')], 'NSS');
  assert.equal(row[colOf(HUMAN_HEADERS, 'status')], 'draft');
  assert.equal(String(row[colOf(HUMAN_HEADERS, 'ID')]), String(res.id));
});

test('approveDrug flips status to approved on the human sheet', () => {
  const g = humanSheet({ status: 'pending' });
  const res = g.json(g.sandbox.handleApproveDrug(USER, { id: ID }));

  assert.equal(res.success, true);
  assert.equal(g.drugSheet.rows[1][colOf(HUMAN_HEADERS, 'status')], 'approved');
});

test('editors without a matching row still get an explicit error', () => {
  const g = humanSheet();
  const res = g.json(g.sandbox.handleUpdateDrug(USER, { id: 999999, generic: 'Ghost' }));
  assert.equal(res.success, false);
  assert.match(res.error, /Drug not found/);
});
