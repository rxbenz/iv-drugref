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
