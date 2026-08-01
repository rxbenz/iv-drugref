/**
 * LIFF bridge — lazily loads the LINE front-end SDK, ONLY inside LINE.
 *
 * Why lazy + conditional: every page that shares results would otherwise pull a
 * third-party script on every visit, including the ~all of them that happen in a
 * normal browser where LIFF does nothing. Guarding on IVDrugRef.isLineInApp()
 * keeps desktop/Chrome/Safari byte-for-byte as they were — no extra request, no
 * CSP surface in practice — while giving share-export.js a real share sheet when
 * the page is open in LINE.
 *
 * Exposes window.__liffReady: a Promise that ALWAYS resolves (never rejects) to
 * the liff object, or to null when LIFF is unavailable/not applicable. Callers
 * feature-detect from there; nothing here throws into the page.
 *
 * LIFF_ID is public by design (it appears in every liff.line.me link).
 */
(function () {
  'use strict';

  var LIFF_ID = '2010742553-w9T3Wtjt';
  var SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

  function inLine() {
    try {
      if (window.IVDrugRef && IVDrugRef.isLineInApp) return IVDrugRef.isLineInApp();
      return /\bLine\/\d/i.test(navigator.userAgent || '');
    } catch (e) { return false; }
  }

  if (!inLine()) { window.__liffReady = Promise.resolve(null); return; }

  // Tell core.js's liff.state forwarder to stand down: liff.init() does that hop
  // itself and keeps the LIFF session while doing it, which a hand-rolled
  // location.replace() cannot. Set synchronously — the forwarder runs the moment
  // core.js is parsed, long before the SDK below finishes loading — which is why
  // this file is loaded BEFORE core.js on every page that has it.
  window.__liffBridge = true;

  // WHY the share button fell back matters and is invisible from the outside:
  // a blocked SDK, a failed init and a missing chat_message.write scope all end
  // as the same "copied to clipboard" toast, with three different fixes. Record
  // which one happened so ?liffdebug=1 can report it (see share-export.js).
  // Costs nothing on the normal path — a few property writes, in LINE only.
  // `inClient` separates the two ways a page opens inside LINE: the LIFF browser
  // (where shareTargetPicker exists) and the plain in-app browser (where it can
  // never work). `perm` separates the scope being CONFIGURED on the LIFF app —
  // which the console shows — from the user having GRANTED it, which is a
  // different thing and the one that actually gates the picker.
  var diag = { sdk: 'loading', init: null, inClient: null, picker: null, perm: null, csp: [] };
  window.__liffDiag = diag;
  try {
    window.addEventListener('securitypolicyviolation', function (e) {
      if (diag.csp.length < 4) diag.csp.push((e.violatedDirective || '?') + '←' + (e.blockedURI || '?'));
    });
  } catch (e) {}

  window.__liffReady = new Promise(function (resolve) {
    var done = false;
    var finish = function (v) { if (!done) { done = true; resolve(v); } };
    // Never let a slow/blocked CDN hang a share tap — fall back instead.
    setTimeout(function () {
      if (diag.sdk === 'loading') diag.sdk = 'timeout';
      finish(null);
    }, 6000);

    var s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onerror = function () { diag.sdk = 'error'; finish(null); };
    s.onload = function () {
      diag.sdk = 'loaded';
      if (!window.liff) { diag.init = 'no-global'; finish(null); return; }
      try {
        window.liff.init({ liffId: LIFF_ID })
          .then(function () {
            var liff = window.liff;
            diag.init = 'ok';
            try { diag.inClient = !!(liff.isInClient && liff.isInClient()); } catch (e) { diag.inClient = 'err'; }
            try { diag.picker = !!(liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')); }
            catch (e) { diag.picker = 'err'; }
            // Grant state is async; resolve the bridge either way so a share tap
            // is never held up waiting on a diagnostic.
            try {
              if (liff.permission && liff.permission.query) {
                liff.permission.query('chat_message.write')
                  .then(function (r) { diag.perm = (r && r.state) || '?'; })
                  .catch(function () { diag.perm = 'err'; });
              } else { diag.perm = 'no-api'; }
            } catch (e) { diag.perm = 'err'; }
            finish(liff);
          })
          .catch(function (err) {
            diag.init = 'fail:' + ((err && (err.code || err.message)) || '?');
            finish(null);
          });
      } catch (e) { diag.init = 'throw:' + ((e && e.message) || '?'); finish(null); }
    };
    (document.head || document.documentElement).appendChild(s);
  });
})();
