(function() {
  'use strict';

  // ====== Drug Definitions ======
  const CALC_DRUGS = [
    {
      id: 'vancomycin', name: 'Vancomycin', sub: '500 mg, 1 g/vial — <a href="tdm.html" style="color:#38bdf8;font-weight:600;">🧬 Bayesian TDM →</a>',
      badges: ['badge-renal'],
      calc: function(pt) {
        const dose_low = Math.round(pt.wt * 15 / 250) * 250;
        const dose_high = Math.round(pt.wt * 20 / 250) * 250;
        const dose = Math.round(pt.wt * 15 / 250) * 250;
        let freq = 'q12h', freqNote = '', dailyDose = 0;
        if (pt.crcl > 80) { freq = 'q8-12h'; freqNote = 'CrCl >80'; dailyDose = dose * 3; }
        else if (pt.crcl > 50) { freq = 'q12h'; freqNote = 'CrCl 50-80'; dailyDose = dose * 2; }
        else if (pt.crcl > 30) { freq = 'q24h'; freqNote = 'CrCl 30-50'; dailyDose = dose; }
        else if (pt.crcl > 10) { freq = 'q24-48h'; freqNote = 'CrCl 10-30'; dailyDose = dose; }
        else { freq = 'q48-72h'; freqNote = 'CrCl <10 / HD'; dailyDose = dose * 0.5; }
        const vol = dose <= 1000 ? 200 : 250;
        const rate_mgmin = 10;
        const infuse_min = Math.ceil(dose / rate_mgmin);
        const rate_mlhr = Math.round(vol / (infuse_min / 60));
        const ke = 0.00083 * pt.crcl + 0.0044;
        const vd = 0.7 * pt.wt;
        const estAUC = dailyDose > 0 ? Math.round(dailyDose / (ke * vd)) : 0;
        let aucNote = '';
        if (estAUC > 0) {
          if (estAUC >= 400 && estAUC <= 600) aucNote = '✅ อยู่ใน target (400-600)';
          else if (estAUC < 400) aucNote = '⚠ ต่ำกว่า target → พิจารณาเพิ่ม dose/frequency';
          else aucNote = '⚠ สูงกว่า target → เสี่ยง nephrotoxicity';
        }
        const renalTable = '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-top:6px;">'
          + '<tr style="background:#e6f1fb;"><th style="padding:4px 6px;text-align:left;border:1px solid #85B7EB;">CrCl (mL/min)</th><th style="padding:4px 6px;border:1px solid #85B7EB;">Interval</th><th style="padding:4px 6px;border:1px solid #85B7EB;">Daily dose</th></tr>'
          + `<tr${pt.crcl>80?' style="background:#dcfce7;font-weight:600;"':''}><td style="padding:4px 6px;border:1px solid #ddd;">>80</td><td style="padding:4px 6px;border:1px solid #ddd;">q8-12h</td><td style="padding:4px 6px;border:1px solid #ddd;">${dose}mg x 2-3/day</td></tr>`
          + `<tr${pt.crcl>50&&pt.crcl<=80?' style="background:#dcfce7;font-weight:600;"':''}><td style="padding:4px 6px;border:1px solid #ddd;">50-80</td><td style="padding:4px 6px;border:1px solid #ddd;">q12h</td><td style="padding:4px 6px;border:1px solid #ddd;">${dose}mg x 2/day</td></tr>`
          + `<tr${pt.crcl>30&&pt.crcl<=50?' style="background:#dcfce7;font-weight:600;"':''}><td style="padding:4px 6px;border:1px solid #ddd;">30-50</td><td style="padding:4px 6px;border:1px solid #ddd;">q24h</td><td style="padding:4px 6px;border:1px solid #ddd;">${dose}mg x 1/day</td></tr>`
          + `<tr${pt.crcl>10&&pt.crcl<=30?' style="background:#fef3c7;font-weight:600;"':''}><td style="padding:4px 6px;border:1px solid #ddd;">10-30</td><td style="padding:4px 6px;border:1px solid #ddd;">q24-48h</td><td style="padding:4px 6px;border:1px solid #ddd;">Re-dose by level</td></tr>`
          + `<tr${pt.crcl<=10?' style="background:#fef2f2;font-weight:600;"':''}><td style="padding:4px 6px;border:1px solid #ddd;"><10 / HD</td><td style="padding:4px 6px;border:1px solid #ddd;">q48-72h</td><td style="padding:4px 6px;border:1px solid #ddd;">Re-dose when trough <15-20</td></tr>`
          + '</table>';
        return {
          title: `Vancomycin ${dose} mg IV ${freq}`,
          details: [
            { l: 'Weight-based dose', v: `15-20 mg/kg = ${dose_low}–${dose_high} mg` },
            { l: 'Recommended dose', v: `${dose} mg` },
            { l: 'Frequency', v: `${freq} (${freqNote}, CrCl ${pt.crcl.toFixed(0)} mL/min)` },
            { l: 'Daily total', v: `~${dailyDose} mg/day` },
            { l: 'Dilution', v: `${dose} mg ใน NSS ${vol} mL` },
            { l: 'Max rate', v: `≤${rate_mgmin} mg/min → infuse ≥${infuse_min} min` },
            { l: 'Infusion rate', v: `${rate_mlhr} mL/hr` },
            { l: 'Est. AUC₂₄', v: `~${estAUC} mg·hr/L ${aucNote}` },
          ],
          info: `<strong>📋 Renal dose adjustment (CrCl ${pt.crcl.toFixed(0)}):</strong>${renalTable}<br><strong>TDM:</strong> AUC/MIC target 400-600 (preferred) | Trough 15-20 mcg/mL (ถ้าไม่มี AUC)<br>เจาะ trough ก่อน dose ที่ 4 (steady state)<br><a href="tdm.html" style="color:#38bdf8;font-weight:700;">🧬 ใช้ Bayesian TDM Hub สำหรับ AUC-guided dosing →</a><br><strong>Monitor:</strong> SCr daily, CBC, Red Man Syndrome → infuse ≥60 min/g<br><strong>⚠:</strong> ห้ามให้ line เดียวกับ Pip/Tazo (↑nephrotoxicity)<br><strong>HD:</strong> Re-dose 15-25 mg/kg post-HD, เจาะ pre-HD level`,
          infoType: 'blue'
        };
      }
    },
    {
      id: 'amikacin', name: 'Amikacin', sub: '500 mg/2 mL — <a href="tdm.html" style="color:#38bdf8;font-weight:600;">🎯 TDM →</a>',
      badges: ['badge-renal'],
      calc: function(pt) {
        const dose = Math.round(pt.wt * 15);
        const dose_ext = Math.round(pt.wt * 20);
        let freq = 'q24h', freqNote = '';
        if (pt.crcl >= 60) { freq = 'q24h'; }
        else if (pt.crcl >= 40) { freq = 'q36h'; freqNote = 'CrCl 40-60'; }
        else if (pt.crcl >= 20) { freq = 'q48h'; freqNote = 'CrCl 20-40'; }
        else { freq = 'by level'; freqNote = 'CrCl <20 → dose by serum level'; }
        return {
          title: `Amikacin ${dose} mg IV ${freq}`,
          details: [
            { l: 'Conventional dose', v: `15 mg/kg = ${dose} mg q8-12h` },
            { l: 'Extended-interval', v: `15-20 mg/kg = ${dose}–${dose_ext} mg ${freq}` },
            { l: 'Frequency adj', v: freq + (freqNote ? ` (${freqNote})` : '') },
            { l: 'Dilution', v: `ใน NSS/D5W 100-200 mL` },
            { l: 'Infuse over', v: `30-60 min` },
          ],
          info: `<strong>TDM:</strong> Peak 20-35 mcg/mL (extended) | Trough <5 mcg/mL<br><a href="tdm.html" style="color:#38bdf8;font-weight:700;">🎯 ใช้ TDM Hub สำหรับ Hartford nomogram + PK →</a><br><strong>Monitor:</strong> SCr, audiometry, vestibular fn<br><strong>⚠:</strong> ห้ามผสมกับ Beta-lactams ใน syringe/bag เดียวกัน`,
          infoType: 'blue'
        };
      }
    },
    {
      id: 'gentamicin', name: 'Gentamicin', sub: '80 mg/2 mL — <a href="tdm.html" style="color:#38bdf8;font-weight:600;">🎯 TDM →</a>',
      badges: ['badge-renal'],
      calc: function(pt) {
        const dose_conv = (pt.wt * 1.7).toFixed(0);
        const dose_ext = Math.round(pt.wt * 5);
        let freq = 'q24h';
        if (pt.crcl >= 60) freq = 'q24h';
        else if (pt.crcl >= 40) freq = 'q36h';
        else if (pt.crcl >= 20) freq = 'q48h';
        else freq = 'by level';
        return {
          title: `Gentamicin ${dose_ext} mg IV ${freq}`,
          details: [
            { l: 'Conventional', v: `1-1.7 mg/kg q8h = ${dose_conv} mg q8h` },
            { l: 'Extended-interval', v: `5-7 mg/kg q24h = ${dose_ext} mg ${freq}` },
            { l: 'Dilution', v: `ใน NSS/D5W 50-200 mL` },
            { l: 'Infuse over', v: `30-60 min` },
          ],
          info: `<strong>TDM:</strong> Hartford nomogram (extended) หรือ Peak 5-10 / Trough <1<br><a href="tdm.html" style="color:#38bdf8;font-weight:700;">🎯 ใช้ TDM Hub สำหรับ Hartford nomogram + PK →</a><br><strong>Monitor:</strong> SCr daily, audiometry<br><strong>Intrathecal:</strong> 4-8 mg/day (ventriculitis)`,
          infoType: 'blue'
        };
      }
    },
    {
      id: 'colistin', name: 'Colistimethate (CMS)', sub: '150 mg CBA/vial (~2 MIU)',
      badges: ['badge-renal'],
      calc: function(pt) {
        const ibw = pt.sex === 'M' ? 50 + 0.9*(pt.ht-152.4) : 45.5 + 0.9*(pt.ht-152.4);
        const useWt = pt.ht ? (pt.wt > ibw*1.2 ? (ibw + 0.4*(pt.wt - ibw)).toFixed(0) : pt.wt) : pt.wt;
        const loading = 300;
        let maintTotal, maintFreq;
        if (pt.crcl >= 70) { maintTotal = 300; maintFreq = '150 mg CBA q12h'; }
        else if (pt.crcl >= 50) { maintTotal = 230; maintFreq = '115 mg CBA q12h'; }
        else if (pt.crcl >= 30) { maintTotal = 170; maintFreq = '85 mg CBA q12h'; }
        else { maintTotal = 130; maintFreq = '130 mg CBA q24h (or by level)'; }
        return {
          title: `CMS loading ${loading} mg CBA → ${maintFreq}`,
          details: [
            { l: 'Loading dose', v: `300 mg CBA (~9 MIU) IV over 30-60 min` },
            { l: 'Maintenance', v: maintFreq },
            { l: 'Daily total', v: `${maintTotal} mg CBA/day` },
            { l: 'Dilution', v: `ใน NSS/D5W 100-250 mL` },
            { l: 'Infuse over', v: `30-60 min` },
            { l: 'Unit conversion', v: `1 MIU ≈ 33.3 mg CBA ≈ 80 mg CMS` },
          ],
          info: `<strong>⚠ Nephrotoxicity สูง → hydrate well</strong><br><strong>Monitor:</strong> SCr daily, UO, neurotoxicity signs<br><strong>IT/IVT:</strong> 10 mg CBA/day (ventriculitis)<br><strong>Adjust:</strong> ${pt.ht ? `IBW=${ibw.toFixed(0)}kg, adjusted wt=${useWt}kg` : 'ใส่ส่วนสูงเพื่อคำนวณ IBW'}`,
          infoType: 'amber'
        };
      }
    },
    {
      id: 'phenytoin', name: 'Phenytoin loading', sub: '250 mg/5 mL — <a href="tdm.html" style="color:#38bdf8;font-weight:600;">🎯 TDM →</a>',
      badges: ['badge-loading'],
      calc: function(pt) {
        const dose = Math.round(pt.wt * 20);
        const maxRate = pt.age >= 65 ? 25 : 50;
        const infuseMin = Math.ceil(dose / maxRate);
        return {
          title: `Phenytoin ${dose} mg IV loading`,
          details: [
            { l: 'Loading dose', v: `20 mg/kg = ${dose} mg` },
            { l: 'Max rate', v: `≤${maxRate} mg/min ${pt.age >= 65 ? '(สูงอายุ)' : ''}` },
            { l: 'Infuse over', v: `≥${infuseMin} min ใน NSS เท่านั้น!` },
            { l: 'Concentration', v: `≤6.7 mg/mL (dilute ใน NSS 50-100 mL)` },
            { l: 'Filter', v: `ต้องใช้ 0.22 μm in-line filter` },
          ],
          info: `<strong>⚠ ใช้ NSS เท่านั้น! ห้าม D5W → ตกตะกอน!</strong><br><strong>Monitor:</strong> ECG continuous, BP q5-15min, IV site (purple glove)<br><strong>Level:</strong> Total 10-20 mcg/mL | Free 1-2 mcg/mL<br><strong>ตรวจ:</strong> Free phenytoin ถ้า albumin <3.5<br><a href="tdm.html" style="color:#38bdf8;font-weight:700;">🎯 ใช้ TDM Hub สำหรับ Winter-Tozer correction + dose prediction →</a>`,
          infoType: 'red'
        };
      }
    },
    {
      id: 'valproate', name: 'Sodium Valproate loading', sub: '400 mg/4 mL — <a href="tdm.html" style="color:#38bdf8;font-weight:600;">🎯 TDM →</a>',
      badges: ['badge-loading'],
      calc: function(pt) {
        const dose30 = Math.round(pt.wt * 30);
        const dose40 = Math.round(pt.wt * 40);
        const maintRate = (pt.wt * 1.5).toFixed(0);
        return {
          title: `Valproate ${dose30}–${dose40} mg IV loading`,
          details: [
            { l: 'Loading dose', v: `30-40 mg/kg = ${dose30}–${dose40} mg` },
            { l: 'Rate', v: `IV over 15-30 min (max 6 mg/kg/min)` },
            { l: 'Maintenance', v: `1-2 mg/kg/hr = ${maintRate}–${Math.round(pt.wt*2)} mg/hr CI` },
            { l: 'Alternative', v: `IV→PO: 15-20 mg/kg/day div q8-12h` },
          ],
          info: `<strong>⚠ ห้ามใช้ร่วม Meropenem/Carbapenem เด็ดขาด! (ลด VPA 60-100%)</strong><br><strong>Level:</strong> 50-100 mcg/mL (SE: 80-120)<br><strong>Monitor:</strong> LFTs, CBC+Plt, ammonia, amylase<br><strong>CI:</strong> Hepatic disease, pregnancy (Cat X)<br><a href="tdm.html" style="color:#38bdf8;font-weight:700;">🎯 ใช้ TDM Hub สำหรับ free level correction + dose adjustment →</a>`,
          infoType: 'red'
        };
      }
    },
    {
      id: 'levetiracetam', name: 'Levetiracetam loading', sub: '500 mg/5 mL',
      badges: ['badge-loading'],
      calc: function(pt) {
        const dose = Math.round(pt.wt * 60 / 500) * 500;
        const doseMax = Math.min(dose, 4500);
        let maint = '1000-1500 mg IV q12h';
        if (pt.crcl < 30) maint = '250-500 mg IV q12h (CrCl <30)';
        else if (pt.crcl < 50) maint = '500-750 mg IV q12h (CrCl 30-50)';
        else if (pt.crcl < 80) maint = '500-1000 mg IV q12h (CrCl 50-80)';
        return {
          title: `Levetiracetam ${doseMax} mg IV loading`,
          details: [
            { l: 'Loading dose (SE)', v: `60 mg/kg = ${dose} mg (max 4500 mg)` },
            { l: 'Recommended', v: `${doseMax} mg IV over 10-15 min` },
            { l: 'Maintenance', v: maint },
            { l: 'Switch PO', v: `IV ↔ PO 1:1 ratio` },
          ],
          info: `<strong>ข้อดี:</strong> No significant drug interactions, safe ใน hepatic impairment<br><strong>SE:</strong> behavioral (irritability, aggression)<br><strong>Monitor:</strong> Seizure freq, SCr, mood/behavior`,
          infoType: 'blue'
        };
      }
    },
    {
      id: 'alteplase', name: 'Alteplase (rt-PA)', sub: 'Actilyse 50 mg/50 mL',
      badges: ['badge-stroke'],
      calc: function(pt) {
        const totalDose = Math.min(pt.wt * 0.9, 90).toFixed(1);
        const bolus = (totalDose * 0.1).toFixed(1);
        const infusion = (totalDose * 0.9).toFixed(1);
        return {
          title: `Alteplase ${totalDose} mg (stroke protocol)`,
          details: [
            { l: 'Total dose', v: `0.9 mg/kg = ${totalDose} mg (max 90 mg)` },
            { l: '10% bolus', v: `${bolus} mg IV push over 1 min` },
            { l: '90% infusion', v: `${infusion} mg IV infusion over 60 min` },
            { l: 'Concentration', v: `1 mg/mL (reconstituted)` },
          ],
          info: `<strong>⚠ Door-to-needle <60 min!</strong><br><strong>ห้าม:</strong> Heparin/Antiplatelet 24 hr หลังให้<br><strong>BP:</strong> q15min x 2hr → q30min x 6hr → q1h x 16hr<br><strong>CT brain:</strong> 24 hr post-dose<br><strong>เตรียม:</strong> Cryoprecipitate, TXA สำหรับ bleeding`,
          infoType: 'red'
        };
      }
    },
    {
      id: 'tenecteplase', name: 'Tenecteplase', sub: 'Metalyse',
      badges: ['badge-stroke'],
      calc: function(pt) {
        let dose_ami;
        if (pt.wt < 60) dose_ami = 30;
        else if (pt.wt < 70) dose_ami = 35;
        else if (pt.wt < 80) dose_ami = 40;
        else if (pt.wt < 90) dose_ami = 45;
        else dose_ami = 50;
        const dose_stroke = Math.min(pt.wt * 0.25, 25).toFixed(1);
        return {
          title: `Tenecteplase — single IV bolus`,
          details: [
            { l: 'Stroke dose', v: `0.25 mg/kg = ${dose_stroke} mg (max 25 mg)` },
            { l: 'AMI dose', v: `${dose_ami} mg (weight-tiered)` },
            { l: 'Route', v: `Single IV bolus over 5-10 sec` },
            { l: 'Concentration', v: `5 mg/mL (reconstituted)` },
            { l: 'Volume (stroke)', v: `${(dose_stroke / 5).toFixed(1)} mL` },
          ],
          info: `<strong>ข้อดี:</strong> Single bolus → ง่ายกว่า Alteplase<br><strong>Evidence:</strong> TASTE, AcT trials สำหรับ stroke<br><strong>Monitor:</strong> NIHSS, BP q15min, bleeding<br><strong>ห้าม:</strong> Heparin/Antiplatelet 24 hr`,
          infoType: 'blue'
        };
      }
    },
  ];

  // ====== CrCl Calculator ======
  // Patient data, CrCl, IBW/ABW consolidated into IVDrugRef.getPatientFromForm()

  function updateCrCl() {
    // Use core.js patient object — consolidates validation, CrCl, IBW/ABW/BMI
    const pt = IVDrugRef.getPatientFromForm();
    IVDrugRef.renderValidationMessages('validationMessages', pt.validation);

    // Block calculation on hard errors
    if (!pt.validation.allValid) {
      var cv = document.getElementById('crclValue'); if (cv) cv.textContent = '—';
      var bi = document.getElementById('bodyCompInfo'); if (bi) bi.style.display = 'none';
      var cw = document.getElementById('crclWarning'); if (cw) cw.style.display = 'none';
      return;
    }

    const crcl = pt.crcl;
    const isPed = pt.isPediatric;
    const bodyBox = document.getElementById('bodyCompInfo');
    const warn = document.getElementById('crclWarning');
    const crclLabel = document.getElementById('crclLabel');
    const crclValue = document.getElementById('crclValue');

    if (isPed && pt.ht > 0) {
      if (crclLabel) crclLabel.textContent = 'eGFR (Bedside Schwartz):';
      if (crclValue) crclValue.textContent = crcl.toFixed(1) + ' mL/min/1.73m²';
    } else {
      if (crclLabel) crclLabel.textContent = 'CrCl (Cockcroft-Gault):';
      if (crclValue) crclValue.textContent = crcl.toFixed(1) + ' mL/min';
    }

    if (!isPed && pt.ht > 0) {
      const ibw = pt.ibw;
      const bmi = pt.bmi;
      const abw = pt.abw;
      const isObese = pt.isObese;
      const isElderly = pt.age >= 65 && pt.scr < 0.7;
      const crcl_raw = IVDrugRef.calcCG_raw(pt.age, pt.wt, pt.scr, pt.sex);

      if (isObese || isElderly) {
        bodyBox.style.display = 'block';
        var D = IVDrugRef.dom;
        var lines = [
          D('strong', { textContent: '📐 Body Comp:' }),
          ' BMI ' + bmi.toFixed(1) + ' | IBW ' + ibw.toFixed(1) + ' kg | ABW ' + abw.toFixed(1) + ' kg'
        ];
        if (isObese) {
          lines.push(D('br'));
          lines.push(D('strong', { textContent: '⚠ Obesity (TBW>' + Math.round(ibw*1.3) + 'kg):' }));
          lines.push(' CG ปรับใช้ ABW ' + abw.toFixed(1) + ' kg (TBW ' + pt.wt + ' → CrCl overestimate ~' + Math.round(crcl_raw - crcl) + ' mL/min)');
        }
        if (isElderly) {
          if (isObese) lines.push(D('br'));
          lines.push(D('strong', { textContent: '👴 Elderly + SCr ' + pt.scr + ':' }));
          lines.push(' Low SCr อาจ overestimate CrCl จาก low muscle mass — พิจารณาใช้ clinical judgment');
        }
        var box = D('div', { className: 'info-box blue', style: 'font-size:11px;line-height:1.6;' }, lines);
        while (bodyBox.firstChild) bodyBox.removeChild(bodyBox.firstChild);
        bodyBox.appendChild(box);
      } else {
        bodyBox.style.display = 'none';
      }
    } else if (isPed) {
      bodyBox.style.display = 'block';
      var D = IVDrugRef.dom;
      var pedBox;
      if (pt.ht > 0) {
        pedBox = D('div', { className: 'info-box blue', style: 'font-size:11px;' }, [
          D('strong', { textContent: '👶 Pediatric:' }),
          ' ใช้ Bedside Schwartz (0.413 × Ht / SCr) — CG ไม่เหมาะสำหรับเด็ก',
          D('br'),
          '⚠ Dosing guidelines ด้านล่างเป็นของผู้ใหญ่ — กรุณาตรวจสอบ pediatric dosing แยก'
        ]);
      } else {
        pedBox = D('div', { className: 'info-box amber', style: 'font-size:11px;' }, [
          D('strong', { textContent: '👶 Pediatric:' }),
          ' กรุณาใส่ส่วนสูงเพื่อคำนวณ eGFR (Schwartz) — CG ไม่เหมาะสำหรับเด็ก'
        ]);
      }
      while (bodyBox.firstChild) bodyBox.removeChild(bodyBox.firstChild);
      bodyBox.appendChild(pedBox);
    } else {
      bodyBox.style.display = 'none';
    }

    if (crcl < 30) {
      warn.style.display = 'block';
      while (warn.firstChild) warn.removeChild(warn.firstChild);
      warn.appendChild(IVDrugRef.dom('div', { className: 'info-box red' }, [
        IVDrugRef.dom('strong', { textContent: '⚠ CrCl <30 mL/min' }),
        ' — ปรับขนาดยาส่วนใหญ่ ตรวจสอบ renal dosing'
      ]));
    } else if (crcl < 50) {
      warn.style.display = 'block';
      while (warn.firstChild) warn.removeChild(warn.firstChild);
      warn.appendChild(IVDrugRef.dom('div', { className: 'info-box amber' }, [
        IVDrugRef.dom('strong', { textContent: 'CrCl 30-50 mL/min' }),
        ' — ยาบางตัวต้องปรับขนาด/interval'
      ]));
    } else {
      warn.style.display = 'none';
    }
  }

  // ====== Drug Selection ======
  let selectedDrug = null;

  function renderDrugGrid() {
    const grid = document.getElementById('drugGrid');
    grid.innerHTML = CALC_DRUGS.map(d => `
      <div class="drug-card ${selectedDrug === d.id ? 'active' : ''}" data-action="selectDrug" data-id="${d.id}">
        <div class="drug-name">${d.name}</div>
        <div class="drug-sub">${d.sub}</div>
        ${d.badges.map(b => `<span class="badge ${b}">${b.replace('badge-','')}</span>`).join(' ')}
      </div>
    `).join('');
  }

  function selectDrug(id) {
    selectedDrug = id;
    lastSelectedDrugForTracking = CALC_DRUGS.find(d => d.id === id)?.name || null;
    renderDrugGrid();
    calculate();
  }

  function calculate() {
    const sec = document.getElementById('outputSection');
    const body = document.getElementById('outputBody');
    const header = document.getElementById('outputHeader');
    if (!selectedDrug) { sec.style.display = 'none'; return; }

    const drug = CALC_DRUGS.find(d => d.id === selectedDrug);
    if (!drug) return;

    // getPatientFromForm runs validation internally
    const pt = IVDrugRef.getPatientFromForm();
    if (!pt.validation.allValid) { sec.style.display = 'none'; return; }
    const result = drug.calc(pt);

    header.innerHTML = `📊 ${drug.name}`;
    body.innerHTML = `
      <div style="padding:16px;">
        <div class="result-box">
          <div class="result-title">Recommended</div>
          <div class="result-value" style="font-size:20px;">${result.title}</div>
        </div>
        <div style="margin-top:14px;">
          ${result.details.map(d => `<div class="detail-row"><span class="detail-label">${d.l}</span><span class="detail-value">${d.v}</span></div>`).join('')}
        </div>
        <div class="info-box ${result.infoType}" style="margin-top:14px;">${result.info}</div>
      </div>
    `;
    sec.style.display = 'block';
    sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (typeof trackCalcUsage === 'function') {
      trackCalcUsage(drug.name, pt, result);
    }
  }

  // ====== Analytics ======
  const ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec';

  const CALC_SESSION_ID = (() => {
    const today = new Date().toISOString().substring(0, 10);
    let id = localStorage.getItem('anonSessionId');
    let idDate = localStorage.getItem('anonSessionDate');
    if (!id || idDate !== today) {
      id = 'u' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('anonSessionId', id);
      localStorage.setItem('anonSessionDate', today);
    }
    return id;
  })();

  const CALC_USER_ID = (() => {
    let uid = localStorage.getItem('anonUserId');
    if (!uid) {
      uid = 'p' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('anonUserId', uid);
    }
    return uid;
  })();

  let calcReqCount = 0;
  function sendCalcAnalytics(data) {
    if (!ANALYTICS_URL || localStorage.getItem('analyticsConsent') !== 'true') return;
    if (calcReqCount >= 40) return;
    calcReqCount++;
    try {
      const payload = JSON.stringify({ ...data, session_id: CALC_SESSION_ID, user_id: CALC_USER_ID });
      if (navigator.sendBeacon) navigator.sendBeacon(ANALYTICS_URL, payload);
      else fetch(ANALYTICS_URL, { method:'POST', body:payload, keepalive:true }).catch(()=>{});
    } catch(e) {}
  }

  const PAGE_ENTER_TIME = Date.now();
  const FROM_PAGE = (() => {
    const ref = document.referrer || '';
    if (ref.includes('index.html') || ref.endsWith('iv-drugref/')) return 'drugref';
    if (ref.includes('tdm.html')) return 'tdm';
    if (ref.includes('vanco-tdm.html')) return 'vanco-tdm';
    return ref ? 'external' : 'direct';
  })();

  let calcPageViewSent = false;
  function sendCalcPageLeave(){
    if(calcPageViewSent)return;
    calcPageViewSent = true;
    const dur = Math.round((Date.now() - PAGE_ENTER_TIME) / 1000);
    IVDrugRef.sendAnalytics({
      type: 'page_view',
      page: 'calculator',
      action: 'leave',
      duration_sec: dur,
      from_page: FROM_PAGE,
      last_drug_selected: selectedDrug || 'none'
    });
  }

  let lastSelectedDrugForTracking = null;
  const calcTracked = {};

  function trackCalcUsage(drugName, pt, result) {
    if (drugName !== lastSelectedDrugForTracking) return;
    lastSelectedDrugForTracking = null;

    const key = drugName + '_' + Math.floor(Date.now() / 30000);
    if (calcTracked[key]) return;
    calcTracked[key] = true;
    IVDrugRef.sendAnalytics({
      type: 'dose_calc',
      drug_name: drugName,
      weight_kg: pt.wt,
      height_cm: pt.ht || '',
      age: pt.age,
      sex: pt.sex,
      scr: pt.scr,
      crcl: pt.crcl.toFixed(1),
      dose_recommended: result.title,
      details: JSON.stringify(result.details.map(d => d.l + ': ' + d.v))
    });
  }

  // ====== Event Delegation ======
  IVDrugRef.delegate(document, 'click', {
    selectDrug: function(e, t) { if (e.target.closest('a[href]')) return; selectDrug(t.dataset.id); }
  });
  IVDrugRef.delegate(document, 'input', {
    patientInput: function() { updateCrCl(); calculate(); }
  });
  IVDrugRef.delegate(document, 'change', {
    patientInput: function() { updateCrCl(); calculate(); }
  });

  // ====== Init ======
  document.addEventListener('DOMContentLoaded', function() {
    IVDrugRef.trackPageView('calculator');
    IVDrugRef.patientCtx.init();
    updateCrCl();
    renderDrugGrid();
  });

  window.addEventListener('beforeunload', sendCalcPageLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendCalcPageLeave();
  });

})();
