# Drug–Fluid (Diluent/Admixture) Compatibility — ICU/Critical Drugs

> **ขอบเขต:** ความเข้ากันได้เมื่อ **เจือจาง/ผสมยาในถุงสารน้ำเดียวกัน** (final infusion / reconstitution & dilution)
> — **ไม่ใช่** Y-site co-administration ของยา 2 ตัว
> **สถานะ:** `C` เข้ากันได้ · `I` ไม่เข้ากัน (ตกตะกอน/เสื่อมสภาพ) · `V` แปรผัน/ระวัง (จำกัดเวลา-ความเข้มข้น หรือไม่ใช่ diluent ตามฉลาก) · `—` ไม่พบข้อมูลชัด
> **สารน้ำ:** NSS=0.9% NaCl · ½NS=0.45% NaCl · D5W=5% Dextrose · D5NSS=D5+0.9% · D5N/2S=D5+0.45% · RL=Ringer's Lactate

> ⚠️ **PATIENT SAFETY / ข้อจำกัดของรายงานนี้**
> - ค่าทั้งหมด **derive จากแหล่งอ้างอิง (package insert/SmPC, Trissel's, Lexicomp, stability studies, NHS/Medusa)** — ไม่ได้แต่งค่าเอง; ถ้าไม่พบหลักฐานชัด ลงเป็น `—` (no data)
> - **เครื่องมือ WebFetch ถูกบล็อก (HTTP 403)** ที่ DailyMed/FDA/EMC/drugs.com → ข้อความฉลากดึงมาจาก search-extract ของฉลากทางการเดียวกัน (URL ตามรายการ) cross-check ≥2 แหล่ง/ค่า
> - **ต้องให้เภสัชกรเจ้าของ verify กับ Trissel's / Lexicomp / NHS Injectable Medicines Guide ฉบับเต็มก่อนอนุมัติเข้าระบบ** โดยเฉพาะเซลล์ confidence MED/LOW
> - รายงาน: deep-research 5-agent fan-out, มิ.ย. 2026

---

## 1) สรุปผู้บริหาร — ยาที่มี "ข้อจำกัด diluent สำคัญ" (ต้องรู้)

**ต้องใช้สารน้ำเฉพาะ (must-use):**
- **Amiodarone → D5W เท่านั้น** (SmPC ระบุ NSS incompatible) ⚠️
- **Sodium nitroprusside → D5W เท่านั้น** (diluent ตามฉลาก; protect from light)
- **Propofol → D5W เท่านั้น** (เจือจาง ≥2 mg/mL; ห้าม saline)
- **Polymyxin B → D5W** (vehicle ตามฉลาก; NSS ไม่ระบุ)
- **Lidocaine (antiarrhythmic infusion) → D5W** (diluent ตามฉลาก; premix เป็น D5W)
- **Desmopressin → NSS เท่านั้น** (ฉลากระบุ saline; D5W ไม่ระบุ)

**ห้ามสารน้ำบางชนิด (contraindicated/incompatible):**
- **Hydralazine + D5W = ห้าม** (dextrose สลายยา → ใช้ NSS) ⚠️
- **Tenecteplase + D5W = ห้าม** (ตกตะกอน; flush line ด้วย NSS) ⚠️ — *แต่ Alteplase + dextrose ได้* (อย่าสับสน 2 ตัว)
- **Albumin 20% + Sterile Water (SWFI) = ห้ามเด็ดขาด** (hemolysis ถึงตาย) — เจือจางด้วย NSS/D5W เท่านั้น ⚠️
- **Nicardipine + RL = ห้าม** (และ + Sodium bicarbonate)
- **Potassium phosphate + RL = ห้าม** (Ca-phosphate ตกตะกอน)
- **Sodium bicarbonate + RL = ห้าม** (Ca ตกตะกอน) + ห้ามผสม Ca/Mg/phosphate ทั่วไป
- **Calcium chloride/gluconate + sodium bicarbonate/phosphate = ห้าม** (CaCO₃/Ca-phosphate ตกตะกอน)
- **Cisatracurium + plain RL = ห้าม** (แต่ D5/RL ได้) · **Glycopyrrolate + RL = ห้าม** (แต่ plain Ringer's ได้) · **Thiopental + RL = ห้าม**

**ระวัง/แปรผัน (variable):**
- **Norepinephrine, Epinephrine → ไม่แนะนำ NSS เดี่ยว** (dextrose ป้องกัน oxidation; ใช้ D5W หรือ D5NS)
- **Furosemide + D5W = ระวัง** (ยา alkaline pH 8–9.3 ไม่เสถียรในกรด → ใช้ NSS/RL)
- **Atracurium + RL** เสื่อมเร็ว (เลี่ยง) · **Midazolam/Remifentanil + RL** ใช้ได้ ≤4 ชม.
- **Haloperidol (IV, off-label) → D5W** (NSS เคยมีรายงานตกตะกอน)

**ไม่เข้ากรอบ "drug-in-fluid" (เป็นสารน้ำเอง/ให้ undiluted):**
- 3% NaCl, 20% Mannitol, Glucose 50% = เป็นสารน้ำเอง · Lipid emulsion 20% = ไม่เจือจาง (dedicated line) · Plasma Exchange = replacement fluid (albumin/FFP) · Adenosine = IV push (saline เป็น flush ไม่ใช่ diluent)
- **20% Mannitol: ห้ามเติม NaCl/KCl** (ตกผลึก)

---

## 2) ตารางหลัก (สถานะต่อสารน้ำ)

> โฟกัส NSS/D5W (diluent ที่ใช้จริงบ่อยสุด) + RL (มีประเด็น Ca/pH); ½NS/D5NSS/D5N2S ระบุเมื่อฉลากกล่าวถึง
> Conf = ความเชื่อมั่น (H=package insert/SmPC, M=tertiary/Trissel, L=inferred)

### 🫀 Vasoactive / Cardiac
| ยา | NSS | D5W | RL | อื่น ๆ | Conf |
|---|---|---|---|---|---|
| Amiodarone | **I** | C | — | D5W only (SmPC) | H |
| Nicardipine | C | C | **I** | +½NS,D5NSS,D5N2S=C; +NaHCO₃=I | H |
| Diltiazem IV | C | C | — | +D5N/2S=C | H |
| Sodium nitroprusside | V/— | C | — | D5W=diluent เดียวตามฉลาก | H(D5W) |
| Glyceryl trinitrate (NTG) | C | C | — | ใช้ขวดแก้ว+สาย non-PVC | H |
| Dobutamine | C | C | C | ห้าม NaHCO₃/alkaline | H |
| Dopamine | C | C | C | ห้าม NaHCO₃ (inactivated) | H |
| Norepinephrine | **V** | C | — | NSS เดี่ยวไม่แนะนำ; +D5NS=C | H |
| Adrenaline (Epinephrine) | **V** | C | — | NSS เดี่ยวไม่แนะนำ (infusion) | H |
| Milrinone | C | C | — | +½NS=C | H |
| Esmolol | C | C | C | ห้าม NaHCO₃ | H |
| Isoproterenol | C | C | — | protect light | H |
| Labetalol | C | C | C | ห้าม NaHCO₃; +D5NSS=C | H |
| Hydralazine IV | C | **I** | C | dextrose สลายยา; US PI=undiluted | H |
| Phenylephrine | C | C | — | — | H |
| Ephedrine | C | C | — | RL ไม่ระบุ | H(NSS/D5W) |

### ⚗️ Electrolytes / Hyperosmolar
| ยา | NSS | D5W | RL | หมายเหตุ | Conf |
|---|---|---|---|---|---|
| Calcium chloride 10% | C | C | V(ซ้ำซ้อน) | ห้าม NaHCO₃/phosphate/carbonate (ตกตะกอน) | H (RL=L) |
| Calcium gluconate | C | C | C(ซ้ำซ้อน) | ห้าม phosphate/bicarbonate | H |
| Potassium chloride (KCl) | C | C | C | additive มาตรฐาน; RL มี K อยู่แล้ว | H |
| Potassium phosphate | C | C | **I** | RL มี Ca → Ca-phosphate ตกตะกอน | H |
| Magnesium sulfate | C | C | — | ห้าม carbonate/salicylate; ระวัง Ca | H(NSS/D5W) |
| 3% NaCl | n/a | n/a | n/a | เป็นสารน้ำเอง; ห้ามร่วมสาย blood | H |
| 20% Mannitol | **I**(เติม NaCl/KCl) | — | — | เป็นสารน้ำเอง; ห้ามเติม electrolyte (ตกผลึก) | H |
| Sodium bicarbonate | C | C | **I** | ห้าม Ca/Mg/phosphate; RL→Ca ตกตะกอน | H |
| Glucose 50% | n/a | n/a | n/a | เป็น dextrose source; มัก IV push | H |

### 💉 Sedation / NMBA / Analgesia
| ยา | NSS | D5W | RL | หมายเหตุ | Conf |
|---|---|---|---|---|---|
| Midazolam | C | C | **V(4h)** | NSS/D5W 24h; LR 4h | H |
| Propofol | **I** | C | I | D5W only, ≥2 mg/mL | H |
| Dexmedetomidine | C | C | C | NSS=prep diluent ตามฉลาก | H(NSS) |
| Ketamine | C | C | — | — | H |
| Etomidate | — | — | — | ฉลากไม่ระบุ diluent (bolus) | L |
| Thiopental | C | C | **I** | alkaline; SWFI preferred | H |
| Fentanyl | C | C | C(NHS) | — | H |
| Remifentanil | C | C | **V(4h)** | +½NS,D5NS=C; LR/D5LR=4h | H |
| Atracurium | C | C | **V→เลี่ยง** | LR เสื่อมเร็ว | H |
| Cisatracurium | C | C | **I(plain)** | D5/LR ได้; plain LR ไม่ได้ | H |
| Rocuronium | C | C | **C** | LR ได้ | H |
| Succinylcholine | C | C | — | ห้าม alkaline admixture | H(NSS/D5W) |
| Sugammadex | C | C | **C** | +½NS+2.5%D, D5NS | H |
| Glycopyrrolate | C | C | **I** | plain Ringer's ได้; Lactated Ringer's ไม่ได้ | H |
| Neostigmine | C | C | C | broad compatibility | M-H |

### 🩸 Anticoag / Thrombolytic / Antidote / Colloid
| ยา | NSS | D5W | RL | หมายเหตุ | Conf |
|---|---|---|---|---|---|
| Heparin | C | C | — | premix ทั้งสอง | H |
| Enoxaparin | C | C(flush) | — | IV bolus เจือจางใน 50mL NSS bag | M-H |
| Alteplase (rt-PA) | C | C | — | SWFI reconstitute; dextrose ได้ | H |
| Tenecteplase | C | **I** | — | dextrose→ตกตะกอน; flush NSS | H |
| Eptifibatide | C | C | — | infuse undiluted จาก vial | H |
| Abciximab | C | C | — | ต้อง filter | H |
| Protamine sulfate | C | C | — | มัก undiluted | H |
| Tranexamic acid | C | C | — | ห้ามผสม blood/penicillin | H |
| N-Acetylcysteine (NAC) | C | C | — | +½NS=C (preferred osmolarity) | H |
| Flumazenil | C | C | **C** | RL ได้ตามฉลาก | H |
| Naloxone | C | C | — | ห้าม bisulfite/alkaline | H |
| Glucagon | — | C | — | D5W=infusion diluent; NSS ไม่ยืนยัน | M |
| Lipid emulsion 20% | n/a | n/a | n/a | ไม่เจือจาง; dedicated line | H |
| Albumin 20% | C | C | — | **+SWFI=ห้าม (hemolysis)**; ห้าม amino acid/alcohol | H |
| Plasma Exchange (TPE) | n/a | n/a | n/a | replacement=albumin/FFP+citrate | H |

### 💊 Endocrine / Steroid / Antimicrobial / Other
| ยา | NSS | D5W | RL | หมายเหตุ | Conf |
|---|---|---|---|---|---|
| Human Insulin (Regular) | C | C | — | adsorb PVC/glass 20–80% (flush set) | H |
| Hydrocortisone | C | C | — | +D5NS=C; ห้ามเกิน diluent ที่ระบุ | H |
| Methylprednisolone | C | C | — | +½NS(D5/0.45%),D5NS=C | H |
| Dexamethasone | C | C | — | — | H |
| Cefepime | C | C | C(+D5) | +D5NS=C; plain ½NS/plain LR ไม่ระบุ | H |
| Polymyxin B | V/— | C | — | D5W=vehicle ตามฉลาก | H(D5W) |
| Digoxin | C | C | — | ต้องเจือจาง ≥4 เท่า ไม่งั้นตกตะกอน | H |
| Adenosine | — | — | — | IV push; saline=flush ไม่ใช่ diluent | H |
| Atropine | C | C | — | diluent จาก Trissel (ไม่ใช่ PI) | M |
| Phytomenadione (Vit K1) | C | C | — | +D5NS=C; protect light | H |
| Desmopressin (DDAVP) | C | — | — | saline only ตามฉลาก; D5W ไม่ระบุ | H(NSS) |
| Haloperidol (IV off-label) | V | C | — | NSS เคยตกตะกอน; D5W preferred | M |
| Nimodipine IV | C | C | C | adsorb PVC→สาย PE/PU; co-infuse (EU SmPC; US ไม่มี IV) | H(EU) |
| Lidocaine | V/— | C | — | D5W=diluent ตามฉลาก/premix | H(D5W) |
| Furosemide | C | **V** | C | D5W: alkaline ยาไม่เสถียรในกรด→prefer NSS/RL | H |

---

## 3) ภาคผนวก — คู่ที่เสนอเข้า CURATED (สำหรับเภสัชกร review/อนุมัติ)

> รูปแบบ `['Generic','Fluid','c|i|v']` ตรงกับ `CURATED_PAIRS` ในแอป (fluidKey รองรับชื่อ NSS/D5W/RL/0.45% NaCl/D5NSS/D5N/2S/SWFI)
> ⚠️ **เป็นข้อเสนอ — ยังไม่ใส่เข้าระบบ** รอเภสัชกรยืนยันรหัส C/I/V ก่อน (โดยเฉพาะที่ทำเครื่องหมาย ❓)

```js
// === INCOMPATIBLE (i) — confidence สูง ===
['Hydralazine IV','D5W','i'],            // dextrose สลายยา (SmPC)
['Tenecteplase','D5W','i'],              // ตกตะกอน (TNKase PI)
['Nicardipine','Ringer\'s Lactate','i'], // Cardene PI
['Potassium phosphate','Ringer\'s Lactate','i'], // Ca-phosphate ตกตะกอน
['Sodium bicarbonate','Ringer\'s Lactate','i'],  // Ca ตกตะกอน
['Propofol','NSS','i'],                  // D5W only (PI)
['Cisatracurium','Ringer\'s Lactate','i'], // plain LR (Nimbex PI) — NB: D5/LR ได้
['Thiopental','Ringer\'s Lactate','i'],  // alkaline (SmPC)
['Glycopyrrolate','Ringer\'s Lactate','i'], // Lactated Ringer's (PI) — NB: plain Ringer's ได้
['Albumin 20%','SWFI','i'],              // hemolysis (PI, contraindicated)

// === VARIABLE / ระวัง (v) — confidence สูง-กลาง ===
['Amiodarone','NSS','v'],                // ❓ SmPC=incompatible(D5W only) — เภสัชเลือก i หรือ v
['Norepinephrine','NSS','v'],            // ไม่แนะนำ NSS เดี่ยว (PI; dextrose ป้องกัน oxidation)
['Adrenaline (Epinephrine)','NSS','v'],  // ไม่แนะนำ NSS เดี่ยว (infusion, PI)
['Furosemide','D5W','v'],                // alkaline ไม่เสถียรในกรด (PI; prefer NSS/RL)
['Atracurium','Ringer\'s Lactate','v'],  // เสื่อมเร็วใน LR (PI)
['Midazolam','Ringer\'s Lactate','v'],   // ใช้ได้ ≤4h (PI)
['Remifentanil','Ringer\'s Lactate','v'],// ใช้ได้ ≤4h (PI)
['Haloperidol','NSS','v'],               // ❓ ตกตะกอนรายงาน (off-label IV; ASHP/Trissel)
['Polymyxin B','NSS','v'],               // ❓ D5W=labeled vehicle; NSS ไม่ระบุ
['Lidocaine','NSS','v'],                 // ❓ D5W=labeled diluent; NSS ไม่ระบุ (แต่ใช้จริงบ่อย)

// === COMPATIBLE (c) — "must-use" ที่ควรยืนยัน positive ===
['Amiodarone','D5W','c'],
['Sodium nitroprusside','D5W','c'],
['Propofol','D5W','c'],
['Hydralazine IV','NSS','c'],
['Tenecteplase','NSS','c'],
['Desmopressin (DDAVP)','NSS','c'],
['Cisatracurium','D5W','c'], ['Cisatracurium','NSS','c'],
['Rocuronium','Ringer\'s Lactate','c'], ['Sugammadex','Ringer\'s Lactate','c'],
['Albumin 20%','NSS','c'], ['Albumin 20%','D5W','c'],
```

**หมายเหตุที่ต้องตัดสินใจ (❓):**
- **Amiodarone+NSS**: SmPC = incompatible (`i`) แต่ทางคลินิกหลายที่ใช้ NSS ระยะสั้นได้ → เภสัชเลือก `i` (เข้มงวดตามผู้ผลิต) หรือ `v` (เตือนแต่ไม่ห้าม)
- **Lidocaine+NSS / Polymyxin B+NSS**: ฉลากระบุ D5W เป็น diluent หลัก แต่ NSS ใช้จริงทั่วไป → `v` (no-data/ระวัง) ปลอดภัยกว่า `i`
- **Calcium + RL**: เป็น "ซ้ำซ้อน" (RL มี Ca อยู่แล้ว) ไม่ใช่ตกตะกอนชัด (confidence ต่ำ) → **ไม่เสนอใส่** จนกว่า verify Trissel's

---

## 4) "ไม่พบข้อมูลชัด (no data)" — ต้อง verify เพิ่มก่อนลงค่า

- **Etomidate + NSS/D5W** — ฉลากไม่ระบุ diluent (bolus) → verify Trissel's/Lexicomp
- **Ketamine + RL, Succinylcholine + RL, Ephedrine + RL** — ฉลากไม่กล่าวถึง LR
- **Glucagon + NSS** — ฉลากยืนยัน D5W; saline ไม่ยืนยัน
- **Magnesium sulfate + RL** — ไม่พบแหล่งเฉพาะ (น่าจะ C — verify)
- **½NS / D5NSS / D5N2S** ของหลายตัว — ฉลากระบุเฉพาะ NSS/D5W เป็นหลัก; combination อื่นถือเป็น inferred จนกว่า verify
- **Cefepime + plain ½NS, plain LR** (ไม่รวม D5) — ฉลากไม่ระบุแยก

---

## 5) แหล่งอ้างอิงหลัก (primary)

ทุกค่ามาจากฉลากทางการ/แหล่งตติยภูมิที่อ้างปฐมภูมิ — ตัวอย่าง URL สำคัญ (ดูเต็มในบันทึก research แต่ละกลุ่ม):

- **FDA package inserts / DailyMed**: Cordarone, Cardene IV (019734s030), Diprivan (019627s069), Precedex (021038s022), Nimbex (020551s019), TNKase & Activase (Genentech), Acetadote (021539s019), Solu-Cortef (009866s080), Solu-Medrol (011856s144), Lanoxin (009330), Furosemide (018667s048), AquaMephyton (012223s040), DDAVP (018938s039), Brevibloc (019386s039), Levophed (007513), Mannitol (016269s055), Potassium Phosphates (212121s000), Albumin 20% (Octapharma/Flexbumin)
- **EMA SmPC (emc, medicines.org.uk)**: Amiodarone (3453/3940), Thiopental (665), Cisatracurium (1380), Rocuronium (553), Hydralazine (6710), Mannitol 15% (1840), Nimotop infusion (1366), Calcium Chloride (4126), KCl concentrate (6272)
- **ตติยภูมิ/แนวทาง**: Trissel's Handbook on Injectable Drugs; ASHP Injectable Drug Information (Haloperidol); NHS Injectable Medicines Guide/Medusa; Scottish ICU; ASFA TPE Core Curriculum 2023 (AJKD); StatPearls (Sodium bicarbonate); PMC stability studies (norepinephrine PMC2858500, CaCl₂ PMC7075352)

> **ขั้นตอนถัดไปที่แนะนำ:** เภสัชกร review ภาคผนวก §3 → ยืนยัน/แก้รหัส C/I/V (โดยเฉพาะ ❓) → ผม import เข้า `CURATED_PAIRS`/แอป (ผ่าน admin panel หรือ commit) แล้ว deploy
