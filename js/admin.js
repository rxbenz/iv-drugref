// ============================================================
// IV DrugRef PWA v5.0 — Admin Module
// Extracted from V4.7.0, wrapped in IIFE for modular architecture
// ============================================================

(function() {
'use strict';

/* ═══════════════════════════════════════════
   CONFIG & STATE
   ═══════════════════════════════════════════ */
const LS_PREFIX = 'ivdrug_admin_';
const ITEMS_PER_PAGE = 25;

let state = {
  user: null,
  myRole: 'editor', // 'admin' or 'editor' — set after getDrugs
  drugs: [],
  auditLog: [],
  adminUsers: [],
  currentPage: 1,
  auditPage: 1,
  sortField: 'id',
  sortDir: 'asc',
  editingId: null,
  importData: null,
  // Compatibility pairs
  compatPairs: [],
  compatPage: 1,
  editingCompatId: null,
  // DDI (drug interaction) data
  ddiPairs: [],
  ddiRules: [],
  editingDDIPairId: null,
  editingDDIRuleId: null,
  // Renal dosing
  renalDrugs: [],
  renalPage: 1,
  editingRenalId: null,
  // Analytics summary
  analyticsData: null,
};

// Built-in defaults so admin works on any machine/browser with NO Settings
// entry. Neither value is secret: the Apps Script URL is already public in
// core.js, and a Google OAuth Client ID is designed to be embedded in the page.
// localStorage still overrides these if an admin wants a different endpoint.
// (The GitHub token is a real secret and is intentionally NOT defaulted.)
const DEFAULT_CLIENT_ID = '666120341779-qusaccvj5tj7o6onfb9nn5vod3o9rrv9.apps.googleusercontent.com';
function defaultScriptUrl() {
  return (window.IVDrugRef && window.IVDrugRef.getAdminGasUrl && window.IVDrugRef.getAdminGasUrl()) || '';
}

function getConfig() {
  return {
    scriptUrl: localStorage.getItem(LS_PREFIX + 'scriptUrl') || defaultScriptUrl(),
    clientId: localStorage.getItem(LS_PREFIX + 'clientId') || DEFAULT_CLIENT_ID,
    allowedEmails: (localStorage.getItem(LS_PREFIX + 'allowedEmails') || '').split(',').map(e => e.trim()).filter(Boolean),
    ghToken: localStorage.getItem(LS_PREFIX + 'ghToken') || '',
    ghRepo: localStorage.getItem(LS_PREFIX + 'ghRepo') || 'rxbenz/iv-drugref',
  };
}
function saveConfig(cfg) {
  localStorage.setItem(LS_PREFIX + 'scriptUrl', cfg.scriptUrl);
  localStorage.setItem(LS_PREFIX + 'clientId', cfg.clientId);
  localStorage.setItem(LS_PREFIX + 'allowedEmails', cfg.allowedEmails.join(','));
  if (cfg.ghToken !== undefined) localStorage.setItem(LS_PREFIX + 'ghToken', cfg.ghToken);
  if (cfg.ghRepo !== undefined) localStorage.setItem(LS_PREFIX + 'ghRepo', cfg.ghRepo);
}

/* ═══════════════════════════════════════════
   AUTHENTICATION — Google Identity Services
   ═══════════════════════════════════════════ */
function initGoogleAuth() {
  const cfg = getConfig();
  if (!cfg.clientId) {
    // First-time setup: show app directly with settings
    showApp({ name: 'Admin (Setup)', email: 'setup@local', picture: '' });
    switchTab('settings');
    toast('กรุณาตั้งค่า Google Client ID และ Script URL ก่อน', 'info');
    return;
  }
  google.accounts.id.initialize({
    client_id: cfg.clientId,
    callback: handleCredentialResponse,
    auto_select: true,
  });
  google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
    theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill',
  });
  google.accounts.id.prompt();
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  const cfg = getConfig();
  if (cfg.allowedEmails.length > 0 && !cfg.allowedEmails.includes(payload.email)) {
    const err = document.getElementById('auth-error');
    err.textContent = `❌ ${payload.email} ไม่มีสิทธิ์เข้าถึง — ติดต่อ admin`;
    err.style.display = 'block';
    return;
  }
  state.user = { name: payload.name, email: payload.email, picture: payload.picture };
  showApp(state.user);
  // Phase A: best-effort — exchange the Google id_token for a Supabase session
  // (no extra login/redirect) so the Renal tab can write direct to Supabase.
  // Silent no-op if the Supabase Google provider isn't configured for id_token;
  // the "🔗 เชื่อม Supabase" button (OAuth redirect) is the fallback.
  if (window.AdminSupabase && response.credential) {
    AdminSupabase.signInWithGoogleIdToken(response.credential).then(function (ok) {
      if (ok && typeof renderRenalSupaStatus === 'function') renderRenalSupaStatus();
    });
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
}

function signIn() {
  const cfg = getConfig();
  if (!cfg.clientId) {
    showApp({ name: 'Admin (Setup)', email: 'setup@local', picture: '' });
    switchTab('settings');
    return;
  }
  google.accounts.id.prompt();
}

function signOut() {
  google.accounts.id.disableAutoSelect();
  state.user = null;
  state.myRole = 'editor';
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  // Re-render sign-in button and re-prompt so user can sign back in
  try {
    google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
      theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill',
    });
    google.accounts.id.prompt();
  } catch (e) { /* GIS not available */ }
}

function showApp(user) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('topbar-user-name').textContent = user.name;
  document.getElementById('topbar-user-avatar').src = user.picture || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%230ea5e9"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="18">👤</text></svg>';
  // Setup mode (no script URL) → grant admin so settings tab is accessible
  if (user.email === 'setup@local') {
    state.myRole = 'admin';
    applyRoleUI();
  }
  loadDrugs();
  loadAuditLog();
  loadSettingsUI();
}

/* ═══════════════════════════════════════════
   API COMMUNICATION
   ═══════════════════════════════════════════ */
/**
 * API Communication Strategy:
 * - READ (getDrugs, getAudit): GET request (CORS works fine with GAS redirect)
 * - WRITE (small payload <6KB): GET with ?data=JSON parameter
 * - WRITE (large payload ≥6KB): POST with no-cors (fire-and-forget)
 *   The POST reaches doPost on the server, but we can't read the response
 *   due to CORS on the redirect. We assume success and verify via GET after.
 */
async function apiCall(action, data = {}) {
  const cfg = getConfig();
  if (!cfg.scriptUrl) {
    toast('กรุณาตั้งค่า Script URL ก่อน', 'error');
    throw new Error('No script URL');
  }

  const isRead = ['getDrugs', 'getAudit', 'getCategories', 'getUsers', 'getCompatPairs', 'getRenalDrugs', 'getAllergyGroups', 'getDDIPairs', 'getDDIClassRules', 'version'].includes(action);
  const url = new URL(cfg.scriptUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('user', state.user?.email || 'unknown');

  if (isRead) {
    Object.entries(data).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    const json = await res.json();
    if (json.permissionDenied) {
      toast('❌ ' + (json.error || 'ไม่มีสิทธิ์'), 'error');
      throw new Error(json.error || 'Permission denied');
    }
    return json;
  }

  // WRITE: check URL length
  const jsonData = JSON.stringify(data);
  url.searchParams.set('data', jsonData);
  const fullUrl = url.toString();

  if (fullUrl.length < 6000) {
    // Small payload → use GET (we can read the response)
    console.log(`[API] ${action} via GET (${fullUrl.length} chars)`);
    const res = await fetch(fullUrl);
    const json = await res.json();
    if (json.permissionDenied) {
      toast('❌ ' + (json.error || 'ไม่มีสิทธิ์'), 'error');
      throw new Error(json.error || 'Permission denied');
    }
    return json;
  }

  // Large payload → use POST no-cors (fire-and-forget)
  console.log(`[API] ${action} via POST no-cors (payload: ${jsonData.length} chars)`);
  const postUrl = cfg.scriptUrl + '?action=' + action +
    '&user=' + encodeURIComponent(state.user?.email || 'unknown');

  await fetch(postUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: jsonData,
  });

  // no-cors POST returns opaque response, but server processed it
  // Add small delay to let GAS finish writing
  await new Promise(r => setTimeout(r, 1000));
  return { success: true, message: 'Sent (POST no-cors)' };
}

// Expected GAS backend version — keep in sync with GAS_VERSION in gas-complete.js.
// If the deployed GAS reports an older value, the editor copy wasn't redeployed.
const EXPECTED_GAS_VERSION = '5.47.0';

async function checkBackendVersion() {
  const box = document.getElementById('version-check-result');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = '<span style="color:var(--text-muted);font-size:13px">🔄 กำลังตรวจ...</span>';

  const appVer = (window.IVDrugRef && IVDrugRef.VERSION) ||
    (document.querySelector('[data-app-version]')?.textContent || '—').replace(/^v/, '');

  // GAS version via ?action=version
  let gasVer = null, gasErr = null;
  try { const r = await apiCall('version'); gasVer = r && r.version; }
  catch (e) { gasErr = e.message; }

  // Supabase reachability — does the ddi_pairs table answer? (also proves ddi.sql ran)
  let supaOk = false, supaErr = null;
  try {
    const SB = 'https://bzwbagojjpiazbeaahmg.supabase.co';
    const KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';
    const res = await fetch(SB + '/rest/v1/ddi_pairs?select=id&limit=1', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    supaOk = res.ok;
    if (!res.ok) supaErr = 'HTTP ' + res.status + (res.status === 404 ? ' (ยังไม่ได้รัน ddi.sql?)' : '');
  } catch (e) { supaErr = e.message; }

  const gasMatch = gasVer && gasVer === EXPECTED_GAS_VERSION;
  const row = (label, value, ok, note) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
       <span style="width:18px">${ok ? '✅' : '⚠️'}</span>
       <span style="flex:1;font-size:13px">${escHtml(label)}</span>
       <code style="font-size:12px">${escHtml(value)}</code>
       ${note ? `<span style="font-size:11px;color:var(--text-muted)">${escHtml(note)}</span>` : ''}
     </div>`;

  box.innerHTML =
    row('App version (frontend)', 'v' + appVer, true, '') +
    row('GAS version (deployed)', gasErr ? 'error' : ('v' + (gasVer || '?')), gasMatch,
        gasErr ? gasErr : (gasMatch ? 'ตรงกับโค้ด' : 'คาดหวัง v' + EXPECTED_GAS_VERSION + ' — ยัง deploy ไม่ครบ?')) +
    row('Supabase (ddi_pairs)', supaOk ? 'reachable' : 'unreachable', supaOk, supaErr || 'พร้อมใช้งาน DDI');
}

async function testConnection() {
  const pre = document.getElementById('test-result');
  pre.style.display = 'block';
  pre.textContent = '🔄 กำลังทดสอบ...\n';
  const cfg = getConfig();

  if (!cfg.scriptUrl) {
    pre.textContent += '❌ ไม่มี Script URL\n';
    return;
  }

  pre.textContent += `📎 URL: ${cfg.scriptUrl}\n`;
  pre.textContent += `📎 URL ends with /exec: ${cfg.scriptUrl.endsWith('/exec')}\n\n`;

  // Test 1: Simple GET (getDrugs)
  try {
    pre.textContent += '── Test 1: GET getDrugs ──\n';
    const url = cfg.scriptUrl + '?action=getDrugs';
    pre.textContent += `URL: ${url}\n`;
    const res = await fetch(url);
    pre.textContent += `Status: ${res.status} ${res.statusText}\n`;
    pre.textContent += `Redirected: ${res.redirected}\n`;
    pre.textContent += `URL after redirect: ${res.url}\n`;
    const text = await res.text();
    pre.textContent += `Response (first 500 chars):\n${text.substring(0, 500)}\n`;

    try {
      const json = JSON.parse(text);
      pre.textContent += `\n✅ Valid JSON! drugs count: ${json.drugs?.length || 0}\n`;
    } catch {
      pre.textContent += `\n⚠️ Response is NOT valid JSON — อาจเป็นหน้า HTML error\n`;
      pre.textContent += `Hint: ถ้าเห็น HTML = ต้อง deploy ใหม่เป็น version ใหม่\n`;
    }
  } catch (err) {
    pre.textContent += `❌ Fetch failed: ${err.message}\n`;
    pre.textContent += `\n📌 วิธีแก้:\n`;
    pre.textContent += `1. ไปที่ Apps Script → Deploy → Manage deployments\n`;
    pre.textContent += `2. กด ✏️ แก้ไข → เลือก "New version"\n`;
    pre.textContent += `3. Who has access: "Anyone"\n`;
    pre.textContent += `4. กด Deploy\n`;
    pre.textContent += `5. ถ้า URL เปลี่ยน ให้ copy URL ใหม่มาใส่\n`;
  }

  // Test 2: Write test (createDrug with test data)
  try {
    pre.textContent += '\n── Test 2: GET with data param (write test) ──\n';
    const testData = { generic: '__TEST__', status: 'draft' };
    const url = cfg.scriptUrl + '?action=createDrug&user=test&data=' + encodeURIComponent(JSON.stringify(testData));
    pre.textContent += `URL length: ${url.length} chars\n`;
    const res = await fetch(url);
    const text = await res.text();
    pre.textContent += `Status: ${res.status}\n`;
    pre.textContent += `Response: ${text.substring(0, 300)}\n`;

    try {
      const json = JSON.parse(text);
      if (json.success) {
        pre.textContent += `✅ Write test PASSED! Created test drug ID: ${json.id}\n`;
        pre.textContent += `🧹 ลบ test drug...\n`;
        // Clean up
        const delUrl = cfg.scriptUrl + '?action=deleteDrug&user=test&data=' + encodeURIComponent(JSON.stringify({ id: json.id }));
        await fetch(delUrl);
        pre.textContent += `✅ Cleaned up\n`;
      } else {
        pre.textContent += `⚠️ Write returned: ${JSON.stringify(json)}\n`;
      }
    } catch {
      pre.textContent += `⚠️ Write response is not valid JSON\n`;
    }
  } catch (err) {
    pre.textContent += `❌ Write test failed: ${err.message}\n`;
  }

  pre.textContent += '\n══ ทดสอบเสร็จแล้ว ══';
}

// Import drugs one-by-one via createDrug GET (guaranteed to work)
async function apiCallChunked(action, drugs) {
  let success = 0, failed = 0;

  for (let i = 0; i < drugs.length; i++) {
    showLoading(`กำลัง import ${i + 1}/${drugs.length} — ${drugs[i].generic}...`);
    try {
      // Send each drug individually via createDrug (small payload = GET works)
      const d = drugs[i];
      d.status = 'draft';
      await apiCall('createDrug', d);
      success++;
    } catch (err) {
      console.error(`Failed to import drug ${i}:`, drugs[i].generic, err);
      failed++;
    }
    // Small delay every 3 drugs to not overwhelm GAS
    if (i % 3 === 2) await new Promise(r => setTimeout(r, 300));
  }

  if (failed > 0) {
    toast(`⚠️ Import: สำเร็จ ${success}, ล้มเหลว ${failed}`, 'warning');
  }
  return { success: true, count: success };
}

/* ═══════════════════════════════════════════
   DRUG LIST OPERATIONS
   ═══════════════════════════════════════════ */

/** Ensure categories/monitoring are arrays and nested objects are parsed */
function normalizeDrugFields(d) {
  if (typeof d.categories === 'string') {
    d.categories = d.categories.startsWith('[')
      ? (function() { try { return JSON.parse(d.categories); } catch(e) { return d.categories.split(',').map(s => s.trim()).filter(Boolean); } })()
      : d.categories.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof d.monitoring === 'string') {
    d.monitoring = d.monitoring.startsWith('[')
      ? (function() { try { return JSON.parse(d.monitoring); } catch(e) { return d.monitoring.split(',').map(s => s.trim()).filter(Boolean); } })()
      : d.monitoring.split(',').map(s => s.trim()).filter(Boolean);
  }
  // Parse nested JSON objects if stored as strings (from GAS Sheet)
  ['reconst', 'dilution', 'admin', 'stability', 'compat'].forEach(key => {
    if (typeof d[key] === 'string' && d[key].startsWith('{')) {
      try { d[key] = JSON.parse(d[key]); } catch(e) {}
    }
  });
  return d;
}

async function loadDrugs() {
  showLoading('กำลังโหลดข้อมูลยา...');
  try {
    const result = await apiCall('getDrugs');
    state.drugs = (result.drugs || []).map(normalizeDrugFields);
    // Capture role from backend response
    if (result.myRole) {
      state.myRole = result.myRole;
      localStorage.setItem(LS_PREFIX + 'myRole', result.myRole);
    }
    // Cache drugs for offline fallback
    if (state.drugs.length > 0) {
      localStorage.setItem(LS_PREFIX + 'drugsCache', JSON.stringify(state.drugs));
    }
    populateCategories();
    renderStats();
    renderDrugTable();
    updatePendingCount();
    applyRoleUI(); // ซ่อน/แสดง UI ตาม role
    checkSyncStatus();
  } catch (e) {
    console.error(e);
    if (e.message && e.message.includes('ไม่มีสิทธิ์')) {
      toast('❌ คุณไม่มีสิทธิ์เข้าถึงระบบนี้ — ติดต่อ Admin', 'error');
      return;
    }
    // Restore cached role so UI isn't blocked
    const cachedRole = localStorage.getItem(LS_PREFIX + 'myRole');
    if (cachedRole) state.myRole = cachedRole;
    // Fallback: load from localStorage cache
    const cached = localStorage.getItem(LS_PREFIX + 'drugsCache');
    if (cached) {
      try { state.drugs = JSON.parse(cached).map(normalizeDrugFields); } catch (pe) { state.drugs = []; }
      populateCategories();
      renderStats();
      renderDrugTable();
      applyRoleUI();
      checkSyncStatus();
      toast('โหลดจาก cache — ไม่สามารถเชื่อมต่อ server', 'info');
    } else {
      toast('ไม่มีข้อมูลยา — กรุณาเชื่อมต่อ internet', 'error');
    }
  }
  hideLoading();
}

/* ═══════════════════════════════════════════
   ROLE-BASED UI — ซ่อน/แสดง element ตาม role
   ═══════════════════════════════════════════ */
function isAdmin() { return state.myRole === 'admin'; }

function applyRoleUI() {
  // แสดง role badge ข้าง user name
  const roleTag = isAdmin() ? '🔑 Admin' : '📝 Editor';
  const nameEl = document.getElementById('topbar-user-name');
  if (nameEl && !nameEl.dataset.roleApplied) {
    nameEl.innerHTML = escHtml(state.user?.name || '') + ` <span style="font-size:10px;background:${isAdmin() ? 'var(--purple-bg)' : 'var(--primary-bg)'};color:${isAdmin() ? '#6d28d9' : '#0369a1'};padding:2px 8px;border-radius:50px;font-weight:600">${roleTag}</span>`;
    nameEl.dataset.roleApplied = '1';
  }

  // ซ่อน tabs ที่ editor ไม่มีสิทธิ์
  document.querySelectorAll('[data-tab="import"]').forEach(el => el.style.display = isAdmin() ? '' : 'none');
  document.querySelectorAll('[data-tab="settings"]').forEach(el => el.style.display = isAdmin() ? '' : 'none');
  document.querySelectorAll('[data-tab="users"]').forEach(el => el.style.display = isAdmin() ? '' : 'none');

  // ปุ่ม "บันทึกและอนุมัติ" เฉพาะ Admin
  const btnSaveApprove = document.getElementById('btn-save-approve');
  if (btnSaveApprove) btnSaveApprove.style.display = isAdmin() ? 'inline-flex' : 'none';

  // ซ่อนปุ่ม "รออนุมัติ" tab สำหรับ editor (ดูได้แต่ approve/reject ไม่ได้)
  // → editor ยังเห็น tab ได้แต่ปุ่ม approve/reject จะไม่แสดง (จัดการใน renderPendingList)

  // re-render ถ้ากำลังดู pending
  renderPendingList();
}

function renderStats() {
  const total = state.drugs.length;
  const approved = state.drugs.filter(d => d.status === 'approved').length;
  const pending = state.drugs.filter(d => d.status === 'pending').length;
  const drafts = state.drugs.filter(d => d.status === 'draft').length;
  const had = state.drugs.filter(d => d.had).length;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">ยาทั้งหมด</div><div class="stat-value primary">${total}</div></div>
    <div class="stat-card"><div class="stat-label">Approved</div><div class="stat-value success">${approved}</div></div>
    <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value warning">${pending}</div></div>
    <div class="stat-card"><div class="stat-label">Draft</div><div class="stat-value">${drafts}</div></div>
    <div class="stat-card"><div class="stat-label">High-Alert</div><div class="stat-value danger">${had}</div></div>
  `;
}

function populateCategories() {
  const cats = new Set();
  state.drugs.forEach(d => {
    (d.categories || []).forEach(c => cats.add(c.trim().toLowerCase()));
  });
  const sel = document.getElementById('filter-category');
  const current = sel.value;
  sel.innerHTML = '<option value="">ทุกหมวดหมู่</option>';
  [...cats].sort().forEach(c => {
    sel.innerHTML += `<option value="${escHtml(c)}">${escHtml(c)}</option>`;
  });
  sel.value = current;
}

function getFilteredDrugs() {
  const q = document.getElementById('search-drugs').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const cat = document.getElementById('filter-category').value;

  let list = state.drugs.filter(d => {
    if (q && !d.generic?.toLowerCase().includes(q) && !d.trade?.toLowerCase().includes(q)) return false;
    if (status && d.status !== status) return false;
    if (cat && !(d.categories || []).some(c => c.toLowerCase() === cat)) return false;
    return true;
  });

  // Sort
  list.sort((a, b) => {
    let va = a[state.sortField] || '', vb = b[state.sortField] || '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

function renderDrugTable() {
  const filtered = getFilteredDrugs();
  const total = filtered.length;
  const pages = Math.ceil(total / ITEMS_PER_PAGE);
  if (state.currentPage > pages) state.currentPage = Math.max(1, pages);

  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  const page = filtered.slice(start, start + ITEMS_PER_PAGE);

  const tbody = document.getElementById('drug-table-body');
  tbody.innerHTML = page.map(d => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${escHtml(String(d.id || '—'))}</td>
      <td>
        <div class="drug-name">${escHtml(d.generic || '')}</div>
        ${d.had ? '<span class="badge badge-had" style="font-size:10px">⚠ HAD</span>' : ''}
      </td>
      <td class="drug-trade">${escHtml(d.trade || '—')}</td>
      <td>${(d.categories || []).map(c => `<span class="badge badge-cat">${escHtml(c)}</span>`).join('')}</td>
      <td><span class="badge ${d.ed === 'E' ? 'badge-ed' : 'badge-ned'}">${escHtml(d.ed || '—')}</span></td>
      <td>${d.had ? '⚠️' : '—'}</td>
      <td><span class="badge badge-${escHtml(d.status || 'draft')}">${escHtml(d.status || 'draft')}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" data-action="editDrug" data-id="${escHtml(String(d.id))}" title="แก้ไข">✏️</button>
          <button class="btn btn-sm btn-outline" data-action="previewDrugById" data-id="${escHtml(String(d.id))}" title="Preview">👁</button>
          ${isAdmin() && d.status === 'pending' ? `<button class="btn btn-sm btn-success" data-action="approveDrug" data-id="${escHtml(String(d.id))}" title="อนุมัติ">✅</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteDrug" data-id="${escHtml(String(d.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  // Pagination
  const pag = document.getElementById('pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let html = `<span style="color:var(--text-muted);font-size:12px">${total} รายการ</span>`;
  html += `<button class="page-btn" data-action="goPage" data-page="${state.currentPage - 1}" ${state.currentPage <= 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - state.currentPage) > 2 && i !== 1 && i !== pages) {
      if (i === state.currentPage - 3 || i === state.currentPage + 3) html += '<span>…</span>';
      continue;
    }
    html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" data-action="goPage" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-action="goPage" data-page="${state.currentPage + 1}" ${state.currentPage >= pages ? 'disabled' : ''}>›</button>`;
  pag.innerHTML = html;
}

function goPage(p) {
  const pages = Math.ceil(getFilteredDrugs().length / ITEMS_PER_PAGE);
  if (p < 1 || p > pages) return;
  state.currentPage = p;
  renderDrugTable();
  document.querySelector('.table-wrap').scrollIntoView({ behavior: 'smooth' });
}

function sortTable(field) {
  if (state.sortField === field) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortField = field;
    state.sortDir = 'asc';
  }
  renderDrugTable();
}

// filterDrugs: triggered by search/filter UI — resets page and re-renders
function filterDrugs() {
  state.currentPage = 1;
  renderDrugTable();
}

// Export data as CSV
function exportData() {
  if (state.drugs.length === 0) {
    toast('ไม่มีข้อมูลให้ export', 'info');
    return;
  }
  const headers = ['ID','Generic Name','Trade Name','Strength','ED','HAD','Categories','Status','Route','Rate','Reconst Solvent','Reconst Volume','Reconst Conc','Diluent','Dilution Volume','Final Conc','Stability Reconst','Stability Diluted','Storage','Y-site Compatible','Incompatible','Precautions','Monitoring','Reference'];
  const rows = state.drugs.map(d => [
    d.id || '', d.generic || '', d.trade || '', d.strength || '', d.ed || '', d.had ? 'Y' : 'N',
    (d.categories || []).join('; '), d.status || '',
    d.admin?.route || '', d.admin?.rate || '',
    d.reconst?.solvent || '', d.reconst?.volume || '', d.reconst?.conc || '',
    d.dilution?.diluent || '', d.dilution?.volume || '', d.dilution?.finalConc || '',
    d.stability?.reconst || '', d.stability?.diluted || '', d.stability?.storage || '',
    d.compat?.ysite || '', d.compat?.incompat || '',
    d.precautions || '', (d.monitoring || []).join('; '), d.ref || ''
  ]);
  const csvContent = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `iv_drugref_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('📥 ส่งออก CSV สำเร็จ', 'success');
}

/* ═══════════════════════════════════════════
   DRUG FORM MODAL
   ═══════════════════════════════════════════ */
function openDrugModal(drug = null) {
  state.editingId = drug ? drug.id : null;
  document.getElementById('modal-title').textContent = drug ? `แก้ไข: ${drug.generic}` : 'เพิ่มยาใหม่';
  togglePreview(false);

  // Populate form
  const fields = {
    'f-generic': drug?.generic || '',
    'f-trade': drug?.trade || '',
    'f-strength': drug?.strength || '',
    'f-ed': drug?.ed || 'E',
    'f-categories': Array.isArray(drug?.categories) ? drug.categories.join(', ') : (drug?.categories || ''),
    'f-reconst-solvent': drug?.reconst?.solvent || '',
    'f-reconst-volume': drug?.reconst?.volume || '',
    'f-reconst-conc': drug?.reconst?.conc || '',
    'f-dil-diluent': drug?.dilution?.diluent || '',
    'f-dil-volume': drug?.dilution?.volume || '',
    'f-dil-conc': drug?.dilution?.finalConc || '',
    'f-admin-route': drug?.admin?.route || '',
    'f-admin-rate': drug?.admin?.rate || '',
    'f-stab-reconst': drug?.stability?.reconst || '',
    'f-stab-diluted': drug?.stability?.diluted || '',
    'f-stab-storage': drug?.stability?.storage || '',
    'f-compat-ysite': drug?.compat?.ysite || '',
    'f-compat-incompat': drug?.compat?.incompat || '',
    'f-precautions': drug?.precautions || '',
    'f-monitoring': Array.isArray(drug?.monitoring) ? drug.monitoring.join(', ') : (drug?.monitoring || ''),
    'f-ref': drug?.ref || '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  document.getElementById('f-had').checked = drug?.had || false;

  // แสดง/ซ่อนปุ่ม "บันทึกและอนุมัติ" ตาม role
  const btnSaveApprove = document.getElementById('btn-save-approve');
  if (btnSaveApprove) {
    btnSaveApprove.style.display = isAdmin() ? 'inline-flex' : 'none';
  }

  document.getElementById('drug-modal').classList.add('open');
}

function closeDrugModal() {
  document.getElementById('drug-modal').classList.remove('open');
  state.editingId = null;
}

function editDrug(id) {
  const drug = state.drugs.find(d => d.id === id);
  if (drug) openDrugModal(drug);
}

function getFormData() {
  return {
    generic: document.getElementById('f-generic').value.trim(),
    trade: document.getElementById('f-trade').value.trim(),
    strength: document.getElementById('f-strength').value.trim(),
    ed: document.getElementById('f-ed').value,
    categories: document.getElementById('f-categories').value.split(',').map(s => s.trim()).filter(Boolean),
    had: document.getElementById('f-had').checked,
    reconst: {
      solvent: document.getElementById('f-reconst-solvent').value.trim(),
      volume: document.getElementById('f-reconst-volume').value.trim(),
      conc: document.getElementById('f-reconst-conc').value.trim(),
    },
    dilution: {
      diluent: document.getElementById('f-dil-diluent').value.trim(),
      volume: document.getElementById('f-dil-volume').value.trim(),
      finalConc: document.getElementById('f-dil-conc').value.trim(),
    },
    admin: {
      route: document.getElementById('f-admin-route').value.trim(),
      rate: document.getElementById('f-admin-rate').value.trim(),
    },
    stability: {
      reconst: document.getElementById('f-stab-reconst').value.trim(),
      diluted: document.getElementById('f-stab-diluted').value.trim(),
      storage: document.getElementById('f-stab-storage').value.trim(),
    },
    compat: {
      ysite: document.getElementById('f-compat-ysite').value.trim(),
      incompat: document.getElementById('f-compat-incompat').value.trim(),
    },
    precautions: document.getElementById('f-precautions').value.trim(),
    monitoring: document.getElementById('f-monitoring').value.split(',').map(s => s.trim()).filter(Boolean),
    ref: document.getElementById('f-ref').value.trim(),
  };
}

async function saveDrug(status) {
  const data = getFormData();
  if (!data.generic) {
    toast('กรุณากรอก Generic Name', 'error');
    return;
  }

  // ═══ ENFORCE: ห้าม set approved ตรงๆ — ต้องผ่าน saveDrugAndApprove() ═══
  if (status === 'approved') {
    status = 'pending';
  }
  // Editor สามารถบันทึกเป็น draft หรือ pending เท่านั้น
  if (!isAdmin() && !['draft', 'pending'].includes(status)) {
    status = 'draft';
  }
  data.status = status;
  showLoading('กำลังบันทึก...');

  // ═══ Snapshot previous approved data for diff review ═══
  if (status === 'pending' && state.editingId) {
    const existing = state.drugs.find(d => d.id === state.editingId);
    if (existing && existing.status === 'approved') {
      const { previousData: _, ...snapshot } = existing;
      data.previousData = JSON.stringify(snapshot);
    }
  }

  const statusLabel = status === 'pending' ? '⏳ รออนุมัติ' : '📝 Draft';
  try {
    let resultId;
    if (state.editingId) {
      data.id = state.editingId;
      const result = await apiCall('updateDrug', data);
      resultId = state.editingId;
      toast(`แก้ไข ${data.generic} สำเร็จ — ${statusLabel}`, 'success');
    } else {
      const result = await apiCall('createDrug', data);
      resultId = result.id;
      toast(`เพิ่ม ${data.generic} สำเร็จ — ${statusLabel}`, 'success');
    }
    closeDrugModal();
    await loadDrugs();
    return resultId;
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    return null;
  } finally {
    hideLoading();
  }
}

/**
 * Admin-only: บันทึกยาแล้วอนุมัติในขั้นตอนเดียว
 * ทำงาน 2 step: createDrug (status=pending) → approveDrug
 * ทำให้ audit log บันทึกทั้ง create + approve แยกกัน
 */
async function saveDrugAndApprove() {
  if (!isAdmin()) {
    toast('❌ เฉพาะ Admin เท่านั้นที่อนุมัติได้', 'error');
    return;
  }

  const data = getFormData();
  if (!data.generic) {
    toast('กรุณากรอก Generic Name', 'error');
    return;
  }

  data.status = 'pending'; // ต้องเป็น pending ก่อน → แล้วค่อย approve
  showLoading('กำลังบันทึกและอนุมัติ...');

  try {
    let drugId;
    if (state.editingId) {
      data.id = state.editingId;
      await apiCall('updateDrug', data);
      drugId = state.editingId;
    } else {
      const result = await apiCall('createDrug', data);
      drugId = result.id;
    }

    // Step 2: Approve
    await apiCall('approveDrug', { id: drugId, approver: state.user?.email });
    logSyncChange('approve', data.generic);
    toast(`✅ ${data.generic} — บันทึกและอนุมัติแล้ว (pending → approved)`, 'success');
    closeDrugModal();
    await loadDrugs();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

async function deleteDrug(id) {
  if (!isAdmin()) { toast('❌ Editor ไม่มีสิทธิ์ลบยา', 'error'); return; }
  const drug = state.drugs.find(d => d.id === id);
  if (!confirm(`ยืนยันลบ "${drug?.generic || id}"?\n\nข้อมูลจะถูกย้ายไป Audit Log`)) return;

  showLoading('กำลังลบ...');
  try {
    await apiCall('deleteDrug', { id });
    logSyncChange('delete', drug?.generic || 'ID:' + id);
    toast(`ลบ ${drug?.generic} แล้ว`, 'success');
    await loadDrugs();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

/* ═══════════════════════════════════════════
   APPROVAL WORKFLOW
   ═══════════════════════════════════════════ */
async function approveDrug(id) {
  if (!isAdmin()) { toast('❌ Editor ไม่มีสิทธิ์อนุมัติยา', 'error'); return; }
  const drug = state.drugs.find(d => d.id === id);
  if (!confirm(`อนุมัติ "${drug?.generic}"?\n\nยานี้จะถูก publish ไปยัง production app`)) return;

  showLoading('กำลังอนุมัติ...');
  try {
    await apiCall('approveDrug', { id, approver: state.user?.email });
    logSyncChange('approve', drug?.generic || 'ID:' + id);
    toast(`✅ อนุมัติ ${drug?.generic} แล้ว — จะปรากฏใน app หลัก`, 'success');
    await loadDrugs();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

async function rejectDrug(id, reason) {
  if (!isAdmin()) { toast('❌ Editor ไม่มีสิทธิ์ส่งกลับยา', 'error'); return; }
  showLoading('กำลังส่งกลับ...');
  try {
    await apiCall('rejectDrug', { id, reason, reviewer: state.user?.email });
    var rejectedDrug = state.drugs.find(function(d) { return d.id === id; });
    logSyncChange('reject', rejectedDrug?.generic || 'ID:' + id);
    toast('ส่งกลับแก้ไขแล้ว', 'info');
    await loadDrugs();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

function updatePendingCount() {
  const count = state.drugs.filter(d => d.status === 'pending').length;
  const badge = document.getElementById('pending-count');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function renderPendingList() {
  const pending = state.drugs.filter(d => d.status === 'pending');
  const el = document.getElementById('pending-list');

  if (pending.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)">✅ ไม่มียาที่รออนุมัติ</div>';
    return;
  }

  el.innerHTML = pending.map(d => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px;box-shadow:var(--shadow)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <strong style="font-size:16px">${escHtml(d.generic)}</strong>
          <span style="color:var(--text-muted);margin-left:8px">${escHtml(d.trade || '')}</span>
          ${d.had ? '<span class="badge badge-had" style="margin-left:8px">⚠ HAD</span>' : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-outline" data-action="openDiffModal" data-id="${escHtml(String(d.id))}">🔍 ตรวจสอบ</button>
          <button class="btn btn-sm btn-outline" data-action="editDrug" data-id="${escHtml(String(d.id))}">✏️ แก้ไข</button>
          ${isAdmin() ? `<button class="btn btn-sm btn-success" data-action="approveDrug" data-id="${escHtml(String(d.id))}">✅ อนุมัติ</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-danger" data-action="rejectDrug" data-id="${escHtml(String(d.id))}">↩️ ส่งกลับ</button>` : '<span class="badge badge-pending">รอ Admin อนุมัติ</span>'}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:12px;color:var(--text-muted)">
        <div><strong>Strength:</strong> ${escHtml(d.strength || '—')}</div>
        <div><strong>Route:</strong> ${escHtml(d.admin?.route || '—')}</div>
        <div><strong>Rate:</strong> ${escHtml(d.admin?.rate || '—')}</div>
        <div><strong>Categories:</strong> ${(d.categories||[]).map(c => escHtml(c)).join(', ') || '—'}</div>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════
   DIFF REVIEW MODAL
   ═══════════════════════════════════════════ */

/** Field definitions for diff display — [label, path, type] */
const DIFF_FIELDS = [
  // section: ข้อมูลทั่วไป
  { section: 'ข้อมูลทั่วไป' },
  { label: 'ชื่อสามัญ (Generic)', path: 'generic' },
  { label: 'ชื่อการค้า (Trade)', path: 'trade' },
  { label: 'ความแรง', path: 'strength' },
  { label: 'บัญชียาหลัก', path: 'ed' },
  { label: 'High-Alert Drug', path: 'had', type: 'boolean' },
  { label: 'หมวดหมู่', path: 'categories', type: 'array' },
  // section: การผสมยา
  { section: 'การผสมยา (Reconstitution)' },
  { label: 'ตัวทำละลาย', path: 'reconst.solvent' },
  { label: 'ปริมาตรผสม', path: 'reconst.volume' },
  { label: 'ความเข้มข้น', path: 'reconst.conc' },
  // section: การเจือจาง
  { section: 'การเจือจาง (Dilution)' },
  { label: 'สารละลาย', path: 'dilution.diluent' },
  { label: 'ปริมาตร', path: 'dilution.volume' },
  { label: 'ความเข้มข้นสุดท้าย', path: 'dilution.finalConc' },
  // section: การบริหารยา
  { section: 'การบริหารยา (Administration)' },
  { label: 'วิธีให้ยา', path: 'admin.route' },
  { label: 'อัตราเร็ว', path: 'admin.rate' },
  // section: ความคงตัว
  { section: 'ความคงตัว (Stability)' },
  { label: 'หลังผสม', path: 'stability.reconst' },
  { label: 'หลังเจือจาง', path: 'stability.diluted' },
  { label: 'การเก็บรักษา', path: 'stability.storage' },
  // section: ความเข้ากัน
  { section: 'ความเข้ากัน (Compatibility)' },
  { label: 'Y-site compatible', path: 'compat.ysite' },
  { label: 'Incompatible', path: 'compat.incompat' },
  // section: อื่นๆ
  { section: 'อื่นๆ' },
  { label: 'ข้อควรระวัง', path: 'precautions' },
  { label: 'Monitoring', path: 'monitoring', type: 'array' },
  { label: 'อ้างอิง', path: 'ref' },
];

function getNestedVal(obj, path) {
  if (!obj) return '';
  return path.split('.').reduce((o, k) => (o && o[k] != null) ? o[k] : '', obj);
}

function formatDiffVal(val, type) {
  if (type === 'boolean') return val ? '✅ ใช่' : '❌ ไม่';
  if (type === 'array') {
    const arr = Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(',').map(s => s.trim()) : []);
    return arr.length ? arr.join(', ') : '';
  }
  if (val === '' || val == null) return '';
  return String(val);
}

function openDiffModal(drugId) {
  const drug = state.drugs.find(d => d.id === drugId);
  if (!drug) { toast('ไม่พบข้อมูลยา', 'error'); return; }

  state.diffDrugId = drugId;
  const prev = drug.previousData || null;
  const isNew = !prev;

  // Title
  document.getElementById('diff-modal-title').textContent =
    isNew ? `🆕 ยาใหม่: ${escHtml(drug.generic)}` : `🔍 เปรียบเทียบ: ${escHtml(drug.generic)}`;

  // Show/hide approve/reject buttons based on role
  const isAdm = isAdmin();
  document.getElementById('diff-approve-btn').style.display = isAdm ? 'inline-flex' : 'none';
  document.getElementById('diff-reject-btn').style.display = isAdm ? 'inline-flex' : 'none';

  // Render diff content
  const el = document.getElementById('diff-content');
  el.innerHTML = renderDiffHTML(prev, drug, isNew);

  document.getElementById('diff-modal').classList.add('open');
}

function renderDiffHTML(oldData, newData, isNew) {
  if (isNew) {
    return `<div class="diff-new-drug-notice">🆕 ยาใหม่ — ยังไม่มีข้อมูลเดิมให้เปรียบเทียบ</div>` + renderNewDrugTable(newData);
  }

  // Count changes
  let changed = 0, added = 0, removed = 0, same = 0;
  const rows = [];

  for (const field of DIFF_FIELDS) {
    if (field.section) {
      rows.push(`<tr class="diff-section-header"><td colspan="3">${escHtml(field.section)}</td></tr>`);
      continue;
    }
    const oldVal = formatDiffVal(getNestedVal(oldData, field.path), field.type);
    const newVal = formatDiffVal(getNestedVal(newData, field.path), field.type);
    let cls = 'diff-same';
    if (oldVal === newVal) {
      same++;
    } else if (!oldVal && newVal) {
      cls = 'diff-added'; added++;
    } else if (oldVal && !newVal) {
      cls = 'diff-removed'; removed++;
    } else {
      cls = 'diff-changed'; changed++;
    }
    rows.push(`<tr class="diff-row ${cls}">
      <td class="diff-label">${escHtml(field.label)}</td>
      <td class="diff-old">${escHtml(oldVal) || '<span style="opacity:0.4">—</span>'}</td>
      <td class="diff-new">${escHtml(newVal) || '<span style="opacity:0.4">—</span>'}</td>
    </tr>`);
  }

  const summary = `<div class="diff-summary">
    ${changed ? `<span class="diff-summary-item"><span class="diff-dot changed"></span> แก้ไข ${changed}</span>` : ''}
    ${added ? `<span class="diff-summary-item"><span class="diff-dot added"></span> เพิ่ม ${added}</span>` : ''}
    ${removed ? `<span class="diff-summary-item"><span class="diff-dot removed"></span> ลบ ${removed}</span>` : ''}
    <span class="diff-summary-item"><span class="diff-dot same"></span> ไม่เปลี่ยน ${same}</span>
  </div>`;

  return summary + `<table class="diff-table">
    <thead><tr><th>ฟิลด์</th><th>ข้อมูลเดิม</th><th>ข้อมูลใหม่</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function renderNewDrugTable(drug) {
  const rows = [];
  for (const field of DIFF_FIELDS) {
    if (field.section) {
      rows.push(`<tr class="diff-section-header"><td colspan="2">${escHtml(field.section)}</td></tr>`);
      continue;
    }
    const val = formatDiffVal(getNestedVal(drug, field.path), field.type);
    if (!val) continue; // skip empty fields for new drugs
    rows.push(`<tr class="diff-row diff-added">
      <td class="diff-label">${escHtml(field.label)}</td>
      <td class="diff-new">${escHtml(val)}</td>
    </tr>`);
  }
  return `<table class="diff-table">
    <thead><tr><th>ฟิลด์</th><th>ค่า</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function closeDiffModal() {
  document.getElementById('diff-modal').classList.remove('open');
  state.diffDrugId = null;
}

async function approveDrugFromDiff() {
  if (!state.diffDrugId) return;
  closeDiffModal();
  await approveDrug(state.diffDrugId);
}

function rejectDrugFromDiff() {
  if (!state.diffDrugId) return;
  const reason = prompt('เหตุผลที่ส่งกลับ:');
  if (reason === null) return;
  closeDiffModal();
  rejectDrug(state.diffDrugId, reason);
}

/* ═══════════════════════════════════════════
   PREVIEW CARD
   ═══════════════════════════════════════════ */
function togglePreview(showPreview) {
  document.getElementById('form-view').style.display = showPreview ? 'none' : 'block';
  document.getElementById('preview-view').style.display = showPreview ? 'block' : 'none';
  document.getElementById('btn-tab-form').style.background = showPreview ? 'transparent' : 'var(--primary)';
  document.getElementById('btn-tab-form').style.color = showPreview ? 'var(--text-muted)' : 'white';
  document.getElementById('btn-tab-preview').style.background = showPreview ? 'var(--primary)' : 'transparent';
  document.getElementById('btn-tab-preview').style.color = showPreview ? 'white' : 'var(--text-muted)';

  if (showPreview) renderPreviewCard(getFormData());
}

function previewDrugById(id) {
  const drug = state.drugs.find(d => d.id === id);
  if (drug) {
    openDrugModal(drug);
    setTimeout(() => togglePreview(true), 50);
  }
}

function renderPreviewCard(d) {
  const card = document.getElementById('preview-card');
  card.className = 'preview-card' + (d.had ? ' had-pulse' : '');

  const sections = [];
  if (d.reconst?.solvent || d.reconst?.volume || d.reconst?.conc) {
    sections.push({ title: 'Reconstitution', content: [d.reconst.solvent, d.reconst.volume ? `Volume: ${d.reconst.volume}` : '', d.reconst.conc ? `Conc: ${d.reconst.conc}` : ''].filter(Boolean).join(' — ') });
  }
  if (d.dilution?.diluent || d.dilution?.volume || d.dilution?.finalConc) {
    sections.push({ title: 'Dilution', content: [d.dilution.diluent, d.dilution.volume ? `Volume: ${d.dilution.volume}` : '', d.dilution.finalConc ? `Final: ${d.dilution.finalConc}` : ''].filter(Boolean).join(' — ') });
  }
  if (d.admin?.route || d.admin?.rate) {
    sections.push({ title: 'Administration', content: [d.admin.route, d.admin.rate].filter(Boolean).join(' — ') });
  }
  if (d.stability?.reconst || d.stability?.diluted || d.stability?.storage) {
    sections.push({ title: 'Stability', content: [d.stability.reconst ? `Reconst: ${d.stability.reconst}` : '', d.stability.diluted ? `Diluted: ${d.stability.diluted}` : '', d.stability.storage ? `Storage: ${d.stability.storage}` : ''].filter(Boolean).join(' | ') });
  }
  if (d.compat?.ysite) {
    sections.push({ title: 'Y-site Compatible', content: d.compat.ysite });
  }
  if (d.compat?.incompat) {
    sections.push({ title: 'Incompatible', content: d.compat.incompat });
  }
  if (d.precautions) {
    sections.push({ title: 'Precautions', content: d.precautions });
  }
  if (d.monitoring?.length) {
    sections.push({ title: 'Monitoring', content: d.monitoring.join(', ') });
  }

  card.innerHTML = `
    <div class="preview-card-header">
      <div>
        <h3>${escHtml(d.generic || 'Drug Name')}</h3>
        <div class="trade">${escHtml(d.trade || '')}</div>
        <div class="strength">${escHtml(d.strength || '')}</div>
      </div>
    </div>
    <div class="preview-card-badges">
      ${d.had ? '<span class="badge badge-had">⚠ High-Alert Drug</span>' : ''}
      <span class="badge ${d.ed === 'E' ? 'badge-ed' : 'badge-ned'}">${d.ed === 'E' ? 'ED' : 'NED'}</span>
      ${(d.categories || []).map(c => `<span class="badge badge-cat">${escHtml(c)}</span>`).join('')}
    </div>
    ${sections.map(s => `
      <div class="preview-section">
        <div class="preview-section-title">${s.title}</div>
        <div class="preview-section-content">${escHtml(s.content)}</div>
      </div>
    `).join('')}
    ${d.ref ? `<div style="padding:8px 20px;font-size:11px;color:var(--text-light);border-top:1px solid var(--border)">📚 ${escHtml(d.ref)}</div>` : ''}
  `;
}

/* ═══════════════════════════════════════════
   BULK IMPORT
   ═══════════════════════════════════════════ */
function setupImportZone() {
  const zone = document.getElementById('import-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleImportFile({ target: { files: e.dataTransfer.files } });
  });
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => { processImportData(result.data, file.name); },
      error: (err) => { toast('CSV parse error: ' + err.message, 'error'); }
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      processImportData(data, file.name);
    };
    reader.readAsArrayBuffer(file);
  } else {
    toast('ไม่รองรับไฟล์นามสกุล .' + ext, 'error');
  }
}

function processImportData(data, filename) {
  if (!data || data.length === 0) {
    toast('ไฟล์ว่างเปล่า', 'error');
    return;
  }

  // Map columns to drug schema
  state.importData = data.map((row, i) => ({
    _row: i + 2,
    generic: row['Generic Name'] || row['generic'] || row['Generic'] || '',
    trade: row['Trade Name'] || row['trade'] || row['Trade'] || '',
    strength: row['Strength'] || row['strength'] || '',
    ed: row['ED'] || row['ed'] || row['ED/NED'] || 'N',
    categories: (row['Categories'] || row['categories'] || '').split(',').map(s => s.trim()).filter(Boolean),
    had: ['true','1','yes','Y'].includes(String(row['HAD'] || row['had'] || '').toLowerCase()),
    reconst: {
      solvent: row['Reconst Solvent'] || row['reconst_solvent'] || '',
      volume: row['Reconst Volume'] || row['reconst_volume'] || '',
      conc: row['Reconst Conc'] || row['reconst_conc'] || '',
    },
    dilution: {
      diluent: row['Diluent'] || row['diluent'] || '',
      volume: row['Dilution Volume'] || row['dilution_volume'] || '',
      finalConc: row['Final Conc'] || row['final_conc'] || '',
    },
    admin: {
      route: row['Route'] || row['route'] || '',
      rate: row['Rate'] || row['rate'] || '',
    },
    stability: {
      reconst: row['Stability Reconst'] || row['stability_reconst'] || '',
      diluted: row['Stability Diluted'] || row['stability_diluted'] || '',
      storage: row['Storage'] || row['storage'] || '',
    },
    compat: {
      ysite: row['Y-site Compatible'] || row['ysite'] || '',
      incompat: row['Incompatible'] || row['incompat'] || '',
    },
    precautions: row['Precautions'] || row['precautions'] || '',
    monitoring: (row['Monitoring'] || row['monitoring'] || '').split(',').map(s => s.trim()).filter(Boolean),
    ref: row['Reference'] || row['ref'] || '',
    status: 'draft',
  }));

  // Validate
  const errors = [];
  state.importData.forEach((d, i) => {
    if (!d.generic) errors.push(`Row ${d._row}: ไม่มี Generic Name`);
  });

  const valid = state.importData.filter(d => d.generic);

  // Show preview
  const area = document.getElementById('import-preview');
  area.innerHTML = `
    <div class="import-status ${errors.length ? 'error' : 'success'}" style="margin-top:16px">
      📄 ${escHtml(filename)} — พบ ${data.length} rows, valid ${valid.length} rows
      ${errors.length ? `<br>⚠️ ${errors.length} errors: ${escHtml(errors.slice(0, 3).join('; '))}${errors.length > 3 ? '...' : ''}` : ''}
    </div>
    <div class="import-preview">
      <div class="table-wrap" style="margin-top:12px">
        <table class="drug-table">
          <thead><tr><th>Row</th><th>Generic</th><th>Trade</th><th>Strength</th><th>ED</th><th>HAD</th><th>Categories</th></tr></thead>
          <tbody>
            ${valid.slice(0, 50).map(d => `
              <tr>
                <td>${d._row}</td>
                <td class="drug-name">${escHtml(d.generic)}</td>
                <td class="drug-trade">${escHtml(d.trade)}</td>
                <td>${escHtml(d.strength)}</td>
                <td><span class="badge ${d.ed === 'E' ? 'badge-ed' : 'badge-ned'}">${d.ed}</span></td>
                <td>${d.had ? '⚠️' : '—'}</td>
                <td>${d.categories.map(c => `<span class="badge badge-cat">${escHtml(c)}</span>`).join('')}</td>
              </tr>
            `).join('')}
            ${valid.length > 50 ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">... และอีก ${valid.length - 50} รายการ</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (valid.length > 0) {
    document.getElementById('btn-import-confirm').style.display = 'inline-flex';
  }
}

async function confirmImport() {
  const valid = (state.importData || []).filter(d => d.generic);
  if (valid.length === 0) return;

  if (!confirm(`ยืนยัน import ${valid.length} รายการ?\n\nทุกรายการจะถูกตั้งเป็น "draft"`)) return;

  showLoading(`กำลัง import ${valid.length} รายการ...`);
  try {
    await apiCallChunked('bulkImport', valid, 15);
    toast(`✅ Import ${valid.length} รายการสำเร็จ`, 'success');
    state.importData = null;
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('btn-import-confirm').style.display = 'none';
    await loadDrugs();
    switchTab('drugs');
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

function downloadTemplate() {
  const headers = ['Generic Name','Trade Name','Strength','ED','Categories','HAD','Reconst Solvent','Reconst Volume','Reconst Conc','Diluent','Dilution Volume','Final Conc','Route','Rate','Stability Reconst','Stability Diluted','Storage','Y-site Compatible','Incompatible','Precautions','Monitoring','Reference'];
  const example = ['vancomycin','Vancocin','500 mg/vial','E','antibiotic','false','SWFI','10 mL','50 mg/mL','NSS or D5W','200 mL','2.5-5 mg/mL','IV infusion','over 60 min','96 hr at RT','96 hr at RT','15-25°C','Amikacin, Cefepime','Ceftriaxone, Heparin','Red man syndrome: infuse over ≥60 min','SCr, BUN, Trough level, WBC','Lexicomp 2025'];

  const csv = headers.join(',') + '\n' + example.map(v => `"${v}"`).join(',') + '\n';
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'iv_drugref_import_template.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('ดาวน์โหลด template แล้ว', 'info');
}

/* ═══════════════════════════════════════════
   AUDIT LOG
   ═══════════════════════════════════════════ */
async function loadAuditLog() {
  try {
    const result = await apiCall('getAudit');
    state.auditLog = result.log || [];
    renderAuditLog();
  } catch (e) {
    console.error('Audit load error:', e);
  }
}

function renderAuditLog() {
  const actionFilter = document.getElementById('audit-filter-action').value;
  const dateFrom = document.getElementById('audit-date-from').value;
  const dateTo = document.getElementById('audit-date-to').value;

  let log = state.auditLog.filter(entry => {
    if (actionFilter && entry.action !== actionFilter) return false;
    if (dateFrom && entry.timestamp < dateFrom) return false;
    if (dateTo && entry.timestamp > dateTo + 'T23:59:59') return false;
    return true;
  });

  const perPage = 30;
  const total = log.length;
  const pages = Math.ceil(total / perPage);
  const start = (state.auditPage - 1) * perPage;
  const page = log.slice(start, start + perPage);

  const timeline = document.getElementById('audit-log-container');
  if (page.length === 0) {
    timeline.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)">ไม่มีรายการ</div>';
    return;
  }

  timeline.innerHTML = page.map(e => `
    <div class="audit-item ${e.action}">
      <div class="audit-meta">
        <span>${formatDate(e.timestamp)}</span>
        <span>👤 ${escHtml(e.user || 'unknown')}</span>
      </div>
      <div class="audit-action">
        ${actionIcon(e.action)} ${actionLabel(e.action)}: <strong>${escHtml(e.drugName || '')}</strong>
        ${e.drugId ? `<span style="font-family:var(--mono);font-size:11px;color:var(--text-light)">#${escHtml(String(e.drugId))}</span>` : ''}
      </div>
      ${e.details ? `<div class="audit-details">${escHtml(e.details)}</div>` : ''}
    </div>
  `).join('');

  // Pagination
  const pag = document.getElementById('audit-pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === state.auditPage ? 'active' : ''}" data-action="auditGoPage" data-page="${i}">${i}</button>`;
  }
  pag.innerHTML = html;
}

function auditGoPage(p) { state.auditPage = p; renderAuditLog(); }

function actionIcon(a) {
  return { create: '🆕', edit: '✏️', delete: '🗑', approve: '✅', reject: '↩️', import: '📥' }[a] || '📝';
}
function actionLabel(a) {
  return { create: 'สร้างใหม่', edit: 'แก้ไข', delete: 'ลบ', approve: 'อนุมัติ', reject: 'ส่งกลับ', import: 'Import' }[a] || a;
}

/* ═══════════════════════════════════════════
   USER MANAGEMENT (admin only)
   ═══════════════════════════════════════════ */
async function loadUsers() {
  try {
    const result = await apiCall('getUsers');
    state.adminUsers = result.users || [];
    if (result.myRole) state.myRole = result.myRole;
    renderUsersTable();
  } catch (e) {
    console.error('loadUsers error:', e);
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (state.adminUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">ยังไม่มีผู้ใช้ — เพิ่มผู้ใช้คนแรก</td></tr>';
    return;
  }

  tbody.innerHTML = state.adminUsers.map(u => {
    const isMe = u.email.toLowerCase() === (state.user?.email || '').toLowerCase();
    const roleBadge = u.role === 'admin'
      ? '<span class="badge" style="background:var(--purple-bg);color:#6d28d9">🔑 Admin</span>'
      : '<span class="badge" style="background:var(--primary-bg);color:#0369a1">📝 Editor</span>';
    return `
      <tr>
        <td style="font-size:13px">${escHtml(u.email)} ${isMe ? '<span style="font-size:10px;color:var(--success)">(คุณ)</span>' : ''}</td>
        <td style="font-size:13px">${escHtml(u.name || '—')}</td>
        <td>${roleBadge}</td>
        <td style="font-size:12px;color:var(--text-muted)">${escHtml(u.addedBy || '—')}</td>
        <td style="font-size:12px;color:var(--text-muted)">${u.addedDate ? formatDate(u.addedDate) : '—'}</td>
        <td>
          <div class="actions-cell">
            ${!isMe ? `
              <button class="btn btn-sm btn-outline" data-action="changeRole" data-email="${escHtml(u.email)}" data-role="${u.role === 'admin' ? 'editor' : 'admin'}" title="เปลี่ยน role">
                ${u.role === 'admin' ? '📝 → Editor' : '🔑 → Admin'}
              </button>
              <button class="btn btn-sm btn-outline" data-action="removeUser" data-email="${escHtml(u.email)}" title="ลบผู้ใช้" style="color:var(--danger)">🗑</button>
            ` : '<span style="font-size:11px;color:var(--text-muted)">—</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function addUser() {
  const email = document.getElementById('new-user-email').value.trim();
  const name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;

  if (!email) { toast('กรุณากรอก email', 'error'); return; }

  showLoading('กำลังเพิ่มผู้ใช้...');
  try {
    const result = await apiCall('setUserRole', { email, name, role });
    if (result.error) {
      toast('❌ ' + result.error, 'error');
    } else {
      toast(`✅ เพิ่ม ${email} เป็น ${role} แล้ว`, 'success');
      document.getElementById('new-user-email').value = '';
      document.getElementById('new-user-name').value = '';
      await loadUsers();
    }
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

async function changeRole(email, newRole) {
  if (!confirm(`เปลี่ยน ${email} เป็น ${newRole}?`)) return;

  showLoading('กำลังเปลี่ยน role...');
  try {
    await apiCall('setUserRole', { email, role: newRole });
    toast(`✅ ${email} → ${newRole}`, 'success');
    await loadUsers();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

async function removeUser(email) {
  if (!confirm(`ลบ ${email} ออกจากระบบ?\n\nผู้ใช้นี้จะไม่สามารถเข้า admin ได้อีก`)) return;

  showLoading('กำลังลบผู้ใช้...');
  try {
    await apiCall('removeUser', { email });
    toast(`🗑 ลบ ${email} แล้ว`, 'success');
    await loadUsers();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

/* ═══════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════ */
function loadSettingsUI() {
  const cfg = getConfig();
  document.getElementById('settings-script-url').value = cfg.scriptUrl;
  document.getElementById('settings-client-id').value = cfg.clientId;
  document.getElementById('settings-allowed-emails').value = cfg.allowedEmails.join(', ');
  var ghTokenEl = document.getElementById('settings-gh-token');
  var ghRepoEl = document.getElementById('settings-gh-repo');
  if (ghTokenEl) ghTokenEl.value = cfg.ghToken;
  if (ghRepoEl) ghRepoEl.value = cfg.ghRepo;
}

function saveSettings() {
  const cfg = {
    scriptUrl: document.getElementById('settings-script-url').value.trim(),
    clientId: document.getElementById('settings-client-id').value.trim(),
    allowedEmails: document.getElementById('settings-allowed-emails').value.split(',').map(e => e.trim()).filter(Boolean),
    ghToken: (document.getElementById('settings-gh-token')?.value || '').trim(),
    ghRepo: (document.getElementById('settings-gh-repo')?.value || 'rxbenz/iv-drugref').trim(),
  };
  saveConfig(cfg);
  toast('💾 บันทึกการตั้งค่าแล้ว — reload เพื่อใช้งาน Google Sign-in', 'success');
}

/* ═══════════════════════════════════════════
   PUBLISH CHANGE LOG & SYNC STATUS
   ═══════════════════════════════════════════ */

/** Simple string hash for change detection (FNV-1a 32-bit) */
function hashStr(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Push a change entry to the sync change log */
function logSyncChange(action, generic) {
  var log = JSON.parse(localStorage.getItem(LS_PREFIX + 'syncChangeLog') || '[]');
  log.push({ action: action, generic: generic || '', ts: new Date().toISOString() });
  localStorage.setItem(LS_PREFIX + 'syncChangeLog', JSON.stringify(log));
  checkSyncStatus();
}

/** Get the current sync change log */
function getSyncChangeLog() {
  return JSON.parse(localStorage.getItem(LS_PREFIX + 'syncChangeLog') || '[]');
}

/** Clear the sync change log and update sync state */
function clearSyncState(jsonContent) {
  localStorage.setItem(LS_PREFIX + 'syncChangeLog', '[]');
  localStorage.setItem(LS_PREFIX + 'lastSyncHash', hashStr(jsonContent));
  localStorage.setItem(LS_PREFIX + 'lastSyncTime', new Date().toISOString());
  checkSyncStatus();
}

/** Check and display sync status in the publish panel */
function checkSyncStatus() {
  var el = document.getElementById('publish-status');
  var btn = document.getElementById('btn-publish');
  if (!el) return;

  var log = getSyncChangeLog();
  var lastTime = localStorage.getItem(LS_PREFIX + 'lastSyncTime');
  var lastHash = localStorage.getItem(LS_PREFIX + 'lastSyncHash');
  var approvedCount = state.drugs.filter(function(d) { return d.status === 'approved'; }).length;

  // Also detect hash mismatch (e.g. direct DB edits not tracked by log)
  var hasHashMismatch = false;
  if (lastHash && state.drugs.length > 0) {
    var currentHash = hashStr(buildDrugsDataJSON());
    hasHashMismatch = currentHash !== lastHash;
  }

  var hasChanges = log.length > 0 || hasHashMismatch;

  if (!hasChanges) {
    // Up to date
    el.style.display = 'block';
    el.style.background = 'rgba(16,185,129,.08)';
    el.style.border = '1px solid rgba(16,185,129,.2)';
    el.style.color = 'var(--green, #10b981)';
    var html = '<strong>Up to date</strong> — ไม่มีการเปลี่ยนแปลงที่ยังไม่ publish';
    if (lastTime) html += '<br><span style="font-size:11px;opacity:.7">Publish ล่าสุด: ' + formatSyncTime(lastTime) + ' (' + approvedCount + ' drugs)</span>';
    el.innerHTML = html;
    if (btn) { btn.disabled = true; btn.textContent = '🚀 Publish Changes'; }
  } else {
    // Has pending changes
    el.style.display = 'block';
    el.style.background = 'rgba(245,158,11,.08)';
    el.style.border = '1px solid rgba(245,158,11,.25)';
    el.style.color = 'var(--warning, #f59e0b)';
    var summary = buildChangeSummary(log, hasHashMismatch);
    var html = '<strong>มีการเปลี่ยนแปลงที่ยังไม่ publish</strong>';
    html += '<div style="margin-top:6px;font-size:12px;color:var(--text-secondary)">' + summary + '</div>';
    html += '<div style="font-size:11px;margin-top:4px;opacity:.7">Approved drugs ปัจจุบัน: ' + approvedCount + '</div>';
    if (lastTime) html += '<div style="font-size:11px;opacity:.7">Publish ล่าสุด: ' + formatSyncTime(lastTime) + '</div>';
    el.innerHTML = html;
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Publish Changes (' + (log.length || '!') + ')'; }
  }
}

function formatSyncTime(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso; }
}

function buildChangeSummary(log, hasHashMismatch) {
  if (log.length === 0 && hasHashMismatch) {
    return 'ข้อมูลไม่ตรงกับที่ publish ล่าสุด';
  }
  var counts = {};
  var ACTION_LABELS = { approve: 'อนุมัติ', delete: 'ลบ', reject: 'ส่งกลับ', import: 'import', edit: 'แก้ไข' };
  log.forEach(function(entry) {
    counts[entry.action] = (counts[entry.action] || 0) + 1;
  });
  var parts = [];
  Object.keys(counts).forEach(function(action) {
    parts.push((ACTION_LABELS[action] || escHtml(action)) + ' ' + counts[action] + ' รายการ');
  });
  if (hasHashMismatch && log.length > 0) parts.push('+ มีการเปลี่ยนแปลงอื่น');
  return parts.join(' / ');
}

/* ═══════════════════════════════════════════
   DRUGS-DATA.JSON SYNC
   ═══════════════════════════════════════════ */

/** Build drugs-data.json content from current approved drugs */
function buildDrugsDataJSON() {
  const approved = state.drugs.filter(d => d.status === 'approved');
  approved.sort((a, b) => (a.generic || '').localeCompare(b.generic || ''));
  const cleaned = approved.map((d, i) => {
    const out = { id: i + 1 };
    const fields = ['generic','trade','strength','ed','categories','reconst','dilution','admin',
      'stability','compat','precautions','monitoring','had','ref'];
    for (const f of fields) { if (d[f] !== undefined && d[f] !== null && d[f] !== '') out[f] = d[f]; }
    return out;
  });
  return JSON.stringify(cleaned, null, 2);
}

/** Export drugs-data.json as downloadable file */
function exportDrugsJSON() {
  if (state.drugs.length === 0) { toast('ไม่มีข้อมูลยา — โหลดข้อมูลก่อน', 'info'); return; }
  const json = buildDrugsDataJSON();
  const count = JSON.parse(json).length;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drugs-data.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 Export drugs-data.json สำเร็จ (' + count + ' รายการ)', 'success');
}

/** Publish drugs-data.json to GitHub via Contents API (semi-auto with confirmation) */
async function publishChanges() {
  const cfg = getConfig();
  if (!cfg.ghToken) { toast('❌ กรุณาใส่ GitHub Token ในตั้งค่าก่อน', 'error'); return; }
  if (!cfg.ghRepo) { toast('❌ กรุณาใส่ GitHub Repo', 'error'); return; }
  if (state.drugs.length === 0) { toast('ไม่มีข้อมูลยา — โหลดข้อมูลก่อน', 'info'); return; }

  // Build summary for confirmation
  const log = getSyncChangeLog();
  const json = buildDrugsDataJSON();
  const count = JSON.parse(json).length;
  const lastHash = localStorage.getItem(LS_PREFIX + 'lastSyncHash');
  const hasHashMismatch = lastHash ? hashStr(json) !== lastHash : true;

  if (!hasHashMismatch && log.length === 0) {
    toast('ข้อมูลเป็นปัจจุบันแล้ว — ไม่มีอะไรต้อง publish', 'info');
    return;
  }

  // Build commit message with change details
  var commitParts = [];
  if (log.length > 0) {
    var counts = {};
    log.forEach(function(entry) { counts[entry.action] = (counts[entry.action] || 0) + 1; });
    Object.keys(counts).forEach(function(action) { commitParts.push(action + ' ' + counts[action]); });
  }
  var commitDetail = commitParts.length > 0 ? ' — ' + commitParts.join(', ') : '';
  var commitMsg = 'Publish drugs-data.json (' + count + ' drugs)' + commitDetail;

  // Confirmation dialog
  var confirmText = 'Publish ' + count + ' approved drugs ไปยัง ' + cfg.ghRepo + '?\n\n';
  if (log.length > 0) {
    confirmText += 'การเปลี่ยนแปลง:\n';
    var ACTION_LABELS = { approve: 'อนุมัติ', delete: 'ลบ', reject: 'ส่งกลับ', import: 'import', edit: 'แก้ไข' };
    log.forEach(function(entry) {
      confirmText += '  • ' + (ACTION_LABELS[entry.action] || entry.action) + ': ' + entry.generic + '\n';
    });
  } else {
    confirmText += '(ข้อมูลเปลี่ยนแปลงจากแหล่งอื่น)\n';
  }
  confirmText += '\nCommit: ' + commitMsg;

  if (!confirm(confirmText)) return;

  const resultEl = document.getElementById('sync-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.style.background = 'rgba(14,165,233,.08)';
    resultEl.style.color = 'var(--primary)';
    resultEl.textContent = '🔄 กำลัง publish...';
  }

  try {
    const apiBase = 'https://api.github.com/repos/' + cfg.ghRepo + '/contents/drugs-data.json';
    const headers = { 'Authorization': 'Bearer ' + cfg.ghToken, 'Accept': 'application/vnd.github.v3+json' };

    // 1. Get current file SHA
    const getRes = await fetch(apiBase, { headers: headers });
    if (!getRes.ok && getRes.status !== 404) throw new Error('GitHub GET failed: ' + getRes.status);
    const current = getRes.ok ? await getRes.json() : null;
    const sha = current ? current.sha : undefined;

    // 2. Build content
    const content = btoa(unescape(encodeURIComponent(json)));

    // 3. PUT to GitHub
    const body = {
      message: commitMsg,
      content: content,
      branch: 'main'
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(function() { return {}; });
      throw new Error('GitHub PUT failed: ' + putRes.status + ' — ' + (err.message || ''));
    }

    const result = await putRes.json();

    // Clear change log and update sync state
    clearSyncState(json);

    if (resultEl) {
      resultEl.style.background = 'rgba(16,185,129,.08)';
      resultEl.style.color = 'var(--green, #10b981)';
      resultEl.textContent = '✅ Publish สำเร็จ! ' + count + ' drugs → ' + cfg.ghRepo + '/main\nCommit: ' + (result.commit ? result.commit.sha.substring(0, 7) : 'ok') + '\nGitHub Pages จะ rebuild ภายใน 1-2 นาที';
    }
    toast('✅ Publish to GitHub สำเร็จ (' + count + ' drugs)', 'success');
  } catch (e) {
    if (resultEl) {
      resultEl.style.background = 'rgba(239,68,68,.08)';
      resultEl.style.color = 'var(--danger, #ef4444)';
      resultEl.textContent = '❌ Publish failed: ' + e.message;
    }
    toast('❌ Publish failed: ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════
   COMPATIBILITY PAIRS CRUD
   ═══════════════════════════════════════════ */
const COMPAT_PER_PAGE = 25;
const RESULT_LABELS = { c: '✅ Compatible', i: '❌ Incompatible', v: '⚠️ Variable' };
const RESULT_BADGE = { c: 'badge-approved', i: 'badge-had', v: 'badge-pending' };

async function loadCompatPairs() {
  refreshSupaStatus();
  showLoading('กำลังโหลดข้อมูล compatibility...');
  try {
    // Phase B: read direct from Supabase compat_pairs (public read; GAS out of path).
    state.compatPairs = await AdminSupabase.getCompatPairs();
    renderCompatStats();
    renderCompatTable();
    refreshSupaStatus();
  } catch (e) {
    console.error('loadCompatPairs error:', e);
    toast('โหลดข้อมูล compatibility ล้มเหลว: ' + e.message, 'error');
  }
  hideLoading();
}

function getFilteredCompatPairs() {
  let pairs = state.compatPairs;
  const q = (document.getElementById('search-compat')?.value || '').toLowerCase().trim();
  const result = document.getElementById('filter-compat-result')?.value || '';

  if (q) {
    pairs = pairs.filter(p =>
      (p.drugA || '').toLowerCase().includes(q) ||
      (p.drugB || '').toLowerCase().includes(q)
    );
  }
  if (result) {
    pairs = pairs.filter(p => p.result === result);
  }
  return pairs;
}

function renderCompatStats() {
  const total = state.compatPairs.length;
  const compatible = state.compatPairs.filter(p => p.result === 'c').length;
  const incompatible = state.compatPairs.filter(p => p.result === 'i').length;
  const variable = state.compatPairs.filter(p => p.result === 'v').length;

  const el = document.getElementById('compat-stats');
  if (el) el.innerHTML = `
    <div class="stat-card"><div class="stat-label">คู่ยาทั้งหมด</div><div class="stat-value primary">${total}</div></div>
    <div class="stat-card"><div class="stat-label">Compatible</div><div class="stat-value success">${compatible}</div></div>
    <div class="stat-card"><div class="stat-label">Incompatible</div><div class="stat-value danger">${incompatible}</div></div>
    <div class="stat-card"><div class="stat-label">Variable</div><div class="stat-value warning">${variable}</div></div>
  `;

  const countEl = document.getElementById('compat-total-count');
  if (countEl) countEl.textContent = total;
}

function renderCompatTable() {
  const filtered = getFilteredCompatPairs();
  const total = filtered.length;
  const pages = Math.ceil(total / COMPAT_PER_PAGE) || 1;
  if (state.compatPage > pages) state.compatPage = pages;
  const start = (state.compatPage - 1) * COMPAT_PER_PAGE;
  const slice = filtered.slice(start, start + COMPAT_PER_PAGE);

  const tbody = document.getElementById('compat-table-body');
  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">ไม่มีข้อมูล</td></tr>';
  } else {
    tbody.innerHTML = slice.map((p, idx) => `
      <tr>
        <td style="color:var(--text-muted);font-size:12px">${start + idx + 1}</td>
        <td><strong>${escHtml(p.drugA || '')}</strong></td>
        <td><strong>${escHtml(p.drugB || '')}</strong></td>
        <td><span class="badge ${RESULT_BADGE[p.result] || ''}">${RESULT_LABELS[p.result] || escHtml(p.result || '')}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${escHtml(p.ref || '—')}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-outline" data-action="editCompatPair" data-id="${escHtml(String(p.id))}" title="แก้ไข">✏️</button>
            ${compatCanDelete() ? `<button class="btn btn-sm btn-outline" data-action="deleteCompatPair" data-id="${escHtml(String(p.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Pagination
  const pag = document.getElementById('compat-pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let html = `<span style="color:var(--text-muted);font-size:12px">${total} คู่ยา</span>`;
  html += `<button class="page-btn" data-action="compatGoPage" data-page="${state.compatPage - 1}" ${state.compatPage <= 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - state.compatPage) > 2 && i !== 1 && i !== pages) {
      if (i === state.compatPage - 3 || i === state.compatPage + 3) html += '<span>…</span>';
      continue;
    }
    html += `<button class="page-btn ${i === state.compatPage ? 'active' : ''}" data-action="compatGoPage" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-action="compatGoPage" data-page="${state.compatPage + 1}" ${state.compatPage >= pages ? 'disabled' : ''}>›</button>`;
  pag.innerHTML = html;
}

function compatGoPage(p) {
  const pages = Math.ceil(getFilteredCompatPairs().length / COMPAT_PER_PAGE);
  if (p < 1 || p > pages) return;
  state.compatPage = p;
  renderCompatTable();
}

function filterCompat() {
  state.compatPage = 1;
  renderCompatTable();
}

function openCompatModal(pair = null) {
  state.editingCompatId = pair ? pair.id : null;
  document.getElementById('compat-modal-title').textContent = pair ? 'แก้ไขคู่ยา' : 'เพิ่มคู่ยา Compatibility';
  document.getElementById('cf-drugA').value = pair ? pair.drugA : '';
  document.getElementById('cf-drugB').value = pair ? pair.drugB : '';
  document.getElementById('cf-result').value = pair ? pair.result : 'c';
  document.getElementById('cf-ref').value = pair ? (pair.ref || '') : '';
  document.getElementById('compat-modal').classList.add('open');
}

function closeCompatModal() {
  document.getElementById('compat-modal').classList.remove('open');
  state.editingCompatId = null;
}

async function saveCompatPair() {
  const drugA = document.getElementById('cf-drugA').value.trim();
  const drugB = document.getElementById('cf-drugB').value.trim();
  const result = document.getElementById('cf-result').value;
  const ref = document.getElementById('cf-ref').value.trim();

  if (!drugA || !drugB) {
    toast('กรุณากรอกชื่อยาทั้ง 2 ช่อง', 'error');
    return;
  }

  if (!(await ensureSupaWrite())) return;
  // Phase B: upsert direct to Supabase. Create generates a stable text id;
  // edit keeps the existing id (upsert by id).
  const id = state.editingCompatId || ('cp_' + Date.now());
  showLoading('กำลังบันทึก...');
  try {
    await AdminSupabase.upsertCompatPair({ id, drugA, drugB, result, ref });
    toast(state.editingCompatId ? '✅ อัพเดทคู่ยาแล้ว' : '✅ เพิ่มคู่ยาแล้ว', 'success');
    closeCompatModal();
    await loadCompatPairs();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

function editCompatPair(id) {
  const pair = state.compatPairs.find(p => String(p.id) === String(id));
  if (pair) openCompatModal(pair);
}

async function deleteCompatPair(id) {
  const pair = state.compatPairs.find(p => String(p.id) === String(id));
  if (!pair) return;
  if (!confirm(`ลบคู่ยา "${pair.drugA} + ${pair.drugB}" ?`)) return;
  if (!(await ensureSupaWrite())) return;   // RLS is the real gate (is_admin)
  showLoading('กำลังลบ...');
  try {
    await AdminSupabase.deleteCompatPair(id);
    toast('🗑 ลบคู่ยาแล้ว', 'success');
    await loadCompatPairs();
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  hideLoading();
}

function exportCompatCSV() {
  if (state.compatPairs.length === 0) { toast('ไม่มีข้อมูล', 'info'); return; }
  const rows = [['Drug A', 'Drug B', 'Result', 'Reference']];
  state.compatPairs.forEach(p => {
    rows.push([p.drugA, p.drugB, p.result, p.ref || '']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `compat-pairs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast('📥 Export CSV สำเร็จ', 'success');
}

// Hardcoded CURATED pairs from compatibility.js — for one-time migration
const CURATED_PAIRS = [
['Norepinephrine','Dobutamine','c'],['Norepinephrine','Dopamine','c'],['Norepinephrine','Adrenaline','c'],
['Norepinephrine','Midazolam','c'],['Norepinephrine','Fentanyl','c'],['Norepinephrine','Morphine','c'],
['Norepinephrine','Heparin','c'],['Norepinephrine','Human Insulin','c'],['Norepinephrine','Potassium','c'],
['Norepinephrine','Furosemide','i'],['Norepinephrine','Pantoprazole','i'],['Norepinephrine','Sodium bicarbonate','i'],
['Norepinephrine','Phenytoin','i'],['Norepinephrine','Diazepam','i'],['Norepinephrine','Nicardipine','c'],
['Norepinephrine','Dexmedetomidine','c'],['Norepinephrine','Propofol','c'],['Norepinephrine','Amiodarone','c'],
['Norepinephrine','Vancomycin','c'],['Norepinephrine','Meropenem','c'],['Norepinephrine','Labetalol','c'],
['Dopamine','Dobutamine','c'],['Dopamine','Adrenaline','c'],['Dopamine','Midazolam','c'],
['Dopamine','Fentanyl','c'],['Dopamine','Heparin','c'],['Dopamine','Morphine','c'],
['Dopamine','Sodium bicarbonate','i'],['Dopamine','Furosemide','v'],['Dopamine','Human Insulin','v'],
['Dopamine','Phenytoin','i'],['Dopamine','Acyclovir','i'],['Dopamine','Nicardipine','c'],
['Dobutamine','Adrenaline','c'],['Dobutamine','Midazolam','c'],['Dobutamine','Fentanyl','c'],
['Dobutamine','Heparin','c'],['Dobutamine','Human Insulin','v'],['Dobutamine','Furosemide','i'],
['Dobutamine','Sodium bicarbonate','i'],['Dobutamine','Phenytoin','i'],['Dobutamine','Diazepam','i'],
['Dobutamine','Acyclovir','i'],['Dobutamine','Nicardipine','c'],['Dobutamine','Potassium','c'],
['Amiodarone','Midazolam','c'],['Amiodarone','Fentanyl','c'],['Amiodarone','Morphine','c'],
['Amiodarone','Dobutamine','c'],['Amiodarone','Dopamine','c'],['Amiodarone','Furosemide','i'],
['Amiodarone','Heparin','i'],['Amiodarone','Sodium bicarbonate','i'],['Amiodarone','Phenytoin','i'],
['Amiodarone','Potassium','c'],['Amiodarone','Human Insulin','c'],['Amiodarone','Dexmedetomidine','c'],
['Midazolam','Fentanyl','c'],['Midazolam','Morphine','c'],['Midazolam','Heparin','c'],
['Midazolam','Human Insulin','c'],['Midazolam','Potassium','c'],['Midazolam','Furosemide','v'],
['Midazolam','Sodium bicarbonate','i'],['Midazolam','Dexamethasone','c'],['Midazolam','Ondansetron','c'],
['Midazolam','Omeprazole','v'],['Midazolam','Propofol','c'],['Midazolam','Vancomycin','c'],
['Midazolam','Meropenem','c'],['Midazolam','Nicardipine','c'],['Midazolam','Labetalol','c'],
['Propofol','Fentanyl','c'],['Propofol','Morphine','c'],['Propofol','Potassium','c'],
['Propofol','Heparin','c'],['Propofol','Phenytoin','i'],['Propofol','Vancomycin','i'],
['Propofol','Meropenem','c'],['Propofol','Ketamine','c'],['Propofol','Dexmedetomidine','c'],
['Heparin','Human Insulin','c'],['Heparin','Potassium','c'],['Heparin','Morphine','c'],
['Heparin','Fentanyl','c'],['Heparin','Furosemide','c'],['Heparin','Dexamethasone','c'],
['Heparin','Pantoprazole','c'],['Heparin','Vancomycin','i'],['Heparin','Gentamicin','v'],
['Heparin','Ciprofloxacin','i'],['Heparin','Diazepam','i'],['Heparin','Phenytoin','i'],
['Heparin','Nicardipine','c'],['Heparin','Labetalol','c'],['Heparin','Meropenem','c'],
['Human Insulin','Potassium','c'],['Human Insulin','Sodium bicarbonate','i'],['Human Insulin','Phenytoin','i'],
['Furosemide','Morphine','c'],['Furosemide','Potassium','c'],['Furosemide','Dexamethasone','c'],
['Furosemide','Vancomycin','i'],['Furosemide','Ciprofloxacin','i'],['Furosemide','Ondansetron','i'],
['Furosemide','Nicardipine','i'],['Furosemide','Labetalol','i'],['Furosemide','Amiodarone','i'],
['Phenytoin','Fentanyl','i'],['Phenytoin','Morphine','i'],['Phenytoin','Vancomycin','i'],
['Phenytoin','Meropenem','i'],['Phenytoin','Potassium','i'],['Phenytoin','Dexamethasone','i'],
['Phenytoin','Dexmedetomidine','i'],['Phenytoin','Propofol','i'],['Phenytoin','Midazolam','i'],
['Vancomycin','Meropenem','c'],['Vancomycin','Midazolam','c'],['Vancomycin','Morphine','c'],
['Vancomycin','Fentanyl','c'],['Vancomycin','Potassium','c'],['Vancomycin','Ceftriaxone','i'],
['Vancomycin','Ceftazidime','i'],['Vancomycin','Piperacillin','i'],['Vancomycin','Dexamethasone','v'],
['Dexmedetomidine','Fentanyl','c'],['Dexmedetomidine','Midazolam','c'],['Dexmedetomidine','Morphine','c'],
['Dexmedetomidine','Amphotericin','i'],['Dexmedetomidine','Diazepam','i'],
['Nicardipine','Fentanyl','c'],['Nicardipine','Sodium bicarbonate','i'],['Nicardipine','Phenytoin','i'],
['Labetalol','Fentanyl','c'],['Labetalol','Morphine','c'],['Labetalol','Heparin','c'],
['Labetalol','Sodium bicarbonate','i'],['Labetalol','Potassium','c'],
['Meropenem','Fentanyl','c'],['Meropenem','Morphine','c'],['Meropenem','Dexamethasone','c'],
['Meropenem','Ondansetron','v'],['Meropenem','Potassium','c'],['Meropenem','Acyclovir','i'],['Meropenem','Diazepam','i'],
['Magnesium','Heparin','c'],['Magnesium','Human Insulin','c'],['Magnesium','Potassium','c'],
['Magnesium','Midazolam','c'],['Magnesium','Amphotericin','i'],['Magnesium','Sodium bicarbonate','i'],
['Magnesium','Calcium','i'],
['Ondansetron','Morphine','c'],['Ondansetron','Fentanyl','c'],['Ondansetron','Dexamethasone','c'],
['Ondansetron','Potassium','c'],['Ondansetron','Sodium bicarbonate','i'],
['Ketamine','Midazolam','c'],['Ketamine','Fentanyl','c'],['Ketamine','Morphine','c'],
['Ketamine','Diazepam','i'],['Ketamine','Sodium bicarbonate','i'],['Ketamine','Phenobarbital','i'],
['Calcium','Sodium bicarbonate','i'],['Calcium','Potassium','c'],
['Levetiracetam','Diazepam','v'],['Levetiracetam','Sodium Valproate','c'],
// Valproic+Meropenem: PK interaction, NOT Y-site — removed from compat matrix
['Methylprednisolone','Heparin','c'],['Methylprednisolone','Ondansetron','c'],
['Hydrocortisone','Heparin','c'],['Hydrocortisone','Midazolam','i'],
['Cisatracurium','Midazolam','c'],['Cisatracurium','Fentanyl','c'],['Cisatracurium','Morphine','c'],
['Cisatracurium','Propofol','c'],['Cisatracurium','Sodium bicarbonate','i'],
['Cisplatin','Ondansetron','c'],['Cisplatin','Dexamethasone','c'],['Cisplatin','Mannitol','c'],
['Cisplatin','Potassium','c'],['Cisplatin','Sodium bicarbonate','i'],
['Carboplatin','Ondansetron','c'],['Carboplatin','Dexamethasone','c'],['Carboplatin','Sodium bicarbonate','i'],
['Paclitaxel','Carboplatin','c'],['Paclitaxel','Cisplatin','c'],['Paclitaxel','Doxorubicin','i'],
['Doxorubicin','Ondansetron','c'],['Doxorubicin','Dexamethasone','c'],['Doxorubicin','Cyclophosphamide','c'],
['Doxorubicin','Heparin','i'],['Doxorubicin','5-Fluorouracil','i'],
['5-Fluorouracil','Ondansetron','c'],['5-Fluorouracil','Leucovorin','c'],['5-Fluorouracil','Methotrexate','i'],
['Gemcitabine','Ondansetron','c'],['Gemcitabine','Dexamethasone','c'],['Gemcitabine','Amphotericin','i'],['Gemcitabine','Furosemide','i'],
['Etoposide','Carboplatin','c'],['Etoposide','Cisplatin','c'],['Etoposide','Ondansetron','c'],['Etoposide','Cefepime','i'],
['Oxaliplatin','Leucovorin','c'],['Oxaliplatin','Sodium bicarbonate','i'],
['Cefepime','Midazolam','c'],['Cefepime','Fentanyl','c'],['Cefepime','Heparin','c'],
['Cefepime','Morphine','c'],['Cefepime','Vancomycin','i'],['Cefepime','Metronidazole','c'],
['Cefepime','Amphotericin','i'],
['Calcium chloride','Dobutamine','c'],['Calcium chloride','Dopamine','c'],['Calcium chloride','Norepinephrine','c'],
['Calcium chloride','Sodium bicarbonate','i'],['Calcium chloride','Ceftriaxone','i'],
['Diltiazem','Heparin','c'],['Diltiazem','Human Insulin','c'],['Diltiazem','Potassium','c'],
['Diltiazem','Amphotericin','i'],['Diltiazem','Furosemide','i'],['Diltiazem','Phenytoin','i'],['Diltiazem','Diazepam','i'],
['Milrinone','Heparin','c'],['Milrinone','Potassium','c'],['Milrinone','Morphine','c'],['Milrinone','Human Insulin','c'],
['Milrinone','Furosemide','i'],['Milrinone','Sodium bicarbonate','i'],
['Daptomycin','Dexamethasone','c'],['Daptomycin','Heparin','c'],
['Daptomycin','RL','i'],['Daptomycin','Sodium bicarbonate','i'],
['Caspofungin','Dexamethasone','c'],['Caspofungin','Meropenem','c'],
['Caspofungin','D5W','i'],['Caspofungin','Sodium bicarbonate','i'],
['Norepinephrine','Calcium chloride','c'],['Norepinephrine','Milrinone','c'],['Norepinephrine','Diltiazem','c'],
['Norepinephrine','Cefepime','c'],
['Dopamine','Calcium chloride','c'],['Dopamine','Milrinone','c'],['Dopamine','Diltiazem','c'],
['Heparin','Cefepime','c'],['Heparin','Diltiazem','c'],['Heparin','Milrinone','c'],
['Midazolam','Cefepime','c'],['Midazolam','Diltiazem','c'],
// Audit additions: critical missing pairs
['Phenytoin','D5W','i'],['Ceftriaxone','Calcium gluconate','i'],['Ceftriaxone','Calcium chloride','i'],
['Pantoprazole','Midazolam','v'],['Amphotericin B','NSS','i'],['20% Mannitol','Potassium chloride','i'],
];

async function importCuratedPairs() {
  // Phase B: bulk-upsert CURATED pairs to Supabase. Idempotent — compat ids are
  // synthetic (not natural keys), so we match existing rows by the normalized
  // pair-key and REUSE their id (update in place); only genuinely-new pairs get
  // a fresh id. This prevents duplicate rows on re-import.
  if (!confirm('นำเข้า/อัปเดต CURATED ' + CURATED_PAIRS.length + ' คู่ยา เข้า Supabase?\nคู่ที่มีอยู่จะถูกอัปเดต (result/ref) — ไม่สร้างซ้ำ')) return;
  if (!(await ensureSupaWrite())) return;

  const keyOf = (a, b) => [a, b].map(s => String(s || '').toLowerCase().trim()).sort().join('|');
  const existing = {};
  state.compatPairs.forEach(p => { existing[keyOf(p.drugA, p.drugB)] = p.id; });
  // Dedupe CURATED_PAIRS by pair-key FIRST — the list contains both-direction
  // duplicates (A+B and B+A) that collapse to one key; without this, one upsert
  // batch would carry two rows with the same id (Postgres 21000) or mint two rows.
  const uniq = new Map();
  CURATED_PAIRS.forEach(([drugA, drugB, result]) => { uniq.set(keyOf(drugA, drugB), { drugA, drugB, result }); });
  let seq = Date.now();
  const rows = [];
  uniq.forEach((p, k) => {
    const id = existing[k] || ('cp_' + (seq++));
    rows.push({ id: String(id), drugA: p.drugA, drugB: p.drugB, result: p.result, ref: "Trissel's / Lexicomp" });
  });

  showLoading('กำลัง upsert ' + rows.length + ' คู่ยา...');
  try {
    const n = await AdminSupabase.bulkUpsertCompatPairs(rows);
    toast('✅ Import สำเร็จ: upsert ' + n + ' คู่ (คู่ที่มีอยู่อัปเดตในที่)', 'success');
    await loadCompatPairs();
  } catch (e) {
    toast('❌ Import ล้มเหลว: ' + e.message, 'error');
  }
  hideLoading();
}

/* ═══════════════════════════════════════════
   DRUG INTERACTION (DDI) DATA CRUD
   ═══════════════════════════════════════════ */
// The 10 additive-risk classes (must match CLASS_DEFS in drug-interactions.js).
const DDI_CLASSES = [
  { key: 'QT', label: '💓 QT prolongation' },
  { key: 'serotonergic', label: '🧠 Serotonin syndrome' },
  { key: 'nephrotoxic', label: '🫘 Nephrotoxicity' },
  { key: 'bleeding', label: '🩸 Bleeding' },
  { key: 'hyperK', label: '⚡ Hyperkalemia' },
  { key: 'ototoxic', label: '👂 Ototoxicity' },
  { key: 'cnsDepress', label: '😴 CNS/resp depression' },
  { key: 'bradycardia', label: '🐢 Bradycardia/AV block' },
  { key: 'hypotension', label: '📉 Hypotension' },
  { key: 'anticholinergic', label: '🌵 Anticholinergic' }
];
const DDI_SEV_LABEL = { contraindicated: '⛔ ห้ามใช้ร่วม', major: '🟠 รุนแรง', moderate: '🟡 ปานกลาง', minor: '⚪ เล็กน้อย' };

async function loadDDIData() {
  refreshSupaStatus();
  showLoading('กำลังโหลดข้อมูล DDI...');
  try {
    // Phase B: read direct from Supabase (public read). aAny/bAny come back as
    // ARRAYS and classes as an array (AdminSupabase normalizes).
    const [p, r] = await Promise.all([AdminSupabase.getDDIPairs(), AdminSupabase.getDDIClassRules()]);
    state.ddiPairs = p || [];
    state.ddiRules = r || [];
    renderDDIPairsTable();
    renderDDIRulesTable();
    refreshSupaStatus();
  } catch (e) {
    console.error('loadDDIData error:', e);
    toast('โหลดข้อมูล DDI ล้มเหลว: ' + e.message, 'error');
  }
  hideLoading();
}

// ── Curated pairs ───────────────────────────────────────────────────
// Build a human label for one side. Accepts an array (Supabase), a JSON-array
// string (legacy), or a single keyword string.
function ddiSideLabel(single, multi) {
  if (Array.isArray(multi)) return multi.length ? multi.join(' / ') : (single || '—');
  if (multi) {
    try { const a = JSON.parse(multi); if (Array.isArray(a) && a.length) return a.join(' / '); }
    catch (e) { return String(multi); }
  }
  return single || '—';
}

function renderDDIPairsTable() {
  const cnt = document.getElementById('ddi-pairs-count');
  if (cnt) cnt.textContent = state.ddiPairs.length;
  const q = (document.getElementById('search-ddi-pair')?.value || '').toLowerCase().trim();
  let rows = state.ddiPairs;
  if (q) rows = rows.filter(p =>
    [p.a, p.aAny, p.b, p.bAny, p.severity, p.mechanism].some(v => String(v || '').toLowerCase().includes(q)));

  const tbody = document.getElementById('ddi-pairs-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">ไม่มีข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((p, idx) => `
    <tr>
      <td style="color:var(--text-muted);font-size:12px">${idx + 1}</td>
      <td><strong>${escHtml(ddiSideLabel(p.a, p.aAny))}</strong></td>
      <td><strong>${escHtml(ddiSideLabel(p.b, p.bAny))}</strong></td>
      <td>${escHtml(DDI_SEV_LABEL[p.severity] || p.severity || '')}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:280px">${escHtml((p.mechanism || '').slice(0, 90))}${(p.mechanism || '').length > 90 ? '…' : ''}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-outline" data-action="editDDIPair" data-id="${escHtml(String(p.id))}" title="แก้ไข">✏️</button>
          ${supaWriteAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteDDIPair" data-id="${escHtml(String(p.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}
function filterDDIPairs() { renderDDIPairsTable(); }

function openDDIPairModal(pair = null) {
  state.editingDDIPairId = pair ? pair.id : null;
  document.getElementById('ddi-pair-modal-title').textContent = pair ? 'แก้ไขคู่ยา DDI' : 'เพิ่มคู่ยา DDI';
  const arr = (v) => { if (!v) return ''; if (Array.isArray(v)) return v.join(', '); try { const a = JSON.parse(v); return Array.isArray(a) ? a.join(', ') : String(v); } catch (e) { return String(v); } };
  document.getElementById('df-a').value = pair ? (pair.a || '') : '';
  document.getElementById('df-aAny').value = pair ? arr(pair.aAny) : '';
  document.getElementById('df-b').value = pair ? (pair.b || '') : '';
  document.getElementById('df-bAny').value = pair ? arr(pair.bAny) : '';
  document.getElementById('df-severity').value = pair ? (pair.severity || 'major') : 'major';
  document.getElementById('df-mechanism').value = pair ? (pair.mechanism || '') : '';
  document.getElementById('df-management').value = pair ? (pair.management || '') : '';
  document.getElementById('df-ref').value = pair ? (pair.ref || '') : '';
  document.getElementById('ddi-pair-modal').classList.add('open');
}
function closeDDIPairModal() {
  document.getElementById('ddi-pair-modal').classList.remove('open');
  state.editingDDIPairId = null;
}

// comma string → JSON-array string (the sheet/Supabase format) or '' for ≤1 token
function ddiCsvToJsonArr(s) {
  const a = String(s || '').split(',').map(x => x.toLowerCase().trim()).filter(Boolean);
  return a.length ? JSON.stringify(a) : '';
}

async function saveDDIPair() {
  const a = document.getElementById('df-a').value.trim().toLowerCase();
  const aAny = ddiCsvToJsonArr(document.getElementById('df-aAny').value);
  const b = document.getElementById('df-b').value.trim().toLowerCase();
  const bAny = ddiCsvToJsonArr(document.getElementById('df-bAny').value);
  if (!(a || aAny) || !(b || bAny)) { toast('ต้องระบุยาทั้งฝั่ง A และ B (ช่องเดี่ยวหรือหลายตัว)', 'error'); return; }
  if (!(await ensureSupaWrite())) return;
  // Phase B: upsert direct to Supabase (aAny/bAny normalized to arrays inside).
  const id = state.editingDDIPairId || ('ddip_' + Date.now());
  const payload = {
    id,
    a: aAny ? '' : a, aAny: aAny, b: bAny ? '' : b, bAny: bAny,
    severity: document.getElementById('df-severity').value,
    mechanism: document.getElementById('df-mechanism').value.trim(),
    management: document.getElementById('df-management').value.trim(),
    ref: document.getElementById('df-ref').value.trim()
  };
  showLoading('กำลังบันทึก...');
  try {
    await AdminSupabase.upsertDDIPair(payload);
    toast(state.editingDDIPairId ? '✅ อัพเดทคู่ยาแล้ว' : '✅ เพิ่มคู่ยาแล้ว', 'success');
    closeDDIPairModal();
    await loadDDIData();
  } catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  hideLoading();
}
function editDDIPair(id) {
  const p = state.ddiPairs.find(x => String(x.id) === String(id));
  if (p) openDDIPairModal(p);
}
async function deleteDDIPair(id) {
  const p = state.ddiPairs.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!confirm('ลบคู่ยา DDI นี้?')) return;
  if (!(await ensureSupaWrite())) return;
  showLoading('กำลังลบ...');
  try { await AdminSupabase.deleteDDIPair(id); toast('🗑 ลบแล้ว', 'success'); await loadDDIData(); }
  catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  hideLoading();
}

// ── Class rules ─────────────────────────────────────────────────────
function renderDDIRulesTable() {
  const cnt = document.getElementById('ddi-rules-count');
  if (cnt) cnt.textContent = state.ddiRules.length;
  const q = (document.getElementById('search-ddi-rule')?.value || '').toLowerCase().trim();
  let rows = state.ddiRules;
  if (q) rows = rows.filter(r => String(r.keyword || '').toLowerCase().includes(q) || String(r.classes || '').toLowerCase().includes(q));

  const tbody = document.getElementById('ddi-rules-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">ไม่มีข้อมูล</td></tr>';
    return;
  }
  const lbl = {}; DDI_CLASSES.forEach(c => lbl[c.key] = c.label);
  tbody.innerHTML = rows.map((r, idx) => {
    const cls = String(r.classes || '').split(',').map(s => s.trim()).filter(Boolean).map(k => lbl[k] || k).join(', ');
    return `<tr>
      <td style="color:var(--text-muted);font-size:12px">${idx + 1}</td>
      <td><strong>${escHtml(r.keyword || '')}</strong></td>
      <td style="font-size:12px">${escHtml(cls)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-outline" data-action="editDDIRule" data-id="${escHtml(String(r.id))}" title="แก้ไข">✏️</button>
          ${supaWriteAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteDDIRule" data-id="${escHtml(String(r.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}
function filterDDIRules() { renderDDIRulesTable(); }

function openDDIRuleModal(rule = null) {
  state.editingDDIRuleId = rule ? rule.id : null;
  document.getElementById('ddi-rule-modal-title').textContent = rule ? 'แก้ไข Class Rule' : 'เพิ่ม Class Rule';
  document.getElementById('rf-keyword').value = rule ? (rule.keyword || '') : '';
  const selected = rule ? String(rule.classes || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  const wrap = document.getElementById('rf-classes');
  wrap.innerHTML = DDI_CLASSES.map(c =>
    `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
       <input type="checkbox" class="rf-cls" value="${c.key}" ${selected.includes(c.key) ? 'checked' : ''}> ${c.label}
     </label>`).join('');
  document.getElementById('ddi-rule-modal').classList.add('open');
}
function closeDDIRuleModal() {
  document.getElementById('ddi-rule-modal').classList.remove('open');
  state.editingDDIRuleId = null;
}
async function saveDDIRule() {
  const keyword = document.getElementById('rf-keyword').value.trim().toLowerCase();
  const classes = Array.from(document.querySelectorAll('#rf-classes .rf-cls:checked')).map(c => c.value).join(',');
  if (!keyword) { toast('ต้องระบุ keyword', 'error'); return; }
  if (!classes) { toast('เลือกอย่างน้อย 1 คลาส', 'error'); return; }
  if (!(await ensureSupaWrite())) return;
  const id = state.editingDDIRuleId || ('ddir_' + Date.now());
  showLoading('กำลังบันทึก...');
  try {
    await AdminSupabase.upsertDDIClassRule({ id, keyword, classes });
    toast(state.editingDDIRuleId ? '✅ อัพเดทแล้ว' : '✅ เพิ่มแล้ว', 'success');
    closeDDIRuleModal();
    await loadDDIData();
  } catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  hideLoading();
}
function editDDIRule(id) {
  const r = state.ddiRules.find(x => String(x.id) === String(id));
  if (r) openDDIRuleModal(r);
}
async function deleteDDIRule(id) {
  if (!confirm('ลบ class rule นี้?')) return;
  if (!(await ensureSupaWrite())) return;
  showLoading('กำลังลบ...');
  try { await AdminSupabase.deleteDDIClassRule(id); toast('🗑 ลบแล้ว', 'success'); await loadDDIData(); }
  catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  hideLoading();
}

// ── Import defaults (seed Supabase from the hardcoded engine data) ──────
// Reads the live defaults straight off window.DrugInteractions so the seed can
// never drift from the engine. Idempotent: deterministic seed ids (by index /
// keyword) → re-running upserts in place instead of creating duplicates.
async function importDDIDefaults() {
  const DI = window.DrugInteractions;
  if (!DI || !DI._CURATED) { toast('ไม่พบ engine (drug-interactions.js) — เปิดหน้า DDI ก่อน', 'error'); return; }
  if (!confirm('นำเข้า/อัปเดต curated pairs + class rules จากค่า default ในโค้ดเข้า Supabase?\n(idempotent — เขียนทับ seed เดิม ไม่สร้างซ้ำ)')) return;
  if (!(await ensureSupaWrite())) return;
  showLoading('กำลังนำเข้า defaults...');
  try {
    // ── Class rules: dedupe by keyword + UNION their classes (CLASS_RULES lists
    // some keywords twice, e.g. fentanyl in serotonergic AND cnsDepress). Without
    // this, two rows share the same id in one upsert batch → Postgres 21000.
    // Reuse an existing row's id (matched by keyword) so re-seeding updates in
    // place instead of duplicating admin-created rules.
    const ruleMap = new Map();   // keyword → Set(classes)
    (DI._CLASS_RULES_SEED || []).forEach(r => {
      const kw = String(r[0]).toLowerCase().trim();
      if (!ruleMap.has(kw)) ruleMap.set(kw, new Set());
      (r[1] || []).forEach(c => ruleMap.get(kw).add(c));
    });
    const existRuleId = {};
    (state.ddiRules || []).forEach(r => { if (r.keyword) existRuleId[String(r.keyword).toLowerCase().trim()] = r.id; });
    const rules = [];
    ruleMap.forEach((clsSet, kw) => {
      rules.push({ id: existRuleId[kw] || ('ddir_seed_' + kw.replace(/[^a-z0-9]+/g, '_')), keyword: kw, classes: Array.from(clsSet) });
    });

    // ── Pairs: match existing rows by a normalized signature (sides + severity)
    // so re-seed reuses their id (no duplicate across id schemes); dedupe the
    // seed by signature too.
    const sigOf = (p) => {
      const side = (single, any) => (any && any.length)
        ? any.map(x => String(x).toLowerCase().trim()).sort().join('+')
        : String(single || '').toLowerCase().trim();
      return [side(p.a, p.aAny), side(p.b, p.bAny)].sort().join('|') + '|' + (p.severity || 'major');
    };
    const existPairId = {};
    (state.ddiPairs || []).forEach(p => { existPairId[sigOf(p)] = p.id; });
    const seen = new Map();
    (DI._CURATED || []).forEach((p, i) => { const s = sigOf(p); if (!seen.has(s)) seen.set(s, { p: p, i: i }); });
    const pairs = [];
    seen.forEach((v, s) => {
      const p = v.p;
      pairs.push({ id: existPairId[s] || ('ddip_seed_' + v.i), a: p.a || '', aAny: p.aAny || [], b: p.b || '', bAny: p.bAny || [],
        severity: p.severity || 'major', mechanism: p.mechanism || '', management: p.management || '', ref: p.ref || '' });
    });

    const nP = await AdminSupabase.bulkUpsertDDIPairs(pairs);
    const nR = await AdminSupabase.bulkUpsertDDIClassRules(rules);
    toast('✅ นำเข้าแล้ว: ' + nP + ' pairs, ' + nR + ' rules (upsert)', 'success');
    await loadDDIData();
  } catch (e) { toast('Import ล้มเหลว: ' + e.message, 'error'); }
  hideLoading();
}

/* ═══════════════════════════════════════════
   RENAL DOSING DATA CRUD
   ═══════════════════════════════════════════ */
const RENAL_PER_PAGE = 25;
const CLASS_LABELS = {abx:'Antibiotics',af:'Antifungals',av:'Antivirals',ac:'Anticoagulants',cv:'Cardiovascular',analgesic:'Analgesics',neuro:'Neurology',chemo:'Chemo',misc:'Misc'};
const INFO_TYPE_LABELS = {blue:'🔵 Info',amber:'🟡 Warning',red:'🔴 Danger',teal:'🟢 Tip'};
const INFO_TYPE_COLORS = {blue:'#eff6ff',amber:'#fffbeb',red:'#fef2f2',teal:'#f0fdfa'};

async function loadRenalDrugs() {
  renderRenalSupaStatus();
  showLoading('กำลังโหลดข้อมูล renal dosing...');
  try {
    // Phase A: read direct from Supabase (public read; GAS no longer in the path).
    // AdminSupabase already returns normalized objects (badges/dosingTable arrays).
    state.renalDrugs = await AdminSupabase.getRenalDrugs();
    renderRenalStats();
    renderRenalTable();
    renderRenalSupaStatus();
  } catch (e) {
    console.error('loadRenalDrugs error:', e);
    toast('โหลดข้อมูล renal dosing ล้มเหลว: ' + e.message, 'error');
  }
  hideLoading();
}

// ── Phase A/B: Supabase session/admin gate for direct writes ───────────────
// Shared across the migrated tabs (Renal, Compat, DDI). _supaAdmin caches the
// Supabase is_admin() result so delete buttons + write gates reflect the ACTUAL
// (RLS) authority, not the legacy GAS role. Set by refreshSupaStatus().
let _supaAdmin = false;
// A write (incl. delete) is authorized by Supabase RLS is_admin(); allow a legacy
// GAS admin as a fallback so existing behavior isn't lost.
function supaWriteAdmin() { return _supaAdmin === true || isAdmin(); }
function renalCanDelete()  { return supaWriteAdmin(); }
function compatCanDelete() { return supaWriteAdmin(); }

// Table-agnostic write gate (session + Supabase is_admin). Used by every
// migrated tab's create/update/delete/import.
async function ensureSupaWrite() {
  if (!window.AdminSupabase || !AdminSupabase.available()) {
    toast('❌ Supabase ยังไม่พร้อม (โหลดไลบรารีไม่สำเร็จ)', 'error'); return false;
  }
  const st = await AdminSupabase.status();
  if (!st.signedIn) {
    toast('⚠️ ต้องเชื่อม Supabase ก่อนแก้ไข — กดปุ่ม "🔗 เชื่อม Supabase"', 'info');
    refreshSupaStatus();
    return false;
  }
  if (!st.isAdmin) {
    if (st.adminError) toast('⚠️ ตรวจสอบสิทธิ์ admin ไม่สำเร็จ (เครือข่าย/Supabase) — ลองอีกครั้ง', 'error');
    else toast('❌ บัญชี ' + st.email + ' ไม่มีสิทธิ์ admin ใน Supabase (ไม่อยู่ใน allowlist)', 'error');
    return false;
  }
  return true;
}
// Phase A name kept for its callers (saveRenalDrug/deleteRenalDrug/importCuratedRenal).
function ensureRenalWriteAccess() { return ensureSupaWrite(); }

function connectSupabase() {
  if (!window.AdminSupabase) { toast('Supabase ยังไม่โหลด', 'error'); return; }
  AdminSupabase.connect().catch(function (e) { toast('เชื่อม Supabase ล้มเหลว: ' + e.message, 'error'); });
}
function connectRenalSupabase() { connectSupabase(); }   // legacy data-action alias

// Render a single status bar (#<prefix>-supa-text / #<prefix>-supa-connect).
function _renderSupaBar(prefix, st) {
  const txt = document.getElementById(prefix + '-supa-text');
  const btn = document.getElementById(prefix + '-supa-connect');
  if (!txt || !btn) return;
  if (!st.available) {
    txt.textContent = '⚠️ Supabase library ไม่โหลด — ตรวจ CSP/เครือข่าย'; btn.style.display = 'none'; return;
  }
  if (st.signedIn && st.isAdmin) {
    txt.innerHTML = '✅ เชื่อม Supabase แล้ว: <b>' + escHtml(st.email) + '</b> (admin) — แก้ไขได้ทันที';
    btn.style.display = 'none';
  } else if (st.signedIn && st.adminError) {
    txt.innerHTML = '⚠️ ลงชื่อเป็น <b>' + escHtml(st.email) + '</b> — ตรวจสิทธิ์ admin ไม่สำเร็จ (เครือข่าย) ลองใหม่';
    btn.style.display = 'none';
  } else if (st.signedIn && !st.isAdmin) {
    txt.innerHTML = '⚠️ ลงชื่อเป็น <b>' + escHtml(st.email) + '</b> แต่ไม่ใช่ admin ใน Supabase — แก้ไขไม่ได้';
    btn.style.display = 'none';
  } else {
    txt.textContent = '🔒 อ่านข้อมูลได้ (public) — ต้องเชื่อม Supabase เพื่อแก้ไข';
    btn.style.display = 'inline-block';
  }
}

// Refresh every present status bar + the shared admin flag; re-render active tab.
async function refreshSupaStatus() {
  let st;
  if (!window.AdminSupabase || !AdminSupabase.available()) {
    st = { available: false, signedIn: false, email: '', isAdmin: false, adminError: false };
  } else {
    st = await AdminSupabase.status(); st.available = true;
  }
  ['renal', 'compat', 'ddi'].forEach(function (p) { _renderSupaBar(p, st); });
  _setSupaAdmin(st.available && st.signedIn && st.isAdmin === true && !st.adminError);
}
// Phase A name kept for its callers (loadRenalDrugs, handleCredentialResponse).
function renderRenalSupaStatus() { return refreshSupaStatus(); }

// Update the shared flag; if it changed, re-render whichever migrated tab is
// active so its delete (🗑) buttons match the real authority.
function _setSupaAdmin(v) {
  if (_supaAdmin === v) return;
  _supaAdmin = v;
  const panel = document.querySelector('.panel.active');
  if (!panel) return;
  try {
    if (panel.id === 'renal-panel' && state.renalDrugs && state.renalDrugs.length) renderRenalTable();
    else if (panel.id === 'compat-panel' && state.compatPairs && state.compatPairs.length) renderCompatTable();
    else if (panel.id === 'ddi-panel' && (state.ddiPairs || state.ddiRules)) { renderDDIPairsTable(); renderDDIRulesTable(); }
  } catch (e) { /* table may not be mounted */ }
}

function getFilteredRenalDrugs() {
  let drugs = state.renalDrugs;
  const q = (document.getElementById('search-renal')?.value || '').toLowerCase().trim();
  const cls = document.getElementById('filter-renal-class')?.value || '';
  if (q) drugs = drugs.filter(d => (d.name || '').toLowerCase().includes(q) || (d.id || '').toLowerCase().includes(q));
  if (cls) drugs = drugs.filter(d => d['class'] === cls);
  return drugs;
}

function renderRenalStats() {
  const total = state.renalDrugs.length;
  const classes = {};
  state.renalDrugs.forEach(d => { classes[d['class']] = (classes[d['class']] || 0) + 1; });
  const topClasses = Object.entries(classes).sort((a,b) => b[1]-a[1]).slice(0, 3);
  const el = document.getElementById('renal-stats');
  if (el) el.innerHTML = `
    <div class="stat-card"><div class="stat-label">ยาทั้งหมด</div><div class="stat-value primary">${total}</div></div>
    ${topClasses.map(([c,n]) => `<div class="stat-card"><div class="stat-label">${CLASS_LABELS[c] || escHtml(c)}</div><div class="stat-value">${n}</div></div>`).join('')}
  `;
  const countEl = document.getElementById('renal-total-count');
  if (countEl) countEl.textContent = total;
}

function renderRenalTable() {
  const filtered = getFilteredRenalDrugs();
  const total = filtered.length;
  const pages = Math.ceil(total / RENAL_PER_PAGE) || 1;
  if (state.renalPage > pages) state.renalPage = pages;
  const start = (state.renalPage - 1) * RENAL_PER_PAGE;
  const slice = filtered.slice(start, start + RENAL_PER_PAGE);
  const tbody = document.getElementById('renal-table-body');
  if (!tbody) return;
  if (slice.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">ไม่มีข้อมูล</td></tr>';
  } else {
    tbody.innerHTML = slice.map((d, idx) => `
      <tr>
        <td style="color:var(--text-muted);font-size:12px">${start + idx + 1}</td>
        <td><strong>${escHtml(d.name || '')}</strong><br><span style="font-size:11px;color:var(--text-muted)">${escHtml(d.id || '')}</span></td>
        <td><span class="badge">${escHtml(CLASS_LABELS[d['class']] || d['class'] || '')}</span></td>
        <td style="font-size:12px">${escHtml(d.sub || '')}</td>
        <td style="font-size:12px">${(d.dosingTable || []).length} ranges</td>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.infoType === 'red' ? '#ef4444' : d.infoType === 'amber' ? '#f59e0b' : d.infoType === 'teal' ? '#14b8a6' : '#3b82f6'}"></span> ${escHtml(INFO_TYPE_LABELS[d.infoType] || '')}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-outline" data-action="editRenalDrug" data-id="${escHtml(String(d.id))}" title="แก้ไข">✏️</button>
            ${renalCanDelete() ? `<button class="btn btn-sm btn-outline" data-action="deleteRenalDrug" data-id="${escHtml(String(d.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }
  const pag = document.getElementById('renal-pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let html = `<span style="color:var(--text-muted);font-size:12px">${total} รายการ</span>`;
  html += `<button class="page-btn" data-action="renalGoPage" data-page="${state.renalPage - 1}" ${state.renalPage <= 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - state.renalPage) > 2 && i !== 1 && i !== pages) {
      if (i === state.renalPage - 3 || i === state.renalPage + 3) html += '<span>…</span>';
      continue;
    }
    html += `<button class="page-btn ${i === state.renalPage ? 'active' : ''}" data-action="renalGoPage" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-action="renalGoPage" data-page="${state.renalPage + 1}" ${state.renalPage >= pages ? 'disabled' : ''}>›</button>`;
  pag.innerHTML = html;
}

function renalGoPage(p) {
  const pages = Math.ceil(getFilteredRenalDrugs().length / RENAL_PER_PAGE);
  if (p < 1 || p > pages) return;
  state.renalPage = p;
  renderRenalTable();
}

function filterRenal() { state.renalPage = 1; renderRenalTable(); }

function openRenalModal(drug = null) {
  state.editingRenalId = drug ? drug.id : null;
  document.getElementById('renal-modal-title').textContent = drug ? 'แก้ไขยา Renal Dosing' : 'เพิ่มยา Renal Dosing';
  document.getElementById('rf-id').value = drug ? drug.id : '';
  document.getElementById('rf-id').readOnly = !!drug;
  document.getElementById('rf-name').value = drug ? drug.name : '';
  document.getElementById('rf-class').value = drug ? drug['class'] : 'abx';
  document.getElementById('rf-sub').value = drug ? (drug.sub || '') : '';
  document.getElementById('rf-recommended').value = drug ? (drug.recommended || '') : '';
  document.getElementById('rf-info').value = drug ? (drug.info || '') : '';
  document.getElementById('rf-infoType').value = drug ? (drug.infoType || 'blue') : 'blue';
  document.getElementById('rf-ref').value = drug ? (drug.ref || '') : '';
  document.querySelectorAll('.rf-badge').forEach(cb => { cb.checked = drug ? (drug.badges || []).includes(cb.value) : false; });
  const container = document.getElementById('rf-dosing-rows');
  container.innerHTML = '';
  if (drug && drug.dosingTable && drug.dosingTable.length > 0) {
    drug.dosingTable.forEach(r => addRenalDosingRow(r.range, r.dose, r.freq, r.note));
  } else {
    addRenalDosingRow('>80', '', '', 'Normal dosing');
    addRenalDosingRow('50-80', '', '', '');
    addRenalDosingRow('10-50', '', '', '');
    addRenalDosingRow('<10 / HD', '', '', '');
  }
  document.getElementById('renal-form-view').style.display = 'block';
  document.getElementById('renal-preview-view').style.display = 'none';
  document.getElementById('btn-renal-form').style.background = 'var(--primary)';
  document.getElementById('btn-renal-form').style.color = 'white';
  document.getElementById('btn-renal-preview').style.background = 'transparent';
  document.getElementById('btn-renal-preview').style.color = 'var(--text-muted)';
  document.getElementById('renal-modal').classList.add('open');
}

function closeRenalModal() {
  document.getElementById('renal-modal').classList.remove('open');
  state.editingRenalId = null;
}

function addRenalDosingRow(range, dose, freq, note) {
  const container = document.getElementById('rf-dosing-rows');
  const row = document.createElement('div');
  row.className = 'renal-dosing-row';
  row.style.cssText = 'display:grid;grid-template-columns:120px 1fr 100px 1fr 36px;gap:4px;margin-bottom:4px';
  row.innerHTML = `<input class="form-input rf-row-range" placeholder=">80" value="${escHtml(range || '')}" style="font-size:12px;padding:6px 8px"><input class="form-input rf-row-dose" placeholder="Dose" value="${escHtml(dose || '')}" style="font-size:12px;padding:6px 8px"><input class="form-input rf-row-freq" placeholder="Freq" value="${escHtml(freq || '')}" style="font-size:12px;padding:6px 8px"><input class="form-input rf-row-note" placeholder="Note" value="${escHtml(note || '')}" style="font-size:12px;padding:6px 8px"><button type="button" class="btn btn-sm" data-action="removeRenalDosingRow" style="color:var(--danger);padding:4px">✕</button>`;
  container.appendChild(row);
}

function collectRenalFormData() {
  const badges = [];
  document.querySelectorAll('.rf-badge:checked').forEach(cb => badges.push(cb.value));
  const cls = document.getElementById('rf-class').value;
  if (!badges.includes(cls)) badges.unshift(cls);
  const rows = [];
  document.querySelectorAll('#rf-dosing-rows .renal-dosing-row').forEach(row => {
    const range = row.querySelector('.rf-row-range')?.value?.trim() || '';
    const dose = row.querySelector('.rf-row-dose')?.value?.trim() || '';
    const freq = row.querySelector('.rf-row-freq')?.value?.trim() || '';
    const note = row.querySelector('.rf-row-note')?.value?.trim() || '';
    if (range || dose) rows.push({ range, dose, freq, note });
  });
  return {
    id: document.getElementById('rf-id').value.trim(),
    name: document.getElementById('rf-name').value.trim(),
    'class': cls,
    sub: document.getElementById('rf-sub').value.trim(),
    badges, recommended: document.getElementById('rf-recommended').value.trim(),
    dosingTable: rows,
    info: document.getElementById('rf-info').value.trim(),
    infoType: document.getElementById('rf-infoType').value,
    ref: document.getElementById('rf-ref').value.trim()
  };
}

async function saveRenalDrug() {
  const data = collectRenalFormData();
  if (!data.id || !data.name) { toast('กรุณากรอก Drug ID และ Drug Name', 'error'); return; }
  // Create mode: guard against silently overwriting an existing drug (upsert keys
  // on id). rf-id is read-only when editing, so this only fires for new adds.
  if (!state.editingRenalId && state.renalDrugs.some(d => String(d.id) === String(data.id))) {
    if (!confirm('มียา id "' + data.id + '" อยู่แล้ว\nการบันทึกจะ "เขียนทับ" ข้อมูลเดิมทั้งหมด — ยืนยันไหม?')) return;
  }
  if (!(await ensureRenalWriteAccess())) return;
  showLoading('กำลังบันทึก...');
  try {
    // Phase A: upsert direct to Supabase (create OR update, keyed by id).
    await AdminSupabase.upsertRenalDrug(data);
    toast(state.editingRenalId ? '✅ อัพเดทยาแล้ว' : '✅ เพิ่มยาแล้ว', 'success');
    closeRenalModal();
    await loadRenalDrugs();
  } catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  hideLoading();
}

function editRenalDrug(id) {
  const drug = state.renalDrugs.find(d => String(d.id) === String(id));
  if (drug) openRenalModal(drug);
}

async function deleteRenalDrug(id) {
  const drug = state.renalDrugs.find(d => String(d.id) === String(id));
  if (!drug) return;
  if (!confirm(`ลบยา "${drug.name}" ?`)) return;
  if (!(await ensureRenalWriteAccess())) return;   // RLS is the real gate (is_admin)
  showLoading('กำลังลบ...');
  try {
    await AdminSupabase.deleteRenalDrug(id);
    toast('🗑 ลบยาแล้ว', 'success');
    await loadRenalDrugs();
  } catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  hideLoading();
}

function toggleRenalPreview(show) {
  document.getElementById('renal-form-view').style.display = show ? 'none' : 'block';
  document.getElementById('renal-preview-view').style.display = show ? 'block' : 'none';
  document.getElementById('btn-renal-form').style.background = show ? 'transparent' : 'var(--primary)';
  document.getElementById('btn-renal-form').style.color = show ? 'var(--text-muted)' : 'white';
  document.getElementById('btn-renal-preview').style.background = show ? 'var(--primary)' : 'transparent';
  document.getElementById('btn-renal-preview').style.color = show ? 'white' : 'var(--text-muted)';
  if (show) renderRenalPreview();
}

function renderRenalPreview() {
  const data = collectRenalFormData();
  const card = document.getElementById('renal-preview-card');
  const badgeHtml = (data.badges || []).map(b => `<span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:11px;font-weight:600;background:#e0f2fe;color:#0ea5e9;margin-right:4px">${escHtml(b)}</span>`).join('');
  const tableRows = (data.dosingTable || []).map(r => `<tr><td style="padding:8px 12px;font-weight:600;white-space:nowrap">${escHtml(r.range)}</td><td style="padding:8px 12px">${escHtml(r.dose)}</td><td style="padding:8px 12px">${escHtml(r.freq)}</td><td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">${escHtml(r.note)}</td></tr>`).join('');
  const bgColor = INFO_TYPE_COLORS[data.infoType] || '#eff6ff';
  const borderColor = data.infoType === 'red' ? '#ef4444' : data.infoType === 'amber' ? '#f59e0b' : data.infoType === 'teal' ? '#14b8a6' : '#3b82f6';
  card.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:600px">
      <h3 style="margin-bottom:4px">${escHtml(data.name || 'Drug Name')}</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${escHtml(data.sub || '')}</div>
      <div style="margin-bottom:12px">${badgeHtml}</div>
      ${data.recommended ? `<div style="background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:12px;margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#059669;margin-bottom:4px">RECOMMENDED DOSE</div><div style="font-weight:600;color:#047857">${escHtml(data.recommended)}</div></div>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px"><thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid var(--border)">GFR</th><th style="padding:8px 12px;text-align:left;border-bottom:2px solid var(--border)">Dose</th><th style="padding:8px 12px;text-align:left;border-bottom:2px solid var(--border)">Freq</th><th style="padding:8px 12px;text-align:left;border-bottom:2px solid var(--border)">Note</th></tr></thead><tbody>${tableRows}</tbody></table>
      ${data.info ? `<div style="background:${bgColor};border-left:4px solid ${borderColor};border-radius:0 8px 8px 0;padding:12px;margin-bottom:12px;font-size:13px">${data.info}</div>` : ''}
      ${data.ref ? `<div style="background:#f8fafc;border-radius:8px;padding:10px;font-size:11px;color:var(--text-muted)"><strong>Ref:</strong> ${escHtml(data.ref)}</div>` : ''}
    </div>`;
}

function exportRenalCSV() {
  if (state.renalDrugs.length === 0) { toast('ไม่มีข้อมูล', 'info'); return; }
  const rows = [['ID', 'Name', 'Class', 'Subclass', 'Badges', 'Recommended', 'Dosing Table', 'Info', 'Info Type', 'Reference']];
  state.renalDrugs.forEach(d => {
    rows.push([d.id, d.name, d['class'], d.sub, JSON.stringify(d.badges), d.recommended, JSON.stringify(d.dosingTable), d.info, d.infoType, d.ref]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `renal-dosing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast('📥 Export CSV สำเร็จ', 'success');
}

// CURATED renal dosing data (26 drugs) now lives in js/curated-renal-drugs.js
// (loaded before this file) — single source shared with the renal review.
// Was duplicated inline here, which let the two copies drift; de-duplicated
// so a clinical fix only needs to land in one place.

async function importCuratedRenal() {
  // Phase A: upsert the corrected in-code dataset (curated-renal-drugs.js) into
  // Supabase — this is also the "re-sync code → Supabase" button (upsert, so it
  // OVERWRITES existing rows to match the code, not skip-if-exists like GAS did).
  if (!confirm('เขียนทับ (upsert) ข้อมูล renal ' + CURATED_RENAL_DRUGS.length + ' ยา จากโค้ดล่าสุดเข้า Supabase?\nยาที่มีอยู่จะถูกอัปเดตให้ตรงกับโค้ด (เช่นค่าที่เพิ่งแก้)')) return;
  if (!(await ensureRenalWriteAccess())) return;

  const drugs = CURATED_RENAL_DRUGS.map(d => ({
    id: d.id, name: d.name, 'class': d['class'], sub: d.sub,
    badges: d.badges, recommended: d.recommended,
    dosingTable: d.dosingTable, info: d.info, infoType: d.infoType, ref: d.ref
  }));

  showLoading('กำลัง upsert ' + drugs.length + ' ยา เข้า Supabase...');
  try {
    const n = await AdminSupabase.bulkUpsertRenalDrugs(drugs);
    toast('✅ Upsert สำเร็จ: ' + n + ' ยา (เขียนทับให้ตรงโค้ด)', 'success');
    await loadRenalDrugs();
  } catch (e) {
    toast('❌ Import ล้มเหลว: ' + e.message, 'error');
  }
  hideLoading();
}

/* ═══════════════════════════════════════════
   ANALYTICS SUMMARY
   ═══════════════════════════════════════════ */
async function loadAnalyticsSummary() {
  // Analytics data อยู่ใน analytics spreadsheet (ไม่ใช่ admin spreadsheet)
  // ใช้ IVDrugRef.getAnalyticsUrl() จาก core.js หรือ localStorage analyticsUrl
  var analyticsUrl = (typeof IVDrugRef !== 'undefined' && IVDrugRef.getAnalyticsUrl)
    ? IVDrugRef.getAnalyticsUrl()
    : localStorage.getItem('analyticsUrl') || '';
  if (!analyticsUrl) {
    showAnalyticsStatus('ไม่พบ Analytics URL — ตรวจสอบ core.js', true);
    return;
  }
  showLoading('กำลังโหลดข้อมูล analytics...');
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 15000);
    var res = await fetch(analyticsUrl + '?action=raw', { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    state.analyticsData = data;
    renderAnalyticsSummary();
    showAnalyticsStatus('');
    toast('โหลด analytics สำเร็จ');
  } catch (e) {
    var msg = e.name === 'AbortError' ? 'Timeout — ลองอีกครั้ง' : e.message;
    showAnalyticsStatus('❌ โหลด analytics ล้มเหลว: ' + msg, true);
  }
  hideLoading();
}

function showAnalyticsStatus(msg, isError) {
  var el = document.getElementById('analytics-status');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = isError ? 'var(--danger-bg, #fef2f2)' : 'var(--surface)';
  el.style.color = isError ? 'var(--danger, #ef4444)' : 'var(--text)';
}

function renderAnalyticsSummary() {
  var d = state.analyticsData;
  if (!d) return;

  var now = new Date();
  var day7ago = new Date(now - 7 * 86400000);
  var day30ago = new Date(now - 30 * 86400000);

  var sessions = d.sessions || [];
  var searches = d.searches || [];
  var errors = (d.errors || d.errorLog || []);

  // ── DAU (30d average) ──
  var sessionsLast30 = sessions.filter(function(s) {
    return s.timestamp && new Date(s.timestamp) >= day30ago;
  });
  var dauMap = {};
  sessionsLast30.forEach(function(s) {
    var day = String(s.timestamp).substring(0, 10);
    if (!dauMap[day]) dauMap[day] = new Set();
    dauMap[day].add(s.user_id || s.session_id || 'anon');
  });
  var dauDays = Object.keys(dauMap);
  var dauAvg = dauDays.length > 0
    ? Math.round(dauDays.reduce(function(sum, day) { return sum + dauMap[day].size; }, 0) / dauDays.length)
    : 0;

  // ── Searches (7d) ──
  var searchesLast7 = searches.filter(function(s) {
    return s.timestamp && new Date(s.timestamp) >= day7ago;
  });

  // ── Errors (7d) ──
  var errorsLast7 = errors.filter(function(e) {
    return e.timestamp && new Date(e.timestamp) >= day7ago;
  });
  var sessionsLast7 = sessions.filter(function(s) {
    return s.timestamp && new Date(s.timestamp) >= day7ago;
  });
  var errorRate = sessionsLast7.length > 0
    ? (errorsLast7.length / sessionsLast7.length * 100).toFixed(1) + '%'
    : '—';

  // ── Render stats cards ──
  document.getElementById('ana-dau').textContent = dauAvg;
  document.getElementById('ana-searches').textContent = searchesLast7.length;
  document.getElementById('ana-errors').textContent = errorsLast7.length;
  document.getElementById('ana-error-rate').textContent = errorRate;

  // ── Missing drugs: queries with no result click ──
  renderMissingDrugs(searchesLast7);

  // ── Top searched drugs ──
  renderTopSearchedDrugs(searchesLast7);

  // ── All search queries ──
  renderAllQueries(searchesLast7);

  // ── Recent errors ──
  renderRecentErrors(errors);
}

function renderMissingDrugs(searches) {
  // Search data logs every keystroke: "c","ce","cef","ceft"...
  // Strategy: group by session, take the LONGEST query per session
  // as the user's intended search term. Then check if it matches any drug.
  var drugNames = state.drugs.map(function(d) {
    return (d.name || d.genericName || '').toLowerCase();
  });

  // Group searches by session_id, find the longest query per session
  var sessionQueries = {};
  searches.forEach(function(s) {
    var q = (s.query || '').trim().toLowerCase();
    var sid = s.session_id || 'unknown';
    var clicked = (s.drug_clicked || '').trim();
    if (!q || q.length < 3) return; // ignore very short partial typing
    if (clicked) return; // user found what they wanted
    // Keep the longest query per session (= final intended search)
    if (!sessionQueries[sid] || q.length > sessionQueries[sid].length) {
      sessionQueries[sid] = q;
    }
  });

  // Count frequency of each final query
  var missingMap = {};
  Object.values(sessionQueries).forEach(function(q) {
    if (!missingMap[q]) missingMap[q] = 0;
    missingMap[q]++;
  });

  // Filter out queries that match a drug in the DB
  var missingList = Object.keys(missingMap)
    .filter(function(q) {
      return !drugNames.some(function(name) {
        return name.indexOf(q) !== -1 || q.indexOf(name) !== -1;
      });
    })
    .map(function(q) { return { query: q, count: missingMap[q] }; })
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 20);

  var maxCount = missingList.length > 0 ? missingList[0].count : 1;
  var tbody = document.getElementById('ana-missing-body');

  if (missingList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ไม่พบคำค้นที่ไม่มีในฐานข้อมูล</td></tr>';
    return;
  }

  tbody.innerHTML = missingList.map(function(item, i) {
    var pct = Math.round(item.count / maxCount * 100);
    var urgency = item.count >= 5 ? 'priority-high' : item.count >= 2 ? 'priority-medium' : '';
    return '<tr class="' + urgency + '">'
      + '<td>' + (i + 1) + '</td>'
      + '<td><strong>' + escHtml(item.query) + '</strong></td>'
      + '<td>' + item.count + '</td>'
      + '<td><div class="analytics-bar-wrap"><div class="analytics-bar" style="width:' + pct + '%"></div></div></td>'
      + '</tr>';
  }).join('');
}

function renderTopSearchedDrugs(searches) {
  var drugCount = {};
  searches.forEach(function(s) {
    var name = (s.drug_clicked || '').trim();
    if (!name) return;
    if (!drugCount[name]) drugCount[name] = 0;
    drugCount[name]++;
  });

  var topDrugs = Object.keys(drugCount)
    .map(function(name) { return { name: name, count: drugCount[name] }; })
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 20);

  var maxCount = topDrugs.length > 0 ? topDrugs[0].count : 1;
  var tbody = document.getElementById('ana-top-drugs-body');

  if (topDrugs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูลการค้นหา</td></tr>';
    return;
  }

  tbody.innerHTML = topDrugs.map(function(item, i) {
    var pct = Math.round(item.count / maxCount * 100);
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + escHtml(item.name) + '</td>'
      + '<td>' + item.count + '</td>'
      + '<td><div class="analytics-bar-wrap"><div class="analytics-bar analytics-bar-blue" style="width:' + pct + '%"></div></div></td>'
      + '</tr>';
  }).join('');
}

function renderAllQueries(searches) {
  // Group by session, take longest query per session as the intended search
  var drugNames = state.drugs.map(function(d) {
    return (d.name || d.genericName || '').toLowerCase();
  });
  var sessionQueries = {};
  searches.forEach(function(s) {
    var q = (s.query || '').trim().toLowerCase();
    var sid = s.session_id || 'unknown';
    if (!q || q.length < 2) return;
    if (!sessionQueries[sid] || q.length > sessionQueries[sid].length) {
      sessionQueries[sid] = q;
    }
  });

  var queryMap = {};
  Object.values(sessionQueries).forEach(function(q) {
    if (!queryMap[q]) queryMap[q] = 0;
    queryMap[q]++;
  });

  var allQueries = Object.keys(queryMap)
    .map(function(q) { return { query: q, count: queryMap[q] }; })
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 30);

  var tbody = document.getElementById('ana-all-queries-body');
  if (allQueries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>';
    return;
  }

  tbody.innerHTML = allQueries.map(function(item, i) {
    var found = drugNames.some(function(name) {
      return name.indexOf(item.query) !== -1 || item.query.indexOf(name) !== -1;
    });
    var status = found
      ? '<span style="color:var(--success, #22c55e)">✅ มี</span>'
      : '<span style="color:var(--danger, #ef4444);font-weight:600">❌ ไม่มี</span>';
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td><strong>' + escHtml(item.query) + '</strong></td>'
      + '<td>' + item.count + '</td>'
      + '<td>' + status + '</td>'
      + '</tr>';
  }).join('');
}

function renderRecentErrors(errors) {
  var sorted = errors.slice().sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  }).slice(0, 20);

  var tbody = document.getElementById('ana-errors-body');

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ไม่มี errors</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(function(e) {
    var sev = (e.severity || 'info').toLowerCase();
    var sevClass = sev === 'high' || sev === 'critical' ? 'priority-high'
      : sev === 'medium' ? 'priority-medium' : '';
    return '<tr class="' + sevClass + '">'
      + '<td style="white-space:nowrap;font-size:11px">' + escHtml(formatDate(e.timestamp)) + '</td>'
      + '<td><span class="severity-badge severity-' + escHtml(sev) + '">' + escHtml(sev) + '</span></td>'
      + '<td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + escHtml(e.message || '—') + '</td>'
      + '<td style="font-size:11px">' + escHtml(e.page || e.url || '—') + '</td>'
      + '</tr>';
  }).join('');
}

/* ═══════════════════════════════════════════
   TAB NAVIGATION
   ═══════════════════════════════════════════ */
function switchTab(tab) {
  // Editor ไม่สามารถเข้า tab ที่ถูกจำกัด
  if (!isAdmin() && ['import', 'settings', 'users', 'analytics'].includes(tab)) {
    toast('❌ คุณไม่มีสิทธิ์เข้าถึงส่วนนี้', 'error');
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `${tab}-panel`));
  if (tab === 'pending') renderPendingList();
  if (tab === 'audit') renderAuditLog();
  if (tab === 'users') loadUsers();
  if (tab === 'quality') renderQualityDashboard();
  if (tab === 'compat') loadCompatPairs();
  if (tab === 'ddi') loadDDIData();
  if (tab === 'renal') loadRenalDrugs();
  if (tab === 'allergy') loadAllergyData();
  if (tab === 'analytics') loadAnalyticsSummary();
}

/* ═══════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════ */
function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

function showLoading(text) {
  document.getElementById('loading-text').textContent = text || 'กำลังโหลด...';
  document.getElementById('loading-overlay').classList.add('show');
}
function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('show');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; setTimeout(() => el.remove(), 300); }, 4000);
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupImportZone();

  // Prevent default form submit and delegate to saveDrug
  var drugForm = document.getElementById('drug-form');
  if (drugForm) {
    drugForm.addEventListener('submit', function(e) { e.preventDefault(); saveDrug('pending'); });
  }

  // ═══════════════════════════════════════════
  //  ALLERGY CROSS-REACTIVITY CRUD (A2)
  // ═══════════════════════════════════════════
  const ALLERGY_PER_PAGE = 20;
  const ALLERGY_TYPE_LABELS = { nbl: 'Non-beta-lactam', beta_lactam: 'Beta-lactam' };

  // parse a value that may be a JSON string (from Sheet) or already an array/object
  function allergyParse(v, fallback) {
    if (Array.isArray(v) || (v && typeof v === 'object')) return v;
    if (typeof v === 'string' && v.trim()) {
      try { return JSON.parse(v); } catch (e) { return fallback; }
    }
    return fallback;
  }
  function allergyTruthy(v) { return v === true || v === 'true' || v === 'TRUE'; }

  async function loadAllergyData() {
    showLoading('กำลังโหลดข้อมูล allergy...');
    try {
      const result = await apiCall('getAllergyGroups');
      state.allergyGroups = (result.groups || []).map(g => ({
        ...g,
        allergens: allergyParse(g.allergens, []),
        crossReactive: allergyParse(g.crossReactive, []),
        safe: allergyParse(g.safe, []),
        caution: allergyParse(g.caution, []),
        refs: allergyParse(g.refs, []),
        chemLabels: allergyParse(g.chemLabels, '')
      }));
      state.allergyRefs = result.refs || [];
      if (!state.allergyPage) state.allergyPage = 1;
      renderAllergyStats();
      renderAllergyTable();
    } catch (e) {
      console.error('loadAllergyData error:', e);
      toast('โหลดข้อมูล allergy ล้มเหลว', 'error');
    }
    hideLoading();
  }

  function getFilteredAllergyGroups() {
    let groups = state.allergyGroups || [];
    const q = (document.getElementById('search-allergy')?.value || '').toLowerCase().trim();
    const type = document.getElementById('filter-allergy-type')?.value || '';
    if (q) groups = groups.filter(g => (g.label || '').toLowerCase().includes(q) || (g.id || '').toLowerCase().includes(q));
    if (type) groups = groups.filter(g => (g.type || 'nbl') === type);
    return groups;
  }

  function renderAllergyStats() {
    const groups = state.allergyGroups || [];
    const nbl = groups.filter(g => (g.type || 'nbl') === 'nbl').length;
    const bl = groups.filter(g => g.type === 'beta_lactam').length;
    const refs = (state.allergyRefs || []).length;
    const el = document.getElementById('allergy-stats');
    if (el) el.innerHTML = `
      <div class="stat-card"><div class="stat-label">กลุ่มทั้งหมด</div><div class="stat-value primary">${groups.length}</div></div>
      <div class="stat-card"><div class="stat-label">Non-beta-lactam</div><div class="stat-value">${nbl}</div></div>
      <div class="stat-card"><div class="stat-label">Beta-lactam</div><div class="stat-value">${bl}</div></div>
      <div class="stat-card"><div class="stat-label">Citations (refs)</div><div class="stat-value">${refs}</div></div>`;
    const countEl = document.getElementById('allergy-total-count');
    if (countEl) countEl.textContent = groups.length;
  }

  function renderAllergyTable() {
    const filtered = getFilteredAllergyGroups();
    const total = filtered.length;
    const pages = Math.ceil(total / ALLERGY_PER_PAGE) || 1;
    if (state.allergyPage > pages) state.allergyPage = pages;
    const start = (state.allergyPage - 1) * ALLERGY_PER_PAGE;
    const slice = filtered.slice(start, start + ALLERGY_PER_PAGE);
    const tbody = document.getElementById('allergy-table-body');
    if (!tbody) return;
    if (slice.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">ยังไม่มีข้อมูล — กด “📦 Seed จากโค้ด” เพื่อนำเข้าครั้งแรก</td></tr>';
    } else {
      tbody.innerHTML = slice.map((g, idx) => `
        <tr>
          <td style="color:var(--text-muted);font-size:12px">${start + idx + 1}</td>
          <td><span style="font-size:12px;font-family:monospace">${escHtml(g.id || '')}</span></td>
          <td><strong>${escHtml(g.label || '')}</strong></td>
          <td><span class="badge">${ALLERGY_TYPE_LABELS[g.type || 'nbl'] || escHtml(g.type || '')}</span></td>
          <td style="font-size:12px">${(g.allergens || []).length}</td>
          <td style="font-size:12px">${(g.crossReactive || []).length} / ${(g.safe || []).length} / ${(g.caution || []).length}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm btn-outline" data-action="editAllergyGroup" data-id="${escHtml(String(g.id))}" title="แก้ไข">✏️</button>
              ${isAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteAllergyGroup" data-id="${escHtml(String(g.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
            </div>
          </td>
        </tr>`).join('');
    }
    const pag = document.getElementById('allergy-pagination');
    if (!pag) return;
    if (pages <= 1) { pag.innerHTML = ''; return; }
    let html = `<span style="color:var(--text-muted);font-size:12px">${total} กลุ่ม</span>`;
    html += `<button class="page-btn" data-action="allergyGoPage" data-page="${state.allergyPage - 1}" ${state.allergyPage <= 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button class="page-btn ${i === state.allergyPage ? 'active' : ''}" data-action="allergyGoPage" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" data-action="allergyGoPage" data-page="${state.allergyPage + 1}" ${state.allergyPage >= pages ? 'disabled' : ''}>›</button>`;
    pag.innerHTML = html;
  }

  function allergyGoPage(p) {
    const pages = Math.ceil(getFilteredAllergyGroups().length / ALLERGY_PER_PAGE);
    if (p < 1 || p > pages) return;
    state.allergyPage = p;
    renderAllergyTable();
  }

  function filterAllergy() { state.allergyPage = 1; renderAllergyTable(); }

  async function deleteAllergyGroup(id) {
    if (!isAdmin()) { toast('❌ เฉพาะ Admin เท่านั้น', 'error'); return; }
    const g = (state.allergyGroups || []).find(x => String(x.id) === String(id));
    if (!g) return;
    if (!confirm(`ลบกลุ่ม "${g.label}" ?`)) return;
    showLoading('กำลังลบ...');
    try {
      await apiCall('deleteAllergyGroup', { id });
      toast('🗑 ลบกลุ่มแล้ว', 'success');
      await loadAllergyData();
    } catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    hideLoading();
  }

  // Seed the Sheet from the hardcoded window.AllergyData (NBL groups + refs).
  // Sends groups one-at-a-time (upsert) so payloads stay small and readable.
  async function seedAllergyFromCode() {
    const AD = window.AllergyData;
    if (!AD || !AD.NBL_GROUPS) { toast('ไม่พบข้อมูลตั้งต้นในโค้ด', 'error'); return; }
    if (!confirm('นำเข้าข้อมูล allergy ตั้งต้นจากโค้ดเข้า Google Sheet?\n(กลุ่ม/refs ที่ id ซ้ำจะถูกอัปเดตทับ)')) return;

    const groups = (AD.NBL_GROUPS || []).map((g, i) => ({
      id: g.id, type: 'nbl', label: g.label || '',
      allergens: g.allergens || [], crossReactive: g.crossReactive || [],
      safe: g.safe || [], caution: g.caution || [], refs: g.refs || [],
      crossReason: g.crossReason || '', cautionReason: g.cautionReason || '', safeReason: g.safeReason || '',
      noteMild: g.noteMild || '', noteIge: g.noteIge || '', noteScar: g.noteScar || '',
      scarCautionNote: g.scarCautionNote || '', singleDrugCallout: g.singleDrugCallout || '',
      keepSafeOnScar: !!g.keepSafeOnScar, clusterAware: !!g.clusterAware,
      crossClassCaution: !!g.crossClassCaution, chemGroupAware: !!g.chemGroupAware,
      chemLabels: g.chemLabels || '', sortOrder: i
    }));
    const refs = Object.keys(AD.REFS || {}).map(k => ({ key: k, citation: AD.REFS[k] }));

    showLoading('กำลัง seed refs...');
    try {
      // refs in chunks of 8 to keep each request small
      for (let i = 0; i < refs.length; i += 8) {
        await apiCall('bulkCreateAllergyRefs', { refs: refs.slice(i, i + 8) });
      }
      for (let i = 0; i < groups.length; i++) {
        showLoading(`กำลัง seed กลุ่ม ${i + 1}/${groups.length}...`);
        await apiCall('bulkCreateAllergyGroups', { groups: [groups[i]] });
      }
      toast(`✅ Seed สำเร็จ: ${groups.length} กลุ่ม, ${refs.length} refs`, 'success');
      await loadAllergyData();
    } catch (e) { toast('Seed ล้มเหลว: ' + e.message, 'error'); }
    hideLoading();
  }

  function exportAllergyCSV() {
    const groups = state.allergyGroups || [];
    if (groups.length === 0) { toast('ไม่มีข้อมูล', 'info'); return; }
    const rows = [['ID', 'Type', 'Label', 'Allergens', 'CrossReactive', 'Safe', 'Caution', 'Refs', 'Flags']];
    groups.forEach(g => {
      const flags = [g.keepSafeOnScar && 'keepSafeOnScar', g.clusterAware && 'clusterAware',
        g.crossClassCaution && 'crossClassCaution', g.chemGroupAware && 'chemGroupAware'].filter(Boolean).join(' ');
      rows.push([g.id, g.type || 'nbl', g.label, JSON.stringify(g.allergens), JSON.stringify(g.crossReactive),
        JSON.stringify(g.safe), JSON.stringify(g.caution), JSON.stringify(g.refs), flags]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `allergy-groups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast('📥 Export CSV สำเร็จ', 'success');
  }

  // ── edit/create modal (A2b) ──
  function editAllergyGroup(id) {
    openAllergyModal((state.allergyGroups || []).find(x => String(x.id) === String(id)) || null);
  }

  function openAllergyModal(group) {
    group = group || null;
    state.editingAllergyId = group ? group.id : null;
    document.getElementById('allergy-modal-title').textContent = group ? 'แก้ไขกลุ่ม Allergy' : 'เพิ่มกลุ่ม Allergy';
    const afSet = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
    const afChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    afSet('af-id', group ? group.id : '');
    document.getElementById('af-id').readOnly = !!group;
    afSet('af-type', group ? (group.type || 'nbl') : 'nbl');
    afSet('af-label', group ? group.label : '');
    afSet('af-sortOrder', group && group.sortOrder != null ? group.sortOrder : '');
    afChk('af-keepSafeOnScar', group && allergyTruthy(group.keepSafeOnScar));
    afChk('af-clusterAware', group && allergyTruthy(group.clusterAware));
    afChk('af-crossClassCaution', group && allergyTruthy(group.crossClassCaution));
    afChk('af-chemGroupAware', group && allergyTruthy(group.chemGroupAware));
    afSet('af-refs', group ? (Array.isArray(group.refs) ? group.refs.join(', ') : (group.refs || '')) : '');
    afSet('af-crossReason', group ? group.crossReason : '');
    afSet('af-cautionReason', group ? group.cautionReason : '');
    afSet('af-safeReason', group ? group.safeReason : '');
    afSet('af-noteMild', group ? group.noteMild : '');
    afSet('af-noteIge', group ? group.noteIge : '');
    afSet('af-noteScar', group ? group.noteScar : '');
    afSet('af-scarCautionNote', group ? group.scarCautionNote : '');
    afSet('af-singleDrugCallout', group ? group.singleDrugCallout : '');
    const cl = group ? group.chemLabels : '';
    afSet('af-chemLabels', cl && typeof cl === 'object' ? JSON.stringify(cl) : (cl || ''));
    ['allergens', 'crossReactive', 'safe', 'caution'].forEach(list => {
      const c = document.getElementById('af-rows-' + list);
      if (c) c.innerHTML = '';
      (group ? (group[list] || []) : []).forEach(d => addAllergyDrugRow(list, d));
    });
    document.getElementById('allergy-modal').classList.add('open');
  }

  function closeAllergyModal() {
    document.getElementById('allergy-modal').classList.remove('open');
    state.editingAllergyId = null;
  }

  function addAllergyDrugRow(listKey, d) {
    const c = document.getElementById('af-rows-' + listKey);
    if (!c) return;
    d = d || {};
    const row = document.createElement('div');
    row.className = 'af-row';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed var(--border)';
    const inp = (cls, ph, val, w) => `<input class="form-input ${cls}" placeholder="${ph}" value="${escHtml(val == null ? '' : String(val))}" style="font-size:12px;padding:6px 8px;width:${w}">`;
    row.innerHTML =
      inp('afr-generic', 'generic', d.generic, '140px') +
      inp('afr-th', 'ไทย', d.th, '120px') +
      inp('afr-sub', 'sub/class', d.sub, '120px') +
      inp('afr-id', 'id', d.id, '110px') +
      inp('afr-cluster', 'cluster', d.cluster, '100px') +
      inp('afr-chem', 'chem', d.chem, '90px') +
      inp('afr-pct', 'pct', d.pct, '80px') +
      `<input class="form-input afr-reason" placeholder="reason" value="${escHtml(d.reason == null ? '' : String(d.reason))}" style="font-size:12px;padding:6px 8px;flex:1;min-width:160px">` +
      `<button type="button" class="btn btn-sm" data-action="removeAllergyDrugRow" style="color:var(--danger);padding:4px">✕</button>`;
    c.appendChild(row);
  }

  function readAllergyRows(listKey) {
    const out = [];
    document.querySelectorAll('#af-rows-' + listKey + ' .af-row').forEach(row => {
      const g = cls => (row.querySelector('.' + cls)?.value || '').trim();
      const generic = g('afr-generic'), th = g('afr-th');
      if (!generic && !th) return;
      const o = { generic: generic };
      if (th) o.th = th;
      const sub = g('afr-sub'); if (sub) o.sub = sub;
      const id = g('afr-id'); if (id) o.id = id;
      const cluster = g('afr-cluster'); if (cluster) o.cluster = cluster;
      const chem = g('afr-chem'); if (chem) o.chem = chem;
      const pct = g('afr-pct'); if (pct) o.pct = pct;
      const reason = g('afr-reason'); if (reason) o.reason = reason;
      out.push(o);
    });
    return out;
  }

  function collectAllergyFormData() {
    const v = id => (document.getElementById(id)?.value || '').trim();
    const chk = id => !!document.getElementById(id)?.checked;
    let chemLabels = '';
    const clRaw = v('af-chemLabels');
    if (clRaw) { try { chemLabels = JSON.parse(clRaw); } catch (e) { chemLabels = clRaw; } }
    const sortOrder = v('af-sortOrder');
    return {
      id: v('af-id'), type: v('af-type') || 'nbl', label: v('af-label'),
      sortOrder: sortOrder === '' ? '' : Number(sortOrder),
      allergens: readAllergyRows('allergens'),
      crossReactive: readAllergyRows('crossReactive'),
      safe: readAllergyRows('safe'),
      caution: readAllergyRows('caution'),
      refs: v('af-refs').split(',').map(s => s.trim()).filter(Boolean),
      crossReason: v('af-crossReason'), cautionReason: v('af-cautionReason'), safeReason: v('af-safeReason'),
      noteMild: v('af-noteMild'), noteIge: v('af-noteIge'), noteScar: v('af-noteScar'),
      scarCautionNote: v('af-scarCautionNote'), singleDrugCallout: v('af-singleDrugCallout'),
      keepSafeOnScar: chk('af-keepSafeOnScar'), clusterAware: chk('af-clusterAware'),
      crossClassCaution: chk('af-crossClassCaution'), chemGroupAware: chk('af-chemGroupAware'),
      chemLabels: chemLabels
    };
  }

  async function saveAllergyGroup() {
    const data = collectAllergyFormData();
    if (!data.id || !data.label) { toast('กรุณากรอก Group ID และ Label', 'error'); return; }
    showLoading('กำลังบันทึก...');
    try {
      if (state.editingAllergyId) {
        await apiCall('updateAllergyGroup', data);
        toast('✅ อัปเดตกลุ่มแล้ว', 'success');
      } else {
        await apiCall('createAllergyGroup', data);
        toast('✅ เพิ่มกลุ่มแล้ว', 'success');
      }
      closeAllergyModal();
      await loadAllergyData();
    } catch (e) { toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    hideLoading();
  }

  // ═══ Event delegation — replaces all inline onclick/onchange/oninput ═══
  IVDrugRef.delegate(document, 'click', {
    signOut: function() { signOut(); },
    switchTab: function(e, t) { switchTab(t.dataset.tab); },
    openDrugModal: function() { openDrugModal(); },
    exportData: function() { exportData(); },
    triggerFileInput: function() { document.getElementById('import-file-input').click(); },
    confirmImport: function() { confirmImport(); },
    addUser: function() { addUser(); },
    saveSettings: function() { saveSettings(); },
    testConnection: function() { testConnection(); },
    checkBackendVersion: function() { checkBackendVersion(); },
    exportDrugsJSON: function() { exportDrugsJSON(); },
    publishChanges: function() { publishChanges(); },
    closeDrugModal: function() { closeDrugModal(); },
    togglePreview: function(e, t) { togglePreview(t.dataset.preview === 'true'); },
    saveDrug: function(e, t) { saveDrug(t.dataset.status); },
    saveDrugAndApprove: function() { saveDrugAndApprove(); },
    editDrug: function(e, t) { editDrug(+t.dataset.id); },
    previewDrugById: function(e, t) { previewDrugById(+t.dataset.id); },
    approveDrug: function(e, t) { approveDrug(+t.dataset.id); },
    deleteDrug: function(e, t) { deleteDrug(+t.dataset.id); },
    rejectDrug: function(e, t) { var reason = prompt('เหตุผลที่ส่งกลับ:'); if (reason !== null) rejectDrug(+t.dataset.id, reason); },
    openDiffModal: function(e, t) { openDiffModal(+t.dataset.id); },
    closeDiffModal: function() { closeDiffModal(); },
    approveDrugFromDiff: function() { approveDrugFromDiff(); },
    rejectDrugFromDiff: function() { rejectDrugFromDiff(); },
    goPage: function(e, t) { goPage(+t.dataset.page); },
    auditGoPage: function(e, t) { auditGoPage(+t.dataset.page); },
    changeRole: function(e, t) { changeRole(t.dataset.email, t.dataset.role); },
    removeUser: function(e, t) { removeUser(t.dataset.email); },
    // Compatibility pairs
    openCompatModal: function() { openCompatModal(); },
    closeCompatModal: function() { closeCompatModal(); },
    saveCompatPair: function() { saveCompatPair(); },
    editCompatPair: function(e, t) { editCompatPair(t.dataset.id); },
    deleteCompatPair: function(e, t) { deleteCompatPair(t.dataset.id); },
    compatGoPage: function(e, t) { compatGoPage(+t.dataset.page); },
    exportCompatCSV: function() { exportCompatCSV(); },
    importCuratedPairs: function() { importCuratedPairs(); },
    // DDI (drug interaction)
    openDDIPairModal: function() { openDDIPairModal(); },
    closeDDIPairModal: function() { closeDDIPairModal(); },
    saveDDIPair: function() { saveDDIPair(); },
    editDDIPair: function(e, t) { editDDIPair(t.dataset.id); },
    deleteDDIPair: function(e, t) { deleteDDIPair(t.dataset.id); },
    filterDDIPairs: function() { filterDDIPairs(); },
    openDDIRuleModal: function() { openDDIRuleModal(); },
    closeDDIRuleModal: function() { closeDDIRuleModal(); },
    saveDDIRule: function() { saveDDIRule(); },
    editDDIRule: function(e, t) { editDDIRule(t.dataset.id); },
    deleteDDIRule: function(e, t) { deleteDDIRule(t.dataset.id); },
    filterDDIRules: function() { filterDDIRules(); },
    importDDIDefaults: function() { importDDIDefaults(); },
    // Renal dosing
    openRenalModal: function() { openRenalModal(); },
    closeRenalModal: function() { closeRenalModal(); },
    saveRenalDrug: function() { saveRenalDrug(); },
    editRenalDrug: function(e, t) { editRenalDrug(t.dataset.id); },
    deleteRenalDrug: function(e, t) { deleteRenalDrug(t.dataset.id); },
    renalGoPage: function(e, t) { renalGoPage(+t.dataset.page); },
    exportRenalCSV: function() { exportRenalCSV(); },
    importCuratedRenal: function() { importCuratedRenal(); },
    connectRenalSupabase: function() { connectRenalSupabase(); },
    connectSupabase: function() { connectSupabase(); },
    addRenalDosingRow: function() { addRenalDosingRow('', '', '', ''); },
    removeRenalDosingRow: function(e, t) { t.closest('.renal-dosing-row').remove(); },
    toggleRenalPreview: function(e, t) { toggleRenalPreview(t.dataset.preview === 'true'); },
    // Allergy cross-reactivity
    openAllergyModal: function() { openAllergyModal(); },
    closeAllergyModal: function() { closeAllergyModal(); },
    saveAllergyGroup: function() { saveAllergyGroup(); },
    editAllergyGroup: function(e, t) { editAllergyGroup(t.dataset.id); },
    deleteAllergyGroup: function(e, t) { deleteAllergyGroup(t.dataset.id); },
    allergyGoPage: function(e, t) { allergyGoPage(+t.dataset.page); },
    seedAllergyFromCode: function() { seedAllergyFromCode(); },
    exportAllergyCSV: function() { exportAllergyCSV(); },
    addAllergyDrugRow: function(e, t) { addAllergyDrugRow(t.dataset.list, {}); },
    removeAllergyDrugRow: function(e, t) { t.closest('.af-row').remove(); }
  });
  IVDrugRef.delegate(document, 'input', {
    filterDrugs: function() { filterDrugs(); },
    filterCompat: function() { filterCompat(); },
    filterRenal: function() { filterRenal(); },
    filterAllergy: function() { filterAllergy(); }
  });
  IVDrugRef.delegate(document, 'change', {
    filterDrugs: function() { filterDrugs(); },
    handleImportFile: function(e) { handleImportFile(e); },
    renderAuditLog: function() { renderAuditLog(); },
    filterCompat: function() { filterCompat(); },
    filterRenal: function() { filterRenal(); },
    filterAllergy: function() { filterAllergy(); }
  });

  // Init Google Auth after GIS library loads
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleAuth();
  } else {
    // GIS not loaded yet — wait
    const check = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(check);
        initGoogleAuth();
      }
    }, 200);
    // Fallback: allow local access after 3s if GIS fails
    setTimeout(() => {
      clearInterval(check);
      const cfg = getConfig();
      if (!cfg.clientId) {
        showApp({ name: 'Admin (Setup)', email: 'setup@local', picture: '' });
        switchTab('settings');
      }
    }, 3000);
  }
});

// ═══════════════════════════════════════════
// EXPOSE TO WINDOW — only items needed externally
// (Google Auth callbacks & shared utilities)
// All inline-handler exports removed; delegation handles them.
// ═══════════════════════════════════════════
window.initGoogleAuth = initGoogleAuth;
window.handleCredentialResponse = handleCredentialResponse;
window.signIn = signIn;
window.toast = toast;

/* ═══════════════════════════════════════════
   DATA QUALITY DASHBOARD
   มาตรฐาน สภ.รพ. มาตรฐานที่ ๔: การควบคุมยา
   ═══════════════════════════════════════════ */

function renderQualityDashboard() {
  var drugs = state.drugs || [];
  if (!drugs.length) { toast('⚠ ยังไม่มีข้อมูลยา', 'warning'); return; }

  // ── Field definitions with severity ──
  var FIELDS = [
    { key: 'generic', label: 'ชื่อสามัญ', severity: 'critical', pts: 15 },
    { key: 'strength', label: 'ความแรง', severity: 'critical', pts: 15 },
    { key: 'admin.route', label: 'วิธีบริหาร (Route)', severity: 'critical', pts: 15 },
    { key: 'admin.rate', label: 'อัตราการให้ (Rate)', severity: 'critical', pts: 15 },
    { key: 'trade', label: 'ชื่อการค้า', severity: 'high', pts: 5 },
    { key: 'reconst.solvent', label: 'ตัวทำละลาย (Reconst)', severity: 'high', pts: 3 },
    { key: 'dilution.diluent', label: 'สารละลายเจือจาง (Dilution)', severity: 'high', pts: 3 },
    { key: 'dilution.finalConc', label: 'ความเข้มข้นสุดท้าย', severity: 'high', pts: 4 },
    { key: 'stability.reconst', label: 'ความคงตัว (Reconst)', severity: 'medium', pts: 3 },
    { key: 'stability.diluted', label: 'ความคงตัว (Diluted)', severity: 'medium', pts: 3 },
    { key: 'stability.storage', label: 'การจัดเก็บ (Storage)', severity: 'medium', pts: 4 },
    { key: 'precautions', label: 'ข้อควรระวัง', severity: 'high', pts: 5 },
    { key: 'monitoring', label: 'การติดตาม (Monitoring)', severity: 'medium', pts: 3 },
    { key: 'ref', label: 'แหล่งอ้างอิง (Reference)', severity: 'low', pts: 2 },
    { key: 'compat.ysite', label: 'Y-site Compatibility', severity: 'low', pts: 5 }
  ];
  var MAX_PTS = FIELDS.reduce(function(s, f) { return s + f.pts; }, 0);

  // ── Helper: get nested field value ──
  function getField(drug, key) {
    var parts = key.split('.');
    var val = drug;
    for (var i = 0; i < parts.length; i++) {
      if (!val) return '';
      val = val[parts[i]];
    }
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '';
    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
    return val ? String(val).trim() : '';
  }

  function isEmpty(v) { return !v || v === '-' || v === 'N/A' || v === 'null' || v === '[]' || v === '{}'; }

  // ── Score each drug ──
  var allIssues = [];
  var scores = [];

  drugs.forEach(function(drug) {
    var pts = 0;
    var missing = [];
    FIELDS.forEach(function(f) {
      var val = getField(drug, f.key);
      if (!isEmpty(val)) {
        pts += f.pts;
      } else {
        missing.push(f);
      }
    });
    var pct = Math.round(pts / MAX_PTS * 100);
    scores.push({ drug: drug, score: pct, missing: missing });

    missing.forEach(function(f) {
      var sev = f.severity;
      // HAD drug missing precautions = upgrade to critical
      if (drug.had && f.key === 'precautions') sev = 'critical';
      allIssues.push({
        drugId: drug.id,
        drugName: drug.generic || '(no name)',
        had: drug.had,
        field: f.label,
        severity: sev,
        key: f.key
      });
    });
  });

  // ── HAD flags ──
  var hadIssues = drugs.filter(function(d) {
    return d.had && (isEmpty(getField(d, 'precautions')) || isEmpty(getField(d, 'monitoring')));
  });

  // ── Duplicate detection ──
  var dupGeneric = [];
  var dupTrade = [];
  var seenGeneric = {};
  var seenTrade = {};
  drugs.forEach(function(d) {
    var g = (d.generic || '').toLowerCase().trim();
    var t = (d.trade || '').toLowerCase().trim();
    if (g && seenGeneric[g]) dupGeneric.push({ name: d.generic, id1: seenGeneric[g], id2: d.id });
    else if (g) seenGeneric[g] = d.id;
    if (t && t !== '-' && seenTrade[t]) dupTrade.push({ name: d.trade, id1: seenTrade[t], id2: d.id });
    else if (t && t !== '-') seenTrade[t] = d.id;
  });

  // ── Stats ──
  var avgScore = Math.round(scores.reduce(function(s, d) { return s + d.score; }, 0) / scores.length);
  var complete = scores.filter(function(d) { return d.score === 100; }).length;
  var critical = allIssues.filter(function(i) { return i.severity === 'critical'; }).length;
  var totalDups = dupGeneric.length + dupTrade.length;

  var statsEl = document.getElementById('quality-stats');
  if (statsEl) statsEl.innerHTML =
    '<div class="stat-card"><div class="stat-label">Quality Score</div><div class="stat-value ' + (avgScore >= 90 ? 'success' : avgScore >= 70 ? 'warning' : 'danger') + '">' + avgScore + '%</div></div>' +
    '<div class="stat-card"><div class="stat-label">ข้อมูลครบ 100%</div><div class="stat-value success">' + complete + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">ข้อมูลไม่ครบ</div><div class="stat-value warning">' + (drugs.length - complete) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">🔴 Critical Issues</div><div class="stat-value danger">' + critical + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">⚠ HAD Issues</div><div class="stat-value danger">' + hadIssues.length + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">ซ้ำซ้อน (Duplicates)</div><div class="stat-value ' + (totalDups > 0 ? 'warning' : 'success') + '">' + totalDups + '</div></div>';

  // ── Issues table (sorted by severity) ──
  var sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  var sevLabel = { critical: '🔴 CRITICAL', high: '🟠 HIGH', medium: '🟡 MEDIUM', low: '🔵 LOW' };
  var sevColor = { critical: '#fef2f2', high: '#fff7ed', medium: '#fefce8', low: '#eff6ff' };
  allIssues.sort(function(a, b) { return sevOrder[a.severity] - sevOrder[b.severity]; });

  var issuesEl = document.getElementById('quality-issues');
  if (issuesEl) {
    var html = '<h3 style="margin-bottom:8px">📋 Validation Issues (' + allIssues.length + ' รายการ)</h3>';
    if (allIssues.length === 0) {
      html += '<div style="padding:20px;text-align:center;color:var(--success);font-weight:600">✅ ข้อมูลยาครบถ้วนทุกรายการ</div>';
    } else {
      html += '<div class="table-wrap"><table class="drug-table"><thead><tr>' +
        '<th>ระดับ</th><th>#</th><th>ชื่อยา</th><th>Field ที่ขาด</th><th>HAD</th></tr></thead><tbody>';
      allIssues.slice(0, 100).forEach(function(iss) {
        html += '<tr style="background:' + sevColor[iss.severity] + '">' +
          '<td><span class="q-badge q-' + escHtml(iss.severity) + '">' + (sevLabel[iss.severity] || escHtml(iss.severity)) + '</span></td>' +
          '<td>' + escHtml(String(iss.drugId)) + '</td>' +
          '<td><strong>' + escHtml(iss.drugName) + '</strong></td>' +
          '<td>' + escHtml(iss.field) + '</td>' +
          '<td>' + (iss.had ? '<span class="badge badge-had">⚠ HAD</span>' : '—') + '</td></tr>';
      });
      if (allIssues.length > 100) html += '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">... แสดง 100 จาก ' + allIssues.length + ' รายการ</td></tr>';
      html += '</tbody></table></div>';
    }

    // ── Bottom drugs by score ──
    var bottomDrugs = scores.filter(function(d) { return d.score < 100; }).sort(function(a, b) { return a.score - b.score; }).slice(0, 15);
    if (bottomDrugs.length > 0) {
      html += '<h3 style="margin:20px 0 8px">📉 ยาที่ข้อมูลน้อยที่สุด (Bottom 15)</h3>';
      html += '<div class="table-wrap"><table class="drug-table"><thead><tr><th>#</th><th>ชื่อยา</th><th>Score</th><th>Progress</th><th>Fields ที่ขาด</th></tr></thead><tbody>';
      bottomDrugs.forEach(function(d) {
        var color = d.score >= 80 ? 'var(--success)' : d.score >= 60 ? 'var(--warning)' : 'var(--danger)';
        html += '<tr><td>' + escHtml(String(d.drug.id)) + '</td><td><strong>' + escHtml(d.drug.generic || '') + '</strong></td>' +
          '<td style="font-weight:700;color:' + color + '">' + d.score + '%</td>' +
          '<td><div class="q-bar"><div class="q-bar-fill" style="width:' + d.score + '%;background:' + color + '"></div></div></td>' +
          '<td style="font-size:11px">' + d.missing.map(function(m) { return escHtml(m.label); }).join(', ') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    issuesEl.innerHTML = html;
  }

  // ── HAD flags ──
  var hadEl = document.getElementById('quality-had-flags');
  if (hadEl) {
    if (hadIssues.length === 0) {
      hadEl.innerHTML = '';
    } else {
      var hHtml = '<h3 style="margin-bottom:8px">🚨 HAD Drugs ที่ขาดข้อมูลสำคัญ (' + hadIssues.length + ' รายการ)</h3>' +
        '<p style="font-size:11px;color:var(--danger);margin-bottom:8px">ยา High-Alert ต้องมี Precautions + Monitoring ครบ ตามมาตรฐาน สภ.รพ.</p>';
      hadIssues.forEach(function(d) {
        var missingFields = [];
        if (isEmpty(getField(d, 'precautions'))) missingFields.push('Precautions');
        if (isEmpty(getField(d, 'monitoring'))) missingFields.push('Monitoring');
        hHtml += '<div class="q-had-card">' +
          '<strong>#' + escHtml(String(d.id)) + ' ' + escHtml(d.generic || '') + '</strong> ' +
          '<span class="badge badge-had">⚠ HAD</span> — ' +
          '<span style="color:var(--danger)">ขาด: ' + missingFields.join(', ') + '</span>' +
          ' <button class="btn btn-sm btn-outline" data-action="editDrug" data-id="' + escHtml(String(d.id)) + '" style="margin-left:8px">✏️ แก้ไข</button></div>';
      });
      hadEl.innerHTML = hHtml;
    }
  }

  // ── Duplicates ──
  var dupEl = document.getElementById('quality-duplicates');
  if (dupEl) {
    if (totalDups === 0) {
      dupEl.innerHTML = '';
    } else {
      var dHtml = '<h3 style="margin-bottom:8px">🔍 ตรวจพบข้อมูลซ้ำ (' + totalDups + ' คู่)</h3>';
      if (dupGeneric.length > 0) {
        dHtml += '<h4 style="font-size:12px;margin:8px 0 4px">Generic Name ซ้ำ:</h4>';
        dupGeneric.forEach(function(d) {
          dHtml += '<div class="q-dup-card">⚠ "<strong>' + escHtml(d.name) + '</strong>" — พบใน #' + escHtml(String(d.id1)) + ' และ #' + escHtml(String(d.id2)) + '</div>';
        });
      }
      if (dupTrade.length > 0) {
        dHtml += '<h4 style="font-size:12px;margin:8px 0 4px">Trade Name ซ้ำ:</h4>';
        dupTrade.forEach(function(d) {
          dHtml += '<div class="q-dup-card">⚠ "<strong>' + escHtml(d.name) + '</strong>" — พบใน #' + escHtml(String(d.id1)) + ' และ #' + escHtml(String(d.id2)) + '</div>';
        });
      }
      dupEl.innerHTML = dHtml;
    }
  }
}

})();
