/* Onboarding Tutorial — v5.9.1 (multi-page) */
(function () {
  'use strict';

  /* ── Per-page step definitions ── */
  var PAGE_STEPS = {
    index: [
      {
        target: '.search-wrap',
        title: '\uD83D\uDD0D Search',
        desc: '\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E0A\u0E37\u0E48\u0E2D\u0E22\u0E32\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E49\u0E19\u0E2B\u0E32 \u0E40\u0E0A\u0E48\u0E19 phenytoin, amiodarone \u2014 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E17\u0E31\u0E19\u0E17\u0E35\u0E41\u0E1A\u0E1A real-time',
        position: 'below'
      },
      {
        target: '#toolsZone',
        title: '\uD83D\uDEE0\uFE0F Quick Tools & Filter',
        desc: '\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E04\u0E33\u0E19\u0E27\u0E13 (Dose Calc, TDM, Renal Dose, Compat) \u0E44\u0E14\u0E49\u0E40\u0E23\u0E47\u0E27\u0E08\u0E32\u0E01\u0E15\u0E23\u0E07\u0E19\u0E35\u0E49 \u0E41\u0E25\u0E49\u0E27\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14" \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E23\u0E2D\u0E07\u0E2B\u0E21\u0E27\u0E14\u0E22\u0E32',
        position: 'below'
      }
    ],
    calculator: [
      {
        target: '.section:first-of-type',
        title: '\uD83D\uDCDD Patient Info',
        desc: '\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E1B\u0E48\u0E27\u0E22: \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01, \u0E2D\u0E32\u0E22\u0E38, \u0E40\u0E1E\u0E28, SCr, \u0E2A\u0E48\u0E27\u0E19\u0E2A\u0E39\u0E07 \u2014 \u0E23\u0E30\u0E1A\u0E1A\u0E04\u0E33\u0E19\u0E27\u0E13 CrCl \u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E2B\u0E19\u0E48\u0E27\u0E22\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E25\u0E31\u0E1A kg/lbs, mg/dL/\u00B5mol/L',
        position: 'below'
      },
      {
        target: '#drugGrid',
        title: '\uD83D\uDC8A Drug Grid',
        desc: '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E32\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E02\u0E19\u0E32\u0E14\u0E22\u0E32\u0E17\u0E35\u0E48\u0E41\u0E19\u0E30\u0E19\u0E33\u0E1E\u0E23\u0E49\u0E2D\u0E21 drip rate \u0E15\u0E32\u0E21\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E1C\u0E39\u0E49\u0E1B\u0E48\u0E27\u0E22',
        position: 'below'
      }
    ],
    tdm: [
      {
        target: '#drugTabs',
        title: '\uD83C\uDFAF Drug Tabs',
        desc: '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E32\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E22\u0E32: Vancomycin, Phenytoin, Aminoglycosides, Valproate, Tacrolimus, Digoxin, Warfarin',
        position: 'below'
      },
      {
        target: '#patientCard',
        title: '\uD83D\uDCDD Patient Info',
        desc: '\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E1B\u0E48\u0E27\u0E22 + \u0E1C\u0E25 lab \u2014 \u0E23\u0E30\u0E1A\u0E1A\u0E04\u0E33\u0E19\u0E27\u0E13 CrCl \u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E30\u0E16\u0E39\u0E01\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E2D\u0E37\u0E48\u0E19\u0E42\u0E14\u0E22\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34',
        position: 'below'
      },
      {
        target: '#sec_vancomycin',
        title: '\uD83E\uDDEA TDM Calculation',
        desc: '\u0E43\u0E2A\u0E48\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 dose/level \u0E17\u0E35\u0E48\u0E44\u0E14\u0E49 \u0E41\u0E25\u0E49\u0E27\u0E01\u0E14 "Run" \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E33\u0E19\u0E27\u0E13 PK parameters, AUC\u2082\u2084, \u0E41\u0E25\u0E30\u0E14\u0E39\u0E01\u0E23\u0E32\u0E1F\u0E1C\u0E25',
        position: 'below'
      }
    ],
    compatibility: [
      {
        target: '#modeTabs',
        title: '\uD83D\uDD00 3 Modes',
        desc: '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E42\u0E2B\u0E21\u0E14\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23: Pair Check (\u0E40\u0E17\u0E35\u0E22\u0E1A 2 \u0E15\u0E31\u0E27), Matrix (\u0E14\u0E39\u0E15\u0E32\u0E23\u0E32\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14), Multi-Drug (\u0E40\u0E0A\u0E47\u0E04\u0E2B\u0E25\u0E32\u0E22\u0E15\u0E31\u0E27\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19)',
        position: 'below'
      },
      {
        target: '#pairSection',
        title: '\uD83D\uDC8A Pair Check',
        desc: '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E32 A \u0E41\u0E25\u0E30\u0E22\u0E32 B \u0E08\u0E32\u0E01 dropdown \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E32\u0E01\u0E31\u0E19\u0E44\u0E14\u0E49 (\u0E40\u0E02\u0E35\u0E22\u0E27/\u0E41\u0E14\u0E07/\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07) \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07 \u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E14 Quick Chip \u0E22\u0E32 ICU \u0E22\u0E2D\u0E14\u0E19\u0E34\u0E22\u0E21',
        position: 'below'
      }
    ],
    'renal-dosing': [
      {
        target: '.section:first-of-type',
        title: '\uD83D\uDCDD Patient Info',
        desc: '\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E1B\u0E48\u0E27\u0E22\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E33\u0E19\u0E27\u0E13 CrCl/eGFR \u0E41\u0E25\u0E49\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E39\u0E15\u0E23 Cockcroft-Gault \u0E2B\u0E23\u0E37\u0E2D CKD-EPI \u0E44\u0E14\u0E49',
        position: 'below'
      },
      {
        target: '#drugSearch',
        title: '\uD83D\uDD0D Drug Search + Filter',
        desc: '\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E22\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E23\u0E2D\u0E07\u0E15\u0E32\u0E21\u0E2B\u0E21\u0E27\u0E14 (Antibiotics, Antifungals \u0E2F\u0E25\u0E2F) \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E39\u0E02\u0E19\u0E32\u0E14\u0E22\u0E32\u0E17\u0E35\u0E48\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E32\u0E21 GFR \u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1B\u0E48\u0E27\u0E22',
        position: 'below'
      }
    ]
  };

  /* ── Detect current page ── */
  function detectPage() {
    var path = location.pathname.split('/').pop() || 'index.html';
    var name = path.replace('.html', '');
    return name || 'index';
  }

  var pageName = detectPage();
  var STEPS = PAGE_STEPS[pageName];
  if (!STEPS) return; // no tutorial for this page

  var LS_KEY = 'hasSeenOnboarding_' + pageName;

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
      '<div class="onboarding-tooltip-title">' + step.title + '</div>' +
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
      tooltipEl.style.top = Math.min(rect.bottom + 12, window.innerHeight - 200) + 'px';
    }
  }

  function highlightElement(step) {
    if (prevHighlight) {
      prevHighlight.classList.remove('onboarding-highlight');
      prevHighlight.style.removeProperty('position');
    }
    var el = document.querySelector(step.target);
    if (el) {
      el.classList.add('onboarding-highlight');
      // Only add position:relative if element is static (don't break fixed/sticky)
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
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
    localStorage.setItem(LS_KEY, 'true');

    if (prevHighlight) {
      prevHighlight.classList.remove('onboarding-highlight');
      prevHighlight.style.removeProperty('position');
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
      var btn = e.target.closest ? e.target.closest('[data-action]') : null;
      var action = (btn && btn.getAttribute('data-action')) || e.target.getAttribute('data-action');
      if (action === 'nextTutorial') showStep(currentStep + 1);
      if (action === 'skipTutorial') endTutorial();
      if (action === 'showTutorial') startTutorial();
    });
  }

  /* --- Auto-show on first visit to this page --- */
  if (!localStorage.getItem(LS_KEY)) {
    setTimeout(startTutorial, 800);
  }
})();
