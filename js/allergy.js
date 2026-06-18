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

  var allergenSel, severitySel, resultEl;

  // class -> Thai group label for the <optgroup>s
  var CLASS_LABEL = {
    penicillin: 'Penicillins',
    cephalosporin: 'Cephalosporins',
    carbapenem: 'Carbapenems',
    monobactam: 'Monobactam'
  };
  var CLASS_ORDER = ['penicillin', 'cephalosporin', 'carbapenem', 'monobactam'];

  function populate() {
    // allergen select, grouped by class
    var html = '';
    CLASS_ORDER.forEach(function (cls) {
      var members = A.DRUGS.filter(function (d) { return d.class === cls; });
      if (!members.length) return;
      html += '<optgroup label="' + esc(CLASS_LABEL[cls] || cls) + '">';
      members.forEach(function (d) {
        var label = d.th + ' (' + d.generic + ')';
        html += '<option value="' + esc(d.id) + '">' + esc(label) + '</option>';
      });
      html += '</optgroup>';
    });
    // non-beta-lactam groups (Phase 4.1) — one optgroup per group
    (A.NBL_GROUPS || []).forEach(function (g) {
      html += '<optgroup label="' + esc(g.label) + '">';
      g.allergens.forEach(function (a) {
        html += '<option value="' + esc(a.id) + '">' + esc(a.th + ' (' + a.generic + ')') + '</option>';
      });
      html += '</optgroup>';
    });
    allergenSel.innerHTML = html;

    // severity select
    severitySel.innerHTML = A.SEVERITY.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.label) + '</option>';
    }).join('');

    // sensible defaults
    allergenSel.value = 'amoxicillin';
    severitySel.value = 'ige';
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
    if (!report) { resultEl.innerHTML = ''; return; }

    var a = report.allergen;
    var sev = report.severity;
    var html = '';

    // header summary
    html += '<div class="info-box blue" style="margin-bottom:14px">' +
      '<strong>กรณี:</strong> แพ้ ' + esc(a.generic) + ' (' + esc(a.th) + ') · ' +
      '<strong>อาการ:</strong> ' + esc(sev.label) +
      '<div style="font-size:12px;margin-top:6px;opacity:.9">' + esc(report.severityNote || sev.note) + '</div></div>';

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

  function render() {
    lastReport = A.buildReport(allergenSel.value, severitySel.value);
    paint();
  }

  function init() {
    allergenSel = document.getElementById('allergenSelect');
    severitySel = document.getElementById('severitySelect');
    resultEl = document.getElementById('allergyResult');
    if (!allergenSel || !severitySel || !resultEl || !A) return;

    populate();
    allergenSel.addEventListener('change', render);
    severitySel.addEventListener('change', render);

    // tier filter (show-only), quick presets, and expand/collapse of a card
    resultEl.addEventListener('click', function (e) {
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
