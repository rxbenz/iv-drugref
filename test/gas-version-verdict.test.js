'use strict';
// ============================================================
// Backend version check (js/admin.js) — ตั้งค่า → ตรวจเวอร์ชัน
//
// The check used to compare the deployed GAS version with `===` and label ANY
// mismatch "คาดหวัง vX — ยัง deploy ไม่ครบ?". On 2026-07-27 that fired right
// after a SUCCESSFUL deploy — GAS was 5.72.0, the still-deploying web build
// expected 5.69.0 — and sent the maintainer back to the GAS editor to redo work
// that had already landed. A backend ahead of the site is the normal state
// between deploying gas-complete.js and the site's own deploy finishing.
//
// These tests run the REAL helpers, sliced out of js/admin.js by their tag.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8');

function loadVerdict() {
  const start = SRC.indexOf('// [gas-version-verdict]');
  const end = SRC.indexOf('// [/gas-version-verdict]');
  assert.ok(start > 0 && end > start, 'gas-version-verdict markers missing from js/admin.js');

  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(
    SRC.slice(start, end) + ';globalThis.compareVersions=compareVersions;' +
    'globalThis.gasVersionVerdict=gasVersionVerdict;',
    sandbox, { filename: 'admin.js#gas-version-verdict' });
  return sandbox;
}

const { compareVersions, gasVersionVerdict } = loadVerdict();
const EXPECTED = '5.72.0';

// ── The message that misled ─────────────────────────────────────────────────

test('a backend NEWER than the build expects is informational, not a warning', () => {
  // The exact state seen on 2026-07-27: GAS deployed at 5.72.0, web still 5.71.0
  // (whose EXPECTED_GAS_VERSION was 5.69.0).
  const v = gasVersionVerdict('5.69.0', '5.72.0');

  assert.equal(v.icon, 'ℹ️');
  assert.match(v.note, /ไม่ต้องทำอะไร/, 'must not send the maintainer back to the GAS editor');
  assert.doesNotMatch(v.note, /ยัง deploy ไม่ครบ/);
});

test('a backend OLDER than the build expects asks for the redeploy', () => {
  const v = gasVersionVerdict(EXPECTED, '5.69.0');

  assert.equal(v.icon, '⚠️');
  assert.match(v.note, /เก่ากว่า/);
  assert.match(v.note, /Deploy/, 'says what to do about it');
});

test('matching versions read as OK', () => {
  const v = gasVersionVerdict(EXPECTED, EXPECTED);

  assert.equal(v.icon, '✅');
  assert.equal(v.note, 'ตรงกับโค้ด');
});

// ── Failure modes ───────────────────────────────────────────────────────────

test('a fetch error is surfaced as-is', () => {
  const v = gasVersionVerdict(EXPECTED, null, 'Session expired');

  assert.equal(v.icon, '⚠️');
  assert.equal(v.note, 'Session expired');
});

test('a reply with no version is a warning, not a silent pass', () => {
  const v = gasVersionVerdict(EXPECTED, undefined);

  assert.equal(v.icon, '⚠️');
  assert.match(v.note, /ไม่มีเลขเวอร์ชัน/);
});

// ── Version comparison ──────────────────────────────────────────────────────

test('versions compare numerically, not as strings', () => {
  // The trap: "5.9.0" > "5.72.0" as strings, so a real backend at 5.9.0 would
  // have been reported as newer than one at 5.72.0.
  assert.equal(compareVersions('5.9.0', '5.72.0'), -1);
  assert.equal(compareVersions('5.72.0', '5.9.0'), 1);
  assert.equal(gasVersionVerdict('5.72.0', '5.9.0').icon, '⚠️', '5.9.0 is OLDER — must warn');
});

test('a missing patch part counts as zero', () => {
  assert.equal(compareVersions('5.72', '5.72.0'), 0);
  assert.equal(compareVersions('5.72.1', '5.72'), 1);
});

test('a leading v is ignored', () => {
  assert.equal(compareVersions('v5.72.0', '5.72.0'), 0);
  assert.equal(gasVersionVerdict('5.72.0', 'v5.72.0').icon, '✅');
});

test('a non-numeric part counts as zero instead of poisoning the compare', () => {
  assert.equal(compareVersions('5.72.x', '5.72.0'), 0);
  assert.equal(compareVersions('', ''), 0);
});
