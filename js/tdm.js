// ============================================================
// IV DrugRef PWA v5.0 — TDM Hub Module
// Therapeutic Drug Monitoring for Vancomycin, Phenytoin,
// Aminoglycosides, and Valproate
// ============================================================

'use strict';

const TDMHub = (function() {

  // ============================================================
  // PATIENT DATA & CrCl CALCULATION
  // ============================================================

  /**
   * Retrieve patient data from form elements, including TDM-specific fields
   * Falls back to IVDrugRef.getPatientFromForm() for base fields
   * @returns {Object} Patient object with wt, age, sex, scr, ht, alb, crcl, dialysis
   */
  function getPatient() {
    // Use base patient extraction from core.js
    const basePatient = IVDrugRef.getPatientFromForm({
      age: 'ptAge', wt: 'ptWt', ht: 'ptHt', sex: 'ptSex', scr: 'ptScr',
      alb: 'ptAlb', dialysis: 'ptDialysis'
    });

    // Ensure TDM-specific fields are present
    return {
      ...basePatient,
      alb: basePatient.alb || 4.0,
      dialysis: basePatient.dialysis || 'none',
      crcl: 0 // Will be calculated in updateCrCl()
    };
  }

  /**
   * Update CrCl based on patient parameters
   * Uses IVDrugRef.calcCockcroftGault() for adult patients
   * Uses IVDrugRef.calcSchwartz() for pediatric patients
   * @returns {Object} Updated patient object
   */
  function updateCrCl() {
    const p = getPatient();

    // Render validation messages
    IVDrugRef.renderValidationMessages('validationMessages', p.validation);

    // Block calculation on hard errors
    var crclEl = document.getElementById('ptCrCl');
    if (!p.validation.allValid) {
      if (crclEl) crclEl.value = '— (invalid input)';
      return;
    }

    const isPed = p.age < 18;

    if (isPed && p.ht > 0) {
      p.crcl = IVDrugRef.calcSchwartz(p.ht, p.scr);
      if (crclEl) crclEl.value = p.crcl.toFixed(1) + ' mL/min/1.73m² (Schwartz)';
    } else {
      p.crcl = IVDrugRef.calcCockcroftGault(p.age, p.wt, p.scr, p.sex, p.ht);
      let label = p.crcl.toFixed(1) + ' mL/min';

      // Show ABW flag if obese
      if (p.ht > 0) {
        const ibw = p.sex === 'M' ? 50 + 2.3 * (p.ht / 2.54 - 60) : 45.5 + 2.3 * (p.ht / 2.54 - 60);
        if (p.wt > ibw * 1.3) label += ' (ABW)';
        if (p.age >= 65 && p.scr < 0.7) label += ' ⚠elderly';
      }
      if (crclEl) crclEl.value = label;
    }
    return p;
  }

  // ============================================================
  // DRUG TAB SWITCHING
  // ============================================================

  let activeDrug = 'vancomycin';

  function switchDrug(drug) {
    activeDrug = drug;
    document.querySelectorAll('.drug-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    document.querySelectorAll('.drug-section').forEach(s => s.classList.remove('active'));
    const tabs = document.querySelectorAll('.drug-tab');
    const idx = ['vancomycin', 'phenytoin', 'aminoglycoside', 'valproate', 'tacrolimus', 'digoxin', 'warfarin'].indexOf(drug);
    if (idx >= 0 && tabs[idx]) {
      tabs[idx].classList.add('active');
      tabs[idx].setAttribute('aria-selected', 'true');
      tabs[idx].setAttribute('tabindex', '0');
    }
    var secEl = document.getElementById('sec_' + drug); if (secEl) secEl.classList.add('active');
  }

  // ============================================================
  // VANCOMYCIN — Bayesian MAP + MCMC
  // (Ported from vanco-tdm.html)
  // ============================================================

  const VancoTDM = (function() {
    const PK_MODELS = [
      {
        id: 'buelga', name: 'Buelga 2005', pop: 'General adults',
        ref: 'Antimicrob Agents Chemother 2005;49:4934-41',
        clFn: crcl => 0.0048 * crcl, vdFn: (wt, ht, sex) => 0.65 * wt,
        omega_cl: 0.25, omega_vd: 0.15, sigma: 0.10
      },
      {
        id: 'roberts', name: 'Roberts 2011', pop: 'ICU / Critically ill',
        ref: 'Antimicrob Agents Chemother 2011;55:2704-9',
        clFn: crcl => 0.024 * crcl + 1.93, vdFn: (wt, ht, sex) => 0.511 * wt,
        omega_cl: 0.30, omega_vd: 0.20, sigma: 0.12
      },
      {
        id: 'goti', name: 'Goti 2018', pop: 'Hospitalized adults',
        ref: 'Clin Pharmacokinet 2018;57:367-82',
        clFn: crcl => 0.0154 * crcl + 0.32, vdFn: (wt, ht, sex) => 0.70 * wt,
        omega_cl: 0.22, omega_vd: 0.18, sigma: 0.08
      },
      {
        id: 'adane', name: 'Adane 2015', pop: 'Obese (BMI ≥30)',
        ref: 'Pharmacotherapy 2015;35:127-139',
        clFn: crcl => 0.0169 * crcl + 0.94, vdFn: (wt, ht, sex) => {
          if (!ht || ht <= 0) return 0.55 * wt;
          const htIn = ht / 2.54, ibw = sex === 'M' ? 50 + 2.3 * (htIn - 60) : 45.5 + 2.3 * (htIn - 60);
          return 0.55 * (wt > ibw * 1.3 ? ibw + 0.4 * (wt - ibw) : wt);
        },
        omega_cl: 0.28, omega_vd: 0.22, sigma: 0.11
      },
      {
        id: 'bourguignon', name: 'Bourguignon 2016', pop: 'Elderly (≥80 yr)',
        ref: 'Antimicrob Agents Chemother 2016;60:4563-7',
        clFn: crcl => 0.0117 * crcl + 0.28, vdFn: (wt, ht, sex) => 0.52 * wt,
        omega_cl: 0.35, omega_vd: 0.20, sigma: 0.13
      }
    ];

    let selectedModel = 'auto', currentPK = null, mcmcSamples = [], allModelResults = [];
    let doses = [{ amount: 1000, interval: 12, infusion: 1, nDoses: 3, dateTime: '' }];
    let levels = [{ value: 15, dateTime: '' }];
    let refTime = null;

    function getDefaultDT(off = 0) {
      const d = new Date();
      d.setHours(d.getHours() - 24 + off);
      d.setMinutes(0, 0, 0);
      return d.toISOString().slice(0, 16);
    }

    function dtH(dt) {
      return (!dt || !refTime) ? 0 : (new Date(dt).getTime() - refTime) / 3600000;
    }

    function updateRef() {
      if (doses[0]?.dateTime) refTime = new Date(doses[0].dateTime).getTime();
    }

    function buildDH() {
      updateRef();
      return doses.map(d => ({
        amount: d.amount, interval: d.interval, infusion: d.infusion, nDoses: d.nDoses,
        startTime: dtH(d.dateTime)
      }));
    }

    function buildLV() {
      updateRef();
      return levels.map(l => ({ value: l.value, time: dtH(l.dateTime) }));
    }

    // Sampling adequacy checks
    function checkSampling() {
      const dh = buildDH(), lvs = buildLV(), warns = [];
      let totalD = 0;
      for (const d of dh) totalD += d.nDoses;
      const lastE = dh[dh.length - 1], ssAt = lastE ? lastE.startTime + 3 * lastE.interval : 0;

      for (const lv of lvs) {
        if (lv.time < ssAt && totalD >= 1)
          warns.push({ s: 'amber', m: `⚠ Level ${lv.value.toFixed(1)} เจาะก่อน steady state (ก่อน dose ที่ 4)` });
        let isTr = false;
        for (const d of dh)
          for (let n = 1; n < d.nDoses; n++)
            if (d.startTime + n * d.interval - lv.time >= 0 && d.startTime + n * d.interval - lv.time <= 1)
              isTr = true;
        if (lv.value < 25 && !isTr && lvs.length === 1)
          warns.push({ s: 'amber', m: `📍 Level ${lv.value.toFixed(1)} อาจไม่ใช่ true trough (Bayesian ยังทำงานได้จาก random level)` });
      }
      return warns;
    }

    function getRecTimes() {
      const dh = buildDH();
      if (!dh.length || !refTime) return [];
      const le = dh[dh.length - 1], ss = le.startTime + 3 * le.interval, recs = [];
      const trT = ss - 0.5;
      if (trT > 0) {
        const d = new Date(refTime + trT * 3600000);
        recs.push({ type: 'trough', label: `Trough: ${d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (30 นาทีก่อน dose #${Math.round(ss / le.interval) + 1})` });
      }
      const pkT = ss + le.infusion + 1;
      if (pkT > 0) {
        const d = new Date(refTime + pkT * 3600000);
        recs.push({ type: 'peak', label: `Peak: ${d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (1 hr หลัง infusion)` });
      }
      return recs;
    }

    function renderSamplingAdvice() {
      let el = document.getElementById('vancoSamplingAdvice');
      if (!el) {
        const c = document.createElement('div');
        c.className = 'card';
        c.innerHTML = '<div class="card-head">📍 SAMPLING ADEQUACY</div><div class="card-body" id="vancoSamplingAdvice"></div>';
        const lc = document.getElementById('vancoLevelList')?.closest('.card');
        if (lc) lc.after(c);
        el = document.getElementById('vancoSamplingAdvice');
      }
      if (!el || !refTime) {
        if (el) el.innerHTML = '<div style="font-size:12px;color:var(--text3)">กรุณากรอกเวลาให้ยาก่อน</div>';
        return;
      }
      let h = '';
      const ws = checkSampling();
      for (const w of ws) h += `<div class="info-box ${w.s}" style="font-size:11px">${w.m}</div>`;
      const recs = getRecTimes();
      if (recs.length) {
        h += '<div style="font-size:11px;color:var(--text2);margin-top:6px"><strong>📋 แนะนำเวลาเจาะ:</strong></div>';
        for (const r of recs)
          h += `<div style="font-size:12px;padding:4px 8px;margin-top:3px;background:var(--bg);border-radius:6px;border:1px solid var(--card-border)"><span style="color:var(--${r.type === 'trough' ? 'purple' : 'blue'})">${r.type === 'trough' ? '🔻' : '🔺'}</span> ${r.label}</div>`;
      }
      const dh = buildDH();
      let totalD = 0;
      for (const d of dh) totalD += d.nDoses;
      const prog = Math.min(totalD / 4 * 100, 100);
      h += `<div style="margin-top:8px;font-size:11px;color:var(--text2)"><strong>📊 SS Progress:</strong> ${totalD}/4 doses ${totalD >= 4 ? '✅' : '⏳'}</div><div class="progress" style="margin:3px 0"><div class="progress-bar" style="width:${prog}%;background:${totalD >= 4 ? 'var(--green)' : 'var(--amber)'}"></div></div>`;
      el.innerHTML = h;
    }

    // PK prediction (1-compartment model)
    function predictConc(t, cl, vd, doseHist) {
      if (!vd || vd <= 0 || !cl || !isFinite(cl) || !isFinite(vd)) return 0;
      const ke = cl / vd;
      if (!isFinite(ke) || ke <= 0) return 0;
      let conc = 0;
      for (const dh of doseHist) {
        if (!dh.infusion || dh.infusion <= 0) continue;
        for (let n = 0; n < dh.nDoses; n++) {
          const tS = dh.startTime + n * dh.interval, tE = tS + dh.infusion, k0 = dh.amount / dh.infusion;
          if (t <= tS) continue;
          if (t <= tE) conc += (k0 / (ke * vd)) * (1 - Math.exp(-ke * (t - tS)));
          else conc += (k0 / (ke * vd)) * (1 - Math.exp(-ke * dh.infusion)) * Math.exp(-ke * (t - tE));
        }
      }
      return isFinite(conc) ? conc : 0;
    }

    function calcAUC_ss(cl, vd, dose, interval, infusion) {
      if (!cl || !vd || cl <= 0 || vd <= 0 || !infusion || infusion <= 0 || !interval || interval <= 0) return NaN;
      const ke = cl / vd;
      if (!isFinite(ke) || ke <= 0) return NaN;
      const k0 = dose / infusion, acc = 1 / (1 - Math.exp(-ke * interval));
      const N = 300, dt = interval / N;
      let auc = 0;
      for (let i = 0; i < N; i++) {
        const t = i * dt + dt / 2;
        let c;
        if (t <= infusion) {
          c = (k0 / (ke * vd)) * (1 - Math.exp(-ke * t)) + (k0 / (ke * vd)) * (1 - Math.exp(-ke * infusion)) * Math.exp(-ke * (interval - infusion + t)) * Math.max(acc - 1, 0);
        } else {
          c = (k0 / (ke * vd)) * (1 - Math.exp(-ke * infusion)) * acc * Math.exp(-ke * (t - infusion));
        }
        auc += Math.max(c, 0) * dt;
      }
      return auc;
    }

    function ssPeakTrough(cl, vd, dose, interval, infusion) {
      if (!cl || !vd || cl <= 0 || vd <= 0 || !infusion || infusion <= 0 || !interval || interval <= 0) return { peak: NaN, trough: NaN };
      const ke = cl / vd;
      if (!isFinite(ke) || ke <= 0) return { peak: NaN, trough: NaN };
      const k0 = dose / infusion, acc = 1 / (1 - Math.exp(-ke * interval));
      const peak = (k0 / (ke * vd)) * (1 - Math.exp(-ke * infusion)) * acc;
      const trough = peak * Math.exp(-ke * (interval - infusion));
      return { peak: isFinite(peak) ? peak : NaN, trough: isFinite(trough) ? trough : NaN };
    }

    // Bayesian MAP estimation with grid search + Nelder-Mead
    function bayesianMAP(pt, doseHist, measuredLevels, model) {
      const crcl = IVDrugRef.calcCockcroftGault(pt.age, pt.wt, pt.scr, pt.sex, pt.ht);
      const popCL = model.clFn(crcl), popVd = model.vdFn(pt.wt, pt.ht, pt.sex);

      function obj(cl, vd) {
        if (cl <= 0 || vd <= 0 || !isFinite(cl) || !isFinite(vd)) return 1e10;
        let o = Math.pow(Math.log(cl / popCL), 2) / model.omega_cl + Math.pow(Math.log(vd / popVd), 2) / model.omega_vd;
        if (!isFinite(o)) return 1e10;
        for (const lv of measuredLevels) {
          const pred = predictConc(lv.time, cl, vd, doseHist);
          if (pred <= 0 || !isFinite(pred)) return 1e10;
          o += Math.pow(Math.log(lv.value) - Math.log(pred), 2) / model.sigma;
          if (!isFinite(o)) return 1e10;
        }
        return o;
      }

      // Grid search
      let bCL = popCL, bVd = popVd, bObj = obj(popCL, popVd);
      for (let ci = 0.3; ci <= 3; ci += 0.1)
        for (let vi = 0.5; vi <= 2; vi += 0.1) {
          const o = obj(popCL * ci, popVd * vi);
          if (o < bObj) { bObj = o; bCL = popCL * ci; bVd = popVd * vi; }
        }

      // Nelder-Mead optimization
      let sx = [{ cl: bCL, vd: bVd }, { cl: bCL * 1.05, vd: bVd }, { cl: bCL, vd: bVd * 1.05 }];
      const f = p => obj(p.cl, p.vd);
      for (let it = 0; it < 300; it++) {
        sx.sort((a, b) => f(a) - f(b));
        const cx = (sx[0].cl + sx[1].cl) / 2, cy = (sx[0].vd + sx[1].vd) / 2;
        const r = { cl: 2 * cx - sx[2].cl, vd: 2 * cy - sx[2].vd }, fr = f(r);
        if (fr < f(sx[0])) {
          const e = { cl: 3 * cx - 2 * sx[2].cl, vd: 3 * cy - 2 * sx[2].vd };
          sx[2] = f(e) < fr ? e : r;
        } else if (fr < f(sx[1]))
          sx[2] = r;
        else {
          const c2 = { cl: (cx + sx[2].cl) / 2, vd: (cy + sx[2].vd) / 2 };
          if (f(c2) < f(sx[2]))
            sx[2] = c2;
          else {
            sx[1] = { cl: (sx[0].cl + sx[1].cl) / 2, vd: (sx[0].vd + sx[1].vd) / 2 };
            sx[2] = { cl: (sx[0].cl + sx[2].cl) / 2, vd: (sx[0].vd + sx[2].vd) / 2 };
          }
        }
        if (Math.abs(f(sx[0]) - f(sx[2])) < 1e-10) break;
      }
      sx.sort((a, b) => f(a) - f(b));
      const r = sx[0];
      return {
        cl: r.cl, vd: r.vd, ke: r.cl / r.vd, halflife: Math.LN2 / (r.cl / r.vd),
        popCL, popVd, crcl, objValue: f(r),
        method: measuredLevels.length > 0 ? 'Bayesian MAP' : 'Population PK',
        model: model.name, modelId: model.id
      };
    }

    // MCMC sampling (adaptive random walk)
    function runMCMC(pt, doseHist, measuredLevels, model, mapR, nSamp, cb) {
      const crcl = IVDrugRef.calcCockcroftGault(pt.age, pt.wt, pt.scr, pt.sex, pt.ht);
      const popCL = model.clFn(crcl), popVd = model.vdFn(pt.wt, pt.ht, pt.sex);

      function logPost(cl, vd) {
        if (cl <= 0 || vd <= 0 || !isFinite(cl) || !isFinite(vd)) return -1e10;
        let lp = -0.5 * (Math.pow(Math.log(cl / popCL), 2) / model.omega_cl + Math.pow(Math.log(vd / popVd), 2) / model.omega_vd);
        if (!isFinite(lp)) return -1e10;
        for (const lv of measuredLevels) {
          const pred = predictConc(lv.time, cl, vd, doseHist);
          if (pred <= 0 || !isFinite(pred)) return -1e10;
          lp -= 0.5 * Math.pow(Math.log(lv.value) - Math.log(pred), 2) / model.sigma;
          if (!isFinite(lp)) return -1e10;
        }
        return lp;
      }

      const samples = [];
      let cl = mapR.cl, vd = mapR.vd, lp = logPost(cl, vd);
      const sdCL = Math.sqrt(model.omega_cl) * popCL * 0.15, sdVd = Math.sqrt(model.omega_vd) * popVd * 0.15;
      let accepted = 0;
      const burnin = Math.floor(nSamp * 0.3), total = nSamp + burnin;
      let batch = 0;
      const batchSz = 100;

      function step() {
        const end = Math.min(batch + batchSz, total);
        for (let i = batch; i < end; i++) {
          const u1 = Math.max(Math.random(), 1e-15), u2 = Math.random();
          const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
          const pCL = cl + z1 * sdCL * 2.4, pVd = vd + z2 * sdVd * 2.4;
          if (!isFinite(pCL) || !isFinite(pVd)) continue;
          const pLP = logPost(pCL, pVd);
          if (isFinite(pLP) && pLP > -1e9 && Math.log(Math.random()) < pLP - lp) { cl = pCL; vd = pVd; lp = pLP; accepted++; }
          if (i >= burnin && cl > 0 && vd > 0 && isFinite(cl) && isFinite(vd)) samples.push({ cl, vd, ke: cl / vd });
        }
        batch = end;
        const pct = Math.round(batch / total * 100);
        const barEl = document.getElementById('vancoMcmcBar');
        const statusEl = document.getElementById('vancoMcmcStatus');
        if (barEl) barEl.style.width = pct + '%';
        if (statusEl) statusEl.textContent = 'MCMC ' + pct + '% (' + samples.length + '/' + nSamp + ' samples)';
        if (batch < total) setTimeout(step, 0);
        else cb(samples, accepted / total);
      }
      step();
    }

    // Graph rendering with concentration curves
    function drawGraph(pk, doseHist, measuredLvls, optDose, optInterval, optInfusion, mcmc) {
      const canvas = document.getElementById('vancoGraph');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 320 * dpr;
      ctx.scale(dpr, dpr);
      const W = rect.width, H = 320;

      let maxTime = 0;
      for (const d of doseHist) maxTime = Math.max(maxTime, d.startTime + d.interval * d.nDoses + d.interval);
      maxTime = Math.max(maxTime, 48);

      const totalTime = maxTime + optInterval * 3, maxConc = 60;
      const pad = { left: 48, right: 16, top: 16, bottom: 36 };
      const gW = W - pad.left - pad.right, gH = H - pad.top - pad.bottom;
      const tX = t => pad.left + (t / totalTime) * gW, cY = c => pad.top + gH - (Math.min(c, maxConc) / maxConc) * gH;

      // Background and grid
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      ctx.lineWidth = 0.5;
      for (let t = 0; t <= totalTime; t += 12) {
        ctx.beginPath();
        ctx.moveTo(tX(t), pad.top);
        ctx.lineTo(tX(t), H - pad.bottom);
        ctx.stroke();
      }
      for (let c = 0; c <= maxConc; c += 10) {
        ctx.beginPath();
        ctx.moveTo(pad.left, cY(c));
        ctx.lineTo(W - pad.right, cY(c));
        ctx.stroke();
      }

      // Therapeutic zone (10-20 mcg/mL)
      ctx.fillStyle = 'rgba(74,222,128,.05)';
      ctx.fillRect(pad.left, cY(20), gW, cY(10) - cY(20));
      ctx.strokeStyle = 'rgba(74,222,128,.12)';
      ctx.setLineDash([3, 3]);
      [10, 20].forEach(c => {
        ctx.beginPath();
        ctx.moveTo(pad.left, cY(c));
        ctx.lineTo(W - pad.right, cY(c));
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Axis labels
      ctx.fillStyle = '#475569';
      ctx.font = '10px "DM Sans"';
      ctx.textAlign = 'center';
      for (let t = 0; t <= totalTime; t += 12) ctx.fillText(t + 'h', tX(t), H - pad.bottom + 14);
      ctx.textAlign = 'right';
      for (let c = 0; c <= maxConc; c += 10) ctx.fillText(c, pad.left - 5, cY(c) + 3);
      ctx.save();
      ctx.translate(11, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('mcg/mL', 0, 0);
      ctx.restore();

      // MCMC credible interval shading
      if (mcmc && mcmc.length > 20) {
        const st = totalTime / 200;
        for (let t = 0; t <= maxTime; t += st) {
          const concs = [];
          for (let si = 0; si < mcmc.length; si += Math.max(1, Math.floor(mcmc.length / 300)))
            concs.push(predictConc(t, mcmc[si].cl, mcmc[si].vd, doseHist));
          concs.sort((a, b) => a - b);
          const lo = concs[Math.floor(concs.length * 0.05)], hi = concs[Math.floor(concs.length * 0.95)];
          ctx.fillStyle = 'rgba(56,189,248,0.08)';
          ctx.fillRect(tX(t), cY(hi), tX(t + st) - tX(t), cY(lo) - cY(hi));
        }
      }

      // MAP concentration curve
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let first = true;
      for (let t = 0; t <= maxTime; t += 0.3) {
        const c = predictConc(t, pk.cl, pk.vd, doseHist);
        const x = tX(t), y = cY(c);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Proposed dosing curve
      const optStart = maxTime;
      const optDH = [{ amount: optDose, interval: optInterval, infusion: optInfusion, startTime: optStart, nDoses: 3 }];
      const carryConc = predictConc(maxTime, pk.cl, pk.vd, doseHist);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      first = true;
      for (let t = optStart; t <= totalTime; t += 0.3) {
        const cNew = predictConc(t, pk.cl, pk.vd, optDH), cCarry = carryConc * Math.exp(-pk.ke * (t - optStart));
        const x = tX(t), y = cY(cNew + cCarry);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Transition line
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(tX(maxTime), pad.top);
      ctx.lineTo(tX(maxTime), H - pad.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.font = '9px "DM Sans"';
      ctx.textAlign = 'center';
      ctx.fillText('→ proposed', tX(maxTime) + 28, pad.top + 10);

      // Measured levels as markers
      for (const lv of measuredLvls) {
        const x = tX(lv.time), y = cY(lv.value);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b1120';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(lv.value.toFixed(1), x, y - 9);
      }
    }

    function renderDoses() {
      if (!doses[0].dateTime) doses[0].dateTime = getDefaultDT(0);
      const el = document.getElementById('vancoDoseList');
      if (!el) return;
      el.innerHTML = doses.map((d, i) => `
        <div class="entry-row"><div class="entry-head"><span>Dose #${i + 1}</span>${doses.length > 1 ? `<button data-action="vancoRemoveDose" data-index="${i}">×</button>` : ''}</div>
        <div class="row row-3" style="gap:8px"><div class="field"><label>Amount (mg)</label><input type="number" value="${d.amount}" min="100" max="4000" step="250" data-action="vancoSetDose" data-index="${i}" data-field="amount"></div>
        <div class="field"><label>Interval (hr)</label><input type="number" value="${d.interval}" min="4" max="72" data-action="vancoSetDose" data-index="${i}" data-field="interval"></div>
        <div class="field"><label>Infusion (hr)</label><input type="number" value="${d.infusion}" min="0.5" max="4" step="0.5" data-action="vancoSetDose" data-index="${i}" data-field="infusion"></div></div>
        <div class="row row-2" style="gap:8px;margin-top:8px"><div class="field"><label>🕐 เริ่มให้ยา (วัน+เวลา)</label><input type="datetime-local" value="${d.dateTime}" data-action="vancoSetDose" data-index="${i}" data-field="dateTime"></div>
        <div class="field"><label># doses ที่ให้แล้ว</label><input type="number" value="${d.nDoses}" min="1" max="50" data-action="vancoSetDose" data-index="${i}" data-field="nDoses"></div></div></div>`).join('');
      renderSamplingAdvice();
    }

    function renderLevels() {
      const el = document.getElementById('vancoLevelList');
      if (!el) return;
      el.innerHTML = levels.map((l, i) => `
        <div class="entry-row"><div class="row row-2" style="gap:8px"><div class="field"><label>Level #${i + 1} (mcg/mL)</label><input type="number" value="${l.value}" min="0.1" max="100" step="0.1" data-action="vancoSetLevel" data-index="${i}" data-field="value"></div>
        <div class="field"><label>🕐 เวลาเจาะ</label><input type="datetime-local" value="${l.dateTime || ''}" data-action="vancoSetLevel" data-index="${i}" data-field="dateTime"></div></div>
        ${levels.length > 1 ? `<button class="btn btn-sm btn-danger" style="margin-top:6px" data-action="vancoRemoveLevel" data-index="${i}">ลบ</button>` : ''}</div>`).join('');
      renderSamplingAdvice();
    }

    function renderModelSelect() {
      const pt = getPatient();
      const bmi = pt.wt / ((pt.ht / 100) ** 2);
      const recModel = bmi >= 30 ? 'adane' : pt.age >= 80 ? 'bourguignon' : null;
      const all = [{ id: 'auto', name: 'Auto-select', pop: 'Best fit (lowest OFV)' }, ...PK_MODELS];
      const el = document.getElementById('vancoModelSelect');
      if (!el) return;
      el.innerHTML = all.map(m => `
        <div class="model-card ${selectedModel === m.id ? 'active' : ''}" data-action="vancoSetModel" data-model="${m.id}">
          <div class="mc-name">${m.name} ${m.id === recModel ? '<span style="color:var(--amber);font-size:10px">⭐ แนะนำ</span>' : ''}</div><div class="mc-sub">${m.pop}</div></div>`).join('');
      if (recModel) {
        let msg = recModel === 'adane' ? `⚠ BMI ${bmi.toFixed(1)} → แนะนำ Adane 2015 (Obesity model)` : `👴 อายุ ${pt.age} ปี → แนะนำ Bourguignon 2016 (Elderly model)`;
        el.innerHTML += `<div class="info-box amber" style="font-size:11px;margin-top:6px">${msg}</div>`;
      }
    }

    function updateOptimizer() {
      if (!currentPK) return;
      const od = +document.getElementById('vancoOptDose').value;
      const oi = +document.getElementById('vancoOptInterval').value;
      const oif = +document.getElementById('vancoOptInfusion').value;
      document.getElementById('vancoOptDoseVal').textContent = od + ' mg';
      document.getElementById('vancoOptIntervalVal').textContent = 'q' + oi + 'h';
      document.getElementById('vancoOptInfusionVal').textContent = oif + ' hr';

      const auc24 = calcAUC_ss(currentPK.cl, currentPK.vd, od, oi, oif) * (24 / oi);
      const ss = ssPeakTrough(currentPK.cl, currentPK.vd, od, oi, oif);
      let cls = 'green', msg = '✅ In target';
      if (auc24 < 400) { cls = 'amber'; msg = '⚠ Below target'; }
      else if (auc24 > 600) { cls = 'red'; msg = '⚠ Above target'; }

      const vol = od <= 1000 ? 200 : 250;
      document.getElementById('vancoOptResult').innerHTML = `
        <div class="result-box ${cls}" style="padding:10px">
          <div style="font-size:20px;font-weight:700;font-family:var(--mono);color:var(--${cls})">AUC₂₄ = ${auc24.toFixed(0)} ${msg}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px">Peak ${ss.peak.toFixed(1)} | Trough ${ss.trough.toFixed(1)} | ${od}mg in NSS ${vol}mL → ${Math.round(vol / oif)} mL/hr</div>
        </div>`;

      drawGraph(currentPK, buildDH(), buildLV(), od, oi, oif, mcmcSamples);
    }

    function genDoseOpts() {
      if (!currentPK) return;
      const qs = [8, 12, 24, 36, 48], ds = [500, 750, 1000, 1250, 1500, 1750, 2000];
      let opts = [];
      for (const q of qs)
        for (const d of ds) {
          const auc = calcAUC_ss(currentPK.cl, currentPK.vd, d, q, 1) * (24 / q);
          if (auc >= 300 && auc <= 750) {
            const ss = ssPeakTrough(currentPK.cl, currentPK.vd, d, q, 1);
            opts.push({ dose: d, q, auc, tr: ss.trough, pk: ss.peak, ok: auc >= 400 && auc <= 600 });
          }
        }
      opts.sort((a, b) => Math.abs(a.auc - 500) - Math.abs(b.auc - 500));
      opts = opts.slice(0, 6);
      const el = document.getElementById('vancoDoseCompare');
      if (!el) return;
      el.innerHTML = opts.map(o => {
        const c = o.ok ? 'green' : (o.auc < 400 ? 'amber' : 'red');
        return `<div class="dose-option" data-action="vancoDoseOption" data-dose="${o.dose}" data-q="${o.q}">
          <div class="opt-dose">${o.dose} mg q${o.q}h</div>
          <div class="opt-auc">AUC₂₄ ${o.auc.toFixed(0)} | Pk ${o.pk.toFixed(1)} | Tr ${o.tr.toFixed(1)}</div>
          <span class="opt-badge" style="background:var(--${c}-dim);color:var(--${c})">${o.ok ? 'In target' : o.auc < 400 ? 'Below' : 'Above'}</span></div>`;
      }).join('');
    }

    return {
      init() { renderDoses(); renderLevels(); renderModelSelect(); },
      addDose() {
        const l = doses[doses.length - 1];
        const nextDt = l.dateTime ? new Date(new Date(l.dateTime).getTime() + l.interval * l.nDoses * 3600000).toISOString().slice(0, 16) : '';
        doses.push({ amount: l.amount, interval: l.interval, infusion: l.infusion, nDoses: 1, dateTime: nextDt });
        renderDoses();
      },
      removeDose(i) { doses.splice(i, 1); renderDoses(); },
      setDose(i, k, v) { doses[i][k] = v; },
      addLevel() {
        const nextDt = doses[0]?.dateTime ? new Date(new Date(doses[0].dateTime).getTime() + 35.5 * 3600000).toISOString().slice(0, 16) : '';
        levels.push({ value: 10, dateTime: nextDt });
        renderLevels();
      },
      removeLevel(i) { levels.splice(i, 1); renderLevels(); },
      setLevel(i, k, v) { levels[i][k] = v; },
      setModel(id) { selectedModel = id; renderModelSelect(); },
      updateOpt() { updateOptimizer(); genDoseOpts(); },
      getDoses() { return doses; },
      getLevels() { return levels; },
      getPK() { return currentPK; },
      getOptData() {
        var el = document.getElementById('vancoOptDose');
        if (!el || !currentPK) return null;
        var od = +el.value, oi = +document.getElementById('vancoOptInterval').value, oif = +document.getElementById('vancoOptInfusion').value;
        var auc24 = calcAUC_ss(currentPK.cl, currentPK.vd, od, oi, oif) * (24/oi);
        var ss = ssPeakTrough(currentPK.cl, currentPK.vd, od, oi, oif);
        return { dose: od, interval: oi, infusion: oif, auc24: auc24, peak: ss.peak, trough: ss.trough };
      },
      run() {
        const pt = updateCrCl();
        updateRef();
        if (!refTime) { alert('กรุณากรอกเวลาให้ยา dose แรกก่อน'); return; }

        const doseHist = buildDH(), measuredLvls = buildLV();
        allModelResults = PK_MODELS.map(m => {
          const pk = bayesianMAP(pt, doseHist, measuredLvls, m);
          const lastD = doseHist[doseHist.length - 1];
          const auc24 = calcAUC_ss(pk.cl, pk.vd, lastD.amount, lastD.interval, lastD.infusion) * (24 / lastD.interval);
          const ss = ssPeakTrough(pk.cl, pk.vd, lastD.amount, lastD.interval, lastD.infusion);
          return { ...pk, auc24, ssPeak: ss.peak, ssTrough: ss.trough };
        });

        let bestIdx = 0;
        if (selectedModel === 'auto')
          bestIdx = allModelResults.reduce((bi, r, i) => r.objValue < allModelResults[bi].objValue ? i : bi, 0);
        else {
          bestIdx = PK_MODELS.findIndex(m => m.id === selectedModel);
          if (bestIdx < 0) bestIdx = 0;
        }
        currentPK = allModelResults[bestIdx];
        const bestModel = PK_MODELS[bestIdx];

        const el = document.getElementById('vancoModelCompare');
        if (el)
          el.innerHTML = '<div class="model-grid">' + allModelResults.map((r, i) => {
            const cls = r.auc24 >= 400 && r.auc24 <= 600 ? 'green' : (r.auc24 < 400 ? 'amber' : 'red');
            return `<div class="model-card ${i === bestIdx ? 'active' : ''}" data-action="vancoRunModel" data-model="${PK_MODELS[i].id}">
              <div class="mc-name">${r.model} ${i === bestIdx ? '⭐' : ''}</div><div class="mc-sub">${PK_MODELS[i].pop}</div>
              <div class="mc-auc" style="color:var(--${cls})">AUC₂₄ ${r.auc24.toFixed(0)}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:3px">CL ${r.cl.toFixed(2)} | Vd ${r.vd.toFixed(1)} | t½ ${r.halflife.toFixed(1)}h</div>
              <div style="font-size:10px;color:var(--text3)">OFV ${r.objValue.toFixed(2)}</div></div>`;
          }).join('') + '</div>';

        const progEl = document.getElementById('vancoMcmcProgress');
        const resEl = document.getElementById('vancoResults');
        if (progEl) progEl.style.display = 'block';
        if (resEl) resEl.style.display = 'none';

        runMCMC(pt, doseHist, measuredLvls, bestModel, currentPK, 2000, function(samples, acceptRate) {
          mcmcSamples = samples;
          if (progEl) progEl.style.display = 'none';
          if (resEl) resEl.style.display = 'block';

          const lastD = buildDH()[buildDH().length - 1];
          const aucArr = samples.map(s => calcAUC_ss(s.cl, s.vd, lastD.amount, lastD.interval, lastD.infusion) * (24 / lastD.interval)).filter(v => isFinite(v)).sort((a, b) => a - b);
          const aucMAP = currentPK.auc24;
          const aucLo = aucArr.length > 0 ? aucArr[Math.floor(aucArr.length * 0.05)] : NaN;
          const aucHi = aucArr.length > 0 ? aucArr[Math.floor(aucArr.length * 0.95)] : NaN;
          const clArr = samples.map(s => s.cl).filter(v => isFinite(v)).sort((a, b) => a - b);
          const clLo = clArr.length > 0 ? clArr[Math.floor(clArr.length * 0.05)] : NaN;
          const clHi = clArr.length > 0 ? clArr[Math.floor(clArr.length * 0.95)] : NaN;

          let aucCls = 'green', aucMsg = '✅ AUC₂₄ อยู่ใน target range (400-600)';
          if (aucMAP < 400) { aucCls = 'amber'; aucMsg = '⚠ ต่ำกว่า target → อาจ subtherapeutic'; }
          else if (aucMAP > 600) { aucCls = 'red'; aucMsg = '⚠ สูงกว่า target → เสี่ยง nephrotoxicity'; }

          const aucEl = document.getElementById('vancoAucResult');
          if (aucEl)
            aucEl.innerHTML = `
              <div class="result-box ${aucCls}"><div class="result-title">AUC₂₄/MIC (${currentPK.model})</div>
              <div class="result-value" style="color:var(--${aucCls})">${aucMAP.toFixed(0)}</div>
              <div class="result-sub" style="color:var(--${aucCls})">${aucMsg}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:6px">90% CI: <span class="ci-badge" style="background:var(--${aucCls}-dim);color:var(--${aucCls})">${aucLo.toFixed(0)} — ${aucHi.toFixed(0)}</span></div></div>
              <div class="share-row"><button class="btn" data-action="shareTDM" data-drug="vancomycin">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="vancomycin">\ud83d\udcc4 PDF</button></div>`;

          // Store AUC CI on currentPK for share access
          currentPK.aucLo = aucLo; currentPK.aucHi = aucHi;

          const pkEl = document.getElementById('vancoPkStats');
          if (pkEl)
            pkEl.innerHTML = `
              <div class="stat"><div class="stat-label">SS Peak</div><div class="stat-val" style="color:var(--blue)">${currentPK.ssPeak.toFixed(1)}</div></div>
              <div class="stat"><div class="stat-label">SS Trough</div><div class="stat-val" style="color:var(--purple)">${currentPK.ssTrough.toFixed(1)}</div></div>
              <div class="stat"><div class="stat-label">t½</div><div class="stat-val">${currentPK.halflife.toFixed(1)}h</div></div>
              <div class="stat"><div class="stat-label">Accept</div><div class="stat-val">${(acceptRate * 100).toFixed(0)}%</div></div>`;

          const ciEl = document.getElementById('vancoCiInfo');
          if (ciEl)
            ciEl.innerHTML = `
              <div class="info-box cyan" style="font-size:11px"><b>90% Credible Intervals (${samples.length} MCMC samples):</b><br>
              AUC₂₄: ${aucLo.toFixed(0)}–${aucHi.toFixed(0)} | CL: ${clLo.toFixed(3)}–${clHi.toFixed(3)} L/hr</div>`;

          const tblEl = document.getElementById('vancoPkTable');
          if (tblEl)
            tblEl.innerHTML = `
              <tr><td>Method</td><td style="color:var(--blue)">${currentPK.method} + MCMC</td></tr>
              <tr><td>PK Model</td><td>${currentPK.model}</td></tr>
              <tr><td>CrCl</td><td>${currentPK.crcl.toFixed(1)} mL/min</td></tr>
              <tr><td>CL (MAP)</td><td>${currentPK.cl.toFixed(3)} L/hr</td></tr>
              <tr><td>Vd (MAP)</td><td>${currentPK.vd.toFixed(1)} L</td></tr>
              <tr><td>Ke</td><td>${currentPK.ke.toFixed(4)} hr⁻¹</td></tr>
              <tr><td>Half-life</td><td>${currentPK.halflife.toFixed(1)} hr</td></tr>
              <tr><td>OFV</td><td>${currentPK.objValue.toFixed(4)}</td></tr>`;

          document.getElementById('vancoOptDose').value = lastD.amount;
          document.getElementById('vancoOptInterval').value = lastD.interval;
          document.getElementById('vancoOptInfusion').value = lastD.infusion;
          updateOptimizer();
          genDoseOpts();

          const resScrollEl = document.getElementById('vancoResults');
          if (resScrollEl) resScrollEl.scrollIntoView({ behavior: 'smooth' });

          // Analytics tracking
          IVDrugRef.sendAnalytics({
            type: 'tdm_usage', drug_name: 'Vancomycin', action: 'calculation',
            model: currentPK.model, auc_result: aucMAP.toFixed(0),
            auc_ci_lo: aucLo.toFixed(0), auc_ci_hi: aucHi.toFixed(0),
            interpretation: aucMAP >= 400 && aucMAP <= 600 ? 'therapeutic' : (aucMAP < 400 ? 'subtherapeutic' : 'supratherapeutic'),
            ss_peak: currentPK.ssPeak.toFixed(1), ss_trough: currentPK.ssTrough.toFixed(1),
            cl_map: currentPK.cl.toFixed(3), vd_map: currentPK.vd.toFixed(1), halflife: currentPK.halflife.toFixed(1),
            dose: lastD.amount + 'mg q' + lastD.interval + 'h', mcmc_accept: (acceptRate * 100).toFixed(0),
            weight_kg: pt.wt, height_cm: pt.ht, age: pt.age, sex: pt.sex,
            scr: pt.scr, crcl: currentPK.crcl.toFixed(0), albumin: pt.alb, dialysis: pt.dialysis,
            measured_levels: JSON.stringify(levels.map(l => ({ value: l.value, time: l.time }))),
            num_levels: levels.length,
            dose_history: JSON.stringify(doses.map(d => ({ amount: d.amount, interval: d.interval, infusion: d.infusion, start: d.startTime, n: d.nDoses }))),
            num_dose_entries: doses.length
          });
        });
      }
    };
  })();

  // ============================================================
  // PHENYTOIN — Winter-Tozer + Michaelis-Menten
  // ============================================================

  const PhenytoinTDM = (function() {
    function winterTozer(totalLevel, albumin, crcl, dialysis) {
      let corrected, equation;
      if (dialysis !== 'none') {
        corrected = totalLevel / (0.1 * albumin + 0.1);
        equation = `${totalLevel} / (0.1 × ${albumin} + 0.1)`;
      } else if (crcl < 15) {
        corrected = totalLevel / (0.1 * albumin + 0.1);
        equation = `${totalLevel} / (0.1 × ${albumin} + 0.1) [uremia]`;
      } else if (albumin < 3.5) {
        corrected = totalLevel / (0.2 * albumin + 0.1);
        equation = `${totalLevel} / (0.2 × ${albumin} + 0.1)`;
      } else {
        corrected = totalLevel;
        equation = 'No correction needed (Alb ≥3.5, normal renal)';
      }
      return { corrected, equation };
    }

    function estimateFreeFraction(albumin, crcl, dialysis) {
      if (dialysis !== 'none') return 0.20;
      if (crcl < 15) return 0.20;
      if (albumin < 2.5) return 0.20;
      if (albumin < 3.5) return 0.15;
      return 0.10;
    }

    function mmDoseForCss(Vmax, Km, targetCss, S, F) {
      if (targetCss >= Vmax / (S * F)) return Infinity;
      return (Vmax * targetCss) / ((Km + targetCss) * S * F);
    }

    function estimateMM(currentDose, currentCss, wt) {
      const S = 0.92, F = 1.0;
      const R = currentDose * S * F;
      const popVmax = 7 * wt, popKm = 4;
      const Vmax_est = R * (popKm + currentCss) / currentCss;
      const Km_est = currentCss * (popVmax / R - 1);
      return {
        method1: { Vmax: Vmax_est, Km: popKm, label: 'Orbit (Km fixed=4)' },
        method2: { Vmax: popVmax, Km: Math.max(Km_est, 0.5), label: 'Orbit (Vmax fixed=7×wt)' },
        population: { Vmax: popVmax, Km: popKm, label: 'Population' },
        S, F
      };
    }

    function drawGraph(mm, S, F, currentDose, currentCss) {
      const canvas = document.getElementById('phenyGraph');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 280 * dpr;
      ctx.scale(dpr, dpr);
      const W = rect.width, H = 280;
      const pad = { left: 48, right: 16, top: 16, bottom: 36 };
      const gW = W - pad.left - pad.right, gH = H - pad.top - pad.bottom;
      const maxDose = 800, maxCss = 40;
      const dX = d => pad.left + (d / maxDose) * gW, cY = c => pad.top + gH - (Math.min(c, maxCss) / maxCss) * gH;

      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      ctx.lineWidth = 0.5;
      for (let d = 0; d <= maxDose; d += 100) {
        ctx.beginPath();
        ctx.moveTo(dX(d), pad.top);
        ctx.lineTo(dX(d), H - pad.bottom);
        ctx.stroke();
      }
      for (let c = 0; c <= maxCss; c += 5) {
        ctx.beginPath();
        ctx.moveTo(pad.left, cY(c));
        ctx.lineTo(W - pad.right, cY(c));
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(74,222,128,.05)';
      ctx.fillRect(pad.left, cY(20), gW, cY(10) - cY(20));

      const methods = [mm.method1, mm.method2];
      const colors = ['#38bdf8', '#a78bfa'];
      methods.forEach((m, mi) => {
        ctx.strokeStyle = colors[mi];
        ctx.lineWidth = 1.5;
        if (mi === 1) ctx.setLineDash([5, 3]);
        ctx.beginPath();
        let first = true;
        for (let d = 10; d <= maxDose; d += 2) {
          const css = (m.Km * d * S * F) / (m.Vmax - d * S * F);
          if (css <= 0 || css > maxCss * 2) continue;
          const x = dX(d), y = cY(css);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      if (currentCss > 0) {
        const x = dX(currentDose), y = cY(currentCss);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b1120';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentCss.toFixed(1)}`, x, y - 10);
      }

      ctx.fillStyle = '#475569';
      ctx.font = '10px "DM Sans"';
      ctx.textAlign = 'center';
      for (let d = 0; d <= maxDose; d += 100) ctx.fillText(d + 'mg', dX(d), H - pad.bottom + 14);
      ctx.textAlign = 'right';
      for (let c = 0; c <= maxCss; c += 10) ctx.fillText(c, pad.left - 5, cY(c) + 3);
      ctx.save();
      ctx.translate(11, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('Css (mcg/mL)', 0, 0);
      ctx.restore();
      ctx.fillStyle = '#475569';
      ctx.font = '10px "DM Sans"';
      ctx.textAlign = 'center';
      ctx.fillText('Daily Dose (mg)', W / 2, H - 4);
    }

    return {
      run() {
        const pt = updateCrCl();
        const totalLevel = +(document.getElementById('phenyLevel').value) || 0;
        const freeLevel = +(document.getElementById('phenyFree').value) || 0;
        const currentDose = +(document.getElementById('phenyDose').value) || 300;

        if (totalLevel <= 0) { alert('กรุณาใส่ค่า Phenytoin level'); return; }

        const wt = winterTozer(totalLevel, pt.alb, pt.crcl, pt.dialysis);
        const freeFrac = estimateFreeFraction(pt.alb, pt.crcl, pt.dialysis);
        const estFree = totalLevel * freeFrac;

        const corrEl = document.getElementById('phenyCorrection');
        if (corrEl)
          corrEl.innerHTML = `
            <div class="result-box ${wt.corrected >= 10 && wt.corrected <= 20 ? 'green' : (wt.corrected < 10 ? 'amber' : 'red')}">
              <div class="result-title">Corrected Total Phenytoin</div>
              <div class="result-value" style="color:var(--${wt.corrected >= 10 && wt.corrected <= 20 ? 'green' : (wt.corrected < 10 ? 'amber' : 'red')})">${wt.corrected.toFixed(1)} mcg/mL</div>
              <div class="result-sub">Measured: ${totalLevel} mcg/mL → Corrected: ${wt.corrected.toFixed(1)} mcg/mL</div>
            </div>
            <div class="info-box cyan" style="font-size:11px;margin-top:8px">
              <b>Winter-Tozer equation:</b> ${wt.equation}<br>
              Albumin: ${pt.alb} g/dL | CrCl: ${pt.crcl.toFixed(0)} mL/min | Dialysis: ${pt.dialysis}<br>
              Est. free fraction: ${(freeFrac * 100).toFixed(0)}% → Est. free level: ${estFree.toFixed(1)} mcg/mL
              ${freeLevel > 0 ? `<br><b>Actual free level:</b> ${freeLevel} mcg/mL (fraction: ${(freeLevel / totalLevel * 100).toFixed(1)}%)` : ''}
            </div>`;

        const useCss = wt.corrected;
        let interpCls = 'green', interpMsg = '';
        if (useCss < 10) { interpCls = 'amber'; interpMsg = '⚠ SUBTHERAPEUTIC — พิจารณาเพิ่ม dose'; }
        else if (useCss <= 20) { interpCls = 'green'; interpMsg = '✅ THERAPEUTIC (10-20 mcg/mL)'; }
        else if (useCss <= 25) { interpCls = 'amber'; interpMsg = '⚠ BORDERLINE TOXIC — monitor closely'; }
        else { interpCls = 'red'; interpMsg = '🚨 TOXIC — หยุดยา/ลด dose ทันที'; }

        const interpEl = document.getElementById('phenyInterpretation');
        if (interpEl)
          interpEl.innerHTML = `
            <div class="result-box ${interpCls}"><div class="result-value" style="font-size:22px;color:var(--${interpCls})">${interpMsg}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:8px">Corrected level: ${useCss.toFixed(1)} mcg/mL | Target: 10-20 mcg/mL (total) | 1-2 mcg/mL (free)</div></div>
            <div class="info-box amber" style="font-size:11px;margin-top:8px">
              <b>Toxicity signs by level:</b><br>
              >20: Nystagmus | >30: Ataxia, slurred speech | >40: Lethargy, confusion | >50: Coma, seizures
            </div>
            <div class="share-row"><button class="btn" data-action="shareTDM" data-drug="phenytoin">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="phenytoin">\ud83d\udcc4 PDF</button></div>`;

        const mm = estimateMM(currentDose, useCss, pt.wt);

        const mmEl = document.getElementById('phenyMM');
        if (mmEl)
          mmEl.innerHTML = `
            <div class="info-box purple" style="font-size:11px">
              <b>Michaelis-Menten kinetics:</b> Phenytoin follows non-linear (saturable) kinetics<br>
              Small dose changes → disproportionately large level changes near saturation<br>
              Orbit method: ใช้ 1 steady-state level เพื่อ estimate Vmax/Km
            </div>`;

        const tblEl = document.getElementById('phenyPkTable');
        if (tblEl)
          tblEl.innerHTML = `
            <tr><td>Method</td><td colspan="2" style="color:var(--blue)">Orbit (1-point estimate)</td></tr>
            <tr><td></td><td style="color:var(--blue);text-align:left">Km fixed</td><td style="color:var(--purple);text-align:right">Vmax fixed</td></tr>
            <tr><td>Vmax</td><td style="text-align:left">${mm.method1.Vmax.toFixed(0)} mg/day</td><td>${mm.population.Vmax.toFixed(0)} mg/day</td></tr>
            <tr><td>Km</td><td style="text-align:left">${mm.method1.Km.toFixed(1)} mcg/mL</td><td>${mm.method2.Km.toFixed(1)} mcg/mL</td></tr>
            <tr><td>Salt factor (S)</td><td colspan="2">${mm.S}</td></tr>
            <tr><td>Current Css</td><td colspan="2">${useCss.toFixed(1)} mcg/mL</td></tr>`;

        function updateDosePredict() {
          const target = +(document.getElementById('phenyTargetCss').value) || 15;
          const valEl = document.getElementById('phenyTargetVal');
          if (valEl) valEl.textContent = target + ' mcg/mL';

          const d1 = mmDoseForCss(mm.method1.Vmax, mm.method1.Km, target, mm.S, mm.F);
          const d2 = mmDoseForCss(mm.method2.Vmax, mm.method2.Km, target, mm.S, mm.F);
          const round25 = d => Math.round(d / 25) * 25;

          const predEl = document.getElementById('phenyDosePredict');
          if (predEl)
            predEl.innerHTML = `
              <div class="result-box blue" style="padding:10px">
                <div class="result-title">Predicted Dose for Css ${target} mcg/mL</div>
                <div class="result-value" style="font-size:22px;color:var(--blue)">${isFinite(d1) ? round25(d1) : '>800'} mg/day</div>
                <div style="font-size:11px;color:var(--text2);margin-top:4px">
                  Method 1 (Km fixed): ${isFinite(d1) ? d1.toFixed(0) : 'N/A'} mg/day |
                  Method 2 (Vmax fixed): ${isFinite(d2) ? d2.toFixed(0) : 'N/A'} mg/day
                </div>
              </div>`;

          const targets = [8, 10, 12, 15, 18, 20];
          let rows = '';
          for (const t of targets) {
            const dd1 = mmDoseForCss(mm.method1.Vmax, mm.method1.Km, t, mm.S, mm.F);
            const dd2 = mmDoseForCss(mm.method2.Vmax, mm.method2.Km, t, mm.S, mm.F);
            const hl = t === Math.round(target) ? 'highlight' : '';
            rows += `<tr class="${hl}"><td>${t}</td><td>${isFinite(dd1) ? round25(dd1) : '—'}</td><td>${isFinite(dd2) ? round25(dd2) : '—'}</td></tr>`;
          }

          const tblDoseEl = document.getElementById('phenyDoseTable');
          if (tblDoseEl)
            tblDoseEl.innerHTML = `
              <table class="correction-table"><tr><th>Target Css</th><th>Dose (Km fixed)</th><th>Dose (Vmax fixed)</th></tr>${rows}</table>
              <div class="info-box amber" style="font-size:11px;margin-top:8px">
                <b>⚠ Phenytoin dose changes:</b> เปลี่ยนครั้งละ ≤50-100 mg/day เท่านั้น<br>
                เจาะ level 5-7 วันหลังเปลี่ยน dose (t½ variable, 12-36h)<br>
                ≥2 steady-state levels at different doses → more accurate Vmax/Km (2-point method)
              </div>`;

          drawGraph(mm, mm.S, mm.F, currentDose, useCss);
        }

        const targetEl = document.getElementById('phenyTargetCss');
        if (targetEl) targetEl.oninput = updateDosePredict;

        const resEl = document.getElementById('phenyResults');
        if (resEl) resEl.style.display = 'block';
        updateDosePredict();

        const scrollEl = document.getElementById('phenyResults');
        if (scrollEl) scrollEl.scrollIntoView({ behavior: 'smooth' });

        IVDrugRef.sendAnalytics({
          type: 'tdm_usage', drug_name: 'Phenytoin', action: 'calculation',
          level: totalLevel, corrected_level: wt.corrected.toFixed(1),
          free_level: freeLevel > 0 ? freeLevel : estFree.toFixed(1),
          free_level_source: freeLevel > 0 ? 'measured' : 'estimated',
          free_fraction: (freeFrac * 100).toFixed(0),
          correction_applied: pt.alb < 3.5 || pt.crcl < 15 || pt.dialysis !== 'none' ? 'yes' : 'none',
          interpretation: useCss >= 10 && useCss <= 20 ? 'therapeutic' : (useCss < 10 ? 'subtherapeutic' : (useCss <= 25 ? 'borderline_toxic' : 'toxic')),
          dose: currentDose, vmax_est: mm.method1.Vmax.toFixed(0), km: mm.method1.Km.toFixed(1),
          weight_kg: pt.wt, height_cm: pt.ht, age: pt.age, sex: pt.sex,
          scr: pt.scr, crcl: pt.crcl.toFixed(0), albumin: pt.alb, dialysis: pt.dialysis
        });
      }
    };
  })();

  // ============================================================
  // AMINOGLYCOSIDES — Hartford Nomogram + 1-compartment PK
  // ============================================================

  const AminoglycosideTDM = (function() {
    const PARAMS = {
      amikacin: {
        name: 'Amikacin',
        extDose: { low: 15, high: 20, unit: 'mg/kg' },
        convDose: { low: 5, high: 7.5, unit: 'mg/kg q8h' },
        peak_target: { ext: { low: 56, high: 64 }, conv: { low: 20, high: 35 } },
        trough_target: { ext: '<1', conv: '<5' },
        popKe: crcl => 0.00293 * crcl + 0.014,
        popVd: wt => 0.25 * wt
      },
      gentamicin: {
        name: 'Gentamicin',
        extDose: { low: 5, high: 7, unit: 'mg/kg' },
        convDose: { low: 1, high: 1.7, unit: 'mg/kg q8h' },
        peak_target: { ext: { low: 16, high: 24 }, conv: { low: 5, high: 10 } },
        trough_target: { ext: '<1', conv: '<1-2' },
        popKe: crcl => 0.00293 * crcl + 0.014,
        popVd: wt => 0.25 * wt
      }
    };

    function getIBW(ht, sex) {
      if (sex === 'M') return 50 + 2.3 * ((ht / 2.54) - 60);
      return 45.5 + 2.3 * ((ht / 2.54) - 60);
    }

    function getDosingWeight(wt, ibw) {
      if (wt > ibw * 1.2) return ibw + 0.4 * (wt - ibw);
      return wt;
    }

    function interpolateNomo(t, points) {
      if (t < points[0].t || t > points[points.length - 1].t) return null;
      for (let i = 0; i < points.length - 1; i++) {
        if (t >= points[i].t && t <= points[i + 1].t) {
          const frac = (t - points[i].t) / (points[i + 1].t - points[i].t);
          return points[i].v + frac * (points[i + 1].v - points[i].v);
        }
      }
      return null;
    }

    function hartfordNomogram(drug, randomLevel, randomTime) {
      const p = PARAMS[drug];
      if (!randomLevel || !randomTime) return null;

      if (drug === 'gentamicin') {
        if (randomTime >= 6 && randomTime <= 14) {
          const q24 = interpolateNomo(randomTime, [{ t: 6, v: 9 }, { t: 8, v: 6 }, { t: 12, v: 2 }, { t: 14, v: 0.5 }]);
          const q36 = interpolateNomo(randomTime, [{ t: 8, v: 9 }, { t: 12, v: 4 }, { t: 14, v: 2 }]);
          const q48 = interpolateNomo(randomTime, [{ t: 12, v: 9 }, { t: 14, v: 4 }]);

          if (randomLevel < q24) return { interval: 24, zone: 'q24h', color: 'green' };
          if (q36 !== null && randomLevel < q36) return { interval: 36, zone: 'q36h', color: 'amber' };
          if (q48 !== null && randomLevel < q48) return { interval: 48, zone: 'q48h', color: 'red' };
          return { interval: 48, zone: 'Hold / recheck', color: 'red' };
        }
      } else {
        if (randomTime >= 6 && randomTime <= 14) {
          const q24 = interpolateNomo(randomTime, [{ t: 6, v: 14 }, { t: 8, v: 9 }, { t: 12, v: 3.5 }, { t: 14, v: 1.5 }]);
          const q36 = interpolateNomo(randomTime, [{ t: 8, v: 14 }, { t: 12, v: 7 }, { t: 14, v: 3.5 }]);
          const q48 = interpolateNomo(randomTime, [{ t: 12, v: 14 }, { t: 14, v: 7 }]);

          if (randomLevel < q24) return { interval: 24, zone: 'q24h', color: 'green' };
          if (q36 !== null && randomLevel < q36) return { interval: 36, zone: 'q36h', color: 'amber' };
          if (q48 !== null && randomLevel < q48) return { interval: 48, zone: 'q48h', color: 'red' };
          return { interval: 48, zone: 'Hold / recheck', color: 'red' };
        }
      }
      return null;
    }

    function drawAGGraph(drug, dose, interval, infDuration, ke, vd) {
      const canvas = document.getElementById('agGraph');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 280 * dpr;
      ctx.scale(dpr, dpr);
      const W = rect.width, H = 280;
      const pad = { left: 48, right: 16, top: 16, bottom: 36 };
      const gW = W - pad.left - pad.right, gH = H - pad.top - pad.bottom;
      const totalTime = interval * 3;
      const maxConc = drug === 'amikacin' ? 80 : 30;
      const tX = t => pad.left + (t / totalTime) * gW, cY = c => pad.top + gH - (Math.min(c, maxConc) / maxConc) * gH;

      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      ctx.lineWidth = 0.5;
      for (let t = 0; t <= totalTime; t += Math.max(4, interval / 4)) {
        ctx.beginPath();
        ctx.moveTo(tX(t), pad.top);
        ctx.lineTo(tX(t), H - pad.bottom);
        ctx.stroke();
      }
      for (let c = 0; c <= maxConc; c += 10) {
        ctx.beginPath();
        ctx.moveTo(pad.left, cY(c));
        ctx.lineTo(W - pad.right, cY(c));
        ctx.stroke();
      }

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const k0 = dose / infDuration;
      let first = true;
      for (let t = 0; t <= totalTime; t += 0.2) {
        let conc = 0;
        for (let n = 0; n < 3; n++) {
          const tStart = n * interval, tEnd = tStart + infDuration;
          if (t <= tStart) continue;
          if (t <= tEnd) conc += (k0 / (ke * vd)) * (1 - Math.exp(-ke * (t - tStart)));
          else conc += (k0 / (ke * vd)) * (1 - Math.exp(-ke * infDuration)) * Math.exp(-ke * (t - tEnd));
        }
        const x = tX(t), y = cY(conc);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '10px "DM Sans"';
      ctx.textAlign = 'center';
      for (let t = 0; t <= totalTime; t += Math.max(4, interval / 4)) ctx.fillText(t + 'h', tX(t), H - pad.bottom + 14);
      ctx.textAlign = 'right';
      for (let c = 0; c <= maxConc; c += 10) ctx.fillText(c, pad.left - 5, cY(c) + 3);
      ctx.save();
      ctx.translate(11, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('mcg/mL', 0, 0);
      ctx.restore();
    }

    return {
      updateUI() {
        const drug = document.getElementById('agDrug').value;
        const p = PARAMS[drug];
        const pt = updateCrCl();
        const ibw = getIBW(pt.ht, pt.sex);
        const dw = getDosingWeight(pt.wt, ibw);
        const extDose = Math.round(dw * p.extDose.low / 50) * 50;
        const el = document.getElementById('agDose');
        if (el) el.value = extDose;
      },
      run() {
        const pt = updateCrCl();
        const drug = document.getElementById('agDrug').value;
        const strategy = document.getElementById('agStrategy').value;
        const dose = +(document.getElementById('agDose').value) || 0;
        const peak = +(document.getElementById('agPeak').value) || 0;
        const trough = +(document.getElementById('agTrough').value) || 0;
        const randomLvl = +(document.getElementById('agRandom').value) || 0;
        const randomTime = +(document.getElementById('agRandomTime').value) || 8;
        const infDuration = +(document.getElementById('agInfusion').value) || 0.5;

        const p = PARAMS[drug];
        const ibw = getIBW(pt.ht, pt.sex);
        const dw = getDosingWeight(pt.wt, ibw);
        const popKe = p.popKe(pt.crcl);
        const popVd = p.popVd(dw);
        const popHL = Math.LN2 / popKe;

        let nomoResult = null;
        if (strategy === 'extended' && randomLvl > 0) {
          nomoResult = hartfordNomogram(drug, randomLvl, randomTime);
        }

        const nomoEl = document.getElementById('agNomogram');
        if (nomoEl)
          nomoEl.innerHTML = nomoResult ?
            `<div class="result-box ${nomoResult.color}">
              <div class="result-title">Hartford Nomogram Result</div>
              <div class="result-value" style="font-size:24px;color:var(--${nomoResult.color})">${nomoResult.zone}</div>
              <div class="result-sub">Level ${randomLvl} mcg/mL at ${randomTime}h post-dose → recommend ${nomoResult.zone}</div>
            </div>` :
            `<div class="info-box amber">ใส่ Random level + time เพื่อใช้ Hartford nomogram (extended-interval dosing)</div>`;

        let ke = popKe, vd = popVd, hl = popHL, pkSource = 'Population estimate';
        if (peak > 0 && trough > 0 && peak > trough) {
          const peakTime = infDuration + 0.5;
          const troughTime = nomoResult ? nomoResult.interval - 0.5 : (strategy === 'extended' ? 23.5 : 7.5);
          ke = Math.log(peak / trough) / (troughTime - peakTime);
          hl = Math.LN2 / ke;
          vd = dose / ((peak / (Math.exp(-ke * 0.5))) * (1 - Math.exp(-ke * (strategy === 'extended' ? 24 : 8))));
          if (vd <= 0 || vd > 200 * pt.wt) vd = popVd;
          pkSource = 'Calculated from measured levels';
        }

        const interval = strategy === 'extended' ? (nomoResult ? nomoResult.interval : 24) : 8;
        const k0 = dose / infDuration;
        const acc = 1 / (1 - Math.exp(-ke * interval));
        const ssPeak = (k0 / (ke * vd)) * (1 - Math.exp(-ke * infDuration)) * acc;
        const ssTrough = ssPeak * Math.exp(-ke * (interval - infDuration));
        const auc24 = dose / (ke * vd) * (24 / interval) * acc;

        const pkResEl = document.getElementById('agPkResult');
        if (pkResEl)
          pkResEl.innerHTML = `
            <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
              <div class="stat"><div class="stat-label">Est. Peak</div><div class="stat-val" style="color:var(--blue)">${ssPeak.toFixed(1)}</div></div>
              <div class="stat"><div class="stat-label">Est. Trough</div><div class="stat-val" style="color:${ssTrough < (drug === 'amikacin' ? 5 : 2) ? 'var(--green)' : 'var(--red)'}">${ssTrough.toFixed(1)}</div></div>
              <div class="stat"><div class="stat-label">t½</div><div class="stat-val">${hl.toFixed(1)}h</div></div>
            </div>`;

        const pkTblEl = document.getElementById('agPkTable');
        if (pkTblEl)
          pkTblEl.innerHTML = `
            <tr><td>Drug</td><td style="color:var(--blue)">${p.name}</td></tr>
            <tr><td>Strategy</td><td>${strategy === 'extended' ? 'Extended-interval (ODA)' : 'Conventional (MDD)'}</td></tr>
            <tr><td>PK source</td><td>${pkSource}</td></tr>
            <tr><td>Dosing weight</td><td>${dw.toFixed(1)} kg ${pt.wt > ibw * 1.2 ? '(ABW)' : '(TBW)'}</td></tr>
            <tr><td>IBW</td><td>${ibw.toFixed(1)} kg</td></tr>
            <tr><td>Ke</td><td>${ke.toFixed(4)} hr⁻¹</td></tr>
            <tr><td>Vd</td><td>${vd.toFixed(1)} L (${(vd / dw).toFixed(2)} L/kg)</td></tr>
            <tr><td>Half-life</td><td>${hl.toFixed(1)} hr</td></tr>
            <tr><td>Interval</td><td>q${interval}h</td></tr>`;

        const targetPeak = strategy === 'extended' ? p.peak_target.ext : p.peak_target.conv;
        const recDoseLow = Math.round(dw * p.extDose.low / 50) * 50;
        const recDoseHigh = Math.round(dw * p.extDose.high / 50) * 50;

        const doseRecEl = document.getElementById('agDoseRec');
        if (doseRecEl)
          doseRecEl.innerHTML = `
            <div class="result-box blue" style="padding:12px">
              <div class="result-title">Recommended Dose</div>
              <div class="result-value" style="font-size:20px;color:var(--blue)">${recDoseLow}–${recDoseHigh} mg q${interval}h</div>
              <div style="font-size:12px;color:var(--text2);margin-top:6px">
                ${p.extDose.low}–${p.extDose.high} mg/kg × ${dw.toFixed(0)}kg | Infuse over ${infDuration * 60} min
              </div>
            </div>
            <div class="info-box blue" style="font-size:11px">
              <b>Target levels (${strategy === 'extended' ? 'Extended' : 'Conventional'}):</b><br>
              Peak: ${targetPeak.low}–${targetPeak.high} mcg/mL | Trough: ${p.trough_target[strategy === 'extended' ? 'ext' : 'conv']} mcg/mL<br>
              <b>Next level timing:</b> Random level 6-14h post-dose (Hartford) หรือ Peak 30 min post-inf + Trough 30 min pre-dose<br>
              <b>Monitor:</b> SCr daily, audiometry weekly, vestibular function
            </div>`;

        const agShareEl = document.getElementById('agDoseRec');
        if (agShareEl) agShareEl.innerHTML += '<div class="share-row"><button class="btn" data-action="shareTDM" data-drug="aminoglycoside">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="aminoglycoside">\ud83d\udcc4 PDF</button></div>';

        drawAGGraph(drug, dose, interval, infDuration, ke, vd);
        const agResEl = document.getElementById('agResults');
        if (agResEl) agResEl.style.display = 'block';
        if (agResEl) agResEl.scrollIntoView({ behavior: 'smooth' });

        IVDrugRef.sendAnalytics({
          type: 'tdm_usage', drug_name: p.name, action: 'calculation',
          strategy, dose: dose + 'mg q' + interval + 'h', interval: interval,
          nomogram_result: nomoResult ? nomoResult.zone : 'N/A',
          est_peak: ssPeak.toFixed(1), est_trough: ssTrough.toFixed(1),
          interpretation: ssTrough < (drug === 'amikacin' ? 5 : 2) ? 'therapeutic' : 'elevated_trough',
          ke: ke.toFixed(4), vd: vd.toFixed(1), halflife: hl.toFixed(1), pk_source: pkSource,
          dosing_weight: dw.toFixed(1), ibw: ibw.toFixed(1),
          measured_peak: peak || '', measured_trough: trough || '',
          measured_random: randomLvl || '', random_time: randomTime || '',
          infusion_duration: infDuration,
          weight_kg: pt.wt, height_cm: pt.ht, age: pt.age, sex: pt.sex,
          scr: pt.scr, crcl: pt.crcl.toFixed(0), albumin: pt.alb, dialysis: pt.dialysis
        });
      }
    };
  })();

  // ============================================================
  // VALPROATE — Free level correction + dose-level relationship
  // ============================================================

  const ValproateTDM = (function() {
    function estimateFreeFraction(totalVPA, albumin) {
      const baseFree = 0.10;
      const albFactor = albumin < 3.5 ? (4.0 / albumin) * 1.2 : 1.0;
      const concFactor = totalVPA > 75 ? 1 + (totalVPA - 75) * 0.003 : 1.0;
      return Math.min(baseFree * albFactor * concFactor, 0.50);
    }

    function correctedTotal(totalVPA, albumin) {
      if (albumin >= 3.5) return totalVPA;
      const ff_normal = 0.10;
      const ff_patient = estimateFreeFraction(totalVPA, albumin);
      return totalVPA * (ff_patient / ff_normal);
    }

    return {
      run() {
        const pt = updateCrCl();
        const totalVPA = +(document.getElementById('vpaLevel').value) || 0;
        const freeVPA = +(document.getElementById('vpaFree').value) || 0;
        const currentDose = +(document.getElementById('vpaDose').value) || 0;
        const form = document.getElementById('vpaForm').value;
        const indication = document.getElementById('vpaIndication').value;

        if (totalVPA <= 0) { alert('กรุณาใส่ค่า Valproate level'); return; }

        const ff = estimateFreeFraction(totalVPA, pt.alb);
        const estFree = totalVPA * ff;
        const corrTotal = correctedTotal(totalVPA, pt.alb);

        const targets = {
          epilepsy: { total: { low: 50, high: 100 }, free: { low: 5, high: 15 }, label: 'Epilepsy' },
          SE: { total: { low: 80, high: 120 }, free: { low: 10, high: 20 }, label: 'Status Epilepticus' },
          bipolar: { total: { low: 50, high: 125 }, free: { low: 5, high: 15 }, label: 'Bipolar' },
          migraine: { total: { low: 50, high: 100 }, free: { low: 5, high: 15 }, label: 'Migraine' }
        };
        const target = targets[indication];

        const freeEl = document.getElementById('vpaFreeCorrection');
        if (freeEl)
          freeEl.innerHTML = `
            <div class="stat-grid" style="grid-template-columns:1fr 1fr 1fr">
              <div class="stat"><div class="stat-label">Total VPA</div><div class="stat-val" style="color:var(--blue)">${totalVPA}</div><div style="font-size:10px;color:var(--text3)">mcg/mL</div></div>
              <div class="stat"><div class="stat-label">Est. Free VPA</div><div class="stat-val" style="color:var(--purple)">${freeVPA > 0 ? freeVPA.toFixed(1) : estFree.toFixed(1)}</div><div style="font-size:10px;color:var(--text3)">${freeVPA > 0 ? 'measured' : 'estimated'}</div></div>
              <div class="stat"><div class="stat-label">Free Fraction</div><div class="stat-val" style="color:var(--cyan)">${freeVPA > 0 ? (freeVPA / totalVPA * 100).toFixed(0) : (ff * 100).toFixed(0)}%</div><div style="font-size:10px;color:var(--text3)">${freeVPA > 0 ? 'actual' : 'estimated'}</div></div>
            </div>
            ${pt.alb < 3.5 ? `<div class="info-box amber" style="font-size:11px"><b>⚠ Hypoalbuminemia (Alb ${pt.alb}):</b> Free fraction เพิ่มขึ้น → total level อาจ misleading<br>
            Corrected total ≈ ${corrTotal.toFixed(0)} mcg/mL | ควรเจาะ free VPA level เพื่อ accuracy<br>
            Total level ${totalVPA} อาจ underestimate pharmacological activity</div>` : ''}
            ${totalVPA > 75 ? `<div class="info-box purple" style="font-size:11px"><b>Saturable protein binding:</b> ที่ total VPA >${'75'} mcg/mL free fraction จะเพิ่มขึ้น non-linearly<br>ควรพิจารณา free VPA level เพื่อ dose optimization</div>` : ''}`;

        const useFree = freeVPA > 0 ? freeVPA : estFree;
        let interpCls = 'green', interpMsg = '';
        if (totalVPA < target.total.low) { interpCls = 'amber'; interpMsg = `⚠ SUBTHERAPEUTIC — ต่ำกว่า target ${target.label} (${target.total.low}-${target.total.high})`; }
        else if (totalVPA <= target.total.high) { interpCls = 'green'; interpMsg = `✅ THERAPEUTIC (${target.total.low}-${target.total.high} mcg/mL for ${target.label})`; }
        else if (totalVPA <= 150) { interpCls = 'amber'; interpMsg = `⚠ SUPRATHERAPEUTIC — สูงกว่า target, monitor toxicity`; }
        else { interpCls = 'red'; interpMsg = '🚨 TOXIC — พิจารณาลด dose/หยุดยา'; }

        const interpEl = document.getElementById('vpaInterpretation');
        if (interpEl)
          interpEl.innerHTML = `
            <div class="result-box ${interpCls}">
              <div class="result-value" style="font-size:20px;color:var(--${interpCls})">${interpMsg}</div>
              <div style="font-size:12px;color:var(--text2);margin-top:6px">
                Total: ${totalVPA} mcg/mL | Free: ${useFree.toFixed(1)} mcg/mL (target free: ${target.free.low}-${target.free.high})
              </div>
            </div>
            <div class="info-box red" style="font-size:11px;margin-top:8px">
              <b>Toxicity signs:</b> N/V, tremor, sedation, thrombocytopenia<br>
              >100: ataxia, confusion | >150: coma risk<br>
              <b>Check:</b> Ammonia (hyperammonemia สามารถเกิดได้ทุก level), LFTs, CBC+Plt
            </div>`;

        function updateDoseRec() {
          const targetLevel = +(document.getElementById('vpaTarget').value) || 75;
          const valEl = document.getElementById('vpaTargetVal');
          if (valEl) valEl.textContent = targetLevel + ' mcg/mL';

          const newDose = Math.round(currentDose * (targetLevel / totalVPA) / 100) * 100;
          const maxDoseDay = 60 * pt.wt;

          let scheduleText = '';
          if (form === 'DR') scheduleText = `${newDose}mg/day ÷ 2-3 doses (Depakote DR)`;
          else if (form === 'ER') scheduleText = `${newDose}mg/day ÷ 1 dose (Depakote ER, round to 250/500)`;
          else if (form === 'syrup') scheduleText = `${newDose}mg/day ÷ 3 doses (Syrup/Solution)`;
          else scheduleText = `${newDose}mg/day (IV → switch PO when able)`;

          const doseEl = document.getElementById('vpaDoseRec');
          if (doseEl)
            doseEl.innerHTML = `
              <div class="result-box blue" style="padding:12px">
                <div class="result-title">Predicted Dose for Target ${targetLevel} mcg/mL</div>
                <div class="result-value" style="font-size:22px;color:var(--blue)">${newDose} mg/day</div>
                <div style="font-size:12px;color:var(--text2);margin-top:4px">${scheduleText}</div>
              </div>
              <div class="info-box teal" style="font-size:11px">
                <b>Linear proportion:</b> New dose = ${currentDose} × (${targetLevel}/${totalVPA}) = ${(currentDose * targetLevel / totalVPA).toFixed(0)} mg/day<br>
                <b>Max dose:</b> ~60 mg/kg/day = ${maxDoseDay.toFixed(0)} mg/day<br>
                <b>Next level:</b> 3-5 วัน after dose change (trough, before AM dose)<br>
                <b>DR→ER conversion:</b> ER dose = DR dose × 1.1-1.2 (ER ↓ bioavailability ~10-20%)
              </div>`;
        }

        const targetEl = document.getElementById('vpaTarget');
        if (targetEl) targetEl.oninput = updateDoseRec;

        const interEl = document.getElementById('vpaInteractions');
        if (interEl)
          interEl.innerHTML = `
            <div class="info-box red" style="font-size:11px">
              <b>🚨 CONTRAINDICATED combinations:</b><br>
              • <b>Meropenem/Carbapenem:</b> ลด VPA level 60-100%! ห้ามให้ร่วมกัน<br>
              • <b>Hepatotoxic drugs + mitochondrial disease:</b> Fatal hepatotoxicity risk
            </div>
            <div class="info-box amber" style="font-size:11px">
              <b>⚠ Significant interactions:</b><br>
              • <b>Lamotrigine:</b> VPA ↑ LTG level 2× → ลด LTG dose 50%<br>
              • <b>Phenobarbital:</b> VPA ↑ PB level<br>
              • <b>Phenytoin:</b> Complex (VPA ↑ free PHT, ↓ total PHT; PHT ↓ VPA)<br>
              • <b>Warfarin/ASA:</b> ↑ free VPA, ↑ bleeding risk (Plt inhibition + protein displacement)<br>
              • <b>Topiramate:</b> ↑ ammonia (both hyperammonemic)
            </div>
            <div class="info-box blue" style="font-size:11px">
              <b>Monitoring checklist:</b><br>
              • LFTs: baseline + periodic (q3-6 months)<br>
              • CBC + Platelets: baseline + periodic<br>
              • Ammonia: if symptoms (lethargy, vomiting, confusion)<br>
              • VPA level: 3-5 days after dose change, trough preferred<br>
              • Free VPA level: if albumin low, VPA >75, uremia, pregnancy, elderly
            </div>`;

        const vpaInterEl = document.getElementById('vpaInteractions');
        if (vpaInterEl) vpaInterEl.innerHTML += '<div class="share-row"><button class="btn" data-action="shareTDM" data-drug="valproate">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="valproate">\ud83d\udcc4 PDF</button></div>';

        const vpaResEl = document.getElementById('vpaResults');
        if (vpaResEl) vpaResEl.style.display = 'block';
        updateDoseRec();

        if (vpaResEl) vpaResEl.scrollIntoView({ behavior: 'smooth' });

        IVDrugRef.sendAnalytics({
          type: 'tdm_usage', drug_name: 'Valproate', action: 'calculation',
          level: totalVPA, free_level: freeVPA > 0 ? freeVPA : estFree.toFixed(1),
          free_fraction: (freeVPA > 0 ? (freeVPA / totalVPA * 100) : (ff * 100)).toFixed(0),
          corrected_total: pt.alb < 3.5 ? corrTotal.toFixed(0) : totalVPA,
          interpretation: totalVPA < target.total.low ? 'subtherapeutic' : (totalVPA <= target.total.high ? 'therapeutic' : (totalVPA <= 150 ? 'supratherapeutic' : 'toxic')),
          dose: currentDose + 'mg/d', indication, formulation: form,
          hypoalbumin: pt.alb < 3.5 ? 'yes' : 'no',
          free_level_source: freeVPA > 0 ? 'measured' : 'estimated',
          weight_kg: pt.wt, height_cm: pt.ht, age: pt.age, sex: pt.sex,
          scr: pt.scr, crcl: pt.crcl.toFixed(0), albumin: pt.alb, dialysis: pt.dialysis
        });
      }
    };
  })();

  // ============================================================
  // PHENYTOIN AUTO-UPDATE on patient change
  // ============================================================

  function updatePhenyCorrection() {
    const totalLevel = +(document.getElementById('phenyLevel').value) || 0;
    if (totalLevel <= 0) return;
    const pt = updateCrCl();
    const alb = pt.alb, crcl = pt.crcl, dialysis = pt.dialysis;

    let corrected, formula;
    if (dialysis !== 'none' || crcl < 15) {
      corrected = totalLevel / (0.1 * alb + 0.1);
      formula = `${totalLevel} / (0.1 × ${alb} + 0.1) = ${corrected.toFixed(1)}`;
    } else if (alb < 3.5) {
      corrected = totalLevel / (0.2 * alb + 0.1);
      formula = `${totalLevel} / (0.2 × ${alb} + 0.1) = ${corrected.toFixed(1)}`;
    } else {
      corrected = totalLevel;
      formula = 'No correction needed';
    }

    const el = document.getElementById('phenyCorrection');
    if (el)
      el.innerHTML = `
        <div class="result-box ${corrected >= 10 && corrected <= 20 ? 'green' : (corrected < 10 ? 'amber' : 'red')}">
          <div class="result-title">Corrected Total Phenytoin (Winter-Tozer)</div>
          <div class="result-value" style="color:var(--${corrected >= 10 && corrected <= 20 ? 'green' : (corrected < 10 ? 'amber' : 'red')})">${corrected.toFixed(1)} mcg/mL</div>
          <div class="result-sub">Measured: ${totalLevel} → Corrected: ${corrected.toFixed(1)} | Alb: ${alb} | CrCl: ${crcl.toFixed(0)}</div>
        </div>
        <div class="info-box cyan" style="font-size:11px"><b>Formula:</b> ${formula}</div>`;
  }

  // ============================================================
  // INITIALIZATION & EVENT LISTENERS
  // ============================================================

  function init() {
    // Wrap in DOMContentLoaded to ensure DOM is ready
    function onReady() {
      IVDrugRef.patientCtx.init();
      updateCrCl();
      VancoTDM.init();
      AminoglycosideTDM.updateUI();

      // Patient field listeners
      ['ptWt', 'ptAge', 'ptScr', 'ptHt', 'ptAlb'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
          updateCrCl();
          updatePhenyCorrection();
        });
      });

      ['ptSex', 'ptDialysis'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
          updateCrCl();
          updatePhenyCorrection();
        });
      });

      // Phenytoin auto-update
      ['phenyLevel', 'phenyFree'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePhenyCorrection);
      });

      // Vancomycin optimizer listeners
      ['vancoOptDose', 'vancoOptInterval', 'vancoOptInfusion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { VancoTDM.updateOpt(); });
      });

      // Window resize for responsive graphs
      window.addEventListener('resize', () => {
        if (activeDrug === 'vancomycin') VancoTDM.updateOpt();
      });

      // Initial phenytoin correction display
      updatePhenyCorrection();

      // Track page view
      IVDrugRef.trackPageView('tdm');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  }

  // ============================================================
  // TACROLIMUS — Bayesian MAP + MCMC
  // ============================================================
  const TacrolimusTDM = (function() {
    const TACRO_MODELS = [
      { id: 'staatz', name: 'Staatz 2004', pop: 'General transplant',
        ref: 'Br J Clin Pharmacol 2004;57:298-309',
        clFn: (wt, hct) => 21.1 * Math.pow(wt / 70, 0.75) * Math.pow((hct || 33) / 33, -0.51),
        vdFn: (wt) => 1.0 * wt, kaFn: () => 4.5, fFn: () => 0.25,
        omega_cl: 0.36, omega_vd: 0.25, sigma: 0.15 },
      { id: 'antignac', name: 'Antignac 2007', pop: 'Renal transplant',
        ref: 'Clin Pharmacokinet 2007;46:85-94',
        clFn: (wt, hct, postTxDay, cyp3a5) => {
          let cl = 19.5 * Math.pow(wt / 70, 0.75);
          if (postTxDay && postTxDay < 14) cl *= 0.75;
          if (cyp3a5 === 'expressor') cl *= 1.55;
          return cl;
        },
        vdFn: (wt) => 0.95 * wt, kaFn: () => 4.0, fFn: () => 0.23,
        omega_cl: 0.30, omega_vd: 0.20, sigma: 0.12 },
      { id: 'han', name: 'Han 2013', pop: 'Asian population',
        ref: 'Ther Drug Monit 2013;35:209-218',
        clFn: (wt, hct, postTxDay, cyp3a5) => {
          let cl = 22.1 * Math.pow(wt / 70, 0.75);
          if (cyp3a5 === 'expressor') cl *= 1.58;
          if ((hct || 33) > 35) cl *= 1.12;
          return cl;
        },
        vdFn: (wt) => 1.1 * wt, kaFn: () => 4.48, fFn: () => 0.25,
        omega_cl: 0.32, omega_vd: 0.22, sigma: 0.14 }
    ];

    function getTargetRange(txType, postTxDay) {
      const early = postTxDay <= 90;
      const ranges = {
        kidney: early ? [8, 12] : [5, 10],
        liver:  early ? [10, 15] : [5, 10],
        heart:  early ? [10, 15] : [5, 10],
        lung:   early ? [10, 15] : [8, 12],
        other:  early ? [8, 12] : [5, 10]
      };
      return ranges[txType] || ranges.other;
    }

    function predictTacroConc(t, cl, vd, ka, F, dose, interval) {
      if (!cl || cl <= 0 || !vd || vd <= 0 || !ka || ka <= 0) return 0;
      const ke = cl / vd;
      if (!isFinite(ke) || ke <= 0) return 0;
      const acc_ke = 1 / (1 - Math.exp(-ke * interval));
      const acc_ka = 1 / (1 - Math.exp(-ka * interval));
      const t_mod = t % interval;
      const c = (F * dose * ka) / (vd * (ka - ke)) *
        (acc_ke * Math.exp(-ke * t_mod) - acc_ka * Math.exp(-ka * t_mod));
      return isFinite(c) && c > 0 ? c : 0;
    }

    function bayesianMAP(pt, troughLevel, dose, interval, model) {
      const hct = +(document.getElementById('tacroHct')?.value) || 33;
      const postTxDay = +(document.getElementById('tacroPostTxDay')?.value) || 30;
      const cyp3a5 = document.getElementById('tacroCYP3A5')?.value || 'unknown';
      const popCL = model.clFn(pt.wt, hct, postTxDay, cyp3a5);
      const popVd = model.vdFn(pt.wt);
      const ka = model.kaFn();
      const F = model.fFn();

      function obj(cl, vd) {
        if (cl <= 0 || vd <= 0 || !isFinite(cl) || !isFinite(vd)) return 1e10;
        let o = Math.pow(Math.log(cl / popCL), 2) / model.omega_cl +
                Math.pow(Math.log(vd / popVd), 2) / model.omega_vd;
        if (!isFinite(o)) return 1e10;
        if (troughLevel > 0) {
          const pred = predictTacroConc(interval - 0.01, cl, vd, ka, F, dose, interval);
          if (pred <= 0 || !isFinite(pred)) return 1e10;
          o += Math.pow(Math.log(troughLevel) - Math.log(pred), 2) / model.sigma;
        }
        return isFinite(o) ? o : 1e10;
      }

      // Grid search + Nelder-Mead (same pattern as Vancomycin)
      let bCL = popCL, bVd = popVd, bObj = obj(popCL, popVd);
      for (let ci = 0.3; ci <= 3; ci += 0.15)
        for (let vi = 0.5; vi <= 2; vi += 0.15) {
          const o = obj(popCL * ci, popVd * vi);
          if (o < bObj) { bObj = o; bCL = popCL * ci; bVd = popVd * vi; }
        }
      let sx = [{ cl: bCL, vd: bVd }, { cl: bCL * 1.05, vd: bVd }, { cl: bCL, vd: bVd * 1.05 }];
      const f = p => obj(p.cl, p.vd);
      for (let it = 0; it < 200; it++) {
        sx.sort((a, b) => f(a) - f(b));
        const cx = (sx[0].cl + sx[1].cl) / 2, cy = (sx[0].vd + sx[1].vd) / 2;
        const r = { cl: 2 * cx - sx[2].cl, vd: 2 * cy - sx[2].vd }, fr = f(r);
        if (fr < f(sx[0])) { const e = { cl: 3 * cx - 2 * sx[2].cl, vd: 3 * cy - 2 * sx[2].vd }; sx[2] = f(e) < fr ? e : r; }
        else if (fr < f(sx[1])) sx[2] = r;
        else { const c2 = { cl: (cx + sx[2].cl) / 2, vd: (cy + sx[2].vd) / 2 }; if (f(c2) < f(sx[2])) sx[2] = c2;
          else { sx[1] = { cl: (sx[0].cl + sx[1].cl) / 2, vd: (sx[0].vd + sx[1].vd) / 2 }; sx[2] = { cl: (sx[0].cl + sx[2].cl) / 2, vd: (sx[0].vd + sx[2].vd) / 2 }; } }
        if (Math.abs(f(sx[0]) - f(sx[2])) < 1e-10) break;
      }
      sx.sort((a, b) => f(a) - f(b));
      const r = sx[0]; const ke = r.cl / r.vd;
      const predTrough = predictTacroConc(interval - 0.01, r.cl, r.vd, ka, F, dose, interval);
      return {
        cl: r.cl, vd: r.vd, ke, ka, F, halflife: Math.LN2 / ke, popCL, popVd,
        predTrough, objValue: f(r),
        method: troughLevel > 0 ? 'Bayesian MAP' : 'Population PK',
        model: model.name, modelId: model.id
      };
    }

    function runMCMC(pt, troughLevel, dose, interval, model, mapR, nSamp, cb) {
      const hct = +(document.getElementById('tacroHct')?.value) || 33;
      const postTxDay = +(document.getElementById('tacroPostTxDay')?.value) || 30;
      const cyp3a5 = document.getElementById('tacroCYP3A5')?.value || 'unknown';
      const popCL = model.clFn(pt.wt, hct, postTxDay, cyp3a5);
      const popVd = model.vdFn(pt.wt);
      const ka = model.kaFn(), F = model.fFn();

      function logPost(cl, vd) {
        if (cl <= 0 || vd <= 0 || !isFinite(cl) || !isFinite(vd)) return -1e10;
        let lp = -0.5 * (Math.pow(Math.log(cl / popCL), 2) / model.omega_cl + Math.pow(Math.log(vd / popVd), 2) / model.omega_vd);
        if (!isFinite(lp)) return -1e10;
        if (troughLevel > 0) {
          const pred = predictTacroConc(interval - 0.01, cl, vd, ka, F, dose, interval);
          if (pred <= 0 || !isFinite(pred)) return -1e10;
          lp -= 0.5 * Math.pow(Math.log(troughLevel) - Math.log(pred), 2) / model.sigma;
        }
        return isFinite(lp) ? lp : -1e10;
      }

      const samples = [];
      let cl = mapR.cl, vd = mapR.vd, lp = logPost(cl, vd);
      const sdCL = Math.sqrt(model.omega_cl) * popCL * 0.15;
      const sdVd = Math.sqrt(model.omega_vd) * popVd * 0.15;
      let accepted = 0;
      const burnin = Math.floor(nSamp * 0.3), total = nSamp + burnin;
      let batch = 0; const batchSz = 100;

      function step() {
        const end = Math.min(batch + batchSz, total);
        for (let i = batch; i < end; i++) {
          const u1 = Math.max(Math.random(), 1e-15), u2 = Math.random();
          const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
          const pCL = cl + z1 * sdCL * 2.4, pVd = vd + z2 * sdVd * 2.4;
          if (!isFinite(pCL) || !isFinite(pVd)) continue;
          const pLP = logPost(pCL, pVd);
          if (isFinite(pLP) && pLP > -1e9 && Math.log(Math.random()) < pLP - lp) { cl = pCL; vd = pVd; lp = pLP; accepted++; }
          if (i >= burnin && cl > 0 && vd > 0 && isFinite(cl) && isFinite(vd)) {
            const trough = predictTacroConc(interval - 0.01, cl, vd, ka, F, dose, interval);
            samples.push({ cl, vd, ke: cl / vd, trough });
          }
        }
        batch = end;
        if (batch < total) setTimeout(step, 0);
        else cb(samples, accepted / total);
      }
      step();
    }

    return {
      run() {
        const pt = updateCrCl();
        const troughLevel = +(document.getElementById('tacroLevel')?.value) || 0;
        const dose = +(document.getElementById('tacroDose')?.value) || 2;
        const interval = 12; // BID
        const txType = document.getElementById('tacroTxType')?.value || 'kidney';
        const postTxDay = +(document.getElementById('tacroPostTxDay')?.value) || 30;
        const target = getTargetRange(txType, postTxDay);

        if (troughLevel <= 0) { alert('กรุณาใส่ trough level'); return; }

        // Run MAP for all models
        const allResults = TACRO_MODELS.map(m => bayesianMAP(pt, troughLevel, dose, interval, m));
        let bestIdx = allResults.reduce((bi, r, i) => r.objValue < allResults[bi].objValue ? i : bi, 0);
        const best = allResults[bestIdx];
        const bestModel = TACRO_MODELS[bestIdx];

        // Interpretation
        let cls = 'green', msg = '✅ อยู่ใน target range (' + target[0] + '-' + target[1] + ' ng/mL)';
        if (troughLevel < target[0]) { cls = 'amber'; msg = '⚠ ต่ำกว่า target → เสี่ยง rejection'; }
        else if (troughLevel > target[1]) { cls = 'red'; msg = '⚠ สูงกว่า target → เสี่ยง nephrotoxicity'; }
        if (troughLevel > 20) { cls = 'red'; msg = '🚨 Toxic range → ลด dose ทันที / hold'; }

        const interpEl = document.getElementById('tacroInterpretation');
        if (interpEl) interpEl.innerHTML =
          '<div class="result-box ' + cls + '"><div class="result-title">Trough Level (' + bestModel.name + ')</div>' +
          '<div class="result-value" style="color:var(--' + cls + ')">' + troughLevel.toFixed(1) + ' ng/mL</div>' +
          '<div class="result-sub" style="color:var(--' + cls + ')">' + msg + '</div>' +
          '<div style="font-size:11px;margin-top:6px;color:var(--text2)">Target: ' + target[0] + '-' + target[1] + ' ng/mL (' + txType + ', day ' + postTxDay + ')</div></div>';

        // PK Table
        const pkTableEl = document.getElementById('tacroPkTable');
        if (pkTableEl) pkTableEl.innerHTML =
          '<tr><td>Method</td><td style="color:var(--blue)">' + best.method + '</td></tr>' +
          '<tr><td>Model</td><td>' + best.model + '</td></tr>' +
          '<tr><td>CL (MAP)</td><td>' + best.cl.toFixed(2) + ' L/hr</td></tr>' +
          '<tr><td>Vd (MAP)</td><td>' + best.vd.toFixed(1) + ' L</td></tr>' +
          '<tr><td>t½</td><td>' + best.halflife.toFixed(1) + ' hr</td></tr>' +
          '<tr><td>Predicted Trough</td><td>' + best.predTrough.toFixed(1) + ' ng/mL</td></tr>' +
          '<tr><td>Pop CL</td><td>' + best.popCL.toFixed(2) + ' L/hr</td></tr>' +
          '<tr><td>Pop Vd</td><td>' + best.popVd.toFixed(1) + ' L</td></tr>';

        // MCMC
        runMCMC(pt, troughLevel, dose, interval, bestModel, best, 1500, function(samples, acceptRate) {
          const troughArr = samples.map(s => s.trough).filter(v => isFinite(v) && v > 0).sort((a, b) => a - b);
          const lo = troughArr.length > 0 ? troughArr[Math.floor(troughArr.length * 0.05)] : NaN;
          const hi = troughArr.length > 0 ? troughArr[Math.floor(troughArr.length * 0.95)] : NaN;

          const ciEl = document.getElementById('tacroCiInfo');
          if (ciEl) ciEl.innerHTML = '<div class="info-box cyan" style="font-size:11px"><b>90% Credible Interval (' + samples.length + ' MCMC samples):</b><br>' +
            'Predicted Trough: ' + (isFinite(lo) ? lo.toFixed(1) : '?') + ' – ' + (isFinite(hi) ? hi.toFixed(1) : '?') + ' ng/mL | Accept: ' + (acceptRate * 100).toFixed(0) + '%</div>';

          // Dose optimization table
          const doseTableEl = document.getElementById('tacroDoseTable');
          if (doseTableEl) {
            const doses = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
            let html = '<table class="pk-table"><tr><th>Dose (mg BID)</th><th>Predicted Trough</th><th>Status</th></tr>';
            for (const d of doses) {
              const predT = predictTacroConc(interval - 0.01, best.cl, best.vd, best.ka, best.F, d, interval);
              const inTarget = predT >= target[0] && predT <= target[1];
              const c = inTarget ? 'green' : (predT < target[0] ? 'amber' : 'red');
              html += '<tr><td>' + d + ' mg</td><td style="color:var(--' + c + ')">' + predT.toFixed(1) + ' ng/mL</td><td style="color:var(--' + c + ')">' +
                (inTarget ? '✅ In target' : (predT < target[0] ? '⚠ Below' : '⚠ Above')) + '</td></tr>';
            }
            html += '</table>';
            doseTableEl.innerHTML = html;
          }

          // Target trough slider
          const slider = document.getElementById('tacroTargetTrough');
          const sliderVal = document.getElementById('tacroTargetVal');
          if (slider && sliderVal) {
            slider.value = (target[0] + target[1]) / 2;
            sliderVal.textContent = slider.value + ' ng/mL';
            slider.oninput = function() {
              sliderVal.textContent = this.value + ' ng/mL';
              const targetT = +this.value;
              // Find dose for target trough by binary search
              let lo = 0.1, hi = 20;
              for (let iter = 0; iter < 30; iter++) {
                const mid = (lo + hi) / 2;
                const pred = predictTacroConc(interval - 0.01, best.cl, best.vd, best.ka, best.F, mid, interval);
                if (pred < targetT) lo = mid; else hi = mid;
              }
              const recDose = Math.round((lo + hi) / 2 * 4) / 4; // round to 0.25
              const predEl = document.getElementById('tacroDosePredict');
              if (predEl) predEl.innerHTML = '<div class="result-box green" style="padding:10px"><div style="font-size:16px;font-weight:700">' +
                recDose + ' mg BID</div><div style="font-size:11px;color:var(--text2)">Predicted trough: ' +
                predictTacroConc(interval - 0.01, best.cl, best.vd, best.ka, best.F, recDose, interval).toFixed(1) + ' ng/mL</div></div>';
            };
            slider.oninput();
          }
        });

        const tacroShareRow = document.createElement('div');
        tacroShareRow.className = 'share-row';
        tacroShareRow.innerHTML = '<button class="btn" data-action="shareTDM" data-drug="tacrolimus">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="tacrolimus">\ud83d\udcc4 PDF</button>';
        const tacroResEl = document.getElementById('tacroResults');
        if (tacroResEl) { var existing = tacroResEl.querySelector('.share-row'); if (existing) existing.remove(); tacroResEl.appendChild(tacroShareRow); }

        const resEl = document.getElementById('tacroResults');
        if (resEl) resEl.style.display = 'block';
        resEl?.scrollIntoView({ behavior: 'smooth' });
      }
    };
  })();

  // ============================================================
  // DIGOXIN — 2-compartment PK + level correction
  // ============================================================
  const DigoxinTDM = (function() {
    const DIG_MODELS = [
      { id: 'jelliffe', name: 'Jelliffe 1991', pop: 'General',
        // CL (mL/min) = 0.33*IBW + 0.9*CrCl (for CHF) or 1.3*IBW + 0.9*CrCl (normal)
        clFn: (crcl, wt, hf) => hf ? (0.33 * wt + 0.9 * crcl) * 0.06 : (1.3 * wt + 0.9 * crcl) * 0.06, // convert to L/hr
        vdFn: (wt) => 7.3 * wt / 1000 * wt, // ~500L for 70kg
        omega_cl: 0.30, omega_vd: 0.25, sigma: 0.15 },
      { id: 'konishi', name: 'Konishi 2002', pop: 'Pop PK',
        clFn: (crcl, wt) => (0.06 * crcl + 0.05 * wt) * 0.06, // L/hr
        vdFn: (wt) => 6.5 * wt,
        omega_cl: 0.28, omega_vd: 0.22, sigma: 0.12 }
    ];

    const F_VALUES = { tablet: 0.7, elixir: 0.8, capsule: 0.9, iv: 1.0 };

    function getTargetRange(indication) {
      return indication === 'hf' ? [0.5, 0.9] : [0.8, 2.0];
    }

    return {
      run() {
        const pt = updateCrCl();
        const level = +(document.getElementById('digLevel')?.value) || 0;
        const timeSince = +(document.getElementById('digTimeSinceLastDose')?.value) || 12;
        const dailyDose = +(document.getElementById('digDose')?.value) || 125;
        const formulation = document.getElementById('digFormulation')?.value || 'tablet';
        const indication = document.getElementById('digIndication')?.value || 'hf';
        const interaction = document.getElementById('digInteraction')?.value || 'none';
        const target = getTargetRange(indication);
        const F = F_VALUES[formulation] || 0.7;

        if (level <= 0) { alert('กรุณาใส่ serum digoxin level'); return; }

        // Distribution phase warning
        let distributionWarning = '';
        let correctedLevel = level;
        if (timeSince < 6) {
          distributionWarning = '⚠ เจาะเลือดภายใน distribution phase (<6h) — ค่าอาจสูงเกินจริง';
          // Rough correction: extrapolate to post-distribution
          const ke_approx = pt.crcl > 0 ? (0.0015 * pt.crcl + 0.0015) : 0.005;
          correctedLevel = level * Math.exp(-ke_approx * (6 - timeSince));
        }

        // Interpretation
        let cls = 'green', msg = '✅ อยู่ใน target range (' + target[0] + '-' + target[1] + ' ng/mL)';
        if (correctedLevel < target[0]) { cls = 'amber'; msg = '⚠ ต่ำกว่า target → อาจ subtherapeutic'; }
        else if (correctedLevel > target[1]) { cls = 'red'; msg = '⚠ สูงกว่า target → เสี่ยง toxicity'; }
        if (correctedLevel > 2.0) { cls = 'red'; msg = '🚨 SDC >2.0 → Digoxin toxicity risk สูง!'; }

        // Drug interaction adjustment
        let interactionNote = '';
        let adjFactor = 1.0;
        if (interaction === 'amiodarone') { adjFactor = 0.5; interactionNote = '⚠ Amiodarone: ลด dose 50% (↑ level ~2 เท่า)'; }
        else if (interaction === 'verapamil') { adjFactor = 0.75; interactionNote = '⚠ Verapamil: ลด dose 25% (↑ level ~25-35%)'; }
        else if (interaction === 'quinidine') { adjFactor = 0.5; interactionNote = '⚠ Quinidine: ลด dose 50% (↓ renal clearance + displacement)'; }

        const interpEl = document.getElementById('digInterpretation');
        if (interpEl) {
          let html = '<div class="result-box ' + cls + '">' +
            '<div class="result-title">Serum Digoxin (SDC)</div>' +
            '<div class="result-value" style="color:var(--' + cls + ')">' + level.toFixed(2) + ' ng/mL</div>' +
            '<div class="result-sub" style="color:var(--' + cls + ')">' + msg + '</div>';
          if (distributionWarning) html += '<div class="info-box amber" style="font-size:11px;margin-top:8px">' + distributionWarning +
            '<br>Estimated post-distribution level: ~' + correctedLevel.toFixed(2) + ' ng/mL</div>';
          if (interactionNote) html += '<div class="info-box red" style="font-size:11px;margin-top:8px">' + interactionNote + '</div>';
          html += '</div>';
          interpEl.innerHTML = html;
        }

        // Simple dose recommendation
        const doseRecEl = document.getElementById('digDoseRec');
        if (doseRecEl) {
          const midTarget = (target[0] + target[1]) / 2;
          const ratio = midTarget / correctedLevel;
          const newDose = Math.round(dailyDose * ratio * adjFactor / 31.25) * 31.25; // round to nearest 31.25
          const capped = Math.min(Math.max(newDose, 62.5), 500);

          let html = '<div class="result-box green" style="padding:12px">' +
            '<div style="font-size:16px;font-weight:700">แนะนำ: ' + capped + ' mcg/day</div>' +
            '<div style="font-size:11px;color:var(--text2);margin-top:4px">' +
            'Current: ' + dailyDose + ' mcg × ratio ' + ratio.toFixed(2);
          if (adjFactor < 1) html += ' × interaction factor ' + adjFactor;
          html += ' = ' + capped + ' mcg</div></div>';

          // Dose options
          html += '<table class="pk-table" style="margin-top:10px"><tr><th>Dose (mcg)</th><th>Formulation</th><th>Predicted SDC</th></tr>';
          for (const d of [62.5, 125, 187.5, 250, 375, 500]) {
            const predSDC = correctedLevel * (d / dailyDose) / adjFactor;
            const inRange = predSDC >= target[0] && predSDC <= target[1];
            const c = inRange ? 'green' : (predSDC < target[0] ? 'amber' : 'red');
            html += '<tr><td>' + d + ' mcg</td><td>' + formulation + '</td><td style="color:var(--' + c + ')">' + predSDC.toFixed(2) + ' ng/mL ' +
              (inRange ? '✅' : '') + '</td></tr>';
          }
          html += '</table>';
          doseRecEl.innerHTML = html;
        }

        // PK Table (population-based)
        const model = DIG_MODELS[0];
        const isHF = indication === 'hf';
        const popCL = model.clFn(pt.crcl, pt.wt, isHF);
        const ke = popCL / (model.vdFn(pt.wt) / 1000); // rough ke
        const pkTableEl = document.getElementById('digPkTable');
        if (pkTableEl) pkTableEl.innerHTML =
          '<tr><td>Model</td><td>' + model.name + '</td></tr>' +
          '<tr><td>Est. CL</td><td>' + popCL.toFixed(3) + ' L/hr</td></tr>' +
          '<tr><td>Est. t½</td><td>' + (Math.LN2 / (ke || 0.01)).toFixed(0) + ' hr</td></tr>' +
          '<tr><td>Bioavailability</td><td>' + (F * 100).toFixed(0) + '% (' + formulation + ')</td></tr>' +
          '<tr><td>CrCl</td><td>' + (pt.crcl || 0).toFixed(1) + ' mL/min</td></tr>';

        const digShareRow = document.createElement('div');
        digShareRow.className = 'share-row';
        digShareRow.innerHTML = '<button class="btn" data-action="shareTDM" data-drug="digoxin">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="digoxin">\ud83d\udcc4 PDF</button>';
        const digResEl2 = document.getElementById('digResults');
        if (digResEl2) { var existing = digResEl2.querySelector('.share-row'); if (existing) existing.remove(); digResEl2.appendChild(digShareRow); }

        const resEl = document.getElementById('digResults');
        if (resEl) resEl.style.display = 'block';
        resEl?.scrollIntoView({ behavior: 'smooth' });
      }
    };
  })();

  // ============================================================
  // WARFARIN — INR-based + Pharmacogenomics (IWPC)
  // ============================================================
  const WarfarinTDM = (function() {

    function inrDoseAdjustment(inr, currentWeeklyDose, targetLow, targetHigh) {
      const midTarget = (targetLow + targetHigh) / 2;
      let action, newDose, urgency;

      if (inr < 1.5) {
        action = 'เพิ่ม dose 10-20% + พิจารณาให้ loading dose';
        newDose = currentWeeklyDose * 1.15;
        urgency = 'amber';
      } else if (inr < targetLow) {
        action = 'เพิ่ม dose 5-15%';
        newDose = currentWeeklyDose * 1.10;
        urgency = 'amber';
      } else if (inr >= targetLow && inr <= targetHigh) {
        action = 'คงขนาดเดิม — INR อยู่ใน target';
        newDose = currentWeeklyDose;
        urgency = 'green';
      } else if (inr <= targetHigh + 0.5) {
        action = 'ลด dose 5-10% หรือคงเดิม + ติดตาม';
        newDose = currentWeeklyDose * 0.95;
        urgency = 'amber';
      } else if (inr <= 5) {
        action = 'Hold 1-2 วัน แล้ว ลด dose 10-20%';
        newDose = currentWeeklyDose * 0.85;
        urgency = 'red';
      } else if (inr <= 9) {
        action = 'Hold warfarin + ให้ Vitamin K 1-2.5 mg PO + ตรวจ INR ซ้ำใน 24-48h';
        newDose = currentWeeklyDose * 0.75;
        urgency = 'red';
      } else {
        action = '🚨 Hold warfarin + Vitamin K 5-10 mg IV + พิจารณา FFP/PCC ถ้ามี bleeding';
        newDose = currentWeeklyDose * 0.5;
        urgency = 'red';
      }

      return { action, newDose: Math.round(newDose * 2) / 2, urgency };
    }

    function iwpcAlgorithm(age, ht, wt, cyp2c9, vkorc1, race, amiodarone, enzymeInducer) {
      // IWPC regression equation (NEJM 2009;360:753-764)
      let val = 5.6044;
      val -= 0.2614 * (age / 10);
      val -= 0.0087 * ht;
      val += 0.0128 * wt;

      // VKORC1
      if (vkorc1 === 'AG') val -= 0.8677;
      else if (vkorc1 === 'AA') val -= 1.6974;

      // CYP2C9
      const cyp = {
        '*1/*2': -0.5211, '*1/*3': -0.9357,
        '*2/*2': -1.0616, '*2/*3': -1.9206, '*3/*3': -2.3312
      };
      if (cyp[cyp2c9]) val += cyp[cyp2c9];

      // Race
      if (race === 'asian') val += 0.2029;
      else if (race === 'black') val -= 0.1291;

      // Drugs
      if (amiodarone) val -= 0.2188;
      if (enzymeInducer) val += 0.1092;

      const weeklyDose = val * val; // sqrt was applied, so square to get dose
      return Math.max(weeklyDose, 3); // minimum 3 mg/wk
    }

    return {
      runINR() {
        const inr = +(document.getElementById('warINR')?.value) || 0;
        const weeklyDose = +(document.getElementById('warWeeklyDose')?.value) || 35;
        const indication = document.getElementById('warIndication')?.value || 'standard';
        const targetLow = indication === 'valve' ? 2.5 : 2.0;
        const targetHigh = indication === 'valve' ? 3.5 : 3.0;

        if (inr <= 0) { alert('กรุณาใส่ค่า INR'); return; }

        const adj = inrDoseAdjustment(inr, weeklyDose, targetLow, targetHigh);
        const dailyCurrent = (weeklyDose / 7).toFixed(1);
        const dailyNew = (adj.newDose / 7).toFixed(1);

        const el = document.getElementById('warINRInterpretation');
        if (el) {
          let html = '<div class="result-box ' + adj.urgency + '" style="padding:12px">' +
            '<div class="result-title">INR Interpretation</div>' +
            '<div class="result-value" style="color:var(--' + adj.urgency + ')">' + inr.toFixed(1) + '</div>' +
            '<div class="result-sub">Target: ' + targetLow + ' – ' + targetHigh + ' (' + indication + ')</div></div>';

          html += '<div class="info-box ' + adj.urgency + '" style="font-size:12px;margin-top:10px">' +
            '<strong>แนะนำ:</strong> ' + adj.action + '</div>';

          html += '<table class="pk-table" style="margin-top:10px">' +
            '<tr><td>Current Dose</td><td>' + weeklyDose + ' mg/wk (' + dailyCurrent + ' mg/day)</td></tr>' +
            '<tr><td>Suggested Dose</td><td style="font-weight:700;color:var(--' + adj.urgency + ')">' + adj.newDose + ' mg/wk (' + dailyNew + ' mg/day)</td></tr>' +
            '<tr><td>Follow-up INR</td><td>' + (inr > 5 ? '24-48 ชั่วโมง' : '1-2 สัปดาห์') + '</td></tr></table>';

          // INR adjustment reference table
          html += '<div style="margin-top:16px;font-size:11px;color:var(--text2)"><strong>INR Dose Adjustment Guide (ACCP):</strong></div>' +
            '<table class="pk-table" style="font-size:11px">' +
            '<tr><th>INR</th><th>Action</th></tr>' +
            '<tr><td><1.5</td><td>เพิ่ม 10-20%</td></tr>' +
            '<tr><td>1.5-' + targetLow + '</td><td>เพิ่ม 5-15%</td></tr>' +
            '<tr style="background:rgba(16,185,129,.05)"><td>' + targetLow + '-' + targetHigh + '</td><td>✅ คงขนาดเดิม</td></tr>' +
            '<tr><td>' + targetHigh + '-5.0</td><td>Hold 1-2 วัน แล้วลด 10-20%</td></tr>' +
            '<tr><td>5.0-9.0</td><td>Hold + Vit K 1-2.5 mg PO</td></tr>' +
            '<tr><td>>9.0</td><td>Hold + Vit K 5-10 mg IV ± FFP/PCC</td></tr></table>';

          el.innerHTML = html;
        }

        const warINRShareRow = document.createElement('div');
        warINRShareRow.className = 'share-row';
        warINRShareRow.innerHTML = '<button class="btn" data-action="shareTDM" data-drug="warfarin-inr">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="warfarin-inr">\ud83d\udcc4 PDF</button>';
        const warINRResEl = document.getElementById('warINRResults');
        if (warINRResEl) { var existing = warINRResEl.querySelector('.share-row'); if (existing) existing.remove(); warINRResEl.appendChild(warINRShareRow); }

        const resEl = document.getElementById('warINRResults');
        if (resEl) resEl.style.display = 'block';
      },

      runPGx() {
        const pt = updateCrCl();
        const cyp2c9 = document.getElementById('warCYP2C9')?.value || '*1/*1';
        const vkorc1 = document.getElementById('warVKORC1')?.value || 'GG';
        const race = document.getElementById('warRace')?.value || 'asian';
        const amio = document.getElementById('warAmiodarone')?.value === '1';
        const enzyme = document.getElementById('warEnzyme')?.value === '1';

        const weeklyDose = iwpcAlgorithm(pt.age, pt.ht, pt.wt, cyp2c9, vkorc1, race, amio, enzyme);
        const dailyDose = weeklyDose / 7;

        // Risk classification
        let riskCls = 'green', riskMsg = 'Standard dose';
        if (weeklyDose < 21) { riskCls = 'amber'; riskMsg = 'Sensitive — ลด dose'; }
        if (weeklyDose < 14) { riskCls = 'red'; riskMsg = 'Highly sensitive — ต้องระวังมาก'; }
        if (weeklyDose > 49) { riskCls = 'amber'; riskMsg = 'Resistant — อาจต้อง dose สูง'; }

        // Genotype interpretation
        const cypInterp = { '*1/*1': 'Normal metabolizer (NM)', '*1/*2': 'Intermediate (IM)', '*1/*3': 'Intermediate (IM)',
          '*2/*2': 'Poor metabolizer (PM)', '*2/*3': 'Poor metabolizer (PM)', '*3/*3': 'Poor metabolizer (PM)' };
        const vkorcInterp = { 'GG': 'Normal sensitivity', 'AG': 'Increased sensitivity (↓ dose)', 'AA': 'High sensitivity (↓↓ dose)' };

        const el = document.getElementById('warPGxResult');
        if (el) {
          let html = '<div class="result-box ' + riskCls + '" style="padding:12px">' +
            '<div class="result-title">IWPC Predicted Dose</div>' +
            '<div class="result-value" style="color:var(--' + riskCls + ')">' + weeklyDose.toFixed(1) + ' mg/wk</div>' +
            '<div class="result-sub">(' + dailyDose.toFixed(1) + ' mg/day) — ' + riskMsg + '</div></div>';

          html += '<table class="pk-table" style="margin-top:12px">' +
            '<tr><td>CYP2C9</td><td>' + cyp2c9 + ' — ' + (cypInterp[cyp2c9] || 'Unknown') + '</td></tr>' +
            '<tr><td>VKORC1</td><td>' + vkorc1 + ' — ' + (vkorcInterp[vkorc1] || 'Unknown') + '</td></tr>' +
            '<tr><td>Race</td><td>' + race + '</td></tr>' +
            '<tr><td>Age</td><td>' + pt.age + ' yrs</td></tr>' +
            '<tr><td>Height</td><td>' + pt.ht + ' cm</td></tr>' +
            '<tr><td>Weight</td><td>' + pt.wt + ' kg</td></tr>';
          if (amio) html += '<tr><td>Amiodarone</td><td style="color:var(--red)">Yes (↓ dose ~25%)</td></tr>';
          if (enzyme) html += '<tr><td>Enzyme Inducer</td><td style="color:var(--amber)">Yes (↑ dose)</td></tr>';
          html += '</table>';

          html += '<div class="info-box purple" style="font-size:11px;margin-top:12px">' +
            '<strong>หมายเหตุ:</strong> IWPC algorithm ใช้สำหรับ <strong>initial dosing</strong> เท่านั้น<br>' +
            'ต้องติดตาม INR ทุก 2-3 วันในสัปดาห์แรก แล้วปรับ dose ตาม INR response<br>' +
            '<em>Ref: IWPC, N Engl J Med 2009;360:753-764</em></div>';

          el.innerHTML = html;
        }

        const warPGxShareRow = document.createElement('div');
        warPGxShareRow.className = 'share-row';
        warPGxShareRow.innerHTML = '<button class="btn" data-action="shareTDM" data-drug="warfarin-pgx">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c</button><button class="btn" data-action="exportTDM" data-drug="warfarin-pgx">\ud83d\udcc4 PDF</button>';
        const warPGxResEl = document.getElementById('warPGxResults');
        if (warPGxResEl) { var existing = warPGxResEl.querySelector('.share-row'); if (existing) existing.remove(); warPGxResEl.appendChild(warPGxShareRow); }

        const resEl = document.getElementById('warPGxResults');
        if (resEl) resEl.style.display = 'block';
      }
    };
  })();

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    // Initialization
    init: init,

    // Drug switching
    switchDrug: switchDrug,

    // Vancomycin TDM module
    VancoTDM_run: () => VancoTDM.run(),
    VancoTDM_init: () => VancoTDM.init(),
    VancoTDM_addDose: () => VancoTDM.addDose(),
    VancoTDM_removeDose: (i) => VancoTDM.removeDose(i),
    VancoTDM_setDose: (i, k, v) => VancoTDM.setDose(i, k, v),
    VancoTDM_addLevel: () => VancoTDM.addLevel(),
    VancoTDM_removeLevel: (i) => VancoTDM.removeLevel(i),
    VancoTDM_setLevel: (i, k, v) => VancoTDM.setLevel(i, k, v),
    VancoTDM_setModel: (id) => VancoTDM.setModel(id),
    VancoTDM_updateOpt: () => VancoTDM.updateOpt(),
    VancoTDM_getDoses: () => VancoTDM.getDoses(),
    VancoTDM_getLevels: () => VancoTDM.getLevels(),
    VancoTDM_getPK: () => VancoTDM.getPK(),
    VancoTDM_getOptData: () => VancoTDM.getOptData(),

    // Phenytoin TDM module
    PhenytoinTDM_run: () => PhenytoinTDM.run(),

    // Aminoglycoside TDM module
    AminoglycosideTDM_updateUI: () => AminoglycosideTDM.updateUI(),
    AminoglycosideTDM_run: () => AminoglycosideTDM.run(),

    // Valproate TDM module
    ValproateTDM_run: () => ValproateTDM.run(),

    // Tacrolimus TDM module
    TacrolimusTDM_run: () => TacrolimusTDM.run(),

    // Digoxin TDM module
    DigoxinTDM_run: () => DigoxinTDM.run(),

    // Warfarin TDM module
    WarfarinTDM_runINR: () => WarfarinTDM.runINR(),
    WarfarinTDM_runPGx: () => WarfarinTDM.runPGx(),

    // Utilities
    updateCrCl: updateCrCl,
    getPatient: getPatient
  };
})();

// Initialize on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TDMHub.init());
} else {
  TDMHub.init();
}

// ====== Event Delegation (replaces inline onclick/onchange in tdm.html) ======
IVDrugRef.delegate(document, 'click', {
  goBack: function(e) { if (history.length > 1) { e.preventDefault(); history.back(); } },
  switchDrug: function(e, t) { TDMHub.switchDrug(t.dataset.drug); },
  vancoAddDose: function() { TDMHub.VancoTDM_addDose(); },
  vancoAddLevel: function() { TDMHub.VancoTDM_addLevel(); },
  vancoRemoveDose: function(e, t) { TDMHub.VancoTDM_removeDose(+t.dataset.index); },
  vancoRemoveLevel: function(e, t) { TDMHub.VancoTDM_removeLevel(+t.dataset.index); },
  vancoSetModel: function(e, t) { TDMHub.VancoTDM_setModel(t.dataset.model); },
  vancoRunModel: function(e, t) { TDMHub.VancoTDM_setModel(t.dataset.model); TDMHub.VancoTDM_run(); },
  vancoRun: function() { TDMHub.VancoTDM_run(); },
  vancoDoseOption: function(e, t) {
    var d = document.getElementById('vancoOptDose'); if (d) d.value = t.dataset.dose;
    var q = document.getElementById('vancoOptInterval'); if (q) q.value = t.dataset.q;
    TDMHub.VancoTDM_updateOpt();
  },
  phenytoinRun: function() { TDMHub.PhenytoinTDM_run(); },
  agRun: function() { TDMHub.AminoglycosideTDM_run(); },
  vpaRun: function() { TDMHub.ValproateTDM_run(); },
  tacrolimusRun: function() { TDMHub.TacrolimusTDM_run(); },
  digoxinRun: function() { TDMHub.DigoxinTDM_run(); },
  warfarinINRRun: function() { TDMHub.WarfarinTDM_runINR(); },
  warfarinPGxRun: function() { TDMHub.WarfarinTDM_runPGx(); },
  shareTDM: function(e, t) { tdmShareLine(t.dataset.drug); },
  exportTDM: function(e, t) { tdmExportPdf(t.dataset.drug); }
});
IVDrugRef.delegate(document, 'change', {
  vancoSetDose: function(e, t) {
    var v = t.dataset.field === 'dateTime' ? t.value : +t.value;
    TDMHub.VancoTDM_setDose(+t.dataset.index, t.dataset.field, v);
  },
  vancoSetLevel: function(e, t) {
    var v = t.dataset.field === 'dateTime' ? t.value : +t.value;
    TDMHub.VancoTDM_setLevel(+t.dataset.index, t.dataset.field, v);
  },
  agUpdateUI: function() { TDMHub.AminoglycosideTDM_updateUI(); }
});

// ============================================================
// SHARE / EXPORT HELPERS (DOM-based extraction for all drug tabs)
// ============================================================
var TDM_RESULT_SECTIONS = {
  'vancomycin': 'vancoResults',
  'phenytoin': 'phenyResults',
  'aminoglycoside': 'agResults',
  'valproate': 'vpaResults',
  'tacrolimus': 'tacroResults',
  'digoxin': 'digResults',
  'warfarin-inr': 'warINRResults',
  'warfarin-pgx': 'warPGxResults'
};
var TDM_DRUG_NAMES = {
  'vancomycin': 'Vancomycin',
  'phenytoin': 'Phenytoin',
  'aminoglycoside': 'Aminoglycoside',
  'valproate': 'Valproate',
  'tacrolimus': 'Tacrolimus',
  'digoxin': 'Digoxin',
  'warfarin-inr': 'Warfarin (INR)',
  'warfarin-pgx': 'Warfarin (PGx)'
};
var TDM_GRAPH_IDS = {
  'vancomycin': 'vancoGraph',
  'aminoglycoside': 'agGraph'
};

function extractTDMResultText(drug) {
  var sectionId = TDM_RESULT_SECTIONS[drug];
  if (!sectionId) return '';
  var section = document.getElementById(sectionId);
  if (!section || section.style.display === 'none') return '';

  // Extract text from result boxes, stat grids, pk tables, info boxes
  var lines = [];
  // Result boxes
  section.querySelectorAll('.result-box').forEach(function(box) {
    var title = box.querySelector('.result-title');
    var value = box.querySelector('.result-value');
    var sub = box.querySelector('.result-sub');
    if (value) lines.push((title ? title.textContent.trim() + ': ' : '') + value.textContent.trim());
    if (sub) lines.push(sub.textContent.trim());
  });
  // Stat grids
  section.querySelectorAll('.stat').forEach(function(s) {
    var label = s.querySelector('.stat-label');
    var val = s.querySelector('.stat-val');
    if (label && val) lines.push(label.textContent.trim() + ': ' + val.textContent.trim());
  });
  // PK tables
  section.querySelectorAll('.pk-table tr, table tr').forEach(function(tr) {
    var cells = tr.querySelectorAll('td');
    if (cells.length >= 2) lines.push(cells[0].textContent.trim() + ': ' + cells[1].textContent.trim());
  });
  return lines.join('\n');
}

function fmtDTHub(dtStr) {
  if (!dtStr) return '-';
  var d = new Date(dtStr);
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var yy = d.getFullYear()+543;
  var hh = String(d.getHours()).padStart(2,'0');
  var mn = String(d.getMinutes()).padStart(2,'0');
  return dd+'/'+mm+'/'+yy+' '+hh+':'+mn;
}

function buildVancoTDMShareText() {
  var SE = IVDrugRef.ShareExport;
  var dt = SE ? SE.thaiDateTime() : '';
  var pt = TDMHub.getPatient();
  var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07';
  var pk = TDMHub.VancoTDM_getPK();
  if (!pk) return '';
  var doses = TDMHub.VancoTDM_getDoses();
  var levels = TDMHub.VancoTDM_getLevels();

  var interp = '\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19 target range';
  if (pk.auc24 < 400) interp = '\u0e15\u0e48\u0e33\u0e01\u0e27\u0e48\u0e32 target (subtherapeutic)';
  else if (pk.auc24 > 600) interp = '\u0e2a\u0e39\u0e07\u0e01\u0e27\u0e48\u0e32 target (\u0e40\u0e2a\u0e35\u0e48\u0e22\u0e07 nephrotoxicity)';

  var text = '=== Vancomycin TDM ===\n';
  text += '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: ' + dt + '\n\n';
  text += '\u0e1c\u0e39\u0e49\u0e1b\u0e48\u0e27\u0e22: ' + sex + ' ' + pt.age + ' \u0e1b\u0e35 ' + pt.wt + ' kg SCr ' + pt.scr + '\n';
  if (pt.crcl) text += 'CrCl: ' + (typeof pt.crcl === 'number' ? pt.crcl.toFixed(1) : pt.crcl) + ' mL/min\n';

  text += '\n--- \u0e02\u0e19\u0e32\u0e14\u0e22\u0e32\u0e40\u0e14\u0e34\u0e21 ---\n';
  for (var i = 0; i < doses.length; i++) {
    var d = doses[i];
    text += '#' + (i+1) + ': ' + d.amount + ' mg q' + d.interval + 'h';
    text += ' (infuse ' + d.infusion + 'h, ' + d.nDoses + ' doses)';
    if (d.dateTime) text += ' \u0e40\u0e23\u0e34\u0e48\u0e21 ' + fmtDTHub(d.dateTime);
    text += '\n';
  }

  text += '\n--- \u0e1c\u0e25 Level ---\n';
  for (var j = 0; j < levels.length; j++) {
    var lv = levels[j];
    text += '#' + (j+1) + ': ' + lv.value + ' mcg/mL';
    if (lv.dateTime) text += ' \u0e40\u0e08\u0e32\u0e30 ' + fmtDTHub(lv.dateTime);
    text += '\n';
  }

  text += '\n--- \u0e1c\u0e25\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c ---\n';
  text += 'AUC\u2082\u2084: ' + pk.auc24.toFixed(0) + ' (target 400-600)\n';
  if (pk.aucLo) text += '90% CI: ' + pk.aucLo.toFixed(0) + '\u2013' + pk.aucHi.toFixed(0) + '\n';
  text += '\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e41\u0e1b\u0e25\u0e1c\u0e25: ' + interp + '\n';
  text += 'SS Peak: ' + pk.ssPeak.toFixed(1) + ' | SS Trough: ' + pk.ssTrough.toFixed(1) + '\n';
  text += 'PK: CL ' + pk.cl.toFixed(3) + ' L/hr | Vd ' + pk.vd.toFixed(1) + ' L | t\u00bd ' + pk.halflife.toFixed(1) + 'h\n';
  text += 'Model: ' + pk.model + '\n';

  var opt = TDMHub.VancoTDM_getOptData();
  if (opt) {
    text += '\n--- \u0e02\u0e19\u0e32\u0e14\u0e22\u0e32\u0e43\u0e2b\u0e21\u0e48\u0e17\u0e35\u0e48\u0e41\u0e19\u0e30\u0e19\u0e33 ---\n';
    text += opt.dose + ' mg q' + opt.interval + 'h (infuse ' + opt.infusion + 'h)\n';
    text += '\u0e04\u0e32\u0e14\u0e01\u0e32\u0e23\u0e13\u0e4c AUC\u2082\u2084: ' + opt.auc24.toFixed(0);
    var optMsg = ' \u2714 In target';
    if (opt.auc24 < 400) optMsg = ' \u26a0 Below target';
    else if (opt.auc24 > 600) optMsg = ' \u26a0 Above target';
    text += optMsg + '\n';
    text += 'Predicted Peak: ' + opt.peak.toFixed(1) + ' | Trough: ' + opt.trough.toFixed(1) + '\n';
  }

  var ver = IVDrugRef.VERSION || '5.1.0';
  text += '\n---\nIV DrugRef v' + ver + '\nhttps://rxbenz.github.io/iv-drugref/\n';
  text += '\u26a0 \u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e0a\u0e48\u0e27\u0e22\u0e04\u0e33\u0e19\u0e27\u0e13 \u0e44\u0e21\u0e48\u0e17\u0e14\u0e41\u0e17\u0e19 clinical judgment';
  return text;
}

function buildTDMShareText(drug) {
  // Vancomycin gets enriched version with dose/level/optimizer data
  if (drug === 'vancomycin') return buildVancoTDMShareText();

  var SE = IVDrugRef.ShareExport;
  var dt = SE ? SE.thaiDateTime() : '';
  var pt = TDMHub.getPatient();
  var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07';
  var drugName = TDM_DRUG_NAMES[drug] || drug;

  var text = '=== ' + drugName + ' TDM ===\n';
  text += '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: ' + dt + '\n\n';
  text += '\u0e1c\u0e39\u0e49\u0e1b\u0e48\u0e27\u0e22: ' + sex + ' ' + pt.age + ' \u0e1b\u0e35 ' + pt.wt + ' kg SCr ' + pt.scr + '\n';
  if (pt.crcl) text += 'CrCl: ' + (typeof pt.crcl === 'number' ? pt.crcl.toFixed(1) : pt.crcl) + ' mL/min\n';
  text += '\n';
  text += extractTDMResultText(drug) + '\n';
  var ver = IVDrugRef.VERSION || '5.1.0';
  text += '\n---\nIV DrugRef v' + ver + '\nhttps://rxbenz.github.io/iv-drugref/\n';
  text += '\u26a0 \u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e0a\u0e48\u0e27\u0e22\u0e04\u0e33\u0e19\u0e27\u0e13 \u0e44\u0e21\u0e48\u0e17\u0e14\u0e41\u0e17\u0e19 clinical judgment';
  return text;
}

function tdmShareLine(drug) {
  if (!IVDrugRef.ShareExport) return;
  var text = buildTDMShareText(drug);
  IVDrugRef.ShareExport.shareToLine(text, { page: 'tdm', drug: TDM_DRUG_NAMES[drug] || drug });
}

function buildVancoTDMPrintData() {
  var pt = TDMHub.getPatient();
  var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07';
  var pk = TDMHub.VancoTDM_getPK();
  if (!pk) return null;
  var doses = TDMHub.VancoTDM_getDoses();
  var levels = TDMHub.VancoTDM_getLevels();
  var cellSt = 'padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:12px';

  var interp = 'In target (400-600)';
  var interpColor = '#16a34a';
  if (pk.auc24 < 400) { interp = 'Below target (<400)'; interpColor = '#d97706'; }
  else if (pk.auc24 > 600) { interp = 'Above target (>600)'; interpColor = '#dc2626'; }

  var patientHtml = '<div style="font-size:13px;line-height:1.8">' +
    '<b>\u0e40\u0e1e\u0e28:</b> ' + sex + ' &nbsp; <b>\u0e2d\u0e32\u0e22\u0e38:</b> ' + pt.age + ' \u0e1b\u0e35 &nbsp; ' +
    '<b>\u0e19\u0e49\u0e33\u0e2b\u0e19\u0e31\u0e01:</b> ' + pt.wt + ' kg &nbsp; <b>SCr:</b> ' + pt.scr + ' mg/dL' +
    (pt.crcl ? ' &nbsp; <b>CrCl:</b> ' + (typeof pt.crcl === 'number' ? pt.crcl.toFixed(1) : pt.crcl) + ' mL/min' : '') +
    '</div>';

  // Dose history
  var doseHtml = '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">\ud83d\udc8a \u0e02\u0e19\u0e32\u0e14\u0e22\u0e32\u0e40\u0e14\u0e34\u0e21</div>' +
    '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
    '<tr style="background:#f1f5f9"><th style="'+cellSt+';text-align:left">#</th><th style="'+cellSt+';text-align:left">Dose</th><th style="'+cellSt+';text-align:left">Regimen</th><th style="'+cellSt+';text-align:left">\u0e40\u0e27\u0e25\u0e32\u0e40\u0e23\u0e34\u0e48\u0e21</th></tr>';
  for (var i = 0; i < doses.length; i++) {
    var d = doses[i];
    doseHtml += '<tr><td style="'+cellSt+'">' + (i+1) + '</td>' +
      '<td style="'+cellSt+'">' + d.amount + ' mg x' + d.nDoses + ' doses</td>' +
      '<td style="'+cellSt+'">q' + d.interval + 'h (infuse ' + d.infusion + 'h)</td>' +
      '<td style="'+cellSt+'">' + fmtDTHub(d.dateTime) + '</td></tr>';
  }
  doseHtml += '</table></div>';

  // Measured levels
  var lvlHtml = '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">\ud83e\ude78 \u0e1c\u0e25 Level \u0e17\u0e35\u0e48\u0e40\u0e08\u0e32\u0e30\u0e44\u0e14\u0e49</div>' +
    '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
    '<tr style="background:#f1f5f9"><th style="'+cellSt+';text-align:left">#</th><th style="'+cellSt+';text-align:left">Level</th><th style="'+cellSt+';text-align:left">\u0e40\u0e27\u0e25\u0e32\u0e40\u0e08\u0e32\u0e30</th></tr>';
  for (var j = 0; j < levels.length; j++) {
    var lv = levels[j];
    lvlHtml += '<tr><td style="'+cellSt+'">' + (j+1) + '</td>' +
      '<td style="'+cellSt+'">' + lv.value + ' mcg/mL</td>' +
      '<td style="'+cellSt+'">' + fmtDTHub(lv.dateTime) + '</td></tr>';
  }
  lvlHtml += '</table></div>';

  // AUC result + PK table
  var aucHtml = '<div style="text-align:center;padding:14px;border:2px solid ' + interpColor + ';border-radius:10px;margin-bottom:14px">' +
    '<div style="font-size:12px;color:#64748b">AUC\u2082\u2084/MIC (' + pk.model + ')</div>' +
    '<div style="font-size:32px;font-weight:700;color:' + interpColor + '">' + pk.auc24.toFixed(0) + '</div>' +
    '<div style="font-size:12px;color:' + interpColor + '">' + interp + '</div>' +
    (pk.aucLo ? '<div style="font-size:11px;color:#64748b;margin-top:4px">90% CI: ' + pk.aucLo.toFixed(0) + ' \u2013 ' + pk.aucHi.toFixed(0) + '</div>' : '') +
    '</div>' +
    '<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:12px">' +
    '<tr><td style="'+cellSt+'"><b>SS Peak</b></td><td style="'+cellSt+'">' + pk.ssPeak.toFixed(1) + ' mcg/mL</td>' +
    '<td style="'+cellSt+'"><b>SS Trough</b></td><td style="'+cellSt+'">' + pk.ssTrough.toFixed(1) + ' mcg/mL</td></tr>' +
    '<tr><td style="'+cellSt+'"><b>CL</b></td><td style="'+cellSt+'">' + pk.cl.toFixed(3) + ' L/hr</td>' +
    '<td style="'+cellSt+'"><b>Vd</b></td><td style="'+cellSt+'">' + pk.vd.toFixed(1) + ' L</td></tr>' +
    '<tr><td style="'+cellSt+'"><b>Ke</b></td><td style="'+cellSt+'">' + pk.ke.toFixed(4) + ' hr\u207b\u00b9</td>' +
    '<td style="'+cellSt+'"><b>t\u00bd</b></td><td style="'+cellSt+'">' + pk.halflife.toFixed(1) + ' hr</td></tr>' +
    '</table>';

  // Dose optimizer
  var optHtml = '';
  var opt = TDMHub.VancoTDM_getOptData();
  if (opt) {
    var optColor = '#16a34a', optMsg = 'In target';
    if (opt.auc24 < 400) { optColor = '#d97706'; optMsg = 'Below target'; }
    else if (opt.auc24 > 600) { optColor = '#dc2626'; optMsg = 'Above target'; }
    optHtml = '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:6px">\ud83c\udfaf \u0e02\u0e19\u0e32\u0e14\u0e22\u0e32\u0e43\u0e2b\u0e21\u0e48\u0e17\u0e35\u0e48\u0e41\u0e19\u0e30\u0e19\u0e33</div>' +
      '<div style="font-size:16px;font-weight:700;color:#0f172a">' + opt.dose + ' mg q' + opt.interval + 'h</div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:4px">Infusion: ' + opt.infusion + ' hr</div>' +
      '<div style="font-size:13px;margin-top:6px;color:' + optColor + ';font-weight:600">' +
        '\u0e04\u0e32\u0e14\u0e01\u0e32\u0e23\u0e13\u0e4c AUC\u2082\u2084: ' + opt.auc24.toFixed(0) + ' \u2014 ' + optMsg + '</div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:2px">Predicted Peak: ' + opt.peak.toFixed(1) + ' mcg/mL | Trough: ' + opt.trough.toFixed(1) + ' mcg/mL</div>' +
      '</div>';
  }

  return {
    title: 'Vancomycin Bayesian TDM Report',
    patientHtml: patientHtml,
    resultsHtml: doseHtml + lvlHtml + aucHtml + optHtml,
    chartCanvas: document.getElementById('vancoGraph'),
    analytics: { page: 'tdm', drug: 'Vancomycin', auc: pk.auc24.toFixed(0) }
  };
}

function tdmExportPdf(drug) {
  if (!IVDrugRef.ShareExport) return;

  // Vancomycin gets enriched version
  if (drug === 'vancomycin') {
    var vancoData = buildVancoTDMPrintData();
    if (vancoData) { IVDrugRef.ShareExport.printReport(vancoData); return; }
  }

  var pt = TDMHub.getPatient();
  var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07';
  var drugName = TDM_DRUG_NAMES[drug] || drug;
  var sectionId = TDM_RESULT_SECTIONS[drug];
  var section = sectionId ? document.getElementById(sectionId) : null;

  var patientHtml = '<div style="font-size:13px;line-height:1.8">' +
    '<b>\u0e40\u0e1e\u0e28:</b> ' + sex + ' &nbsp; <b>\u0e2d\u0e32\u0e22\u0e38:</b> ' + pt.age + ' \u0e1b\u0e35 &nbsp; ' +
    '<b>\u0e19\u0e49\u0e33\u0e2b\u0e19\u0e31\u0e01:</b> ' + pt.wt + ' kg &nbsp; <b>SCr:</b> ' + pt.scr + ' mg/dL' +
    (pt.crcl ? ' &nbsp; <b>CrCl:</b> ' + (typeof pt.crcl === 'number' ? pt.crcl.toFixed(1) : pt.crcl) + ' mL/min' : '') +
    '</div>';

  // Clone the result section HTML for print (strip buttons and share rows)
  var resultsHtml = '';
  if (section) {
    var clone = section.cloneNode(true);
    clone.querySelectorAll('.share-row, button, .btn').forEach(function(el) { el.remove(); });
    clone.style.display = 'block';
    clone.style.color = '#000';
    clone.querySelectorAll('[style*="color:var("]').forEach(function(el) {
      var s = el.getAttribute('style') || '';
      s = s.replace(/color:var\(--green\)/g, 'color:#16a34a')
           .replace(/color:var\(--amber\)/g, 'color:#d97706')
           .replace(/color:var\(--red\)/g, 'color:#dc2626')
           .replace(/color:var\(--blue\)/g, 'color:#2563eb')
           .replace(/color:var\(--purple\)/g, 'color:#7c3aed')
           .replace(/color:var\(--text2\)/g, 'color:#64748b')
           .replace(/color:var\(--text3\)/g, 'color:#94a3b8');
      el.setAttribute('style', s);
    });
    resultsHtml = clone.innerHTML;
  }

  var graphId = TDM_GRAPH_IDS[drug];
  var chartCanvas = graphId ? document.getElementById(graphId) : null;

  IVDrugRef.ShareExport.printReport({
    title: drugName + ' TDM Report',
    patientHtml: patientHtml,
    resultsHtml: resultsHtml,
    chartCanvas: chartCanvas,
    analytics: { page: 'tdm', drug: drugName }
  });
}
