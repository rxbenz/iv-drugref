// ============================================================
// IV DrugRef Analytics — Google Apps Script v5
// Last updated: 2026-03-21
// 
// CHANGELOG v5 (from v4):
// - TDMUsage schema ขยายรองรับ 4 drugs (Vancomycin, Phenytoin, AG, Valproate)
// - เพิ่ม columns: action, interpretation, level, corrected_level, free_level,
//   free_fraction, strategy, nomogram_result, indication, formulation,
//   cl_map, vd_map, halflife, crcl, albumin, dialysis, pk_source,
//   auc_ci_lo, auc_ci_hi, mcmc_accept
// - doGet summary: per-drug breakdown, interpretation distribution, clinical outcomes
// - Dashboard: TDM tab v5 with per-drug analytics
// - Backward compatible กับ v4 data ทั้งหมด
//
// วิธีอัปเดต:
// 1. เปิด Google Sheets → Extensions → Apps Script
// 2. ลบ code เดิมทั้งหมด → paste code นี้
// 3. กด Run → เลือก setupV5 → Run
//    ⚠️ setupV5 จะ เพิ่ม columns ใหม่ใน TDMUsage เท่านั้น ไม่ลบ data เดิม!
// 4. Deploy → Manage deployments → ✏️ → New version → Deploy
// ============================================================

// ============================================================
// SETUP V5: ขยาย TDMUsage columns (ไม่กระทบ data เดิม)
// ============================================================
function setupV5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let tdm = ss.getSheetByName('TDMUsage');
  if (!tdm) {
    tdm = ss.insertSheet('TDMUsage');
    Logger.log('✅ Created TDMUsage sheet');
  }
  
  // New v5 headers (superset of v4 — captures ALL user-entered parameters)
  const v5Headers = [
    'timestamp', 'session_id', 'user_id',
    'drug_name', 'action',           // 'calculation' only (no tab_switch)
    'model',                          // Vancomycin: Buelga/Roberts/Goti
    'auc_result', 'auc_ci_lo', 'auc_ci_hi',
    'level', 'corrected_level', 'free_level', 'free_level_source', 'free_fraction',
    'interpretation',                 // therapeutic | subtherapeutic | supratherapeutic | toxic | borderline_toxic | elevated_trough
    'ss_peak', 'ss_trough',          // Vancomycin: steady-state peak/trough
    'dose', 'strategy',              // AG: extended | conventional
    'nomogram_result',               // AG: q24h | q36h | q48h
    'indication', 'formulation',     // VPA: epilepsy/SE/bipolar; DR/ER/syrup/IV
    'correction_applied',            // PHT: yes | none
    'cl_map', 'vd_map', 'halflife', 'ke',
    'pk_source',                     // AG: Population estimate | Calculated from measured levels
    'mcmc_accept',                   // Vancomycin: MCMC acceptance rate
    // Full patient info (ALL drugs)
    'weight_kg', 'height_cm', 'age', 'sex', 'scr', 'crcl', 'albumin', 'dialysis',
    'dosing_weight', 'ibw',          // AG: ABW/TBW + IBW
    'hypoalbumin',                   // VPA: yes/no
    'est_peak', 'est_trough',        // AG: predicted SS peak/trough
    // Measured levels (user-entered raw data)
    'measured_levels',               // Vancomycin: JSON [{value,time},...]
    'num_levels',                    // Vancomycin: count of levels entered
    'dose_history',                  // Vancomycin: JSON [{amount,interval,infusion,start,n},...]
    'num_dose_entries',              // Vancomycin: count of dose entries
    'measured_peak', 'measured_trough', 'measured_random', 'random_time', // AG: raw level inputs
    'infusion_duration',              // AG: infusion time user entered
    // v5.1: Special population & sampling adequacy
    'bmi', 'obesity_flag', 'elderly_flag',    // obesity: obese|normal; elderly: elderly_80+|elderly_65+|adult
    'at_steady_state', 'sampling_warnings',   // yes|no; pre-steady-state,not-true-trough
    'total_doses_given'                       // count of doses given before TDM
  ];
  
  // Check if headers need updating
  const lastCol = tdm.getLastColumn();
  if (lastCol < v5Headers.length) {
    // Clear row 1 and write new headers (preserves data rows)
    if (tdm.getLastRow() === 0) {
      tdm.appendRow(v5Headers);
    } else {
      // Expand columns first
      const currentHeaders = lastCol > 0 ? tdm.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      const newCols = v5Headers.filter(h => !currentHeaders.includes(h));
      if (newCols.length > 0) {
        // Add new column headers after existing ones
        for (let i = 0; i < newCols.length; i++) {
          tdm.getRange(1, lastCol + 1 + i).setValue(newCols[i]);
        }
        Logger.log('✅ Added ' + newCols.length + ' new columns to TDMUsage: ' + newCols.join(', '));
      } else {
        Logger.log('ℹ️ TDMUsage already has all v5 columns');
      }
    }
    tdm.getRange('1:1').setFontWeight('bold').setBackground('#059669').setFontColor('white');
    tdm.setFrozenRows(1);
  } else {
    Logger.log('ℹ️ TDMUsage columns already up to date');
  }
  
  // Ensure other v4 sheets exist
  setupV4();
  
  Logger.log('✅ setupV5 complete!');
}

// ============================================================
// SETUP V4: เพิ่ม 4 sheets (DoseCalcs, DrugExpands, CalcVisits, TDMUsage)
// ============================================================
function setupV4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = {
    'DoseCalcs': {
      headers: ['timestamp', 'session_id', 'user_id', 'drug_name', 'weight_kg', 'height_cm', 'age', 'sex', 'scr', 'crcl', 'dose_recommended', 'dose_unit', 'concentration', 'result_ml_hr', 'details'],
      color: '#7C3AED'
    },
    'DrugExpands': {
      headers: ['timestamp', 'session_id', 'user_id', 'drug_id', 'drug_name', 'source', 'filter_used', 'has_dose_calc'],
      color: '#DC2626'
    },
    'CalcVisits': {
      headers: ['timestamp', 'session_id', 'user_id', 'page', 'referrer', 'drugs_available'],
      color: '#D97706'
    },
    'PageViews': {
      headers: ['timestamp', 'session_id', 'user_id', 'page', 'action', 'duration_sec', 'from_page', 'referrer', 'active_drug', 'last_drug_selected'],
      color: '#0EA5E9'
    },
    'RenalDosing': {
      headers: ['timestamp', 'session_id', 'user_id', 'drug_name', 'drug_class', 'formula_used', 'gfr_value', 'crcl_cg', 'egfr_ckd', 'ckd_stage', 'recommended_dose', 'weight_kg', 'height_cm', 'age', 'sex', 'scr'],
      color: '#0D9488'
    }
  };
  
  for (const [name, config] of Object.entries(sheets)) {
    let s = ss.getSheetByName(name);
    if (!s) {
      s = ss.insertSheet(name);
      s.appendRow(config.headers);
      s.getRange('1:1').setFontWeight('bold').setBackground(config.color).setFontColor('white');
      s.setFrozenRows(1);
      Logger.log('✅ Created ' + name + ' sheet');
    }
  }
}

// ============================================================
// LEGACY SETUP (v3 base sheets)
// ============================================================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let s1 = ss.getSheetByName('Sessions');
  if (!s1) {
    s1 = ss.insertSheet('Sessions');
    s1.appendRow(['timestamp', 'session_id', 'user_id', 'platform', 'standalone', 'online', 'screen_w', 'screen_h']);
    s1.getRange('1:1').setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    s1.setFrozenRows(1);
  }
  
  let s2 = ss.getSheetByName('Searches');
  if (!s2) {
    s2 = ss.insertSheet('Searches');
    s2.appendRow(['timestamp', 'session_id', 'user_id', 'query', 'drug_clicked', 'time_to_click_ms', 'filter_used', 'results_count']);
    s2.getRange('1:1').setFontWeight('bold').setBackground('#0EA5E9').setFontColor('white');
    s2.setFrozenRows(1);
  }
  
  let s3 = ss.getSheetByName('Surveys');
  if (!s3) {
    s3 = ss.insertSheet('Surveys');
    s3.appendRow(['timestamp', 'session_id', 'user_id', 'survey_phase', 'role', 'department',
      'sat_1_easy_to_find', 'sat_2_accurate', 'sat_3_faster', 'sat_4_recommend', 'sat_5_overall',
      'sus_1', 'sus_2', 'sus_3', 'sus_4', 'sus_5', 'sus_6', 'sus_7', 'sus_8', 'sus_9', 'sus_10',
      'sus_score', 'comments']);
    s3.getRange('1:1').setFontWeight('bold').setBackground('#059669').setFontColor('white');
    s3.setFrozenRows(1);
  }
  
  setupV4();
  setupV5();
  Logger.log('✅ Full setup complete!');
}

// ============================================================
// Helper: Bangkok timestamp
// ============================================================
function bangkokNow() {
  return Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss.SSS'+07:00'");
}

// ============================================================
// POST: รับข้อมูลจากแอป (v3 + v4 + v5 events)
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = bangkokNow();
    const sid = data.session_id || '';
    const uid = data.user_id || '';
    
    if (data.type === 'session') {
      ss.getSheetByName('Sessions').appendRow([
        now, sid, uid, data.platform || '', data.standalone || '', data.online || '',
        data.screen_w || '', data.screen_h || ''
      ]);
    }
    
    else if (data.type === 'search') {
      ss.getSheetByName('Searches').appendRow([
        now, sid, uid, data.query || '', data.drug_clicked || '',
        data.time_to_click_ms || 0, data.filter_used || '', data.results_count || 0
      ]);
    }
    
    else if (data.type === 'survey') {
      const sus = data.sus || [];
      let susScore = '';
      if (sus.length === 10) {
        let raw = 0;
        for (let i = 0; i < 10; i++) raw += (i % 2 === 0) ? (sus[i] - 1) : (5 - sus[i]);
        susScore = raw * 2.5;
      }
      const hasSat = data.sat_1 || data.sat_2 || data.sat_3 || data.sat_4 || data.sat_5;
      const hasSus = sus.length === 10;
      let phase = hasSat && hasSus ? 'both' : (hasSat ? 'satisfaction' : (hasSus ? 'sus' : 'unknown'));
      
      ss.getSheetByName('Surveys').appendRow([
        now, sid, uid, phase, data.role || '', data.department || '',
        data.sat_1 || '', data.sat_2 || '', data.sat_3 || '', data.sat_4 || '', data.sat_5 || '',
        ...(sus.length === 10 ? sus : Array(10).fill('')), susScore, data.comments || ''
      ]);
    }
    
    else if (data.type === 'dose_calc') {
      const sheet = ss.getSheetByName('DoseCalcs');
      if (sheet) sheet.appendRow([now, sid, uid,
        data.drug_name||'', data.weight_kg||'', data.height_cm||'',
        data.age||'', data.sex||'', data.scr||'', data.crcl||'',
        data.dose_recommended||data.dose_value||'',
        data.dose_unit||'', data.concentration||'', data.result_ml_hr||'',
        data.details||'']);
    }
    
    else if (data.type === 'drug_expand') {
      const sheet = ss.getSheetByName('DrugExpands');
      if (sheet) sheet.appendRow([now, sid, uid, data.drug_id||'', data.drug_name||'', data.source||'', data.filter_used||'', data.has_dose_calc||false]);
    }
    
    else if (data.type === 'calc_visit') {
      const sheet = ss.getSheetByName('CalcVisits');
      if (sheet) sheet.appendRow([now, sid, uid, data.page||'calculator', data.referrer||'', data.drugs_available||'']);
    }
    
    // v5: Unified page_view tracking (enter + leave with duration)
    else if (data.type === 'page_view') {
      const sheet = ss.getSheetByName('PageViews');
      if (sheet) sheet.appendRow([
        now, sid, uid,
        data.page || '',           // drugref | calculator | tdm | vanco-tdm
        data.action || '',         // enter | leave
        data.duration_sec || '',   // seconds on page (only on 'leave')
        data.from_page || '',      // drugref | calculator | tdm | direct | external
        data.referrer || '',
        data.active_drug || '',    // TDM: which drug tab was active when leaving
        data.last_drug_selected || '' // Calculator: which drug was last selected
      ]);
    }
    
    // v5.1: Renal Dosing usage tracking
    else if (data.type === 'renal_dosing') {
      const sheet = ss.getSheetByName('RenalDosing');
      if (sheet) sheet.appendRow([
        now, sid, uid,
        data.drug_name || '',
        data.drug_class || '',
        data.formula_used || '',
        data.gfr_value || '',
        data.crcl_cg || '',
        data.egfr_ckd || '',
        data.ckd_stage || '',
        data.recommended_dose || '',
        data.weight_kg || '',
        data.height_cm || '',
        data.age || '',
        data.sex || '',
        data.scr || ''
      ]);
    }
    
    // v5: Enriched TDM usage (all 4 drugs — only actual calculations, not browsing)
    else if (data.type === 'tdm_usage') {
      const sheet = ss.getSheetByName('TDMUsage');
      if (sheet) {
        sheet.appendRow([
          now, sid, uid,
          data.drug_name || '',
          data.action || 'calculation',
          data.model || '',
          data.auc_result || '',
          data.auc_ci_lo || '',
          data.auc_ci_hi || '',
          data.level || '',
          data.corrected_level || '',
          data.free_level || '',
          data.free_level_source || '',
          data.free_fraction || '',
          data.interpretation || '',
          data.ss_peak || '',
          data.ss_trough || '',
          data.dose || '',
          data.strategy || '',
          data.nomogram_result || '',
          data.indication || '',
          data.formulation || '',
          data.correction_applied || '',
          data.cl_map || '',
          data.vd_map || '',
          data.halflife || '',
          data.ke || '',
          data.pk_source || '',
          data.mcmc_accept || '',
          // Full patient info
          data.weight_kg || '',
          data.height_cm || '',
          data.age || '',
          data.sex || '',
          data.scr || '',
          data.crcl || '',
          data.albumin || '',
          data.dialysis || '',
          data.dosing_weight || '',
          data.ibw || '',
          data.hypoalbumin || '',
          data.est_peak || '',
          data.est_trough || '',
          // Raw measured data (user inputs)
          data.measured_levels || '',
          data.num_levels || '',
          data.dose_history || '',
          data.num_dose_entries || '',
          data.measured_peak || '',
          data.measured_trough || '',
          data.measured_random || '',
          data.random_time || '',
          data.infusion_duration || '',
          // v5.1: Special population & sampling adequacy
          data.bmi || '',
          data.obesity_flag || '',
          data.elderly_flag || '',
          data.at_steady_state || '',
          data.sampling_warnings || '',
          data.total_doses_given || ''
        ]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// GET: Dashboard data (v5 — enriched TDM aggregation)
// ============================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'summary';
    
    if (action === 'summary') {
      const sessions = getSheetData('Sessions');
      const searches = getSheetData('Searches');
      const surveys = getSheetData('Surveys');
      const doseCalcs = getSheetData('DoseCalcs');
      const drugExpands = getSheetData('DrugExpands');
      const calcVisits = getSheetData('CalcVisits');
      const tdmUsage = getSheetData('TDMUsage');
      const pageViews = getSheetData('PageViews');
      const renalDosing = getSheetData('RenalDosing');
      
      // =========================================
      // v3 existing aggregations (unchanged)
      // =========================================
      const allUserIds = new Set();
      const addUsers = (rows) => rows.forEach(r => { const id = String(r.user_id || r.session_id || '').trim(); if (id) allUserIds.add(id); });
      addUsers(sessions); addUsers(searches);
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000);
      const dailyMap = {};
      const addToDaily = (rows) => {
        rows.forEach(r => {
          const ts = String(r.timestamp || ''), day = ts.substring(0, 10);
          if (!day || day === 'undefined') return;
          try { if (isNaN(new Date(ts).getTime()) || new Date(ts) < thirtyDaysAgo) return; } catch(e) { return; }
          if (!dailyMap[day]) dailyMap[day] = new Set();
          const uid = String(r.user_id || r.session_id || '').trim();
          if (uid) dailyMap[day].add(uid);
        });
      };
      addToDaily(sessions); addToDaily(searches);
      const dailyUsers = Object.entries(dailyMap).map(([date, set]) => ({ date, users: set.size })).sort((a, b) => a.date.localeCompare(b.date));
      
      const drugCount = {};
      searches.forEach(r => { const drug = String(r.drug_clicked || '').trim(); if (drug && drug !== 'undefined') drugCount[drug] = (drugCount[drug] || 0) + 1; });
      const topDrugs = Object.entries(drugCount).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([drug, count]) => ({ drug, count }));
      
      const times = searches.map(r => parseInt(r.time_to_click_ms)).filter(t => !isNaN(t) && t > 0 && t < 300000);
      const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
      const timeBuckets = [0, 0, 0, 0, 0, 0];
      times.forEach(t => { const s = t / 1000; if (s < 5) timeBuckets[0]++; else if (s < 10) timeBuckets[1]++; else if (s < 20) timeBuckets[2]++; else if (s < 30) timeBuckets[3]++; else if (s < 60) timeBuckets[4]++; else timeBuckets[5]++; });
      
      const platforms = {};
      sessions.forEach(r => { const p = String(r.platform || 'Unknown'); platforms[p] = (platforms[p] || 0) + 1; });
      
      const satSurveys = surveys.filter(r => r.sat_5_overall && r.sat_5_overall !== '');
      const satScores = satSurveys.map(r => parseInt(r.sat_5_overall));
      const avgSat = satScores.length > 0 ? (satScores.reduce((a, b) => a + b, 0) / satScores.length).toFixed(1) : 0;
      
      const susScores = surveys.filter(r => r.sus_score !== undefined && r.sus_score !== '').map(r => parseFloat(r.sus_score)).filter(s => !isNaN(s));
      const avgSUS = susScores.length > 0 ? (susScores.reduce((a, b) => a + b, 0) / susScores.length).toFixed(1) : 0;
      
      const satBreakdown = {};
      ['sat_1_easy_to_find', 'sat_2_accurate', 'sat_3_faster', 'sat_4_recommend', 'sat_5_overall'].forEach(key => {
        const vals = surveys.map(r => parseInt(r[key])).filter(v => !isNaN(v) && v > 0);
        satBreakdown[key] = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
      });
      
      const filterCount = {};
      searches.forEach(r => { const f = String(r.filter_used || '').trim(); if (f && f !== 'all' && f !== 'undefined') filterCount[f] = (filterCount[f] || 0) + 1; });
      
      const roleCount = {}, deptCount = {};
      surveys.forEach(r => { const role = String(r.role || '').trim(); if (role) roleCount[role] = (roleCount[role] || 0) + 1; });
      surveys.forEach(r => { const dept = String(r.department || '').trim(); if (dept) deptCount[dept] = (deptCount[dept] || 0) + 1; });
      
      const satUserIds = new Set(surveys.filter(r => r.survey_phase === 'satisfaction').map(r => String(r.user_id || r.session_id)));
      const susUserIds = new Set(surveys.filter(r => r.survey_phase === 'sus').map(r => String(r.user_id || r.session_id)));
      const bothPhases = [...satUserIds].filter(id => susUserIds.has(id)).length;
      
      // =========================================
      // v4 aggregations (DoseCalcs, DrugExpands, CalcVisits)
      // =========================================
      const doseCalcDrugCount = {};
      doseCalcs.forEach(r => { const drug = String(r.drug_name || '').trim(); if (drug) doseCalcDrugCount[drug] = (doseCalcDrugCount[drug] || 0) + 1; });
      const topDoseCalcDrugs = Object.entries(doseCalcDrugCount).sort((a, b) => b[1] - a[1]).map(([drug, count]) => ({ drug, count }));
      
      const expandDrugCount = {}, expandSourceCount = {};
      drugExpands.forEach(r => {
        const drug = String(r.drug_name || '').trim(); if (drug) expandDrugCount[drug] = (expandDrugCount[drug] || 0) + 1;
        const src = String(r.source || '').trim(); if (src) expandSourceCount[src] = (expandSourceCount[src] || 0) + 1;
      });
      const topExpandedDrugs = Object.entries(expandDrugCount).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([drug, count]) => ({ drug, count }));
      
      const calcVisitsByDay = {};
      calcVisits.forEach(r => { const day = String(r.timestamp || '').substring(0, 10); if (day && day !== 'undefined') calcVisitsByDay[day] = (calcVisitsByDay[day] || 0) + 1; });
      
      // =========================================
      // v5 NEW: Enriched TDM aggregation (per-drug)
      // =========================================
      const tdmCalcs = tdmUsage.filter(r => String(r.action || '') !== 'tab_switch');
      const tdmTabSwitches = tdmUsage.filter(r => String(r.action || '') === 'tab_switch');
      
      // Per-drug breakdown
      const tdmByDrug = {};
      const tdmDrugNames = ['Vancomycin', 'Phenytoin', 'Amikacin', 'Gentamicin', 'Valproate'];
      tdmDrugNames.forEach(name => { tdmByDrug[name] = { total: 0, interpretations: {}, users: new Set() }; });
      
      tdmCalcs.forEach(r => {
        const drug = String(r.drug_name || '').trim();
        if (!drug) return;
        if (!tdmByDrug[drug]) tdmByDrug[drug] = { total: 0, interpretations: {}, users: new Set() };
        tdmByDrug[drug].total++;
        const uid = String(r.user_id || r.session_id || '').trim();
        if (uid) tdmByDrug[drug].users.add(uid);
        const interp = String(r.interpretation || '').trim();
        if (interp) tdmByDrug[drug].interpretations[interp] = (tdmByDrug[drug].interpretations[interp] || 0) + 1;
      });
      
      // Convert Sets to counts for JSON
      const tdmByDrugJson = {};
      for (const [drug, data] of Object.entries(tdmByDrug)) {
        tdmByDrugJson[drug] = { total: data.total, uniqueUsers: data.users.size, interpretations: data.interpretations };
      }
      
      // Vancomycin-specific: model usage + AUC distribution
      const vancoCalcs = tdmCalcs.filter(r => String(r.drug_name || '') === 'Vancomycin');
      const vancoModelCount = {};
      const vancoAUCs = [];
      const vancoObesityCount = {};
      const vancoElderlyCount = {};
      const vancoSSCount = { yes: 0, no: 0 };
      const vancoSamplingWarnings = {};
      vancoCalcs.forEach(r => {
        const model = String(r.model || '').trim(); if (model) vancoModelCount[model] = (vancoModelCount[model] || 0) + 1;
        const auc = parseFloat(r.auc_result); if (!isNaN(auc) && auc > 0) vancoAUCs.push(auc);
        // v5.1 aggregation
        const ob = String(r.obesity_flag || '').trim(); if (ob) vancoObesityCount[ob] = (vancoObesityCount[ob] || 0) + 1;
        const el = String(r.elderly_flag || '').trim(); if (el) vancoElderlyCount[el] = (vancoElderlyCount[el] || 0) + 1;
        const ss = String(r.at_steady_state || '').trim(); if (ss === 'yes') vancoSSCount.yes++; else if (ss === 'no') vancoSSCount.no++;
        const sw = String(r.sampling_warnings || '').trim();
        if (sw && sw !== 'none') sw.split(',').forEach(w => { vancoSamplingWarnings[w] = (vancoSamplingWarnings[w] || 0) + 1; });
      });
      const vancoAvgAUC = vancoAUCs.length > 0 ? (vancoAUCs.reduce((a, b) => a + b, 0) / vancoAUCs.length).toFixed(0) : 0;
      
      // Phenytoin-specific: correction applied rate
      const phenyCalcs = tdmCalcs.filter(r => String(r.drug_name || '') === 'Phenytoin');
      const phenyCorrectionRate = phenyCalcs.length > 0
        ? (phenyCalcs.filter(r => String(r.correction_applied || '') === 'yes').length / phenyCalcs.length * 100).toFixed(0) : 0;
      
      // AG-specific: strategy + nomogram
      const agCalcs = tdmCalcs.filter(r => ['Amikacin', 'Gentamicin'].includes(String(r.drug_name || '')));
      const agStrategyCount = {};
      const agNomogramCount = {};
      agCalcs.forEach(r => {
        const s = String(r.strategy || '').trim(); if (s) agStrategyCount[s] = (agStrategyCount[s] || 0) + 1;
        const n = String(r.nomogram_result || '').trim(); if (n && n !== 'N/A') agNomogramCount[n] = (agNomogramCount[n] || 0) + 1;
      });
      
      // VPA-specific: indication + hypoalbumin
      const vpaCalcs = tdmCalcs.filter(r => String(r.drug_name || '') === 'Valproate');
      const vpaIndicationCount = {};
      vpaCalcs.forEach(r => { const ind = String(r.indication || '').trim(); if (ind) vpaIndicationCount[ind] = (vpaIndicationCount[ind] || 0) + 1; });
      const vpaHypoalbuminRate = vpaCalcs.length > 0
        ? (vpaCalcs.filter(r => String(r.hypoalbumin || '') === 'yes').length / vpaCalcs.length * 100).toFixed(0) : 0;
      
      // Overall interpretation distribution (all drugs combined)
      const allInterpretations = {};
      tdmCalcs.forEach(r => {
        const interp = String(r.interpretation || '').trim();
        if (interp) allInterpretations[interp] = (allInterpretations[interp] || 0) + 1;
      });
      
      // Tab switch frequency (user journey)
      const tabSwitchCount = {};
      tdmTabSwitches.forEach(r => {
        const drug = String(r.drug_name || '').trim();
        if (drug) tabSwitchCount[drug] = (tabSwitchCount[drug] || 0) + 1;
      });
      
      // TDM usage by day
      const tdmByDay = {};
      tdmCalcs.forEach(r => {
        const day = String(r.timestamp || '').substring(0, 10);
        if (day && day !== 'undefined') tdmByDay[day] = (tdmByDay[day] || 0) + 1;
      });
      
      // Retention
      const userFirstSeen = {}, userLastSeen = {};
      [...sessions, ...searches].forEach(r => {
        const uid = String(r.user_id || r.session_id || '').trim();
        const day = String(r.timestamp || '').substring(0, 10);
        if (!uid || !day || day === 'undefined') return;
        if (!userFirstSeen[uid] || day < userFirstSeen[uid]) userFirstSeen[uid] = day;
        if (!userLastSeen[uid] || day > userLastSeen[uid]) userLastSeen[uid] = day;
      });
      let returningUsers = 0;
      Object.keys(userFirstSeen).forEach(uid => { if (userFirstSeen[uid] !== userLastSeen[uid]) returningUsers++; });
      
      // =========================================
      // v5.1: Renal Dosing aggregation
      // =========================================
      const renalDrugCount = {};
      const renalClassCount = {};
      const renalFormulaCount = {};
      const renalStageCount = {};
      const renalByDay = {};
      renalDosing.forEach(r => {
        const drug = String(r.drug_name || '').trim();
        if (drug) renalDrugCount[drug] = (renalDrugCount[drug] || 0) + 1;
        const cls = String(r.drug_class || '').trim();
        if (cls) renalClassCount[cls] = (renalClassCount[cls] || 0) + 1;
        const formula = String(r.formula_used || '').trim();
        if (formula) renalFormulaCount[formula] = (renalFormulaCount[formula] || 0) + 1;
        const stage = String(r.ckd_stage || '').trim();
        if (stage) renalStageCount[stage] = (renalStageCount[stage] || 0) + 1;
        const day = String(r.timestamp || '').substring(0, 10);
        if (day && day !== 'undefined') renalByDay[day] = (renalByDay[day] || 0) + 1;
      });
      const topRenalDrugs = Object.entries(renalDrugCount).sort((a, b) => b[1] - a[1]).map(([drug, count]) => ({ drug, count }));
      
      const result = {
        // v3
        totalSessions: sessions.length,
        uniqueUsers: allUserIds.size,
        totalSearches: searches.length,
        totalSurveys: surveys.length,
        dailyUsers, topDrugs,
        searchTime: { avg: avgTime, count: times.length, buckets: timeBuckets },
        platforms, filterUsage: filterCount,
        satisfaction: { avg: avgSat, count: satScores.length, breakdown: satBreakdown },
        sus: { avg: avgSUS, count: susScores.length },
        surveyCompletion: { satOnly: satUserIds.size, susOnly: susUserIds.size, bothPhases },
        demographics: { roles: roleCount, departments: deptCount },
        
        // v4
        doseCalcStats: {
          total: doseCalcs.length, byDrug: topDoseCalcDrugs,
          uniqueUsers: new Set(doseCalcs.map(r => String(r.user_id || r.session_id || '').trim()).filter(Boolean)).size
        },
        drugExpandStats: { total: drugExpands.length, topDrugs: topExpandedDrugs, bySources: expandSourceCount },
        calcVisitStats: {
          total: calcVisits.length, byDay: calcVisitsByDay,
          uniqueUsers: new Set(calcVisits.map(r => String(r.user_id || r.session_id || '').trim()).filter(Boolean)).size
        },
        
        // v5 — enriched TDM
        tdmStats: {
          total: tdmCalcs.length,
          totalWithTabSwitches: tdmUsage.length,
          uniqueUsers: new Set(tdmCalcs.map(r => String(r.user_id || r.session_id || '').trim()).filter(Boolean)).size,
          byDrug: tdmByDrugJson,
          byDay: tdmByDay,
          allInterpretations,
          tabSwitches: tabSwitchCount,
          vancomycin: {
            total: vancoCalcs.length,
            byModel: vancoModelCount,
            avgAUC: vancoAvgAUC,
            aucInTarget: vancoCalcs.filter(r => { const a = parseFloat(r.auc_result); return a >= 400 && a <= 600; }).length,
            // v5.1: Special population analytics
            obesityDistribution: vancoObesityCount,
            elderlyDistribution: vancoElderlyCount,
            steadyStateCompliance: vancoSSCount,
            samplingWarnings: vancoSamplingWarnings
          },
          phenytoin: {
            total: phenyCalcs.length,
            correctionAppliedRate: phenyCorrectionRate
          },
          aminoglycosides: {
            total: agCalcs.length,
            byStrategy: agStrategyCount,
            byNomogram: agNomogramCount
          },
          valproate: {
            total: vpaCalcs.length,
            byIndication: vpaIndicationCount,
            hypoalbuminRate: vpaHypoalbuminRate
          }
        },
        
        retention: {
          totalUsers: Object.keys(userFirstSeen).length,
          returningUsers, retentionRate: Object.keys(userFirstSeen).length > 0
            ? (returningUsers / Object.keys(userFirstSeen).length * 100).toFixed(1) : 0
        },
        
        // v5: Page view stats + user journey
        pageViewStats: (() => {
          const enters = pageViews.filter(r => String(r.action) === 'enter');
          const leaves = pageViews.filter(r => String(r.action) === 'leave');
          // Page visit counts
          const pageVisits = {};
          enters.forEach(r => { const p = String(r.page || '').trim(); if (p) pageVisits[p] = (pageVisits[p] || 0) + 1; });
          // Average duration per page
          const pageDurations = {};
          leaves.forEach(r => {
            const p = String(r.page || '').trim();
            const dur = parseInt(r.duration_sec);
            if (p && !isNaN(dur) && dur > 0 && dur < 3600) {
              if (!pageDurations[p]) pageDurations[p] = [];
              pageDurations[p].push(dur);
            }
          });
          const avgDurations = {};
          for (const [p, durs] of Object.entries(pageDurations)) {
            avgDurations[p] = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
          }
          // Navigation flow (from_page → page)
          const flows = {};
          enters.forEach(r => {
            const from = String(r.from_page || 'direct').trim();
            const to = String(r.page || '').trim();
            if (to) { const key = from + ' → ' + to; flows[key] = (flows[key] || 0) + 1; }
          });
          // Top user journeys (unique users who visited multiple pages in same session)
          const sessionPages = {};
          enters.forEach(r => {
            const sid = String(r.session_id || '').trim();
            const p = String(r.page || '').trim();
            if (sid && p) { if (!sessionPages[sid]) sessionPages[sid] = []; sessionPages[sid].push(p); }
          });
          const multiPageSessions = Object.values(sessionPages).filter(pages => pages.length > 1).length;
          return { total: pageViews.length, pageVisits, avgDurations, flows, multiPageSessions };
        })(),
        
        // User journey lookup (last 50 unique users for dashboard)
        recentUsers: (() => {
          const userMap = {};
          // Collect all events with timestamps for each user
          const addEvents = (rows, eventType) => {
            rows.forEach(r => {
              const uid = String(r.user_id || '').trim();
              if (!uid) return;
              if (!userMap[uid]) userMap[uid] = [];
              userMap[uid].push({
                time: String(r.timestamp || ''),
                type: eventType,
                detail: r.page || r.drug_name || r.drug_clicked || r.query || ''
              });
            });
          };
          addEvents(pageViews.filter(r => String(r.action) === 'enter'), 'page_view');
          addEvents(searches, 'search');
          addEvents(doseCalcs, 'dose_calc');
          addEvents(tdmCalcs, 'tdm_calc');
          addEvents(renalDosing, 'renal_dosing');
          // Get last 50 users sorted by most recent activity
          const userLastTime = {};
          for (const [uid, events] of Object.entries(userMap)) {
            events.sort((a, b) => b.time.localeCompare(a.time));
            userLastTime[uid] = events[0].time;
          }
          const recentUids = Object.entries(userLastTime)
            .sort((a, b) => b[1].localeCompare(a[1]))
            .slice(0, 50)
            .map(([uid]) => uid);
          const result = {};
          recentUids.forEach(uid => {
            result[uid] = userMap[uid].sort((a, b) => a.time.localeCompare(b.time)).slice(-30); // last 30 events per user
          });
          return result;
        })(),
        
        lastUpdated: bangkokNow(),
        version: 'v5.1',
        
        // v5.1: Renal Dosing stats
        renalDosingStats: {
          total: renalDosing.length,
          uniqueUsers: new Set(renalDosing.map(r => String(r.user_id || r.session_id || '').trim()).filter(Boolean)).size,
          topDrugs: topRenalDrugs,
          byClass: renalClassCount,
          byFormula: renalFormulaCount,
          byCKDStage: renalStageCount,
          byDay: renalByDay
        }
      };
      
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'export') {
      const sheet = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : 'Sessions';
      const validSheets = ['Sessions', 'Searches', 'Surveys', 'DoseCalcs', 'DrugExpands', 'CalcVisits', 'TDMUsage', 'PageViews', 'RenalDosing'];
      if (!validSheets.includes(sheet)) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid sheet', validSheets })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify(getSheetData(sheet))).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// Helper: Read sheet data as array of objects
// ============================================================
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (row[i] instanceof Date) {
        obj[h] = Utilities.formatDate(row[i], "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss.SSS'+07:00'");
      } else if (h === 'timestamp' && typeof row[i] === 'string' && row[i].endsWith('Z')) {
        try { obj[h] = Utilities.formatDate(new Date(row[i]), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss.SSS'+07:00'"); }
        catch(e) { obj[h] = row[i]; }
      } else { obj[h] = row[i]; }
    });
    return obj;
  });
}

function testDoGet() { Logger.log(doGet({ parameter: { action: 'summary' } }).getContent()); }
function testSetupV5() { setupV5(); }
