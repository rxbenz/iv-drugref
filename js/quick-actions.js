/* ============================================================
   Quick Actions FAB — v5.7.0
   Cross-page floating action button for ICU quick access:
   1) Quick drug search
   2) Quick compatibility check
   3) Quick drip rate calculator
   ============================================================ */
(function() {
  'use strict';

  // ===== DRUG DATA =====
  var drugs = []; // [{id, generic, trade, had, categories, y, x}, ...]

  function loadDrugs() {
    // Try localStorage first (drugData_v4 has full objects)
    try {
      var raw = localStorage.getItem('drugData_v4');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          drugs = parsed.map(mapDrug);
          return;
        }
      }
    } catch (e) {}
    // Fallback: fetch drugs-data.json
    fetch('drugs-data.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (Array.isArray(data)) drugs = data.map(mapDrug);
      })
      .catch(function() {});
  }

  function mapDrug(d) {
    // Normalize from full field names to working format
    var cats = d.categories || d.c || [];
    if (typeof cats === 'string') {
      try { cats = JSON.parse(cats); } catch(e) { cats = cats.split(',').map(function(s){return s.trim()}); }
    }
    var compat = d.compat || {};
    if (typeof compat === 'string') { try { compat = JSON.parse(compat); } catch(e) { compat = {}; } }
    return {
      i: d.id || d.i,
      g: d.generic || d.g || '',
      t: d.trade || d.t || '',
      h: d.ed === 'Y' || d.had === true || d.h === true || d.h === 1,
      c: cats,
      y: (compat.ysite || d.y || ''),
      x: (compat.incompat || d.x || '')
    };
  }

  // ===== CURATED COMPATIBILITY MAP =====
  // Subset of most critical ICU pairs (same as compatibility.js CURATED)
  var CURATED = [
    ['Norepinephrine','Dobutamine','c'],['Norepinephrine','Milrinone','c'],['Norepinephrine','Diltiazem','c'],
    ['Norepinephrine','Heparin','c'],['Norepinephrine','Midazolam','c'],['Norepinephrine','Fentanyl','c'],
    ['Norepinephrine','Morphine','c'],['Norepinephrine','Human Insulin','c'],['Norepinephrine','Potassium','c'],
    ['Norepinephrine','Calcium chloride','c'],['Norepinephrine','Cefepime','c'],
    ['Norepinephrine','Furosemide','i'],['Norepinephrine','Pantoprazole','i'],['Norepinephrine','Phenytoin','i'],
    ['Norepinephrine','Sodium bicarbonate','i'],['Norepinephrine','Diazepam','i'],
    ['Dopamine','Dobutamine','c'],['Dopamine','Heparin','c'],['Dopamine','Potassium','c'],
    ['Dopamine','Calcium chloride','c'],['Dopamine','Milrinone','c'],['Dopamine','Diltiazem','c'],
    ['Dopamine','Furosemide','i'],['Dopamine','Sodium bicarbonate','i'],['Dopamine','Phenytoin','i'],
    ['Dobutamine','Heparin','c'],['Dobutamine','Potassium','c'],['Dobutamine','Calcium chloride','c'],
    ['Dobutamine','Milrinone','c'],
    ['Dobutamine','Furosemide','i'],['Dobutamine','Sodium bicarbonate','i'],['Dobutamine','Phenytoin','i'],
    ['Adrenaline','Heparin','c'],['Adrenaline','Midazolam','c'],['Adrenaline','Fentanyl','c'],
    ['Adrenaline','Furosemide','i'],['Adrenaline','Sodium bicarbonate','i'],
    ['Milrinone','Heparin','c'],['Milrinone','Potassium','c'],['Milrinone','Morphine','c'],['Milrinone','Human Insulin','c'],
    ['Milrinone','Furosemide','i'],['Milrinone','Sodium bicarbonate','i'],
    ['Amiodarone','Heparin','c'],['Amiodarone','Dobutamine','c'],['Amiodarone','Midazolam','c'],
    ['Amiodarone','Furosemide','i'],['Amiodarone','Sodium bicarbonate','i'],['Amiodarone','Ceftriaxone','i'],
    ['Heparin','Potassium','c'],['Heparin','Morphine','c'],['Heparin','Fentanyl','c'],
    ['Heparin','Midazolam','c'],['Heparin','Cefepime','c'],['Heparin','Diltiazem','c'],['Heparin','Milrinone','c'],
    ['Heparin','Vancomycin','i'],['Heparin','Diazepam','i'],
    ['Vancomycin','Cefepime','c'],['Vancomycin','Meropenem','c'],['Vancomycin','Piperacillin','c'],
    ['Vancomycin','Dexamethasone','i'],['Vancomycin','Ceftriaxone','i'],
    ['Piperacillin','Vancomycin','c'],['Piperacillin','Meropenem','i'],['Piperacillin','Amikacin','i'],
    ['Meropenem','Vancomycin','c'],['Meropenem','Cefepime','c'],
    ['Meropenem','Amphotericin','i'],['Meropenem','Diazepam','i'],
    ['Furosemide','Midazolam','i'],['Furosemide','Amiodarone','i'],['Furosemide','Diltiazem','i'],
    ['Pantoprazole','Midazolam','v'],
    ['Phenytoin','D5W','i'],['Ceftriaxone','Calcium gluconate','i'],['Ceftriaxone','Calcium chloride','i'],
    ['Calcium chloride','Dobutamine','c'],['Calcium chloride','Dopamine','c'],['Calcium chloride','Norepinephrine','c'],
    ['Calcium chloride','Sodium bicarbonate','i'],['Calcium chloride','Ceftriaxone','i'],
    ['Diltiazem','Heparin','c'],['Diltiazem','Human Insulin','c'],['Diltiazem','Potassium','c'],
    ['Diltiazem','Amphotericin','i'],['Diltiazem','Furosemide','i'],['Diltiazem','Phenytoin','i'],['Diltiazem','Diazepam','i'],
    ['Daptomycin','Dexamethasone','c'],['Daptomycin','Heparin','c'],
    ['Daptomycin','RL','i'],['Daptomycin','Sodium bicarbonate','i'],
    ['Caspofungin','Dexamethasone','c'],['Caspofungin','Meropenem','c'],
    ['Caspofungin','D5W','i'],['Caspofungin','Sodium bicarbonate','i'],
    ['Midazolam','Cefepime','c'],['Midazolam','Diltiazem','c'],
    ['20% Mannitol','Potassium chloride','i'],['Amphotericin B','NSS','i']
  ];
  var CURATED_MAP = {};
  CURATED.forEach(function(r) {
    var key = [normKey(r[0]), normKey(r[1])].sort().join('|');
    CURATED_MAP[key] = r[2];
  });

  // Also try to load from compatibility page's cache if available
  try {
    var cachedPairs = localStorage.getItem('ivdrug_compatPairsCache');
    if (cachedPairs) {
      var pairs = JSON.parse(cachedPairs);
      if (Array.isArray(pairs) && pairs.length > 0) {
        pairs.forEach(function(r) {
          var key = [normKey(r[0]), normKey(r[1])].sort().join('|');
          CURATED_MAP[key] = r[2];
        });
      }
    }
  } catch(e) {}

  function normKey(generic) {
    var words = generic.toLowerCase().split(/[\s,()\/]+/);
    for (var w = 0; w < words.length; w++) {
      var cleaned = words[w].replace(/[^a-z]/g, '');
      if (cleaned.length > 0) return cleaned;
    }
    return generic.toLowerCase().replace(/[^a-z]/g, '');
  }

  function getCompat(drugA, drugB) {
    if (drugA.i === drugB.i) return { status: 'self', detail: '' };
    var ka = normKey(drugA.g), kb = normKey(drugB.g);
    var key = [ka, kb].sort().join('|');
    if (CURATED_MAP[key]) {
      var s = CURATED_MAP[key];
      return {
        status: s === 'c' ? 'compatible' : s === 'i' ? 'incompatible' : 'variable',
        detail: drugA.g + ' + ' + drugB.g
      };
    }
    // Check drug-specific fields
    var aY = (drugA.y || '').toLowerCase(), aX = (drugA.x || '').toLowerCase();
    var bY = (drugB.y || '').toLowerCase(), bX = (drugB.x || '').toLowerCase();
    var bNameLow = drugB.g.toLowerCase().split(/[\s(]/)[0];
    var aNameLow = drugA.g.toLowerCase().split(/[\s(]/)[0];
    if (aX.indexOf(bNameLow) !== -1 || bX.indexOf(aNameLow) !== -1) {
      return { status: 'incompatible', detail: drugA.g + ' + ' + drugB.g };
    }
    if (aY.indexOf(bNameLow) !== -1 || bY.indexOf(aNameLow) !== -1) {
      return { status: 'compatible', detail: drugA.g + ' + ' + drugB.g };
    }
    return { status: 'nodata', detail: 'ไม่มีข้อมูล — ตรวจสอบ Trissel\'s' };
  }

  // ===== DRIP RATE DRUGS =====
  var DRIP_DRUGS = [
    {
      id: 'norepi', name: 'Norepinephrine',
      unit: 'mcg/min', weightBased: false,
      concs: [
        { label: '4 mg/250 mL', mgPerMl: 0.016 },
        { label: '8 mg/250 mL', mgPerMl: 0.032 },
        { label: '4 mg/100 mL', mgPerMl: 0.04 }
      ],
      range: '2-40 mcg/min',
      note: 'Septic shock first-line vasopressor'
    },
    {
      id: 'dopamine', name: 'Dopamine',
      unit: 'mcg/kg/min', weightBased: true,
      concs: [
        { label: '400 mg/250 mL', mgPerMl: 1.6 },
        { label: '800 mg/250 mL', mgPerMl: 3.2 }
      ],
      range: '2-20 mcg/kg/min',
      note: 'Low: renal | Med: cardiac | High: vasopressor'
    },
    {
      id: 'dobutamine', name: 'Dobutamine',
      unit: 'mcg/kg/min', weightBased: true,
      concs: [
        { label: '250 mg/250 mL', mgPerMl: 1.0 },
        { label: '500 mg/250 mL', mgPerMl: 2.0 }
      ],
      range: '2-20 mcg/kg/min',
      note: 'Inotrope — cardiogenic shock'
    },
    {
      id: 'adrenaline', name: 'Adrenaline',
      unit: 'mcg/min', weightBased: false,
      concs: [
        { label: '4 mg/250 mL', mgPerMl: 0.016 },
        { label: '1 mg/250 mL', mgPerMl: 0.004 }
      ],
      range: '1-20 mcg/min',
      note: 'Anaphylaxis / refractory shock'
    },
    {
      id: 'nicardipine', name: 'Nicardipine',
      unit: 'mg/hr', weightBased: false,
      concs: [
        { label: '25 mg/250 mL', mgPerMl: 0.1 }
      ],
      range: '5-15 mg/hr',
      note: 'IV antihypertensive'
    },
    {
      id: 'dex', name: 'Dexmedetomidine',
      unit: 'mcg/kg/hr', weightBased: true,
      concs: [
        { label: '200 mcg/50 mL', mgPerMl: 0.004 },
        { label: '400 mcg/100 mL', mgPerMl: 0.004 }
      ],
      range: '0.2-1.4 mcg/kg/hr',
      note: 'ICU sedation — no resp depression'
    }
  ];

  // ===== STATE =====
  var isOpen = false;
  var activePanel = null; // 'search' | 'compat' | 'drip'
  var selectedDripDrug = null;
  var selectedDripConc = 0;
  var compatDrugA = null;
  var compatDrugB = null;

  // ===== DRAG STATE =====
  var FAB_POS_KEY = 'qaFabPosition';
  var isDragging = false;
  var dragStartX = 0, dragStartY = 0;
  var fabStartX = 0, fabStartY = 0;
  var dragMoved = false; // distinguish tap from drag
  var DRAG_THRESHOLD = 8; // px before considered a drag

  function saveFabPosition(x, y) {
    try { localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x: x, y: y })); } catch(e) {}
  }

  function loadFabPosition() {
    try {
      var raw = localStorage.getItem(FAB_POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  }

  function applyFabPosition(wrap, pos) {
    if (!pos) return;
    // Clamp to viewport
    var vw = window.innerWidth, vh = window.innerHeight;
    var x = Math.max(0, Math.min(pos.x, vw - 54));
    var y = Math.max(0, Math.min(pos.y, vh - 54));
    wrap.style.bottom = 'auto';
    wrap.style.right = 'auto';
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';
  }

  // ===== INIT =====
  loadDrugs();

  document.addEventListener('DOMContentLoaded', function() {
    injectHTML();
    bindEvents();
    bindDrag();
    // Restore saved position
    var wrap = document.getElementById('qaFabWrap');
    var saved = loadFabPosition();
    if (saved) applyFabPosition(wrap, saved);
  });

  // ===== HTML INJECTION =====
  function injectHTML() {
    // Backdrop
    var bd = document.createElement('div');
    bd.className = 'qa-backdrop';
    bd.id = 'qaBackdrop';
    document.body.appendChild(bd);

    // FAB wrap
    var wrap = document.createElement('div');
    wrap.className = 'qa-fab-wrap';
    wrap.id = 'qaFabWrap';
    wrap.innerHTML = '<div class="qa-menu" id="qaMenu">'
      + '<button class="qa-menu-item" data-qa="drip"><span class="qa-icon">💧</span> Drip Rate</button>'
      + '<button class="qa-menu-item" data-qa="compat"><span class="qa-icon">🔗</span> เช็ค Compat</button>'
      + '<button class="qa-menu-item" data-qa="search"><span class="qa-icon">🔍</span> ค้นยาด่วน</button>'
      + '</div>'
      + '<button class="qa-fab" id="qaFab" aria-label="Quick Actions" aria-expanded="false">⚡</button>';
    document.body.appendChild(wrap);

    // Search panel
    var sp = document.createElement('div');
    sp.className = 'qa-panel';
    sp.id = 'qaSearchPanel';
    sp.innerHTML = '<div class="qa-panel-handle"></div>'
      + '<div class="qa-panel-header"><span class="qa-panel-title">🔍 ค้นยาด่วน</span>'
      + '<button class="qa-panel-close" data-qa-close>&times;</button></div>'
      + '<div class="qa-panel-body">'
      + '<input type="text" class="qa-search-input" id="qaSearchInput" placeholder="พิมพ์ชื่อยา..." autocomplete="off">'
      + '<div class="qa-search-results" id="qaSearchResults"></div></div>';
    document.body.appendChild(sp);

    // Compat panel
    var cp = document.createElement('div');
    cp.className = 'qa-panel';
    cp.id = 'qaCompatPanel';
    cp.innerHTML = '<div class="qa-panel-handle"></div>'
      + '<div class="qa-panel-header"><span class="qa-panel-title">🔗 เช็ค Compatibility</span>'
      + '<button class="qa-panel-close" data-qa-close>&times;</button></div>'
      + '<div class="qa-panel-body">'
      + '<div class="qa-compat-row">'
      + '<div class="qa-compat-select-wrap"><input type="text" class="qa-compat-input" id="qaCompatA" placeholder="ยา A" autocomplete="off">'
      + '<div class="qa-autocomplete" id="qaAcA"></div></div>'
      + '<span class="qa-compat-vs">VS</span>'
      + '<div class="qa-compat-select-wrap"><input type="text" class="qa-compat-input" id="qaCompatB" placeholder="ยา B" autocomplete="off">'
      + '<div class="qa-autocomplete" id="qaAcB"></div></div>'
      + '</div>'
      + '<div class="qa-compat-result" id="qaCompatResult"></div>'
      + '</div>';
    document.body.appendChild(cp);

    // Drip panel
    var dp = document.createElement('div');
    dp.className = 'qa-panel';
    dp.id = 'qaDripPanel';
    dp.innerHTML = '<div class="qa-panel-handle"></div>'
      + '<div class="qa-panel-header"><span class="qa-panel-title">💧 Quick Drip Rate</span>'
      + '<button class="qa-panel-close" data-qa-close>&times;</button></div>'
      + '<div class="qa-panel-body">'
      + '<div class="qa-drip-grid" id="qaDripGrid"></div>'
      + '<div class="qa-drip-form" id="qaDripForm">'
      + '<div class="qa-drip-field"><span class="qa-drip-label">น้ำหนัก (kg)</span>'
      + '<input type="number" class="qa-drip-input" id="qaDripWt" placeholder="70" step="0.1" inputmode="decimal"></div>'
      + '<div class="qa-drip-field"><span class="qa-drip-label">Dose (<span id="qaDripUnit">-</span>)</span>'
      + '<input type="number" class="qa-drip-input" id="qaDripDose" placeholder="0" step="0.1" inputmode="decimal"></div>'
      + '<div class="qa-drip-field"><span class="qa-drip-label">Concentration</span>'
      + '<div class="qa-drip-conc-row" id="qaDripConcs"></div></div>'
      + '</div>'
      + '<div class="qa-drip-result" id="qaDripResult">'
      + '<div class="qa-drip-result-rate" id="qaDripRate">--</div>'
      + '<div class="qa-drip-result-unit">mL/hr</div>'
      + '<div class="qa-drip-result-detail" id="qaDripDetail"></div>'
      + '<div class="qa-drip-range" id="qaDripRange"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(dp);

    // Populate drip drug grid
    var gridHtml = '';
    DRIP_DRUGS.forEach(function(d) {
      gridHtml += '<button class="qa-drip-drug" data-drip="' + d.id + '">' + d.name + '</button>';
    });
    document.getElementById('qaDripGrid').innerHTML = gridHtml;

    // Pre-fill weight from patient context if available
    try {
      var ptCtx = sessionStorage.getItem('patientContext');
      if (ptCtx) {
        var pt = JSON.parse(ptCtx);
        if (pt && pt.weight) document.getElementById('qaDripWt').value = pt.weight;
      }
    } catch(e) {}
  }

  // ===== EVENT BINDING =====
  function bindEvents() {
    var fab = document.getElementById('qaFab');
    var bd = document.getElementById('qaBackdrop');

    // FAB toggle
    fab.addEventListener('click', function() {
      if (activePanel) { closePanel(); return; }
      isOpen = !isOpen;
      toggleMenu(isOpen);
    });

    // Backdrop close
    bd.addEventListener('click', function() { closeAll(); });

    // Menu items
    document.getElementById('qaMenu').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-qa]');
      if (!btn) return;
      var action = btn.getAttribute('data-qa');
      toggleMenu(false);
      openPanel(action);
    });

    // Panel close buttons
    document.querySelectorAll('[data-qa-close]').forEach(function(btn) {
      btn.addEventListener('click', function() { closePanel(); });
    });

    // ---- Search ----
    var searchInput = document.getElementById('qaSearchInput');
    var searchTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function() { runSearch(searchInput.value.trim()); }, 150);
    });

    // ---- Compat autocomplete ----
    setupAutocomplete('qaCompatA', 'qaAcA', function(d) {
      compatDrugA = d; checkCompat();
    });
    setupAutocomplete('qaCompatB', 'qaAcB', function(d) {
      compatDrugB = d; checkCompat();
    });

    // ---- Drip drug selection ----
    document.getElementById('qaDripGrid').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-drip]');
      if (!btn) return;
      selectDripDrug(btn.getAttribute('data-drip'));
    });

    // Drip inputs
    document.getElementById('qaDripWt').addEventListener('input', calcDrip);
    document.getElementById('qaDripDose').addEventListener('input', calcDrip);

    // Keyboard: Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  // ===== DRAG TO REPOSITION =====
  function bindDrag() {
    var fab = document.getElementById('qaFab');
    var wrap = document.getElementById('qaFabWrap');

    // --- Touch (mobile) ---
    fab.addEventListener('touchstart', function(e) {
      if (isOpen || activePanel) return;
      var t = e.touches[0];
      isDragging = true;
      dragMoved = false;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      var rect = wrap.getBoundingClientRect();
      fabStartX = rect.left;
      fabStartY = rect.top;
      wrap.style.transition = 'none';
      // Do NOT preventDefault here — allows tap-to-click to work
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      var t = e.touches[0];
      var dx = t.clientX - dragStartX;
      var dy = t.clientY - dragStartY;
      if (!dragMoved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragMoved = true;
      e.preventDefault(); // prevent scroll only once dragging starts
      moveFab(fabStartX + dx, fabStartY + dy);
    }, { passive: false });

    document.addEventListener('touchend', function() {
      if (!isDragging) return;
      isDragging = false;
      wrap.style.transition = '';
      if (dragMoved) {
        snapToEdge();
        dragMoved = false;
      }
    });

    // --- Mouse (desktop) ---
    fab.addEventListener('mousedown', function(e) {
      if (isOpen || activePanel) return;
      isDragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      var rect = wrap.getBoundingClientRect();
      fabStartX = rect.left;
      fabStartY = rect.top;
      wrap.style.transition = 'none';
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      if (!dragMoved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragMoved = true;
      moveFab(fabStartX + dx, fabStartY + dy);
    });

    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      wrap.style.transition = '';
      if (dragMoved) snapToEdge();
    });

    // Suppress click after drag (both mouse & touch-generated clicks)
    fab.addEventListener('click', function(e) {
      if (dragMoved) {
        e.stopImmediatePropagation();
        e.preventDefault();
        dragMoved = false;
      }
    }, true);

    // Helpers
    function moveFab(x, y) {
      var vw = window.innerWidth, vh = window.innerHeight;
      x = Math.max(0, Math.min(x, vw - 54));
      y = Math.max(0, Math.min(y, vh - 54));
      wrap.style.bottom = 'auto';
      wrap.style.right = 'auto';
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
    }

    function snapToEdge() {
      var rect = wrap.getBoundingClientRect();
      var vw = window.innerWidth;
      var centerX = rect.left + 27;
      var snapX = centerX < vw / 2 ? 16 : vw - 54 - 16;
      var snapY = Math.max(16, Math.min(rect.top, window.innerHeight - 54 - 16));
      wrap.style.left = snapX + 'px';
      wrap.style.top = snapY + 'px';
      saveFabPosition(snapX, snapY);
    }

    // Re-clamp on resize
    window.addEventListener('resize', function() {
      var saved = loadFabPosition();
      if (saved) applyFabPosition(wrap, saved);
    });
  }

  // ===== FAB TOGGLE =====
  function toggleMenu(show) {
    isOpen = show;
    var wrap = document.getElementById('qaFabWrap');
    var fab = document.getElementById('qaFab');
    var bd = document.getElementById('qaBackdrop');
    if (show) {
      wrap.classList.add('qa-open');
      fab.setAttribute('aria-expanded', 'true');
      fab.textContent = '+';
      bd.classList.add('qa-show');
    } else {
      wrap.classList.remove('qa-open');
      fab.setAttribute('aria-expanded', 'false');
      fab.textContent = '⚡';
      bd.classList.remove('qa-show');
    }
  }

  // ===== PANEL OPEN/CLOSE =====
  function openPanel(type) {
    activePanel = type;
    var panelId = type === 'search' ? 'qaSearchPanel' : type === 'compat' ? 'qaCompatPanel' : 'qaDripPanel';
    var panel = document.getElementById(panelId);
    var bd = document.getElementById('qaBackdrop');
    panel.classList.add('qa-panel-show');
    bd.classList.add('qa-show');

    // Autofocus
    if (type === 'search') {
      setTimeout(function() { document.getElementById('qaSearchInput').focus(); }, 350);
    }
  }

  function closePanel() {
    if (!activePanel) return;
    var panelId = activePanel === 'search' ? 'qaSearchPanel' : activePanel === 'compat' ? 'qaCompatPanel' : 'qaDripPanel';
    document.getElementById(panelId).classList.remove('qa-panel-show');
    document.getElementById('qaBackdrop').classList.remove('qa-show');
    var fab = document.getElementById('qaFab');
    fab.setAttribute('aria-expanded', 'false');
    fab.textContent = '⚡';
    activePanel = null;
    isOpen = false;
    document.getElementById('qaFabWrap').classList.remove('qa-open');
  }

  function closeAll() {
    toggleMenu(false);
    closePanel();
  }

  // ===== QUICK SEARCH =====
  function runSearch(q) {
    var el = document.getElementById('qaSearchResults');
    if (!q || q.length < 1) { el.innerHTML = ''; return; }
    var lower = q.toLowerCase();
    var matches = drugs.filter(function(d) {
      return d.g.toLowerCase().indexOf(lower) !== -1 ||
             d.t.toLowerCase().indexOf(lower) !== -1;
    }).slice(0, 6);
    if (matches.length === 0) {
      el.innerHTML = '<div class="qa-search-empty">ไม่พบยาที่ค้นหา</div>';
      return;
    }
    el.innerHTML = matches.map(function(d) {
      var badge = d.h ? '<span class="qa-had-badge">HAD</span>' : '';
      return '<a class="qa-search-item" href="index.html?search=' + encodeURIComponent(d.g) + '">'
        + '<div><div class="qa-search-item-name">' + escHtml(d.g) + '</div>'
        + '<div class="qa-search-item-trade">' + escHtml(d.t) + '</div></div>'
        + badge + '</a>';
    }).join('');
  }

  // ===== COMPATIBILITY CHECK =====
  function setupAutocomplete(inputId, acId, onSelect) {
    var input = document.getElementById(inputId);
    var ac = document.getElementById(acId);
    var timer;
    input.addEventListener('input', function() {
      clearTimeout(timer);
      timer = setTimeout(function() {
        var q = input.value.trim().toLowerCase();
        if (q.length < 1) { ac.classList.remove('qa-ac-show'); return; }
        var matches = drugs.filter(function(d) {
          return d.g.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        if (matches.length === 0) { ac.classList.remove('qa-ac-show'); return; }
        ac.innerHTML = matches.map(function(d) {
          return '<div class="qa-autocomplete-item" data-id="' + d.i + '">' + escHtml(d.g) + '</div>';
        }).join('');
        ac.classList.add('qa-ac-show');
      }, 120);
    });

    ac.addEventListener('click', function(e) {
      var item = e.target.closest('.qa-autocomplete-item');
      if (!item) return;
      var id = parseInt(item.getAttribute('data-id'));
      var d = drugs.find(function(dr) { return dr.i === id; });
      if (d) {
        input.value = d.g;
        onSelect(d);
      }
      ac.classList.remove('qa-ac-show');
    });

    input.addEventListener('blur', function() {
      setTimeout(function() { ac.classList.remove('qa-ac-show'); }, 200);
    });
  }

  function checkCompat() {
    var el = document.getElementById('qaCompatResult');
    if (!compatDrugA || !compatDrugB) { el.classList.remove('qa-show'); return; }
    var result = getCompat(compatDrugA, compatDrugB);
    var cls = 'qa-show ';
    var icon, text;
    switch (result.status) {
      case 'compatible':
        cls += 'qa-compat-ok'; icon = '✅'; text = 'Compatible'; break;
      case 'incompatible':
        cls += 'qa-compat-bad'; icon = '❌'; text = 'Incompatible'; break;
      case 'variable':
        cls += 'qa-compat-warn'; icon = '⚠️'; text = 'Variable'; break;
      default:
        cls += 'qa-compat-unknown'; icon = '❓'; text = 'No data'; break;
    }
    el.className = 'qa-compat-result ' + cls;
    el.innerHTML = '<div>' + icon + ' ' + text + '</div>'
      + '<div class="qa-compat-detail">' + escHtml(result.detail) + '</div>'
      + '<a class="qa-compat-link" href="compatibility.html">ดูรายละเอียดเพิ่มเติม →</a>';
  }

  // ===== DRIP RATE CALCULATOR =====
  function selectDripDrug(id) {
    selectedDripDrug = DRIP_DRUGS.find(function(d) { return d.id === id; });
    if (!selectedDripDrug) return;

    // Highlight selected
    document.querySelectorAll('.qa-drip-drug').forEach(function(btn) {
      btn.classList.toggle('qa-selected', btn.getAttribute('data-drip') === id);
    });

    // Show form
    document.getElementById('qaDripForm').classList.add('qa-show');
    document.getElementById('qaDripUnit').textContent = selectedDripDrug.unit;

    // Hide weight field if not weight-based
    var wtField = document.getElementById('qaDripWt').closest('.qa-drip-field');
    wtField.style.display = selectedDripDrug.weightBased ? '' : 'none';

    // Populate concentrations
    selectedDripConc = 0;
    var concHtml = '';
    selectedDripDrug.concs.forEach(function(c, idx) {
      concHtml += '<button class="qa-drip-conc' + (idx === 0 ? ' qa-selected' : '') + '" data-conc="' + idx + '">' + c.label + '</button>';
    });
    var concRow = document.getElementById('qaDripConcs');
    concRow.innerHTML = concHtml;
    concRow.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-conc]');
      if (!btn) return;
      selectedDripConc = parseInt(btn.getAttribute('data-conc'));
      concRow.querySelectorAll('.qa-drip-conc').forEach(function(b, i) {
        b.classList.toggle('qa-selected', i === selectedDripConc);
      });
      calcDrip();
    });

    // Reset result
    document.getElementById('qaDripResult').classList.remove('qa-show');
    document.getElementById('qaDripDose').value = '';
    document.getElementById('qaDripDose').focus();
  }

  function calcDrip() {
    if (!selectedDripDrug) return;
    var dose = parseFloat(document.getElementById('qaDripDose').value);
    var wt = parseFloat(document.getElementById('qaDripWt').value) || 0;
    var resultEl = document.getElementById('qaDripResult');

    if (!dose || dose <= 0) { resultEl.classList.remove('qa-show'); return; }
    if (selectedDripDrug.weightBased && (!wt || wt <= 0)) { resultEl.classList.remove('qa-show'); return; }

    var conc = selectedDripDrug.concs[selectedDripConc];
    var concMcgPerMl = conc.mgPerMl * 1000; // mg/mL → mcg/mL
    var mlPerHr;

    if (selectedDripDrug.unit === 'mcg/min') {
      // dose in mcg/min → mL/hr = dose * 60 / concMcgPerMl
      mlPerHr = (dose * 60) / concMcgPerMl;
    } else if (selectedDripDrug.unit === 'mcg/kg/min') {
      // dose in mcg/kg/min → mL/hr = dose * wt * 60 / concMcgPerMl
      mlPerHr = (dose * wt * 60) / concMcgPerMl;
    } else if (selectedDripDrug.unit === 'mcg/kg/hr') {
      // dose in mcg/kg/hr → mL/hr = dose * wt / concMcgPerMl
      mlPerHr = (dose * wt) / concMcgPerMl;
    } else if (selectedDripDrug.unit === 'mg/hr') {
      // dose in mg/hr → mL/hr = dose / conc.mgPerMl
      mlPerHr = dose / conc.mgPerMl;
    }

    var rounded = Math.round(mlPerHr * 10) / 10;
    document.getElementById('qaDripRate').textContent = rounded;
    document.getElementById('qaDripDetail').textContent =
      selectedDripDrug.name + ' ' + dose + ' ' + selectedDripDrug.unit +
      (selectedDripDrug.weightBased ? ' (wt ' + wt + ' kg)' : '') +
      ' | ' + conc.label;
    document.getElementById('qaDripRange').textContent = 'Range: ' + selectedDripDrug.range + ' — ' + selectedDripDrug.note;
    resultEl.classList.add('qa-show');
  }

  // ===== UTILITY =====
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

})();
