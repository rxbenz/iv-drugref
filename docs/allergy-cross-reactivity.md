# Allergy Cross-Reactivity Reference — Beta-Lactam (Phase 1)

> 🟢 **สถานะ: ตัวเลข/คำแนะนำ beta-lactam ยืนยันกับ full-text แล้ว (2026-06-18)**
> — ตรวจกับ PDF แหล่งปฐมภูมิ 12 ไฟล์ (Picard 2019, Khan 2022, Zagursky 2018,
> Romano 2015/2016, pharmacy/clinician reviews, Trubiano 2022). เหลือเภสัชกร
> สอบทานเชิงคลินิกขั้นสุดท้าย + เห็นชอบ threshold/tier ก่อน lock เข้า Phase 2
>
> ขอบเขต Phase 1 = **beta-lactam เท่านั้น** (penicillins, cephalosporins,
> carbapenems, monobactam). กลุ่มอื่น (sulfa, NSAID, anticonvulsant + HLA)
> อยู่ Phase 5 — โครง HLA ท้ายไฟล์ **ยังรอ verify**

---

## ✅ สถานะการ verify

- รอบแรก research ผ่าน search snippet (WebFetch โดน block 403) → **รอบนี้เภสัชกร
  ส่ง full-text PDF 12 ไฟล์มาแล้ว ผมตรวจซ้ำทุกค่ากับต้นฉบับ** ผล: ตัวเลข
  beta-lactam ทั้งหมด**ตรงกับ full-text** (รายละเอียด + คำ verbatim อยู่ในแต่ละหัวข้อ)
- ✅ = ยืนยันกับ full-text แล้ว · ☐ = รอเภสัชกรสอบทานคลินิก/เห็นชอบ threshold
- จุดที่ปรับหลังอ่าน full-text:
  - **ceftazidime ↔ aztreonam** แชร์ R1 เหมือนกันเป๊ะ — ยืนยันตรงจาก Khan 2022
    (ดูข้อ 3); ส่วนการจัด ceftazidime อยู่กลุ่ม aminothiazole นั้นแชร์แค่ "วง"
    แต่ oxime ต่าง → คง caveat ไว้
  - ค่า "ภาพรวม ~2%" = Khan 2022 อ้าง post-1980 12 studies → 8/417 = **2%**
    (ตำราเก่า 8–10% เป็นค่าเกินจริง)

---

## 1. นิยามระดับความเสี่ยง (risk tier)

| Tier | ความหมาย | % แพ้ข้าม (โดยประมาณ) |
|---|---|---|
| 🔴 สูง (high) | R1 side chain เหมือน/คล้ายยาที่แพ้ หรือยาในกลุ่มเดียวกัน | ~16% (same R1) |
| 🟠 ปานกลาง (moderate) | R1 คล้ายบางส่วน (intermediate similarity) | ~5–6% |
| 🟡 ต่ำ (low) | R1 ต่างกัน แต่ยังเป็น beta-lactam | ~2% |
| 🟢 น้อยมาก (negligible) | side chain ไม่ซ้ำ / โครงสร้างต่างกลุ่มสิ้นเชิง | <1% |

> ✅ **เลขหลักจาก Picard 2019 meta-analysis [3] (penicillin-allergic) — ตรงกับ full-text:**
> - aminocephalosporin (same R1, similarity=1): **16.45%** (95% CI 11.07–23.75)
> - intermediate (similarity 0.563–0.714): **5.60%** (95% CI 3.46–8.95)
> - low similarity (<0.4), ทุก generation: **2.11%** (95% CI 0.98–4.46)
> - carbapenem (ทุกตัว): **0.87%** (95% CI 0.32–2.32) — meta จาก 1127 ผู้ป่วย
>
> ✅ ภาพรวม pen→ceph **~2%** = Khan 2022 [1] (post-1980, 12 studies → 8/417 = 2%);
> ค่าตำราเก่า 8–10% เกินจริง (ยุคแรก cephalosporin ปนเปื้อน penicillin) — เป็นหมายเหตุ ไม่ใช่ค่าหลัก

---

## 2. กฎปรับตามความรุนแรงของปฏิกิริยา (severity gating) — สำคัญที่สุดเชิงความปลอดภัย

| ปฏิกิริยาที่ผู้ป่วยเคยเป็น | แนวทาง | challenge / test dose | ✅ verify |
|---|---|---|---|
| ผื่น maculopapular ไม่รุนแรง (delayed, benign) | low-risk → ทางเลือก R1 ต่างใช้ได้ | direct oral challenge ได้ ไม่ต้อง skin test [1] | ✅ |
| IgE immediate: ลมพิษ / angioedema / anaphylaxis | risk-stratify; เลือก R1 ต่าง/cefazolin/carbapenem/aztreonam | high-risk ต้อง skin test ก่อน challenge [1][2] | ✅ |
| **SCAR: SJS / TEN / DRESS / AGEP** | **หลีกเลี่ยงยาต้นเหตุ + ยาที่โครงสร้างใกล้เคียง (มักเลี่ยงทั้งกลุ่ม)** | **ห้าม challenge / desensitization โดยเด็ดขาด** [1][6] | ✅ |
| ปฏิกิริยารุนแรงอื่น (interstitial nephritis, hemolytic anemia, cytopenias, DILI, nephritis…) | หลีกเลี่ยง | **ห้าม re-exposure** [1] | ✅ |

> ✅ **ยืนยันจาก Khan 2022 [1] — TABLE IV "Contraindications to drug challenges"**
> ระบุชัด: SJS/TEN, DRESS, AGEP, severe drug anaphylaxis, cytopenias, drug-induced
> liver injury, nephritis ฯลฯ + ข้อความ: *"Avoidance of all beta-lactams is generally
> recommended in [SCARs]"* และ delayed intradermal test ห้ามใน SJS/TEN
>
> ✅ **กฎ SCAR (Trubiano 2022 [6]) — verbatim:** *"If the testing is non-conclusive or
> negative, it is recommended to avoid the suspected culprit drug and any structurally
> similar drug in future"* + *"A negative patch test does not exclude"* (skin test ผลลบ
> ไม่ "clear" ยา) → ถ้าเคยเป็น SCAR ให้ถือว่า "ห้ามใช้ + เลี่ยงยาใกล้เคียง" ไว้ก่อน

---

## 3. R1 side-chain groupings (ฐานของการคำนวณแพ้ข้าม)

| กลุ่ม R1 | ยาในกลุ่ม (แพ้ข้ามกันเอง) | หมายเหตุ | ✅ verify |
|---|---|---|---|
| **Amoxicillin cluster** | Amoxicillin · Cefadroxil · Cefprozil · Cefatrizine | R1 = hydroxy-aminobenzyl [4][7] | ✅ |
| **Ampicillin cluster** | Ampicillin · Cephalexin (cefalexin) · Cefaclor · Cephradine · Cephaloglycin · Loracarbef | R1 = aminobenzyl [4][7] | ✅ |
| **Aminothiazole-methoxyimino** | Cefotaxime · Ceftriaxone · Cefepime · Cefpodoxime · Cefuroxime | Ceftriaxone+Cefotaxime R1 เหมือนกันเป๊ะ [5][7] | ✅ |
| **Alkoxyimino (ceftazidime/aztreonam)** | **Ceftazidime ↔ Aztreonam** (R1 เหมือนกัน) | ⚠️ **อย่าจัด ceftazidime ไว้กลุ่ม methoxyimino** — เป็นจุดที่ chart ทั่วไปมักผิด [7] | ✅ |
| **Unique (ไม่ซ้ำใคร)** | **Cefazolin** | R1 และ R2 ไม่ซ้ำ beta-lactam ใดเลย → ปลอดภัยสุด [1][8] | ✅ |

> ✅ **ยืนยันจาก full-text** — pharmacy review [7]: *"[Amoxicillin] has the same side
> chain as … cefadroxil, cefprozil, … cefatrizine. Ampicillin has the same side chain
> as cefaclor, cephalexin, cephradine, cephaloglycin and loracarbef. **Distinctly,
> cefazolin does [not share a side chain]**."* · Khan 2022 [1]: *"aztreonam and
> ceftazidime sharing an **identical R1 side chain**."*

---

## 4. ตารางคำแนะนำต่อยาที่แพ้ (เริ่มที่ aminopenicillin)

### 4.1 แพ้ Amoxicillin / Ampicillin (aminopenicillin)

#### 🚫 ควรหลีกเลี่ยง
| ยาเป้าหมาย | % แพ้ข้าม | tier | เหตุผล | ref | ✅ |
|---|---|---|---|---|---|
| Penicillins อื่น (Pen G/V, piperacillin, cloxacillin…) | ถือว่าแพ้ทั้งกลุ่ม | 🔴 | แกน penicillin เดียวกัน | [1] | ✅ |
| Cefadroxil, Cefprozil (แพ้ amoxicillin) | ~16% (CI 11–24) | 🔴 | R1 เหมือน amoxicillin | [3][4] | ✅ |
| Cephalexin, Cefaclor, Cephradine, Loracarbef (แพ้ ampicillin) | ~16% (CI 11–24) | 🔴 | R1 เหมือน ampicillin | [3][4] | ✅ |

#### ✅ ทางเลือกที่ปลอดภัยกว่า
| ยาเป้าหมาย | % แพ้ข้าม | tier | เหตุผล / เงื่อนไข | ref | ✅ |
|---|---|---|---|---|---|
| **Cefazolin** | ~0.7% | 🟢 | R1 ไม่ซ้ำใคร — Khan: ให้ได้แม้มีประวัติ anaphylaxis (ยกเว้น SCAR) | [1][8] | ✅ |
| Carbapenem (meropenem, imipenem, ertapenem) | 0.87% (CI 0.32–2.32) | 🟢 | Khan: ให้ได้ทุกกรณีไม่ต้องทดสอบ (ยกเว้น SCAR) | [1][3] | ✅ |
| Aztreonam | <1% | 🟢 | ไม่แพ้ข้ามกับ penicillin — **ยกเว้นแพ้ Ceftazidime** (R1 เดียวกัน) | [1] | ✅ |
| Ceftriaxone, Cefotaxime, Cefuroxime, Cefepime, Ceftazidime | 2.11% (CI 0.98–4.46) | 🟡 | R1 ต่างจาก aminopenicillin; ผื่นไม่รุนแรง พิจารณาใช้/graded challenge | [1][3] | ✅ |
| Non-beta-lactam (ดูข้อ 5) | N/A | 🟢 | ต่างกลุ่มสิ้นเชิง — เลือกตาม indication | [2] | ✅ |

> หมายเหตุ severity: ตารางนี้ใช้กับประวัติ IgE/ผื่นทั่วไป — **ถ้าเคยเป็น SCAR
> ให้เลี่ยง beta-lactam ทั้งหมดและห้าม challenge** (ดูข้อ 2)

### 4.2 แพ้ Penicillin G/V
- หลักการเดียวกับ 4.1 แต่ R1 ของ penicillin G ไม่ตรงกับ cephalosporin กลุ่ม amino → cephalosporin ส่วนใหญ่ tier 🟡 ต่ำ; cefazolin/carbapenem/aztreonam 🟢
- *(รอเติมตารางเต็มหลัง verify 4.1)* ✅ ☐

### 4.3 แพ้ Cephalosporin (เช่น ceftriaxone)
- cephalosporin → cephalosporin: **R1 เหมือน = เสี่ยง; R1 ต่าง = ต่ำ** [1]
- ช่วงที่รายงานใน T-cell-mediated penicillin hypersensitivity → cephalosporins = **2.8–31.2%** (สะท้อนว่า side chain กำหนดมาก) [5]
- *(รอเติมตารางเต็มหลัง verify)* ✅ ☐

---

## 5. ทางเลือก non-beta-lactam (เมื่อต้องเลี่ยง beta-lactam ทั้งหมด)

เลือก **ตาม indication/เชื้อ/ตำแหน่ง** — ไม่มีแพ้ข้ามกับ beta-lactam [2][8]:

| กลุ่ม | ตัวอย่าง | ✅ |
|---|---|---|
| Macrolide | Azithromycin, Clarithromycin | ☐ |
| Fluoroquinolone | Levofloxacin, Ciprofloxacin | ☐ |
| Lincosamide | Clindamycin | ☐ |
| Glycopeptide | Vancomycin | ☐ |
| Tetracycline | Doxycycline | ☐ |
| Others | TMP-SMX, Metronidazole, Nitrofurantoin | ☐ |

> ⚠️ **Aztreonam ไม่นับเป็น non-beta-lactam** — เป็น monobactam (beta-lactam)
> ที่ปลอดภัยในคนแพ้ penicillin ยกเว้น ceftazidime → จัดไว้ในตารางข้อ 4

---

## 6. Phase 5 (อนาคต) — HLA pharmacogenomics สำหรับคนไทย (ยังไม่อยู่ใน v1)

| ยา | HLA allele | ปฏิกิริยา | หมายเหตุไทย | ref | ✅ |
|---|---|---|---|---|---|
| Carbamazepine / Oxcarbazepine | **HLA-B*15:02** | SJS/TEN | คนไทย allele freq ~16%; NHSO ครอบคลุมตรวจก่อนเริ่ม | [9] | ☐ |
| Carbamazepine | HLA-A*31:01 | MPE/DRESS/SJS-TEN | กว้างกว่า เชื้อชาติหลากหลาย | [9] | ☐ |
| Allopurinol | **HLA-B*58:01** | SCAR (SJS/TEN, DRESS) | คนไทยสัมพันธ์สูง; NHSO แนะนำตรวจ | [10] | ☐ |
| Abacavir | HLA-B*57:01 | hypersensitivity | CPIC strong; ห้ามใช้ถ้าผลบวก | [9] | ☐ |

---

## 7. เอกสารอ้างอิง

1. Khan DA, et al. Drug allergy: A 2022 practice parameter update. *J Allergy Clin Immunol*. 2022;150(6):1333-1393.
2. Blumenthal KG, Peter JG, Trubiano JA, Phillips EJ. Antibiotic allergy. *Lancet*. 2019;393(10167):183-198.
3. Picard M, et al. Cross-Reactivity to Cephalosporins and Carbapenems in Penicillin-Allergic Patients: Two Systematic Reviews and Meta-Analyses. *J Allergy Clin Immunol Pract*. 2019;7(8):2722-2738.
4. Zagursky RJ, Pichichero ME. Cross-reactivity in β-Lactam Allergy. *J Allergy Clin Immunol Pract*. 2018;6(1):72-81.
5. Romano A, et al. IgE-mediated hypersensitivity to cephalosporins / T-cell-mediated penicillin hypersensitivity cross-reactivity. *J Allergy Clin Immunol*. 2015–2016.
6. Trubiano JA, et al. The assessment of severe cutaneous adverse drug reactions. *Aust Prescr*. 2022.
7. Cephalosporins: A Focus on Side Chains and β-Lactam Cross-Reactivity. (review) PMC6789778.
8. β-Lactam Allergy and Cross-Reactivity: A Clinician's Guide. *J Asthma Allergy*. 2021. PMC7822086.
9. Phillips EJ, et al. CPIC Guideline for HLA Genotype and Carbamazepine/Oxcarbazepine: 2017 Update. *Clin Pharmacol Ther*. 2018;103(4):574-581. (+ CPIC abacavir 2014)
10. Sukasem C, et al. HLA-B*58:01 and allopurinol SCAR in Thai population (2014); Implementation of HLA-B*15:02 genotyping in Thailand. *Front Pharmacol*. 2022;13:867490.

---

## Checklist การ verify

**ยืนยันกับ full-text แล้ว (โดย Claude, 2026-06-18):**
- [x] เลข Picard 2019 (16.45 / 5.60 / 2.11 / 0.87% + 95% CI) — ตรง full-text [3]
- [x] contraindication SCAR ของ Khan 2022 — TABLE IV + "avoidance of all beta-lactams" [1]
- [x] R1 groupings (amoxicillin/ampicillin cluster, ceftazidime↔aztreonam identical R1, cefazolin "distinctly" unique) [1][7]
- [x] cefazolin ~0.7% + เงื่อนไข "ให้ได้แม้ anaphylaxis ยกเว้น SCAR" [1][8]
- [x] carbapenem/aztreonam management ของ Khan [1]; Romano range 2.8–31.2% [5]

**เหลือเภสัชกรสอบทาน/เห็นชอบ (clinical sign-off):**
- [ ] เห็นชอบ tier/threshold ที่ใช้ (16 / 5.6 / 2.1 / <1%) เหมาะกับ UI ไหม
- [ ] เห็นชอบรายการ non-beta-lactam alternatives + วิธี gating ตาม severity
- [ ] ตัดสินใจ: ต้องเติมตาราง 4.2 (แพ้ Pen G/V) และ 4.3 (แพ้ cephalosporin) ให้เต็มก่อน Phase 2 หรือไม่
- [ ] HLA (ข้อ 6, Phase 5) — ยังรอ verify จากไฟล์ CPIC/Sukasem ที่ส่งมา (ทำตอนถึง Phase 5)
