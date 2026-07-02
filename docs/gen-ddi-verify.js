// Generate a DDI verification document (HTML) from js/drug-interactions.js defaults.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = require('path').join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/drug-interactions.js'), 'utf8');

const sandbox = { window: {}, console: { log() {} } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox); // no fetch in sandbox → loadRemote never auto-runs

const DI = sandbox.window.DrugInteractions;
const CLASS_DEFS = DI._CLASS_DEFS;
const CLASS_RULES = DI._CLASS_RULES_SEED; // [keyword, classes[]]
const CURATED = DI._CURATED;

// ---- Merge duplicate keywords (union classes) ----
const kwMap = new Map();
for (const [kw, cls] of CLASS_RULES) {
  if (!kwMap.has(kw)) kwMap.set(kw, new Set());
  cls.forEach(c => kwMap.get(kw).add(c));
}

// members per class
const classMembers = {};
Object.keys(CLASS_DEFS).forEach(c => classMembers[c] = []);
for (const [kw, set] of kwMap) for (const c of set) classMembers[c].push(kw);

const SEV_TH = { contraindicated: 'ห้ามใช้ร่วม', major: 'รุนแรง (Major)', moderate: 'ปานกลาง (Moderate)', minor: 'เล็กน้อย (Minor)' };
const SEV_COLOR = { contraindicated: '#dc2626', major: '#ea580c', moderate: '#ca8a04', minor: '#64748b' };

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sevBadge = s => `<span class="sev" style="color:${SEV_COLOR[s]};border-color:${SEV_COLOR[s]}">${SEV_TH[s] || s}</span>`;
// Real, clickable checkbox with a stable key (state persists via localStorage).
const chk = k => `<input type="checkbox" class="vchk" data-k="${esc(k)}">`;

// ---- Stats ----
const nRules = CLASS_RULES.length, nKw = kwMap.size, nPairs = CURATED.length, nClasses = Object.keys(CLASS_DEFS).length;

// ---- Section 1: class definitions ----
let s1 = `<table><thead><tr><th style="width:28px">✓</th><th>Class</th><th>ระดับ</th><th>กลไก</th><th>การจัดการ</th><th>อ้างอิง</th></tr></thead><tbody>`;
for (const [key, d] of Object.entries(CLASS_DEFS)) {
  s1 += `<tr><td class="chk">${chk('def:' + key)}</td><td><b>${d.icon} ${esc(key)}</b><br><small>${esc(d.label)}</small></td>
  <td>${sevBadge(d.severity)}</td><td>${esc(d.mechanism)}</td><td>${esc(d.management)}</td><td><small>${esc(d.ref)}</small></td></tr>`;
}
s1 += '</tbody></table>';

// ---- Section 2: members per class ----
let s2 = '';
for (const [key, d] of Object.entries(CLASS_DEFS)) {
  const mem = classMembers[key].sort();
  s2 += `<div class="clsbox"><div class="clshead">${d.icon} <b>${esc(key)}</b> — ${esc(d.label)} ${sevBadge(d.severity)} <small>(${mem.length} ตัว)</small></div>
  <div class="members">${mem.map(m => `<label class="pill">${chk('mem:' + key + ':' + m)} ${esc(m)}</label>`).join(' ')}</div></div>`;
}

// ---- Section 3: keyword → classes table ----
const kwSorted = [...kwMap.keys()].sort();
let s3 = `<table><thead><tr><th style="width:28px">✓</th><th>ยา (keyword)</th><th>Class ที่ติด tag</th></tr></thead><tbody>`;
for (const kw of kwSorted) {
  const cls = [...kwMap.get(kw)];
  s3 += `<tr><td class="chk">${chk('kw:' + kw)}</td><td><b>${esc(kw)}</b></td><td>${cls.map(c => `<code>${esc(c)}</code>`).join(' ')}</td></tr>`;
}
s3 += '</tbody></table>';

// ---- Section 4: curated pairs ----
let s4 = `<table><thead><tr><th style="width:28px">✓</th><th>#</th><th>คู่ยา</th><th>ระดับ</th><th>กลไก</th><th>การจัดการ</th><th>อ้างอิง</th></tr></thead><tbody>`;
CURATED.forEach((p, i) => {
  const a = p.a ? p.a : (p.aAny || []).join(' / ');
  const b = p.b ? p.b : (p.bAny || []).join(' / ');
  s4 += `<tr><td class="chk">${chk('pair:' + (i + 1) + ':' + (p.a || (p.aAny || [])[0]))}</td><td>${i + 1}</td><td><b>${esc(a)}</b><br>+ ${esc(b)}</td>
  <td>${sevBadge(p.severity)}</td><td>${esc(p.mechanism)}</td><td>${esc(p.management)}</td><td><small>${esc(p.ref)}</small></td></tr>`;
});
s4 += '</tbody></table>';

const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>เอกสารตรวจสอบข้อมูล DDI — IV DrugRef</title>
<style>
body{font-family:'Segoe UI',Tahoma,sans-serif;margin:0;padding:16px;background:#f8fafc;color:#1e293b;font-size:14px;line-height:1.55}
.wrap{max-width:1000px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}
h2{font-size:16px;margin:28px 0 8px;padding:8px 12px;background:#1e293b;color:#fff;border-radius:8px}
.meta{color:#64748b;font-size:12px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)}
th{background:#e2e8f0;text-align:left;padding:6px 8px;font-size:12px}
td{padding:6px 8px;border-top:1px solid #e2e8f0;vertical-align:top}
tr:nth-child(even) td{background:#f8fafc}
.sev{display:inline-block;border:1px solid;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;white-space:nowrap;background:#fff}
code{background:#eef2ff;color:#4338ca;padding:1px 6px;border-radius:5px;font-size:12px}
.pill{display:inline-block;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:2px 9px;margin:2px;font-size:12.5px}
.clsbox{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0}
.clshead{margin-bottom:6px}
.chk{font-size:15px;color:#94a3b8;text-align:center}
.vchk{width:17px;height:17px;accent-color:#16a34a;cursor:pointer;vertical-align:-3px}
tr.done td{background:#f0fdf4 !important;color:#94a3b8}
tr.done td b,tr.done td code{color:#94a3b8;background:transparent}
label.pill{cursor:pointer;user-select:none}
label.pill.done{background:#f0fdf4;border-color:#86efac;color:#94a3b8;text-decoration:line-through}
#progressBar{position:sticky;top:0;z-index:10;background:#fff;border:1px solid #e2e8f0;border-radius:10px;
  padding:8px 14px;margin:10px 0;box-shadow:0 2px 6px rgba(0,0,0,.08);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
#progTrack{flex:1;min-width:140px;height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}
#progFill{height:100%;width:0%;background:#16a34a;border-radius:6px;transition:width .2s}
#progText{font-size:13px;font-weight:700;white-space:nowrap}
.btn{background:#1e293b;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12.5px;cursor:pointer}
.btn.gray{background:#64748b}
.alert{background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:8px;padding:10px 14px;margin:10px 0}
.warn{background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #ca8a04;border-radius:8px;padding:10px 14px;margin:10px 0}
.info{background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;padding:10px 14px;margin:10px 0}
small{color:#64748b}
@media print{body{background:#fff}h2{background:#fff;color:#000;border:1px solid #000}}
</style></head><body><div class="wrap">
<h1>📋 เอกสารตรวจสอบข้อมูล Drug–Drug Interaction (DDI)</h1>
<div class="meta">IV DrugRef PWA — ข้อมูล default ในโค้ด (js/drug-interactions.js) ณ วันที่ 2 ก.ค. 2026 ·
${nClasses} classes · ${nKw} ยา (keywords) · ${nPairs} คู่ curated</div>

<div id="progressBar">
  <span id="progText">ตรวจแล้ว 0 / 0</span>
  <div id="progTrack"><div id="progFill"></div></div>
  <button class="btn" id="btnCopy" type="button">📋 คัดลอกรายการที่ยังไม่ตรวจ</button>
  <button class="btn gray" id="btnReset" type="button">ล้างการติ๊กทั้งหมด</button>
</div>

<div class="info"><b>วิธีใช้เอกสารนี้:</b> ตรวจแต่ละรายการเทียบกับ UpToDate/Lexicomp/Micromedex แล้ว<b>กดติ๊ก
checkbox</b> เมื่อยืนยันว่าถูกต้อง — สถานะการติ๊กถูกบันทึกไว้ในเบราว์เซอร์อัตโนมัติ (เปิดไฟล์ซ้ำก็ไม่หาย)
รายการที่<b>ผิด/ขาด</b>ไม่ต้องติ๊ก — จดส่งกลับมา เช่น "class cnsDepress ควรเป็น major, คู่ #5 กลไกไม่ถูก, ขาดยา X ใน class Y"</div>

<h2>🔎 0) วิเคราะห์กรณี Midazolam + Morphine ที่ไม่ขึ้นเตือน</h2>
<div class="alert"><b>สาเหตุ: ข้อมูลใน Supabase ไม่ครบ ไม่ใช่ตัวกลไกตรวจผิด</b><br>
ในโค้ด default ทั้ง <code>morphine</code> และ <code>midazolam</code> ติด tag <code>cnsDepress</code> อยู่แล้ว
— ถ้าแอพใช้ค่า default จะต้องขึ้นเตือน "Additive CNS/respiratory depression"<br><br>
แต่แอพจะเอาตาราง <code>ddi_class_rules</code> จาก Supabase มา<b>แทนที่</b>ค่า default ทั้งชุด
— และตารางนั้นน่าจะ<b>มีข้อมูลไม่ครบ</b> (สาเหตุที่เป็นไปได้มากสุด: การ Import Defaults รุ่นแรก
เคยมีบั๊ก keyword ซ้ำ ทำให้ import ล้มกลางคัน/ได้บางส่วน — บั๊กนั้นแก้แล้วใน v5.51.0)
ยากลุ่ม opioid/benzodiazepine จึงหายไปจากชุดที่ใช้จริงบนหน้าเว็บ
→ ยืนยันได้ด้วย SQL ในหัวข้อ 5)<br><br>
<b>วิธีแก้ (หลังตรวจข้อมูลในเอกสารนี้เสร็จ):</b> เข้า admin → แท็บ DDI → กด "Import Defaults" อีกครั้ง
(เวอร์ชันปัจจุบันจะ merge/update รายการเดิมให้เอง ไม่สร้างซ้ำ) แล้วข้อมูลครบชุดล่าสุดจะถูก sync ขึ้น Supabase</div>
<div class="warn"><b>จุดที่ควรพิจารณาเป็นพิเศษ (ผมติดธงไว้ให้):</b><br>
1. <b>cnsDepress ตอนนี้ตั้งระดับเป็น Moderate</b> — แต่ UpToDate/Lexicomp จัด Opioid + Benzodiazepine เป็น
<b>Risk D / Major</b> และ US FDA มี Boxed Warning สำหรับคู่นี้ → ควรพิจารณาปรับเป็น <b>Major</b>
(เหตุที่เดิมตั้ง moderate: ใน ICU มักตั้งใจใช้ร่วมภายใต้ monitor เช่น fentanyl+midazolam sedation
— ถ้าปรับเป็น major ข้อความ "จัดการ" ยังอธิบายบริบท ICU ไว้อยู่)<br>
2. <b>dexmedetomidine</b> ติดแค่ bradycardia — เป็นยา sedative ควรติด <code>cnsDepress</code> ด้วยไหม?<br>
3. <b>ketamine</b> ติด cnsDepress ไว้ (กดหายใจน้อยกว่ากลุ่มอื่น) — คงไว้หรือถอด?<br>
4. <b>tramadol/pethidine + ondansetron</b> จะชนกันผ่าน class serotonergic — สอดคล้อง Lexicomp (Risk C)<br>
5. ยาในฐานข้อมูล compat ที่<b>ยังไม่ติด tag ใด ๆ</b> เช่น olanzapine (QT/CNS), quetiapine ไม่มีในระบบ IV
— ช่วยดูหัวข้อ 2) ว่ามียาที่ใช้บ่อยในโรงพยาบาลคุณตกหล่นไหม</div>

<h2>1) นิยาม Class (${nClasses} classes) — ระดับความรุนแรง / กลไก / การจัดการ</h2>
<p><small>Class = กลุ่มความเสี่ยงสะสม: ถ้าเลือกยา ≥2 ตัวที่อยู่ class เดียวกัน ระบบจะเตือนอัตโนมัติ</small></p>
${s1}

<h2>2) สมาชิกแต่ละ Class — ตรวจว่า "ยาไหนควรอยู่/ไม่ควรอยู่ + ขาดยาอะไร"</h2>
${s2}

<h2>3) ตารางรายยา (${nKw} ตัว) — ยาแต่ละตัวติด tag อะไรบ้าง</h2>
${s3}

<h2>4) คู่ interaction เฉพาะ (Curated pairs — ${nPairs} คู่)</h2>
<p><small>คู่ที่ระบุชื่อเจาะจง (class model อธิบายไม่ได้) — keyword จับแบบ substring เช่น "valpro" จับทั้ง valproate/valproic acid</small></p>
${s4}

<h2>5) SQL สำหรับเช็คข้อมูลจริงใน Supabase (รันใน SQL Editor)</h2>
<div class="info" style="font-family:monospace;font-size:12.5px;white-space:pre-wrap">-- นับจำนวน rules ที่อยู่บน Supabase ตอนนี้ (ควรได้ ${nKw} หลัง import ใหม่)
select count(*) from ddi_class_rules;

-- ดูว่า morphine / midazolam มี tag อะไร (ตอนนี้คาดว่า "ไม่พบแถว" = สาเหตุของบั๊ก)
select data->>'keyword' as drug, data->'classes' as classes
from ddi_class_rules
where data->>'keyword' in ('morphine','midazolam','fentanyl','propofol');

-- ดูคู่ curated ทั้งหมดบน Supabase
select data->>'a' as a, data->>'b' as b, data->'aAny' as a_any, data->'bAny' as b_any,
       data->>'severity' as severity
from ddi_pairs order by 5;</div>

<div class="meta" style="margin-top:24px">หมายเหตุ: เอกสารนี้สร้างจากข้อมูลในโค้ดอัตโนมัติ — ถ้าแก้ข้อมูลในโค้ดแล้ว regenerate ได้เสมอ ·
ระบบ DDI เป็น screening เบื้องต้น ไม่แทนการตรวจสอบจากแหล่งอ้างอิงหลัก</div>
</div>
<script>
(function () {
  'use strict';
  var KEY = 'ddiVerifyChecks_v1';
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.vchk'));

  // localStorage may be unavailable (e.g. sandboxed preview) — ticking still
  // works within the session, it just won't persist.
  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveState(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* no persistence */ }
  }
  var state = loadState();

  function paint(box) {
    var row = box.closest('tr'); if (row) row.classList.toggle('done', box.checked);
    var pill = box.closest('label.pill'); if (pill) pill.classList.toggle('done', box.checked);
  }
  function refreshProgress() {
    var done = boxes.filter(function (b) { return b.checked; }).length;
    document.getElementById('progText').textContent = 'ตรวจแล้ว ' + done + ' / ' + boxes.length;
    document.getElementById('progFill').style.width = (boxes.length ? (100 * done / boxes.length) : 0) + '%';
  }

  boxes.forEach(function (b) {
    if (state[b.getAttribute('data-k')]) b.checked = true;
    paint(b);
    b.addEventListener('change', function () {
      state[b.getAttribute('data-k')] = b.checked ? 1 : 0;
      saveState(state); paint(b); refreshProgress();
    });
  });
  refreshProgress();

  document.getElementById('btnReset').addEventListener('click', function () {
    if (!confirm('ล้างการติ๊กทั้งหมด?')) return;
    state = {}; saveState(state);
    boxes.forEach(function (b) { b.checked = false; paint(b); });
    refreshProgress();
  });

  document.getElementById('btnCopy').addEventListener('click', function () {
    var todo = boxes.filter(function (b) { return !b.checked; })
      .map(function (b) { return '- ' + b.getAttribute('data-k'); });
    var txt = todo.length
      ? 'รายการที่ยังไม่ได้ตรวจ (' + todo.length + '):\\n' + todo.join('\\n')
      : 'ตรวจครบทุกรายการแล้ว ✓';
    function fallback() { prompt('คัดลอกข้อความนี้:', txt); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { alert('คัดลอกแล้ว (' + todo.length + ' รายการ)'); }, fallback);
    } else fallback();
  });
})();
</script>
</body></html>`;

const out = path.join(ROOT, 'docs', 'ddi-verify.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('written:', out);
console.log(`stats: ${nClasses} classes, ${nRules} rule entries -> ${nKw} unique keywords, ${nPairs} curated pairs`);
// quick sanity: morphine+midazolam must collide on cnsDepress in defaults
const f = DI.check(['Morphine', 'Midazolam']);
console.log('check(Morphine, Midazolam) =>', JSON.stringify(f.map(x => ({ t: x.title, sev: x.severity }))));
