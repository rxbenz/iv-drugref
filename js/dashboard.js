(function() {
  'use strict';

  // ============================================================
  // IV DrugRef Dashboard v6.1 — Cross-Filter Engine (Hardened)
  // Fixes: XSS, performance, memory, error handling, accessibility
  // ============================================================

  // ─── CONSTANTS ─────────────────────────────────────────────
  const FETCH_TIMEOUT_MS = 15000;        // 15s fetch timeout
  const AUTO_REFRESH_MS = 60000;         // 60s auto-refresh
  const DEBOUNCE_MS = 150;               // 150ms debounce for filters
  const TOAST_DURATION_MS = 2200;        // toast display time
  const MAX_TIME_TO_CLICK_MS = 300000;   // 5min max for search time metric
  const DAU_DAYS = 30;                   // days shown in DAU chart
  const TOP_N_DEFAULT = 20;              // default top-N for tables
  const FILTER_SAMPLE_SIZE = 50;         // rows to sample for filter detection
  const MAX_JOURNEY_USERS = 50;          // max users in journey list
  const MAX_FLOW_ENTRIES = 15;           // max flow entries in chart

  const C = {blue:'#38bdf8',cyan:'#22d3ee',green:'#34d399',amber:'#fbbf24',purple:'#a78bfa',red:'#f87171',pink:'#f472b6',slate:'#546380',teal:'#2dd4bf'};
  const CD = {responsive:true,plugins:{legend:{labels:{color:'#8899b4',font:{family:'Noto Sans Thai',size:10}}}},scales:{x:{ticks:{color:'#546380',font:{size:9}},grid:{color:'rgba(26,37,64,0.5)'}},y:{ticks:{color:'#546380',font:{size:9}},grid:{color:'rgba(26,37,64,0.5)'}},beginAtZero:true}};
  const RENAL_CLS = {abx:'Antibiotics',av:'Antivirals',ac:'Anticoagulants',misc:'Others'};
  const RENAL_CLR = {abx:C.blue,av:C.purple,ac:C.pink,misc:C.green};
  const STG_CLR = {G1:'#34d399',G2:'#6ee7b7',G3a:'#fbbf24',G3b:'#f59e0b',G4:'#fb923c',G5:'#f87171'};
  const INTERP_CLR = {therapeutic:C.green,subtherapeutic:C.amber,supratherapeutic:C.red,toxic:C.pink,borderline_toxic:'#fb923c',elevated_trough:C.red};

  // Weight histogram config
  const WEIGHT_BUCKETS = [
    { label: '<40', min: -Infinity, max: 40, color: C.red },
    { label: '40-50', min: 40, max: 50, color: C.amber },
    { label: '50-60', min: 50, max: 60, color: C.green },
    { label: '60-70', min: 60, max: 70, color: C.cyan },
    { label: '70-80', min: 70, max: 80, color: C.blue },
    { label: '>80', min: 80, max: Infinity, color: C.purple }
  ];

  // Search time buckets (seconds)
  const TIME_BUCKETS = [
    { label: '<5s', max: 5 },
    { label: '5-10s', max: 10 },
    { label: '10-20s', max: 20 },
    { label: '20-30s', max: 30 },
    { label: '30-60s', max: 60 },
    { label: '>60s', max: Infinity }
  ];

  // ─── STATE ─────────────────────────────────────────────────
  let SCRIPT_URL = localStorage.getItem('analyticsUrl') || '';
  let charts = {};
  let RAW = null;
  let FILTERS = {};
  let SESSION_MAP = {};
  let _arTimer = null, _arOn = false;
  let _journeyUsers = {};
  let _filterCache = null;     // memoized filter results
  let _filterCacheKey = null;  // cache invalidation key

  // ─── SECURITY: HTML escaping ───────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── UTILITIES: Consolidated from core.js ───────────────────
  function fmtNum(n, decimals) {
    var result = IVDrugRef.fmt(n, decimals);
    return result === '–' ? 'N/A' : result;
  }
  var debounce = IVDrugRef.debounce;

  // ─── Tab navigation ────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const panel = document.getElementById('panel-' + t.dataset.tab);
    if (panel) panel.classList.add('active');
  }));

  // ─── Setup ─────────────────────────────────────────────────
  function toggleSetup() {
    const banner = document.getElementById('setupBanner');
    banner.classList.toggle('show');
    document.getElementById('scriptUrl').value = SCRIPT_URL;
  }

  function saveUrl() {
    SCRIPT_URL = document.getElementById('scriptUrl').value.trim();
    // Validate URL protocol
    if (SCRIPT_URL && !SCRIPT_URL.startsWith('https://')) {
      toast('⚠️ URL ต้องเป็น HTTPS');
      return;
    }
    localStorage.setItem('analyticsUrl', SCRIPT_URL);
    document.getElementById('setupBanner').classList.remove('show');
    fetchRaw();
  }

  // ─── Chart helpers ─────────────────────────────────────────
  function dc(k) {
    if (charts[k]) { charts[k].destroy(); delete charts[k]; }
  }

  function mc(id, cfg) {
    dc(id);
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    charts[id] = new Chart(ctx, cfg);
  }

  function xprt(id) {
    const c = charts[id];
    if (!c) return;
    const a = document.createElement('a');
    a.download = `IV_DrugRef_${id}.png`;
    a.href = c.toBase64Image();
    a.click();
    toast('📷 Exported');
  }

  // ============================================================
  // CROSS-FILTER ENGINE
  // ============================================================
  function addFilter(key, val) {
    // Sanitize inputs
    key = String(key);
    val = String(val);
    if (FILTERS[key] === val) { delete FILTERS[key]; }
    else { FILTERS[key] = val; }
    _filterCache = null; // invalidate cache
    renderFilterBadges();
    debouncedReRender();
  }

  function removeFilter(key) {
    delete FILTERS[String(key)];
    _filterCache = null;
    renderFilterBadges();
    debouncedReRender();
  }

  function clearAllFilters() {
    FILTERS = {};
    _filterCache = null;
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('globalSearch').value = '';
    renderFilterBadges();
    debouncedReRender();
    toast('✕ ล้าง filter แล้ว');
  }

  function renderFilterBadges() {
    const el = document.getElementById('filterBadges');
    if (!el) return;
    // Use safe DOM construction instead of innerHTML with onclick
    el.innerHTML = '';
    Object.entries(FILTERS).forEach(([k, v]) => {
      const badge = document.createElement('span');
      badge.className = 'filter-badge';
      badge.setAttribute('role', 'button');
      badge.setAttribute('tabindex', '0');
      badge.setAttribute('aria-label', `Remove filter ${k}: ${v}`);
      badge.textContent = `${k}: ${v} `;
      const x = document.createElement('span');
      x.className = 'x';
      x.textContent = '✕';
      badge.appendChild(x);
      badge.addEventListener('click', () => removeFilter(k));
      badge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeFilter(k); } });
      el.appendChild(badge);
    });
  }

  // Build session lookup map
  function buildSessionMap(sessions) {
    SESSION_MAP = {};
    (sessions || []).forEach(s => {
      const sid = String(s.session_id || '').trim();
      if (sid) SESSION_MAP[sid] = { platform: String(s.platform || ''), user_id: String(s.user_id || '') };
    });
  }

  // Resolve field with SESSION_MAP fallback
  function resolveField(r, field) {
    if (r[field] !== undefined && r[field] !== null && String(r[field]).trim() !== '') return String(r[field]);
    const sid = String(r.session_id || '').trim();
    if (sid && SESSION_MAP[sid] && SESSION_MAP[sid][field]) return SESSION_MAP[sid][field];
    return '';
  }

  const FILTER_FIELDS = { drug:['drug_name','drug_clicked','drug_id'], platform:['platform'], class:['drug_class'], formula:['formula_used'], stage:['ckd_stage'], interpretation:['interpretation'], role:['role'], user:['user_id','session_id'] };

  function detectApplicableFilters(rows) {
    const sample = rows.slice(0, Math.min(rows.length, FILTER_SAMPLE_SIZE));
    const applicable = {};
    for (const key of Object.keys(FILTERS)) {
      if (key === 'user' || key === 'platform') { applicable[key] = true; continue; }
      const fields = FILTER_FIELDS[key] || [];
      applicable[key] = sample.some(r => fields.some(f => r[f] !== undefined && r[f] !== null && String(r[f]).trim() !== ''));
    }
    return applicable;
  }

  function applyFilters(rows) {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    const q = document.getElementById('globalSearch').value.trim().toLowerCase();
    const applicable = detectApplicableFilters(rows);

    return rows.filter(r => {
      if (from || to) {
        const ts = String(r.timestamp || '').substring(0, 10);
        if (ts) { if (from && ts < from) return false; if (to && ts > to) return false; }
      }
      for (const [key, val] of Object.entries(FILTERS)) {
        if (!applicable[key]) continue;
        if (key === 'drug') { if (!matchDrug(r, val)) return false; }
        else if (key === 'platform') { if (resolveField(r, 'platform') !== val) return false; }
        else if (key === 'class') { if (String(r.drug_class || '') !== val) return false; }
        else if (key === 'formula') { if (String(r.formula_used || '') !== val) return false; }
        else if (key === 'stage') { if (String(r.ckd_stage || '') !== val) return false; }
        else if (key === 'interpretation') { if (String(r.interpretation || '') !== val) return false; }
        else if (key === 'role') { if (String(r.role || '') !== val) return false; }
        else if (key === 'user') { if (String(r.user_id || r.session_id || '') !== val) return false; }
      }
      if (q) {
        const txt = Object.values(r).join(' ').toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }

  function matchDrug(r, drug) {
    const d = drug.toLowerCase();
    return (String(r.drug_name || '').toLowerCase() === d || String(r.drug_clicked || '').toLowerCase() === d || String(r.drug_id || '').toLowerCase() === d);
  }

  // ============================================================
  // FETCH RAW (with timeout & safe error display)
  // ============================================================
  async function fetchRaw() {
    if (!SCRIPT_URL) {
      document.getElementById('statusMsg').textContent = 'กดปุ่ม ⚙ URL เพื่อเชื่อมต่อ';
      document.getElementById('statusMsg').style.display = 'block';
      return;
    }
    document.getElementById('statusMsg').textContent = '⏳ กำลังโหลด raw data...';
    document.getElementById('statusMsg').style.display = 'block';

    // AbortController for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(SCRIPT_URL + '?action=raw', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);

      // Validate response structure
      if (!d || typeof d !== 'object') throw new Error('Invalid response format');

      RAW = d;
      _filterCache = null;
      buildSessionMap(RAW.sessions);
      document.getElementById('statusMsg').style.display = 'none';
      reRender();
      toast('✅ โหลดข้อมูลสำเร็จ (' + totalRows() + ' rows)');
    } catch (err) {
      clearTimeout(timeout);
      const msg = document.getElementById('statusMsg');
      msg.className = 'error';
      // SAFE: Use textContent instead of innerHTML to prevent XSS
      msg.textContent = '❌ ' + (err.name === 'AbortError' ? 'Timeout — ลองอีกครั้ง' : err.message);
      msg.style.display = 'block';
      // Report to error tracker if available
      if (window.IVErrorTracker) {
        window.IVErrorTracker.report('Dashboard fetch failed: ' + err.message, 'high');
      }
    }
  }

  function totalRows() {
    if (!RAW) return 0;
    return Object.values(RAW).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  }

  // ============================================================
  // RE-RENDER (debounced, lazy-tab rendering)
  // ============================================================
  function getActiveTab() {
    const active = document.querySelector('.tab.active');
    return active ? active.dataset.tab : 'overview';
  }

  function reRender() {
    if (!RAW) return;
    const sessions = applyFilters(RAW.sessions || []);
    const searches = applyFilters(RAW.searches || []);
    const surveys = applyFilters(RAW.surveys || []);
    const doseCalcs = applyFilters(RAW.doseCalcs || []);
    const drugExpands = applyFilters(RAW.drugExpands || []);
    const tdmUsage = applyFilters(RAW.tdmUsage || []);
    const pageViews = applyFilters(RAW.pageViews || []);
    const renalDosing = applyFilters(RAW.renalDosing || []);
    const compatUsage = applyFilters(RAW.compatUsage || []);
    const drugRatings = applyFilters(RAW.drugRatings || []);
    const npsResponses = applyFilters(RAW.npsResponses || []);

    // Always render overview + active tab
    renderOverview(sessions, searches, surveys, doseCalcs, tdmUsage, compatUsage);

    const tab = getActiveTab();
    if (tab === 'drugs' || tab === 'overview') renderDrugs(searches, drugExpands);
    if (tab === 'tdm' || tab === 'overview') renderTDM(tdmUsage);
    if (tab === 'renal' || tab === 'overview') renderRenal(renalDosing);
    if (tab === 'compat' || tab === 'overview') renderCompat(compatUsage);
    if (tab === 'dosecalc' || tab === 'overview') renderDoseCalc(doseCalcs);
    if (tab === 'ratings' || tab === 'overview') renderRatingsNPS(drugRatings, npsResponses);
    if (tab === 'survey' || tab === 'overview') renderSurvey(surveys);
    if (tab === 'journey' || tab === 'overview') renderJourney(pageViews, sessions, searches, doseCalcs, tdmUsage);

    document.getElementById('footerInfo').textContent = `Filtered: ${sessions.length + searches.length + tdmUsage.length + renalDosing.length + compatUsage.length} rows | Dashboard v6.1`;
  }

  // Debounced version for filter changes
  const debouncedReRender = debounce(reRender, DEBOUNCE_MS);

  // Re-render active tab on tab change
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    if (RAW) reRender();
  }));

  // ============================================================
  // AGGREGATION HELPERS
  // ============================================================
  function countBy(arr, key) {
    const m = {};
    arr.forEach(r => {
      const v = String(r[key] || '').trim();
      if (v && v !== 'undefined') m[v] = (m[v] || 0) + 1;
    });
    return m;
  }

  function topN(map, n) {
    n = n || TOP_N_DEFAULT;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ drug: k, count: v }));
  }

  function uniqueSet(arr, key) {
    const s = new Set();
    arr.forEach(r => {
      const v = String(r[key] || r.session_id || '').trim();
      if (v) s.add(v);
    });
    return s;
  }

  function dailyCount(arr) {
    const m = {};
    arr.forEach(r => {
      const d = String(r.timestamp || '').substring(0, 10);
      if (d && d !== 'undefined') m[d] = (m[d] || 0) + 1;
    });
    return m;
  }

  function dailyUnique(arr) {
    const m = {};
    arr.forEach(r => {
      const d = String(r.timestamp || '').substring(0, 10);
      const u = String(r.user_id || r.session_id || '').trim();
      if (d && d !== 'undefined' && u) {
        if (!m[d]) m[d] = new Set();
        m[d].add(u);
      }
    });
    const out = {};
    for (const [k, v] of Object.entries(m)) out[k] = v.size;
    return out;
  }

  function statBox(icon, val, label, color) {
    return `<div class="stat ${esc(color)}"><div class="stat-icon">${icon}</div><div class="stat-val">${esc(String(val))}</div><div class="stat-lbl">${esc(label)}</div></div>`;
  }

  // ─── SAFE table builder (no XSS) ──────────────────────────
  function buildClickTable(cid, rows, barColor, filterKey) {
    const el = document.getElementById(cid);
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<div class="empty-msg"><div class="icon">📭</div>ยังไม่มีข้อมูล</div>';
      return;
    }
    const mx = rows[0]?.count || 1;
    const activeD = FILTERS.drug?.toLowerCase();
    const fKey = filterKey || 'drug';

    // Build table using DOM API to prevent XSS
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const theadRow = document.createElement('tr');
    ['#', 'ชื่อยา', 'ครั้ง', ''].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      theadRow.appendChild(th);
    });
    thead.appendChild(theadRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((d, i) => {
      const tr = document.createElement('tr');
      tr.className = 'clickable' + (activeD === d.drug.toLowerCase() ? ' highlight' : '');
      tr.setAttribute('role', 'button');
      tr.setAttribute('tabindex', '0');
      tr.addEventListener('click', () => addFilter(fKey, d.drug));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addFilter(fKey, d.drug); } });

      const tdRank = document.createElement('td');
      tdRank.className = 'rank';
      tdRank.textContent = i + 1;

      const tdName = document.createElement('td');
      tdName.className = 'drug-name';
      tdName.textContent = d.drug; // textContent = safe

      const tdCount = document.createElement('td');
      tdCount.className = 'count';
      tdCount.textContent = d.count;

      const tdBar = document.createElement('td');
      tdBar.className = 'bar-cell';
      tdBar.innerHTML = `<div class="mini-bar"><div class="mini-bar-fill" style="width:${(d.count / mx * 100).toFixed(0)}%;background:${barColor || C.cyan}"></div></div>`;

      tr.append(tdRank, tdName, tdCount, tdBar);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    el.innerHTML = '';
    el.appendChild(table);
  }

  // Chart click handler
  function addChartClick(chartId, filterKey, labelMap) {
    const el = document.getElementById(chartId);
    if (!el) return;
    el.addEventListener('click', function(evt) {
      const c = charts[chartId];
      if (!c) return;
      const pts = c.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
      if (pts.length > 0) {
        const idx = pts[0].index;
        const label = c.data.labels[idx];
        const val = labelMap ? (labelMap[label] || label) : label;
        addFilter(filterKey, val);
      }
    });
  }

  // ============================================================
  // RENDER: OVERVIEW
  // ============================================================
  function renderOverview(sessions, searches, surveys, doseCalcs, tdmUsage, compatUsage) {
    const users = uniqueSet([...sessions, ...searches], 'user_id');
    const times = searches.map(r => parseInt(r.time_to_click_ms)).filter(t => !isNaN(t) && t > 0 && t < MAX_TIME_TO_CLICK_MS);
    const avgT = times.length > 0 ? fmtNum(times.reduce((a, b) => a + b, 0) / times.length / 1000) : '—';

    document.getElementById('overviewStats').innerHTML = [
      statBox('👤', sessions.length.toLocaleString(), 'Sessions', 'blue'),
      statBox('🧑‍⚕️', users.size.toLocaleString(), 'Unique Users', 'green'),
      statBox('🔍', searches.length.toLocaleString(), 'Searches', 'cyan'),
      statBox('⏱', avgT, 'Avg Search (s)', 'amber'),
      statBox('🧮', doseCalcs.length.toLocaleString(), 'Dose Calcs', 'pink'),
      statBox('🎯', tdmUsage.length.toLocaleString(), 'TDM Calcs', 'red'),
      statBox('🔗', compatUsage.length.toLocaleString(), 'Compat Checks', 'purple'),
    ].join('');

    // DAU
    const dau = dailyUnique([...sessions, ...searches]);
    const dauDays = Object.keys(dau).sort().slice(-DAU_DAYS);
    mc('dauChart', {type:'line', data:{labels:dauDays.map(d => d.substring(5)), datasets:[{label:'DAU', data:dauDays.map(d => dau[d]), borderColor:C.cyan, backgroundColor:'rgba(34,211,238,0.06)', fill:true, tension:0.35, pointRadius:2, borderWidth:2}]}, options:{...CD, plugins:{legend:{display:false}}}});

    // Platform
    const plat = countBy(sessions, 'platform');
    mc('platformChart', {type:'doughnut', data:{labels:Object.keys(plat), datasets:[{data:Object.values(plat), backgroundColor:[C.blue, C.green, C.amber, C.purple]}]}, options:{responsive:true, plugins:{legend:{position:'bottom', labels:{color:'#8899b4', font:{size:10}}}}}});
    addChartClick('platformChart', 'platform');

    // Time distribution
    const bk = new Array(TIME_BUCKETS.length).fill(0);
    times.forEach(t => {
      const s = t / 1000;
      for (let i = 0; i < TIME_BUCKETS.length; i++) {
        if (s < TIME_BUCKETS[i].max || i === TIME_BUCKETS.length - 1) { bk[i]++; break; }
      }
    });
    mc('timeChart', {type:'bar', data:{labels:TIME_BUCKETS.map(b => b.label), datasets:[{data:bk, backgroundColor:C.cyan, borderRadius:4}]}, options:{...CD, plugins:{legend:{display:false}}}});
  }

  // ============================================================
  // RENDER: DRUGS
  // ============================================================
  function renderDrugs(searches, drugExpands) {
    const drugCount = countBy(searches, 'drug_clicked');
    buildClickTable('topDrugsTable', topN(drugCount), C.cyan, 'drug');
    const expCount = countBy(drugExpands, 'drug_name');
    buildClickTable('topExpandsTable', topN(expCount), C.purple, 'drug');

    const filters = countBy(searches, 'filter_used');
    mc('filterChart', {type:'bar', data:{labels:Object.keys(filters), datasets:[{data:Object.values(filters), backgroundColor:C.blue, borderRadius:4}]}, options:{...CD, indexAxis:'y', plugins:{legend:{display:false}}}});

    const src = countBy(drugExpands, 'source');
    mc('srcChart', {type:'doughnut', data:{labels:Object.keys(src), datasets:[{data:Object.values(src), backgroundColor:[C.blue, C.green, C.amber]}]}, options:{responsive:true, plugins:{legend:{position:'bottom', labels:{color:'#8899b4', font:{size:10}}}}}});
  }

  // ============================================================
  // RENDER: TDM
  // ============================================================
  function renderTDM(tdm) {
    const users = uniqueSet(tdm, 'user_id');
    const byDrug = countBy(tdm, 'drug_name');
    const byInterp = countBy(tdm, 'interpretation');

    document.getElementById('tdmStats').innerHTML = [
      statBox('🎯', tdm.length.toLocaleString(), 'TDM Total', 'red'),
      statBox('👤', users.size.toLocaleString(), 'Users', 'cyan'),
      statBox('🧬', (byDrug['Vancomycin'] || 0).toLocaleString(), 'Vancomycin', 'blue'),
      statBox('⚡', (byDrug['Phenytoin'] || 0).toLocaleString(), 'Phenytoin', 'purple'),
      statBox('💉', ((byDrug['Amikacin'] || 0) + (byDrug['Gentamicin'] || 0)).toLocaleString(), 'AG', 'green'),
      statBox('🧠', (byDrug['Valproate'] || 0).toLocaleString(), 'VPA', 'amber'),
    ].join('');

    const dNames = Object.keys(byDrug).sort((a, b) => (byDrug[b] || 0) - (byDrug[a] || 0));
    mc('tdmDrugChart', {type:'bar', data:{labels:dNames, datasets:[{data:dNames.map(n => byDrug[n]), backgroundColor:[C.blue, C.purple, C.green, C.teal, C.amber, C.pink].slice(0, dNames.length), borderRadius:6}]}, options:{...CD, plugins:{legend:{display:false}}}});
    addChartClick('tdmDrugChart', 'drug');

    const iLabels = Object.keys(byInterp);
    mc('tdmInterpChart', {type:'doughnut', data:{labels:iLabels, datasets:[{data:Object.values(byInterp), backgroundColor:iLabels.map(l => INTERP_CLR[l] || C.slate)}]}, options:{responsive:true, plugins:{legend:{position:'bottom', labels:{color:'#8899b4', font:{size:10}}}}}});
    addChartClick('tdmInterpChart', 'interpretation');

    const byDay = dailyCount(tdm);
    const days = Object.keys(byDay).sort().slice(-DAU_DAYS);
    mc('tdmDayChart', {type:'bar', data:{labels:days.map(d => d.substring(5)), datasets:[{data:days.map(d => byDay[d]), backgroundColor:C.red, borderRadius:3}]}, options:{...CD, plugins:{legend:{display:false}}}});
  }

  // ============================================================
  // RENDER: RENAL
  // ============================================================
  function renderRenal(renal) {
    const users = uniqueSet(renal, 'user_id');
    const byFormula = countBy(renal, 'formula_used');
    const byStage = countBy(renal, 'ckd_stage');
    const fe = Object.entries(byFormula).sort((a, b) => b[1] - a[1]);
    const severe = (byStage['G4'] || 0) + (byStage['G5'] || 0);

    document.getElementById('renalStats').innerHTML = [
      statBox('🧬', renal.length.toLocaleString(), 'Lookups', 'teal'),
      statBox('👤', users.size.toLocaleString(), 'Users', 'green'),
      statBox('📊', fe.length > 0 ? (fe[0][0].includes('Cockcroft') ? 'CG' : 'CKD-EPI') : '—', 'Top Formula', 'blue'),
      statBox('⚠', severe.toLocaleString(), 'Severe CKD (G4-5)', 'amber'),
    ].join('');

    const byDrug = countBy(renal, 'drug_name');
    buildClickTable('renalDrugsTable', topN(byDrug, 15), C.teal, 'drug');

    const byClass = countBy(renal, 'drug_class');
    const clLabels = Object.keys(byClass);
    mc('renalClassChart', {type:'doughnut', data:{labels:clLabels.map(k => RENAL_CLS[k] || k), datasets:[{data:Object.values(byClass), backgroundColor:clLabels.map(k => RENAL_CLR[k] || C.slate), borderWidth:0}]}, options:{responsive:true, plugins:{legend:{labels:{color:'#8899b4', font:{size:10}}}}}});
    addChartClick('renalClassChart', 'class', Object.fromEntries(clLabels.map(k => [RENAL_CLS[k] || k, k])));

    mc('renalFormulaChart', {type:'doughnut', data:{labels:Object.keys(byFormula), datasets:[{data:Object.values(byFormula), backgroundColor:[C.blue, C.green, C.amber], borderWidth:0}]}, options:{responsive:true, plugins:{legend:{labels:{color:'#8899b4', font:{size:10}}}}}});
    addChartClick('renalFormulaChart', 'formula');

    const stL = Object.keys(byStage).sort();
    mc('renalStageChart', {type:'bar', data:{labels:stL, datasets:[{label:'Lookups', data:stL.map(k => byStage[k]), backgroundColor:stL.map(k => STG_CLR[k] || C.slate), borderRadius:5}]}, options:{...CD, plugins:{legend:{display:false}}}});
    addChartClick('renalStageChart', 'stage');

    const byDay = dailyCount(renal);
    const days = Object.keys(byDay).sort().slice(-DAU_DAYS);
    mc('renalDayChart', {type:'line', data:{labels:days.map(d => d.substring(5)), datasets:[{label:'Lookups', data:days.map(d => byDay[d]), borderColor:C.teal, backgroundColor:'rgba(45,212,191,0.08)', fill:true, tension:0.3, pointRadius:3}]}, options:{...CD, plugins:{legend:{display:false}}}});
  }

  // ============================================================
  // RENDER: Compat
  // ============================================================
  function renderCompat(compat) {
    const users = uniqueSet(compat, 'user_id');
    const pairChecks = compat.filter(r => r.mode === 'pair');
    const multiChecks = compat.filter(r => r.mode === 'multi');
    const incompats = compat.filter(r => r.result_status === 'incompatible' || r.result_status === 'has_incompatible');

    document.getElementById('compatStats').innerHTML = [
      statBox('🔗', compat.length.toLocaleString(), 'Total Checks', 'purple'),
      statBox('👤', users.size.toLocaleString(), 'Unique Users', 'blue'),
      statBox('💊', pairChecks.length.toLocaleString(), 'Pair Checks', 'cyan'),
      statBox('🔬', multiChecks.length.toLocaleString(), 'Multi Checks', 'teal'),
      statBox('❌', incompats.length.toLocaleString(), 'Incompatible', 'red')
    ].join('');

    const modeCount = countBy(compat, 'mode');
    mc('compatModeChart', {type:'doughnut', data:{labels:Object.keys(modeCount), datasets:[{data:Object.values(modeCount), backgroundColor:['#0ea5e9','#7c3aed','#d97706','#059669','#dc2626']}]}, options:{responsive:true, plugins:{legend:{position:'bottom', labels:{color:'#8899b4', font:{size:10}}}}}});

    const drugPairs = {};
    pairChecks.forEach(r => {
      const pair = [r.drug_a, r.drug_b].filter(Boolean).sort().join(' + ');
      if (pair) drugPairs[pair] = (drugPairs[pair] || 0) + 1;
    });
    const topPairs = Object.entries(drugPairs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    mc('compatDrugChart', {type:'bar', data:{labels:topPairs.map(p => p[0].length > 25 ? p[0].substring(0, 25) + '…' : p[0]), datasets:[{label:'Checks', data:topPairs.map(p => p[1]), backgroundColor:'#7c3aed', borderRadius:4}]}, options:{...CD, indexAxis:'y', plugins:{legend:{display:false}}}});

    const daily = dailyCount(compat);
    const days = Object.keys(daily).sort();
    mc('compatDayChart', {type:'line', data:{labels:days.map(d => d.substring(5)), datasets:[{label:'Compat Checks', data:days.map(d => daily[d]), borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,0.1)', fill:true, tension:0.3, pointRadius:3}]}, options:{...CD, plugins:{legend:{display:false}}}});
  }

  // ============================================================
  // RENDER: DOSE CALC
  // ============================================================
  function renderDoseCalc(doseCalcs) {
    const users = uniqueSet(doseCalcs, 'user_id');
    const byDrug = countBy(doseCalcs, 'drug_name');
    const byUnit = countBy(doseCalcs, 'dose_unit');
    const byUser = countBy(doseCalcs, 'user_id');
    const uniqueDrugs = Object.keys(byDrug).length;

    document.getElementById('doseCalcStats').innerHTML = [
      statBox('🧮', doseCalcs.length.toLocaleString(), 'Total Calcs', 'pink'),
      statBox('👤', users.size.toLocaleString(), 'Unique Users', 'cyan'),
      statBox('💊', uniqueDrugs.toLocaleString(), 'Unique Drugs', 'purple'),
      statBox('📊', doseCalcs.length > 0 ? fmtNum(doseCalcs.length / Math.max(users.size, 1)) : '—', 'Avg Calcs/User', 'amber'),
    ].join('');

    const drugNames = Object.keys(byDrug).sort((a, b) => (byDrug[b] || 0) - (byDrug[a] || 0)).slice(0, 15);
    mc('dcDrugChart', {type:'bar', data:{labels:drugNames, datasets:[{data:drugNames.map(n => byDrug[n]), backgroundColor:C.pink, borderRadius:6}]}, options:{...CD, plugins:{legend:{display:false}}}});
    addChartClick('dcDrugChart', 'drug');

    const unitLabels = Object.keys(byUnit);
    mc('dcUnitChart', {type:'doughnut', data:{labels:unitLabels.length ? unitLabels : ['—'], datasets:[{data:unitLabels.length ? Object.values(byUnit) : [1], backgroundColor:[C.blue, C.green, C.amber, C.purple, C.red, C.teal]}]}, options:{responsive:true, plugins:{legend:{position:'bottom', labels:{color:'#8899b4', font:{size:10}}}}}});

    const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
    mc('dcUserChart', {type:'bar', data:{labels:topUsers.map(u => u[0].length > 12 ? u[0].substring(0, 12) + '…' : u[0]), datasets:[{label:'Calcs', data:topUsers.map(u => u[1]), backgroundColor:C.cyan, borderRadius:4}]}, options:{...CD, indexAxis:'y', plugins:{legend:{display:false}}}});

    // Weight distribution
    const weights = doseCalcs.map(r => parseFloat(r.weight_kg)).filter(w => !isNaN(w) && w > 0 && w < 300);
    const wBuckets = new Array(WEIGHT_BUCKETS.length).fill(0);
    weights.forEach(w => {
      for (let i = 0; i < WEIGHT_BUCKETS.length; i++) {
        if (w < WEIGHT_BUCKETS[i].max || i === WEIGHT_BUCKETS.length - 1) { wBuckets[i]++; break; }
      }
    });
    mc('dcWeightChart', {type:'bar', data:{labels:WEIGHT_BUCKETS.map(b => b.label), datasets:[{label:'Patients', data:wBuckets, backgroundColor:WEIGHT_BUCKETS.map(b => b.color), borderRadius:4}]}, options:{...CD, plugins:{legend:{display:false}}}});

    const byDay = dailyCount(doseCalcs);
    const days = Object.keys(byDay).sort().slice(-DAU_DAYS);
    mc('dcDayChart', {type:'line', data:{labels:days.map(d => d.substring(5)), datasets:[{label:'Dose Calcs', data:days.map(d => byDay[d]), borderColor:C.pink, backgroundColor:'rgba(244,114,182,0.08)', fill:true, tension:0.3, pointRadius:3}]}, options:{...CD, plugins:{legend:{display:false}}}});
  }

  // ============================================================
  // RENDER: RATINGS & NPS
  // ============================================================
  function renderRatingsNPS(drugRatings, npsResponses) {
    // ── Stats ──
    const totalRatings = drugRatings.length;
    const avgRating = totalRatings > 0 ? fmtNum(drugRatings.reduce((s, r) => s + (parseFloat(r.rating) || 0), 0) / totalRatings) : '—';
    const totalNPS = npsResponses.length;
    const promoters = npsResponses.filter(r => parseInt(r.score) >= 9).length;
    const detractors = npsResponses.filter(r => parseInt(r.score) <= 6).length;
    const npsScore = totalNPS > 0 ? Math.round((promoters / totalNPS - detractors / totalNPS) * 100) : '—';

    var el = document.getElementById('ratingStats');
    if (el) el.innerHTML = [
      statBox('⭐', avgRating, 'Avg Drug Rating', 'amber'),
      statBox('📊', totalRatings.toLocaleString(), 'Total Ratings', 'blue'),
      statBox('📈', typeof npsScore === 'number' ? (npsScore >= 0 ? '+' : '') + npsScore : npsScore, 'NPS Score', npsScore >= 50 ? 'green' : npsScore >= 0 ? 'amber' : 'red'),
      statBox('👥', totalNPS.toLocaleString(), 'NPS Responses', 'purple'),
      statBox('😊', promoters.toLocaleString(), 'Promoters (9-10)', 'green'),
      statBox('😐', (totalNPS - promoters - detractors).toLocaleString(), 'Passives (7-8)', 'amber'),
    ].join('');

    // ── Rating Distribution Chart (1-5 stars) ──
    var ratingBuckets = [0, 0, 0, 0, 0];
    drugRatings.forEach(function(r) {
      var v = parseInt(r.rating);
      if (v >= 1 && v <= 5) ratingBuckets[v - 1]++;
    });
    mc('ratingDistChart', {
      type: 'bar',
      data: {
        labels: ['★', '★★', '★★★', '★★★★', '★★★★★'],
        datasets: [{ data: ratingBuckets, backgroundColor: [C.red, '#fb923c', C.amber, C.green, C.cyan], borderRadius: 4 }]
      },
      options: { ...CD, plugins: { legend: { display: false } } }
    });

    // ── NPS Distribution Chart (0-10) ──
    var npsBuckets = new Array(11).fill(0);
    npsResponses.forEach(function(r) {
      var v = parseInt(r.score);
      if (v >= 0 && v <= 10) npsBuckets[v]++;
    });
    var npsColors = npsBuckets.map(function(_, i) { return i <= 6 ? C.red : i <= 8 ? C.amber : C.green; });
    mc('npsDistChart', {
      type: 'bar',
      data: {
        labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        datasets: [{ data: npsBuckets, backgroundColor: npsColors, borderRadius: 4 }]
      },
      options: { ...CD, plugins: { legend: { display: false } } }
    });

    // ── Top Rated Drugs ──
    var drugMap = {};
    drugRatings.forEach(function(r) {
      var name = r.drug_name || r.drugName || 'Unknown';
      if (!drugMap[name]) drugMap[name] = { sum: 0, count: 0 };
      drugMap[name].sum += parseFloat(r.rating) || 0;
      drugMap[name].count++;
    });
    var sorted = Object.entries(drugMap).map(function(e) {
      return { name: e[0], avg: e[1].sum / e[1].count, count: e[1].count };
    }).sort(function(a, b) { return b.avg - a.avg || b.count - a.count; }).slice(0, 10);

    var topEl = document.getElementById('topRatedDrugs');
    if (topEl) {
      if (sorted.length === 0) {
        topEl.innerHTML = '<div class="empty-msg"><div class="icon">⭐</div>ยังไม่มีข้อมูล rating</div>';
      } else {
        topEl.innerHTML = '<table class="tw"><tr><th>Drug</th><th>Avg</th><th>Count</th></tr>' +
          sorted.map(function(d) {
            var stars = '★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg));
            return '<tr><td>' + d.name + '</td><td><span style="color:#f59e0b">' + stars + '</span> ' + d.avg.toFixed(1) + '</td><td>' + d.count + '</td></tr>';
          }).join('') + '</table>';
      }
    }

    // ── NPS Comments ──
    var commentsEl = document.getElementById('npsComments');
    if (commentsEl) {
      var withComment = npsResponses.filter(function(r) { return r.comment && r.comment.trim(); });
      if (withComment.length === 0) {
        commentsEl.innerHTML = '<div class="empty-msg"><div class="icon">💬</div>ยังไม่มี comment</div>';
      } else {
        commentsEl.innerHTML = withComment.slice(0, 20).map(function(r) {
          var score = parseInt(r.score);
          var cat = score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';
          var color = score >= 9 ? C.green : score >= 7 ? C.amber : C.red;
          return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">' +
            '<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:' + color + ';color:#fff;text-align:center;line-height:24px;font-weight:700;font-size:11px;margin-right:8px">' + score + '</span>' +
            '<span style="color:var(--text2)">' + (r.comment || '') + '</span>' +
            '<span style="float:right;font-size:10px;color:var(--text3)">' + cat + '</span></div>';
        }).join('');
      }
    }
  }

  // ============================================================
  // RENDER: SURVEY
  // ============================================================
  function renderSurvey(surveys) {
    const satRows = surveys.filter(r => r.sat_5_overall && r.sat_5_overall !== '');
    const susRows = surveys.filter(r => r.sus_score !== undefined && r.sus_score !== '');
    const avgSat = satRows.length > 0 ? fmtNum(satRows.reduce((s, r) => s + parseFloat(r.sat_5_overall), 0) / satRows.length) : '—';
    const avgSus = susRows.length > 0 ? fmtNum(susRows.reduce((s, r) => s + parseFloat(r.sus_score), 0) / susRows.length) : '—';
    const byRole = countBy(surveys, 'role');
    const byDept = countBy(surveys, 'department');
    const bothPhases = surveys.filter(r => r.sat_5_overall && r.sat_5_overall !== '' && r.sus_score !== undefined && r.sus_score !== '').length;

    document.getElementById('surveyStats').innerHTML = [
      statBox('📋', surveys.length.toLocaleString(), 'Surveys', 'purple'),
      statBox('⭐', avgSat, 'Avg Satisfaction', 'amber'),
      statBox('📊', avgSus, 'Avg SUS', 'green'),
      statBox('✅', satRows.length.toLocaleString(), 'Satisfaction Done', 'blue'),
      statBox('📋', susRows.length.toLocaleString(), 'SUS Done', 'cyan'),
      statBox('🔁', bothPhases.toLocaleString(), 'Both Phases', 'pink'),
    ].join('');

    const satKeys = ['sat_1_easy_to_find','sat_2_accurate','sat_3_faster','sat_4_recommend','sat_5_overall'];
    const satLabels = ['ค้นหาง่าย','ถูกต้อง','เร็วขึ้น','แนะนำ','โดยรวม'];
    const satAvgs = satKeys.map(k => { const vals = surveys.map(r => parseFloat(r[k])).filter(v => !isNaN(v)); return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0; });
    mc('satChart', {type:'bar', data:{labels:satLabels, datasets:[{data:satAvgs, backgroundColor:C.amber, borderRadius:4}]}, options:{...CD, plugins:{legend:{display:false}}, scales:{...CD.scales, y:{...CD.scales.y, max:5}}}});

    const rLabels = Object.keys(byRole);
    mc('roleChart', {type:'doughnut', data:{labels:rLabels.length ? rLabels : ['—'], datasets:[{data:rLabels.length ? Object.values(byRole) : [1], backgroundColor:[C.blue, C.green, C.amber, C.purple, C.red]}]}, options:{responsive:true, plugins:{legend:{position:'bottom', labels:{color:'#8899b4', font:{size:10}}}}}});
    addChartClick('roleChart', 'role');

    const dLabels = Object.keys(byDept), dData = Object.values(byDept);
    mc('deptChart', {type:'bar', data:{labels:dLabels.length ? dLabels : ['—'], datasets:[{data:dData.length ? dData : [0], backgroundColor:C.green, borderRadius:4}]}, options:{...CD, indexAxis:'y', plugins:{legend:{display:false}}}});

    // SUS Score distribution
    const susEmptyMsg = document.getElementById('susEmptyMsg');
    const susCanvas = document.getElementById('susChart');
    if (susRows.length >= 5) {
      if (susEmptyMsg) susEmptyMsg.style.display = 'none';
      if (susCanvas) susCanvas.style.display = '';
      const buckets = [0, 0, 0, 0, 0];
      const bucketLabels = ['0-20','21-40','41-60','61-80','81-100'];
      const bucketColors = [C.red, C.amber, '#fb923c', C.green, C.cyan];
      susRows.forEach(r => {
        const s = parseFloat(r.sus_score);
        if (s <= 20) buckets[0]++; else if (s <= 40) buckets[1]++; else if (s <= 60) buckets[2]++; else if (s <= 80) buckets[3]++; else buckets[4]++;
      });
      mc('susChart', {type:'bar', data:{labels:bucketLabels, datasets:[{label:'SUS Responses', data:buckets, backgroundColor:bucketColors, borderRadius:4}]}, options:{...CD, plugins:{legend:{display:false}}}});
    } else {
      dc('susChart'); // properly destroy chart if it exists
      if (susCanvas) susCanvas.style.display = 'none';
      if (susEmptyMsg) susEmptyMsg.style.display = '';
    }
  }

  // ============================================================
  // RENDER: JOURNEY (XSS-safe)
  // ============================================================
  function renderJourney(pageViews, sessions, searches, doseCalcs, tdmUsage) {
    const users = uniqueSet(pageViews, 'user_id');

    document.getElementById('journeyStats').innerHTML = [
      statBox('📄', pageViews.length.toLocaleString(), 'Page Views', 'cyan'),
      statBox('👤', users.size.toLocaleString(), 'Users', 'blue'),
    ].join('');

    const byPage = countBy(pageViews, 'page');
    mc('pvChart', {type:'bar', data:{labels:Object.keys(byPage), datasets:[{data:Object.values(byPage), backgroundColor:C.cyan, borderRadius:5}]}, options:{...CD, plugins:{legend:{display:false}}}});

    // Flow
    const flows = {};
    const pvBySession = {};
    pageViews.forEach(r => {
      const sid = String(r.session_id || '');
      if (sid) { if (!pvBySession[sid]) pvBySession[sid] = []; pvBySession[sid].push(r); }
    });
    for (const evts of Object.values(pvBySession)) {
      evts.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
      for (let i = 0; i < evts.length - 1; i++) {
        const key = `${evts[i].page}→${evts[i + 1].page}`;
        flows[key] = (flows[key] || 0) + 1;
      }
    }
    const flowTop = Object.entries(flows).sort((a, b) => b[1] - a[1]).slice(0, MAX_FLOW_ENTRIES);
    mc('flowChart', {type:'bar', data:{labels:flowTop.map(f => f[0]), datasets:[{data:flowTop.map(f => f[1]), backgroundColor:C.blue, borderRadius:3}]}, options:{...CD, indexAxis:'y', plugins:{legend:{display:false}}}});

    // User list — build using DOM API (XSS-safe)
    const allUsers = {};
    const addEvts = (arr, type) => arr.forEach(r => {
      const uid = String(r.user_id || r.session_id || '').trim();
      if (!uid) return;
      if (!allUsers[uid]) allUsers[uid] = [];
      allUsers[uid].push({ type, time: r.timestamp, detail: String(r.drug_name || r.drug_clicked || r.page || r.query || '—') });
    });
    addEvts(pageViews, 'page_view');
    addEvts(searches, 'search');
    addEvts(doseCalcs, 'dose_calc');
    addEvts(tdmUsage, 'tdm_calc');
    for (const uid in allUsers) allUsers[uid].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    _journeyUsers = allUsers;

    const uids = Object.keys(allUsers).slice(0, MAX_JOURNEY_USERS);
    const userListEl = document.getElementById('userList');
    userListEl.innerHTML = '';

    if (uids.length) {
      uids.forEach(u => {
        const pill = document.createElement('span');
        pill.className = 'user-pill';
        pill.setAttribute('role', 'button');
        pill.setAttribute('tabindex', '0');
        pill.textContent = u.substring(0, 12) + '…';
        pill.addEventListener('click', () => addFilter('user', u));
        pill.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addFilter('user', u); } });
        userListEl.appendChild(pill);
      });
    } else {
      userListEl.innerHTML = '<div class="empty-msg">ยังไม่มีข้อมูล</div>';
    }
  }

  // ─── SAFE Timeline renderer ────────────────────────────────
  function showTimeline() {
    const uid = document.getElementById('journeyUid').value.trim();
    const el = document.getElementById('userTimeline');
    if (!uid) { el.textContent = ''; el.innerHTML = '<div class="empty-msg">กรุณาพิมพ์ user_id</div>'; return; }

    let events = _journeyUsers[uid];
    if (!events) {
      const match = Object.keys(_journeyUsers).find(k => k.includes(uid));
      if (match) { document.getElementById('journeyUid').value = match; return showTimeline(); }
      el.innerHTML = '<div class="empty-msg">ไม่พบข้อมูล</div>';
      return;
    }

    const typeL = { page_view: '📄 Page', search: '🔍 Search', dose_calc: '🧮 Dose', tdm_calc: '🎯 TDM' };
    const typeCls = { page_view: 'page_view', search: 'search', dose_calc: 'dose_calc', tdm_calc: 'tdm_calc' };

    // Build timeline using DOM API (XSS-safe)
    el.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;color:var(--accent-cyan);font-weight:600;margin:8px 0';
    header.textContent = `🗺 ${uid} (${events.length} events)`;
    el.appendChild(header);

    const timeline = document.createElement('div');
    timeline.className = 'timeline';

    events.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'tl-item ' + (typeCls[ev.type] || '');

      const time = document.createElement('div');
      time.className = 'tl-time';
      time.textContent = ev.time ? ev.time.substring(0, 19).replace('T', ' ') : '';

      const typeName = document.createElement('div');
      typeName.className = 'tl-type';
      typeName.textContent = typeL[ev.type] || ev.type;

      const detail = document.createElement('div');
      detail.className = 'tl-detail';
      detail.textContent = ev.detail || '—'; // textContent = safe

      item.append(time, typeName, detail);
      timeline.appendChild(item);
    });

    el.appendChild(timeline);
  }

  // ============================================================
  // Export CSV (improved: RFC 4180 compliant, toast errors)
  // ============================================================
  async function exportCSV(sheet) {
    if (!SCRIPT_URL) { toast('⚠️ ตั้งค่า URL ก่อน'); return; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(SCRIPT_URL + '?action=export&sheet=' + encodeURIComponent(sheet), { signal: controller.signal });
      clearTimeout(timeout);

      const data = await res.json();
      if (data.error) { toast('❌ ' + data.error); return; }
      if (!Array.isArray(data) || !data.length) { toast('📭 ไม่มีข้อมูล'); return; }

      const h = Object.keys(data[0]);
      // RFC 4180: escape quotes, newlines, commas
      const escCSV = (val) => {
        const s = String(val || '');
        if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const csv = [h.map(escCSV).join(','), ...data.map(r => h.map(k => escCSV(r[k])).join(','))].join('\r\n');

      const b = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IV_DrugRef_${sheet}_${new Date().toISOString().substring(0, 10)}.csv`;
      a.click();
      // Cleanup blob URL to prevent memory leak
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('📥 Exported ' + sheet);
    } catch (e) {
      clearTimeout(timeout);
      toast('❌ Export failed: ' + (e.name === 'AbortError' ? 'Timeout' : e.message));
      if (window.IVErrorTracker) {
        window.IVErrorTracker.report('CSV export failed (' + sheet + '): ' + e.message, 'medium');
      }
    }
  }

  // ─── Auto-refresh ──────────────────────────────────────────
  function toggleAR() {
    _arOn = !_arOn;
    const b = document.getElementById('arBtn'), d = document.getElementById('arDot');
    if (_arOn) {
      b.textContent = '⏱ Auto: ON';
      b.classList.add('active-state');
      d.style.display = 'inline';
      _arTimer = setInterval(fetchRaw, AUTO_REFRESH_MS);
      toast('⏱ Auto-refresh ON');
    } else {
      b.textContent = '⏱ Auto: OFF';
      b.classList.remove('active-state');
      d.style.display = 'none';
      if (_arTimer) { clearInterval(_arTimer); _arTimer = null; }
      toast('⏱ Auto-refresh OFF');
    }
  }

  // ─── Toast ─────────────────────────────────────────────────
  function toast(m) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), TOAST_DURATION_MS);
  }

  // ─── Cleanup on unload ─────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    if (_arTimer) { clearInterval(_arTimer); _arTimer = null; }
    _journeyUsers = {};
    // Destroy all charts
    Object.keys(charts).forEach(dc);
  });

  // ─── Init: Wire up all event handlers programmatically ─────
  const today = new Date().toISOString().substring(0, 10);
  const ago = new Date(Date.now() - DAU_DAYS * 86400000).toISOString().substring(0, 10);
  document.getElementById('dateFrom').value = ago;
  document.getElementById('dateTo').value = today;

  // Debounced inputs
  document.getElementById('globalSearch').addEventListener('input', debouncedReRender);
  document.getElementById('dateFrom').addEventListener('change', debouncedReRender);
  document.getElementById('dateTo').addEventListener('change', debouncedReRender);

  // Header buttons
  var btnSetup = document.getElementById('btnSetup');
  if (btnSetup) btnSetup.addEventListener('click', toggleSetup);
  var btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.addEventListener('click', fetchRaw);
  var btnSaveUrl = document.getElementById('btnSaveUrl');
  if (btnSaveUrl) btnSaveUrl.addEventListener('click', saveUrl);

  // Export CSV buttons (data-export attribute)
  document.querySelectorAll('[data-export]').forEach(function(btn) {
    btn.addEventListener('click', function() { exportCSV(btn.getAttribute('data-export')); });
  });

  // Chart screenshot buttons (data-xprt attribute)
  document.querySelectorAll('[data-xprt]').forEach(function(btn) {
    btn.addEventListener('click', function() { xprt(btn.getAttribute('data-xprt')); });
  });

  // Toolbar buttons
  var clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) clearBtn.addEventListener('click', clearAllFilters);
  var arBtn = document.getElementById('arBtn');
  if (arBtn) arBtn.addEventListener('click', toggleAR);

  // Journey search
  var btnTimeline = document.getElementById('btnShowTimeline');
  if (btnTimeline) btnTimeline.addEventListener('click', showTimeline);

  // i18n: listen for language change events
  document.addEventListener('languageChanged', function() { debouncedReRender(); });

  if (SCRIPT_URL) fetchRaw();
})();
