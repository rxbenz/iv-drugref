'use strict';
// ============================================================
// Offline drug snapshot — regenerated from Supabase at build time
//
// drugs-data.json is what the app renders on first paint and offline
// (js/index.js: cache → this file → Supabase sync). It was committed once and
// then drifted: by v5.70.0 it still flagged a drug as HIGH-ALERT that the admin
// panel had un-flagged months earlier. The build now refreshes it from the same
// public-read table the app syncs from, so the bundled fallback ships current.
//
// Refusing a bad refresh matters more than refreshing. A truncated, empty or
// malformed response must never overwrite a good snapshot — this is the dataset
// users see with no network — so validateSnapshot() holds the fetch to a floor
// relative to the committed file, and the build keeps the committed copy
// whenever the fetch cannot be trusted.
// ============================================================

// Same host + publishable (anon) key the client already carries in js/index.js.
// Public-read only; the sb_secret_… key must never appear here.
const SUPABASE_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';

// Mirrors the app's own read (js/index.js fetchDrugsFromServer). The explicit
// limit is well above the ~166-drug table so a silent PostgREST page cap would
// have to shrink the result enough for the floor check below to catch it.
const DEFAULT_ENDPOINT =
  SUPABASE_URL + '/rest/v1/drugs?select=data&status=eq.approved&order=id.asc&limit=5000';

// A refresh must carry at least this share of the committed snapshot's drugs.
// Catches truncation and an accidentally-emptied table; a real deletion of more
// than 10% of the formulary is rare enough to be worth a manual snapshot commit.
const MIN_RATIO = 0.9;

// Edit history / editor identity must never reach a public file. The GAS sync
// already strips these before upsert; stripped again here so the artifact is
// safe no matter what upstream stored.
const PUBLIC_STRIP = ['previousData', 'createdBy', 'updatedBy', 'updatedAt'];

/**
 * Stable order: by NUMERIC id — the order the committed snapshot already has
 * (1 = Abciximab … 166 = Pembrolizumab; newer drugs are appended, not merged
 * alphabetically). js/index.js renders DRUGS in array order, so sorting by name
 * instead would silently reorder the app's list and push the drugs whose names
 * start with a digit ("20% Mannitol", "3% NaCl") to the top of the first page.
 */
function byId(a, b) {
  // Number(null) and Number('') are 0, which would sort an id-less row to the
  // very front — treat anything blank as "no id" instead.
  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const ai = num(a.id);
  const bi = num(b.id);
  const aNum = Number.isFinite(ai);
  const bNum = Number.isFinite(bi);
  if (aNum && bNum && ai !== bi) return ai - bi;
  if (aNum !== bNum) return aNum ? -1 : 1;  // rows with an unusable id sort last
  return String(a.generic).localeCompare(String(b.generic), 'en');
}

/**
 * Turn PostgREST rows into the snapshot array, or refuse them.
 * `rows` may be [{data:{…}}] (what the endpoint returns) or bare drug objects.
 * `baselineCount` is the committed snapshot's drug count; pass 0 when unknown.
 * → { ok:true, drugs, dropped } | { ok:false, reason }
 */
function validateSnapshot(rows, baselineCount = 0) {
  if (!Array.isArray(rows)) return { ok: false, reason: 'response was not an array' };
  if (!rows.length) return { ok: false, reason: 'response was empty' };

  let dropped = 0;
  const drugs = [];
  for (const row of rows) {
    const d = (row && typeof row === 'object' && !Array.isArray(row) && 'data' in row) ? row.data : row;
    // `generic` is what the app keys every card off — a row without it is unusable.
    if (!d || typeof d !== 'object' || typeof d.generic !== 'string' || !d.generic.trim()) {
      dropped++;
      continue;
    }
    const clean = Object.assign({}, d);
    for (const k of PUBLIC_STRIP) delete clean[k];
    drugs.push(clean);
  }

  if (!drugs.length) return { ok: false, reason: 'no usable drug objects in the response' };

  const floor = Math.floor(baselineCount * MIN_RATIO);
  if (baselineCount > 0 && drugs.length < floor) {
    return {
      ok: false,
      reason: `only ${drugs.length} drugs vs ${baselineCount} in the committed snapshot (need ≥ ${floor})`,
    };
  }

  drugs.sort(byId);
  return { ok: true, drugs, dropped };
}

/**
 * Read the approved drugs from Supabase.
 * Never throws — a build must not die on someone else's outage.
 * → { ok:true, rows } | { ok:false, reason }
 */
async function fetchApprovedDrugs(opts = {}) {
  const fetchImpl = opts.fetch || globalThis.fetch;
  const timeoutMs = opts.timeoutMs || 15000;
  // DRUG_SNAPSHOT_ENDPOINT lets a test (or a staging project) point the refresh
  // somewhere else. Whatever it returns still has to clear validateSnapshot().
  const endpoint = opts.endpoint || process.env.DRUG_SNAPSHOT_ENDPOINT || DEFAULT_ENDPOINT;

  if (typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'fetch is unavailable in this Node runtime' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true, rows: await res.json() };
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
    return { ok: false, reason: aborted ? `timed out after ${timeoutMs}ms` : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  validateSnapshot,
  fetchApprovedDrugs,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DEFAULT_ENDPOINT,
  MIN_RATIO,
  PUBLIC_STRIP,
};
