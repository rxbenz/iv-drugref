// ============================================================
// line-webhook · matcher.mjs   (PURE — no Deno/Node/DOM APIs)
// Drug-name matching + message parsing for the LINE bot. Imported by BOTH
// index.ts (Deno) and node --test (test/line-matcher.test.js).
//
// This is NAME LOOKUP (free text → a drug in the `drugs` table). It borrows
// the normalization idea from js/compatibility.js (compare on lowercase
// alphanumerics) but is simpler than that file's salt-aware pair-key matching
// (normKey/keyCandidates). Ambiguity (e.g. "calcium" → gluconate vs chloride)
// is surfaced as SUGGESTIONS, never guessed — a clinical-safety choice.
// ============================================================

// Normalize for loose comparison: lowercase, keep a–z / 0–9 / Thai, drop the rest.
export function normKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9฀-๿]+/g, '');
}

// Levenshtein edit distance (used only on short drug-name keys → typo tolerance).
export function levenshtein(a, b) {
  a = String(a); b = String(b);
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Parse a chat message into an intent.
// Phase 3 handles 'drug' + 'help'; 'pair' / 'renal' are parsed here (pre-wired)
// and get their handlers in Phase 4.
export function parseMessage(text) {
  const t = String(text || '').trim();
  if (!t) return { kind: 'help' };
  const low = t.toLowerCase();
  if (['help', 'menu', 'เมนู', 'ช่วยเหลือ', 'ยา', '?'].includes(low)) return { kind: 'help' };
  const renal = t.match(/^(?:ไต|renal)\s+(.+)$/i);
  if (renal) return { kind: 'renal', query: renal[1].trim() };
  const parts = t.split(/\s*(?:\+|กับ)\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 2) return { kind: 'pair', a: parts[0], b: parts[1] };
  return { kind: 'drug', query: t };
}

// Split a (possibly verbose) trade string into comparable tokens.
function tradeKeys(trade) {
  return String(trade || '')
    .split(/[,/;()]+/)
    .map(normKey)
    .filter((k) => k.length >= 3);
}

// Match a free-text query to a drug. Returns one of:
//   { status:'found',  drug }              exactly one confident match
//   { status:'suggest', candidates:[…≤3] } ambiguous / typo — let the user pick
//   { status:'none' }                      nothing close
export function matchDrug(query, drugs) {
  const qk = normKey(query);
  if (!qk || !Array.isArray(drugs) || !drugs.length) return { status: 'none' };

  const exact = [], prefix = [], sub = [];
  for (const d of drugs) {
    if (!d || !d.generic) continue;
    const gk = normKey(d.generic);
    if (gk === qk) { exact.push(d); continue; }
    if (qk.length >= 3 && gk.startsWith(qk)) { prefix.push(d); continue; }
    if (qk.length >= 4 && (gk.includes(qk) || tradeKeys(d.trade).some((tk) => tk.includes(qk)))) {
      sub.push(d);
    }
  }
  if (exact.length === 1) return { status: 'found', drug: exact[0] };
  if (exact.length > 1) return { status: 'suggest', candidates: exact.slice(0, 3) };
  const near = prefix.length ? prefix : sub;
  if (near.length === 1) return { status: 'found', drug: near[0] };
  if (near.length > 1) return { status: 'suggest', candidates: near.slice(0, 3) };

  // Fuzzy typo tolerance on the generic key (only for reasonably long queries).
  if (qk.length < 4) return { status: 'none' };
  const fuzzy = [];
  for (const d of drugs) {
    if (!d || !d.generic) continue;
    const dist = levenshtein(qk, normKey(d.generic));
    if (dist <= 2) fuzzy.push({ d, dist });
  }
  fuzzy.sort((a, b) => a.dist - b.dist);
  if (fuzzy.length) return { status: 'suggest', candidates: fuzzy.slice(0, 3).map((x) => x.d) };
  return { status: 'none' };
}
