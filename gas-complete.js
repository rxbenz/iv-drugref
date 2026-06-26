/**
 * ================================================================
 * IV DrugRef PWA v5.0 — Complete Google Apps Script
 * ================================================================
 *
 * วิธีใช้:
 * 1. เปิด Google Apps Script Editor (script.google.com)
 * 2. ลบโค้ดเก่าทั้งหมด แล้ว paste ไฟล์นี้ทั้งหมดทับ
 * 3. ตั้ง SPREADSHEET_ID ให้ตรงกับ Google Sheets ที่ใช้
 * 4. Deploy: Deploy > Manage deployments > New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy URL ไปใส่ใน admin settings
 *
 * Sheets ที่ต้องมี (สร้างอัตโนมัติถ้าไม่มี):
 *   Drugs, AuditLog, AdminUsers, Sessions, Searches,
 *   PageViews, DoseCalcs, DrugExpands, TDMUsage,
 *   RenalDosing, CompatUsage, Surveys, Errors,
 *   UrgentAlerts, DrugRatings, NPSResponses
 *
 * ================================================================
 */

// ──────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────
var GAS_VERSION = '5.28.0'; // ← bump เมื่อแก้ GAS แล้ว deploy ใหม่

var SPREADSHEET_ID = ''; // ← ใส่ ID ของ Google Sheets (ถ้าว่าง = ใช้ bound spreadsheet)

// DrugData อยู่ใน analytics spreadsheet (คนละ sheet กับ admin)
var DRUG_SPREADSHEET_ID = '1WWXRocEfhLSZRvuWPbDZ7uKlW61wGB3HIGF_4vjkIeE';

function getSS() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getDrugSS() {
  return SpreadsheetApp.openById(DRUG_SPREADSHEET_ID);
}

// Sheet name constants
var SHEETS = {
  DRUGS: 'DrugData',
  AUDIT: 'AuditLog',
  USERS: 'AdminUsers',
  SESSIONS: 'Sessions',
  SEARCHES: 'Searches',
  PAGE_VIEWS: 'PageViews',
  DOSE_CALCS: 'DoseCalcs',
  DRUG_EXPANDS: 'DrugExpands',
  TDM_USAGE: 'TDMUsage',
  RENAL_DOSING: 'RenalDosing',
  COMPAT_USAGE: 'CompatUsage',
  RENAL_DRUGS_DATA: 'RenalDrugsData',
  SURVEYS: 'Surveys',
  ERRORS: 'ErrorLog',
  URGENT_ALERTS: 'UrgentAlerts',
  CALC_VISITS: 'CalcVisits',
  DRUG_RATINGS: 'DrugRatings',
  NPS_RESPONSES: 'NPSResponses',
  COMPAT_PAIRS: 'CompatPairs',
  ALLERGY_LOOKUPS: 'AllergyLookups',
  ALLERGY_GROUPS: 'AllergyGroups',
  ALLERGY_REFS: 'AllergyRefs',
  FEATURE_USE: 'FeatureUse',
  MICRO_FEEDBACK: 'MicroFeedback',
  SUS_ITEMS: 'SusItems'
};

// ──────────────────────────────────────────────
// CORS HELPERS
// ──────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return jsonResponse({ success: false, error: msg });
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch (e) { return str; }
}

// ──────────────────────────────────────────────
// SHEET HELPERS
// ──────────────────────────────────────────────
function getOrCreateSheet(name, headers, ss) {
  ss = ss || getSS();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E3F2FD');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function getSheetData(sheetName, ss) {
  ss = ss || getSS();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function appendToSheet(sheetName, headers, values) {
  var sheet = getOrCreateSheet(sheetName, headers);
  sheet.appendRow(values);
}

/**
 * Smart logger: reads existing sheet headers, maps data fields to matching columns.
 * - If sheet exists: uses its headers (preserves existing structure)
 * - If sheet doesn't exist: creates with fallbackHeaders
 * - Extra fields in data go to 'data' column as JSON (if column exists)
 * - Always prepends timestamp
 */
function smartLog(sheetName, data, fallbackHeaders) {
  var ss = getSS();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // Sheet doesn't exist — create with fallback headers
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(fallbackHeaders);
    sheet.getRange(1, 1, 1, fallbackHeaders.length).setFontWeight('bold').setBackground('#E3F2FD');
    sheet.setFrozenRows(1);
  }

  // Read existing headers from row 1
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Build row by matching data keys to headers
  var row = headers.map(function(h) {
    if (!h) return '';
    var key = String(h).trim();

    // Direct match
    if (data[key] !== undefined) {
      var val = data[key];
      return typeof val === 'object' ? JSON.stringify(val) : val;
    }

    // camelCase match: try converting header "auc_ci_lo" to data key "aucCiLo" etc.
    var camel = key.replace(/_([a-z])/g, function(_, c) { return c.toUpperCase(); });
    if (data[camel] !== undefined) {
      var val2 = data[camel];
      return typeof val2 === 'object' ? JSON.stringify(val2) : val2;
    }

    // snake_case match: try converting data key to header
    for (var dk in data) {
      var snake = dk.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (snake === key || dk.toLowerCase() === key.toLowerCase()) {
        var val3 = data[dk];
        return typeof val3 === 'object' ? JSON.stringify(val3) : val3;
      }
    }

    // Special: timestamp column gets auto-filled
    if (key === 'timestamp') return new Date().toISOString();

    return '';
  });

  sheet.appendRow(row);
  return row;
}

// ──────────────────────────────────────────────
// doGet — Handle all GET requests
// ──────────────────────────────────────────────
function doGet(e) {
  try {
    var action = (e.parameter.action || '').toLowerCase();
    var user = e.parameter.user || '';
    var data = {};

    if (e.parameter.data) {
      try { data = JSON.parse(e.parameter.data); } catch (err) { /* ignore */ }
    }

    switch (action) {
      // ── Version Check ──
      case 'version':
        return jsonResponse({ version: GAS_VERSION });

      // ── Dashboard ──
      case 'raw':
        return handleRaw();
      case 'export':
        return handleExport(e.parameter.sheet);

      // ── Drug Data (App Sync) ──
      case 'drugs':
        return handleGetDrugs();

      // ── Compat Pairs (Public — no auth) ──
      case 'compatpairs':
        return handleGetCompatPairsPublic();

      // ── Admin CRUD ──
      case 'getdrugs':
        return handleAdminGetDrugs(user);
      case 'createdrug':
        return handleCreateDrug(user, data);
      case 'updatedrug':
        return handleUpdateDrug(user, data);
      case 'deletedrug':
        return handleDeleteDrug(user, data);
      case 'approvedrug':
        return handleApproveDrug(user, data);
      case 'rejectdrug':
        return handleRejectDrug(user, data);

      // ── Admin Users ──
      case 'getaudit':
        return handleGetAudit();
      case 'getusers':
        return handleGetUsers();
      case 'setuserrole':
        return handleSetUserRole(user, data);
      case 'removeuser':
        return handleRemoveUser(user, data);

      // ── Compatibility Pairs ──
      case 'getcompatpairs':
        return handleGetCompatPairs(user);
      case 'createcompatpair':
        return handleCreateCompatPair(user, data);
      case 'updatecompatpair':
        return handleUpdateCompatPair(user, data);
      case 'deletecompatpair':
        return handleDeleteCompatPair(user, data);
      case 'bulkcreatecompatpairs':
        return handleBulkCreateCompatPairs(user, data);

      // ── Renal Dosing Data ──
      case 'renaldrugs':
        return handleGetRenalDrugsPublic();
      case 'getrenaldrugs':
        return handleGetRenalDrugs(user);
      case 'createrenaldrug':
        return handleCreateRenalDrug(user, data);
      case 'updaterenaldrug':
        return handleUpdateRenalDrug(user, data);
      case 'deleterenaldrug':
        return handleDeleteRenalDrug(user, data);
      case 'bulkcreaterenaldrugs':
        return handleBulkCreateRenalDrugs(user, data);

      // ── Allergy cross-reactivity data ──
      case 'allergydata':
        return handleGetAllergyDataPublic();
      case 'getallergygroups':
        return handleGetAllergyGroups(user);
      case 'createallergygroup':
        return handleCreateAllergyGroup(user, data);
      case 'updateallergygroup':
        return handleUpdateAllergyGroup(user, data);
      case 'deleteallergygroup':
        return handleDeleteAllergyGroup(user, data);
      case 'bulkcreateallergygroups':
        return handleBulkCreateAllergyGroups(user, data);
      case 'bulkcreateallergyrefs':
        return handleBulkCreateAllergyRefs(user, data);

      // ── Urgent Alerts ──
      case 'checkurgentalerts':
        return handleCheckUrgentAlerts(e.parameter.since);

      default:
        return errorResponse('Unknown action: ' + action);
    }
  } catch (err) {
    return errorResponse(err.message);
  }
}

// ──────────────────────────────────────────────
// doPost — Handle all POST requests
// ──────────────────────────────────────────────
function doPost(e) {
  try {
    var data = {};
    try { data = JSON.parse(e.postData.contents); } catch (err) { /* ignore */ }

    // ── Admin bulk operations via POST ──
    if (data.action === 'bulkCreateCompatPairs') {
      return handleBulkCreateCompatPairs(data.user || '', data);
    }
    if (data.action === 'bulkCreateRenalDrugs') {
      return handleBulkCreateRenalDrugs(data.user || '', data);
    }

    // ── Allergy admin ops via POST (large payloads) ──
    // apiCall sends the action in the BODY for small writes and in the URL query
    // for large no-cors POSTs, so accept either source here.
    var postAction = data.action || (e && e.parameter && e.parameter.action) || '';
    var postUser = data.user || (e && e.parameter && e.parameter.user) || '';
    switch (postAction) {
      case 'createAllergyGroup':      return handleCreateAllergyGroup(postUser, data);
      case 'updateAllergyGroup':      return handleUpdateAllergyGroup(postUser, data);
      case 'deleteAllergyGroup':      return handleDeleteAllergyGroup(postUser, data);
      case 'bulkCreateAllergyGroups': return handleBulkCreateAllergyGroups(postUser, data);
      case 'bulkCreateAllergyRefs':   return handleBulkCreateAllergyRefs(postUser, data);
    }

    var eventType = data.type || data.event || data.action || '';

    // Normalize analytics event names: index.js sends UPPER_CASE, but
    // calculator/tdm/vanco/renal/compat send lower_case (dose_calc, tdm_usage,
    // renal_dosing, compat_usage, calc_visit). Without this they all fell through
    // to the generic SESSIONS log and never reached their dashboard sheets.
    var ET_MAP = {
      dose_calc: 'DOSE_CALC', compat_usage: 'COMPAT_CHECK', renal_dosing: 'RENAL_DOSING',
      tdm_usage: 'TDM_RESULT', calc_visit: 'CALC_VISIT'
    };
    if (ET_MAP[eventType]) eventType = ET_MAP[eventType];

    // ── Analytics Events ──
    switch (eventType) {
      case 'page_view':
        return logPageView(data);
      case 'error_report':
        return logErrors(data);
      case 'SESSION_START':
        return logSession(data);
      case 'SEARCH':
        return logSearch(data);
      case 'FILTER':
        return logAnalyticsGeneric(data, 'Filters');
      case 'VIEW_DRUG':
        return logDrugExpand(data);
      case 'DOSE_CALC':
        return logDoseCalc(data);
      case 'TDM_RESULT':
        return logTDMUsage(data);
      case 'RENAL_DOSING':
        return logRenalDosing(data);
      case 'COMPAT_CHECK':
        return logCompatUsage(data);
      case 'CALC_VISIT':
        return logAnalyticsGeneric(data, SHEETS.CALC_VISITS);
      case 'ALLERGY_LOOKUP':
        return logAllergyLookup(data);
      case 'DRUG_RATING':
        return logDrugRating(data);
      case 'NPS_SUBMIT':
        return logNPSResponse(data);
      case 'SURVEY':
        return logSurvey(data);
      case 'QUICK_ACTION':
      case 'ONBOARDING':
        return logFeatureUse(data);
      case 'MICRO_FEEDBACK':
        return logMicroFeedback(data);
      case 'SUS_ITEM':
        return logSusItem(data);
      default:
        // Generic log — catch all unknown events
        return logAnalyticsGeneric(data, SHEETS.SESSIONS);
    }
  } catch (err) {
    return errorResponse(err.message);
  }
}


// ════════════════════════════════════════════════
// ANALYTICS LOGGING FUNCTIONS
// ════════════════════════════════════════════════

/**
 * All analytics logging uses smartLog — reads existing sheet headers
 * and maps incoming data fields automatically. This preserves existing
 * column structure (like TDMUsage with 55+ columns) without hardcoding.
 *
 * Fallback headers are only used when creating NEW sheets.
 */

function logSession(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.SESSIONS, data,
    ['timestamp', 'session_id', 'user_id', 'platform', 'standalone', 'online', 'screen_w', 'screen_h']);
  return jsonResponse({ success: true });
}

function logSearch(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.SEARCHES, data,
    ['timestamp', 'session_id', 'user_id', 'query', 'results', 'time_to_click_ms', 'drug_clicked', 'filter_used']);
  return jsonResponse({ success: true });
}

function logPageView(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.PAGE_VIEWS, data,
    ['timestamp', 'session_id', 'user_id', 'page', 'action', 'duration_sec', 'from_page', 'referrer']);
  return jsonResponse({ success: true });
}

function logDoseCalc(data) {
  data.timestamp = new Date().toISOString();
  // fallback headers match the fields calculator.js actually sends (only used
  // when the sheet is first auto-created; existing sheets keep their headers)
  smartLog(SHEETS.DOSE_CALCS, data,
    ['timestamp', 'session_id', 'user_id', 'drug_name', 'dose_unit', 'weight_kg', 'height_cm',
     'age', 'sex', 'scr', 'crcl', 'dose_recommended', 'details']);
  return jsonResponse({ success: true });
}

function logDrugExpand(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.DRUG_EXPANDS, data,
    ['timestamp', 'session_id', 'user_id', 'drug_id', 'drug_name', 'source']);
  return jsonResponse({ success: true });
}

// Feature-adoption tracking — FAB quick-actions + onboarding tutorial.
function logFeatureUse(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.FEATURE_USE, data,
    ['timestamp', 'session_id', 'user_id', 'feature', 'action', 'page', 'detail']);
  return jsonResponse({ success: true });
}

// Micro 👍/👎 feedback (one-tap after value delivered).
function logMicroFeedback(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.MICRO_FEEDBACK, data,
    ['timestamp', 'session_id', 'user_id', 'rating', 'reason', 'page', 'context']);
  return jsonResponse({ success: true });
}

// Progressive SUS — one item at a time; aggregate per user_id for cohort SUS.
function logSusItem(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.SUS_ITEMS, data,
    ['timestamp', 'session_id', 'user_id', 'item_index', 'score', 'page']);
  return jsonResponse({ success: true });
}

function logTDMUsage(data) {
  // TDMUsage has 55+ columns — smartLog reads them from existing sheet
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.TDM_USAGE, data,
    ['timestamp', 'session_id', 'user_id', 'drug_name', 'model', 'auc_result',
     'dose_recommendation', 'weight_kg', 'scr', 'age', 'action']);
  return jsonResponse({ success: true });
}

function logRenalDosing(data) {
  data.timestamp = new Date().toISOString();
  // match renal-dosing.js fields (was drug/crcl/formula — never populated)
  smartLog(SHEETS.RENAL_DOSING, data,
    ['timestamp', 'session_id', 'user_id', 'drug_name', 'drug_class', 'formula_used',
     'gfr_value', 'ckd_stage', 'recommended_dose', 'weight_kg', 'age', 'sex', 'scr']);
  return jsonResponse({ success: true });
}

function logCompatUsage(data) {
  data.timestamp = new Date().toISOString();
  // match compatibility.js fields (was 'result' — dashboard reads result_status)
  smartLog(SHEETS.COMPAT_USAGE, data,
    ['timestamp', 'session_id', 'user_id', 'mode', 'drug_a', 'drug_b', 'result_status',
     'result_source', 'drugs_count', 'pairs_total', 'pairs_compatible', 'pairs_incompatible']);
  return jsonResponse({ success: true });
}

function logAllergyLookup(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.ALLERGY_LOOKUPS, data,
    ['timestamp', 'session_id', 'user_id', 'allergen_id', 'allergen_name', 'group',
     'severity', 'avoid_count', 'caution_count', 'safer_count', 'blocked']);
  return jsonResponse({ success: true });
}

function logErrors(data) {
  var errors = data.errors || [data];
  errors.forEach(function(err) {
    err.timestamp = new Date().toISOString();
    err.session_id = err.session_id || data.session_id || '';
    err.user_id = err.user_id || data.user_id || '';
    smartLog(SHEETS.ERRORS, err,
      ['timestamp', 'session_id', 'user_id', 'severity', 'message', 'url', 'user_agent', 'page', 'app_version']);
  });
  return jsonResponse({ success: true, logged: errors.length });
}

function logSurvey(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.SURVEYS, data,
    ['timestamp', 'session_id', 'user_id', 'role', 'department',
     'sat_1_easy_to_find', 'sat_2_accurate', 'sat_3_faster', 'sat_4_recommend', 'sat_5_overall',
     'sus_score', 'comment']);
  return jsonResponse({ success: true });
}

function logAnalyticsGeneric(data, sheetName) {
  data.timestamp = new Date().toISOString();
  smartLog(sheetName || SHEETS.SESSIONS, data,
    ['timestamp', 'session_id', 'user_id', 'event', 'type', 'data']);
  return jsonResponse({ success: true });
}


// ════════════════════════════════════════════════
// DRUG RATING + NPS (NEW)
// ════════════════════════════════════════════════

function logDrugRating(data) {
  data.timestamp = new Date().toISOString();
  data.drug_id = data.drug_id || data.drugId || '';
  data.drug_name = data.drug_name || data.drugName || '';
  smartLog(SHEETS.DRUG_RATINGS, data,
    ['timestamp', 'session_id', 'user_id', 'drug_id', 'drug_name', 'rating']);
  return jsonResponse({ success: true, type: 'DRUG_RATING' });
}

function logNPSResponse(data) {
  var score = parseInt(data.score) || 0;
  data.timestamp = new Date().toISOString();
  data.score = score;
  data.session_count = data.session_count || data.sessionCount || 0;
  data.nps_category = score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';
  smartLog(SHEETS.NPS_RESPONSES, data,
    ['timestamp', 'session_id', 'user_id', 'score', 'comment', 'session_count', 'nps_category']);
  return jsonResponse({ success: true, type: 'NPS_SUBMIT', category: data.nps_category });
}


// ════════════════════════════════════════════════
// DASHBOARD: RAW DATA + EXPORT
// ════════════════════════════════════════════════

function handleRaw() {
  return jsonResponse({
    sessions: getSheetData(SHEETS.SESSIONS),
    searches: getSheetData(SHEETS.SEARCHES),
    pageViews: getSheetData(SHEETS.PAGE_VIEWS),
    doseCalcs: getSheetData(SHEETS.DOSE_CALCS),
    drugExpands: getSheetData(SHEETS.DRUG_EXPANDS),
    tdmUsage: getSheetData(SHEETS.TDM_USAGE),
    renalDosing: getSheetData(SHEETS.RENAL_DOSING),
    compatUsage: getSheetData(SHEETS.COMPAT_USAGE),
    surveys: getSheetData(SHEETS.SURVEYS),
    calcVisits: getSheetData(SHEETS.CALC_VISITS),
    drugRatings: getSheetData(SHEETS.DRUG_RATINGS),
    npsResponses: getSheetData(SHEETS.NPS_RESPONSES),
    allergyLookups: getSheetData(SHEETS.ALLERGY_LOOKUPS),
    featureUse: getSheetData(SHEETS.FEATURE_USE),
    microFeedback: getSheetData(SHEETS.MICRO_FEEDBACK),
    susItems: getSheetData(SHEETS.SUS_ITEMS),
    gasVersion: GAS_VERSION,
    serverTime: new Date().toISOString()
  });
}

function handleExport(sheetName) {
  if (!sheetName) return errorResponse('Missing sheet parameter');
  var data = getSheetData(sheetName);
  return jsonResponse(data);
}

// ════════════════════════════════════════════════
// SEED / TEST DATA CLEANUP  (run manually from the GAS editor)
// ── IMPORTANT: run these from the ANALYTICS GAS project (the one bound to the
//    analytics spreadsheet). Back up first: File → Make a copy.
// ════════════════════════════════════════════════
var ANALYTICS_SHEETS_FOR_CLEAN = [
  SHEETS.SESSIONS, SHEETS.SEARCHES, SHEETS.PAGE_VIEWS, SHEETS.DOSE_CALCS,
  SHEETS.DRUG_EXPANDS, SHEETS.TDM_USAGE, SHEETS.RENAL_DOSING, SHEETS.COMPAT_USAGE,
  SHEETS.SURVEYS, SHEETS.CALC_VISITS, SHEETS.DRUG_RATINGS, SHEETS.NPS_RESPONSES,
  SHEETS.ALLERGY_LOOKUPS, SHEETS.FEATURE_USE, SHEETS.MICRO_FEEDBACK,
  SHEETS.SUS_ITEMS, SHEETS.ERRORS, 'Filters'
];

// Delete rows whose any cell matches obvious seed/test markers.
// PREVIEW (no delete): cleanSeedData()  →  DELETE: cleanSeedData(true)
function cleanSeedData(commit) {
  var markers = /\b(test|audit|seed|demo|dummy|curl|sample|fake)\b/i;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];
  ANALYTICS_SHEETS_FOR_CLEAN.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { return; }
    var last = sh.getLastRow();
    if (last < 2) { report.push(name + ': 0 data rows'); return; }
    var values = sh.getDataRange().getValues();
    var toDelete = [];
    for (var r = 1; r < values.length; r++) {        // r=0 is the header
      if (markers.test(values[r].join(' '))) toDelete.push(r + 1); // 1-based row
    }
    if (commit === true) {
      for (var i = toDelete.length - 1; i >= 0; i--) sh.deleteRow(toDelete[i]);
    }
    report.push(name + ': ' + toDelete.length + (commit === true ? ' DELETED' : ' matched (preview)') + ' / ' + (last - 1) + ' rows');
  });
  var msg = (commit === true ? '✅ cleanSeedData DONE\n' : '👀 PREVIEW only — run cleanSeedData(true) to delete\n') + report.join('\n');
  Logger.log(msg);
  return msg;
}

// Full reset: delete ALL data rows (keep headers) from every analytics sheet.
// Use when all current data is demo/seed and you want a clean slate.
// PREVIEW: purgeAllAnalytics()  →  DELETE: purgeAllAnalytics(true)
function purgeAllAnalytics(commit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];
  ANALYTICS_SHEETS_FOR_CLEAN.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { return; }
    var n = Math.max(0, sh.getLastRow() - 1);
    if (commit === true && n > 0) {
      // Clear all data rows (keep the header). Avoids the Sheets limitation
      // "it is not possible to delete all non-frozen rows" that deleteRows hits
      // when removing every data row at once.
      sh.getRange(2, 1, n, sh.getMaxColumns()).clearContent();
      // Shrink the sheet back down, always leaving header + 1 spare blank row.
      var blanks = sh.getMaxRows() - 2;
      if (blanks > 0) sh.deleteRows(3, blanks);
    }
    report.push(name + ': ' + n + (commit === true ? ' DELETED' : ' (preview)'));
  });
  var msg = (commit === true ? '✅ purgeAllAnalytics DONE — clean slate\n' : '👀 PREVIEW only — run purgeAllAnalytics(true) to delete ALL\n') + report.join('\n');
  Logger.log(msg);
  return msg;
}

// Delete rows whose `timestamp` does NOT end with 'Z'.
// ── Signature: the live app always writes timestamps via server-side
//    `new Date().toISOString()` → UTC, ALWAYS ends in 'Z'. The synthetic seed
//    rows were generated externally with a local offset ('+07:00'), so any
//    non-'Z' timestamp is seed. Rows with an EMPTY timestamp are KEPT (never
//    auto-deleted — inspect them by hand).
// Uses a keep-and-rewrite strategy (one clear + one write per sheet) instead of
// per-row deleteRow(), so it stays fast on the big sheets (Sessions ~6.7k rows)
// and won't hit the 6-minute execution limit.
// PREVIEW (no delete): cleanSeedByTimestamp()  →  DELETE: cleanSeedByTimestamp(true)
// Process ONE sheet (so a single-sheet run can isolate a failure). Returns a
// report line. On commit it flushes immediately, so partial progress survives
// even if a later sheet throws — and re-running just skips already-clean sheets
// (idempotent: a cleaned sheet has only Z rows → 0 to remove).
function _cleanSeedTsOne(ss, name, commit) {
  var sh = ss.getSheetByName(name);
  if (!sh) { return name + ': (missing)'; }
  var last = sh.getLastRow();
  if (last < 2) { return name + ': 0 data rows'; }
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var tsCol = headers.indexOf('timestamp');
  if (tsCol < 0) { return name + ': no timestamp column — SKIPPED'; }
  // Collect the 1-based sheet rows that are SEED (timestamp present, not 'Z').
  var seedRows = [], emptyTs = 0;
  for (var r = 1; r < values.length; r++) {
    var ts = String(values[r][tsCol] == null ? '' : values[r][tsCol]).trim();
    if (ts === '') { emptyTs++; continue; }                  // keep blanks
    if (ts.charAt(ts.length - 1) !== 'Z') { seedRows.push(r + 1); } // seed → delete
  }
  var removed = seedRows.length;
  if (commit !== true || removed === 0) {
    return name + ': ' + removed + (commit === true ? ' (already clean)' : ' seed (preview)') +
      ' / ' + (last - 1) + ' rows' + (emptyTs ? ' [' + emptyTs + ' blank-ts kept]' : '');
  }
  // Delete in contiguous blocks from the BOTTOM up (so earlier indices stay
  // valid). Seed was bulk-inserted so blocks are usually few. Each block delete
  // is retried a few times to ride out GAS's transient "try again later".
  var blocks = 0, deleted = 0, i = seedRows.length - 1;
  try {
    while (i >= 0) {
      var end = seedRows[i], start = end;
      while (i - 1 >= 0 && seedRows[i - 1] === start - 1) { start = seedRows[i - 1]; i--; }
      var count = end - start + 1;
      _deleteRowsRetry(sh, start, count);
      blocks++; deleted += count; i--;
      SpreadsheetApp.flush();
    }
    return name + ': ' + deleted + ' DELETED in ' + blocks + ' block(s) / ' + (last - 1) +
      ' rows' + (emptyTs ? ' [' + emptyTs + ' blank-ts kept]' : '');
  } catch (e) {
    return name + ': ⚠️ ERROR after ' + deleted + ' deleted (' + e.message + ') — re-run to finish';
  }
}

// deleteRows with up to 4 attempts (2s/4s/8s backoff) to survive transient
// GAS Sheets backend errors ("An unknown error has occurred, try again later").
function _deleteRowsRetry(sh, start, count) {
  var delay = 2000;
  for (var attempt = 1; ; attempt++) {
    try { sh.deleteRows(start, count); return; }
    catch (e) {
      if (attempt >= 4) throw e;
      Utilities.sleep(delay);
      delay *= 2;
    }
  }
}

function cleanSeedByTimestamp(commit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];
  ANALYTICS_SHEETS_FOR_CLEAN.forEach(function (name) {
    report.push(_cleanSeedTsOne(ss, name, commit));
  });
  var msg = (commit === true
    ? '✅ cleanSeedByTimestamp DONE — non-Z (seed) rows removed\n'
    : '👀 PREVIEW only — run cleanSeedByTimestamp(true) to delete\n') + report.join('\n');
  Logger.log(msg);
  return msg;
}

// Per-sheet commit helpers — if the all-sheets run trips GAS's "unknown error"
// (transient / too-large write), clean the heavy sheets one at a time.
function cleanSeedTs_Sessions()   { return _logOne('Sessions'); }
function cleanSeedTs_Searches()   { return _logOne('Searches'); }
function cleanSeedTs_PageViews()  { return _logOne('PageViews'); }
function cleanSeedTs_DoseCalcs()  { return _logOne('DoseCalcs'); }
function cleanSeedTs_ErrorLog()   { return _logOne('ErrorLog'); }
function _logOne(name) {
  var r = _cleanSeedTsOne(SpreadsheetApp.getActiveSpreadsheet(), name, true);
  Logger.log(r);
  return r;
}

// One-click commit wrappers for the Apps Script editor (the Run button can't
// pass arguments, so a no-arg function is needed to actually delete).
// ⚠️ DESTRUCTIVE — back up the spreadsheet first. Select this in the function
//    dropdown, then click Run.
function purgeAllAnalyticsNow() {
  return purgeAllAnalytics(true);
}
function cleanSeedDataNow() {
  return cleanSeedData(true);
}
function cleanSeedByTimestampNow() {
  return cleanSeedByTimestamp(true);
}

// READ-ONLY diagnostic — profiles every analytics sheet so the seed-vs-real
// signature can be identified before deleting anything. Deletes NOTHING.
// Select in the function dropdown, Run, then read the Execution log.
function inspectAnalytics() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = [];
  ANALYTICS_SHEETS_FOR_CLEAN.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { return; }
    var last = sh.getLastRow();
    if (last < 2) { out.push('── ' + name + ': (empty)'); return; }
    var values = sh.getDataRange().getValues();
    var headers = values[0];
    var tsCol = headers.indexOf('timestamp');
    var uidCol = headers.indexOf('user_id');
    var sidCol = headers.indexOf('session_id');
    var minTs = null, maxTs = null, uids = {}, sids = {}, byDate = {};
    for (var r = 1; r < values.length; r++) {
      if (tsCol >= 0) {
        var ts = String(values[r][tsCol]).slice(0, 10);
        if (ts) {
          if (!minTs || ts < minTs) minTs = ts;
          if (!maxTs || ts > maxTs) maxTs = ts;
          byDate[ts] = (byDate[ts] || 0) + 1;
        }
      }
      if (uidCol >= 0) { var u = String(values[r][uidCol]); uids[u] = (uids[u] || 0) + 1; }
      if (sidCol >= 0) { var s = String(values[r][sidCol]); sids[s] = (sids[s] || 0) + 1; }
    }
    var uidKeys = Object.keys(uids);
    var dateKeys = Object.keys(byDate).sort();
    out.push('────────── ' + name + ' (' + (last - 1) + ' rows)');
    out.push('  dates: ' + minTs + ' → ' + maxTs + ' (' + dateKeys.length + ' distinct days)');
    out.push('  distinct user_id: ' + uidKeys.length + ' | distinct session_id: ' + Object.keys(sids).length);
    out.push('  sample user_id: ' + uidKeys.slice(0, 6).join(' , '));
    out.push('  first row: ' + values[1].join(' | ').slice(0, 180));
    out.push('  last  row: ' + values[values.length - 1].join(' | ').slice(0, 180));
  });
  var msg = '🔍 ANALYTICS INSPECT (read-only, nothing deleted)\n' + out.join('\n');
  Logger.log(msg);
  return msg;
}


// ════════════════════════════════════════════════
// SUPABASE MIGRATION (Phase 1 step 4) — one-time historical backfill
// ── Reads each analytics sheet, keeps only REAL rows (timestamp ends in 'Z';
//    the +07:00 seed rows are dropped automatically), reshapes them into the
//    Supabase `events` table, and bulk-inserts via the Data API (UrlFetchApp —
//    outbound works fine even though Sheets *writes* were flaky). Each migrated
//    row is tagged data._src='sheets' so a re-run is easy to make idempotent:
//    to redo from scratch, run this in the Supabase SQL editor first —
//        delete from public.events where data->>'_src' = 'sheets';
//    then migrate again.
// PREVIEW (no insert): migrateToSupabase()  →  INSERT: migrateToSupabaseNow()
// ════════════════════════════════════════════════
var SUPA_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';
var SUPA_KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';
var SUPA_EVENTS = SUPA_URL + '/rest/v1/events';
var SUPA_BATCH = 500;
// Only migrate rows from BEFORE the dual-write went live (deploy ~05:02Z on
// 2026-06-22; first live Supabase row 05:05Z). Rows at/after this are already
// in Supabase via the live dual-write, so skipping them avoids duplicates.
// ISO-UTC ('...Z') strings compare lexicographically = chronologically.
var MIG_CUTOFF = '2026-06-22T05:00:00Z';

// Reverse of the doPost analytics router: sheet → canonical event type, so
// migrated history uses the same type strings the live app sends.
var SHEET_TO_TYPE = {
  'Sessions': 'SESSION_START', 'Searches': 'SEARCH', 'PageViews': 'page_view',
  'DrugExpands': 'VIEW_DRUG', 'DoseCalcs': 'DOSE_CALC', 'TDMUsage': 'TDM_RESULT',
  'RenalDosing': 'RENAL_DOSING', 'CompatUsage': 'COMPAT_CHECK', 'CalcVisits': 'CALC_VISIT',
  'AllergyLookups': 'ALLERGY_LOOKUP', 'DrugRatings': 'DRUG_RATING', 'NPSResponses': 'NPS_SUBMIT',
  'Surveys': 'SURVEY', 'FeatureUse': 'FEATURE_USE', 'MicroFeedback': 'MICRO_FEEDBACK',
  'SusItems': 'SUS_ITEM', 'Filters': 'FILTER', 'ErrorLog': 'error_report'
};

// POST an array of event rows to Supabase; 4 attempts with 2/4/8s backoff.
function _migPostBatch(rows) {
  var delay = 2000;
  for (var attempt = 1; ; attempt++) {
    try {
      var resp = UrlFetchApp.fetch(SUPA_EVENTS, {
        method: 'post', contentType: 'application/json',
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Prefer': 'return=minimal' },
        payload: JSON.stringify(rows), muteHttpExceptions: true
      });
      var code = resp.getResponseCode();
      if (code >= 200 && code < 300) return;
      if (attempt >= 4) throw new Error('HTTP ' + code + ': ' + resp.getContentText().slice(0, 160));
    } catch (e) { if (attempt >= 4) throw e; }
    Utilities.sleep(delay); delay *= 2;
  }
}

// Resumable per-sheet migration. Progress is persisted per sheet in Script
// Properties (mig_off_<sheet> = how many real rows already inserted), so if GAS
// throws its transient "unknown error" mid-run you just RUN AGAIN — it skips
// the rows already sent and continues, with NO duplicates. The set of rows to
// migrate is stable (cutoff excludes all the post-deploy rows the live
// dual-write keeps appending), so the offset stays exact across runs.
function migrateSheetToSupabase(name, commit) {
  var type = SHEET_TO_TYPE[name];
  if (!type) return name + ': no type mapping — SKIPPED';
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return name + ': (missing)';
  var last = sh.getLastRow();
  if (last < 2) return name + ': 0 data rows';
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var tsCol = headers.indexOf('timestamp');
  if (tsCol < 0) return name + ': no timestamp column — SKIPPED';
  var sidCol = headers.indexOf('session_id'), uidCol = headers.indexOf('user_id'),
      avCol = headers.indexOf('app_version');
  var core = { timestamp: 1, session_id: 1, user_id: 1, app_version: 1 };

  var props = PropertiesService.getScriptProperties();
  var pkey = 'mig_off_' + name;
  var alreadyDone = commit === true ? (parseInt(props.getProperty(pkey) || '0', 10) || 0) : 0;

  var batch = [], realIdx = 0, sent = 0;
  for (var r = 1; r < values.length; r++) {
    var ts = String(values[r][tsCol] == null ? '' : values[r][tsCol]).trim();
    if (!ts || ts.charAt(ts.length - 1) !== 'Z') continue;   // skip seed (+07:00) / blank
    if (ts >= MIG_CUTOFF) continue;                           // already in Supabase via live dual-write
    realIdx++;
    if (commit === true && realIdx <= alreadyDone) continue;  // sent in a prior run → skip (no dup)
    var data = { _src: 'sheets' };
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c]; if (!h || core[h]) continue;
      var v = values[r][c];
      if (v === '' || v === null || v === undefined) continue;
      data[h] = v;
    }
    batch.push({
      type: type, ts: ts, client_ts: ts,
      session_id: sidCol >= 0 ? (values[r][sidCol] || null) : null,
      user_id: uidCol >= 0 ? (values[r][uidCol] || null) : null,
      app_version: avCol >= 0 ? (values[r][avCol] || null) : null,
      data: data
    });
    if (commit === true && batch.length >= SUPA_BATCH) {
      _migPostBatch(batch); sent += batch.length;
      props.setProperty(pkey, String(alreadyDone + sent));   // persist progress after each batch
      batch = [];
    }
  }
  if (commit === true && batch.length) {
    _migPostBatch(batch); sent += batch.length;
    props.setProperty(pkey, String(alreadyDone + sent));
  }
  if (commit !== true) return name + ' → ' + type + ': ' + realIdx + ' real (preview) / ' + (last - 1) + ' rows';
  return name + ' → ' + type + ': ' + sent + ' inserted (was ' + alreadyDone + ', total real ' + realIdx + ')';
}

function migrateToSupabase(commit) {
  var report = [];
  Object.keys(SHEET_TO_TYPE).forEach(function (name) {
    try { report.push(migrateSheetToSupabase(name, commit)); }
    catch (e) { report.push(name + ': ⚠️ ERROR (' + e.message + ') — just RUN AGAIN to resume'); }
  });
  var msg = (commit === true
    ? '✅ migrateToSupabase pass DONE — re-run until every sheet shows "0 inserted"\n'
    : '👀 PREVIEW — run migrateToSupabaseNow() to insert\n') + report.join('\n');
  Logger.log(msg);
  return msg;
}
function migrateToSupabaseNow() { return migrateToSupabase(true); }

// Per-sheet runners (resumable too) — handy for isolating the big sheets.
function migrate_Sessions()  { return _migLog('Sessions'); }
function migrate_Searches()  { return _migLog('Searches'); }
function migrate_PageViews() { return _migLog('PageViews'); }
function migrate_DrugRatings() { return _migLog('DrugRatings'); }   // tiny — connectivity test
function _migLog(name) { var r = migrateSheetToSupabase(name, true); Logger.log(r); return r; }

// Clear all migration progress (use ONLY together with a full Supabase wipe:
//   delete from public.events where data->>'_src' = 'sheets';
// then this, so a fresh migrateToSupabaseNow re-inserts everything from 0).
function resetMigrationFlags() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(SHEET_TO_TYPE).forEach(function (n) { props.deleteProperty('mig_off_' + n); });
  Logger.log('migration offsets reset — next migrate starts from row 0');
}


// ════════════════════════════════════════════════
// DRUG DATA (APP SYNC)
// ════════════════════════════════════════════════

function handleGetDrugs() {
  var rawDrugs = getSheetData(SHEETS.DRUGS, getDrugSS());
  var drugs = rawDrugs.map(function(d) { return normalizeDrugRow(d); });
  // Filter to approved only
  var result = drugs.filter(function(d) { return d.status === 'approved'; });
  return jsonResponse({ drugs: result });
}


// ════════════════════════════════════════════════
// ADMIN CRUD
// ════════════════════════════════════════════════

// Fallback admin emails — used when AdminUsers sheet is empty
// (ป้องกัน lock-out เมื่อ deploy GAS ใหม่ที่ยังไม่มี user data)
var FALLBACK_ADMINS = ['thapanat.nk@gmail.com'];

function getRole(email) {
  if (!email) return null;
  var users = getSheetData(SHEETS.USERS);

  // Search by email column (case-insensitive, handles Email/email header)
  var user = users.find(function(u) {
    var uEmail = u.email || u.Email || '';
    return uEmail.toLowerCase() === email.toLowerCase();
  });
  if (user) return user.role || user.Role || 'editor';

  // Fallback: if AdminUsers is empty AND email is in fallback list, grant admin
  if (users.length === 0 && FALLBACK_ADMINS.indexOf(email.toLowerCase()) >= 0) {
    return 'admin';
  }

  return null;
}

function checkPermission(email, requiredRole) {
  var role = getRole(email);
  if (!role) return { allowed: false, role: null };
  if (requiredRole === 'admin' && role !== 'admin') return { allowed: false, role: role };
  return { allowed: true, role: role };
}

function addAuditLog(user, action, drugId, drugName, details) {
  appendToSheet(SHEETS.AUDIT,
    ['timestamp', 'user', 'action', 'drugId', 'drugName', 'details'],
    [new Date().toISOString(), user, action, drugId || '', drugName || '', details || '']
  );
}

function handleAdminGetDrugs(user) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'คุณไม่มีสิทธิเข้าถึงส่วนนี้' });

  var rawDrugs = getSheetData(SHEETS.DRUGS, getDrugSS());
  var drugs = rawDrugs.map(function(d) { return normalizeDrugRow(d); });

  return jsonResponse({
    drugs: drugs,
    auditLog: getSheetData(SHEETS.AUDIT),
    myRole: perm.role,
    adminUsers: perm.role === 'admin' ? getSheetData(SHEETS.USERS) : []
  });
}

/**
 * Map analytics sheet headers (human-readable) → admin format (lowercase keys)
 * Supports both formats so it works regardless of which sheet is used
 */
function normalizeDrugRow(d) {
  // If already normalized (has lowercase 'generic'), return as-is
  if (d.generic) {
    // Parse previousData if it's a JSON string
    if (d.previousData && typeof d.previousData === 'string') {
      d.previousData = tryParseJSON(d.previousData);
    }
    return d;
  }

  var hadVal = d['HAD'] || d['had'] || false;
  if (hadVal === 'TRUE' || hadVal === true) hadVal = true;
  else hadVal = false;

  var cats = d['Categories'] || d['categories'] || '';
  if (typeof cats === 'string') {
    cats = cats.split(',').map(function(c) { return c.trim().toLowerCase(); }).filter(Boolean);
  }

  return {
    id: d['ID'] || d['id'] || '',
    generic: d['Generic Name'] || d['generic'] || '',
    trade: d['Trade Name'] || d['trade'] || '',
    strength: d['Strength'] || d['strength'] || '',
    ed: d['ED/NED'] || d['ed'] || 'N',
    had: hadVal,
    categories: cats,
    status: d['status'] || 'approved',
    reconst: {
      solvent: d['Reconst: Solvent'] || '',
      volume: d['Reconst: Volume'] || '',
      conc: d['Reconst: Conc'] || ''
    },
    dilution: {
      diluent: d['Dilution: Diluent'] || '',
      volume: d['Dilution: Volume'] || '',
      finalConc: d['Dilution: Final Conc'] || ''
    },
    admin: {
      route: d['Admin: Route'] || '',
      rate: d['Admin: Rate'] || ''
    },
    stability: {
      reconst: d['Stability: Reconst'] || '',
      diluted: d['Stability: Diluted'] || '',
      storage: d['Stability: Storage'] || ''
    },
    compat: {
      ysite: d['Compat: Y-site'] || '',
      incompat: d['Compat: Incompatible'] || ''
    },
    precautions: d['Precautions'] || d['precautions'] || '',
    monitoring: d['Monitoring'] || d['monitoring'] || '',
    ref: d['Reference'] || d['ref'] || '',
    dosing: d['Usual Dose'] || d['dosing'] || '',
    previousData: d['previousData'] ? tryParseJSON(d['previousData']) : null
  };
}

function handleCreateDrug(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ' });

  var sheet = getOrCreateSheet(SHEETS.DRUGS,
    ['id', 'generic', 'trade', 'strength', 'ed', 'had', 'categories', 'status',
     'reconst', 'dilution', 'admin', 'stability', 'compat', 'precautions', 'monitoring', 'ref',
     'createdBy', 'createdAt', 'updatedAt', 'previousData'],
    getDrugSS()
  );

  var id = Date.now();
  var now = new Date().toISOString();
  sheet.appendRow([
    id, data.generic || '', data.trade || '', data.strength || '',
    data.ed || 'N', data.had || false, JSON.stringify(data.categories || []),
    data.status || 'draft',
    JSON.stringify(data.reconst || {}), JSON.stringify(data.dilution || {}),
    JSON.stringify(data.admin || {}), JSON.stringify(data.stability || {}),
    JSON.stringify(data.compat || {}), data.precautions || '',
    JSON.stringify(data.monitoring || []), data.ref || '',
    user, now, now
  ]);

  addAuditLog(user, 'createDrug', id, data.generic, 'Status: ' + (data.status || 'draft'));
  _syncDrugsSafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, id: id, message: 'Drug created' });
}

function handleUpdateDrug(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ' });

  var sheet = getDrugSS().getSheetByName(SHEETS.DRUGS);
  if (!sheet) return errorResponse('Drugs sheet not found');

  var all = sheet.getDataRange().getValues();
  var headers = all[0];
  var idCol = headers.indexOf('id');
  if (idCol === -1) return errorResponse('ID column not found');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      // ═══ Snapshot previous data when changing to pending (for diff review) ═══
      var prevStatusCol = headers.indexOf('status');
      var prevDataCol = headers.indexOf('previousData');
      if (data.status === 'pending' && prevDataCol >= 0 && prevStatusCol >= 0 && all[i][prevStatusCol] === 'approved') {
        var snapshot = {};
        for (var h = 0; h < headers.length; h++) {
          if (headers[h] && headers[h] !== 'previousData') {
            var cellVal = all[i][h];
            snapshot[headers[h]] = (typeof cellVal === 'string' && (cellVal.charAt(0) === '{' || cellVal.charAt(0) === '['))
              ? tryParseJSON(cellVal) : cellVal;
          }
        }
        sheet.getRange(i + 1, prevDataCol + 1).setValue(JSON.stringify(snapshot));
      }

      for (var key in data) {
        if (key === 'id') continue;
        var col = headers.indexOf(key);
        if (col >= 0) {
          var val = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
          sheet.getRange(i + 1, col + 1).setValue(val);
        }
      }
      var updCol = headers.indexOf('updatedAt');
      if (updCol >= 0) sheet.getRange(i + 1, updCol + 1).setValue(new Date().toISOString());

      addAuditLog(user, 'updateDrug', data.id, data.generic || all[i][headers.indexOf('generic')], 'Updated fields: ' + Object.keys(data).join(', '));
      _syncDrugsSafe();   // dual-write to Supabase (covers approve/reject too)
      return jsonResponse({ success: true, id: data.id, message: 'Drug updated' });
    }
  }
  return errorResponse('Drug not found: ' + data.id);
}

function handleDeleteDrug(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getDrugSS().getSheetByName(SHEETS.DRUGS);
  if (!sheet) return errorResponse('Drugs sheet not found');

  var all = sheet.getDataRange().getValues();
  var idCol = all[0].indexOf('id');
  var nameCol = all[0].indexOf('generic');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      var name = all[i][nameCol] || '';
      sheet.deleteRow(i + 1);
      addAuditLog(user, 'deleteDrug', data.id, name, 'Permanently deleted');
      try { _supaDelete('drugs', 'id', String(data.id)); } catch (e) { Logger.log('drug del supabase: ' + e.message); }
      return jsonResponse({ success: true, message: 'Drug deleted: ' + name });
    }
  }
  return errorResponse('Drug not found: ' + data.id);
}

function handleApproveDrug(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var updateData = { id: data.id, status: 'approved', previousData: '' };
  var result = handleUpdateDrug(user, updateData);
  addAuditLog(user, 'approveDrug', data.id, '', 'Approved by ' + user);
  return result;
}

function handleRejectDrug(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var updateData = { id: data.id, status: 'draft' };
  var result = handleUpdateDrug(user, updateData);
  addAuditLog(user, 'rejectDrug', data.id, '', 'Rejected: ' + (data.reason || 'No reason'));
  return result;
}


// ════════════════════════════════════════════════
// ADMIN USERS
// ════════════════════════════════════════════════

function handleGetAudit() {
  return jsonResponse({ auditLog: getSheetData(SHEETS.AUDIT) });
}

function handleGetUsers() {
  return jsonResponse({ adminUsers: getSheetData(SHEETS.USERS) });
}

function handleSetUserRole(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getOrCreateSheet(SHEETS.USERS, ['email', 'name', 'role', 'addedBy', 'addedAt']);
  var all = sheet.getDataRange().getValues();
  var emailCol = all[0].indexOf('email');

  for (var i = 1; i < all.length; i++) {
    if (all[i][emailCol] === data.email) {
      var roleCol = all[0].indexOf('role');
      sheet.getRange(i + 1, roleCol + 1).setValue(data.role || 'editor');
      addAuditLog(user, 'setUserRole', '', data.email, 'Role: ' + data.role);
      return jsonResponse({ success: true, email: data.email, role: data.role });
    }
  }

  // New user
  sheet.appendRow([data.email, data.name || '', data.role || 'editor', user, new Date().toISOString()]);
  addAuditLog(user, 'addUser', '', data.email, 'Added as ' + (data.role || 'editor'));
  return jsonResponse({ success: true, email: data.email, role: data.role || 'editor', message: 'User added' });
}

function handleRemoveUser(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getSS().getSheetByName(SHEETS.USERS);
  if (!sheet) return errorResponse('Users sheet not found');

  var all = sheet.getDataRange().getValues();
  var emailCol = all[0].indexOf('email');

  for (var i = 1; i < all.length; i++) {
    if (all[i][emailCol] === data.email) {
      sheet.deleteRow(i + 1);
      addAuditLog(user, 'removeUser', '', data.email, 'Removed');
      return jsonResponse({ success: true, message: 'User removed: ' + data.email });
    }
  }
  return errorResponse('User not found: ' + data.email);
}


// ════════════════════════════════════════════════
// COMPATIBILITY PAIRS CRUD
// ════════════════════════════════════════════════

var COMPAT_HEADERS = ['id', 'drugA', 'drugB', 'result', 'ref', 'createdBy', 'createdAt', 'updatedAt'];

// Public endpoint — returns only drugA, drugB, result (no auth required)
function handleGetCompatPairsPublic() {
  var pairs = getSheetData(SHEETS.COMPAT_PAIRS);
  var slim = pairs.map(function(p) {
    return [p.drugA || '', p.drugB || '', p.result || 'c'];
  });
  return jsonResponse({ pairs: slim });
}

function handleGetCompatPairs(user) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });
  return jsonResponse({ pairs: getSheetData(SHEETS.COMPAT_PAIRS), myRole: perm.role });
}

function handleCreateCompatPair(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var sheet = getOrCreateSheet(SHEETS.COMPAT_PAIRS, COMPAT_HEADERS);
  var id = Date.now();
  var now = new Date().toISOString();
  sheet.appendRow([
    id, data.drugA || '', data.drugB || '', data.result || 'c', data.ref || '',
    user, now, now
  ]);
  addAuditLog(user, 'createCompatPair', id, data.drugA + ' + ' + data.drugB, 'Result: ' + data.result);
  _syncCompatSafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, id: id, message: 'Compat pair created' });
}

function handleUpdateCompatPair(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var sheet = getSS().getSheetByName(SHEETS.COMPAT_PAIRS);
  if (!sheet) return errorResponse('CompatPairs sheet not found');

  var all = sheet.getDataRange().getValues();
  var headers = all[0];
  var idCol = headers.indexOf('id');
  if (idCol === -1) return errorResponse('ID column not found');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      for (var key in data) {
        if (key === 'id') continue;
        var col = headers.indexOf(key);
        if (col >= 0) {
          sheet.getRange(i + 1, col + 1).setValue(data[key]);
        }
      }
      var updCol = headers.indexOf('updatedAt');
      if (updCol >= 0) sheet.getRange(i + 1, updCol + 1).setValue(new Date().toISOString());

      addAuditLog(user, 'updateCompatPair', data.id, (data.drugA || all[i][headers.indexOf('drugA')]) + ' + ' + (data.drugB || all[i][headers.indexOf('drugB')]), 'Updated');
      _syncCompatSafe();   // dual-write to Supabase (best-effort)
      return jsonResponse({ success: true, id: data.id, message: 'Compat pair updated' });
    }
  }
  return errorResponse('Compat pair not found: ' + data.id);
}

function handleDeleteCompatPair(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getSS().getSheetByName(SHEETS.COMPAT_PAIRS);
  if (!sheet) return errorResponse('CompatPairs sheet not found');

  var all = sheet.getDataRange().getValues();
  var idCol = all[0].indexOf('id');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      var drugACol = all[0].indexOf('drugA');
      var drugBCol = all[0].indexOf('drugB');
      var name = (all[i][drugACol] || '') + ' + ' + (all[i][drugBCol] || '');
      sheet.deleteRow(i + 1);
      addAuditLog(user, 'deleteCompatPair', data.id, name, 'Deleted');
      try { _supaDelete('compat_pairs', 'id', String(data.id)); } catch (e) { Logger.log('compat del supabase: ' + e.message); }
      return jsonResponse({ success: true, message: 'Deleted: ' + name });
    }
  }
  return errorResponse('Compat pair not found: ' + data.id);
}


function handleBulkCreateCompatPairs(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var pairs = data.pairs || [];
  if (pairs.length === 0) return errorResponse('No pairs provided');

  var sheet = getOrCreateSheet(SHEETS.COMPAT_PAIRS, COMPAT_HEADERS);

  // Read existing pairs for upsert detection
  var existing = getSheetData(SHEETS.COMPAT_PAIRS);
  var existingKeys = {};
  existing.forEach(function(p, idx) {
    var key = [p.drugA, p.drugB].map(function(s) { return (s || '').toLowerCase().trim(); }).sort().join('|');
    existingKeys[key] = { row: idx + 2, result: p.result }; // +2 for header + 0-index
  });

  var now = new Date().toISOString();
  var created = 0;
  var updated = 0;
  var skipped = 0;

  pairs.forEach(function(p) {
    var key = [p.drugA, p.drugB].map(function(s) { return (s || '').toLowerCase().trim(); }).sort().join('|');
    var newResult = p.result || 'c';
    if (existingKeys[key]) {
      // Upsert: update if status changed
      if (existingKeys[key].result !== newResult) {
        var rowNum = existingKeys[key].row;
        sheet.getRange(rowNum, 4).setValue(newResult); // col 4 = result
        sheet.getRange(rowNum, 8).setValue(now);        // col 8 = updatedAt
        updated++;
      } else {
        skipped++;
      }
      return;
    }
    var id = Date.now() + created; // Ensure unique IDs
    sheet.appendRow([id, p.drugA || '', p.drugB || '', newResult, p.ref || '', user, now, now]);
    existingKeys[key] = { row: sheet.getLastRow(), result: newResult };
    created++;
  });

  addAuditLog(user, 'bulkImportCompat', '', '', 'Imported ' + created + ' new, updated ' + updated + ', skipped ' + skipped + ' unchanged');
  _syncCompatSafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, created: created, updated: updated, skipped: skipped });
}


// ════════════════════════════════════════════════
// RENAL DOSING DATA CRUD
// ════════════════════════════════════════════════

var RENAL_DRUG_HEADERS = ['id', 'name', 'class', 'sub', 'badges', 'recommended', 'dosingTable', 'info', 'infoType', 'ref', 'createdBy', 'createdAt', 'updatedAt'];

// ════════════════════════════════════════════════
// SUPABASE REFERENCE-DATA SYNC (Phase 2 step 2)
// ── GAS dual-writes admin reference data to Supabase using the SERVICE key
//    (server-side, bypasses RLS). The key is read from Script Properties —
//    NEVER hardcode it here (this file is in a public repo).
//    Set it once: ADMIN GAS editor → Project Settings → Script Properties →
//    SUPABASE_SERVICE_KEY = sb_secret_…
// ════════════════════════════════════════════════
var SUPA_REF_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';

function _supaServiceKey() {
  var k = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (!k) throw new Error('SUPABASE_SERVICE_KEY not set in Script Properties');
  return k;
}

function _supaUpsert(table, rows) {
  if (!rows || !rows.length) return;
  var key = _supaServiceKey();
  var resp = UrlFetchApp.fetch(SUPA_REF_URL + '/rest/v1/' + table, {
    method: 'post', contentType: 'application/json',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'resolution=merge-duplicates,return=minimal' },
    payload: JSON.stringify(rows), muteHttpExceptions: true
  });
  var c = resp.getResponseCode();
  if (c < 200 || c >= 300) throw new Error('Supabase upsert ' + table + ' ' + c + ': ' + resp.getContentText().slice(0, 200));
}

function _supaDelete(table, col, val) {
  var key = _supaServiceKey();
  var url = SUPA_REF_URL + '/rest/v1/' + table + '?' + col + '=eq.' + encodeURIComponent(val);
  var resp = UrlFetchApp.fetch(url, {
    method: 'delete',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'return=minimal' },
    muteHttpExceptions: true
  });
  var c = resp.getResponseCode();
  if (c < 200 || c >= 300) throw new Error('Supabase delete ' + table + ' ' + c);
}

// Upsert ALL current renal drugs (cheap — 26 rows). Used by the one-time
// migration and as the post-write sync. data jsonb holds the full drug object.
function _syncRenalToSupabase() {
  var drugs = getSheetData(SHEETS.RENAL_DRUGS_DATA);
  var rows = drugs.filter(function (d) { return d.id; }).map(function (d) {
    return { id: String(d.id), name: d.name || '', data: d };
  });
  _supaUpsert('renal_drugs', rows);
  return rows.length;
}
// Best-effort wrapper — a Supabase hiccup must never break the GAS admin write.
function _syncRenalSafe() {
  try { _syncRenalToSupabase(); } catch (e) { Logger.log('renal->supabase sync failed: ' + e.message); }
}

// Diagnostic — what spreadsheet/tabs does this GAS project actually see?
function diagAdminSheets() {
  try {
    var a = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('active SS: ' + (a ? (a.getName() + ' / ' + a.getId()) : 'null (standalone?)'));
    if (a) Logger.log('active tabs: ' + a.getSheets().map(function (s) { return s.getName(); }).join(', '));
  } catch (e) { Logger.log('active err: ' + e.message); }
  Logger.log('SPREADSHEET_ID const = "' + SPREADSHEET_ID + '"');
  try {
    var g = getSS();
    Logger.log('getSS(): ' + g.getName() + ' / ' + g.getId());
    Logger.log('getSS tabs: ' + g.getSheets().map(function (s) { return s.getName(); }).join(', '));
  } catch (e) { Logger.log('getSS err: ' + e.message); }
}

// One-time migration — run from the ADMIN GAS editor after setting the key.
function migrateRenalToSupabaseNow() {
  var n = _syncRenalToSupabase();
  Logger.log('renal_drugs upserted to Supabase: ' + n);
  return n;
}

// ── Compat pairs sync ───────────────────────────────────────────────
// Upsert ALL compat pairs (cheap — ~257 rows). data jsonb holds the full
// pair object; drug_a/drug_b mirrored to columns for convenience.
function _syncCompatToSupabase() {
  var pairs = getSheetData(SHEETS.COMPAT_PAIRS);
  var rows = pairs.filter(function (p) { return p.id; }).map(function (p) {
    return { id: String(p.id), drug_a: p.drugA || '', drug_b: p.drugB || '', data: p };
  });
  _supaUpsert('compat_pairs', rows);
  return rows.length;
}
function _syncCompatSafe() {
  try { _syncCompatToSupabase(); } catch (e) { Logger.log('compat->supabase sync failed: ' + e.message); }
}
function migrateCompatToSupabaseNow() {
  var n = _syncCompatToSupabase();
  Logger.log('compat_pairs upserted to Supabase: ' + n);
  return n;
}

// ── Drugs sync ──────────────────────────────────────────────────────
// Drug data lives in the drug spreadsheet (getDrugSS, openById) — reachable
// from any GAS project. The DrugData sheet uses HUMAN-READABLE headers
// ("Generic Name", "Reconst: Solvent", …), so map via normalizeDrugRow first,
// then coerce nested fields to objects/arrays → clean drugs-data.json shape.
function _syncDrugsToSupabase() {
  var raw = getSheetData(SHEETS.DRUGS, getDrugSS());
  function obj(v) { return (typeof v === 'string') ? (tryParseJSON(v) || {}) : (v || {}); }
  function arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      var p = tryParseJSON(v);
      if (Array.isArray(p)) return p;
      return v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    }
    return [];
  }
  var rows = [];
  raw.forEach(function (d) {
    var o = normalizeDrugRow(d);                 // human-readable headers → object
    var idNum = parseInt(o.id, 10);
    if (isNaN(idNum)) { Logger.log('skip drug (non-numeric id): ' + (o.generic || '')); return; }
    o.id = idNum;
    o.reconst = obj(o.reconst); o.dilution = obj(o.dilution); o.admin = obj(o.admin);
    o.stability = obj(o.stability); o.compat = obj(o.compat);
    o.categories = arr(o.categories); o.monitoring = arr(o.monitoring);
    rows.push({ id: idNum, generic: o.generic || '', status: o.status || 'approved', data: o });
  });
  for (var i = 0; i < rows.length; i += 100) _supaUpsert('drugs', rows.slice(i, i + 100)); // chunk big payload
  return rows.length;
}
function _syncDrugsSafe() {
  try { _syncDrugsToSupabase(); } catch (e) { Logger.log('drugs->supabase sync failed: ' + e.message); }
}
function migrateDrugsToSupabaseNow() {
  var n = _syncDrugsToSupabase();
  Logger.log('drugs upserted to Supabase: ' + n);
  return n;
}

// ── Allergy sync (groups + refs) ────────────────────────────────────
// Store raw sheet rows in `data` jsonb (JSON-string fields kept as-is — the
// app's applyRemoteData already parses them, same as it did from GAS).
function _syncAllergyToSupabase() {
  var groups = getSheetData(SHEETS.ALLERGY_GROUPS);
  var grows = groups.filter(function (g) { return g.id; })
    .map(function (g) { return { id: String(g.id), data: g }; });
  _supaUpsert('allergy_groups', grows);
  var refs = getSheetData(SHEETS.ALLERGY_REFS);
  var rrows = refs.filter(function (r) { return r.key; })
    .map(function (r) { return { key: String(r.key), data: r }; });
  _supaUpsert('allergy_refs', rrows);
  return grows.length + ' groups, ' + rrows.length + ' refs';
}
function _syncAllergySafe() {
  try { _syncAllergyToSupabase(); } catch (e) { Logger.log('allergy->supabase sync failed: ' + e.message); }
}
function migrateAllergyToSupabaseNow() {
  var r = _syncAllergyToSupabase();
  Logger.log('allergy upserted to Supabase: ' + r);
  return r;
}

// ── Usual Dose import (Batch 1: neuro-critical + emergency) ──────────
// Writes the "Usual Dose" column (created if missing) in the DrugData sheet by
// drug ID, then dual-writes all drugs to Supabase. Run from the ADMIN GAS
// editor (getDrugSS openById reaches the drug spreadsheet). EBM drafts,
// pharmacist-reviewed.
function importDosingBatch1() {
  var DOSE = {
    5:  'AIS: 0.9 mg/kg (max 90 mg) — bolus 10% ใน 1 นาที, ที่เหลือหยดใน 60 นาที',
    93: 'Status epilepticus: Loading 20 mg/kg IV (≤50 mg/min; ผู้สูงอายุ/โรคหัวใจ ≤25 mg/min), monitor ECG/BP\nMaintenance 4–6 mg/kg/day',
    104:'Status epilepticus: Loading 40 mg/kg IV (max 3 g) ใน 10 นาที',
    91: 'Status epilepticus: 15–20 mg/kg IV (≤50–100 mg/min), monitor การหายใจ/BP',
    77: 'Status epilepticus: 0.2 mg/kg IV; refractory: หยด 0.05–0.4 mg/kg/h (prehospital 10 mg IM)',
    144:'↑ICP: 0.25–1 g/kg IV ใน 10–20 นาที, ซ้ำได้ q4–6h — monitor serum osm <320, electrolytes',
    143:'↑ICP: 3–5 mL/kg (หรือ 250 mL) IV ใน 10–20 นาที ทาง central line\nSevere hyponatremia: 100–150 mL bolus ซ้ำได้',
    82: 'aSAH vasospasm: เริ่ม 1 mg/h IV (~15 mcg/kg/h) ×2 ชม. → ถ้า BP ทนได้ เพิ่มเป็น 2 mg/h\nน้ำหนัก <70 kg / BP ไม่นิ่ง: เริ่ม 0.5 mg/h — หยดต่อเนื่องทาง central line ร่วมกับสารน้ำ\nIV 5–14 วัน → PO 60 mg q4h จนครบ 21 วัน',
    81: 'Acute BP (stroke/HTN emergency): หยด 5 mg/h, เพิ่ม 2.5 mg/h q5–15 นาที, max 15 mg/h',
    64: 'Acute BP: 10–20 mg IV ใน 1–2 นาที, ซ้ำ/เพิ่มเท่าตัว q10 นาที (max 300 mg)\nหรือหยด 0.5–2 mg/min',
    4:  'Cardiac arrest: 1 mg IV/IO q3–5 นาที\nAnaphylaxis: 0.5 mg IM\nInfusion: 0.05–0.5 mcg/kg/min',
    7:  'VF/pVT: 300 mg IV push (ซ้ำ 150 mg)\nStable: 150 mg ใน 10 นาที → 1 mg/min ×6h → 0.5 mg/min'
  };
  var sheet = getDrugSS().getSheetByName(SHEETS.DRUGS);
  if (!sheet) throw new Error('Drugs sheet not found');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('ID'); if (idCol < 0) idCol = headers.indexOf('id');
  if (idCol < 0) throw new Error('ID column not found');
  var doseCol = headers.indexOf('Usual Dose');
  if (doseCol < 0) { doseCol = headers.length; sheet.getRange(1, doseCol + 1).setValue('Usual Dose'); }
  var n = 0;
  for (var i = 1; i < values.length; i++) {
    var id = parseInt(values[i][idCol], 10);
    if (DOSE[id]) { sheet.getRange(i + 1, doseCol + 1).setValue(DOSE[id]); n++; }
  }
  _syncDrugsSafe();   // dual-write to Supabase
  Logger.log('Usual Dose set for ' + n + ' drugs (Batch 1) + synced to Supabase');
  return n;
}

// Generic dosing importer (the ongoing path — no GAS re-paste per batch).
// 1) In the ADMIN spreadsheet create a tab "DosingImport" with 2 columns:
//    id | dosing   (header row optional). Paste the approved id+dosing rows.
// 2) Run this. It writes the "Usual Dose" column in DrugData by id, then
//    dual-writes all drugs to Supabase. Rows with blank dosing are skipped.
function importDosingFromTab() {
  var imp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DosingImport');
  if (!imp) throw new Error('Create a tab "DosingImport" with columns: id | dosing');
  var rows = imp.getDataRange().getValues();
  var start = (rows.length && String(rows[0][0]).toLowerCase() === 'id') ? 1 : 0;
  var map = {};
  for (var i = start; i < rows.length; i++) {
    var id = parseInt(rows[i][0], 10);
    var dose = rows[i][1];
    // Allow single-line paste: convert the literal token \n (backslash-n) into a real
    // line break so multi-line dosing pastes into ONE cell without CSV quoting/import.
    if (!isNaN(id) && dose !== '' && dose != null) map[id] = String(dose).replace(/\\n/g, '\n');
  }
  var sheet = getDrugSS().getSheetByName(SHEETS.DRUGS);
  if (!sheet) throw new Error('Drugs sheet not found');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('ID'); if (idCol < 0) idCol = headers.indexOf('id');
  if (idCol < 0) throw new Error('ID column not found');
  var doseCol = headers.indexOf('Usual Dose');
  if (doseCol < 0) { doseCol = headers.length; sheet.getRange(1, doseCol + 1).setValue('Usual Dose'); }
  var n = 0;
  for (var r = 1; r < values.length; r++) {
    var rid = parseInt(values[r][idCol], 10);
    if (map[rid] != null) { sheet.getRange(r + 1, doseCol + 1).setValue(map[rid]); n++; }
  }
  _syncDrugsSafe();
  Logger.log('imported dosing for ' + n + ' drugs from DosingImport tab + synced to Supabase');
  return n;
}


function handleGetRenalDrugsPublic() {
  var drugs = getSheetData(SHEETS.RENAL_DRUGS_DATA);
  var slim = drugs.map(function(d) {
    return { id: d.id, name: d.name, class: d['class'], sub: d.sub, badges: d.badges, recommended: d.recommended, dosingTable: d.dosingTable, info: d.info, infoType: d.infoType, ref: d.ref };
  });
  return jsonResponse({ drugs: slim });
}

function handleGetRenalDrugs(user) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });
  return jsonResponse({ drugs: getSheetData(SHEETS.RENAL_DRUGS_DATA), myRole: perm.role });
}

function handleCreateRenalDrug(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var sheet = getOrCreateSheet(SHEETS.RENAL_DRUGS_DATA, RENAL_DRUG_HEADERS);
  var now = new Date().toISOString();
  var id = data.id || ('renal_' + Date.now());
  sheet.appendRow([
    id, data.name || '', data['class'] || '', data.sub || '',
    typeof data.badges === 'object' ? JSON.stringify(data.badges) : (data.badges || '[]'),
    data.recommended || '',
    typeof data.dosingTable === 'object' ? JSON.stringify(data.dosingTable) : (data.dosingTable || '[]'),
    data.info || '', data.infoType || 'blue', data.ref || '',
    user, now, now
  ]);
  addAuditLog(user, 'createRenalDrug', id, data.name, 'Created');
  _syncRenalSafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, id: id });
}

function handleUpdateRenalDrug(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var sheet = getSS().getSheetByName(SHEETS.RENAL_DRUGS_DATA);
  if (!sheet) return errorResponse('RenalDrugsData sheet not found');

  var all = sheet.getDataRange().getValues();
  var headers = all[0];
  var idCol = headers.indexOf('id');
  if (idCol === -1) return errorResponse('ID column not found');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      for (var key in data) {
        if (key === 'id') continue;
        var col = headers.indexOf(key);
        if (col >= 0) {
          var val = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
          sheet.getRange(i + 1, col + 1).setValue(val);
        }
      }
      var updCol = headers.indexOf('updatedAt');
      if (updCol >= 0) sheet.getRange(i + 1, updCol + 1).setValue(new Date().toISOString());
      addAuditLog(user, 'updateRenalDrug', data.id, data.name || all[i][headers.indexOf('name')], 'Updated');
      _syncRenalSafe();   // dual-write to Supabase (best-effort)
      return jsonResponse({ success: true, id: data.id });
    }
  }
  return errorResponse('Renal drug not found: ' + data.id);
}

function handleDeleteRenalDrug(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getSS().getSheetByName(SHEETS.RENAL_DRUGS_DATA);
  if (!sheet) return errorResponse('RenalDrugsData sheet not found');

  var all = sheet.getDataRange().getValues();
  var idCol = all[0].indexOf('id');
  var nameCol = all[0].indexOf('name');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      var name = all[i][nameCol] || '';
      sheet.deleteRow(i + 1);
      addAuditLog(user, 'deleteRenalDrug', data.id, name, 'Deleted');
      try { _supaDelete('renal_drugs', 'id', String(data.id)); } catch (e) { Logger.log('renal del supabase: ' + e.message); }
      return jsonResponse({ success: true, message: 'Deleted: ' + name });
    }
  }
  return errorResponse('Renal drug not found: ' + data.id);
}

function handleBulkCreateRenalDrugs(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var drugs = data.drugs || [];
  if (drugs.length === 0) return errorResponse('No drugs provided');

  var sheet = getOrCreateSheet(SHEETS.RENAL_DRUGS_DATA, RENAL_DRUG_HEADERS);
  var existing = getSheetData(SHEETS.RENAL_DRUGS_DATA);
  var existingIds = {};
  existing.forEach(function(d) { existingIds[String(d.id).toLowerCase()] = true; });

  var now = new Date().toISOString();
  var created = 0, skipped = 0;

  drugs.forEach(function(d) {
    var drugId = String(d.id || '').toLowerCase();
    if (existingIds[drugId]) { skipped++; return; }
    sheet.appendRow([
      d.id || '', d.name || '', d['class'] || '', d.sub || '',
      typeof d.badges === 'object' ? JSON.stringify(d.badges) : (d.badges || '[]'),
      d.recommended || '',
      typeof d.dosingTable === 'object' ? JSON.stringify(d.dosingTable) : (d.dosingTable || '[]'),
      d.info || '', d.infoType || 'blue', d.ref || '',
      user, now, now
    ]);
    existingIds[drugId] = true;
    created++;
  });

  addAuditLog(user, 'bulkImportRenalDrugs', '', '', 'Imported ' + created + ', skipped ' + skipped);
  _syncRenalSafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, created: created, skipped: skipped });
}


// ════════════════════════════════════════════════
// ALLERGY CROSS-REACTIVITY DATA CRUD
// ════════════════════════════════════════════════
// One row per group (beta_lactam | nbl). Nested arrays/objects (allergens,
// crossReactive, safe, caution, refs, chemLabels) are stored as JSON strings;
// the frontend parses them back. Boolean flags are stored as TRUE/FALSE.
// Citations live in a separate AllergyRefs sheet (key -> citation).

var ALLERGY_GROUP_HEADERS = ['id', 'type', 'label', 'allergens', 'crossReactive', 'safe', 'caution',
  'refs', 'crossReason', 'cautionReason', 'safeReason', 'noteMild', 'noteIge', 'noteScar',
  'scarCautionNote', 'singleDrugCallout', 'keepSafeOnScar', 'clusterAware', 'crossClassCaution',
  'chemGroupAware', 'chemLabels', 'sortOrder', 'createdBy', 'createdAt', 'updatedAt'];

var ALLERGY_REF_HEADERS = ['key', 'citation', 'createdBy', 'createdAt', 'updatedAt'];

// JSON-encode objects/arrays, pass scalars through (null -> '')
function allergyJ(v) {
  return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : (v == null ? '' : v);
}
function allergyBool(v) { return v === true || v === 'true'; }

function allergyGroupRow(id, d, createdBy, createdAt, updatedAt) {
  return [
    id, d.type || 'nbl', d.label || '',
    allergyJ(d.allergens || []), allergyJ(d.crossReactive || []), allergyJ(d.safe || []),
    allergyJ(d.caution || []), allergyJ(d.refs || []),
    d.crossReason || '', d.cautionReason || '', d.safeReason || '',
    d.noteMild || '', d.noteIge || '', d.noteScar || '', d.scarCautionNote || '', d.singleDrugCallout || '',
    allergyBool(d.keepSafeOnScar), allergyBool(d.clusterAware), allergyBool(d.crossClassCaution),
    allergyBool(d.chemGroupAware), allergyJ(d.chemLabels || ''),
    (d.sortOrder != null ? d.sortOrder : ''),
    createdBy, createdAt, updatedAt
  ];
}

// Public read — app sync (no permission). Returns raw rows; frontend parses JSON.
function handleGetAllergyDataPublic() {
  return jsonResponse({
    groups: getSheetData(SHEETS.ALLERGY_GROUPS),
    refs: getSheetData(SHEETS.ALLERGY_REFS)
  });
}

function handleGetAllergyGroups(user) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });
  return jsonResponse({
    groups: getSheetData(SHEETS.ALLERGY_GROUPS),
    refs: getSheetData(SHEETS.ALLERGY_REFS),
    myRole: perm.role
  });
}

function handleCreateAllergyGroup(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });
  var sheet = getOrCreateSheet(SHEETS.ALLERGY_GROUPS, ALLERGY_GROUP_HEADERS);
  var now = new Date().toISOString();
  var id = data.id || ('agrp_' + Date.now());
  sheet.appendRow(allergyGroupRow(id, data, user, now, now));
  addAuditLog(user, 'createAllergyGroup', id, data.label || '', 'Created');
  _syncAllergySafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, id: id });
}

function handleUpdateAllergyGroup(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var sheet = getSS().getSheetByName(SHEETS.ALLERGY_GROUPS);
  if (!sheet) return errorResponse('AllergyGroups sheet not found');
  var all = sheet.getDataRange().getValues();
  var headers = all[0];
  var idCol = headers.indexOf('id');
  if (idCol === -1) return errorResponse('ID column not found');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      for (var key in data) {
        if (key === 'id') continue;
        var col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(allergyJ(data[key]));
      }
      var updCol = headers.indexOf('updatedAt');
      if (updCol >= 0) sheet.getRange(i + 1, updCol + 1).setValue(new Date().toISOString());
      addAuditLog(user, 'updateAllergyGroup', data.id, data.label || '', 'Updated');
      _syncAllergySafe();   // dual-write to Supabase (best-effort)
      return jsonResponse({ success: true, id: data.id });
    }
  }
  return errorResponse('Allergy group not found: ' + data.id);
}

function handleDeleteAllergyGroup(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getSS().getSheetByName(SHEETS.ALLERGY_GROUPS);
  if (!sheet) return errorResponse('AllergyGroups sheet not found');
  var all = sheet.getDataRange().getValues();
  var idCol = all[0].indexOf('id');
  var labelCol = all[0].indexOf('label');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      var label = all[i][labelCol] || '';
      sheet.deleteRow(i + 1);
      addAuditLog(user, 'deleteAllergyGroup', data.id, label, 'Deleted');
      try { _supaDelete('allergy_groups', 'id', String(data.id)); } catch (e) { Logger.log('allergy del supabase: ' + e.message); }
      return jsonResponse({ success: true, message: 'Deleted: ' + label });
    }
  }
  return errorResponse('Allergy group not found: ' + data.id);
}

// Bulk import (upsert by id) — used to seed the Sheet from the hardcoded groups
function handleBulkCreateAllergyGroups(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var groups = data.groups || [];
  if (groups.length === 0) return errorResponse('No groups provided');

  var sheet = getOrCreateSheet(SHEETS.ALLERGY_GROUPS, ALLERGY_GROUP_HEADERS);
  var existing = getSheetData(SHEETS.ALLERGY_GROUPS);
  var rowById = {};
  existing.forEach(function(g, idx) { rowById[String(g.id)] = idx + 2; }); // +2 header+0-index

  var now = new Date().toISOString();
  var created = 0, updated = 0;
  groups.forEach(function(g) {
    var id = g.id || ('agrp_' + Date.now() + created);
    var row = allergyGroupRow(id, g, user, now, now);
    if (rowById[String(id)]) {
      sheet.getRange(rowById[String(id)], 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      sheet.appendRow(row);
      rowById[String(id)] = sheet.getLastRow();
      created++;
    }
  });
  addAuditLog(user, 'bulkImportAllergyGroups', '', '', 'Imported ' + created + ' new, updated ' + updated);
  _syncAllergySafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, created: created, updated: updated });
}

// Bulk import refs (upsert by key)
function handleBulkCreateAllergyRefs(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ์' });

  var refs = data.refs || [];
  if (refs.length === 0) return errorResponse('No refs provided');

  var sheet = getOrCreateSheet(SHEETS.ALLERGY_REFS, ALLERGY_REF_HEADERS);
  var existing = getSheetData(SHEETS.ALLERGY_REFS);
  var rowByKey = {};
  existing.forEach(function(r, idx) { rowByKey[String(r.key)] = idx + 2; });

  var now = new Date().toISOString();
  var created = 0, updated = 0;
  refs.forEach(function(r) {
    if (!r.key) return;
    var row = [r.key, r.citation || '', user, now, now];
    if (rowByKey[String(r.key)]) {
      sheet.getRange(rowByKey[String(r.key)], 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      sheet.appendRow(row);
      rowByKey[String(r.key)] = sheet.getLastRow();
      created++;
    }
  });
  addAuditLog(user, 'bulkImportAllergyRefs', '', '', 'Imported ' + created + ' new, updated ' + updated);
  _syncAllergySafe();   // dual-write to Supabase (best-effort)
  return jsonResponse({ success: true, created: created, updated: updated });
}


// ════════════════════════════════════════════════
// URGENT ALERTS
// ════════════════════════════════════════════════

function handleCheckUrgentAlerts(since) {
  var sinceTs = parseInt(since) || 0;
  var alerts = getSheetData(SHEETS.URGENT_ALERTS);

  // Filter active (not resolved)
  var active = alerts.filter(function(a) {
    return a.status !== 'resolved';
  });

  // Check if any are new since last check
  var hasNew = active.some(function(a) {
    var ts = new Date(a.createdAt || a.timestamp || 0).getTime();
    return ts > sinceTs;
  });

  return jsonResponse({
    serverTime: Date.now(),
    alerts: active,
    hasNew: hasNew
  });
}


// ════════════════════════════════════════════════
// UTILITY: Admin Alert Management
// ════════════════════════════════════════════════

function createUrgentAlert(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true });

  var id = 'ALERT_' + Date.now();
  appendToSheet(SHEETS.URGENT_ALERTS,
    ['id', 'type', 'severity', 'title', 'message', 'drugName', 'actionRequired', 'status', 'createdAt', 'createdBy'],
    [id, data.type || 'safety_alert', data.severity || 'medium', data.title || '', data.message || '',
     data.drugName || '', data.actionRequired || '', 'active', new Date().toISOString(), user]
  );

  addAuditLog(user, 'createUrgentAlert', id, data.drugName, data.title);
  return jsonResponse({ success: true, alertId: id });
}

function resolveUrgentAlert(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true });

  var sheet = getSS().getSheetByName(SHEETS.URGENT_ALERTS);
  if (!sheet) return errorResponse('UrgentAlerts sheet not found');

  var all = sheet.getDataRange().getValues();
  var idCol = all[0].indexOf('id');
  var statusCol = all[0].indexOf('status');

  for (var i = 1; i < all.length; i++) {
    if (all[i][idCol] === data.alertId) {
      sheet.getRange(i + 1, statusCol + 1).setValue('resolved');
      addAuditLog(user, 'resolveUrgentAlert', data.alertId, '', 'Resolved');
      return jsonResponse({ success: true, message: 'Alert resolved' });
    }
  }
  return errorResponse('Alert not found');
}
