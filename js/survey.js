/* ============================================================
 * In-app Satisfaction + SUS survey (research instrument)
 * ------------------------------------------------------------
 * Sends a `SURVEY` analytics event with the exact fields the GAS
 * `logSurvey` / dashboard Survey tab expect:
 *   role, department, sat_1_easy_to_find..sat_5_overall, sus_score, comment
 * Self-contained: injects its own trigger button + modal (inline styles),
 * so no extra CSS/build wiring is needed. Loaded on index.html.
 * ============================================================ */
(function () {
  'use strict';
  var DONE_KEY = 'ivdrug_surveyDone';

  function t(th, en) {
    var lang = (window.IVDrugRefI18n && IVDrugRefI18n.getCurrentLang && IVDrugRefI18n.getCurrentLang()) || 'th';
    return lang === 'en' ? en : th;
  }

  // Standard SUS items (alternating positive/negative), Thai + English.
  var SUS = [
    ['ฉันคิดว่าจะใช้แอปนี้บ่อย', 'I think I would use this app frequently'],
    ['ฉันรู้สึกว่าแอปซับซ้อนเกินไป', 'I found the app unnecessarily complex'],
    ['ฉันคิดว่าแอปใช้งานง่าย', 'I thought the app was easy to use'],
    ['ฉันคิดว่าต้องมีผู้เชี่ยวชาญช่วยจึงจะใช้ได้', 'I would need support of a technical person to use this app'],
    ['ฉันรู้สึกว่าฟังก์ชันต่าง ๆ ทำงานสอดคล้องกันดี', 'I found the various functions well integrated'],
    ['ฉันคิดว่าแอปมีความไม่สอดคล้องมากเกินไป', 'I thought there was too much inconsistency'],
    ['ฉันคิดว่าคนส่วนใหญ่จะเรียนรู้แอปนี้ได้เร็ว', 'Most people would learn this app very quickly'],
    ['ฉันรู้สึกว่าแอปใช้งานยุ่งยาก', 'I found the app very cumbersome to use'],
    ['ฉันรู้สึกมั่นใจเวลาใช้แอป', 'I felt very confident using the app'],
    ['ฉันต้องเรียนรู้หลายอย่างก่อนจะใช้แอปได้', 'I needed to learn a lot before I could get going']
  ];

  var SAT = [
    ['sat_1_easy_to_find', 'ค้นหายาได้ง่าย', 'Easy to find drugs'],
    ['sat_2_accurate', 'ข้อมูลถูกต้องน่าเชื่อถือ', 'Information is accurate/trustworthy'],
    ['sat_3_faster', 'ช่วยให้ทำงานเร็วขึ้น', 'Helps me work faster'],
    ['sat_4_recommend', 'จะแนะนำเพื่อนร่วมงาน', 'I would recommend it to colleagues'],
    ['sat_5_overall', 'ความพึงพอใจโดยรวม', 'Overall satisfaction']
  ];

  var ROLES = [
    ['pharmacist', 'เภสัชกร', 'Pharmacist'],
    ['physician', 'แพทย์', 'Physician'],
    ['nurse', 'พยาบาล', 'Nurse'],
    ['student', 'นักศึกษา', 'Student'],
    ['other', 'อื่น ๆ', 'Other']
  ];

  function likertRow(name, label) {
    var cells = '';
    for (var i = 1; i <= 5; i++) {
      cells += '<label style="flex:1;text-align:center;cursor:pointer;font-size:13px">' +
        '<input type="radio" name="' + name + '" value="' + i + '" style="display:block;margin:0 auto 2px"> ' + i + '</label>';
    }
    return '<div style="margin:10px 0">' +
      '<div style="font-size:13px;color:#1e293b;margin-bottom:4px">' + label + '</div>' +
      '<div style="display:flex;gap:4px">' + cells + '</div></div>';
  }

  function buildModal() {
    var roleOpts = ROLES.map(function (r) { return '<option value="' + r[0] + '">' + t(r[1], r[2]) + '</option>'; }).join('');
    var satHtml = SAT.map(function (s) { return likertRow(s[0], t(s[1], s[2])); }).join('');
    var susHtml = SUS.map(function (s, i) { return likertRow('sus_' + i, (i + 1) + '. ' + t(s[0], s[1])); }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'surveyOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;font-family:"IBM Plex Sans Thai",sans-serif';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px 20px 0 0;max-height:90vh;width:100%;max-width:560px;overflow-y:auto;padding:20px;box-shadow:0 -4px 30px rgba(0,0,0,0.25)">' +
        '<div style="width:36px;height:4px;background:#cbd5e1;border-radius:2px;margin:0 auto 14px"></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0">📋 ' + t('แบบประเมินการใช้งาน', 'Usability Survey') + '</h3>' +
          '<button data-survey-close style="width:32px;height:32px;border:none;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:18px;cursor:pointer">×</button>' +
        '</div>' +
        '<p style="font-size:12px;color:#64748b;margin:0 0 14px">' + t('ใช้เวลา ~2 นาที เพื่อพัฒนาแอปและงานวิจัย ขอบคุณครับ', 'Takes ~2 min — helps improve the app and our research. Thank you!') + '</p>' +

        '<div style="display:flex;gap:10px;margin-bottom:8px">' +
          '<div style="flex:1"><label style="font-size:12px;color:#475569">' + t('บทบาท', 'Role') + '</label>' +
            '<select id="svRole" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">' + roleOpts + '</select></div>' +
          '<div style="flex:1"><label style="font-size:12px;color:#475569">' + t('หน่วยงาน', 'Department') + '</label>' +
            '<input id="svDept" type="text" placeholder="' + t('เช่น OPD, ICU', 'e.g. OPD, ICU') + '" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px"></div>' +
        '</div>' +

        '<div style="font-weight:600;font-size:14px;color:#0f172a;margin:14px 0 2px">⭐ ' + t('ความพึงพอใจ (1=น้อย, 5=มาก)', 'Satisfaction (1=low, 5=high)') + '</div>' +
        satHtml +

        '<div style="font-weight:600;font-size:14px;color:#0f172a;margin:16px 0 2px">📊 ' + t('แบบวัด SUS (1=ไม่เห็นด้วย, 5=เห็นด้วย)', 'SUS scale (1=disagree, 5=agree)') + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">' + t('ตอบให้ครบ 10 ข้อเพื่อคำนวณคะแนน SUS (ไม่ครบก็ส่งได้)', 'Answer all 10 to compute the SUS score (optional)') + '</div>' +
        susHtml +

        '<div style="margin:12px 0"><label style="font-size:12px;color:#475569">' + t('ความคิดเห็นเพิ่มเติม', 'Additional comments') + '</label>' +
          '<textarea id="svComment" rows="2" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;resize:vertical"></textarea></div>' +

        '<div id="svErr" style="display:none;color:#dc2626;font-size:12px;margin-bottom:6px"></div>' +
        '<button data-survey-submit style="width:100%;padding:13px;background:#0ea5e9;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer">' + t('ส่งแบบประเมิน', 'Submit') + '</button>' +
      '</div>';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('[data-survey-close]')) close();
      else if (e.target.closest('[data-survey-submit]')) submit();
    });
    document.body.appendChild(overlay);
  }

  function val(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? parseInt(el.value) : null;
  }

  function submit() {
    var sat = {};
    var anySat = false;
    SAT.forEach(function (s) { var v = val(s[0]); sat[s[0]] = (v == null ? '' : v); if (v != null) anySat = true; });

    if (!anySat) { showErr(t('กรุณาให้คะแนนความพึงพอใจอย่างน้อย 1 ข้อ', 'Please rate at least one satisfaction item')); return; }

    // SUS: only if all 10 answered
    var susVals = SUS.map(function (_, i) { return val('sus_' + i); });
    var susScore = '';
    if (susVals.every(function (v) { return v != null; })) {
      var sum = 0;
      susVals.forEach(function (v, i) { sum += (i % 2 === 0) ? (v - 1) : (5 - v); }); // odd idx(0-based even)=positive
      susScore = sum * 2.5;
    }

    var payload = {
      type: 'SURVEY',
      role: (document.getElementById('svRole') || {}).value || '',
      department: ((document.getElementById('svDept') || {}).value || '').trim(),
      sus_score: susScore,
      comment: ((document.getElementById('svComment') || {}).value || '').trim()
    };
    SAT.forEach(function (s) { payload[s[0]] = sat[s[0]]; });

    if (window.IVDrugRef && IVDrugRef.sendAnalytics) IVDrugRef.sendAnalytics(payload);
    try { localStorage.setItem(DONE_KEY, String(Date.now())); } catch (e) {}
    close();
    hideTrigger();
    toast(t('ขอบคุณสำหรับการประเมิน 🙏', 'Thank you for your feedback 🙏'));
  }

  function showErr(msg) { var e = document.getElementById('svErr'); if (e) { e.textContent = msg; e.style.display = 'block'; } }

  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:10060;font-family:inherit;box-shadow:0 4px 16px rgba(0,0,0,0.2)';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 3000);
  }

  function close() { var o = document.getElementById('surveyOverlay'); if (o) o.remove(); }

  function show() { if (!document.getElementById('surveyOverlay')) buildModal(); }

  function hideTrigger() { var b = document.getElementById('surveyTriggerBtn'); if (b) b.style.display = 'none'; }

  function injectTrigger() {
    if (document.getElementById('surveyTriggerBtn')) return;
    var b = document.createElement('button');
    b.id = 'surveyTriggerBtn';
    b.type = 'button';
    b.textContent = '📋 ' + t('ประเมินแอป', 'Survey');
    b.title = t('แบบประเมินการใช้งาน', 'Usability survey');
    b.style.cssText = 'position:fixed;left:12px;bottom:14px;z-index:9000;background:#0ea5e9;color:#fff;border:none;border-radius:20px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(14,165,233,0.4);font-family:"IBM Plex Sans Thai",sans-serif;opacity:0.92';
    b.addEventListener('click', show);
    document.body.appendChild(b);
  }

  // Public API + delegated action (e.g. a nav/footer link can use data-action="showSurvey")
  window.IVSurvey = { show: show };
  if (window.IVDrugRef && IVDrugRef.delegate) {
    IVDrugRef.delegate(document, 'click', { showSurvey: function () { show(); } });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Show the trigger unless the user already completed the survey.
    var done = false;
    try { done = !!localStorage.getItem(DONE_KEY); } catch (e) {}
    if (!done) injectTrigger();
  });
})();
