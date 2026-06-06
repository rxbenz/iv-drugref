# IV DrugRef PWA — Roadmap

> สถานะปัจจุบัน: **v5.11.1** · จัดลำดับตามความเหมาะสม: ความปลอดภัยผู้ป่วย →
> ความถูกต้องของข้อมูล → หนี้ทางสถาปัตยกรรม → ฟีเจอร์ → การขัดเกลา
> (อ้างอิงจาก code จริง + Pending Items ใน `CLAUDE.md`)

นิยามระดับความสำคัญ:
- **P0** — กระทบความปลอดภัย/ความถูกต้องทางคลินิกโดยตรง ต้องทำก่อน
- **P1** — หนี้ทางสถาปัตยกรรม/operational ที่บล็อกงานอื่น
- **P2** — ความสดของข้อมูล + ฟีเจอร์ที่ค้างไว้
- **P3** — คุณภาพโค้ด/ความปลอดภัยเชิงป้องกัน/ขัดเกลา

---

## P0 — ความปลอดภัย & ความถูกต้องทางคลินิก (ทำก่อน)

### P0.1 สร้าง automated test suite สำหรับสูตรคลินิก ⭐ สำคัญที่สุด — 🟡 IN PROGRESS
- **ปัญหาเดิม**: `npm test` ชี้ไฟล์ที่ไม่มีจริง → แอปคำนวณยาโดยไม่มี test เลย
- **ทำแล้ว (✅)**:
  - `test/clinical-formulas.test.js` (`node --test`, 30 เคส) โหลด **โค้ดจริง**
    (`core.js` + vanco PK models) ใน `vm` sandbox โดยไม่แก้ไฟล์แอป
    (`test/helpers/load-clinical.js` stub browser globals)
  - ครอบ golden values จาก `CLAUDE.md`: CG/CG-raw/Schwartz/IBW/ABW/BSA/BMI/
    CKD-EPI 2021/CKD stage + vanco 5 โมเดล (Buelga 5.99, Goti 3.65, Llopis 3.49)
    + Colin 2019 (35yo→4.10, 60yo→2.55, heme ×1.294)
  - ผูก CI แล้ว: step `npm test` ใน `deploy.yml` รันก่อน build → deploy ล้มถ้า test แดง
- **เหลือทำ (🟡)**:
  - integration test ของ Bayesian engine (`bayesianMAP`/`runMCMC`, AUC₂₄ end-to-end)
    — ติดที่ engine ผูกกับ DOM หนัก (engine ยังอยู่แยกในแต่ละเพจ)
  - ~~golden test ฝั่ง `tdm.js`~~ ✅ ปิดแล้วโดย P1.1 (ทั้งสองเพจใช้ `pk-models.js`
    ชุดเดียว → test เดียวคุมทั้งคู่)
- **Effort เหลือ**: S–M · **ผลตอบแทน**: สูงมาก (safety net ให้ refactor P1)

### P0.2 ปิด silent CG override ใน Bayesian engine — ✅ RESOLVED (ส่วนใหญ่แก้ไปแล้ว)
- **ปัญหาเดิม** (โน้ต v5.9.3): หน้าจอแสดง Schwartz (เด็ก) แต่ engine
  (`bayesianMAP`/`runMCMC`) แอบคำนวณ CG (ผู้ใหญ่) → display≠engine
- **ผลการสำรวจ (สำคัญ)**: bug นี้ **ถูกแก้ไปแล้ว** โดยงานรุ่นหลัง —
  - v5.10.0: engine เปลี่ยนมาใช้ `model.crclFn(pt)` / `model.clFn(pt)`
    (แต่ละโมเดลคิดไตเอง ไม่ hardcode CG)
  - v5.11.0: เด็ก 1-17 → Colin model (crclFn = Schwartz, clFn ใช้ SCr ตรง ๆ)
  - พิสูจน์ด้วยเคสเด็กจริง (อายุ 10): engine CrCl = Schwartz 139.4 = หน้าจอ
    (ไม่ใช่ adult CG 135.4); Colin CL ไม่พึ่ง CG เลย
- **ทำแล้ว (✅)**:
  - เพิ่ม regression test "display↔engine CrCl consistency (P0.2 guard)" ล็อกไว้
    (peds → Schwartz ไม่ใช่ CG; Colin CL เป็น SCr-driven) — กันถอยกลับ
  - แก้โน้ต stale ใน `CLAUDE.md` (เลิกบอกว่ายังค้าง)
- **non-vanco — ลงลึกแล้ว (✅ ปลอดภัยโดยโครงสร้าง ไม่ต้องแก้)**:
  ตรวจ run path จริงของ phenytoin/AG/valproate/tacrolimus/digoxin/warfarin
  ทุกตัวทำ `const pt = updateCrCl();` **ครั้งเดียว** แล้วใช้ `pt` ตัวนั้นทั้ง
  แสดงผล + คำนวณ (เช่น AG: `popKe = p.popKe(pt.crcl)`) → display กับ engine
  ใช้ object เดียวกัน field เดียวกัน **เป็นไปไม่ได้ที่จะไม่ตรงกัน**; และ
  `updateCrCl()` route Schwartz ให้เด็กอยู่แล้ว (บรรทัด 60-64) → ไม่มี CG
  override. ชั้นความปลอดภัย 2 ชั้น: (1) guard บล็อกเด็ก (2) updateCrCl ให้
  Schwartz. **สรุป: ไม่ harden** เพราะจะเป็น churn บนโค้ดคลินิกที่ถูกอยู่แล้ว
- **สถานะ**: ✅ ปิด — ไม่เหลืองานโค้ด (P0.2 = verified resolved + protected by tests)

### P0.3 2-compartment engine (peak/trough fidelity)
- **ปัญหา**: engine เป็น 1-comp; AUC₂₄ แม่นยำ (compartment-independent) แต่
  peak/trough เป็นค่าประมาณ — v5.11.1 ต้องขึ้น disclaimer amber ในเด็ก
  (ω_Vss เป็น lognormal approx ของ V1+V2, V2 IIV 97.9%)
- **ทำอะไร**: Option A — 2-comp engine + 4-param fit แยก V1/V2 IIV; เปิดทาง
  ให้ Colin additive residual error term (1.23 mg/L SD) ที่ตอนนี้ยังไม่ถูกโมเดล
- **Effort**: L · **ผลตอบแทน**: กลาง (เฉพาะเคสที่ต้องพึ่ง peak/trough จริง)
- **ขึ้นกับ**: ควรทำหลัง P0.1 (มี test กันถดถอย) และ P1.1 (มี shared module)

---

## P1 — หนี้ทางสถาปัตยกรรม & Operational

### P1.1 รวม PK_MODELS + helper vanco ที่ซ้ำสองไฟล์เป็น shared module — ✅ DONE
- **ปัญหาเดิม**: โมเดล PK 5 ตัว + helper + Colin อยู่ทั้ง `tdm.js` (`VancoTDM`)
  และ `vanco-tdm.js` — ~40 ฟังก์ชันซ้ำ; แก้ที่เดียวลืมอีกที่ = สูตรสองหน้าไม่ตรงกัน
- **ทำแล้ว (✅)**:
  - พิสูจน์ก่อนรวม: เทียบ 2 implementation 360,000 ครั้ง (20k random patients
    × ทุก fn) → **maxRelDiff 0, identical** จึงรวมได้โดยไม่เปลี่ยนพฤติกรรม
  - สร้าง `js/pk-models.js` → `window.VancoPK = {PK_MODELS, COLIN_MODEL, isPedsVanco}`
    (เก็บ coefficient/comment provenance ไว้ที่เดียว)
  - `tdm.js` + `vanco-tdm.js` เลิก define เอง → destructure จาก `window.VancoPK`
  - wired ใน `tdm.html`/`vanco-tdm.html` (script tag) + `PAGES` ใน `build.js`
    (load หลัง core.js, ก่อน tdm/vanco-tdm) — verify built dist: VancoPK def
    มาก่อน consumer + ไม่มี external ref ค้าง (404)
  - test loader โหลด shared module ตรง ๆ → 1 test คุมโมเดลทั้งสองเพจ; เพิ่ม
    `isPedsVanco` boundary test (รวม 31 เคส ผ่านหมด); build:prod ผ่าน
- **ผลพลอยได้**: ปิด sub-item ของ P0.1 ("golden test ฝั่ง tdm.js") — ตอนนี้
  tdm.js ใช้โมเดลชุดเดียวกับที่ test คุมแล้ว
- **หมายเหตุ release**: เป็น refactor ไม่เปลี่ยนพฤติกรรม แต่แตะ runtime JS →
  ตอน merge ขึ้น production ควร bump version (5.11.1→5.11.2) ตาม CONTRIBUTING §5

### P1.2 Deploy `gas-complete.js` ขึ้น GAS ทั้งสอง editor + re-import
- **ปัญหา** (Pending Items): เวอร์ชันล่าสุดมี upsert bulk import + version
  endpoint + `previousData` diff แต่ยังไม่ได้ deploy ขึ้น Admin + Analytics GAS
- **ทำอะไร**: copy ขึ้นทั้งสอง editor → New deployment → re-import CURATED
  compatibility pairs ผ่าน admin panel → ลบคู่ Valproic+Meropenem (PK interaction
  ไม่ใช่ Y-site) ด้วยมือ
- **Effort**: S (งานมือ ทำครั้งเดียว) · **ผลตอบแทน**: สูง (ปลดล็อก P2.2)

---

## P2 — ความสดของข้อมูล & ฟีเจอร์ค้าง

### P2.1 ต่อ `renal-dosing.html` ให้ดึงจาก Google Sheet
- **ปัญหา**: ตอนนี้ renal dosing 26 ตัว hardcode ใน `js/curated-renal-drugs.js`
  ขณะที่ฝั่ง admin (`renal-admin-block.js`) มี CRUD เขียนลง Sheet อยู่แล้ว
  → แก้ใน Sheet แต่หน้าจริงไม่อัปเดต
- **ทำอะไร**: ให้ `renal-dosing.js` fetch จาก GAS (เหมือน drug data) + fallback
  เป็น hardcode เมื่อ offline
- **Effort**: M · **ขึ้นกับ P1.2** (GAS endpoint พร้อม)

### P2.2 Admin GAS version-check UI
- **ปัญหา**: endpoint `?action=version` มีแล้ว แต่ UI ยังไม่สร้าง → ไม่รู้ว่า
  GAS ที่ deploy ตรงกับโค้ดล่าสุดไหม
- **ทำอะไร**: badge/ปุ่มในแผง admin แสดงเวอร์ชัน GAS เทียบกับ `version.json`
- **Effort**: S · **ขึ้นกับ P1.2**

### P2.3 จัดการ normKey() collision อย่างชัดเจน
- **ปัญหา** (ระบุใน `CLAUDE.md`): `normKey()` ตัดคำแรก → Calcium gluconate &
  Calcium chloride ชนกันเป็น `"calcium"` (potassium/sodium ก็เช่นกัน) →
  จับคู่ compatibility ผิดเกลือได้
- **ทำอะไร**: เพิ่ม disambiguation map สำหรับเกลือที่รู้ว่าชน หรือ key รองด้วยคำที่ 2
- **Effort**: M · **ผลตอบแทน**: กลาง (ความถูกต้องของ compatibility checker)

---

## P3 — คุณภาพโค้ด, ความปลอดภัยเชิงป้องกัน, ขัดเกลา

### P3.1 Audit XSS surface (`innerHTML`)
- **ปัญหา**: `innerHTML` ใช้หนาแน่นทั่วโค้ด (admin 49, tdm 48, dashboard 23…)
  `dashboard.js` v6.1 hardened XSS แล้ว แต่ไฟล์อื่นยังไม่ผ่านการ audit
- **ทำอะไร**: ตรวจจุดที่ interpolate ค่าจากผู้ใช้/GAS เข้า `innerHTML` →
  เปลี่ยนเป็น `textContent`/escape helper (โดยเฉพาะ admin ที่รับ input จากผู้ใช้)
- **Effort**: M

### P3.2 ลบ `console.log` ออกจาก production path
- **ปัญหา**: เหลือ debug log ใน core/admin/compatibility/index/error-tracker
- **ทำอะไร**: ตัดออก หรือ gate ด้วย flag debug; ให้ `build.js --prod` strip ให้
- **Effort**: S

### P3.3 ทบทวน dependencies ที่ไม่ถูกใช้
- **ปัญหา**: `package.json` ลิสต์ `docx` + `terser` แต่ build จริงใช้แค่
  `clean-css` (JS ไม่ minify โดยตั้งใจ)
- **ทำอะไร**: ยืนยันว่าไม่มีสคริปต์ไหนใช้ แล้วถอดออก (ลดผิวการโจมตี + ขนาด install)
- **Effort**: S

---

## ลำดับการลงมือที่แนะนำ (critical path)

```
P0.1 (tests + CI)  ──►  P1.1 (shared PK module)  ──►  P0.2 (CG override)
       │                                                     │
       └──────────────►  P0.3 (2-comp engine, ทำทีหลังสุดของสาย clinical)
P1.2 (GAS deploy)  ──►  P2.1 (renal จาก Sheet) + P2.2 (version UI)
P3.x  ทำแทรกได้ตลอด (independent)
```

**เหตุผลของลำดับ**: เริ่มที่ **P0.1 (tests)** เพราะมันคือ "safety net" ที่ทำให้
งาน refactor ที่เหลือ (โดยเฉพาะ P1.1 + P0.2 + P0.3 ซึ่งแตะสูตรคลินิก) ทำได้
โดยไม่กลัวถดถอยเงียบ ๆ จากนั้น **P1.1** ก่อน **P0.2/P0.3** เพราะมี code เดียว
ให้แก้แทนที่จะแก้สองไฟล์ ฝั่ง **P1.2 (GAS)** เป็นสายขนานที่ปลดล็อก P2 ทั้งก้อน
ส่วน **P3** เป็นงานอิสระแทรกได้ทุกเมื่อ
