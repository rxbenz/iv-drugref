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
