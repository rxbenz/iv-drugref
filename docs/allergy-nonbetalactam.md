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
- [ ] ตัดสิน: paracetamol ขนาดสูง → คงเป็น ✅ หรือย้ายเป็น ⚠️ (รอ confirm)

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
