'use strict';
// ============================================================
// Test loader — runs the REAL clinical source in a Node vm sandbox
// with browser globals stubbed, so tests exercise production code
// (js/core.js, js/vanco-tdm.js) without modifying app files.
//
// Why a sandbox: these files are browser IIFEs that touch document/
// window/localStorage at load time. We stub those, slice out the pure
// (DOM-free) clinical sections, and read back the exported objects.
//
// When ROADMAP P1.1 extracts PK_MODELS into a shared js/pk-models.js,
// loadVancoModels() can be simplified to a plain require().
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const readJs = (rel) => fs.readFileSync(path.join(ROOT, 'js', rel), 'utf8');

// ---- Minimal browser DOM/host stub (robust via Proxy no-ops) ----
function makeEl() {
  const target = {
    style: {}, dataset: {}, attributes: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: '', outerHTML: '', textContent: '', value: '', content: '',
    checked: false, disabled: false,
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    appendChild(c) { return c; }, removeChild(c) { return c; },
    append() {}, prepend() {}, after() {}, before() {}, remove() {},
    insertAdjacentHTML() {}, addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return true; }, querySelector() { return null; },
    querySelectorAll() { return []; }, closest() { return null; },
    contains() { return false; }, focus() {}, blur() {}, click() {},
    cloneNode() { return makeEl(); },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
  };
  return new Proxy(target, {
    get(t, p) { return p in t ? t[p] : function () { return makeEl(); }; },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function makeSandbox() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  const documentStub = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeEl(),
    createElementNS: () => makeEl(),
    addEventListener() {}, removeEventListener() {},
    documentElement: makeEl(), body: makeEl(), head: makeEl(),
    readyState: 'complete',
  };
  const windowStub = {
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    location: { reload() {}, href: 'http://localhost/' },
    devicePixelRatio: 1,
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage,
    navigator: { onLine: true, userAgent: 'node-test', serviceWorker: undefined },
    location: windowStub.location,
    matchMedia: windowStub.matchMedia,
    fetch: () => new Promise(() => {}),
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  sandbox.window.localStorage = localStorage;
  sandbox.window.document = documentStub;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

// ---- Load IVDrugRef (core.js) — slice to the main IIFE only ----
// (skips the ThemeManager/offline/keydown trailers that run DOM at load)
function loadCore() {
  let src = readJs('core.js');
  const cut = src.indexOf('THEME MANAGER');
  if (cut > 0) src = src.slice(0, cut);
  src += '\n;globalThis.IVDrugRef = IVDrugRef;';
  const sandbox = makeSandbox();
  vm.runInContext(src, sandbox, { filename: 'core.js' });
  if (!sandbox.IVDrugRef) throw new Error('core.js did not expose IVDrugRef');
  return { IVDrugRef: sandbox.IVDrugRef, sandbox };
}

// ---- Load the shared vanco PK models (js/pk-models.js) ----
// Post-P1.1: PK_MODELS + COLIN_MODEL live in one shared module consumed by
// both tdm.js and vanco-tdm.js, so testing it covers both pages.
function loadVancoModels() {
  const { IVDrugRef, sandbox } = loadCore();
  // pk-models.js references IVDrugRef (global) and sets window.VancoPK
  vm.runInContext(readJs('pk-models.js'), sandbox, { filename: 'pk-models.js' });
  const VancoPK = sandbox.window.VancoPK;
  if (!VancoPK) throw new Error('pk-models.js did not expose window.VancoPK');
  const byId = {};
  for (const m of VancoPK.PK_MODELS) byId[m.id] = m;
  byId.colin = VancoPK.COLIN_MODEL;
  return { models: byId, VancoPK, IVDrugRef };
}

// ---- Load the IV compatibility checker (js/compatibility.js) ----
// The whole file is one IIFE `(function(){ … })()`. We cut off the DOM trailer
// (the `document.addEventListener('click', …)` onward), export the functions
// under test, then re-close the IIFE ourselves — so only the pure data +
// matching logic runs (no DOM at load).
function loadCompatibility() {
  const { sandbox } = loadCore();
  // The drug dataset was extracted to js/compat-drugs.js (window.COMPAT_DRUGS);
  // load it first so compatibility.js's `const DRUGS = window.COMPAT_DRUGS` resolves.
  vm.runInContext(readJs('compat-drugs.js'), sandbox, { filename: 'compat-drugs.js' });
  let src = readJs('compatibility.js');
  const cut = src.indexOf("document.addEventListener('click'");
  if (cut > 0) src = src.slice(0, cut);
  src += '\n;globalThis.getCompatibility=getCompatibility;globalThis.keyCandidates=keyCandidates;globalThis.normKey=normKey;'
    + 'globalThis.renderPairDetail=renderPairDetail;globalThis.renderGroupedResults=renderGroupedResults;'
    + 'globalThis.fluidKey=fluidKey;globalThis.DRUGS=DRUGS;globalThis.rebuildCuratedMap=rebuildCuratedMap;\n})();';
  vm.runInContext(src, sandbox, { filename: 'compatibility.js' });
  if (!sandbox.getCompatibility) throw new Error('compatibility.js did not expose getCompatibility');
  return {
    getCompatibility: sandbox.getCompatibility,
    keyCandidates: sandbox.keyCandidates,
    normKey: sandbox.normKey,
    renderPairDetail: sandbox.renderPairDetail,
    renderGroupedResults: sandbox.renderGroupedResults,
    fluidKey: sandbox.fluidKey,
    DRUGS: sandbox.DRUGS,
    rebuildCuratedMap: sandbox.rebuildCuratedMap,
    sandbox,
  };
}

module.exports = { loadCore, loadVancoModels, loadCompatibility };
