/* allergy.js — Cross-reactivity page UI (multi-drug)
 *
 * Multi-allergen: the user adds SEVERAL culprit drugs, each with its own
 * severity / reaction-nature / NSAID-phenotype. The page aggregates their
 * single-allergen reports via AllergyData.buildMultiReport() (worst-wins per
 * target drug) and can answer the clinician's real question — "the patient is
 * allergic to A, B, C … can they use <candidate>?".
 *
 * All dynamic strings go through IVDrugRef.escHtml() per the project XSS
 * convention (P3.1) — this page reads GAS/Sheet-authored data via Supabase.
 */
(function () {
  'use strict';

  var A = window.AllergyData;
  var esc = (window.IVDrugRef && window.IVDrugRef.escHtml)
    ? window.IVDrugRef.escHtml
    : function (s) { return String(s == null ? '' : s); };

  // ---- state --------------------------------------------------------------
  var selected = [];        // [{ id, severity, nature, phenotype }] — drugs the patient is allergic to
  var candidateKey = null;  // canonical key of the "check this drug" candidate (or null)
  var candidateItem = null; // { key, generic, th } display for the candidate pill
  var lastReport = null;    // last buildMultiReport() result
  var multiCtx = false;     // true when ≥2 allergens selected (drivers UI shown)
  var resultEl;

  // allergen picker (search + group chips + list)
  var pickerEl, searchEl, chipsEl, listEl, clearEl, selectedListEl;
  var ALLERGENS = [], GROUPS = [], pkList = [];
  var pq = '', pg = 'all', pkbd = -1, pickerOpen = false;

  // candidate picker (search + list + selected pill)
  var candPickerEl, candSearchEl, candListEl, candClearEl, candSelEl;
  var UNIVERSE = [], cq = '', ckbd = -1, candOpen = false, cList = [];

  var CLASS_LABEL = { penicillin: 'Penicillins', cephalosporin: 'Cephalosporins', carbapenem: 'Carbapenems', monobactam: 'Monobactam' };
  var CLASS_ORDER = ['penicillin', 'cephalosporin', 'carbapenem', 'monobactam'];

  function phenotypeGroupFor(id) {
    var ref = A.NBL_INDEX && A.NBL_INDEX[id];
    return (ref && ref.group && ref.group.phenotypes) ? ref.group : null;
  }
  function defaultPhenotype(id) {
    var g = phenotypeGroupFor(id);
    return g ? (g.phenotypeDefault || (g.phenotypes[0] && g.phenotypes[0].id) || '') : '';
  }

  function classLabel(d) { return CLASS_LABEL[d.class] || d.class || ''; }
  function clusterText(d) {
    if (d.unique) return 'side chain ไม่ซ้ำกับ beta-lactam อื่น (จึงแพ้ข้ามต่ำมาก)';
    if (d.cluster && A.CLUSTERS[d.cluster]) return A.CLUSTERS[d.cluster].label;
    return 'ไม่อยู่ในกลุ่ม R1 ที่ใช้จับคู่';
  }
  function dl(label, value) {
    if (!value) return '';
    return '<div class="ar-dl"><span class="ar-dl-k">' + esc(label) + '</span><span class="ar-dl-v">' + value + '</span></div>';
  }
  function hi(text, q) {
    text = String(text == null ? '' : text);
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  // ===== allergen picker ====================================================
  function buildPickerData() {
    ALLERGENS = [];
    GROUPS = [{ id: 'all', label: 'ทั้งหมด' }];
    CLASS_ORDER.forEach(function (cls) {
      var m = A.DRUGS.filter(function (d) { return d.class === cls; });
      if (!m.length) return;
      GROUPS.push({ id: cls, label: CLASS_LABEL[cls] || cls });
      m.forEach(function (d) { ALLERGENS.push({ id: d.id, generic: d.generic, th: d.th, trade: d.trade || [], gid: cls, glabel: CLASS_LABEL[cls] || cls }); });
    });
    (A.NBL_GROUPS || []).forEach(function (g) {
      GROUPS.push({ id: g.id, label: g.label });
      g.allergens.forEach(function (a) { ALLERGENS.push({ id: a.id, generic: a.generic, th: a.th, trade: a.trade || [], gid: g.id, glabel: g.label }); });
    });
  }
  function allergenById(id) { for (var i = 0; i < ALLERGENS.length; i++) if (ALLERGENS[i].id === id) return ALLERGENS[i]; return null; }

  function renderChips() {
    chipsEl.innerHTML = GROUPS.map(function (g) {
      var n = (g.id === 'all') ? ALLERGENS.length : ALLERGENS.filter(function (x) { return x.gid === g.id; }).length;
      return '<button type="button" class="ap-chip" data-g="' + esc(g.id) + '" aria-pressed="' +
        (pg === g.id ? 'true' : 'false') + '">' + esc(g.label) + ' <span class="ap-n">' + n + '</span></button>';
    }).join('');
  }
  function setChipActive() {
    var btns = chipsEl.querySelectorAll('.ap-chip');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-g') === pg ? 'true' : 'false');
  }
  function filteredAllergens() {
    var q = pq.trim().toLowerCase(), qth = pq.trim();
    return ALLERGENS.filter(function (x) {
      if (pg !== 'all' && x.gid !== pg) return false;
      if (!q) return true;
      // Search generic + Thai + TRADE names + id, so "Bactrim"/"cotrimoxazole"/
      // "Rocephin"/"Cipro" resolve (the picker is the only way in — a missed
      // match = no cross-reactivity warning at all).
      if (x.generic.toLowerCase().indexOf(q) >= 0 || x.th.indexOf(qth) >= 0) return true;
      if (x.id && x.id.toLowerCase().indexOf(q) >= 0) return true;
      return (x.trade || []).some(function (tr) { return String(tr).toLowerCase().indexOf(q) >= 0; });
    });
  }
  function renderList() {
    if (searchEl) searchEl.setAttribute('aria-expanded', pickerOpen ? 'true' : 'false');
    if (!pickerOpen) { listEl.style.display = 'none'; pkList = []; return; }
    listEl.style.display = 'block';
    if (pg === 'all' && !pq.trim()) { listEl.innerHTML = '<div class="ap-empty">🔎 พิมพ์ชื่อยา หรือเลือกกลุ่มยาด้านบน</div>'; pkList = []; return; }
    pkList = filteredAllergens();
    if (!pkList.length) { listEl.innerHTML = '<div class="ap-empty">ไม่พบยา — ลองพิมพ์อย่างอื่น</div>'; return; }
    var html = '', lastG = null;
    pkList.forEach(function (x, idx) {
      var isSel = selected.some(function (s) { return s.id === x.id; });
      if (x.gid !== lastG) { html += '<div class="ap-grp">' + esc(x.glabel) + '</div>'; lastG = x.gid; }
      html += '<div class="ap-opt' + (idx === pkbd ? ' kbd' : '') + (isSel ? ' on' : '') + '" data-id="' + esc(x.id) + '" role="option">' +
        '<span class="ap-nm">' + hi(x.th, pq) + ' <span class="ap-en">' + hi(x.generic, pq) + '</span></span>' +
        '<span class="ap-tag">' + (isSel ? '✓ เพิ่มแล้ว' : esc(x.glabel)) + '</span></div>';
    });
    listEl.innerHTML = html;
  }
  function scrollKbd(el) { var k = el.querySelector('.kbd'); if (k && k.scrollIntoView) k.scrollIntoView({ block: 'nearest' }); }

  function addAllergen(id) {
    if (!id) return;
    if (!selected.some(function (s) { return s.id === id; })) {
      selected.push({ id: id, severity: 'ige', nature: 'allergy', phenotype: defaultPhenotype(id) });
    }
    pickerOpen = false; pq = '';
    if (searchEl) searchEl.value = '';
    if (clearEl) clearEl.style.display = 'none';
    renderList();
    renderSelectedList();
    render(true);
  }
  function removeAllergen(idx) {
    if (isNaN(idx) || !selected[idx]) return;
    selected.splice(idx, 1);
    renderSelectedList();
    renderList();
    render(true);
  }

  // ===== selected-allergen cards (per-drug severity / nature / phenotype) ===
  function severityOptions(val) {
    return A.SEVERITY.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === val ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
  }
  function natureOptions(val) {
    return [['allergy', 'แพ้จริง / สงสัยแพ้'], ['intolerance', 'ผลข้างเคียง / ไม่ทนยา']].map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  function renderSelectedList() {
    if (!selectedListEl) return;
    if (!selected.length) {
      selectedListEl.innerHTML = '<div class="al-empty">ยังไม่ได้เลือกยาที่แพ้ — ค้นหาด้านบนแล้วแตะเพื่อเพิ่ม (เพิ่มได้หลายตัว)</div>';
      return;
    }
    selectedListEl.innerHTML = '<div class="al-list-title">ยาที่แพ้ (' + selected.length + ')</div>' +
      selected.map(function (s, i) {
        var it = allergenById(s.id) || { generic: s.id, th: '', glabel: '' };
        var intol = s.nature === 'intolerance';
        var g = phenotypeGroupFor(s.id);
        var phenoHtml = (g && !intol) ?
          '<label class="al-ctl"><span>' + esc(g.phenotypeLabel || 'ลักษณะการแพ้') + '</span><select data-act="al-phenotype" data-idx="' + i + '">' +
          g.phenotypes.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === s.phenotype ? ' selected' : '') + '>' + esc(p.label) + '</option>'; }).join('') +
          '</select></label>' : '';
        return '<div class="al-card">' +
          '<div class="al-card-head">' +
            '<span class="al-card-name">' + esc(it.generic) + ' <small>' + esc(it.th) + (it.glabel ? ' · ' + esc(it.glabel) : '') + '</small></span>' +
            '<button type="button" class="al-card-x" data-act="al-remove" data-idx="' + i + '" aria-label="ลบยานี้">✕</button>' +
          '</div>' +
          '<div class="al-card-controls">' +
            '<label class="al-ctl"><span>ลักษณะปฏิกิริยา</span><select data-act="al-nature" data-idx="' + i + '">' + natureOptions(s.nature) + '</select></label>' +
            (intol ? '' : '<label class="al-ctl"><span>ความรุนแรง</span><select data-act="al-severity" data-idx="' + i + '">' + severityOptions(s.severity) + '</select></label>') +
            phenoHtml +
          '</div>' +
        '</div>';
      }).join('');
  }

  // ===== candidate picker ("can they use X?") ===============================
  // Candidate universe = every allergy-DB drug (allergens + targets, canonical
  // keys) PLUS the shared IV-drug list (window.COMPAT_DRUGS, ~167 drugs) so the
  // user can check ANY drug, not only ones in the allergy tables. Compat-only
  // drugs get an 'nm:' key; buildMultiReport's candidate lookup then reports them
  // as "not related → presumed usable" when they don't touch any selected allergy.
  function buildUniverse() {
    UNIVERSE = A.drugUniverse ? A.drugUniverse().slice() : [];
    var norm = A.normName || function (s) { return String(s == null ? '' : s).split('(')[0].toLowerCase().trim(); };
    var seen = {};
    UNIVERSE.forEach(function (u) { seen[norm(u.generic)] = true; });
    (window.COMPAT_DRUGS || []).forEach(function (d) {
      var g = d.g || d.generic; if (!g) return;
      var nk = norm(g);
      if (!nk || seen[nk]) return;
      seen[nk] = true;
      UNIVERSE.push({ key: 'nm:' + nk, generic: g, th: '', glabel: 'ยาอื่น ๆ (นอกฐานแพ้ยา)' });
    });
  }
  function candByKey(key) { for (var i = 0; i < UNIVERSE.length; i++) if (UNIVERSE[i].key === key) return UNIVERSE[i]; return null; }
  function filteredCandidates() {
    var q = cq.trim().toLowerCase(), qth = cq.trim();
    if (!q) return [];
    return UNIVERSE.filter(function (x) {
      return x.generic.toLowerCase().indexOf(q) >= 0 || (x.th && x.th.indexOf(qth) >= 0);
    }).slice(0, 40);
  }
  function renderCandidateList() {
    if (candSearchEl) candSearchEl.setAttribute('aria-expanded', candOpen ? 'true' : 'false');
    if (!candOpen) { candListEl.style.display = 'none'; cList = []; return; }
    candListEl.style.display = 'block';
    if (!cq.trim()) { candListEl.innerHTML = '<div class="ap-empty">🔎 พิมพ์ชื่อยาที่อยากตรวจ (เช่น parecoxib)</div>'; cList = []; return; }
    cList = filteredCandidates();
    if (!cList.length) { candListEl.innerHTML = '<div class="ap-empty">ไม่พบยา — ลองพิมพ์อย่างอื่น</div>'; return; }
    var html = '', lastG = null;
    cList.forEach(function (x, idx) {
      if (x.glabel !== lastG) { html += '<div class="ap-grp">' + esc(x.glabel || 'อื่น ๆ') + '</div>'; lastG = x.glabel; }
      html += '<div class="ap-opt' + (idx === ckbd ? ' kbd' : '') + (x.key === candidateKey ? ' on' : '') + '" data-key="' + esc(x.key) + '" role="option">' +
        '<span class="ap-nm">' + hi(x.th, cq) + ' <span class="ap-en">' + hi(x.generic, cq) + '</span></span>' +
        '<span class="ap-tag">' + esc(x.glabel || '') + '</span></div>';
    });
    candListEl.innerHTML = html;
  }
  function pickCandidate(key) {
    var it = candByKey(key); if (!it) return;
    candidateKey = it.key; candidateItem = it;
    candOpen = false; cq = '';
    if (candSearchEl) candSearchEl.value = '';
    if (candClearEl) candClearEl.style.display = 'none';
    renderCandidateList(); renderCandidatePill();
    render(true);
  }
  function clearCandidate() {
    candidateKey = null; candidateItem = null; cq = ''; ckbd = -1;
    if (candSearchEl) candSearchEl.value = '';
    if (candClearEl) candClearEl.style.display = 'none';
    renderCandidatePill(); renderCandidateList();
    render(false);
  }
  function renderCandidatePill() {
    if (!candSelEl) return;
    if (!candidateItem) { candSelEl.style.display = 'none'; candSelEl.innerHTML = ''; return; }
    candSelEl.innerHTML =
      '<span class="aps-check" aria-hidden="true">🎯</span>' +
      '<span class="aps-label">ตรวจ:</span>' +
      '<span class="aps-name">' + esc(candidateItem.generic) + (candidateItem.th ? ' <small>(' + esc(candidateItem.th) + ')</small>' : '') + '</span>' +
      '<button type="button" class="aps-change" data-act="cand-clear">ล้าง</button>';
    candSelEl.style.display = 'flex';
  }

  // ===== result rendering ===================================================
  var TIER_TH = { high: 'แพ้ข้ามสูง', moderate: 'ปานกลาง', low: 'ต่ำ', negligible: 'น้อยมาก' };
  var RISK_RANK = { negligible: 0, low: 1, moderate: 2, high: 3 };
  var CHIP_ORDER = ['negligible', 'low', 'moderate', 'high'];
  var filter = null;
  function isShown(tier) { return filter === null || filter.indexOf(tier) >= 0; }
  function tierLabelOf(item) { return A.TIERS[item.tier] ? A.TIERS[item.tier].label : item.tier; }

  var BUCKET_TH = { avoid: '🚫 เลี่ยง', caution: '⚠️ ระวัง', safer: '✅ ปลอดภัยกว่า' };

  // "↳ จากการแพ้: Aspirin · Ciprofloxacin" line on the collapsed card (multi only)
  function driversLine(item) {
    if (!multiCtx || !item.drivers || !item.drivers.length) return '';
    var names = item.drivers.map(function (d) { return esc(d.allergenName) + (d.self ? ' (แพ้เอง)' : ''); });
    return '<div class="ar-drivers">↳ จากการแพ้: ' + names.join(' · ') + '</div>';
  }
  // per-allergen breakdown inside the expanded detail (only when genuinely aggregated)
  function driversDetail(item) {
    if (!item.drivers || item.drivers.length < 2) return '';
    var rows = item.drivers.map(function (d) {
      var tl = d.self ? 'ยาที่แพ้เอง' : (A.TIERS[d.tier] ? A.TIERS[d.tier].label : d.tier);
      var bk = BUCKET_TH[d.bucket] || d.bucket;
      return '<li><strong>' + esc(d.allergenName) + '</strong>: ' + bk + ' — ' + esc(tl) + (d.pct ? ' · ' + esc(d.pct) : '') +
        (d.reason ? '<br><span class="ar-muted">' + esc(d.reason) + '</span>' : '') + '</li>';
    }).join('');
    return dl('รายละเอียดต่อยาที่แพ้', '<ul class="ar-driver-list">' + rows + '</ul>');
  }

  function detailHtml(item) {
    var d = item.drug;
    var trade = (d.trade && d.trade.length) ? esc(d.trade.join(', ')) : '';
    var pctLine = esc(item.pct || '');
    if (item.pctCI) pctLine += ' <span class="ar-muted">(95% CI ~' + esc(item.pctCI) + '%)</span>';
    var refLis = (item.refs || []).filter(function (k) { return A.REFS[k]; }).map(function (k) { return '<li>' + esc(A.REFS[k]) + '</li>'; }).join('');
    var refBlock = refLis ? '<ol class="ar-dl-refs">' + refLis + '</ol>' : '';
    return '<div class="ar-detail">' +
      (trade ? dl('ชื่อการค้า', trade) : '') +
      (d.class ? dl('กลุ่มยา', esc(classLabel(d))) : '') +
      ((d.unique || (d && 'cluster' in d)) ? dl('R1 side chain', esc(clusterText(d))) : '') +
      (pctLine ? dl('โอกาสแพ้ข้าม', pctLine) : '') +
      (item.reason ? dl('เหตุผล', esc(item.reason)) : '') +
      (item.advice ? dl('คำแนะนำ', '💡 ' + esc(item.advice)) : '') +
      driversDetail(item) +
      (refBlock ? dl('อ้างอิง', refBlock) : '') +
    '</div>';
  }
  function rowHtml(item) {
    var d = item.drug;
    var tierLabel = A.TIERS[item.tier] ? A.TIERS[item.tier].label : item.tier;
    var pct = item.pct ? (' · ' + item.pct) : '';
    return '<div class="ar-row tier-' + esc(item.tier) + '">' +
      '<div class="ar-row-head" role="button" tabindex="0" aria-expanded="false">' +
        '<div class="ar-drug">' + esc(d.generic) +
          ' <span class="ar-generic">' + esc(d.th) + (d.class ? ' · ' + esc(classLabel(d)) : '') + '</span>' + driversLine(item) + '</div>' +
        '<div class="ar-head-right">' +
          '<span class="ar-badge tier-' + esc(item.tier) + '">' + esc(tierLabel) + esc(pct) + '</span>' +
          '<span class="ar-caret" aria-hidden="true">▾</span>' +
        '</div>' +
      '</div>' +
      detailHtml(item) +
    '</div>';
  }
  function groupHtml(titleClass, icon, title, items) {
    var shown = (items || []).filter(function (it) { return isShown(it.tier); });
    if (!shown.length) return '';
    shown.sort(function (x, y) { return RISK_RANK[x.tier] - RISK_RANK[y.tier]; });
    var countTxt = shown.length + (shown.length !== items.length ? ' จาก ' + items.length : '') + ' รายการ';
    return '<div class="ar-group"><div class="ar-group-title ' + titleClass + '">' +
      icon + ' ' + title + ' <span class="ar-count">(' + countTxt + ')</span></div>' +
      shown.map(rowHtml).join('') + '</div>';
  }
  function controlsHtml() {
    var chips = CHIP_ORDER.map(function (t) {
      var on = (filter !== null && filter.indexOf(t) >= 0);
      return '<button type="button" class="ar-legend-chip" data-tier="' + t + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<i class="ar-dot dot-' + t + '"></i>' + esc(TIER_TH[t]) + '</button>';
    }).join('');
    return '<div class="ar-filter"><div class="ar-legend">' + chips + '</div>' +
      '<div class="ar-quick">' +
        '<button type="button" class="ar-quick-btn" data-quick="safe">🟢 เฉพาะปลอดภัย</button>' +
        '<button type="button" class="ar-quick-btn" data-quick="all"' + (filter === null ? ' disabled' : '') + '>แสดงทั้งหมด</button>' +
      '</div>' +
      '<div class="ar-filter-hint">แตะระดับความเสี่ยงเพื่อแสดงเฉพาะระดับนั้น (แตะซ้ำ = แสดงทั้งหมด)</div></div>';
  }

  function actionsHtml() {
    return '<div class="ar-actions">' +
      '<button type="button" class="ar-act-btn" data-act="copy">📋 คัดลอก</button>' +
      '<button type="button" class="ar-act-btn" data-act="line">💬 LINE</button>' +
      '<button type="button" class="ar-act-btn" data-act="pdf">🖨️ PDF</button>' +
    '</div>';
  }
  function caseSummaryHtml(report) {
    var chips = report.allergens.map(function (al) {
      var extra = al.nature === 'intolerance' ? 'ไม่ทนยา' : (al.severity && al.severity.label) || '';
      return '<span class="al-sum-chip">' + esc(al.meta.generic) + (extra ? ' <small>· ' + esc(extra) + '</small>' : '') + '</span>';
    }).join('');
    // per-allergen phenotype/subtype management guidance (NSAID NERD/SNIDR…,
    // heparin HIT/DTH/immediate…) — surfaced from report.allergens[].phenotypeNote
    var pnotes = report.allergens.filter(function (al) { return al.phenotypeNote; }).map(function (al) {
      return '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border,#e2e8f0);font-size:12px;line-height:1.55">' +
        '🧭 <strong>' + esc(al.meta.generic) + ':</strong> ' + esc(al.phenotypeNote) + '</div>';
    }).join('');
    return '<div class="info-box blue al-summary" style="margin-bottom:14px">' +
      '<strong>ผู้ป่วยแพ้ ' + report.allergens.length + ' รายการ:</strong>' +
      '<div class="al-sum-chips">' + chips + '</div>' + pnotes + '</div>';
  }
  // Prominent SCAR safety banner — when ANY selected allergen is a SCAR-severity
  // reaction (SJS/TEN/DRESS/AGEP), the whole related class is contraindicated and
  // challenge/desensitization is forbidden. The per-allergen reports already route
  // this correctly into "avoid"; this banner surfaces the emphatic warning that the
  // single-drug view showed but the aggregate view otherwise wouldn't.
  function scarBannerHtml(report) {
    var scar = report.allergens.filter(function (al) { return al.severity && al.severity.blockAllBetaLactam; });
    if (!scar.length) return '';
    var names = scar.map(function (al) { return esc(al.meta.generic) + (al.meta.th ? ' (' + esc(al.meta.th) + ')' : ''); }).join(' · ');
    return '<div class="info-box red" style="margin-bottom:14px">' +
      '⛔ <strong>อาการแพ้รุนแรงชนิด SCAR</strong> (' + names + ') — ' +
      'หลีกเลี่ยงยาในกลุ่มที่เกี่ยวข้อง<strong>ทั้งหมด</strong>และยาที่โครงสร้างใกล้เคียง · ' +
      '<strong>ห้าม</strong> challenge / desensitization เด็ดขาด · ปรึกษาผู้เชี่ยวชาญด้านภูมิแพ้ยาก่อนตัดสินใจใช้ยาที่เกี่ยวข้อง</div>';
  }
  function candVerdictText(c) {
    return ({ avoid: '🚫 ควรหลีกเลี่ยง', caution: '⚠️ ใช้ด้วยความระมัดระวัง',
      safer: '✅ น่าจะใช้ได้ (ปลอดภัยกว่า)', unknown: 'ℹ️ ไม่พบความสัมพันธ์การแพ้ข้าม (โดยหลักการใช้ได้)' })[c.bucket] || c.bucket;
  }
  function candidateBannerHtml(c) {
    var map = { avoid: 'red', caution: 'amber', safer: 'green', unknown: 'blue' };
    var cls = map[c.bucket] || 'blue';
    var h = '<div class="info-box ' + cls + ' cand-banner" style="margin-bottom:14px">' +
      '<div class="cand-head">🎯 <strong>' + esc(c.name) + (c.th ? ' (' + esc(c.th) + ')' : '') + '</strong> → ' + esc(candVerdictText(c)) + '</div>';
    var lines = [];
    (c.drivers || []).forEach(function (d) {
      var bk = d.self ? 'ยาตัวเดียวกับที่แพ้' : (BUCKET_TH[d.bucket] || d.bucket);
      lines.push('<li>เทียบกับ <strong>' + esc(d.allergenName) + '</strong>: ' + bk +
        (d.pct ? ' — ' + esc(d.pct) : '') +
        (d.reason ? ' <span class="ar-muted">(' + esc(d.reason) + ')</span>' : '') +
        (d.advice ? '<div class="cand-advice">💡 ' + esc(d.advice) + '</div>' : '') + '</li>');
    });
    (c.unrelated || []).forEach(function (name) {
      lines.push('<li>เทียบกับ <strong>' + esc(name) + '</strong>: <span class="ar-muted">— ไม่เกี่ยวข้อง</span></li>');
    });
    if (lines.length) h += '<ul class="cand-lines">' + lines.join('') + '</ul>';
    if (c.bucket === 'unknown') h += '<div class="cand-note">ยานี้ไม่อยู่ในกลุ่มเสี่ยงของยาที่ผู้ป่วยแพ้ → โดยหลักการใช้ได้ แต่ยังต้องซักประวัติการแพ้โดยตรงและใช้ clinical judgment</div>';
    h += '<div class="cand-note">⚠️ ประเมินเบื้องต้น — ยืนยันด้วยการซักประวัติและดุลพินิจทางคลินิกเสมอ</div></div>';
    return h;
  }
  function intoleranceHtml(n) {
    var h = '<div class="info-box blue" style="margin-bottom:10px"><strong>' + esc(n.allergen.generic) + '</strong> — ระบุเป็น “ผลข้างเคียง/ไม่ทนยา” (ไม่ใช่การแพ้ทางภูมิคุ้มกัน)</div>';
    if (n.pseudo) h += pseudoHtml(n.pseudo);
    else if (n.advisory) h += '<div class="info-box green" style="margin-bottom:10px">✅ ' + esc(n.advisory) + '</div>';
    if (n.caveat) h += '<div class="info-box amber" style="margin-bottom:10px">' + esc(n.caveat) + '</div>';
    return h;
  }
  function pseudoHtml(p) {
    var h = '<div class="info-box green" style="margin-bottom:14px"><strong>🛠️ ' + esc(p.title || 'การจัดการ (non-immune)') + '</strong>';
    if (p.points && p.points.length) {
      h += '<ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.7">' +
        p.points.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    }
    h += '</div>';
    if (p.premed && p.premed.length) {
      h += '<div class="info-box amber" style="margin-bottom:14px"><strong>💉 Premedication</strong>';
      if (p.premedNote) h += '<div style="font-size:12px;margin:6px 0 8px;opacity:.9">' + esc(p.premedNote) + '</div>';
      h += '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">' +
        p.premed.map(function (r) { return '<li><strong>' + esc(r.when) + ':</strong> ' + esc(r.what) + '</li>'; }).join('') + '</ul></div>';
    }
    return h;
  }
  function refsHtmlMulti(report) {
    var li = (report.refs || []).filter(function (k) { return A.REFS[k]; }).map(function (k) { return '<li>' + esc(A.REFS[k]) + '</li>'; }).join('');
    if (!li) return '';
    return '<details class="ar-refs"><summary>📚 แหล่งอ้างอิงที่ใช้ในผลนี้</summary><ol>' + li + '</ol></details>';
  }

  function paint() {
    var report = lastReport;
    if (!report || !report.allergens.length) {
      resultEl.innerHTML = '<div class="info-box blue" style="text-align:center">' +
        '🔍 เพิ่มยาที่ผู้ป่วยแพ้ (เพิ่มได้หลายตัว) เพื่อดูคำแนะนำการแพ้ข้ามยารวมทุกตัว · ' +
        'จะกรอก “ยาที่อยากตรวจ” เพื่อถามว่าใช้ได้ไหมก็ได้</div>';
      return;
    }
    var html = '';
    if (report.candidate) html += candidateBannerHtml(report.candidate);
    html += caseSummaryHtml(report);
    html += scarBannerHtml(report);
    html += actionsHtml();
    (report.intoleranceNotes || []).forEach(function (n) { html += intoleranceHtml(n); });
    html += controlsHtml();
    html += groupHtml('ar-safer-title', '✅', 'ปลอดภัยกว่า / พิจารณาใช้ได้', report.safer);
    html += groupHtml('ar-caution-title', '⚠️', 'ใช้ด้วยความระมัดระวัง', report.caution);
    html += groupHtml('ar-avoid-title', '🚫', 'ควรหลีกเลี่ยง', report.avoid);
    var anyShown = report.avoid.concat(report.caution, report.safer).some(function (it) { return isShown(it.tier); });
    var hasAny = report.avoid.length + report.caution.length + report.safer.length > 0;
    if (hasAny && !anyShown) html += '<div class="info-box amber">ไม่มีรายการตรงกับตัวกรอง — แตะ “แสดงทั้งหมด” ด้านบน</div>';
    if (!hasAny) html += '<div class="info-box amber">ไม่มีข้อมูลแพ้ข้ามในฐานข้อมูลสำหรับยาที่เลือก — ใช้ clinical judgment + ซักประวัติประกอบ</div>';
    html += refsHtmlMulti(report);
    resultEl.innerHTML = html;
  }

  function render(userInitiated) {
    multiCtx = selected.length > 1;
    // pass the universe item (carries the display name); falls back to the key
    lastReport = A.buildMultiReport(selected, candidateItem || candidateKey);
    paint();
    if (userInitiated) logLookup();
  }

  // ---- share / export ------------------------------------------------------
  var SITE_URL = 'https://rxbenz.github.io/iv-drugref/';
  function buildShareText(report) {
    var L = ['🛡️ ผลตรวจแพ้ข้ามยา (หลายตัว) — IV DrugRef'];
    L.push('แพ้: ' + report.allergens.map(function (al) {
      return al.meta.generic + (al.nature === 'intolerance' ? ' (ไม่ทนยา)' : ' (' + al.severity.label + ')');
    }).join(', '));
    if (report.candidate) {
      var c = report.candidate;
      L.push('', '🎯 ตรวจ ' + c.name + ': ' + candVerdictText(c));
      (c.drivers || []).forEach(function (d) {
        L.push('   • เทียบ ' + d.allergenName + ': ' + (d.self ? 'ยาตัวเดียวกับที่แพ้' : (BUCKET_TH[d.bucket] || d.bucket)) + (d.pct ? ' ' + d.pct : ''));
      });
    }
    function block(title, items) {
      if (!items || !items.length) return;
      L.push('', title);
      items.forEach(function (it) {
        L.push('• ' + it.drug.generic + (it.drug.th ? ' (' + it.drug.th + ')' : '') + ' — ' + tierLabelOf(it) + (it.pct ? ' ' + it.pct : '') +
          (multiCtx && it.drivers && it.drivers.length ? ' [จาก: ' + it.drivers.map(function (d) { return d.allergenName; }).join(', ') + ']' : ''));
      });
    }
    block('🚫 ควรหลีกเลี่ยง:', report.avoid);
    block('⚠️ ใช้ด้วยความระมัดระวัง:', report.caution);
    block('✅ ปลอดภัยกว่า:', report.safer);
    L.push('', '⚠️ เครื่องมือช่วยประเมินเบื้องต้น — ใช้ clinical judgment ประกอบ', SITE_URL);
    return L.join('\n');
  }
  function printGroupHtml(title, items) {
    if (!items || !items.length) return '';
    var rows = items.map(function (it) {
      var d = it.drug;
      return '<li><strong>' + esc(d.generic) + '</strong>' + (d.th ? ' (' + esc(d.th) + ')' : '') + ' — ' +
        esc(tierLabelOf(it)) + (it.pct ? ' ' + esc(it.pct) : '') +
        (it.reason ? '<br><span style="color:#64748b;font-size:11px">' + esc(it.reason) + '</span>' : '') + '</li>';
    }).join('');
    return '<div style="margin-bottom:10px"><div style="font-weight:600;font-size:13px;margin-bottom:4px">' +
      esc(title) + '</div><ul style="margin:0;padding-left:18px;font-size:12px">' + rows + '</ul></div>';
  }
  function doPrint(report) {
    var SE = window.IVDrugRef && window.IVDrugRef.ShareExport;
    if (!SE) return;
    var patientHtml = '<div style="font-size:13px"><strong>แพ้:</strong> ' +
      report.allergens.map(function (al) { return esc(al.meta.generic) + ' (' + esc(al.nature === 'intolerance' ? 'ไม่ทนยา' : al.severity.label) + ')'; }).join(', ') + '</div>';
    var results = '';
    if (report.candidate) {
      results += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px;font-size:12px;margin-bottom:10px">' +
        '<strong>🎯 ตรวจ ' + esc(report.candidate.name) + ':</strong> ' + esc(candVerdictText(report.candidate)) + '</div>';
    }
    results += printGroupHtml('🚫 ควรหลีกเลี่ยง', report.avoid);
    results += printGroupHtml('⚠️ ใช้ด้วยความระมัดระวัง', report.caution);
    results += printGroupHtml('✅ ปลอดภัยกว่า', report.safer);
    SE.printReport({ title: '🛡️ ผลตรวจแพ้ข้ามยา (หลายตัว)', patientHtml: patientHtml, resultsHtml: results,
      analytics: { page: 'allergy', drug: report.allergens.map(function (al) { return al.meta.generic; }).join('+') } });
  }
  function handleAction(act) {
    if (!lastReport) return;
    var SE = window.IVDrugRef && window.IVDrugRef.ShareExport;
    var ana = { page: 'allergy', drug: lastReport.allergens.map(function (al) { return al.meta.generic; }).join('+') };
    if (act === 'copy') { if (SE) SE.copyText(buildShareText(lastReport), ana); }
    else if (act === 'line') { if (SE) SE.shareToLine(buildShareText(lastReport), ana); }
    else if (act === 'pdf') { doPrint(lastReport); }
  }

  // ---- analytics -----------------------------------------------------------
  function logLookup() {
    try {
      var r = lastReport, IV = window.IVDrugRef;
      if (!r || !IV || !IV.sendAnalytics || !r.allergens.length) return;
      IV.sendAnalytics({
        type: 'ALLERGY_LOOKUP',
        allergen_ids: selected.map(function (s) { return s.id; }).join(','),
        allergen_count: selected.length,
        candidate: candidateItem ? candidateItem.generic : '',
        candidate_bucket: r.candidate ? r.candidate.bucket : '',
        avoid_count: (r.avoid || []).length,
        caution_count: (r.caution || []).length,
        safer_count: (r.safer || []).length
      });
    } catch (e) { /* analytics must never break the page */ }
  }

  // ---- remote (Supabase) data ---------------------------------------------
  var ALLERGY_CACHE_KEY = 'allergyData_v1';
  function applyAndRerender(d) {
    if (!A.applyRemoteData || !A.applyRemoteData(d)) return false;
    buildPickerData();
    buildUniverse();
    // drop any selected allergen / candidate that a remote edit removed
    selected = selected.filter(function (s) { return allergenById(s.id); });
    if (candidateKey && !candByKey(candidateKey)) { candidateKey = null; candidateItem = null; }
    renderChips();
    renderList();
    renderSelectedList();
    renderCandidatePill();
    render(false);
    return true;
  }
  function loadRemoteAllergyData() {
    var SB_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';
    var SB_KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';
    var H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
    Promise.all([
      fetch(SB_URL + '/rest/v1/allergy_groups?select=data', { headers: H, cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch(SB_URL + '/rest/v1/allergy_refs?select=data', { headers: H, cache: 'no-store' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      var groups = Array.isArray(res[0]) ? res[0].map(function (x) { return x.data; }).filter(Boolean) : [];
      var refs = Array.isArray(res[1]) ? res[1].map(function (x) { return x.data; }).filter(Boolean) : [];
      var d = { groups: groups, refs: refs };
      if ((groups.length || refs.length) && applyAndRerender(d)) {
        try { localStorage.setItem(ALLERGY_CACHE_KEY, JSON.stringify(d)); } catch (e) {}
      }
    }).catch(function () {
      try { var cached = localStorage.getItem(ALLERGY_CACHE_KEY); if (cached) applyAndRerender(JSON.parse(cached)); } catch (e) {}
    });
  }

  function toggleCard(head) {
    var row = head.parentNode;
    var open = row.classList.toggle('open');
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function init() {
    resultEl = document.getElementById('allergyResult');
    pickerEl = document.getElementById('allergenPicker');
    chipsEl = document.getElementById('allergenChips');
    listEl = document.getElementById('allergenList');
    searchEl = document.getElementById('allergenSearch');
    clearEl = document.getElementById('allergenClear');
    selectedListEl = document.getElementById('allergenSelectedList');
    candPickerEl = document.getElementById('candidatePicker');
    candSearchEl = document.getElementById('candidateSearch');
    candListEl = document.getElementById('candidateList');
    candClearEl = document.getElementById('candidateClear');
    candSelEl = document.getElementById('candidateSelected');
    if (!resultEl || !chipsEl || !listEl || !searchEl || !selectedListEl || !A) return;

    if (window.IVDrugRef && window.IVDrugRef.trackPageView) window.IVDrugRef.trackPageView('allergy');

    buildPickerData();
    buildUniverse();
    renderChips();
    renderList();
    renderSelectedList();
    renderCandidatePill();

    // --- allergen picker events ---
    searchEl.addEventListener('focus', function () { pickerOpen = true; renderList(); });
    searchEl.addEventListener('input', function () {
      pq = searchEl.value; pkbd = -1; pickerOpen = true;
      clearEl.style.display = pq ? 'block' : 'none';
      renderList();
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); pickerOpen = true; pkbd = Math.min(pkbd + 1, pkList.length - 1); renderList(); scrollKbd(listEl); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); pkbd = Math.max(pkbd - 1, 0); renderList(); scrollKbd(listEl); }
      else if (e.key === 'Enter') { e.preventDefault(); var it = pkList[pkbd < 0 ? 0 : pkbd]; if (it) addAllergen(it.id); }
      else if (e.key === 'Escape') { pickerOpen = false; renderList(); searchEl.blur(); }
    });
    clearEl.addEventListener('click', function () {
      pq = ''; searchEl.value = ''; clearEl.style.display = 'none'; pickerOpen = true; pkbd = -1;
      renderList(); searchEl.focus();
    });
    chipsEl.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('.ap-chip');
      if (!c) return;
      e.stopPropagation();
      pg = c.getAttribute('data-g'); pkbd = -1; pickerOpen = true;
      setChipActive(); renderList(); searchEl.focus();
    });
    listEl.addEventListener('mousedown', function (e) {
      var o = e.target.closest && e.target.closest('.ap-opt');
      if (o) { e.preventDefault(); addAllergen(o.getAttribute('data-id')); }
    });

    // --- selected-allergen card events (per-drug controls + remove) ---
    selectedListEl.addEventListener('change', function (e) {
      var el = e.target, act = el.getAttribute && el.getAttribute('data-act');
      if (!act) return;
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      if (isNaN(idx) || !selected[idx]) return;
      if (act === 'al-severity') selected[idx].severity = el.value;
      else if (act === 'al-phenotype') selected[idx].phenotype = el.value;
      else if (act === 'al-nature') { selected[idx].nature = el.value; renderSelectedList(); }
      render(true);
    });
    selectedListEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act="al-remove"]');
      if (b) removeAllergen(parseInt(b.getAttribute('data-idx'), 10));
    });

    // --- candidate picker events ---
    if (candSearchEl) {
      candSearchEl.addEventListener('focus', function () { candOpen = true; renderCandidateList(); });
      candSearchEl.addEventListener('input', function () {
        cq = candSearchEl.value; ckbd = -1; candOpen = true;
        if (candClearEl) candClearEl.style.display = cq ? 'block' : 'none';
        renderCandidateList();
      });
      candSearchEl.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); candOpen = true; ckbd = Math.min(ckbd + 1, cList.length - 1); renderCandidateList(); scrollKbd(candListEl); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); ckbd = Math.max(ckbd - 1, 0); renderCandidateList(); scrollKbd(candListEl); }
        else if (e.key === 'Enter') { e.preventDefault(); var it = cList[ckbd < 0 ? 0 : ckbd]; if (it) pickCandidate(it.key); }
        else if (e.key === 'Escape') { candOpen = false; renderCandidateList(); candSearchEl.blur(); }
      });
    }
    if (candClearEl) candClearEl.addEventListener('click', function () {
      cq = ''; candSearchEl.value = ''; candClearEl.style.display = 'none'; candOpen = true; ckbd = -1;
      renderCandidateList(); candSearchEl.focus();
    });
    if (candListEl) candListEl.addEventListener('mousedown', function (e) {
      var o = e.target.closest && e.target.closest('.ap-opt');
      if (o) { e.preventDefault(); pickCandidate(o.getAttribute('data-key')); }
    });
    if (candSelEl) candSelEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act="cand-clear"]');
      if (b) { e.stopPropagation(); clearCandidate(); }
    });

    // close open pickers on outside click
    document.addEventListener('click', function (e) {
      if (pickerOpen && pickerEl && !pickerEl.contains(e.target)) { pickerOpen = false; renderList(); }
      if (candOpen && candPickerEl && !candPickerEl.contains(e.target)) { candOpen = false; renderCandidateList(); }
    });

    // --- results: tier filter + card expand ---
    resultEl.addEventListener('click', function (e) {
      var actBtn = e.target.closest && e.target.closest('.ar-act-btn');
      if (actBtn) { handleAction(actBtn.getAttribute('data-act')); return; }
      var chip = e.target.closest && e.target.closest('.ar-legend-chip');
      if (chip) {
        var t = chip.getAttribute('data-tier');
        filter = (filter && filter.length === 1 && filter[0] === t) ? null : [t];
        paint(); return;
      }
      var q = e.target.closest && e.target.closest('.ar-quick-btn');
      if (q) { filter = (q.getAttribute('data-quick') === 'safe') ? ['low', 'negligible'] : null; paint(); return; }
      var head = e.target.closest && e.target.closest('.ar-row-head');
      if (head) toggleCard(head);
    });
    resultEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var head = e.target.closest && e.target.closest('.ar-row-head');
      if (head) { e.preventDefault(); toggleCard(head); }
    });

    render();
    loadRemoteAllergyData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
