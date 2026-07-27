'use strict';
// ============================================================
// Offline drug snapshot (drug-snapshot.js) — build-time refresh
//
// build.js replaces dist/drugs-data.json with the live approved drugs so the
// bundled offline fallback is not months stale (the drift that made a drug read
// HIGH-ALERT in the app after the admin panel had un-flagged it, v5.70.0).
//
// The refresh is only as safe as its refusal to run: dist/ already holds the
// committed snapshot, so anything validateSnapshot() rejects leaves users on
// known-good data. These tests pin the rejections as much as the happy path.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const { validateSnapshot, fetchApprovedDrugs, DEFAULT_ENDPOINT } = require('../drug-snapshot');

const drug = (generic, extra = {}) => Object.assign({ id: 1, generic, had: false }, extra);
const rowsOf = (...drugs) => drugs.map((d) => ({ data: d }));

// ── Accepting good data ─────────────────────────────────────────────────────

test('unwraps PostgREST {data} rows into the snapshot array', () => {
  const res = validateSnapshot(rowsOf(drug('Acyclovir'), drug('Abciximab')), 2);

  assert.equal(res.ok, true);
  assert.equal(res.drugs.length, 2);
  assert.equal(res.dropped, 0);
});

test('orders by numeric id, which is the order the app renders', () => {
  const res = validateSnapshot(rowsOf(
    drug('Pembrolizumab', { id: 166 }), drug('Abciximab', { id: 1 }), drug('Meropenem', { id: 10 }),
  ), 3);

  assert.deepEqual(res.drugs.map((d) => d.id), [1, 10, 166], 'numeric, not lexicographic: 10 before 166');
});

test('does not let digit-prefixed names jump to the top of the list', () => {
  // js/index.js renders DRUGS in array order, so sorting by name would move
  // "20% Mannitol" (id 144) ahead of Abciximab (id 1) on the app's first page.
  const res = validateSnapshot(rowsOf(
    drug('Abciximab', { id: 1 }), drug('20% Mannitol', { id: 144 }),
  ), 2);

  assert.deepEqual(res.drugs.map((d) => d.generic), ['Abciximab', '20% Mannitol']);
});

test('refreshing with unchanged data reproduces the committed snapshot exactly', () => {
  const committed = require('../drugs-data.json');
  const res = validateSnapshot(committed.map((d) => ({ data: d })), committed.length);

  assert.equal(res.ok, true);
  assert.deepEqual(res.drugs, committed,
    'a refresh that changes nothing must not reorder or reshape the file');
});

test('rows with an unusable id sort last rather than corrupting the order', () => {
  const res = validateSnapshot(rowsOf(
    drug('Odd', { id: null }), drug('Abciximab', { id: 1 }),
  ), 2);

  assert.deepEqual(res.drugs.map((d) => d.generic), ['Abciximab', 'Odd']);
});

test('accepts bare drug objects as well as wrapped rows', () => {
  const res = validateSnapshot([drug('Abciximab'), drug('Acyclovir')], 2);

  assert.equal(res.ok, true);
  assert.deepEqual(res.drugs.map((d) => d.generic), ['Abciximab', 'Acyclovir']);
});

test('keeps the clinical fields intact', () => {
  const full = drug('Abciximab', {
    had: true, ed: 'N', categories: ['cardiovascular'],
    reconst: { solvent: 'NSS' }, monitoring: ['Platelet'],
  });
  const res = validateSnapshot(rowsOf(full), 1);

  assert.deepEqual(res.drugs[0].reconst, { solvent: 'NSS' });
  assert.deepEqual(res.drugs[0].categories, ['cardiovascular']);
  assert.equal(res.drugs[0].had, true);
});

test('strips edit history and editor identity from the public artifact', () => {
  const res = validateSnapshot(rowsOf(drug('Abciximab', {
    previousData: { had: true }, createdBy: 'someone@example.com',
    updatedBy: 'someone@example.com', updatedAt: '2026-07-27T00:00:00Z',
  })), 1);

  const keys = Object.keys(res.drugs[0]);
  ['previousData', 'createdBy', 'updatedBy', 'updatedAt'].forEach((k) => {
    assert.ok(!keys.includes(k), `${k} must not ship in drugs-data.json`);
  });
  assert.equal(res.drugs[0].generic, 'Abciximab');
});

// ── Refusing bad data (the committed snapshot survives) ──────────────────────

test('refuses a truncated response instead of shrinking the drug list', () => {
  const rows = rowsOf(...Array.from({ length: 100 }, (_, i) => drug('Drug ' + i)));
  const res = validateSnapshot(rows, 166);

  assert.equal(res.ok, false);
  assert.match(res.reason, /only 100 drugs vs 166/);
});

test('allows a small real shrink above the floor', () => {
  const rows = rowsOf(...Array.from({ length: 160 }, (_, i) => drug('Drug ' + i)));
  const res = validateSnapshot(rows, 166);

  assert.equal(res.ok, true, '160 of 166 is a plausible edit, not a truncation');
});

test('refuses an empty response', () => {
  assert.equal(validateSnapshot([], 166).ok, false);
});

test('refuses a non-array response', () => {
  assert.equal(validateSnapshot({ message: 'JWT expired' }, 166).ok, false);
  assert.equal(validateSnapshot(null, 166).ok, false);
});

test('refuses a response whose rows carry no usable drug', () => {
  const res = validateSnapshot([{ data: null }, { data: { generic: '  ' } }, {}], 166);

  assert.equal(res.ok, false);
  assert.match(res.reason, /no usable drug objects/);
});

test('drops individual unusable rows but reports them', () => {
  const rows = [{ data: drug('Abciximab') }, { data: { id: 2 } }, { data: drug('Vancomycin') }];
  const res = validateSnapshot(rows, 2);

  assert.equal(res.ok, true);
  assert.equal(res.dropped, 1);
  assert.deepEqual(res.drugs.map((d) => d.generic), ['Abciximab', 'Vancomycin']);
});

test('skips the floor check when there is no baseline to compare against', () => {
  assert.equal(validateSnapshot(rowsOf(drug('Abciximab')), 0).ok, true);
});

// ── Fetching ────────────────────────────────────────────────────────────────

test('reads approved drugs only, with the publishable key attached', async () => {
  let seenUrl = null, seenHeaders = null;
  await fetchApprovedDrugs({
    fetch: async (url, opts) => {
      seenUrl = url; seenHeaders = opts.headers;
      return { ok: true, json: async () => [] };
    },
  });

  assert.match(seenUrl, /status=eq\.approved/);
  assert.equal(seenUrl, DEFAULT_ENDPOINT);
  assert.match(seenHeaders.apikey, /^sb_publishable_/);
  assert.match(seenHeaders.Authorization, /^Bearer sb_publishable_/);
});

test('reports an HTTP error rather than throwing', async () => {
  const res = await fetchApprovedDrugs({ fetch: async () => ({ ok: false, status: 503 }) });

  assert.equal(res.ok, false);
  assert.match(res.reason, /HTTP 503/);
});

test('reports a network failure rather than throwing', async () => {
  const res = await fetchApprovedDrugs({
    fetch: async () => { throw new Error('getaddrinfo ENOTFOUND'); },
  });

  assert.equal(res.ok, false);
  assert.match(res.reason, /ENOTFOUND/);
});

test('gives up on a hung request so an offline build still finishes', async () => {
  const res = await fetchApprovedDrugs({
    timeoutMs: 20,
    fetch: (url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
      });
    }),
  });

  assert.equal(res.ok, false);
  assert.match(res.reason, /timed out/);
});

test('a failed fetch never yields drugs for the build to write', async () => {
  const res = await fetchApprovedDrugs({ fetch: async () => ({ ok: false, status: 500 }) });

  assert.equal(res.ok, false);
  assert.equal(res.drugs, undefined, 'build.js writes only when ok is true');
});
