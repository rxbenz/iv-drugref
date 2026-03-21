# 💉 IV Drug Quick Reference — PWA

## คู่มือผสมยาฉีดฉบับพกพา
### กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา (Neurological Institute of Thailand)

**🌐 Live:** [https://rxbenz.github.io/iv-drugref/](https://rxbenz.github.io/iv-drugref/)

---

## ✨ Features

| Feature | รายละเอียด |
|---|---|
| 💊 **Drug Reference** | ข้อมูลยาฉีด 117 รายการ (Reconstitution, Dilution, Compatibility, Stability, Monitoring) |
| 🔍 **Smart Search** | ค้นหาด้วยชื่อสามัญ/การค้า + Filter ตาม category (HAD, Stroke, ICU, Antimicrobial ฯลฯ) |
| 🧮 **Dose Calculator** | คำนวณ dose สำหรับ Vasopressors, Sedatives (Norepinephrine, Dobutamine, Dopamine, Nicardipine, Dexmedetomidine, Adrenaline) |
| 🎯 **TDM Hub** | Therapeutic Drug Monitoring สำหรับ 4 ยา — Vancomycin (Bayesian MAP+MCMC), Phenytoin (Winter-Tozer), Aminoglycosides (Hartford nomogram), Valproate (Free level correction) |
| 📊 **Analytics Dashboard** | Dashboard v5 — Usage tracking, TDM per-drug analytics, User Journey timeline, Survey (Satisfaction + SUS) |
| 📡 **Offline PWA** | ใช้งานได้แม้ไม่มี internet — Service Worker cache ทุกหน้า |
| 🔄 **Dynamic Sync** | ข้อมูลยา sync จาก Google Sheets ทุก 30 นาที + fallback เป็น static data |

---

## 📁 โครงสร้างไฟล์

```
iv-drugref/
├── index.html                ← แอปหลัก (Drug Reference + Inline Dose Calc)
├── calculator.html           ← Dose Calculator (standalone page)
├── tdm.html                  ← TDM Hub (Vancomycin, Phenytoin, AG, Valproate)
├── vanco-tdm.html            ← Legacy Vancomycin Bayesian TDM v2
├── dashboard.html            ← Analytics Dashboard v5
├── sw.js                     ← Service Worker v4.3.0
├── manifest.json             ← PWA manifest
├── google-apps-script-v5.js  ← Google Apps Script (Analytics backend)
├── README.md                 ← ไฟล์นี้
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

## 🗺 Navigation Flow

```
index.html (Drug Reference)
├── 🧮 Dose Calculator → calculator.html
│   ├── Vancomycin card → 🧬 Bayesian TDM → tdm.html
│   ├── Amikacin/Gentamicin → 🎯 TDM → tdm.html
│   ├── Phenytoin → 🎯 TDM → tdm.html
│   └── Valproate → 🎯 TDM → tdm.html
├── 🎯 TDM Hub → tdm.html
└── 📊 Dashboard → dashboard.html
```

---

## 🎯 TDM Hub — รายละเอียดแต่ละยา

### Vancomycin — Bayesian MAP + MCMC
- 3 PK models: Buelga 2005, Roberts 2011 (ICU), Goti 2018
- Grid search + Nelder-Mead MAP optimization
- Metropolis-Hastings MCMC (2000 samples, 90% CI)
- AUC₂₄ target 400-600, dose optimizer (6 options)
- Auto model selection by lowest OFV

### Phenytoin — Winter-Tozer + Michaelis-Menten
- Winter-Tozer correction (hypoalbumin, renal impairment, dialysis)
- Orbit method: Vmax/Km estimation from 1 level
- Dose prediction table (targets 8-20 mcg/mL)
- MM dose-level curve visualization

### Aminoglycosides — Hartford Nomogram
- Amikacin + Gentamicin
- IBW/ABW dosing weight calculation
- Hartford nomogram interpolation (6-14h post-dose)
- 1-compartment PK from peak/trough or population estimates
- Concentration-time graph (3 doses)

### Valproate — Free Level Correction
- Free fraction estimation (albumin, concentration, uremia)
- Target ranges by indication (epilepsy, SE, bipolar, migraine)
- Drug interaction warnings (Carbapenem contraindicated, etc.)
- Linear dose adjustment calculation

---

## 📊 Analytics Pipeline (v5)

### Data Collection (8 sheets)
| Sheet | เก็บข้อมูล | Trigger |
|---|---|---|
| Sessions | Platform, standalone, screen size | Page load (consent) |
| Searches | Query, drug clicked, time-to-click | Card expand |
| Surveys | Satisfaction (5 ข้อ) + SUS (10 ข้อ) | Auto-prompt |
| DoseCalcs | Drug, patient params, result | Explicit drug selection |
| DrugExpands | Drug, source (search/browse/filter) | Card expand |
| PageViews | Page, duration, from_page, referrer | Enter/leave every page |
| TDMUsage | Drug, all patient params, measured levels, clinical interpretation | Run calculation |
| CalcVisits | Page, referrer | Page load |

### Dashboard Features
- 📈 Overview (DAU, searches, satisfaction, SUS)
- 💊 Drug Usage (top searched, top expanded, filter usage)
- 🎯 TDM Hub (per-drug breakdown, interpretation distribution, model usage)
- 🧮 Dose Calc (usage by drug, visits by day)
- 📋 Survey (satisfaction breakdown, SUS, demographics)
- 👥 Retention (returning users, retention rate)
- 🗺 User Journey (page flow, time-on-page, user timeline lookup)

### Analytics Rules
- เก็บเฉพาะ **actual usage** — ไม่ track passive browsing
- TDM: fire เมื่อกด Calculate เท่านั้น
- Dose Calculator: fire เมื่อ user เลือกยา (ไม่ใช่ auto-recalc)
- page_view: track enter + leave with duration ทุกหน้า
- Anonymous — ไม่เก็บชื่อ, IP, หรือข้อมูลส่วนบุคคล

---

## 🚀 วิธี Deploy

### GitHub Pages (Production)
1. Push ไฟล์ทั้งหมดขึ้น GitHub repository
2. Settings → Pages → Deploy from branch `main` / `root`
3. URL: `https://rxbenz.github.io/iv-drugref/`

### Google Apps Script (Analytics Backend)
1. เปิด Google Sheets → Extensions → Apps Script
2. Paste `google-apps-script-v5.js`
3. Run → `setupV5()` (สร้าง sheets + columns ใหม่, ไม่ลบ data เดิม)
4. Deploy → New deployment → Web app → Anyone

### Service Worker Update
1. แก้ไฟล์ HTML ตามต้องการ
2. เปลี่ยน `CACHE_NAME` ใน `sw.js` (เช่น `iv-drugref-v4.4.0`)
3. Push ขึ้น GitHub
4. ผู้ใช้จะเห็นแถบสีเขียว "มีเวอร์ชันใหม่" → แตะเพื่ออัปเดต

---

## 📡 Offline Support
- Service Worker cache ทุกหน้า (Stale-While-Revalidate strategy)
- ข้อมูลยา 117 รายการฝังใน HTML (STATIC_DRUGS) → ใช้ได้ทันทีแม้ offline
- Background sync จาก Google Sheets ทุก 30 นาที (เมื่อ online)
- แถบสีเหลือง "ออฟไลน์" เมื่อไม่มี internet

---

## 📱 ติดตั้งเป็น App

### Android (Chrome)
1. เปิด URL → banner "ติดตั้งเป็น App" จะขึ้นอัตโนมัติ
2. หรือ เมนู ⋮ → "Install app"

### iOS (Safari)
1. เปิด URL → กดปุ่ม Share ⬆
2. เลือก "Add to Home Screen" → Add

---

## 📝 Version History

| Version | วันที่ | การเปลี่ยนแปลง |
|---|---|---|
| **4.3.0** | มี.ค. 2569 | TDM Hub (4 drugs), Analytics v5 (PageViews + User Journey), unified page_view tracking |
| 4.2.0 | มี.ค. 2569 | Dynamic drug loading (Google Sheets sync), inline dose calculator, v4 analytics |
| 3.0.0 | มี.ค. 2569 | Survey system (Satisfaction + SUS), consent banner, v3 analytics |
| 2.0.0 | มี.ค. 2569 | Analytics dashboard, search tracking, PWA install banners |
| 1.0.0 | มี.ค. 2569 | Initial release — 48 drugs, basic search, offline PWA |

---

## 📜 License

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**

✅ ใช้งาน แชร์ ดัดแปลงได้ — ต้องให้เครดิตผู้สร้าง | ❌ ห้ามใช้เชิงพาณิชย์ | 🔄 ดัดแปลงต้องแชร์ภายใต้สัญญาเดียวกัน

---

## 👨‍⚕️ ผู้จัดทำ

**ภก. ฐาปนัท นาคครุฑ (Benz)**
กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา
กรมการแพทย์ กระทรวงสาธารณสุข

📱 LINE: rxbenz | 📧 thapanat.nk@gmail.com

---

## 📚 แหล่งอ้างอิง

- Lexicomp Online
- Trissel's Handbook on Injectable Drugs (21st Ed.)
- AHFS Drug Information
- ISMP High-Alert Medications
- AHA/ACLS Guidelines
- Package Inserts
- ASHP/IDSA Vancomycin Guidelines 2020
- AES Status Epilepticus Guidelines
- AHA/ASA Stroke Guidelines
