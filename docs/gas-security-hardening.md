# คู่มือเปิดใช้ Security Hardening (P4) — ต้องลงมือเอง

> เอกสารนี้คู่กับ PR ที่พอร์ตชุดแก้ security/governance เข้ามา **โค้ด/SQL อยู่ใน repo
> แล้ว แต่ "merge เฉย ๆ ไม่มีผล"** — ต้องรัน SQL ใน Supabase + deploy GAS เอง
> ตามขั้นตอนด้านล่าง ทำ **ส่วน A ก่อน** (เร่งด่วนสุด ปิดช่องโหว่จริงที่เปิดอยู่)

สารบัญ:
- [ส่วน A — รัน SQL ใน Supabase](#ส่วน-a) ⚠️ เร่งด่วน · ปิดช่องโหว่ anon อ่านข้อมูลลับ
- [ส่วน B — อัปเดต GAS (strips + generic error)](#ส่วน-b) · ปลอดภัยขึ้นทันทีที่ deploy
- [ส่วน C — เปิด id_token verify](#ส่วน-c) 🔴 ปิดช่องปลอม admin (ต้อง wire + test เอง)
- [ส่วน D — งานแนะนำเพิ่ม (ยังไม่ทำ)](#ส่วน-d)

---

## <a name="ส่วน-a"></a>ส่วน A — รัน SQL ใน Supabase ⚠️ (ทำก่อน)

**ปัญหาที่ปิด:** ตอนนี้ใครก็ได้ที่มี publishable key (ซึ่งอยู่ในโค้ดหน้าเว็บ = สาธารณะ)
ยิง query `?status=neq.approved` เพื่ออ่าน **ยาที่ยังไม่อนุมัติ + ประวัติการแก้ (previousData)
+ อีเมลคนแก้ (PII)** ได้ — ทั้งที่หน้าเว็บกรองแค่ฝั่ง client (เลี่ยงได้ง่าย)

**วิธีทำ:** เปิด Supabase Dashboard → เมนู **SQL Editor** → รันไฟล์ต่อไปนี้ **ตามลำดับ**
(คัดลอกเนื้อไฟล์ทั้งไฟล์มาวางแล้วกด Run):

1. **`supabase/refdata.sql`** — เปลี่ยน RLS ของตาราง `drugs` ให้ anon อ่านได้เฉพาะแถว
   `status = 'approved'` (admin ที่ล็อกอินยังอ่านได้หมด) + เพิ่ม trigger `touch_updated_at`
   ที่อัปเดตเวลา `updated_at` ทุกครั้งที่แก้ (เป็นฐานของ optimistic concurrency ในส่วน D)
2. **`supabase/auth.sql`** — เปิด policy `admin read events` (ให้เฉพาะ admin อ่าน analytics
   events ได้ + ลบ policy อ่านสาธารณะเดิมถ้ามี) — เดิมเป็นแค่คอมเมนต์ ทำให้ repo ไม่ตรงกับ
   production จริง
3. **`supabase/audit.sql`** *(ไม่บังคับ แต่แนะนำ)* — สร้างตาราง `audit_log` + trigger
   `log_audit()` (SECURITY DEFINER) บันทึกทุกการแก้ข้อมูลคลินิก (ใคร/เมื่อไหร่/ก่อน→หลัง)
   แบบปลอมจากฝั่ง client ไม่ได้ — ปิดช่องที่การแก้ผ่าน admin-supabase.js ไม่มี audit trail

> ทุกไฟล์เขียนแบบ **idempotent** (drop-then-create) รันซ้ำได้ปลอดภัย
> ตรวจว่าสำเร็จ: หลังรัน ลองเปิด `…/rest/v1/drugs?status=neq.approved&select=id` ด้วย
> publishable key — ต้องได้ `[]` (ว่าง) ไม่ใช่รายการ draft

---

## <a name="ส่วน-b"></a>ส่วน B — อัปเดต GAS: strips + generic error

**พอร์ตมาแล้วใน `gas-complete.js`** (ไม่ต้องแก้โค้ดเพิ่ม) — มีผลทันทีที่คุณ deploy ใหม่:

- `handleUpdateDrug` **ไม่รับ `previousData`/`idToken`/`user`/`action` จาก client** อีกต่อไป
  (server เป็นคนสร้าง snapshot เอง — กัน client ปลอม "ค่าก่อนแก้" ให้ดูไม่มีพิษภัยตอน review)
- `_syncDrugsToSupabase` / `_syncAllergyToSupabase` **ตัด PII** (previousData/createdBy/
  updatedBy/…) ออกก่อน sync ไปตารางที่อ่านสาธารณะ
- `errorResponse` ตอน error **ส่งข้อความกลาง ๆ** ("เกิดข้อผิดพลาดภายในระบบ") แทนการโยน
  `err.message` + stack ให้ผู้เรียก (เดิม endpoint แบบ "Anyone" รั่วรายละเอียดภายใน)

**วิธี deploy** (ตาม CLAUDE.md — ต้องทำ **ทั้ง 2 GAS editor**: Admin + Analytics):
1. เปิด GAS editor → คัดลอก `gas-complete.js` ทั้งไฟล์วางทับ → **บันทึก (Ctrl+S)**
2. **Deploy → Manage deployments → (ดินสอ) → Version: New version → Deploy**
   (แค่ Save/Run ไม่พอ — ต้อง **New version** ตัว web app ถึงจะอัปเดต)
3. ทำซ้ำกับ GAS อีกตัว
4. ตรวจ: หน้า admin → เมนูตรวจเวอร์ชัน ควรเห็น GAS ตอบ **5.66.0** (= `EXPECTED_GAS_VERSION`)

---

## <a name="ส่วน-c"></a>ส่วน C — เปิด id_token verify 🔴 (ปิดช่องปลอมเป็น admin)

**ปัญหาที่ปิด:** GAS deploy แบบ "Anyone" + เชื่อ param `user=` ที่ปลอมได้ → ใครก็ยิง
`curl '…/exec?action=setUserRole&user=<อีเมลคุณ>&data={"email":"attacker","role":"admin"}'`
เพื่อ **ตั้งตัวเองเป็น admin** หรือแก้ข้อมูลยาได้

**สถานะ: โค้ดต่อสายเรียบร้อยแล้ว (v5.67.0) — คุณเหลือแค่ deploy → ทดสอบ → เปิดสวิตช์**

สิ่งที่ทำไปแล้วในโค้ด (ไม่ต้องแก้เอง):
- `doGet` / `doPost` เรียก `_resolveUser()` แล้วใช้ **อีเมลจาก id_token ที่ยืนยันแล้ว**
  แทน `e.parameter.user` / `data.user` เดิมทุกจุด
- ถ้าเปิดสวิตช์ `REQUIRE_ID_TOKEN=on` → คำสั่งที่ **แก้ข้อมูล** ทุกตัวจะถูกปฏิเสธถ้าไม่มี
  token ที่ถูกต้อง (คำสั่งอ่านอย่างเดียวไม่กระทบ)
- หน้า admin แนบ id_token ไปให้อยู่แล้ว (ตั้งแต่ v5.66.0)
- ใส่ cache ผลการตรวจ token (5 นาที) เพื่อไม่ให้ทุกคำสั่งต้องวิ่งไปถาม Google ใหม่

### C1. Deploy โค้ดใหม่ (ยังไม่เปิดสวิตช์ = ยังทำงานเหมือนเดิมทุกอย่าง)

ทำเหมือนส่วน B — copy `gas-complete.js` → วางทับ → Ctrl+S → **Deploy → Manage deployments
→ ✏️ → New version → Deploy** ทำ **ทั้ง 2 GAS**

ตรวจว่าขึ้นเวอร์ชันใหม่แล้ว (ต้องได้ `{"version":"5.67.0"}` ทั้งคู่):
- Admin GAS: `<ADMIN_URL>/exec?action=version`
- Analytics GAS: `<ANALYTICS_URL>/exec?action=version`

### C2. ทดสอบก่อนบังคับ (สำคัญที่สุด)

ตอนนี้สวิตช์ยังปิด → ทุกอย่างต้องทำงานปกติ 100%:
1. เข้าหน้า admin → ลอง **แก้ข้อมูลยา 1 รายการ** แล้วบันทึก → ต้องสำเร็จ
2. ลองแท็บ Compatibility / Renal / Allergy → โหลดข้อมูลได้ปกติ
3. เปิด GAS editor → เมนู **Executions** → ดูรายการล่าสุด ต้องเป็น *Completed* (ไม่ใช่ Failed)

ถ้ามีอะไรผิดปกติ → **หยุด** อย่าเพิ่งทำ C3 แล้วแจ้งมาได้

### C3. เปิดสวิตช์บังคับใช้

ทำ **ทั้ง 2 GAS**: GAS editor → ⚙️ **Project Settings** → เลื่อนลงหา **Script Properties**
→ **Add script property**
- Property: `REQUIRE_ID_TOKEN`
- Value: `on`
→ **Save script properties**

> ไม่ต้อง Deploy ใหม่หลังเพิ่ม property — มีผลทันที

### C4. ยืนยันว่าปิดช่องโหว่สำเร็จ

**ก) แอดมินตัวจริงต้องยังใช้งานได้:** กลับไปหน้า admin → แก้ข้อมูลยา 1 รายการ → ต้องสำเร็จ

**ข) คนนอกต้องถูกปฏิเสธ:** เปิดลิงก์นี้ในเบราว์เซอร์ (แทน `<ADMIN_URL>` ด้วย URL ของ Admin GAS)
```
<ADMIN_URL>/exec?action=setUserRole&user=thapanat.nk@gmail.com&data={"email":"test@evil.com","role":"admin"}
```
- ✅ **ถูกต้อง:** ได้ข้อความปฏิเสธ *"ต้องยืนยันตัวตนด้วย id_token…"*
- ❌ ถ้ายังสำเร็จ = สวิตช์ยังไม่ทำงาน ตรวจว่าตั้ง property ถูกที่ GAS ตัวที่กำลังทดสอบไหม

> จากนั้นเข้าแท็บ **จัดการผู้ใช้** ในหน้า admin เพื่อเช็กว่าไม่มี `test@evil.com` โผล่มาจริง ๆ

### ถ้าพลาดล็อกตัวเองออก

ลบ property `REQUIRE_ID_TOKEN` ทิ้ง → กลับสู่พฤติกรรมเดิมทันที (ค่าเริ่มต้น = ปิด
จึงไม่มีทางล็อกถาวร) แล้วแจ้งมาได้ครับ

---

## <a name="ส่วน-d"></a>ส่วน D — งานแนะนำเพิ่ม (ยังไม่พอร์ต — เสี่ยง/ต้อง rework)

พอร์ตไม่ได้แบบปลอดภัยในรอบนี้เพราะ `gas-complete.js` บน main คนละสายกับ branch ต้นทาง
(ไม่มี scaffolding `LEGACY_SHEET_CRUD`) — ทำเป็นงานถัดไปเมื่อพร้อมทดสอบ:

1. **doPost routing สำหรับ drug/user write ที่ใหญ่ >6KB** — ปัจจุบันการแก้ยาที่มีข้อความไทยยาว
   ถูกส่งเป็น POST no-cors แล้ว **ไม่มี route รับใน doPost** → ตกไปเป็น analytics ขยะ + รายงานว่า
   สำเร็จทั้งที่ข้อมูลหาย (silent data loss) ควรเพิ่ม case `createdrug/updatedrug/…` ใน doPost
2. **LockService** ครอบทุก action ที่แก้ข้อมูล (กัน 2 คนแก้แถวเดียวกันทับกัน)
3. **Optimistic concurrency (B5)** — `admin-supabase.js` อ่าน `updated_at` มาด้วย แล้วตอนแก้ใช้
   `.eq('updated_at', ค่าที่อ่านมา)` ถ้า 0 แถว = มีคนแก้ไปก่อน → เตือน "reload ก่อน" (ต้องมี
   trigger `touch_updated_at` จากส่วน A ก่อน)
4. **Audit trail อ่านกลับ (B4)** — เพิ่ม `AdminSupabase.getAuditLog()` + UI แสดง (ตาราง
   `audit_log` จากส่วน A มีข้อมูลรออยู่แล้ว)

---

## ✅ Checklist

- [x] ส่วน A: รัน SQL ใน Supabase SQL Editor *(2026-07-27)*
- [x] ส่วน A: ตรวจ `?status=neq.approved` คืน `[]` ✅ ปิดช่องโหว่แล้ว
- [x] ส่วน B: deploy `gas-complete.js` v5.66.0 ทั้ง 2 GAS *(2026-07-27)*
- [ ] ส่วน C1: deploy `gas-complete.js` **v5.67.0** ทั้ง 2 GAS (โค้ดต่อสายให้แล้ว)
- [ ] ส่วน C2: ทดสอบตอนสวิตช์ยังปิด — แก้ข้อมูลยาได้ปกติ + Executions ไม่ Failed
- [ ] ส่วน C3: ตั้ง Script Property `REQUIRE_ID_TOKEN=on` ทั้ง 2 GAS
- [ ] ส่วน C4: ยืนยัน — แอดมินยังแก้ได้ + ลิงก์ `setUserRole` ของคนนอกถูกปฏิเสธ
- [ ] ส่วน D: วางแผนทำภายหลัง
