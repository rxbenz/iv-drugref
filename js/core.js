// ============================================================
// IV DrugRef PWA v5.0 — Core Utilities
// Shared across all pages
// ============================================================

/* global window */
'use strict';

var IVDrugRef = (function() {

  // ============================================================
  // PATIENT INPUT VALIDATION
  // ============================================================

  /**
   * Clinical validation rules for patient parameters.
   * Two tiers: "error" = impossible/dangerous value (blocks calculation),
   *            "warn"  = unusual but possible (shows warning, allows calculation).
   */
  var VALIDATION_RULES = {
    age: {
      label: 'อายุ',
      unit: 'ปี',
      error: { min: 0.1, max: 120, msg: 'อายุต้องอยู่ระหว่าง 0–120 ปี' },
      warn: [
        { test: function(v) { return v > 100; }, msg: 'อายุ >100 ปี — กรุณาตรวจสอบ' },
        { test: function(v) { return v < 1; }, msg: 'อายุ <1 ปี — กรุณาตรวจสอบสูตรคำนวณ' }
      ]
    },
    wt: {
      label: 'น้ำหนัก',
      unit: 'kg',
      error: { min: 0.3, max: 500, msg: 'น้ำหนักต้องอยู่ระหว่าง 0.3–500 kg' },
      warn: [
        { test: function(v) { return v > 300; }, msg: 'น้ำหนัก >300 kg — กรุณาตรวจสอบ' },
        { test: function(v) { return v < 3; }, msg: 'น้ำหนัก <3 kg — ตรวจสอบหน่วย (kg)' }
      ]
    },
    scr: {
      label: 'SCr',
      unit: 'mg/dL',
      error: { min: 0.05, max: 50, msg: 'SCr ต้องอยู่ระหว่าง 0.05–50 mg/dL' },
      warn: [
        { test: function(v) { return v > 15; }, msg: 'SCr >15 — ค่าสูงมาก กรุณาตรวจสอบ' },
        { test: function(v) { return v < 0.2; }, msg: 'SCr <0.2 — ค่าต่ำผิดปกติ อาจทำให้ CrCl สูงเกินจริง' }
      ]
    },
    ht: {
      label: 'ส่วนสูง',
      unit: 'cm',
      error: { min: 20, max: 260, msg: 'ส่วนสูงต้องอยู่ระหว่าง 20–260 cm' },
      warn: [
        { test: function(v) { return v > 220; }, msg: 'ส่วนสูง >220 cm — กรุณาตรวจสอบ' },
        { test: function(v) { return v < 40; }, msg: 'ส่วนสูง <40 cm — กรุณาตรวจสอบ' }
      ]
    }
  };

  /**
   * Validate a single patient parameter.
   * @param {string} field - Field key (age, wt, scr, ht)
   * @param {number} value - The value to validate
   * @returns {Object} { valid: bool, level: 'ok'|'warn'|'error', messages: string[] }
   */
  function validateField(field, value) {
    var rule = VALIDATION_RULES[field];
    if (!rule) return { valid: true, level: 'ok', messages: [] };

    var messages = [];

    // Check for NaN / empty
    if (value === null || value === undefined || isNaN(value)) {
      return { valid: false, level: 'error', messages: [rule.label + ' — กรุณาระบุค่า'] };
    }

    // Hard error range
    var er = rule.error;
    if (value < er.min || value > er.max) {
      return { valid: false, level: 'error', messages: [er.msg] };
    }

    // Warnings
    var level = 'ok';
    for (var i = 0; i < rule.warn.length; i++) {
      if (rule.warn[i].test(value)) {
        level = 'warn';
        messages.push(rule.warn[i].msg);
      }
    }

    return { valid: true, level: level, messages: messages };
  }

  /**
   * Validate all patient fields and apply visual feedback to form inputs.
   * @param {Object} values - { age, wt, scr, ht } numeric values
   * @param {Object} fieldIds - Optional custom DOM ID mapping
   * @returns {Object} { allValid: bool, results: { field: validationResult }, errors: string[], warnings: string[] }
   */
  function validatePatientInput(values, fieldIds) {
    var ids = Object.assign({
      age: 'ptAge', wt: 'ptWt', ht: 'ptHt', scr: 'ptScr'
    }, fieldIds || {});

    var results = {};
    var errors = [];
    var warnings = [];
    var allValid = true;

    var fields = ['age', 'wt', 'scr', 'ht'];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var val = values[f];
      var result = validateField(f, val);
      results[f] = result;

      if (!result.valid) {
        allValid = false;
        errors = errors.concat(result.messages);
      } else if (result.level === 'warn') {
        warnings = warnings.concat(result.messages);
      }

      // Apply visual feedback to DOM element
      var el = document.getElementById(ids[f]);
      if (el) {
        el.classList.remove('input-error', 'input-warn');
        if (result.level === 'error') {
          el.classList.add('input-error');
        } else if (result.level === 'warn') {
          el.classList.add('input-warn');
        }
      }
    }

    return { allValid: allValid, results: results, errors: errors, warnings: warnings };
  }

  /**
   * Render validation messages into a target container element.
   * @param {string} containerId - DOM ID of the container
   * @param {Object} validation - Result from validatePatientInput()
   */
  function renderValidationMessages(containerId, validation) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Clear safely
    while (container.firstChild) container.removeChild(container.firstChild);

    if (validation.errors.length === 0 && validation.warnings.length === 0) {
      container.style.display = 'none';
      return;
    }

    function buildMsg(text, level) {
      return dom('div', { className: 'validation-msg validation-' + level }, [
        dom('span', { className: 'v-icon', textContent: level === 'error' ? '!' : '?' }),
        dom('span', { textContent: text })
      ]);
    }

    for (var i = 0; i < validation.errors.length; i++) {
      container.appendChild(buildMsg(validation.errors[i], 'error'));
    }
    for (var j = 0; j < validation.warnings.length; j++) {
      container.appendChild(buildMsg(validation.warnings[j], 'warn'));
    }

    container.style.display = 'flex';
  }


  // ============================================================
  // CLINICAL CALCULATORS
  // ============================================================

  /**
   * Ideal Body Weight (Devine formula)
   * @param {number} ht - Height in cm
   * @param {string} sex - 'M' or 'F'
   * @returns {number} IBW in kg
   */
  function calcIBW(ht, sex) {
    if (!ht || ht <= 0) return 0;
    const htIn = ht / 2.54;
    return sex === 'M' ? 50 + 2.3 * (htIn - 60) : 45.5 + 2.3 * (htIn - 60);
  }

  /**
   * Adjusted Body Weight (for obesity)
   * @param {number} wt - Actual weight in kg
   * @param {number} ibw - Ideal body weight in kg
   * @returns {number} ABW in kg
   */
  function calcABW(wt, ibw) {
    // Guard: if actual weight < IBW, ABW formula can produce inappropriate values
    // In clinical practice, use actual weight when wt < IBW
    if (wt <= 0 || ibw <= 0) return wt || 0;
    if (wt < ibw) return wt; // No adjustment needed if underweight
    return ibw + 0.4 * (wt - ibw);
  }

  /**
   * Body Mass Index
   * @param {number} wt - Weight in kg
   * @param {number} ht - Height in cm
   * @returns {number} BMI in kg/m²
   */
  function calcBMI(wt, ht) {
    if (!ht || ht <= 0) return 0;
    return wt / ((ht / 100) ** 2);
  }

  /**
   * Body Surface Area (Mosteller formula)
   * @param {number} ht - Height in cm
   * @param {number} wt - Weight in kg
   * @returns {number} BSA in m²
   */
  function calcBSA(ht, wt) {
    if (!ht || !wt || ht <= 0 || wt <= 0) return 0;
    return Math.sqrt((ht * wt) / 3600);
  }

  /**
   * Cockcroft-Gault CrCl with automatic weight adjustment
   * Uses ABW if patient is obese (>130% IBW)
   * @param {number} age - Age in years
   * @param {number} wt - Actual weight in kg
   * @param {number} scr - Serum creatinine in mg/dL
   * @param {string} sex - 'M' or 'F'
   * @param {number} ht - Height in cm (optional, used for obesity adjustment)
   * @returns {number} CrCl in mL/min, minimum 5
   */
  function calcCockcroftGault(age, wt, scr, sex, ht) {
    if (scr <= 0) return 0;
    let useWt = wt;
    if (ht && ht > 0) {
      const ibw = calcIBW(ht, sex);
      if (wt > ibw * 1.3) useWt = calcABW(wt, ibw); // ABW for obese
    }
    let crcl = ((140 - age) * useWt) / (72 * scr);
    if (sex === 'F') crcl *= 0.85;
    return Math.max(Math.round(crcl * 10) / 10, 5);
  }

  /**
   * Cockcroft-Gault with raw TBW (no obesity adjustment)
   * Used for comparison and non-adjusted dosing
   * @param {number} age - Age in years
   * @param {number} wt - Actual weight in kg
   * @param {number} scr - Serum creatinine in mg/dL
   * @param {string} sex - 'M' or 'F'
   * @returns {number} CrCl in mL/min
   */
  function calcCG_raw(age, wt, scr, sex) {
    if (scr <= 0) return 0;
    let crcl = ((140 - age) * wt) / (72 * scr);
    if (sex === 'F') crcl *= 0.85;
    return Math.round(crcl * 10) / 10;
  }

  /**
   * Bedside Schwartz equation (pediatric eGFR)
   * For ages 1-17 years
   * @param {number} ht - Height in cm
   * @param {number} scr - Serum creatinine in mg/dL
   * @returns {number} eGFR in mL/min/1.73m²
   */
  function calcSchwartz(ht, scr) {
    if (scr <= 0 || !ht || ht <= 0) return 0;
    return Math.round((0.413 * ht / scr) * 10) / 10;
  }

  /**
   * CKD-EPI 2021 equation (race-free)
   * Returns indexed eGFR for standardized BSA (1.73m²)
   * @param {number} age - Age in years
   * @param {number} scr - Serum creatinine in mg/dL
   * @param {string} sex - 'M' or 'F'
   * @returns {number} eGFR in mL/min/1.73m²
   */
  function calcCKDEPI2021(age, scr, sex) {
    let eGFR;
    if (sex === 'F') {
      const kappa = 0.7;
      const alpha = scr <= kappa ? -0.241 : -1.2;
      eGFR = 142 * Math.pow(Math.min(scr / kappa, 1), alpha)
        * Math.pow(Math.max(scr / kappa, 1), -1.2)
        * Math.pow(0.9938, age) * 1.012;
    } else {
      const kappa = 0.9;
      const alpha = scr <= kappa ? -0.302 : -1.2;
      eGFR = 142 * Math.pow(Math.min(scr / kappa, 1), alpha)
        * Math.pow(Math.max(scr / kappa, 1), -1.2)
        * Math.pow(0.9938, age);
    }
    return Math.round(eGFR * 10) / 10;
  }

  /**
   * CKD-EPI 2021 de-indexed for drug dosing
   * Converts indexed eGFR to non-indexed using patient BSA
   * Per KDIGO 2024 recommendations for personalized dosing
   * @param {number} age - Age in years
   * @param {number} scr - Serum creatinine in mg/dL
   * @param {string} sex - 'M' or 'F'
   * @param {number} bsa - Body surface area in m²
   * @returns {number} Non-indexed eGFR in mL/min
   */
  function calcCKDEPI2021_nonindexed(age, scr, sex, bsa) {
    const indexed = calcCKDEPI2021(age, scr, sex);
    return Math.round(indexed * bsa / 1.73 * 10) / 10;
  }

  /**
   * Get CKD stage classification from GFR value
   * @param {number} gfr - Glomerular filtration rate in mL/min
   * @returns {Object} Stage info with stage code, Thai label, and CSS class
   */
  function getCKDStage(gfr) {
    // Labels in both Thai (default) and English for i18n support
    var stages = [
      { min: 90, stage: 'G1', label: 'ปกติ/สูง', labelEn: 'Normal/High', cls: 'stage-1' },
      { min: 60, stage: 'G2', label: 'ลดลงเล็กน้อย', labelEn: 'Mildly decreased', cls: 'stage-2' },
      { min: 45, stage: 'G3a', label: 'ลดลงเล็กน้อย-ปานกลาง', labelEn: 'Mildly-moderately decreased', cls: 'stage-3a' },
      { min: 30, stage: 'G3b', label: 'ลดลงปานกลาง-มาก', labelEn: 'Moderately-severely decreased', cls: 'stage-3b' },
      { min: 15, stage: 'G4', label: 'ลดลงมาก', labelEn: 'Severely decreased', cls: 'stage-4' },
      { min: -Infinity, stage: 'G5', label: 'ไตวาย', labelEn: 'Kidney failure', cls: 'stage-5' }
    ];
    for (var i = 0; i < stages.length; i++) {
      if (gfr >= stages[i].min) return stages[i];
    }
    return stages[stages.length - 1];
  }

  /**
   * Build comprehensive patient object from form elements
   * Automatically calculates all derived metrics (IBW, ABW, BMI, BSA, etc.)
   * @param {Object} fieldIds - Optional custom field ID mapping
   * @returns {Object} Complete patient data object
   */
  function getPatientFromForm(fieldIds) {
    // Default field IDs matching standard form layout
    const ids = Object.assign({
      age: 'ptAge', wt: 'ptWt', ht: 'ptHt', sex: 'ptSex', scr: 'ptScr',
      alb: 'ptAlb', dialysis: 'ptDialysis'
    }, fieldIds || {});

    const getVal = (id, def) => {
      const el = document.getElementById(id);
      if (!el) return def;
      const v = parseFloat(el.value);
      return isNaN(v) ? def : v;
    };
    const getStr = (id, def) => {
      const el = document.getElementById(id);
      return el ? el.value : def;
    };

    const age = getVal(ids.age, 55);
    const wt = getVal(ids.wt, 70);
    const ht = getVal(ids.ht, 170);
    const sex = getStr(ids.sex, 'M');
    const scr = getVal(ids.scr, 1.0);
    const alb = getVal(ids.alb, 4.0);
    const dialysis = getStr(ids.dialysis, 'none');

    // Run validation and apply visual feedback
    const validation = validatePatientInput(
      { age: age, wt: wt, scr: scr, ht: ht },
      { age: ids.age, wt: ids.wt, scr: ids.scr, ht: ids.ht }
    );

    const ibw = Math.round(calcIBW(ht, sex) * 10) / 10;
    const abw = Math.round(calcABW(wt, ibw) * 10) / 10;
    const bmi = Math.round(calcBMI(wt, ht) * 10) / 10;
    const bsa = Math.round(calcBSA(ht, wt) * 100) / 100;
    const isObese = wt > ibw * 1.3;
    const isUnderweight = wt < ibw;
    const isPediatric = age < 18;

    // Calculate renal function (CrCl for adults, Schwartz for pediatric)
    let crcl;
    if (isPediatric && ht > 0) {
      crcl = calcSchwartz(ht, scr);
    } else {
      crcl = calcCockcroftGault(age, wt, scr, sex, ht);
    }

    return {
      age, wt, ht, sex, scr, alb, dialysis,
      ibw, abw, bmi, bsa, isObese, isUnderweight, isPediatric,
      crcl,
      validation
    };
  }


  // ============================================================
  // PATIENT CONTEXT PERSISTENCE
  // ============================================================
  var PATIENT_CTX_KEY = 'ivdrug_patientCtx';
  var PATIENT_FIELDS = ['wt', 'age', 'sex', 'scr', 'ht', 'alb', 'dialysis'];
  var PATIENT_FIELD_IDS = { wt: 'ptWt', age: 'ptAge', sex: 'ptSex', scr: 'ptScr', ht: 'ptHt', alb: 'ptAlb', dialysis: 'ptDialysis' };
  var MAX_PATIENTS = 3;

  function _ctxRead() {
    try { return JSON.parse(sessionStorage.getItem(PATIENT_CTX_KEY)) || null; }
    catch(e) { return null; }
  }
  function _ctxWrite(data) {
    try { sessionStorage.setItem(PATIENT_CTX_KEY, JSON.stringify(data)); } catch(e) {}
  }
  function _ctxEnsure() {
    var d = _ctxRead();
    if (!d || !Array.isArray(d.patients)) d = { patients: [], activeIdx: 0 };
    return d;
  }

  /** Collect raw patient values from current form inputs */
  function _collectFormValues() {
    var vals = {};
    for (var i = 0; i < PATIENT_FIELDS.length; i++) {
      var f = PATIENT_FIELDS[i];
      var el = document.getElementById(PATIENT_FIELD_IDS[f]);
      if (!el) continue;
      if (f === 'sex' || f === 'dialysis') vals[f] = el.value;
      else { var v = parseFloat(el.value); if (!isNaN(v)) vals[f] = v; }
    }
    return vals;
  }

  /** Build short label: "♂ 70kg 55y SCr 1.0" */
  function _buildLabel(p) {
    var parts = [];
    if (p.sex) parts.push(p.sex === 'M' ? '\u2642' : '\u2640');
    if (p.wt) parts.push(p.wt + 'kg');
    if (p.age) parts.push(p.age + 'y');
    if (p.scr) parts.push('SCr ' + p.scr);
    if (p.ht) parts.push(p.ht + 'cm');
    return parts.join(' ') || 'Patient';
  }

  var patientCtx = {
    /** Save current form values to active patient slot (or create new) */
    save: function() {
      var vals = _collectFormValues();
      if (!vals.wt && !vals.age && !vals.scr) return; // nothing meaningful
      var d = _ctxEnsure();
      vals.savedAt = Date.now();
      vals.label = _buildLabel(vals);
      if (d.patients.length === 0) {
        vals.id = generateId(8);
        d.patients.push(vals);
        d.activeIdx = 0;
      } else {
        var idx = d.activeIdx;
        vals.id = d.patients[idx].id || generateId(8);
        d.patients[idx] = vals;
      }
      _ctxWrite(d);
      patientCtx.renderBar();
    },

    /** Get active patient data or null */
    load: function() {
      var d = _ctxRead();
      if (!d || !d.patients.length) return null;
      return d.patients[d.activeIdx] || d.patients[0] || null;
    },

    /** Get all patients */
    getAll: function() {
      var d = _ctxRead();
      return d ? d.patients : [];
    },

    /** Get active index */
    getActiveIdx: function() {
      var d = _ctxRead();
      return d ? d.activeIdx : 0;
    },

    /** Add new patient slot (max 3) */
    addNew: function() {
      var d = _ctxEnsure();
      if (d.patients.length >= MAX_PATIENTS) return;
      d.patients.push({ id: generateId(8), label: 'Patient ' + (d.patients.length + 1), savedAt: Date.now() });
      d.activeIdx = d.patients.length - 1;
      _ctxWrite(d);
      patientCtx.fillForm();
      patientCtx.renderBar();
    },

    /** Switch active patient */
    setActive: function(idx) {
      var d = _ctxEnsure();
      if (idx < 0 || idx >= d.patients.length) return;
      // Save current form to old slot first
      var vals = _collectFormValues();
      if (vals.wt || vals.age || vals.scr) {
        vals.savedAt = Date.now();
        vals.label = _buildLabel(vals);
        vals.id = d.patients[d.activeIdx] ? d.patients[d.activeIdx].id : generateId(8);
        d.patients[d.activeIdx] = vals;
      }
      d.activeIdx = idx;
      _ctxWrite(d);
      patientCtx.fillForm();
      patientCtx.renderBar();
    },

    /** Remove one patient */
    remove: function(idx) {
      var d = _ctxEnsure();
      if (idx < 0 || idx >= d.patients.length) return;
      d.patients.splice(idx, 1);
      if (d.activeIdx >= d.patients.length) d.activeIdx = Math.max(0, d.patients.length - 1);
      _ctxWrite(d);
      if (d.patients.length) patientCtx.fillForm();
      patientCtx.renderBar();
    },

    /** Clear all patients */
    clear: function() {
      sessionStorage.removeItem(PATIENT_CTX_KEY);
      patientCtx.renderBar();
    },

    /** Fill form inputs from active patient context */
    fillForm: function() {
      var p = patientCtx.load();
      if (!p) return false;
      var filled = false;
      for (var i = 0; i < PATIENT_FIELDS.length; i++) {
        var f = PATIENT_FIELDS[i];
        if (p[f] === undefined || p[f] === null) continue;
        var el = document.getElementById(PATIENT_FIELD_IDS[f]);
        if (!el) continue;
        el.value = p[f];
        filled = true;
      }
      // Dispatch events to trigger existing recalculation handlers
      if (filled) {
        ['ptWt', 'ptAge', 'ptScr', 'ptHt', 'ptAlb'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        ['ptSex', 'ptDialysis'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
      return filled;
    },

    /** Render patient context bar into #patientCtxBar */
    renderBar: function() {
      var bar = document.getElementById('patientCtxBar');
      if (!bar) return;
      var d = _ctxRead();
      var patients = d ? d.patients : [];
      var activeIdx = d ? d.activeIdx : 0;

      // Clear
      while (bar.firstChild) bar.removeChild(bar.firstChild);

      if (!patients.length) {
        bar.className = 'patient-ctx-bar empty';
        return;
      }

      bar.className = 'patient-ctx-bar';

      // Patient chips
      var chips = dom('div', { className: 'ctx-chips' }, []);
      for (var i = 0; i < patients.length; i++) {
        var p = patients[i];
        var chip = dom('button', {
          className: 'ctx-chip' + (i === activeIdx ? ' active' : ''),
          'data-action': 'ctxSwitch',
          'data-idx': String(i),
          textContent: p.label || ('Patient ' + (i + 1))
        });
        chips.appendChild(chip);
      }
      bar.appendChild(chips);

      // Actions
      var actions = dom('div', { className: 'ctx-actions' }, []);
      if (patients.length < MAX_PATIENTS) {
        actions.appendChild(dom('button', {
          className: 'ctx-btn ctx-add',
          'data-action': 'ctxAdd',
          textContent: '+',
          title: 'เพิ่มผู้ป่วย'
        }));
      }
      actions.appendChild(dom('button', {
        className: 'ctx-btn ctx-clear',
        'data-action': 'ctxClear',
        textContent: 'ล้าง',
        title: 'ล้างข้อมูลผู้ป่วยทั้งหมด'
      }));
      bar.appendChild(actions);
    },

    /** Set up auto-save listener + fill + render bar. Call once on page init. */
    init: function() {
      // Fill from existing context (suppress auto-save during fill)
      var _filling = false;
      var filled = false;

      // Debounced auto-save
      var autoSave = debounce(function() {
        if (!_filling) patientCtx.save();
      }, 500);

      // Attach auto-save to all patient inputs
      PATIENT_FIELDS.forEach(function(f) {
        var el = document.getElementById(PATIENT_FIELD_IDS[f]);
        if (!el) return;
        var evt = (f === 'sex' || f === 'dialysis') ? 'change' : 'input';
        el.addEventListener(evt, autoSave);
      });

      // Fill form from context (before auto-save kicks in)
      _filling = true;
      filled = patientCtx.fillForm();
      _filling = false;

      // If we filled, do an initial save to refresh savedAt
      if (filled) patientCtx.save();

      // Render bar
      patientCtx.renderBar();

      // Event delegation for bar buttons
      var bar = document.getElementById('patientCtxBar');
      if (bar) {
        delegate(bar, 'click', {
          ctxSwitch: function(e, t) { patientCtx.setActive(parseInt(t.dataset.idx, 10)); },
          ctxAdd: function() { patientCtx.addNew(); },
          ctxClear: function() { patientCtx.clear(); }
        });
      }
    }
  };


  // ============================================================
  // ANALYTICS
  // ============================================================
  const ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec';
  const ADMIN_GAS_URL = 'https://script.google.com/macros/s/AKfycbwJhLwY34rKpVVBE4aFRMOee6-lldazO64uOk0EXEA0Yvwgz6SA3kjeWt7-R6BSsNZT/exec';
  let _reqCount = 0;

  /**
   * Get anonymous session ID from localStorage
   * @returns {string} Session ID or empty string
   */
  function getSessionId() {
    return localStorage.getItem('anonSessionId') || '';
  }

  /**
   * Get anonymous user ID from localStorage
   * @returns {string} User ID or empty string
   */
  function getUserId() {
    return localStorage.getItem('anonUserId') || '';
  }

  /**
   * Check if user has consented to analytics
   * @returns {boolean} True if analytics consent is given
   */
  function hasAnalyticsConsent() {
    return true; // Always allow — matches v4.7 behavior
  }

  /**
   * Send analytics event via sendBeacon or fetch
   * Rate limited to 40 requests per page session
   * @param {Object} data - Event data to send
   */
  function sendAnalytics(data) {
    if (!ANALYTICS_URL || !hasAnalyticsConsent()) return;
    if (_reqCount >= 40) return;
    _reqCount++;
    try {
      const payload = JSON.stringify({
        ...data,
        session_id: getSessionId(),
        user_id: getUserId()
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ANALYTICS_URL, payload);
      } else {
        fetch(ANALYTICS_URL, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* silent fail */ }
  }

  /**
   * Track page view with automatic entry/exit timing
   * Sends page_view events on entry and exit with duration
   * @param {string} pageName - Name/identifier of current page
   * @returns {Object} Tracking object with sendExit function and metadata
   */
  function trackPageView(pageName) {
    const enterTime = Date.now();
    const fromPage = (function() {
      const ref = document.referrer || '';
      if (ref.includes('index.html') || ref.endsWith('iv-drugref/')) return 'drugref';
      if (ref.includes('calculator.html')) return 'calculator';
      if (ref.includes('tdm.html')) return 'tdm';
      if (ref.includes('vanco-tdm.html')) return 'vanco-tdm';
      if (ref.includes('renal-dosing.html')) return 'renal-dosing';
      if (ref.includes('compatibility.html')) return 'compatibility';
      if (ref.includes('dashboard.html')) return 'dashboard';
      return ref ? 'external' : 'direct';
    })();

    // Send entry event
    sendAnalytics({
      type: 'page_view', page: pageName, action: 'enter',
      from_page: fromPage, referrer: document.referrer || 'direct'
    });

    // Track exit event (sent only once)
    let exitSent = false;
    function sendExit(extraData) {
      if (exitSent) return;
      exitSent = true;
      sendAnalytics({
        type: 'page_view', page: pageName, action: 'leave',
        duration_sec: Math.round((Date.now() - enterTime) / 1000),
        from_page: fromPage,
        ...(extraData || {})
      });
    }

    // Send exit on page unload or visibility change
    // Use named handlers stored on function scope to allow cleanup and prevent accumulation
    function onBeforeUnload() { sendExit(); }
    function onVisChange() { if (document.visibilityState === 'hidden') sendExit(); }

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisChange);

    return {
      sendExit,
      fromPage,
      enterTime,
      // Allow caller to clean up listeners
      destroy: function() {
        sendExit();
        window.removeEventListener('beforeunload', onBeforeUnload);
        document.removeEventListener('visibilitychange', onVisChange);
      }
    };
  }


  // ============================================================
  // SERVICE WORKER
  // ============================================================

  /**
   * Register service worker with user-prompted update flow.
   * When a new SW is found waiting, shows a toast asking the user to reload.
   */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('[SW] Registered:', reg.scope);

      // If a new SW is already waiting (e.g. user revisits after deploy)
      if (reg.waiting) { showUpdateToast(reg.waiting); return; }

      // Listen for a new SW that finishes installing
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready — prompt user
            showUpdateToast(newSW);
          }
        });
      });
    }).catch(err => console.warn('[SW] Registration failed:', err));

    // When the new SW takes over, reload the page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  /**
   * Show a non-intrusive toast prompting the user to reload for updates.
   * @param {ServiceWorker} waitingSW - the waiting service worker instance
   */
  function showUpdateToast(waitingSW) {
    // Prevent duplicate toasts
    if (document.getElementById('sw-update-toast')) return;

    var toast = document.createElement('div');
    toast.id = 'sw-update-toast';
    toast.className = 'sw-update-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
      '<span class="sw-update-msg">มีเวอร์ชันใหม่พร้อมใช้งาน</span>' +
      '<button class="sw-update-btn" id="sw-update-accept">โหลดใหม่</button>' +
      '<button class="sw-update-dismiss" id="sw-update-dismiss" aria-label="ปิด">&times;</button>';
    document.body.appendChild(toast);

    // Force reflow then add visible class for animation
    toast.offsetHeight;
    toast.classList.add('visible');

    document.getElementById('sw-update-accept').addEventListener('click', function() {
      waitingSW.postMessage({ type: 'SKIP_WAITING' });
      toast.remove();
    });
    document.getElementById('sw-update-dismiss').addEventListener('click', function() {
      toast.classList.remove('visible');
      setTimeout(function() { toast.remove(); }, 300);
    });
  }


  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  /**
   * Generate random anonymous ID using crypto API
   * @param {number} len - Length in hex characters (default 16)
   * @returns {string} Random hex string
   */
  function generateId(len) {
    len = len || 16;
    // Prefer crypto API, fallback to Math.random for older browsers
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint8Array(len / 2);
      crypto.getRandomValues(arr);
      return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback: Math.random-based (less secure but functional)
    var result = '';
    for (var i = 0; i < len; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  }

  /**
   * Debounce function to limit function execution
   * @param {Function} fn - Function to debounce
   * @param {number} ms - Debounce delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, ms) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   * Format number with specified decimal precision
   * @param {number} n - Number to format
   * @param {number} decimals - Number of decimal places (default 1)
   * @returns {string} Formatted number string
   */
  function fmt(n, decimals) {
    decimals = decimals !== undefined ? decimals : 1;
    // Guard against NaN, Infinity, and non-numeric input
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return (Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals);
  }

  /**
   * Event delegation helper — attaches a single listener on a container
   * and dispatches to handlers based on data-action attributes.
   * @param {HTMLElement|null} container - Element to listen on (null = document)
   * @param {string} eventType - DOM event type ('click', 'input', 'change', etc.)
   * @param {Object} actionMap - { actionName: function(event, targetElement) }
   */
  function delegate(container, eventType, actionMap) {
    var useCapture = (eventType === 'focus' || eventType === 'blur');
    (container || document).addEventListener(eventType, function(e) {
      var target = e.target.closest ? e.target.closest('[data-action]') : e.target;
      if (!target) return;
      var action = target.getAttribute('data-action');
      if (action && actionMap[action]) actionMap[action](e, target);
    }, useCapture);
  }

  /**
   * Safe DOM element builder — prevents innerHTML XSS.
   * @param {string} tag - HTML tag name
   * @param {Object|null} attrs - Attributes/properties (className, style, textContent, etc.)
   * @param {Array} children - Child elements or strings (strings become text nodes)
   * @returns {HTMLElement}
   */
  function dom(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (key === 'className') el.className = attrs[key];
        else if (key === 'textContent') el.textContent = attrs[key];
        else if (key === 'style' && typeof attrs[key] === 'string') el.style.cssText = attrs[key];
        else if (key === 'htmlFor') el.htmlFor = attrs[key];
        else el.setAttribute(key, attrs[key]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else if (child) el.appendChild(child);
      }
    }
    return el;
  }

  /**
   * Version and app name constants
   */
  const VERSION = '5.3.7';
  const APP_NAME = 'IV DrugRef';

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    // Version info
    VERSION,
    APP_NAME,

    // Validation
    VALIDATION_RULES,
    validateField,
    validatePatientInput,
    renderValidationMessages,

    // Clinical calculators
    calcIBW,
    calcABW,
    calcBMI,
    calcBSA,
    calcCockcroftGault,
    calcCG_raw,
    calcSchwartz,
    calcCKDEPI2021,
    calcCKDEPI2021_nonindexed,
    getCKDStage,
    getPatientFromForm,

    // Patient Context Persistence
    patientCtx,

    // Analytics
    sendAnalytics,
    trackPageView,
    getSessionId,
    getUserId,
    hasAnalyticsConsent,
    getAnalyticsUrl: function() { return ANALYTICS_URL; },
    getAdminGasUrl: function() { return ADMIN_GAS_URL; },

    // Service Worker
    registerSW,

    // Utility helpers
    generateId,
    debounce,
    fmt,
    dom,
    delegate,

    // Clinical Decision Support — reference links
    REF_LINKS: {
      thaiFDA: 'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/FRM_SEARCH_DRUG.aspx',
      nlem: 'https://nlem.hss.moph.go.th/',
      kdigo: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/'
    }
  };
})();

// ============================================================
// NORMALIZE CACHED DRUG DATA — Fix GAS strings before index.js
// ============================================================
(function(){
  try{
    var raw=localStorage.getItem('drugData_v4');
    if(!raw)return;
    var drugs=JSON.parse(raw);
    if(!Array.isArray(drugs))return;
    var fixed=false;
    drugs.forEach(function(d){
      if(d.monitoring&&typeof d.monitoring==='string'){
        var v=d.monitoring.trim();
        if(v[0]==='['){try{d.monitoring=JSON.parse(v);fixed=true;return}catch(e){}}
        d.monitoring=v.split(',').map(function(s){return s.trim()}).filter(Boolean);
        fixed=true;
      }
      if(d.categories&&typeof d.categories==='string'){
        var c=d.categories.trim();
        if(c[0]==='['){try{d.categories=JSON.parse(c);fixed=true;return}catch(e){}}
        d.categories=c.split(',').map(function(s){return s.trim()}).filter(Boolean);
        fixed=true;
      }
      ['reconst','dilution','admin','stability','compat'].forEach(function(k){
        if(d[k]&&typeof d[k]==='string'){try{d[k]=JSON.parse(d[k]);fixed=true}catch(e){}}
      });
    });
    if(fixed)localStorage.setItem('drugData_v4',JSON.stringify(drugs));
  }catch(e){}
})();

// ============================================================
// AUTO-INITIALIZATION
// ============================================================
// Register service worker on page load
document.addEventListener('DOMContentLoaded', () => {
  IVDrugRef.registerSW();
});
