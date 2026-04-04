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
var SPREADSHEET_ID = ''; // ← ใส่ ID ของ Google Sheets (ถ้าว่าง = ใช้ bound spreadsheet)

function getSS() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
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
  SURVEYS: 'Surveys',
  ERRORS: 'ErrorLog',
  URGENT_ALERTS: 'UrgentAlerts',
  CALC_VISITS: 'CalcVisits',
  DRUG_RATINGS: 'DrugRatings',
  NPS_RESPONSES: 'NPSResponses',
  COMPAT_PAIRS: 'CompatPairs'
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

// ──────────────────────────────────────────────
// SHEET HELPERS
// ──────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  var ss = getSS();
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

function getSheetData(sheetName) {
  var ss = getSS();
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

    var eventType = data.type || data.event || data.action || '';

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
      case 'DRUG_RATING':
        return logDrugRating(data);
      case 'NPS_SUBMIT':
        return logNPSResponse(data);
      case 'SURVEY':
        return logSurvey(data);
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
    ['timestamp', 'session_id', 'user_id', 'query', 'results', 'time_to_click_ms']);
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
  smartLog(SHEETS.DOSE_CALCS, data,
    ['timestamp', 'session_id', 'user_id', 'drug_name', 'dose', 'weight_kg', 'crcl', 'result']);
  return jsonResponse({ success: true });
}

function logDrugExpand(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.DRUG_EXPANDS, data,
    ['timestamp', 'session_id', 'user_id', 'drug_id', 'drug_name']);
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
  smartLog(SHEETS.RENAL_DOSING, data,
    ['timestamp', 'session_id', 'user_id', 'drug', 'crcl', 'formula', 'weight_kg', 'age', 'sex', 'scr']);
  return jsonResponse({ success: true });
}

function logCompatUsage(data) {
  data.timestamp = new Date().toISOString();
  smartLog(SHEETS.COMPAT_USAGE, data,
    ['timestamp', 'session_id', 'user_id', 'drug_a', 'drug_b', 'result', 'mode']);
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
    npsResponses: getSheetData(SHEETS.NPS_RESPONSES)
  });
}

function handleExport(sheetName) {
  if (!sheetName) return errorResponse('Missing sheet parameter');
  var data = getSheetData(sheetName);
  return jsonResponse(data);
}


// ════════════════════════════════════════════════
// DRUG DATA (APP SYNC)
// ════════════════════════════════════════════════

function handleGetDrugs() {
  var drugs = getSheetData(SHEETS.DRUGS);
  // Filter to approved only IF status column exists
  // DrugData sheet อาจไม่มี column status (ยาทั้งหมดถือว่า approved)
  var hasStatus = drugs.length > 0 && drugs[0].hasOwnProperty('status');
  var result = hasStatus
    ? drugs.filter(function(d) { return d.status === 'approved'; })
    : drugs; // No status column = return all
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

  return jsonResponse({
    drugs: getSheetData(SHEETS.DRUGS),
    auditLog: getSheetData(SHEETS.AUDIT),
    myRole: perm.role,
    adminUsers: perm.role === 'admin' ? getSheetData(SHEETS.USERS) : []
  });
}

function handleCreateDrug(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ' });

  var sheet = getOrCreateSheet(SHEETS.DRUGS,
    ['id', 'generic', 'trade', 'strength', 'ed', 'had', 'categories', 'status',
     'reconst', 'dilution', 'admin', 'stability', 'compat', 'precautions', 'monitoring', 'ref',
     'createdBy', 'createdAt', 'updatedAt']
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
  return jsonResponse({ success: true, id: id, message: 'Drug created' });
}

function handleUpdateDrug(user, data) {
  var perm = checkPermission(user, 'editor');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ไม่มีสิทธิ' });

  var sheet = getSS().getSheetByName(SHEETS.DRUGS);
  if (!sheet) return errorResponse('Drugs sheet not found');

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

      addAuditLog(user, 'updateDrug', data.id, data.generic || all[i][headers.indexOf('generic')], 'Updated fields: ' + Object.keys(data).join(', '));
      return jsonResponse({ success: true, id: data.id, message: 'Drug updated' });
    }
  }
  return errorResponse('Drug not found: ' + data.id);
}

function handleDeleteDrug(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var sheet = getSS().getSheetByName(SHEETS.DRUGS);
  if (!sheet) return errorResponse('Drugs sheet not found');

  var all = sheet.getDataRange().getValues();
  var idCol = all[0].indexOf('id');
  var nameCol = all[0].indexOf('generic');

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      var name = all[i][nameCol] || '';
      sheet.deleteRow(i + 1);
      addAuditLog(user, 'deleteDrug', data.id, name, 'Permanently deleted');
      return jsonResponse({ success: true, message: 'Drug deleted: ' + name });
    }
  }
  return errorResponse('Drug not found: ' + data.id);
}

function handleApproveDrug(user, data) {
  var perm = checkPermission(user, 'admin');
  if (!perm.allowed) return jsonResponse({ permissionDenied: true, error: 'ต้องเป็น admin' });

  var updateData = { id: data.id, status: 'approved' };
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

  // Read existing pairs for duplicate detection
  var existing = getSheetData(SHEETS.COMPAT_PAIRS);
  var existingKeys = {};
  existing.forEach(function(p) {
    var key = [p.drugA, p.drugB].map(function(s) { return (s || '').toLowerCase().trim(); }).sort().join('|');
    existingKeys[key] = true;
  });

  var now = new Date().toISOString();
  var created = 0;
  var skipped = 0;

  pairs.forEach(function(p) {
    var key = [p.drugA, p.drugB].map(function(s) { return (s || '').toLowerCase().trim(); }).sort().join('|');
    if (existingKeys[key]) {
      skipped++;
      return;
    }
    var id = Date.now() + created; // Ensure unique IDs
    sheet.appendRow([id, p.drugA || '', p.drugB || '', p.result || 'c', p.ref || '', user, now, now]);
    existingKeys[key] = true;
    created++;
  });

  addAuditLog(user, 'bulkImportCompat', '', '', 'Imported ' + created + ' pairs, skipped ' + skipped + ' duplicates');
  return jsonResponse({ success: true, created: created, skipped: skipped });
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
