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
// index.html?search=… / compatibility.html?drug=…). Used by Phase 3+.
export function appLink(pathAndQuery = '') {
  return pathAndQuery ? `${APP_BASE}/${pathAndQuery}` : APP_BASE;
}

// How-to text shared by the help + greeting replies.
const HOW_TO =
  'พิมพ์เพื่อค้นข้อมูลยา IV (อ้างอิงเท่านั้น):\n' +
  '• ชื่อยา — เช่น "meropenem"\n' +
  '• "ยา A + ยา B" — เช็คการเข้ากันได้ (Y-site)\n' +
  '• "ไต <ชื่อยา>" — ขนาดยาในผู้ป่วยไต';

// Reply to any text message. Phase 2 skeleton always returns this menu;
// Phase 3 replaces the text-message path with real drug lookup.
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
