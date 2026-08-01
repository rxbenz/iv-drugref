'use strict';
// ============================================================
// shareToLine() — progressive enhancement (Phase 7)
//
// The share button must never become a dead end. Best path first:
//   inside LINE → LIFF shareTargetPicker · mobile web → line.me share URL ·
//   desktop / anything unavailable → clipboard (the original behaviour).
//
// The cases that matter are the unhappy ones: the LIFF SDK failing to load, the
// picker being unavailable, the picker throwing, the user backing out, and a
// blocked popup — each must land on a working fallback, and a cancel must not be
// mistaken for a failure (or for a successful send).
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'share-export.js'), 'utf8');

/**
 * Load the real share-export.js IIFE with a stubbed browser.
 *   ua        – navigator.userAgent (decides mobile vs desktop)
 *   inLine    – what IVDrugRef.isLineInApp() returns
 *   liff      – value window.__liffReady resolves to (null = unavailable)
 *   openBlocked – window.open returns null (popup blocker)
 *   clipboardOk – navigator.clipboard.writeText resolves/rejects
 */
function load({ ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', inLine = false,
                liff = null, openBlocked = false, clipboardOk = true } = {}) {
  const events = [];      // analytics
  const toasts = [];
  const opened = [];
  let copied = null;

  const el = () => new Proxy({ style: {}, classList: { add() {}, remove() {} }, remove() {},
    appendChild(c) { return c; }, addEventListener() {}, focus() {}, select() {}, setAttribute() {} },
    { get(t, p) { return p in t ? t[p] : function () { return el(); }; }, set(t, p, v) { t[p] = v; return true; } });

  const sandbox = {
    document: { createElement: () => el(), getElementById: () => null, body: el(), head: el(),
      querySelector: () => null, addEventListener() {},
      execCommand: () => { copied = 'execCommand'; return clipboardOk; } },
    navigator: {
      userAgent: ua,
      clipboard: { writeText: (t) => (clipboardOk ? (copied = t, Promise.resolve()) : Promise.reject(new Error('denied'))) },
    },
    window: {
      __liffReady: Promise.resolve(liff),
      open: (url) => { opened.push(url); return openBlocked ? null : {}; },
      addEventListener() {},
    },
    setTimeout, clearTimeout, console,
    IVDrugRef: {
      isLineInApp: () => inLine,
      sendAnalytics: (d) => events.push(d),
      escHtml: (s) => String(s == null ? '' : s),
    },
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.IVDrugRef = sandbox.IVDrugRef;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'share-export.js' });

  const api = sandbox.IVDrugRef.ShareExport;
  assert.ok(api && api.shareToLine, 'share-export exposed shareToLine');
  return { api, events, toasts, opened, copied: () => copied, sandbox };
}

// analytics land asynchronously (clipboard/LIFF promises) — let them settle
const settle = () => new Promise((r) => setTimeout(r, 5));
const method = (events) => {
  const e = events.filter((x) => x.action === 'share_line').pop();
  return e && e.method;
};

test('desktop keeps the original clipboard behaviour', async () => {
  const t = load({ ua: 'Mozilla/5.0 (Macintosh) Safari/605' });
  t.api.shareToLine('AUC 450', { page: 'tdm' });
  await settle();
  assert.strictEqual(t.copied(), 'AUC 450');
  assert.strictEqual(t.opened.length, 0, 'no popup on desktop');
  assert.strictEqual(method(t.events), 'clipboard');
});

test('mobile web opens the LINE share URL with the text encoded', async () => {
  const t = load({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari' });
  t.api.shareToLine('Vanco + Heparin = ไม่เข้ากัน', { page: 'compat' });
  await settle();
  assert.strictEqual(t.opened.length, 1);
  assert.match(t.opened[0], /^https:\/\/line\.me\/R\/share\?text=/);
  assert.ok(t.opened[0].includes(encodeURIComponent('Vanco + Heparin = ไม่เข้ากัน')));
  assert.strictEqual(method(t.events), 'line_url');
});

test('a blocked popup falls back to the clipboard', async () => {
  const t = load({ ua: 'Mozilla/5.0 (iPhone) Safari', openBlocked: true });
  t.api.shareToLine('AUC 450');
  await settle();
  assert.strictEqual(t.copied(), 'AUC 450', 'text still reaches the user');
  assert.strictEqual(method(t.events), 'clipboard');
});

test('inside LINE the picker is used and reported as a real send', async () => {
  const picked = [];
  const liff = {
    isApiAvailable: (n) => n === 'shareTargetPicker',
    shareTargetPicker: (msgs) => { picked.push(msgs); return Promise.resolve({ status: 'success' }); },
  };
  const t = load({ ua: 'Mozilla/5.0 (iPhone) Line/13.5.0', inLine: true, liff });
  t.api.shareToLine('AUC 450', { page: 'vanco-tdm' });
  await settle();
  assert.strictEqual(picked.length, 1);
  // compare by value — the array is built inside the vm realm, so its prototype
  // is not reference-equal to this realm's Object/Array
  assert.strictEqual(JSON.stringify(picked[0]), JSON.stringify([{ type: 'text', text: 'AUC 450' }]));
  assert.strictEqual(method(t.events), 'liff_picker');
  assert.strictEqual(t.opened.length, 0, 'no popup — the picker handled it');
});

test('backing out of the picker is recorded as a cancel, not a failure', async () => {
  const liff = {
    isApiAvailable: () => true,
    shareTargetPicker: () => Promise.resolve(null),   // user dismissed
  };
  const t = load({ ua: 'Mozilla/5.0 (iPhone) Line/13.5.0', inLine: true, liff });
  t.api.shareToLine('AUC 450');
  await settle();
  assert.strictEqual(method(t.events), 'liff_cancelled');
  assert.strictEqual(t.copied(), null, 'no surprise clipboard write after a deliberate cancel');
});

test('LIFF unavailable in LINE (SDK blocked) falls back to the clipboard', async () => {
  const t = load({ ua: 'Mozilla/5.0 (iPhone) Line/13.5.0', inLine: true, liff: null });
  t.api.shareToLine('AUC 450');
  await settle();
  assert.strictEqual(t.copied(), 'AUC 450');
  assert.strictEqual(method(t.events), 'clipboard');
});

test('picker present but throwing still lands on the clipboard', async () => {
  const liff = {
    isApiAvailable: () => true,
    shareTargetPicker: () => Promise.reject(new Error('scope missing')),
  };
  const t = load({ ua: 'Mozilla/5.0 (Android) Line/13.4.1', inLine: true, liff });
  t.api.shareToLine('AUC 450');
  await settle();
  assert.strictEqual(t.copied(), 'AUC 450');
  assert.strictEqual(method(t.events), 'clipboard');
});

test('caller analytics are preserved alongside the method tag', async () => {
  const t = load({ ua: 'Mozilla/5.0 (Macintosh) Safari' });
  t.api.shareToLine('AUC 450', { page: 'vanco-tdm', drug: 'Vancomycin', auc: '450' });
  await settle();
  const e = t.events.filter((x) => x.action === 'share_line').pop();
  assert.strictEqual(e.page, 'vanco-tdm');
  assert.strictEqual(e.drug, 'Vancomycin');
  assert.strictEqual(e.auc, '450');
  assert.strictEqual(e.method, 'clipboard');
});
