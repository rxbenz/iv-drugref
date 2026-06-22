/* ============================================================
 * Respectful feedback engine — IV DrugRef
 * ------------------------------------------------------------
 * Healthcare users come for URGENT info and won't stop for a form, so we never
 * block the task. Strategy (all opt-in, all dismissible, all capped):
 *   1) Micro 👍/👎 — one tap after the user has had time to get value (dwell),
 *      with optional 1-tap reason chips. → MICRO_FEEDBACK
 *   2) Progressive SUS — ONE SUS item at a time for returning users; answers
 *      accumulate per user across sessions → cohort SUS. → SUS_ITEM
 *   3) Full survey stays available but is NEVER pushed — opened only via
 *      window.IVSurvey.show() / data-action="showSurvey" (e.g. an About link).
 *
 * Respect rules (the important part):
 *   • Never on the first visit; never more than ONE prompt per session.
 *   • Global cooldown between prompts (COOLDOWN_DAYS).
 *   • GIVE UP: after GIVEUP_DISMISS dismissals the user is opted out FOREVER.
 *   • Never re-ask something already answered (micro once; SUS skips done items).
 *   • Only appears after real dwell + interaction, anchored bottom-center,
 *     clear of the FAB, below modals. One tap to answer, one to dismiss.
 * ============================================================ */
(function () {
  'use strict';

  var LS = 'ivdrug_fb';
  var SS_COUNTED = 'ivdrug_fb_counted';   // session counted (sessionStorage)
  var SS_SHOWN = 'ivdrug_fb_shown';       // a prompt already shown this session

  var COOLDOWN_DAYS = 3;
  var MICRO_MIN_SESSION = 2;   // don't ask micro before the 2nd session
  var SUS_MIN_SESSION = 3;     // SUS only for returning users
  var GIVEUP_DISMISS = 2;      // dismiss this many times → opt out forever
  var DWELL_MS = 25000;        // wait until the user has likely gotten value

  function t(th, en) {
    var lang = (window.IVDrugRefI18n && IVDrugRefI18n.getCurrentLang && IVDrugRefI18n.getCurrentLang()) || 'th';
    return lang === 'en' ? en : th;
  }
  function page() {
    return (window.IVDrugRef && IVDrugRef.currentPage && IVDrugRef.currentPage()) ||
      (location.pathname.split('/').pop() || 'index').replace('.html', '') || 'index';
  }

  // ── state ──
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }

  function countSessionOnce() {
    try { if (sessionStorage.getItem(SS_COUNTED)) return; sessionStorage.setItem(SS_COUNTED, '1'); } catch (e) {}
    var s = load(); s.sessions = (s.sessions || 0) + 1; save(s);
  }
  function shownThisSession() { try { return !!sessionStorage.getItem(SS_SHOWN); } catch (e) { return false; } }
  function markShown() { try { sessionStorage.setItem(SS_SHOWN, '1'); } catch (e) {} }

  function send(payload) { if (window.IVDrugRef && IVDrugRef.sendAnalytics) IVDrugRef.sendAnalytics(payload); }

  // ── SUS items (standard, alternating) — shared with the full survey ──
  var SUS = [
    ['ฉันคิดว่าจะใช้แอปนี้บ่อย', 'I would use this app frequently'],
    ['ฉันรู้สึกว่าแอปซับซ้อนเกินไป', 'I found the app unnecessarily complex'],
    ['ฉันคิดว่าแอปใช้งานง่าย', 'I thought the app was easy to use'],
    ['ฉันคิดว่าต้องมีผู้เชี่ยวชาญช่วยจึงจะใช้ได้', 'I would need support to use this app'],
    ['ฉันรู้สึกว่าฟังก์ชันต่าง ๆ ทำงานสอดคล้องกันดี', 'The functions were well integrated'],
    ['ฉันคิดว่าแอปมีความไม่สอดคล้องมากเกินไป', 'There was too much inconsistency'],
    ['ฉันคิดว่าคนส่วนใหญ่จะเรียนรู้แอปนี้ได้เร็ว', 'Most people would learn this very quickly'],
    ['ฉันรู้สึกว่าแอปใช้งานยุ่งยาก', 'I found the app very cumbersome'],
    ['ฉันรู้สึกมั่นใจเวลาใช้แอป', 'I felt very confident using the app'],
    ['ฉันต้องเรียนรู้หลายอย่างก่อนจะใช้แอปได้', 'I needed to learn a lot before I could get going']
  ];

  // ── decide what (if anything) to ask ──
  function chooseType() {
    var s = load();
    if (s.optedOut) return null;
    if (shownThisSession()) return null;
    var now = Date.now();
    if (s.lastPromptTs && (now - s.lastPromptTs) < COOLDOWN_DAYS * 86400000) return null;
    var sess = s.sessions || 0;
    if (!s.microDone && sess >= MICRO_MIN_SESSION) return 'micro';
    var done = s.sus || {};
    if (sess >= SUS_MIN_SESSION && Object.keys(done).length < SUS.length) return 'sus';
    return null;
  }
  function nextSusIndex() {
    var done = (load().sus) || {};
    for (var i = 0; i < SUS.length; i++) if (done[i] === undefined) return i;
    return -1;
  }

  function onDismiss() {
    var s = load();
    s.dismiss = (s.dismiss || 0) + 1;
    s.lastPromptTs = Date.now();
    if (s.dismiss >= GIVEUP_DISMISS) s.optedOut = true; // give up — never ask again
    save(s);
    markShown();
    closeBar();
  }
  function afterAnswer() { var s = load(); s.lastPromptTs = Date.now(); save(s); markShown(); }

  // ── UI shell (bottom-center card, clear of the FAB, below modals) ──
  function shell(inner) {
    closeBar();
    var w = document.createElement('div');
    w.id = 'fbBar';
    w.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9400;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:10px 12px;width:calc(100% - 24px);max-width:380px;font-family:"IBM Plex Sans Thai",sans-serif;animation:fbUp .25s ease';
    w.innerHTML = inner;
    document.body.appendChild(w);
    if (!document.getElementById('fbKeyframes')) {
      var st = document.createElement('style'); st.id = 'fbKeyframes';
      st.textContent = '@keyframes fbUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}';
      document.head.appendChild(st);
    }
    return w;
  }
  function closeBar() { var b = document.getElementById('fbBar'); if (b) b.remove(); }
  function xBtn() {
    return '<button data-fb-x aria-label="close" style="border:none;background:transparent;color:#94a3b8;font-size:18px;cursor:pointer;padding:0 4px;line-height:1">×</button>';
  }
  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#059669;color:#fff;padding:9px 16px;border-radius:18px;font-size:13px;z-index:9500;font-family:"IBM Plex Sans Thai",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }

  // ── Micro 👍/👎 ──
  function showMicro() {
    var w = shell(
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="flex:1;font-size:13px;color:#0f172a">' + t('ข้อมูลนี้มีประโยชน์ไหม?', 'Was this helpful?') + '</span>' +
        '<button data-fb-up style="border:none;background:#ecfdf5;border-radius:10px;padding:6px 12px;font-size:18px;cursor:pointer">👍</button>' +
        '<button data-fb-down style="border:none;background:#fef2f2;border-radius:10px;padding:6px 12px;font-size:18px;cursor:pointer">👎</button>' +
        xBtn() + '</div>');
    w.addEventListener('click', function (e) {
      if (e.target.closest('[data-fb-x]')) { onDismiss(); return; }
      if (e.target.closest('[data-fb-up]')) { microAnswer('up'); }
      else if (e.target.closest('[data-fb-down]')) { microReasons(); }
    });
  }
  function microReasons() {
    var reasons = [
      ['notfound', t('หาข้อมูลไม่เจอ', 'Couldn’t find it')],
      ['incomplete', t('ข้อมูลไม่ครบ', 'Incomplete')],
      ['hard', t('ใช้งานยาก', 'Hard to use')],
      ['slow', t('ช้า/มีปัญหา', 'Slow / buggy')]
    ];
    var chips = reasons.map(function (r) {
      return '<button data-fb-reason="' + r[0] + '" style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:14px;padding:6px 10px;font-size:12px;cursor:pointer;color:#0f172a">' + r[1] + '</button>';
    }).join('');
    var w = shell(
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:13px;color:#0f172a">' + t('ติดตรงไหนครับ? (ไม่บังคับ)', 'What went wrong? (optional)') + '</span>' + xBtn() + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + chips + '</div>');
    w.addEventListener('click', function (e) {
      if (e.target.closest('[data-fb-x]')) { microAnswer('down', ''); return; } // still record the 👎
      var c = e.target.closest('[data-fb-reason]');
      if (c) microAnswer('down', c.getAttribute('data-fb-reason'));
    });
  }
  function microAnswer(rating, reason) {
    var s = load(); s.microDone = true; s.micro = { rating: rating, reason: reason || '', ts: Date.now() }; save(s);
    afterAnswer();
    send({ type: 'MICRO_FEEDBACK', rating: rating, reason: reason || '', page: page(), context: 'dwell' });
    // Route engaged users to the optional full survey — never forced.
    var w = shell('<div style="font-size:13px;color:#0f172a">' + t('ขอบคุณครับ 🙏 ', 'Thanks 🙏 ') +
      '<a href="#" data-fb-full style="color:#0ea5e9;font-weight:600;text-decoration:none">' + t('ให้ความเห็นเพิ่ม', 'Tell us more') + '</a></div>');
    w.addEventListener('click', function (e) { if (e.target.closest('[data-fb-full]')) { e.preventDefault(); closeBar(); show(); } });
    setTimeout(closeBar, 4000);
  }

  // ── Progressive SUS (one item) ──
  function showSus() {
    var idx = nextSusIndex();
    if (idx < 0) return;
    var scale = '';
    for (var i = 1; i <= 5; i++) scale += '<button data-sus-score="' + i + '" style="flex:1;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:8px 0;font-size:14px;cursor:pointer;color:#0f172a">' + i + '</button>';
    var w = shell(
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">' +
        '<span style="font-size:13px;color:#0f172a;line-height:1.35">' + t(SUS[idx][0], SUS[idx][1]) + '</span>' + xBtn() + '</div>' +
      '<div style="display:flex;gap:6px">' + scale + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:3px"><span>' + t('ไม่เห็นด้วย', 'Disagree') + '</span><span>' + t('เห็นด้วย', 'Agree') + '</span></div>');
    w.addEventListener('click', function (e) {
      if (e.target.closest('[data-fb-x]')) { onDismiss(); return; }
      var b = e.target.closest('[data-sus-score]');
      if (b) susAnswer(idx, parseInt(b.getAttribute('data-sus-score')));
    });
  }
  function susAnswer(idx, score) {
    var s = load(); s.sus = s.sus || {}; s.sus[idx] = score; save(s);
    afterAnswer();
    send({ type: 'SUS_ITEM', item_index: idx, score: score, page: page() });
    closeBar();
    toast(t('ขอบคุณครับ 🙏', 'Thanks 🙏'));
  }

  // ── dwell trigger (only after real interaction) ──
  var interacted = false;
  function markInteract() { interacted = true; }

  function maybePrompt() {
    if (document.visibilityState !== 'visible' || !interacted) {
      // try again shortly once the user is back / has interacted
      setTimeout(maybePrompt, 8000); return;
    }
    var type = chooseType();
    if (type === 'micro') showMicro();
    else if (type === 'sus') showSus();
  }

  // ── full survey (optional, never pushed) — kept lightweight ──
  var ROLES = [['pharmacist', 'เภสัชกร', 'Pharmacist'], ['physician', 'แพทย์', 'Physician'], ['nurse', 'พยาบาล', 'Nurse'], ['student', 'นักศึกษา', 'Student'], ['other', 'อื่น ๆ', 'Other']];
  var SAT = [
    ['sat_1_easy_to_find', 'ค้นหายาได้ง่าย', 'Easy to find drugs'],
    ['sat_2_accurate', 'ข้อมูลถูกต้องน่าเชื่อถือ', 'Information is accurate'],
    ['sat_3_faster', 'ช่วยให้ทำงานเร็วขึ้น', 'Helps me work faster'],
    ['sat_4_recommend', 'จะแนะนำเพื่อนร่วมงาน', 'I would recommend it'],
    ['sat_5_overall', 'ความพึงพอใจโดยรวม', 'Overall satisfaction']
  ];
  function likert(name, label) {
    var c = '';
    for (var i = 1; i <= 5; i++) c += '<label style="flex:1;text-align:center;cursor:pointer;font-size:13px"><input type="radio" name="' + name + '" value="' + i + '" style="display:block;margin:0 auto 2px"> ' + i + '</label>';
    return '<div style="margin:9px 0"><div style="font-size:13px;color:#1e293b;margin-bottom:4px">' + label + '</div><div style="display:flex;gap:4px">' + c + '</div></div>';
  }
  function val(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? parseInt(el.value) : null; }

  function show() {
    if (document.getElementById('surveyOverlay')) return;
    var roleOpts = ROLES.map(function (r) { return '<option value="' + r[0] + '">' + t(r[1], r[2]) + '</option>'; }).join('');
    var satHtml = SAT.map(function (s) { return likert(s[0], t(s[1], s[2])); }).join('');
    var susHtml = SUS.map(function (s, i) { return likert('fsus_' + i, (i + 1) + '. ' + t(s[0], s[1])); }).join('');
    var o = document.createElement('div');
    o.id = 'surveyOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;font-family:"IBM Plex Sans Thai",sans-serif';
    o.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;max-height:90vh;width:100%;max-width:560px;overflow-y:auto;padding:20px">' +
      '<div style="width:36px;height:4px;background:#cbd5e1;border-radius:2px;margin:0 auto 14px"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0">📋 ' + t('แบบประเมินการใช้งาน', 'Usability Survey') + '</h3><button data-survey-close style="width:32px;height:32px;border:none;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:18px;cursor:pointer">×</button></div>' +
      '<p style="font-size:12px;color:#64748b;margin:0 0 14px">' + t('ขอบคุณที่สละเวลา ~2 นาที เพื่อพัฒนาแอปและงานวิจัย', 'Thanks for ~2 min to improve the app & our research') + '</p>' +
      '<div style="display:flex;gap:10px;margin-bottom:8px"><div style="flex:1"><label style="font-size:12px;color:#475569">' + t('บทบาท', 'Role') + '</label><select id="svRole" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">' + roleOpts + '</select></div><div style="flex:1"><label style="font-size:12px;color:#475569">' + t('หน่วยงาน', 'Department') + '</label><input id="svDept" type="text" placeholder="' + t('เช่น OPD, ICU', 'e.g. OPD, ICU') + '" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px"></div></div>' +
      '<div style="font-weight:600;font-size:14px;color:#0f172a;margin:14px 0 2px">⭐ ' + t('ความพึงพอใจ (1=น้อย, 5=มาก)', 'Satisfaction (1=low, 5=high)') + '</div>' + satHtml +
      '<div style="font-weight:600;font-size:14px;color:#0f172a;margin:16px 0 2px">📊 ' + t('SUS (1=ไม่เห็นด้วย, 5=เห็นด้วย)', 'SUS (1=disagree, 5=agree)') + '</div>' + susHtml +
      '<div style="margin:12px 0"><label style="font-size:12px;color:#475569">' + t('ความคิดเห็นเพิ่มเติม', 'Comments') + '</label><textarea id="svComment" rows="2" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;resize:vertical"></textarea></div>' +
      '<div id="svErr" style="display:none;color:#dc2626;font-size:12px;margin-bottom:6px"></div>' +
      '<button data-survey-submit style="width:100%;padding:13px;background:#0ea5e9;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer">' + t('ส่งแบบประเมิน', 'Submit') + '</button></div>';
    o.addEventListener('click', function (e) {
      if (e.target === o || e.target.closest('[data-survey-close]')) o.remove();
      else if (e.target.closest('[data-survey-submit]')) submitFull();
    });
    document.body.appendChild(o);
  }
  function submitFull() {
    var sat = {}, any = false;
    SAT.forEach(function (s) { var v = val(s[0]); sat[s[0]] = (v == null ? '' : v); if (v != null) any = true; });
    if (!any) { var e = document.getElementById('svErr'); if (e) { e.textContent = t('กรุณาให้คะแนนอย่างน้อย 1 ข้อ', 'Please rate at least one item'); e.style.display = 'block'; } return; }
    var sv = SUS.map(function (_, i) { return val('fsus_' + i); }), sus = '';
    if (sv.every(function (v) { return v != null; })) { var sum = 0; sv.forEach(function (v, i) { sum += (i % 2 === 0) ? (v - 1) : (5 - v); }); sus = sum * 2.5; }
    var p = { type: 'SURVEY', role: (document.getElementById('svRole') || {}).value || '', department: ((document.getElementById('svDept') || {}).value || '').trim(), sus_score: sus, comment: ((document.getElementById('svComment') || {}).value || '').trim() };
    SAT.forEach(function (s) { p[s[0]] = sat[s[0]]; });
    send(p);
    var s2 = load(); s2.fullDone = true; save(s2);
    var o = document.getElementById('surveyOverlay'); if (o) o.remove();
    toast(t('ขอบคุณสำหรับการประเมิน 🙏', 'Thank you 🙏'));
  }

  // ── public API + wiring ──
  window.IVSurvey = { show: show };
  window.IVFeedback = { state: load, micro: showMicro };
  if (window.IVDrugRef && IVDrugRef.delegate) IVDrugRef.delegate(document, 'click', { showSurvey: function () { show(); } });

  document.addEventListener('DOMContentLoaded', function () {
    countSessionOnce();
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, markInteract, { once: true, passive: true });
    });
    // Only arm the dwell timer if there's actually something eligible to ask.
    if (chooseType()) setTimeout(maybePrompt, DWELL_MS);
  });
})();
