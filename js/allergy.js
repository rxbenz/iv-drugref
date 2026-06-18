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

  function rowHtml(item) {
    var d = item.drug;
    var tierLabel = A.TIERS[item.tier] ? A.TIERS[item.tier].label : item.tier;
    var pct = item.pct ? (' · ' + item.pct) : '';
    var advice = item.advice
      ? '<div class="ar-advice">💡 ' + esc(item.advice) + '</div>'
      : '';
    return '' +
      '<div class="ar-row tier-' + esc(item.tier) + '">' +
        '<div class="ar-row-head">' +
          '<div class="ar-drug">' + esc(d.generic) +
            ' <span class="ar-generic">' + esc(d.th) + ' · ' + esc(classLabel(d)) + '</span></div>' +
          '<span class="ar-badge tier-' + esc(item.tier) + '">' + esc(tierLabel) + esc(pct) + '</span>' +
        '</div>' +
        '<div class="ar-reason">' + esc(item.reason) + '</div>' +
        advice +
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
    collect(report.safer);
    var li = Object.keys(keys)
      .filter(function (k) { return A.REFS[k]; })
      .map(function (k) { return '<li>' + esc(A.REFS[k]) + '</li>'; })
      .join('');
    if (!li) return '';
    return '<details class="ar-refs"><summary>📚 แหล่งอ้างอิงที่ใช้ในผลนี้</summary><ol>' + li + '</ol></details>';
  }

  // ---- tier filter state (all on by default) ----
  var TIER_KEYS = ['high', 'moderate', 'low', 'negligible'];
  var TIER_TH = { high: 'แพ้ข้ามสูง', moderate: 'ปานกลาง', low: 'ต่ำ', negligible: 'น้อยมาก' };
  var activeTiers = { high: true, moderate: true, low: true, negligible: true };

  function controlsHtml() {
    var chips = TIER_KEYS.map(function (t) {
      return '<button type="button" class="ar-legend-chip" data-tier="' + t + '" aria-pressed="' +
        (activeTiers[t] ? 'true' : 'false') + '">' +
        '<i class="ar-dot dot-' + t + '"></i>' + esc(TIER_TH[t]) + '</button>';
    }).join('');
    return '<div class="ar-filter">' +
      '<div class="ar-legend">' + chips + '</div>' +
      '<div class="ar-quick">' +
        '<button type="button" class="ar-quick-btn" data-quick="safe">🟢 เฉพาะปลอดภัย</button>' +
        '<button type="button" class="ar-quick-btn" data-quick="all">แสดงทั้งหมด</button>' +
      '</div>' +
      '<div class="ar-filter-hint">แตะระดับความเสี่ยงเพื่อกรองรายการ (เลือกได้หลายระดับ)</div>' +
    '</div>';
  }

  var lastReport = null;

  // build one group, applying the active-tier filter; '' when nothing shown
  function groupHtml(titleClass, icon, title, items) {
    var shown = items.filter(function (it) { return activeTiers[it.tier]; });
    if (!shown.length) return '';
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
      '<div style="font-size:12px;margin-top:6px;opacity:.9">' + esc(sev.note) + '</div></div>';

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
      html += groupHtml('ar-avoid-title', '🚫', 'ควรหลีกเลี่ยง', report.avoid);
      html += groupHtml('ar-safer-title', '✅', 'ปลอดภัยกว่า / พิจารณาใช้ได้', report.safer);
    }

    // nothing matches the current filter
    var anyShown = report.avoid.concat(report.safer).some(function (it) { return activeTiers[it.tier]; });
    if (!anyShown) {
      html += '<div class="info-box amber">ไม่มีรายการตรงกับตัวกรอง — แตะ “แสดงทั้งหมด” ด้านบน</div>';
    }

    // always show non-beta-lactam alternatives + references
    html += altHtml();
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

    // tier filter: toggle individual chips, or quick "safe"/"all" presets
    resultEl.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('.ar-legend-chip');
      if (chip) {
        var t = chip.getAttribute('data-tier');
        activeTiers[t] = !activeTiers[t];
        paint();
        return;
      }
      var q = e.target.closest && e.target.closest('.ar-quick-btn');
      if (q) {
        var mode = q.getAttribute('data-quick');
        TIER_KEYS.forEach(function (k) { activeTiers[k] = (mode === 'all'); });
        if (mode === 'safe') { activeTiers.low = true; activeTiers.negligible = true; }
        paint();
        return;
      }
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
