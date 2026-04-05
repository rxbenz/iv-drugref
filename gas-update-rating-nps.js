/**
 * ================================================================
 * IV DrugRef — GAS Update: Drug Rating + NPS Support
 * ================================================================
 *
 * วิธีใช้:
 * 1. เปิด Google Apps Script Editor (script.google.com)
 * 2. เปิด project ที่ใช้กับ IV DrugRef
 * 3. สร้าง Sheet ใหม่ 2 อัน:
 *    - "DrugRatings" (columns: timestamp, session_id, user_id, drug_id, drug_name, rating)
 *    - "NPSResponses" (columns: timestamp, session_id, user_id, score, comment, session_count, nps_category)
 * 4. Copy code ด้านล่างไปเพิ่มในไฟล์ GAS ที่มีอยู่
 * 5. Deploy ใหม่ (Manage deployments > New deployment)
 *
 * ================================================================
 */

// ────────────────────────────────────────────────
// เพิ่มใน doPost(e) — ส่วน routing ตาม event type
// ────────────────────────────────────────────────

/*
  ใน function doPost(e) ที่มีอยู่แล้ว ให้เพิ่ม case สำหรับ event ใหม่:

  // ... existing code ...

  const data = JSON.parse(e.postData.contents);
  const eventType = data.type || data.event || data.action;

  // ──── เพิ่ม block นี้ ────
  if (eventType === 'DRUG_RATING') {
    return logDrugRating(data);
  }
  if (eventType === 'NPS_SUBMIT') {
    return logNPSResponse(data);
  }
  // ──── จบ block ────

  // ... rest of existing routing ...
*/


// ────────────────────────────────────────────────
// Function: บันทึก Drug Rating
// ────────────────────────────────────────────────
function logDrugRating(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('DrugRatings');

    // สร้าง Sheet อัตโนมัติถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet('DrugRatings');
      sheet.appendRow([
        'timestamp', 'session_id', 'user_id',
        'drug_id', 'drug_name', 'rating'
      ]);
      // Format header
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#E3F2FD');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date().toISOString(),
      data.session_id || '',
      data.user_id || '',
      data.drugId || '',
      data.drugName || '',
      data.rating || 0
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true, type: 'DRUG_RATING'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ────────────────────────────────────────────────
// Function: บันทึก NPS Response
// ────────────────────────────────────────────────
function logNPSResponse(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('NPSResponses');

    // สร้าง Sheet อัตโนมัติถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet('NPSResponses');
      sheet.appendRow([
        'timestamp', 'session_id', 'user_id',
        'score', 'comment', 'session_count', 'nps_category'
      ]);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#E8F5E9');
      sheet.setFrozenRows(1);
    }

    // แบ่ง NPS category
    var score = parseInt(data.score) || 0;
    var category = score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';

    sheet.appendRow([
      new Date().toISOString(),
      data.session_id || '',
      data.user_id || '',
      score,
      data.comment || '',
      data.sessionCount || 0,
      category
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true, type: 'NPS_SUBMIT', category: category
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ────────────────────────────────────────────────
// เพิ่มใน doGet() — action=raw response
// ────────────────────────────────────────────────

/*
  ใน function ที่สร้าง response สำหรับ action=raw
  (ที่ return sessions, searches, surveys ฯลฯ)
  ให้เพิ่ม 2 fields ใน response object:

  // ... existing code ...

  var result = {
    sessions: getSheetData('Sessions'),
    searches: getSheetData('Searches'),
    surveys: getSheetData('Surveys'),
    doseCalcs: getSheetData('DoseCalcs'),
    drugExpands: getSheetData('DrugExpands'),
    tdmUsage: getSheetData('TDMUsage'),
    pageViews: getSheetData('PageViews'),
    renalDosing: getSheetData('RenalDosing'),
    compatUsage: getSheetData('CompatUsage'),

    // ──── เพิ่ม 2 บรรทัดนี้ ────
    drugRatings: getSheetData('DrugRatings'),
    npsResponses: getSheetData('NPSResponses')
    // ──── จบ ────
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
*/


// ────────────────────────────────────────────────
// Helper: อ่านข้อมูลจาก Sheet (ถ้ามีอยู่แล้ว ไม่ต้องเพิ่ม)
// ────────────────────────────────────────────────

/*
  ถ้ายังไม่มี helper function getSheetData ให้เพิ่ม:

  function getSheetData(sheetName) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // header only

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
*/


// ================================================================
// SHEET STRUCTURE REFERENCE
// ================================================================
//
// Sheet: DrugRatings
// ┌─────────────┬────────────┬─────────┬─────────┬──────────────┬────────┐
// │ timestamp   │ session_id │ user_id │ drug_id │ drug_name    │ rating │
// ├─────────────┼────────────┼─────────┼─────────┼──────────────┼────────┤
// │ 2026-03-31  │ u_abc123   │ anon_x  │ 5       │ Amikacin     │ 4      │
// │ 2026-03-31  │ u_def456   │ anon_y  │ 12      │ Vancomycin   │ 5      │
// └─────────────┴────────────┴─────────┴─────────┴──────────────┴────────┘
//
// Sheet: NPSResponses
// ┌─────────────┬────────────┬─────────┬───────┬──────────────────┬───────────────┬──────────────┐
// │ timestamp   │ session_id │ user_id │ score │ comment          │ session_count │ nps_category │
// ├─────────────┼────────────┼─────────┼───────┼──────────────────┼───────────────┼──────────────┤
// │ 2026-03-31  │ u_abc123   │ anon_x  │ 9     │ ใช้งานง่ายมาก     │ 10            │ Promoter     │
// │ 2026-03-31  │ u_ghi789   │ anon_z  │ 6     │ อยากให้เพิ่มยา    │ 20            │ Detractor    │
// └─────────────┴────────────┴─────────┴───────┴──────────────────┴───────────────┴──────────────┘
//
// NPS Score Categories:
//   0-6  = Detractor (สีแดง)
//   7-8  = Passive (สีเหลือง)
//   9-10 = Promoter (สีเขียว)
//
// NPS Score = %Promoter - %Detractor (range: -100 to +100)
// ================================================================
