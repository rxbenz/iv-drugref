> **บันทึกย้อนหลัง — เพิ่มเข้า `main` เมื่อ 2026-07-27**
>
> เอกสารนี้คือรายงานตรวจสอบจากต้นเดือน ก.ค. 2026 (ยุค v5.51.5 → v5.55) ซึ่งเดิม
> อยู่บน branch `claude/fable-app-comprehensive-review-lo0m8d` เท่านั้น ย้ายมาเก็บ
> ไว้ที่นี่เพื่อรักษาบันทึกว่า **ตรวจพบอะไร และตัดสินใจอย่างไร** ก่อนที่ branch
> นั้นจะถูกลบ
>
> ข้อค้นพบทั้งหมดถูกตรวจทานกับโค้ดบน `main` อีกครั้งเมื่อ 2026-07-27 และส่วนที่
> ยังใช้ได้ถูกนำเข้า `main` แล้วผ่าน **PR #27** (แก้บั๊กคณิตศาสตร์ใน Bayesian PK —
> v5.62.0) และ **PR #28** (clinical safety / infra+PWA / security / a11y) ส่วนที่
> เหลือประเมินแล้วว่าแก้ไปก่อนหน้านั้นแล้ว หรือไม่เข้ากับโครงสร้างปัจจุบัน
>
> ⚠️ **อย่าอ่านหัวข้อ "งานที่ต้องทำต่อ" ในเอกสารนี้เป็นรายการงานค้างปัจจุบัน** —
> มันสะท้อนสถานะของเดือนกรกฎาคม ดู [`ROADMAP.md`](../ROADMAP.md) และ
> [`CLAUDE.md`](../CLAUDE.md) สำหรับสถานะล่าสุด

# รายงานตรวจสอบทั้งแอพแบบ Comprehensive (IV DrugRef PWA)

**วันที่:** 2–3 กรกฎาคม 2026 · **เวอร์ชันฐาน:** 5.51.5 → **แก้เป็น 5.53.0**
**วิธีตรวจ:** ใช้ Fable 5 fan-out ตรวจหลายมิติแบบขนาน + ยืนยันบั๊คแบบ adversarial
(ตัวตรวจซ้ำพยายาม "หักล้าง" ทุก finding) แล้วผมตรวจโค้ดจริงซ้ำอีกชั้นก่อนแก้

> **สรุปสั้น (TL;DR):** ตรวจ **2 รอบ** ครบทั้ง 13 มิติ
> - **รอบ 1 (v5.52.0):** แก้ **23 จุด** — SW install ล้มเหลว, renal CDS, peds guard,
>   analytics, build/CI hardening (ดู §1–8)
> - **รอบ 2 (v5.53.0):** ตรวจลึก 8 มิติที่รอบแรกหยุดกลางคัน (security, GAS backend,
>   analytics, PWA, UI/UX, compat/DDI, allergy, admin) เจอ + แก้อีก **~30 จุด**
>   รวมบั๊ค **patient-safety under-warning** ที่อันตราย (ดู §9) และ **security
>   critical** (ดู §10)
>
> ทั้งหมดผ่าน **182 test** (เพิ่ม regression 15 เคส) + build prod สำเร็จ
>
> **⚠ ต้องทำต่อด้วยมือ:** deploy `gas-complete.js` v5.53.0 ขึ้น GAS ทั้ง 2 ตัว —
> มี fix สำคัญ (doPost drug-write routing, LockService, id-token verification,
> previousData strip) + safety gate เดิม — ดูหัวข้อ §12 "งานที่ต้องทำต่อ"

---

## 1. ภาพรวมสถาปัตยกรรม (System Architecture)

**สภาพโดยรวม:** โครงหลักแข็งแรงดี — script/link ของทั้ง 10 หน้าตรงกับ `PAGES` ใน
`build.js` (ลำดับโหลดถูกต้อง core.js → pk-models.js → tdm.js), เวอร์ชันตรงกันทุก
ไฟล์, drugCacheVer inject ทำงาน, test gate deploy อยู่

**ความเสี่ยงเชิงโครงสร้างที่ยังอยู่ (documented, ไม่ใช่บั๊คใหม่):**
- **Dual-backend GAS + Supabase + deploy GAS ด้วยมือ** — เป็นจุดเปราะที่สุดของระบบ
  แต่กำลังทยอยเลิกใช้ตาม roadmap อยู่แล้ว การ copy-paste code ขึ้น GAS 2 ตัวด้วยมือ
  = โอกาสที่ code สองฝั่งไม่ตรงกัน (ดูข้อ governance ด้านล่างที่กลายเป็นบั๊คจริง)

**แก้แล้วในรอบนี้:**
| # | ปัญหา | ระดับ | แก้อย่างไร |
|---|-------|-------|-----------|
| A1 | **SW precache `./error-tracker.js` ที่ไม่มีจริงใน dist → `cache.addAll` reject → SW install ล้มเหลวทุก deploy** | 🔴 High | ลบ entry ออก + เปลี่ยน install เป็น per-asset (`Promise.allSettled`) กัน 1 ไฟล์หายทำ SW ตายทั้งตัว |
| A2 | `build:dev` สร้าง dist ที่ 404 ทุก asset (ไม่ copy css/, js/) | 🟠 Med | `build()` โหมด dev copy `css/` + `js/` ไป dist |
| A3 | ไฟล์หายใน PAGES = แค่ warning, build ยัง exit 0 | 🟠 Med | เก็บ `MISSING_FILES` → `process.exit(1)` + เช็ค precache list ตรงกับ dist |
| A4 | ไม่มี CI ตอน PR (test รันแค่ตอน deploy หลัง push main) + tag backup ถูกสร้างก่อน test | 🟠 Med | เพิ่ม `ci.yml` (test+build บน PR) + ย้าย backup tag ไปหลัง test/build |
| A5 | `index.html`/`admin.html` ไม่มี BUILD marker → prod inline หลัง i18n (ลำดับต่างจาก dev) | 🟡 Low | ใส่ `<!-- BUILD:CSS/JS -->` ให้ตรงกับ 8 หน้าอื่น |

> **A1 คือ root cause ของมหากาพย์ v5.51.x ทั้งหมด** — เพราะ SW ตัวใหม่ install ไม่
> สำเร็จ ตัวเก่าจึงเป็น controller ตลอด, fix เรื่อง stale cache/skipWaiting ที่ทำมา
> ตั้งแต่ v5.51.1–5.51.2 ไม่เคยมีผล และเป็นเหตุให้ต้องใช้ `forceUpdate:true` แบบถาวร
> (blunt instrument) การแก้ A1 ควรทำให้ปัญหา "admin แก้แล้วแอพไม่อัปเดต" หายไปจริง

**คำแนะนำต่อ (ยังไม่แก้ในรอบนี้ — ต้องคุยก่อน):**
- หลัง A1 นิ่งแล้ว ค่อยตั้ง `version.json` `forceUpdate:false` เป็นค่า default
  (สงวน `true` ไว้เฉพาะ correction ทางคลินิกฉุกเฉิน) — ตอนนี้ทุก deploy บังคับ
  reload ทุก tab กลางคัน (เภสัชกรกำลังคำนวณ vanco อยู่ก็โดน) และ banner โชว์ git
  hash แทนเลขเวอร์ชัน ควรให้ build เขียนทั้งเวอร์ชันคนอ่าน + git hash แยกกัน

---

## 2. Data Design & Data Integrity

**สภาพโดยรวม:** dataset นิ่ง (`drugs-data.json` 166 ตัว schema สม่ำเสมอ ไม่มี id/
generic ซ้ำ), layer reshape ฝั่งอ่าน (Supabase readers) ระมัดระวังดี

**บั๊ค governance ที่ร้ายแรงที่สุด (แก้แล้ว):**
| # | ปัญหา | ระดับ | แก้อย่างไร |
|---|-------|-------|-----------|
| D1 | **Stale-Sheet second writer** — admin เขียน compat/DDI/renal ตรงเข้า Supabase แล้ว (v5.50–5.51) แต่ GAS ยังมี handler เดิมที่ปิดท้ายด้วยการ upsert **ทั้งตาราง**จาก Sheet (ที่ตอนนี้เก่าค้าง) กลับเข้า Supabase → ถ้ามีใครเรียก (admin panel เก่าใน cache / เรียก migrate*Now / hit public GAS URL) จะเขียนทับข้อมูลจริง: edit ที่แก้ไปหาย, pair ที่ลบไป**ฟื้นกลับมา** | 🔴 High | ใส่ safety gate: handler + migrate*Now ของ compat/DDI/renal ถูกปิดไว้ เว้นแต่ตั้ง Script Property `LEGACY_SHEET_CRUD=on` โดยเจตนา |

> D1 อันตรายเพราะเป็น**การ corrupt ข้อมูล clinical แบบเงียบ ๆ** — ข้อมูล
> incompatibility ที่ลบไปแล้วอาจฟื้นกลับมาโดยไม่มีใครรู้ และ `doGet` เชื่อ query
> param `user=` ตรง ๆ (spoof ได้) ทำให้ endpoint พวกนี้ยิงจากภายนอกได้

**บั๊ค data อื่นที่แก้แล้ว:**
| # | ปัญหา | ระดับ | แก้ |
|---|-------|-------|-----|
| D2 | core.js cache-normalization `return` กลางคัน → drug ที่ parse monitoring แล้ว จะข้าม categories/reconst/… (normalize ไม่ครบ) | 🟠 Med | เอา early return ออก, normalize ครบทุก field |
| D3 | `iv_drugref_last_sync` ถูก stamp ทุก page load → offline banner รายงานข้อมูลเก่าเป็น "เพิ่ง sync" | 🟠 Med | อ่านเวลา fetch จริงจาก `drugData_v4_ts` แทน `Date.now()` |
| D4 | compat pairs จาก Supabase: `result` หาย → default เป็น `'c'` (compatible) — fail-open อันตราย | 🟠 Med | fail closed: ทิ้ง row ที่ result ไม่ใช่ c/i/v |

**ยังเหลือ/แนะนำ (ไม่ใช่บั๊คโค้ด — ฝั่ง Supabase config):**
- 🟡 ตาราง refdata public-read เปิดให้อ่าน `data` jsonb ทั้งก้อน → หลุด email admin
  (`createdBy`), `previousData` snapshot, และ draft ที่ยังไม่ approve ควรทำ view ที่
  select เฉพาะ field ที่ client ต้องใช้ แทนการเปิดทั้ง row
- 🟡 `events.ts` เอกสารบอกว่า "server-set, client ปลอมเวลาไม่ได้" แต่จริง ๆ ยังมี
  `client_ts` ที่ client ส่งมา ควรตรวจว่า dashboard ใช้ `ts` (server) จริงทุกกราฟ

---

## 3. Clinical Calculators & Renal Dosing (สำคัญสุดต่อความปลอดภัยผู้ป่วย)

**สภาพโดยรวม:** สูตรหลักถูกต้อง — CG (มี ABW สำหรับคนอ้วน + female 0.85),
CKD-EPI 2021, Bedside Schwartz, Devine IBW, Mosteller BSA, drip-rate ทั้งหมด verify
ผ่าน แต่มีปัญหาเชิงโครงสร้าง + boundary หลายจุดที่กระทบ dose จริง

| # | ปัญหา | ระดับ | แก้อย่างไร |
|---|-------|-------|-----------|
| C1 | **Supabase override ทำให้ headline "Recommended" ไม่ขึ้นกับ GFR** — ยา renal ที่ดึงจาก Supabase คืน `recommended` เป็น string คงที่ (= dose ไตปกติ) ทุกค่า GFR → ผู้ป่วย ESRD เห็น dose ปกติ **และ** CDS contraindication (เช่น metformin GFR<30) หายเพราะ scan ไม่เจอคำว่า "ห้ามใช้" | 🔴 **Critical** | `getDosing(gfr)` เลือกแถว band ที่ตรง GFR มาสร้าง headline; ถ้าไม่ตรงเตือนแทนที่จะเดา dose ปกติ; `isDrugContraindicated` scan แถวที่ highlight ด้วย |
| C2 | **Infant (<1 ปี) "block" เป็นแค่ banner** — calculator + renal ยังคำนวณ/โชว์ dose ให้ทารกใต้ banner แดง | 🟠→🔴 High | เช็ค `getGuardStatus().blocked` แล้ว abort output จริง |
| C3 | **โหมดเด็ก: renal band ใช้ CG ผู้ใหญ่ แต่หน้าโชว์ Schwartz** — dose ถูก band ด้วยเลขที่ต่างจากที่โชว์ | 🟠→🔴 High | `getActiveGFR()` คืน Schwartz เมื่อ <18; label เปลี่ยนเป็น "(Schwartz)" |
| C4 | Vancomycin `Math.round(wt*15/250)*250` → **0 mg** เมื่อ ≤8 kg | 🟠 Med | floor ที่ 250 mg (ทั้ง renal-dosing + calculator) |
| C5 | Cefepime: GFR=30 ได้ q24h แต่ตาราง 30–60 บอก q12h + ช่วง 29–30 ไม่ highlight | 🟠 Med | จัด band ตาม Maxipime PI (>60/30–60/11–29/<11) ให้ contiguous |
| C6 | `rdRangeHit` มอง ≤/≥ เป็น strict → GFR ตรงขอบ band ไม่ match แถวไหนเลย | 🟠 Med | ≤/≥ (และ <=/>=) = inclusive |
| C7 | Paracetamol IV: หน้าเลือก indication ตัวแรกเสมอ → คน <50 kg เห็น dose ≥50 kg | 🟠 Med | เพิ่ม `when(pt)` เลือก indication ตามน้ำหนักจริง |
| C8 | Ceftazidime GFR 6–15 headline (`500 mg–1 g q24-48h`) ขัดกับตาราง+Fortaz PI | 🟠 Med | จัด headline ให้ตรง band ของมันเอง (500 mg q24h) |
| C9 | Aminoglycoside (amikacin/gentamicin) คิด dose บน TBW ไม่ปรับคนอ้วน | 🟠 Med | ใช้ AdjBW เมื่อ TBW >120% IBW (เหมือน colistin) |
| C10 | renal `getPatient()` คิด ABW ไม่มี guard underweight → ABW สูงกว่าน้ำหนักจริงในคนผอม | 🟡 Low | เพิ่ม guard (wt<IBW → ใช้ wt) ให้ตรง core.js `calcABW` |
| C11 | SCr toggle µmol↔mg/dL `toFixed(1)` → ค่าเพี้ยนทุกครั้งที่ toggle | 🟡 Low | ใช้ `toFixed(2)` ตอนแปลงกลับ |
| C12 | Enoxaparin ข้อความบอก "ไม่ปรับตามไต" แต่ `renalTiers` ปรับให้จริง | 🟡 Low | แก้ข้อความ assumptions ให้ตรงพฤติกรรม |

> **ทุกจุดในหมวดนี้ผมล็อกด้วย regression test** (`test/renal-dosing.test.js`, 11 เคส
> ใหม่) — เช่น "ESRD ต้องได้แถว band ไม่ใช่ dose ปกติ", "GFR ตรงขอบ 30 ต้อง match",
> "vanco 7 kg ต้องไม่ได้ 0 mg" เพื่อไม่ให้ regress กลับ

---

## 4. Core Frontend / Runtime (แก้แล้ว)

| # | ปัญหา | ระดับ | แก้ |
|---|-------|-------|-----|
| F1 | **ปุ่ม dismiss/รับทราบ urgent-alert ใช้ไม่ได้** — blob `parseInt('ALERT_...')` = NaN → banner z-index สูงค้างถาวร | 🟠→🔴 High | ลงทะเบียน delegate handler ใหม่ที่อ่าน id เป็น string |
| F2 | **DRUG_RATING + NPS_SUBMIT ยิงตรง GAS ไม่ผ่าน Supabase** → dashboard (อ่าน Supabase อย่างเดียวหลัง Phase 1) มองไม่เห็น rating/NPS หลัง migrate เลย | 🟠→🔴 High | เปลี่ยนไปใช้ `IVDrugRef.sendAnalytics` (dual-write + session id มาตรฐาน) |
| F3 | IndexedDB restore guard `!window.DRUGS` เป็น dead code (window.DRUGS ไม่มีจริง) → ทุกหน้า reload 1 ครั้ง | 🟠 Med | reload เฉพาะหน้า index ที่มี `#drugList` และ DRUGS ว่างจริง |
| F4 | FAB compat ยังใช้ matching เก่าก่อน P2.3 (salt collision) | 🟠 Med | port `keyCandidates` salt-aware มา (ดู C ในหมวด compat) |
| F5 | FAB drip-rate อ่านน้ำหนักจาก sessionStorage `patientContext` ที่ไม่มีใครเขียน (dead) | 🟠 Med | อ่านจาก `IVDrugRef.patientCtx` จริง |
| F6 | error-tracker `APP_VERSION` hardcode `5.11.1` (เก่า 40 release) | 🟠 Med | อ่าน `IVDrugRef.VERSION` แบบ lazy + fallback 5.52.0 |
| F7 | Esc ปิด urgent modal ไม่ได้ (`closeUrgentModal` ไม่ใช่ global) | 🟡 Low | fallback `urgentModal.remove()` |
| F8 | `events.app_version` = null เกือบทุก row | 🟡 Low | default เป็น `IVDrugRef.VERSION` ใน sendToSupabase |
| F9 | star-rating `data-name` escape ซ้ำ 2 รอบ (`&amp;amp;`) | 🟡 Low | ตัด escape ซ้ำ (ตัว renderer escape ให้แล้ว) |
| F10 | `#qaDripConcs` เพิ่ม click listener ใหม่ทุกครั้งที่เลือกยา | 🟡 Low | bind ครั้งเดียวด้วย flag |

---

## 5. Security (สรุปผลตรวจ — ส่วนใหญ่ผ่าน)

**ผ่าน:**
- ✅ ไม่มี `sb_secret_`/`service_role` หลุดใน client — service key อ่านจาก GAS
  Script Properties เท่านั้น (`SUPABASE_SERVICE_KEY not set` throw ถ้าไม่มี)
- ✅ CSP มีครบทั้ง 10 หน้า + `connect-src` มี supabase.co
- ✅ RLS `events`: anon INSERT ได้อย่างเดียว, ไม่มี SELECT/UPDATE/DELETE policy
- ✅ dashboard บังคับ Supabase Auth + verify `is_admin()` RPC
- ✅ XSS chokepoint: `escHtml` deep-copy ใน renderer, interactions.js/allergy.js
  escape remote strings แล้ว — **รอบนี้เพิ่มการ escape ใน renal-dosing.js** (ตาราง
  + ชื่อยา + badge ที่ตอนนี้มาจาก Supabase = admin-authored → stored-XSS vector)

**แนะนำต่อ (config ฝั่ง Supabase/GAS — ทำนอกโค้ด):**
- 🟡 refdata public-read เปิด jsonb ทั้ง row (email admin/draft หลุด — ดู §2)
- 🟡 GAS `doGet`/`doPost` เชื่อ `user=` param ตรง ๆ (spoof identity ได้) — safety
  gate D1 ที่เพิ่มลดความเสียหายของ endpoint compat/renal/DDI แล้ว แต่ handler
  drug/allergy/user ยัง trust param นี้ ควรย้ายไป verify token จริงใน Phase ต่อไป
- 🟡 admin.html โหลด PapaParse จาก CDN — มี SRI แล้ว (ดี); GIS ไม่มี SRI (Google
  ไม่การันตี content — ยอมรับได้)

---

## 6. GAS Backend, Analytics & PWA/Operations (สรุป)

**GAS backend:** action handler ครบ, dual-write helper best-effort (ไม่ block user
ถ้า Supabase ล่ม) — จุดเสี่ยงหลักคือ D1 (แก้แล้วด้วย gate) + trust `user=` param
(§5) `GAS_VERSION` bump เป็น 5.52.0 แล้ว **แต่ต้อง deploy ด้วยมือ**

**Analytics/Dashboard:** F2 (rating/NPS หาย) + F8 (app_version null) แก้แล้ว —
สองอย่างนี้เคยทำให้ข้อมูล research เพี้ยนเงียบ ๆ; dashboard paging cap 200k rows
ไม่มี retention filter (🟡 ปรับปรุงในอนาคตเมื่อ event เยอะขึ้น)

**PWA/Ops:** A1 (SW install fail) คือปัญหาใหญ่สุด — แก้แล้ว; precache list ครบ 10
หน้า; manifest version bump 5.11.1 → 5.52.0; build มี guard เช็ค precache vs dist
แล้ว (กันเคสเดิมเกิดซ้ำ)

---

## 7. งานที่ต้องทำต่อ (ต้องทำด้วยมือ — ผมทำให้ไม่ได้)

1. **🔴 Deploy `gas-complete.js` v5.52.0 ขึ้น GAS ทั้ง 2 ตัว** (Admin + Analytics)
   → New deployment → Web app ทั้งคู่ **สำคัญ:** มี safety gate `LEGACY_SHEET_CRUD`
   ใหม่ที่กันข้อมูล Supabase ถูกเขียนทับ ถ้าไม่ deploy gate จะยังไม่มีผลกับ live
   - ถ้ายังต้องใช้ path เก่าชั่วคราว → ตั้ง Script Property `LEGACY_SHEET_CRUD=on`
     โดยเจตนา (ไม่แนะนำ)
2. **🟡 พิจารณาตั้ง `version.json` `forceUpdate:false`** เป็น default หลังยืนยันว่า
   A1 ทำให้ SW อัปเดตได้เองแล้ว (ทดสอบบนมือถือจริง 1 รอบ)
3. **🟡 ปิด jsonb ทั้ง row ของ refdata public-read** (ทำ Postgres view select เฉพาะ
   field ที่ client ใช้) เพื่อไม่ให้ email admin/draft/previousData หลุด
4. **🟡 (Phase ต่อไป)** ย้าย admin write ทั้งหมด (drug/allergy/user) จาก GAS →
   Supabase direct + verify token จริง แทน trust `user=` param

---

## 8. ผลการทดสอบ

- ✅ `npm test` — **178 tests ผ่านทั้งหมด** (จากเดิม 167 + 11 เคสใหม่)
- ✅ `node build.js --prod` — build 10 หน้าสำเร็จ, precache check ผ่าน (16 assets)
- ✅ `node build.js --dev` — copy css/ + js/ ครบ (เดิม 404)
- ✅ syntax check ทุกไฟล์ที่แก้ผ่าน (รวม gas-complete.js, sw.js, build.js)

**หมายเหตุกระบวนการ (รอบ 1):** การ fan-out ตรวจเชิงลึกครบ 4 มิติ (architecture,
data-design, core-frontend, clinical-calculators) แล้ว **หยุดกลางคันเพราะชน monthly
spend limit** — มิติที่เหลือตรวจต่อในรอบ 2 (§9–11)

---

# ══════════ รอบ 2 (v5.53.0) — 8 มิติที่เหลือ ══════════

รอบ 2 fan-out subagent 8 ตัวขนานตรวจลึกมิติที่เหลือ (security, GAS backend,
analytics/dashboard, PWA/ops, UI-UX/a11y/i18n, compat/DDI, allergy, admin
governance) แล้วผมยืนยันกับโค้ดจริงทุก finding ก่อนแก้ **จุดที่ security กับ admin
governance เจอตรงกันแบบอิสระ (convergent) = สัญญาณว่าเป็นของจริง**

## 9. Patient-Safety Under-warning (compat/DDI + allergy) — อันตรายสุด, แก้แล้ว + ล็อกด้วย test

จุดเหล่านี้คือ **"เตือนน้อยกว่าที่ควร"** ในทิศทางที่เป็นอันตราย (บอกว่าปลอดภัยทั้งที่ไม่)

| # | ปัญหา | ระดับ | แก้ |
|---|-------|-------|-----|
| R1 | **DigiFab (ยาแก้พิษ digoxin) ยิง alert พิษ digoxin ทั้งหมด** — `indexOf('digoxin')` จับ "Digoxin-specific antibody (DigiFab)" → DigiFab+Amiodarone/Calcium ขึ้นเตือนกลับด้าน | 🟠 High | neutralize token antidote ในสตริงที่ใช้ match (คงชื่อแสดงผล) + test |
| R2 | **Calcium/Magnesium + Potassium phosphate → "เข้ากันได้"** ทั้งที่ทั้งคู่ระบุตกตะกอน (calcium-phosphate precipitation คลาสสิก) — bare-cation `calcium|potassium='c'` รั่วไปทับ | 🟠 High | เพิ่ม salt-specific 'i' rows (ชนะ fallback) + test |
| R3 | **carbapenem→carbapenem → "เสี่ยงน้อยมาก ให้ได้ไม่ต้องทดสอบ"** — ผู้ป่วยแพ้ meropenem ถูกบอกว่า imipenem ปลอดภัย (rule 4 ไม่เช็ค allergen) | 🟠 High | เพิ่ม rule carbapenem↔carbapenem = high + gate rule 4 (`a.class !== 'carbapenem'`) + test |
| R4 | **compat Supabase sync ลบ built-in 250+ pairs ทิ้ง** — sync ที่ไม่ครบทำ known incompatibility กลายเป็น nodata ทุก page load | 🟠 High | `rebuildCuratedMap` **merge** จาก built-in เป็นฐาน แล้ว overlay sheet (ไม่ wipe) + test |
| R5 | **SCAR (SJS/TEN/DRESS) ไม่ถูกยกระดับเป็นแดง** สำหรับกลุ่ม non-beta-lactam — sulfa/anticonvulsant SCAR (ตัวการ SCAR คลาสสิก) ได้แค่กล่องน้ำเงิน | 🟠 Med→High | เพิ่ม red banner เมื่อ `sev.id==='scar'` แม้ไม่ blocked |
| R6 | **allergy ค้นด้วยชื่อการค้าไม่เจอ** — "Bactrim"/"cotrimoxazole"/"Rocephin" คืน "ไม่พบยา" → ไม่ได้เตือน cross-reactivity เลย | 🟠 Med | search รวม trade + id |
| R7 | compat "variable" hint กว้างเกินไป — ยาที่ text มีคำว่า "variable" ทำให้คู่ที่ไม่เกี่ยวขึ้น caution | 🟠 Med | emit variable เฉพาะเมื่อคำอยู่คู่กับชื่อยาคู่ตรวจ |
| R8 | drug-fluid pairs (Daptomycin+RL ฯลฯ) วางผิดใน CURATED ที่ถูก sync ลบ | 🟠 Med | ย้ายเข้า FLUID_CURATED |
| R9 | DDI analytics `top_severity` ไม่รู้จัก "contraindicated" | 🟡 Low | เพิ่ม `contraindicated:4` |

> **หมายเหตุคลินิก (ไม่แก้เอง — ฝากตรวจ):** agent เสนอว่า **cefuroxime** ถูกจัดผิด
> cluster (methoxyimino) — R1 จริงเป็น furanyl ไม่ใช่ aminothiazolyl → อาจ
> overstate cross-reactivity ผม**ไม่แก้ให้** เพราะเป็นการ **ลด** warning และคุณเป็น
> เภสัชกรที่ควรตัดสิน (over-warning = ปลอดภัยกว่า) — ถ้ายืนยันว่าถูกต้องแล้วบอกได้ครับ

## 10. Security & Governance — convergent CRITICAL, แก้แล้ว (บางส่วนต้อง deploy)

| # | ปัญหา | ระดับ | แก้ |
|---|-------|-------|-----|
| S1 | **GAS เชื่อ `user=` param ไม่ verify → ยิง URL ตรง ๆ แก้ข้อมูลยา/อนุมัติ draft/ตั้งตัวเองเป็น admin** (security + admin agent เจอตรงกัน) | 🔴 **Critical** | admin.js ส่ง Google **id_token** (JWT ที่เซ็นแล้ว); GAS เพิ่ม `_verifyIdToken`/`_resolveUser` verify ฝั่ง server → ใช้ email จาก token **เปิดใช้ด้วย `REQUIRE_ID_TOKEN=on`** (opt-in กันล็อก admin ก่อนทดสอบ) |
| S2 | **Stored XSS ใน dashboard** — NPS comment + drug name จาก event ที่ anonymous ใส่ได้ → รันใน session admin | 🟠 High | `esc(r.comment)` + `esc(d.name)` |
| S3 | **GitHub PAT (scope repo → push main → auto-deploy) เก็บ localStorage** → XSS ดึงไปได้ = รันโค้ดใส่ทุกเครื่อง | 🟠 High | ย้าย ghToken → **sessionStorage** (ล้างเมื่อปิด tab) + migrate ของเก่า |
| S4 | **doPost ไม่มี handler สำหรับ drug write** → edit >6KB (ไทยเยอะ + previousData) หลุดเป็น junk analytics แต่ UI ขึ้น "สำเร็จ" (ข้อมูลหาย) | 🟠 High | route drug/user single-write ใน doPost |
| S5 | direct-Supabase edit (compat/DDI/renal) ไม่มี **audit trail** — ข้อมูล safety-critical เขียนตรงไม่มี who/when | 🟠 High | *(ยังไม่แก้ — ต้องทำ Postgres trigger; §12)* |
| S6 | ไม่มี **LockService** → concurrent edit ทับ row ผิด | 🟠 Med | เพิ่ม script lock รอบ mutating action ทุกตัว |
| S7 | diff-review "before" (previousData) client ส่งมาได้ → ปลอม diff ให้ดูไม่มีพิษ | 🟠 Med | strip `previousData`/`idToken`/`user`/`action` จาก client payload (server เป็นคนเขียน snapshot เท่านั้น) |
| S8 | Supabase drugs public-read เห็น draft ที่ยังไม่ approve + previousData ผ่าน `?status=neq.approved` | 🟠 Med | RLS `drugs` public read เฉพาะ `status='approved'` (IaC) + strip previousData/createdBy ตอน sync |
| S9 | events read policy อยู่แค่ใน comment (SQL ไม่ converge กับ prod) | 🟡 Med | เปิด policy `admin read events` เป็น IaC จริง (auth.sql) |
| S10 | errorResponse echo `err.message` (spreadsheet id/stack หลุด) | 🟡 Low | log ภายใน + คืนข้อความ generic |
| S11 | gas-update-rating-nps.js เป็น dead duplicate ที่ทับ handler จริงถ้า paste | 🟡 Low | ลบไฟล์ |

> **จุดที่ตรวจแล้ว "ผ่าน" (ยืนยันแล้ว):** admin write ตรง Supabase ใช้ RLS
> `is_admin()` server-enforced (anon key เขียนไม่ได้); ไม่มี service key หลุด client;
> RLS events = anon INSERT อย่างเดียว; XSS chokepoint ส่วนใหญ่ผ่าน escHtml

## 11. Analytics · PWA · UI/UX — แก้แล้ว

**Analytics/Dashboard:**
- 🟠 offline IndexedDB queue flush เข้า **Supabase** ด้วย (เดิมเข้า GAS อย่างเดียว →
  dashboard มองไม่เห็น event ที่เก็บตอน offline) + clear เฉพาะที่ส่งแล้ว
- 🟠 `page_view` นับ 2 เท่า (enter+leave) → นับเฉพาะ enter (แก้ Page Views + flow self-loop)
- 🟠 daily bucket ใช้ UTC ปนกับกราฟ +7 → helper `thDate()` +7 ทุกที่ (filter + daily + default window)
- 🟡 paging เพิ่ม tiebreaker `.order('id')` (กัน skip/dup ที่ ts ซ้ำ) + warn เมื่อชน cap 200k

**PWA/Operations:**
- 🟠 **build.js stamp git hash เข้า `dist/sw.js` CACHE_NAME** — เดิม build ไม่แตะ sw.js
  เลย → deploy ที่แก้แค่ HTML/CSS/JS ไม่ install SW ใหม่ (ต้นเหตุ stale-SW เกิดซ้ำได้)
- 🟠 SW `caches.match(..., {ignoreSearch:true})` — deep-link ที่มี query (`?search=`,
  `?drug=`) offline เดิมเจอหน้า 503 ทั้งที่ cache มี
- 🟡 precache `icon-96x96.png` (badge notification)

**UI/UX & a11y:**
- 🟠 **compat matrix เป็น color-only → colorblind อ่านผิด** — เพิ่ม glyph C/I/V/? ในทุก
  cell (สี+ตัวอักษร) + incompatible เป็นแดงเข้ม/ตัวหนา
- 🟠 result card "incompatible" ไม่เด่นกว่า compatible + คำไม่แดง → เพิ่มแถบซ้ายแดง + ตัวหนา
- 🟡 aria-label ช่องค้นหา (index/compat/renal) + ปุ่ม ✕ ล้างค้นหา

## 12. งานที่ต้องทำต่อ (รอบ 2 — ต้องทำด้วยมือ)

1. **🔴 Deploy `gas-complete.js` v5.53.0 ขึ้น GAS ทั้ง 2 ตัว** — รอบนี้มี fix สำคัญ:
   doPost drug-write routing (กันข้อมูลหาย), LockService, id-token verify, strip
   previousData, errorResponse generic ถ้าไม่ deploy fix เหล่านี้จะยังไม่มีผล
2. **🔴 เปิด id-token verification:** หลัง deploy แล้ว ตั้ง Script Property
   **`REQUIRE_ID_TOKEN=on`** ในทั้ง 2 GAS แล้วทดสอบ login+แก้ยา 1 ครั้ง (ปิด critical
   auth hole) — ⚠ id_token อายุ ~1 ชม. ถ้า session ยาวกว่านั้นอาจต้อง re-login;
   ทดสอบก่อนเปิดถาวร
3. **🟠 รัน SQL ใหม่ใน Supabase:** `supabase/refdata.sql` (drugs public-read เฉพาะ
   approved) + `supabase/auth.sql` (admin read events policy) — เป็น IaC ให้ repo ตรงกับ prod
4. **🟠 audit trail สำหรับ direct-Supabase edit (S5):** ยังไม่แก้ในโค้ด — แนะนำทำ Postgres
   trigger เขียน `audit_log` (actor จาก `auth.jwt()`) บนตาราง compat/renal/ddi/allergy
5. **🟡 (คลินิก) ตรวจ cefuroxime cluster** (§9 หมายเหตุ) — ตัดสินใจว่าจะแยก cluster ไหม
6. **🟡 งาน a11y/i18n ที่เหลือ (บันทึกไว้ ไม่เร่ง):** modal focus-trap ครบทุก dialog,
   label `for=` ครบใน tdm/vanco, i18n coverage ของ verdict allergy/compat ใน EN mode

---

# ══════════ รอบ 3 (v5.54.0) — กลุ่ม medium/improvement ที่เหลือ ══════════

หลังปิด critical/high ครบแล้ว รอบนี้ลุยกลุ่ม 3 (medium/ปรับปรุง) ที่ค้างไว้

## 13. i18n — verdict ความปลอดภัยเป็นสองภาษา (EN mode ไม่โชว์ไทยแล้ว)

agent ให้ high เพราะเสี่ยง misread ตอนสลับ EN ผมทำ verdict ที่เป็น**จุดตัดสินใจ
ทางคลินิก**ให้ 2 ภาษา (ตัวเนื้อความบรรยายปล่อยให้ i18n engine เดิมจัดการ) + เพิ่ม
`languageChanged` listener ให้ re-render ผลที่แสดงอยู่:
- **allergy:** หัวข้อ avoid/safer/caution, tier label (แพ้ข้ามสูง→High cross-reactivity),
  แถบ SCAR ทั้ง beta-lactam + non-beta-lactam
- **compat:** label 2-drug card (เดิม hardcode อังกฤษแม้อยู่โหมดไทย), diluent, สรุป 3+ ตัว
- **calculator:** headline "⚠ หลีกเลี่ยง / ปรึกษาเภสัช" → bilingual
- allergy disclaimer/meta เดิมเขียน "beta-lactam only" → อัปเดตเป็นรายการกลุ่มยาจริง
- *(renal free-text ในข้อมูลยาปล่อยไทยไว้ — เป็น clinical content ไม่ใช่ UI chrome)*

## 14. Accessibility

- **TDM + Vanco:** เพิ่ม `label for=` ครบทุก input (47 + 11 label) — เดิม screen reader
  ไม่รู้ว่าช่องไหน weight/SCr/age
- **shared `IVDrugRef.trapFocus()`** ใน core.js — set role=dialog/aria-modal, trap Tab,
  คืน focus ให้ปุ่มเดิมตอนปิด → wire เข้า renal recom modal + urgent-alert modal
  (safety surface). modal อื่น (admin/survey/filter-sheet) ใช้ helper เดิมต่อได้

## 15. Admin governance

- **validation ก่อนเขียน Supabase:** compat (result ต้อง c/i/v, ห้ามยาซ้ำกัน), renal
  (ต้องมี recommended หรือตาราง, dose ห้ามว่าง, ช่วง GFR ต้องมีตัวเลข/HD/CAPD)
- **bulk import เตือนจำนวนที่จะเขียนทับ** — คำนวณ overlap กับ Supabase แล้วบอกชัดว่า
  จะทับกี่ตัว (กัน revert edit ที่เพิ่งแก้ในแผงเงียบ ๆ)
- **updated_at trigger** (refdata.sql) — bump ทุก UPDATE เป็นรากฐานของ optimistic
  concurrency + สัญญาณ "แก้ล่าสุดเมื่อไหร่" *(precondition check เต็มยังต้องทำต่อ)*

## 16. Analytics fidelity

- **rate limit 20→60/นาที** + เกิน cap → queue ไว้ flush ไม่ทิ้ง (power user ที่ค้นเร็ว
  ไม่ถูกตัด) + ย้าย counter ให้ offline event ไม่กิน budget + flush queue ทุกต้นนาที
- **cross-filter denominator ซื่อสัตย์:** scan ทั้ง dataset (ไม่ใช่ 50 แถวแรก) หา
  applicability; ถ้า filter มิติข้อมูล (drug/class/…) active แต่ dataset ไม่มี field นั้น
  → **ตัด dataset ออก** ไม่ใช่ปล่อยผ่านทั้งก้อน (กัน "480 users" โผล่ข้าง "12 Vanco searches")

## 17. งานที่ยังเหลือหลังรอบ 3 (บันทึกไว้)

- cefuroxime cluster (clinical call ของคุณ)
- + งาน deploy กลุ่ม 1 เดิม (GAS v5.54.0, `REQUIRE_ID_TOKEN=on`, รัน SQL)

> ✅ 3 ข้อแรก (concurrency / audit trail / focus-trap ที่เหลือ) **ทำครบแล้วในรอบ 5
> (v5.56.0)** ด้านล่าง

---

# ══════════ รอบ 4 (v5.55.0) — Vanco Bayesian engine ══════════

Adversarial review ของ Vancomycin TDM (bayesian) — reviewer อิสระ 2 คน ยืนยันเชิงตัวเลข
เจอ **2 บั๊คคณิตศาสตร์** ในเครื่องยนต์ PK (`js/pk-models.js`) ที่ทำให้ตัวเลขที่แพทย์ใช้
ตัดสินใจ (AUC₂₄ + individual estimate) ผิด — ค่า CL ประชากรและจลนศาสตร์ 1-/2-comp
ถูกต้องอยู่แล้ว (ไม่แตะ)

| # | บั๊ค | ผลต่อคลินิก | แก้ |
|---|------|-------------|-----|
| V1 | `calcAUC_ss` ใช้ numeric integrator ที่มี carry term ผิด (เลขชี้กำลังผิด + clamp) → AUC ต่ำกว่าจริง 3%@1h ถึง 12%@4h infusion | 🔴 ยิ่ง infusion ยาว (dose สูง) ยิ่งต่ำ → under-dose | คืนค่า **exact `dose/CL`** (SS mass balance, ไม่ขึ้นกับ compartment/infusion) |
| V2 | MAP/MCMC หารด้วย ω/σ แทนที่จะเป็น **variance ω²/σ²** (ค่าที่เก็บคือ CV/SD) | 🔴 ระดับที่วัดได้ถูกถ่วงน้ำหนักต่ำ → estimate หดเข้าหา population (ตรงข้าม Bayesian); CI กว้างเกิน ~2.5× | ยกกำลังสองด้วย `_v2()` ใน **ทั้ง 4 fitter** (bayesianMAP, runMCMC, bayesianMAP2c, runMCMC2c) |

- โบนัส: 1-comp `runMCMC` proposal step ใช้ `2.4/√2` (จาก over-stepping) — acceptance ≈0.45
- ล็อกด้วย golden test ใหม่: AUC24 แบบ exact (Buelga 334 / Goti 548 / Llopis 572),
  infusion-independence lock, และ MAP shrinkage-magnitude lock (cl/popCL ≈0.671 สำหรับ
  trough +50% — จะ regress กลับเป็น ≈0.74 ถ้า divisor ผิดกลับ)

---

# ══════════ รอบ 5 (v5.56.0) — Governance + a11y (B4/B5/B6) ══════════

ปิด 3 ข้อที่ค้างจาก §17 หลังจาก compat/DDI/renal ย้ายไปเขียน **ตรงเข้า Supabase**
(ข้าม GAS `addAuditLog` เดิม) — ทำให้ path ตรงนี้ถูกกำกับดูแลเท่ากับตอนผ่าน GAS

| # | งาน | ทำอะไร |
|---|-----|--------|
| **B4** | Audit trail | `supabase/audit.sql` — ตาราง `audit_log` (append-only) + trigger **SECURITY DEFINER** `log_audit()` บนทุกตาราง clinical บันทึก actor/action/before/after — **client ปลอมหรือข้ามไม่ได้** (รันเป็น definer, RLS ให้ admin อ่านอย่างเดียว) อ่านผ่าน `AdminSupabase.getAuditLog()` |
| **B5** | Optimistic concurrency | getter คืน `updated_at` เป็น `_updatedAt`; ตอน **แก้ไข** admin.js ส่งกลับ, UPDATE ถูก guard ด้วย `.eq('updated_at', seen)` → 0 rows = มีคนอื่นแก้ก่อน → throw `CONFLICT` → `_conflictToast()` แทนการเขียนทับเงียบ ๆ (อาศัย trigger `touch_updated_at` จาก refdata.sql) |
| **B6** | Focus-trap ที่เหลือ | `IVDrugRef.trapFocus` ต่อเข้ากับ: filter sheet หน้า index (monkey-patch blob `openFilterSheet`/`closeFilterSheet`), survey dialog (`survey.js`), และ admin modal ทุกตัว (`_trapModal`/`_releaseModal` keyed ตาม id — diff modal ซ้อนบน drug modal คืน focus ถูก) |

**⚠ ต้องทำด้วยมือ:** รัน `supabase/audit.sql` ครั้งเดียวใน Supabase SQL editor —
ก่อนหน้านั้น direct-Supabase edit ยังไม่ถูกบันทึก

---

## สรุปผลการทดสอบ (รวม 5 รอบ)

- ✅ `npm test` — **183 tests ผ่านทั้งหมด** (167 เดิม + 16 regression clinical/PK)
- ✅ `node build.js --prod` — build 10 หน้าสำเร็จ, sw.js CACHE_NAME stamp ทำงาน,
  precache check ผ่าน (17 assets)
- ✅ syntax check ทุกไฟล์ที่แก้ผ่าน (รวม gas-complete.js, sw.js, build.js)
- ทุก finding ยืนยันกับโค้ดจริงก่อนแก้ (ไม่เชื่อ finding ดิบ); จุด clinical ทุกจุดมี
  regression test ล็อกไว้กัน regress; บั๊ค vanco 2 ตัวยืนยันด้วย reviewer อิสระ 2 คน
- **เวอร์ชันปัจจุบัน: 5.56.0**
