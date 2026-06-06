// ============================================================
// IV DrugRef — Vancomycin PK Models (shared module)
// ============================================================
// Single source of truth for the vancomycin population-PK models, shared
// by tdm.js (VancoTDM) and vanco-tdm.js. Previously these were duplicated
// verbatim in both files (ROADMAP P1.1); unified here so a coefficient fix
// can never again land in one page but not the other.
//
// Exposes (global, browser): window.VancoPK = { PK_MODELS, COLIN_MODEL,
//                                                isPedsVanco }
//
// Requires: IVDrugRef (core.js) for calcBSA / calcSchwartz — load AFTER core.js
//           and BEFORE tdm.js / vanco-tdm.js.
//
// Engine contract (1-compartment): AUC24,ss = daily_dose / CL — exact and
// compartment-independent, so a correct CL gives a correct AUC. 2-comp papers
// (Llopis, Goti) collapse to Vss = Vc+Vp as the single V (V only shapes
// peak/trough, not interval AUC).
//
// Per-model interface: crclFn(pt), clFn(pt), vdFn(pt) — each paper uses a
// different CrCl method, so CrCl is computed per model rather than passed in.
// Coefficients verified vs primary papers (Phase 2b, v5.10.0); golden values
// recorded in CLAUDE.md and asserted in test/clinical-formulas.test.js.
// ============================================================
(function (global) {
  'use strict';

  // --- Per-model CrCl helpers (each paper uses a different method) ---
  function _vCgPlain(pt){ var c=(140-pt.age)*pt.wt/(72*pt.scr); if(pt.sex==='F')c*=0.85; return c; }
  function _vLbw(wt,ht,sex){ var bmi=wt/Math.pow(ht/100,2); return sex==='M'?9270*wt/(6680+216*bmi):9270*wt/(8780+244*bmi); }
  function _vCgLbw(pt){ // Llopis-Salvia: CG with lean body weight; SCr<0.6 → cap CrCl 120
    var lbw=_vLbw(pt.wt,pt.ht,pt.sex); var c=(140-pt.age)*lbw/(72*pt.scr); if(pt.sex==='F')c*=0.85;
    if(pt.scr<0.6) c=Math.min(c,120); return c; }
  function _vCgGoti(pt){ // Goti: CG plain; SCr<1 & age>60 → SCr=1; truncate at 150
    var scr=(pt.scr<1&&pt.age>60)?1:pt.scr; var c=(140-pt.age)*pt.wt/(72*scr); if(pt.sex==='F')c*=0.85;
    return Math.min(c,150); }
  function _vCgAdaneBsa(pt){ // Adane: CG TBW; SCr<1 → 1; normalize to 1.73m²
    var scr=pt.scr<1?1:pt.scr; var c=(140-pt.age)*pt.wt/(72*scr); if(pt.sex==='F')c*=0.85;
    var bsa=IVDrugRef.calcBSA(pt.ht,pt.wt)||1.73; return c*1.73/bsa; }
  function _vJelliffe(pt){ // Bourguignon: Jelliffe 1973 (mL/min/1.73m²)
    var c=(98-0.8*(pt.age-20))/pt.scr; if(pt.sex==='F')c*=0.9; return Math.max(c,0); }
  function _vDial(pt){ return (pt.dialysis&&pt.dialysis!=='none')?1:0; }

  var PK_MODELS = [
    { id:'buelga', name:'Buelga 2005', pop:'Hematologic malignancy',
      ref:'Antimicrob Agents Chemother 2005;49:4934-41',
      crclFn:_vCgPlain,
      clFn:function(pt){ return 0.0648*_vCgPlain(pt); },     // 1.08 × CLcr(L/h) = 0.0648 × CrCl(mL/min)
      vdFn:function(pt){ return 0.98*pt.wt; },
      omega_cl:0.25, omega_vd:0.15, sigma:0.10 },
    { id:'llopis', name:'Llopis-Salvia 2006', pop:'Critically ill (ICU)',
      ref:'J Clin Pharm Ther 2006;31:447-54',
      crclFn:_vCgLbw,
      clFn:function(pt){ return 0.034*_vCgLbw(pt)+0.015*pt.wt; },
      vdFn:function(pt){ return 1.734*pt.wt; },              // Vss = Vc(0.414·TBW) + Vp(1.32·TBW)
      omega_cl:0.30, omega_vd:0.20, sigma:0.12 },
    { id:'goti', name:'Goti 2018', pop:'General hospitalized (±dialysis)',
      ref:'Ther Drug Monit 2018;40:212-21',
      crclFn:_vCgGoti,
      clFn:function(pt){ return 4.5*Math.pow(_vCgGoti(pt)/120,0.8)*Math.pow(0.7,_vDial(pt)); },
      vdFn:function(pt){ return 58.4*(pt.wt/70)*(_vDial(pt)?0.5:1)+38.4; },  // Vss = Vc(58.4·WT/70, ×0.5 if HD) + Vp(38.4)
      omega_cl:0.22, omega_vd:0.18, sigma:0.08 },
    { id:'adane', name:'Adane 2015', pop:'Extremely obese (BMI≥40)',
      ref:'Pharmacotherapy 2015;35:127-139',
      crclFn:_vCgAdaneBsa,
      clFn:function(pt){ return 6.54*(_vCgAdaneBsa(pt)/125); },
      vdFn:function(pt){ return 0.51*pt.wt; },
      omega_cl:0.28, omega_vd:0.22, sigma:0.11 },
    { id:'bourguignon', name:'Bourguignon 2016', pop:'Elderly >80yr',
      ref:'Antimicrob Agents Chemother 2016;60:4563-7',
      crclFn:_vJelliffe,
      clFn:function(pt){ var kel=0.0229+0.00088*_vJelliffe(pt); return kel*(23.35+0.211*pt.wt); }, // CL = kel × V
      vdFn:function(pt){ return 23.35+0.211*pt.wt; },
      omega_cl:0.35, omega_vd:0.20, sigma:0.13 }
  ];

  // ============================================================
  // PEDIATRIC MODEL — Colin 2019 (Clin Pharmacokinet 58:767-780)
  // For age 1-17 (non-neonate). 2-comp paper → use Vss=V1+V2 in 1-comp engine.
  // Coefficients verified vs paper Table 3 + Eq 5-13 (golden: 35yo CL≈4.10,
  // 60yo CL≈2.55). SCr in mg/dL. PMA: FMat uses weeks, FDecline/SCRstd use years.
  // ============================================================
  var COLIN = { theta_CL:5.31, theta_V1:42.9, theta_V2:41.7, theta_Q2:3.22,
    PMA50:46.4, gamma1:2.89, AGE50:61.6, gamma2:2.24, theta_SCR:0.649, theta_STDY10:0.294 };
  function _colinPMAyr(pt){ return pt.age + 40.0/52.0; }          // non-neonate: +40 weeks
  function _colinCL(pt){
    var FSize=pt.wt/70.0;
    var PMAyr=_colinPMAyr(pt), PMAwk=PMAyr*52.0;
    var FMat=Math.pow(PMAwk,COLIN.gamma1)/(Math.pow(PMAwk,COLIN.gamma1)+Math.pow(COLIN.PMA50,COLIN.gamma1));
    var FDecline=Math.pow(PMAyr,-COLIN.gamma2)/(Math.pow(PMAyr,-COLIN.gamma2)+Math.pow(COLIN.AGE50,-COLIN.gamma2));
    var SCRstd=Math.exp(-1.228 + Math.log10(PMAyr)*0.672 + 6.27*Math.exp(-3.11*PMAyr));
    var FSCR=Math.exp(-COLIN.theta_SCR*(pt.scr - SCRstd));
    var CL=COLIN.theta_CL*Math.pow(FSize,0.75)*FMat*FDecline*FSCR;
    if(pt.heme) CL*=(1+COLIN.theta_STDY10);  // hematologic malignancy ×1.294
    return CL;
  }
  function _colinVss(pt){ return (COLIN.theta_V1+COLIN.theta_V2)*(pt.wt/70.0); } // 84.6×(WGT/70)
  // Priors from Colin 2019 Table 3 (verified): ω_CL 27.9% CV → 0.279;
  // ω_Vss 0.586 (lognormal combine of V1 27.3% + V2 97.9% IIV, size-invariant);
  // residual proportional 0.215. NOTE: paper's combined error also has an
  // additive term (1.23 mg/L SD) — engine is proportional-only, so additive is
  // NOT modeled here (flagged for backlog / future 2-comp engine).
  var COLIN_MODEL = { id:'colin', name:'Colin 2019', pop:'Pediatric 1-17yr',
    ref:'Clin Pharmacokinet 2019;58:767-80',
    crclFn:function(pt){ return IVDrugRef.calcSchwartz(pt.ht,pt.scr); },  // display only (Schwartz eGFR)
    clFn:_colinCL, vdFn:_colinVss,
    omega_cl:0.279, omega_vd:0.586, sigma:0.215 };

  // Age routing: <1 blocked by guard, 1-17 → Colin (peds), ≥18 → adult 5-model.
  function isPedsVanco(pt){ return pt && typeof pt.age==='number' && pt.age>=1 && pt.age<18; }

  // ============================================================
  // PK ENGINE — 1-compartment, zero-order infusion, superposition
  // ============================================================
  // Extracted verbatim from the (previously duplicated) engines in
  // vanco-tdm.js and tdm.js (VancoTDM) — ROADMAP P0.3a. The two copies were
  // proven semantically identical before unification; only DOM element IDs in
  // runMCMC differed, so progress reporting is parameterized via onProgress().
  // Pure math (no DOM): predictConc / calcAUC_ss / ssPeakTrough / bayesianMAP.
  // The model object is opaque to the engine (consumes crclFn/clFn/vdFn +
  // omega_cl/omega_vd/sigma/name/id), so the engine is compartment-agnostic and
  // a future 2-comp swap (P0.3b) lands here once, not in two files.

  function predictConc(t,cl,vd,doseHist){
    if(!vd||vd<=0||!cl||!isFinite(cl)||!isFinite(vd))return 0;
    const ke=cl/vd;
    if(!isFinite(ke)||ke<=0)return 0;
    let conc=0;
    for(const dh of doseHist){
      if(!dh.infusion||dh.infusion<=0)continue;
      for(let n=0;n<dh.nDoses;n++){
        const tS=dh.startTime+n*dh.interval, tE=tS+dh.infusion, k0=dh.amount/dh.infusion;
        if(t<=tS)continue;
        if(t<=tE) conc+=(k0/(ke*vd))*(1-Math.exp(-ke*(t-tS)));
        else conc+=(k0/(ke*vd))*(1-Math.exp(-ke*dh.infusion))*Math.exp(-ke*(t-tE));
      }
    }
    return isFinite(conc)?conc:0;
  }

  function calcAUC_ss(cl,vd,dose,interval,infusion){
    if(!cl||!vd||cl<=0||vd<=0||!infusion||infusion<=0||!interval||interval<=0)return NaN;
    const ke=cl/vd;
    if(!isFinite(ke)||ke<=0)return NaN;
    // Numeric integration at steady-state using accumulation factor
    const k0=dose/infusion, acc=1/(1-Math.exp(-ke*interval));
    const N=300; const dt=interval/N; let auc=0;
    for(let i=0;i<N;i++){
      const t=i*dt+dt/2; // midpoint
      let c;
      if(t<=infusion){
        const cInf=(k0/(ke*vd))*(1-Math.exp(-ke*t));
        const cCarry=(k0/(ke*vd))*(1-Math.exp(-ke*infusion))*Math.exp(-ke*(interval-infusion+t))*(acc-1);
        c=cInf+Math.max(cCarry,0);
      } else {
        const cEnd=(k0/(ke*vd))*(1-Math.exp(-ke*infusion))*acc;
        c=cEnd*Math.exp(-ke*(t-infusion));
      }
      auc+=Math.max(c,0)*dt;
    }
    return auc;
  }

  // Steady-state peak & trough
  function ssPeakTrough(cl,vd,dose,interval,infusion){
    if(!cl||!vd||cl<=0||vd<=0||!infusion||infusion<=0||!interval||interval<=0)return{peak:NaN,trough:NaN};
    const ke=cl/vd;
    if(!isFinite(ke)||ke<=0)return{peak:NaN,trough:NaN};
    const k0=dose/infusion, acc=1/(1-Math.exp(-ke*interval));
    const peak=(k0/(ke*vd))*(1-Math.exp(-ke*infusion))*acc;
    const trough=peak*Math.exp(-ke*(interval-infusion));
    return{peak:isFinite(peak)?peak:NaN,trough:isFinite(trough)?trough:NaN};
  }

  // ----- Bayesian MAP: grid search + Nelder-Mead -----
  function bayesianMAP(pt,doseHist,measuredLevels,model){
    const crcl=model.crclFn(pt);
    const popCL=model.clFn(pt), popVd=model.vdFn(pt);

    function obj(cl,vd){
      if(cl<=0||vd<=0||!isFinite(cl)||!isFinite(vd))return 1e10;
      const eCL=Math.log(cl/popCL),eVd=Math.log(vd/popVd);
      let o=eCL*eCL/model.omega_cl+eVd*eVd/model.omega_vd;
      if(!isFinite(o))return 1e10;
      for(const lv of measuredLevels){
        const pred=predictConc(lv.time,cl,vd,doseHist);
        if(pred<=0||!isFinite(pred))return 1e10;
        o+=Math.pow(Math.log(lv.value)-Math.log(pred),2)/model.sigma;
        if(!isFinite(o))return 1e10;
      }
      return o;
    }

    // Grid search
    let bCL=popCL,bVd=popVd,bObj=obj(popCL,popVd);
    for(let ci=0.3;ci<=3;ci+=0.1)for(let vi=0.5;vi<=2;vi+=0.1){
      const o=obj(popCL*ci,popVd*vi);if(o<bObj){bObj=o;bCL=popCL*ci;bVd=popVd*vi;}
    }

    // Nelder-Mead
    let sx=[{cl:bCL,vd:bVd},{cl:bCL*1.05,vd:bVd},{cl:bCL,vd:bVd*1.05}];
    const f=p=>obj(p.cl,p.vd);
    for(let it=0;it<300;it++){
      sx.sort((a,b)=>f(a)-f(b));
      const cx=(sx[0].cl+sx[1].cl)/2,cy=(sx[0].vd+sx[1].vd)/2;
      const r={cl:2*cx-sx[2].cl,vd:2*cy-sx[2].vd},fr=f(r);
      if(fr<f(sx[0])){const e={cl:3*cx-2*sx[2].cl,vd:3*cy-2*sx[2].vd};sx[2]=f(e)<fr?e:r;}
      else if(fr<f(sx[1]))sx[2]=r;
      else{const c2={cl:(cx+sx[2].cl)/2,vd:(cy+sx[2].vd)/2};
        if(f(c2)<f(sx[2]))sx[2]=c2;
        else{sx[1]={cl:(sx[0].cl+sx[1].cl)/2,vd:(sx[0].vd+sx[1].vd)/2};sx[2]={cl:(sx[0].cl+sx[2].cl)/2,vd:(sx[0].vd+sx[2].vd)/2};}
      }
      if(Math.abs(f(sx[0])-f(sx[2]))<1e-10)break;
    }
    sx.sort((a,b)=>f(a)-f(b));
    const r=sx[0];
    return{cl:r.cl,vd:r.vd,ke:r.cl/r.vd,halflife:Math.LN2/(r.cl/r.vd),popCL,popVd,crcl,objValue:f(r),
      method:measuredLevels.length>0?'Bayesian MAP':'Population PK',model:model.name,modelId:model.id};
  }

  // ----- MCMC: Metropolis-Hastings (async batched) -----
  // onProgress(pct, nSamplesSoFar, nSampTarget) is optional; call sites supply
  // their own DOM update (the only thing that differed between the two pages).
  function runMCMC(pt,doseHist,measuredLevels,model,mapR,nSamp,cb,onProgress){
    const popCL=model.clFn(pt),popVd=model.vdFn(pt);

    function logPost(cl,vd){
      if(cl<=0||vd<=0||!isFinite(cl)||!isFinite(vd))return -1e10;
      let lp=-0.5*(Math.pow(Math.log(cl/popCL),2)/model.omega_cl+Math.pow(Math.log(vd/popVd),2)/model.omega_vd);
      if(!isFinite(lp))return -1e10;
      for(const lv of measuredLevels){
        const pred=predictConc(lv.time,cl,vd,doseHist);
        if(pred<=0||!isFinite(pred))return -1e10;
        lp-=0.5*Math.pow(Math.log(lv.value)-Math.log(pred),2)/model.sigma;
        if(!isFinite(lp))return -1e10;
      }
      return lp;
    }

    const samples=[];
    let cl=mapR.cl,vd=mapR.vd,lp=logPost(cl,vd);
    const sdCL=Math.sqrt(model.omega_cl)*popCL*0.15;
    const sdVd=Math.sqrt(model.omega_vd)*popVd*0.15;
    let accepted=0;
    const burnin=Math.floor(nSamp*0.3), total=nSamp+burnin;
    let batch=0; const batchSz=100;

    function step(){
      const end=Math.min(batch+batchSz,total);
      for(let i=batch;i<end;i++){
        // Normal proposal via Box-Muller
        const u1=Math.max(Math.random(),1e-15),u2=Math.random();
        const z1=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
        const z2=Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);
        const pCL=cl+z1*sdCL*2.4, pVd=vd+z2*sdVd*2.4;
        if(!isFinite(pCL)||!isFinite(pVd))continue;
        const pLP=logPost(pCL,pVd);
        if(isFinite(pLP)&&pLP>-1e9&&Math.log(Math.random())<pLP-lp){cl=pCL;vd=pVd;lp=pLP;accepted++;}
        if(i>=burnin&&cl>0&&vd>0&&isFinite(cl)&&isFinite(vd))samples.push({cl,vd,ke:cl/vd});
      }
      batch=end;
      const pct=Math.round(batch/total*100);
      if(onProgress) onProgress(pct, samples.length, nSamp);
      if(batch<total)setTimeout(step,0);
      else cb(samples,accepted/total);
    }
    step();
  }

  var engine = { predictConc:predictConc, calcAUC_ss:calcAUC_ss, ssPeakTrough:ssPeakTrough,
    bayesianMAP:bayesianMAP, runMCMC:runMCMC };

  global.VancoPK = { PK_MODELS: PK_MODELS, COLIN_MODEL: COLIN_MODEL, isPedsVanco: isPedsVanco, engine: engine };
})(typeof window !== 'undefined' ? window : this);
