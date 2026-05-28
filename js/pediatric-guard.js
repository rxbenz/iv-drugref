/**
 * IV DrugRef — Pediatric Safety Guard Module
 *
 * Centralized logic for blocking or warning when adult-only clinical
 * decision support is invoked for pediatric patients.
 *
 * Bayesian PK models (Buelga, Roberts, Goti, Adane, Bourguignon) are
 * derived from adult cohorts and are NOT validated for ages <18.
 * Drug-dosing thresholds in calculator/renal-dosing assume adult
 * absolute CrCl (mL/min) and may mis-classify pediatric eGFR
 * (Schwartz, mL/min/1.73m²).
 *
 * Patient safety module — modify with extreme caution.
 */

(function() {
  'use strict';

  var VERSION = '5.9.3';

  // ── Context identifiers (string constants) ──────────────
  var CONTEXTS = {
    VANCO_BAYESIAN: 'vanco-bayesian',
    AMINOGLYCOSIDE_BAYESIAN: 'aminoglycoside-bayesian',
    PHENYTOIN_BAYESIAN: 'phenytoin-bayesian',
    VALPROATE_BAYESIAN: 'valproate-bayesian',
    DIGOXIN_BAYESIAN: 'digoxin-bayesian',
    TACROLIMUS_BAYESIAN: 'tacrolimus-bayesian',
    WARFARIN_BAYESIAN: 'warfarin-bayesian',
    CALCULATOR_DOSING: 'calculator-dosing',
    RENAL_DOSING: 'renal-dosing'
  };

  var SEVERITY = {
    BLOCK: 'block',
    WARN: 'warn'
  };

  var BLOCK_CONTEXTS = [
    CONTEXTS.VANCO_BAYESIAN,
    CONTEXTS.AMINOGLYCOSIDE_BAYESIAN,
    CONTEXTS.PHENYTOIN_BAYESIAN,
    CONTEXTS.VALPROATE_BAYESIAN,
    CONTEXTS.DIGOXIN_BAYESIAN,
    CONTEXTS.TACROLIMUS_BAYESIAN,
    CONTEXTS.WARFARIN_BAYESIAN
  ];

  var WARN_CONTEXTS = [
    CONTEXTS.CALCULATOR_DOSING,
    CONTEXTS.RENAL_DOSING
  ];

  // ── Bilingual text ──────────────────────────────────────
  // Keyed by [language][template-id]
  var TEXT = {
    th: {
      block_infant_title: '⛔ ไม่สามารถใช้ในทารก (อายุ &lt;1 ปี)',
      block_infant_body: 'ทั้ง Bedside Schwartz และ Cockcroft-Gault ไม่ valid ในเด็กอายุน้อยกว่า 1 ปี ค่า SCr และ muscle mass แตกต่างจากเด็กโตอย่างมาก',
      block_infant_rec: '📌 ปรึกษาเภสัชกร neonatal/pediatric หรือใช้ Schwartz-Lyon equation พร้อม body length สำหรับ neonates',
      block_bayesian_title: '⛔ ไม่สามารถใช้ Bayesian TDM นี้ในเด็กได้',
      block_bayesian_body: 'Population PK models ในหน้านี้ (Buelga 2005, Roberts 2011, Goti 2018, Adane 2015, Bourguignon 2016) validate ในผู้ใหญ่เท่านั้น — ไม่เหมาะสำหรับผู้ป่วยอายุน้อยกว่า 18 ปี',
      block_bayesian_rec: '📌 แนะนำให้ปรึกษาเภสัชกรเด็ก หรือใช้ pediatric TDM software (เช่น InsightRx, DoseMeRx Pediatric, PrecisePK Peds) ที่มี pediatric model',
      warn_calculator_title: '⚠ คำเตือน: ผู้ป่วยอายุน้อยกว่า 18 ปี',
      warn_calculator_body: 'Drug-dosing thresholds ในหน้านี้ออกแบบสำหรับผู้ใหญ่ (CrCl absolute mL/min) — ค่า eGFR ที่คำนวณด้วย Schwartz (mL/min/1.73m²) อาจไม่ตรงกับ adult thresholds โดยตรง',
      warn_calculator_rec: '📌 ตรวจสอบ dose กับ pediatric reference (Lexicomp Pediatric, Harriet Lane, Red Book) ก่อนใช้',
      warn_renal_title: '⚠ คำเตือน: ผู้ป่วยอายุน้อยกว่า 18 ปี',
      warn_renal_body: 'Renal dose-adjustment tables ในหน้านี้อ้างอิง adult CrCl (CG/CKD-EPI) — ค่า eGFR pediatric (Schwartz) ไม่สามารถใช้กับ adult threshold ได้โดยตรง',
      warn_renal_rec: '📌 ใช้ KDIGO pediatric guidelines หรือปรึกษาเภสัชกรเด็กก่อนปรับ dose',
      patient_info_label: 'ผู้ป่วย:'
    },
    en: {
      block_infant_title: '⛔ Not available for infants (age &lt;1 yr)',
      block_infant_body: 'Both Bedside Schwartz and Cockcroft-Gault are not validated below 1 year of age — SCr and muscle mass differ substantially from older children.',
      block_infant_rec: '📌 Consult a neonatal/pediatric pharmacist, or use Schwartz-Lyon with body length for neonates.',
      block_bayesian_title: '⛔ This Bayesian TDM is not available for pediatric patients',
      block_bayesian_body: 'Population PK models on this page (Buelga 2005, Roberts 2011, Goti 2018, Adane 2015, Bourguignon 2016) are validated in adults only — not suitable for patients under 18.',
      block_bayesian_rec: '📌 Refer to a pediatric pharmacist, or use pediatric-validated TDM software (e.g., InsightRx, DoseMeRx Pediatric, PrecisePK Peds).',
      warn_calculator_title: '⚠ Warning: pediatric patient (age <18)',
      warn_calculator_body: 'Drug-dosing thresholds on this page were designed for adults (absolute CrCl mL/min). Schwartz eGFR (mL/min/1.73m²) may not map directly to these thresholds.',
      warn_calculator_rec: '📌 Verify dose against a pediatric reference (Lexicomp Pediatric, Harriet Lane, Red Book) before use.',
      warn_renal_title: '⚠ Warning: pediatric patient (age <18)',
      warn_renal_body: 'Renal dose-adjustment tables on this page reference adult CrCl (CG/CKD-EPI). Pediatric Schwartz eGFR cannot be applied directly to adult thresholds.',
      warn_renal_rec: '📌 Use KDIGO pediatric guidelines or consult a pediatric pharmacist before adjusting dose.',
      patient_info_label: 'Patient:'
    }
  };

  // ── Throttle state for analytics (per-context) ──────────
  var _lastTrackTs = {};
  var TRACK_THROTTLE_MS = 5000;

  // ── Predicates ─────────────────────────────────────────
  function isPediatric(age) {
    return typeof age === 'number' && isFinite(age) && age >= 1 && age < 18;
  }

  function isInfant(age) {
    return typeof age === 'number' && isFinite(age) && age >= 0 && age < 1;
  }

  // ── Language helper ─────────────────────────────────────
  function getLang() {
    try {
      if (window.IVDrugRefI18n && typeof window.IVDrugRefI18n.getCurrentLang === 'function') {
        var l = window.IVDrugRefI18n.getCurrentLang();
        return TEXT[l] ? l : 'th';
      }
    } catch (e) {}
    return 'th';
  }

  function t(key) {
    var lang = getLang();
    return (TEXT[lang] && TEXT[lang][key]) || (TEXT.th[key] || '');
  }

  // ── Core: getGuardStatus ────────────────────────────────
  function getGuardStatus(pt, context) {
    if (!pt || typeof pt.age !== 'number' || !isFinite(pt.age)) {
      return { blocked: false, severity: null };
    }

    var age = pt.age;

    // Infants: block in every context
    if (isInfant(age)) {
      return {
        blocked: true,
        severity: SEVERITY.BLOCK,
        reason: 'infant',
        context: context,
        titleKey: 'block_infant_title',
        bodyKey: 'block_infant_body',
        recKey: 'block_infant_rec'
      };
    }

    // Pediatric 1–17: depends on context
    if (isPediatric(age)) {
      if (BLOCK_CONTEXTS.indexOf(context) >= 0) {
        return {
          blocked: true,
          severity: SEVERITY.BLOCK,
          reason: 'adult-only-pk-model',
          context: context,
          titleKey: 'block_bayesian_title',
          bodyKey: 'block_bayesian_body',
          recKey: 'block_bayesian_rec'
        };
      }
      if (WARN_CONTEXTS.indexOf(context) >= 0) {
        var isRenal = context === CONTEXTS.RENAL_DOSING;
        return {
          blocked: false,
          severity: SEVERITY.WARN,
          reason: 'adult-thresholds',
          context: context,
          titleKey: isRenal ? 'warn_renal_title' : 'warn_calculator_title',
          bodyKey: isRenal ? 'warn_renal_body' : 'warn_calculator_body',
          recKey: isRenal ? 'warn_renal_rec' : 'warn_calculator_rec'
        };
      }
    }

    return { blocked: false, severity: null };
  }

  // ── DOM rendering ───────────────────────────────────────
  function renderBanner(container, status, pt) {
    if (!container) return;
    if (!status || !status.severity) {
      hideBanner(container);
      return;
    }

    var sev = status.severity; // 'block' or 'warn'
    var boxCls = sev === SEVERITY.BLOCK ? 'red' : 'amber';
    var title = t(status.titleKey);
    var body = t(status.bodyKey);
    var rec = t(status.recKey);

    var ptLine = '';
    if (pt && typeof pt.age === 'number') {
      var ptLabel = t('patient_info_label');
      var parts = [];
      parts.push('age ' + pt.age);
      if (pt.wt) parts.push(pt.wt + ' kg');
      if (pt.ht) parts.push(pt.ht + ' cm');
      if (pt.scr) parts.push('SCr ' + pt.scr);
      ptLine = '<div style="font-size:11px;opacity:.8;margin-top:6px"><strong>' +
        ptLabel + '</strong> ' + parts.join(', ') + '</div>';
    }

    container.innerHTML =
      '<div class="info-box ' + boxCls + ' pediatric-guard-banner" ' +
      'role="alert" aria-live="assertive" ' +
      'style="padding:12px;border-width:2px;border-style:solid;margin:12px 0;font-size:12px;line-height:1.55">' +
        '<div style="font-weight:700;font-size:13px;margin-bottom:6px">' + title + '</div>' +
        '<div>' + body + '</div>' +
        '<div style="margin-top:8px">' + rec + '</div>' +
        ptLine +
      '</div>';
    container.style.display = 'block';
    container.setAttribute('data-guard-active', '1');
    container.setAttribute('data-guard-severity', sev);
  }

  function hideBanner(container) {
    if (!container) return;
    container.style.display = 'none';
    container.innerHTML = '';
    container.removeAttribute('data-guard-active');
    container.removeAttribute('data-guard-severity');
  }

  // ── Button enable/disable helpers ───────────────────────
  function setDisabled(el, disabled, reason) {
    if (!el) return;
    if (disabled) {
      el.setAttribute('disabled', 'disabled');
      el.setAttribute('aria-disabled', 'true');
      if (reason) el.setAttribute('title', reason);
      el.style.opacity = '0.45';
      el.style.cursor = 'not-allowed';
    } else {
      el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('title');
      el.style.opacity = '';
      el.style.cursor = '';
    }
  }

  function disableButtons(selectors, reason) {
    if (!selectors || !selectors.length) return;
    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j++) setDisabled(nodes[j], true, reason);
    }
  }

  function enableButtons(selectors) {
    if (!selectors || !selectors.length) return;
    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j++) setDisabled(nodes[j], false);
    }
  }

  // ── Analytics ───────────────────────────────────────────
  function trackBlockedAttempt(context, pt, status) {
    var now = Date.now();
    var key = context + ':' + (status && status.severity);
    if (_lastTrackTs[key] && (now - _lastTrackTs[key]) < TRACK_THROTTLE_MS) return;
    _lastTrackTs[key] = now;

    try {
      if (!window.IVDrugRef || typeof window.IVDrugRef.sendAnalytics !== 'function') return;
      // Payload follows the GAS receiver convention: routed by `type`, and
      // session_id/user_id are added by IVDrugRef.sendAnalytics() enrichment.
      window.IVDrugRef.sendAnalytics({
        type: 'pediatric_guard',
        context: context,
        severity: (status && status.severity) || null,
        reason: (status && status.reason) || null,
        patient_age: pt && typeof pt.age === 'number' ? pt.age : null,
        patient_weight: pt && typeof pt.wt === 'number' ? pt.wt : null,
        patient_height: pt && typeof pt.ht === 'number' ? pt.ht : null,
        patient_scr: pt && typeof pt.scr === 'number' ? pt.scr : null,
        patient_sex: pt && typeof pt.sex === 'string' ? pt.sex : null,
        app_version: VERSION
      });
    } catch (e) { /* silent */ }
  }

  // ── Convenience: evaluate + render + return blocked flag ─
  // Returns true when caller should ABORT (i.e., status.blocked).
  // Always renders banner state (block, warn, or clear).
  function enforce(pt, context, opts) {
    opts = opts || {};
    var status = getGuardStatus(pt, context);
    var container = opts.banner;
    if (typeof container === 'string') container = document.getElementById(container);

    if (status.severity) {
      renderBanner(container, status, pt);
      if (opts.disableSelectors) disableButtons(opts.disableSelectors, t(status.titleKey));
      if (status.blocked) {
        trackBlockedAttempt(context, pt, status);
        return true;
      }
      // Warn-only: also report analytics (single-shot per throttle window)
      trackBlockedAttempt(context, pt, status);
      return false;
    }

    hideBanner(container);
    if (opts.disableSelectors) enableButtons(opts.disableSelectors);
    return false;
  }

  // ── Public API ──────────────────────────────────────────
  var api = {
    VERSION: VERSION,
    CONTEXTS: CONTEXTS,
    SEVERITY: SEVERITY,
    isPediatric: isPediatric,
    isInfant: isInfant,
    getGuardStatus: getGuardStatus,
    renderBanner: renderBanner,
    hideBanner: hideBanner,
    disableButtons: disableButtons,
    enableButtons: enableButtons,
    trackBlockedAttempt: trackBlockedAttempt,
    enforce: enforce
  };

  if (typeof window !== 'undefined') {
    window.PediatricGuard = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
