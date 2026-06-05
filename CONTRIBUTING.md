# Contributing & Development Rules — IV DrugRef PWA

> เอกสารนี้คือ **กฎระเบียบการพัฒนา** สำหรับแอปอ้างอิงยาทางคลินิก อ่านคู่กับ
> `CLAUDE.md` (บริบทสถาปัตยกรรม) และ `ROADMAP.md` (ลำดับงาน)
>
> **บริบทความเสี่ยง**: นี่คือเครื่องมือช่วยตัดสินใจทางคลินิกที่บุคลากรการแพทย์
> ใช้จริง การคำนวณที่ผิด = dosing ผู้ป่วยผิด ทุกกฎด้านล่างมีไว้เพื่อกันความผิดพลาด
> ที่หลุดถึงผู้ใช้จริง

---

## 0. กฎเหล็ก (Golden Rules) — ห้ามฝ่าฝืน

1. **`main` = production.** การ `push` เข้า `main` จะ trigger GitHub Actions
   build + deploy ขึ้น GitHub Pages **ทันที** (`.github/workflows/deploy.yml`)
   → ผู้ใช้จริงเห็นทันที **ห้าม push ตรงเข้า `main`** ทุกการเปลี่ยนแปลงต้องผ่าน
   branch + PR + checklist
2. **งานทุกชิ้นทำบน feature branch ก่อนเสมอ** แล้วค่อย merge เข้า `main` ผ่าน PR
3. **ห้าม merge ถ้า build ไม่ผ่าน** — `node build.js --prod` ต้องสำเร็จและ serve
   จาก `dist/` ได้โดยไม่มี 404
4. **การแก้สูตรคลินิกต้องมีหลักฐานอ้างอิง** (primary source) + golden value
   verification เสมอ (ดู §4)
5. **ห้ามลด version หรือข้าม version bump** เมื่อปล่อยของขึ้น production (ดู §5)

---

## 1. Branch & PR Workflow

### ตั้งชื่อ branch
```
feat/<ชื่อสั้น>      # ฟีเจอร์ใหม่           เช่น feat/peds-vanco-colin
fix/<ชื่อสั้น>       # แก้บั๊ก/แก้สูตร        เช่น fix/vanco-cl-correction
docs/<ชื่อสั้น>      # เอกสารอย่างเดียว
refactor/<ชื่อสั้น>  # ปรับโครงสร้าง ไม่เปลี่ยนพฤติกรรม
```
(สอดคล้องกับประวัติจริงใน repo เช่น `fix/peds-pk-disclaimer-v5111`)

### ขั้นตอนมาตรฐาน
```bash
git checkout main && git pull origin main
git checkout -b feat/my-change        # 1. แตก branch จาก main ล่าสุด
# ...แก้โค้ด...
npm run build:prod                    # 2. build ผ่าน (ดู §3)
npm test                              # 3. test เขียว (เมื่อมี suite แล้ว — ROADMAP P0.1)
git commit -m "feat: ..."             # 4. commit (ดู §6)
git push -u origin feat/my-change     # 5. push branch (ไม่ใช่ main)
# 6. เปิด PR → ผ่าน checklist §3 → merge เข้า main → Actions deploy อัตโนมัติ
```

### กฎ PR
- 1 PR = 1 เป้าหมายชัดเจน (อย่ารวมหลายเรื่องไม่เกี่ยวกันใน PR เดียว)
- PR ที่แตะสูตรคลินิก **ต้อง** แนบ: อ้างอิง paper, ค่าก่อน→หลัง, golden values ที่ verify
- ใช้ **squash merge** เพื่อให้ history ใน `main` สะอาด (1 PR = 1 commit)
- ลบ branch หลัง merge

---

## 2. ห้ามทำบน `main` โดยตรง — ทำไม

`main` ไม่มี staging คั่น: `git push main` → deploy ภายในไม่กี่นาที ดังนั้น `main`
ต้องอยู่ในสภาพ **deploy ได้ตลอดเวลา** (always-releasable) การทดลอง/งานครึ่ง ๆ
กลาง ๆ ต้องอยู่บน branch เท่านั้น

> หมายเหตุ: pre-push hook ที่สร้าง backup tag `local/*` เป็น hook **เฉพาะเครื่อง
> local** (ไม่ได้อยู่ใน repo) อย่าพึ่งพามันใน CI/เครื่องอื่น ฝั่ง CI มี backup tag
> `deploy/*` สร้างให้อัตโนมัติทุกครั้งที่ deploy อยู่แล้ว

---

## 3. Pre-Merge Checklist (ติ๊กให้ครบก่อน merge)

```
[ ] แตก branch จาก main ล่าสุด, ไม่ push ตรง main
[ ] node build.js --prod สำเร็จ ไม่มี error
[ ] serve dist/ แล้วหน้าที่แก้ทำงาน, console ไม่มี error, ไม่มี 404
[ ] ไฟล์ HTML ใช้ prefix css/ และ js/ ครบ (ไม่งั้น build inline พัง → §7)
[ ] ถ้าเพิ่มเพจใหม่: เพิ่ม entry ใน PAGES object ของ build.js (ลำดับ CSS/JS ถูก)
[ ] ถ้าแตะสูตรคลินิก: ผ่าน Clinical Change Protocol §4 ครบ
[ ] ถ้าปล่อย production: version bump ครบทุกจุด §5
[ ] ถ้าแตะ gas-complete.js: ทำตาม §6 (deploy ทั้งสอง GAS)
[ ] npm test เขียว (เมื่อมี suite แล้ว — ปัจจุบันยังไม่มี ดู ROADMAP P0.1)
```

---

## 4. Clinical Change Protocol (สำคัญที่สุด)

ใช้กับทุกการแก้ที่กระทบ **ผลการคำนวณ**: CrCl, BSA, IBW, drip rate, Bayesian TDM,
vanco AUC, renal dosing thresholds, pediatric guard

1. **อ้างอิงต้นฉบับ**: ระบุ paper/guideline + สมการ + ตาราง (เช่น "Colin 2019,
   Clin Pharmacokinet 58:767-80, Table 3 + Eq 5-13") ลงใน commit message/PR
2. **ระวังหน่วย (unit traps)**: ตรวจหน่วยทุกตัวแปร — โมเดล PK มักผสมหน่วย เช่น
   Colin: PMA เป็น weeks ใน FMat แต่ years ใน FDecline; SCr เป็น mg/dL ไม่ใช่ μmol/L
3. **Golden value verification**: คำนวณ 2-3 เคสด้วยมือ/อ้างอิงค่าจาก paper แล้ว
   ยืนยันว่าโค้ดให้ค่าตรง (เช่น 35yo/70kg/SCr0.83 → CL 4.10) — เก็บค่าเหล่านี้ไว้
   เป็น test case (ROADMAP P0.1)
4. **ตรวจ regression**: ค่ากลุ่มผู้ใหญ่/เคสเดิมต้องไม่เปลี่ยนถ้าไม่ได้ตั้งใจ
5. **ถ้าแก้ที่สองไฟล์**: ปัจจุบัน PK_MODELS ซ้ำใน `tdm.js` + `vanco-tdm.js`
   **ต้องแก้ทั้งสองให้ตรงกัน** (จนกว่าจะรวมเป็น shared module — ROADMAP P1.1)
6. **Safety guard ต้องไม่ถูกปลดโดยไม่ตั้งใจ**: ถ้าแตะ `pediatric-guard.js`
   ระบุชัดว่า context ไหนถูกปลด/กั้น และมีโมเดล validated รองรับหรือไม่
7. **Disclaimer ตามหลักฐาน**: ถ้าค่าเชื่อถือได้บางส่วน (เช่น peds peak/trough
   1-comp) ต้องขึ้น disclaimer ให้ผู้ใช้ (เหมือน v5.11.1)

> หลักการกลาง: **โค้ดที่อ่าน drug field ห้ามสมมติ type** ต้องผ่าน
> `normalizeDrugFields()` หรือเช็ค type ก่อนใช้ method ของ array/object เสมอ
> (GAS คืนค่าทุกอย่างเป็น string — ดู `CLAUDE.md`)

---

## 5. Versioning & Release Checklist

เวอร์ชันคุมการ **force-update** ของ PWA — ถ้า bump ไม่ครบ ผู้ใช้บางส่วนจะค้าง
cache เก่า เมื่อปล่อย production ต้องอัปเดตให้ครบ **ทุกจุด**:

```
[ ] package.json        → "version"
[ ] version.json        → "version" (+ "forceUpdate": true ถ้าต้องบังคับรีโหลด)
[ ] sw.js               → version constant ที่ header + เพิ่ม changelog บนสุด
[ ] per-page footers    → version string ในทุก *.html ที่แสดงเวอร์ชัน
```

- ใช้ **semver**: patch = แก้บั๊ก/disclaimer, minor = ฟีเจอร์/โมเดลใหม่,
  major = เปลี่ยนสถาปัตยกรรม (ดูแนวจากประวัติ v5.10.0 / v5.11.0 / v5.11.1)
- `drugCacheVer` ไม่ต้องแตะ — `build.js` ใส่ git hash ให้ตอน build อัตโนมัติ

---

## 6. GAS Backend Change Protocol

`gas-complete.js` **ไม่ได้ deploy ผ่าน git** ต้อง copy ขึ้น GAS editor ด้วยมือ และมี
**สอง deployment** (Admin + Analytics) ที่ใช้โค้ดเดียวกันแต่ผูกคนละ Spreadsheet

เมื่อแก้ `gas-complete.js`:
```
[ ] copy ทั้งไฟล์ขึ้น Admin GAS editor → Deploy → New deployment
[ ] copy ทั้งไฟล์ขึ้น Analytics GAS editor → Deploy → New deployment
[ ] ถ้า deployment URL เปลี่ยน → อัปเดต URL ใน js/core.js
[ ] ทดสอบ endpoint ที่แก้จากทั้งสองฝั่ง
```
- เพิ่มคอลัมน์ใน Sheet ใหม่: ใช้ **lowercase key** (เช่น `previousData`) เพราะโค้ด
  หาคอลัมน์ด้วย `headers.indexOf('previousData')`
- ห้ามลืม: ปัจจุบันมี GAS เวอร์ชันใหม่ค้าง deploy อยู่ (ดู Pending Items ใน CLAUDE.md
  / ROADMAP P1.2)

---

## 7. Build System Invariants (ห้ามทำพัง)

- **HTML ต้องอ้างไฟล์ local ด้วย prefix `css/` และ `js/`** เท่านั้น
  (`<link href="css/shared.css">`, `<script src="js/core.js">`) — `build.js`
  ใช้ regex หา/ลบ tag เหล่านี้ก่อน inline ถ้าใช้ bare path จะ inline ซ้อนกับ ref
  เดิม → 404 บน `dist/`
- **ข้อยกเว้น**: ไฟล์ระดับ root (`i18n.js`, `translations-en.js`) **ห้าม** ใส่ prefix
  — มันถูก copy เป็น static ไม่ได้ inline
- **เพจใหม่ต้องลงทะเบียนใน `PAGES`** ของ `build.js` (ลำดับ CSS/JS สำคัญ)
- **JS ไม่ถูก minify โดยตั้งใจ** (index.js line 7 ถูก obfuscate ไว้ — terser จะพัง)
  อย่าเปิด JS minification
- **index.js line 7 เป็น minified** — เพิ่มฟีเจอร์ด้วยการ monkey-patch หลัง line 143
  ไม่แก้โค้ดที่ obfuscate ตรง ๆ

---

## 8. Commit Message Convention

```
<type>: <สรุปสั้น> (vX.Y.Z ถ้าเป็น release)

<รายละเอียด: อะไรเปลี่ยน + ทำไม + อ้างอิงถ้าเป็น clinical>
```
- `type` ∈ `feat` / `fix` / `docs` / `refactor` / `chore`
- commit message เป็น **ภาษาอังกฤษ** (string ที่เป็น UI ภาษาไทยคงไว้ตามเดิมได้)
- clinical fix: ใส่อ้างอิง paper + ค่า before→after ใน body (ดูแบบจาก
  `463e1c5 fix: correct vancomycin PK model coefficients`)

---

## 9. Local Testing

```bash
npm run build:dev    # copy ไป dist/ แบบ external ref (เร็ว, debug ง่าย)
npm run build:prod   # build เต็ม (inline + minify CSS) — ใช้ตรวจก่อน merge
npx http-server .    # เปิด server ทดสอบ
```
- `admin.html` ต้อง Google Sign-in — ทดสอบ UI โดยไม่ login ให้ inject mock ผ่าน
  `localStorage` (ดูวิธีใน `CLAUDE.md` → "Testing admin.html locally") และต้องใช้
  `build:prod` (admin ต้องการ CSS/JS ที่ inline แล้ว)

---

## 10. Rollback / Incident

ทุก deploy มี backup tag อัตโนมัติ:
```bash
git tag -l "deploy/*"                 # ดู backup ที่ CI สร้าง
git checkout deploy/20260405-090013   # ย้อนไปจุดก่อนหน้า
# แก้ → เปิด branch → PR → merge เพื่อ deploy เวอร์ชันที่ถูกต้องทับ
```
ถ้าพบสูตรคลินิกผิดบน production: **bump version + `forceUpdate: true`** ในแพตช์แก้
เพื่อบังคับผู้ใช้รีโหลดทันที (อย่าพึ่ง cache หมดอายุเอง)
