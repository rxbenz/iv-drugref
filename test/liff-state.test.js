'use strict';
// ============================================================
// LIFF sub-path forwarding (js/core.js)
//
// A rich-menu button pointed at https://liff.line.me/<id>/calculator.html opens
// the LIFF app's Endpoint URL (our index) with ?liff.state=%2Fcalculator.html and
// expects the page to forward itself. Without this the button just showed the
// drug list — which is what happened on the first LIFF rollout attempt.
//
// liff.state is attacker-controllable (it is in the URL), so the forwarding must
// only ever go somewhere on our own origin, and must never loop.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');
// Only the IIFE — the trailers (ThemeManager etc.) touch the DOM at load.
const CORE = SRC.slice(0, SRC.indexOf('THEME MANAGER'));

const ENDPOINT = 'https://rxbenz.github.io/iv-drugref/index.html';

/**
 * Load core.js with a stub location and report where it tried to send us.
 * `opts.bridge` mimics liff-bridge.js having set window.__liffBridge first.
 * `out.rewritten` collects history.replaceState targets, `out.runTimers()` fires
 * whatever core.js scheduled (the SDK-never-arrived fallback lives in there).
 */
function forwardFrom(href, out, opts) {
  const replaced = [];
  const rewritten = [];
  const timers = [];
  const url = new URL(href);
  const el = () => new Proxy({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    innerHTML: '', textContent: '', appendChild(c) { return c; }, addEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null, remove() {} },
    { get(t, p) { return p in t ? t[p] : function () { return el(); }; }, set(t, p, v) { t[p] = v; return true; } });

  const location = {
    href: url.href, search: url.search, origin: url.origin,
    pathname: url.pathname, hash: url.hash,
    replace: (u) => replaced.push(u),
    reload() {},
  };
  const sandbox = {
    location, URL, URLSearchParams, console,
    history: { replaceState: (_s, _t, u) => rewritten.push(u) },
    window: { location, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: el, addEventListener() {}, body: el(), head: el(), documentElement: el(), readyState: 'complete' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: (function () {
      const m = new Map();
      return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
    })(),
    navigator: { onLine: true, userAgent: 'node-test' },
    fetch: () => new Promise(() => {}),
    // Recorded, not run: the fallback is on a 4s timer and the test drives it.
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout() {}, setInterval: () => 0, clearInterval,
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  if (opts && opts.bridge) sandbox.window.__liffBridge = true;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CORE, sandbox, { filename: 'core.js' });
  if (out) {
    out.rewritten = rewritten;
    out.timers = timers;
    // core.js schedules unrelated work at load too; each one is independent.
    out.runTimers = () => timers.forEach((t) => { try { t.fn(); } catch (e) {} });
  }
  return replaced;
}

test('forwards to the requested page under the app directory', () => {
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/calculator.html'));
  assert.strictEqual(to.length, 1);
  assert.strictEqual(to[0], 'https://rxbenz.github.io/iv-drugref/calculator.html');
});

test('keeps the query string, so bot deep links still land on the right drug', () => {
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/index.html?drug=Vancomycin'));
  assert.strictEqual(to[0], 'https://rxbenz.github.io/iv-drugref/index.html?drug=Vancomycin');
});

test('resolves under /iv-drugref/, not the origin root (which would 404)', () => {
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/tdm.html'));
  assert.ok(to[0].startsWith('https://rxbenz.github.io/iv-drugref/'), to[0]);
});

test('does nothing without liff.state — normal visits are untouched', () => {
  assert.strictEqual(forwardFrom(ENDPOINT).length, 0);
  assert.strictEqual(forwardFrom(ENDPOINT + '?drug=Vancomycin').length, 0);
});

test('rejects an absolute URL (open redirect)', () => {
  assert.strictEqual(forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('https://evil.example/steal')).length, 0);
});

test('rejects a protocol-relative URL (open redirect)', () => {
  assert.strictEqual(forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('//evil.example/steal')).length, 0);
});

test('rejects a javascript: payload', () => {
  assert.strictEqual(forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('javascript:alert(1)')).length, 0);
});

test('never forwards to the page it is already on (no reload loop)', () => {
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/index.html'));
  // resolves to .../index.html, which differs from the current href only by the
  // query — so if it ever resolved identically it must not redirect
  to.forEach((u) => assert.notStrictEqual(u, ENDPOINT + '?liff.state=' + encodeURIComponent('/index.html')));
});

test('already on the requested page → does NOT forward (the reload loop)', () => {
  // What LINE actually does: it keeps re-attaching ?liff.state to the page it
  // landed on. Comparing full hrefs saw "different URL" every time and forwarded
  // again, so calculator.html reloaded forever. Comparing paths ends it.
  const here = 'https://rxbenz.github.io/iv-drugref/calculator.html';
  const to = forwardFrom(here + '?liff.state=' + encodeURIComponent('/calculator.html'));
  assert.strictEqual(to.length, 0, 'no forward — we are already on that page');
});

test('same page with an extra query is still not a forward', () => {
  const here = 'https://rxbenz.github.io/iv-drugref/index.html';
  const to = forwardFrom(here + '?drug=Vanco&liff.state=' + encodeURIComponent('/index.html?drug=Vanco'));
  assert.strictEqual(to.length, 0);
});

test('when it does not forward, liff.state is stripped in place (SDK must not retry it)', () => {
  const out = {};
  const here = 'https://rxbenz.github.io/iv-drugref/calculator.html';
  const to = forwardFrom(here + '?liff.state=' + encodeURIComponent('/calculator.html'), out);
  assert.strictEqual(to.length, 0, 'no navigation');
  assert.deepStrictEqual(out.rewritten, [here], 'URL rewritten without liff.state');
});

test('stripping keeps the page own query intact', () => {
  const out = {};
  const here = 'https://rxbenz.github.io/iv-drugref/index.html';
  forwardFrom(here + '?drug=Vanco&liff.state=' + encodeURIComponent('/index.html?drug=Vanco'), out);
  assert.deepStrictEqual(out.rewritten, [here + '?drug=Vanco']);
});

// ── standing down for the LIFF SDK ───────────────────────────────────────────
// Forwarding ourselves discards the LIFF session LINE just granted: liff.init()
// on the destination then finds no context, returns to liff.line.me for one
// ("logging in…"), which sends us back to the endpoint — a bounce loop. Where
// the SDK is present it owns the hop.

test('stands down when liff-bridge is on the page (SDK owns the hop)', () => {
  const out = {};
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/calculator.html'), out, { bridge: true });
  assert.strictEqual(to.length, 0, 'no navigation — liff.init() does it');
});

test('…but still forwards if the SDK never arrives (blocked CDN)', () => {
  const out = {};
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/calculator.html'), out, { bridge: true });
  assert.ok(out.timers.some((t) => t.ms >= 1000), 'the fallback waits out a grace period');
  out.runTimers();
  assert.deepStrictEqual(to, ['https://rxbenz.github.io/iv-drugref/calculator.html']);
});

test('with the SDK present, liff.state is NOT stripped — the SDK reads it', () => {
  const out = {};
  const here = 'https://rxbenz.github.io/iv-drugref/calculator.html';
  const to = forwardFrom(here + '?liff.state=' + encodeURIComponent('/calculator.html'), out, { bridge: true });
  assert.strictEqual(to.length, 0);
  assert.deepStrictEqual(out.rewritten, [], 'left intact for liff.init()');
});

// ── carrying the login round-trip ────────────────────────────────────────────

test('other query params ride along (LINE leaves code/state on the endpoint)', () => {
  const to = forwardFrom(ENDPOINT + '?code=AbC123&state=xyz&liff.state=' + encodeURIComponent('/calculator.html'));
  const u = new URL(to[0]);
  assert.strictEqual(u.pathname, '/iv-drugref/calculator.html');
  assert.strictEqual(u.searchParams.get('code'), 'AbC123');
  assert.strictEqual(u.searchParams.get('state'), 'xyz');
  assert.strictEqual(u.searchParams.get('liff.state'), null, 'never carried — that is the loop');
});

test('liff.state own params win over carried ones', () => {
  const to = forwardFrom(ENDPOINT + '?drug=Aspirin&liff.state=' + encodeURIComponent('/index.html?drug=Vancomycin'));
  const u = new URL(to[0]);
  assert.deepStrictEqual(u.searchParams.getAll('drug'), ['Vancomycin']);
});

test('a real forward does not also rewrite history', () => {
  const out = {};
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/calculator.html'), out);
  assert.strictEqual(to.length, 1);
  assert.deepStrictEqual(out.rewritten, []);
});
