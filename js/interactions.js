// ============================================================================
// Drug Interaction (DDI) page — standalone
// ============================================================================
// PHARMACOLOGICAL drug–drug interaction screening. This is a SEPARATE page from
// IV (physical/Y-site) compatibility — different clinical question entirely.
// It reuses the shared drug list (window.COMPAT_DRUGS) and the shared engine
// (window.DrugInteractions, which also pulls admin-managed pairs/class tags from
// Supabase). The picker here is intentionally lightweight: pick ≥2 drugs → screen.
// ============================================================================
(function () {
  'use strict';

  // Shared dataset (extracted to js/compat-drugs.js). Drugs only — fluids/diluents
  // are irrelevant to pharmacological interactions, so drop them.
  var ALL = (window.COMPAT_DRUGS || []).filter(function (d) { return !d.isFluid; });

  var selected = [];   // array of drug ids (d.i)

  // Common ICU / high-alert quick picks (by generic substring) for one-tap add.
  var QUICK = ['Amiodarone', 'Digoxin', 'Vancomycin', 'Gentamicin', 'Furosemide',
    'Ondansetron', 'Haloperidol', 'Fentanyl', 'Midazolam', 'Norepinephrine',
    'Enoxaparin', 'Heparin', 'Phenytoin', 'Linezolid', 'Ciprofloxacin'];

  function byId(id) { return ALL.find(function (d) { return d.i === id; }); }
  function esc(s) { return (window.IVDrugRef && IVDrugRef.escHtml) ? IVDrugRef.escHtml(s) : String(s == null ? '' : s); }

  // ── Search suggestions ──────────────────────────────────────────────
  function renderSuggestions(q) {
    var box = document.getElementById('ddiSuggestions');
    if (!box) return;
    q = (q || '').trim().toLowerCase();
    if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
    var hits = ALL.filter(function (d) {
      return selected.indexOf(d.i) < 0 &&
        ((d.g || '').toLowerCase().indexOf(q) >= 0 || (d.t || '').toLowerCase().indexOf(q) >= 0);
    }).slice(0, 12);
    if (!hits.length) { box.innerHTML = '<div class="ddi-sg-empty">ไม่พบยา</div>'; box.style.display = 'block'; return; }
    box.innerHTML = hits.map(function (d) {
      return '<div class="ddi-sg-item" data-action="ddiPick" data-id="' + d.i + '">' +
        '<b>' + esc(d.g) + '</b>' + (d.h ? ' <span class="ddi-sg-alert">⚠️</span>' : '') +
        (d.t ? '<span class="ddi-sg-trade">' + esc(d.t) + '</span>' : '') + '</div>';
    }).join('');
    box.style.display = 'block';
  }

  function renderChips() {
    var wrap = document.getElementById('ddiQuickChips');
    if (!wrap) return;
    wrap.innerHTML = QUICK.map(function (name) {
      var d = ALL.find(function (x) { return (x.g || '').toLowerCase().indexOf(name.toLowerCase()) === 0; });
      if (!d || selected.indexOf(d.i) >= 0) return '';
      return '<button class="ddi-chip" data-action="ddiPick" data-id="' + d.i + '">' + esc(d.g) + '</button>';
    }).join('');
  }

  function renderSelected() {
    var wrap = document.getElementById('ddiSelected');
    if (!wrap) return;
    if (!selected.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = selected.map(function (id) {
      var d = byId(id); if (!d) return '';
      return '<span class="ddi-pill">' + esc(d.g) +
        ' <button class="ddi-pill-x" data-action="ddiRemove" data-id="' + id + '" aria-label="ลบ">×</button></span>';
    }).join('');
  }

  // ── Results ─────────────────────────────────────────────────────────
  function renderResults() {
    var container = document.getElementById('ddiResults');
    if (!container) return;
    var drugs = selected.map(byId).filter(Boolean);
    if (drugs.length < 2) {
      container.innerHTML = '<p class="check-hint">💊 เพิ่มยา <b>≥2 ตัว</b> เพื่อตรวจอันตรกิริยาระหว่างยา (DDI)</p>';
      return;
    }
    var genericList = drugs.map(function (d) { return d.g; });
    container.innerHTML = window.DrugInteractions ? window.DrugInteractions.renderHtml(genericList) : '';

    if (typeof IVDrugRef !== 'undefined' && IVDrugRef.sendAnalytics) {
      var findings = (window.DrugInteractions && window.DrugInteractions.check)
        ? window.DrugInteractions.check(genericList) : [];
      var classes = findings.filter(function (f) { return f.cls; }).map(function (f) { return f.cls; });
      var sevRank = { major: 3, moderate: 2, minor: 1 };
      var topSeverity = findings.reduce(function (top, f) {
        return (sevRank[f.severity] || 0) > (sevRank[top] || 0) ? f.severity : top;
      }, '');
      IVDrugRef.sendAnalytics({
        type: 'ddi_check', drugs_count: drugs.length, findings_count: findings.length,
        classes: classes.join(','), top_severity: topSeverity || 'none'
      });
    }
  }

  function refreshAll() { renderChips(); renderSelected(); renderResults(); }

  function addDrug(id) {
    if (selected.indexOf(id) < 0) selected.push(id);
    var inp = document.getElementById('ddiSearch'); if (inp) inp.value = '';
    var box = document.getElementById('ddiSuggestions'); if (box) { box.innerHTML = ''; box.style.display = 'none'; }
    refreshAll();
  }
  function removeDrug(id) { selected = selected.filter(function (x) { return x !== id; }); refreshAll(); }
  function clearAll() { selected = []; refreshAll(); }

  // ── Init ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    refreshAll();

    // Re-render when admin-managed DDI data finishes syncing from Supabase.
    if (window.DrugInteractions) window.DrugInteractions.onUpdate = function () {
      try { renderResults(); } catch (e) { /* not mounted */ }
    };

    // Deep-link: ?drug=Name (e.g. from a drug card cross-link) preselects one drug.
    try {
      var q = new URLSearchParams(location.search).get('drug') || new URLSearchParams(location.search).get('search');
      if (q) {
        var ql = q.trim().toLowerCase();
        var hit = ALL.find(function (d) {
          var g = (d.g || '').toLowerCase();
          return g === ql || g.indexOf(ql) === 0;
        });
        if (hit) addDrug(hit.i);
      }
    } catch (e) { /* ignore */ }

    if (window.IVDrugRef && IVDrugRef.delegate) {
      IVDrugRef.delegate(document, 'click', {
        ddiPick: function (e, t) { addDrug(+t.dataset.id); },
        ddiRemove: function (e, t) { removeDrug(+t.dataset.id); },
        ddiClear: function () { clearAll(); }
      });
    }
    var search = document.getElementById('ddiSearch');
    if (search) {
      search.addEventListener('input', function () { renderSuggestions(this.value); });
      // Enter picks the first suggestion
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var first = document.querySelector('#ddiSuggestions .ddi-sg-item');
          if (first) { e.preventDefault(); addDrug(+first.dataset.id); }
        }
      });
    }
    // Close suggestions on outside click
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#ddiSearchWrap')) {
        var box = document.getElementById('ddiSuggestions'); if (box) box.style.display = 'none';
      }
    });
  });
})();
