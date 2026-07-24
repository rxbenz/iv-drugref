# Allergy Cross-Reactivity — Non-Beta-Lactam Groups (Phase 4.1)

> 🟢 **กลุ่ม Sulfonamide: เภสัชกร verify แล้ว + encode แล้ว (2026-06-18)**
> SCAR rule = non-antibiotic sulfonamide เป็น "ระวัง/หลีกถ้าไม่จำเป็น" (conservative).
> กลุ่มถัดไป (NSAID ฯลฯ) ยังเป็น DRAFT — ทำทีละกลุ่ม ไม่รวบ (feature-plan ข้อ 11/13).
>
> ไฟล์นี้ต่อยอดจาก `allergy-cross-reactivity.md` (beta-lactam, Phase 1 ปิดแล้ว)
> ขยายไปกลุ่มยานอก beta-lactam ทีละกลุ่ม — **กลุ่มที่ 1 = Sulfonamides**

---

## หลักการสำคัญ: กลไกแพ้ข้ามของยานอก beta-lactam ≠ R1 side chain

beta-lactam ใช้โมเดล R1 side-chain (โครงสร้างเหมือน → แพ้ข้าม). ยานอก beta-lactam
**ใช้กลไกอื่น** จึงต้องใช้โมเดลข้อมูลแยก (ไม่ผ่าน engine R1 เดิม):

| กลุ่ม | กลไกแพ้ข้าม | รูปแบบข้อมูลที่เหมาะ |
|---|---|---|
| Sulfonamide | โครงสร้างเฉพาะ (N4 arylamine + N1 ring) ของ **sulfonamide antibiotic** เท่านั้น | curated: antibiotic ↔ antibiotic แพ้ข้าม; non-antibiotic = ปลอดภัย |
| NSAID | **เภสัชวิทยา** (COX-1 inhibition) ไม่ใช่ภูมิคุ้มกัน/โครงสร้าง | curated ตามความแรง COX-1 + COX-2 selective = ทางเลือก |
| Fluoroquinolone | intra-class (แพ้ข้ามในกลุ่มสูง) | curated intra-class |
| Glycopeptide / Aminoglycoside / Macrolide | intra-class | curated intra-class |
| Anticonvulsant (aromatic) | โครงสร้าง aromatic + **HLA-B*15:02** (สำคัญมากในคนไทย) | curated + ผูก HLA (เลื่อนไป group ท้าย — ต้อง verify HLA) |

→ **ข้อเสนอ data model**: เพิ่ม `NBL_GROUPS` (non-beta-lactam) ใน `allergy-data.js`
แยกจาก `DRUGS`/`computeRelation` ของ beta-lactam (engine เดิมไม่แตะ → test เดิมไม่พัง).
`buildReport()` ตรวจว่า allergen เป็น beta-lactam (อยู่ใน `DRUGS`) → ใช้ engine R1 เดิม;
ถ้าเป็น allergen ในกลุ่มนอก beta-lactam → ดึง guidance จาก `NBL_GROUPS` มาจัดเป็น
avoid/safer แบบเดียวกัน (UI/หน้าตาเหมือนเดิม).

---

## กลุ่มที่ 1 — Sulfonamides (ซัลโฟนาไมด์)

### 🔑 ใจความสำคัญ (myth-buster)
**"แพ้ sulfa" ไม่ได้แปลว่าต้องเลี่ยงยาที่มีหมู่ sulfonamide ทุกตัว** — แพ้ข้ามเกิด
เฉพาะระหว่าง **sulfonamide antibiotic** ด้วยกัน เพราะมีหมู่ **N4 arylamine** และวง
แทนที่ที่ตำแหน่ง **N1** ซึ่งเป็นตัวก่อปฏิกิริยา ส่วน **non-antibiotic sulfonamide**
(ยาขับปัสสาวะ, celecoxib, ยาเบาหวานกลุ่ม sulfonylurea ฯลฯ) **ไม่มีหมู่ N4 arylamine**
→ **ไม่มีแพ้ข้ามเชิงภูมิคุ้มกัน**

### 🚫 ควรหลีกเลี่ยง (แพ้ข้ามได้จริง) — sulfonamide *antibiotics* ด้วยกัน
| ยา | ระดับ | เหตุผล | อ้างอิง |
|---|---|---|---|
| Sulfadiazine | 🔴 สูง | sulfonamide antibiotic เหมือนกัน (มี N4 arylamine) | brackett2004, khan2022 |
| Sulfasalazine | 🔴 สูง | sulfonamide antibiotic | brackett2004 |
| Sulfacetamide (เฉพาะที่/ตา) | 🔴 สูง | sulfonamide antibiotic | brackett2004 |
| (TMP-SMX = ตัวที่แพ้เอง) | — | — | — |

### ✅ ปลอดภัย (ไม่แพ้ข้าม) — non-antibiotic sulfonamides
> ผู้ป่วยที่แพ้ TMP-SMX (รวมชนิด IgE-mediated) **ใช้ยาเหล่านี้ได้** (Strom 2003: ที่
> เห็น "แพ้" 9.9% เป็นจาก *ภูมิแพ้ทั่วไปของผู้ป่วย* ไม่ใช่แพ้ข้ามโครงสร้าง — ความเสี่ยง
> ต่อ penicillin ยังสูงกว่าด้วยซ้ำ)

| กลุ่ม | ตัวอย่าง | ระดับ |
|---|---|---|
| Thiazide diuretics | Hydrochlorothiazide, Chlorthalidone | 🟢 น้อยมาก |
| Loop diuretics | Furosemide, Bumetanide, Torsemide | 🟢 น้อยมาก |
| Carbonic anhydrase inhibitor | Acetazolamide | 🟢 น้อยมาก |
| COX-2 selective | Celecoxib | 🟢 น้อยมาก |
| Sulfonylureas | Glipizide, Glibenclamide, Gliclazide | 🟢 น้อยมาก |
| Triptans | Sumatriptan | 🟢 น้อยมาก |

> ⚠️ ข้อยกเว้น/ข้อควรระวัง:
> - **ประวัติ SCAR (SJS/TEN/DRESS) จาก sulfonamide antibiotic** → เลี่ยง sulfonamide
>   **antibiotic ทั้งหมด** และ **ห้าม** challenge (เหมือน gating ของ beta-lactam).
>   non-antibiotic sulfonamide ทางทฤษฎียังถือว่าไม่แพ้ข้าม แต่หลายแหล่งแนะนำ
>   **ระมัดระวัง/หลีกเลี่ยงถ้าไม่จำเป็น** ในกรณี SCAR รุนแรง *(ขอ verify จุดนี้)*
> - แพ้ข้ามที่รายงานบางส่วนเป็น **multiple concurrent allergy** (ผู้ป่วยแพ้ง่ายหลายตัว)
>   ไม่ใช่ cross-reactivity แท้

### กฎ severity (เหมือน framework เดิม)
- ผื่นไม่รุนแรง / unknown → low-risk: Khan 2022 แนะนำ **one-step direct oral challenge**
  ต่อ TMP-SMX ได้ในผู้ป่วย low-risk
- IgE (ลมพิษ/anaphylaxis) → เลี่ยง sulfonamide antibiotic; ใช้ non-antibiotic ได้
- SCAR → เลี่ยง sulfonamide antibiotic ทั้งหมด, ห้าม challenge

### อ้างอิงกลุ่ม Sulfonamide
- **strom2003** — Strom BL, et al. Absence of cross-reactivity between sulfonamide
  antibiotics and sulfonamide nonantibiotics. *N Engl J Med* 2003;349(17):1628-35.
- **brackett2004** — Brackett CC, et al. Likelihood and mechanisms of
  cross-allergenicity between sulfonamide antibiotics and other drugs containing a
  sulfonamide functional group. *Pharmacotherapy* 2004;24(7):856-70. (PMID 15303450)
- **khan2022** — Khan DA, et al. Drug allergy: 2022 practice parameter update.
  *J Allergy Clin Immunol* 2022;150(6):1333-1393.
- **ccjm2025** — Can my patient with a 'sulfa allergy' receive celecoxib or other
  nonantimicrobial sulfonamides? *Cleve Clin J Med* 2025;92(3):147.

---

## คิวกลุ่มถัดไป (ทำทีละกลุ่ม หลัง Sulfonamide ผ่าน verify)
2. **NSAID** — cross-reactivity เชิงเภสัชวิทยา (COX-1); COX-2 selective เป็นทางเลือก
3. **Fluoroquinolone** — intra-class
4. **Glycopeptide / Aminoglycoside / Macrolide** — intra-class
5. **Anticonvulsant (aromatic) + HLA-B*15:02 / HLA-B*58:01** — สำคัญมากในคนไทย
   (ต้อง verify ตัวเลขกับ full-text CPIC/Sukasem)

---

## กลุ่มที่ 2 — NSAID (DRAFT 🟡 รอ verify)

### 🔑 ใจความสำคัญ: แพ้ข้ามขึ้นกับ "ชนิดปฏิกิริยา (phenotype)" ไม่ใช่โครงสร้าง
แพ้ข้าม NSAID ส่วนใหญ่เป็น **เภสัชวิทยา (ยับยั้ง COX-1)** ไม่ใช่ภูมิคุ้มกัน/โครงสร้าง
→ แบ่งเป็น 2 สถานการณ์ใหญ่ (EAACI/Kowalski 2013):

**A) Cross-reactive (พบบ่อยสุด, COX-1)** — NERD (หืด/ไซนัส), NECD (ลมพิษเรื้อรัง),
NIUA (ลมพิษ/angioedema ในคนทั่วไป): ปฏิกิริยาต่อ **COX-1 inhibitor แรงทุกตัว**
→ ต้องเลี่ยง COX-1 แรงทั้งหมด, ใช้ COX-2 selective / weak COX-1 แทน

**B) Selective / single-drug (ภูมิคุ้มกัน)** — SNIUAA (IgE) / SNIDHR (T-cell, รวม SCAR):
แพ้ **NSAID ตัวเดียว (หรือกลุ่มเคมีเดียวกัน)** → NSAID กลุ่มเคมีอื่น **ใช้ได้** แม้เป็น
COX-1 แรง (ไม่ขึ้นกับความแรง COX-1)

### 🚫 ควรหลีกเลี่ยง — กรณี cross-reactive (COX-1 แรง)
| ยา | กลุ่มเคมี | ระดับ |
|---|---|---|
| Aspirin (ขนาดยาแก้ปวด/ต้านอักเสบ) | Salicylate | 🔴 สูง |
| Ibuprofen, Naproxen, Ketoprofen | Propionic acid | 🔴 สูง |
| Diclofenac, Indomethacin, Ketorolac | Acetic acid | 🔴 สูง |
| Piroxicam | Oxicam | 🔴 สูง |
| Mefenamic acid | Fenamate | 🔴 สูง |

### ✅ ปลอดภัยกว่า (cross-reactive type)
| ยา | เหตุผล | ระดับ |
|---|---|---|
| Celecoxib | COX-2 selective (แพ้ข้าม ~2% เท่านั้น) | 🟢 น้อยมาก |
| Etoricoxib | COX-2 selective | 🟢 น้อยมาก |
| Paracetamol (acetaminophen) | weak COX-1; ส่วนใหญ่ใช้ได้ (ขนาดสูงอาจแพ้ข้ามส่วนน้อย) | 🟢 น้อยมาก |

### ⚠️ ใช้ด้วยความระมัดระวัง
| ยา | เหตุผล |
|---|---|
| Meloxicam, Nimesulide | preferential COX-2 — ส่วนใหญ่ใช้ได้ แต่แพ้ข้าม ~2-4% → เริ่มขนาดต่ำ/challenge |

### หมายเหตุสำคัญต่อการใช้ในเครื่องมือ (design)
> เครื่องมือจะ **ตั้งสมมุติฐานเป็น cross-reactive (กรณีพบบ่อย)** เป็นค่าตั้งต้น
> แล้วแสดง **คำเตือนเด่น** ว่า: ถ้าเป็น **single-drug** (เคยใช้ NSAID ตัวอื่นได้ /
> แพ้ตัวเดียว / anaphylaxis ต่อตัวเดียว) → เลี่ยงเฉพาะตัวที่แพ้ + กลุ่มเคมีเดียวกัน,
> NSAID กลุ่มอื่นใช้ได้ — *(ขอ verify วิธีนำเสนอนี้)*

### กฎ severity (NSAID)
- cross-reactive (mild/IgE) → เลี่ยง COX-1 แรงทั้งหมด; COX-2 selective/paracetamol ใช้ได้
- **SCAR (SJS/TEN/DRESS)** จาก NSAID → มักเป็น **single-drug (SNIDHR)**: เลี่ยงตัวที่แพ้
  (+ กลุ่มเคมีเดียวกัน) เด็ดขาด, ห้าม challenge, ปรึกษาผู้เชี่ยวชาญ

### อ้างอิงกลุ่ม NSAID
- **kowalski2013** — Kowalski ML, et al. Classification and practical approach to the
  diagnosis and management of hypersensitivity to NSAIDs. *Allergy* 2013;68:1219-32.
- **dona2020** — Doña I, et al. Progress in understanding hypersensitivity reactions to
  NSAIDs. *Allergy* 2020;75:561-575.
- **nsaidReview2026** — Cross-Reactivity and Cross-Intolerance Among NSAIDs: COX-1
  mechanisms, COX-2 inhibitors & paracetamol. *Int J Mol Sci* 2026;27:3727.
- **khan2022** — Khan DA, et al. Drug allergy: 2022 practice parameter update. *JACI* 2022.

### กลุ่มโครงสร้างเคมี (chemical class) — สำคัญเฉพาะ single-drug
ใน **single-drug (selective)** การแพ้ข้ามเดินตาม **กลุ่มเคมี** ไม่ใช่ความแรง COX-1
แต่ละตัวจึง tag `chem`:
| กลุ่มเคมี | ยา |
|---|---|
| Salicylate | Aspirin |
| Propionic acid (profen) | Ibuprofen, Naproxen, Ketoprofen |
| Acetic acid | Diclofenac, Indomethacin, Ketorolac |
| Oxicam (enolic acid) | Piroxicam, **Meloxicam** |
| Fenamate | Mefenamic acid |
| Coxib | Celecoxib, Etoricoxib |
| Sulfonanilide | Nimesulide |
| Para-aminophenol | Paracetamol |

> ⚠️ จุดสำคัญทางคลินิก: **Meloxicam = Oxicam กลุ่มเดียวกับ Piroxicam** → ถ้าแพ้
> piroxicam แบบ single-drug ต้องเตือน meloxicam ด้วย (แม้ในโหมด cross-reactive
> มันเป็นแค่ "ระวัง" เพราะ preferential COX-2). callout จะ **ระบุชื่อยากลุ่ม
> เคมีเดียวกันแบบ dynamic** ตามตัวที่เลือก

### Checklist verify (กลุ่ม NSAID) — ✅ ครบ 2026-06-18
- [x] เห็นชอบกรอบ cross-reactive vs single-drug + การตั้งค่าเริ่มเป็น cross-reactive
- [x] เห็นชอบรายการ 🚫 COX-1 แรง / ✅ COX-2 selective + paracetamol / ⚠️ meloxicam-nimesulide
- [x] เห็นชอบวิธีนำเสนอ single-drug เป็น "คำเตือนเด่น" (ไม่แยกเป็น severity ใหม่)
- [x] เพิ่ม chemical class (`chem`) ทุกตัว + callout ระบุยากลุ่มเคมีเดียวกัน dynamic
- [x] ตัดสิน: paracetamol ขนาดสูง → **คงเป็น ✅ ปลอดภัย** (weak COX-1; ส่วนใหญ่ใช้ได้)

---

## กลุ่มที่ 3 — Anticonvulsant (aromatic AEDs) + HLA (✅ verify + encode แล้ว 2026-06-18)

### 🔑 ใจความ: 2 แกน — (1) แพ้ข้ามใน aromatic AEDs (2) HLA pharmacogenomic
ยากันชักกลุ่ม **aromatic** (มีวงแหวน aromatic) แพ้ข้ามกันสูงมาก โดยเฉพาะปฏิกิริยา
รุนแรง (SCAR). **HLA-B*15:02 พบบ่อยในคนไทย** → เป็นความเสี่ยงสำคัญต่อ SJS/TEN

### 🚫 แพ้ข้ามกัน — Aromatic AEDs (เลี่ยงทั้งกลุ่มถ้าเคยแพ้ตัวใดตัวหนึ่ง)
| ยา | หมายเหตุ |
|---|---|
| Carbamazepine | aromatic; เสี่ยงสูงสุด + ผูกกับ HLA-B*15:02 |
| Oxcarbazepine | aromatic; HLA-B*15:02 (Thai/Chinese) |
| Phenytoin / Fosphenytoin | aromatic; HLA-B*15:02 (อ่อนกว่า CBZ) |
| Phenobarbital / Primidone | aromatic (barbiturate) |
| Lamotrigine | aromatic; แพ้ข้ามกับ CBZ ได้ + ตัวมันเองเสี่ยง SJS |

> **อัตราแพ้ข้าม aromatic AEDs ~40-58%** (บางการศึกษาสูงถึง 80%) และ
> **สูงขึ้นตามความรุนแรง**: MPE ~8% · SJS ~29% · SJS/TEN overlap ~50%

### ✅ ปลอดภัยกว่า — Non-aromatic AEDs (ไม่แพ้ข้ามกับ aromatic)
| ยา | กลุ่ม |
|---|---|
| Valproic acid / Valproate | non-aromatic |
| Levetiracetam | non-aromatic |
| Gabapentin, Pregabalin | gabapentinoid |
| Topiramate | non-aromatic |
| Benzodiazepines (clonazepam/clobazam) | non-aromatic |
| Lacosamide, Vigabatrin | non-aromatic |

> ⚠️ **Zonisamide** ไม่ใส่ในรายการปลอดภัย — เป็น sulfonamide-derivative (เสี่ยง SJS
> คนละกลไก) → จัดเป็น "ระวัง"

### 🧬 HLA callout (แสดงเด่น — สำคัญสำหรับคนไทย)
- **HLA-B*15:02** (ไทย prevalence ~8-27%): CPIC 2017 → **ห้ามใช้ carbamazepine
  + oxcarbazepine** ในผู้ที่มี allele นี้; CPIC phenytoin 2020 → เลี่ยง phenytoin/
  fosphenytoin ถ้ามีทางเลือก (association อ่อนกว่า)
- **HLA-A*31:01**: เสี่ยง carbamazepine-induced MPE/DRESS/SJS → CPIC แนะนำเลี่ยง
  carbamazepine ถ้ามีทางเลือก
- 💡 แนะนำตรวจ HLA-B*15:02 **ก่อนเริ่ม** carbamazepine/oxcarbazepine ในคนไทย
  (มาตรฐานในไทยแล้ว)

### กฎ severity (Anticonvulsant)
- ปฏิกิริยาเป็น **T-cell delayed** เป็นหลัก (ไม่ใช่ IgE)
- **mild (MPE)** → แพ้ข้าม ~8%; แนะนำเปลี่ยนเป็น non-aromatic เพื่อความปลอดภัย
- **SCAR (SJS/TEN/DRESS)** → เลี่ยง aromatic AEDs **ทั้งหมด**เด็ดขาด · ห้าม challenge ·
  ใช้ non-aromatic เท่านั้น

### อ้างอิงกลุ่ม Anticonvulsant
- **cpic2017cbz** — Phillips EJ, et al. CPIC Guideline for HLA Genotype and Use of
  Carbamazepine and Oxcarbazepine: 2017 Update. *Clin Pharmacol Ther* 2018;103(4):574-581.
- **cpic2020phenytoin** — Karnes JH, et al. CPIC Guideline for CYP2C9 and HLA-B
  Genotypes and Phenytoin Dosing: 2020 Update. *Clin Pharmacol Ther* 2021;109(2):302-309.
- **aedCrossReview** — Rashes/hypersensitivity reactions associated with antiepileptic
  drugs: review. *Seizure / Epilepsy Behav* 2019.
- **thaiHLA2022** — Implementation of HLA-B*15:02 Genotyping as Standard-of-Care …
  in Thailand. *Front Pharmacol* 2022;13:867490.

### Checklist verify (กลุ่ม Anticonvulsant) — ✅ ครบ 2026-06-18
- [x] เห็นชอบรายการ 🚫 aromatic AEDs (รวม lamotrigine อยู่ในกลุ่มเลี่ยง)
- [x] เห็นชอบรายการ ✅ non-aromatic (valproate/levetiracetam/gabapentinoid/topiramate/BZD/lacosamide)
- [x] เห็นชอบ zonisamide = "ระวัง" (sulfonamide-derivative)
- [x] เห็นชอบ HLA callout (B*15:02 + A*31:01) แสดงเด่น
- [x] ยืนยันตัวเลข: แพ้ข้าม 40-58% · MPE 8% / SJS 29% / overlap 50% · Thai B*15:02 ~8-27%
- [x] ตัดสิน: phenytoin + HLA-B*15:02 → **"เลี่ยงถ้ามีทางเลือก" (ตาม CPIC)**
- [x] engine: เพิ่ม `keepSafeOnScar` → non-aromatic AED คงเป็น "ปลอดภัย" แม้ SCAR

---

## กลุ่มที่ 4 — Fluoroquinolone (✅ verify + encode แล้ว 2026-06-18)

### 🔑 ใจความ: หลักฐานใหม่ — แพ้ข้ามในกลุ่ม "ต่ำ" (ไม่ใช่สูงอย่างที่เคยเชื่อ)
เดิมเชื่อว่า FQ แพ้ข้ามกันสูง → เลี่ยงทั้งกลุ่ม. **หลักฐานใหม่ (2022-2025)** พบว่า
แพ้ข้ามในกลุ่มจริง ๆ **ต่ำ ~2-5%** (cipro 2.5% / levo 2.0% / moxi 5.3%; บางการศึกษา 0%)
→ การเลี่ยงทั้งกลุ่ม **อาจไม่จำเป็น** ยกเว้น SCAR

> ⚠️ จุดสำคัญ: **oral challenge เป็นวิธีเดียว**ที่ยืนยันว่าใช้ FQ ตัวอื่นได้
> (skin test/BAT บอกได้แค่ว่าแพ้กลุ่ม แต่ทำนาย tolerance รายตัวไม่ได้)
> → ค่าตั้งต้นที่ปลอดภัยสุด = ใช้ยา **นอกกลุ่ม FQ**

### ⚠️ FQ ตัวอื่นในกลุ่ม (caution — ไม่ใช่ avoid เด็ดขาด, ยกเว้น SCAR)
| ยา | หมายเหตุ |
|---|---|
| Ciprofloxacin | แพ้ข้าม ~2.5% |
| Levofloxacin | แพ้ข้าม ~2.0% (cipro→levo มัก tolerate) |
| Moxifloxacin | แพ้ข้าม ~5.3% (สูงสุด, โครงสร้างต่าง) |
| Ofloxacin, Norfloxacin | ข้อมูลจำกัด |

> 💡 default = **caution** (low ~2-5%); ถ้าจำเป็นต้องใช้ FQ อีกตัว → ยืนยันด้วย oral
> challenge. **SCAR (SJS/TEN/DRESS) → escalate เป็น avoid ทั้งกลุ่ม · ห้าม challenge**

### ✅ ปลอดภัย — ยาต่างกลุ่ม (ไม่มีปัญหาแพ้ข้ามกับ FQ)
เลือกตามชนิดการติดเชื้อ: Beta-lactam (ถ้าไม่แพ้), Macrolide (Azithromycin),
TMP-SMX, Doxycycline, Aminoglycoside, Clindamycin, Metronidazole

### กฎ severity (Fluoroquinolone)
- **mild/IgE** → FQ ตัวอื่น = "ระวัง" (~2-5%); ใช้ยานอกกลุ่มก่อน, ถ้าจำเป็นต้องใช้ FQ
  ตัวอื่น → oral challenge
- **SCAR** → เลี่ยง FQ **ทั้งกลุ่ม**เด็ดขาด · ห้าม challenge · ใช้ยานอกกลุ่มเท่านั้น
- ยานอกกลุ่ม FQ คงเป็น "ปลอดภัย" แม้ SCAR (`keepSafeOnScar`)

### อ้างอิงกลุ่ม Fluoroquinolone
- **fqCohort2022** — Immediate Hypersensitivity to Fluoroquinolones: A Cohort Assessing
  Cross-Reactivity. *Open Forum Infect Dis* 2022;9(4):ofac106.
- **fqInClass2023** — In-Class Cross-Reactivity among Hospitalized Patients with
  Hypersensitivity Reactions to Fluoroquinolones. *Antimicrob Agents Chemother* 2023.
- **eaaci2025fq** — Gelincik A, et al. Diagnosis of Quinolone Hypersensitivity: An
  EAACI Position Paper. *Allergy* 2025.

### Checklist verify (กลุ่ม Fluoroquinolone) — ✅ ครบ 2026-06-18
- [x] เห็นชอบแนวคิดใหม่: แพ้ข้ามในกลุ่ม **ต่ำ** → FQ ตัวอื่น = "ระวัง" (ไม่ใช่ avoid) ใน non-SCAR
- [x] เห็นชอบ SCAR → escalate เป็น avoid ทั้งกลุ่ม
- [x] เห็นชอบ moxifloxacin = เสี่ยงสูงสุด (~5.3%)
- [x] เห็นชอบรายการ ✅ ยานอกกลุ่ม (เลือกตามการติดเชื้อ)
- [x] เห็นชอบ callout: oral challenge = วิธีเดียวยืนยัน tolerance; ใช้ยานอกกลุ่มก่อน
- [x] ตัดสิน: **ค่าตั้งต้น = "caution"** (ตามหลักฐานใหม่) · engine flag `crossClassCaution`

---

## Checklist verify (กลุ่ม Sulfonamide) — ✅ ครบ 2026-06-18
- [x] เห็นชอบ "myth-buster": non-antibiotic sulfonamide = ปลอดภัย (ไม่มี N4 arylamine)
- [x] เห็นชอบรายการ 🚫 ควรเลี่ยง (sulfonamide antibiotics)
- [x] เห็นชอบรายการ ✅ ปลอดภัย (thiazide/loop/CA-I/celecoxib/sulfonylurea/triptan)
- [x] กรณี **SCAR** → non-antibiotic sulfonamide = **"ระวัง/หลีกถ้าไม่จำเป็น"** (caution, conservative)
- [x] เห็นชอบ data model `NBL_GROUPS` (แยกจาก engine R1)

> Encoded ใน `js/allergy-data.js` (`NBL_GROUPS` + `buildNblReport`), wired ใน
> `js/allergy.js` (dropdown + กลุ่ม "ใช้ด้วยความระมัดระวัง"), locked โดย 7 tests
> ใน `test/allergy-data.test.js` (รวม 104 tests ผ่าน).

---

## กลุ่มที่ 5 — Local Anesthetics (ยาชาเฉพาะที่) — ✅ verify + encode แล้ว 2026-06-18

### หลักการ: แพ้ข้ามขึ้นกับ "linkage" (ester vs amide) ไม่ใช่ "เป็นยาชา"
- **Ester** (procaine, benzocaine, tetracaine, chloroprocaine): ถูกย่อยเป็น
  **PABA** (para-aminobenzoic acid) ซึ่งเป็นตัวก่อแพ้ → **ester แพ้ข้ามกันเอง (สูง)**
- **Amide** (lidocaine, bupivacaine, mepivacaine, ropivacaine, prilocaine,
  articaine): แพ้จริงพบ **<1%** · แพ้ข้าม amide↔amide **ต่ำ/ไม่แน่นอน**
- **ester ↔ amide ไม่แพ้ข้ามกัน** → ถ้าแพ้กลุ่มหนึ่ง ใช้ another class ได้
- ⚠️ แพ้ LA จริงพบน้อยมาก — ส่วนใหญ่เป็นปฏิกิริยา**ไม่ใช่ภูมิแพ้** (vasovagal,
  ใจสั่น/มือสั่นจาก epinephrine, วิตกกังวล, พิษจากยา) → ซักประวัติให้ดีก่อน

### Preservative / additive (สารก่อแพ้คนละตัว)
- **Methylparaben** (สารกันเสียใน multidose vial) โครงสร้างใกล้ PABA → อาจแพ้ข้าม
  ในคนแพ้ **ester** → เลือกชนิด single-dose / preservative-free
- **Sodium metabisulfite** (สารกันหืนในสูตรผสม **epinephrine**) → ถ้าสงสัยให้ใช้
  สูตร plain (ไม่ผสม adrenaline)

### โมเดลข้อมูล: แยกเป็น 2 NBL groups
แทนที่จะทำ cross-list ราย allergen (engine ไม่รองรับ) → แยก linkage เป็นคนละกลุ่ม
ทำให้ engine เดิมแสดง "อีก class = ปลอดภัย" ได้เลย:

| Group | crossReactive (ในกลุ่ม) | safe (ทางเลือก) | flag |
|---|---|---|---|
| `la-ester` | ester อื่น = 🔴 สูง (PABA) | amide ทั้งหมด | `keepSafeOnScar` |
| `la-amide` | amide อื่น = 🟡 ต่ำ → 🔴 เมื่อ SCAR | ester + amide ที่ skin-test ผ่าน | `crossClassCaution`, `keepSafeOnScar` |

- `la-ester` ใช้ default (crossReactive = avoid/high)
- `la-amide` ใช้ `crossClassCaution: true` (amide แพ้ข้ามต่ำ → caution; escalate avoid เมื่อ SCAR)
- ทั้งสองกลุ่ม `keepSafeOnScar: true` เพราะอีก class คนละโครงสร้าง → ปลอดภัยแม้ SCAR

### Severity
- mild/IgE → เลี่ยงทั้ง class ที่แพ้, ใช้อีก class ได้ (preservative-free)
- SCAR (พบยากมาก) → เลี่ยงทั้ง class · ห้าม challenge · อีก class ใช้ภายใต้การดูแล

### Checklist verify (กลุ่ม Local Anesthetic) — ✅ ครบ 2026-06-18
- [x] เห็นชอบแยก ester/amide เป็น 2 กลุ่ม (linkage-based)
- [x] เห็นชอบ ester↔ester สูง (PABA) · amide↔amide ต่ำ · ester↔amide = ไม่แพ้ข้าม
- [x] เห็นชอบเตือน methylparaben (ester) + metabisulfite (สูตรผสม epi)
- [x] เห็นชอบเน้น "แพ้ LA จริง <1% ส่วนใหญ่ไม่ใช่ภูมิแพ้"

### อ้างอิงกลุ่ม Local Anesthetic
- **bhole2012** — Bhole MV, et al. IgE-mediated allergy to local anaesthetics:
  separating fact from perception. *Br J Anaesth* 2012;108(6):903-11.
- **harboe2010** — Harboe T, et al. Suspected allergy to local anaesthetics:
  follow-up in 135 cases. *Acta Anaesthesiol Scand* 2010;54(5):536-42.
- **khan2022** — Drug allergy: 2022 practice parameter update. *JACI* 2022.

> Encoded ใน `js/allergy-data.js` (groups `la-ester` + `la-amide`), locked โดย
> 4 tests ใน `test/allergy-data.test.js` (รวม 125 tests ผ่าน).

---

## กลุ่มที่ 6 — Iodinated Contrast Media (สารทึบรังสีไอโอดีน) — ✅ verify + encode แล้ว 2026-06-18

### หลักการ: แพ้ข้ามตาม "side chain" (carbamoyl) ไม่ใช่ "ไอโอดีน"
- การแพ้ ICM **ไม่ใช่การแพ้ไอโอดีน** และ **ไม่เกี่ยวกับการแพ้อาหารทะเล/กุ้งหอยปูปลา**
  (myth สำคัญ — ห้ามใช้ประวัติแพ้อาหารทะเลมาห้ามให้ ICM)
- แพ้ข้ามขึ้นกับ **carbamoyl side chain**: ตัวที่ side chain เหมือนกันแพ้ข้าม
  **สูง ~60-77%** · ตัวที่ side chain ต่างกลุ่ม = เสี่ยงต่ำกว่าแต่ **คาดเดาไม่ได้**
  → ยืนยันตัวที่ปลอดภัยด้วย **skin test** (วิธีเดียวที่เชื่อถือได้)

### การจัดกลุ่ม side chain (cluster)
| Cluster | Agents (trade) | หมายเหตุ |
|---|---|---|
| A — classic dihydroxypropyl-carbamoyl | Iohexol (Omnipaque), Iomeprol (Iomeron), Ioversol (Optiray), Iodixanol (Visipaque) | แพ้ข้ามกันสูง 60-77% |
| B — distinct side chain | Iopamidol (Iopamiro/Isovue), Iobitridol (Xenetix) | มักเป็นตัวเลือกสำรอง |
| C — mixed | Iopromide (Ultravist) | classic + modified |
| D — ionic (เก่า) | Ioxaglate (Hexabrix), Diatrizoate (Urografin/Gastrografin) | high-osmolar/ionic |

### Premedication (ESUR 2025)
- **ไม่แนะนำให้ใช้ premedication (steroid/antihistamine) แบบ routine แล้ว** —
  หลักฐานประสิทธิภาพไม่ดีพอ; reaction ที่เกิดทั้งที่ premedicate มักรุนแรงเท่าเดิม
- เน้น **เปลี่ยนตัวยา (side chain ต่างกลุ่ม) + allergy workup (skin test)** แทน

### ทางเลือกปลอดภัย (คนละ class — ไม่แพ้ข้าม)
- **Gadolinium (MRI)** — คนละ class ไม่แพ้ข้ามกับ ICM (มี hypersensitivity ของตัวเองแต่พบน้อย)
- การตรวจที่ไม่ใช้สารทึบรังสี / อัลตราซาวด์
- ICM ตัวที่ skin test ผ่าน

### โมเดลข้อมูล: NBL group เดียว + flag `clusterAware` (engine enhancement)
แพ้ข้ามขึ้นกับ side-chain cluster (คล้ายแนวคิด R1 ของ beta-lactam) → เพิ่ม flag
`clusterAware` ใน `buildNblReport`:
- allergen + crossReactive แต่ละตัวมี field `cluster`
- **same cluster** กับตัวที่แพ้ → avoid (high) · **different cluster** → caution (low, แนะนำ skin test)
- **SCAR** → escalate avoid ทุกตัว · `keepSafeOnScar` → GBCA/ทางเลือกยังปลอดภัย
- refactor การแบ่ง avoid/caution ให้ decision-driven (`crossAvoid`/`crossCaution`)
  → กลุ่มเดิม (default / crossClassCaution) พฤติกรรมไม่เปลี่ยน (locked โดย regression test)

### Checklist verify (กลุ่ม ICM) — ✅ ครบ 2026-06-18
- [x] เห็นชอบ myth-buster: ไม่ใช่แพ้ไอโอดีน / ไม่เกี่ยวอาหารทะเล
- [x] เห็นชอบจัดกลุ่ม side chain (A/B/C/D) + same cluster = แพ้ข้ามสูง
- [x] เห็นชอบ "skin test = วิธีเดียวยืนยันตัวปลอดภัย"
- [x] เห็นชอบ premedication ไม่ routine (ESUR 2025) → เปลี่ยนตัวยาสำคัญกว่า
- [x] เห็นชอบ Gadolinium = ทางเลือกคนละ class

### อ้างอิงกลุ่ม ICM
- **esur2025cm** — ESUR Contrast Media Safety Committee. Hypersensitivity
  reactions to contrast media: Part 1 & 2 (updated). *Eur Radiol* 2025.
- **icmClass2024** — Cross-reactivity in hypersensitivity reactions to contrast
  agents: new classification and guide for clinical practice. *Eur Radiol* 2024.
- **icmSkinTest2024** — Skin Test Reactivity Patterns in Patients Allergic to
  Iodinated Contrast Media: A Refined View. *JACI Pract* 2024 (PMID 39056227).

> Encoded ใน `js/allergy-data.js` (group `icm` + `clusterAware` engine flag),
> locked โดย 4 tests ใน `test/allergy-data.test.js` (รวม 129 tests ผ่าน).

---

## กลุ่มที่ 7 — Heparins (เฮพาริน / LMWH) — ✅ verify + encode แล้ว 2026-06-18

### แยก 2 ภาวะภูมิคุ้มกัน (สำคัญมาก — กลไกต่างกัน)
| | HIT | Delayed-type hypersensitivity (DTH) |
|---|---|---|
| กลไก | Ab ต่อ PF4/heparin complex | T-cell delayed (type IV) |
| อาการ | เกล็ดเลือดต่ำ + ลิ่มเลือดอุดตัน (อันตรายถึงชีวิต — **ไม่ใช่ผื่นแพ้**) | ผื่น eczema/plaque ที่จุดฉีด SC |
| แพ้ข้าม UFH↔LMWH | ~50% in vivo | กว้าง (ไม่ขึ้นกับ MW) |
| Onset | 5-10 วัน (เคยได้มาก่อน 1-2 วัน) | 14-35 วัน (re-exposure 2-10 วัน) |

### หลักการแพ้ข้าม + ทางเลือก
- **เลี่ยง heparin ทุกตัว** (UFH + LMWH ทุกชนิด) ในทั้ง HIT และ DTH
- **ห้ามใช้ LMWH แทน UFH ใน HIT** (แพ้ข้าม ~50%)
- **ทางเลือก (ASH 2018):** argatroban, bivalirudin (DTI — ไม่แพ้ข้าม, ครึ่งชีวิตสั้น เหมาะกรณีวิกฤต) · fondaparinux (HIT: เสี่ยงต่ำ; DTH: ทนได้ดี ~6% cross) · danaparoid (cross ใน vitro, in vivo น้อย → caution) · DOAC (ผู้ป่วยอาการคงที่)
- **เกร็ด DTH:** IV UFH มักใช้ได้แม้แพ้ SC heparin (ปรึกษาผู้เชี่ยวชาญ)

### โมเดลข้อมูล
- cross-reactivity เป็นแบบ **ทั้ง class** (เหมือน sulfonamide) → NBL group ปกติ ไม่ใช้ clusterAware
- crossReactive (avoid สูง) = heparin ทุกตัว · caution = danaparoid · safe = DTI/fondaparinux/DOAC
- `keepSafeOnScar: true` — ยา non-heparin คือตัวที่แนะนำให้เปลี่ยนไปใช้แม้กรณีรุนแรง → ยังคงสถานะ safe

### Checklist verify (กลุ่ม Heparin) — ✅ ครบ 2026-06-18
- [x] เห็นชอบแยก HIT (immune, PF4) vs DTH (ผื่น)
- [x] เห็นชอบ UFH↔LMWH แพ้ข้าม → เลี่ยงทุกตัว / ห้าม LMWH แทน UFH ใน HIT
- [x] เห็นชอบทางเลือก DTI/fondaparinux/danaparoid/DOAC (ASH 2018)
- [x] เห็นชอบ fondaparinux ทนได้ดีใน DTH (~6% cross)

### อ้างอิงกลุ่ม Heparin
- **ash2018hit** — Cuker A, et al. ASH 2018 guidelines for management of VTE:
  heparin-induced thrombocytopenia. *Blood Adv* 2018;2(22):3360-92.
- **dthHeparin** — Schindewolf M, et al. Delayed-type hypersensitivity to
  heparins/heparinoids; tolerance of fondaparinux. (PMID 17573880 / 15025697)

> Encoded ใน `js/allergy-data.js` (group `heparin`), locked โดย 3 tests ใน
> `test/allergy-data.test.js` (รวม 132 tests ผ่าน).

---

## กลุ่มที่เพิ่มใหม่ (multi-drug feature) — ✅ pharmacist-verified 2026-07

> ✅ **เนื้อหาคลินิก 3 จุดด้านล่าง verify กับ primary source (full paper) แล้ว —
> ทุก classification ถูกต้อง ไม่มีการเปลี่ยน bucket** Encoded ใน `js/allergy-data.js`
> (groups `tetracycline`, `nitroimidazole`) + Parecoxib ใน group `nsaid`. Locked
> โดย tests ใน `test/allergy-data.test.js` (`data: tetracycline …`,
> `data: nitroimidazole …`, `data: Parecoxib …`, `data: verified … refs`,
> `multi EXAMPLE …`).

### ✅ Parecoxib เข้ากลุ่ม NSAID (safe / COX-2 selective)
- **หลักการ**: parecoxib = prodrug ของ valdecoxib, COX-2 selective สูง (มีรูปแบบฉีด
  IV/IM) → ผู้ป่วย NSAID **cross-reactive** (NERD/NECD/NIUA, กลไก COX-1) ส่วนใหญ่ทนได้
  เทียบเท่า celecoxib / etoricoxib
- **หลักฐาน**: **Colanardi 2008** (Ann Allergy Asthma Immunol 100:82-85, PMID 18254487) —
  n=79 (รวม multiple-class/cross-reactive 31 ราย), challenge parecoxib 40mg → **แพ้ 0%
  ทุกกลุ่ม**; 23% แพ้ยาปฏิชีวนะร่วม (รวม cotrimoxazole 1) + atopy 20% ก็ยังทน · เทียบ
  coxib อื่น: etoricoxib 0-7%, celecoxib 0-33.3%, valdecoxib 2.4-4% → parecoxib ดีสุด
- **sulfonamide**: parecoxib เป็น **non-antibiotic sulfonamide** ที่ **ไม่มีหมู่ N4
  arylamine** → ไม่แพ้ข้ามกับ sulfonamide antibiotic (**CCJM 2025** 92(3):147; Strom
  2003) จึงให้ในผู้แพ้ sulfa antibiotic ได้ (เหมือน celecoxib). *ไม่* เพิ่ม parecoxib
  ในกลุ่ม sulfonamide — candidate check ที่ตอบ "ไม่เกี่ยวข้อง/ใช้ได้" เมื่อคนไข้แพ้ sulfa
  เป็นคำตอบที่ถูกต้องตาม CCJM แล้ว · valdecoxib SJS/TEN (JAAD 2004) = SCAR idiosyncratic
  คนละเรื่อง cross-react → severity gate จัดการ
- **แนวปฏิบัติ**: ควรยืนยันด้วย **graded challenge** ก่อนใช้จริง (Colanardi)
- **refs**: kowalski2013 · dona2020 · nsaidReview2026 · **colanardi2008** · ccjm2025

### ✅ กลุ่ม Tetracyclines (caution — verified)
- **allergens**: Doxycycline, Minocycline, Tetracycline, Tigecycline
- **โมเดล**: `crossClassCaution: true` + `keepSafeOnScar: true` → tetracycline ตัวอื่น =
  ⚠️ caution (non-SCAR), 🚫 avoid ที่ SCAR; ยานอกกลุ่ม = safe
- **หลักฐาน (แพ้ข้าม "แปรปรวน/ยังไม่สรุป" → caution ถูกต้อง):**
  - **Maciag 2020** (Ann Allergy Asthma Immunol 124:589-593): "rate of cross-reactivity …
    **has not been established**"; case series 10 ราย แพ้ข้ามแปรปรวน; จัดการด้วย skin test +
    graded challenge + desensitization → **ไม่ contraindicate ทั้ง class**
  - **Tham 1996** (Arch Dermatol 132(9):1134-1135): FDE cross tetra↔doxy **62.5%**,
    tetra↔mino **18.75%**, **37.5% ไม่แพ้ข้าม**
  - **Hamilton 2019** (Pharmacy 7(3):104) — review หนุน; **Correia 1999** (CED 24:137) —
    case แพ้ข้าม doxy↔mino
- **minocycline เฉพาะตัว**: DRESS / drug-induced lupus / Sweet (Shepherd 2002; Brown 2009)
- **safe**: beta-lactam (ถ้าไม่แพ้) · macrolide · clindamycin · TMP-SMX
- **refs**: maciag2020 · hamilton2019 · tham1996 · correia1999 · minoLupus

### ✅ กลุ่ม Nitroimidazoles (avoid — verified)
- **allergens**: Metronidazole, Tinidazole, Secnidazole, Ornidazole
- **โมเดล**: NBL ปกติ (cross = 🚫 avoid) + `keepSafeOnScar: true` → เลี่ยงทั้งกลุ่ม
- **หลักฐาน (cross-reactivity ยืนยัน → avoid ถูกต้อง):**
  - **Gendelman 2014** (Allergy Rhinol 5(2):e66-e69): *"because of the similar chemical
    structure of nitroimidazoles, patients with hypersensitivity to metronidazole may also
    have hypersensitivity to tinidazole"*
  - **Hollis 2022** (Cureus 14(7):e26849): tinidazole "posed a serious risk" ในผู้ป่วย
    metronidazole-anaphylaxis · **Cahill 2021** (AACI 17:136): desensitization protocol
- **safe (ทางเลือกคุม anaerobe ทั่วไป)**: clindamycin · amoxicillin-clavulanate /
  piperacillin-tazobactam (ถ้าไม่แพ้ beta-lactam) · vancomycin PO (เฉพาะ CDI)
- **⚠️ ข้อสำคัญ (trichomoniasis)**: มีแต่ nitroimidazole ที่ได้ผล → แนวทางคือ **desensitize
  metronidazole** ภายใต้การเฝ้าระวัง ไม่ใช่สลับไป tinidazole (แพ้ข้าม) หรือยานอกกลุ่ม
  (fail สูง) — encoded ใน callout
- **refs**: gendelman2014 · hollis2022 · cahill2021

### หมายเหตุ: ฟีเจอร์ "แพ้ยาหลายชนิด" (multi-drug)
หน้า allergy รองรับการเลือกยาที่แพ้ได้หลายตัว (แต่ละตัวตั้ง severity/phenotype/nature
แยกกัน) แล้วรวมผลแบบ **worst-wins** ต่อยาเป้าหมาย + ตอบคำถาม "ใช้ยา X ได้ไหม"
(candidate). Engine อยู่ที่ `AllergyData.buildMultiReport()` — เป็นชั้นรวมผลล้วน
(ไม่เพิ่ม clinical logic ใหม่ นอกจากกฎ "แพ้เอง = เลี่ยงเสมอ" และ "ยาที่ปลอดภัยกับทุก
ตัวที่แพ้เท่านั้นจึงจะขึ้น safe"). Locked โดย `multi …` / `multi EXAMPLE …` tests.

---

## ✅ กลุ่ม Opioid (pharmacist-verified 2026-07)
- **allergens:** Morphine, Codeine, Oxycodone, Hydromorphone, Fentanyl, Pethidine(Meperidine),
  Tramadol, Methadone
- **โมเดล:** `clusterAware` + `clusterCaution:true` (flag ใหม่) — **ต่างกลุ่มโครงสร้าง = safer**
  (0% cross), **กลุ่มเดียวกัน = caution** (≤~7%). กลุ่มโครงสร้าง: phenanthrene / phenylpiperidine /
  diphenylheptane / phenylpropylamine
- **หลักฐาน:** **Khalaf 2025** (J Pain Palliat Care Pharmacother): *"No cross-reactivity among any
  opioid drug classes → 100% re-exposure tolerance"*; Baldo 2018 (JACI Pract editorial); ASHP/
  Ann Pharmacother 2019
- **pseudo block (สำคัญ):** อาการที่เรียกว่า "แพ้ opioid" ส่วนใหญ่ = **pseudoallergy** (morphine/
  codeine/pethidine กระตุ้น histamine โดยตรง → คัน/ผื่น/หน้าแดง) หรือผลข้างเคียง — ไม่ใช่ IgE ·
  fentanyl/sufentanil/alfentanil/remifentanil/tramadol ปล่อย histamine น้อย → ทางเลือกเมื่อ
  pseudoallergy · nature=intolerance → แสดง pseudo box
- **⚙️ engine:** เพิ่ม flag `clusterCaution` ใน `buildNblReport` (same cluster=caution/moderate,
  different=safer/negligible; SCAR ยัง avoid) + collect `crossSafer` เข้า safer bucket
- **refs:** khalaf2025, baldo2018, ashp2019

## ✅ กลุ่ม Corticosteroid (pharmacist-verified 2026-07)
- **allergens:** Hydrocortisone, Prednisolone, Methylprednisolone (A) · Triamcinolone, Budesonide (B) ·
  Betamethasone, Dexamethasone (C) · Clobetasol (D1)
- **โมเดล:** `clusterAware` เดิม — cluster = **A/B/C/D1/D2** (Coopman 1989 / Matura-Goossens D1-D2 /
  Baeck 2011); same group = avoid, different group = caution; **กลุ่ม C (betamethasone/dexamethasone)
  = แพ้ข้ามต่ำสุด → safe (ทางเลือกแรก)**
- **หลักฐาน:** **Baeck 2011** (Allergy, molecular modelling) · Berbegal/Actas 2016 (review, Coopman
  A/B/C/D — *"betamethasone/dexamethasone tolerated in many cases"*) · Chen 2022 (JAMA Dermatol) ·
  Baker 2015 · JIACI 2006
- **excipient (สำคัญ):** immediate/anaphylaxis มัก**แพ้ excipient** ไม่ใช่ตัวสเตียรอยด์ — succinate
  ester (hydrocortisone/methylprednisolone succinate), **carboxymethylcellulose (CMC)** (เคส Triamcort
  intra-articular — Guillet 2025), PEG → เลือกสูตรที่ไม่มี excipient นั้น · pseudo box อธิบาย
- **หมายเหตุ:** Baeck cluster — A↔D2 และ C↔D1 มักจับกลุ่มกัน (ใส่ note ใน sub/callout) · ถ้าแพ้กลุ่ม C
  เอง (พบน้อย) ให้ประเมินเป็นราย ๆ
- **refs:** baeck2011, berbegal2016, chen2022cs, baker2015, jiaci2006cs, guillet2025

> ทั้ง 2 กลุ่ม locked โดย `test/allergy-data.test.js` (`data: opioid …`, `data: corticosteroid …`,
> `multi: opioid candidate …`, `data: verified refs on opioid + corticosteroid …`).

## ✅ กลุ่ม Aminoglycoside (pharmacist-verified 2026-07)
- **allergens:** Gentamicin, Tobramycin, Amikacin, Neomycin (deoxystreptamine) · Streptomycin (streptidine)
- **โมเดล:** `clusterAware` เดิม — cluster ตาม "แกน aminocyclitol": **deoxystreptamine**
  (gentamicin/tobramycin/amikacin/kanamycin/neomycin/paromomycin) = same cluster → **avoid** ·
  **streptidine** (streptomycin) โครงสร้างต่าง → **safe (ไม่แพ้ข้าม)** · `keepSafeOnScar:true`
- **🔑 ใจความ:** แพ้ข้ามในกลุ่ม deoxystreptamine **สูง ≥50%** (neomycin↔tobramycin ถึง **65%**) →
  *"all deoxystreptamine aminoglycosides carry a contraindication if HS to another"* → ถ้าแพ้ตัวใด
  ตัวหนึ่งให้ถือว่า **contraindicate ทั้ง subgroup** · streptomycin (streptidine) แยกออก = ไม่แพ้ข้าม ·
  อาการที่พบบ่อยสุด = **allergic contact dermatitis** จาก neomycin ชนิดทา (systemic HSR พบน้อยกว่า)
- **หลักฐาน:** **Childs-Kean 2019** (Pharmacy Basel 7(3):124 — review หลัก, ตัวเลข ≥50% / 65% /
  contraindication statement) · Di Leo 2022 (Clin Rev Allergy Immunol) · WAO NBL statement
- **refs:** childsKean2019, diLeo2022, waoNbl

## ✅ กลุ่ม Macrolide (pharmacist-verified 2026-07)
- **allergens:** Erythromycin, Clarithromycin, Azithromycin, Roxithromycin, Spiramycin
- **โมเดล:** `crossClassCaution:true` (เหมือน fluoroquinolone) — macrolide ตัวอื่น = **caution**
  (non-SCAR), ยกระดับเป็น **avoid เมื่อ SCAR** · ยาต่างกลุ่ม (beta-lactam/doxycycline/FQ/clindamycin)
  = **safe** · `keepSafeOnScar:true`
- **🔑 ใจความ:** แพ้ข้ามในกลุ่ม macrolide **ต่ำและไม่สม่ำเสมอ** — หลักฐานเป็น **case report** เป็นหลัก
  (erythromycin↔clarithromycin [14-membered]; erythromycin↔azithromycin) · ผู้ป่วยหลายรายทน macrolide
  ตัวอื่นได้ · HSR โดยรวมพบ **0.4–3%** · **drug provocation test** เป็นวิธีเดียวที่ยืนยัน tolerance ของ
  macrolide ตัวอื่นได้ → การเลี่ยงทั้งกลุ่มอาจไม่จำเป็น แต่ค่าเริ่มต้นที่ปลอดภัยสุด = ยานอกกลุ่ม
- **หลักฐาน:** **Shaeer 2019** (Pharmacy Basel 7(3):135 — review หลัก, *"cross-reactivity low/
  inconsistent … lack of evidence for cross-sensitization"*, HSR 0.4–3%) · Pereira 2024 (Asia Pac
  Allergy — DPT to confirm/exclude) · macrolide peds provocation cohort 2024 · WAO NBL statement
- **refs:** shaeer2019, pereira2024, macroPeds2024, waoNbl

> ทั้ง 2 กลุ่ม locked โดย `test/allergy-data.test.js` (`data: aminoglycoside …`, `data: macrolide …`,
> `multi: aminoglycoside candidate …`, `data: verified refs on aminoglycoside + macrolide …`).

## ✅ กลุ่ม PPI (Proton Pump Inhibitor) (pharmacist-verified 2026-07)
- **allergens:** Omeprazole, Esomeprazole, Pantoprazole (benzimidazole cluster) · Lansoprazole, Rabeprazole (pyridine cluster)
- **โมเดล:** `clusterAware` เดิม — cluster ตาม side chain ที่ดัด: **benzimidazole**
  (omeprazole/esomeprazole/pantoprazole — methoxy/difluoromethoxy) = same cluster → **avoid** ·
  **pyridine** (lansoprazole/rabeprazole/dexlansoprazole) = different cluster → **caution** ·
  `keepSafeOnScar:true` (H2RA/antacid คนละ class → ปลอดภัยแม้ SCAR)
- **🔑 ใจความ:** แพ้ข้ามไป PPI ตัวอื่นเฉลี่ย **61.6%** · แพ้ทั้งกลุ่ม **8.9%** → **ไม่มี PPI ตัวไหน
  safe ก่อน work-up**; PPI ต่างกลุ่มแพ้ข้ามต่ำกว่าแต่ต้องยืนยันด้วย **skin test + DPT** เสมอ ·
  benzimidazole cluster (ome/eso/panto) แพ้ข้ามกันสูงสุด · **H2RA (famotidine) = ทางเลือกปลอดภัย**
  (Sobrevia 2010: ranitidine ทนได้ทุกเคส) · SCAR → เลี่ยง PPI ทุกตัว
- **หลักฐาน:** **Bavbek 2024** (Allergy — EAACI position paper, ตาราง substituent + ตัวเลข 61.6%/8.9%,
  skin test + DPT ก่อนเลือก alternative) · Sobrevia 2010 (JIACI — Pattern 1 pan-PPI vs Pattern 2
  within-cluster; ranitidine ทนได้) · Kepil Özdemir 2013 (Clin Exp Allergy — skin test ยืนยัน cross)
- **refs:** bavbek2024, sobrevia2010, kepilOzdemir2013

## ✅ กลุ่ม Sulfonylurea (pharmacist-verified 2026-07)
- **allergens:** Glibenclamide (Glyburide), Glipizide, Gliclazide, Glimepiride, Chlorpropamide, Tolbutamide
- **โมเดล:** `crossClassCaution` (เหมือน fluoroquinolone/macrolide) — SU ตัวอื่น = **caution**
  (ยกเป็น **avoid เมื่อ SCAR**) · `keepSafeOnScar:true` (ยาเบาหวานนอกกลุ่ม SU ไม่เกี่ยวโครงสร้าง →
  ต้องปลอดภัยเสมอ)
- **🔑 ใจความ:** sulfonylurea = **non-antibiotic (non-arylamine) sulfonamide** — ไม่มีหมู่ N4
  arylamine → แพ้ข้ามเชิงภูมิกับ **sulfa antibiotic ต่ำ/theoretical** (ตัวกำหนดคือ N1/N4 substitution
  ไม่ใช่หมู่ sulfonamide ร่วม) · **within-SU (SU↔SU) ไม่มีการศึกษาโดยตรง** → จัด caution ไว้ก่อน (ดุลพินิจ
  เภสัชกร) · **ยาเบาหวานนอกกลุ่ม SU** (metformin/glinide/DPP-4i/SGLT2i/GLP-1/insulin/pioglitazone)
  = ทางเลือกปลอดภัยชัดเจน
- **หลักฐาน:** **Johnson 2005** (Ann Pharmacother — *"dogma แพ้ข้าม antibiotic↔non-antibiotic ไม่มี
  ข้อมูลหนุน"*) · **Ghimire 2013** (J Clin Pharm Ther — non-sulfonylarylamine = *"required
  precaution"*, คำเตือนแพ้ข้าม = theoretical) · Giles/Pharmacy 2019 (7(3):132 — N1/N4 substitution
  เป็นตัวกำหนด, low risk แต่ prudent ถ้าอาการรุนแรง) · Strom 2003 (NEJM, ในโค้ดแล้ว)
- **หมายเหตุ engine:** `keepSafeOnScar` เป็น group-level → ต้องเก็บ metformin/insulin (ไม่เกี่ยว) ให้
  safe เสมอ ไม่งั้นถูก mis-flag เป็น caution ตอน SCAR · การ precaution ของ sulfa antibiotic/thiazide
  ตอน SCAR จึงสื่อผ่าน per-item note + noteScar แทนการ downgrade bucket
- **refs:** strom2003, johnson2005, ghimire2013, sulfaAllergyRev2019

> ทั้ง 2 กลุ่ม locked โดย `test/allergy-data.test.js` (`data: PPI …`, `data: sulfonylurea …`,
> `multi: PPI + sulfonylurea candidates …`, `data: verified refs on PPI + sulfonylurea …`).
