// ============================================================================
// Admin ↔ Supabase bridge — Phase A (Renal reference data writes direct to
// Supabase, no GAS). Reuses the public app's publishable (anon) key for READS
// (renal_drugs is public-read). WRITES require a Supabase Auth session whose
// Google email is in the `admins` allowlist — RLS enforces `is_admin()`.
//
// Auth strategy (least-friction, degrade gracefully):
//   1. Reuse any existing Supabase session (e.g. from the dashboard, same origin).
//   2. Best-effort: exchange the admin's Google GIS id_token for a Supabase
//      session via signInWithIdToken — NO extra login/redirect. Works only if the
//      Supabase Google provider lists this app's GIS client id as authorized.
//   3. Fallback: connect() → signInWithOAuth(google) (the proven dashboard
//      redirect flow) when the id_token path isn't available.
// Reads never need auth; only writes do. Everything is scoped to Renal for now.
// ============================================================================
(function () {
  'use strict';

  var SB_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';
  var SB_KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';
  var _client = null;
  var _adminOk = null;   // cached is_admin() result (null = unknown)
  var _adminErr = false; // true when the last is_admin() check ERRORED (vs a clean false)

  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient) return null;
    _client = window.supabase.createClient(SB_URL, SB_KEY);
    return _client;
  }
  function available() { return !!client(); }

  // ---- Auth ----------------------------------------------------------------
  async function session() {
    var c = client(); if (!c) return null;
    try { var r = await c.auth.getSession(); return (r && r.data && r.data.session) || null; }
    catch (e) { return null; }
  }

  // Returns true/false on a DEFINITIVE result; on an RPC/network error returns
  // false but sets _adminErr so callers can show a retryable message instead of
  // misreporting a real admin as "not in allowlist". Errors are NOT cached.
  async function isAdmin(force) {
    var c = client(); if (!c) { _adminErr = false; return false; }
    if (_adminOk !== null && !force) { _adminErr = false; return _adminOk; }
    _adminErr = false;
    try {
      var r = await c.rpc('is_admin');
      if (r.error) { _adminErr = true; return false; }   // don't cache an errored check
      _adminOk = r.data === true;
    } catch (e) { _adminErr = true; return false; }
    return _adminOk;
  }
  function adminCheckErrored() { return _adminErr; }

  // Seamless: turn a Google GIS credential (id_token) into a Supabase session
  // without a redirect. No-throw; returns true only on success.
  async function signInWithGoogleIdToken(idToken) {
    var c = client(); if (!c || !idToken) return false;
    try {
      var r = await c.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (r && r.data && r.data.session) { _adminOk = null; return true; }
    } catch (e) { /* provider not configured for id_token → use connect() */ }
    return false;
  }

  // Redirect-based OAuth fallback (same pattern the dashboard uses).
  async function connect() {
    var c = client(); if (!c) throw new Error('ไลบรารี Supabase ยังไม่โหลด');
    await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } });
  }

  async function signOut() {
    var c = client(); if (!c) return;
    try { await c.auth.signOut(); } catch (e) { /* ignore */ }
    _adminOk = null;
  }

  // Combined status for the UI: {available, signedIn, email, isAdmin, adminError}.
  // adminError=true means the is_admin() check couldn't be completed (network/RPC)
  // — distinct from a definitive isAdmin:false (email not in the allowlist).
  async function status() {
    if (!available()) return { available: false, signedIn: false, email: '', isAdmin: false, adminError: false };
    var s = await session();
    if (!s) return { available: true, signedIn: false, email: '', isAdmin: false, adminError: false };
    var admin = await isAdmin(true);
    return { available: true, signedIn: true, email: (s.user && s.user.email) || '', isAdmin: admin, adminError: adminCheckErrored() };
  }

  // ---- Generic table CRUD (Phase B) ----------------------------------------
  // All admin-managed reference tables share the {pk + data jsonb} shape with
  // public-read / admin-write RLS. One set of primitives serves them all; the
  // per-table wrappers below just reshape to/from each table's `data` object.
  var TABLE_PK = {
    renal_drugs: 'id', compat_pairs: 'id', ddi_pairs: 'id',
    ddi_class_rules: 'id', allergy_groups: 'id', allergy_refs: 'key'
  };

  // Tolerant array parse — legacy rows may store arrays as JSON STRINGS.
  function _arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    return [];
  }

  async function getRows(table, opts) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    opts = opts || {};
    var pk = TABLE_PK[table] || 'id';
    var r = await c.from(table).select(opts.select || ('' + pk + ',data'))
      .order(opts.orderBy || pk, { ascending: opts.ascending !== false });
    if (r.error) throw new Error(r.error.message);
    return r.data || [];
  }

  // row = { pk, data, name?, extra? } — extra merges helper columns (drug_a, a, keyword…)
  async function upsertRow(table, row) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    var pkCol = TABLE_PK[table]; if (!pkCol) throw new Error('ตารางไม่รู้จัก: ' + table);
    var payload = row.extra ? Object.assign({}, row.extra) : {};
    payload[pkCol] = row.pk;
    if (row.name !== undefined) payload.name = row.name;
    if (row.data !== undefined) payload.data = row.data;
    var r = await c.from(table).upsert(payload, { onConflict: pkCol });
    if (r.error) throw new Error(r.error.message);
    return true;
  }

  async function deleteRow(table, pkVal) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    var pkCol = TABLE_PK[table] || 'id';
    var r = await c.from(table).delete().eq(pkCol, pkVal);
    if (r.error) throw new Error(r.error.message);
    return true;
  }

  async function bulkUpsert(table, rows) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    if (!rows || !rows.length) return 0;
    var pkCol = TABLE_PK[table]; if (!pkCol) throw new Error('ตารางไม่รู้จัก: ' + table);
    var r = await c.from(table).upsert(rows, { onConflict: pkCol });
    if (r.error) throw new Error(r.error.message);
    return rows.length;
  }

  // ---- Renal (renal_drugs) — Phase A, now thin wrappers over the generic API -
  function _renalToData(drug) {
    return {
      id: drug.id, name: drug.name, 'class': drug['class'] || '', sub: drug.sub || '',
      badges: _arr(drug.badges), recommended: drug.recommended || '',
      dosingTable: _arr(drug.dosingTable), info: drug.info || '',
      infoType: drug.infoType || 'blue', ref: drug.ref || ''
    };
  }
  function _renalFromRow(row) {
    var d = row.data || {};
    return {
      id: row.id, name: row.name || d.name || '', 'class': d['class'] || '', sub: d.sub || '',
      badges: _arr(d.badges), recommended: d.recommended || '', dosingTable: _arr(d.dosingTable),
      info: d.info || '', infoType: d.infoType || 'blue', ref: d.ref || ''
    };
  }
  async function getRenalDrugs() { return (await getRows('renal_drugs', { select: 'id,name,data' })).map(_renalFromRow); }
  async function upsertRenalDrug(drug) { return upsertRow('renal_drugs', { pk: drug.id, name: drug.name, data: _renalToData(drug) }); }
  async function deleteRenalDrug(id) { return deleteRow('renal_drugs', id); }
  async function bulkUpsertRenalDrugs(drugs) {
    return bulkUpsert('renal_drugs', (drugs || []).map(function (d) { return { id: d.id, name: d.name, data: _renalToData(d) }; }));
  }

  // ---- Compatibility pairs (compat_pairs) ----------------------------------
  // Public reader (compatibility.js) reshapes row.data → [drugA, drugB, result].
  async function getCompatPairs() {
    return (await getRows('compat_pairs', { select: 'id,data' })).map(function (row) {
      var d = row.data || {};
      return { id: row.id, drugA: d.drugA || '', drugB: d.drugB || '', result: d.result || 'c', ref: d.ref || '' };
    });
  }
  async function upsertCompatPair(p) {
    var data = { id: String(p.id), drugA: p.drugA || '', drugB: p.drugB || '', result: p.result || 'c', ref: p.ref || '' };
    return upsertRow('compat_pairs', { pk: String(p.id), extra: { drug_a: p.drugA || '', drug_b: p.drugB || '' }, data: data });
  }
  async function deleteCompatPair(id) { return deleteRow('compat_pairs', String(id)); }
  async function bulkUpsertCompatPairs(pairs) {
    return bulkUpsert('compat_pairs', (pairs || []).map(function (p) {
      return { id: String(p.id), drug_a: p.drugA || '', drug_b: p.drugB || '',
        data: { id: String(p.id), drugA: p.drugA || '', drugB: p.drugB || '', result: p.result || 'c', ref: p.ref || '' } };
    }));
  }

  // ---- DDI pairs + class rules (ddi_pairs / ddi_class_rules) ----------------
  // Public reader (drug-interactions.js) expects data.aAny/bAny as ARRAYS and
  // classes as an ARRAY — mirror gas-complete.js _syncDDI* reshaping exactly.
  async function getDDIPairs() {
    return (await getRows('ddi_pairs', { select: 'id,data' })).map(function (row) {
      var d = row.data || {};
      return { id: row.id, a: d.a || '', aAny: _arr(d.aAny), b: d.b || '', bAny: _arr(d.bAny),
        severity: d.severity || 'major', mechanism: d.mechanism || '', management: d.management || '', ref: d.ref || '' };
    });
  }
  function _ddiPairData(p) {
    var aAny = _arr(p.aAny), bAny = _arr(p.bAny);
    var d = { severity: p.severity || 'major', mechanism: p.mechanism || '', management: p.management || '', ref: p.ref || '' };
    if (aAny.length) d.aAny = aAny; else if (p.a) d.a = String(p.a).toLowerCase().trim();
    if (bAny.length) d.bAny = bAny; else if (p.b) d.b = String(p.b).toLowerCase().trim();
    return d;
  }
  async function upsertDDIPair(p) {
    return upsertRow('ddi_pairs', { pk: String(p.id), extra: { a: p.a || '', b: p.b || '' }, data: _ddiPairData(p) });
  }
  async function deleteDDIPair(id) { return deleteRow('ddi_pairs', String(id)); }
  async function bulkUpsertDDIPairs(pairs) {
    return bulkUpsert('ddi_pairs', (pairs || []).map(function (p) {
      return { id: String(p.id), a: p.a || '', b: p.b || '', data: _ddiPairData(p) };
    }));
  }
  async function getDDIClassRules() {
    return (await getRows('ddi_class_rules', { select: 'id,data' })).map(function (row) {
      var d = row.data || {};
      return { id: row.id, keyword: d.keyword || '', classes: _arr(d.classes) };
    });
  }
  function _ddiRuleData(r) {
    var kw = String(r.keyword || '').toLowerCase().trim();
    var classes = _arr(r.classes);
    if (!classes.length) classes = String(r.classes || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return { keyword: kw, classes: classes };
  }
  async function upsertDDIClassRule(r) {
    var d = _ddiRuleData(r);
    return upsertRow('ddi_class_rules', { pk: String(r.id), extra: { keyword: d.keyword }, data: d });
  }
  async function deleteDDIClassRule(id) { return deleteRow('ddi_class_rules', String(id)); }
  async function bulkUpsertDDIClassRules(rules) {
    return bulkUpsert('ddi_class_rules', (rules || []).map(function (r) {
      var d = _ddiRuleData(r);
      return { id: String(r.id), keyword: d.keyword, data: d };
    }));
  }

  window.AdminSupabase = {
    available: available, client: client,
    session: session, isAdmin: isAdmin, adminCheckErrored: adminCheckErrored, status: status,
    signInWithGoogleIdToken: signInWithGoogleIdToken, connect: connect, signOut: signOut,
    // generic
    getRows: getRows, upsertRow: upsertRow, deleteRow: deleteRow, bulkUpsert: bulkUpsert,
    // renal (Phase A)
    getRenalDrugs: getRenalDrugs, upsertRenalDrug: upsertRenalDrug,
    deleteRenalDrug: deleteRenalDrug, bulkUpsertRenalDrugs: bulkUpsertRenalDrugs,
    // compat (Phase B)
    getCompatPairs: getCompatPairs, upsertCompatPair: upsertCompatPair,
    deleteCompatPair: deleteCompatPair, bulkUpsertCompatPairs: bulkUpsertCompatPairs,
    // ddi (Phase B)
    getDDIPairs: getDDIPairs, upsertDDIPair: upsertDDIPair, deleteDDIPair: deleteDDIPair,
    bulkUpsertDDIPairs: bulkUpsertDDIPairs,
    getDDIClassRules: getDDIClassRules, upsertDDIClassRule: upsertDDIClassRule,
    deleteDDIClassRule: deleteDDIClassRule, bulkUpsertDDIClassRules: bulkUpsertDDIClassRules
  };
})();
