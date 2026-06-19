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

## ส่วนที่ 2 — Admin CRUD (แก้/เพิ่ม/ลบ ข้อมูล allergy) 🔜 (กำลังทำต่อ)

> จะอัปเดตคู่มือส่วนนี้เมื่อโค้ด admin + GAS handler เสร็จ

---

## หมายเหตุสำคัญ
- ฟีเจอร์อื่น (drug/compat/renal) **ไม่กระทบ** — เพิ่มเฉพาะ event/handler ใหม่
- ถ้ายังไม่ deploy GAS: event `ALLERGY_LOOKUP` จะตกไปที่ generic log ชั่วคราว
  (ไม่ error แต่ยังไม่ขึ้น dashboard) — deploy แล้วจะเข้าที่ถูก
- **ต้อง deploy ทั้ง 2 editor ก็ต่อเมื่อ** แก้ส่วนที่ทั้งสองใช้ร่วมกัน; ส่วน
  analytics นี้อยู่ที่ตัว Analytics เป็นหลัก (Admin GAS ไม่จำเป็นรอบนี้)
