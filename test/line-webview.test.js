'use strict';
// ============================================================
// LINE in-app WebView detection — IVDrugRef.isLineInApp(ua)
// Loads the REAL js/core.js in the vm sandbox (via load-clinical) and
// locks the UA classification used to keep the PWA safe inside LINE
// (force-update / SW-controllerchange auto-reload downgraded there).
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('./helpers/load-clinical');

const { IVDrugRef } = loadCore();

// Real LINE in-app / LIFF WebView user-agents carry a "Line/<version>" token.
const LINE_UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.5.0',
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.0.0 Mobile Safari/537.36 Line/13.4.1',
  'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Line/12.20.1 LIFF', // LIFF browser
];

// Normal browsers — including near-miss words (online/, baseline/, guideline)
// that must NOT be mistaken for the LINE app.
const NON_LINE_UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh) Safari/605.1.15 baseline/2 online/3 guideline',
  '',
];

test('isLineInApp is exported from core', () => {
  assert.strictEqual(typeof IVDrugRef.isLineInApp, 'function');
});

test('isLineInApp: true for LINE / LIFF WebView UAs', () => {
  for (const ua of LINE_UAS) {
    assert.strictEqual(IVDrugRef.isLineInApp(ua), true, `expected LINE for: ${ua}`);
  }
});

test('isLineInApp: false for normal browsers and line-like words', () => {
  for (const ua of NON_LINE_UAS) {
    assert.strictEqual(IVDrugRef.isLineInApp(ua), false, `expected non-LINE for: ${ua}`);
  }
});

test('isLineInApp: bad / missing input does not throw and returns boolean', () => {
  // In the sandbox navigator.userAgent is 'node-test', so the no-arg/nullish
  // paths fall through to it and classify as non-LINE.
  assert.strictEqual(typeof IVDrugRef.isLineInApp(), 'boolean');
  assert.strictEqual(IVDrugRef.isLineInApp(), false);
  assert.strictEqual(IVDrugRef.isLineInApp(null), false);
  assert.strictEqual(IVDrugRef.isLineInApp(undefined), false);
});
