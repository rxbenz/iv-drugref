'use strict';
// ============================================================
// POST routing (gas-complete.js) — large writes must reach their handler
//
// js/admin.js sends a write as a GET with the payload in the query string, but
// switches to POST once that URL would exceed ~6 KB — which a drug record with
// long Thai precautions does. doPost knew only the bulk/allergy actions, so a
// large drug edit fell through to the analytics switch and was filed as a
// Sessions row: the drug was never written, and the client (sending no-cors,
// unable to read the reply) reported success anyway.
//
// doGet and doPost now share routeApiAction(), so the two verbs cannot drift.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGas, HUMAN_HEADERS } = require('./helpers/load-gas');

const USER = 'admin@test.local';
const ID = 1001;

function sheet(overrides = {}) {
  const cells = Object.assign({
    'ID': ID, 'Generic Name': 'Abciximab', 'HAD': true,
    'Categories': 'cardiovascular', 'status': 'approved',
  }, overrides);
  return loadGas({
    drugSheetRows: [HUMAN_HEADERS.slice(), HUMAN_HEADERS.map((h) => (h in cells ? cells[h] : ''))],
  });
}

/** A POST as js/admin.js sends it: action + user in the query, payload in the body. */
const postEvent = (action, payload) => ({
  parameter: { action, user: USER },
  postData: { contents: JSON.stringify(payload) },
});

/** An analytics POST: no action in the query, event fields in the body. */
const analyticsEvent = (payload) => ({ parameter: {}, postData: { contents: JSON.stringify(payload) } });

const colOf = (name) => HUMAN_HEADERS.indexOf(name);

// ── The reported gap ────────────────────────────────────────────────────────

test('a drug edit sent by POST actually updates the drug', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doPost(postEvent('updateDrug', {
    id: ID, generic: 'Abciximab', had: false, precautions: 'ระวังเลือดออก',
  })));

  assert.equal(res.success, true);
  assert.equal(g.drugSheet.rows[1][colOf('HAD')], false, 'the POST path must write, not log');
  assert.equal(g.drugSheet.rows[1][colOf('Precautions')], 'ระวังเลือดออก');
});

test('the POST reply carries the same written/skipped detail as the GET path', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doPost(postEvent('updateDrug', {
    id: ID, generic: 'Abciximab', notAColumn: 'x',
  })));

  assert.deepEqual(res.written, ['generic']);
  assert.deepEqual(res.skipped, ['notAColumn']);
});

test('a large drug edit is never filed as an analytics row', () => {
  const g = sheet();
  g.sandbox.doPost(postEvent('updateDrug', { id: ID, generic: 'Abciximab', had: false }));

  assert.equal(g.sandbox.SHEETS.SESSIONS, 'Sessions');
  assert.ok(!g.sandbox.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions'),
    'the old code logged the edit to Sessions instead of saving it');
});

test('createDrug works over POST too', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doPost(postEvent('createDrug', {
    generic: 'Test Drug', had: true, status: 'draft',
  })));

  assert.equal(res.success, true);
  assert.equal(g.drugSheet.rows.length, 3);
  assert.equal(g.drugSheet.rows[2][colOf('Generic Name')], 'Test Drug');
});

test('approveDrug works over POST too', () => {
  const g = sheet({ status: 'pending' });   // must actually change, not start there
  g.sandbox.doPost(postEvent('approveDrug', { id: ID }));

  assert.equal(g.drugSheet.rows[1][colOf('status')], 'approved');
});

// ── Analytics must keep working ─────────────────────────────────────────────

test('an analytics event still reaches the analytics logger', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doPost(analyticsEvent({ type: 'SEARCH', query: 'vanco' })));

  assert.equal(res.success, true);
  assert.ok(g.sandbox.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Searches'),
    'SEARCH must still be logged');
  assert.equal(g.drugSheet.rows.length, 2, 'no drug row may be touched');
});

test('an analytics event carrying its own `action` never reaches an API handler', () => {
  const g = sheet();
  // QUICK_ACTION events send {type, action:…}; `type` marks them as analytics.
  g.sandbox.doPost(analyticsEvent({ type: 'QUICK_ACTION', action: 'updateDrug', id: ID, had: false }));

  assert.equal(g.drugSheet.rows[1][colOf('HAD')], true, 'the drug must be untouched');
});

test('an unknown POST with no type still falls through to the generic log', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doPost(postEvent('somethingUnknown', { foo: 'bar' })));

  assert.equal(res.success, true, 'unknown POSTs are logged, not rejected');
  assert.equal(g.drugSheet.rows.length, 2);
});

// ── doGet keeps its behaviour ───────────────────────────────────────────────

test('doGet still routes writes through the shared table', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doGet({
    parameter: { action: 'updateDrug', user: USER, data: JSON.stringify({ id: ID, had: false }) },
  }));

  assert.equal(res.success, true);
  assert.equal(g.drugSheet.rows[1][colOf('HAD')], false);
});

test('doGet still reports an unknown action', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doGet({ parameter: { action: 'nope', user: USER } }));

  assert.equal(res.success, false);
  assert.match(res.error, /Unknown action/);
});

test('doGet reads its query-string arguments through the shared router', () => {
  const g = sheet();
  const res = g.json(g.sandbox.doGet({ parameter: { action: 'version' } }));

  assert.equal(res.version, g.sandbox.GAS_VERSION);
});

// ── Permission still applies on the POST path ───────────────────────────────

test('a non-admin POST is refused, not silently logged', () => {
  const g = loadGas({
    drugSheetRows: [HUMAN_HEADERS.slice(), HUMAN_HEADERS.map((h) => (h === 'ID' ? ID : ''))],
    adminUsers: [['email', 'name', 'role'], ['someone@test.local', 'Someone', 'viewer']],
  });
  const res = g.json(g.sandbox.doPost({
    parameter: { action: 'updateDrug', user: 'stranger@test.local' },
    postData: { contents: JSON.stringify({ id: ID, had: false }) },
  }));

  assert.equal(res.permissionDenied, true);
});
