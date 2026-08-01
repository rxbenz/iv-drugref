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

  window.__liffReady = new Promise(function (resolve) {
    var done = false;
    var finish = function (v) { if (!done) { done = true; resolve(v); } };
    // Never let a slow/blocked CDN hang a share tap — fall back instead.
    setTimeout(function () { finish(null); }, 6000);

    var s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onerror = function () { finish(null); };
    s.onload = function () {
      if (!window.liff) { finish(null); return; }
      try {
        window.liff.init({ liffId: LIFF_ID })
          .then(function () { finish(window.liff); })
          .catch(function () { finish(null); });
      } catch (e) { finish(null); }
    };
    (document.head || document.documentElement).appendChild(s);
  });
})();
