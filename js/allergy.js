/* allergy.js — Cross-reactivity page UI (Phase 3)
 *
 * Wires the two <select>s to the pure engine in js/allergy-data.js
 * (window.AllergyData) and renders the grouped result. All dynamic strings
 * go through IVDrugRef.escHtml() per the project XSS convention (P3.1) — even
 * though the data is developer-controlled today, this page may later read
 * GAS/Sheet-authored data.
 */
(function () {
  'use strict';

  var A = window.AllergyData;
  var esc = (window.IVDrugRef && window.IVDrugRef.escHtml)
    ? window.IVDrugRef.escHtml
    : function (s) { return String(s == null ? '' : s); };

  var severitySel, resultEl;
  // allergen picker (hybrid: search + group chips + list)
  var selectEl, chipsEl, searchEl, clearEl;
  var ALLERGENS = [], GROUPS = [], pkList = [];
  var selectedId = '', pq = '', pg = 'all', pkbd = -1, pickerOpen = false;

  // class -> Thai group label for the <optgroup>s
  var CLASS_LABEL = {
    penicillin: 'Penicillins',
    cephalosporin: 'Cephalosporins',
    carbapenem: 'Carbapenems',
    monobactam: 'Monobactam'
  };
  var CLASS_ORDER = ['penicillin', 'cephalosporin', 'carbapenem', 'monobactam'];

  function populateSeverity() {
    severitySel.innerHTML = A.SEVERITY.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.label) + '</option>';
    }).join('');
    severitySel.value = 'ige';
  }

  // ---- allergen picker ----------------------------------------------------
  // Flatten beta-lactam (by class) + non-beta-lactam groups into one searchable
  // list, plus the group chips (with counts).
  function buildPickerData() {
    ALLERGENS = [];
    GROUPS = [{ id: 'all', label: 'ทั้งหมด' }];
    CLASS_ORDER.forEach(function (cls) {
      var m = A.DRUGS.filter(function (d) { return d.class === cls; });
      if (!m.length) return;
      GROUPS.push({ id: cls, label: CLASS_LABEL[cls] || cls });
      m.forEach(function (d) {
        ALLERGENS.push({ id: d.id, generic: d.generic, th: d.th, gid: cls, glabel: CLASS_LABEL[cls] || cls });
      });
    });
    (A.NBL_GROUPS || []).forEach(function (g) {
      GROUPS.push({ id: g.id, label: g.label });
      g.allergens.forEach(function (a) {
        ALLERGENS.push({ id: a.id, generic: a.generic, th: a.th, gid: g.id, glabel: g.label });
      });
    });
  }

  function itemById(id) {
    for (var i = 0; i < ALLERGENS.length; i++) if (ALLERGENS[i].id === id) return ALLERGENS[i];
    return null;
  }
  function displayText(id) { var it = itemById(id); return it ? (it.th + ' (' + it.generic + ')') : ''; }

  function renderChips() {
    chipsEl.innerHTML = GROUPS.map(function (g) {
      var n = (g.id === 'all') ? ALLERGENS.length
        : ALLERGENS.filter(function (x) { return x.gid === g.id; }).length;
      return '<button type="button" class="ap-chip" data-g="' + esc(g.id) + '" aria-pressed="' +
        (pg === g.id ? 'true' : 'false') + '">' + esc(g.label) +
        ' <span class="ap-n">' + n + '</span></button>';
    }).join('');
  }

  // search text match (Thai or English substring)
  function matchPq(x) {
    var q = pq.trim();
    if (!q) return true;
    return x.generic.toLowerCase().indexOf(q.toLowerCase()) >= 0 || x.th.indexOf(q) >= 0;
  }

  // Build the drug dropdown, filtered by the active group chip (pg) AND the
  // search box (pq). When the group is "ทั้งหมด" the options are grouped with
  // <optgroup> so all drugs stay navigable; otherwise only the chosen group's
  // drugs are listed. The search box narrows the list further.
  function renderSelect() {
    function optFor(x) {
      return '<option value="' + esc(x.id) + '">' + esc(x.th + ' (' + x.generic + ')') + '</option>';
    }
    var opts = '<option value="">— เลือกยาที่ผู้ป่วยแพ้ —</option>', any = false;
    if (pg === 'all') {
      GROUPS.forEach(function (g) {
        if (g.id === 'all') return;
        var items = ALLERGENS.filter(function (x) { return x.gid === g.id && matchPq(x); });
        if (items.length) { opts += '<optgroup label="' + esc(g.label) + '">' + items.map(optFor).join('') + '</optgroup>'; any = true; }
      });
    } else {
      var its = ALLERGENS.filter(function (x) { return x.gid === pg && matchPq(x); });
      if (its.length) { opts += its.map(optFor).join(''); any = true; }
    }
    if (!any) opts += '<option value="" disabled>— ไม่พบยา —</option>';
    selectEl.innerHTML = opts;
    selectEl.value = itemById(selectedId) ? selectedId : '';
  }

  // Open the native dropdown programmatically (modern browsers). Must be called
  // from a user gesture (e.g. a chip click) — silently ignored where unsupported.
  function openDropdown() {
    try { if (selectEl.showPicker) selectEl.showPicker(); } catch (e) { /* unsupported */ }
  }

  function pickId(id) {
    selectedId = id || '';
    renderSelect();
    render(true);   // recompute report (user-initiated → logged)
  }

  function classLabel(d) {
    return CLASS_LABEL[d.class] || d.class;
  }

  // R1 side-chain description for the expand panel
  function clusterText(d) {
    if (d.unique) return 'side chain ไม่ซ้ำกับ beta-lactam อื่น (จึงแพ้ข้ามต่ำมาก)';
    if (d.cluster && A.CLUSTERS[d.cluster]) return A.CLUSTERS[d.cluster].label;
    return 'ไม่อยู่ในกลุ่ม R1 ที่ใช้จับคู่';
  }

  // one "label: value" line for the detail panel
  function dl(label, value) {
    if (!value) return '';
    return '<div class="ar-dl"><span class="ar-dl-k">' + esc(label) + '</span>' +
      '<span class="ar-dl-v">' + value + '</span></div>';
  }

  // expandable detail (hidden until the card is opened)
  function detailHtml(item) {
    var d = item.drug;
    var trade = (d.trade && d.trade.length) ? esc(d.trade.join(', ')) : '—';
    var pctLine = esc(item.pct || '');
    if (item.pctCI) pctLine += ' <span class="ar-muted">(95% CI ~' + esc(item.pctCI) + '%)</span>';
    var refLis = (item.refs || [])
      .filter(function (k) { return A.REFS[k]; })
      .map(function (k) { return '<li>' + esc(A.REFS[k]) + '</li>'; }).join('');
    var refBlock = refLis ? '<ol class="ar-dl-refs">' + refLis + '</ol>' : '';
    return '<div class="ar-detail">' +
      dl('ชื่อการค้า', trade) +
      dl('กลุ่มยา', esc(classLabel(d))) +
      ((d.unique || 'cluster' in d) ? dl('R1 side chain', esc(clusterText(d))) : '') +
      dl('โอกาสแพ้ข้าม', pctLine) +
      dl('เหตุผล', esc(item.reason)) +
      (item.advice ? dl('คำแนะนำ', '💡 ' + esc(item.advice)) : '') +
      (refBlock ? dl('อ้างอิง', refBlock) : '') +
    '</div>';
  }

  // collapsed card = drug name + risk badge + caret; click to expand
  function rowHtml(item) {
    var d = item.drug;
    var tierLabel = A.TIERS[item.tier] ? A.TIERS[item.tier].label : item.tier;
    var pct = item.pct ? (' · ' + item.pct) : '';
    return '' +
      '<div class="ar-row tier-' + esc(item.tier) + '">' +
        '<div class="ar-row-head" role="button" tabindex="0" aria-expanded="false">' +
          '<div class="ar-drug">' + esc(d.generic) +
            ' <span class="ar-generic">' + esc(d.th) + ' · ' + esc(classLabel(d)) + '</span></div>' +
          '<div class="ar-head-right">' +
            '<span class="ar-badge tier-' + esc(item.tier) + '">' + esc(tierLabel) + esc(pct) + '</span>' +
            '<span class="ar-caret" aria-hidden="true">▾</span>' +
          '</div>' +
        '</div>' +
        detailHtml(item) +
      '</div>';
  }

  function altHtml() {
    var items = A.NON_BETA_LACTAM.map(function (g) {
      return '<div class="ar-alt-item"><span class="ar-alt-class">' + esc(g.class) + '</span>' +
        '<span class="ar-alt-drugs">' + esc(g.drugs.join(', ')) + '</span></div>';
    }).join('');
    return '<div class="section">' +
      '<div class="section-header">🟢 ทางเลือกนอกกลุ่ม beta-lactam (ไม่มีปัญหาแพ้ข้าม)</div>' +
      '<div class="ar-alt">' + items + '</div></div>';
  }

  // collect the unique reference keys appearing in a report, render <details>
  function refsHtml(report) {
    var keys = {};
    function collect(list) {
      (list || []).forEach(function (it) {
        (it.refs || []).forEach(function (k) { keys[k] = true; });
      });
    }
    collect(report.avoid);
    collect(report.caution);
    collect(report.safer);
    var li = Object.keys(keys)
      .filter(function (k) { return A.REFS[k]; })
      .map(function (k) { return '<li>' + esc(A.REFS[k]) + '</li>'; })
      .join('');
    if (!li) return '';
    return '<details class="ar-refs"><summary>📚 แหล่งอ้างอิงที่ใช้ในผลนี้</summary><ol>' + li + '</ol></details>';
  }

  // ---- tier filter state ----
  // filter === null  => show all (default); otherwise an array of tiers to show
  var TIER_TH = { high: 'แพ้ข้ามสูง', moderate: 'ปานกลาง', low: 'ต่ำ', negligible: 'น้อยมาก' };
  var RISK_RANK = { negligible: 0, low: 1, moderate: 2, high: 3 };   // safest -> riskiest
  var CHIP_ORDER = ['negligible', 'low', 'moderate', 'high'];        // safest first
  var filter = null;

  function isShown(tier) { return filter === null || filter.indexOf(tier) >= 0; }

  function controlsHtml() {
    var chips = CHIP_ORDER.map(function (t) {
      var on = (filter !== null && filter.indexOf(t) >= 0);
      return '<button type="button" class="ar-legend-chip" data-tier="' + t + '" aria-pressed="' +
        (on ? 'true' : 'false') + '">' +
        '<i class="ar-dot dot-' + t + '"></i>' + esc(TIER_TH[t]) + '</button>';
    }).join('');
    return '<div class="ar-filter">' +
      '<div class="ar-legend">' + chips + '</div>' +
      '<div class="ar-quick">' +
        '<button type="button" class="ar-quick-btn" data-quick="safe">🟢 เฉพาะปลอดภัย</button>' +
        '<button type="button" class="ar-quick-btn" data-quick="all"' +
          (filter === null ? ' disabled' : '') + '>แสดงทั้งหมด</button>' +
      '</div>' +
      '<div class="ar-filter-hint">แตะระดับความเสี่ยงเพื่อแสดงเฉพาะระดับนั้น (แตะซ้ำ = แสดงทั้งหมด)</div>' +
    '</div>';
  }

  var lastReport = null;

  // ---- share / export ----------------------------------------------------
  var SITE_URL = 'https://rxbenz.github.io/iv-drugref/';
  function tierLabelOf(item) {
    return A.TIERS[item.tier] ? A.TIERS[item.tier].label : item.tier;
  }

  function actionsHtml() {
    return '<div class="ar-actions">' +
      '<button type="button" class="ar-act-btn" data-act="copy">📋 คัดลอก</button>' +
      '<button type="button" class="ar-act-btn" data-act="line">💬 LINE</button>' +
      '<button type="button" class="ar-act-btn" data-act="pdf">🖨️ PDF</button>' +
    '</div>';
  }

  // plain-text version (for clipboard / LINE)
  function buildShareText(report) {
    var a = report.allergen, sev = report.severity;
    var L = ['🛡️ ผลตรวจแพ้ข้ามยา — IV DrugRef',
      'แพ้: ' + a.generic + ' (' + a.th + ')',
      'อาการ: ' + sev.label];
    if (report.calloutNote) L.push('', report.calloutNote);
    function block(title, items) {
      if (!items || !items.length) return;
      L.push('', title);
      items.forEach(function (it) {
        L.push('• ' + it.drug.generic + ' (' + it.drug.th + ') — ' +
          tierLabelOf(it) + (it.pct ? ' ' + it.pct : ''));
      });
    }
    block('🚫 ควรหลีกเลี่ยง:', report.avoid);
    block('⚠️ ใช้ด้วยความระมัดระวัง:', report.caution);
    block('✅ ปลอดภัยกว่า:', report.safer);
    if (report.nonBetaLactam) {
      L.push('', '🟢 ทางเลือกนอกกลุ่ม beta-lactam:');
      report.nonBetaLactam.forEach(function (g) { L.push('• ' + g.class + ': ' + g.drugs.join(', ')); });
    }
    L.push('', '⚠️ เครื่องมือช่วยประเมินเบื้องต้น — ใช้ clinical judgment ประกอบ', SITE_URL);
    return L.join('\n');
  }

  // HTML version (for print-to-PDF); all dynamic strings escaped (printReport is
  // an HTML passthrough — never feed it raw strings)
  function printGroupHtml(title, items) {
    if (!items || !items.length) return '';
    var rows = items.map(function (it) {
      var d = it.drug;
      return '<li><strong>' + esc(d.generic) + '</strong> (' + esc(d.th) + ') — ' +
        esc(tierLabelOf(it)) + (it.pct ? ' ' + esc(it.pct) : '') +
        (it.reason ? '<br><span style="color:#64748b;font-size:11px">' + esc(it.reason) + '</span>' : '') +
        '</li>';
    }).join('');
    return '<div style="margin-bottom:10px"><div style="font-weight:600;font-size:13px;margin-bottom:4px">' +
      esc(title) + '</div><ul style="margin:0;padding-left:18px;font-size:12px">' + rows + '</ul></div>';
  }

  function doPrint(report) {
    var SE = window.IVDrugRef && window.IVDrugRef.ShareExport;
    if (!SE) return;
    var a = report.allergen, sev = report.severity;
    var patientHtml = '<div style="font-size:13px"><strong>แพ้:</strong> ' +
      esc(a.generic) + ' (' + esc(a.th) + ')<br><strong>อาการ:</strong> ' + esc(sev.label) + '</div>';
    var results = '';
    if (report.calloutNote) {
      results += '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;' +
        'padding:8px;font-size:12px;margin-bottom:10px">' + esc(report.calloutNote) + '</div>';
    }
    results += printGroupHtml('🚫 ควรหลีกเลี่ยง', report.avoid);
    results += printGroupHtml('⚠️ ใช้ด้วยความระมัดระวัง', report.caution);
    results += printGroupHtml('✅ ปลอดภัยกว่า', report.safer);
    if (report.nonBetaLactam) {
      var alt = report.nonBetaLactam.map(function (g) {
        return '<li>' + esc(g.class) + ': ' + esc(g.drugs.join(', ')) + '</li>';
      }).join('');
      results += '<div style="margin-bottom:10px"><div style="font-weight:600;font-size:13px;margin-bottom:4px">' +
        '🟢 ทางเลือกนอกกลุ่ม beta-lactam</div><ul style="margin:0;padding-left:18px;font-size:12px">' + alt + '</ul></div>';
    }
    SE.printReport({
      title: '🛡️ ผลตรวจแพ้ข้ามยา',
      patientHtml: patientHtml,
      resultsHtml: results,
      analytics: { page: 'allergy', drug: a.generic }
    });
  }

  function handleAction(act) {
    if (!lastReport) return;
    var SE = window.IVDrugRef && window.IVDrugRef.ShareExport;
    var ana = { page: 'allergy', drug: lastReport.allergen.generic };
    if (act === 'copy') { if (SE) SE.copyText(buildShareText(lastReport), ana); }
    else if (act === 'line') { if (SE) SE.shareToLine(buildShareText(lastReport), ana); }
    else if (act === 'pdf') { doPrint(lastReport); }
  }

  // build one group, applying the active-tier filter; '' when nothing shown
  function groupHtml(titleClass, icon, title, items) {
    var shown = items.filter(function (it) { return isShown(it.tier); });
    if (!shown.length) return '';
    // safest -> riskiest within the group
    shown.sort(function (x, y) { return RISK_RANK[x.tier] - RISK_RANK[y.tier]; });
    var countTxt = shown.length + (shown.length !== items.length ? ' จาก ' + items.length : '') + ' รายการ';
    return '<div class="ar-group"><div class="ar-group-title ' + titleClass + '">' +
      icon + ' ' + title + ' <span class="ar-count">(' + countTxt + ')</span></div>' +
      shown.map(rowHtml).join('') + '</div>';
  }

  function paint() {
    var report = lastReport;
    if (!report) {
      resultEl.innerHTML = '<div class="info-box blue" style="text-align:center">' +
        '🔍 พิมพ์ชื่อยาที่ผู้ป่วยแพ้ในช่องด้านบน แล้วเลือกจากรายการ ' +
        'เพื่อดูคำแนะนำการแพ้ข้ามยาและทางเลือกที่ปลอดภัย</div>';
      return;
    }

    var a = report.allergen;
    var sev = report.severity;
    var html = '';

    // header summary
    html += '<div class="info-box blue" style="margin-bottom:14px">' +
      '<strong>กรณี:</strong> แพ้ ' + esc(a.generic) + ' (' + esc(a.th) + ') · ' +
      '<strong>อาการ:</strong> ' + esc(sev.label) +
      '<div style="font-size:12px;margin-top:6px;opacity:.9">' + esc(report.severityNote || sev.note) + '</div></div>';

    html += actionsHtml();

    // prominent callout (e.g. NSAID single-drug vs cross-reactive distinction)
    if (report.calloutNote) {
      html += '<div class="info-box amber" style="margin-bottom:14px">' +
        esc(report.calloutNote) + '</div>';
    }

    html += controlsHtml();

    if (report.blocked) {
      // SCAR — block all beta-lactams
      html += '<div class="info-box red" style="margin-bottom:14px">' +
        '⛔ <strong>อาการแพ้รุนแรงชนิด SCAR</strong> — หลีกเลี่ยง beta-lactam ' +
        '<strong>ทุกชนิด</strong> และยาที่โครงสร้างใกล้เคียง · ' +
        '<strong>ห้าม</strong> challenge / desensitization · ' +
        'ให้เลือกยานอกกลุ่ม beta-lactam เท่านั้น</div>';
      html += groupHtml('ar-avoid-title', '🚫', 'หลีกเลี่ยงทั้งหมด', report.avoid);
    } else {
      // safest first: safer -> caution -> avoid
      html += groupHtml('ar-safer-title', '✅', 'ปลอดภัยกว่า / พิจารณาใช้ได้', report.safer);
      html += groupHtml('ar-caution-title', '⚠️', 'ใช้ด้วยความระมัดระวัง', report.caution || []);
      html += groupHtml('ar-avoid-title', '🚫', 'ควรหลีกเลี่ยง', report.avoid);
    }

    // nothing matches the current filter
    var anyShown = report.avoid.concat(report.caution || [], report.safer)
      .some(function (it) { return isShown(it.tier); });
    if (!anyShown) {
      html += '<div class="info-box amber">ไม่มีรายการตรงกับตัวกรอง — แตะ “แสดงทั้งหมด” ด้านบน</div>';
    }

    // beta-lactam reports list non-beta-lactam alternatives; NBL reports already
    // name their safe options, so skip the generic alternatives box there
    if (report.nonBetaLactam) html += altHtml();
    html += refsHtml(report);

    resultEl.innerHTML = html;
  }

  function render(userInitiated) {
    lastReport = A.buildReport(selectedId, severitySel.value);
    paint();
    if (userInitiated) logLookup();
  }

  // Analytics: log a cross-reactivity lookup (allergen + severity chosen by the
  // user). Fires only on explicit actions (pick allergen / change severity), not
  // on the initial auto-render, so the dashboard counts real usage. Mirrors the
  // canonical IVDrugRef.sendAnalytics({type, ...}) convention used by other pages.
  function logLookup() {
    try {
      var r = lastReport;
      var IV = window.IVDrugRef;
      if (!r || !IV || !IV.sendAnalytics) return;
      IV.sendAnalytics({
        type: 'ALLERGY_LOOKUP',
        allergen_id: selectedId,
        allergen_name: (r.allergen && r.allergen.generic) || selectedId,
        group: (r.allergen && r.allergen.class) || '',
        severity: severitySel ? severitySel.value : '',
        avoid_count: (r.avoid || []).length,
        caution_count: (r.caution || []).length,
        safer_count: (r.safer || []).length,
        blocked: !!r.blocked
      });
    } catch (e) { /* analytics must never break the page */ }
  }

  // A3: pull admin-edited allergy data from the Sheet (via GAS), with a
  // localStorage cache for offline and a silent fallback to the hardcoded
  // defaults when offline / GAS not deployed / empty sheet.
  var ALLERGY_CACHE_KEY = 'allergyData_v1';

  function applyAndRerender(d) {
    if (!A.applyRemoteData || !A.applyRemoteData(d)) return false;
    buildPickerData();
    if (selectedId && !itemById(selectedId)) selectedId = '';   // dropped by a remote edit
    renderChips();
    renderSelect();
    render();   // re-render report (not user-initiated -> not logged)
    return true;
  }

  function loadRemoteAllergyData() {
    // 1) apply cached copy immediately (works offline)
    try {
      var cached = localStorage.getItem(ALLERGY_CACHE_KEY);
      if (cached) applyAndRerender(JSON.parse(cached));
    } catch (e) { /* ignore bad cache */ }
    // 2) refresh from network
    var IV = window.IVDrugRef;
    var base = IV && IV.getAdminGasUrl && IV.getAdminGasUrl();
    if (!base) return;
    fetch(base + '?action=allergydata')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && (d.groups || d.refs) && applyAndRerender(d)) {
          try { localStorage.setItem(ALLERGY_CACHE_KEY, JSON.stringify(d)); } catch (e) {}
        }
      })
      .catch(function () { /* offline / not deployed -> keep hardcoded defaults */ });
  }

  function init() {
    severitySel = document.getElementById('severitySelect');
    resultEl = document.getElementById('allergyResult');
    chipsEl = document.getElementById('allergenChips');
    selectEl = document.getElementById('allergenSelect');
    searchEl = document.getElementById('allergenSearch');
    clearEl = document.getElementById('allergenClear');
    if (!severitySel || !resultEl || !chipsEl || !selectEl || !A) return;

    // page-view analytics (enter/leave with duration) — same as other pages
    if (window.IVDrugRef && window.IVDrugRef.trackPageView) {
      window.IVDrugRef.trackPageView('allergy');
    }

    populateSeverity();
    buildPickerData();
    renderChips();
    renderSelect();   // dropdown of drugs, filtered by the active group chip

    severitySel.addEventListener('change', function () { render(true); });

    // --- allergen picker: search box + group chips both filter the dropdown ---
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        pq = searchEl.value;
        if (clearEl) clearEl.style.display = pq ? 'block' : 'none';
        renderSelect();
      });
    }
    if (clearEl) {
      clearEl.addEventListener('click', function () {
        pq = ''; searchEl.value = ''; clearEl.style.display = 'none';
        renderSelect(); searchEl.focus();
      });
    }
    chipsEl.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('.ap-chip');
      if (!c) return;
      pg = c.getAttribute('data-g');
      renderChips();
      renderSelect();   // re-filter the dropdown to the chosen group
      openDropdown();    // auto-open the dropdown so the drugs show immediately
    });
    selectEl.addEventListener('change', function () { pickId(selectEl.value); });

    // tier filter (show-only), quick presets, and expand/collapse of a card
    resultEl.addEventListener('click', function (e) {
      var actBtn = e.target.closest && e.target.closest('.ar-act-btn');
      if (actBtn) { handleAction(actBtn.getAttribute('data-act')); return; }
      var chip = e.target.closest && e.target.closest('.ar-legend-chip');
      if (chip) {
        var t = chip.getAttribute('data-tier');
        // clicking the sole active tier again clears the filter (show all)
        filter = (filter && filter.length === 1 && filter[0] === t) ? null : [t];
        paint();
        return;
      }
      var q = e.target.closest && e.target.closest('.ar-quick-btn');
      if (q) {
        filter = (q.getAttribute('data-quick') === 'safe') ? ['low', 'negligible'] : null;
        paint();
        return;
      }
      var head = e.target.closest && e.target.closest('.ar-row-head');
      if (head) { toggleCard(head); }
    });

    // keyboard: Enter/Space expands the focused card header
    resultEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var head = e.target.closest && e.target.closest('.ar-row-head');
      if (head) { e.preventDefault(); toggleCard(head); }
    });

    render();
    loadRemoteAllergyData();   // A3: override with Sheet-authored data if available
  }

  function toggleCard(head) {
    var row = head.parentNode;
    var open = row.classList.toggle('open');
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
