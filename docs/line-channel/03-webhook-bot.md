# Phase 2 — โครงบอต: webhook + ตรวจลายเซ็น (คู่มือคอนโซล)

> เป้าหมาย: เอาโค้ดบอตขึ้น Supabase (ผ่านหน้าเว็บ) → ต่อเข้ากับ LINE → ทักบอตแล้วได้เมนูตอบ
> โค้ดอยู่ที่ `supabase/functions/line-webhook/` (4 ไฟล์: `index.ts`, `verify.mjs`, `messages.mjs`, `matcher.mjs`)
>
> ⚠️ **ห้ามวาง Channel secret / access token ลงไฟล์ใน repo** — วางเฉพาะในหน้า Supabase Secrets เท่านั้น

## ขั้นที่ 1 — สร้าง Edge Function ในหน้าเว็บ Supabase
1. https://supabase.com/dashboard → โปรเจกต์ **iv-drugref** → เมนูซ้าย **Edge Functions**
2. กด **Deploy a new function** → เลือก **Via Editor**
3. ตั้งชื่อฟังก์ชัน: **`line-webhook`** (ต้องชื่อนี้เป๊ะ — URL อ้างจากชื่อ)
4. ในเอดิเตอร์จะมีไฟล์ `index.ts` มาให้ 1 ไฟล์ → **ลบเนื้อหาเดิม** แล้ววางเนื้อหาจาก
   `supabase/functions/line-webhook/index.ts`
5. **เพิ่มอีก 3 ไฟล์** (ปุ่ม + / New file ในเอดิเตอร์) ชื่อให้ตรง แล้ววางเนื้อหาจาก repo:
   - `verify.mjs`
   - `messages.mjs`
   - `matcher.mjs`
   > ทั้ง 4 ไฟล์ต้องอยู่**โฟลเดอร์เดียวกัน** (index.ts อ้าง `./verify.mjs`, `./messages.mjs`, `./matcher.mjs`)
6. **สำคัญมาก — ปิด Verify JWT**: ในหน้า deploy/ตั้งค่าฟังก์ชัน หา **"Enforce JWT verification" / "Verify JWT"** แล้ว**ปิด (OFF)**
   - เพราะ LINE ไม่ได้ส่ง Supabase JWT มา ถ้าเปิดไว้จะโดนปฏิเสธก่อนถึงโค้ดเรา
   - ความปลอดภัยมาจาก **การตรวจลายเซ็น LINE** ในโค้ดแทน (ไฟล์ `verify.mjs`)
7. กด **Deploy**

## ขั้นที่ 2 — ตั้ง Secret (ของลับ 2 ตัวจาก Phase 0)
Edge Functions → **Secrets** → **Add new secret** ทีละตัว (ก๊อปค่าจาก password manager):
- `LINE_CHANNEL_SECRET` = Channel secret
- `LINE_CHANNEL_ACCESS_TOKEN` = Channel access token (long-lived)

> Secret เก็บฝั่งเซิร์ฟเวอร์ ไม่โผล่ในโค้ด/หน้าเว็บผู้ใช้ · ถ้าเปลี่ยนค่าต้องกด Deploy ฟังก์ชันใหม่ครั้งนึง

## ขั้นที่ 3 — เอา URL ไปต่อกับ LINE
URL ของ webhook คือ:
```
https://bzwbagojjpiazbeaahmg.supabase.co/functions/v1/line-webhook
```
1. LINE Developers Console → channel **Messaging API** ของ OA → แท็บ **Messaging API**
2. ช่อง **Webhook URL** → วาง URL ข้างบน → **Update**
3. กด **Verify** → ต้องได้ **Success** (200) ✅ — แปลว่า Supabase รับสายและตรวจลายเซ็นผ่าน
4. เปิดสวิตช์ **Use webhook** ให้ ON

## ขั้นที่ 4 — ปิดข้อความตอบกลับอัตโนมัติเดิมของ OA
เพื่อไม่ให้ระบบตอบกลับอัตโนมัติเดิมชนกับบอต:
- OA Manager → **การตั้งค่า → การตอบกลับ (Response settings)**
  - โหมดแชท: ตั้งเป็น **แชทบอท (Bot)** / เปิด **Webhook**
  - **ปิด** "ข้อความตอบกลับอัตโนมัติ (Auto-response)" และ "ข้อความทักทายเพื่อนใหม่ (Greeting)"
    (ถ้าอยากให้บอตเป็นคนทักเอง)

## ขั้นที่ 5 — ทดสอบ
- **จากมือถือ**: พิมพ์อะไรก็ได้หาบอต → ต้องได้ **เมนูช่วยเหลือ** ตอบกลับ (พร้อม disclaimer)
- **จำลองด้วยสคริปต์** (ไม่ต้องใช้แอป): เทียบว่าลายเซ็นถูก→200 / ผิด→403
  ```bash
  export LINE_CHANNEL_SECRET='...'   # ค่าจาก password manager
  export FUNCTION_URL='https://bzwbagojjpiazbeaahmg.supabase.co/functions/v1/line-webhook'
  bash scripts/line-webhook-sim.sh
  ```
- **ดู log**: Edge Functions → `line-webhook` → **Logs**

## แก้ปัญหาที่พบบ่อย
| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| Verify ได้ 401/JWT error | ยังไม่ได้ปิด **Verify JWT** (ขั้น 1.6) |
| Verify ได้ 403 | secret ไม่ตรง (ขั้น 2) หรือยังไม่ Deploy หลังตั้ง secret |
| ทักแล้วบอตเงียบ | ยังไม่เปิด Use webhook / ข้อความตอบกลับอัตโนมัติเดิมยังเปิดอยู่ / ดู Logs |
| บอตตอบช้าครั้งแรก | cold start ของ Edge Function (ปกติ) |

> Phase 3 จะต่อยอด: พิมพ์ชื่อยา → บอตค้นจาก Supabase แล้วตอบเป็นการ์ดข้อมูลยา (แทนเมนู)
