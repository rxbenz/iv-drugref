// Drug–Drug Interaction engine (Phase 0) — locks the class-collision + curated-pair logic.
const { test } = require('node:test');
const assert = require('node:assert');

// The module attaches to window.DrugInteractions; provide a minimal stub then load it.
global.window = global.window || {};
require('../js/drug-interactions.js');
const DI = global.window.DrugInteractions;

function titles(names) { return DI.check(names).map(f => f.title); }
function sevs(names) { return DI.check(names).map(f => f.severity); }

test('needs ≥2 drugs', () => {
  assert.deepStrictEqual(DI.check(['Amiodarone']), []);
  assert.deepStrictEqual(DI.check([]), []);
});

test('class collision: two QT-prolongers flag additive QT', () => {
  const t = titles(['Amiodarone', 'Ondansetron']);
  assert.ok(t.some(x => /QT/.test(x)), 'expected a QT finding');
});

test('class collision lists ALL members (3 QT drugs → one finding, three drugs)', () => {
  const f = DI.check(['Amiodarone', 'Ciprofloxacin', 'Haloperidol']).find(x => /QT/.test(x.title));
  assert.ok(f, 'expected a QT finding');
  assert.strictEqual(f.drugs.length, 3);
});

test('aminoglycoside + vancomycin → both nephrotoxic AND ototoxic', () => {
  const t = titles(['Vancomycin', 'Gentamicin']);
  assert.ok(t.some(x => /nephro/i.test(x)), 'nephrotoxicity');
  assert.ok(t.some(x => /oto/i.test(x)), 'ototoxicity');
});

test('serotonergic: fentanyl + linezolid', () => {
  assert.ok(titles(['Fentanyl', 'Linezolid']).some(x => /[Ss]erotonin/.test(x)));
});

test('curated pair: valproate + carbapenem (any -penem)', () => {
  assert.strictEqual(DI.check(['Sodium Valproate', 'Meropenem']).length, 1);
  assert.strictEqual(DI.check(['Sodium Valproate', 'Ertapenem']).length, 1);
});

test('curated pair: linezolid + sympathomimetic (MAOI)', () => {
  assert.ok(titles(['Linezolid', 'Adrenaline (Epinephrine)']).length >= 1);
});

test('no false positives for unrelated drugs', () => {
  assert.deepStrictEqual(DI.check(['Cefazolin', 'NSS']), []);
});

// ---- Phase 1: new additive classes ----
test('class: two CNS depressants flag additive CNS/resp depression', () => {
  assert.ok(titles(['Morphine', 'Midazolam']).some(x => /CNS|respiratory|กดประสาท/i.test(x)));
});

test('class: β-blocker + non-DHP CCB flag additive bradycardia', () => {
  assert.ok(titles(['Esmolol', 'Diltiazem IV']).some(x => /bradycardia|เต้นช้า/i.test(x)));
});

test('class: two vasodilators flag additive hypotension', () => {
  assert.ok(titles(['Glyceryl Trinitrate (NTG)', 'Sodium Nitroprusside']).some(x => /hypotension|ความดันต่ำ/i.test(x)));
});

test('class: two anticholinergics flag additive anticholinergic burden', () => {
  assert.ok(titles(['Atropine', 'Glycopyrrolate']).some(x => /anticholinergic|โคลิเนอร์จิก/i.test(x)));
});

// ---- Phase 1: new curated pairs ----
test('curated: ceftriaxone + IV calcium', () => {
  assert.ok(titles(['Ceftriaxone', 'Calcium Gluconate']).some(x => /Ceftriaxone/i.test(x)));
});

test('curated: digoxin + amiodarone (PK level rise)', () => {
  const t = titles(['Digoxin', 'Amiodarone']);
  assert.ok(t.some(x => /Digoxin/i.test(x) && /Amiodarone/i.test(x)));
});

test('curated: methotrexate + cotrimoxazole (myelosuppression)', () => {
  assert.ok(titles(['Methotrexate IV (high-dose)', 'Cotrimoxazole (TMP/SMX)']).some(x => /Methotrexate/i.test(x)));
});

test('curated: aminoglycoside + neuromuscular blocker (prolonged paralysis)', () => {
  assert.ok(titles(['Gentamicin', 'Rocuronium']).some(x => /Gentamicin/i.test(x) && /Rocuronium/i.test(x)));
});

test('curated: phenytoin + valproate (free phenytoin rise)', () => {
  assert.ok(titles(['Phenytoin', 'Sodium Valproate']).some(x => /Phenytoin/i.test(x)));
});

test('valproate + carbapenem still fires exactly one finding (no class leakage)', () => {
  // meropenem/valproate must stay untagged so the curated pair is the sole finding
  assert.strictEqual(DI.check(['Sodium Valproate', 'Meropenem']).length, 1);
});

test('findings are severity-sorted (major before moderate)', () => {
  const s = sevs(['Vancomycin', 'Gentamicin']); // nephrotoxic(major) + ototoxic(moderate)
  const order = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
  for (let i = 1; i < s.length; i++) assert.ok(order[s[i - 1]] <= order[s[i]]);
});

// ---- Merge-over-defaults (the Midazolam+Morphine safety-floor fix) ----
// _applyRemote must MERGE Supabase data over the code defaults, never REPLACE them,
// so an incomplete/stale remote table can never silently drop a vetted interaction.
test('remote SAFETY FLOOR: incomplete remote rules can NOT drop a code interaction', () => {
  // Simulate the exact bug: Supabase has SOME class rules but is missing the
  // opioid/benzo cnsDepress tags entirely.
  DI._applyRemote({ pairs: [], rules: [
    { keyword: 'amiodarone', classes: ['QT'] },
    { keyword: 'ciprofloxacin', classes: ['QT'] }
  ] });
  // Midazolam+Morphine (cnsDepress in code defaults) MUST still fire despite the
  // remote set omitting them.
  assert.ok(titles(['Morphine', 'Midazolam']).some(x => /CNS|respiratory|กดประสาท/i.test(x)),
    'code cnsDepress floor must survive an incomplete remote sync');
  DI._applyRemote({}); // reset working tables to pure defaults
});

test('remote can ADD a new keyword/class not in code defaults', () => {
  DI._applyRemote({ pairs: [], rules: [{ keyword: 'cefazolin', classes: ['QT'] }] });
  // cefazolin now QT-tagged remotely → collides with a code QT drug
  assert.ok(titles(['Cefazolin', 'Amiodarone']).some(x => /QT/.test(x)),
    'remote-added tag should take effect');
  DI._applyRemote({});
  // ...and after reset, cefazolin is untagged again (no phantom QT)
  assert.deepStrictEqual(DI.check(['Cefazolin', 'NSS']), []);
});

test('remote UNIONs classes onto an existing code keyword (never subtracts)', () => {
  // Remote says morphine is ONLY serotonergic (omits cnsDepress). Union keeps both.
  DI._applyRemote({ pairs: [], rules: [{ keyword: 'morphine', classes: ['serotonergic'] }] });
  assert.ok(titles(['Morphine', 'Midazolam']).some(x => /CNS|respiratory|กดประสาท/i.test(x)),
    'union must retain the code cnsDepress tag');
  DI._applyRemote({});
});

test('remote curated pair with same identity OVERRIDES default (no duplicate)', () => {
  // Admin edits valproate+meropenem severity via Supabase; must stay ONE finding.
  DI._applyRemote({ rules: [], pairs: [
    { a: 'valpro', bAny: ['meropenem', 'ertapenem', 'imipenem', 'penem'], severity: 'moderate',
      mechanism: 'edited', management: 'edited', ref: 'edited' }
  ] });
  const f = DI.check(['Sodium Valproate', 'Meropenem']);
  assert.strictEqual(f.length, 1, 'same-identity remote pair overrides, not duplicates');
  assert.strictEqual(f[0].severity, 'moderate', 'remote edit should win');
  DI._applyRemote({});
  // reset restores the default severity
  assert.strictEqual(DI.check(['Sodium Valproate', 'Meropenem'])[0].severity, 'major');
});

test('_applyRemote({}) is a clean reset to code defaults', () => {
  DI._applyRemote({ rules: [{ keyword: 'zzz_fake', classes: ['QT'] }] });
  DI._applyRemote({});
  // the pristine seed is untouched by any merge
  assert.ok(DI._CLASS_RULES_SEED.every(r => r[0] !== 'zzz_fake'));
  assert.ok(titles(['Morphine', 'Midazolam']).some(x => /CNS|respiratory|กดประสาท/i.test(x)));
});
