/**
 * IV DrugRef PWA — English Translations v2.0
 * CRITICAL: Thai has NO word boundaries — patterns must be FULL PHRASES
 * Short Thai words (ห้าม, ควร, เก็บ, ต่ำ, สูง) CANNOT be pattern-matched
 * because they appear inside compound words (การเตรียม, ข้อควรระวัง)
 */

window.IV_I18N_EN = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // UI translations for data-i18n attributes
  // ═══════════════════════════════════════════════════════════
  var ui = {};

  // ═══════════════════════════════════════════════════════════
  // DRUG SECTION TITLES & FIELD LABELS
  // Used by translateLabels() with CONTAINS matching
  // Applied to .section-title, .info-label elements
  // ═══════════════════════════════════════════════════════════
  var drugSections = {
    // ── Section titles (from obfuscated code, format: "Thai (ENGLISH)") ──
    'การเตรียมยา (RECONSTITUTION)': 'RECONSTITUTION',
    'การเตรียมยา': 'RECONSTITUTION',
    'การเจือจาง (DILUTION)': 'DILUTION',
    'การเจือจาง': 'DILUTION',
    'วิธีบริหารยา (ADMINISTRATION)': 'ADMINISTRATION',
    'วิธีบริหารยา': 'ADMINISTRATION',
    'ความคงตัว (STABILITY)': 'STABILITY',
    'ความคงตัว': 'STABILITY',
    'ข้อควรระวัง (PRECAUTIONS)': 'PRECAUTIONS',
    'ข้อควรระวัง / PRECAUTIONS': 'PRECAUTIONS',
    'ข้อควรระวัง': 'PRECAUTIONS',
    'ความเข้ากันได้ (COMPATIBILITY)': 'COMPATIBILITY',
    'ความเข้ากันได้': 'COMPATIBILITY',
    'การติดตาม (MONITORING)': 'MONITORING',
    'การติดตาม': 'MONITORING',
    'แหล่งอ้างอิง (REFERENCE)': 'REFERENCE',
    'แหล่งอ้างอิง': 'REFERENCE',
    'การคำนวณขนาดยา': 'DOSE CALCULATION',

    // ── Field labels (info-label class) ──
    'ตัวทำละลาย': 'SOLVENT',
    'ปริมาตร': 'VOLUME',
    'ความเข้มข้น': 'CONCENTRATION',
    'สารเจือจาง': 'DILUENT',
    'ความเข้มข้นสุดท้าย': 'FINAL CONCENTRATION',
    'วิธีการให้': 'ROUTE',
    'อัตราการให้': 'RATE',
    'หลัง Reconstitution': 'AFTER RECONSTITUTION',
    'หลัง Dilution': 'AFTER DILUTION',
    'การเก็บรักษา': 'STORAGE',

    // ── Filter & nav labels ──
    'หมวดยา': 'DRUG CATEGORIES',
  };

  // ═══════════════════════════════════════════════════════════
  // FULL PHRASES (applied WITHOUT boundary check — direct substring match)
  // These are complete, unambiguous phrases safe for direct replacement
  // Sorted by length DESC to prevent partial matches
  // ═══════════════════════════════════════════════════════════
  var fullPhrases = [
    // ── Disclaimers & institutional text ──
    { th: 'ข้อจำกัดความรับผิดชอบ (Disclaimer)', en: 'Disclaimer' },
    { th: 'ข้อจำกัดความรับผิดชอบ', en: 'Disclaimer' },
    { th: 'ข้อมูลในแอปพลิเคชันนี้จัดทำขึ้นเพื่อเป็น', en: 'The information in this application is provided as a' },
    { th: 'เครื่องมือสนับสนุนการตัดสินใจทางคลินิก', en: 'clinical decision support tool' },
    { th: 'ไม่ได้มีวัตถุประสงค์เพื่อทดแทนดุลยพินิจทางวิชาชีพของเภสัชกรหรือบุคลากรทางการแพทย์', en: 'not intended to replace professional judgment of pharmacists or healthcare professionals' },
    { th: 'ผู้ใช้ควรตรวจสอบข้อมูลกับแหล่งอ้างอิงปฐมภูมิ', en: 'Users should verify information with primary references' },
    { th: 'และพิจารณาข้อมูลเฉพาะของผู้ป่วยแต่ละรายก่อนนำไปใช้ในทางคลินิกเสมอ', en: 'and consider individual patient data before clinical application' },
    { th: 'ผู้จัดทำไม่รับผิดชอบต่อความเสียหายใดๆ ที่อาจเกิดจากการใช้ข้อมูลนี้โดยไม่ได้ตรวจสอบกับแหล่งข้อมูลที่เป็นปัจจุบัน', en: 'The developer is not responsible for any damages from using this information without verification with current data sources' },
    { th: 'เครื่องมือช่วยคำนวณเบื้องต้น ไม่ทดแทน clinical judgment ของเภสัชกร/แพทย์', en: 'Basic calculation tool — not a substitute for clinical judgment of pharmacist/physician' },
    { th: 'เครื่องมือช่วยปรับขนาดยาเบื้องต้นเท่านั้น — ต้องใช้ clinical judgment ประกอบเสมอ', en: 'Basic dose adjustment tool only — must always use clinical judgment' },
    { th: 'เครื่องมือช่วยคำนวณเบื้องต้นเท่านั้น', en: 'Basic calculation tool only' },
    { th: 'สำหรับบุคลากรทางการแพทย์เท่านั้น', en: 'For healthcare professionals only' },
    { th: 'จัดทำโดย ภก. ฐาปนัท นาคครุฑ (Benz) กลุ่มงานเภสัชกรรม', en: 'Developed by Thapanat Nakkrut, M.Pharm. (Benz), Pharmacy Dept.' },
    { th: 'กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา', en: 'Pharmacy Dept., Neurological Institute of Thailand' },
    { th: 'สถาบันประสาทวิทยา', en: 'Neurological Institute of Thailand' },
    { th: 'กลุ่มงานเภสัชกรรม', en: 'Pharmacy Department' },

    // ── License section ──
    { th: 'ผลงานนี้เผยแพร่ภายใต้สัญญาอนุญาต', en: 'This work is published under' },
    { th: 'สัญญาอนุญาต (License)', en: 'License' },
    { th: 'สัญญาอนุญาต', en: 'License' },
    { th: 'ใช้งาน แชร์ ดัดแปลงได้ — ต้องให้เครดิตผู้สร้าง', en: 'Use, share, adapt — must credit creator' },
    { th: 'ห้ามใช้เชิงพาณิชย์', en: 'No commercial use' },
    { th: 'ถ้าดัดแปลง ต้องแชร์ภายใต้สัญญาเดียวกัน', en: 'If adapted, must share under same license' },
    { th: 'ดูรายละเอียดสัญญาอนุญาต', en: 'View license details' },

    // ── UI navigation ──
    { th: 'เกี่ยวกับแอปนี้', en: 'About this app' },
    { th: 'แจ้งปัญหา / ข้อเสนอแนะ', en: 'Report issues / Suggestions' },
    { th: 'ค้นหายา... เช่น phenytoin, amiodarone, rt-PA', en: 'Search drugs... e.g., phenytoin, amiodarone, rt-PA' },
    { th: 'ค้นหาชื่อยา...', en: 'Search drug name...' },
    { th: 'ค้นหายา...', en: 'Search drugs...' },

    // ── Version info ──
    { th: 'เวอร์ชัน 4.6.0 — มีนาคม 2569 (2026)', en: 'Version 4.6.0 — March 2026' },
    { th: 'มีนาคม 2569', en: 'March 2026' },

    // ── TDM page ──
    { th: 'เริ่มให้ยา (วัน+เวลา)', en: 'Start drug (date+time)' },
    { th: 'เริ่มให้ยา (days+เวลา)', en: 'Start drug (date+time)' },
    { th: '# doses ที่ให้แล้ว', en: '# doses already given' },
    { th: 'เวลาเจาะ', en: 'Sampling time' },
    { th: '+ เพิ่ม dose', en: '+ Add dose' },
    { th: '+ เพิ่ม level', en: '+ Add level' },
    { th: '⭐ แนะนำ', en: '⭐ Recommended' },
    { th: 'ระบบเลือก model ที่ objective function value ต่ำที่สุด (best fit)', en: 'System selects model with lowest objective function value (best fit)' },
    { th: 'ต่ำที่สุด', en: 'lowest' },
    { th: 'สูงที่สุด', en: 'highest' },
    { th: '📋 แนะนำเวลาเจาะ:', en: '📋 Recommended sampling times:' },
    { th: 'กรุณากรอกเวลาให้ยาก่อน', en: 'Please enter drug administration time first' },
    { th: 'กรุณาใส่ค่า Phenytoin level', en: 'Please enter Phenytoin level' },
    { th: 'กรุณาใส่ค่า Valproate level', en: 'Please enter Valproate level' },
    { th: 'นาทีก่อน dose', en: 'minutes before dose' },
    { th: 'นาทีหลัง infusion', en: 'minutes after infusion' },
    { th: 'อยู่ใน target range', en: 'within target range' },
    { th: 'ต่ำกว่า target', en: 'Below target' },
    { th: 'สูงกว่า target', en: 'Above target' },
    { th: 'อาจ subtherapeutic', en: 'may be subtherapeutic' },
    { th: 'เสี่ยง nephrotoxicity', en: 'risk of nephrotoxicity' },
    { th: 'พิจารณาเพิ่ม dose', en: 'consider increasing dose' },
    { th: 'หยุดยา/ลด dose ทันที', en: 'stop/reduce dose immediately' },
    { th: 'พิจารณาลด dose/หยุดยา', en: 'consider reducing dose/stopping drug' },
    // Vancomycin
    { th: 'เจาะก่อน steady state', en: 'drawn before steady state' },
    { th: 'อาจไม่ใช่ true trough', en: 'may not be true trough' },
    { th: 'ยังทำงานได้จาก random level', en: 'can still work from random level' },
    // Phenytoin
    { th: 'Phenytoin มี non-linear kinetics', en: 'Phenytoin has non-linear kinetics' },
    { th: 'ต้องส่ง free level', en: 'must send free level' },
    { th: 'เส้นโค้ง Michaelis-Menten', en: 'Michaelis-Menten curve' },
    { th: 'แสดง non-linear relationship ระหว่าง dose', en: 'shows non-linear relationship between dose' },
    { th: 'เปลี่ยนครั้งละ', en: 'change by' },
    { th: 'เจาะ level 5-7 วันหลังเปลี่ยน dose', en: 'Draw level 5-7 days after dose change' },
    // Aminoglycoside
    { th: 'เจาะ random level ที่ 6-14 hr post-dose', en: 'draw random level at 6-14 hr post-dose' },
    { th: 'ควรเจาะหลัง dose ที่ 1 เท่านั้น', en: 'Should draw only after dose #1' },
    { th: 'ไม่ต้องรอ steady state', en: 'does not need to wait for steady state' },
    { th: '30 นาทีหลัง infusion เสร็จ', en: '30 minutes after infusion finished' },
    { th: '30 นาทีก่อน dose ถัดไป', en: '30 minutes before next dose' },
    // Valproate
    { th: 'เจาะ trough level ก่อน dose ถัดไป', en: 'Draw trough level before next dose' },
    { th: 'ส่ง free VPA level', en: 'send free VPA level' },
    { th: 'free fraction เพิ่มขึ้น', en: 'free fraction increased' },
    { th: 'ห้ามใช้ร่วม Carbapenem', en: 'Cannot use together with Carbapenem' },
    { th: 'ลด VPA level 60-100%', en: 'reduces VPA level 60-100%' },
    { th: 'ห้ามให้ร่วมกัน', en: 'Cannot give together' },

    // ── Renal Dosing ──
    { th: 'ข้อมูลผู้ป่วย', en: 'Patient Information' },
    { th: 'อายุ (ปี)', en: 'Age (years)' },
    { th: 'น้ำหนัก (kg)', en: 'Weight (kg)' },
    { th: 'ส่วนสูง (cm)', en: 'Height (cm)' },
    { th: 'สูตรคำนวณ (เลือกที่จะใช้กับ dosing)', en: 'Calculation Formula (select for dosing use)' },
    { th: 'เลือกยาเพื่อดู Renal Dosing', en: 'Select drug to view Renal Dosing' },
    // GFR stage labels
    { th: 'ลดลงเล็กน้อย-ปานกลาง', en: 'Mildly-moderately decreased' },
    { th: 'ลดลงปานกลาง-มาก', en: 'Moderately-severely decreased' },
    { th: 'ลดลงเล็กน้อย', en: 'Mildly decreased' },
    { th: 'ลดลงมาก', en: 'Severely decreased' },
    { th: 'ปกติ/สูง', en: 'Normal/High' },
    { th: 'ไตวายระยะสุดท้าย', en: 'End-stage renal disease' },
    { th: 'ไตวาย', en: 'Kidney failure' },
    // Renal warnings
    { th: 'ไม่เหมาะสำหรับผู้ป่วยเด็ก', en: 'not suitable for pediatric patients' },
    { th: 'ระบบจะใช้ Schwartz equation อัตโนมัติ', en: 'system will use Schwartz equation automatically' },
    { th: 'ระบบปรับใช้ ABW', en: 'System applies ABW' },
    { th: 'อัตโนมัติ', en: 'automatically' },
    { th: 'น้ำหนักจริงต่ำกว่า IBW', en: 'Actual weight below IBW' },
    { th: 'ไม่พบยาที่ค้นหา', en: 'No drugs found' },
    { th: 'ยาส่วนใหญ่ต้องปรับขนาดอย่างมาก', en: 'most drugs require significant dose adjustment' },
    { th: 'ต้องปรับขนาดยาส่วนใหญ่', en: 'most drugs require dose adjustment' },
    { th: 'ยาหลายตัวต้องปรับ dose/interval', en: 'many drugs require dose/interval adjustment' },
    { th: 'อาจต้องเพิ่มขนาดยา', en: 'may need to increase drug dose' },
    { th: 'อาจ overestimate จาก low muscle mass', en: 'may overestimate from low muscle mass' },
    { th: 'แต่ practice นี้ controversial และไม่ evidence-based', en: 'but this practice is controversial and not evidence-based' },
    { th: 'บาง clinician round SCr ขึ้นเป็น 1.0', en: 'Some clinicians round SCr up to 1.0' },
    { th: 'แนะนำ: ใช้ CKD-EPI 2021 แทน CG', en: 'Recommendation: use CKD-EPI 2021 instead of CG' },

    // ── Compatibility page ──
    { th: 'กรุณาเลือกยาคนละตัว', en: 'Please select different drugs' },
    { th: 'พิมพ์ชื่อยาเพื่อเพิ่ม', en: 'Type drug name to add' },

    // ── Drug data: Storage conditions (complete phrases) ──
    { th: 'เก็บ RT ห้ามแช่เย็น', en: 'Store at RT, do not refrigerate' },
    { th: 'เก็บ RT, protect from light, ห้ามแช่เย็น', en: 'Store at RT, protect from light, do not refrigerate' },
    { th: 'เก็บ RT, ห้าม freeze', en: 'Store at RT, do not freeze' },
    { th: 'เก็บ RT, protect from light', en: 'Store at RT, protect from light' },
    { th: 'เก็บ 2–8°C, ห้าม freeze', en: 'Store 2–8°C, do not freeze' },
    { th: 'เก็บ 2–8°C, protect from light', en: 'Store 2–8°C, protect from light' },
    { th: 'เก็บ 2–25°C, protect from light', en: 'Store 2–25°C, protect from light' },
    { th: 'เก็บ vial RT, protect from light', en: 'Store vial at RT, protect from light' },
    { th: 'เก็บ vial RT, ห้าม aluminum', en: 'Store vial at RT, avoid aluminum' },
    { th: 'เก็บ vial ที่ 2–25°C', en: 'Store vial at 2–25°C' },
    { th: 'เก็บ vial ที่ 2–8°C', en: 'Store vial at 2–8°C' },
    { th: 'เก็บ vial ที่ RT, ป้องกันแสง', en: 'Store vial at RT, protect from light' },
    { th: 'เก็บ vial ที่ RT', en: 'Store vial at RT' },
    { th: 'เก็บ 2–25°C', en: 'Store 2–25°C' },
    { th: 'เก็บ 2–8°C', en: 'Store 2–8°C' },
    { th: 'เก็บ vial RT', en: 'Store vial at RT' },
    { th: 'เก็บ RT', en: 'Store at RT' },
    { th: 'เก็บแยกจากยาอื่น', en: 'Store separately from other drugs' },
    { th: 'ที่อุณหภูมิต่ำ', en: 'at low temperature' },

    // ── Drug data: Administration instructions ──
    { th: 'IV infusion เท่านั้น', en: 'IV infusion only' },
    { th: 'IV push เท่านั้น', en: 'IV push only' },
    { th: 'Dedicated line เท่านั้น', en: 'Dedicated line only' },
    { th: 'ห้าม IV push', en: 'Do NOT give IV push' },
    { th: 'ห้าม IV push, IM, SC', en: 'Do NOT give IV push, IM, SC' },
    { th: 'ห้าม IM', en: 'Do NOT give IM' },
    { th: 'ห้าม SC', en: 'Do NOT give SC' },
    { th: 'ห้ามผสมกับยาอื่น', en: 'Do not mix with other drugs' },
    { th: 'ห้ามผสมใน', en: 'Do not mix in' },

    // ── Drug data: Dilution ──
    { th: 'NSS หรือ D5W', en: 'NSS or D5W' },
    { th: 'D5W เท่านั้น', en: 'D5W only' },
    { th: 'NSS เท่านั้น', en: 'NSS only' },
    { th: 'ไม่ต้องเจือจางเพิ่ม', en: 'No additional dilution needed' },
    { th: 'ไม่ต้องเจือจาง', en: 'No dilution needed' },

    // ── Drug data: Stability ──
    { th: 'ใช้ทันทีหลังเปิด', en: 'Use immediately after opening' },
    { th: 'ใช้ทันที (no preservative)', en: 'Use immediately (no preservative)' },
    { th: 'ใช้ทันที', en: 'Use immediately' },
    { th: 'ใช้ภายใน', en: 'Use within' },
    { th: 'ป้องกันแสง', en: 'protect from light' },
    { th: 'หลังเปิด', en: 'after opening' },
    { th: 'หลัง reconst', en: 'after reconstitution' },
    { th: 'หลัง dilute', en: 'after dilution' },
    { th: 'หลัง thaw', en: 'after thaw' },

    // ── Drug data: Precaution phrases ──
    { th: 'ห้ามเขย่า', en: 'Do not shake' },
    { th: 'ห้าม freeze', en: 'Do not freeze' },
    { th: 'ห้ามแช่เย็น', en: 'Do not refrigerate' },
    { th: 'ห้ามให้เร็วกว่า', en: 'Do not administer faster than' },
    { th: 'ห้ามสับสนกับ', en: 'Do not confuse with' },
    { th: 'ห้ามใช้ร่วม', en: 'Do not use together with' },
    { th: 'ห้ามให้ทาง', en: 'Do not give via' },
    { th: 'ห้ามผสม', en: 'Do not mix' },
    { th: 'ห้ามใช้', en: 'Do not use' },
    { th: 'ห้ามหยุดยาทันที', en: 'Do not stop drug abruptly' },
    { th: 'ห้ามให้', en: 'Do not give' },
    { th: 'ไม่ต้องปรับขนาดตามไต', en: 'No renal dose adjustment needed' },
    { th: 'ไม่ต้องปรับตามไต', en: 'No renal adjustment needed' },
    { th: 'ไม่ต้องปรับขนาด', en: 'No dose adjustment needed' },
    { th: 'ไม่ต้องปรับ', en: 'No adjustment needed' },
    { th: 'ไม่เกิน', en: 'not exceeding' },
    { th: 'ไม่แนะนำ', en: 'Not recommended' },

    // ── Drug data: Clinical phrases ──
    { th: 'ตรวจ platelet ก่อน', en: 'Check platelet before' },
    { th: 'เตรียม crash cart', en: 'Prepare crash cart' },
    { th: 'เตรียม platelet', en: 'Prepare platelet' },
    { th: 'ต้องให้เร็วมาก', en: 'must administer very rapidly' },
    { th: 'Bleeding risk สูง', en: 'Bleeding risk high' },
    { th: 'Flush NSS ก่อน-หลัง', en: 'Flush NSS before and after' },
    { th: 'Flush D5W ก่อน/หลัง', en: 'Flush D5W before/after' },
    { th: 'เจาะ trough ก่อน dose ที่ 4', en: 'Draw trough before dose #4' },
    { th: 'เจาะ baseline', en: 'Draw baseline' },
    { th: 'ผ่าน 0.2-0.22 μm filter', en: 'via 0.2-0.22 μm filter' },
    { th: 'ให้ช้าๆ', en: 'Administer slowly' },
    { th: 'ให้ทันทีหลังผสม', en: 'Give immediately after mixing' },
    { th: 'ลด dose', en: 'reduce dose' },
    { th: 'ระวังใน MG', en: 'Caution in MG' },

    // ── Drug data: Solvent ──
    { th: 'NSS (preferred)', en: 'NSS (preferred)' },
    { th: 'ได้แต่ monitor BG', en: 'possible but monitor BG' },

    // ── Dashboard ──
    { th: '⭐ ความพึงพอใจโดยรวม', en: '⭐ Overall Satisfaction' },
    { th: '✅ ข้อมูลถูกต้อง ครบถ้วน เชื่อถือได้', en: '✅ Information accurate, complete, reliable' },
    { th: '📦 ใช้ข้อมูล built-in', en: '📦 Using built-in data' },

    // ── Calculator page ──
    { th: 'ผลคำนวณ', en: 'Calculation Results' },
    { th: 'เลือกยา', en: 'Select Drug' },

    // ── Common drug data: mixed Thai/English clinical text ──
    { th: 'TOF monitoring จำเป็น', en: 'TOF monitoring required' },
    { th: 'ถ้าหยุดยา', en: 'if drug is stopped' },
    { th: 'ลด dose)', en: 'reduce dose)' },
    { th: 'หยุด ≥28 d ก่อน/หลัง surgery', en: 'stop ≥28 d before/after surgery' },
    { th: 'ปรับ dose CrCl', en: 'adjust dose for CrCl' },
    { th: 'ห้ามใช้รักษา pneumonia', en: 'Do not use for pneumonia' },
    { th: 'Switch IV→PO เร็วเมื่อทนได้', en: 'Switch IV→PO early when tolerated' },
    { th: 'ไม่หยุด insulin จน AG ปกติ', en: 'do not stop insulin until AG normalized' },
    { th: 'ตาม Thiamine (B1) 100 mg IV ก่อนให้ glucose ในผู้ป่วยเสี่ยง Wernicke', en: 'give Thiamine (B1) 100 mg IV before glucose in Wernicke-risk patients' },
    { th: 'ข้อดีเหนือ Colistin', en: 'Advantages over Colistin' },
    { th: 'ไม่ต้องปรับตาม renal', en: 'no renal adjustment needed' },
    { th: 'ใช้ infusion pump เสมอ', en: 'always use infusion pump' },
    { th: 'ที่ให้ IV ได้', en: 'that can be given IV' },
    { th: 'prime tubing ด้วย insulin solution', en: 'prime tubing with insulin solution' },

    // ── Missing fragments found in testing ──
    { th: 'ที่อุณหภูมิห้อง', en: 'at room temperature' },
    { th: 'อุณหภูมิห้อง', en: 'room temperature' },
    { th: 'ตู้เย็น', en: 'refrigerator' },
    { th: 'ชั่วโมง', en: 'hours' },
    { th: 'สัปดาห์', en: 'weeks' },
    { th: 'เสถียร', en: 'stable' },

    // ── Comprehensive drug data fragments (v2.2 scan) ──
    // Compound phrases — must be in fullPhrases for safe direct replacement
    { th: 'ห้ามผสมกับยาอื่นใน', en: 'Do not mix with other drugs in' },
    { th: 'Compatible กับยาหลายชนิด', en: 'Compatible with many drugs' },
    { th: 'แยก line เมื่อเป็นไปได้', en: 'separate line when possible' },
    { th: 'เมื่อเป็นไปได้', en: 'when possible' },
    { th: 'ห้าม mix กับยาอื่น', en: 'Do not mix with other drugs' },
    { th: 'ห้ามเจือจาง', en: 'Do not dilute' },
    { th: 'ไม่จำเป็นต้องผสม', en: 'No premixing required' },
    { th: 'ปรับขนาดตาม', en: 'Adjust dose per' },
    { th: 'ก่อนเริ่ม', en: 'before starting' },
    { th: 'ก่อนให้', en: 'before giving' },
    { th: 'ต้องใช้', en: 'must use' },
    { th: 'ต้อง dilute ก่อนให้', en: 'must dilute before giving' },
    { th: 'ให้เร็ว', en: 'give rapidly' },
    { th: 'ไม่ต้อง', en: 'no need to' },
    { th: 'ต่ำกว่า', en: 'lower than' },
    { th: 'สูงกว่า', en: 'higher than' },
    { th: 'ทุกชนิด', en: 'all types' },
    { th: 'กับยาอื่น', en: 'with other drugs' },
    { th: 'เด็ดขาด', en: 'absolutely' },
    { th: 'โดยเฉพาะ', en: 'especially' },
    { th: 'ระวังใน', en: 'caution in' },
    { th: 'เดียวกัน', en: 'same' },
    { th: 'กับยาหลายชนิด', en: 'with many drugs' },
    { th: 'ข้อดีเหนือ', en: 'Advantages over' },
    { th: 'ข้อดี:', en: 'Pros:' },
    { th: 'ข้อดี', en: 'Pros' },
    { th: 'ตกตะกอน', en: 'precipitate' },
    { th: 'ใช้ใน:', en: 'Used in:' },
    { th: 'ใช้ใน', en: 'use in' },
    { th: 'แม้ใน', en: 'even in' },
    { th: 'สะสมใน', en: 'accumulates in' },
    { th: 'ทางเลือกที่ดีกว่า:', en: 'Better alternative:' },
    { th: 'ทางเลือก:', en: 'Alternatives:' },
    { th: 'ทางเลือก', en: 'alternative' },
    { th: 'ใช้เฉพาะ', en: 'use only for' },
    { th: 'ไม่ได้ผลถ้าไม่มี', en: 'not effective without' },
    { th: 'แต่อาจต้อง', en: 'but may need to' },
    { th: 'แต่ยัง', en: 'but still' },
    { th: 'อ้างอิงจาก', en: 'Referenced from' },
    { th: 'ประกอบการตัดสินใจทุกครั้ง', en: 'for every clinical decision' },
    { th: 'ประกอบการตัดสินใจ', en: 'for clinical decision' },
    { th: 'ใกล้หัวใจที่สุด', en: 'closest to heart' },
    { th: 'ที่สุด', en: 'most' },
    { th: 'เริ่ม', en: 'start' },
    { th: 'สูงมาก', en: 'very high' },
    { th: 'สูงขึ้น', en: 'higher' },
    { th: 'ไม่ถูก', en: 'not' },
    { th: 'ไม่เพิ่ม', en: 'does not increase' },
    { th: 'ไม่ได้ผล', en: 'not effective' },
    { th: 'ลดลง', en: 'decreased' },
    { th: 'ให้ช้า', en: 'give slowly' },
    { th: 'น้ำหนัก', en: 'weight' },
    { th: 'ห้ามเจาะจาก', en: 'Do not draw from' },

    // ── v2.4 fixes — corruptions & missing fragments from test ──
    // Compound phrases that must be caught BEFORE short patterns
    { th: 'เจือจางใน', en: 'Dilute in' },
    { th: 'ให้ได้ไม่เกิน', en: 'not exceeding' },
    { th: 'ให้ได้ความเข้มข้น', en: 'to a concentration of' },
    { th: 'ให้ได้', en: 'to achieve' },
    { th: 'ให้ใน', en: 'give over' },
    { th: 'ถ้าใช้ร่วมกับ', en: 'if used together with' },
    { th: 'ละลายใน', en: 'Dissolve in' },
    { th: 'ตกตะกอนง่าย', en: 'precipitates easily' },
    { th: 'ในผู้ใหญ่', en: 'in adults' },
    { th: 'ในเด็ก', en: 'in children' },
    { th: 'ค่อยๆ หมุน', en: 'gently rotate' },
    { th: 'ค่อยๆ', en: 'gently' },
    { th: 'หมุน', en: 'rotate' },
    { th: 'ประเมินซ้ำ', en: 'reassess' },
    { th: 'เสี่ยง', en: 'risk of' },
    { th: 'นาที', en: 'minutes' },
    { th: 'ต่ำ', en: 'low' },
  ];

  // ═══════════════════════════════════════════════════════════
  // BOUNDARY-CHECKED PATTERNS
  // Applied only when NOT adjacent to other Thai characters
  // These short words are safe: they only replace when surrounded by non-Thai
  // ═══════════════════════════════════════════════════════════
  var patterns = [
    // ── UI labels ──
    { th: 'เท่านั้น', en: 'only' },
    { th: 'หรือ', en: 'or' },
    { th: 'ถ้ามี', en: 'if available' },
    { th: 'ถ้าจำเป็น', en: 'if necessary' },
    { th: 'ทั้งหมด', en: 'All' },
    { th: 'ข้อมูลยา', en: 'Drug data' },
    { th: 'รายการ', en: 'items' },
    { th: 'เวอร์ชัน', en: 'Version' },
    { th: 'ลบ', en: 'Delete' },
    { th: 'กลับ', en: 'Back' },
    { th: 'กรอง', en: 'Filter' },
    { th: 'ชาย', en: 'Male' },
    { th: 'หญิง', en: 'Female' },
    { th: 'เพศ', en: 'Sex' },
    // ── Time/units ──
    { th: 'ชม.', en: 'hr' },
    { th: 'วัน', en: 'days' },
    // ── Common drug data words ──
    { th: 'ทุก', en: 'every' },
    { th: 'ใน', en: 'in' },
    { th: 'ใช้', en: 'use' },
    { th: 'ถ้า', en: 'if' },
    { th: 'ที่', en: 'at' },
    { th: 'ได้', en: 'can' },
    { th: 'ตาม', en: 'per' },
    { th: 'กับ', en: 'with' },
    { th: 'หลัง', en: 'after' },
    { th: 'ก่อน', en: 'before' },
    { th: 'แยก', en: 'separate' },
    { th: 'ระวัง', en: 'caution' },
    { th: 'สำหรับ', en: 'for' },
    { th: 'สูง', en: 'high' },
    { th: 'เจาะ', en: 'draw' },
    { th: 'เพิ่ม', en: 'increase' },
    { th: 'ปรับ', en: 'adjust' },
    { th: 'แทน', en: 'instead' },
    { th: 'มาก', en: 'very' },
    { th: 'ผ่าน', en: 'via' },
    { th: 'เสมอ', en: 'always' },
    { th: 'ลด', en: 'reduce' },
    { th: 'ห้าม', en: 'Do not' },
    { th: 'เก็บ', en: 'store' },
    { th: 'ไม่', en: 'not' },
    { th: 'ต้อง', en: 'must' },
    { th: 'อาจ', en: 'may' },
    { th: 'จาก', en: 'from' },
    { th: 'ช้าๆ', en: 'slowly' },
    { th: 'ให้', en: 'give' },
    { th: 'เตรียม', en: 'prepare' },
    { th: 'แนะนำ', en: 'recommend' },
    { th: 'แต่', en: 'but' },
    { th: 'เช่น', en: 'e.g.' },
    { th: 'เฉพาะ', en: 'specific' },
    { th: 'อายุ', en: 'age' },
    { th: 'ปี', en: 'years' },
  ];

  // ═══════════════════════════════════════════════════════════
  // PAGE-SPECIFIC HANDLERS
  // ═══════════════════════════════════════════════════════════
  var pages = {

    index: {
      _originals: {},
      apply: function() {
        var self = this;
        var si = document.getElementById('searchInput');
        if (si) { self._originals.sph = si.placeholder; si.placeholder = 'Search drugs... e.g., phenytoin, amiodarone, rt-PA'; }
        var ct = document.getElementById('filterChipText');
        if (ct && ct.textContent.trim() === 'ทั้งหมด') { self._originals.ct = ct.textContent; ct.textContent = 'All'; }
        var at = document.getElementById('filterActiveTag');
        if (at && at.textContent.trim() === 'ทั้งหมด') { self._originals.at = at.textContent; at.textContent = 'All'; }
        var fst = document.querySelector('.filter-sheet-title');
        if (fst && fst.textContent.indexOf('หมวดยา') !== -1) { self._originals.fst = fst.innerHTML; fst.innerHTML = '🏷️ Drug Categories'; }
        var ft = document.getElementById('filterToggle');
        if (ft) { var sp = ft.querySelector('span:first-child'); if (sp && sp.textContent === 'กรอง') { self._originals.ft = sp.textContent; sp.textContent = 'Filter'; } }
        document.querySelectorAll('.filter-btn, .filter-sheet-btn').forEach(function(b) {
          if (b.textContent.trim() === 'ทั้งหมด') { b.setAttribute('data-i18n-btn-orig', b.textContent); b.textContent = 'All'; }
        });
        var vi = document.getElementById('versionInfo');
        if (vi) {
          self._originals.vi = vi.innerHTML;
          vi.innerHTML = vi.innerHTML.replace('เวอร์ชัน', 'Version').replace('มีนาคม 2569 (2026)', 'March 2026').replace('ข้อมูลยา', 'Drug data').replace('รายการ', 'items');
        }
      },
      revert: function() {
        var self = this;
        var si = document.getElementById('searchInput');
        if (si && self._originals.sph) si.placeholder = self._originals.sph;
        var ct = document.getElementById('filterChipText');
        if (ct && self._originals.ct) ct.textContent = self._originals.ct;
        var at = document.getElementById('filterActiveTag');
        if (at && self._originals.at) at.textContent = self._originals.at;
        var fst = document.querySelector('.filter-sheet-title');
        if (fst && self._originals.fst) fst.innerHTML = self._originals.fst;
        var ft = document.getElementById('filterToggle');
        if (ft && self._originals.ft) { var sp = ft.querySelector('span:first-child'); if (sp) sp.textContent = self._originals.ft; }
        var vi = document.getElementById('versionInfo');
        if (vi && self._originals.vi) vi.innerHTML = self._originals.vi;
        document.querySelectorAll('[data-i18n-btn-orig]').forEach(function(b) { b.textContent = b.getAttribute('data-i18n-btn-orig'); b.removeAttribute('data-i18n-btn-orig'); });
        self._originals = {};
      }
    },

    calculator: {
      _originals: {},
      apply: function() {
        document.querySelectorAll('a').forEach(function(a) { if (a.textContent.trim() === '← กลับ') { a.setAttribute('data-i18n-btn-orig', a.textContent); a.textContent = '← Back'; } });
      },
      revert: function() {
        document.querySelectorAll('[data-i18n-btn-orig]').forEach(function(el) { el.textContent = el.getAttribute('data-i18n-btn-orig'); el.removeAttribute('data-i18n-btn-orig'); });
        this._originals = {};
      }
    },

    tdm: {
      _originals: {},
      apply: function() {
        document.querySelectorAll('a').forEach(function(a) { if (a.textContent.trim() === '← กลับ') { a.setAttribute('data-i18n-btn-orig', a.textContent); a.textContent = '← Back'; } });
      },
      revert: function() {
        document.querySelectorAll('[data-i18n-btn-orig]').forEach(function(el) { el.textContent = el.getAttribute('data-i18n-btn-orig'); el.removeAttribute('data-i18n-btn-orig'); });
        this._originals = {};
      }
    },

    renal: {
      _originals: {},
      apply: function() {
        document.querySelectorAll('a').forEach(function(a) { if (a.textContent.trim() === '← กลับ') { a.setAttribute('data-i18n-btn-orig', a.textContent); a.textContent = '← Back'; } });
        document.querySelectorAll('input[placeholder]').forEach(function(inp) { if (/ค้นหา/.test(inp.placeholder)) { inp.setAttribute('data-i18n-ph-orig', inp.placeholder); inp.placeholder = 'Search drug name...'; } });
        document.querySelectorAll('label').forEach(function(lbl) {
          var t = lbl.textContent.trim();
          var m = { 'อายุ (ปี)': 'Age (years)', 'น้ำหนัก (kg)': 'Weight (kg)', 'เพศ': 'Sex', 'ส่วนสูง (cm)': 'Height (cm)' };
          if (m[t]) { lbl.setAttribute('data-i18n-btn-orig', lbl.textContent); lbl.textContent = m[t]; }
          if (t.indexOf('สูตรคำนวณ') !== -1) { lbl.setAttribute('data-i18n-btn-orig', lbl.textContent); lbl.textContent = 'Calculation Formula (select for dosing use)'; }
        });
        document.querySelectorAll('select option').forEach(function(o) {
          if (o.textContent.trim() === 'ชาย') { o.setAttribute('data-i18n-btn-orig', o.textContent); o.textContent = 'Male'; }
          if (o.textContent.trim() === 'หญิง') { o.setAttribute('data-i18n-btn-orig', o.textContent); o.textContent = 'Female'; }
        });
        document.querySelectorAll('button, .tab-btn, .filter-btn').forEach(function(b) {
          if (b.textContent.trim() === 'ทั้งหมด') { b.setAttribute('data-i18n-btn-orig', b.textContent); b.textContent = 'All'; }
        });
        document.querySelectorAll('.section-header').forEach(function(el) {
          if (el.textContent.indexOf('ข้อมูลผู้ป่วย') !== -1) { el.setAttribute('data-i18n-btn-orig', el.innerHTML); el.innerHTML = el.innerHTML.replace('ข้อมูลผู้ป่วย', 'Patient Information'); }
          if (el.textContent.indexOf('เลือกยาเพื่อดู') !== -1) { el.setAttribute('data-i18n-btn-orig', el.innerHTML); el.innerHTML = el.innerHTML.replace('เลือกยาเพื่อดู Renal Dosing', 'Select drug to view Renal Dosing'); }
        });
      },
      revert: function() {
        document.querySelectorAll('[data-i18n-btn-orig]').forEach(function(el) {
          if (['LABEL','OPTION','A','BUTTON'].indexOf(el.tagName) !== -1) el.textContent = el.getAttribute('data-i18n-btn-orig');
          else el.innerHTML = el.getAttribute('data-i18n-btn-orig');
          el.removeAttribute('data-i18n-btn-orig');
        });
        document.querySelectorAll('[data-i18n-ph-orig]').forEach(function(el) { el.placeholder = el.getAttribute('data-i18n-ph-orig'); el.removeAttribute('data-i18n-ph-orig'); });
        this._originals = {};
      }
    },

    compatibility: {
      _originals: {},
      apply: function() {
        document.querySelectorAll('a').forEach(function(a) { if (a.textContent.trim() === '← กลับ') { a.setAttribute('data-i18n-btn-orig', a.textContent); a.textContent = '← Back'; } });
        document.querySelectorAll('input[placeholder]').forEach(function(inp) { if (/พิมพ์ชื่อยา/.test(inp.placeholder)) { inp.setAttribute('data-i18n-ph-orig', inp.placeholder); inp.placeholder = 'Type drug name to add'; } });
      },
      revert: function() {
        document.querySelectorAll('[data-i18n-btn-orig]').forEach(function(el) { el.textContent = el.getAttribute('data-i18n-btn-orig'); el.removeAttribute('data-i18n-btn-orig'); });
        document.querySelectorAll('[data-i18n-ph-orig]').forEach(function(el) { el.placeholder = el.getAttribute('data-i18n-ph-orig'); el.removeAttribute('data-i18n-ph-orig'); });
        this._originals = {};
      }
    },

    dashboard: {
      _originals: {},
      apply: function() {
        var self = this;
        // Helper: store original and replace
        function tr(el, newText, key) {
          if (!el) return;
          if (!self._originals[key]) self._originals[key] = el.textContent;
          el.textContent = newText;
        }
        function trPh(el, newPh, key) {
          if (!el) return;
          if (!self._originals[key]) self._originals[key] = el.placeholder;
          el.placeholder = newPh;
        }

        // Setup banner
        var setupH3 = document.querySelector('.setup-banner h3');
        tr(setupH3, '⚙ Google Apps Script URL Setup', 'setupH3');
        var saveBtn = document.querySelector('.setup-banner button');
        tr(saveBtn, '💾 Save', 'saveBtn');

        // Toolbar labels
        var labels = document.querySelectorAll('.toolbar label');
        labels.forEach(function(lbl) {
          if (lbl.textContent.trim() === '📅 จาก') tr(lbl, '📅 From', 'lblFrom');
          if (lbl.textContent.trim() === 'ถึง') tr(lbl, 'To', 'lblTo');
        });

        // Search placeholder
        var search = document.getElementById('globalSearch');
        trPh(search, '🔍 Search drug / user...', 'search');

        // Clear all filters button
        var clearBtn = document.querySelector('.toolbar .btn.sm');
        if (clearBtn && /ล้างทั้งหมด/.test(clearBtn.textContent)) {
          tr(clearBtn, '✕ Clear All', 'clearBtn');
        }

        // Journey search placeholder
        var jInput = document.getElementById('journeyUid');
        trPh(jInput, 'Type user_id...', 'journeyUid');

        // Status message
        var status = document.getElementById('statusMsg');
        if (status && /กดปุ่ม/.test(status.textContent)) {
          tr(status, 'Press ⚙ URL button to connect Google Sheets', 'statusMsg');
        }

        // SUS empty message
        var susEmpty = document.getElementById('susEmptyMsg');
        if (susEmpty && /ต้องการ/.test(susEmpty.textContent)) {
          tr(susEmpty, '📊 Need SUS data ≥5 responses', 'susEmpty');
        }

        // Card headers with Thai text
        document.querySelectorAll('.card-hd').forEach(function(hd) {
          var t = hd.textContent.trim();
          if (/Top ยาค้นหาบ่อย/.test(t)) tr(hd, '🔍 Top Searched Drugs', 'topDrugs');
          if (/Top ยาดูบ่อย/.test(t)) tr(hd, '👁 Top Viewed Drugs', 'topExpands');
          if (/Filter ใช้บ่อย/.test(t)) tr(hd, '🏷 Most Used Filters', 'topFilters');
        });
      },
      revert: function() {
        var self = this;
        // Restore text content
        var mapping = {
          'setupH3': '.setup-banner h3',
          'saveBtn': '.setup-banner button',
          'clearBtn': null // handled below
        };
        Object.keys(mapping).forEach(function(key) {
          if (!self._originals[key]) return;
          var sel = mapping[key];
          if (sel) {
            var el = document.querySelector(sel);
            if (el) el.textContent = self._originals[key];
          }
        });

        // Restore placeholders
        ['search', 'journeyUid'].forEach(function(key) {
          if (!self._originals[key]) return;
          var el = document.getElementById(key === 'search' ? 'globalSearch' : key);
          if (el) el.placeholder = self._originals[key];
        });

        // Restore labels
        var labels = document.querySelectorAll('.toolbar label');
        labels.forEach(function(lbl) {
          if (lbl.textContent.trim() === '📅 From' && self._originals['lblFrom']) lbl.textContent = self._originals['lblFrom'];
          if (lbl.textContent.trim() === 'To' && self._originals['lblTo']) lbl.textContent = self._originals['lblTo'];
        });

        // Restore status
        var status = document.getElementById('statusMsg');
        if (status && self._originals['statusMsg']) status.textContent = self._originals['statusMsg'];

        // Restore card headers
        document.querySelectorAll('.card-hd').forEach(function(hd) {
          var t = hd.textContent.trim();
          if (/Top Searched/.test(t) && self._originals['topDrugs']) hd.textContent = self._originals['topDrugs'];
          if (/Top Viewed/.test(t) && self._originals['topExpands']) hd.textContent = self._originals['topExpands'];
          if (/Most Used Filters/.test(t) && self._originals['topFilters']) hd.textContent = self._originals['topFilters'];
        });

        this._originals = {};
      }
    }
  };

  return { ui: ui, drugSections: drugSections, fullPhrases: fullPhrases, patterns: patterns, pages: pages };
})();
