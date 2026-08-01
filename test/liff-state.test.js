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

/** Load core.js with a stub location and report where it tried to send us. */
function forwardFrom(href, out) {
  const replaced = [];
  const rewritten = [];
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
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CORE, sandbox, { filename: 'core.js' });
  if (out) out.rewritten = rewritten;
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

test('a real forward does not also rewrite history', () => {
  const out = {};
  const to = forwardFrom(ENDPOINT + '?liff.state=' + encodeURIComponent('/calculator.html'), out);
  assert.strictEqual(to.length, 1);
  assert.deepStrictEqual(out.rewritten, []);
});
