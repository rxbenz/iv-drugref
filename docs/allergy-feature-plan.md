# Plan การพัฒนาฟีเจอร์ "ทางเลือกเมื่อแพ้ยา" (Allergy Cross-Reactivity)

> เครื่องมือช่วยตัดสินใจสำหรับเภสัชกร/บุคลากรการแพทย์: ผู้ป่วยแพ้ยา A →
> ควรหลีกเลี่ยงยาใด (แพ้ข้าม) และมีทางเลือกที่ปลอดภัยกว่าใดบ้าง โดยอิงเหตุผล
> เชิงโครงสร้าง (R1 side chain / กลุ่มยา), % แพ้ข้าม, ระดับความเสี่ยง และมี
> reference กำกับ — ปรับคำแนะนำตามความรุนแรงของปฏิกิริยา (severity gating).

**Mockup:** `mockups/allergy-cross-reactivity-mockup.html` (v1 — สว่าง/มืด, %, ref, เหตุผล R1)

## หลักการตลอดทุก phase
- ทำทีละ phase **แล้วหยุดให้เจ้าของโปรเจกต์ verify** ก่อนไปต่อ (โดยเฉพาะ Phase 1/5 ที่เป็นข้อมูลคลินิก)
- dev บน feature branch — ไม่แตะ `main` จนถึง Phase 6
- ข้อมูลคลินิกต้อง "มี reference + ผ่านการ verify โดยเภสัชกร" ก่อนขึ้นระบบเสมอ
- ทุกจุดที่ render ข้อมูลลง DOM ต้องผ่าน `IVDrugRef.escHtml()` (กฎ XSS ของโปรเจกต์)

## ภาพรวม phase

| Phase | ชื่อ | สถานะ |
|---|---|---|
| 0 | Mockup + scope | ✅ เสร็จ |
| 1 | Data research (beta-lactam) | 🔬 กำลังทำ |
| 2 | Data model + schema | รอ |
| 3 | สร้างหน้า UI (static) | รอ |
| 4 | Logic เชื่อมข้อมูล | รอ |
| 5 | ขยายกลุ่มยาอื่น | รอ |
| 6 | Integrate + ship | รอ |
| 7 | Admin CRUD (อนาคต) | backlog |

---

## Phase 0 — Mockup & Scope ✅
- ได้: mockup v1 (สว่าง/มืด, % แพ้ข้าม, reference, เหตุผล R1 side chain)
- **เสร็จแล้ว**

## Phase 1 — Deep-research ข้อมูล beta-lactam 🔬 (กำลังทำ)
- **เป้าหมาย:** ตารางอ้างอิง cross-reactivity ของ beta-lactam ฉบับร่าง
- **ผมทำ:** deep-research จากแหล่งปฐมภูมิ/แนวทาง (Khan 2022 practice parameter,
  Blumenthal 2019 Lancet, Romano side-chain tables, Picard 2019 carbapenem meta,
  Zagursky/Pichichero ฯลฯ) → ออกเป็น `docs/allergy-cross-reactivity.md`
  แต่ละแถว: ยาที่แพ้ → ยาเป้าหมาย, **% (พร้อมช่วง)**, ระดับเสี่ยง, เหตุผล (R1/class),
  reference
- **เจ้าของโปรเจกต์ทำ:** verify ค่าทางคลินิก (quality gate — ไม่ verify ไม่ไปต่อ)
- เริ่มที่ beta-lactam เพราะข้อมูลแน่นและใช้บ่อยสุด

## Phase 2 — Data model & schema 🗂️ (มี decision สำคัญ)
- **เป้าหมาย:** แปลงตารางที่ verify แล้ว → โครงสร้างข้อมูลที่โค้ดอ่านได้
  (`js/allergy-data.js` หรือ JSON)
- **🔑 decision — เก็บข้อมูลแบบไหน:**
  - **A) Curated list** (แบบ `CURATED_PAIRS`): เขียนคู่ตรง ๆ → verify ง่าย แต่ข้อมูลเยอะ
  - **B) Structure-based engine**: เก็บ side chain R1 + กลุ่มยา แล้วคำนวณแพ้ข้ามเอง
    → ข้อมูลน้อย ขยายง่าย แต่ตรวจผลทีละคู่ยาก
  - **C) Hybrid (แนะนำ):** structure เป็นฐาน + curated override + % จาก literature ต่อคู่สำคัญ
- **เจ้าของโปรเจกต์ทำ:** เลือก A/B/C

## Phase 3 — หน้า UI (static) 🎨
- สร้าง `allergy.html` + `css/allergy.css` + `js/allergy.js` จาก mockup
- ลงทะเบียนใน `PAGES` ของ `build.js` (CSS/JS load order), ใช้ `escHtml()`, รองรับธีมสว่าง/มืด
- ยัง hardcode ข้อมูลตัวอย่าง — เน้นให้หน้าเป๊ะตาม mockup ก่อน

## Phase 4 — Logic เชื่อมข้อมูลจริง ⚙️
- typeahead ค้นยา, severity gating, จัดกลุ่ม/เรียงตามเสี่ยง, แสดง % + ref,
  กด ref เลื่อนไปรายการอ้างอิง
- เชื่อมกับ data จาก Phase 2 (เลิก hardcode)

## Phase 5 — ขยายกลุ่มยาอื่น 📚
- เพิ่มกลุ่ม clinical สำคัญในไทยทีละกลุ่ม (แต่ละกลุ่มวน Phase 1→verify ย่อ):
  Sulfonamide, NSAID, anticonvulsant (+ **HLA-B*15:02 / HLA-B*58:01** คนไทย),
  opioid, contrast media ฯลฯ
- ทำทีละกลุ่ม ไม่รวบ

## Phase 6 — Integrate & Ship 🚀
- ลิงก์จาก index/compat, FAB (`quick-actions.js`), onboarding step,
  i18n EN (`translations-en.js`), test ค่าทางคลินิก (`test/`),
  bump version (`package.json` / `version.json` / `sw.js` + changelog / per-page footer),
  merge → `main` → auto-deploy
- **เจ้าของโปรเจกต์ทำ:** review final + อนุมัติ merge

## Phase 7 — Admin CRUD (อนาคต / backlog)
- แก้ข้อมูลแพ้ข้ามผ่าน admin panel + Google Sheets/GAS เหมือน compatibility
- ทำเมื่อข้อมูลนิ่งแล้ว
