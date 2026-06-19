# คู่มือ Deploy — Backend ฟีเจอร์ Allergy

> ผมเขียนโค้ดให้แล้ว แต่ "ทำให้ทำงานจริง" ต้องให้คุณเอา `gas-complete.js`
> ไปวางใน Google Apps Script เอง (Google account เป็นของคุณ) ทำตามทีละขั้น

## ส่วนที่ 1 — Analytics ของ Allergy → Dashboard ✅ (ทำแล้วในโค้ด)

### โค้ดที่เพิ่ม (อัตโนมัติเมื่อ deploy)
- **Frontend** (`js/allergy.js`): ส่ง event `ALLERGY_LOOKUP` ทุกครั้งที่ผู้ใช้เลือกยา/
  ความรุนแรง + เก็บ page-view ของหน้า allergy
- **GAS** (`gas-complete.js`): รับ event `ALLERGY_LOOKUP` → เก็บลง sheet
  `AllergyLookups` (สร้าง sheet ให้อัตโนมัติ ไม่ต้องสร้างเอง) + ส่งให้ dashboard
- **Dashboard** (`dashboard.html` / `js/dashboard.js`): แท็บใหม่ **🛡️ Allergy**
  (Total Lookups / Unique Users / Top Allergen / SCAR Blocked + กราฟ top allergens,
  by severity, by day)

### ขั้นตอน deploy (คุณทำ) — ใช้ GAS ตัว **Analytics**
> GAS ตัว Analytics = ตัวที่เก็บสถิติทั้งหมด (URL ขึ้นต้น `AKfycbxsNFG4...`)

1. เปิด Google Apps Script editor ของ **Analytics** (ผูกกับ Sheet analytics)
2. เปิดไฟล์ `gas-complete.js` ในเครื่อง → **copy ทั้งไฟล์**
3. วางทับโค้ดเดิมใน editor → กด 💾 บันทึก
4. กด **Deploy → Manage deployments → (ดินสอ ✏️ แก้ deployment เดิม) →
   Version: New version → Deploy**
   - สำคัญ: ต้องเป็น **New version** ไม่งั้นโค้ดใหม่ไม่มีผล
5. เสร็จ — ไม่ต้องแตะ URL (ใช้ URL เดิม), ไม่ต้องสร้าง sheet (สร้างเอง)

### วิธีตรวจว่าได้ผล
- เข้าเว็บหน้า allergy → ลองเลือกยา/เปลี่ยนความรุนแรง 2-3 ครั้ง
- เปิด Google Sheet analytics → จะเห็น tab ใหม่ **AllergyLookups** มีข้อมูลเข้ามา
- เปิดหน้า dashboard → แท็บ **🛡️ Allergy** → เห็นตัวเลข/กราฟ

---

## ส่วนที่ 2 — Admin CRUD (แก้/เพิ่ม/ลบ ข้อมูล allergy) ✅ (NBL — ทำแล้ว)

### โค้ดที่เพิ่ม
- **GAS** (`gas-complete.js`): sheets `AllergyGroups` + `AllergyRefs` (สร้างเอง) +
  endpoints `allergydata` (public), `getAllergyGroups`, create/update/delete,
  `bulkCreateAllergyGroups`, `bulkCreateAllergyRefs` (รองรับทั้ง GET เล็ก / POST ใหญ่)
- **Admin** (`admin.html` + `js/admin.js`): แท็บ **🛡️ Allergy** — ตาราง + ปุ่ม
  **Seed จากโค้ด** + ฟอร์มแก้/เพิ่มกลุ่ม (4 lists: allergens/cross/safe/caution +
  notes + flags + refs) + ลบ (admin) + export CSV

### ขั้นตอน deploy (คุณทำ) — ต้อง deploy **ทั้ง 2 editor**
> ข้อมูล allergy (CRUD) อยู่ใน spreadsheet ของ **Admin GAS** · การเก็บสถิติ
> (ALLERGY_LOOKUP) อยู่ที่ **Analytics GAS** → โค้ดเดียวกัน แต่ deploy 2 ที่

1. copy `gas-complete.js` → วางใน **Admin GAS** editor → Deploy → New version
2. copy `gas-complete.js` → วางใน **Analytics GAS** editor → Deploy → New version
   (อันนี้เพื่อ analytics ส่วนที่ 1 ด้วย)

### วิธีใช้ (หลัง deploy)
1. เข้า admin → แท็บ **🛡️ Allergy** → กด **📦 Seed จากโค้ด** (ครั้งแรกครั้งเดียว)
   → ข้อมูล 7 กลุ่ม NBL + refs จะถูกเขียนลง Google Sheet
2. จากนั้นแก้/เพิ่ม/ลบ กลุ่มได้เลยผ่านฟอร์ม (กด ✏️ เพื่อแก้, ＋ เพิ่มกลุ่ม)
3. ✅ **A3 เสร็จแล้ว** — หน้า allergy จริง**อ่านจาก Sheet แล้ว**: ตอนเปิดหน้า
   จะ fetch ข้อมูลจาก GAS (`?action=allergydata`) มาทับ hardcode + cache ลง
   localStorage (เปิดออฟไลน์ได้) → **แก้ใน admin แล้วผู้ใช้เห็นจริง**
   (ถ้า GAS ยังไม่ deploy / ออฟไลน์ → ใช้ hardcode เดิมอัตโนมัติ ไม่ error)
4. Beta-lactam (type `beta_lactam`) — โครงรองรับแล้ว แต่ seed/engine ของ
   beta-lactam จะทำใน **ขั้น B** (ตอนนี้ A3 ข้าม beta_lactam ใช้ hardcode)

---

## หมายเหตุสำคัญ
- ฟีเจอร์อื่น (drug/compat/renal) **ไม่กระทบ** — เพิ่มเฉพาะ event/handler ใหม่
- ถ้ายังไม่ deploy GAS: event `ALLERGY_LOOKUP` จะตกไปที่ generic log ชั่วคราว
  (ไม่ error แต่ยังไม่ขึ้น dashboard) — deploy แล้วจะเข้าที่ถูก
- **ต้อง deploy ทั้ง 2 editor ก็ต่อเมื่อ** แก้ส่วนที่ทั้งสองใช้ร่วมกัน; ส่วน
  analytics นี้อยู่ที่ตัว Analytics เป็นหลัก (Admin GAS ไม่จำเป็นรอบนี้)
