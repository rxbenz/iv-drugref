// ============================================================
// IV DrugRef Analytics — Google Apps Script
// Deploy this as a Web App to receive data from the PWA
// ============================================================
// วิธีติดตั้ง:
// 1. เปิด Google Sheets ใหม่
// 2. Extensions → Apps Script
// 3. ลบ code เดิม → paste code นี้ทั้งหมด
// 4. กด Run → setup() (ครั้งแรกครั้งเดียว ให้ permission)
// 5. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Copy URL ที่ได้ → ใส่ในแอป (ANALYTICS_URL)
// ============================================================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet 1: Sessions
  let s1 = ss.getSheetByName('Sessions');
  if (!s1) {
    s1 = ss.insertSheet('Sessions');
    s1.appendRow(['timestamp', 'session_id', 'platform', 'standalone', 'online', 'screen_w', 'screen_h']);
    s1.getRange('1:1').setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
  }
  
  // Sheet 2: Searches
  let s2 = ss.getSheetByName('Searches');
  if (!s2) {
    s2 = ss.insertSheet('Searches');
    s2.appendRow(['timestamp', 'session_id', 'query', 'drug_clicked', 'time_to_click_ms', 'filter_used', 'results_count']);
    s2.getRange('1:1').setFontWeight('bold').setBackground('#0EA5E9').setFontColor('white');
  }
  
  // Sheet 3: Surveys
  let s3 = ss.getSheetByName('Surveys');
  if (!s3) {
    s3 = ss.insertSheet('Surveys');
    s3.appendRow([
      'timestamp', 'session_id', 'role', 'department',
      'sat_1_easy_to_find', 'sat_2_accurate', 'sat_3_faster_than_before', 'sat_4_recommend', 'sat_5_overall',
      'sus_1', 'sus_2', 'sus_3', 'sus_4', 'sus_5', 'sus_6', 'sus_7', 'sus_8', 'sus_9', 'sus_10',
      'sus_score', 'comments'
    ]);
    s3.getRange('1:1').setFontWeight('bold').setBackground('#059669').setFontColor('white');
  }
  
  // Delete default Sheet1 if exists
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  
  Logger.log('Setup complete! 3 sheets created.');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = new Date().toISOString();
    
    if (data.type === 'session') {
      ss.getSheetByName('Sessions').appendRow([
        now, data.session_id, data.platform, data.standalone, data.online,
        data.screen_w, data.screen_h
      ]);
    }
    
    else if (data.type === 'search') {
      ss.getSheetByName('Searches').appendRow([
        now, data.session_id, data.query, data.drug_clicked,
        data.time_to_click_ms, data.filter_used, data.results_count
      ]);
    }
    
    else if (data.type === 'survey') {
      // Calculate SUS score
      const sus = data.sus || [];
      let susScore = 0;
      if (sus.length === 10) {
        for (let i = 0; i < 10; i++) {
          susScore += (i % 2 === 0) ? (sus[i] - 1) : (5 - sus[i]);
        }
        susScore *= 2.5;
      }
      
      ss.getSheetByName('Surveys').appendRow([
        now, data.session_id, data.role || '', data.department || '',
        data.sat_1, data.sat_2, data.sat_3, data.sat_4, data.sat_5,
        ...(sus.length === 10 ? sus : Array(10).fill('')),
        sus.length === 10 ? susScore : '',
        data.comments || ''
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // API for dashboard to read data
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e.parameter.action;
    
    if (action === 'summary') {
      const sessions = getSheetData('Sessions');
      const searches = getSheetData('Searches');
      const surveys = getSheetData('Surveys');
      
      // Unique sessions
      const uniqueSessions = new Set(sessions.map(r => r.session_id));
      
      // Daily active users (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const recentSessions = sessions.filter(r => new Date(r.timestamp) > thirtyDaysAgo);
      
      // Daily breakdown
      const dailyMap = {};
      recentSessions.forEach(r => {
        const day = r.timestamp.substring(0, 10);
        if (!dailyMap[day]) dailyMap[day] = new Set();
        dailyMap[day].add(r.session_id);
      });
      const dailyUsers = Object.entries(dailyMap).map(([date, set]) => ({date, users: set.size})).sort((a,b) => a.date.localeCompare(b.date));
      
      // Top searched drugs
      const drugCount = {};
      searches.forEach(r => {
        if (r.drug_clicked) {
          drugCount[r.drug_clicked] = (drugCount[r.drug_clicked] || 0) + 1;
        }
      });
      const topDrugs = Object.entries(drugCount).sort((a,b) => b[1] - a[1]).slice(0, 20).map(([drug, count]) => ({drug, count}));
      
      // Search time stats
      const times = searches.map(r => parseInt(r.time_to_click_ms)).filter(t => t > 0 && t < 300000);
      const avgTime = times.length > 0 ? Math.round(times.reduce((a,b) => a+b, 0) / times.length) : 0;
      const medianTime = times.length > 0 ? times.sort((a,b) => a-b)[Math.floor(times.length/2)] : 0;
      
      // Platform breakdown
      const platforms = {};
      sessions.forEach(r => { platforms[r.platform] = (platforms[r.platform] || 0) + 1; });
      
      // Survey scores
      const satScores = surveys.filter(r => r.sat_5).map(r => parseInt(r.sat_5));
      const avgSat = satScores.length > 0 ? (satScores.reduce((a,b) => a+b, 0) / satScores.length).toFixed(1) : 0;
      const susScores = surveys.filter(r => r.sus_score !== '').map(r => parseFloat(r.sus_score));
      const avgSUS = susScores.length > 0 ? (susScores.reduce((a,b) => a+b, 0) / susScores.length).toFixed(1) : 0;
      
      // Filter usage
      const filterCount = {};
      searches.forEach(r => {
        if (r.filter_used && r.filter_used !== 'all') {
          filterCount[r.filter_used] = (filterCount[r.filter_used] || 0) + 1;
        }
      });
      
      const result = {
        totalSessions: sessions.length,
        uniqueUsers: uniqueSessions.size,
        totalSearches: searches.length,
        totalSurveys: surveys.length,
        dailyUsers,
        topDrugs,
        searchTime: { avg: avgTime, median: medianTime, count: times.length },
        platforms,
        filterUsage: filterCount,
        satisfaction: { avg: avgSat, count: satScores.length },
        sus: { avg: avgSUS, count: susScores.length },
        lastUpdated: now.toISOString()
      };
      
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Export raw data
    if (action === 'export') {
      const sheet = e.parameter.sheet || 'Sessions';
      const data = getSheetData(sheet);
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({error: 'Invalid action. Use ?action=summary or ?action=export&sheet=Sessions'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}
