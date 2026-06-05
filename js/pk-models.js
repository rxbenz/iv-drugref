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

  global.VancoPK = { PK_MODELS: PK_MODELS, COLIN_MODEL: COLIN_MODEL, isPedsVanco: isPedsVanco };
})(typeof window !== 'undefined' ? window : this);
