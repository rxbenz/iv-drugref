// ============================================================
// line-webhook · messages.mjs   (PURE — no Deno/Node/DOM APIs)
// Message builders for the LINE bot. Imported by BOTH the Deno function
// (index.ts) and node --test (test/line-messages.test.js) so the CI test
// gate covers exactly what ships.
//
// CLINICAL SAFETY: the bot is REFERENCE-LOOKUP ONLY. Every reply carries
// DISCLAIMER and the bot never performs dose/TDM calculation — those live
// in the app behind the pediatric guard. Locked by test/line-messages.test.js.
// ============================================================

export const APP_BASE = 'https://rxbenz.github.io/iv-drugref';

// Shown on every bot reply.
export const DISCLAIMER =
  '⚠️ ข้อมูลอ้างอิงเบื้องต้นสำหรับบุคลากรทางการแพทย์เท่านั้น ' +
  'โปรดตรวจสอบกับแหล่งอ้างอิงหลักก่อนใช้กับผู้ป่วย · ' +
  'บอทไม่คำนวณขนาดยา — เครื่องมือคำนวณอยู่ในแอป';

// Build a full app URL (reuses the app's existing deep-link params, e.g.
// index.html?search=… / index.html?drug=…).
export function appLink(pathAndQuery = '') {
  return pathAndQuery ? `${APP_BASE}/${pathAndQuery}` : APP_BASE;
}

// How-to text shared by the help + greeting replies.
const HOW_TO =
  'พิมพ์เพื่อค้นข้อมูลยา IV (อ้างอิงเท่านั้น):\n' +
  '• ชื่อยา — เช่น "meropenem"\n' +
  '• "ยา A + ยา B" — เช็คการเข้ากันได้ (Y-site)\n' +
  '• "ไต <ชื่อยา>" — ขนาดยาในผู้ป่วยไต';

// Reply to help/menu requests (and non-drug intents until Phase 4).
export function buildHelp() {
  const text = HOW_TO + '\n\nเปิดแอปเต็ม: ' + APP_BASE + '\n\n' + DISCLAIMER;
  return [{ type: 'text', text }];
}

// Reply when a user adds the OA as a friend (LINE "follow" event).
export function buildGreeting() {
  const text =
    'สวัสดีค่ะ 🙌 นี่คือผู้ช่วยค้นข้อมูลยา IV DrugRef\n\n' +
    HOW_TO + '\n\nหรือกดเมนูด้านล่าง / เปิดแอปเต็ม: ' + APP_BASE + '\n\n' + DISCLAIMER;
  return [{ type: 'text', text }];
}

// ---------- Phase 3: drug lookup replies ----------

// Coerce a drug field to a clean display string ('' for missing / "-" placeholders).
function asText(v) {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  const t = s.trim();
  return (t === '' || t === '-') ? '' : t;
}

// A label/value row inside the Flex card.
function kvRow(label, value) {
  return {
    type: 'box', layout: 'baseline', spacing: 'sm',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#8a8a8a', flex: 2, wrap: true },
      { type: 'text', text: value, size: 'sm', color: '#111111', flex: 5, wrap: true },
    ],
  };
}

// A Flex bubble for one drug — same admin-verified reference fields the app shows.
// Footer button deep-links to the full app card (index.html?drug=…).
export function buildDrugFlex(drug) {
  const g = asText(drug.generic) || 'ยา';
  const reconst = drug.reconst || {};
  const dilution = drug.dilution || {};
  const admin = drug.admin || {};
  const compat = drug.compat || {};

  const rows = [];
  const strength = asText(drug.strength);
  const solvent = asText(reconst.solvent);
  const rvol = asText(reconst.volume);
  const diluent = asText(dilution.diluent);
  const finalConc = asText(dilution.finalConc);
  const rate = asText(admin.rate);
  const incompat = asText(compat.incompat);

  if (strength) rows.push(kvRow('ความแรง', strength));
  if (solvent) rows.push(kvRow('การผสม', solvent + (rvol ? ' • ' + rvol : '')));
  if (diluent || finalConc) rows.push(kvRow('เจือจาง', [diluent, finalConc].filter(Boolean).join(' → ')));
  if (rate) rows.push(kvRow('อัตราให้ยา', rate));

  const body = [
    { type: 'text', text: g, weight: 'bold', size: 'xl', wrap: true, color: '#0e7490' },
  ];
  const trade = asText(drug.trade);
  if (trade) body.push({ type: 'text', text: trade, size: 'xs', color: '#8a8a8a', wrap: true });
  if (drug.had) {
    body.push({ type: 'text', text: '⚠️ ยาความเสี่ยงสูง (High-Alert)', size: 'xs', weight: 'bold', color: '#b91c1c', margin: 'sm' });
  }
  body.push({ type: 'separator', margin: 'md' });
  if (rows.length) {
    body.push({ type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: rows });
  } else {
    body.push({ type: 'text', text: 'ดูรายละเอียดในแอป', size: 'sm', color: '#8a8a8a', margin: 'md' });
  }
  if (incompat) {
    body.push({
      type: 'box', layout: 'vertical', margin: 'md', paddingAll: 'sm',
      backgroundColor: '#fef2f2', cornerRadius: 'md',
      contents: [{ type: 'text', text: '⚠️ ห้ามผสม: ' + incompat, size: 'xs', color: '#b91c1c', wrap: true }],
    });
  }
  body.push({ type: 'separator', margin: 'md' });
  body.push({ type: 'text', text: DISCLAIMER, size: 'xxs', color: '#9a9a9a', wrap: true, margin: 'md' });

  return {
    type: 'flex',
    altText: g + ' — ข้อมูลยา IV (อ้างอิง)',
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', contents: body },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary', color: '#0e7490', height: 'sm',
          action: { type: 'uri', label: 'เปิดในแอป', uri: appLink('index.html?drug=' + encodeURIComponent(g)) },
        }],
      },
    },
  };
}

// Ambiguous / typo → a text message with tappable candidate buttons (each taps
// back the exact generic name so the next round resolves to a single card).
export function buildSuggestions(query, candidates) {
  const names = (candidates || []).map((d) => asText(d && d.generic)).filter(Boolean).slice(0, 3);
  const items = names.map((n) => ({
    type: 'action', action: { type: 'message', label: n.slice(0, 20), text: n },
  }));
  const text = 'ไม่แน่ใจว่าหมายถึงตัวไหน — เลือกได้เลย 👇\n(คุณพิมพ์: "' + query + '")';
  return { type: 'text', text, quickReply: { items } };
}

// No match → point the user at the app's search (which has its own fallback data).
export function buildNotFound(query) {
  const text =
    'ไม่พบยา "' + query + '" 🔎\n' +
    'ลองพิมพ์ชื่อสามัญเป็นภาษาอังกฤษ หรือค้นในแอป:\n' +
    appLink('index.html?search=' + encodeURIComponent(query)) + '\n\n' + DISCLAIMER;
  return { type: 'text', text };
}

// ---------- Phase 4: Y-site pair result + renal note ----------

// result code (js/compatibility.js): c=compatible, i=incompatible, v=variable
const COMPAT_STYLE = {
  c: { emoji: '✅', label: 'เข้ากันได้ (Y-site)', color: '#15803d', bg: '#f0fdf4' },
  i: { emoji: '❌', label: 'ไม่เข้ากัน — ห้ามให้ร่วมสาย/ผสม', color: '#b91c1c', bg: '#fef2f2' },
  v: { emoji: '⚠️', label: 'ข้อมูลแปรผัน — โปรดตรวจสอบ/ระวัง', color: '#b45309', bg: '#fffbeb' },
};
const COMPAT_NONE = { emoji: '❔', label: 'ไม่มีข้อมูลคู่นี้โดยตรง', color: '#6b7280', bg: '#f3f4f6' };

// Flex result for an "A + B" Y-site compatibility check. `code` = 'c'|'i'|'v'|null.
export function buildPairResult(nameA, nameB, code) {
  const st = COMPAT_STYLE[code] || COMPAT_NONE;
  const pairText = nameA + ' + ' + nameB;
  const uri = appLink('compatibility.html?a=' + encodeURIComponent(nameA) + '&b=' + encodeURIComponent(nameB));
  const contents = [
    {
      type: 'box', layout: 'vertical', paddingAll: 'md', backgroundColor: st.bg, cornerRadius: 'md',
      contents: [{ type: 'text', text: st.emoji + ' ' + st.label, weight: 'bold', size: 'md', color: st.color, wrap: true }],
    },
    { type: 'text', text: pairText, size: 'sm', color: '#111111', wrap: true, margin: 'md' },
  ];
  if (code === 'v' || !code) {
    contents.push({ type: 'text', text: 'ดูรายละเอียด/ทางเลือกยาที่เข้ากันได้ในแอป', size: 'xs', color: '#6b7280', wrap: true, margin: 'sm' });
  }
  contents.push({ type: 'separator', margin: 'md' });
  contents.push({ type: 'text', text: DISCLAIMER, size: 'xxs', color: '#9a9a9a', wrap: true, margin: 'md' });
  return {
    type: 'flex',
    altText: pairText + ' — ' + st.label,
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary', color: '#0e7490', height: 'sm',
          action: { type: 'uri', label: 'เปิดในแอป', uri },
        }],
      },
    },
  };
}

// "ไต X" → the bot does NOT compute renal doses (weight + GFR dependent);
// it routes to the app's renal calculator. Keeps the reference-lookup contract.
export function buildRenalNote(generic) {
  const text =
    '🧪 การปรับขนาดยา "' + generic + '" ในผู้ป่วยไตขึ้นกับ น้ำหนัก + ค่าการทำงานของไต (GFR) ' +
    'ของผู้ป่วยแต่ละราย — บอทไม่คำนวณให้ (ความปลอดภัย)\n\n' +
    'เปิดในแอปเพื่อใส่ค่าแล้วคำนวณ:\n' +
    appLink('renal-dosing.html?drug=' + encodeURIComponent(generic)) + '\n\n' + DISCLAIMER;
  return { type: 'text', text };
}
