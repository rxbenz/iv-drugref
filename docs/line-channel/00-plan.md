# แผนแม่บท: ช่องทาง LINE — แบ่ง 8 Phase

> สถานะ: อนุมัติแผนแล้ว (2026-07-17) · ทำทีละ phase — **แต่ละ phase จบในตัว ใช้งานได้จริงทันที**
> ก่อนเริ่ม phase ใดให้เจ้าของโปรเจกต์สั่งเริ่มเป็นรายการไป

> ⚠️ **กล่องเตือนสำคัญที่สุด**: repo นี้เป็น **public** — **ห้ามวาง Channel secret /
> Channel access token / key ลับใด ๆ ลงในไฟล์ของ repo เด็ดขาด** (รวมถึงในเอกสาร,
> ตัวอย่างโค้ด, screenshot) ที่เก็บที่ถูกต้องคือ Supabase secrets และ GAS Script
> Properties เท่านั้น — ดูตาราง secret ใน [`README.md`](README.md)

## 1. ที่มา

- ต้องการช่องทางเสริมผ่าน LINE โดย **PWA เดิมไม่เปลี่ยนพฤติกรรมใด ๆ**
- มี LINE OA อยู่แล้ว · เอาครบ 4 ฟีเจอร์: rich menu → แชตบอต → urgent alert → แชร์
- ไม่ใช้ LINE Notify (ปิดบริการไปแล้วปี 2025) — ทุกอย่างผ่าน **Messaging API**

## 2. ข้อเท็จจริงจากการสำรวจโค้ด (อ้างอิง file:line)

| # | ข้อเท็จจริง | อ้างอิง |
|---|---|---|
| 1 | ยังไม่มีโค้ด LINE จริงเลย — ปุ่ม "แชร์ LINE" ปัจจุบันคือ copy ลง clipboard | `js/share-export.js:134-142` |
| 2 | `version.json` เปิด `forceUpdate: true` และเมื่อไม่มี service worker โค้ดจะ `location.reload()` อัตโนมัติ โดย loop-guard พึ่ง `sessionStorage` ซึ่งใน in-app WebView บางกรณีใช้ไม่ได้ → **เสี่ยง reload วนใน LINE browser — ต้องแก้ก่อนเปิด rich menu** | `js/core.js:988-1000`, `:1044-1051` |
| 3 | SW registration ปลอดภัยแล้ว (feature-guarded) — ไม่มี SW ก็ไม่พัง แค่ไม่มี offline cache | `js/core.js:877` |
| 4 | Deep link ที่มีแล้ว: `index.html?search=\|?drug=`, `compatibility.html?drug=` (ตัวเดียว), `calculator.html?drug=` — ยังไม่มี: compat 2 ตัว, renal | `js/index.js:586-604`, `js/compatibility.js:908-921`, `js/calculator.js:1123-1136` |
| 5 | ข้อมูลอ้างอิงอ่านจาก Supabase แบบ public-read (anon key) อยู่แล้ว → บอตใช้ฐานเดียวกับแอปได้ทันที | `js/index.js:761`, `js/compatibility.js:328`, `js/renal-dosing.js:1186` |
| 6 | ตาราง `events` รับ anon INSERT (ไม่มี anon SELECT) → บอต log `LINE_QUERY` ได้ตาม convention เดิม | `supabase/schema.sql`, `js/core.js:744-769` |
| 7 | **GAS อ่าน HTTP request header ไม่ได้** → ตรวจ `X-Line-Signature` ไม่ได้ → webhook ต้องเป็น Supabase Edge Function; GAS ยิงขาออก (broadcast) ได้ปกติ | โครงสร้าง `doGet/doPost` ใน `gas-complete.js:193-405` |
| 8 | Urgent alerts: `createUrgentAlert()` มีอยู่แต่ **ไม่ได้ route** เข้า doGet/doPost และ admin panel **ไม่มี UI** — วันนี้สร้าง alert ได้จาก GAS editor เท่านั้น; client รับผ่าน SW polling ทุก 5 นาที | `gas-complete.js:2188-2222`, `sw.js:757-803` |
| 9 | ⚠️ SW poll `checkUrgentAlerts` ที่ **ANALYTICS** GAS URL แต่ admin panel เรียก **ADMIN** GAS URL — คนละ deployment ผูกคนละ spreadsheet → Phase 5 ต้อง pre-check ก่อนเขียนโค้ด | `sw.js:776`, `js/admin.js:174`, `gas-complete.js:35` |
| 10 | มีตัวตรวจ GAS drift อยู่แล้ว (`GAS_VERSION` = `EXPECTED_GAS_VERSION` + panel ใน admin) — ทุก phase ที่แตะ GAS ต้อง bump คู่ | `gas-complete.js:28`, `js/admin.js:234` |
| 11 | แบบแผน secret เดิม: `SUPABASE_SERVICE_KEY` ใน GAS Script Properties (ไม่เคย hardcode) | `gas-complete.js:1627-1631` |
| 12 | CSP เป็น meta tag แยกต่อหน้า (บรรทัด 5) — ยังไม่อนุญาตโดเมน LINE; จะเพิ่มเฉพาะหน้า/เฉพาะ phase ที่ใช้ LIFF SDK จริง (Phase 7) | `*.html:5` |
| 13 | `docs/` ไม่ถูก deploy (build.js ไม่ copy) → เก็บคู่มือได้ปลอดภัย | `build.js:60-63` |

## 3. การตัดสินใจสถาปัตยกรรม

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| Webhook บอต | **Supabase Edge Function** `line-webhook` (Deno/TypeScript) | อ่าน header ได้ → ตรวจลายเซ็นได้; อยู่ติดฐานข้อมูล; ฟรี ~500K calls/เดือน |
| การตอบแชต | Messaging API **reply** เท่านั้น | ฟรีไม่จำกัด ไม่กินโควตา |
| Broadcast ประกาศด่วน | **GAS** hook ใน `createUrgentAlert` ผ่าน `UrlFetchApp` | pipeline alert + สิทธิ์ admin อยู่ใน GAS แล้ว; token เก็บใน Script Properties ตามแบบแผน `SUPABASE_SERVICE_KEY` |
| Rich menu / LIFF | ตั้งค่าในคอนโซลทั้งหมด; LIFF endpoint = เว็บเดิม; **ยังไม่ใส่ LIFF SDK จนถึง Phase 7** | หน้าเว็บเปิดใน LIFF browser ได้โดยไม่ต้อง `liff.init()` — เล็กสุด เสี่ยงต่ำสุด |
| Logic บอตที่ทดสอบได้ | pure ESM `.mjs` (`matcher.mjs`, `messages.mjs`) ให้ Deno import และ `node --test` โหลดได้ทั้งคู่ | เข้า gate `npm test` เดิมใน CI; ห้าม import โค้ดหน้าเว็บเข้า Deno — พอร์ต semantics ของ `normKey`/`keyCandidates` (จาก `js/compatibility.js:355-376`) พร้อม comment ระบุที่มา |
| Analytics | บอต log event `type: 'LINE_QUERY'` (UPPER_CASE ตาม convention), `user_id` = sha256 ของ LINE userId ตัดสั้น (ไม่เก็บ id ดิบ) | ใช้ dashboard เดิมวิเคราะห์ได้ |
| Secrets | token อยู่ 2 ที่ตามหน้าที่ (Supabase secrets = ตอบแชต, GAS Script Properties = broadcast) + มี `SECRETS.md` บอกตำแหน่ง/วิธี rotate | แลกความซ้ำซ้อนเล็กน้อยกับความง่ายของแต่ละฝั่ง |

## 4. กติกาความปลอดภัยทางคลินิก (ผูกทุก phase)

1. บอต = **lookup อ้างอิงเท่านั้น** — โค้ดใน Edge Function ต้อง**ไม่มี** path คำนวณขนาดยา/TDM เลยแม้แต่บรรทัดเดียว (ปลอดภัยเชิงโครงสร้าง ไม่ใช่แค่เชิงนโยบาย)
2. เครื่องคิดเลข/TDM ทำในแอปเท่านั้น (มี pediatric guard) — บอตส่งได้แค่ **ลิงก์** เปิดหน้านั้น
3. ทุกคำตอบแนบ disclaimer + ปุ่ม "เปิดในแอป" เสมอ — ข้อความ disclaimer ที่เสนอ (เจ้าของโปรเจกต์รีวิว/แก้ก่อน Phase 3 ขึ้นจริง):

   > ⚠️ ข้อมูลอ้างอิงเบื้องต้นสำหรับบุคลากรทางการแพทย์เท่านั้น
   > โปรดตรวจสอบกับแหล่งอ้างอิงหลักก่อนใช้กับผู้ป่วย · บอทไม่คำนวณขนาดยา —
   > เครื่องมือคำนวณอยู่ในแอป

4. ชื่อยากำกวม/สะกดผิด → เสนอตัวเลือก (quick reply) ให้กดเลือก **ไม่เดาคำตอบ**
5. ข้อมูลที่บอตแสดง = field เดียวกับที่แอปแสดง (ชุดที่ admin verify แล้ว) — บอตไม่แต่ง/สรุปความเอง

## 5. โควตาข้อความ LINE (คณิตที่ต้องรู้ก่อน Phase 6)

- **Reply** (บอตตอบคนที่ทักมา): **ฟรี ไม่จำกัด** — ฟีเจอร์บอตทั้งหมดจึงไม่มีต้นทุนต่อข้อความ
- **Broadcast** (ส่งหาผู้ติดตามทุกคน): กินโควตาข้อความฟรีรายเดือนของ OA
  (แพลนฟรีของไทย ≈ **300 ข้อความ/เดือน** — ตัวเลขจริงให้เช็คใน OA Manager ตอนทำ Phase 0 แล้วจดลง `01-prerequisites.md`)
- **1 broadcast = จำนวนผู้ติดตาม ข้อความ** เช่น ผู้ติดตาม 100 คน → broadcast ได้ ~3 ครั้ง/เดือน
  → ใช้กับ**ประกาศด่วนจริง ๆ เท่านั้น** และ Phase 6 มี dialog แสดงโควตาคงเหลือก่อนส่งทุกครั้ง
- ถ้าผู้ติดตามโตจนโควตาไม่พอ → พิจารณาแพลนเสียเงินของ LINE OA (ดูราคาปัจจุบันในคอนโซล)

## 6. รายละเอียดต่อ Phase

### Phase 0 — เตรียมคอนโซล (S · ไม่มีโค้ด) — ✅ DONE (2026-07-17)
ตามคู่มือ [`01-prerequisites.md`](01-prerequisites.md): เปิด/ยืนยัน Messaging API channel
บน OA เดิม → เก็บ Channel secret + ออก Channel access token (เก็บใน password manager
**ไม่ใช่ใน repo**) → สร้าง LINE Login channel (รองรับ LIFF ใน Phase 1) → **ยืนยันเปิดหน้า
Edge Functions ใน Supabase dashboard ได้** (deploy ผ่านเว็บ Via Editor — **ไม่ใช้ CLI**) →
เช็คโควตาข้อความฟรีจริงแล้วจดไว้
**ตรวจ**: ✅ Messaging API เปิด · secret/token เก็บแล้ว · Login channel สร้างแล้ว ·
Edge Functions dashboard เปิดได้ · โควตา = ฟรี 300 ข้อความ/เดือน (เพดานตายตัว), ผู้ติดตาม ~0

### Phase 1 — LINE entry: กัน reload วน + rich menu (S/M) — *ship โค้ดก่อน แล้วค่อยเปิด rich menu*
**โค้ด**
- `js/core.js`: เพิ่ม helper แท้ `isLineInApp(ua)` (ตรวจ UA มี `Line/`) export บน `IVDrugRef`;
  ใน `checkForUpdate()` branch `forceUpdate` (`:988-1000`) ถ้าอยู่ใน LINE → **ไม่เรียก**
  `showForceUpdateBanner` (ซึ่ง auto-reload) แต่แสดง banner กดปิดได้ + ปุ่ม "โหลดใหม่";
  ใน `controllerchange` (`:915-919`) ถ้าอยู่ใน LINE → toast แทน auto-reload;
  คง sessionStorage guard เดิมเป็นตาข่ายชั้นสอง
- `js/site-chrome.js`: ซ่อน install UI (`beforeinstallprompt` `:19-23`) เมื่ออยู่ใน LINE
- `js/index.js`: แนบ `line_inapp: true` ใน SESSION_START (~2 บรรทัด) เพื่อให้ dashboard เห็น traffic จาก LINE
- test: เพิ่มเคส `isLineInApp` (LINE UA / LIFF UA / Chrome / Safari) ใน harness เดิม
- **ไม่แก้ CSP** (ยังไม่มี SDK) · ship ด้วย `npm run release`
**คอนโซล** (คู่มือ `02-rich-menu-liff.md` สร้างตอนทำ): สร้าง LIFF app (endpoint = root
ของ Pages, size Full) บน LINE Login channel; สร้าง rich menu ใน OA Manager ปุ่มชี้
`https://liff.line.me/{liffId}/index.html`, `.../compatibility.html`, `.../renal-dosing.html`,
`.../calculator.html`, `.../allergy.html`, `.../interactions.html`
**ตรวจ**: กดทุกปุ่มบนมือถือจริง → เปิดถูกหน้าใน LINE; ปล่อย version ใหม่แล้ว banner
ใน LINE **กดปิดได้ ไม่ reload วน**; ปุ่ม install หายใน LINE แต่ยังอยู่ใน Chrome ปกติ

### Phase 2 — โครงบอต: webhook + ลายเซ็น + ตอบเมนู (M)
**โค้ด**
- ใหม่ `supabase/functions/line-webhook/index.ts`: อ่าน raw body → ตรวจ `X-Line-Signature`
  (HMAC-SHA256 ด้วย `LINE_CHANNEL_SECRET`, เทียบแบบ constant-time; ผิด → 403) →
  event `message`/`follow` → reply เมนูช่วยเหลือ (รายการ deep link) ผ่าน
  `POST https://api.line.me/v2/bot/message/reply`; ตอบ 200 เสมอ (รวม Verify ping ที่ events ว่าง)
- ใหม่ `supabase/functions/line-webhook/lib/messages.mjs` (pure): `buildHelp()`,
  ค่าคงที่ `DISCLAIMER`, ตัวสร้าง deep link (รับ `liffId` เป็น parameter)
- ใหม่ `test/line-messages.test.js` (node --test, dynamic `import()`)
- ใหม่ `scripts/line-webhook-sim.sh`: จำลอง LINE POST พร้อมลายเซ็นจริง (openssl HMAC + curl,
  secret อ่านจาก env) — ทดสอบทั้งเคส 200 และ 403
- **Deploy = ผ่านหน้าเว็บ Supabase dashboard (Via Editor)** ไม่ใช้ CLI (ตามที่เลือกไว้):
  Edge Functions → **Deploy a new function** ชื่อ `line-webhook` → วางโค้ด `index.ts` +
  ไฟล์ `lib/*.mjs` ในเอดิเตอร์ → Deploy · ที่ **Function settings** ตั้ง **Verify JWT = OFF**
  (เทียบเท่า `--no-verify-jwt` — จำเป็นเพราะ LINE ไม่ส่ง Supabase JWT; ความปลอดภัยมาจาก
  ลายเซ็น LINE แทน) · repo เก็บโค้ดเป็น source of truth แล้วก๊อปวางลง dashboard (แบบเดียว
  กับที่ทำ `gas-complete.js` ลง GAS editor)
**คอนโซล** (คู่มือ `03-webhook-bot.md`): ตั้งของลับที่ **Edge Functions → Secrets**
(`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LIFF_ID`);
วาง webhook URL `https://bzwbagojjpiazbeaahmg.supabase.co/functions/v1/line-webhook`
ใน LINE Developers console + กด Verify; **ปิด auto-reply/greeting เดิมของ OA**
**ตรวจ**: `npm test` เขียว; sim script ได้ 200/403 ตามคาด; ทักบอตจากมือถือแล้วได้เมนูตอบ
· ไม่แตะไฟล์ PWA → **ไม่ bump version**

### Phase 3 — บอตค้นข้อมูลยา (M)
**โค้ด**
- ใหม่ `supabase/functions/line-webhook/lib/matcher.mjs`: พอร์ต semantics ของ
  `normKey`/`keyCandidates` + `CATION_PREFIXES` (จาก `js/compatibility.js:355-376`,
  ใส่ comment ที่มา); `parseMessage(text)` → `{kind: 'drug'|'pair'|'renal'|'help'}`;
  `matchDrug(query, drugs)`: exact → prefix → substring (generic+trade) → Levenshtein ≤2
  เสนอ ≤3 ตัวเลือก
- `index.ts`: อ่าน `/rest/v1/drugs?select=data&status=eq.approved` (anon key จาก env ที่
  platform ฉีดให้) + cache in-memory 5 นาที → เจอ → **Flex Message card**
  (generic/trade, strength, reconst, dilution, rate, คำเตือน incompat 1 บรรทัด;
  footer = disclaimer + ปุ่ม `https://liff.line.me/{liffId}/index.html?drug={generic}` —
  deep link นี้ใช้ได้แล้ววันนี้); กำกวม → quick reply ให้เลือก; ไม่เจอ → คำแนะนำ + ลิงก์
  `index.html?search={query}`; ปิดท้าย log `LINE_QUERY` (fire-and-forget anon INSERT)
- ใหม่ `test/line-matcher.test.js` — golden cases (เช่น calcium gluconate ≠ bare calcium,
  trade name, สะกดผิด)
**ตรวจ**: พิมพ์ชื่อยา → ได้การ์ด; สะกดผิด → ได้ตัวเลือก; ปุ่มเปิดแอปตรงตัวยา;
แถว `LINE_QUERY` โผล่ในตาราง `events`

### Phase 4 — บอตเช็คคู่ Y-site + renal + deep link ใหม่ 2 จุด (M)
**โค้ด**
- `matcher.mjs`/`index.ts`: ไวยากรณ์คู่ (`A + B` / `A กับ B`) → อ่าน `compat_pairs`
  เทียบ key ทั้งสองลำดับ → แปลรหัสผล (`'c'`/`'i'`/variable — **ตรวจชุดรหัสจริงกับ
  compatibility.js ตอนลงมือ**) เป็นข้อความไทย + สัญลักษณ์ชัดเจน; `renal X` / `ไต X` →
  อ่าน `renal_drugs` ตอบตารางย่อ
- `js/compatibility.js`: ขยาย deep link block (`:908-921`) รองรับ `?a=&b=` → เลือกยา
  2 ตัว + เช็คอัตโนมัติ (additive — `?drug=` เดิมไม่แตะ)
- `js/renal-dosing.js`: เพิ่ม `?drug=` preselect ตาม pattern หน้าอื่น
- ship ด้วย `npm run release`
**ตรวจ**: ถามคู่ยาทั้งสองลำดับได้คำตอบเดียวกัน; ปุ่มจากบอตเปิดหน้า compat พร้อมยา 2 ตัว;
`renal meropenem` ตอบถูก; ลิงก์ `?drug=` เดิมยังใช้ได้

### Phase 5 — ประกาศด่วน: admin UI + route GAS (ยังไม่แตะ LINE) (M)
**Pre-check ก่อนเขียนโค้ด (~15 นาที)**: SW poll `checkUrgentAlerts` ที่ ANALYTICS URL
(`sw.js:776`) แต่ admin เรียก ADMIN GAS (`js/admin.js:174`) และ `getSS()` ผูก spreadsheet
คนละตัว (`gas-complete.js:35`) → ต้องยืนยันว่าจะสร้าง alert ที่ deployment ไหนให้ตรงกับ
ที่ SW poll (อาจต้องเพิ่มอีเมลเภสัชกรในชีต Users ของฝั่ง Analytics)
**โค้ด**
- `gas-complete.js`: route `createurgentalert`/`resolveurgentalert` เข้า doGet
  (ฟังก์ชันมีอยู่แล้ว `:2188-2222`, เดินตามแบบ `createdrug`); bump `GAS_VERSION`
- `js/admin.js` + `admin.html`: panel "ประกาศด่วน" — ฟอร์ม (type, severity, title,
  message, drugName, actionRequired) + รายการ alert ที่ active + ปุ่ม resolve;
  bump `EXPECTED_GAS_VERSION` (ตัวตรวจ drift จะบังคับให้ re-paste GAS)
- ship ด้วย `npm run release` · คู่มือ `04-urgent-alerts.md`: ขั้นตอน copy `gas-complete.js`
  ไปวาง **ทั้งสอง** GAS editor + Deploy ใหม่
**ตรวจ**: สร้าง alert จาก admin → แจ้งเตือนถึงเครื่อง client ภายใน 5 นาที (รอบ polling);
resolve ได้; version-check panel เขียว

### Phase 6 — Broadcast ประกาศด่วนเข้า LINE (S)
**โค้ด**
- `gas-complete.js`: ใน `createUrgentAlert` เมื่อ `data.lineBroadcast === true` →
  `_lineBroadcastAlert(alert)` = `UrlFetchApp` POST `https://api.line.me/v2/bot/message/broadcast`
  (Bearer token จาก Script Properties `LINE_CHANNEL_ACCESS_TOKEN`, `muteHttpExceptions: true`
  — **LINE ล้มต้องไม่ทำให้การสร้าง alert ล้ม** บันทึกผลลง audit log แทน);
  เพิ่ม doGet case `linequota` proxy `GET /v2/bot/message/quota` + `/quota/consumption`;
  bump `GAS_VERSION`
- `js/admin.js`/`admin.html`: checkbox "ส่งผ่าน LINE broadcast ด้วย" + dialog ยืนยัน
  แสดงโควตา ("จะใช้ N ข้อความ จากที่เหลือ X"); bump `EXPECTED_GAS_VERSION`; `npm run release`
- ใหม่ `docs/line-channel/SECRETS.md`: ตาราง secret × ที่เก็บ × วิธี rotate (ไม่มีค่าจริง)
**คอนโซล**: ตั้ง `LINE_CHANNEL_ACCESS_TOKEN` ใน Script Properties ของ GAS
(deployment ที่ระบุจาก Phase 5 pre-check)
**ตรวจ**: โควตาโชว์ใน admin; ทดสอบ broadcast ถึงมือถือตัวเอง (ตอนผู้ติดตามยังน้อย);
บังคับให้ LINE call ล้ม → alert ยังสร้างสำเร็จ + มี log

### Phase 7 — อัปเกรดปุ่มแชร์ (M)
**โค้ด**
- ใหม่ `js/liff-bridge.js` (~40 บรรทัด): ถ้า `IVDrugRef.isLineInApp()` → inject
  `https://static.line-scdn.net/liff/edge/2/sdk.js` → `liff.init({liffId})` →
  expose `window.__liffReady` (LIFF ID เป็นค่า public ใส่โค้ดได้)
- `js/share-export.js` `shareToLine()` (`:134-142`) — progressive enhancement:
  ใน LINE + `liff.isApiAvailable('shareTargetPicker')` → เปิดหน้าต่างแชร์จริง;
  มือถือเบราว์เซอร์ปกติ → `https://line.me/R/share?text=` (ถ้า popup โดนบล็อก →
  fallback clipboard); เดสก์ท็อป → clipboard เดิม **ไม่เปลี่ยน**; แนบ `method` ใน analytics
- `build.js` PAGES: เพิ่ม `liff-bridge.js` ใน 4 หน้าที่มี share-export
  (calculator, allergy, tdm, vanco-tdm)
- แก้ CSP meta (บรรทัด 5) เฉพาะ 4 หน้านั้น: `script-src` += `https://static.line-scdn.net`;
  `connect-src` += `https://api.line.me https://liffsdk.line-scdn.net https://api-data.line.me`
- ship ด้วย `npm run release`
**คอนโซล** (คู่มือ `05-share-upgrade.md`): เปิด scope `chat_message.write` ให้ LIFF app
(จำเป็นต่อ shareTargetPicker)
**ตรวจ**: ใน LINE แชร์ผล TDM → picker ขึ้นและส่งได้; Chrome Android → หน้าแชร์ LINE เปิด;
เดสก์ท็อปเหมือนเดิมทุกอย่าง; DevTools console ไม่มี CSP violation ทั้ง 4 หน้า

## 7. ตารางความเสี่ยง

| ความเสี่ยง | ตัวรับมือ (phase) |
|---|---|
| reload วนใน LINE WebView — `forceUpdate: true` เปิดอยู่จริงตอนนี้ | Phase 1 ship ก่อนเปิด rich menu: ใน LINE เปลี่ยน auto-reload เป็น banner/toast กดปิดได้ทั้งสอง path; sessionStorage guard เดิมคงไว้เป็นชั้นสอง |
| โควตา broadcast หมด (ฟรี ~300 ข้อความ/เดือน; 1 ครั้ง = จำนวนผู้ติดตาม) | Phase 6: proxy โควตา + dialog ยืนยันก่อนส่ง; ฟีเจอร์บอต (reply) ฟรีเสมอไม่เกี่ยวโควตา |
| Webhook ล่ม → บอตเงียบ | rich menu ไม่พึ่งบอต (ทางเข้าหลักไม่ล่มตาม); คู่มือวิธีดู log ใน Supabase dashboard + กด Verify ใหม่ |
| พิมพ์ชื่อยาผิด/กำกวม | ลำดับ match: exact → prefix → substring → edit-distance ≤2; กำกวม → เสนอตัวเลือก ไม่เดา; ล็อกพฤติกรรมด้วย golden tests |
| ความรับผิดทางคลินิก | บอต lookup-only เชิงโครงสร้าง (ไม่มีโค้ดคำนวณใน function); disclaimer ทุกคำตอบ; ข้อมูลชุดเดียวกับแอป; เภสัชกรรีวิวข้อความก่อน Phase 3 ขึ้นจริง |
| Secret รั่ว (repo public) | เก็บเฉพาะ Supabase secrets + GAS Script Properties; `SECRETS.md` บอกตำแหน่งไม่บอกค่า; sim script อ่านจาก env; กล่องเตือนหัวเอกสารนี้ |
| GAS 2 deployment drift (แก้แล้ว deploy ไม่ครบ) | ใช้ตัวตรวจ `GAS_VERSION`/`EXPECTED_GAS_VERSION` เดิม — ทุก phase ที่แตะ GAS ต้อง bump คู่ |
| สร้าง alert ผิด deployment (Admin vs Analytics spreadsheet) | Phase 5 มี pre-check เป็นขั้นแรกก่อนเขียนโค้ด |
| LINE in-app browser ไม่มี service worker (iOS) | ยอมรับได้: หน้าเว็บโหลดจากเน็ตปกติ แค่ไม่มี offline cache; SW registration มี feature guard อยู่แล้ว |

## 8. สิ่งที่แผนนี้ *ไม่* ทำ (ตัดสินใจแล้ว)

- ไม่ทำ LINE Login บนตัว PWA (ยังไม่มีเหตุต้องผูก identity ผู้ใช้)
- ไม่ทำ dose calculator / TDM ในแชต (กติกาความปลอดภัยข้อ 1)
- ไม่ย้าย backend เดิมใด ๆ — GAS/Supabase ทำหน้าที่เดิมทุกอย่าง
- ไม่ใช้ LINE Notify (บริการปิดแล้ว)
