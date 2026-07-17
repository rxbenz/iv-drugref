'use strict';
// ============================================================
// LINE bot drug-matching + Flex-card tests. Imports the SAME .mjs the Deno
// function uses, so `npm test` (CI gate) locks the matcher + reply contract.
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'supabase', 'functions', 'line-webhook');
const loadMatcher = () => import(path.join(DIR, 'matcher.mjs'));
const loadMessages = () => import(path.join(DIR, 'messages.mjs'));

// Small fixture (generic + trade only — enough for name matching).
const DRUGS = [
  { generic: 'Vancomycin', trade: 'Vancocin' },
  { generic: 'Meropenem', trade: 'Meronem' },
  { generic: 'Calcium gluconate', trade: '' },
  { generic: 'Calcium chloride', trade: '' },
  { generic: 'Amiodarone', trade: 'Cordarone' },
];

test('matchDrug: exact + prefix resolve to a single drug', async () => {
  const { matchDrug } = await loadMatcher();
  assert.strictEqual(matchDrug('vancomycin', DRUGS).drug.generic, 'Vancomycin');
  assert.strictEqual(matchDrug('VANCO', DRUGS).drug.generic, 'Vancomycin'); // prefix, case-insensitive
  assert.strictEqual(matchDrug('cordarone', DRUGS).drug.generic, 'Amiodarone'); // trade-name substring
});

test('matchDrug: ambiguous salt → suggestions, never a guess (clinical safety)', async () => {
  const { matchDrug } = await loadMatcher();
  const r = matchDrug('calcium', DRUGS);
  assert.strictEqual(r.status, 'suggest');
  const names = r.candidates.map((d) => d.generic).sort();
  assert.deepStrictEqual(names, ['Calcium chloride', 'Calcium gluconate']);
});

test('matchDrug: typo → fuzzy suggestion; nonsense → none', async () => {
  const { matchDrug } = await loadMatcher();
  const r = matchDrug('vancomicin', DRUGS); // 1 edit from Vancomycin
  assert.strictEqual(r.status, 'suggest');
  assert.ok(r.candidates.some((d) => d.generic === 'Vancomycin'));
  assert.strictEqual(matchDrug('qwertyzz', DRUGS).status, 'none');
  assert.strictEqual(matchDrug('', DRUGS).status, 'none');
});

test('parseMessage: routes drug / pair / renal / help', async () => {
  const { parseMessage } = await loadMatcher();
  assert.strictEqual(parseMessage('vancomycin').kind, 'drug');
  assert.deepStrictEqual(parseMessage('vanco + heparin'), { kind: 'pair', a: 'vanco', b: 'heparin' });
  assert.deepStrictEqual(parseMessage('ยา A กับ ยา B'), { kind: 'pair', a: 'ยา A', b: 'ยา B' });
  assert.deepStrictEqual(parseMessage('ไต meropenem'), { kind: 'renal', query: 'meropenem' });
  assert.strictEqual(parseMessage('เมนู').kind, 'help');
  assert.strictEqual(parseMessage('   ').kind, 'help');
});

test('buildDrugFlex: card carries generic, disclaimer, HAD flag, incompat + app deep link', async () => {
  const { buildDrugFlex, DISCLAIMER, APP_BASE } = await loadMessages();
  const flex = buildDrugFlex({
    generic: 'Vancomycin', trade: 'Vancocin', strength: '500 mg', had: true,
    reconst: { solvent: 'SWFI', volume: '10 mL' },
    dilution: { diluent: 'NSS', finalConc: '5 mg/mL' },
    admin: { rate: '≤10 mg/min' },
    compat: { incompat: 'Ceftriaxone' },
  });
  const s = JSON.stringify(flex);
  assert.strictEqual(flex.type, 'flex');
  assert.ok(s.includes('Vancomycin'));
  assert.ok(s.includes(DISCLAIMER), 'card must carry the disclaimer');
  assert.ok(s.includes(APP_BASE + '/index.html?drug=Vancomycin'), 'card must deep-link into the app');
  assert.ok(s.includes('High-Alert'), 'HAD drugs flagged');
  assert.ok(s.includes('Ceftriaxone'), 'incompatibility shown');
});

test('compat: buildCompatMap + lookupCompat — both orders, salt-aware, no leak', async () => {
  const { buildCompatMap, lookupCompat } = await loadMatcher();
  const map = buildCompatMap([
    ['Vancomycin', 'Heparin', 'i'],
    ['Potassium', 'Furosemide', 'c'],          // bare cation (KCl additive)
    ['Calcium gluconate', 'Ceftriaxone', 'i'],
  ]);
  assert.strictEqual(lookupCompat(map, 'Vancomycin', 'Heparin'), 'i');
  assert.strictEqual(lookupCompat(map, 'Heparin', 'Vancomycin'), 'i');          // order-independent
  assert.strictEqual(lookupCompat(map, 'Potassium chloride', 'Furosemide'), 'c'); // salt → bare-cation fallback
  assert.strictEqual(lookupCompat(map, 'Calcium gluconate', 'Ceftriaxone'), 'i');
  assert.strictEqual(lookupCompat(map, 'Calcium chloride', 'Ceftriaxone'), null); // one salt's data never leaks
  assert.strictEqual(lookupCompat(map, 'Aspirin', 'Water'), null);
});

test('buildPairResult: colored result carries the pair, disclaimer, deep link', async () => {
  const { buildPairResult, DISCLAIMER, APP_BASE } = await loadMessages();
  const flex = buildPairResult('Vancomycin', 'Heparin', 'i');
  const s = JSON.stringify(flex);
  assert.strictEqual(flex.type, 'flex');
  assert.ok(s.includes('ไม่เข้ากัน'));
  assert.ok(s.includes(APP_BASE + '/compatibility.html?a=Vancomycin&b=Heparin'));
  assert.ok(s.includes(DISCLAIMER));
  assert.ok(JSON.stringify(buildPairResult('A', 'B', null)).includes('ไม่มีข้อมูล'), 'null → no-data label');
});

test('buildRenalNote: routes to the app calculator, never computes a dose', async () => {
  const { buildRenalNote, DISCLAIMER, APP_BASE } = await loadMessages();
  const msg = buildRenalNote('Vancomycin');
  assert.strictEqual(msg.type, 'text');
  assert.ok(msg.text.includes('Vancomycin'));
  assert.ok(msg.text.includes(APP_BASE + '/renal-dosing.html?drug=Vancomycin'));
  assert.ok(/ไม่คำนวณ/.test(msg.text), 'renal reply must state it does not calculate');
  assert.ok(msg.text.includes(DISCLAIMER));
});
