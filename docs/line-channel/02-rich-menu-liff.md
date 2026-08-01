# Phase 1 — LINE entry (WebView hardening + LIFF + rich menu) — บันทึก

> สถานะ: ✅ เสร็จ + deploy live (**v5.53.0**, 2026-07-17) · ทดสอบบนมือถือผ่านครบ 3 ข้อ

## โค้ดที่ ship (v5.53.0)
- `js/core.js` — `isLineInApp(ua)` + ใน LINE downgrade auto-reload 2 ทาง
  (force-update banner / SW `controllerchange`) เป็นแบบ **กดเอง** → กัน reload วน
- `js/site-chrome.js` — ซ่อนปุ่ม/แบนเนอร์ติดตั้ง PWA เมื่ออยู่ใน LINE
- `js/index.js` — แนบ `line_inapp` ใน `SESSION_START`
- `test/line-webview.test.js` — 4 เคส (LINE/LIFF UA = true; เบราว์เซอร์/คำหลอก = false)

## LIFF app (สร้างบน LINE Login channel)
| ฟิลด์ | ค่า |
|---|---|
| **LIFF ID** | `2010742553-w9T3Wtjt`  ← public, ใช้ต่อใน Phase 3/7 |
| LIFF URL | `https://liff.line.me/2010742553-w9T3Wtjt` |
| Endpoint URL | `https://rxbenz.github.io/iv-drugref` ← **ห้ามมี `/` ปิดท้าย** (ดูกับดักข้อ 2) |
| Size | Full |
| Scope | `openid` + `chat_message.write` (เปิดตอน Phase 7) |
| Add friend option | On (Normal) |
| shareTargetPicker | **ON** (Phase 7) |

## Rich menu (OA Manager)
- ชื่อ: **เมนูหลัก IV DrugRef** · เทมเพลต 6 ปุ่ม (2×3)
- **ดีไซน์ v2 (โทนสว่าง, ภาษาอังกฤษ)** — ใช้จริง: [`richmenu.jpg`](richmenu.jpg)
  (การ์ดขาว glassmorphism เงานุ่ม + ไอคอนเส้น gradient) · ต้นฉบับ [`richmenu.html`](richmenu.html)
  · ทางเลือกโทนเข้ม: [`richmenu-dark.jpg`](richmenu-dark.jpg) / [`richmenu-dark.html`](richmenu-dark.html)
- **แอ็กชัน = ลิงก์** · ลำดับ 6 ปุ่มคงเดิมเสมอ (เปลี่ยนดีไซน์ = เปลี่ยนแค่รูป ไม่ต้องแก้ลิงก์)
- ⚠️ **ตารางข้างล่างคือ URL ชุดเดิม (plain https) ซึ่งถูกแทนแล้ว** — ใช้ชุด LIFF ในหัวข้อถัดไป

| ปุ่ม (v2 EN) | ป้ายแอ็กชัน | URL เดิม (เลิกใช้) |
|---|---|---|
| 🔍 Drug Info | Drug Info | `https://rxbenz.github.io/iv-drugref/index.html` |
| 🔗 Compatibility | Compatibility | `…/compatibility.html` |
| 💧 Renal Dosing | Renal Dosing | `…/renal-dosing.html` |
| 🧮 Calculators | Calculators | `…/calculator.html` |
| ⇄ Interactions | Interactions | `…/interactions.html` |
| 🛡️ Allergy | Allergy | `…/allergy.html` |

> ดีไซน์เดิม v1 (โทนเข้ม/ฟอนต์ไทย Loma) ถูกแทนด้วย v2 ตามที่ผู้ใช้เลือกโทนสว่าง

**อัปเดต (v5.83.0) — เปลี่ยนมาใช้ LIFF URL แล้ว**

เดิมใช้ลิงก์เว็บธรรมดาเพราะเสถียรกว่า แต่หน้าที่เปิดแบบนั้นอยู่ใน **in-app browser
ไม่ใช่ LIFF browser** → `shareTargetPicker` (Phase 7) ใช้ไม่ได้ ปุ่มแชร์เลยตกไปใช้คัดลอกตลอด
จึงเปลี่ยนปุ่ม rich menu เป็น LIFF URL:

```
https://liff.line.me/2010742553-w9T3Wtjt/index.html
https://liff.line.me/2010742553-w9T3Wtjt/compatibility.html
https://liff.line.me/2010742553-w9T3Wtjt/renal-dosing.html
https://liff.line.me/2010742553-w9T3Wtjt/calculator.html
https://liff.line.me/2010742553-w9T3Wtjt/interactions.html
https://liff.line.me/2010742553-w9T3Wtjt/allergy.html
```

**3 กับดักที่ต้องตั้งให้ถูก ไม่งั้นพัง:**

1. **LINE Login channel ต้อง Published** — ถ้ายัง Developing จะเปิดได้เฉพาะคนที่มีสิทธิ์ใน
   channel คนอื่นกดแล้ว error
2. **Endpoint URL ต้องไม่มี `/` ปิดท้าย** → ตั้งเป็น `https://rxbenz.github.io/iv-drugref`
3. **ต้องมีตัวส่งต่อ `liff.state`** ← สาเหตุที่รอบแรกกดปุ่ม Calculators แล้วไปโผล่หน้า index:
   LIFF ไม่ได้เปิดหน้านั้นตรง ๆ มันเปิด **Endpoint URL (= index)** แล้วแนบ
   `?liff.state=%2Fcalculator.html` มาให้หน้าเว็บพาตัวเองไปต่อ ซึ่ง index ไม่มีตัวจัดการ
   → v5.83.0 เพิ่มตัวส่งต่อใน `core.js` (ทำงานทุกหน้า ทันที ไม่ต้องรอ LIFF SDK
   และรับเฉพาะ path ในโดเมนตัวเอง กัน open redirect) ล็อกด้วย `test/liff-state.test.js`

> รูป rich menu สร้างด้วย headless Chromium จาก HTML (การ์ด glassmorphism + inline SVG icons)
> ขนาด 2500×1686 JPEG ~130 KB (ต่ำกว่าลิมิต LINE 1 MB) · แก้ดีไซน์ที่ `richmenu.html` แล้วเรนเดอร์ใหม่:
> `chromium --headless=new --window-size=2500,1686 --default-background-color=eaf1f8ff --screenshot=out.jpg file://…/richmenu.html`

## ทดสอบบนมือถือ — ผ่านครบ ✅
1. ✅ เมนูโผล่ใต้ห้องแชต + กดแต่ละปุ่มเปิดถูกหน้าในแอป LINE
2. ✅ **ไม่มีจอโหลดวน** (สิ่งที่ Phase 1 แก้)
3. ✅ ปุ่มติดตั้ง PWA หายใน LINE (ยังมีใน Chrome ปกติ)
