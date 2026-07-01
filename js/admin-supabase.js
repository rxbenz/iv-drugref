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

  // ---- Renal reference data (renal_drugs) ----------------------------------
  // Row shape: { id (text PK), name (text), data (jsonb = full drug object) }.
  // The public renal page (renal-dosing.js applyRenalRemote) reads `data`, so we
  // always store the complete object there.
  function _toData(drug) {
    return {
      id: drug.id, name: drug.name, 'class': drug['class'] || '', sub: drug.sub || '',
      badges: _arr(drug.badges),
      recommended: drug.recommended || '',
      dosingTable: _arr(drug.dosingTable),
      info: drug.info || '', infoType: drug.infoType || 'blue', ref: drug.ref || ''
    };
  }
  // Tolerant array parse — legacy rows (synced by the old GAS path) may store
  // badges/dosingTable as JSON STRINGS instead of arrays. Mirror renal-dosing.js
  // rdParse so the admin table/modal (and any re-save) never lose that data.
  function _arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    return [];
  }
  function _fromRow(row) {
    var d = row.data || {};
    return {
      id: row.id, name: row.name || d.name || '', 'class': d['class'] || '',
      sub: d.sub || '', badges: _arr(d.badges),
      recommended: d.recommended || '',
      dosingTable: _arr(d.dosingTable),
      info: d.info || '', infoType: d.infoType || 'blue', ref: d.ref || ''
    };
  }

  async function getRenalDrugs() {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    var r = await c.from('renal_drugs').select('id,name,data').order('id', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    return (r.data || []).map(_fromRow);
  }

  async function upsertRenalDrug(drug) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    var r = await c.from('renal_drugs')
      .upsert({ id: drug.id, name: drug.name, data: _toData(drug) }, { onConflict: 'id' });
    if (r.error) throw new Error(r.error.message);
    return true;
  }

  async function deleteRenalDrug(id) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    var r = await c.from('renal_drugs').delete().eq('id', id);
    if (r.error) throw new Error(r.error.message);
    return true;
  }

  async function bulkUpsertRenalDrugs(drugs) {
    var c = client(); if (!c) throw new Error('Supabase ยังไม่โหลด');
    var rows = (drugs || []).map(function (d) {
      return { id: d.id, name: d.name, data: _toData(d) };
    });
    if (!rows.length) return 0;
    var r = await c.from('renal_drugs').upsert(rows, { onConflict: 'id' });
    if (r.error) throw new Error(r.error.message);
    return rows.length;
  }

  window.AdminSupabase = {
    available: available, client: client,
    session: session, isAdmin: isAdmin, adminCheckErrored: adminCheckErrored, status: status,
    signInWithGoogleIdToken: signInWithGoogleIdToken, connect: connect, signOut: signOut,
    getRenalDrugs: getRenalDrugs, upsertRenalDrug: upsertRenalDrug,
    deleteRenalDrug: deleteRenalDrug, bulkUpsertRenalDrugs: bulkUpsertRenalDrugs
  };
})();
