/* ============================================================
   site-chrome.js — shared collapsible left-rail navigation (P3.4)
   Injects ONE off-canvas drawer nav into every user page, replacing the
   per-page .bottom-nav (which had drifted out of sync). Controls:
   - edge toggle button (‹‹ open / ›› closed)
   - swipe: right-from-left-edge opens, left closes
   - tap the scrim, click a nav item, or press Escape to close
   - auto-hide when scrolling down
   dashboard/admin are intentionally NOT in this nav (admin-only).
   ============================================================ */
(function () {
  'use strict';
  if (window.__siteChromeLoaded) return;
  window.__siteChromeLoaded = true;

  // 7 user pages (order = display order in the rail)
  var PAGES = [
    { file: 'index.html',         ic: '💉', lb: 'ค้นหายา' },
    { file: 'calculator.html',    ic: '🧮', lb: 'คำนวณ' },
    { file: 'tdm.html',           ic: '🎯', lb: 'TDM' },
    { file: 'vanco-tdm.html',     ic: '🧪', lb: 'Vanco' },
    { file: 'renal-dosing.html',  ic: '🧬', lb: 'Renal' },
    { file: 'compatibility.html', ic: '🔗', lb: 'เข้ากัน' },
    { file: 'allergy.html',       ic: '🛡️', lb: 'แพ้ยา' }
  ];

  function currentFile() {
    var p = (location.pathname || '').split('/').pop();
    return (!p) ? 'index.html' : p;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function build() {
    var cur = currentFile();

    var rail = document.createElement('nav');
    rail.className = 'sc-rail';
    rail.setAttribute('aria-label', 'เมนูหลัก');
    var html = '<a class="sc-brand" href="index.html" title="IV DrugRef">💊</a>';
    PAGES.forEach(function (pg) {
      var active = (pg.file === cur) ? ' sc-active' : '';
      html += '<a class="sc-item' + active + '" href="' + esc(pg.file) + '">' +
        '<span class="sc-ic">' + pg.ic + '</span>' +
        '<span class="sc-lb">' + esc(pg.lb) + '</span></a>';
    });
    rail.innerHTML = html;

    var scrim = document.createElement('div');
    scrim.className = 'sc-scrim';

    var toggle = document.createElement('button');
    toggle.className = 'sc-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'เปิด/ปิดเมนู');
    toggle.textContent = '››'; // ››

    document.body.appendChild(scrim);
    document.body.appendChild(rail);
    document.body.appendChild(toggle);

    function setOpen(o) {
      document.body.classList.toggle('sc-open', o);
      toggle.textContent = o ? '‹‹' : '››';
      toggle.setAttribute('aria-expanded', o ? 'true' : 'false');
    }
    function isOpen() { return document.body.classList.contains('sc-open'); }

    toggle.addEventListener('click', function () { setOpen(!isOpen()); });
    scrim.addEventListener('click', function () { setOpen(false); });
    rail.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.sc-item')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) setOpen(false);
    });

    // auto-hide on scroll-down (only acts when the drawer is open)
    var lastY = 0, ticking = false, st = null;
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      document.body.classList.add('sc-scrolling');
      clearTimeout(st);
      st = setTimeout(function () { document.body.classList.remove('sc-scrolling'); }, 500);
      if (!ticking) {
        requestAnimationFrame(function () {
          if (y > lastY + 6 && y > 40 && isOpen()) setOpen(false);
          lastY = y; ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // swipe: right opens; left closes (when open, swipe anywhere; when closed,
    // only a swipe starting near the left edge opens — so normal swipes elsewhere
    // don't trigger it)
    var sx = 0, sy = 0, tracking = false;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      tracking = isOpen() ? true : (sx < 28);
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!tracking) return; tracking = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 45 || Math.abs(dy) > Math.abs(dx)) return;
      setOpen(dx > 0);
    }, { passive: true });

    // Default: OPEN on entry so the menu is discoverable; the user then
    // swipes left / scrolls / taps to hide it.
    setOpen(true);

    injectFooter();
  }

  // Compact footer + info modal (disclaimer/license/refs). Skipped if the page
  // already ships its own footer (index keeps its rich footer, which is also
  // coupled to index.js via #footerDrugCount). Version is single-sourced from
  // IVDrugRef.VERSION so there's nothing per-page to bump.
  function injectFooter() {
    if (document.querySelector('footer, .app-footer')) return;
    var ver = (window.IVDrugRef && window.IVDrugRef.VERSION) ? window.IVDrugRef.VERSION : '';

    var f = document.createElement('footer');
    f.className = 'sc-footer';
    f.innerHTML =
      '<span>💊 <b>IV DrugRef</b> <span class="sc-ver">v' + esc(ver) + '</span> · ' +
      'ภก.ฐาปนัท นาคครุฑ (Benz) · สถาบันประสาทวิทยา</span>' +
      '<button type="button" class="sc-info-btn">ℹ️ เกี่ยวกับ / Disclaimer / License</button>';

    var m = document.createElement('div');
    m.className = 'sc-modal';
    m.innerHTML =
      '<div class="sc-sheet">' +
        '<h3>ℹ️ เกี่ยวกับแอปนี้</h3>' +
        '<div class="sc-box sc-red"><b>⚠️ Disclaimer</b> — เครื่องมือสนับสนุนการตัดสินใจทางคลินิกเท่านั้น ' +
        'ไม่ทดแทนดุลยพินิจวิชาชีพ ตรวจสอบกับแหล่งอ้างอิงปฐมภูมิเสมอ</div>' +
        '<div class="sc-cred">จัดทำโดย ภก.ฐาปนัท นาคครุฑ (Benz)<br>' +
        'กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา · Neurological Institute of Thailand</div>' +
        '<div class="sc-box sc-blue"><b>📜 License</b> — CC BY-NC-SA 4.0 · ใช้/แชร์/ดัดแปลงได้ ต้องให้เครดิต · ' +
        'ห้ามเชิงพาณิชย์ · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.th" target="_blank" rel="noopener">รายละเอียด</a></div>' +
        '<div class="sc-refs">แหล่งอ้างอิง: Lexicomp, Trissel\'s Handbook on Injectable Drugs, AHFS, ISMP, ' +
        'Package Inserts, Clinical Practice Guidelines · <b>เวอร์ชัน ' + esc(ver) + '</b></div>' +
        '<div class="sc-close-wrap"><button type="button" class="sc-close-btn">ปิด</button></div>' +
      '</div>';

    document.body.appendChild(f);
    document.body.appendChild(m);

    function openM() { m.classList.add('sc-modal-open'); }
    function closeM() { m.classList.remove('sc-modal-open'); }
    f.querySelector('.sc-info-btn').addEventListener('click', openM);
    m.querySelector('.sc-close-btn').addEventListener('click', closeM);
    m.addEventListener('click', function (e) { if (e.target === m) closeM(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.classList.contains('sc-modal-open')) closeM();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
