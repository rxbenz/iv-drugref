(function() {
  'use strict';

  // ====== Drug Definitions ======
  const CALC_DRUGS = [
    {
      id: 'vancomycin', name: 'Vancomycin', sub: '500 mg, 1 g/vial — <a href="tdm.html" style="color:#38bdf8;font-weight:600;">🧬 Bayesian TDM →</a>',
      badges: ['badge-renal'],
      maxDose: { value: 4000, unit: 'mg/day', ref: 'Rybak MJ, et al. ASHP/IDSA/PIDS 2020 Vancomycin Guidelines' },
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
          calculatedDose: dailyDose,
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
      maxDose: { value: 2000, unit: 'mg', ref: 'Lexicomp — Max single loading dose 2000 mg' },
      calc: function(pt) {
        const dose = Math.round(pt.wt * 20);
        const maxRate = pt.age >= 65 ? 25 : 50;
        const infuseMin = Math.ceil(dose / maxRate);
        return {
          calculatedDose: dose,
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
      maxDose: { value: 3000, unit: 'mg', ref: 'Lexicomp — Max loading dose 40 mg/kg (usual max ~3000 mg)' },
      calc: function(pt) {
        const dose30 = Math.round(pt.wt * 30);
        const dose40 = Math.round(pt.wt * 40);
        const maintRate = (pt.wt * 1.5).toFixed(0);
        return {
          calculatedDose: dose40,
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
      maxDose: { value: 4500, unit: 'mg', ref: 'Lexicomp — Max loading dose 4500 mg' },
      calc: function(pt) {
        const dose = Math.round(pt.wt * 60 / 500) * 500;
        const doseMax = Math.min(dose, 4500);
        let maint = '1000-1500 mg IV q12h';
        if (pt.crcl < 30) maint = '250-500 mg IV q12h (CrCl <30)';
        else if (pt.crcl < 50) maint = '500-750 mg IV q12h (CrCl 30-50)';
        else if (pt.crcl < 80) maint = '500-1000 mg IV q12h (CrCl 50-80)';
        return {
          calculatedDose: dose,
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
      maxDose: { value: 90, unit: 'mg', ref: 'AHA/ASA 2019 — Max 90 mg total' },
      calc: function(pt) {
        const totalDose = Math.min(pt.wt * 0.9, 90).toFixed(1);
        const bolus = (totalDose * 0.1).toFixed(1);
        const infusion = (totalDose * 0.9).toFixed(1);
        return {
          calculatedDose: parseFloat((pt.wt * 0.9).toFixed(1)),
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
      maxDose: { value: 25, unit: 'mg (stroke)', ref: 'TASTE/AcT Trials — Max 25 mg for stroke' },
      calc: function(pt) {
        let dose_ami;
        if (pt.wt < 60) dose_ami = 30;
        else if (pt.wt < 70) dose_ami = 35;
        else if (pt.wt < 80) dose_ami = 40;
        else if (pt.wt < 90) dose_ami = 45;
        else dose_ami = 50;
        const dose_stroke = Math.min(pt.wt * 0.25, 25).toFixed(1);
        return {
          calculatedDose: parseFloat((pt.wt * 0.25).toFixed(1)),
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

  // ====== Generic structured dose-rule engine (Phase 1) ======
  // Instead of a bespoke calc(), a drug may declare a structured `doseRule`. The
  // engine computes a per-patient dose from it (weight / flat / BSA basis; single
  // value or [low,high] range; per-dose & per-day caps; rounding) and ALWAYS prints
  // the rule, the assumptions, and the source reference next to the number so the
  // result is verifiable. It runs through the SAME calc(pt) contract + Calculate
  // button, so getPatientFromForm() validation and the pediatric guard already gate
  // it. Adult rules FAIL CLOSED for age <18 (the numbers are adult-specific).
  function _dosesPerDay(interval) {
    var m = /q\s*(\d+(?:\.\d+)?)\s*h/i.exec(interval || '');
    if (m) return 24 / parseFloat(m[1]);
    if (/\b(od|daily|q24h)\b/i.test(interval)) return 1;
    if (/\bbid\b/i.test(interval)) return 2;
    if (/\btid\b/i.test(interval)) return 3;
    if (/\bqid\b/i.test(interval)) return 4;
    return null;
  }
  function _roundStep(v, step) { return step ? Math.round(v / step) * step : Math.round(v * 10) / 10; }
  // Display a milligram amount, switching to grams at >=1000 mg for readability.
  function _fmtAmt(mg) {
    if (mg >= 1000) return (Math.round(mg / 100) / 10) + ' g';
    return (Math.round(mg * 10) / 10) + ' mg';
  }
  function _evalIndication(pt, ind) {
    var doseArr = Array.isArray(ind.dose) ? ind.dose : [ind.dose];
    var wkg = pt.wt, wLabel = 'actual ' + pt.wt + ' kg';
    if (ind.basis === 'weight' && ind.weightBasis === 'ibw') { wkg = pt.ibw || pt.wt; wLabel = 'IBW ' + (pt.ibw || pt.wt) + ' kg'; }
    if (ind.basis === 'weight' && ind.weightBasis === 'abw') { wkg = pt.abw || pt.wt; wLabel = 'ABW ' + (pt.abw || pt.wt) + ' kg'; }
    var unitToMg = ind.unit === 'g' ? 1000 : 1;
    function perDoseMg(d) {
      var amt;
      if (ind.basis === 'weight') amt = d * wkg;            // d = mg/kg
      else if (ind.basis === 'bsa') amt = d * (pt.bsa || 0); // d = mg/m2
      else amt = d * unitToMg;                               // flat: d in mg or g
      if (ind.roundTo) amt = _roundStep(amt, ind.roundTo);
      if (ind.maxPerDose && amt > ind.maxPerDose) amt = ind.maxPerDose;
      return amt;
    }
    var perLo = perDoseMg(doseArr[0]), perHi = perDoseMg(doseArr[doseArr.length - 1]);
    var dpd = _dosesPerDay(ind.interval);
    var dayLo = dpd ? perLo * dpd : null, dayHi = dpd ? perHi * dpd : null, dayCapped = false;
    if (ind.maxPerDay) {
      if (dayLo != null && dayLo > ind.maxPerDay) { dayLo = ind.maxPerDay; dayCapped = true; }
      if (dayHi != null && dayHi > ind.maxPerDay) { dayHi = ind.maxPerDay; dayCapped = true; }
    }
    var perStr = perLo === perHi ? _fmtAmt(perLo) : (_fmtAmt(perLo) + '–' + _fmtAmt(perHi));
    var doseStr = doseArr.length === 1 ? doseArr[0] : (doseArr[0] + '–' + doseArr[doseArr.length - 1]);
    var basisStr = ind.basis === 'weight' ? (doseStr + ' ' + ind.unit + ' × ' + wLabel)
      : ind.basis === 'bsa' ? (doseStr + ' ' + ind.unit + ' × BSA ' + (pt.bsa || 0).toFixed(2) + ' m²')
        : (doseStr + ' ' + ind.unit + ' (fixed)');
    var rows = [{ l: ind.label, v: '<strong>' + perStr + ' ' + ind.interval + '</strong>' },
      { l: '· คิดจาก', v: basisStr }];
    if (dayLo != null) rows.push({ l: '· รวมต่อวัน', v: (dayLo === dayHi ? _fmtAmt(dayLo) : _fmtAmt(dayLo) + '–' + _fmtAmt(dayHi)) + (dayCapped ? ' (ถึงเพดาน max/วัน)' : '') });
    if (ind.maxPerDose) rows.push({ l: '· เพดาน/ครั้ง', v: _fmtAmt(ind.maxPerDose) });
    if (ind.renalAdjust) rows.push({ l: '· ⚠ ปรับตามไต', v: ind.renalAdjust + (pt.crcl != null ? ' (CrCl ปัจจุบัน ' + pt.crcl.toFixed(0) + ')' : '') });
    if (ind.note) rows.push({ l: '· หมายเหตุ', v: ind.note });
    return { perHi: perHi, dayHi: dayHi, rows: rows, titleStr: ind.label + ': ' + perStr + ' ' + ind.interval };
  }
  function _ruleCalc(pt, def) {
    var dr = def.doseRule;
    // Fail closed for pediatrics: these rules encode ADULT doses.
    if (pt.isPediatric) {
      return {
        calculatedDose: 0, title: def.name + ' — ขนาดผู้ใหญ่ (ไม่คำนวณให้เด็ก)',
        details: [{ l: '⚠ อายุ <18 ปี', v: 'กฎนี้เป็นขนาดผู้ใหญ่ — ไม่คำนวณให้สำหรับเด็ก กรุณาใช้ขนาด mg/kg เด็กตามแหล่งอ้างอิง' }],
        info: '<strong>📚 อ้างอิง:</strong> ' + dr.drugRef + '<br>⚠ ขนาดเด็กต่างจากผู้ใหญ่ ต้องคำนวณ/ตรวจสอบแยก',
        infoType: 'amber'
      };
    }
    var allRows = [], primary = null;
    dr.indications.forEach(function (ind, i) {
      var r = _evalIndication(pt, ind);
      if (i === 0) primary = r;
      if (i > 0) allRows.push({ l: '—', v: '' });
      allRows = allRows.concat(r.rows);
    });
    return {
      calculatedDose: primary ? (primary.dayHi || primary.perHi) : 0,
      title: primary ? primary.titleStr : def.name,
      details: allRows,
      info: '<strong>📋 วิธีคิด:</strong> โปรแกรมคูณ/ใส่ค่าตามกฎด้านบนกับค่าคนไข้ที่กรอก<br>'
        + '<strong>สมมติฐาน:</strong> ' + dr.assumptions + '<br>'
        + '<strong>📚 อ้างอิง:</strong> ' + dr.drugRef + '<br>'
        + '⚠ เป็นค่าตั้งต้น ต้องตรวจสอบกับแหล่งอ้างอิง + clinical judgment ทุกครั้ง',
      infoType: 'blue'
    };
  }
  function makeRuleDrug(def) {
    return {
      id: def.id, name: def.name, sub: def.sub || '', badges: def.badges || [],
      maxDose: def.maxDose || null, doseRule: def.doseRule,
      calc: function (pt) { return _ruleCalc(pt, def); }
    };
  }

  // ---- Phase 1 demo drugs (structured doseRule; verified standard ADULT doses) ----
  CALC_DRUGS.push(makeRuleDrug({
    id: 'enoxaparin', name: 'Enoxaparin (treatment)', sub: 'Clexane — SC', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Lexicomp; ASH/CHEST VTE guidelines',
      assumptions: 'ใช้ actual body weight (treatment dose). CrCl <30 ต้องปรับเป็นวันละครั้ง — โปรแกรมยังไม่ปรับตามไตให้อัตโนมัติ. Prophylaxis = 40 mg SC วันละครั้ง (fixed ไม่อิงน้ำหนัก).',
      indications: [
        { label: 'VTE/ACS treatment', basis: 'weight', weightBasis: 'actual', dose: 1, unit: 'mg/kg', interval: 'q12h', renalAdjust: 'CrCl <30 → 1 mg/kg วันละครั้ง' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ceftriaxone', name: 'Ceftriaxone', sub: 'Inj. 1 g, 2 g', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาด flat ผู้ใหญ่ ไตปกติ (ceftriaxone ไม่ต้องปรับตามไตทั่วไป). เด็กใช้ขนาด mg/kg แยกต่างหาก.',
      indications: [
        { label: 'ทั่วไป (most infections)', basis: 'flat', dose: [1, 2], unit: 'g', interval: 'q24h' },
        { label: 'Meningitis', basis: 'flat', dose: 2, unit: 'g', interval: 'q12h', maxPerDay: 4000 }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'acyclovir-hsv', name: 'Acyclovir (HSV encephalitis)', sub: 'Inj. 250 mg', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'IDSA Encephalitis Guidelines; Lexicomp',
      assumptions: 'ใช้ actual body weight; ในคนอ้วนพิจารณาใช้ IBW เพื่อลด nephrotoxicity. ปรับตาม CrCl แยก. Infuse ≥1 ชม. + ให้สารน้ำเพียงพอ.',
      indications: [
        { label: 'HSV encephalitis', basis: 'weight', weightBasis: 'actual', dose: 10, unit: 'mg/kg', interval: 'q8h', renalAdjust: 'ปรับตาม CrCl (เช่น CrCl 25-50 → q12h)', note: 'infuse ≥1 ชม., hydrate' }
      ]
    }
  }));
  // ---- High-use IV antibiotics + paracetamol (standard adult doses, normal renal) ----
  CALC_DRUGS.push(makeRuleDrug({
    id: 'cefepime', name: 'Cefepime', sub: 'Inj. 1 g, 2 g', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. ปรับตาม CrCl แยก (CrCl <60 ลดขนาด/ความถี่). เด็กใช้ mg/kg.',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: [1, 2], unit: 'g', interval: 'q12h' },
        { label: 'รุนแรง / Febrile neutropenia / Pseudomonas', basis: 'flat', dose: 2, unit: 'g', interval: 'q8h', renalAdjust: 'ปรับตาม CrCl <60' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'meropenem', name: 'Meropenem', sub: 'Inj. 1 g', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. ปรับตาม CrCl แยก (CrCl <50). เด็กใช้ mg/kg.',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: 1, unit: 'g', interval: 'q8h', note: '⚠ ห้ามใช้ร่วม valproate (ลดระดับ VPA)' },
        { label: 'Meningitis / รุนแรง / Pseudomonas', basis: 'flat', dose: 2, unit: 'g', interval: 'q8h', renalAdjust: 'ปรับตาม CrCl <50' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'piptazo', name: 'Piperacillin/Tazobactam', sub: 'Inj. 4.5 g', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดคิดเป็น pip/tazo รวม (4.5 g = 4 g + 0.5 g), ผู้ใหญ่ ไตปกติ. ปรับตาม CrCl แยก. พิจารณา extended infusion 4 ชม. ในเชื้อดื้อ.',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: 4.5, unit: 'g', interval: 'q8h' },
        { label: 'Pseudomonas / รุนแรง', basis: 'flat', dose: 4.5, unit: 'g', interval: 'q6h', renalAdjust: 'ปรับตาม CrCl <40' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'cefazolin', name: 'Cefazolin', sub: 'Inj. 1 g', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; ASHP surgical prophylaxis',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. Surgical prophylaxis ให้ภายใน 60 นาทีก่อนผ่า; ≥120 kg → 3 g; redose q4h ถ้าผ่าตัดนาน.',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: [1, 2], unit: 'g', interval: 'q8h' },
        { label: 'Surgical prophylaxis', basis: 'flat', dose: 2, unit: 'g', interval: 'ก่อนผ่าตัด (single)', note: '≥120 kg → 3 g; redose q4h ถ้าผ่านาน' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ceftazidime', name: 'Ceftazidime', sub: 'Inj. 1 g, 2 g', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. ปรับตาม CrCl แยก (CrCl <50). เด็กใช้ mg/kg.',
      indications: [
        { label: 'ทั่วไป / Pseudomonas', basis: 'flat', dose: [1, 2], unit: 'g', interval: 'q8h', renalAdjust: 'ปรับตาม CrCl <50' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'metronidazole', name: 'Metronidazole', sub: 'Inj. 500 mg/100 mL', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่. IV ↔ กิน ขนาดเท่ากัน (1:1). C. difficile รุนแรงใช้ร่วม vancomycin กิน.',
      indications: [
        { label: 'Anaerobic infection', basis: 'flat', dose: 500, unit: 'mg', interval: 'q8h', maxPerDay: 4000 }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'daptomycin', name: 'Daptomycin', sub: 'Inj. 350 mg, 500 mg', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Lexicomp; IDSA MRSA guidelines',
      assumptions: 'ใช้ actual body weight. CrCl <30 หรือฟอกไต → ทุก 48 ชม. ⚠ ห้ามใช้รักษา pneumonia (surfactant ยับยั้งยา). Monitor CPK สัปดาห์ละครั้ง.',
      indications: [
        { label: 'Bacteremia / endocarditis (MRSA)', basis: 'weight', weightBasis: 'actual', dose: 6, unit: 'mg/kg', interval: 'q24h', renalAdjust: 'CrCl <30 → q48h' },
        { label: 'Skin/soft tissue (SSTI)', basis: 'weight', weightBasis: 'actual', dose: 4, unit: 'mg/kg', interval: 'q24h', renalAdjust: 'CrCl <30 → q48h' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'paracetamol-iv', name: 'Paracetamol IV', sub: 'Inj. 10 mg/mL (1 g/100 mL)', badges: [],
    doseRule: {
      drugRef: 'Lexicomp; UpToDate',
      assumptions: 'รวมขนาดจากทุกแหล่ง (กิน/ฉีด/ยาผสม) ห้ามเกิน 4 g/วัน. ผู้มีปัจจัยเสี่ยงตับ (สุรา/ทุพโภชนาการ) ลด ≤2-3 g/วัน. IV infusion over 15 นาที.',
      indications: [
        { label: 'น้ำหนัก ≥50 kg', basis: 'flat', dose: 1, unit: 'g', interval: 'q6h', maxPerDay: 4000 },
        { label: 'น้ำหนัก <50 kg', basis: 'weight', weightBasis: 'actual', dose: 15, unit: 'mg/kg', interval: 'q6h', maxPerDose: 750, note: 'max 75 mg/kg/วัน (≤3.75 g)' }
      ]
    }
  }));
  // ---- Batch 3: more high-use IV anti-infectives (standard adult doses, normal renal) ----
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ampicillin', name: 'Ampicillin', sub: 'Inj. 1 g, 2 g', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาด ampicillin เดี่ยว ผู้ใหญ่ ไตปกติ (ต่างจาก ampicillin/sulbactam). ปรับตาม CrCl แยก. เด็กใช้ mg/kg.',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: [1, 2], unit: 'g', interval: 'q6h' },
        { label: 'Meningitis / Listeria', basis: 'flat', dose: 2, unit: 'g', interval: 'q4h', maxPerDay: 12000 }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'clindamycin', name: 'Clindamycin', sub: 'Inj. 300 mg, 600 mg', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่. ไม่ต้องปรับตามไต. IV ↔ กิน ต่างขนาด. ใช้ขนาดสูง (900 mg) ใน toxin-mediated (necrotizing fasciitis).',
      indications: [
        { label: 'Serious infection', basis: 'flat', dose: [600, 900], unit: 'mg', interval: 'q8h' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'levofloxacin', name: 'Levofloxacin', sub: 'Inj. 500 mg, 750 mg', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. IV ↔ กิน 1:1. ปรับตาม CrCl <50. ⚠ QT prolongation, tendon rupture.',
      indications: [
        { label: 'ทั่วไป (CAP/complicated)', basis: 'flat', dose: 750, unit: 'mg', interval: 'q24h', renalAdjust: 'CrCl <50 ปรับขนาด/ความถี่' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ciprofloxacin', name: 'Ciprofloxacin', sub: 'Inj. 200 mg, 400 mg', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. ปรับตาม CrCl <30. ⚠ QT prolongation, tendon rupture; bioavailability กิน สูง (PO 750 mg ≈ IV 400 mg).',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: 400, unit: 'mg', interval: 'q12h' },
        { label: 'รุนแรง / Pseudomonas', basis: 'flat', dose: 400, unit: 'mg', interval: 'q8h', renalAdjust: 'CrCl <30 ปรับ' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'azithromycin', name: 'Azithromycin IV', sub: 'Inj. 500 mg', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่. ไม่ต้องปรับตามไต. ⚠ QT prolongation. เปลี่ยนเป็นกินเมื่ออาการดีขึ้น.',
      indications: [
        { label: 'ทั่วไป (CAP/severe)', basis: 'flat', dose: 500, unit: 'mg', interval: 'q24h' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'fluconazole', name: 'Fluconazole', sub: 'Inj. 200 mg, 400 mg', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'IDSA Candidiasis Guidelines; Lexicomp',
      assumptions: 'ใช้ actual body weight (candidemia). IV ↔ กิน 1:1. CrCl <50 → ลด maintenance ครึ่งหนึ่ง (loading เท่าเดิม).',
      indications: [
        { label: 'Candidemia — loading (ครั้งเดียว)', basis: 'weight', weightBasis: 'actual', dose: 12, unit: 'mg/kg', interval: 'loading (single)', maxPerDose: 800 },
        { label: 'Candidemia — maintenance', basis: 'weight', weightBasis: 'actual', dose: 6, unit: 'mg/kg', interval: 'q24h', maxPerDose: 400, renalAdjust: 'CrCl <50 → ครึ่งขนาด maintenance' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ganciclovir', name: 'Ganciclovir', sub: 'Inj. 500 mg', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Lexicomp; AST/transplant CMV guidelines',
      assumptions: 'ใช้ actual body weight (คนอ้วนพิจารณา IBW). ปรับตาม CrCl แยก. infuse ≥1 ชม. ⚠ Myelosuppression (monitor CBC), teratogenic.',
      indications: [
        { label: 'Induction (CMV)', basis: 'weight', weightBasis: 'actual', dose: 5, unit: 'mg/kg', interval: 'q12h', renalAdjust: 'ปรับตาม CrCl <70' },
        { label: 'Maintenance', basis: 'weight', weightBasis: 'actual', dose: 5, unit: 'mg/kg', interval: 'q24h', renalAdjust: 'ปรับตาม CrCl <70' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ertapenem', name: 'Ertapenem', sub: 'Inj. 1 g', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่ ไตปกติ. CrCl <30 → 500 mg q24h. ⚠ ไม่ครอบคลุม Pseudomonas/Acinetobacter.',
      indications: [
        { label: 'ทั่วไป', basis: 'flat', dose: 1, unit: 'g', interval: 'q24h', renalAdjust: 'CrCl <30 → 500 mg q24h' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'linezolid', name: 'Linezolid', sub: 'Inj. 600 mg/300 mL', badges: [],
    doseRule: {
      drugRef: 'Sanford Guide; Lexicomp',
      assumptions: 'ขนาดผู้ใหญ่. ไม่ต้องปรับตามไต. IV ↔ กิน 1:1. ⚠ Myelosuppression ถ้าใช้ >14 วัน (monitor CBC), serotonin syndrome (+ SSRI).',
      indications: [
        { label: 'MRSA / VRE', basis: 'flat', dose: 600, unit: 'mg', interval: 'q12h' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ampho-liposomal', name: 'Liposomal Amphotericin B', sub: 'AmBisome — ⚠ คนละขนาดกับ conventional', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'IDSA Aspergillosis/Mucormycosis Guidelines; Lexicomp',
      assumptions: 'ใช้ actual body weight. ⚠⚠ ขนาดสูงกว่า conventional AmB หลายเท่า — อย่าสับสน! Infuse over ~2 ชม.; premedicate; monitor K⁺/Mg²⁺/SCr.',
      indications: [
        { label: 'Invasive fungal (Aspergillus/Candida)', basis: 'weight', weightBasis: 'actual', dose: [3, 5], unit: 'mg/kg', interval: 'q24h' },
        { label: 'Mucormycosis / CNS', basis: 'weight', weightBasis: 'actual', dose: [5, 10], unit: 'mg/kg', interval: 'q24h' }
      ]
    }
  }));
  CALC_DRUGS.push(makeRuleDrug({
    id: 'ampho-conventional', name: 'Amphotericin B (conventional)', sub: 'Deoxycholate — ⚠ คนละขนาดกับ liposomal', badges: ['badge-renal'],
    doseRule: {
      drugRef: 'Lexicomp; IDSA antifungal guidelines',
      assumptions: 'ใช้ actual body weight. ⚠⚠ ขนาด 0.5–1 mg/kg/วัน เท่านั้น — ห้ามใช้ขนาด liposomal (3–5 mg/kg)! Test dose ก่อน; premedicate; nephrotoxic มาก (hydrate, monitor SCr/K⁺/Mg²⁺); infuse over 2–6 ชม.',
      indications: [
        { label: 'Invasive fungal', basis: 'weight', weightBasis: 'actual', dose: [0.5, 1], unit: 'mg/kg', interval: 'q24h', note: 'max ~1.5 mg/kg/วัน' }
      ]
    }
  }));

  // ====== CrCl Calculator ======
  // Patient data, CrCl, IBW/ABW consolidated into IVDrugRef.getPatientFromForm()

  function updateCrCl(silent) {
    // Initial / cleared state: when every patient field is still blank, don't
    // flash red validation errors (the fields use placeholders now, not values).
    var blankIds = ['ptWt', 'ptAge', 'ptScr', 'ptHt'];
    var allBlank = blankIds.every(function(id) {
      var el = document.getElementById(id);
      return !el || String(el.value).trim() === '';
    });
    if (allBlank) {
      IVDrugRef.renderValidationMessages('validationMessages', { errors: [], warnings: [] });
      blankIds.forEach(function(id){ var el = document.getElementById(id); if (el) el.classList.remove('input-error', 'input-warn'); });
      var cv0 = document.getElementById('crclValue'); if (cv0) cv0.textContent = '—';
      var bi0 = document.getElementById('bodyCompInfo'); if (bi0) bi0.style.display = 'none';
      var cw0 = document.getElementById('crclWarning'); if (cw0) cw0.style.display = 'none';
      var gb0 = document.getElementById('calcGuardBanner'); if (gb0) gb0.style.display = 'none';
      return;
    }

    // Use core.js patient object — consolidates validation, CrCl, IBW/ABW/BMI
    const pt = IVDrugRef.getPatientFromForm();

    if (silent) {
      // Mid-typing (input event): don't nag. validatePatientInput() (called
      // inside getPatientFromForm) just added input-error/input-warn classes —
      // strip them synchronously (before paint, so no red flash / shake) and
      // skip the message box + guard banner. Full validation happens on blur
      // (change) and when the user presses Calculate.
      blankIds.forEach(function(id){ var el = document.getElementById(id); if (el) el.classList.remove('input-error', 'input-warn'); });
      if (!pt.validation.allValid) return; // leave the previous CrCl display as-is
    } else {
      IVDrugRef.renderValidationMessages('validationMessages', pt.validation);

      // Pediatric safety guard (warn-level; never blocks)
      if (window.PediatricGuard) {
        window.PediatricGuard.enforce(pt, window.PediatricGuard.CONTEXTS.CALCULATOR_DOSING, {
          banner: 'calcGuardBanner'
        });
      }

      // Block calculation on hard errors
      if (!pt.validation.allValid) {
        var cv = document.getElementById('crclValue'); if (cv) cv.textContent = '—';
        var bi = document.getElementById('bodyCompInfo'); if (bi) bi.style.display = 'none';
        var cw = document.getElementById('crclWarning'); if (cw) cw.style.display = 'none';
        return;
      }
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
    // Explicit-trigger model: selecting a drug no longer auto-calculates —
    // prompt the user to press the Calculate button instead.
    markStale();
  }

  let lastCalcResult = null;

  // ====== Explicit calculate trigger ======
  // Inputs/drug selection mark the result "stale" (keep the old result, show a
  // hint, pulse the button); the dose is recomputed only when the user presses
  // 🧮 คำนวณ. CrCl still updates live (handled in updateCrCl).
  function markStale() {
    const btn = document.getElementById('calcRunBtn');
    const hint = document.getElementById('calcStaleHint');
    const sec = document.getElementById('outputSection');
    const resultShown = sec && sec.style.display !== 'none';
    if (btn) btn.classList.toggle('calc-attention', !!selectedDrug);
    if (hint) {
      if (!selectedDrug) {
        hint.style.display = 'none';
      } else {
        hint.textContent = resultShown
          ? '⚠ ค่าเปลี่ยนแล้ว — กด 🧮 คำนวณ เพื่ออัปเดตผล'
          : 'กด 🧮 คำนวณ เพื่อดูผลขนาดยา';
        hint.style.display = 'block';
      }
    }
  }

  function runCalc() {
    const btn = document.getElementById('calcRunBtn');
    const hint = document.getElementById('calcStaleHint');
    updateCrCl();
    calculate();
    if (btn) btn.classList.remove('calc-attention');
    if (hint) hint.style.display = 'none';
  }

  function buildCalcShareText(drug, pt, result) {
    var dt = IVDrugRef.ShareExport ? IVDrugRef.ShareExport.thaiDateTime() : '';
    var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07'; // ชาย/หญิง
    var text = '=== ' + drug.name + ' Dose ===\n';
    text += '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: ' + dt + '\n\n'; // วันที่
    text += '\u0e1c\u0e39\u0e49\u0e1b\u0e48\u0e27\u0e22: ' + sex + ' ' + pt.age + ' \u0e1b\u0e35 ' + pt.wt + ' kg SCr ' + pt.scr + '\n'; // ผู้ป่วย ... ปี
    if (pt.crcl) text += 'CrCl: ' + pt.crcl.toFixed(1) + ' mL/min\n';
    text += '\n\u0e41\u0e19\u0e30\u0e19\u0e33: ' + result.title + '\n'; // แนะนำ
    result.details.forEach(function(d) {
      // Strip HTML tags from values
      var v = d.v.replace(/<[^>]*>/g, '');
      text += '- ' + d.l + ': ' + v + '\n';
    });
    var ver = IVDrugRef.VERSION || '5.9.3';
    text += '\n---\nIV DrugRef v' + ver + '\nhttps://rxbenz.github.io/iv-drugref/\n';
    text += '\u26a0 \u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e0a\u0e48\u0e27\u0e22\u0e04\u0e33\u0e19\u0e27\u0e13 \u0e44\u0e21\u0e48\u0e17\u0e14\u0e41\u0e17\u0e19 clinical judgment';
    // ⚠ ใช้เป็นเครื่องมือช่วยคำนวณ ไม่ทดแทน clinical judgment
    return text;
  }

  function calculate() {
    const sec = document.getElementById('outputSection');
    const body = document.getElementById('outputBody');
    const header = document.getElementById('outputHeader');
    if (!selectedDrug) { sec.style.display = 'none'; lastCalcResult = null; return; }

    const drug = CALC_DRUGS.find(d => d.id === selectedDrug);
    if (!drug) return;

    // getPatientFromForm runs validation internally
    const pt = IVDrugRef.getPatientFromForm();
    if (!pt.validation.allValid) { sec.style.display = 'none'; lastCalcResult = null; return; }
    const result = drug.calc(pt);
    lastCalcResult = { drug: drug, pt: pt, result: result };

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
        ${drug.maxDose && result.calculatedDose > drug.maxDose.value ? `<div class="cds-alert danger" style="margin-top:14px;">
          <div class="cds-alert-title">⚠ เกินขนาดยาสูงสุดที่แนะนำ</div>
          <div class="cds-alert-body">
            ขนาดยาที่คำนวณได้ <strong>${result.calculatedDose} ${drug.maxDose.unit}</strong>
            เกินค่าสูงสุด <strong>${drug.maxDose.value} ${drug.maxDose.unit}</strong><br>
            กรุณาตรวจสอบและปรับขนาดยาตามความเหมาะสม
          </div>
          <div class="cds-alert-ref">📚 ${drug.maxDose.ref}</div>
        </div>` : ''}
        <div class="share-row">
          <button class="btn" data-action="copyCalcResult">\ud83d\udccb \u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01</button>
        </div>
      </div>
    `;
    // calculate() now runs only on the explicit Calculate button press, so
    // scrolling the result into view is the expected, user-initiated behavior.
    sec.style.display = 'block';
    sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (typeof trackCalcUsage === 'function') {
      trackCalcUsage(drug.name, pt, result, drug.maxDose && drug.maxDose.unit);
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

  function trackCalcUsage(drugName, pt, result, unit) {
    if (drugName !== lastSelectedDrugForTracking) return;
    lastSelectedDrugForTracking = null;

    const key = drugName + '_' + Math.floor(Date.now() / 30000);
    if (calcTracked[key]) return;
    calcTracked[key] = true;
    IVDrugRef.sendAnalytics({
      type: 'dose_calc',
      drug_name: drugName,
      dose_unit: unit || '',
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

  // ====== Unit Conversion Toggles ======
  var unitState = { wt: 'kg', ht: 'cm', scr: 'mgdl' };

  function toggleWtUnit() {
    var inp = document.getElementById('ptWt');
    var label = document.getElementById('wtUnitLabel');
    var togText = document.getElementById('wtToggleText');
    var v = parseFloat(inp.value);
    if (unitState.wt === 'kg') {
      unitState.wt = 'lbs';
      if (!isNaN(v)) inp.value = (v * 2.205).toFixed(1);
      inp.step = '0.1'; inp.min = '7'; inp.max = '880';
      label.textContent = 'lbs'; togText.textContent = 'kg';
    } else {
      unitState.wt = 'kg';
      if (!isNaN(v)) inp.value = (v / 2.205).toFixed(1);
      inp.step = '0.1'; inp.min = '3'; inp.max = '400';
      label.textContent = 'kg'; togText.textContent = 'lbs';
    }
    updateCrCl(); markStale();
  }

  function toggleHtUnit() {
    var inp = document.getElementById('ptHt');
    var label = document.getElementById('htUnitLabel');
    var togText = document.getElementById('htToggleText');
    var v = parseFloat(inp.value);
    if (unitState.ht === 'cm') {
      unitState.ht = 'in';
      if (!isNaN(v)) inp.value = (v / 2.54).toFixed(1);
      inp.step = '0.1'; inp.min = '16'; inp.max = '98';
      label.textContent = 'in'; togText.textContent = 'cm';
    } else {
      unitState.ht = 'cm';
      if (!isNaN(v)) inp.value = (v * 2.54).toFixed(1);
      inp.step = '0.1'; inp.min = '40'; inp.max = '250';
      label.textContent = 'cm'; togText.textContent = 'in';
    }
    updateCrCl(); markStale();
  }

  function toggleScrUnit() {
    var inp = document.getElementById('ptScr');
    var label = document.getElementById('scrUnitLabel');
    var togText = document.getElementById('scrToggleText');
    var v = parseFloat(inp.value);
    if (unitState.scr === 'mgdl') {
      unitState.scr = 'umol';
      if (!isNaN(v)) inp.value = (v * 88.4).toFixed(0);
      inp.step = '1'; inp.min = '9'; inp.max = '1768';
      label.textContent = 'µmol/L'; togText.textContent = 'mg/dL';
    } else {
      unitState.scr = 'mgdl';
      if (!isNaN(v)) inp.value = (v / 88.4).toFixed(1);
      inp.step = '0.1'; inp.min = '0.1'; inp.max = '20';
      label.textContent = 'mg/dL'; togText.textContent = 'µmol/L';
    }
    updateCrCl(); markStale();
  }

  // Intercept getPatientFromForm to convert non-standard units back to kg/cm/mg/dL.
  // IMPORTANT: only touch a field's .value when it actually needs converting, and
  // restore only those. Writing inp.value back unconditionally corrupts mid-typing
  // input on type=number: while typing "0." the .value getter returns "0", so the
  // restore wrote "0" back, dropping the "." and jumping the caret.
  var _origGetPt = IVDrugRef.getPatientFromForm;
  IVDrugRef.getPatientFromForm = function() {
    var touched = [];
    function convert(id, needsConvert, fn) {
      if (!needsConvert) return;
      var el = document.getElementById(id);
      if (!el) return;
      var orig = el.value;
      var v = parseFloat(orig);
      if (!isNaN(v)) el.value = fn(v);
      touched.push([el, orig]);
    }
    convert('ptWt', unitState.wt === 'lbs', function(v){ return (v / 2.205).toFixed(1); });
    convert('ptHt', unitState.ht === 'in', function(v){ return (v * 2.54).toFixed(1); });
    convert('ptScr', unitState.scr === 'umol', function(v){ return (v / 88.4).toFixed(2); });

    var pt = _origGetPt.call(IVDrugRef);

    // Restore only the fields we changed (default units → nothing touched).
    for (var i = 0; i < touched.length; i++) touched[i][0].value = touched[i][1];

    return pt;
  };

  // ====== Event Delegation ======
  IVDrugRef.delegate(document, 'click', {
    selectDrug: function(e, t) { if (e.target.closest('a[href]')) return; selectDrug(t.dataset.id); },
    runCalc: runCalc,
    copyCalcResult: function() {
      if (!lastCalcResult || !IVDrugRef.ShareExport) return;
      var text = buildCalcShareText(lastCalcResult.drug, lastCalcResult.pt, lastCalcResult.result);
      IVDrugRef.ShareExport.copyText(text, { page: 'calculator', drug: lastCalcResult.drug.name });
    },
    toggleWtUnit: toggleWtUnit,
    toggleHtUnit: toggleHtUnit,
    toggleScrUnit: toggleScrUnit
  });
  IVDrugRef.delegate(document, 'input', {
    patientInput: function() { updateCrCl(true); markStale(); }
  });
  IVDrugRef.delegate(document, 'change', {
    patientInput: function() { updateCrCl(false); markStale(); }
  });

  // ====== Init ======
  // Deep-link pre-select: the drug-card "🧮 คำนวณขนาดยา" chip links here as
  // calculator.html?drug=<id>. Match the param to a CALC_DRUGS entry (by id, or by
  // name as a fallback) and pre-select it so the user lands ready to enter patient
  // params. Patient fields stay blank and the result is still explicit-trigger only
  // (no auto-dose) — this only chooses the drug.
  function preselectFromQuery() {
    try {
      var q = new URLSearchParams(location.search).get('drug');
      if (!q) return;
      var ql = q.trim().toLowerCase();
      var hit = CALC_DRUGS.find(function(d) {
        return d.id === ql || d.name.toLowerCase().indexOf(ql) >= 0 || ql.indexOf(d.id) >= 0;
      });
      if (!hit) return;
      selectDrug(hit.id);
      var grid = document.getElementById('drugGrid');
      if (grid && grid.scrollIntoView) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { /* ignore malformed query */ }
  }

  document.addEventListener('DOMContentLoaded', function() {
    IVDrugRef.trackPageView('calculator');
    IVDrugRef.patientCtx.init();
    updateCrCl();
    renderDrugGrid();
    preselectFromQuery();
  });

  window.addEventListener('beforeunload', sendCalcPageLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendCalcPageLeave();
  });

})();
