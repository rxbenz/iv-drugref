'use strict';
// ============================================================
// Drug list freshness — the snapshot must never suppress the sync
//
// Regression cover for v5.70.0. initDrugs() (minified line-7 blob) renders from
// cache → drugs-data.json, stamps `drugData_v4_ts`, and only then syncs from
// Supabase IF that stamp is older than 30 minutes. Loading the committed
// snapshot therefore marked the data "just synced" and skipped the sync — and
// because build.js clears the drug cache on every deploy (drugCacheVer), that
// was the path taken after each deploy. The app served month-old bundled data
// (a drug un-flagged as HIGH-ALERT in the admin panel still showed HAD) while
// the correct data sat in Supabase.
//
// The guard in js/index.js back-dates the stamp for snapshot loads only. These
// tests run the REAL guard: the IIFE is sliced out of js/index.js by its tag.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'index.js'), 'utf8');
const TAG = '[snapshot-freshness-guard]';

/** Slice the tagged IIFE out of the page script. */
function guardSource() {
  const tag = SRC.indexOf(TAG);
  assert.ok(tag > 0, `${TAG} marker missing from js/index.js`);
  const start = SRC.indexOf('(function () {', tag);
  const end = SRC.indexOf('})();', start);
  assert.ok(start > 0 && end > start, 'could not slice the guard IIFE');
  return SRC.slice(start, end + '})();'.length);
}

/**
 * Fresh sandbox with the two globals the guard wraps, plus a localStorage stub.
 * `snapshot` / `server` decide what the wrapped loader returns.
 */
function setup({ snapshot = [{ generic: 'Abciximab' }] } = {}) {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const calls = { saved: [] };

  const sandbox = { console, localStorage };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  // Stand-ins for the minified originals.
  sandbox.fetchDrugsFromLocalFile = async () => snapshot;
  sandbox.saveDrugsToCache = (list) => {
    calls.saved.push(list);
    localStorage.setItem('drugData_v4', JSON.stringify(list));
    localStorage.setItem('drugData_v4_ts', String(NOW));
  };

  vm.createContext(sandbox);
  vm.runInContext(guardSource(), sandbox, { filename: 'index.js#guard' });
  return { sandbox, localStorage, calls };
}

const NOW = 1750000000000; // fixed "now" — the stamp a real sync would write

/** What initDrugs() computes: a stamp older than 30 min means "go sync". */
const wouldSync = (ls) => NOW - parseInt(ls.getItem('drugData_v4_ts') || '0', 10) > 1800000;

test('loading the bundled snapshot leaves the cache marked stale, so the sync runs', async () => {
  const { sandbox, localStorage } = setup();

  const data = await sandbox.fetchDrugsFromLocalFile();
  sandbox.saveDrugsToCache(data);

  assert.equal(localStorage.getItem('drugData_v4_ts'), '0');
  assert.ok(wouldSync(localStorage), 'initDrugs must proceed to the Supabase sync');
});

test('the snapshot is still cached for offline/first paint', async () => {
  const { sandbox, localStorage, calls } = setup();

  const data = await sandbox.fetchDrugsFromLocalFile();
  sandbox.saveDrugsToCache(data);

  assert.equal(calls.saved.length, 1, 'the original saveDrugsToCache still runs');
  assert.deepEqual(JSON.parse(localStorage.getItem('drugData_v4')), [{ generic: 'Abciximab' }]);
});

test('a server sync stamps normally — the 30-minute interval is unchanged', () => {
  const { sandbox, localStorage } = setup();

  // No snapshot load preceded this: this is the fetchDrugsFromServer path.
  sandbox.saveDrugsToCache([{ generic: 'Abciximab' }]);

  assert.equal(localStorage.getItem('drugData_v4_ts'), String(NOW));
  assert.equal(wouldSync(localStorage), false, 'a fresh server sync must not re-sync');
});

test('the stale mark applies once, not to the sync that follows it', async () => {
  const { sandbox, localStorage } = setup();

  const snap = await sandbox.fetchDrugsFromLocalFile();
  sandbox.saveDrugsToCache(snap);              // snapshot → stamped stale
  assert.equal(localStorage.getItem('drugData_v4_ts'), '0');

  sandbox.saveDrugsToCache([{ generic: 'Fresh' }]);  // server data → stamped fresh
  assert.equal(localStorage.getItem('drugData_v4_ts'), String(NOW));
  assert.equal(wouldSync(localStorage), false);
});

test('an empty/failed snapshot fetch does not mark anything stale', async () => {
  const { sandbox, localStorage } = setup({ snapshot: null });

  const data = await sandbox.fetchDrugsFromLocalFile();
  assert.equal(data, null);

  sandbox.saveDrugsToCache([{ generic: 'FromServer' }]);
  assert.equal(localStorage.getItem('drugData_v4_ts'), String(NOW));
});
