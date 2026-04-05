# IV DrugRef v5.0 — คู่มือ Deploy ขึ้น GitHub Pages

## สิ่งที่ต้องมีก่อน Deploy

- [x] Node.js ติดตั้งบนเครื่อง (v16+)
- [x] Git ติดตั้งบนเครื่อง
- [x] GitHub account (rxbenz)
- [x] GitHub repo สำหรับ IV DrugRef (public หรือ private ก็ได้)

---

## ขั้นตอนที่ 1: เตรียม repo บน GitHub

### ถ้ายังไม่มี repo:
1. ไปที่ https://github.com/new
2. ตั้งชื่อ repo เช่น `iv-drugref` หรือชื่อที่ต้องการ
3. เลือก **Public** (GitHub Pages ฟรีสำหรับ public repo)
4. **ไม่ต้อง** เลือก Initialize with README
5. กด **Create repository**
6. Copy URL ของ repo เช่น `https://github.com/rxbenz/iv-drugref.git`

### ถ้ามี repo อยู่แล้ว:
- ใช้ URL ของ repo เดิมได้เลย

---

## ขั้นตอนที่ 2: Build Production บนเครื่อง

เปิด Terminal แล้ว cd ไปที่ folder v5.0-modular:

```bash
# 1. cd ไปที่ project folder
cd "path/to/IV DrugRef PWA Development/v5.0-modular"

# 2. ติดตั้ง dependencies (ครั้งแรกครั้งเดียว)
npm install

# 3. Build production (minified)
node build.js --prod
```

ถ้าสำเร็จจะเห็น:
```
✅ Build completed!
📊 Summary: 8 pages built, total HTML: 680.5 KB
```

ไฟล์ทั้งหมดจะอยู่ใน folder `dist/`

---

## ขั้นตอนที่ 3: Deploy ขึ้น GitHub Pages

### วิธี A: ใช้ deploy.sh (แนะนำ)

```bash
# ครั้งแรก — ใส่ URL ของ repo
chmod +x deploy.sh
./deploy.sh --setup https://github.com/rxbenz/REPO_NAME.git

# ครั้งถัดไป — แค่รัน
./deploy.sh
```

### วิธี B: ทำเอง step by step

```bash
# 1. cd เข้าไปใน dist/
cd dist

# 2. Init git (ครั้งแรกเท่านั้น)
git init
git remote add origin https://github.com/rxbenz/REPO_NAME.git

# 3. สร้าง branch gh-pages
git checkout -B gh-pages

# 4. Add ไฟล์ทั้งหมด
git add -A

# 5. Commit
git commit -m "Deploy IV DrugRef v5.0.0"

# 6. Push ขึ้น GitHub
git push -u origin gh-pages --force

# 7. กลับไป folder หลัก
cd ..
```

---

## ขั้นตอนที่ 4: เปิด GitHub Pages

1. ไปที่ repo บน GitHub: `https://github.com/rxbenz/REPO_NAME`
2. คลิก **Settings** (tab ด้านบน)
3. คลิก **Pages** (menu ซ้ายมือ ใต้ "Code and automation")
4. ใน section **Build and deployment**:
   - **Source**: เลือก `Deploy from a branch`
   - **Branch**: เลือก `gh-pages` แล้วเลือก `/ (root)`
5. กด **Save**
6. รอ 1-2 นาที แล้ว refresh หน้า

จะเห็น URL ของเว็บ:
```
https://rxbenz.github.io/REPO_NAME/
```

---

## ขั้นตอนที่ 5: ทดสอบหลัง Deploy

### 5.1 เปิดเว็บใน Chrome
- ไปที่ `https://rxbenz.github.io/REPO_NAME/`
- เช็คว่าหน้าแรก (index.html) โหลดปกติ
- ลองคลิกไปหน้าอื่น ๆ (TDM, Calculator, etc.)

### 5.2 ทดสอบ PWA Install
- บน Chrome desktop: คลิกไอคอน install ที่ address bar (ถ้ามี)
- บน Chrome mobile: กดเมนู ⋮ → "Add to Home screen"
- เปิด app จาก home screen ดูว่าทำงานปกติ

### 5.3 ทดสอบ Offline Mode
1. เปิด Chrome DevTools (F12)
2. ไป tab **Application** → **Service Workers**
3. เช็คว่า sw.js registered สำเร็จ
4. ไป tab **Network** → ติ๊ก **Offline**
5. Reload หน้า — app ควรยังใช้งานได้ (โหลดจาก cache)
6. เปิด Offline กลับ

### 5.4 Lighthouse Audit
1. เปิด Chrome DevTools (F12)
2. ไป tab **Lighthouse**
3. เลือก Categories: **Performance**, **PWA**, **Best Practices**
4. เลือก Device: **Mobile**
5. กด **Analyze page load**
6. ดู score — เป้าหมาย: PWA > 90, Performance > 80

### 5.5 เช็ค Service Worker Features
1. DevTools → Application → Service Workers
   - ✅ Status: activated and running
   - ✅ Source: sw.js
2. DevTools → Application → Cache Storage
   - ✅ `iv-drugref-v5.0.0` (app shell cache)
   - ✅ `iv-drugref-data-v1` (drug data cache)

---

## การ Update ครั้งถัดไป

เมื่อแก้ไข code แล้วอยาก deploy ใหม่:

```bash
# 1. แก้ไข source files ใน v5.0-modular/

# 2. Build ใหม่
node build.js --prod

# 3. Deploy
./deploy.sh
```

**สำคัญ**: ถ้าเปลี่ยน version ต้องอัพเดต 4 ที่:
1. `js/core.js` → `const VERSION = 'x.x.x'`
2. `js/error-tracker.js` → `APP_VERSION: 'x.x.x'`
3. `sw.js` → `const CACHE_NAME = 'iv-drugref-vx.x.x'`
4. `manifest.json` → `"version": "x.x.x"`

---

## Troubleshooting

### GitHub Pages ไม่แสดงเว็บ
- เช็คว่า branch `gh-pages` มีไฟล์ `index.html` อยู่ที่ root
- ไปที่ Settings → Pages ดูว่า source เป็น `gh-pages` / root
- รอ 2-5 นาทีหลัง push (GitHub ต้อง build)

### Service Worker ไม่ register
- HTTPS เท่านั้น (GitHub Pages มี HTTPS อัตโนมัติ)
- ถ้าเปิดจาก `file://` จะไม่ทำงาน — ต้องเปิดจาก URL จริง

### Cache ไม่ update หลัง deploy ใหม่
- เปลี่ยน `CACHE_NAME` ใน sw.js ทุกครั้งที่ deploy version ใหม่
- หรือ DevTools → Application → Storage → Clear site data

### Push Notification ไม่ทำงาน
- ต้องขอ permission จาก user ก่อน (`Notification.requestPermission()`)
- HTTPS required
- ต้องมี push subscription key (VAPID) ที่ server

---

## File Structure สำหรับ Reference

```
v5.0-modular/
├── css/                    # CSS modules (source)
│   ├── shared.css
│   ├── theme-light.css
│   ├── theme-dark.css
│   ├── index.css
│   ├── tdm.css
│   ├── renal-dosing.css
│   ├── calculator.css
│   ├── compatibility.css
│   ├── dashboard.css
│   ├── vanco-tdm.css
│   └── admin.css
├── js/                     # JS modules (source)
│   ├── error-tracker.js
│   ├── core.js
│   ├── index.js
│   ├── tdm.js
│   ├── renal-dosing.js
│   ├── calculator.js
│   ├── compatibility.js
│   ├── dashboard.js
│   ├── vanco-tdm.js
│   └── admin.js
├── icons/                  # PWA icons
├── dist/                   # Built output (deploy this)
├── *.html                  # HTML pages (source)
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
├── drugs-data.json         # Drug database
├── i18n.js                 # Internationalization
├── translations-en.js      # English translations
├── build.js                # Build script
├── deploy.sh               # Deploy script
└── package.json            # Node dependencies
```
