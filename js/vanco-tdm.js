(function() {
  'use strict';

  // Track page view when module loads
  document.addEventListener('DOMContentLoaded', function() {
    IVDrugRef.trackPageView('vanco-tdm');
  });

// ============================================================
// VANCOMYCIN BAYESIAN TDM v2.0
// 3 PK Models + MAP (Nelder-Mead) + MCMC (Metropolis-Hastings)
// ============================================================

const PK_MODELS = [
  { id:'buelga', name:'Buelga 2005', pop:'General adults',
    ref:'Antimicrob Agents Chemother 2005;49:4934-41',
    clFn:(crcl)=>0.0048*crcl, vdFn:(wt)=>0.65*wt,
    omega_cl:0.25, omega_vd:0.15, sigma:0.10 },
  { id:'roberts', name:'Roberts 2011', pop:'ICU / Critically ill',
    ref:'Antimicrob Agents Chemother 2011;55:2704-9',
    clFn:(crcl)=>0.024*crcl+1.93, vdFn:(wt)=>0.511*wt,
    omega_cl:0.30, omega_vd:0.20, sigma:0.12 },
  { id:'goti', name:'Goti 2018', pop:'Hospitalized adults',
    ref:'Clin Pharmacokinet 2018;57:367-82',
    clFn:(crcl)=>0.0154*crcl+0.32, vdFn:(wt)=>0.70*wt,
    omega_cl:0.22, omega_vd:0.18, sigma:0.08 },
  { id:'adane', name:'Adane 2015', pop:'Obese (BMI ≥30)',
    ref:'Pharmacotherapy 2015;35:127-139',
    // 1-comp model: CL = 0.0169*CrCl + 0.94, Vd = 0.55*ABW (adjusted body weight)
    clFn:(crcl)=>0.0169*crcl+0.94, vdFn:(wt,ht,sex)=>{
      if(!ht||ht<=0) return 0.55*wt;
      const htIn=ht/2.54; const ibw=sex==='M'?50+2.3*(htIn-60):45.5+2.3*(htIn-60);
      const abw = wt > ibw*1.3 ? ibw+0.4*(wt-ibw) : wt;
      return 0.55*abw;
    },
    omega_cl:0.28, omega_vd:0.22, sigma:0.11,
    useABW:true },
  { id:'bourguignon', name:'Bourguignon 2016', pop:'Elderly (≥80 yr)',
    ref:'Antimicrob Agents Chemother 2016;60:4563-7',
    // CL = 0.0117*CrCl + 0.28, Vd = 0.52*TBW
    clFn:(crcl)=>0.0117*crcl+0.28, vdFn:(wt)=>0.52*wt,
    omega_cl:0.35, omega_vd:0.20, sigma:0.13 }
];

let selectedModel='auto', currentPK=null, mcmcSamples=[], allModelResults=[];
let lastMCMCAcceptRate=0, lastMCMCSampleCount=0, lastSamplingWarnings=[];

// --- Helpers (consolidated into core.js) ---
function cockcroft(age,wt,scr,sex,ht){ return IVDrugRef.calcCockcroftGault(age,wt,scr,sex,ht); }
function getPatient(){
  var p=IVDrugRef.getPatientFromForm();
  var albEl=document.getElementById('ptAlb'), dialEl=document.getElementById('ptDialysis');
  return{wt:p.wt,age:p.age,sex:p.sex,scr:p.scr,ht:p.ht,
    albumin:albEl&&albEl.value?+albEl.value:null,
    dialysis:dialEl?dialEl.value:'none'};
}
function updateCrCl(){
  const p=getPatient();
  const crcl=cockcroft(p.age,p.wt,p.scr,p.sex,p.ht);
  let label=crcl.toFixed(1)+' mL/min';
  if(p.ht>0){const htIn=p.ht/2.54;const ibw=p.sex==='M'?50+2.3*(htIn-60):45.5+2.3*(htIn-60);if(p.wt>ibw*1.3)label+=' (ABW)';if(p.age>=65&&p.scr<0.7)label+=' ⚠elderly';}
  var crclEl=document.getElementById('ptCrCl'); if(crclEl) crclEl.value=label;
}

// --- Dose & Level State (datetime-based) ---
// Internal: all times stored as hours from first dose (t=0)
// UI: user enters date + clock time, system converts
let doses=[{amount:1000,interval:12,infusion:1,nDoses:3,dateTime:''}];
let levels=[{value:15,dateTime:''}];
let referenceTime=null; // epoch ms of first dose

function getDefaultDateTime(offsetHrs=0){
  const d=new Date();d.setHours(d.getHours()-24+offsetHrs);d.setMinutes(0,0,0);
  return d.toISOString().slice(0,16); // yyyy-MM-ddTHH:mm
}

function dtToHours(dtStr){
  if(!dtStr||!referenceTime) return 0;
  return (new Date(dtStr).getTime()-referenceTime)/3600000;
}

function updateReferenceTime(){
  if(doses[0]?.dateTime){
    referenceTime=new Date(doses[0].dateTime).getTime();
  }
}

function buildDoseHist(){
  updateReferenceTime();
  return doses.map(d=>({
    amount:d.amount, interval:d.interval, infusion:d.infusion, nDoses:d.nDoses,
    startTime: dtToHours(d.dateTime)
  }));
}

function buildLevels(){
  updateReferenceTime();
  return levels.map(l=>({
    value:l.value, time: dtToHours(l.dateTime)
  }));
}

// --- Sampling Adequacy Analysis ---
// Count doses whose infusion completed before a given time point
function countCompletedDoses(dh, beforeTime){
  let count=0;
  for(const d of dh){
    for(let n=0;n<d.nDoses;n++){
      const infEnd=d.startTime+n*d.interval+d.infusion;
      if(infEnd<=beforeTime) count++;
    }
  }
  return count;
}

function analyzeSampling(){
  const dh=buildDoseHist(), lvls=buildLevels();
  const warnings=[];

  // Count total doses given
  let totalDoses=0, lastDoseEnd=0;
  for(const d of dh){
    totalDoses+=d.nDoses;
    lastDoseEnd=Math.max(lastDoseEnd, d.startTime + (d.nDoses-1)*d.interval + d.infusion);
  }

  for(const lv of lvls){
    // Steady state check: count doses that finished infusion before sampling time
    const dosesBeforeSample=countCompletedDoses(dh, lv.time);
    if(dosesBeforeSample<4 && totalDoses>=1){
      warnings.push({type:'pre-ss', severity:'amber',
        msg:`⚠ Level ที่ ${lv.value.toFixed(1)} mcg/mL เจาะหลัง dose ที่ ${dosesBeforeSample} (ก่อน steady state ≥4 doses) — ผล Bayesian อาจไม่แม่นยำ`});
    }

    // True trough check: should be ≤30min before next dose
    let isTrueTrough=false;
    for(const d of dh){
      for(let n=1;n<d.nDoses;n++){
        const nextDoseTime=d.startTime+n*d.interval;
        const diff=nextDoseTime-lv.time;
        if(diff>=0 && diff<=1) isTrueTrough=true; // within 1hr before next dose
      }
    }
    // Check if it looks like a trough (value typically <25)
    if(lv.value<25 && !isTrueTrough && lvls.length===1){
      warnings.push({type:'not-trough', severity:'amber',
        msg:`📍 Level ${lv.value.toFixed(1)} อาจไม่ใช่ true trough — true trough ควรเจาะ ≤30 นาทีก่อน dose ถัดไป (Bayesian MAP ยังทำงานได้จาก random level)`});
    }
  }

  return warnings;
}

// Recommend optimal sampling times
function getRecommendedSamplingTimes(){
  const dh=buildDoseHist();
  if(dh.length===0) return [];
  const recs=[];

  // Find the start time of the 4th dose across all entries
  const allDoseStarts=[];
  for(const d of dh){
    for(let n=0;n<d.nDoses;n++){
      allDoseStarts.push({start:d.startTime+n*d.interval, infusion:d.infusion, interval:d.interval});
    }
  }
  allDoseStarts.sort((a,b)=>a.start-b.start);
  if(allDoseStarts.length<4){
    // Not enough doses yet — recommend based on projected 4th dose
    const lastEntry=dh[dh.length-1];
    const totalNow=allDoseStarts.length;
    const remaining=4-totalNow;
    const projected=lastEntry.startTime+(lastEntry.nDoses-1)*lastEntry.interval+remaining*lastEntry.interval;
    if(projected>0 && referenceTime){
      const trDt=new Date(referenceTime+(projected-0.5)*3600000);
      recs.push({type:'trough',time:projected-0.5,dt:trDt,
        label:`Trough: ${trDt.toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (30 นาทีก่อน dose #4)`});
      const pkTime=projected+lastEntry.infusion+1;
      const pkDt=new Date(referenceTime+pkTime*3600000);
      recs.push({type:'peak',time:pkTime,dt:pkDt,
        label:`Peak: ${pkDt.toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (1 hr หลัง infusion dose #4)`});
    }
    return recs;
  }

  // 4th dose info (index 3)
  const dose4=allDoseStarts[3];
  const doseNum=4;

  // Trough: 30 min before 4th dose
  const troughTime=dose4.start-0.5;
  if(troughTime>0 && referenceTime){
    const trDt=new Date(referenceTime+troughTime*3600000);
    recs.push({type:'trough',time:troughTime,dt:trDt,
      label:`Trough: ${trDt.toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (30 นาทีก่อน dose #${doseNum})`});
  }

  // Peak: 1 hr after end of 4th dose infusion
  const peakTime=dose4.start+dose4.infusion+1;
  if(peakTime>0 && referenceTime){
    const pkDt=new Date(referenceTime+peakTime*3600000);
    recs.push({type:'peak',time:peakTime,dt:pkDt,
      label:`Peak: ${pkDt.toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (1 hr หลัง infusion dose #${doseNum})`});
  }

  return recs;
}

function renderDoses(){
  if(!doses[0].dateTime) doses[0].dateTime=getDefaultDateTime(0);
  document.getElementById('doseList').innerHTML=doses.map((d,i)=>`
    <div class="dose-entry"><div class="dose-entry-head"><span>Dose #${i+1}</span>${doses.length>1?`<button data-action="removeDose" data-index="${i}">×</button>`:''}</div>
    <div class="row row-3" style="gap:8px"><div class="field"><label>Amount (mg)</label><input type="number" value="${d.amount}" min="100" max="4000" step="250" data-action="setDose" data-index="${i}" data-field="amount"></div>
    <div class="field"><label>Interval (hr)</label><input type="number" value="${d.interval}" min="4" max="72" data-action="setDose" data-index="${i}" data-field="interval"></div>
    <div class="field"><label>Infusion (hr)</label><input type="number" value="${d.infusion}" min="0.5" max="4" step="0.5" data-action="setDose" data-index="${i}" data-field="infusion"></div></div>
    <div class="row row-2" style="gap:8px;margin-top:8px"><div class="field"><label>🕐 เริ่มให้ยา (วัน+เวลา)</label><input type="datetime-local" value="${d.dateTime}" data-action="setDoseDateTime" data-index="${i}"></div>
    <div class="field"><label># doses ที่ให้แล้ว</label><input type="number" value="${d.nDoses}" min="1" max="50" data-action="setDoseCount" data-index="${i}"></div></div></div>`).join('');
  renderSamplingAdvice();
}
function addDose(){const l=doses[doses.length-1];const nextDt=l.dateTime?new Date(new Date(l.dateTime).getTime()+l.interval*l.nDoses*3600000).toISOString().slice(0,16):'';doses.push({amount:l.amount,interval:l.interval,infusion:l.infusion,nDoses:1,dateTime:nextDt});renderDoses();}

function renderLevels(){
  document.getElementById('levelList').innerHTML=levels.map((l,i)=>`
    <div class="level-entry"><div class="row row-2" style="gap:8px"><div class="field"><label>Level #${i+1} (mcg/mL)</label><input type="number" value="${l.value}" min="0.1" max="100" step="0.1" data-action="setLevel" data-index="${i}" data-field="value"></div>
    <div class="field"><label>🕐 เวลาเจาะ</label><input type="datetime-local" value="${l.dateTime}" data-action="setLevelDateTime" data-index="${i}"></div></div>
    ${levels.length>1?`<button class="btn btn-sm" style="background:var(--red-dim);color:var(--red);margin-top:6px" data-action="removeLevel" data-index="${i}">ลบ</button>`:''}</div>`).join('');
  renderSamplingAdvice();
}
function addLevel(){const nextDt=doses[0]?.dateTime?new Date(new Date(doses[0].dateTime).getTime()+35.5*3600000).toISOString().slice(0,16):'';levels.push({value:10,dateTime:nextDt});renderLevels();}

// --- Sampling Advice Panel ---
function renderSamplingAdvice(){
  updateReferenceTime();
  let adviceEl=document.getElementById('samplingAdvice');
  if(!adviceEl){
    const card=document.createElement('div');card.className='card';card.id='samplingAdviceCard';
    card.innerHTML='<div class="card-head">📍 SAMPLING ADEQUACY</div><div class="card-body" id="samplingAdvice"></div>';
    const levelCard=document.getElementById('levelList')?.closest('.card');
    if(levelCard)levelCard.after(card);
    adviceEl=document.getElementById('samplingAdvice');
  }
  if(!adviceEl||!referenceTime){if(adviceEl)adviceEl.innerHTML='<div style="font-size:12px;color:var(--text3)">กรุณากรอกเวลาให้ยาก่อน</div>';return;}

  let html='';

  // Warnings
  const warns=analyzeSampling();
  for(const w of warns){
    html+=`<div class="info-box ${w.severity}" style="font-size:11px">${w.msg}</div>`;
  }

  // Recommended times
  const recs=getRecommendedSamplingTimes();
  if(recs.length>0){
    html+='<div style="font-size:11px;color:var(--text2);margin-top:8px"><strong>📋 แนะนำเวลาเจาะ (at steady state):</strong></div>';
    for(const r of recs){
      html+=`<div style="font-size:12px;padding:6px 8px;margin-top:4px;background:var(--bg);border-radius:6px;border:1px solid var(--card-border)">
        <span style="color:var(--${r.type==='trough'?'purple':'blue'})">${r.type==='trough'?'🔻':'🔺'}</span> ${r.label}</div>`;
    }
  }

  // Steady-state timeline
  const dh=buildDoseHist();
  if(dh.length>0){
    const lastEntry=dh[dh.length-1];
    let totalDoses=0;for(const d of dh)totalDoses+=d.nDoses;
    const ssAt=4; // doses needed for SS
    const atSS=totalDoses>=ssAt;
    const progress=Math.min(totalDoses/ssAt*100,100);
    const barColor=atSS?'var(--green)':'var(--amber)';
    html+=`<div style="margin-top:10px;font-size:11px;color:var(--text2)"><strong>📊 Steady-State Progress:</strong> ${totalDoses} / ${ssAt} doses (${atSS?'✅ ถึง SS แล้ว':'⏳ ยังไม่ถึง SS'})</div>
    <div class="progress" style="margin:4px 0"><div class="progress-bar" style="width:${progress}%;background:${barColor}"></div></div>`;
  }

  if(!warns.length && html.indexOf('แนะนำ')===-1) html='<div style="font-size:12px;color:var(--green)">✅ ยังไม่พบปัญหาเรื่อง sampling</div>';

  adviceEl.innerHTML=html;
}

// --- Model Selection UI ---
function getRecommendedModel(pt){
  if(!pt) pt=getPatient();
  const ht=pt.ht||170, htIn=ht/2.54;
  const ibw = pt.sex==='M' ? 50+2.3*(htIn-60) : 45.5+2.3*(htIn-60);
  const bmi = pt.wt / ((ht/100)**2);
  if(bmi >= 30 || pt.wt > ibw*1.3) return 'adane';
  if(pt.age >= 80) return 'bourguignon';
  return null; // auto is fine
}

function renderModelSelect(){
  const recModel = getRecommendedModel();
  const all=[{id:'auto',name:'Auto-select',pop:'Best fit (lowest OFV)'},...PK_MODELS];
  document.getElementById('modelSelect').innerHTML=all.map(m=>{
    const isRec = m.id===recModel;
    return `<div class="model-card ${selectedModel===m.id?'active':''}" data-action="selectModel" data-model="${m.id}">
      <div class="mc-name">${m.name} ${isRec?'<span style="color:var(--amber);font-size:10px">⭐ แนะนำ</span>':''}</div>
      <div class="mc-sub">${m.pop}${m.ref?' — '+m.ref:''}</div></div>`;
  }).join('');
  // Show recommendation info
  if(recModel){
    const pt=getPatient();
    const bmi = pt.wt/((pt.ht/100)**2);
    let msg='';
    if(recModel==='adane') msg=`<strong>⚠ BMI ${bmi.toFixed(1)} → แนะนำ Adane 2015 (Obesity model)</strong><br>Model นี้ใช้ ABW สำหรับ Vd + CrCl ที่ adjusted → แม่นยำกว่า general models ในคนอ้วน`;
    else if(recModel==='bourguignon') msg=`<strong>👴 อายุ ${pt.age} ปี → แนะนำ Bourguignon 2016 (Elderly model)</strong><br>Validated ในผู้ป่วย >80 ปี ที่มี CL ต่ำกว่า general population`;
    document.getElementById('modelSelect').innerHTML+=`<div class="info-box amber" style="font-size:11px;margin-top:8px">${msg}</div>`;
  }
}

// ============================================================
// PK ENGINE: 1-compartment, zero-order infusion, superposition
// ============================================================
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

// ============================================================
// BAYESIAN MAP: Grid search + Nelder-Mead
// ============================================================
function bayesianMAP(pt,doseHist,measuredLevels,model){
  const crcl=cockcroft(pt.age,pt.wt,pt.scr,pt.sex,pt.ht);
  const popCL=model.clFn(crcl), popVd=model.vdFn(pt.wt,pt.ht,pt.sex);

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

// ============================================================
// MCMC: Metropolis-Hastings (async batched)
// ============================================================
function runMCMC(pt,doseHist,measuredLevels,model,mapR,nSamp,cb){
  const crcl=cockcroft(pt.age,pt.wt,pt.scr,pt.sex,pt.ht);
  const popCL=model.clFn(crcl),popVd=model.vdFn(pt.wt,pt.ht,pt.sex);

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
    var barEl=document.getElementById('mcmcBar'); if(barEl) barEl.style.width=pct+'%';
    var statEl=document.getElementById('mcmcStatus'); if(statEl) statEl.textContent='MCMC '+pct+'% ('+samples.length+'/'+nSamp+' samples)';
    if(batch<total)setTimeout(step,0);
    else cb(samples,accepted/total);
  }
  step();
}

// ============================================================
// GRAPH: Canvas with CI band
// ============================================================
function drawGraph(pk,doseHist,measuredLvls,optDose,optInterval,optInfusion,mcmc){
  const canvas=document.getElementById('pkGraph'),ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr;canvas.height=320*dpr;ctx.scale(dpr,dpr);
  const W=rect.width,H=320;

  // Time range
  let maxTime=0;
  for(const d of doseHist)maxTime=Math.max(maxTime,d.startTime+d.interval*d.nDoses+d.interval);
  maxTime=Math.max(maxTime,48);
  const totalTime=maxTime+optInterval*3, maxConc=60;
  const pad={left:48,right:16,top:16,bottom:36};
  const gW=W-pad.left-pad.right,gH=H-pad.top-pad.bottom;
  const tX=t=>pad.left+(t/totalTime)*gW, cY=c=>pad.top+gH-(Math.min(c,maxConc)/maxConc)*gH;

  // Background
  ctx.fillStyle='#0f172a';ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=0.5;
  for(let t=0;t<=totalTime;t+=12){ctx.beginPath();ctx.moveTo(tX(t),pad.top);ctx.lineTo(tX(t),H-pad.bottom);ctx.stroke();}
  for(let c=0;c<=maxConc;c+=10){ctx.beginPath();ctx.moveTo(pad.left,cY(c));ctx.lineTo(W-pad.right,cY(c));ctx.stroke();}

  // Target zone (trough 10-20)
  ctx.fillStyle='rgba(74,222,128,.06)';ctx.fillRect(pad.left,cY(20),gW,cY(10)-cY(20));
  ctx.strokeStyle='rgba(74,222,128,.15)';ctx.setLineDash([3,3]);
  [10,20].forEach(c=>{ctx.beginPath();ctx.moveTo(pad.left,cY(c));ctx.lineTo(W-pad.right,cY(c));ctx.stroke();});
  ctx.setLineDash([]);

  // Axes labels
  ctx.fillStyle='#64748b';ctx.font='10px "DM Sans"';ctx.textAlign='center';
  for(let t=0;t<=totalTime;t+=12)ctx.fillText(t+'h',tX(t),H-pad.bottom+14);
  ctx.textAlign='right';
  for(let c=0;c<=maxConc;c+=10)ctx.fillText(c,pad.left-5,cY(c)+3);
  ctx.save();ctx.translate(11,H/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('mcg/mL',0,0);ctx.restore();

  // 90% CI band from MCMC
  if(mcmc&&mcmc.length>20){
    const step=totalTime/200;
    for(let t=0;t<=maxTime;t+=step){
      const concs=[];
      for(let si=0;si<mcmc.length;si+=Math.max(1,Math.floor(mcmc.length/300))){
        concs.push(predictConc(t,mcmc[si].cl,mcmc[si].vd,doseHist));
      }
      concs.sort((a,b)=>a-b);
      const lo=concs[Math.floor(concs.length*0.05)],hi=concs[Math.floor(concs.length*0.95)];
      ctx.fillStyle='rgba(56,189,248,0.1)';
      const x1=tX(t),x2=tX(t+step);
      ctx.fillRect(x1,cY(hi),x2-x1,cY(lo)-cY(hi));
    }
  }

  // Current regimen curve (blue)
  ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.beginPath();let first=true;
  for(let t=0;t<=maxTime;t+=0.3){const c=predictConc(t,pk.cl,pk.vd,doseHist);const x=tX(t),y=cY(c);if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);}
  ctx.stroke();

  // Proposed regimen (green dashed)
  const optStart=maxTime;
  const optDH=[{amount:optDose,interval:optInterval,infusion:optInfusion,startTime:optStart,nDoses:3}];
  const carryConc=predictConc(maxTime,pk.cl,pk.vd,doseHist);
  ctx.strokeStyle='#4ade80';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.beginPath();first=true;
  for(let t=optStart;t<=totalTime;t+=0.3){
    const cNew=predictConc(t,pk.cl,pk.vd,optDH);
    const cCarry=carryConc*Math.exp(-pk.ke*(t-optStart));
    const x=tX(t),y=cY(cNew+cCarry);
    if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
  }
  ctx.stroke();ctx.setLineDash([]);

  // Transition line
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;ctx.setLineDash([2,2]);
  ctx.beginPath();ctx.moveTo(tX(maxTime),pad.top);ctx.lineTo(tX(maxTime),H-pad.bottom);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,255,255,.3)';ctx.font='9px "DM Sans"';ctx.textAlign='center';
  ctx.fillText('→ proposed',tX(maxTime)+28,pad.top+10);

  // Measured levels
  for(const lv of measuredLvls){
    const x=tX(lv.time),y=cY(lv.value);
    ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#0f172a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fbbf24';ctx.font='bold 10px "JetBrains Mono"';ctx.textAlign='center';
    ctx.fillText(lv.value.toFixed(1),x,y-9);
  }
}

// ============================================================
// MAIN RUN
// ============================================================
function runBayesian(){
  const pt=getPatient();
  const doseHist=buildDoseHist();
  const measuredLvls=buildLevels();

  // Validate datetime inputs
  if(!referenceTime){alert('กรุณากรอกเวลาให้ยา dose แรกก่อน');return;}
  for(const lv of measuredLvls){
    if(lv.time<=0){alert('กรุณากรอกเวลาเจาะ level ให้ถูกต้อง (ต้องหลังให้ยา dose แรก)');return;}
  }

  // MAP for all models
  allModelResults=PK_MODELS.map(m=>{
    const pk=bayesianMAP(pt,doseHist,measuredLvls,m);
    const lastD=doseHist[doseHist.length-1];
    const auc24=calcAUC_ss(pk.cl,pk.vd,lastD.amount,lastD.interval,lastD.infusion)*(24/lastD.interval);
    const ss=ssPeakTrough(pk.cl,pk.vd,lastD.amount,lastD.interval,lastD.infusion);
    return{...pk,auc24,ssPeak:ss.peak,ssTrough:ss.trough};
  });

  // Select best
  let bestIdx=0;
  if(selectedModel==='auto'){
    bestIdx=allModelResults.reduce((bi,r,i)=>r.objValue<allModelResults[bi].objValue?i:bi,0);
  } else {
    bestIdx=PK_MODELS.findIndex(m=>m.id===selectedModel);
    if(bestIdx<0)bestIdx=0;
  }
  currentPK=allModelResults[bestIdx];
  const bestModel=PK_MODELS[bestIdx];

  // Model comparison
  document.getElementById('modelCompare').innerHTML='<div class="model-grid">'+allModelResults.map((r,i)=>{
    const cls=r.auc24>=400&&r.auc24<=600?'green':(r.auc24<400?'amber':'red');
    return`<div class="model-card ${i===bestIdx?'active':''}" data-action="runWithModel" data-model="${PK_MODELS[i].id}">
      <div class="mc-name">${r.model} ${i===bestIdx?'⭐':''}</div>
      <div class="mc-sub">${PK_MODELS[i].pop}</div>
      <div class="mc-auc" style="color:var(--${cls})">AUC₂₄ ${r.auc24.toFixed(0)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px">CL ${r.cl.toFixed(2)} | Vd ${r.vd.toFixed(1)} | t½ ${r.halflife.toFixed(1)}h</div>
      <div style="font-size:10px;color:var(--text3)">OFV ${r.objValue.toFixed(2)}</div></div>`;
  }).join('')+'</div>';

  // Start MCMC
  document.getElementById('mcmcProgress').style.display='block';
  document.getElementById('resultsSection').style.display='none';

  // Store sampling warnings before MCMC for report access
  lastSamplingWarnings=analyzeSampling();

  runMCMC(pt,doseHist,measuredLvls,bestModel,currentPK,2000,function(samples,acceptRate){
    mcmcSamples=samples;
    lastMCMCAcceptRate=acceptRate;
    lastMCMCSampleCount=samples.length;
    document.getElementById('mcmcProgress').style.display='none';
    document.getElementById('resultsSection').style.display='block';

    // AUC CI from MCMC — filter NaN to prevent corrupted percentiles
    const lastD=doseHist[doseHist.length-1];
    const aucArr=samples.map(s=>calcAUC_ss(s.cl,s.vd,lastD.amount,lastD.interval,lastD.infusion)*(24/lastD.interval)).filter(v=>isFinite(v)).sort((a,b)=>a-b);
    const aucMAP=currentPK.auc24;
    const aucLo=aucArr.length>0?aucArr[Math.floor(aucArr.length*0.05)]:NaN;
    const aucHi=aucArr.length>0?aucArr[Math.floor(aucArr.length*0.95)]:NaN;
    // Store on currentPK for share/export access
    currentPK.aucLo=aucLo; currentPK.aucHi=aucHi;

    // CL CI
    const clArr=samples.map(s=>s.cl).filter(v=>isFinite(v)).sort((a,b)=>a-b);
    const clLo=clArr.length>0?clArr[Math.floor(clArr.length*0.05)]:NaN;
    const clHi=clArr.length>0?clArr[Math.floor(clArr.length*0.95)]:NaN;
    const keArr=samples.map(s=>s.ke).filter(v=>isFinite(v)).sort((a,b)=>a-b);
    const keLo=keArr.length>0?keArr[Math.floor(keArr.length*0.05)]:NaN;
    const keHi=keArr.length>0?keArr[Math.floor(keArr.length*0.95)]:NaN;

    let aucCls='green',aucMsg='✅ AUC₂₄ อยู่ใน target range (400-600)';
    if(aucMAP<400){aucCls='amber';aucMsg='⚠ ต่ำกว่า target → อาจ subtherapeutic';}
    else if(aucMAP>600){aucCls='red';aucMsg='⚠ สูงกว่า target → เสี่ยง nephrotoxicity';}

    document.getElementById('aucResult').innerHTML=`
      <div class="result-box ${aucCls}">
        <div class="result-title">AUC₂₄/MIC (${currentPK.model})</div>
        <div class="result-value" style="color:var(--${aucCls})">${aucMAP.toFixed(0)}</div>
        <div class="result-sub" style="color:var(--${aucCls})">${aucMsg}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:6px">90% CI: <span class="ci-badge" style="background:var(--${aucCls}-dim);color:var(--${aucCls})">${aucLo.toFixed(0)} — ${aucHi.toFixed(0)}</span></div>
      </div>
      <div class="share-row">
        <button class="btn" data-action="shareVancoLine">\ud83d\udccb \u0e41\u0e0a\u0e23\u0e4c LINE</button>
        <button class="btn" data-action="exportVancoPdf">\ud83d\udcc4 Export PDF</button>
      </div>`;

    document.getElementById('pkStats').innerHTML=`
      <div class="stat"><div class="stat-label">SS Peak</div><div class="stat-val" style="color:var(--blue)">${currentPK.ssPeak.toFixed(1)}</div></div>
      <div class="stat"><div class="stat-label">SS Trough</div><div class="stat-val" style="color:var(--purple)">${currentPK.ssTrough.toFixed(1)}</div></div>
      <div class="stat"><div class="stat-label">t½</div><div class="stat-val">${currentPK.halflife.toFixed(1)}h</div></div>
      <div class="stat"><div class="stat-label">Accept</div><div class="stat-val">${(acceptRate*100).toFixed(0)}%</div></div>`;

    document.getElementById('ciInfo').innerHTML=`
      <div class="info-box cyan" style="font-size:11px"><b>90% Credible Intervals (${samples.length} MCMC samples):</b><br>
      AUC₂₄: ${aucLo.toFixed(0)}–${aucHi.toFixed(0)} &nbsp;|&nbsp; CL: ${clLo.toFixed(3)}–${clHi.toFixed(3)} L/hr &nbsp;|&nbsp; Ke: ${keLo.toFixed(4)}–${keHi.toFixed(4)} hr⁻¹</div>`;

    document.getElementById('pkTable').innerHTML=`
      <tr><td>Method</td><td style="color:var(--blue)">${currentPK.method} + MCMC</td></tr>
      <tr><td>PK Model</td><td>${currentPK.model}</td></tr>
      <tr><td>CrCl</td><td>${currentPK.crcl.toFixed(1)} mL/min</td></tr>
      <tr><td>CL (MAP)</td><td>${currentPK.cl.toFixed(3)} L/hr</td></tr>
      <tr><td>Vd (MAP)</td><td>${currentPK.vd.toFixed(1)} L</td></tr>
      <tr><td>Ke</td><td>${currentPK.ke.toFixed(4)} hr⁻¹</td></tr>
      <tr><td>Half-life</td><td>${currentPK.halflife.toFixed(1)} hr</td></tr>
      <tr><td>Pop CL</td><td>${currentPK.popCL.toFixed(3)} L/hr</td></tr>
      <tr><td>Pop Vd</td><td>${currentPK.popVd.toFixed(1)} L</td></tr>
      <tr><td>OFV</td><td>${currentPK.objValue.toFixed(4)}</td></tr>
      <tr><td>MCMC samples</td><td>${samples.length} (accept ${(acceptRate*100).toFixed(1)}%)</td></tr>`;

    document.getElementById('optDose').value=lastD.amount;
    document.getElementById('optInterval').value=lastD.interval;
    document.getElementById('optInfusion').value=lastD.infusion;
    updateOptimizer();
    genDoseOpts();
    document.getElementById('resultsSection').scrollIntoView({behavior:'smooth'});

    // v5.1: track TDM usage with full data
    if (typeof trackTDMResult === 'function') {
      trackTDMResult(
        currentPK.model,
        aucMAP, aucLo, aucHi, acceptRate,
        pt, currentPK, doseHist, measuredLvls
      );
    }
  });
}

// ============================================================
// DOSE OPTIMIZER
// ============================================================
function updateOptimizer(){
  if(!currentPK)return;
  const od=+document.getElementById('optDose').value,oi=+document.getElementById('optInterval').value,oif=+document.getElementById('optInfusion').value;
  document.getElementById('optDoseVal').textContent=od+' mg';
  document.getElementById('optIntervalVal').textContent='q'+oi+'h';
  document.getElementById('optInfusionVal').textContent=oif+' hr';
  const auc24=calcAUC_ss(currentPK.cl,currentPK.vd,od,oi,oif)*(24/oi);
  const ss=ssPeakTrough(currentPK.cl,currentPK.vd,od,oi,oif);
  let cls='green',msg='✅ In target';if(auc24<400){cls='amber';msg='⚠ Below';}else if(auc24>600){cls='red';msg='⚠ Above';}
  const vol=od<=1000?200:250;
  document.getElementById('optResult').innerHTML=`
    <div class="result-box ${cls}" style="padding:10px">
      <div style="font-size:20px;font-weight:700;font-family:var(--mono);color:var(--${cls})">AUC₂₄ = ${auc24.toFixed(0)} ${msg}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">Peak ${ss.peak.toFixed(1)} | Trough ${ss.trough.toFixed(1)} | ${od}mg in NSS ${vol}mL → ${Math.round(vol/oif)} mL/hr</div>
    </div>`;
  drawGraph(currentPK,buildDoseHist(),buildLevels(),od,oi,oif,mcmcSamples);
}

function genDoseOpts(){
  if(!currentPK)return;
  const qs=[8,12,24,36,48],ds=[500,750,1000,1250,1500,1750,2000];let opts=[];
  for(const q of qs)for(const d of ds){
    const auc=calcAUC_ss(currentPK.cl,currentPK.vd,d,q,1)*(24/q);
    if(auc>=300&&auc<=750){
      const ss=ssPeakTrough(currentPK.cl,currentPK.vd,d,q,1);
      opts.push({dose:d,q,auc,tr:ss.trough,pk:ss.peak,ok:auc>=400&&auc<=600});
    }
  }
  opts.sort((a,b)=>Math.abs(a.auc-500)-Math.abs(b.auc-500));
  opts=opts.slice(0,6);
  document.getElementById('doseCompare').innerHTML=opts.map(o=>{
    const c=o.ok?'green':(o.auc<400?'amber':'red');
    return`<div class="dose-option" data-action="doseOption" data-dose="${o.dose}" data-q="${o.q}">
      <div class="opt-dose">${o.dose} mg q${o.q}h</div>
      <div class="opt-auc">AUC₂₄ ${o.auc.toFixed(0)} | Pk ${o.pk.toFixed(1)} | Tr ${o.tr.toFixed(1)}</div>
      <span class="opt-badge" style="background:var(--${c}-dim);color:var(--${c})">${o.ok?'In target':o.auc<400?'Below':'Above'}</span></div>`;
  }).join('');
}

// ============================================================
// SHARE / EXPORT HELPERS
// ============================================================
function fmtDT(dtStr) {
  if (!dtStr) return '-';
  var d = new Date(dtStr);
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var yy = d.getFullYear()+543;
  var hh = String(d.getHours()).padStart(2,'0');
  var mn = String(d.getMinutes()).padStart(2,'0');
  return dd+'/'+mm+'/'+yy+' '+hh+':'+mn;
}

function getOptData() {
  var el = document.getElementById('optDose');
  if (!el || !currentPK) return null;
  var od = +el.value, oi = +document.getElementById('optInterval').value, oif = +document.getElementById('optInfusion').value;
  var auc24 = calcAUC_ss(currentPK.cl, currentPK.vd, od, oi, oif) * (24/oi);
  var ss = ssPeakTrough(currentPK.cl, currentPK.vd, od, oi, oif);
  return { dose: od, interval: oi, infusion: oif, auc24: auc24, peak: ss.peak, trough: ss.trough };
}

function buildVancoShareText() {
  if (!currentPK) return '';
  var SE = IVDrugRef.ShareExport;
  var dt = SE ? SE.thaiDateTime() : '';
  var pt = getPatient();
  var crcl = cockcroft(pt.age, pt.wt, pt.scr, pt.sex, pt.ht);
  var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07';

  var interp = '\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19 target range';
  if (currentPK.auc24 < 400) interp = '\u0e15\u0e48\u0e33\u0e01\u0e27\u0e48\u0e32 target (subtherapeutic)';
  else if (currentPK.auc24 > 600) interp = '\u0e2a\u0e39\u0e07\u0e01\u0e27\u0e48\u0e32 target (\u0e40\u0e2a\u0e35\u0e48\u0e22\u0e07 nephrotoxicity)';

  var text = '=== Vancomycin TDM ===\n';
  text += '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: ' + dt + '\n\n';
  text += '\u0e1c\u0e39\u0e49\u0e1b\u0e48\u0e27\u0e22: ' + sex + ' ' + pt.age + ' \u0e1b\u0e35 ' + pt.wt + ' kg';
  if (pt.ht) text += ' Ht ' + pt.ht + ' cm';
  text += ' SCr ' + pt.scr + '\n';
  text += 'CrCl: ' + crcl.toFixed(1) + ' mL/min';
  if (pt.albumin) text += ' | Albumin: ' + pt.albumin.toFixed(1) + ' g/dL';
  text += ' | Dialysis: ' + (pt.dialysis && pt.dialysis !== 'none' ? pt.dialysis : '\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e25\u0e49\u0e32\u0e07\u0e44\u0e15') + '\n\n';

  // Dose history
  text += '--- \u0e02\u0e19\u0e32\u0e14\u0e22\u0e32\u0e40\u0e14\u0e34\u0e21 ---\n';
  for (var i = 0; i < doses.length; i++) {
    var d = doses[i];
    text += '#' + (i+1) + ': ' + d.amount + ' mg q' + d.interval + 'h';
    text += ' (infuse ' + d.infusion + 'h, ' + d.nDoses + ' doses)';
    if (d.dateTime) text += ' \u0e40\u0e23\u0e34\u0e48\u0e21 ' + fmtDT(d.dateTime);
    text += '\n';
  }

  // Measured levels
  text += '\n--- \u0e1c\u0e25 Level ---\n';
  for (var j = 0; j < levels.length; j++) {
    var lv = levels[j];
    text += '#' + (j+1) + ': ' + lv.value + ' mcg/mL';
    if (lv.dateTime) text += ' \u0e40\u0e08\u0e32\u0e30 ' + fmtDT(lv.dateTime);
    text += '\n';
  }

  // AUC result
  text += '\n--- \u0e1c\u0e25\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c ---\n';
  text += 'AUC\u2082\u2084: ' + currentPK.auc24.toFixed(0) + ' (target 400-600)\n';
  text += '90% CI: ' + currentPK.aucLo.toFixed(0) + '\u2013' + currentPK.aucHi.toFixed(0) + '\n';
  text += '\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e41\u0e1b\u0e25\u0e1c\u0e25: ' + interp + '\n';
  text += 'SS Peak: ' + currentPK.ssPeak.toFixed(1) + ' | SS Trough: ' + currentPK.ssTrough.toFixed(1) + '\n';
  text += 'PK: CL ' + currentPK.cl.toFixed(3) + ' L/hr | Vd ' + currentPK.vd.toFixed(1) + ' L | t\u00bd ' + currentPK.halflife.toFixed(1) + 'h\n';
  text += 'Model: ' + currentPK.model + '\n';

  // Diagnostics
  text += '\n--- Diagnostics ---\n';
  // Sampling adequacy
  var dh = buildDoseHist();
  var totalDosesForReport = 0; for (var di = 0; di < dh.length; di++) totalDosesForReport += dh[di].nDoses;
  var ssStatus = totalDosesForReport >= 4 ? '\u2705 At steady state (' + totalDosesForReport + ' doses)' : '\u26a0 Pre-steady state (' + totalDosesForReport + '/4 doses)';
  text += 'Sampling: ' + ssStatus + '\n';
  if (lastSamplingWarnings.length > 0) {
    for (var wi = 0; wi < lastSamplingWarnings.length; wi++) {
      text += '  ' + lastSamplingWarnings[wi].msg.replace(/<[^>]*>/g, '') + '\n';
    }
  }
  text += 'MCMC: ' + lastMCMCSampleCount + ' samples | Accept rate ' + (lastMCMCAcceptRate * 100).toFixed(1) + '%\n';

  // Dose optimizer recommendation
  var opt = getOptData();
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

  text += '\n---\nIV DrugRef v' + (IVDrugRef.VERSION || '5.1.0') + '\nhttps://rxbenz.github.io/iv-drugref/\n';
  text += '\u26a0 \u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e0a\u0e48\u0e27\u0e22\u0e04\u0e33\u0e19\u0e27\u0e13 \u0e44\u0e21\u0e48\u0e17\u0e14\u0e41\u0e17\u0e19 clinical judgment';
  return text;
}

function buildVancoPrintData() {
  if (!currentPK) return null;
  var pt = getPatient();
  var crcl = cockcroft(pt.age, pt.wt, pt.scr, pt.sex, pt.ht);
  var sex = pt.sex === 'M' ? '\u0e0a\u0e32\u0e22' : '\u0e2b\u0e0d\u0e34\u0e07';
  var cellSt = 'padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:12px';

  var interp = 'In target (400-600)';
  var interpColor = '#16a34a';
  if (currentPK.auc24 < 400) { interp = 'Below target (<400)'; interpColor = '#d97706'; }
  else if (currentPK.auc24 > 600) { interp = 'Above target (>600)'; interpColor = '#dc2626'; }

  var dialysisLabel = pt.dialysis && pt.dialysis !== 'none' ? pt.dialysis : '\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e25\u0e49\u0e32\u0e07\u0e44\u0e15';
  var patientHtml = '<div style="font-size:13px;line-height:1.8">' +
    '<b>\u0e40\u0e1e\u0e28:</b> ' + sex + ' &nbsp; <b>\u0e2d\u0e32\u0e22\u0e38:</b> ' + pt.age + ' \u0e1b\u0e35 &nbsp; ' +
    '<b>\u0e19\u0e49\u0e33\u0e2b\u0e19\u0e31\u0e01:</b> ' + pt.wt + ' kg &nbsp; ' +
    (pt.ht ? '<b>\u0e2a\u0e48\u0e27\u0e19\u0e2a\u0e39\u0e07:</b> ' + pt.ht + ' cm &nbsp; ' : '') +
    '<b>SCr:</b> ' + pt.scr + ' mg/dL<br>' +
    '<b>CrCl:</b> ' + crcl.toFixed(1) + ' mL/min &nbsp; ' +
    (pt.albumin ? '<b>Albumin:</b> ' + pt.albumin.toFixed(1) + ' g/dL &nbsp; ' : '') +
    '<b>Dialysis:</b> ' + dialysisLabel +
    '</div>';

  // Dose history table
  var doseHtml = '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">\ud83d\udc8a \u0e02\u0e19\u0e32\u0e14\u0e22\u0e32\u0e40\u0e14\u0e34\u0e21</div>' +
    '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
    '<tr style="background:#f1f5f9"><th style="'+cellSt+';text-align:left">#</th><th style="'+cellSt+';text-align:left">Dose</th><th style="'+cellSt+';text-align:left">Regimen</th><th style="'+cellSt+';text-align:left">\u0e40\u0e27\u0e25\u0e32\u0e40\u0e23\u0e34\u0e48\u0e21</th></tr>';
  for (var i = 0; i < doses.length; i++) {
    var d = doses[i];
    doseHtml += '<tr><td style="'+cellSt+'">' + (i+1) + '</td>' +
      '<td style="'+cellSt+'">' + d.amount + ' mg x' + d.nDoses + ' doses</td>' +
      '<td style="'+cellSt+'">q' + d.interval + 'h (infuse ' + d.infusion + 'h)</td>' +
      '<td style="'+cellSt+'">' + fmtDT(d.dateTime) + '</td></tr>';
  }
  doseHtml += '</table></div>';

  // Measured levels table
  var lvlHtml = '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">\ud83e\ude78 \u0e1c\u0e25 Level \u0e17\u0e35\u0e48\u0e40\u0e08\u0e32\u0e30\u0e44\u0e14\u0e49</div>' +
    '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
    '<tr style="background:#f1f5f9"><th style="'+cellSt+';text-align:left">#</th><th style="'+cellSt+';text-align:left">Level</th><th style="'+cellSt+';text-align:left">\u0e40\u0e27\u0e25\u0e32\u0e40\u0e08\u0e32\u0e30</th></tr>';
  for (var j = 0; j < levels.length; j++) {
    var lv = levels[j];
    lvlHtml += '<tr><td style="'+cellSt+'">' + (j+1) + '</td>' +
      '<td style="'+cellSt+'">' + lv.value + ' mcg/mL</td>' +
      '<td style="'+cellSt+'">' + fmtDT(lv.dateTime) + '</td></tr>';
  }
  lvlHtml += '</table></div>';

  // AUC result box + PK table
  var aucHtml = '<div style="text-align:center;padding:14px;border:2px solid ' + interpColor + ';border-radius:10px;margin-bottom:14px">' +
    '<div style="font-size:12px;color:#64748b">AUC\u2082\u2084/MIC (' + currentPK.model + ')</div>' +
    '<div style="font-size:32px;font-weight:700;color:' + interpColor + '">' + currentPK.auc24.toFixed(0) + '</div>' +
    '<div style="font-size:12px;color:' + interpColor + '">' + interp + '</div>' +
    '<div style="font-size:11px;color:#64748b;margin-top:4px">90% CI: ' + currentPK.aucLo.toFixed(0) + ' \u2013 ' + currentPK.aucHi.toFixed(0) + '</div>' +
    '</div>' +
    '<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:12px">' +
    '<tr><td style="'+cellSt+'"><b>SS Peak</b></td><td style="'+cellSt+'">' + currentPK.ssPeak.toFixed(1) + ' mcg/mL</td>' +
    '<td style="'+cellSt+'"><b>SS Trough</b></td><td style="'+cellSt+'">' + currentPK.ssTrough.toFixed(1) + ' mcg/mL</td></tr>' +
    '<tr><td style="'+cellSt+'"><b>CL</b></td><td style="'+cellSt+'">' + currentPK.cl.toFixed(3) + ' L/hr</td>' +
    '<td style="'+cellSt+'"><b>Vd</b></td><td style="'+cellSt+'">' + currentPK.vd.toFixed(1) + ' L</td></tr>' +
    '<tr><td style="'+cellSt+'"><b>Ke</b></td><td style="'+cellSt+'">' + currentPK.ke.toFixed(4) + ' hr\u207b\u00b9</td>' +
    '<td style="'+cellSt+'"><b>t\u00bd</b></td><td style="'+cellSt+'">' + currentPK.halflife.toFixed(1) + ' hr</td></tr>' +
    '</table>';

  // Diagnostics section
  var dh2 = buildDoseHist();
  var totalDosesP = 0; for (var dk = 0; dk < dh2.length; dk++) totalDosesP += dh2[dk].nDoses;
  var ssStatusP = totalDosesP >= 4;
  var ssColor = ssStatusP ? '#16a34a' : '#d97706';
  var diagHtml = '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px">' +
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">\ud83d\udd2c Diagnostics</div>' +
    '<div><b>Sampling:</b> <span style="color:' + ssColor + '">' + (ssStatusP ? '\u2705 At steady state' : '\u26a0 Pre-steady state') + ' (' + totalDosesP + ' doses)</span></div>';
  if (lastSamplingWarnings.length > 0) {
    for (var wk = 0; wk < lastSamplingWarnings.length; wk++) {
      diagHtml += '<div style="color:#d97706;margin-top:2px">' + lastSamplingWarnings[wk].msg.replace(/<[^>]*>/g, '') + '</div>';
    }
  }
  diagHtml += '<div style="margin-top:4px"><b>MCMC:</b> ' + lastMCMCSampleCount + ' samples | Accept rate: ' + (lastMCMCAcceptRate * 100).toFixed(1) + '%</div>' +
    '</div>';

  // Dose optimizer recommendation
  var optHtml = '';
  var opt = getOptData();
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

  var resultsHtml = doseHtml + lvlHtml + aucHtml + diagHtml + optHtml;

  return {
    title: 'Vancomycin Bayesian TDM Report',
    patientHtml: patientHtml,
    resultsHtml: resultsHtml,
    chartCanvas: document.getElementById('pkGraph'),
    analytics: { page: 'vanco-tdm', drug: 'Vancomycin', auc: currentPK.auc24.toFixed(0) }
  };
}

// ============================================================
// ANALYTICS (shared IDs with index.html via localStorage)
// ============================================================
const TDM_ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec';
const TDM_SID = localStorage.getItem('anonSessionId') || '';
const TDM_UID = localStorage.getItem('anonUserId') || '';
let tdmReqCount = 0;

function sendTDMAnalytics(data) {
  if (!TDM_ANALYTICS_URL || localStorage.getItem('analyticsConsent') !== 'true') return;
  if (tdmReqCount >= 20) return;
  tdmReqCount++;
  try {
    const payload = JSON.stringify({ ...data, session_id: TDM_SID, user_id: TDM_UID });
    if (navigator.sendBeacon) navigator.sendBeacon(TDM_ANALYTICS_URL, payload);
    else fetch(TDM_ANALYTICS_URL, { method:'POST', body:payload, keepalive:true }).catch(()=>{});
  } catch(e) {}
}

// Track page visit
sendTDMAnalytics({
  type: 'calc_visit',
  page: 'vanco-tdm',
  referrer: document.referrer || 'direct',
  drugs_available: 'Vancomycin'
});

// Track TDM result (called after MCMC completes) — v5.1 full schema
let tdmResultTracked = false;
function trackTDMResult(model, aucMAP, aucLo, aucHi, acceptRate, pt, pkResult, doseHist, measuredLvls) {
  if (tdmResultTracked) return;
  tdmResultTracked = true;
  
  const lastD = doseHist[doseHist.length-1];
  const crcl = cockcroft(pt.age,pt.wt,pt.scr,pt.sex,pt.ht);
  const htIn = (pt.ht||170)/2.54;
  const ibw = pt.sex==='M' ? 50+2.3*(htIn-60) : 45.5+2.3*(htIn-60);
  const bmi = pt.wt / (((pt.ht||170)/100)**2);
  const isObese = pt.wt > ibw * 1.3;
  const abw = ibw + 0.4*(pt.wt - ibw);

  // Sampling adequacy
  let totalDoses=0;for(const d of doseHist)totalDoses+=d.nDoses;
  const atSS = totalDoses >= 4;
  const samplingWarnings = [];
  if(!atSS) samplingWarnings.push('pre-steady-state');
  
  // Interpretation
  let interp = 'therapeutic';
  if(aucMAP < 400) interp = 'subtherapeutic';
  else if(aucMAP > 600) interp = 'supratherapeutic';
  
  sendTDMAnalytics({
    type: 'tdm_usage',
    drug_name: 'Vancomycin',
    action: 'calculation',
    model: model,
    auc_result: aucMAP,
    auc_ci_lo: aucLo,
    auc_ci_hi: aucHi,
    interpretation: interp,
    ss_peak: pkResult.ssPeak ? pkResult.ssPeak.toFixed(1) : '',
    ss_trough: pkResult.ssTrough ? pkResult.ssTrough.toFixed(1) : '',
    dose: lastD.amount + 'mg q' + lastD.interval + 'h',
    cl_map: pkResult.cl ? pkResult.cl.toFixed(4) : '',
    vd_map: pkResult.vd ? pkResult.vd.toFixed(1) : '',
    halflife: pkResult.halflife ? pkResult.halflife.toFixed(1) : '',
    ke: pkResult.ke ? pkResult.ke.toFixed(5) : '',
    mcmc_accept: acceptRate ? (acceptRate*100).toFixed(1) : '',
    // Full patient info
    weight_kg: pt.wt,
    height_cm: pt.ht || '',
    age: pt.age,
    sex: pt.sex,
    scr: pt.scr,
    crcl: crcl.toFixed(1),
    albumin: pt.albumin || '',
    dialysis: pt.dialysis || '',
    dosing_weight: isObese ? abw.toFixed(1) : pt.wt,
    ibw: ibw.toFixed(1),
    // Obesity/elderly flags (new v5.1)
    bmi: bmi.toFixed(1),
    obesity_flag: isObese ? 'obese' : 'normal',
    elderly_flag: pt.age >= 80 ? 'elderly_80+' : (pt.age >= 65 ? 'elderly_65+' : 'adult'),
    at_steady_state: atSS ? 'yes' : 'no',
    sampling_warnings: samplingWarnings.join(',') || 'none',
    total_doses_given: totalDoses,
    // Raw data
    measured_levels: JSON.stringify(measuredLvls.map(l=>({value:l.value,time:l.time.toFixed(1)}))),
    num_levels: measuredLvls.length,
    dose_history: JSON.stringify(doseHist.map(d=>({amount:d.amount,interval:d.interval,infusion:d.infusion,start:d.startTime.toFixed(1),n:d.nDoses}))),
    num_dose_entries: doseHist.length
  });
}

  // Event listeners
  ['ptWt','ptAge','ptSex','ptScr','ptHt'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input',updateCrCl);
  });
  ['optDose','optInterval','optInfusion'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input',()=>{updateOptimizer();genDoseOpts();});
  });
  window.addEventListener('resize',()=>{if(currentPK)updateOptimizer();});

  // Init
  IVDrugRef.patientCtx.init();
  updateCrCl();
  renderDoses();
  renderLevels();
  renderModelSelect();

  // ====== Event Delegation (replaces inline onclick/onchange) ======
  IVDrugRef.delegate(document, 'click', {
    addDose: function() { addDose(); },
    addLevel: function() { addLevel(); },
    runBayesian: function() { runBayesian(); },
    removeDose: function(e, t) { doses.splice(+t.dataset.index, 1); renderDoses(); },
    removeLevel: function(e, t) { levels.splice(+t.dataset.index, 1); renderLevels(); },
    selectModel: function(e, t) { selectedModel = t.dataset.model; renderModelSelect(); },
    runWithModel: function(e, t) { selectedModel = t.dataset.model; runBayesian(); },
    doseOption: function(e, t) {
      var d = document.getElementById('optDose'); if (d) d.value = t.dataset.dose;
      var q = document.getElementById('optInterval'); if (q) q.value = t.dataset.q;
      updateOptimizer(); genDoseOpts();
    },
    shareVancoLine: function() {
      if (!currentPK || !IVDrugRef.ShareExport) return;
      IVDrugRef.ShareExport.shareToLine(buildVancoShareText(), { page: 'vanco-tdm', drug: 'Vancomycin', auc: currentPK.auc24.toFixed(0) });
    },
    exportVancoPdf: function() {
      if (!currentPK || !IVDrugRef.ShareExport) return;
      IVDrugRef.ShareExport.printReport(buildVancoPrintData());
    }
  });
  IVDrugRef.delegate(document, 'change', {
    setDose: function(e, t) { doses[+t.dataset.index][t.dataset.field] = +t.value; },
    setDoseDateTime: function(e, t) { doses[+t.dataset.index].dateTime = t.value; updateReferenceTime(); renderSamplingAdvice(); },
    setDoseCount: function(e, t) { doses[+t.dataset.index].nDoses = +t.value; renderSamplingAdvice(); },
    setLevel: function(e, t) { levels[+t.dataset.index][t.dataset.field] = +t.value; },
    setLevelDateTime: function(e, t) { levels[+t.dataset.index].dateTime = t.value; renderSamplingAdvice(); }
  });

})();
