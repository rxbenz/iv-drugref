// ============================================================
// IV DrugRef PWA v5.0 — Index Page Script
// Extracted from V4.7.1 (clean, non-obfuscated)
// Drug reference homepage with search, filtering, and analytics
// ============================================================

const ANALYTICS_URL="https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec",DOSE_CALC={"Norepinephrine (Levophed)":{unit:"mcg/kg/min",min:.01,max:2,default:.1,step:.01,wt:!0,concs:[{l:"4 mg/250 mL",v:16},{l:"8 mg/250 mL",v:32}],note:"Central line preferred. Extravasation → phentolamine 5-10 mg SC"},Dobutamine:{unit:"mcg/kg/min",min:2.5,max:20,default:5,step:.5,wt:!0,concs:[{l:"250 mg/250 mL",v:1e3},{l:"500 mg/250 mL",v:2e3}],note:"Titrate q10 min. ห้ามผสมกับ NaHCO₃"},Dopamine:{unit:"mcg/kg/min",min:1,max:20,default:5,step:.5,wt:!0,concs:[{l:"200 mg/250 mL",v:800},{l:"400 mg/250 mL",v:1600}],note:"Low 1-5: renal | Med 5-10: cardiac | High >10: vasopressor"},"Adrenaline (Epinephrine)":{unit:"mcg/min",min:1,max:20,default:2,step:.5,wt:!1,concs:[{l:"1 mg/250 mL",v:4},{l:"4 mg/250 mL",v:16}],note:"Infusion 1-10 mcg/min titrate. Cardiac arrest: 1 mg IV push q3-5min"},Nicardipine:{unit:"mg/hr",min:1,max:15,default:5,step:.5,wt:!1,concs:[{l:"25 mg/250 mL (0.1 mg/mL)",v:.1},{l:"50 mg/250 mL (0.2 mg/mL)",v:.2}],note:"เปลี่ยน IV site q12h (peripheral). Target ถึง → ลด 3 mg/hr"},Dexmedetomidine:{unit:"mcg/kg/hr",min:.2,max:1.5,default:.5,step:.1,wt:!0,concs:[{l:"200 mcg/50 mL (4 mcg/mL)",v:4}],note:"ห้ามให้ >24 ชม. Loading: 1 mcg/kg/10 min (optional)"}};let searchTimeout,DRUGS=[],filteredDrugs=[],searchQuery="",currentFilter="all",expandedCards=new Set;function loadDrugsFromCache(){try{const e=localStorage.getItem("drugData_v4");if(e){const t=JSON.parse(e);if(Array.isArray(t)&&t.length>0){const e=t[0];if(e&&e.generic&&e.strength&&e.dilution&&e.admin)return t}}localStorage.removeItem("drugData_v4"),localStorage.removeItem("drugData_v4_ts")}catch(e){localStorage.removeItem("drugData_v4"),localStorage.removeItem("drugData_v4_ts")}return null}async function fetchDrugsFromLocalFile(){try{const e=await fetch("./drugs-data.json",{cache:"no-cache"});if(!e.ok)return null;const t=await e.json();if(Array.isArray(t)&&t.length>0)return t}catch(e){console.warn("[DrugSync] Local file fetch error:",e)}return null}async function fetchDrugsFromServer(){if(!navigator.onLine)return null;try{const e=await fetch(ANALYTICS_URL+"?action=drugs",{method:"GET",cache:"no-cache"});if(!e.ok)return null;const t=await e.json();if(t.drugs&&Array.isArray(t.drugs)&&t.drugs.length>0&&t.drugs.every(e=>e.generic&&e.reconst&&e.dilution&&e.admin&&e.monitoring))return t.drugs}catch(e){console.warn("[DrugSync] Server fetch error:",e)}return null}function saveDrugsToCache(e){try{localStorage.setItem("drugData_v4",JSON.stringify(e)),localStorage.setItem("drugData_v4_ts",Date.now().toString())}catch(e){}}function showSyncStatus(e,t="success"){let n=document.getElementById("syncStatus");n||(n=document.createElement("div"),n.id="syncStatus",n.style.cssText="position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;\n                        padding:6px 16px;border-radius:20px;font-size:12px;font-weight:500;\n                        opacity:0;transition:opacity 0.3s;pointer-events:none;font-family:inherit;\n                        white-space:nowrap;",document.body.appendChild(n)),n.style.background={syncing:"#f59e0b",success:"#059669",offline:"#64748b",error:"#dc2626"}[t]||"#ffffff",n.style.color="#fff",n.textContent=e,n.style.opacity="1","syncing"!==t&&setTimeout(()=>{n.style.opacity="0"},3e3)}async function initDrugs(){try{"v5.1"!==localStorage.getItem("drugCacheVer")&&(localStorage.removeItem("drugData_v4"),localStorage.removeItem("drugData_v4_ts"),localStorage.setItem("drugCacheVer","v5.1"))}catch(e){}let e=loadDrugsFromCache();if(DRUGS=e||[],!DRUGS.length){const e=await fetchDrugsFromLocalFile();e&&(DRUGS=e,saveDrugsToCache(DRUGS))}updateList();const t=localStorage.getItem("drugData_v4_ts")||"0",n=parseInt(t),i=Date.now()-n>18e5;if(navigator.onLine&&i){showSyncStatus("🔄 กำลัง sync...","syncing");const t=await fetchDrugsFromServer();t?(DRUGS=t,saveDrugsToCache(DRUGS),updateList(),showSyncStatus(`📦 อัพเดต ${t.length} รายการ`,"success")):showSyncStatus(e?"📦 ใช้ข้อมูลจาก cache":"⚠️ ไม่มีอินเทอร์เน็ต","offline")}}async function manualSync(){if(!navigator.onLine)return void showSyncStatus("⚠️ ไม่มีอินเทอร์เน็ต","offline");showSyncStatus("🔄 กำลัง sync...","syncing");try{const e=await fetchDrugsFromServer();e?(DRUGS=e,saveDrugsToCache(DRUGS),updateList(),showSyncStatus(`✓ อัพเดต ${e.length} รายการ`,"success")):showSyncStatus("✗ ไม่สามารถ sync ได้","error")}catch(e){console.error("[Sync] Error:",e);showSyncStatus("✗ Sync error","error")}}function onSearch(e){clearTimeout(searchTimeout),searchQuery=e.toLowerCase().trim(),searchQuery?document.getElementById("clearBtn").classList.add("show"):document.getElementById("clearBtn").classList.remove("show"),searchTimeout=setTimeout(()=>{updateList(),searchQuery&&sendAnalytics("SEARCH",{query:searchQuery,results:filteredDrugs.length})},150)}function clearSearch(){document.getElementById("searchInput").value="",searchQuery="",document.getElementById("clearBtn").classList.remove("show"),updateList(),document.getElementById("searchInput").focus()}function setFilter(e){currentFilter=e,updateFilterUI(),updateList(),closeFilterSheet(),sendAnalytics("FILTER",{filter:e})}function updateFilterUI(){document.querySelectorAll(".filter-btn").forEach(e=>{const t=e.dataset.filter;e.classList.toggle("active",t===currentFilter)}),document.querySelectorAll(".filter-sheet-btn").forEach(e=>{const t=e.dataset.filter;e.classList.toggle("active",t===currentFilter)});const e=document.getElementById("filterChipText"),t=document.getElementById("filterChip"),n=document.getElementById("filterActiveTag");if("all"===currentFilter)e.textContent="ทั้งหมด",t.classList.remove("has-filter"),n&&(n.textContent="ทั้งหมด",n.classList.remove("show"));else{const i="had"===currentFilter?"⚠ High Alert":currentFilter;e.textContent=i,t.classList.add("has-filter"),n&&(n.textContent=i,n.classList.add("show"))}}function filterDrugs(){let e=DRUGS;if(searchQuery){const t=searchQuery;e=e.filter(e=>{const n=(e.generic||"").toLowerCase(),i=(e.trade||"").toLowerCase(),s=(e.strength||"").toLowerCase(),a=(e.categories||[]).map(e=>e.toLowerCase()).join(" "),r=(e.precautions||"").toLowerCase();return n.includes(t)||i.includes(t)||s.includes(t)||a.includes(t)||r.includes(t)})}return"all"!==currentFilter&&(e="had"===currentFilter?e.filter(e=>e.had):e.filter(e=>(e.categories||[]).includes(currentFilter))),e}function sendAnalytics(e,t={}){if(typeof IVDrugRef!=="undefined"&&IVDrugRef.sendAnalytics){IVDrugRef.sendAnalytics({type:e,...t});return}if(navigator.onLine)try{const n={action:"log",event:e,data:t,timestamp:(new Date).toISOString(),userAgent:navigator.userAgent,sessionId:sessionStorage.getItem("sessionId")||""};fetch(ANALYTICS_URL,{method:"POST",body:JSON.stringify(n),mode:"no-cors"}).catch(()=>{})}catch(e){}}function trackSession(){const e="sid_"+Date.now()+"_"+Math.random().toString(36).substr(2,6);sessionStorage.setItem("sessionId",e),sessionStorage.setItem("sessionStart",Date.now().toString()),sendAnalytics("SESSION_START",{sessionId:e})}function renderDrugCard(e){const t=["drug-card"];e.had&&t.push("had");const n="E"===e.ed?'<span class="badge badge-ed">ED</span>':'<span class="badge badge-ned">NED</span>',i=e.had?'<span class="badge badge-had">⚠ HAD</span>':"",s=(e.trade||"").match(/\d+\s*(?:mg|mcg|mL)/i),a=s?s[0]:e.strength||"";return`\n    <div class="${t.join(" ")}" data-drug-id="${e.id}">\n      <div class="card-header" data-action="toggleCard" data-id="${e.id}">\n        <div class="card-number">${e.id}</div>\n        <div class="card-title-area">\n          <div class="card-generic">${e.generic}${DOSE_CALC[e.generic]?' <span style="font-size:11px;opacity:0.7;" title="มี Dose Calculator">📊</span>':''}</div>\n          <div class="card-trade">\n            ${e.trade||"-"}\n            ${a?`<span style="opacity:0.6; font-size:11px;">${a}</span>`:""}\n          </div>\n        </div>\n        <div class="card-badges">\n          ${i}\n          ${n}\n        </div>\n        <div class="card-chevron">▼</div>\n      </div>\n      \n      <div class="card-body">\n        ${renderCardBody(e)}\n      </div>\n    </div>\n  `}function renderCardBody(e){let t="";if(e.reconst&&(t+=`\n      <div class="info-section">\n        <div class="section-title">\n          <span class="icon">🧪</span> Reconstitution\n        </div>\n        <div class="info-grid">\n          <div class="info-item">\n            <div class="info-label">Solvent</div>\n            <div class="info-value">${e.reconst.solvent||"-"}</div>\n          </div>\n          <div class="info-item">\n            <div class="info-label">Volume</div>\n            <div class="info-value">${e.reconst.volume||"-"}</div>\n          </div>\n          <div class="info-item">\n            <div class="info-label">Concentration</div>\n            <div class="info-value mono">${e.reconst.conc||"-"}</div>\n          </div>\n        </div>\n      </div>\n    `),e.dilution&&(t+=`\n      <div class="info-section">\n        <div class="section-title">\n          <span class="icon">💧</span> Dilution\n        </div>\n        <div class="info-grid">\n          <div class="info-item">\n            <div class="info-label">Diluent</div>\n            <div class="info-value">${e.dilution.diluent||"-"}</div>\n          </div>\n          <div class="info-item">\n            <div class="info-label">Final Volume</div>\n            <div class="info-value">${e.dilution.volume||"-"}</div>\n          </div>\n          <div class="info-item full-width">\n            <div class="info-label">Final Concentration</div>\n            <div class="info-value mono">${e.dilution.finalConc||"-"}</div>\n          </div>\n        </div>\n      </div>\n    `),e.admin&&(t+=`\n      <div class="info-section">\n        <div class="section-title">\n          <span class="icon">💉</span> Administration\n        </div>\n        <div class="info-grid">\n          <div class="info-item full-width">\n            <div class="info-label">Route</div>\n            <div class="info-value">${e.admin.route||"-"}</div>\n          </div>\n          <div class="info-item full-width">\n            <div class="info-label">Rate</div>\n            <div class="info-value">${e.admin.rate||"-"}</div>\n          </div>\n        </div>\n      </div>\n    `),e.stability&&(t+=`\n      <div class="info-section">\n        <div class="section-title">\n          <span class="icon">⏱️</span> Stability\n        </div>\n        <div class="info-grid">\n          <div class="info-item">\n            <div class="info-label">Reconstituted</div>\n            <div class="info-value">${e.stability.reconst||"-"}</div>\n          </div>\n          <div class="info-item">\n            <div class="info-label">Diluted</div>\n            <div class="info-value">${e.stability.diluted||"-"}</div>\n          </div>\n          <div class="info-item full-width">\n            <div class="info-label">Storage</div>\n            <div class="info-value">${e.stability.storage||"-"}</div>\n          </div>\n        </div>\n      </div>\n    `),e.compat){const n=e.compat.ysite&&"limited data"!==e.compat.ysite.toLowerCase()&&"not recommended"!==e.compat.ysite.toLowerCase();t+=`\n      <div class="info-section">\n        <div class="section-title">\n          <span class="icon">🔗</span> Y-site Compatibility\n        </div>\n        <div class="${n?"compat-ok":"compat-bad"}">\n          <div class="info-label">${n?"✓ Compatible":"✗ Incompatible"}</div>\n          <div class="info-value" style="margin-top:4px;">${e.compat.ysite||"-"}</div>\n        </div>\n        ${e.compat.incompat?`\n          <div class="warning-box" style="margin-top:8px;">\n            <div class="info-label" style="color:#dc2626;">ห้ามผสม (Incompatible)</div>\n            <div class="info-value" style="color:#7f1d1d; margin-top:4px;">${e.compat.incompat}</div>\n          </div>\n        `:""}\n      </div>\n    `}return e.precautions&&(t+=`\n      <div class="warning-box">\n        <div class="info-label">⚠️ Precautions</div>\n        <div class="info-value" style="margin-top:6px; color:#7f1d1d;">${e.precautions}</div>\n      </div>\n    `),e.monitoring&&e.monitoring.length>0&&(t+=`\n      <div class="info-section">\n        <div class="section-title">\n          <span class="icon">👁️</span> Monitoring\n        </div>\n        <div class="monitoring-tags">\n          ${e.monitoring.map(e=>`<span class="m-tag">${e}</span>`).join("")}\n        </div>\n      </div>\n    `),DOSE_CALC[e.generic]&&(t+=renderDoseCalculator(e.generic)),e.ref&&(t+=`\n      <div class="ref-line">\n        📚 <strong>Ref:</strong> ${e.ref}\n      </div>\n    `),t+=renderStarRating(e),t}function renderDoseCalculator(e){const t=DOSE_CALC[e];if(!t)return"";const n=t.concs.map((t,n)=>`\n    <div class="calc-field">\n      <label>${t.l}</label>\n      <input type="radio" name="conc_${e.replace(/[^a-z0-9]/gi,"")}" value="${t.v}" \n             ${0===n?"checked":""} data-action="updateDoseCalc" data-drug="${e}">\n    </div>\n  `).join(""),i=t.wt?`\n    <div class="calc-field">\n      <label>Weight (kg)</label>\n      <input type="number" min="1" max="200" value="70" step="1" \n             id="wt_${e.replace(/[^a-z0-9]/gi,"")}" data-action="updateDoseCalc" data-drug="${e}" data-action="updateDoseCalc" data-drug="${e}">\n    </div>\n  `:"",s=`dose_${e.replace(/[^a-z0-9]/gi,"")}`;return`\n    <div class="calc-section">\n      <div style="font-weight:600; font-size:12px; color:#185FA5; margin-bottom:8px;">\n        📊 Dose Calculator: ${e}\n      </div>\n      <div class="calc-grid">\n        ${n}\n        ${i}\n        <div class="calc-field">\n          <label>Dose (${t.unit})</label>\n          <input type="number" min="${t.min}" max="${t.max}" value="${t.default}" step="${t.step}"\n                 id="${s}" data-action="updateDoseCalc" data-drug="${e}" data-action="updateDoseCalc" data-drug="${e}">\n        </div>\n      </div>\n      <div id="calcResult_${e.replace(/[^a-z0-9]/gi,"")}" style="display:none; margin-top:10px;">\n        <div class="calc-result">\n          <div class="calc-result-value" id="calcValue_${e.replace(/[^a-z0-9]/gi,"")}">-</div>\n          <div style="font-size:10px; color:#166534; margin-top:2px;">mL/hr</div>\n        </div>\n      </div>\n      <div class="calc-note">\n        ${t.note}\n      </div>\n      <div class="calc-disclaimer">\n        ⚠️ This is a guide only. Always verify calculations independently.\n      </div>\n    </div>\n  `}function updateDoseCalc(e){const t=DOSE_CALC[e];if(!t)return;const n=e.replace(/[^a-z0-9]/gi,""),i=document.querySelectorAll(`input[name="conc_${n}"]:checked`);if(0===i.length)return;const s=parseFloat(i[0].value),a=document.getElementById(`dose_${n}`);if(!a)return;const r=parseFloat(a.value)||t.default;let o,l=1;if(t.wt){const e=document.getElementById(`wt_${n}`);l=e?parseFloat(e.value)||70:70}o=t.unit.includes("/hr")?t.wt?r*l/s:r/s:t.wt?r*l*60/s:60*r/s;const c=document.getElementById(`calcResult_${n}`),d=document.getElementById(`calcValue_${n}`);c&&d&&(d.textContent=o.toFixed(1),c.style.display="block")}function toggleCard(e){const t=document.querySelector(`[data-drug-id="${e}"]`);if(!t)return;const n=t.classList.contains("expanded");if(t.classList.toggle("expanded"),n)expandedCards.delete(e);else{expandedCards.add(e);const t=DRUGS.find(t=>t.id===e);t&&sendAnalytics("VIEW_DRUG",{drugId:e,drugName:t.generic})}}function renderDrugList(e){const t=document.getElementById("drugList"),n=document.getElementById("resultsInfo");if(0===e.length)t.innerHTML='\n      <div class="empty-state">\n        <div class="empty-icon">📭</div>\n        <div class="empty-text">ไม่พบยา</div>\n        <div class="empty-hint">ลองค้นหาด้วยคำอื่นหรือเปลี่ยนตัวกรองประเภท</div>\n      </div>\n    ',n.textContent="0 results";else{t.innerHTML=e.map(e=>renderDrugCard(e)).join("");const i=e.filter(e=>e.had).length;n.innerHTML=`แสดง ${e.length} รายการ`+(i>0?` (${i} ⚠ HAD)`:"")+(e.length<DRUGS.length?` จากทั้งหมด ${DRUGS.length} รายการ`:"")}}function openFilterSheet(){const e=document.getElementById("filterSheetBackdrop"),t=document.getElementById("filterSheet");e.classList.add("open"),t.classList.add("open")}function closeFilterSheet(){const e=document.getElementById("filterSheetBackdrop"),t=document.getElementById("filterSheet");e.classList.remove("open"),t.classList.remove("open")}function initFilters(){document.querySelectorAll(".filter-btn").forEach(e=>{e.addEventListener("click",()=>setFilter(e.dataset.filter))}),document.querySelectorAll(".filter-sheet-btn").forEach(e=>{e.addEventListener("click",()=>setFilter(e.dataset.filter))})}function toggleFilters(){const e=document.getElementById("filters"),t=document.getElementById("filterToggle");e&&t&&(e.classList.toggle("open"),t.classList.toggle("open"))}function showAbout(){alert("IV Drug Quick Reference v4.7.0\n\nจัดทำโดย ภก. ฐาปนัท นาคครุฑ (Benz)\nกลุ่มงานเภสัชกรรม\nสถาบันประสาทวิทยา\n\nแหล่งอ้างอิง:\nLexicomp, Trissel's Handbook,\nAHFS, ISMP, AHA/ACLS, Package Inserts")}function showContact(){alert("📧 แจ้งปัญหา / ข้อเสนอแนะ\n\nติดต่อ: ภก. ฐาปนัท นาคครุฑ (Benz)\nEmail: thapanat.nk@gmail.com\nLINE: rxbenz\n\nพบข้อมูลยาผิดพลาด อยากให้เพิ่มยา หรือมี feedback ใดๆ แจ้งได้เลยครับ")}function updateList(){filteredDrugs=filterDrugs(),renderDrugList(filteredDrugs)}let activeUrgentAlerts=[],urgentAlertsDismissed=JSON.parse(localStorage.getItem("urgentDismissed")||"[]");const URGENT_POLL_INTERVAL=3e5;let urgentPollClientTimer=null;async function requestNotificationPermission(){if(!("Notification"in window))return console.warn("[Urgent] Notification API not supported"),"denied";if("granted"===Notification.permission)return"granted";if("denied"===Notification.permission)return"denied";try{return await Notification.requestPermission()}catch(e){return console.warn("[Urgent] Permission request failed:",e),"denied"}}async function initUrgentAlertSystem(){const e=await requestNotificationPermission();console.log("[Urgent] Notification permission:",e),"serviceWorker"in navigator&&navigator.serviceWorker.controller&&(navigator.serviceWorker.addEventListener("message",e=>{e.data&&("URGENT_ALERTS_UPDATE"===e.data.type&&handleUrgentAlertsUpdate(e.data.alerts,e.data.hasNew),"URGENT_ALERT_CLICK"===e.data.type&&showUrgentAlertDetail(e.data.alertId))}),navigator.serviceWorker.controller.postMessage({type:"START_URGENT_POLL"})),startClientUrgentPolling(),await checkUrgentAlertsFromClient()}function startClientUrgentPolling(){urgentPollClientTimer&&clearInterval(urgentPollClientTimer),urgentPollClientTimer=setInterval(()=>{navigator.onLine&&checkUrgentAlertsFromClient()},3e5)}async function checkUrgentAlertsFromClient(){if(navigator.onLine)try{const e=parseInt(localStorage.getItem("urgentLastCheck")||"0"),t=await fetch(`${ANALYTICS_URL}?action=checkUrgentAlerts&since=${e}`,{cache:"no-cache"});if(!t.ok)return;const n=await t.json();if(n.serverTime&&localStorage.setItem("urgentLastCheck",String(n.serverTime)),n.alerts&&n.alerts.length>0&&(handleUrgentAlertsUpdate(n.alerts,n.hasNew),n.hasNew&&"granted"===Notification.permission)){const e=n.alerts.filter(e=>e.isNew);for(const t of e)if(document.hidden)try{new Notification(`⚠️ ${t.title}`,{body:t.message||t.drugName,icon:"./icons/icon-192x192.png",tag:"urgent-"+t.id,requireInteraction:"critical"===t.severity})}catch(e){}}}catch(e){console.warn("[Urgent] Client check failed:",e.message)}}function handleUrgentAlertsUpdate(e,t){activeUrgentAlerts=e.filter(e=>!urgentAlertsDismissed.includes(e.id)),renderUrgentBanner(),t&&navigator.onLine&&manualSync()}function renderUrgentBanner(){let e=document.getElementById("urgentAlertBanner");if(0===activeUrgentAlerts.length)return void(e&&(e.style.display="none"));e||(e=document.createElement("div"),e.id="urgentAlertBanner",e.style.cssText="position:fixed;top:0;left:0;right:0;z-index:10000;\n      font-family:'IBM Plex Sans Thai',sans-serif;transition:transform 0.3s ease;",document.body.appendChild(e));const t={critical:{bg:"#dc2626",border:"#b91c1c",text:"#fff",pulse:!0},high:{bg:"#d97706",border:"#b45309",text:"#fff",pulse:!1},medium:{bg:"#2563eb",border:"#1d4ed8",text:"#fff",pulse:!1}},n=[...activeUrgentAlerts].sort((e,t)=>{const n={critical:0,high:1,medium:2};return(n[e.severity]??3)-(n[t.severity]??3)}),i=n[0],s=t[i.severity]||t.high,a=n.length-1;if(e.style.display="block",e.innerHTML=`\n    <div style="background:${s.bg};border-bottom:2px solid ${s.border};color:${s.text};\n                padding:10px 16px;${s.pulse?"animation:urgentPulse 2s infinite;":""}">\n      <div style="display:flex;align-items:center;justify-content:space-between;max-width:900px;margin:0 auto;">\n        <div style="flex:1;min-width:0;">\n          <div style="font-size:12px;font-weight:700;letter-spacing:0.5px;opacity:0.9;margin-bottom:2px;">\n            ${{critical:"🚨",high:"⚠️",medium:"ℹ️"}[i.severity]} ${({recall:"Drug Recall",safety_alert:"Safety Alert",shortage:"Drug Shortage",formulation_change:"Formulation Change"}[i.type]||"ALERT").toUpperCase()}\n            ${i.drugName?" — "+i.drugName:""}\n          </div>\n          <div style="font-size:13px;font-weight:500;line-height:1.4;">\n            ${i.title}\n          </div>\n          ${i.actionRequired?`<div style="font-size:11px;margin-top:3px;opacity:0.9;">📋 ${i.actionRequired}</div>`:""}\n          ${a>0?`<div style="font-size:11px;margin-top:4px;opacity:0.8;">+ ${a} รายการเพิ่มเติม</div>`:""}\n        </div>\n        <div style="display:flex;gap:8px;flex-shrink:0;margin-left:12px;">\n          <button data-action="showAllUrgentAlerts" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);\n            color:${s.text};padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;\n            font-family:inherit;">ดูทั้งหมด</button>\n          <button data-action="dismissUrgentAlert" data-id="${i.id}" style="background:none;border:none;color:${s.text};\n            font-size:18px;cursor:pointer;opacity:0.7;padding:4px;">✕</button>\n        </div>\n      </div>\n    </div>\n  `,s.pulse&&!document.getElementById("urgentPulseStyle")){const e=document.createElement("style");e.id="urgentPulseStyle",e.textContent="@keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:0.85}}",document.head.appendChild(e)}}function dismissUrgentAlert(e){urgentAlertsDismissed.push(e),localStorage.setItem("urgentDismissed",JSON.stringify(urgentAlertsDismissed)),activeUrgentAlerts=activeUrgentAlerts.filter(t=>t.id!==e),renderUrgentBanner()}function showAllUrgentAlerts(){const e=[...activeUrgentAlerts].sort((e,t)=>{const n={critical:0,high:1,medium:2};return(n[e.severity]??3)-(n[t.severity]??3)}),t={critical:"🚨",high:"⚠️",medium:"ℹ️"},n={recall:"Drug Recall",safety_alert:"Safety Alert",shortage:"Drug Shortage",formulation_change:"Formulation Change"},i={critical:"#fef2f2",high:"#fffbeb",medium:"#eff6ff"},s={critical:"#fecaca",high:"#fed7aa",medium:"#bfdbfe"},a={critical:"#991b1b",high:"#92400e",medium:"#1e40af"};let r=e.map(e=>`\n    <div style="background:${i[e.severity]||"#f8fafc"};border:1px solid ${s[e.severity]||"#e2e8f0"};\n                border-radius:12px;padding:14px;margin-bottom:10px;">\n      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">\n        <span style="font-size:16px;">${t[e.severity]}</span>\n        <span style="font-size:12px;font-weight:700;color:${a[e.severity]};letter-spacing:0.3px;">\n          ${(n[e.type]||"ALERT").toUpperCase()}\n        </span>\n        ${e.drugName?`<span style="font-size:12px;color:#64748b;">— ${e.drugName}</span>`:""}\n      </div>\n      <div style="font-size:14px;font-weight:600;color:#1e293b;line-height:1.4;">${e.title}</div>\n      ${e.message?`<div style="font-size:13px;color:#475569;margin-top:4px;line-height:1.5;">${e.message}</div>`:""}\n      ${e.actionRequired?`<div style="font-size:12px;color:${a[e.severity]};margin-top:6px;font-weight:500;">📋 Action: ${e.actionRequired}</div>`:""}\n      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">\n        <span style="font-size:10px;color:#94a3b8;">${e.createdAt?new Date(e.createdAt).toLocaleString("th-TH"):""}</span>\n        <button data-action="dismissUrgentAlertAndClose" data-id="${e.id}"\n                style="font-size:11px;color:#64748b;background:rgba(0,0,0,0.05);border:none;padding:4px 10px;\n                       border-radius:6px;cursor:pointer;font-family:inherit;">รับทราบแล้ว</button>\n      </div>\n    </div>\n  `).join(""),o=document.getElementById("urgentModal");o&&o.remove(),o=document.createElement("div"),o.id="urgentModal",o.style.cssText="position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-end;justify-content:center;",o.innerHTML=`\n    <div data-action="closeUrgentModal"\n         style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div>\n    <div style="position:relative;background:#fff;border-radius:20px 20px 0 0;max-height:80vh;width:100%;max-width:500px;\n                overflow-y:auto;padding:20px;box-shadow:0 -4px 30px rgba(0,0,0,0.2);">\n      <div style="width:36px;height:4px;background:#cbd5e1;border-radius:2px;margin:0 auto 16px;"></div>\n      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">\n        <h3 style="font-size:16px;font-weight:700;color:#1e293b;">🔔 Urgent Drug Alerts (${e.length})</h3>\n        <button data-action="closeUrgentModal"\n                style="width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;color:#64748b;\n                       font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>\n      </div>\n      ${r||'<div style="text-align:center;color:#94a3b8;padding:20px;">ไม่มี urgent alerts</div>'}\n    </div>\n  `,document.body.appendChild(o)}function showUrgentAlertDetail(e){activeUrgentAlerts.find(t=>t.id===e)&&showAllUrgentAlerts()}async function init(){"serviceWorker"in navigator&&navigator.serviceWorker.register("./sw.js").catch(e=>{console.warn("[SW] Registration failed:",e)}),trackSession(),incrementSessionCount(),await initDrugs(),document.getElementById("drugCount").textContent=DRUGS.length+" drugs",document.getElementById("footerDrugCount").textContent=DRUGS.length,document.getElementById("versionInfo").textContent=`เวอร์ชัน 5.1.0 — เมษายน 2569 (2026) | ข้อมูลยา ${DRUGS.length} รายการ`,initFilters(),updateFilterUI(),IVDrugRef.delegate(document,"click",{clearSearch:function(){clearSearch()},openFilterSheet:function(){openFilterSheet()},toggleFilters:function(){toggleFilters()},closeFilterSheet:function(){closeFilterSheet()},showAbout:function(){showAbout()},showContact:function(){showContact()},toggleCard:function(e,t){var id=parseInt(t.getAttribute("data-id")||t.closest("[data-id]").getAttribute("data-id"));if(id)toggleCard(id)},dismissUrgentAlert:function(e,t){var id=parseInt(t.getAttribute("data-id"));if(id)dismissUrgentAlert(id)},showAllUrgentAlerts:function(){showAllUrgentAlerts()},dismissUrgentAlertAndClose:function(e,t){var id=parseInt(t.getAttribute("data-id"));if(id){dismissUrgentAlert(id);var m=document.getElementById("urgentModal");if(m)m.remove()}},closeUrgentModal:function(){var m=document.getElementById("urgentModal");if(m)m.remove()},rateDrug:function(e,t){var id=parseInt(t.dataset.id);var name=t.dataset.name||"";var star=e.target.closest("[data-star]");if(star&&id){handleStarClick(id,name,parseInt(star.dataset.star))}},editRating:function(e,t){var id=t.dataset.id;var cards=document.querySelectorAll(".card-rating");cards.forEach(function(c){if(c.dataset.drugId===id){var s=c.querySelector(".stars");if(s)s.classList.remove("rated")}})},npsScore:function(e,t){selectNPSScore(parseInt(t.dataset.score),t.dataset.cls)},npsSubmit:function(){submitNPS()},npsDismiss:function(){dismissNPS()}}),IVDrugRef.delegate(document,"input",{updateDoseCalc:function(e,t){var drug=t.getAttribute("data-drug");if(drug)updateDoseCalc(drug)}}),IVDrugRef.delegate(document,"change",{updateDoseCalc:function(e,t){var drug=t.getAttribute("data-drug");if(drug)updateDoseCalc(drug)}}),document.getElementById("searchInput").addEventListener("input",e=>{onSearch(e.target.value)}),window.addEventListener("online",()=>{showSyncStatus("🌐 Back online","success"),manualSync(),checkUrgentAlertsFromClient()}),window.addEventListener("offline",()=>{showSyncStatus("📡 No internet","offline")}),window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(),window.deferredPrompt=e}),initUrgentAlertSystem(),checkNPS()}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",init):init();
// ============================================================
// INLINE STAR RATING SYSTEM
// ============================================================
function getDrugRatings(){try{return JSON.parse(localStorage.getItem('drugRatings')||'{}')}catch(e){return{}}}
function saveDrugRating(id,rating){var ratings=getDrugRatings();ratings[id]={rating:rating,ts:Date.now()};localStorage.setItem('drugRatings',JSON.stringify(ratings))}

function renderStarRating(drug){
  var ratings=getDrugRatings();
  var existing=ratings[drug.id];
  var stars='';
  for(var i=1;i<=5;i++){
    var filled=existing&&i<=existing.rating;
    stars+='<span data-star="'+i+'" class="'+(filled?'filled':'')+'">'+( filled?'\u2605':'\u2606')+'</span>';
  }
  var rated=existing?' rated':'';
  var label=existing?'<span class="rating-thanks">\u2605 '+existing.rating+'/5</span><span class="rating-edit" data-action="editRating" data-id="'+drug.id+'">แก้ไข</span>':'<span class="rating-label">ให้คะแนนยานี้</span>';
  return '<div class="card-rating" data-drug-id="'+drug.id+'">'+label+'<span class="stars'+rated+'" data-action="rateDrug" data-id="'+drug.id+'" data-name="'+drug.generic+'">'+stars+'</span></div>';
}

function handleStarClick(drugId,drugName,starVal){
  saveDrugRating(drugId,starVal);
  // Update UI
  var container=document.querySelector('.card-rating[data-drug-id="'+drugId+'"]');
  if(!container)return;
  var starsEl=container.querySelector('.stars');
  starsEl.classList.add('rated');
  starsEl.querySelectorAll('[data-star]').forEach(function(s){
    var v=parseInt(s.dataset.star);
    s.className=v<=starVal?'filled':'';
    s.textContent=v<=starVal?'\u2605':'\u2606';
  });
  // Update label
  var oldLabel=container.querySelector('.rating-label');
  if(oldLabel){
    var thanks=document.createElement('span');thanks.className='rating-thanks';thanks.textContent='\u2605 '+starVal+'/5 ขอบคุณ!';
    oldLabel.replaceWith(thanks);
    setTimeout(function(){thanks.textContent='\u2605 '+starVal+'/5';},2000);
  }
  // Analytics
  try{navigator.sendBeacon(ANALYTICS_URL,JSON.stringify({type:'DRUG_RATING',drugId:drugId,drugName:drugName,rating:starVal,session_id:sessionStorage.getItem('sessionId')||'',user_id:localStorage.getItem('anonUserId')||''}))}catch(e){};
}

// Star hover effect
document.addEventListener('mouseover',function(e){
  var star=e.target.closest('[data-star]');
  if(!star)return;
  var container=star.closest('.stars');
  if(!container||container.classList.contains('rated'))return;
  var val=parseInt(star.dataset.star);
  container.querySelectorAll('[data-star]').forEach(function(s){
    s.className=parseInt(s.dataset.star)<=val?'hovered':'';
  });
});
document.addEventListener('mouseout',function(e){
  var star=e.target.closest('[data-star]');
  if(!star)return;
  var container=star.closest('.stars');
  if(!container||container.classList.contains('rated'))return;
  container.querySelectorAll('[data-star]').forEach(function(s){s.className='';});
});

// ============================================================
// NPS BOTTOM SHEET
// ============================================================
var npsSelectedScore=null;

function incrementSessionCount(){
  var c=parseInt(localStorage.getItem('npsSessionCount')||'0')+1;
  localStorage.setItem('npsSessionCount',String(c));
  return c;
}

function checkNPS(){
  var count=parseInt(localStorage.getItem('npsSessionCount')||'0');
  var lastResp=parseInt(localStorage.getItem('npsLastResponse')||'0');
  var daysSince=(Date.now()-lastResp)/86400000;
  if(daysSince<90)return;
  var triggers=[5,10,20,40,80,160];
  if(triggers.indexOf(count)>=0)setTimeout(showNPS,3000);
}

function showNPS(){
  if(document.getElementById('npsBackdrop'))return;
  var scaleHtml='';
  for(var i=0;i<=10;i++){
    var cls=i<=6?'detractor':i<=8?'passive':'promoter';
    scaleHtml+='<button class="nps-score-btn" data-action="npsScore" data-score="'+i+'" data-cls="'+cls+'">'+i+'</button>';
  }
  var html='<div class="nps-backdrop" id="npsBackdrop" data-action="npsDismiss"></div>'+
    '<div class="nps-sheet" id="npsSheet">'+
    '<div class="nps-handle"></div>'+
    '<div class="nps-question">คุณจะแนะนำ IV DrugRef<br>ให้เพื่อนร่วมงานใช้หรือไม่?</div>'+
    '<div class="nps-scale">'+scaleHtml+'</div>'+
    '<div class="nps-labels"><span>ไม่แนะนำเลย</span><span>แนะนำอย่างยิ่ง</span></div>'+
    '<input class="nps-comment" id="npsComment" placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)">'+
    '<div class="nps-actions">'+
    '<button class="nps-submit" id="npsSubmitBtn" disabled data-action="npsSubmit">ส่งคะแนน</button>'+
    '<button class="nps-dismiss" data-action="npsDismiss">ไว้ภายหลัง</button>'+
    '</div></div>';
  var wrapper=document.createElement('div');
  wrapper.innerHTML=html;
  while(wrapper.firstChild)document.body.appendChild(wrapper.firstChild);
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      document.getElementById('npsBackdrop').classList.add('open');
      document.getElementById('npsSheet').classList.add('open');
    });
  });
}

function selectNPSScore(score,cls){
  npsSelectedScore=score;
  document.querySelectorAll('.nps-score-btn').forEach(function(b){
    b.classList.remove('selected','detractor','passive','promoter');
  });
  var btn=document.querySelector('.nps-score-btn[data-score="'+score+'"]');
  if(btn){btn.classList.add('selected',cls);}
  var submit=document.getElementById('npsSubmitBtn');
  if(submit)submit.disabled=false;
}

function submitNPS(){
  if(npsSelectedScore===null)return;
  var comment=(document.getElementById('npsComment')||{}).value||'';
  localStorage.setItem('npsLastResponse',String(Date.now()));
  try{navigator.sendBeacon(ANALYTICS_URL,JSON.stringify({type:'NPS_SUBMIT',score:npsSelectedScore,comment:comment,sessionCount:parseInt(localStorage.getItem('npsSessionCount')||'0'),session_id:sessionStorage.getItem('sessionId')||'',user_id:localStorage.getItem('anonUserId')||''}))}catch(e){};
  dismissNPS();
}

function dismissNPS(){
  var bd=document.getElementById('npsBackdrop');
  var sh=document.getElementById('npsSheet');
  if(sh)sh.classList.remove('open');
  if(bd)bd.classList.remove('open');
  setTimeout(function(){if(bd)bd.remove();if(sh)sh.remove();},400);
}

// ============================================================
// QUICK ACCESS — Favorites, Most Used, Recent
// ============================================================

// --- Data Layer ---
function getFavorites(){
  try{return JSON.parse(localStorage.getItem('drugFavorites')||'[]')}catch(e){return[]}
}
function saveFavorites(ids){
  localStorage.setItem('drugFavorites',JSON.stringify(ids));
}
function toggleFavorite(drugId){
  var favs=getFavorites();
  var idx=favs.indexOf(drugId);
  var action;
  if(idx>=0){favs.splice(idx,1);action='remove';}
  else{favs.unshift(drugId);action='add';}
  saveFavorites(favs);
  // Update star button on card
  var btn=document.querySelector('.fav-btn[data-id="'+drugId+'"]');
  if(btn){
    btn.classList.toggle('active');
    btn.textContent=btn.classList.contains('active')?'\u2605':'\u2606';
  }
  // Analytics
  var drug=DRUGS.find(function(d){return d.id===drugId});
  sendAnalytics('BOOKMARK_TOGGLE',{drugId:drugId,drugName:drug?drug.generic:'',action:action});
  renderQuickAccess();
}

function getViewHistory(){
  try{return JSON.parse(localStorage.getItem('drugViewHistory')||'[]')}catch(e){return[]}
}
function getViewCounts(){
  try{return JSON.parse(localStorage.getItem('drugViewCounts')||'{}')}catch(e){return{}}
}
function recordDrugView(drugId){
  // Update history (dedup, cap at 20)
  var history=getViewHistory();
  history=history.filter(function(h){return h.id!==drugId});
  history.unshift({id:drugId,ts:Date.now()});
  if(history.length>20)history=history.slice(0,20);
  localStorage.setItem('drugViewHistory',JSON.stringify(history));
  // Update view count
  var counts=getViewCounts();
  counts[drugId]=(counts[drugId]||0)+1;
  localStorage.setItem('drugViewCounts',JSON.stringify(counts));
  renderQuickAccess();
}

// --- Render Functions ---
function drugById(id){
  return DRUGS.find(function(d){return d.id===id});
}

function renderQuickAccess(){
  var zone=document.getElementById('quickAccessZone');
  if(!zone)return;
  // Only show when no search and filter is "all"
  if(searchQuery||currentFilter!=='all'){zone.innerHTML='';return;}

  var favIds=getFavorites();
  var favDrugs=favIds.map(drugById).filter(Boolean);

  var counts=getViewCounts();
  var sortedIds=Object.keys(counts).map(function(k){return{id:parseInt(k),count:counts[k]}})
    .sort(function(a,b){return b.count-a.count}).slice(0,10);
  var mostUsed=sortedIds.map(function(e){return drugById(e.id)}).filter(Boolean);

  var history=getViewHistory();
  var seen={};
  var recent=[];
  for(var i=0;i<history.length&&recent.length<5;i++){
    if(!seen[history[i].id]){
      var d=drugById(history[i].id);
      if(d){recent.push(d);seen[history[i].id]=true;}
    }
  }

  if(favDrugs.length===0&&mostUsed.length===0&&recent.length===0){
    zone.innerHTML='';return;
  }

  var html='<div class="quick-access-zone">';
  if(favDrugs.length>0)html+=renderFavoritesSection(favDrugs);
  if(mostUsed.length>0)html+=renderMostUsedSection(mostUsed);
  if(recent.length>0)html+=renderRecentSection(recent);
  html+='</div>';
  zone.innerHTML=html;
}

function renderFavoritesSection(drugs){
  var chips=drugs.map(function(d){
    var hadCls=d.had?' chip-had':'';
    return '<button class="drug-chip'+hadCls+'" data-action="jumpDrug" data-id="'+d.id+'">'
      +'<span class="chip-star">\u2605</span>'+d.generic+'</button>';
  }).join('');
  return '<div class="qa-section">'
    +'<div class="qa-header">'
    +'<div class="qa-title">\u2B50 \u0E22\u0E32\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 <span style="font-weight:400;opacity:0.6">('+drugs.length+')</span></div>'
    +'<button class="qa-action" data-action="clearFavorites">\u0E25\u0E49\u0E32\u0E07</button>'
    +'</div>'
    +'<div class="qa-scroll">'+chips+'</div>'
    +'</div>';
}

function renderMostUsedSection(drugs){
  var counts=getViewCounts();
  var chips=drugs.map(function(d,i){
    var hadCls=d.had?' chip-had':'';
    return '<button class="drug-chip'+hadCls+'" data-action="jumpDrug" data-id="'+d.id+'">'
      +'<span class="chip-rank">'+(i+1)+'</span>'+d.generic
      +'<span style="font-size:10px;opacity:0.5">('+counts[d.id]+')</span></button>';
  }).join('');
  return '<div class="qa-section">'
    +'<div class="qa-header">'
    +'<div class="qa-title">\uD83D\uDD25 \u0E22\u0E32\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E1A\u0E48\u0E2D\u0E22</div>'
    +'</div>'
    +'<div class="qa-scroll">'+chips+'</div>'
    +'</div>';
}

function renderRecentSection(drugs){
  var chips=drugs.map(function(d){
    var hadCls=d.had?' chip-had':'';
    return '<button class="drug-chip'+hadCls+'" data-action="jumpDrug" data-id="'+d.id+'">'
      +d.generic+'</button>';
  }).join('');
  return '<div class="qa-section">'
    +'<div class="qa-header">'
    +'<div class="qa-title">\uD83D\uDD70\uFE0F \u0E04\u0E49\u0E19\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14</div>'
    +'</div>'
    +'<div class="qa-scroll">'+chips+'</div>'
    +'</div>';
}

// --- Jump to Drug ---
function jumpToDrug(drugId){
  // Analytics
  var drug=drugById(drugId);
  var zone=document.getElementById('quickAccessZone');
  var source='recent';
  if(zone){
    var btn=zone.querySelector('[data-id="'+drugId+'"]');
    if(btn){
      var sec=btn.closest('.qa-section');
      if(sec){
        var title=sec.querySelector('.qa-title');
        if(title){
          var txt=title.textContent;
          if(txt.indexOf('\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01')>=0)source='favorites';
          else if(txt.indexOf('\u0E1A\u0E48\u0E2D\u0E22')>=0)source='most_used';
        }
      }
    }
  }
  sendAnalytics('QUICK_ACCESS_CLICK',{drugId:drugId,drugName:drug?drug.generic:'',source:source});

  // Find card in current list
  var card=document.querySelector('.drug-card[data-drug-id="'+drugId+'"]');
  if(card){
    card.scrollIntoView({behavior:'smooth',block:'center'});
    // Expand if collapsed
    if(!expandedCards.has(drugId))toggleCard(drugId);
    return;
  }
  // Card not visible — clear search/filter and retry
  searchQuery='';currentFilter='all';
  document.getElementById('searchInput').value='';
  document.getElementById('clearBtn').classList.remove('show');
  updateFilterUI();
  updateList();
  setTimeout(function(){
    var c=document.querySelector('.drug-card[data-drug-id="'+drugId+'"]');
    if(c){
      c.scrollIntoView({behavior:'smooth',block:'center'});
      if(!expandedCards.has(drugId))toggleCard(drugId);
    }
  },100);
}

// --- Monkey-patch Integration ---
// Wrap renderDrugCard to inject favorite star button
var _origRenderDrugCard=renderDrugCard;
renderDrugCard=function(drug){
  var html=_origRenderDrugCard(drug);
  var isFav=getFavorites().indexOf(drug.id)>=0;
  var star='<button class="fav-btn'+(isFav?' active':'')+'" data-action="toggleFav" data-id="'+drug.id+'" data-name="'+(drug.generic||'').replace(/"/g,'&quot;')+'" aria-label="Bookmark">'+(isFav?'\u2605':'\u2606')+'</button>';
  html=html.replace('<div class="card-chevron">',star+'<div class="card-chevron">');
  return html;
};

// Wrap toggleCard to record drug views on expand
var _origToggleCard=toggleCard;
toggleCard=function(id){
  var wasExpanded=expandedCards.has(id);
  _origToggleCard(id);
  if(!wasExpanded&&expandedCards.has(id)){
    recordDrugView(id);
  }
};

// Wrap updateList to refresh quick access zone
var _origUpdateList=updateList;
updateList=function(){
  _origUpdateList();
  renderQuickAccess();
};

// --- Register New Delegate Actions ---
IVDrugRef.delegate(document,'click',{
  toggleFav:function(e,t){
    e.stopPropagation();
    var id=parseInt(t.getAttribute('data-id'));
    if(id)toggleFavorite(id);
  },
  jumpDrug:function(e,t){
    var id=parseInt(t.getAttribute('data-id'));
    if(id)jumpToDrug(id);
  },
  clearFavorites:function(){
    saveFavorites([]);
    renderQuickAccess();
  }
});

// --- Session Bookmark Sync (analytics) ---
(function(){
  var favs=getFavorites();
  if(favs.length>0){
    sendAnalytics('BOOKMARK_SYNC',{favorites:favs,count:favs.length});
  }
})();

// Initial render of quick access (in case init already ran)
if(typeof DRUGS!=='undefined'&&DRUGS.length>0){
  renderQuickAccess();
}
