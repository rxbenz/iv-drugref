# ค่าลับ (secrets) — เก็บที่ไหน / เปลี่ยนยังไง

> ⚠️ **repo นี้เป็น public** — ห้ามวางค่าลับลงในไฟล์ใด ๆ ของ repo เด็ดขาด
> (รวมถึงในคอมเมนต์ ตัวอย่างโค้ด เอกสาร และ screenshot)
>
> ไฟล์นี้บอก **ตำแหน่งที่เก็บ** เท่านั้น **ไม่มีค่าจริง**

## ตารางสรุป

| ค่า | เก็บที่ | ใช้ทำอะไร | ถ้าไม่มีจะเป็นยังไง |
|---|---|---|---|
| **LINE Channel secret** | Supabase → Edge Functions → **Secrets** (`LINE_CHANNEL_SECRET`) | ตรวจลายเซ็นว่า webhook มาจาก LINE จริง | บอตปฏิเสธทุกข้อความ (403) |
| **LINE Channel access token** | Supabase Secrets (`LINE_CHANNEL_ACCESS_TOKEN`) | บอตตอบแชต (reply — ฟรี) | บอตรับข้อความได้แต่ตอบไม่ได้ |
| **LINE Channel access token** (ตัวเดียวกัน) | **GAS → Project Settings → Script Properties** (`LINE_CHANNEL_ACCESS_TOKEN`) | broadcast ประกาศด่วนเข้า LINE | ประกาศในแอปยังทำงานปกติ แต่ส่ง LINE ไม่ได้ (แจ้ง error ให้เห็น) |
| **Supabase service key** | GAS Script Properties (`SUPABASE_SERVICE_KEY`) | GAS เขียนข้อมูลอ้างอิงกลับเข้า Supabase | admin แก้ข้อมูลแล้วไม่ sync เข้า Supabase |
| **LIFF ID** | ไม่ลับ — อยู่ในโค้ด/เอกสารได้ | สร้างลิงก์ `liff.line.me/...` | — |
| **Supabase publishable key** | ไม่ลับ — hardcode ใน `core.js`/`dashboard.js` ตามการออกแบบ | client อ่าน/เขียนข้อมูลตาม RLS | — |

> token ตัวเดียวกันต้องใส่ **2 ที่** (Supabase + GAS) เพราะคนละระบบทำคนละหน้าที่:
> Supabase = ตอบแชต · GAS = ส่งประกาศ

## วิธีเปลี่ยน/ออก token ใหม่ (rotate)

ทำเมื่อ token หลุด หรือเปลี่ยนตามรอบความปลอดภัย

1. **ออกตัวใหม่**: LINE Developers Console → channel Messaging API → แท็บ Messaging API → **Channel access token** → **Issue** (ตัวเก่าจะใช้ไม่ได้ทันทีถ้ากด Reissue)
2. **อัปเดต Supabase**: Dashboard → Edge Functions → Secrets → แก้ `LINE_CHANNEL_ACCESS_TOKEN` → **Deploy ฟังก์ชัน `line-webhook` ใหม่ 1 ครั้ง**
3. **อัปเดต GAS**: GAS editor → Project Settings → Script Properties → แก้ `LINE_CHANNEL_ACCESS_TOKEN` → **Deploy → New version** (ทำทั้ง 2 deployment)
4. **ตรวจ**:
   - บอต: ทักหาบอตในมือถือ → ต้องตอบได้
   - broadcast: หน้า admin → ประกาศด่วน → ติ๊ก LINE → ต้องแสดงโควตาได้ (ไม่ error 401)

**Channel secret** เปลี่ยนได้ที่หน้าเดียวกัน (Basic settings) → อัปเดตใน Supabase Secrets แล้ว Deploy ฟังก์ชันใหม่

## หลักการ

- ค่าลับอยู่ **ฝั่งเซิร์ฟเวอร์เท่านั้น** — ไม่เคยถูกส่งไปที่เบราว์เซอร์ผู้ใช้
- โค้ดที่ต้องใช้ค่าลับ **อ่านจาก Script Properties / Secrets เสมอ** ไม่มี fallback เป็นค่าใน repo
- ถ้าค่าลับหาย โค้ดต้อง **แจ้ง error ให้เห็น** ไม่ใช่เงียบ ๆ ทำงานผิด (เช่น broadcast จะรายงานว่า `LINE_CHANNEL_ACCESS_TOKEN not set`)
