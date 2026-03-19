# IV Drug Quick Reference — PWA

## คู่มือผสมยาฉีดฉบับพกพา
### กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา (Neurological Institute of Thailand)

---

## 📁 โครงสร้างไฟล์

```
iv-drugref-pwa/
├── index.html          ← แอปหลัก (ข้อมูลยา 48 รายการฝังในไฟล์)
├── manifest.json       ← PWA manifest (ข้อมูลชื่อ, icon, theme)
├── sw.js               ← Service Worker (จัดการ offline cache)
├── README.md           ← ไฟล์นี้
└── icons/
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    ├── icon-512x512.png
    ├── icon-maskable-192x192.png
    └── icon-maskable-512x512.png
```

---

## 🚀 วิธี Deploy บน GitHub Pages (ฟรี 100%)

### ขั้นตอนที่ 1: สร้าง GitHub Account (ถ้ายังไม่มี)
1. ไปที่ https://github.com/signup
2. สร้างบัญชี (ใช้ email โรงพยาบาลหรือส่วนตัวก็ได้)

### ขั้นตอนที่ 2: สร้าง Repository ใหม่
1. กดปุ่ม **"+"** มุมขวาบน → **"New repository"**
2. ตั้งชื่อ: `iv-drugref` (หรือชื่อที่ต้องการ)
3. เลือก **Public** (ต้องเป็น Public สำหรับ GitHub Pages ฟรี)
4. กด **"Create repository"**

### ขั้นตอนที่ 3: Upload ไฟล์
1. ในหน้า repository ว่างๆ กด **"uploading an existing file"**
2. ลากไฟล์ทั้งหมด (index.html, manifest.json, sw.js, โฟลเดอร์ icons/) มาวาง
3. ⚠️ **สำคัญ:** ต้อง upload ทีละชั้น:
   - Upload `index.html`, `manifest.json`, `sw.js` ก่อน → Commit
   - สร้างโฟลเดอร์ `icons` → Upload ไฟล์ icon ทั้งหมด → Commit
4. หรือใช้ GitHub Desktop / git CLI จะสะดวกกว่า

### ขั้นตอนที่ 4: เปิด GitHub Pages
1. ไปที่ **Settings** (แท็บบนสุด) → **Pages** (เมนูซ้าย)
2. ที่ **Source** → เลือก **"Deploy from a branch"**
3. **Branch** → เลือก `main` → โฟลเดอร์ `/ (root)`
4. กด **Save**
5. รอ 1-2 นาที → จะได้ URL: `https://[username].github.io/iv-drugref/`

### ขั้นตอนที่ 5: ติดตั้งเป็น App บนมือถือ
#### Android (Chrome):
1. เปิด URL ด้วย Chrome
2. จะมี banner ขึ้นมาว่า "ติดตั้งเป็น App" → กด **ติดตั้ง**
3. หรือ กดเมนู ⋮ → **"Add to Home screen"** / **"Install app"**

#### iOS (Safari):
1. เปิด URL ด้วย Safari
2. กดปุ่ม Share (⬆) ด้านล่าง
3. เลือก **"Add to Home Screen"**
4. ตั้งชื่อ → กด **Add**

---

## 📡 การใช้งาน Offline
- หลังเปิดแอปครั้งแรก (online) → Service Worker จะ cache ทุกอย่างอัตโนมัติ
- ครั้งต่อไปเปิดได้แม้ไม่มี internet
- ข้อมูลยา 48 รายการฝังอยู่ใน HTML → ไม่ต้องเรียก API ใดๆ
- ถ้าออฟไลน์จะมีแถบสีเหลืองขึ้นแจ้ง

---

## 🔄 การอัปเดตข้อมูล
1. แก้ไขไฟล์ `index.html` (เพิ่ม/แก้ข้อมูลยาใน array `DRUGS`)
2. เปลี่ยน version ใน `sw.js` (แก้ `CACHE_NAME` เช่น `iv-drugref-v1.1.0`)
3. Push ขึ้น GitHub
4. ผู้ใช้จะเห็นแถบสีเขียว "มีเวอร์ชันใหม่" → แตะเพื่ออัปเดต

---

## ⚡ ทางเลือกอื่นในการ Deploy

### Netlify (ง่ายมาก)
1. ไปที่ https://netlify.com → Sign up
2. ลากโฟลเดอร์ทั้งหมดมาวาง → Deploy ทันที
3. ได้ URL ฟรี เช่น `iv-drugref.netlify.app`

### ใช้ใน Local Network โรงพยาบาล
1. วางไฟล์บน web server ภายใน (Apache/Nginx)
2. เข้าถึงผ่าน IP: `http://192.168.x.x/iv-drugref/`
3. ⚠️ PWA install ต้องใช้ HTTPS (ยกเว้น localhost)

---

## 📝 ข้อมูลเวอร์ชัน
- **Version:** 1.0.0
- **จัดทำโดย:** กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา
- **วันที่:** มีนาคม 2569 (2026)
- **จำนวนยา:** 48 รายการ (ยาฉีดที่สำคัญ)
- **แหล่งอ้างอิง:** Lexicomp, Trissel's, Package Inserts, Clinical Guidelines
