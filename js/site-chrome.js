/* ============================================================
   site-chrome.js — shared collapsible left-rail navigation + footer (P3.4)
   One off-canvas drawer nav + compact footer + About modal injected into every
   user page (replaces the per-page bottom-nav). The chrome renders its OWN
   Thai/English text from IVDrugRefI18n.getCurrentLang() and re-renders on the
   'languageChanged' event — and is marked data-i18n-done so the global i18n
   pattern engine never half-translates it.
   Controls: edge toggle (‹‹/››), swipe (right-from-edge opens, left closes),
   Esc; state persists across navigation (sessionStorage). dashboard/admin are
   intentionally NOT in this nav.
   ============================================================ */
(function () {
  'use strict';
  if (window.__siteChromeLoaded) return;
  window.__siteChromeLoaded = true;

  // ----- PWA install support (captured ASAP; the event can fire before build) -----
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // keep our own UI in control
    deferredPrompt = e;
    if (window.__scOnInstallable) window.__scOnInstallable();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    try { localStorage.setItem('pwaInstalled', '1'); } catch (e) {}
    if (window.__scOnInstalled) window.__scOnInstalled();
  });
  function isInstalled() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function platform() {
    var ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    // iPadOS 13+ reports as Macintosh but is touch-capable
    if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'desktop';
  }

  // 7 user pages (order = display order). label keys resolved per language below.
  var PAGES = [
    { file: 'index.html',         ic: '💉', key: 'search' },
    { file: 'calculator.html',    ic: '🧮', key: 'calc' },
    { file: 'tdm.html',           ic: '🎯', key: 'tdm' },
    { file: 'vanco-tdm.html',     ic: '🧪', key: 'vanco' },
    { file: 'renal-dosing.html',  ic: '🧬', key: 'renal' },
    { file: 'compatibility.html', ic: '🔗', key: 'compat' },
    { file: 'allergy.html',       ic: '🛡️', key: 'allergy' }
  ];

  var STR = {
    th: {
      search: 'ค้นหายา', calc: 'คำนวณ', tdm: 'TDM', vanco: 'Vanco', renal: 'Renal', compat: 'เข้ากัน', allergy: 'แพ้ยา',
      by: 'ภก.ฐาปนัท นาคครุฑ (Benz) · สถาบันประสาทวิทยา',
      infoBtn: 'ℹ️ เกี่ยวกับ / Disclaimer / License',
      aboutTitle: 'ℹ️ เกี่ยวกับแอปนี้',
      disclaimer: '<b>⚠️ Disclaimer</b> — เครื่องมือสนับสนุนการตัดสินใจทางคลินิกเท่านั้น ไม่ทดแทนดุลยพินิจวิชาชีพ ตรวจสอบกับแหล่งอ้างอิงปฐมภูมิเสมอ',
      cred: 'จัดทำโดย ภก.ฐาปนัท นาคครุฑ (Benz)<br>กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา',
      license: '<b>📜 License</b> — CC BY-NC-SA 4.0 · ใช้/แชร์/ดัดแปลงได้ ต้องให้เครดิต · ห้ามเชิงพาณิชย์ · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.th" target="_blank" rel="noopener">รายละเอียด</a>',
      refsLabel: 'แหล่งอ้างอิง', verLabel: 'เวอร์ชัน', close: 'ปิด',
      install: 'ติดตั้ง',
      instTitle: '📲 ติดตั้งแอปลงเครื่อง',
      instIntro: 'ติดตั้ง IV DrugRef ไว้บนเครื่อง — เปิดเร็วจากไอคอนหน้าจอ ใช้งานออฟไลน์ได้ เต็มจอเหมือนแอปจริง ไม่ต้องเปิดเบราว์เซอร์',
      instNow: '⬇️ ติดตั้งเลย',
      instStepsHead: 'วิธีติดตั้งด้วยตนเอง:',
      bannerText: '📲 รู้ไหม? ติดตั้งแอปนี้ลงเครื่องได้ — เปิดเร็ว ใช้ออฟไลน์ได้',
      bannerGo: 'ดูวิธีติดตั้ง',
      later: 'ไม่ตอนนี้'
    },
    en: {
      search: 'Search', calc: 'Calc', tdm: 'TDM', vanco: 'Vanco', renal: 'Renal', compat: 'Compat', allergy: 'Allergy',
      by: 'Thapanat Nakkrut (Benz) · Neurological Institute of Thailand',
      infoBtn: 'ℹ️ About / Disclaimer / License',
      aboutTitle: 'ℹ️ About this app',
      disclaimer: '<b>⚠️ Disclaimer</b> — Clinical decision support tool only; not a substitute for professional judgment. Always verify against primary references.',
      cred: 'Created by Thapanat Nakkrut (Benz)<br>Pharmacy Dept., Neurological Institute of Thailand',
      license: '<b>📜 License</b> — CC BY-NC-SA 4.0 · use / share / adapt with credit · non-commercial · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en" target="_blank" rel="noopener">details</a>',
      refsLabel: 'References', verLabel: 'Version', close: 'Close',
      install: 'Install',
      instTitle: '📲 Install this app',
      instIntro: 'Install IV DrugRef on your device — launch instantly from a home-screen icon, works offline, full-screen like a native app, no browser bar.',
      instNow: '⬇️ Install now',
      instStepsHead: 'Install manually:',
      bannerText: '📲 Did you know? You can install this app — fast launch, works offline',
      bannerGo: 'How to install',
      later: 'Not now'
    }
  };
  var REFS = "Lexicomp, Trissel's Handbook on Injectable Drugs, AHFS, ISMP, Package Inserts, Clinical Practice Guidelines";

  // Platform-specific manual install steps (used when there's no native prompt,
  // e.g. iOS Safari, or as a fallback alongside the "Install now" button).
  var INSTALL_STEPS = {
    ios: {
      th: ['แตะปุ่ม <b>แชร์</b> (Share <b>⬆️</b>) ที่แถบของ Safari',
           'เลื่อนหา <b>“เพิ่มลงในหน้าจอโฮม” (Add to Home Screen)</b>',
           'แตะ <b>เพิ่ม (Add)</b> มุมขวาบน → ไอคอนแอปจะขึ้นบนหน้าจอโฮม'],
      en: ['Tap the <b>Share</b> button (<b>⬆️</b>) in Safari',
           'Scroll to <b>“Add to Home Screen”</b>',
           'Tap <b>Add</b> (top-right) → the app icon appears on your home screen']
    },
    android: {
      th: ['แตะเมนู <b>⋮</b> มุมขวาบนของ Chrome',
           'เลือก <b>“ติดตั้งแอป” / “เพิ่มลงในหน้าจอหลัก”</b> (Install app / Add to Home screen)',
           'กด <b>ติดตั้ง</b> ยืนยัน'],
      en: ['Tap the <b>⋮</b> menu (top-right) in Chrome',
           'Choose <b>“Install app” / “Add to Home screen”</b>',
           'Tap <b>Install</b> to confirm']
    },
    desktop: {
      th: ['กดไอคอน <b>ติดตั้ง ⊕</b> ที่ปลายแถบที่อยู่ (address bar) ด้านขวา',
           'หรือเมนู <b>⋮</b> → <b>“ติดตั้ง IV DrugRef…”</b> (Install…)',
           'กด <b>ติดตั้ง</b> — แอปจะเปิดเป็นหน้าต่างของตัวเอง'],
      en: ['Click the <b>Install ⊕</b> icon at the right end of the address bar',
           'or menu <b>⋮</b> → <b>“Install IV DrugRef…”</b>',
           'Click <b>Install</b> — it opens in its own window']
    }
  };

  function lang() {
    try { return (window.IVDrugRefI18n && window.IVDrugRefI18n.getCurrentLang() === 'en') ? 'en' : 'th'; }
    catch (e) { return 'th'; }
  }
  function ver() { return (window.IVDrugRef && window.IVDrugRef.VERSION) ? window.IVDrugRef.VERSION : ''; }
  function currentFile() { var p = (location.pathname || '').split('/').pop(); return (!p) ? 'index.html' : p; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function build() {
    var cur = currentFile();

    // ----- left rail -----
    var rail = document.createElement('nav');
    rail.className = 'sc-rail';
    rail.setAttribute('aria-label', 'menu');
    rail.setAttribute('data-i18n-done', '1');   // chrome manages its own translation
    var html = '<a class="sc-brand" href="index.html" title="IV DrugRef">💊</a>';
    PAGES.forEach(function (pg) {
      var active = (pg.file === cur) ? ' sc-active' : '';
      html += '<a class="sc-item' + active + '" href="' + esc(pg.file) + '" data-k="' + pg.key + '">' +
        '<span class="sc-ic">' + pg.ic + '</span><span class="sc-lb"></span></a>';
    });
    // install entry point (hidden when already installed)
    html += '<button type="button" class="sc-item sc-install-item" data-k="install"' +
      (isInstalled() ? ' style="display:none"' : '') + '>' +
      '<span class="sc-ic">📲</span><span class="sc-lb"></span></button>';
    rail.innerHTML = html;

    var toggle = document.createElement('button');
    toggle.className = 'sc-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'menu');

    // ----- footer + About modal (only if the page has no footer of its own) -----
    var footer = null, modal = null;
    if (!document.querySelector('footer, .app-footer')) {
      footer = document.createElement('footer');
      footer.className = 'sc-footer';
      footer.setAttribute('data-i18n-done', '1');
      footer.innerHTML = '<span class="sc-foot-main"></span>' +
        '<button type="button" class="sc-info-btn"></button>';

      modal = document.createElement('div');
      modal.className = 'sc-modal';
      modal.setAttribute('data-i18n-done', '1');
      modal.innerHTML =
        '<div class="sc-sheet">' +
          '<h3 class="sc-m-title"></h3>' +
          '<div class="sc-box sc-red sc-m-disc"></div>' +
          '<div class="sc-cred sc-m-cred"></div>' +
          '<div class="sc-box sc-blue sc-m-lic"></div>' +
          '<div class="sc-refs sc-m-refs"></div>' +
          '<div class="sc-close-wrap"><button type="button" class="sc-close-btn"></button></div>' +
        '</div>';
    }

    // ----- install guide modal (always injected; reuses sc-modal styling) -----
    var instModal = document.createElement('div');
    instModal.className = 'sc-modal sc-install-modal';
    instModal.setAttribute('data-i18n-done', '1');
    instModal.innerHTML =
      '<div class="sc-sheet">' +
        '<h3 class="sc-m-title sci-title"></h3>' +
        '<div class="sc-cred sci-intro"></div>' +
        '<button type="button" class="sci-now" style="display:none"></button>' +
        '<div class="sci-steps-head"></div>' +
        '<ol class="sci-steps"></ol>' +
        '<div class="sc-close-wrap"><button type="button" class="sc-close-btn sci-close"></button></div>' +
      '</div>';

    // ----- one-time discovery banner (only if not installed / not dismissed) -----
    var banner = null;
    var dismissed = false;
    try { dismissed = localStorage.getItem('pwaInstallDismissed') === '1' || localStorage.getItem('pwaInstalled') === '1'; } catch (e) {}
    if (!isInstalled() && !dismissed) {
      banner = document.createElement('div');
      banner.className = 'sc-install-banner';
      banner.setAttribute('data-i18n-done', '1');
      banner.innerHTML =
        '<span class="scib-text"></span>' +
        '<button type="button" class="scib-go"></button>' +
        '<button type="button" class="scib-x" aria-label="dismiss">✕</button>';
    }

    document.body.appendChild(rail);
    document.body.appendChild(toggle);
    if (footer) { document.body.appendChild(footer); document.body.appendChild(modal); }
    document.body.appendChild(instModal);
    if (banner) document.body.appendChild(banner);

    // ----- apply / re-apply language to all chrome text -----
    function applyLang() {
      var t = STR[lang()];
      // re-assert the skip flag — i18n's revert (EN->TH) strips data-i18n-done,
      // which would let the pattern engine half-translate the chrome next time.
      rail.setAttribute('data-i18n-done', '1');
      if (footer) { footer.setAttribute('data-i18n-done', '1'); modal.setAttribute('data-i18n-done', '1'); }
      instModal.setAttribute('data-i18n-done', '1');
      if (banner) banner.setAttribute('data-i18n-done', '1');
      rail.querySelectorAll('.sc-item').forEach(function (a) {
        var lb = a.querySelector('.sc-lb');
        if (lb) lb.textContent = t[a.getAttribute('data-k')] || '';
      });
      // install modal text + platform steps
      instModal.querySelector('.sci-title').textContent = t.instTitle;
      instModal.querySelector('.sci-intro').textContent = t.instIntro;
      instModal.querySelector('.sci-now').textContent = t.instNow;
      instModal.querySelector('.sci-steps-head').textContent = t.instStepsHead;
      var steps = (INSTALL_STEPS[platform()] || INSTALL_STEPS.desktop)[lang()] ||
        (INSTALL_STEPS[platform()] || INSTALL_STEPS.desktop).en;
      instModal.querySelector('.sci-steps').innerHTML =
        steps.map(function (s) { return '<li>' + s + '</li>'; }).join('');
      instModal.querySelector('.sci-close').textContent = t.close;
      if (banner) {
        banner.querySelector('.scib-text').textContent = t.bannerText;
        banner.querySelector('.scib-go').textContent = t.bannerGo;
      }
      if (footer) {
        footer.querySelector('.sc-foot-main').innerHTML =
          '💊 <b>IV DrugRef</b> <span class="sc-ver">v' + esc(ver()) + '</span> · ' + esc(t.by);
        footer.querySelector('.sc-info-btn').textContent = t.infoBtn;
        modal.querySelector('.sc-m-title').textContent = t.aboutTitle;
        modal.querySelector('.sc-m-disc').innerHTML = t.disclaimer;
        modal.querySelector('.sc-m-cred').innerHTML = t.cred;
        modal.querySelector('.sc-m-lic').innerHTML = t.license;
        modal.querySelector('.sc-m-refs').innerHTML = esc(t.refsLabel) + ': ' + esc(REFS) +
          ' · <b>' + esc(t.verLabel) + ' ' + esc(ver()) + '</b>';
        modal.querySelector('.sc-close-btn').textContent = t.close;
      }
    }
    applyLang();
    document.addEventListener('languageChanged', applyLang);

    // ----- open/close (persisted) -----
    function setOpen(o) {
      document.body.classList.toggle('sc-open', o);
      toggle.textContent = o ? '‹‹' : '››';
      toggle.setAttribute('aria-expanded', o ? 'true' : 'false');
      try { sessionStorage.setItem('sc-open', o ? 'open' : 'closed'); } catch (e) {}
    }
    function isOpen() { return document.body.classList.contains('sc-open'); }

    toggle.addEventListener('click', function () { setOpen(!isOpen()); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) setOpen(false); });

    // swipe: right opens (from left edge when closed); left closes
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

    // About modal open/close
    if (footer) {
      footer.querySelector('.sc-info-btn').addEventListener('click', function () { modal.classList.add('sc-modal-open'); });
      modal.querySelector('.sc-close-btn').addEventListener('click', function () { modal.classList.remove('sc-modal-open'); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('sc-modal-open'); });
    }

    // ----- install guide: open/close, native prompt, banner -----
    var installItem = rail.querySelector('.sc-install-item');
    var instNowBtn = instModal.querySelector('.sci-now');

    function refreshInstallUI() {
      // show the "Install now" button only when a native prompt is available
      instNowBtn.style.display = deferredPrompt ? '' : 'none';
    }
    function openInstall() { refreshInstallUI(); instModal.classList.add('sc-modal-open'); }
    function closeInstall() { instModal.classList.remove('sc-modal-open'); }
    function hideBanner(persist) {
      if (banner) banner.classList.remove('scib-show');
      if (persist) { try { localStorage.setItem('pwaInstallDismissed', '1'); } catch (e) {} }
    }

    if (installItem) installItem.addEventListener('click', function () { setOpen(false); openInstall(); });
    instModal.querySelector('.sci-close').addEventListener('click', closeInstall);
    instModal.addEventListener('click', function (e) { if (e.target === instModal) closeInstall(); });

    instNowBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      var p = deferredPrompt; deferredPrompt = null;
      p.prompt();
      p.userChoice.then(function () { refreshInstallUI(); }).catch(function () {});
      closeInstall(); hideBanner(false);
    });

    if (banner) {
      banner.querySelector('.scib-go').addEventListener('click', function () { hideBanner(true); openInstall(); });
      banner.querySelector('.scib-x').addEventListener('click', function () { hideBanner(true); });
      // reveal after a short delay so it isn't jarring on first paint
      setTimeout(function () { if (banner) banner.classList.add('scib-show'); }, 1200);
    }

    // react to late-arriving installability / completed install
    window.__scOnInstallable = refreshInstallUI;
    window.__scOnInstalled = function () {
      if (installItem) installItem.style.display = 'none';
      hideBanner(true); closeInstall();
    };
    refreshInstallUI();

    var stored;
    try { stored = sessionStorage.getItem('sc-open'); } catch (e) { stored = null; }
    setOpen(stored !== 'closed');   // default OPEN on first entry
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
