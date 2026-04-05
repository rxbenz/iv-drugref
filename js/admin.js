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
  // Renal dosing
  renalDrugs: [],
  renalPage: 1,
  editingRenalId: null,
  // Analytics summary
  analyticsData: null,
};

function getConfig() {
  return {
    scriptUrl: localStorage.getItem(LS_PREFIX + 'scriptUrl') || '',
    clientId: localStorage.getItem(LS_PREFIX + 'clientId') || '',
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

  const isRead = ['getDrugs', 'getAudit', 'getCategories', 'getUsers', 'getCompatPairs', 'getRenalDrugs'].includes(action);
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
    sel.innerHTML += `<option value="${c}">${c}</option>`;
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
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${d.id || '—'}</td>
      <td>
        <div class="drug-name">${escHtml(d.generic || '')}</div>
        ${d.had ? '<span class="badge badge-had" style="font-size:10px">⚠ HAD</span>' : ''}
      </td>
      <td class="drug-trade">${escHtml(d.trade || '—')}</td>
      <td>${(d.categories || []).map(c => `<span class="badge badge-cat">${escHtml(c)}</span>`).join('')}</td>
      <td><span class="badge ${d.ed === 'E' ? 'badge-ed' : 'badge-ned'}">${d.ed || '—'}</span></td>
      <td>${d.had ? '⚠️' : '—'}</td>
      <td><span class="badge badge-${d.status || 'draft'}">${d.status || 'draft'}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" data-action="editDrug" data-id="${d.id}" title="แก้ไข">✏️</button>
          <button class="btn btn-sm btn-outline" data-action="previewDrugById" data-id="${d.id}" title="Preview">👁</button>
          ${isAdmin() && d.status === 'pending' ? `<button class="btn btn-sm btn-success" data-action="approveDrug" data-id="${d.id}" title="อนุมัติ">✅</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteDrug" data-id="${d.id}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
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
          <button class="btn btn-sm btn-outline" data-action="openDiffModal" data-id="${d.id}">🔍 ตรวจสอบ</button>
          <button class="btn btn-sm btn-outline" data-action="editDrug" data-id="${d.id}">✏️ แก้ไข</button>
          ${isAdmin() ? `<button class="btn btn-sm btn-success" data-action="approveDrug" data-id="${d.id}">✅ อนุมัติ</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-danger" data-action="rejectDrug" data-id="${d.id}">↩️ ส่งกลับ</button>` : '<span class="badge badge-pending">รอ Admin อนุมัติ</span>'}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:12px;color:var(--text-muted)">
        <div><strong>Strength:</strong> ${escHtml(d.strength || '—')}</div>
        <div><strong>Route:</strong> ${escHtml(d.admin?.route || '—')}</div>
        <div><strong>Rate:</strong> ${escHtml(d.admin?.rate || '—')}</div>
        <div><strong>Categories:</strong> ${(d.categories||[]).join(', ') || '—'}</div>
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
      📄 ${filename} — พบ ${data.length} rows, valid ${valid.length} rows
      ${errors.length ? `<br>⚠️ ${errors.length} errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}` : ''}
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
        ${e.drugId ? `<span style="font-family:var(--mono);font-size:11px;color:var(--text-light)">#${e.drugId}</span>` : ''}
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

/** Sync drugs-data.json to GitHub via Contents API */
async function syncToGitHub() {
  const cfg = getConfig();
  if (!cfg.ghToken) { toast('❌ กรุณาใส่ GitHub Token ในตั้งค่าก่อน', 'error'); return; }
  if (!cfg.ghRepo) { toast('❌ กรุณาใส่ GitHub Repo', 'error'); return; }
  if (state.drugs.length === 0) { toast('ไม่มีข้อมูลยา — โหลดข้อมูลก่อน', 'info'); return; }

  const resultEl = document.getElementById('sync-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.style.background = 'rgba(14,165,233,.08)';
    resultEl.style.color = 'var(--primary)';
    resultEl.textContent = '🔄 กำลัง sync...';
  }

  try {
    const apiBase = 'https://api.github.com/repos/' + cfg.ghRepo + '/contents/drugs-data.json';
    const headers = { 'Authorization': 'Bearer ' + cfg.ghToken, 'Accept': 'application/vnd.github.v3+json' };

    // 1. Get current file SHA
    const getRes = await fetch(apiBase, { headers: headers });
    if (!getRes.ok && getRes.status !== 404) throw new Error('GitHub GET failed: ' + getRes.status);
    const current = getRes.ok ? await getRes.json() : null;
    const sha = current ? current.sha : undefined;

    // 2. Build new content
    const json = buildDrugsDataJSON();
    const count = JSON.parse(json).length;
    const content = btoa(unescape(encodeURIComponent(json)));

    // 3. PUT to GitHub
    const body = {
      message: 'Sync drugs-data.json from admin (' + count + ' drugs)',
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
    if (resultEl) {
      resultEl.style.background = 'rgba(16,185,129,.08)';
      resultEl.style.color = 'var(--green, #10b981)';
      resultEl.textContent = '✅ Sync สำเร็จ! ' + count + ' drugs → ' + cfg.ghRepo + '/main\nCommit: ' + (result.commit ? result.commit.sha.substring(0, 7) : 'ok') + '\nGitHub Pages จะ rebuild ภายใน 1-2 นาที';
    }
    toast('✅ Sync to GitHub สำเร็จ (' + count + ' drugs)', 'success');
  } catch (e) {
    if (resultEl) {
      resultEl.style.background = 'rgba(239,68,68,.08)';
      resultEl.style.color = 'var(--danger, #ef4444)';
      resultEl.textContent = '❌ Sync failed: ' + e.message;
    }
    toast('❌ Sync failed: ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════
   COMPATIBILITY PAIRS CRUD
   ═══════════════════════════════════════════ */
const COMPAT_PER_PAGE = 25;
const RESULT_LABELS = { c: '✅ Compatible', i: '❌ Incompatible', v: '⚠️ Variable' };
const RESULT_BADGE = { c: 'badge-approved', i: 'badge-had', v: 'badge-pending' };

async function loadCompatPairs() {
  showLoading('กำลังโหลดข้อมูล compatibility...');
  try {
    const result = await apiCall('getCompatPairs');
    state.compatPairs = result.pairs || [];
    renderCompatStats();
    renderCompatTable();
  } catch (e) {
    console.error('loadCompatPairs error:', e);
    toast('โหลดข้อมูล compatibility ล้มเหลว', 'error');
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
        <td><span class="badge ${RESULT_BADGE[p.result] || ''}">${RESULT_LABELS[p.result] || p.result}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${escHtml(p.ref || '—')}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-outline" data-action="editCompatPair" data-id="${p.id}" title="แก้ไข">✏️</button>
            ${isAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteCompatPair" data-id="${p.id}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
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

  showLoading('กำลังบันทึก...');
  try {
    if (state.editingCompatId) {
      await apiCall('updateCompatPair', { id: state.editingCompatId, drugA, drugB, result, ref });
      toast('✅ อัพเดทคู่ยาแล้ว', 'success');
    } else {
      await apiCall('createCompatPair', { drugA, drugB, result, ref });
      toast('✅ เพิ่มคู่ยาแล้ว', 'success');
    }
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
  if (!isAdmin()) { toast('❌ เฉพาะ Admin เท่านั้น', 'error'); return; }
  const pair = state.compatPairs.find(p => String(p.id) === String(id));
  if (!pair) return;
  if (!confirm(`ลบคู่ยา "${pair.drugA} + ${pair.drugB}" ?`)) return;

  showLoading('กำลังลบ...');
  try {
    await apiCall('deleteCompatPair', { id });
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
  if (state.compatPairs.length > 0) {
    if (!confirm(`มีข้อมูลอยู่แล้ว ${state.compatPairs.length} คู่\nระบบจะข้ามคู่ยาที่ซ้ำ — ต้องการ import CURATED ${CURATED_PAIRS.length} คู่?`)) return;
  } else {
    if (!confirm(`Import ข้อมูล CURATED ${CURATED_PAIRS.length} คู่ยา เข้าสู่ Google Sheets?`)) return;
  }

  const pairs = CURATED_PAIRS.map(([drugA, drugB, result]) => ({
    drugA, drugB, result, ref: "Trissel's / Lexicomp"
  }));

  showLoading(`กำลัง import ${pairs.length} คู่ยา...`);
  try {
    // Use POST directly for bulk — payload is large
    const cfg = getConfig();
    const postUrl = cfg.scriptUrl + '?action=bulkCreateCompatPairs&user=' + encodeURIComponent(state.user?.email || 'unknown');
    const body = JSON.stringify({ action: 'bulkCreateCompatPairs', user: state.user?.email || 'unknown', pairs });

    if (body.length < 6000) {
      // Small enough for GET
      const result = await apiCall('bulkCreateCompatPairs', { pairs });
      toast(`✅ Import สำเร็จ: เพิ่ม ${result.created} คู่, ข้าม ${result.skipped} คู่ซ้ำ`, 'success');
    } else {
      // Large payload → POST no-cors
      await fetch(postUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
      });
      await new Promise(r => setTimeout(r, 2000));
      toast('✅ ส่งข้อมูล import แล้ว — กำลังโหลดใหม่...', 'success');
    }
    await loadCompatPairs();
  } catch (e) {
    toast('❌ Import ล้มเหลว: ' + e.message, 'error');
  }
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
  showLoading('กำลังโหลดข้อมูล renal dosing...');
  try {
    const result = await apiCall('getRenalDrugs');
    state.renalDrugs = (result.drugs || []).map(d => ({
      ...d,
      badges: typeof d.badges === 'string' ? JSON.parse(d.badges || '[]') : (d.badges || []),
      dosingTable: typeof d.dosingTable === 'string' ? JSON.parse(d.dosingTable || '[]') : (d.dosingTable || [])
    }));
    renderRenalStats();
    renderRenalTable();
  } catch (e) {
    console.error('loadRenalDrugs error:', e);
    toast('โหลดข้อมูล renal dosing ล้มเหลว', 'error');
  }
  hideLoading();
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
    ${topClasses.map(([c,n]) => `<div class="stat-card"><div class="stat-label">${CLASS_LABELS[c] || c}</div><div class="stat-value">${n}</div></div>`).join('')}
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
        <td><span class="badge">${CLASS_LABELS[d['class']] || d['class'] || ''}</span></td>
        <td style="font-size:12px">${escHtml(d.sub || '')}</td>
        <td style="font-size:12px">${(d.dosingTable || []).length} ranges</td>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.infoType === 'red' ? '#ef4444' : d.infoType === 'amber' ? '#f59e0b' : d.infoType === 'teal' ? '#14b8a6' : '#3b82f6'}"></span> ${INFO_TYPE_LABELS[d.infoType] || ''}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-outline" data-action="editRenalDrug" data-id="${escHtml(String(d.id))}" title="แก้ไข">✏️</button>
            ${isAdmin() ? `<button class="btn btn-sm btn-outline" data-action="deleteRenalDrug" data-id="${escHtml(String(d.id))}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}
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
  showLoading('กำลังบันทึก...');
  try {
    if (state.editingRenalId) {
      await apiCall('updateRenalDrug', data);
      toast('✅ อัพเดทยาแล้ว', 'success');
    } else {
      await apiCall('createRenalDrug', data);
      toast('✅ เพิ่มยาแล้ว', 'success');
    }
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
  if (!isAdmin()) { toast('❌ เฉพาะ Admin เท่านั้น', 'error'); return; }
  const drug = state.renalDrugs.find(d => String(d.id) === String(id));
  if (!drug) return;
  if (!confirm(`ลบยา "${drug.name}" ?`)) return;
  showLoading('กำลังลบ...');
  try {
    await apiCall('deleteRenalDrug', { id });
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

// Hardcoded CURATED renal dosing data — for one-time migration
const CURATED_RENAL_DRUGS = [
  // ── ANTIBIOTICS ──
  {id:'vancomycin',name:'Vancomycin','class':'abx',sub:'Glycopeptide',badges:['abx','renal','hd'],
    recommended:'15-20 mg/kg/dose q8-12h',
    dosingTable:[
      {range:'>80',dose:'15-20 mg/kg',freq:'q8-12h',note:'Normal dosing'},
      {range:'50–80',dose:'15-20 mg/kg',freq:'q12h',note:''},
      {range:'30–50',dose:'15-20 mg/kg',freq:'q24h',note:''},
      {range:'10–30',dose:'15-20 mg/kg',freq:'q24-48h',note:'Re-dose by trough'},
      {range:'<10 / HD',dose:'15-20 mg/kg',freq:'q48-72h',note:'Re-dose when trough <15-20'}
    ],
    info:'<strong>TDM:</strong> AUC/MIC 400-600 (preferred) | Trough 15-20 mcg/mL<br>เจาะ trough ก่อน dose ที่ 4<br><strong>HD:</strong> Re-dose 15-25 mg/kg post-HD, เจาะ pre-HD level<br><strong>CRRT:</strong> 15-20 mg/kg loading → 7.5-10 mg/kg q12h (adjust by level)',
    infoType:'blue',
    ref:'Rybak MJ, et al. Am J Health Syst Pharm. 2020;77(11):835-864 | Lexicomp 2024'},

  {id:'meropenem',name:'Meropenem','class':'abx',sub:'Carbapenem',badges:['abx','renal'],
    recommended:'1-2 g q8h',
    dosingTable:[
      {range:'>50',dose:'1–2 g',freq:'q8h',note:'No adjustment needed'},
      {range:'26–50',dose:'1 g',freq:'q12h',note:''},
      {range:'10–25',dose:'500 mg–1 g',freq:'q12h',note:''},
      {range:'<10 / HD',dose:'500 mg–1 g',freq:'q24h',note:'Give post-HD on HD days'}
    ],
    info:'<strong>Extended infusion:</strong> 3-4 hr infusion may improve PK/PD target attainment<br><strong>Seizure risk:</strong> ต่ำกว่า Imipenem แต่ยังต้องระวังใน CKD<br><strong>CRRT:</strong> 1 g q8h (CVVH/CVVHD/CVVHDF)',
    infoType:'blue',
    ref:'Lexicomp 2024 | Sanford Guide 2024'},

  {id:'imipenem',name:'Imipenem/Cilastatin','class':'abx',sub:'Carbapenem',badges:['abx','renal'],
    recommended:'500 mg q6h',
    dosingTable:[
      {range:'>70',dose:'500 mg',freq:'q6h',note:'Normal'},
      {range:'41–70',dose:'500 mg',freq:'q8h',note:''},
      {range:'21–40',dose:'250–500 mg',freq:'q8-12h',note:''},
      {range:'6–20',dose:'250 mg',freq:'q12h',note:''},
      {range:'<6 / HD',dose:'250 mg',freq:'q12h',note:'Supplement post-HD'}
    ],
    info:'<strong>⚠ Seizure risk สูงขึ้นใน renal impairment</strong> — ห้ามใช้ขนาด >500 mg/dose ถ้า CrCl <70<br><strong>CRRT:</strong> 500 mg q6-8h',
    infoType:'amber',
    ref:'Lexicomp 2024 | Package Insert'},

  {id:'ertapenem',name:'Ertapenem','class':'abx',sub:'Carbapenem',badges:['abx','renal','hd'],
    recommended:'1 g q24h',
    dosingTable:[
      {range:'>30',dose:'1 g',freq:'q24h',note:'No adjustment'},
      {range:'≤30 / HD',dose:'500 mg',freq:'q24h',note:'Give supplement 150 mg post-HD'}
    ],
    info:'<strong>HD:</strong> ถ้า dose ≤6 hr ก่อน HD → supplement 150 mg post-HD<br><strong>ไม่แนะนำ</strong>ใน CRRT (ข้อมูลจำกัด)',
    infoType:'blue',
    ref:'Lexicomp 2024 | Sanford Guide 2024'},

  {id:'piptazo',name:'Piperacillin/Tazobactam','class':'abx',sub:'Beta-lactam/BLI',badges:['abx','renal'],
    recommended:'4.5 g q6h',
    dosingTable:[
      {range:'>40',dose:'4.5 g',freq:'q6h',note:'Normal (EI: 4hr)'},
      {range:'20–40',dose:'3.375 g q6h หรือ 4.5 g',freq:'q8h',note:''},
      {range:'<20 / HD',dose:'2.25 g q6h หรือ 4.5 g',freq:'q12h',note:'Supplement 0.75 g post-HD'}
    ],
    info:'<strong>Extended infusion:</strong> 4 hr infusion recommended for PK/PD optimization<br><strong>⚠ หลีกเลี่ยงร่วม Vancomycin</strong> → ↑ risk AKI<br><strong>CRRT:</strong> 4.5 g q6-8h',
    infoType:'blue',
    ref:'Lexicomp 2024 | Rhodes NJ, et al. Pharmacotherapy 2015'},

  {id:'ceftriaxone',name:'Ceftriaxone','class':'abx',sub:'3rd gen Cephalosporin',badges:['abx'],
    recommended:'1–2 g q24h (ไม่ต้องปรับขนาดตามไต)',
    dosingTable:[
      {range:'All GFR',dose:'1–2 g',freq:'q24h',note:'ไม่ต้องปรับ (hepatic elimination ~40%)'},
      {range:'HD',dose:'1–2 g',freq:'q24h',note:'Not dialyzable; no supplement needed'}
    ],
    info:'<strong>ข้อดี:</strong> No renal dose adjustment needed<br><strong>⚠ Max 2g/day</strong> ใน combined hepatic + renal impairment<br><strong>ห้ามผสม</strong>ใน Ca²⁺-containing solutions (Ringer\'s, Hartmann\'s)',
    infoType:'teal',
    ref:'Lexicomp 2024'},

  {id:'ceftazidime',name:'Ceftazidime','class':'abx',sub:'3rd gen Cephalosporin (anti-Pseudomonas)',badges:['abx','renal','hd'],
    recommended:'1–2 g q8h',
    dosingTable:[
      {range:'>50',dose:'1–2 g',freq:'q8h',note:'Normal'},
      {range:'31–50',dose:'1 g',freq:'q12h',note:''},
      {range:'16–30',dose:'1 g',freq:'q24h',note:''},
      {range:'6–15',dose:'500 mg',freq:'q24h',note:''},
      {range:'<6 / HD',dose:'1 g loading → 500 mg',freq:'q24-48h',note:'Give post-HD'}
    ],
    info:'<strong>CRRT:</strong> 1-2 g q8-12h<br><strong>Extended infusion:</strong> อาจพิจารณา 3-4 hr infusion',
    infoType:'blue',
    ref:'Lexicomp 2024 | Sanford Guide 2024'},

  {id:'cefepime',name:'Cefepime','class':'abx',sub:'4th gen Cephalosporin',badges:['abx','renal'],
    recommended:'1–2 g q8h',
    dosingTable:[
      {range:'>60',dose:'1–2 g',freq:'q8h',note:'Normal'},
      {range:'30–60',dose:'1–2 g',freq:'q12h',note:''},
      {range:'11–29',dose:'1 g',freq:'q24h',note:''},
      {range:'≤10 / HD',dose:'500 mg–1 g',freq:'q24h',note:'Give post-HD'}
    ],
    info:'<strong>⚠ Neurotoxicity risk สูงขึ้นมาก</strong>เมื่อไม่ปรับ dose ใน CKD → confusion, seizures, myoclonus<br><strong>CRRT:</strong> 1-2 g q8-12h',
    infoType:'amber',
    ref:'Lexicomp 2024 | Payne LE, et al. Crit Care. 2017;21(1):276'},

  {id:'amikacin',name:'Amikacin','class':'abx',sub:'Aminoglycoside',badges:['abx','renal','hd'],
    recommended:'15 mg/kg q24h (extended-interval)',
    dosingTable:[
      {range:'≥60',dose:'15 mg/kg',freq:'q24h',note:'Extended-interval'},
      {range:'40–59',dose:'15 mg/kg',freq:'q36h',note:''},
      {range:'20–39',dose:'15 mg/kg',freq:'q48h',note:''},
      {range:'<20 / HD',dose:'15 mg/kg',freq:'By level',note:'Re-dose when trough <5'}
    ],
    info:'<strong>TDM:</strong> Peak 20-35 (extended) | Trough <5 mcg/mL<br><strong>Monitor:</strong> SCr, audiometry, vestibular function<br><strong>HD:</strong> Give post-HD, เจาะ level pre-next dose',
    infoType:'blue',
    ref:'Lexicomp 2024 | Nicolau DP, et al. AAC 1995'},

  // ── ANTIFUNGALS ──
  {id:'fluconazole',name:'Fluconazole','class':'af',sub:'Azole',badges:['af','renal'],
    recommended:'200-400 mg/day',
    dosingTable:[
      {range:'>50',dose:'200-400 mg',freq:'q24h',note:'Normal dose'},
      {range:'≤50 (no HD)',dose:'100-200 mg',freq:'q24h',note:'ลด 50%'},
      {range:'<10 / HD',dose:'100-200 mg',freq:'q24h post-HD',note:'ให้หลัง HD'}
    ],
    info:'<strong>HD:</strong> Fluconazole dialyzable — ให้ dose หลัง HD<br><strong>CRRT:</strong> ให้ normal dose (200-400 mg/day)<br><strong>Monitor:</strong> LFTs, QTc',
    infoType:'blue',
    ref:'Lexicomp 2024 | IDSA Candidiasis Guidelines 2016'},

  {id:'amphotericin-b',name:'Amphotericin B (Liposomal)','class':'af',sub:'Polyene',badges:['af','nephrotox'],
    recommended:'3-5 mg/kg/day (ไม่ต้องปรับ dose ตาม GFR)',
    dosingTable:[
      {range:'All GFR',dose:'3-5 mg/kg/day',freq:'q24h',note:'ไม่ต้องปรับ dose'},
      {range:'HD',dose:'3-5 mg/kg/day',freq:'q24h',note:'ไม่ถูก dialyze'}
    ],
    info:'<strong>⚠ Nephrotoxic:</strong> Monitor SCr, K+, Mg++ ทุกวัน<br>Liposomal form มี nephrotoxicity น้อยกว่า conventional<br>Pre-hydrate with NSS 500 mL ก่อนให้ยา<br><strong>CRRT:</strong> ไม่ต้องปรับ dose',
    infoType:'amber',
    ref:'Lexicomp 2024 | IDSA Aspergillosis Guidelines 2016'},

  {id:'voriconazole',name:'Voriconazole','class':'af',sub:'Azole',badges:['af','avoid'],
    recommended:'IV: 6 mg/kg q12h x2 → 4 mg/kg q12h; PO: 200-300 mg q12h',
    dosingTable:[
      {range:'>50',dose:'IV: 6→4 mg/kg; PO: 200-300 mg',freq:'q12h',note:'Normal'},
      {range:'≤50',dose:'⚠ PO only: 200-300 mg',freq:'q12h',note:'หลีกเลี่ยง IV (SBECD)'},
      {range:'<10 / HD',dose:'PO: 200 mg',freq:'q12h',note:'PO only'}
    ],
    info:'<strong>⚠ IV formulation:</strong> มี SBECD (sulfobutylether-β-cyclodextrin) ที่สะสมใน renal impairment<br>ถ้า CrCl ≤50 → เปลี่ยนเป็น PO หรือใช้ liposomal ampho B แทน<br><strong>TDM:</strong> Trough 1-5.5 mcg/mL<br><strong>Monitor:</strong> LFTs, visual disturbances',
    infoType:'amber',
    ref:'Lexicomp 2024 | IDSA Aspergillosis Guidelines 2016'},

  // ── ANTIVIRALS ──
  {id:'acyclovir',name:'Acyclovir','class':'av',sub:'Nucleoside Analog',badges:['av','renal','nephrotox'],
    recommended:'10 mg/kg q8h (HSV encephalitis)',
    dosingTable:[
      {range:'>50',dose:'10 mg/kg',freq:'q8h',note:'HSV encephalitis dose'},
      {range:'25–50',dose:'10 mg/kg',freq:'q12h',note:''},
      {range:'10–25',dose:'10 mg/kg',freq:'q24h',note:''},
      {range:'<10 / HD',dose:'5 mg/kg',freq:'q24h + post-HD',note:'Give dose post-HD'}
    ],
    info:'<strong>⚠ Nephrotoxic:</strong> Crystalluria risk — hydrate with NSS 1 L ก่อนให้ยา<br>Infuse over ≥1 hour<br><strong>HD:</strong> Give supplemental dose post-HD<br><strong>Monitor:</strong> SCr, urine output, neurological status',
    infoType:'amber',
    ref:'Lexicomp 2024 | Red Book 2024'},

  {id:'ganciclovir',name:'Ganciclovir','class':'av',sub:'Nucleoside Analog',badges:['av','renal','hd'],
    recommended:'5 mg/kg q12h (induction) → 5 mg/kg q24h (maintenance)',
    dosingTable:[
      {range:'≥70',dose:'5 mg/kg',freq:'q12h / q24h',note:'Induction / Maintenance'},
      {range:'50–69',dose:'2.5 mg/kg',freq:'q12h / q24h',note:''},
      {range:'25–49',dose:'2.5 / 1.25 mg/kg',freq:'q24h',note:''},
      {range:'10–24',dose:'1.25 / 0.625 mg/kg',freq:'q24h',note:''},
      {range:'<10 / HD',dose:'1.25 mg/kg',freq:'3x/wk post-HD',note:''}
    ],
    info:'<strong>Monitor:</strong> CBC 2-3x/wk (neutropenia risk), SCr<br><strong>HD:</strong> Give post-HD on dialysis days<br><strong>CRRT:</strong> 2.5 mg/kg q12h (induction) → q24h (maintenance)',
    infoType:'blue',
    ref:'Lexicomp 2024 | Transplant Infectious Disease Guidelines'},

  // ── ANTICOAGULANTS ──
  {id:'enoxaparin',name:'Enoxaparin','class':'ac',sub:'LMWH',badges:['ac','renal'],
    recommended:'Treatment: 1 mg/kg q12h | Prophylaxis: 40 mg q24h',
    dosingTable:[
      {range:'>30',dose:'1 mg/kg',freq:'q12h',note:'Treatment dose'},
      {range:'>30',dose:'40 mg',freq:'q24h',note:'Prophylaxis'},
      {range:'≤30',dose:'1 mg/kg',freq:'q24h ⚠',note:'ลด frequency'},
      {range:'≤30',dose:'30 mg',freq:'q24h',note:'Prophylaxis (ลด dose)'}
    ],
    info:'<strong>⚠ CrCl ≤30:</strong> LMWH สะสมได้ → พิจารณา UFH แทน<br><strong>Monitor:</strong> Anti-Xa level (target 0.5-1.0 IU/mL for treatment)<br><strong>Obesity:</strong> ใช้ actual body weight, cap ที่ 150 mg/dose<br><strong>HD:</strong> หลีกเลี่ยง LMWH → ใช้ UFH',
    infoType:'amber',
    ref:'Lexicomp 2024 | CHEST Guidelines 2021'},

  {id:'dabigatran',name:'Dabigatran','class':'ac',sub:'DOAC (Direct Thrombin Inhibitor)',badges:['ac','renal','avoid'],
    recommended:'150 mg BID (AF) | 150 mg BID (VTE treatment)',
    dosingTable:[
      {range:'>50',dose:'150 mg',freq:'BID',note:'Normal dose'},
      {range:'30–50',dose:'110 mg',freq:'BID',note:'ลด dose (age ≥80, P-gp inhib)'},
      {range:'<30',dose:'⚠ Contraindicated',freq:'—',note:'ห้ามใช้'}
    ],
    info:'<strong>⚠ Renal elimination 80%:</strong> ห้ามใช้ถ้า CrCl <30<br><strong>Drug interaction:</strong> P-gp inhibitors (verapamil, dronedarone) → ลด dose<br><strong>Reversal:</strong> Idarucizumab (Praxbind)<br><strong>HD:</strong> Dialyzable — สามารถ remove ได้ 60% ใน 2-3 ชม.',
    infoType:'red',
    ref:'Lexicomp 2024 | ESC AF Guidelines 2024'},

  // ── CARDIOVASCULAR ──
  {id:'digoxin',name:'Digoxin','class':'cv',sub:'Cardiac Glycoside',badges:['cv','renal','nephrotox'],
    recommended:'0.125-0.25 mg/day',
    dosingTable:[
      {range:'>50',dose:'0.125-0.25 mg',freq:'q24h',note:''},
      {range:'10–50',dose:'0.0625-0.125 mg',freq:'q24h',note:'ลด dose 50%'},
      {range:'<10 / HD',dose:'0.0625 mg',freq:'q48h',note:'By level'}
    ],
    info:'<strong>TDM:</strong> Target 0.5-0.9 ng/mL (HF) | 0.8-2.0 (AF)<br><strong>⚠ Toxicity risk:</strong> เพิ่มขึ้นเมื่อ K+ ต่ำ, renal impairment<br><strong>HD:</strong> Not significantly removed<br><strong>Drug interaction:</strong> Amiodarone, verapamil → ลด dose 50%',
    infoType:'amber',
    ref:'Lexicomp 2024 | ACC/AHA HF Guidelines 2022'},

  {id:'enalapril',name:'Enalapril','class':'cv',sub:'ACE Inhibitor',badges:['cv','renal'],
    recommended:'2.5-20 mg/day (titrate)',
    dosingTable:[
      {range:'>30',dose:'2.5-20 mg',freq:'q12-24h',note:'Titrate to response'},
      {range:'10–30',dose:'2.5-5 mg',freq:'q24h',note:'Start low'},
      {range:'<10 / HD',dose:'2.5 mg',freq:'q24h',note:'Dialyzable'}
    ],
    info:'<strong>⚠ Monitor:</strong> K+, SCr (ยอมรับ SCr เพิ่ม ≤30% จาก baseline)<br>ถ้า SCr เพิ่ม >30% หรือ K+ >5.5 → ลด dose หรือหยุด<br><strong>HD:</strong> Give supplemental dose post-HD (20-25% dialyzable)',
    infoType:'blue',
    ref:'Lexicomp 2024 | KDIGO CKD Guidelines 2024'},

  // ── ANALGESICS ──
  {id:'morphine',name:'Morphine','class':'analgesic',sub:'Opioid',badges:['analgesic','renal','avoid'],
    recommended:'Normal dose (titrate to pain)',
    dosingTable:[
      {range:'>50',dose:'Normal dose',freq:'q4h PRN',note:'Titrate to pain'},
      {range:'15–50',dose:'ลด 50-75%',freq:'q6-8h',note:'M6G สะสม'},
      {range:'<15 / HD',dose:'⚠ หลีกเลี่ยง',freq:'—',note:'ใช้ fentanyl แทน'}
    ],
    info:'<strong>⚠ Active metabolite M6G:</strong> สะสมใน renal impairment → respiratory depression, sedation<br><strong>Alternative:</strong> Fentanyl (no active metabolites, ไม่ต้องปรับ dose)<br><strong>HD:</strong> M6G ถูก dialyze ได้บางส่วน แต่ยังเสี่ยง',
    infoType:'red',
    ref:'Lexicomp 2024 | Dean M. J Pain Symptom Manage 2004'},

  {id:'gabapentin',name:'Gabapentin','class':'analgesic',sub:'Gabapentinoid',badges:['analgesic','renal'],
    recommended:'300-1200 mg TID',
    dosingTable:[
      {range:'≥60',dose:'300-1200 mg',freq:'TID',note:'Normal dose'},
      {range:'30–59',dose:'200-700 mg',freq:'BID',note:''},
      {range:'15–29',dose:'100-300 mg',freq:'q24h',note:''},
      {range:'<15 / HD',dose:'100-300 mg',freq:'post-HD',note:'Supplemental dose after HD'}
    ],
    info:'<strong>100% renal elimination:</strong> ต้องปรับ dose ตาม GFR เสมอ<br><strong>HD:</strong> Dialyzable — ให้ supplemental dose 125-350 mg post-HD<br><strong>Monitor:</strong> Sedation, dizziness, peripheral edema',
    infoType:'blue',
    ref:'Lexicomp 2024 | Bockbrader HN, et al. Clin Pharmacokinet 2010'},

  // ── NEUROLOGY ──
  {id:'levetiracetam',name:'Levetiracetam','class':'neuro',sub:'Antiepileptic',badges:['neuro','renal','hd'],
    recommended:'500-1500 mg BID',
    dosingTable:[
      {range:'>80',dose:'500-1500 mg',freq:'q12h',note:'Normal dose'},
      {range:'50–80',dose:'500-1000 mg',freq:'q12h',note:''},
      {range:'30–50',dose:'250-750 mg',freq:'q12h',note:''},
      {range:'<30 / HD',dose:'250-500 mg',freq:'q12h',note:'Supplement 250-500 mg post-HD'}
    ],
    info:'<strong>66% renal elimination:</strong> ต้องปรับ dose ตาม GFR<br><strong>HD:</strong> Dialyzable ~50% — ให้ supplemental dose 250-500 mg post-HD<br><strong>CRRT:</strong> 250-750 mg q12h<br><strong>IV ↔ PO:</strong> 1:1 conversion',
    infoType:'blue',
    ref:'Lexicomp 2024 | Epilepsia 2006'},

  {id:'phenobarbital',name:'Phenobarbital','class':'neuro',sub:'Barbiturate',badges:['neuro','hd'],
    recommended:'60-180 mg/day (ไม่ต้องปรับ dose แต่ระวัง sedation)',
    dosingTable:[
      {range:'>10',dose:'60-180 mg',freq:'q24h',note:'ไม่ต้องปรับ (hepatic metabolism)'},
      {range:'<10 / HD',dose:'60-180 mg',freq:'q24h',note:'Supplement post-HD'}
    ],
    info:'<strong>Primarily hepatic metabolism</strong> — ไม่ต้องปรับ dose ตาม GFR<br>แต่ active metabolite อาจสะสมใน severe renal impairment → ระวัง sedation<br><strong>HD:</strong> 20-50% dialyzable — give supplement post-HD<br><strong>TDM:</strong> Target 15-40 mcg/mL',
    infoType:'blue',
    ref:'Lexicomp 2024 | Winter\'s Basic Clinical Pharmacokinetics'},

  // ── CHEMOTHERAPY ──
  {id:'methotrexate',name:'Methotrexate (High-dose)','class':'chemo',sub:'Antimetabolite',badges:['chemo','renal','nephrotox'],
    recommended:'Per protocol + aggressive hydration + leucovorin rescue',
    dosingTable:[
      {range:'≥60',dose:'Per protocol',freq:'Per protocol',note:'ต้อง hydrate + alkalinize urine'},
      {range:'<60',dose:'⚠ Hold/Reduce',freq:'—',note:'Delay until GFR ≥60'}
    ],
    info:'<strong>⚠ Nephrotoxic:</strong> MTX precipitates ใน renal tubules<br><strong>Mandatory:</strong> Aggressive hydration (3 L/m²/day) + Urine alkalinization (pH >7)<br><strong>Leucovorin rescue:</strong> ต้องให้ตาม MTX level protocol<br><strong>HD:</strong> High-flux HD หรือ CWHD อาจช่วยลด level ได้<br><strong>Monitor:</strong> MTX level, SCr q6-12h, CBC, LFTs',
    infoType:'red',
    ref:'Lexicomp 2024 | NCCN Guidelines | Howard SC, et al. NEJM 2016'},

  {id:'cisplatin',name:'Cisplatin','class':'chemo',sub:'Platinum',badges:['chemo','nephrotox'],
    recommended:'Per protocol + aggressive hydration',
    dosingTable:[
      {range:'≥60',dose:'Per protocol',freq:'Per cycle',note:'Pre/post hydration mandatory'},
      {range:'45–59',dose:'ลด 25%',freq:'Per cycle',note:'พิจารณา carboplatin'},
      {range:'<45',dose:'⚠ Contraindicated',freq:'—',note:'ใช้ carboplatin แทน'}
    ],
    info:'<strong>⚠ Highly nephrotoxic:</strong> Causes dose-dependent tubular injury<br><strong>Mandatory hydration:</strong> NSS 1-2 L pre/post + mannitol<br><strong>Alternative:</strong> Carboplatin (AUC-based, less nephrotoxic)<br><strong>Monitor:</strong> SCr, Mg++, K+, audiometry',
    infoType:'red',
    ref:'Lexicomp 2024 | NCCN Guidelines'},

  // ── MISCELLANEOUS ──
  {id:'allopurinol',name:'Allopurinol','class':'misc',sub:'Xanthine Oxidase Inhibitor',badges:['misc','renal'],
    recommended:'100-300 mg/day',
    dosingTable:[
      {range:'>60',dose:'100-300 mg',freq:'q24h',note:'Titrate to uric acid <6'},
      {range:'30–60',dose:'100-200 mg',freq:'q24h',note:''},
      {range:'15–30',dose:'100 mg',freq:'q24h',note:''},
      {range:'<15 / HD',dose:'100 mg',freq:'q48h',note:'Post-HD on dialysis days'}
    ],
    info:'<strong>Active metabolite Oxipurinol:</strong> สะสมใน renal impairment → เสี่ยง hypersensitivity syndrome<br><strong>HLA-B*5801:</strong> Screen ก่อนเริ่มยา (โดยเฉพาะ Thai/Asian) — ลด risk SJS/TEN<br><strong>HD:</strong> Dialyzable — give post-HD<br><strong>Alternative:</strong> Febuxostat (ไม่ต้องปรับ dose)',
    infoType:'amber',
    ref:'Lexicomp 2024 | ACR Gout Guidelines 2020'},

  {id:'metformin',name:'Metformin','class':'misc',sub:'Biguanide',badges:['misc','renal','avoid'],
    recommended:'500-1000 mg BID (max 2000 mg/day)',
    dosingTable:[
      {range:'≥45',dose:'500-1000 mg',freq:'BID',note:'Normal dose'},
      {range:'30–44',dose:'500 mg',freq:'BID (max 1000)',note:'⚠ ลด dose + monitor'},
      {range:'<30',dose:'⚠ Contraindicated',freq:'—',note:'Lactic acidosis risk'}
    ],
    info:'<strong>⚠ Lactic acidosis:</strong> Risk เพิ่มเมื่อ GFR <30<br><strong>GFR 30-44:</strong> ลด dose + ห้ามเริ่มยาใหม่ (ให้ต่อได้ถ้าใช้อยู่แล้ว)<br><strong>Hold:</strong> ก่อน contrast media, surgery, หรือ acute illness<br><strong>HD:</strong> Dialyzable — มี case reports ใช้ HD รักษา metformin-associated lactic acidosis',
    infoType:'red',
    ref:'Lexicomp 2024 | KDIGO Diabetes & CKD 2022 | FDA Label 2024'}
];

async function importCuratedRenal() {
  if (state.renalDrugs.length > 0) {
    if (!confirm('มีข้อมูลอยู่แล้ว ' + state.renalDrugs.length + ' รายการ\nระบบจะข้ามยาที่ซ้ำ — ต้องการ import CURATED ' + CURATED_RENAL_DRUGS.length + ' รายการ?')) return;
  } else {
    if (!confirm('Import ข้อมูล CURATED ' + CURATED_RENAL_DRUGS.length + ' ยา เข้าสู่ Google Sheets?')) return;
  }

  const drugs = CURATED_RENAL_DRUGS.map(d => ({
    id: d.id, name: d.name, 'class': d['class'], sub: d.sub,
    badges: d.badges, recommended: d.recommended,
    dosingTable: d.dosingTable, info: d.info, infoType: d.infoType, ref: d.ref
  }));

  showLoading('กำลัง import ' + drugs.length + ' ยา...');
  try {
    const cfg = getConfig();
    const postUrl = cfg.scriptUrl + '?action=bulkCreateRenalDrugs&user=' + encodeURIComponent(state.user?.email || 'unknown');
    const body = JSON.stringify({ action: 'bulkCreateRenalDrugs', user: state.user?.email || 'unknown', drugs: drugs });

    if (body.length < 6000) {
      const result = await apiCall('bulkCreateRenalDrugs', { drugs });
      toast('✅ Import สำเร็จ: เพิ่ม ' + result.created + ' ยา, ข้าม ' + result.skipped + ' ซ้ำ', 'success');
    } else {
      await fetch(postUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
      });
      await new Promise(r => setTimeout(r, 2500));
      toast('✅ ส่งข้อมูล import แล้ว — กำลังโหลดใหม่...', 'success');
    }
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
  if (tab === 'renal') loadRenalDrugs();
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
    exportDrugsJSON: function() { exportDrugsJSON(); },
    syncToGitHub: function() { syncToGitHub(); },
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
    // Renal dosing
    openRenalModal: function() { openRenalModal(); },
    closeRenalModal: function() { closeRenalModal(); },
    saveRenalDrug: function() { saveRenalDrug(); },
    editRenalDrug: function(e, t) { editRenalDrug(t.dataset.id); },
    deleteRenalDrug: function(e, t) { deleteRenalDrug(t.dataset.id); },
    renalGoPage: function(e, t) { renalGoPage(+t.dataset.page); },
    exportRenalCSV: function() { exportRenalCSV(); },
    importCuratedRenal: function() { importCuratedRenal(); },
    addRenalDosingRow: function() { addRenalDosingRow('', '', '', ''); },
    removeRenalDosingRow: function(e, t) { t.closest('.renal-dosing-row').remove(); },
    toggleRenalPreview: function(e, t) { toggleRenalPreview(t.dataset.preview === 'true'); }
  });
  IVDrugRef.delegate(document, 'input', {
    filterDrugs: function() { filterDrugs(); },
    filterCompat: function() { filterCompat(); },
    filterRenal: function() { filterRenal(); }
  });
  IVDrugRef.delegate(document, 'change', {
    filterDrugs: function() { filterDrugs(); },
    handleImportFile: function(e) { handleImportFile(e); },
    renderAuditLog: function() { renderAuditLog(); },
    filterCompat: function() { filterCompat(); },
    filterRenal: function() { filterRenal(); }
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
          '<td><span class="q-badge q-' + iss.severity + '">' + sevLabel[iss.severity] + '</span></td>' +
          '<td>' + iss.drugId + '</td>' +
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
        html += '<tr><td>' + d.drug.id + '</td><td><strong>' + escHtml(d.drug.generic || '') + '</strong></td>' +
          '<td style="font-weight:700;color:' + color + '">' + d.score + '%</td>' +
          '<td><div class="q-bar"><div class="q-bar-fill" style="width:' + d.score + '%;background:' + color + '"></div></div></td>' +
          '<td style="font-size:11px">' + d.missing.map(function(m) { return m.label; }).join(', ') + '</td></tr>';
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
          '<strong>#' + d.id + ' ' + escHtml(d.generic || '') + '</strong> ' +
          '<span class="badge badge-had">⚠ HAD</span> — ' +
          '<span style="color:var(--danger)">ขาด: ' + missingFields.join(', ') + '</span>' +
          ' <button class="btn btn-sm btn-outline" data-action="editDrug" data-id="' + d.id + '" style="margin-left:8px">✏️ แก้ไข</button></div>';
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
          dHtml += '<div class="q-dup-card">⚠ "<strong>' + escHtml(d.name) + '</strong>" — พบใน #' + d.id1 + ' และ #' + d.id2 + '</div>';
        });
      }
      if (dupTrade.length > 0) {
        dHtml += '<h4 style="font-size:12px;margin:8px 0 4px">Trade Name ซ้ำ:</h4>';
        dupTrade.forEach(function(d) {
          dHtml += '<div class="q-dup-card">⚠ "<strong>' + escHtml(d.name) + '</strong>" — พบใน #' + d.id1 + ' และ #' + d.id2 + '</div>';
        });
      }
      dupEl.innerHTML = dHtml;
    }
  }
}

})();
