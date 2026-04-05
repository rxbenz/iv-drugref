// ============================================================
// IV DrugRef PWA v5.1 — Share / Export Module
// Clipboard copy, LINE share, Print-to-PDF
// ============================================================

(function() {
  'use strict';

  // ---- Toast notification ----
  var toastTimer = null;
  function showToast(msg, duration) {
    duration = duration || 2200;
    var el = document.getElementById('ivdr-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ivdr-toast';
      el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
        'background:#1e293b;color:#f1f5f9;padding:10px 20px;border-radius:10px;font-size:13px;' +
        'font-weight:500;z-index:9999;opacity:0;transition:opacity .25s;pointer-events:none;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:90vw;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.style.opacity = '0'; }, duration);
  }

  // ---- Clipboard copy with fallback ----
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function() { return true; }, function() {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    return ok;
  }

  // ---- Thai date formatter (Buddhist era) ----
  function thaiDateTime() {
    var d = new Date();
    var day = String(d.getDate()).padStart(2, '0');
    var mon = String(d.getMonth() + 1).padStart(2, '0');
    var yr = d.getFullYear() + 543;
    var hr = String(d.getHours()).padStart(2, '0');
    var mn = String(d.getMinutes()).padStart(2, '0');
    return day + '/' + mon + '/' + yr + ' ' + hr + ':' + mn;
  }

  // ---- Minimal QR Code generator (Version 2, Level M, numeric/alphanumeric/byte) ----
  // Generates a QR code as a data URL image for embedding in PDF exports.
  // Supports short URLs up to ~32 alphanumeric characters (sufficient for our use case).
  var QR = (function() {
    // Pre-computed QR code for "https://rxbenz.github.io/iv-drugref/"
    // Version 3, Error Correction Level M, Byte mode
    // This avoids runtime QR encoding complexity for our single fixed URL.
    var SIZE = 29; // Version 3 = 29x29 modules
    // Encoded as rows of hex (1=black, 0=white), each row is 29 bits packed into 4 bytes (32 bits, last 3 unused)
    var DATA = [
      0xfec57bf8, 0x8284ca08, 0xba792ae8, 0xba8a52e8, 0xba3b1ae8, 0x824cf208, 0xfeaaabf8,
      0x00d9f800, 0xb774d258, 0xfddeff88, 0xab74a630, 0x60b83908, 0xbb934860, 0x44039638,
      0x9bdc90b8, 0x08220690, 0xe22ab9d0, 0x040b2970, 0x8e7fc2a0, 0x29a7c3a0, 0x5abedfe0,
      0x00f8f8f8, 0xfed2fad0, 0x82d628c8, 0xba59cfa0, 0xbaa1dcc8, 0xbaf2b928, 0x820e2850,
      0xfebabf50
    ];

    function toDataURL(cellSize) {
      cellSize = cellSize || 3;
      var margin = cellSize;
      var totalSize = SIZE * cellSize + margin * 2;
      var canvas = document.createElement('canvas');
      canvas.width = totalSize;
      canvas.height = totalSize;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, totalSize, totalSize);
      ctx.fillStyle = '#000';
      for (var r = 0; r < SIZE; r++) {
        var row = DATA[r];
        for (var c = 0; c < SIZE; c++) {
          if ((row >> (31 - c)) & 1) {
            ctx.fillRect(margin + c * cellSize, margin + r * cellSize, cellSize, cellSize);
          }
        }
      }
      return canvas.toDataURL('image/png');
    }

    return { toDataURL: toDataURL };
  })();

  // ---- Analytics helper ----
  function trackShareExport(action, extra) {
    if (typeof IVDrugRef !== 'undefined' && IVDrugRef.sendAnalytics) {
      var data = { type: 'share_export', action: action, timestamp: new Date().toISOString() };
      if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) data[k] = extra[k]; } }
      IVDrugRef.sendAnalytics(data);
    }
  }

  // ---- Public API ----

  /**
   * Copy text to clipboard + show toast + track analytics
   * @param {string} text - Plain text to copy
   * @param {object} [analytics] - Extra analytics fields {page, drug, ...}
   */
  function copyText(text, analytics) {
    copyToClipboard(text).then(function(ok) {
      showToast(ok ? '\u2705 \u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27' : '\u274c \u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
      // ✅ คัดลอกแล้ว / ❌ คัดลอกไม่สำเร็จ
    });
    trackShareExport('copy', analytics);
  }

  /**
   * Copy for LINE sharing + show LINE-specific toast
   * @param {string} text - Plain text to copy
   * @param {object} [analytics] - Extra analytics fields
   */
  function shareToLine(text, analytics) {
    copyToClipboard(text).then(function(ok) {
      showToast(ok
        ? '\u2705 \u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e27\u0e32\u0e07\u0e43\u0e19 LINE \u0e44\u0e14\u0e49\u0e40\u0e25\u0e22'
        // ✅ คัดลอกแล้ว — วางใน LINE ได้เลย
        : '\u274c \u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
    });
    trackShareExport('share_line', analytics);
  }

  /**
   * Print-to-PDF report
   * @param {object} opts
   * @param {string} opts.title - Report title
   * @param {string} opts.patientHtml - Patient info HTML
   * @param {string} opts.resultsHtml - Results HTML
   * @param {HTMLCanvasElement} [opts.chartCanvas] - Optional chart canvas to include
   * @param {object} [opts.analytics] - Extra analytics fields
   */
  function printReport(opts) {
    var area = document.getElementById('ivdr-print-area');
    if (!area) {
      area = document.createElement('div');
      area.id = 'ivdr-print-area';
      document.body.appendChild(area);
    }

    var chartImg = '';
    if (opts.chartCanvas) {
      try {
        var dataUrl = opts.chartCanvas.toDataURL('image/png');
        chartImg = '<div style="margin:16px 0;text-align:center">' +
          '<img src="' + dataUrl + '" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:6px" alt="Concentration-time curve">' +
          '</div>';
      } catch(e) {}
    }

    var ver = (typeof IVDrugRef !== 'undefined' && IVDrugRef.VERSION) ? IVDrugRef.VERSION : '5.1.0';
    var html = '<div style="font-family:sans-serif;color:#000;background:#fff;padding:24px;max-width:700px;margin:0 auto">' +
      '<h2 style="margin:0 0 4px;font-size:18px;color:#0f172a">' + (opts.title || 'IV DrugRef Report') + '</h2>' +
      '<div style="font-size:11px;color:#64748b;margin-bottom:16px">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: ' + thaiDateTime() + '</div>' +
      '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px">' +
        '<div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px">\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1c\u0e39\u0e49\u0e1b\u0e48\u0e27\u0e22</div>' +
        (opts.patientHtml || '') +
      '</div>' +
      '<div style="margin-bottom:14px">' + (opts.resultsHtml || '') + '</div>' +
      chartImg +
      '<div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:10px;display:flex;align-items:center;gap:12px">' +
        '<img src="' + QR.toDataURL(3) + '" style="width:70px;height:70px;flex-shrink:0" alt="QR Code">' +
        '<div style="font-size:10px;color:#94a3b8">' +
          'IV DrugRef v' + ver + '<br>' +
          '\u26a0 \u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e0a\u0e48\u0e27\u0e22\u0e04\u0e33\u0e19\u0e27\u0e13 \u0e44\u0e21\u0e48\u0e17\u0e14\u0e41\u0e17\u0e19 clinical judgment' +
          // ⚠ ใช้เป็นเครื่องมือช่วยคำนวณ ไม่ทดแทน clinical judgment
        '</div>' +
      '</div>' +
    '</div>';

    area.innerHTML = html;
    area.style.display = 'block';

    // Slight delay to ensure rendering before print
    setTimeout(function() {
      window.print();
    }, 100);

    // Cleanup after print
    var cleanup = function() {
      area.innerHTML = '';
      area.style.display = 'none';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Fallback cleanup after 10s if afterprint doesn't fire (some mobile browsers)
    setTimeout(cleanup, 10000);

    trackShareExport('export_pdf', opts.analytics);
  }

  // Expose on IVDrugRef namespace
  if (typeof IVDrugRef !== 'undefined') {
    IVDrugRef.ShareExport = {
      copyText: copyText,
      shareToLine: shareToLine,
      printReport: printReport,
      showToast: showToast,
      thaiDateTime: thaiDateTime
    };
  }

})();
