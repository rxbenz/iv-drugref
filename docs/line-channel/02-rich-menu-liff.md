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
| Endpoint URL | `https://rxbenz.github.io/iv-drugref/` |
| Size | Full |
| Scope | `openid` |
| Add friend option | On (Normal) |
| shareTargetPicker | **OFF** (เปิดตอน Phase 7 พร้อม scope `chat_message.write`) |

## Rich menu (OA Manager)
- ชื่อ: **เมนูหลัก IV DrugRef** · เทมเพลต 6 ปุ่ม (2×3)
- **ดีไซน์ v2 (โทนสว่าง, ภาษาอังกฤษ)** — ใช้จริง: [`richmenu.jpg`](richmenu.jpg)
  (การ์ดขาว glassmorphism เงานุ่ม + ไอคอนเส้น gradient) · ต้นฉบับ [`richmenu.html`](richmenu.html)
  · ทางเลือกโทนเข้ม: [`richmenu-dark.jpg`](richmenu-dark.jpg) / [`richmenu-dark.html`](richmenu-dark.html)
- **แอ็กชัน = ลิงก์ (plain https)** — ไม่ใช่ LIFF URL · **ลำดับ 6 ปุ่ม/URL คงเดิม** (เปลี่ยนดีไซน์ = เปลี่ยนแค่รูป ไม่ต้องแก้ลิงก์):

| ปุ่ม (v2 EN) | ป้ายแอ็กชัน | URL |
|---|---|---|
| 🔍 Drug Info | Drug Info | `https://rxbenz.github.io/iv-drugref/index.html` |
| 🔗 Compatibility | Compatibility | `…/compatibility.html` |
| 💧 Renal Dosing | Renal Dosing | `…/renal-dosing.html` |
| 🧮 Calculators | Calculators | `…/calculator.html` |
| ⇄ Interactions | Interactions | `…/interactions.html` |
| 🛡️ Allergy | Allergy | `…/allergy.html` |

> ดีไซน์เดิม v1 (โทนเข้ม/ฟอนต์ไทย Loma) ถูกแทนด้วย v2 ตามที่ผู้ใช้เลือกโทนสว่าง

**ทำไม plain https ไม่ใช่ LIFF URL**: ลิงก์เว็บตรงเปิดใน **in-app browser ของ LINE**
(UA มี `Line/` → hardening ทำงาน) และ**ชัวร์กว่า** — ไม่ต้องพึ่งการต่อ path ของ LIFF
ที่จุกจิก (endpoint มี `/` ปิดท้าย → ถ้าใช้ LIFF URL path จะเพี้ยนเป็น `//`). LIFF app
เก็บไว้ใช้ Phase 3 (ปุ่มการ์ดในบอต) + Phase 7 (แชร์).

> รูป rich menu สร้างด้วย headless Chromium จาก HTML (การ์ด glassmorphism + inline SVG icons)
> ขนาด 2500×1686 JPEG ~130 KB (ต่ำกว่าลิมิต LINE 1 MB) · แก้ดีไซน์ที่ `richmenu.html` แล้วเรนเดอร์ใหม่:
> `chromium --headless=new --window-size=2500,1686 --default-background-color=eaf1f8ff --screenshot=out.jpg file://…/richmenu.html`

## ทดสอบบนมือถือ — ผ่านครบ ✅
1. ✅ เมนูโผล่ใต้ห้องแชต + กดแต่ละปุ่มเปิดถูกหน้าในแอป LINE
2. ✅ **ไม่มีจอโหลดวน** (สิ่งที่ Phase 1 แก้)
3. ✅ ปุ่มติดตั้ง PWA หายใน LINE (ยังมีใน Chrome ปกติ)
