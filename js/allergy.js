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

  var LEGEND =
    '<div class="ar-legend">' +
      '<span><i class="ar-dot dot-high"></i>แพ้ข้ามสูง</span>' +
      '<span><i class="ar-dot dot-moderate"></i>ปานกลาง</span>' +
      '<span><i class="ar-dot dot-low"></i>ต่ำ</span>' +
      '<span><i class="ar-dot dot-negligible"></i>น้อยมาก</span>' +
    '</div>';

  function render() {
    var report = A.buildReport(allergenSel.value, severitySel.value);
    if (!report) { resultEl.innerHTML = ''; return; }

    var a = report.allergen;
    var sev = report.severity;
    var html = '';

    // header summary
    html += '<div class="info-box blue" style="margin-bottom:14px">' +
      '<strong>กรณี:</strong> แพ้ ' + esc(a.generic) + ' (' + esc(a.th) + ') · ' +
      '<strong>อาการ:</strong> ' + esc(sev.label) +
      '<div style="font-size:12px;margin-top:6px;opacity:.9">' + esc(sev.note) + '</div></div>';

    html += LEGEND;

    if (report.blocked) {
      // SCAR — block all beta-lactams
      html += '<div class="info-box red" style="margin-bottom:14px">' +
        '⛔ <strong>อาการแพ้รุนแรงชนิด SCAR</strong> — หลีกเลี่ยง beta-lactam ' +
        '<strong>ทุกชนิด</strong> และยาที่โครงสร้างใกล้เคียง · ' +
        '<strong>ห้าม</strong> challenge / desensitization · ' +
        'ให้เลือกยานอกกลุ่ม beta-lactam เท่านั้น</div>';
      html += '<div class="ar-group"><div class="ar-group-title ar-avoid-title">' +
        '🚫 หลีกเลี่ยงทั้งหมด <span class="ar-count">(' + report.avoid.length + ' รายการ)</span></div>' +
        report.avoid.map(rowHtml).join('') + '</div>';
    } else {
      if (report.avoid.length) {
        html += '<div class="ar-group"><div class="ar-group-title ar-avoid-title">' +
          '🚫 ควรหลีกเลี่ยง <span class="ar-count">(' + report.avoid.length + ' รายการ)</span></div>' +
          report.avoid.map(rowHtml).join('') + '</div>';
      }
      if (report.safer.length) {
        html += '<div class="ar-group"><div class="ar-group-title ar-safer-title">' +
          '✅ ปลอดภัยกว่า / พิจารณาใช้ได้ <span class="ar-count">(' + report.safer.length + ' รายการ)</span></div>' +
          report.safer.map(rowHtml).join('') + '</div>';
      }
    }

    // always show non-beta-lactam alternatives + references
    html += altHtml();
    html += refsHtml(report);

    resultEl.innerHTML = html;
  }

  function init() {
    allergenSel = document.getElementById('allergenSelect');
    severitySel = document.getElementById('severitySelect');
    resultEl = document.getElementById('allergyResult');
    if (!allergenSel || !severitySel || !resultEl || !A) return;

    populate();
    allergenSel.addEventListener('change', render);
    severitySel.addEventListener('change', render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
