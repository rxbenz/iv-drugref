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
                liff = null, openBlocked = false, clipboardOk = true,
                search = '', diag = undefined } = {}) {
  const events = [];      // analytics
  const toasts = [];
  const opened = [];
  const created = [];     // every createElement — the toast is in here
  let copied = null;

  const el = () => new Proxy({ style: {}, classList: { add() {}, remove() {} }, remove() {},
    appendChild(c) { return c; }, addEventListener() {}, focus() {}, select() {}, setAttribute() {} },
    { get(t, p) { return p in t ? t[p] : function () { return el(); }; }, set(t, p, v) { t[p] = v; return true; } });

  const sandbox = {
    location: { search },
    document: { createElement: () => { const e = el(); created.push(e); return e; },
      getElementById: () => null, body: el(), head: el(),
      querySelector: () => null, addEventListener() {},
      execCommand: () => { copied = 'execCommand'; return clipboardOk; } },
    navigator: {
      userAgent: ua,
      clipboard: { writeText: (t) => (clipboardOk ? (copied = t, Promise.resolve()) : Promise.reject(new Error('denied'))) },
    },
    window: {
      __liffReady: Promise.resolve(liff),
      __liffDiag: diag,
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
  const toastText = () => {
    const t = created.filter((e) => e.id === 'ivdr-toast').pop();
    return t && t.textContent;
  };
  return { api, events, toasts, opened, copied: () => copied, toastText, sandbox };
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

// ── telling the three fallbacks apart ────────────────────────────────────────
// A blocked SDK, a failed init and a missing chat_message.write scope all end as
// the same clipboard toast but need three different fixes, so the cause has to
// reach analytics — and, under ?liffdebug=1, the tester's screen.

const reason = (events) => {
  const e = events.filter((x) => x.action === 'share_line').pop();
  return e && e.reason;
};

test('no SDK at all is reported as no_sdk, not just "clipboard"', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: null });
  t.api.shareToLine('x', { page: 'calculator' });
  await settle();
  assert.strictEqual(method(t.events), 'clipboard');
  assert.strictEqual(reason(t.events), 'no_sdk');
});

test('SDK present but picker unavailable is reported as no_picker', async () => {
  // A real SDK whose picker refuses — not one missing the method, which is a
  // different fault (no_sdk) and has its own test below.
  const t = load({ ua: 'iPhone', inLine: true,
    liff: { isApiAvailable: () => false, shareTargetPicker: () => Promise.reject(new Error('nope')) } });
  t.api.shareToLine('x', { page: 'calculator' });
  await settle();
  assert.strictEqual(reason(t.events), 'no_picker');
});

test('a throwing picker is reported as picker_error', async () => {
  const t = load({ ua: 'iPhone', inLine: true,
    liff: { isApiAvailable: () => true, shareTargetPicker: () => Promise.reject(new Error('nope')) } });
  t.api.shareToLine('x', { page: 'calculator' });
  await settle();
  assert.strictEqual(reason(t.events), 'picker_error');
});

test('desktop clipboard carries no reason — nothing went wrong there', async () => {
  const t = load({ ua: 'Macintosh' });
  t.api.shareToLine('x', {});
  await settle();
  assert.strictEqual(method(t.events), 'clipboard');
  assert.strictEqual(reason(t.events), undefined);
});

test('without the debug flag the toast is the ordinary Thai one', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: null, diag: { sdk: 'timeout', init: null, picker: null, csp: [] } });
  t.api.shareToLine('x', {});
  await settle();
  assert.match(t.toastText(), /LINE/);
  assert.ok(!/sdk=/.test(t.toastText()), 'no diagnostics leak to real users');
});

test('?liffdebug=1 shows the cause instead of the toast', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: null, search: '?liffdebug=1',
    diag: { sdk: 'loaded', init: 'ok', picker: false, csp: [] } });
  t.api.shareToLine('x', {});
  await settle();
  assert.match(t.toastText(), /sdk=loaded/);
  assert.match(t.toastText(), /init=ok/);
  assert.match(t.toastText(), /picker=false/);
});

test('a CSP block shows up in the debug readout', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: null, search: '?a=1&liffdebug=1',
    diag: { sdk: 'error', init: null, picker: null, csp: ['script-src←https://static.line-scdn.net'] } });
  t.api.shareToLine('x', {});
  await settle();
  assert.match(t.toastText(), /CSP/);
  assert.match(t.toastText(), /line-scdn/);
});

test('debug mode still copies to the clipboard — diagnosis never costs the share', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: null, search: '?liffdebug=1' });
  t.api.shareToLine('AUC 450', {});
  await settle();
  assert.strictEqual(t.copied(), 'AUC 450');
  assert.strictEqual(method(t.events), 'clipboard');
});

// ── asking for the grant the user never gave ─────────────────────────────────
// Configuring chat_message.write on the LIFF app is not the same as the USER
// having granted it, and an account authorised before the scope was added is
// never re-prompted on its own. The button asks — once — and retries.

/** A liff stub whose picker only turns on after the permission is granted. */
function liffNeedingGrant({ state = 'prompt', accept = true, hasApi = true } = {}) {
  const calls = { requestAll: 0 };
  let granted = state === 'granted';
  const liff = {
    calls,
    isApiAvailable: () => granted,
    shareTargetPicker: () => (granted
      ? Promise.resolve({ status: 'success' })
      : Promise.reject(new Error('unavailable'))),
  };
  if (hasApi) {
    liff.permission = {
      query: () => Promise.resolve({ state: granted ? 'granted' : state }),
      requestAll: () => { calls.requestAll++; if (accept) granted = true; return Promise.resolve(); },
    };
  }
  return liff;
}

test('picker off + grant pending -> asks, then shares for real', async () => {
  const liff = liffNeedingGrant();
  const t = load({ ua: 'iPhone', inLine: true, liff });
  t.api.shareToLine('AUC 450', { page: 'vanco-tdm' });
  await settle();
  assert.strictEqual(liff.calls.requestAll, 1, 'asked once');
  assert.strictEqual(method(t.events), 'liff_picker', 'and the share actually went out');
});

test('a declined grant falls back to the clipboard, tagged no_grant', async () => {
  const liff = liffNeedingGrant({ accept: false });
  const t = load({ ua: 'iPhone', inLine: true, liff });
  t.api.shareToLine('AUC 450', {});
  await settle();
  assert.strictEqual(liff.calls.requestAll, 1);
  assert.strictEqual(t.copied(), 'AUC 450');
  assert.strictEqual(reason(t.events), 'no_grant');
});

test('never prompts when there is nothing to prompt for', async () => {
  // state 'unavailable' = the scope is not on the LIFF app at all; asking the
  // user cannot fix that, and a prompt on every tap would be pure nagging.
  const liff = liffNeedingGrant({ state: 'unavailable' });
  const t = load({ ua: 'iPhone', inLine: true, liff });
  t.api.shareToLine('x', {});
  await settle();
  assert.strictEqual(liff.calls.requestAll, 0);
  assert.strictEqual(reason(t.events), 'no_picker');
});

test('an older SDK with no permission API still just copies', async () => {
  const liff = liffNeedingGrant({ hasApi: false });
  const t = load({ ua: 'iPhone', inLine: true, liff });
  t.api.shareToLine('x', {});
  await settle();
  assert.strictEqual(reason(t.events), 'no_picker');
  assert.strictEqual(method(t.events), 'clipboard');
});

test('a picker that is already available is shared without any prompt', async () => {
  const liff = liffNeedingGrant({ state: 'granted' });
  const t = load({ ua: 'iPhone', inLine: true, liff });
  t.api.shareToLine('x', {});
  await settle();
  assert.strictEqual(liff.calls.requestAll, 0, 'no permission round-trip when it already works');
  assert.strictEqual(method(t.events), 'liff_picker');
});

test('debug readout carries the LIFF-browser and grant states', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: null, search: '?liffdebug=1',
    diag: { sdk: 'loaded', init: 'ok', inClient: true, picker: false, perm: 'prompt', csp: [] } });
  t.api.shareToLine('x', {});
  await settle();
  assert.match(t.toastText(), /inClient=true/);
  assert.match(t.toastText(), /perm=prompt/);
});

// ── isApiAvailable is advisory, not authoritative ────────────────────────────
// On device it reported false with inClient=true and perm=granted — every
// documented condition met. Trusting it there costs a share that would have
// worked, so the call is attempted anyway and failure lands where the flag
// would have left us: the clipboard.

test('picker works even though isApiAvailable says it does not', async () => {
  const liff = {
    isApiAvailable: () => false,
    shareTargetPicker: () => Promise.resolve({ status: 'success' }),
  };
  const t = load({ ua: 'iPhone', inLine: true, liff });
  t.api.shareToLine('AUC 450', { page: 'calculator' });
  await settle();
  assert.strictEqual(method(t.events), 'liff_picker', 'shared instead of believing the flag');
});

test('a genuinely unavailable picker still just copies, and records why', async () => {
  const err = new Error('shareTargetPicker is not available');
  err.code = 'FORBIDDEN';
  const t = load({ ua: 'iPhone', inLine: true, search: '?liffdebug=1',
    diag: { sdk: 'loaded', init: 'ok', inClient: true, picker: false, perm: 'granted', csp: [] },
    liff: { isApiAvailable: () => false, shareTargetPicker: () => Promise.reject(err) } });
  t.api.shareToLine('AUC 450', {});
  await settle();
  assert.strictEqual(t.copied(), 'AUC 450');
  assert.strictEqual(method(t.events), 'clipboard');
  assert.match(t.toastText(), /pickErr=FORBIDDEN/, 'the real error is reported, not guessed at');
});

test('a picker that throws synchronously is caught too', async () => {
  const t = load({ ua: 'iPhone', inLine: true,
    liff: { isApiAvailable: () => true, shareTargetPicker: () => { throw new Error('boom'); } } });
  t.api.shareToLine('x', {});
  await settle();
  assert.strictEqual(method(t.events), 'clipboard');
  assert.strictEqual(reason(t.events), 'picker_error');
});

test('an SDK without shareTargetPicker at all is no_sdk', async () => {
  const t = load({ ua: 'iPhone', inLine: true, liff: { isApiAvailable: () => false } });
  t.api.shareToLine('x', {});
  await settle();
  assert.strictEqual(reason(t.events), 'no_sdk');
});

test('debug readout names the launch context, not just "inside LINE"', async () => {
  // isInClient() is true in the plain in-app browser too, where the picker can
  // never work — ctx is what separates a real LIFF launch from that.
  const t = load({ ua: 'iPhone', inLine: true, liff: null, search: '?liffdebug=1',
    diag: { sdk: 'loaded', init: 'ok', inClient: true, ctx: 'none', picker: false,
            perm: 'granted', csp: [], pickErr: 'FORBIDDEN' } });
  t.api.shareToLine('x', {});
  await settle();
  assert.match(t.toastText(), /ctx=none/);
  assert.match(t.toastText(), /pickErr=FORBIDDEN/);
});
