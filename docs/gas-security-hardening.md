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

## <a name="ส่วน-c"></a>ส่วน C — เปิด id_token verify 🔴 (ปิดช่องปลอม admin)

**ปัญหาที่ปิด:** GAS deploy แบบ "Anyone" + เชื่อ param `user=` ที่ปลอมได้ → ใครก็ยิง
`curl '…/exec?action=setUserRole&user=<อีเมลคุณ>&data={"email":"attacker","role":"admin"}'`
เพื่อ **ตั้งตัวเองเป็น admin** หรือแก้ข้อมูลยาได้

**สถานะตอนนี้:** เครื่องมือตรวจ id_token **อยู่ใน `gas-complete.js` แล้ว** (ฟังก์ชัน
`_verifyIdToken` / `_resolveUser` / `_requireIdToken` / `_isMutatingAction`) และหน้า admin
**ส่ง id_token ไปด้วยแล้ว** (`js/admin.js`) — แต่ **ยังไม่ได้ต่อสายเข้า `doGet`/`doPost`**
เพราะเป็นจุดที่ต้องทดสอบเองในเครื่องจริง (โครงสร้าง doGet/doPost ของคุณต่างจาก branch ต้นทาง
ผมจึงไม่แก้ให้แบบเดา ๆ เพื่อไม่ให้ backend พังตอน deploy)

### ขั้นตอน (ทำในเครื่องจริง + ทดสอบก่อนบังคับ)

**C1. ต่อสายใน `doGet(e)`** — หาบรรทัด `var user = e.parameter.user || '';` (ต้นฟังก์ชัน)
แล้ว **แทนที่** ด้วย (ต้องมี `var data = {}` + parse `e.parameter.data` อยู่ก่อนหน้าแล้ว —
ถ้ายังไม่มีให้ย้ายขึ้นมา):

```javascript
    // Trusted actor: verified id_token email when present, else the (spoofable) param.
    var _auth = _resolveUser(e, data);
    var user = _auth.email;
    if (_isMutatingAction(action) && _requireIdToken() && !_auth.verified) {
      return errorResponse('Identity not verified — a valid signed id_token is required (REQUIRE_ID_TOKEN is on).');
    }
```

**C2. ต่อสายใน `doPost(e)`** — หลัง parse `data` จาก body และได้ค่า `action` แล้ว ใส่:

```javascript
    var _auth = _resolveUser(e, data);
    var postUser = _auth.email;   // ← ใช้ postUser นี้แทน data.user เดิมในการเช็คสิทธิ์
    if (_isMutatingAction(String(action).toLowerCase()) && _requireIdToken() && !_auth.verified) {
      return errorResponse('Identity not verified — a valid signed id_token is required (REQUIRE_ID_TOKEN is on).');
    }
```

> ⚠️ จุดสำคัญ: หา `checkPermission(...)` / `getRole(...)` ในแต่ละ handler แล้วให้ใช้
> **`_auth.email`** (จาก id_token) แทน `e.parameter.user` / `data.user` เดิม — ไม่งั้นยังปลอมได้

**C3. ทดสอบ (สำคัญที่สุด — ก่อนบังคับ):**
- Deploy GAS ใหม่ (ยังไม่เปิด flag) → ล็อกอิน admin → ลองแก้ข้อมูลสัก 1 รายการ → ต้องยังทำงานปกติ
  (ตอนนี้ `REQUIRE_ID_TOKEN` ยังไม่เปิด = พฤติกรรมเดิม แค่มี id_token ส่งไปด้วย)
- ดู **Executions log** ใน GAS ว่า `_verifyIdToken` คืนอีเมลถูกต้อง (ไม่ null)

**C4. บังคับใช้:** เมื่อทดสอบผ่านแล้ว → GAS editor → **Project Settings → Script Properties
→ Add property**: ชื่อ `REQUIRE_ID_TOKEN` ค่า `on` → ทำทั้ง 2 GAS
- ทดสอบซ้ำว่า admin ยังแก้ได้ **และ** `curl` แบบไม่มี id_token ต้องถูกปฏิเสธ
- ถ้าล็อกเอาต์ตัวเองโดยไม่ตั้งใจ → ลบ property `REQUIRE_ID_TOKEN` ออก = กลับสู่ปกติทันที
  (ค่า default = ปิด จึงไม่มีทางล็อกถาวร)

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

- [ ] ส่วน A: รัน `refdata.sql` + `auth.sql` (+ `audit.sql`) ใน Supabase SQL Editor
- [ ] ส่วน A: ตรวจ `?status=neq.approved` คืน `[]`
- [ ] ส่วน B: copy `gas-complete.js` → deploy **New version** ทั้ง 2 GAS → เห็นเวอร์ชัน 5.66.0
- [ ] ส่วน C: ต่อสาย doGet/doPost (C1–C2) → deploy → ทดสอบ (C3)
- [ ] ส่วน C: ตั้ง `REQUIRE_ID_TOKEN=on` ทั้ง 2 GAS → ทดสอบซ้ำ (C4)
- [ ] ส่วน D: วางแผนทำภายหลัง
