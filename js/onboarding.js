/* Onboarding Tutorial — v5.9.0 */
(function () {
  'use strict';

  var STEPS = [
    {
      target: '.search-wrap',
      title: 'Search',
      icon: 'magnifying-glass',
      desc: 'พิมพ์ชื่อยาภาษาอังกฤษเพื่อค้นหา เช่น phenytoin, amiodarone — ระบบจะแสดงผลทันทีแบบ real-time',
      position: 'below'
    },
    {
      target: '#toolsZone',
      title: 'Quick Tools & Filter',
      icon: 'tools',
      desc: 'เข้าถึงเครื่องมือคำนวณ (Dose Calc, TDM, Renal Dose, Compat) ได้เร็วจากตรงนี้ แล้วกดปุ่ม "ทั้งหมด" ด้านล่างเพื่อกรองหมวดยา',
      position: 'below'
    },
    {
      target: '.bottom-nav',
      title: 'Navigation',
      icon: 'nav',
      desc: 'แถบด้านล่างใช้สลับระหว่างหน้าต่างๆ ของแอป ลองกดดูแต่ละหน้าได้เลย',
      position: 'above'
    }
  ];

  var ICONS = {
    'magnifying-glass': '\uD83D\uDD0D',
    'tools': '\uD83D\uDEE0\uFE0F',
    'nav': '\uD83E\uDDED'
  };

  var currentStep = 0;
  var backdropEl = null;
  var tooltipEl = null;
  var prevHighlight = null;

  function createOverlay() {
    if (backdropEl) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'onboarding-backdrop';
    backdropEl.addEventListener('click', function (e) {
      if (e.target === backdropEl) endTutorial();
    });

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'onboarding-tooltip';

    document.body.appendChild(backdropEl);
    document.body.appendChild(tooltipEl);
  }

  function renderTooltip(step, idx) {
    var dots = '';
    for (var i = 0; i < STEPS.length; i++) {
      dots += '<span class="onboarding-dot' + (i === idx ? ' active' : '') + '"></span>';
    }

    var isLast = idx === STEPS.length - 1;
    tooltipEl.innerHTML =
      '<div class="onboarding-tooltip-title">' +
        (ICONS[step.icon] || '') + ' ' + step.title +
      '</div>' +
      '<div class="onboarding-tooltip-desc">' + step.desc + '</div>' +
      '<div class="onboarding-dots">' + dots + '</div>' +
      '<div class="onboarding-actions">' +
        '<button class="onboarding-skip" data-action="skipTutorial">' +
          (isLast ? '' : '\u0E02\u0E49\u0E32\u0E21\u0E44\u0E1B') +
        '</button>' +
        '<button class="onboarding-next" data-action="nextTutorial">' +
          (isLast ? '\u0E40\u0E23\u0E34\u0E48\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19' : '\u0E16\u0E31\u0E14\u0E44\u0E1B \u203A') +
        '</button>' +
      '</div>';
  }

  function positionTooltip(step) {
    var el = document.querySelector(step.target);
    if (!el) return;

    var rect = el.getBoundingClientRect();
    var tw = Math.min(320, window.innerWidth - 40);

    tooltipEl.style.width = tw + 'px';
    tooltipEl.style.left = Math.max(20, Math.min(window.innerWidth - tw - 20, rect.left + rect.width / 2 - tw / 2)) + 'px';

    if (step.position === 'above') {
      tooltipEl.style.top = '';
      tooltipEl.style.bottom = (window.innerHeight - rect.top + 12) + 'px';
    } else {
      tooltipEl.style.bottom = '';
      tooltipEl.style.top = (rect.bottom + 12) + 'px';
    }
  }

  function highlightElement(step) {
    if (prevHighlight) {
      prevHighlight.classList.remove('onboarding-highlight');
    }
    var el = document.querySelector(step.target);
    if (el) {
      el.classList.add('onboarding-highlight');
      prevHighlight = el;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showStep(idx) {
    if (idx < 0 || idx >= STEPS.length) return endTutorial();

    currentStep = idx;
    var step = STEPS[idx];

    tooltipEl.classList.remove('visible');

    setTimeout(function () {
      highlightElement(step);
      renderTooltip(step, idx);
      positionTooltip(step);

      setTimeout(function () {
        tooltipEl.classList.add('visible');
      }, 30);
    }, 150);
  }

  function endTutorial() {
    localStorage.setItem('hasSeenOnboarding', 'true');

    if (prevHighlight) {
      prevHighlight.classList.remove('onboarding-highlight');
      prevHighlight = null;
    }
    if (backdropEl) backdropEl.classList.remove('active');
    if (tooltipEl) tooltipEl.classList.remove('visible');

    setTimeout(function () {
      if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
      backdropEl = null;
      tooltipEl = null;
    }, 350);
  }

  function startTutorial() {
    currentStep = 0;
    createOverlay();
    backdropEl.classList.add('active');
    showStep(0);
  }

  /* --- Event delegation via IVDrugRef.delegate --- */
  if (typeof IVDrugRef !== 'undefined' && IVDrugRef.delegate) {
    IVDrugRef.delegate(document, 'click', {
      nextTutorial: function () {
        showStep(currentStep + 1);
      },
      skipTutorial: function () {
        endTutorial();
      },
      showTutorial: function () {
        startTutorial();
      }
    });
  } else {
    document.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-action') || (e.target.closest && e.target.closest('[data-action]') || {}).getAttribute && e.target.closest('[data-action]').getAttribute('data-action');
      if (action === 'nextTutorial') showStep(currentStep + 1);
      if (action === 'skipTutorial') endTutorial();
      if (action === 'showTutorial') startTutorial();
    });
  }

  /* --- Auto-show on first visit --- */
  if (!localStorage.getItem('hasSeenOnboarding')) {
    setTimeout(startTutorial, 800);
  }
})();
