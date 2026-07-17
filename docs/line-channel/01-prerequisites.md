# Phase 0 — เตรียมคอนโซล (คู่มือทีละขั้น)

> เป้าหมาย: รวบรวม "กุญแจ" และเครื่องมือที่ phase ถัด ๆ ไปต้องใช้ — **ยังไม่มีการเขียนโค้ด
> และยังไม่มีอะไรเปลี่ยนกับแอปหรือ OA ที่ผู้ใช้เห็น**
>
> ⚠️ ค่าลับทุกตัวในหน้านี้ (Channel secret / Channel access token) ให้จดลง
> **password manager หรือที่จดส่วนตัว** เท่านั้น — **ห้ามวางลงไฟล์ใด ๆ ใน repo,
> ห้ามส่งในแชตสาธารณะ, ห้ามติดไปกับ screenshot** (repo นี้เป็น public ทั้งโลกเห็น)

## สิ่งที่จะได้เมื่อจบ Phase 0

- [ ] Messaging API channel ที่ผูกกับ OA เดิม (ช่องทางให้บอตรับ-ส่งข้อความ)
- [ ] **Channel secret** (จดเก็บส่วนตัว) — ไว้ตรวจลายเซ็นว่าคำขอมาจาก LINE จริง
- [ ] **Channel access token** (จดเก็บส่วนตัว) — ไว้ให้บอตส่งข้อความออก
- [ ] LINE Login channel (เปล่า ๆ ไว้ก่อน) — ที่อยู่ของ LIFF app ใน Phase 1
- [ ] ยืนยันเปิดหน้า Edge Functions ใน Supabase dashboard ได้ (deploy ผ่านเว็บ — ไม่ใช้ CLI)
- [ ] ตัวเลขโควตาข้อความฟรี/เดือนของ OA (จดลงตารางท้ายไฟล์นี้)

---

## ขั้นที่ 1 — เปิด Messaging API ให้ OA เดิม

**Messaging API คืออะไร**: ช่องทางแบบโปรแกรม (API) ของ OA — เปิดแล้วบอต/ระบบของเรา
จะรับข้อความที่คนพิมพ์เข้ามา และตอบกลับเองได้ (rich menu แบบลิงก์เฉย ๆ ไม่จำเป็นต้องใช้
แต่แชตบอต Phase 2 ต้องใช้แน่นอน — เปิดตอนนี้เลยทีเดียวจบ)

1. เข้า **LINE Official Account Manager** — https://manager.line.biz — ด้วยบัญชีที่เป็น
   แอดมินของ OA
2. เลือก OA ของเรา → **ตั้งค่า (Settings)** (มุมขวาบน) → เมนูซ้าย **Messaging API**
3. ถ้ายังไม่เคยเปิด: กด **เปิดใช้งาน Messaging API (Use Messaging API)**
   - ระบบจะให้เลือก/สร้าง **Provider** — คือ "กล่องรวมโปรเจกต์" ในฝั่งนักพัฒนาของ LINE
     (หนึ่ง provider มีได้หลาย channel) → ถ้ายังไม่มี ให้สร้างใหม่ตั้งชื่อ เช่น `IV DrugRef`
     **ข้อควรระวัง: OA หนึ่งตัวผูก provider ได้ครั้งเดียว ย้ายทีหลังไม่ได้** — ใช้ provider
     ที่เราตั้งเอง อย่าไปเกาะ provider ขององค์กรอื่น
   - ยอมรับเงื่อนไข → เสร็จแล้วหน้านี้จะแสดง **Channel ID** และชื่อ channel
4. เสร็จขั้นนี้ OA เราจะไปโผล่เป็น **Messaging API channel** ใน LINE Developers Console ด้วย

> หมายเหตุ: การเปิด Messaging API **ยังไม่เปลี่ยนพฤติกรรม OA** — ข้อความตอบกลับอัตโนมัติ
> เดิม (ถ้ามี) ยังทำงานเหมือนเดิม จนกว่าเราจะสลับไปใช้ webhook ใน Phase 2

## ขั้นที่ 2 — เก็บ Channel secret + ออก Channel access token

ทำใน **LINE Developers Console** — https://developers.line.biz/console/
(login ด้วยบัญชีเดียวกับข้อ 1)

1. เลือก provider ที่ได้จากขั้นที่ 1 → คลิก channel ของ OA (ชนิด **Messaging API**)
2. แท็บ **Basic settings** → เลื่อนหา **Channel secret** → กด copy → **จดลง password manager**
   (ตั้งชื่อรายการ เช่น `IV DrugRef — LINE channel secret`)
3. แท็บ **Messaging API** → เลื่อนลงล่างสุดหา **Channel access token (long-lived)** →
   กด **Issue** (ออก token) → copy → **จดลง password manager**
   - token นี้คือ "กุญแจส่งข้อความในนาม OA" — ใครได้ไปคือส่งข้อความหาผู้ติดตามเราได้
     ถ้าหลุดเมื่อไร ให้กลับมาหน้านี้กด **Reissue** (ออกใหม่ ตัวเก่าตายทันที)
4. แท็บเดียวกันนี้จะมีช่อง **Webhook URL** — **ยังไม่ต้องใส่อะไร** (จะใส่ตอน Phase 2)

## ขั้นที่ 3 — สร้าง LINE Login channel (บ้านของ LIFF ใน Phase 1)

**ทำไมต้องมีอีก channel**: LIFF app (ตัวที่ทำให้เว็บเราเปิดเต็มจอในแอป LINE ได้ผ่านลิงก์
`https://liff.line.me/...`) ปัจจุบัน LINE ให้สร้างไว้ใต้ channel ชนิด **LINE Login**
(ไม่ใช่ Messaging API) — สร้างเปล่า ๆ รอไว้ก่อน ตัว LIFF app ค่อยเพิ่มตอน Phase 1

1. ใน LINE Developers Console → เลือก provider เดิม → **Create a new channel**
2. เลือกชนิด **LINE Login** → กรอก:
   - Region: Thailand · Channel name: เช่น `IV DrugRef LIFF` · คำอธิบายสั้น ๆ
   - App types: เลือก **Web app**
3. สร้างเสร็จปล่อยไว้แค่นี้ (สถานะ Developing ได้ ไม่ต้อง publish จนกว่าจะใช้จริง)

## ขั้นที่ 4 — ยืนยันว่าเปิดหน้า Edge Functions ใน Supabase dashboard ได้

> **การตัดสินใจ (2026-07-17)**: เราจะ **deploy บอตผ่านหน้าเว็บ Supabase dashboard**
> (โหมด **Via Editor** — เขียน/วางโค้ดในเบราว์เซอร์แล้วกด Deploy) **ไม่ใช้ Supabase CLI**
> — เหมือน mental model การวางโค้ดลง GAS editor ที่คุ้นอยู่แล้ว และไม่ต้องแตะ terminal เลย

**Edge Function คืออะไร**: โปรแกรมเล็ก ๆ ที่ฝากรันบนเซิร์ฟเวอร์ Supabase — Phase 2
เราจะใช้เป็น "webhook" (ที่รับข้อความจาก LINE มาตอบ)

**ขั้นนี้แค่ยืนยันว่ามี "ที่ให้ลงบอต" พร้อม (ไม่ต้องสร้าง function ตอนนี้):**
1. เข้า https://supabase.com/dashboard → เปิดโปรเจกต์ **`iv-drugref`**
2. เมนูซ้าย → **Edge Functions**
3. หน้าเปิดได้ (ยังว่าง ไม่มี function = ถูกต้อง) เห็นการ์ด **Via Editor**
   ("Create and edit functions directly in the browser") + เมนู **Secrets** ทางซ้าย = ผ่าน ✅

> Phase 2 เราจะกด **Deploy a new function** → เขียนโค้ดใน editor → ตั้งของลับที่เมนู
> **Secrets** (`LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` / `LIFF_ID`) —
> ทั้งหมดทำในเว็บ ไม่ต้องใช้ CLI

## ขั้นที่ 5 — เช็คโควตาข้อความฟรีของ OA แล้วจดไว้

1. กลับไป **LINE OA Manager** → OA ของเรา → **ตั้งค่า → แผนการใช้งาน / Subscription plan**
   (หรือดูจากหน้า **Insight → ข้อความ**)
2. ดูว่าแพลนปัจจุบันคืออะไร และได้ **ข้อความฟรีกี่ข้อความ/เดือน** → จดลงตารางข้างล่าง

**ทำไมต้องรู้**: การ "broadcast" (Phase 6) คิดโควตาแบบ *1 ผู้รับ = 1 ข้อความ* เช่น
ผู้ติดตาม 100 คน กด broadcast 1 ครั้ง = ใช้ 100 ข้อความ ส่วน**บอตตอบแชต (reply) ฟรี
ไม่จำกัด ไม่เกี่ยวกับโควตานี้**

| รายการ | ค่า (บันทึก 2026-07-17) |
|---|---|
| ชื่อแพลนปัจจุบัน | **ฟรี (Free)** — กำลังใช้งาน |
| ข้อความฟรี/เดือน | **300** (เพดานตายตัว — แพลนฟรีส่งเกินไม่ได้) |
| จำนวนผู้ติดตามปัจจุบัน | **~0** (OA ใหม่ ยังไม่มีเพื่อน) |
| → broadcast ได้ประมาณ (ฟรี ÷ ผู้ติดตาม) | ยังคำนวณไม่ได้ (ผู้ติดตาม 0) — คิดใหม่ตอน Phase 6 |

> **หมายเหตุแพ็กเกจ (กันสับสน)**: LINE มี 2 แพ็กเกจ**แยกกัน** —
> (1) **แพ็กเกจรายเดือน** (ฟรี 300 / เบสิค ฿1,280 = 15,000 / โปร ฿1,780 = 35,000 ข้อความ/เดือน)
> = โควตา **broadcast/push**; (2) **OA แชทแพ็กเกจ** (ฟรี / ฿555) = ฟีเจอร์จัดการแชท
> ของเจ้าหน้าที่ (แท็ก/โน้ต/ประวัติ). **บอตเราใช้แค่แพลนฟรีของทั้งคู่** — reply ผ่าน API
> ฟรีไม่จำกัด; broadcast ค่อยพิจารณาอัปเกรดถ้าเพื่อนเยอะจนเกิน 300/เดือน

---

## Checklist ปิด Phase 0 — ✅ เสร็จครบ (2026-07-17)

- [x] Messaging API เปิดแล้ว (เห็น channel ใน LINE Developers Console)
- [x] Channel secret อยู่ใน password manager
- [x] Channel access token (long-lived) อยู่ใน password manager
- [x] LINE Login channel สร้างแล้ว (ว่าง ๆ รอ LIFF)
- [x] เปิดหน้า Edge Functions ใน Supabase dashboard ได้ (Via Editor + Secrets พร้อม)
- [x] โควตาบันทึกแล้ว: ฟรี 300 ข้อความ/เดือน (เพดานตายตัว), ผู้ติดตาม ~0

**Phase 0 จบแล้ว** → ต่อ **Phase 1**: โค้ดกัน reload วนใน LINE (`isLineInApp` +
downgrade force-update + ซ่อนปุ่ม install) + เทสต์ แล้วสร้าง LIFF app + rich menu
(คู่มือ `02-rich-menu-liff.md` จะมาพร้อม Phase 1)
