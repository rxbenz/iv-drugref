/**
 * IV DrugRef PWA v5.0 - Renal Dosing Module
 *
 * Page-specific logic for renal-dosing.html
 * - Drug database (RENAL_DRUGS array)
 * - Drug filtering and rendering
 * - Drug recommendation display
 * - Body composition analysis
 * - Renal function-specific calculations and tracking
 *
 * Delegates core calculations (CG, CKD-EPI, Schwartz, CKD staging) to core.js
 */

(function() {
  'use strict';

  // ============================
  // STATE
  // ============================
  let activeFormula = 'cg'; // 'cg' or 'ckd'
  let isPediatric = false;
  let selectedDrug = null;
  let activeFilter = 'all';
  const renalTracked = {};

  // ============================
  // PATIENT DATA (refactored to use core)
  // ============================

  /**
   * Get patient object from form inputs with renal-dosing-specific computed properties
   * Delegates core calculations to IVDrugRef, adds body composition analysis
   */
  function getPatient() {
    const pt = IVDrugRef.getPatientFromForm();

    // Add renal-dosing-specific computed properties
    // Body composition calculations for renal dosing
    const htIn = pt.ht / 2.54; // cm → inches
    const ibw = pt.sex === 'M' ? 50 + 2.3 * (htIn - 60) : 45.5 + 2.3 * (htIn - 60);
    const bmi = pt.wt / ((pt.ht / 100) ** 2);
    const abw = ibw + 0.4 * (pt.wt - ibw);
    const isObese = pt.wt > ibw * 1.3; // ABW >130% IBW
    const isUnderweight = pt.wt < ibw;
    const bsa = IVDrugRef.calcBSA(pt.ht, pt.wt); // Use core BSA calculation

    return {
      ...pt,
      ibw: Math.round(ibw * 10) / 10,
      bmi: Math.round(bmi * 10) / 10,
      abw: Math.round(abw * 10) / 10,
      isObese,
      isUnderweight,
      bsa: bsa
    };
  }

  /**
   * Get active GFR value based on selected formula
   */
  function getActiveGFR() {
    const pt = getPatient();
    if (activeFormula === 'cg') {
      const useWt = pt.isObese ? pt.abw : pt.wt;
      return IVDrugRef.calcCockcroftGault(pt.age, useWt, pt.scr, pt.sex);
    } else {
      // For dosing use non-indexed version if BSA is atypical
      if (pt.bsa > 2.0 || pt.bsa < 1.5) {
        return IVDrugRef.calcCKDEPI2021_nonindexed(pt.age, pt.scr, pt.sex, pt.bsa);
      }
      return IVDrugRef.calcCKDEPI2021(pt.age, pt.scr, pt.sex);
    }
  }

  /**
   * Set active formula and recalculate
   */
  function setFormula(f) {
    if (isPediatric) return; // locked to Schwartz in pediatric mode
    activeFormula = f;
    document.querySelectorAll('.formula-btn').forEach(b => b.classList.remove('active'));
    var activeBtn = document.querySelector(`.formula-btn[data-value="${f}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    var boxCG = document.getElementById('boxCG'); if (boxCG) boxCG.classList.toggle('active', f === 'cg');
    var boxCKD = document.getElementById('boxCKD'); if (boxCKD) boxCKD.classList.toggle('active', f === 'ckd');
    recalc();
  }

  /**
   * Main recalculation function - updates all displays based on patient data
   */
  function recalc() {
    const pt = getPatient();

    // Render validation messages (validation runs inside getPatientFromForm)
    IVDrugRef.renderValidationMessages('validationMessages', pt.validation);

    // Block calculation on hard errors
    if (!pt.validation.allValid) {
      var el;
      el = document.getElementById('valCG'); if (el) el.textContent = '—';
      el = document.getElementById('valCKD'); if (el) el.textContent = '—';
      el = document.getElementById('stageCG'); if (el) el.textContent = '';
      el = document.getElementById('stageCKD'); if (el) el.textContent = '';
      el = document.getElementById('bodyCompBox'); if (el) el.style.display = 'none';
      el = document.getElementById('renalWarning'); if (el) el.textContent = '';
      return;
    }

    isPediatric = pt.age < 18;

    const bodyBox = document.getElementById('bodyCompBox');
    const pedBox = document.getElementById('pediatricBox');
    const formulaSec = document.getElementById('formulaSection');
    const adultSec = document.getElementById('adultResultsSection');

    // ── PEDIATRIC MODE ──
    if (isPediatric) {
      formulaSec.style.display = 'none';
      adultSec.style.display = 'none';
      bodyBox.style.display = 'none';

      const schwartz = IVDrugRef.calcSchwartz(pt.ht, pt.scr);
      const stage = IVDrugRef.getCKDStage(schwartz);
      pedBox.style.display = 'block';
      pedBox.innerHTML = `
        <div class="pediatric-box">
          <div class="title">👶 Pediatric Mode — Bedside Schwartz Equation</div>
          <div class="pediatric-result">
            <div class="val">${schwartz.toFixed(1)}</div>
            <div class="unit">eGFR mL/min/1.73m²</div>
            <div style="margin-top:4px;"><span class="renal-result-stage ${stage.cls}">${stage.stage} ${stage.label}</span></div>
          </div>
          <div class="pediatric-note">
            <strong>สูตร:</strong> eGFR = 0.413 × Height(cm) / SCr<br>
            <strong>ใช้สำหรับ:</strong> ผู้ป่วยอายุ 1–17 ปี (Bedside Schwartz, Schwartz GJ et al. JASN 2009)<br>
            <strong>⚠ ข้อจำกัด:</strong> ไม่แม่นยำใน AKI, muscular/obese children, หรือ neonates
          </div>
          <div class="pediatric-block-msg">
            ⚠ CG และ CKD-EPI ไม่เหมาะสำหรับผู้ป่วยเด็ก — ระบบจะใช้ Schwartz equation อัตโนมัติ<br>
            Renal dosing guidelines ด้านล่างอ้างอิงจากข้อมูลผู้ใหญ่เป็นหลัก — กรุณาตรวจสอบ pediatric dosing แยกต่างหาก
          </div>
        </div>`;

      const warn = document.getElementById('renalWarning');
      warn.innerHTML = schwartz < 30 ? '<div class="info-box red"><strong>⚠ eGFR &lt;30</strong> — ต้องปรับขนาดยาส่วนใหญ่อย่างมากในเด็ก</div>' : '';

      if (selectedDrug) showDrugRecom(selectedDrug);
      return;
    }

    // ── ADULT MODE ──
    pedBox.style.display = 'none';
    formulaSec.style.display = 'block';
    adultSec.style.display = 'block';

    // Calculate values using core functions
    const cg = IVDrugRef.calcCockcroftGault(pt.age, pt.wt, pt.scr, pt.sex, pt.ht);
    const cgRaw = IVDrugRef.calcCG_raw(pt.age, pt.wt, pt.scr, pt.sex);
    const ckdIndexed = IVDrugRef.calcCKDEPI2021(pt.age, pt.scr, pt.sex);
    const ckdNonindexed = IVDrugRef.calcCKDEPI2021_nonindexed(pt.age, pt.scr, pt.sex, pt.bsa);

    // Update CG display — show adjusted label if obese
    const cgLabelEl = document.querySelector('#boxCG .renal-result-label');
    if (cgLabelEl) {
      while (cgLabelEl.firstChild) cgLabelEl.removeChild(cgLabelEl.firstChild);
      if (pt.isObese) {
        cgLabelEl.appendChild(document.createTextNode('CrCl (CG — '));
        cgLabelEl.appendChild(IVDrugRef.dom('span', { style: 'color:#ea580c;font-weight:700;', textContent: 'ABW' }));
        cgLabelEl.appendChild(document.createTextNode(')'));
      } else {
        cgLabelEl.textContent = 'CrCl (Cockcroft-Gault)';
      }
    }
    var valCGEl = document.getElementById('valCG'); if (valCGEl) valCGEl.textContent = cg.toFixed(1);

    // CKD-EPI show non-indexed for dosing
    const ckdLabelEl = document.querySelector('#boxCKD .renal-result-label');
    if (ckdLabelEl) {
      while (ckdLabelEl.firstChild) ckdLabelEl.removeChild(ckdLabelEl.firstChild);
      if (pt.bsa > 2.0 || pt.bsa < 1.5) {
        ckdLabelEl.appendChild(document.createTextNode('eGFR (CKD-EPI — '));
        ckdLabelEl.appendChild(IVDrugRef.dom('span', { style: 'color:#15803d;font-weight:700;', textContent: 'non-indexed' }));
        ckdLabelEl.appendChild(document.createTextNode(')'));
      } else {
        ckdLabelEl.textContent = 'eGFR (CKD-EPI 2021)';
      }
    }
    var showNonindexed = (pt.bsa > 2.0 || pt.bsa < 1.5);
    var valCKDEl = document.getElementById('valCKD'); if (valCKDEl) valCKDEl.textContent = (showNonindexed ? ckdNonindexed : ckdIndexed).toFixed(1);
    var ckdUnitEl = document.querySelector('#boxCKD .renal-result-unit'); if (ckdUnitEl) ckdUnitEl.textContent = showNonindexed ? 'mL/min (non-indexed for dosing)' : 'mL/min/1.73m²';

    const stageCG = IVDrugRef.getCKDStage(cg);
    const stageCKD = IVDrugRef.getCKDStage(ckdIndexed);
    function renderStage(containerId, stage) {
      var el = document.getElementById(containerId);
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(IVDrugRef.dom('span', { className: 'renal-result-stage ' + stage.cls, textContent: stage.stage + ' ' + stage.label }));
    }
    renderStage('stageCG', stageCG);
    renderStage('stageCKD', stageCKD);

    // ── BODY COMPOSITION ANALYSIS ──
    const isElderly = pt.age >= 65 && pt.scr < 0.7;
    let showBodyBox = pt.isObese || pt.isUnderweight || isElderly;

    if (showBodyBox) {
      bodyBox.style.display = 'block';
      let boxClass, title, note, weightTag;

      if (pt.isObese) {
        boxClass = 'obesity';
        title = '⚠️ Obesity Detected (ABW >130% IBW)';
        weightTag = `<span class="weight-used-tag abw">CG ใช้ ABW = ${pt.abw.toFixed(1)} kg</span>`;
        const diff = cgRaw - cg;
        note = `<strong>TBW ${pt.wt} kg → CG(TBW) = ${cgRaw.toFixed(1)} mL/min</strong> (overestimates by ~${diff.toFixed(0)} mL/min)<br>
                ระบบปรับใช้ <strong>ABW = IBW + 0.4×(TBW−IBW) = ${pt.abw.toFixed(1)} kg</strong> อัตโนมัติ<br>
                <em>Ref: Winter MA, et al. Pharmacotherapy 2012; Brown DL, et al. Ann Pharmacother 2013</em>`;
      } else if (pt.isUnderweight) {
        boxClass = 'underweight';
        title = '⚠️ Underweight (TBW < IBW)';
        weightTag = `<span class="weight-used-tag tbw">CG ใช้ TBW = ${pt.wt} kg</span>`;
        note = `น้ำหนักจริงต่ำกว่า IBW → ใช้ actual body weight ใน CG (ไม่ปรับ)<br>
                <em>พิจารณาว่า low muscle mass อาจทำให้ CrCl overestimate ได้</em>`;
      } else if (isElderly) {
        boxClass = 'elderly';
        title = '👴 Elderly + Low SCr Warning';
        weightTag = '';
        note = `อายุ ≥65 ปี + SCr ${pt.scr} mg/dL (<0.7) → CrCl อาจ <strong>overestimate</strong> จาก low muscle mass<br>
                บาง clinician round SCr ขึ้นเป็น 1.0 — <strong>แต่ practice นี้ controversial และไม่ evidence-based</strong><br>
                <strong>แนะนำ:</strong> ใช้ CKD-EPI 2021 แทน CG ในกลุ่มนี้ หรือใช้ clinical judgment<br>
                <em>Ref: KDIGO 2024; Flamant M, et al. Am J Kidney Dis 2012</em>`;
      }

      var D = IVDrugRef.dom;
      function compItem(label, value) {
        return D('div', { className: 'body-comp-item' }, [
          D('div', { className: 'label', textContent: label }),
          D('div', { className: 'value', textContent: value })
        ]);
      }
      var gridEl = D('div', { className: 'body-comp-grid' }, [
        compItem('BMI', pt.bmi.toFixed(1)),
        compItem('IBW', pt.ibw.toFixed(1) + ' kg'),
        compItem('ABW', pt.abw.toFixed(1) + ' kg')
      ]);

      // Weight tag element
      var weightEl = null;
      if (pt.isObese) {
        weightEl = D('span', { className: 'weight-used-tag abw', textContent: 'CG ใช้ ABW = ' + pt.abw.toFixed(1) + ' kg' });
      } else if (pt.isUnderweight) {
        weightEl = D('span', { className: 'weight-used-tag tbw', textContent: 'CG ใช้ TBW = ' + pt.wt + ' kg' });
      }

      // Note element — safe text construction
      var noteEl = D('div', { className: 'body-comp-note' });
      if (pt.isObese) {
        noteEl.appendChild(D('strong', { textContent: 'TBW ' + pt.wt + ' kg → CG(TBW) = ' + cgRaw.toFixed(1) + ' mL/min' }));
        noteEl.appendChild(document.createTextNode(' (overestimates by ~' + (cgRaw - cg).toFixed(0) + ' mL/min)'));
        noteEl.appendChild(D('br'));
        noteEl.appendChild(document.createTextNode('ระบบปรับใช้ '));
        noteEl.appendChild(D('strong', { textContent: 'ABW = IBW + 0.4×(TBW−IBW) = ' + pt.abw.toFixed(1) + ' kg' }));
        noteEl.appendChild(document.createTextNode(' อัตโนมัติ'));
        noteEl.appendChild(D('br'));
        noteEl.appendChild(D('em', { textContent: 'Ref: Winter MA, et al. Pharmacotherapy 2012; Brown DL, et al. Ann Pharmacother 2013' }));
      } else if (pt.isUnderweight) {
        noteEl.appendChild(document.createTextNode('น้ำหนักจริงต่ำกว่า IBW → ใช้ actual body weight ใน CG (ไม่ปรับ)'));
        noteEl.appendChild(D('br'));
        noteEl.appendChild(D('em', { textContent: 'พิจารณาว่า low muscle mass อาจทำให้ CrCl overestimate ได้' }));
      } else if (isElderly) {
        noteEl.appendChild(document.createTextNode('อายุ ≥65 ปี + SCr ' + pt.scr + ' mg/dL (<0.7) → CrCl อาจ '));
        noteEl.appendChild(D('strong', { textContent: 'overestimate' }));
        noteEl.appendChild(document.createTextNode(' จาก low muscle mass'));
        noteEl.appendChild(D('br'));
        noteEl.appendChild(document.createTextNode('บาง clinician round SCr ขึ้นเป็น 1.0 — '));
        noteEl.appendChild(D('strong', { textContent: 'แต่ practice นี้ controversial และไม่ evidence-based' }));
        noteEl.appendChild(D('br'));
        noteEl.appendChild(D('strong', { textContent: 'แนะนำ:' }));
        noteEl.appendChild(document.createTextNode(' ใช้ CKD-EPI 2021 แทน CG ในกลุ่มนี้ หรือใช้ clinical judgment'));
        noteEl.appendChild(D('br'));
        noteEl.appendChild(D('em', { textContent: 'Ref: KDIGO 2024; Flamant M, et al. Am J Kidney Dis 2012' }));
      }

      var compBox = D('div', { className: 'body-comp-box ' + boxClass }, [
        D('div', { className: 'body-comp-title', textContent: title }),
        gridEl
      ]);
      if (weightEl) compBox.appendChild(weightEl);
      compBox.appendChild(noteEl);

      while (bodyBox.firstChild) bodyBox.removeChild(bodyBox.firstChild);
      bodyBox.appendChild(compBox);
    } else {
      bodyBox.style.display = 'none';
    }

    // ── GFR WARNINGS ──
    const gfr = getActiveGFR();
    const warn = document.getElementById('renalWarning');
    while (warn.firstChild) warn.removeChild(warn.firstChild);
    var D = IVDrugRef.dom;

    function addWarnBox(cls, strongText, text, emText) {
      var children = [D('strong', { textContent: strongText }), ' — ' + text];
      if (emText) { children.push(D('br')); children.push(D('em', { textContent: emText })); }
      warn.appendChild(D('div', { className: 'info-box ' + cls }, children));
    }

    if (gfr < 15) {
      addWarnBox('red', '⚠ GFR <15', 'ไตวายระยะสุดท้าย (G5) ยาส่วนใหญ่ต้องปรับขนาดอย่างมาก หรือ contraindicated');
    } else if (gfr < 30) {
      addWarnBox('amber', '⚠ GFR 15–29', 'ต้องปรับขนาดยาส่วนใหญ่ ตรวจสอบ renal dosing ทุกตัว');
    } else if (gfr < 50) {
      addWarnBox('amber', 'GFR 30–49', 'ยาหลายตัวต้องปรับ dose/interval');
    }
    // ARC warning
    if (gfr > 130 && pt.age < 50) {
      addWarnBox('teal', '🔺 Augmented Renal Clearance (ARC)?', 'GFR >130 ในผู้ป่วยอายุน้อย → อาจต้องเพิ่มขนาดยา (เช่น beta-lactams, vancomycin) เพื่อให้ได้ target', 'Ref: Udy AA, et al. Clin Pharmacokinet 2010');
    }

    // Re-render drug recommendation if open
    if (selectedDrug) showDrugRecom(selectedDrug);

    // CDS: Re-render drug list to update contraindication highlighting
    renderDrugList(document.getElementById('drugSearch').value.toLowerCase().trim());
  }

  // ============================
  // DRUG DATABASE
  // ============================

  const RENAL_DRUGS = [
    // ── ANTIBIOTICS ──
    {
      id: 'vancomycin', name: 'Vancomycin', class: 'abx', badges: ['abx','renal','hd'],
      sub: 'Glycopeptide',
      getDosing: function(gfr, pt) {
        const dose = Math.round(pt.wt * 15 / 250) * 250;
        const doseHigh = Math.round(pt.wt * 20 / 250) * 250;
        let rec, freq, css;
        if (gfr > 80) { rec = `${dose}–${doseHigh} mg q8-12h`; freq = 'q8-12h'; css = 'highlight'; }
        else if (gfr > 50) { rec = `${dose} mg q12h`; freq = 'q12h'; css = 'highlight'; }
        else if (gfr > 30) { rec = `${dose} mg q24h`; freq = 'q24h'; css = 'highlight-amber'; }
        else if (gfr > 10) { rec = `${dose} mg q24-48h (re-dose by level)`; freq = 'q24-48h'; css = 'highlight-amber'; }
        else { rec = `${dose} mg q48-72h (re-dose by level)`; freq = 'q48-72h'; css = 'highlight-red'; }
        return {
          recommended: rec,
          table: [
            { range: '>80', dose: `${dose}–${doseHigh} mg`, freq: 'q8-12h', note: 'Normal dosing', hl: gfr > 80 },
            { range: '50–80', dose: `${dose} mg`, freq: 'q12h', note: '', hl: gfr > 50 && gfr <= 80 },
            { range: '30–50', dose: `${dose} mg`, freq: 'q24h', note: '', hl: gfr > 30 && gfr <= 50 },
            { range: '10–30', dose: `${dose} mg`, freq: 'q24-48h', note: 'Re-dose by trough', hlAmber: gfr > 10 && gfr <= 30 },
            { range: '<10 / HD', dose: `${dose} mg`, freq: 'q48-72h', note: 'Re-dose when trough <15-20', hlRed: gfr <= 10 },
          ],
          info: `<strong>TDM:</strong> AUC/MIC 400-600 (preferred) | Trough 15-20 mcg/mL<br>เจาะ trough ก่อน dose ที่ 4<br><strong>HD:</strong> Re-dose 15-25 mg/kg post-HD, เจาะ pre-HD level<br><strong>CRRT:</strong> 15-20 mg/kg loading → 7.5-10 mg/kg q12h (adjust by level)`,
          infoType: 'blue',
          ref: 'Rybak MJ, et al. Am J Health Syst Pharm. 2020;77(11):835-864 | Lexicomp 2024'
        };
      }
    },
    {
      id: 'meropenem', name: 'Meropenem', class: 'abx', badges: ['abx','renal'],
      sub: 'Carbapenem',
      getDosing: function(gfr, pt) {
        let rec;
        if (gfr > 50) rec = '1-2 g q8h (no adjustment)';
        else if (gfr > 25) rec = '1 g q12h';
        else if (gfr > 10) rec = '500 mg–1 g q12h';
        else rec = '500 mg–1 g q24h';
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: '1–2 g', freq: 'q8h', note: 'No adjustment needed', hl: gfr > 50 },
            { range: '26–50', dose: '1 g', freq: 'q12h', note: '', hl: gfr > 25 && gfr <= 50 },
            { range: '10–25', dose: '500 mg–1 g', freq: 'q12h', note: '', hlAmber: gfr > 10 && gfr <= 25 },
            { range: '<10 / HD', dose: '500 mg–1 g', freq: 'q24h', note: 'Give post-HD on HD days', hlRed: gfr <= 10 },
          ],
          info: `<strong>Extended infusion:</strong> 3-4 hr infusion may improve PK/PD target attainment<br><strong>Seizure risk:</strong> ต่ำกว่า Imipenem แต่ยังต้องระวังใน CKD<br><strong>CRRT:</strong> 1 g q8h (CVVH/CVVHD/CVVHDF)`,
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Sanford Guide 2024'
        };
      }
    },
    {
      id: 'imipenem', name: 'Imipenem/Cilastatin', class: 'abx', badges: ['abx','renal'],
      sub: 'Carbapenem',
      getDosing: function(gfr, pt) {
        let rec;
        if (gfr > 70) rec = '500 mg q6h (no adjustment)';
        else if (gfr > 40) rec = '500 mg q8h';
        else if (gfr > 20) rec = '250–500 mg q8-12h';
        else rec = '250 mg q12h';
        return {
          recommended: rec,
          table: [
            { range: '>70', dose: '500 mg', freq: 'q6h', note: 'Normal', hl: gfr > 70 },
            { range: '41–70', dose: '500 mg', freq: 'q8h', note: '', hl: gfr > 40 && gfr <= 70 },
            { range: '21–40', dose: '250–500 mg', freq: 'q8-12h', note: '', hlAmber: gfr > 20 && gfr <= 40 },
            { range: '6–20', dose: '250 mg', freq: 'q12h', note: '', hlAmber: gfr > 6 && gfr <= 20 },
            { range: '<6 / HD', dose: '250 mg', freq: 'q12h', note: 'Supplement post-HD', hlRed: gfr <= 6 },
          ],
          info: `<strong>⚠ Seizure risk สูงขึ้นใน renal impairment</strong> — ห้ามใช้ขนาด >500 mg/dose ถ้า CrCl <70<br><strong>CRRT:</strong> 500 mg q6-8h`,
          infoType: 'amber',
          ref: 'Lexicomp 2024 | Package Insert'
        };
      }
    },
    {
      id: 'ertapenem', name: 'Ertapenem', class: 'abx', badges: ['abx','renal','hd'],
      sub: 'Carbapenem',
      getDosing: function(gfr, pt) {
        let rec;
        if (gfr > 30) rec = '1 g q24h (no adjustment)';
        else rec = '500 mg q24h';
        return {
          recommended: rec,
          table: [
            { range: '>30', dose: '1 g', freq: 'q24h', note: 'No adjustment', hl: gfr > 30 },
            { range: '≤30 / HD', dose: '500 mg', freq: 'q24h', note: 'Give supplement 150 mg post-HD', hlAmber: gfr <= 30 },
          ],
          info: `<strong>HD:</strong> ถ้า dose ≤6 hr ก่อน HD → supplement 150 mg post-HD<br><strong>ไม่แนะนำ</strong>ใน CRRT (ข้อมูลจำกัด)`,
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Sanford Guide 2024'
        };
      }
    },
    {
      id: 'piptazo', name: 'Piperacillin/Tazobactam', class: 'abx', badges: ['abx','renal'],
      sub: 'Beta-lactam/BLI',
      getDosing: function(gfr, pt) {
        let rec;
        if (gfr > 40) rec = '4.5 g q6h (no adjustment)';
        else if (gfr > 20) rec = '3.375 g q6h หรือ 4.5 g q8h';
        else rec = '2.25 g q6h หรือ 4.5 g q12h';
        return {
          recommended: rec,
          table: [
            { range: '>40', dose: '4.5 g', freq: 'q6h', note: 'Normal (EI: 4hr)', hl: gfr > 40 },
            { range: '20–40', dose: '3.375 g q6h หรือ 4.5 g', freq: 'q8h', note: '', hlAmber: gfr > 20 && gfr <= 40 },
            { range: '<20 / HD', dose: '2.25 g q6h หรือ 4.5 g', freq: 'q12h', note: 'Supplement 0.75 g post-HD', hlRed: gfr <= 20 },
          ],
          info: `<strong>Extended infusion:</strong> 4 hr infusion recommended for PK/PD optimization<br><strong>⚠ หลีกเลี่ยงร่วม Vancomycin</strong> → ↑ risk AKI<br><strong>CRRT:</strong> 4.5 g q6-8h`,
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Rhodes NJ, et al. Pharmacotherapy 2015'
        };
      }
    },
    {
      id: 'ceftriaxone', name: 'Ceftriaxone', class: 'abx', badges: ['abx'],
      sub: '3rd gen Cephalosporin',
      getDosing: function(gfr, pt) {
        return {
          recommended: '1–2 g q24h (ไม่ต้องปรับขนาดตามไต)',
          table: [
            { range: 'All GFR', dose: '1–2 g', freq: 'q24h', note: 'ไม่ต้องปรับ (hepatic elimination ~40%)', hl: true },
            { range: 'HD', dose: '1–2 g', freq: 'q24h', note: 'Not dialyzable; no supplement needed', hl: false },
          ],
          info: `<strong>ข้อดี:</strong> No renal dose adjustment needed<br><strong>⚠ Max 2g/day</strong> ใน combined hepatic + renal impairment<br><strong>ห้ามผสม</strong>ใน Ca²⁺-containing solutions (Ringer's, Hartmann's)`,
          infoType: 'teal',
          ref: 'Lexicomp 2024'
        };
      }
    },
    {
      id: 'ceftazidime', name: 'Ceftazidime', class: 'abx', badges: ['abx','renal','hd'],
      sub: '3rd gen Cephalosporin (anti-Pseudomonas)',
      getDosing: function(gfr, pt) {
        let rec;
        if (gfr > 50) rec = '1–2 g q8h';
        else if (gfr > 30) rec = '1 g q12h';
        else if (gfr > 15) rec = '1 g q24h';
        else rec = '500 mg–1 g q24-48h';
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: '1–2 g', freq: 'q8h', note: 'Normal', hl: gfr > 50 },
            { range: '31–50', dose: '1 g', freq: 'q12h', note: '', hl: gfr > 30 && gfr <= 50 },
            { range: '16–30', dose: '1 g', freq: 'q24h', note: '', hlAmber: gfr > 15 && gfr <= 30 },
            { range: '6–15', dose: '500 mg', freq: 'q24h', note: '', hlAmber: gfr > 6 && gfr <= 15 },
            { range: '<6 / HD', dose: '1 g loading → 500 mg', freq: 'q24-48h', note: 'Give post-HD', hlRed: gfr <= 6 },
          ],
          info: `<strong>CRRT:</strong> 1-2 g q8-12h<br><strong>Extended infusion:</strong> อาจพิจารณา 3-4 hr infusion`,
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Sanford Guide 2024'
        };
      }
    },
    {
      id: 'cefepime', name: 'Cefepime', class: 'abx', badges: ['abx','renal'],
      sub: '4th gen Cephalosporin',
      getDosing: function(gfr, pt) {
        let rec;
        if (gfr > 60) rec = '1–2 g q8h';
        else if (gfr > 30) rec = '1–2 g q12h';
        else if (gfr > 10) rec = '1 g q24h';
        else rec = '500 mg–1 g q24h';
        return {
          recommended: rec,
          table: [
            { range: '>60', dose: '1–2 g', freq: 'q8h', note: 'Normal', hl: gfr > 60 },
            { range: '30–60', dose: '1–2 g', freq: 'q12h', note: '', hl: gfr > 30 && gfr <= 60 },
            { range: '11–29', dose: '1 g', freq: 'q24h', note: '', hlAmber: gfr > 10 && gfr <= 29 },
            { range: '≤10 / HD', dose: '500 mg–1 g', freq: 'q24h', note: 'Give post-HD', hlRed: gfr <= 10 },
          ],
          info: `<strong>⚠ Neurotoxicity risk สูงขึ้นมาก</strong>เมื่อไม่ปรับ dose ใน CKD → confusion, seizures, myoclonus<br><strong>CRRT:</strong> 1-2 g q8-12h`,
          infoType: 'amber',
          ref: 'Lexicomp 2024 | Payne LE, et al. Crit Care. 2017;21(1):276'
        };
      }
    },
    {
      id: 'amikacin', name: 'Amikacin', class: 'abx', badges: ['abx','renal','hd'],
      sub: 'Aminoglycoside',
      getDosing: function(gfr, pt) {
        const dose = Math.round(pt.wt * 15);
        let rec;
        if (gfr >= 60) rec = `${dose} mg q24h (extended-interval)`;
        else if (gfr >= 40) rec = `${dose} mg q36h`;
        else if (gfr >= 20) rec = `${dose} mg q48h`;
        else rec = `${dose} mg → re-dose by level`;
        return {
          recommended: rec,
          table: [
            { range: '≥60', dose: `${dose} mg (15 mg/kg)`, freq: 'q24h', note: 'Extended-interval', hl: gfr >= 60 },
            { range: '40–59', dose: `${dose} mg`, freq: 'q36h', note: '', hlAmber: gfr >= 40 && gfr < 60 },
            { range: '20–39', dose: `${dose} mg`, freq: 'q48h', note: '', hlAmber: gfr >= 20 && gfr < 40 },
            { range: '<20 / HD', dose: `${dose} mg`, freq: 'By level', note: 'Re-dose when trough <5', hlRed: gfr < 20 },
          ],
          info: `<strong>TDM:</strong> Peak 20-35 (extended) | Trough <5 mcg/mL<br><strong>Monitor:</strong> SCr, audiometry, vestibular function<br><strong>HD:</strong> Give post-HD, เจาะ level pre-next dose`,
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Nicolau DP, et al. AAC 1995'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // ANTIFUNGALS
    // ════════════════════════════════════════════════════
    {
      id: 'fluconazole', name: 'Fluconazole', class: 'af', badges: ['af','renal'],
      sub: 'Azole',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 50) rec = 'Normal dose (200-400 mg/day)';
        else rec = 'ลด dose 50%';
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: '200-400 mg', freq: 'q24h', note: 'Normal dose', hl: gfr > 50 },
            { range: '≤50 (no HD)', dose: '100-200 mg', freq: 'q24h', note: 'ลด 50%', hlAmber: gfr <= 50 && gfr > 10 },
            { range: '<10 / HD', dose: '100-200 mg', freq: 'q24h post-HD', note: 'ให้หลัง HD', hlRed: gfr <= 10 },
          ],
          info: '<strong>HD:</strong> Fluconazole dialyzable — ให้ dose หลัง HD<br><strong>CRRT:</strong> ให้ normal dose (200-400 mg/day)<br><strong>Monitor:</strong> LFTs, QTc',
          infoType: 'blue',
          ref: 'Lexicomp 2024 | IDSA Candidiasis Guidelines 2016'
        };
      }
    },
    {
      id: 'amphotericin-b', name: 'Amphotericin B (Liposomal)', class: 'af', badges: ['af','nephrotox'],
      sub: 'Polyene',
      getDosing: function(gfr) {
        return {
          recommended: '3-5 mg/kg/day (ไม่ต้องปรับ dose ตาม GFR)',
          table: [
            { range: 'All GFR', dose: '3-5 mg/kg/day', freq: 'q24h', note: 'ไม่ต้องปรับ dose', hl: true },
            { range: 'HD', dose: '3-5 mg/kg/day', freq: 'q24h', note: 'ไม่ถูก dialyze', hl: false },
          ],
          info: '<strong>⚠ Nephrotoxic:</strong> Monitor SCr, K+, Mg++ ทุกวัน<br>Liposomal form มี nephrotoxicity น้อยกว่า conventional<br>Pre-hydrate with NSS 500 mL ก่อนให้ยา<br><strong>CRRT:</strong> ไม่ต้องปรับ dose',
          infoType: 'amber',
          ref: 'Lexicomp 2024 | IDSA Aspergillosis Guidelines 2016'
        };
      }
    },
    {
      id: 'voriconazole', name: 'Voriconazole', class: 'af', badges: ['af','avoid'],
      sub: 'Azole',
      getDosing: function(gfr) {
        return {
          recommended: gfr > 50 ? 'IV: 6 mg/kg q12h x2 → 4 mg/kg q12h' : '⚠ หลีกเลี่ยง IV (SBECD accumulation) → ใช้ PO แทน',
          table: [
            { range: '>50', dose: 'IV: 6→4 mg/kg; PO: 200-300 mg', freq: 'q12h', note: 'Normal', hl: gfr > 50 },
            { range: '≤50', dose: '⚠ PO only: 200-300 mg', freq: 'q12h', note: 'หลีกเลี่ยง IV (SBECD)', hlAmber: gfr <= 50 && gfr > 10 },
            { range: '<10 / HD', dose: 'PO: 200 mg', freq: 'q12h', note: 'PO only', hlRed: gfr <= 10 },
          ],
          info: '<strong>⚠ IV formulation:</strong> มี SBECD (sulfobutylether-β-cyclodextrin) ที่สะสมใน renal impairment<br>ถ้า CrCl ≤50 → เปลี่ยนเป็น PO หรือใช้ liposomal ampho B แทน<br><strong>TDM:</strong> Trough 1-5.5 mcg/mL<br><strong>Monitor:</strong> LFTs, visual disturbances',
          infoType: 'amber',
          ref: 'Lexicomp 2024 | IDSA Aspergillosis Guidelines 2016'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // ANTIVIRALS
    // ════════════════════════════════════════════════════
    {
      id: 'acyclovir', name: 'Acyclovir', class: 'av', badges: ['av','renal','nephrotox'],
      sub: 'Nucleoside Analog',
      getDosing: function(gfr, pt) {
        const dose10 = Math.round(pt.wt * 10);
        let rec;
        if (gfr > 50) rec = `${dose10} mg (10 mg/kg) q8h`;
        else if (gfr > 25) rec = `${dose10} mg q12h`;
        else if (gfr > 10) rec = `${dose10} mg q24h`;
        else rec = `${Math.round(dose10 / 2)} mg q24h`;
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: '10 mg/kg', freq: 'q8h', note: 'HSV encephalitis dose', hl: gfr > 50 },
            { range: '25–50', dose: '10 mg/kg', freq: 'q12h', note: '', hlAmber: gfr > 25 && gfr <= 50 },
            { range: '10–25', dose: '10 mg/kg', freq: 'q24h', note: '', hlAmber: gfr > 10 && gfr <= 25 },
            { range: '<10 / HD', dose: '5 mg/kg', freq: 'q24h + post-HD', note: 'Give dose post-HD', hlRed: gfr <= 10 },
          ],
          info: '<strong>⚠ Nephrotoxic:</strong> Crystalluria risk — hydrate with NSS 1 L ก่อนให้ยา<br>Infuse over ≥1 hour<br><strong>HD:</strong> Give supplemental dose post-HD<br><strong>Monitor:</strong> SCr, urine output, neurological status',
          infoType: 'amber',
          ref: 'Lexicomp 2024 | Red Book 2024'
        };
      }
    },
    {
      id: 'ganciclovir', name: 'Ganciclovir', class: 'av', badges: ['av','renal','hd'],
      sub: 'Nucleoside Analog',
      getDosing: function(gfr) {
        let rec;
        if (gfr >= 70) rec = '5 mg/kg q12h (induction) → 5 mg/kg q24h (maintenance)';
        else if (gfr >= 50) rec = '2.5 mg/kg q12h → 2.5 mg/kg q24h';
        else if (gfr >= 25) rec = '2.5 mg/kg q24h → 1.25 mg/kg q24h';
        else if (gfr >= 10) rec = '1.25 mg/kg q24h → 0.625 mg/kg q24h';
        else rec = '1.25 mg/kg 3x/wk post-HD';
        return {
          recommended: rec,
          table: [
            { range: '≥70', dose: '5 mg/kg', freq: 'q12h / q24h', note: 'Induction / Maintenance', hl: gfr >= 70 },
            { range: '50–69', dose: '2.5 mg/kg', freq: 'q12h / q24h', note: '', hlAmber: gfr >= 50 && gfr < 70 },
            { range: '25–49', dose: '2.5 / 1.25 mg/kg', freq: 'q24h', note: '', hlAmber: gfr >= 25 && gfr < 50 },
            { range: '10–24', dose: '1.25 / 0.625 mg/kg', freq: 'q24h', note: '', hlAmber: gfr >= 10 && gfr < 25 },
            { range: '<10 / HD', dose: '1.25 mg/kg', freq: '3x/wk post-HD', note: '', hlRed: gfr < 10 },
          ],
          info: '<strong>Monitor:</strong> CBC 2-3x/wk (neutropenia risk), SCr<br><strong>HD:</strong> Give post-HD on dialysis days<br><strong>CRRT:</strong> 2.5 mg/kg q12h (induction) → q24h (maintenance)',
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Transplant Infectious Disease Guidelines'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // ANTICOAGULANTS
    // ════════════════════════════════════════════════════
    {
      id: 'enoxaparin', name: 'Enoxaparin', class: 'ac', badges: ['ac','renal'],
      sub: 'LMWH',
      getDosing: function(gfr, pt) {
        const treatDose = Math.round(pt.wt * 1);
        const prophDose = gfr > 30 ? 40 : 30;
        let rec;
        if (gfr > 30) rec = `Treatment: ${treatDose} mg q12h | Prophylaxis: 40 mg q24h`;
        else rec = `Treatment: ${treatDose} mg q24h | Prophylaxis: 30 mg q24h`;
        return {
          recommended: rec,
          table: [
            { range: '>30', dose: `${treatDose} mg (1 mg/kg)`, freq: 'q12h', note: 'Treatment dose', hl: gfr > 30 },
            { range: '>30', dose: '40 mg', freq: 'q24h', note: 'Prophylaxis', hl: gfr > 30 },
            { range: '≤30', dose: `${treatDose} mg (1 mg/kg)`, freq: 'q24h ⚠', note: 'ลด frequency', hlRed: gfr <= 30 },
            { range: '≤30', dose: '30 mg', freq: 'q24h', note: 'Prophylaxis (ลด dose)', hlRed: gfr <= 30 },
          ],
          info: '<strong>⚠ CrCl ≤30:</strong> LMWH สะสมได้ → พิจารณา UFH แทน<br><strong>Monitor:</strong> Anti-Xa level (target 0.5-1.0 IU/mL for treatment)<br><strong>Obesity:</strong> ใช้ actual body weight, cap ที่ 150 mg/dose<br><strong>HD:</strong> หลีกเลี่ยง LMWH → ใช้ UFH',
          infoType: 'amber',
          ref: 'Lexicomp 2024 | CHEST Guidelines 2021'
        };
      }
    },
    {
      id: 'dabigatran', name: 'Dabigatran', class: 'ac', badges: ['ac','renal','avoid'],
      sub: 'DOAC (Direct Thrombin Inhibitor)',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 50) rec = '150 mg BID (AF) | 150 mg BID (VTE treatment)';
        else if (gfr > 30) rec = '110 mg BID (ลด dose)';
        else rec = '⚠ ห้ามใช้ (CrCl <30)';
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: '150 mg', freq: 'BID', note: 'Normal dose', hl: gfr > 50 },
            { range: '30–50', dose: '110 mg', freq: 'BID', note: 'ลด dose (age ≥80, P-gp inhib)', hlAmber: gfr > 30 && gfr <= 50 },
            { range: '<30', dose: '⚠ Contraindicated', freq: '—', note: 'ห้ามใช้', hlRed: gfr <= 30 },
          ],
          info: '<strong>⚠ Renal elimination 80%:</strong> ห้ามใช้ถ้า CrCl <30<br><strong>Drug interaction:</strong> P-gp inhibitors (verapamil, dronedarone) → ลด dose<br><strong>Reversal:</strong> Idarucizumab (Praxbind)<br><strong>HD:</strong> Dialyzable — สามารถ remove ได้ 60% ใน 2-3 ชม.',
          infoType: 'red',
          ref: 'Lexicomp 2024 | ESC AF Guidelines 2024'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // CARDIOVASCULAR
    // ════════════════════════════════════════════════════
    {
      id: 'digoxin', name: 'Digoxin', class: 'cv', badges: ['cv','renal','nephrotox'],
      sub: 'Cardiac Glycoside',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 50) rec = '0.125-0.25 mg/day';
        else if (gfr > 10) rec = '0.0625-0.125 mg/day';
        else rec = '0.0625 mg q48h หรือ by level';
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: '0.125-0.25 mg', freq: 'q24h', note: '', hl: gfr > 50 },
            { range: '10–50', dose: '0.0625-0.125 mg', freq: 'q24h', note: 'ลด dose 50%', hlAmber: gfr > 10 && gfr <= 50 },
            { range: '<10 / HD', dose: '0.0625 mg', freq: 'q48h', note: 'By level', hlRed: gfr <= 10 },
          ],
          info: '<strong>TDM:</strong> Target 0.5-0.9 ng/mL (HF) | 0.8-2.0 (AF)<br><strong>⚠ Toxicity risk:</strong> เพิ่มขึ้นเมื่อ K+ ต่ำ, renal impairment<br><strong>HD:</strong> Not significantly removed<br><strong>Drug interaction:</strong> Amiodarone, verapamil → ลด dose 50%',
          infoType: 'amber',
          ref: 'Lexicomp 2024 | ACC/AHA HF Guidelines 2022'
        };
      }
    },
    {
      id: 'enalapril', name: 'Enalapril', class: 'cv', badges: ['cv','renal'],
      sub: 'ACE Inhibitor',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 30) rec = '2.5-20 mg/day (titrate)';
        else rec = '2.5 mg/day (start low, titrate cautiously)';
        return {
          recommended: rec,
          table: [
            { range: '>30', dose: '2.5-20 mg', freq: 'q12-24h', note: 'Titrate to response', hl: gfr > 30 },
            { range: '10–30', dose: '2.5-5 mg', freq: 'q24h', note: 'Start low', hlAmber: gfr > 10 && gfr <= 30 },
            { range: '<10 / HD', dose: '2.5 mg', freq: 'q24h', note: 'Dialyzable', hlRed: gfr <= 10 },
          ],
          info: '<strong>⚠ Monitor:</strong> K+, SCr (ยอมรับ SCr เพิ่ม ≤30% จาก baseline)<br>ถ้า SCr เพิ่ม >30% หรือ K+ >5.5 → ลด dose หรือหยุด<br><strong>HD:</strong> Give supplemental dose post-HD (20-25% dialyzable)',
          infoType: 'blue',
          ref: 'Lexicomp 2024 | KDIGO CKD Guidelines 2024'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // ANALGESICS
    // ════════════════════════════════════════════════════
    {
      id: 'morphine', name: 'Morphine', class: 'analgesic', badges: ['analgesic','renal','avoid'],
      sub: 'Opioid',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 50) rec = 'Normal dose (titrate to pain)';
        else if (gfr > 15) rec = 'ลด dose 50-75% + เพิ่ม interval';
        else rec = '⚠ หลีกเลี่ยง → เปลี่ยนเป็น fentanyl/hydromorphone';
        return {
          recommended: rec,
          table: [
            { range: '>50', dose: 'Normal dose', freq: 'q4h PRN', note: 'Titrate to pain', hl: gfr > 50 },
            { range: '15–50', dose: 'ลด 50-75%', freq: 'q6-8h', note: 'M6G สะสม', hlAmber: gfr > 15 && gfr <= 50 },
            { range: '<15 / HD', dose: '⚠ หลีกเลี่ยง', freq: '—', note: 'ใช้ fentanyl แทน', hlRed: gfr <= 15 },
          ],
          info: '<strong>⚠ Active metabolite M6G:</strong> สะสมใน renal impairment → respiratory depression, sedation<br><strong>Alternative:</strong> Fentanyl (no active metabolites, ไม่ต้องปรับ dose)<br><strong>HD:</strong> M6G ถูก dialyze ได้บางส่วน แต่ยังเสี่ยง',
          infoType: 'red',
          ref: 'Lexicomp 2024 | Dean M. J Pain Symptom Manage 2004'
        };
      }
    },
    {
      id: 'gabapentin', name: 'Gabapentin', class: 'analgesic', badges: ['analgesic','renal'],
      sub: 'Gabapentinoid',
      getDosing: function(gfr) {
        let rec;
        if (gfr >= 60) rec = '300-1200 mg TID';
        else if (gfr >= 30) rec = '200-700 mg BID';
        else if (gfr >= 15) rec = '100-300 mg daily';
        else rec = '100-300 mg post-HD';
        return {
          recommended: rec,
          table: [
            { range: '≥60', dose: '300-1200 mg', freq: 'TID', note: 'Normal dose', hl: gfr >= 60 },
            { range: '30–59', dose: '200-700 mg', freq: 'BID', note: '', hlAmber: gfr >= 30 && gfr < 60 },
            { range: '15–29', dose: '100-300 mg', freq: 'q24h', note: '', hlAmber: gfr >= 15 && gfr < 30 },
            { range: '<15 / HD', dose: '100-300 mg', freq: 'post-HD', note: 'Supplemental dose after HD', hlRed: gfr < 15 },
          ],
          info: '<strong>100% renal elimination:</strong> ต้องปรับ dose ตาม GFR เสมอ<br><strong>HD:</strong> Dialyzable — ให้ supplemental dose 125-350 mg post-HD<br><strong>Monitor:</strong> Sedation, dizziness, peripheral edema',
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Bockbrader HN, et al. Clin Pharmacokinet 2010'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // NEUROLOGY
    // ════════════════════════════════════════════════════
    {
      id: 'levetiracetam', name: 'Levetiracetam', class: 'neuro', badges: ['neuro','renal','hd'],
      sub: 'Antiepileptic',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 80) rec = '500-1500 mg BID';
        else if (gfr > 50) rec = '500-1000 mg BID';
        else if (gfr > 30) rec = '250-750 mg BID';
        else rec = '250-500 mg BID + supplement post-HD';
        return {
          recommended: rec,
          table: [
            { range: '>80', dose: '500-1500 mg', freq: 'q12h', note: 'Normal dose', hl: gfr > 80 },
            { range: '50–80', dose: '500-1000 mg', freq: 'q12h', note: '', hl: gfr > 50 && gfr <= 80 },
            { range: '30–50', dose: '250-750 mg', freq: 'q12h', note: '', hlAmber: gfr > 30 && gfr <= 50 },
            { range: '<30 / HD', dose: '250-500 mg', freq: 'q12h', note: 'Supplement 250-500 mg post-HD', hlRed: gfr <= 30 },
          ],
          info: '<strong>66% renal elimination:</strong> ต้องปรับ dose ตาม GFR<br><strong>HD:</strong> Dialyzable ~50% — ให้ supplemental dose 250-500 mg post-HD<br><strong>CRRT:</strong> 250-750 mg q12h<br><strong>IV ↔ PO:</strong> 1:1 conversion',
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Epilepsia 2006'
        };
      }
    },
    {
      id: 'phenobarbital', name: 'Phenobarbital', class: 'neuro', badges: ['neuro','hd'],
      sub: 'Barbiturate',
      getDosing: function(gfr) {
        return {
          recommended: gfr > 10 ? '60-180 mg/day (ไม่ต้องปรับ dose แต่ระวัง sedation)' : 'Normal dose + supplement post-HD',
          table: [
            { range: '>10', dose: '60-180 mg', freq: 'q24h', note: 'ไม่ต้องปรับ (hepatic metabolism)', hl: gfr > 10 },
            { range: '<10 / HD', dose: '60-180 mg', freq: 'q24h', note: 'Supplement post-HD', hlAmber: gfr <= 10 },
          ],
          info: '<strong>Primarily hepatic metabolism</strong> — ไม่ต้องปรับ dose ตาม GFR<br>แต่ active metabolite อาจสะสมใน severe renal impairment → ระวัง sedation<br><strong>HD:</strong> 20-50% dialyzable — give supplement post-HD<br><strong>TDM:</strong> Target 15-40 mcg/mL',
          infoType: 'blue',
          ref: 'Lexicomp 2024 | Winter\'s Basic Clinical Pharmacokinetics'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // CHEMOTHERAPY
    // ════════════════════════════════════════════════════
    {
      id: 'methotrexate', name: 'Methotrexate (High-dose)', class: 'chemo', badges: ['chemo','renal','nephrotox'],
      sub: 'Antimetabolite',
      getDosing: function(gfr) {
        let rec;
        if (gfr >= 60) rec = 'ให้ตาม protocol + aggressive hydration + leucovorin rescue';
        else rec = '⚠ GFR <60 → ลด dose หรือ delay until renal recovery';
        return {
          recommended: rec,
          table: [
            { range: '≥60', dose: 'Per protocol', freq: 'Per protocol', note: 'ต้อง hydrate + alkalinize urine', hl: gfr >= 60 },
            { range: '<60', dose: '⚠ Hold/Reduce', freq: '—', note: 'Delay until GFR ≥60', hlRed: gfr < 60 },
          ],
          info: '<strong>⚠ Nephrotoxic:</strong> MTX precipitates ใน renal tubules<br><strong>Mandatory:</strong> Aggressive hydration (3 L/m²/day) + Urine alkalinization (pH >7)<br><strong>Leucovorin rescue:</strong> ต้องให้ตาม MTX level protocol<br><strong>HD:</strong> High-flux HD หรือ CWHD อาจช่วยลด level ได้<br><strong>Monitor:</strong> MTX level, SCr q6-12h, CBC, LFTs',
          infoType: 'red',
          ref: 'Lexicomp 2024 | NCCN Guidelines | Howard SC, et al. NEJM 2016'
        };
      }
    },
    {
      id: 'cisplatin', name: 'Cisplatin', class: 'chemo', badges: ['chemo','nephrotox'],
      sub: 'Platinum',
      getDosing: function(gfr) {
        let rec;
        if (gfr >= 60) rec = 'ให้ตาม protocol + aggressive hydration';
        else if (gfr >= 45) rec = 'ลด dose 25% + hydration';
        else rec = '⚠ ห้ามใช้ → เปลี่ยนเป็น carboplatin';
        return {
          recommended: rec,
          table: [
            { range: '≥60', dose: 'Per protocol', freq: 'Per cycle', note: 'Pre/post hydration mandatory', hl: gfr >= 60 },
            { range: '45–59', dose: 'ลด 25%', freq: 'Per cycle', note: 'พิจารณา carboplatin', hlAmber: gfr >= 45 && gfr < 60 },
            { range: '<45', dose: '⚠ Contraindicated', freq: '—', note: 'ใช้ carboplatin แทน', hlRed: gfr < 45 },
          ],
          info: '<strong>⚠ Highly nephrotoxic:</strong> Causes dose-dependent tubular injury<br><strong>Mandatory hydration:</strong> NSS 1-2 L pre/post + mannitol<br><strong>Alternative:</strong> Carboplatin (AUC-based, less nephrotoxic)<br><strong>Monitor:</strong> SCr, Mg++, K+, audiometry',
          infoType: 'red',
          ref: 'Lexicomp 2024 | NCCN Guidelines'
        };
      }
    },

    // ════════════════════════════════════════════════════
    // MISCELLANEOUS
    // ════════════════════════════════════════════════════
    {
      id: 'allopurinol', name: 'Allopurinol', class: 'misc', badges: ['misc','renal'],
      sub: 'Xanthine Oxidase Inhibitor',
      getDosing: function(gfr) {
        let rec;
        if (gfr > 60) rec = '100-300 mg/day';
        else if (gfr > 30) rec = '100-200 mg/day';
        else if (gfr > 15) rec = '100 mg/day';
        else rec = '100 mg q48h';
        return {
          recommended: rec,
          table: [
            { range: '>60', dose: '100-300 mg', freq: 'q24h', note: 'Titrate to uric acid <6', hl: gfr > 60 },
            { range: '30–60', dose: '100-200 mg', freq: 'q24h', note: '', hlAmber: gfr > 30 && gfr <= 60 },
            { range: '15–30', dose: '100 mg', freq: 'q24h', note: '', hlAmber: gfr > 15 && gfr <= 30 },
            { range: '<15 / HD', dose: '100 mg', freq: 'q48h', note: 'Post-HD on dialysis days', hlRed: gfr <= 15 },
          ],
          info: '<strong>Active metabolite Oxipurinol:</strong> สะสมใน renal impairment → เสี่ยง hypersensitivity syndrome<br><strong>HLA-B*5801:</strong> Screen ก่อนเริ่มยา (โดยเฉพาะ Thai/Asian) — ลด risk SJS/TEN<br><strong>HD:</strong> Dialyzable — give post-HD<br><strong>Alternative:</strong> Febuxostat (ไม่ต้องปรับ dose)',
          infoType: 'amber',
          ref: 'Lexicomp 2024 | ACR Gout Guidelines 2020'
        };
      }
    },
    {
      id: 'metformin', name: 'Metformin', class: 'misc', badges: ['misc','renal','avoid'],
      sub: 'Biguanide',
      getDosing: function(gfr) {
        let rec;
        if (gfr >= 45) rec = '500-1000 mg BID (max 2000 mg/day)';
        else if (gfr >= 30) rec = '500 mg BID (max 1000 mg/day) ⚠';
        else rec = '⚠ Contraindicated (lactic acidosis risk)';
        return {
          recommended: rec,
          table: [
            { range: '≥45', dose: '500-1000 mg', freq: 'BID', note: 'Normal dose', hl: gfr >= 45 },
            { range: '30–44', dose: '500 mg', freq: 'BID (max 1000)', note: '⚠ ลด dose + monitor', hlAmber: gfr >= 30 && gfr < 45 },
            { range: '<30', dose: '⚠ Contraindicated', freq: '—', note: 'Lactic acidosis risk', hlRed: gfr < 30 },
          ],
          info: '<strong>⚠ Lactic acidosis:</strong> Risk เพิ่มเมื่อ GFR <30<br><strong>GFR 30-44:</strong> ลด dose + ห้ามเริ่มยาใหม่ (ให้ต่อได้ถ้าใช้อยู่แล้ว)<br><strong>Hold:</strong> ก่อน contrast media, surgery, หรือ acute illness<br><strong>HD:</strong> Dialyzable — มี case reports ใช้ HD รักษา metformin-associated lactic acidosis',
          infoType: 'red',
          ref: 'Lexicomp 2024 | KDIGO Diabetes & CKD 2022 | FDA Label 2024'
        };
      }
    }
  ];

  // ============================
  // DRUG FILTERING & RENDERING
  // ============================

  function filterDrugs() {
    const q = document.getElementById('drugSearch').value.toLowerCase().trim();
    renderDrugList(q);
  }

  function filterByClass(cls) {
    activeFilter = cls;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    filterDrugs();
  }

  // CDS: Check if a drug is contraindicated at given GFR
  function isDrugContraindicated(drug, gfr) {
    if (gfr >= 30 || !gfr) return false;
    if (!drug.badges || !drug.badges.includes('avoid')) return false;
    try {
      const pt = getPatient();
      const data = drug.getDosing(gfr, pt);
      const rec = (data.recommended || '').toLowerCase();
      return rec.includes('contraindicated') || rec.includes('ห้ามใช้') ||
             rec.includes('หลีกเลี่ยง') || rec.includes('avoid');
    } catch (e) {
      return true; // conservative: treat as contraindicated if can't check
    }
  }

  function renderDrugList(search = '') {
    const list = document.getElementById('drugList');
    let drugs = RENAL_DRUGS;

    if (activeFilter !== 'all') {
      drugs = drugs.filter(d => d.class === activeFilter);
    }
    if (search) {
      drugs = drugs.filter(d => d.name.toLowerCase().includes(search) || d.sub.toLowerCase().includes(search));
    }

    if (drugs.length === 0) {
      list.innerHTML = '<div class="no-results">ไม่พบยาที่ค้นหา</div>';
      return;
    }

    // CDS: Check for severe CKD
    const gfr = getActiveGFR();
    const isSevereCKD = gfr && gfr < 30;
    let ckdStage = null;
    if (isSevereCKD && typeof IVDrugRef !== 'undefined' && IVDrugRef.getCKDStage) {
      ckdStage = IVDrugRef.getCKDStage(gfr);
    }

    const badgeLabels = {
      abx: 'Antibiotic', af: 'Antifungal', av: 'Antiviral', ac: 'Anticoagulant',
      chemo: 'Chemo', cv: 'Cardiovascular', analgesic: 'Analgesic', neuro: 'Neuro',
      misc: 'Other', renal: 'Renal Adj', hd: 'HD Adj', noadj: 'No Adj',
      avoid: '⚠ Avoid/Caution', nephrotox: 'Nephrotoxic'
    };

    // CDS: CKD stage warning banner
    let bannerHtml = '';
    if (isSevereCKD && ckdStage) {
      const kdigo = (typeof IVDrugRef !== 'undefined' && IVDrugRef.REF_LINKS) ? IVDrugRef.REF_LINKS.kdigo : '#';
      bannerHtml = `<div class="cds-alert danger" style="margin:0 0 10px 0;">
        <div class="cds-alert-title">⚠ CKD Stage ${ckdStage.stage} (GFR ${Math.round(gfr)} mL/min)</div>
        <div class="cds-alert-body">ยาที่แสดงเป็นสีแดงมีข้อห้ามใช้หรือควรหลีกเลี่ยงในผู้ป่วย CKD ระยะนี้</div>
        <div class="cds-alert-ref">📚 <a href="${kdigo}" target="_blank" rel="noopener">KDIGO CKD Guidelines</a></div>
      </div>`;
    }

    list.innerHTML = bannerHtml + drugs.map(d => {
      const contraindicated = isSevereCKD && isDrugContraindicated(d, gfr);
      return `
      <div class="drug-item ${selectedDrug === d.id ? 'active' : ''} ${contraindicated ? 'cds-contraindicated' : ''}" data-action="selectDrug" data-id="${d.id}">
        <div class="drug-item-header">
          <div>
            <div class="drug-item-name">${d.name}</div>
            <div class="drug-item-class">${d.sub}</div>
          </div>
          ${contraindicated ? '<span class="badge badge-had" style="margin-left:auto;font-size:10px;">⚠ CI</span>' : ''}
        </div>
        <div class="drug-item-badges">
          ${d.badges.map(b => `<span class="badge badge-${b}">${badgeLabels[b] || b}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function selectDrug(id) {
    selectedDrug = id;
    renderDrugList(document.getElementById('drugSearch').value.toLowerCase().trim());
    showDrugRecom(id);
    trackRenalDrugSelection(id);
  }

  // ============================
  // DRUG TRACKING & ANALYTICS
  // ============================

  /**
   * Track drug selection for analytics
   * Sends comprehensive patient and dosing data to analytics endpoint
   */
  function trackRenalDrugSelection(id) {
    const key = id + '_' + Math.floor(Date.now() / 30000); // 30s debounce
    if (renalTracked[key]) return;
    renalTracked[key] = true;

    const drug = RENAL_DRUGS.find(d => d.id === id);
    if (!drug) return;

    const pt = getPatient();
    const gfr = getActiveGFR();
    const stage = IVDrugRef.getCKDStage(gfr);
    const data = drug.getDosing(gfr, pt);

    IVDrugRef.sendAnalytics({
      type: 'renal_dosing',
      drug_name: drug.name,
      drug_class: drug.class,
      formula_used: activeFormula === 'cg' ? 'Cockcroft-Gault' : 'CKD-EPI 2021',
      gfr_value: gfr.toFixed(1),
      ckd_stage: stage.stage,
      recommended_dose: data.recommended,
      weight_kg: pt.wt,
      height_cm: pt.ht,
      age: pt.age,
      sex: pt.sex,
      scr: pt.scr
    });
  }

  // ============================
  // DRUG RECOMMENDATION DISPLAY
  // ============================

  function showDrugRecom(id) {
    const drug = RENAL_DRUGS.find(d => d.id === id);
    if (!drug) return;

    const gfr = getActiveGFR();
    const pt = getPatient();
    const data = drug.getDosing(gfr, pt);
    const formulaLabel = activeFormula === 'cg'
      ? `CrCl ${gfr.toFixed(1)} mL/min (CG)`
      : `eGFR ${gfr.toFixed(1)} mL/min/1.73m² (CKD-EPI)`;

    const sec = document.getElementById('recomSection');
    document.getElementById('recomDrugName').textContent = drug.name;

    let tableHTML = `<table class="dose-table">
      <thead><tr><th>GFR Range</th><th>Dose</th><th>Frequency</th><th>Note</th></tr></thead><tbody>`;
    data.table.forEach(r => {
      let cls = '';
      if (r.hl) cls = 'highlight';
      else if (r.hlAmber) cls = 'highlight-amber';
      else if (r.hlRed) cls = 'highlight-red';
      tableHTML += `<tr class="${cls}"><td>${r.range}</td><td>${r.dose}</td><td>${r.freq}</td><td>${r.note}</td></tr>`;
    });
    tableHTML += '</tbody></table>';

    document.getElementById('recomBody').innerHTML = `
      <div class="current-dose-box">
        <div class="current-dose-label">Recommended for ${formulaLabel}</div>
        <div class="current-dose-value">${data.recommended}</div>
      </div>
      <div class="dose-table-wrap">${tableHTML}</div>
      <div class="info-box ${data.infoType}">${data.info}</div>
      <div class="ref-box"><strong>📚 Ref:</strong> ${data.ref}</div>
    `;

    sec.classList.add('visible');
    sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeDrugRecom() {
    selectedDrug = null;
    document.getElementById('recomSection').classList.remove('visible');
    renderDrugList(document.getElementById('drugSearch').value.toLowerCase().trim());
  }

  // ============================
  // PAGE INITIALIZATION
  // ============================

  /**
   * Initialize page on DOMContentLoaded
   * Set up event listeners and initial state
   */
  function init() {
    // Track page view
    IVDrugRef.trackPageView('renal-dosing');

    // Patient context: fill from session, set up auto-save
    IVDrugRef.patientCtx.init();

    // Initial render
    recalc();
    renderDrugList();

    // Set up input listeners for patient parameters
    document.getElementById('ptAge').addEventListener('input', recalc);
    document.getElementById('ptWt').addEventListener('input', recalc);
    document.getElementById('ptHt').addEventListener('input', recalc);
    document.getElementById('ptSex').addEventListener('change', recalc);
    document.getElementById('ptScr').addEventListener('input', recalc);

    // Event delegation — replaces inline onclick/oninput/onchange
    IVDrugRef.delegate(document, 'click', {
      setFormula: function(e, t) { setFormula(t.dataset.value); },
      filterByClass: function(e, t) { filterByClass(t.dataset.value); },
      selectDrug: function(e, t) { selectDrug(t.dataset.id); },
      closeDrugRecom: function() { closeDrugRecom(); }
    });
    IVDrugRef.delegate(document, 'input', {
      recalc: function() { recalc(); },
      filterDrugs: function() { filterDrugs(); }
    });
    IVDrugRef.delegate(document, 'change', {
      recalc: function() { recalc(); }
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
