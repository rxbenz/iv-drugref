#!/usr/bin/env node
/**
 * bump-version.js — one-command release bump for IV DrugRef PWA.
 *
 * Bumps the app version in EVERY place the force-update / display path depends on,
 * so the numbers can never drift out of sync (a drift breaks force-update):
 *   - package.json          "version"
 *   - version.json          "version"  (+ forces forceUpdate:true)
 *   - sw.js                 header comment + CACHE_NAME const + a changelog line
 *   - js/core.js            const VERSION + a new RELEASE_NOTES entry (What's New)
 * Per-page footer version strings update themselves at runtime from
 * IVDrugRef.VERSION via [data-app-version] — no file edit needed.
 *
 * Usage:
 *   node bump-version.js <version> [--title "หัวข้อสั้น ๆ"] [--date YYYY-MM-DD] "โน้ต1" "โน้ต2" ...
 *   npm run release -- <version> --title "หัวข้อ" "โน้ต1" "โน้ต2"
 *
 * Notes are the Thai "What's New" bullet lines shown to users on the next open.
 * Example:
 *   node bump-version.js 5.52.0 --title "แจ้งเตือนอัปเดต" \
 *     "🎉 เพิ่มหน้าต่างมีอะไรใหม่" "⚡ บังคับอัปเดตเป็นเวอร์ชันล่าสุดทุกครั้ง"
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const P = (f) => path.join(ROOT, f);

// ── tiny arg parser ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
  console.log('วิธีใช้: node bump-version.js <version> [--title "หัวข้อ"] [--date YYYY-MM-DD] "โน้ต1" "โน้ต2" ...');
  console.log('ตัวอย่าง: node bump-version.js 5.52.0 --title "แจ้งเตือนอัปเดต" "🎉 เพิ่มหน้าต่างมีอะไรใหม่"');
  process.exit(argv.length ? 0 : 1);
}

const NEW = argv[0];
let title = '';
let date = '';
const items = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--title') { title = argv[++i] || ''; }
  else if (a === '--date') { date = argv[++i] || ''; }
  else { items.push(a); }
}

// ── validation ──────────────────────────────────────────────────────────────
function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

if (!/^\d+\.\d+\.\d+$/.test(NEW)) fail('รูปแบบเวอร์ชันต้องเป็น x.y.z (เช่น 5.52.0) — ได้รับ: "' + NEW + '"');

const pkg = JSON.parse(fs.readFileSync(P('package.json'), 'utf8'));
const OLD = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(OLD)) fail('เวอร์ชันเดิมใน package.json ผิดรูปแบบ: "' + OLD + '"');

function cmp(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (pa[i] > pb[i]) return 1; if (pa[i] < pb[i]) return -1; }
  return 0;
}
if (cmp(NEW, OLD) <= 0) fail('เวอร์ชันใหม่ (' + NEW + ') ต้องมากกว่าเวอร์ชันเดิม (' + OLD + ')');

if (!title && !items.length) fail('ต้องระบุอย่างน้อย 1 โน้ต หรือ --title เพื่อบอกผู้ใช้ว่าอัปเดตอะไร');
if (!title) title = items.length ? items[0].replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 60) : ('อัปเดตเวอร์ชัน ' + NEW);

if (!date) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('รูปแบบวันที่ต้องเป็น YYYY-MM-DD — ได้รับ: "' + date + '"');

// ── helpers: read / replace-once-or-warn / write ────────────────────────────
const changed = [];
const warned = [];

function replaceOnce(file, oldStr, newStr, label) {
  const p = P(file);
  let txt = fs.readFileSync(p, 'utf8');
  if (txt.indexOf(oldStr) === -1) { warned.push(file + ' — ไม่พบข้อความ ' + label); return null; }
  txt = txt.replace(oldStr, newStr);
  fs.writeFileSync(p, txt);
  changed.push(file + ' — ' + label);
  return txt;
}

// ── 1) package.json ─────────────────────────────────────────────────────────
replaceOnce('package.json', '"version": "' + OLD + '"', '"version": "' + NEW + '"', 'version');

// ── 1b) package-lock.json — keep the root version in sync, else `npm ci`
//        (used by the deploy workflow) errors on a package.json/lock mismatch.
//        Only the app's own version lines match "<OLD>" (no dependency is on it),
//        so a plain replace-all is safe and keeps the diff to the version fields.
(function () {
  const p = P('package-lock.json');
  if (!fs.existsSync(p)) { warned.push('package-lock.json — ไม่พบไฟล์ (ข้าม)'); return; }
  let lock = fs.readFileSync(p, 'utf8');
  const needle = '"version": "' + OLD + '"';
  if (lock.indexOf(needle) === -1) { warned.push('package-lock.json — ไม่พบ version เดิม'); return; }
  lock = lock.split(needle).join('"version": "' + NEW + '"');
  fs.writeFileSync(p, lock);
  changed.push('package-lock.json — version (sync กับ package.json)');
})();

// ── 2) version.json  (+ force forceUpdate:true) ─────────────────────────────
(function () {
  const p = P('version.json');
  const vj = JSON.parse(fs.readFileSync(p, 'utf8'));
  vj.version = NEW;
  vj.forceUpdate = true;
  fs.writeFileSync(p, JSON.stringify(vj, null, 2) + '\n');
  changed.push('version.json — version + forceUpdate:true');
})();

// ── 3) sw.js — header + CACHE_NAME + changelog line ─────────────────────────
(function () {
  const p = P('sw.js');
  let sw = fs.readFileSync(p, 'utf8');

  // header comment: "Service Worker vX.Y.Z"
  if (sw.indexOf('Service Worker v' + OLD) !== -1) {
    sw = sw.replace('Service Worker v' + OLD, 'Service Worker v' + NEW);
    changed.push('sw.js — header version');
  } else { warned.push('sw.js — ไม่พบ header "Service Worker v' + OLD + '"'); }

  // CACHE_NAME const
  const cacheOld = "const CACHE_NAME = 'iv-drugref-v" + OLD + "';";
  const cacheNew = "const CACHE_NAME = 'iv-drugref-v" + NEW + "';";
  if (sw.indexOf(cacheOld) !== -1) {
    sw = sw.replace(cacheOld, cacheNew);
    changed.push('sw.js — CACHE_NAME');
  } else { warned.push('sw.js — ไม่พบ CACHE_NAME เดิม'); }

  // changelog line: insert "// vX.Y.Z: <title>" just above the separator that
  // precedes the CACHE_NAME const (dev-facing release log).
  const lines = sw.split('\n');
  const ci = lines.findIndex((l) => l.indexOf(cacheNew) === 0);
  if (ci > 2 && /^\/\/ =+/.test(lines[ci - 2])) {
    lines.splice(ci - 2, 0, '// v' + NEW + ': ' + title);
    sw = lines.join('\n');
    changed.push('sw.js — changelog line');
  } else { warned.push('sw.js — ไม่ได้แทรกบรรทัด changelog (โครงไฟล์ไม่ตรงที่คาด)'); }

  fs.writeFileSync(p, sw);
})();

// ── 4) js/core.js — const VERSION + RELEASE_NOTES entry ─────────────────────
(function () {
  const p = P('js/core.js');
  let core = fs.readFileSync(p, 'utf8');

  const vOld = "const VERSION = '" + OLD + "';";
  const vNew = "const VERSION = '" + NEW + "';";
  if (core.indexOf(vOld) !== -1) {
    core = core.replace(vOld, vNew);
    changed.push('js/core.js — VERSION');
  } else { warned.push('js/core.js — ไม่พบ const VERSION เดิม'); }

  // Build the new RELEASE_NOTES entry (valid JS; JSON.stringify escapes safely).
  const itemsBlock = items.length
    ? '[\n' + items.map((it) => '        ' + JSON.stringify(it)).join(',\n') + '\n      ]'
    : '[]';
  const entry =
    '    {\n' +
    "      v: '" + NEW + "',\n" +
    "      date: '" + date + "',\n" +
    '      title: ' + JSON.stringify(title) + ',\n' +
    '      items: ' + itemsBlock + '\n' +
    '    },\n';

  const anchor = 'const RELEASE_NOTES = [\n';
  if (core.indexOf(anchor) !== -1) {
    core = core.replace(anchor, anchor + entry);
    changed.push('js/core.js — RELEASE_NOTES entry');
  } else { warned.push('js/core.js — ไม่พบ RELEASE_NOTES anchor'); }

  fs.writeFileSync(p, core);
})();

// ── report ──────────────────────────────────────────────────────────────────
console.log('\n🔖 อัปเดตเวอร์ชัน ' + OLD + ' → ' + NEW + '  (' + date + ')');
console.log('   หัวข้อ: ' + title);
if (items.length) items.forEach((it) => console.log('   • ' + it));
console.log('\n✅ แก้ไฟล์สำเร็จ:');
changed.forEach((c) => console.log('   ✓ ' + c));
if (warned.length) {
  console.log('\n⚠️  ข้อควรระวัง (ตรวจด้วยตนเอง):');
  warned.forEach((w) => console.log('   ! ' + w));
}
console.log('\n👉 ขั้นถัดไป: npm test  →  git add -A  →  git commit  →  git push');
if (warned.length) process.exitCode = 2;
