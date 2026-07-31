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
      if (val === undefined) {
        // Field not present on this page → no input to validate, use default.
        results[f] = { valid: true, level: 'ok', messages: [] };
        continue;
      }
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

    // Raw numeric read: NaN if the field is present-but-blank, undefined if the
    // field is absent on this page. Lets validation tell "left blank" (must
    // error) from "not a field here" (use default silently). [C1 fix]
    const getRaw = (id) => {
      const el = document.getElementById(id);
      if (!el) return undefined;
      return parseFloat(el.value); // '' → NaN
    };
    const ageRaw = getRaw(ids.age);
    const wtRaw = getRaw(ids.wt);
    const htRaw = getRaw(ids.ht);
    const scrRaw = getRaw(ids.scr);

    // Validate the RAW values BEFORE applying display defaults, so a cleared
    // field can no longer be masked by a phantom default. Callers gate on
    // validation.allValid, so the defaults below never reach a shown result. [C1]
    //
    // Height is OPTIONAL for adults: Cockcroft-Gault falls back to actual body
    // weight when height is absent, and every IBW/ABW/BSA-based path guards for a
    // missing height. It stays REQUIRED for pediatrics, where Schwartz eGFR needs
    // it. So a blank height only skips validation when the patient is a valid
    // adult; left as NaN (→ error) for peds or unknown age. [height-optional]
    const _adult = !isNaN(ageRaw) && ageRaw >= 18;
    const htForValidation = (_adult && isNaN(htRaw)) ? undefined : htRaw;
    const validation = validatePatientInput(
      { age: ageRaw, wt: wtRaw, scr: scrRaw, ht: htForValidation },
      { age: ids.age, wt: ids.wt, scr: ids.scr, ht: ids.ht }
    );

    const _def = (v, d) => (v === undefined || isNaN(v)) ? d : v;
    const age = _def(ageRaw, 55);
    const wt = _def(wtRaw, 70);
    const ht = _def(htRaw, 170);
    const sex = getStr(ids.sex, 'M');
    const scr = _def(scrRaw, 1.0);
    const alb = getVal(ids.alb, 4.0);
    const dialysis = getStr(ids.dialysis, 'none');

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
  // Supabase analytics (Phase 1 migration). Publishable key is safe in the
  // browser — security comes from RLS (events table is anon insert-only).
  const SUPABASE_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';
  const SUPABASE_EVENTS_URL = SUPABASE_URL + '/rest/v1/events';
  let _reqCount = 0;
  let _reqWindowStart = Date.now();

  /**
   * Get anonymous session ID from localStorage (lazy-init, rotates daily).
   * Mirrors the scheme calculator.js uses so all pages share one ID.
   * @returns {string} Session ID
   */
  function getSessionId() {
    var today = new Date().toISOString().substring(0, 10);
    var id = localStorage.getItem('anonSessionId');
    var idDate = localStorage.getItem('anonSessionDate');
    if (!id || idDate !== today) {
      id = 'u' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      try {
        localStorage.setItem('anonSessionId', id);
        localStorage.setItem('anonSessionDate', today);
      } catch (e) {}
    }
    return id;
  }

  /**
   * Get anonymous user ID from localStorage (lazy-init, persistent).
   * @returns {string} User ID
   */
  function getUserId() {
    var uid = localStorage.getItem('anonUserId');
    if (!uid) {
      uid = 'p' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      try { localStorage.setItem('anonUserId', uid); } catch (e) {}
    }
    return uid;
  }

  /**
   * Check if user has consented to analytics
   * @returns {boolean} True if analytics consent is given
   */
  function hasAnalyticsConsent() {
    return true; // Always allow — matches v4.7 behavior
  }

  /**
   * Reshape a flat analytics event into the Supabase `events` table row, then
   * insert it via the Data API (PostgREST). Top-level columns are pulled out;
   * everything else is nested under `data` (jsonb). Fire-and-forget — failures
   * are swallowed so analytics never affects the user. sendBeacon can't set the
   * apikey/Authorization headers, so we use fetch with keepalive (survives
   * page unload the same way).
   * @param {Object} enriched - Event data already enriched with session/user id
   */
  function sendToSupabase(enriched) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
      var row = {
        type: enriched.type || 'unknown',
        session_id: enriched.session_id || null,
        user_id: enriched.user_id || null,
        // Default to the running app version — callers never set this, so it
        // was null on virtually every event row (useless for adoption charts).
        app_version: enriched.app_version ||
          ((typeof IVDrugRef !== 'undefined' && IVDrugRef.VERSION) ? IVDrugRef.VERSION : null),
        client_ts: enriched.queued_at || new Date().toISOString(),
        data: {}
      };
      var skip = { type: 1, session_id: 1, user_id: 1, app_version: 1, queued_at: 1 };
      Object.keys(enriched).forEach(function(k) { if (!skip[k]) row.data[k] = enriched[k]; });
      fetch(SUPABASE_EVENTS_URL, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(row),
        keepalive: true
      }).catch(function() {});
    } catch (e) { /* silent fail */ }
  }

  /**
   * Send analytics event via sendBeacon or fetch
   * Rate limited to 20 requests per minute (rolling window)
   * @param {Object} data - Event data to send
   */
  function sendAnalytics(data) {
    if (!hasAnalyticsConsent()) return;
    var enriched = {
      ...data,
      session_id: getSessionId(),
      user_id: getUserId()
    };
    // Offline: queue to IndexedDB for later flush. Do this BEFORE the rate
    // counter so offline events don't consume the online send budget.
    if (!navigator.onLine) {
      enriched.queued_at = new Date().toISOString();
      queueAnalyticsEvent(enriched);
      return;
    }
    // Online rate limit: 60/min rolling (was 20 — a pharmacist doing rapid
    // lookups is exactly the power user we most want to measure, and 20
    // truncated their busiest bursts). Over the cap → queue for the next flush
    // instead of dropping outright.
    const now = Date.now();
    if (now - _reqWindowStart > 60000) {
      _reqCount = 0; _reqWindowStart = now;
      // Drain any overflow queued during the previous minute (also covers the
      // online-overflow path below, which otherwise only flushed on reconnect).
      try { flushAnalyticsQueue(); } catch (e) {}
    }
    if (_reqCount >= 60) {
      enriched.queued_at = new Date().toISOString();
      queueAnalyticsEvent(enriched);
      return;
    }
    _reqCount++;
    // Primary sink: Supabase (Phase 1). Dual-write to GAS keeps the legacy
    // dashboard working until it migrates (Phase 1 step 5).
    sendToSupabase(enriched);
    try {
      if (!ANALYTICS_URL) return;
      var payload = JSON.stringify(enriched);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ANALYTICS_URL, payload);
      } else {
        fetch(ANALYTICS_URL, { method: 'POST', body: payload, keepalive: true }).catch(function() {});
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
   * Detect LINE's in-app browser / LIFF WebView.
   * LINE's WebView user-agent carries a "Line/<version>" token (e.g.
   * ".../ Line/13.5.0"); LIFF pages opened from the LINE client run in the same
   * WebView. Used to keep the app safe inside LINE: the force-update auto-reload
   * and the SW-controllerchange auto-reload are both downgraded to dismissible,
   * user-tapped reloads there — an in-app WebView may lack a service worker to
   * make a reload "stick", and its sessionStorage (our reload-loop guard) can be
   * ephemeral, so with forceUpdate:true a silent auto-reload could loop.
   * Pure function (ua injectable) so it is unit-testable.
   * @param {string} [ua] - user-agent string (defaults to navigator.userAgent)
   * @returns {boolean}
   */
  function isLineInApp(ua) {
    try {
      var s = ua != null ? ua : ((typeof navigator !== 'undefined' && navigator.userAgent) || '');
      return /\bLine\/\d/i.test(s);
    } catch (e) { return false; }
  }

  /**
   * Register service worker with user-prompted update flow.
   * When a new SW is found waiting, shows a toast asking the user to reload.
   */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('[SW] Registered:', reg.scope);

      // Force an update check now + whenever the app regains focus. Installed PWA
      // windows are long-lived and may not navigate, so the browser's automatic
      // sw.js check can lag for days — leaving an old SW controlling (e.g. the
      // pre-v5.51.1 cache-first-Supabase bug). reg.update() re-fetches sw.js; if it
      // changed, the new SW installs → skipWaiting (v5.51.2+) → activates → reload.
      // reg.update() returns a Promise — a synchronous try/catch does NOT catch its
      // rejection (offline / transient sw.js fetch fail / "Not found"). Unhandled, it
      // bubbles to window.onunhandledrejection and pops the error-tracker toast
      // ("เกิดข้อผิดพลาดเล็กน้อย") on every page load. Swallow it on the promise —
      // the update check is best-effort by design.
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });

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

    // When the new SW takes over, reload the page — EXCEPT inside LINE's in-app
    // WebView, where a silent auto-reload can loop; there we show a dismissible
    // update toast and let the user reload manually.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      if (isLineInApp()) { showUpdateToast(null); return; }
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
      // Normal browsers with a waiting SW: SKIP_WAITING → controllerchange → reload.
      // In LINE (or when called without a waiting SW), do a direct user-initiated
      // reload — the SKIP_WAITING→controllerchange auto-reload path is off in LINE.
      if (waitingSW && !isLineInApp()) {
        try { waitingSW.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
      } else {
        window.location.reload();
      }
      toast.remove();
    });
    document.getElementById('sw-update-dismiss').addEventListener('click', function() {
      toast.classList.remove('visible');
      setTimeout(function() { toast.remove(); }, 300);
    });
  }


  // ============================================================
  // VERSION CHECK — Force Update Support (v5.3.8)
  // ============================================================
  // Polls version.json to detect new deploys.
  // If forceUpdate=true and version mismatch → force reload immediately.
  // If forceUpdate=false → rely on normal SW update toast.
  // Checks: on page load, on visibilitychange, and every 5 minutes.

  var VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  var _versionCheckTimer = null;
  var _currentAppVersion = null; // set from version.json on first load

  function checkForUpdate() {
    // Inside LINE's in-app WebView there is no service worker, so a reload cannot
    // reliably pick up a new build — and version.json's `version` (the git hash,
    // stamped by build.js for cache-busting) never equals core.js VERSION (semver),
    // so the check would flag "new version" on EVERY page load and nag forever
    // (the banner the user reported). The update can't be completed here, so skip
    // the whole version check in LINE. Real browsers / the installed PWA still
    // force-update normally (the SW makes the reload actually stick).
    if (isLineInApp()) return;
    fetch('version.json?_t=' + Date.now(), { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.version) return;

        // Baseline = the version embedded in the RUNNING build (VERSION), NOT the
        // first value fetched from version.json. This is what makes "force update
        // every session" actually work: if the loaded page is a STALE cached build,
        // the very first check already sees version.json.version !== VERSION and
        // forces the reload. The old code adopted the freshly-fetched server value
        // on first load and returned without comparing, so a stale build was never
        // caught on open — only if the version changed again while the tab stayed
        // open. Seeding from VERSION closes that gap.
        if (!_currentAppVersion) _currentAppVersion = VERSION;

        // Running the latest build — nothing to do
        if (data.version === _currentAppVersion) return;

        console.log('[VersionCheck] New version:', data.version, '(current:', _currentAppVersion + ')', 'force:', data.forceUpdate);

        if (data.forceUpdate) {
          // (LINE's in-app WebView is handled by the early return in
          // checkForUpdate — it never reaches here.)
          // Force update: show non-dismissable banner then reload.
          // Loop guard: force ONCE per target version per session. If we already
          // forced to this version this session but the build is still stale (e.g.
          // version.json/build drift, or the cache refused to refresh), stop forcing
          // so the page can't get stuck in a reload loop — the dismissible SW toast /
          // next navigation picks it up instead.
          var _guardKey = 'ivdr_forced_' + data.version;
          var _alreadyForced = false;
          try { _alreadyForced = sessionStorage.getItem(_guardKey) === '1'; } catch (e) {}
          if (_alreadyForced) return;
          try { sessionStorage.setItem(_guardKey, '1'); } catch (e) {}
          showForceUpdateBanner(data.version);
        } else {
          // Normal: let SW handle it (toast with dismiss option)
          // Trigger SW update check
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then(function(reg) {
              if (reg) reg.update().catch(function() {});
            }).catch(function() {});
          }
        }
      })
      .catch(function() { /* offline or error — ignore */ });
  }

  function showForceUpdateBanner(newVersion) {
    // Prevent duplicate banners
    if (document.getElementById('force-update-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'force-update-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
      'background:#dc2626;color:#fff;padding:16px 20px;text-align:center;' +
      'font-size:15px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    banner.innerHTML = 'กำลังอัพเดตเป็นเวอร์ชัน ' + newVersion + ' ...';
    document.body.appendChild(banner);

    // Force SW to activate new version, then reload
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistration().then(function(reg) {
        if (reg) {
          reg.update().then(function() {
            // Give SW time to install new version
            setTimeout(function() {
              if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
              // Reload after a short delay regardless
              setTimeout(function() { window.location.reload(); }, 1500);
            }, 2000);
          }).catch(function() {
            // update() failed (offline/transient) — reload anyway to pick up new files
            setTimeout(function() { window.location.reload(); }, 1500);
          });
        } else {
          // No SW — just reload
          setTimeout(function() { window.location.reload(); }, 1500);
        }
      }).catch(function() { setTimeout(function() { window.location.reload(); }, 1500); });
    } else {
      // No SW — just reload
      setTimeout(function() { window.location.reload(); }, 1500);
    }
  }

  function startVersionCheck() {
    // Initial check after 3s (let page load first)
    setTimeout(checkForUpdate, 3000);

    // Periodic check
    _versionCheckTimer = setInterval(checkForUpdate, VERSION_CHECK_INTERVAL);

    // Check when tab becomes visible again
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    });
  }


  // ============================================================
  // WHAT'S NEW — release-notes popup (Thai) shown once per new version
  // ============================================================
  // User-facing changelog, NEWEST FIRST. `npm run release` PREPENDS a new entry
  // right after the `const RELEASE_NOTES = [` line, so keep that line intact.
  // Shape: { v:'x.y.z', date:'YYYY-MM-DD', title:'หัวข้อสั้น ๆ', items:['บรรทัดไทย', ...] }
  const RELEASE_NOTES = [
    {
      v: '5.79.4',
      date: '2026-07-31',
      title: "แก้ตาราง 'ยาที่ดูบ่อย' ใน Dashboard",
      items: [
        "แก้ Dashboard → Drug Usage ที่ตาราง 'Top ยาดูบ่อย' ว่างเปล่า (ชื่อฟิลด์ข้อมูลไม่ตรงกันหลังย้ายมาใช้ Supabase)",
        "ข้อมูลเก่าและใหม่นับรวมกันได้ถูกต้องแล้ว"
      ]
    },
    {
      v: '5.79.3',
      date: '2026-07-31',
      title: "แก้ตาราง 'ยาที่ค้นแล้วไม่มีในฐานข้อมูล'",
      items: [
        "แก้หน้า Admin → Analytics ที่ตาราง 'ยาที่ถูกค้นหาแต่ไม่มีในฐานข้อมูล' ว่างเปล่าเสมอ และคอลัมน์สถานะขึ้น '✅ มี' ทุกแถว (อ่านชื่อยาผิดฟิลด์)",
        "ตอนนี้แสดงคำค้นที่ยังไม่มียาในระบบได้ถูกต้อง — ใช้ดูว่าควรเพิ่มยาตัวไหน"
      ]
    },
    {
      v: '5.79.2',
      date: '2026-07-31',
      title: "แก้หน้า Analytics ใน Admin โหลดไม่ขึ้น",
      items: [
        "หน้า Analytics ใน Admin เปลี่ยนไปอ่านจาก Supabase โดยตรง (เดิมดึงผ่าน Google Sheets ทั้ง 16 แท็บจนหมดเวลา 15 วินาที)",
        "โหลดเฉพาะข้อมูล 30 วันล่าสุดเท่าที่หน้านี้ใช้จริง — เร็วขึ้นมากและไม่ Timeout อีก"
      ]
    },
    {
      v: '5.79.1',
      date: '2026-07-31',
      title: "แก้บั๊กหน้า Admin/Dashboard",
      items: [
        "แก้หน้า Analytics ใน Admin ที่ขึ้น error เมื่อมีคำค้นหาเป็นตัวเลข (เช่น ค้น \"500\") ทำให้โหลดสถิติไม่ขึ้นทั้งหน้า",
        "แก้เลขเวอร์ชันท้ายหน้า Dashboard ที่ค้างเป็นเลขเก่า ให้ตรงกับเวอร์ชันแอปจริงเสมอ"
      ]
    },
    {
      v: '5.79.0',
      date: '2026-07-31',
      title: "ประกาศด่วนถึงผู้ใช้ทุกคน 📢",
      items: [
        "เพิ่มแท็บ 'ประกาศด่วน' ในหน้า admin — ส่งประกาศความปลอดภัย (เรียกคืนยา ฯลฯ) ถึงเครื่องผู้ใช้ทุกคนได้ภายใน ~5 นาที และปิดประกาศได้เมื่อเรื่องจบ"
      ]
    },
    {
      v: '5.73.0',
      date: '2026-07-31',
      title: "แก้ข้อความตรวจเวอร์ชันในหน้าผู้ดูแลระบบที่ทำให้เข้าใจผิด",
      items: [
        "เดิมถ้าเวอร์ชันเซิร์ฟเวอร์กับเว็บไม่ตรงกัน จะขึ้นเตือนว่า 'ยัง deploy ไม่ครบ?' เสมอ แม้ในกรณีที่ deploy สำเร็จแล้วและกำลังรอเว็บอัปเดตตามมา",
        "ตอนนี้แยกชัดเจน: เซิร์ฟเวอร์เก่ากว่า = ต้อง deploy ใหม่ / เซิร์ฟเวอร์ใหม่กว่า = ปกติ ไม่ต้องทำอะไร"
      ]
    },
    {
      v: '5.72.0',
      date: '2026-07-27',
      title: "แก้: การแก้ข้อมูลยาที่มีเนื้อหายาวถูกทิ้งเงียบ ๆ",
      items: [
        "ยาที่มีข้อความยาว (เช่น ข้อควรระวังหลายบรรทัด) เวลาบันทึกจะถูกส่งอีกช่องทางหนึ่ง ซึ่งฝั่งเซิร์ฟเวอร์ไม่รองรับ ทำให้ข้อมูลถูกทิ้งทั้งก้อนโดยไม่มีการแจ้งเตือน — แก้แล้ว",
        "ทุกการบันทึกจะอ่านคำตอบจากเซิร์ฟเวอร์เสมอ ถ้าอ่านไม่ได้จะแจ้งให้ตรวจสอบก่อนบันทึกซ้ำ ไม่รายงานว่าสำเร็จลอย ๆ"
      ]
    },
    {
      v: '5.71.0',
      date: '2026-07-27',
      title: "ข้อมูลยาสำรองสำหรับใช้ออฟไลน์ เป็นข้อมูลล่าสุดเสมอ",
      items: [
        "ชุดข้อมูลยาที่ฝังมากับแอป (ใช้ตอนเปิดครั้งแรกและตอนไม่มีเน็ต) จะถูกสร้างใหม่จากฐานข้อมูลจริงทุกครั้งที่อัปเดตแอป — เดิมเป็นข้อมูลชุดเก่าค้างไว้หลายเดือน",
        "ถ้าดึงข้อมูลล่าสุดไม่ได้ ระบบจะใช้ชุดเดิมที่ตรวจสอบแล้วแทน ไม่เสี่ยงได้ข้อมูลไม่ครบ"
      ]
    },
    {
      v: '5.70.0',
      date: '2026-07-27',
      title: "แก้ข้อมูลยาในแอปไม่อัปเดตตามที่แอดมินแก้",
      items: [
        "หน้าค้นหายา: หลังอัปเดตแอป เคยแสดงข้อมูลชุดเดิมที่ฝังมากับตัวแอป และไม่ดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์นานถึง 30 นาที — แก้แล้ว ตอนนี้ดึงทันที",
        "ผลคือ ข้อมูลยาที่แก้ในหน้าผู้ดูแลระบบจะขึ้นในแอปของผู้ใช้เร็วขึ้นมาก"
      ]
    },
    {
      v: '5.69.0',
      date: '2026-07-27',
      title: "แก้บั๊ก: แก้ไขข้อมูลยาในหน้าผู้ดูแลระบบไม่ถูกบันทึก",
      items: [
        "หน้าผู้ดูแลระบบ: เดิมกดบันทึกข้อมูลยาแล้วขึ้นว่าสำเร็จ แต่ข้อมูลไม่ได้ถูกบันทึกจริง — แก้ไขแล้ว",
        "เพิ่มการแจ้งเตือนเมื่อบันทึกไม่สำเร็จ ระบบจะไม่รายงานว่าสำเร็จทั้งที่ไม่ได้บันทึกอีกต่อไป"
      ]
    },
    {
      v: '5.68.0',
      date: '2026-07-27',
      title: "แจ้งเตือนเซสชันแอดมินหมดอายุให้ชัดเจน",
      items: [
        "🔑 เมื่อเปิดหน้าแอดมินค้างไว้เกิน 1 ชั่วโมงแล้วกดบันทึกไม่ได้ ระบบจะบอกชัดเจนว่า 'เซสชันหมดอายุ — กด Sign Out แล้วเข้าใหม่' แทนข้อความปฏิเสธที่เข้าใจยาก"
      ]
    },
    {
      v: '5.67.0',
      date: '2026-07-27',
      title: "ปิดช่องโหว่ปลอมตัวเป็นแอดมิน (ขั้นเตรียมพร้อม)",
      items: [
        "🔐 ระบบหลังบ้านตรวจสอบตัวตนผู้แก้ข้อมูลด้วย signed token จาก Google แทนการเชื่ออีเมลที่ส่งมาเฉย ๆ (ต้อง deploy GAS + เปิดสวิตช์ตาม docs/gas-security-hardening.md จึงจะบังคับใช้เต็มรูปแบบ)"
      ]
    },
    {
      v: '5.66.0',
      date: '2026-07-24',
      title: "เสริมความปลอดภัยระบบหลังบ้าน (backend hardening)",
      items: [
        "🔐 เตรียมระบบยืนยันตัวตนแบบ signed token สำหรับการแก้ข้อมูลผ่านแผงแอดมิน และ SQL ปิดไม่ให้บุคคลภายนอกอ่านข้อมูลยาที่ยังไม่อนุมัติ/ข้อมูลส่วนบุคคล — ส่วนนี้ต้องตั้งค่าฝั่งเซิร์ฟเวอร์เพิ่ม (ดู docs/gas-security-hardening.md) จึงจะมีผลเต็มที่"
      ]
    },
    {
      v: '5.65.0',
      date: '2026-07-24',
      title: "ความปลอดภัย + การเข้าถึง (a11y) + ความแม่นยำข้อมูล",
      items: [
        "🔒 อุดช่องโหว่ XSS ในหน้า dashboard (comment/ชื่อยาที่ผู้ใช้ส่งเข้ามาถูก escape ก่อนแสดง) และย้าย GitHub token ของแอดมินไป sessionStorage (ปลอดภัยขึ้น)",
        "⌨️ รองรับคีย์บอร์ด/screen reader ดีขึ้น: modal ดักโฟกัส (Tab วนในกล่อง แล้วคืนโฟกัสเดิม) + ผูก label กับช่องกรอกในหน้า TDM/Vanco",
        "✅ แผงแอดมิน: ตรวจข้อมูลก่อนบันทึกลง Supabase (ผล compat ต้องถูกต้อง, renal ต้องมีขนาดยา + ช่วง GFR ที่ถูกต้อง) และเตือนจำนวนรายการที่จะถูกเขียนทับตอน import",
        "📊 Analytics แม่นยำขึ้น: เพิ่มลิมิต 20→60 ครั้ง/นาที (ไม่ตกหล่นตอนใช้ถี่) และ cross-filter ไม่นับข้ามชุดข้อมูลที่ไม่มีมิตินั้น"
      ]
    },
    {
      v: '5.64.0',
      date: '2026-07-24',
      title: "แก้ระบบอัปเดตอัตโนมัติ + ความเสถียร",
      items: [
        "🔄 แก้ Service Worker ที่ติดตั้งไม่สำเร็จทุกครั้งที่ deploy (ต้นเหตุที่แอปค้างเวอร์ชันเก่า) — ตอนนี้อัปเดตเป็นเวอร์ชันล่าสุดได้จริงอัตโนมัติ",
        "🔔 ปุ่มปิด/รับทราบแจ้งเตือนด่วน (urgent alert) กดได้แล้ว (เดิมกดไม่ทำงานเพราะ id เป็นข้อความ)",
        "🕐 เวลา 'ซิงค์ล่าสุด' ในโหมดออฟไลน์แสดงเวลาที่ดึงข้อมูลจริง (เดิมโชว์เวลาเปิดหน้าเสมอ ทำให้ข้อมูลเก่าดูเหมือนเพิ่งอัปเดต)",
        "📊 คะแนนรีวิวยา + แบบสอบถามความพึงพอใจ (NPS) ส่งเข้าระบบวิเคราะห์ได้แล้ว (เดิมส่งผิดทางจนไม่ปรากฏใน dashboard)",
        "🛠️ ระบบ build ตรวจไฟล์หายอัตโนมัติ + เพิ่ม CI รันเทสต์ทุกครั้งก่อน merge"
      ]
    },
    {
      v: '5.63.0',
      date: '2026-07-24',
      title: "ปรับความแม่นยำคำเตือนความปลอดภัยคลินิก",
      items: [
        "🩺 Renal dosing: คนไข้ไตวายระยะสุดท้ายได้ขนาดยาตามค่า GFR จริง + ขึ้นธงห้ามใช้ (CI) ถูกต้อง และเด็กอายุ <1 ปีถูกบล็อกการคำนวณจริง (เดิมโชว์ขนาดยาใต้แบนเนอร์เตือน)",
        "💉 Vancomycin: ขนาดยาตามน้ำหนักไม่ปัดเป็น 0 mg ในเด็กเล็ก และ aminoglycoside ใช้ AdjBW เมื่อน้ำหนักเกิน >120% IBW",
        "⚠️ ปฏิกิริยาระหว่างยา: DigiFab (ยาแก้พิษ digoxin) ไม่ถูกเตือนผิดว่าตีกับ digoxin อีกต่อไป",
        "🧪 ความเข้ากันได้ IV: Calcium/Magnesium + Phosphate = เข้ากันไม่ได้ (ตกตะกอน) และการ sync ข้อมูลไม่ลบคู่ยาอันตรายที่มีในระบบทิ้ง",
        "🔬 แพ้ข้ามยา: carbapenem→carbapenem = เสี่ยงสูง (ไม่ใช่น้อยมาก), ค้นด้วยชื่อการค้า (เช่น Bactrim) ได้, ครอบคลุม 17 กลุ่มยา"
      ]
    },
    {
      v: '5.62.0',
      date: '2026-07-24',
      title: "ปรับปรุงความแม่นยำเครื่องคำนวณ Vanco TDM",
      items: [
        "🔧 แก้สูตร AUC₂₄ ให้เป็นค่าแม่นตรงตามหลัก mass balance (dose/CL) — ค่าเดิมต่ำกว่าจริง 3–12% โดยเฉพาะเมื่อ infusion นาน",
        "🎯 แก้การถ่วงน้ำหนักผล vanco level ในโมเดล Bayesian (ω²/σ²) — ค่าประมาณรายผู้ป่วยตอบสนองต่อระดับยาที่วัดจริงถูกต้องขึ้น ช่วงความเชื่อมั่นแคบลงสู่ค่าที่ควรเป็น"
      ]
    },
    {
      v: '5.61.0',
      date: '2026-07-24',
      title: "NSAID 5 phenotype + Heparin HIT/DTH/immediate",
      items: [
        "NSAID: เลือก phenotype ได้ 5 แบบตามมาตรฐาน EAACI/ENDA — NERD/NECD/NIUA (แพ้ข้าม COX-1 ทั้งกลุ่ม, COX-2 ใช้ได้) กับ SNIUAA/SNIDR (แพ้ตัวเดียว, NSAID กลุ่มเคมีอื่นใช้ได้) พร้อมคำแนะนำจัดการเฉพาะแต่ละแบบ",
        "Heparin: เลือกชนิดปฏิกิริยา HIT / DTH (ผื่นจุดฉีด) / immediate ได้ — คำแนะนำต่างกัน (HIT ห้ามสลับ LMWH ใช้ DTI, DTH ใช้ fondaparinux/IV UFH ได้) + เพิ่ม danaparoid"
      ]
    },
    {
      v: '5.60.0',
      date: '2026-07-24',
      title: "เพิ่มกลุ่มแพ้ยา PPI + Sulfonylurea",
      items: [
        "PPI: แบ่ง 2 กลุ่มโครงสร้าง — omeprazole/esomeprazole/pantoprazole (benzimidazole) แพ้ข้ามกันสูง, lansoprazole/rabeprazole (pyridine) แยกกลุ่ม — ต่างกลุ่มยืนยันด้วย skin test/DPT ก่อนใช้, H2RA (famotidine) เป็นทางเลือกปลอดภัย",
        "Sulfonylurea: SU เป็น non-antibiotic sulfonamide → แพ้ข้ามกับ sulfa antibiotic ต่ำ; SU ตัวอื่นให้ระวัง; ยาเบาหวานนอกกลุ่ม SU (metformin/DPP-4i/SGLT2i/insulin) ใช้ได้ปลอดภัย"
      ]
    },
    {
      v: '5.59.0',
      date: '2026-07-24',
      title: "เพิ่มกลุ่มแพ้ยา Aminoglycoside + Macrolide",
      items: [
        "Aminoglycoside: กลุ่ม deoxystreptamine (gentamicin/tobramycin/amikacin/neomycin) แพ้ข้ามกัน ≥50% ถ้าแพ้ตัวหนึ่งเลี่ยงทั้งกลุ่ม — streptomycin โครงสร้างต่างใช้ได้",
        "Macrolide: แพ้ข้ามในกลุ่มต่ำ/ไม่สม่ำเสมอ (erythromycin/clarithromycin/azithromycin) — ยืนยันด้วย drug provocation test ก่อนใช้ตัวอื่น หรือเลือกยานอกกลุ่ม"
      ]
    },
    {
      v: '5.58.0',
      date: '2026-07-24',
      title: "เพิ่มกลุ่มยาแพ้: Opioid + Corticosteroid",
      items: [
        "💉 หน้าแพ้ยา: เพิ่มกลุ่ม Opioid — แยก “แพ้จริง vs pseudoallergy (histamine)” + แนะยาต่างกลุ่มโครงสร้างที่ใช้แทนได้ (Khalaf 2025)",
        "💊 เพิ่มกลุ่ม Corticosteroid — จัดกลุ่ม A/B/C/D, กลุ่ม C (betamethasone/dexamethasone) เป็นทางเลือก + เตือนแพ้สารเพิ่ม (excipient: succinate/CMC)"
      ]
    },
    {
      v: '5.57.0',
      date: '2026-07-24',
      title: "อัปเดตหน้าแพ้ยา: เตือน SCAR + ตรวจยาได้ทุกตัว",
      items: [
        "⛔ หน้าแพ้ยา: เพิ่มแบนเนอร์เตือน SCAR (SJS/TEN/DRESS) เด่นชัดเมื่อยาที่แพ้เป็นชนิดรุนแรง — ห้าม challenge/desensitization",
        "🔎 ช่อง “ตรวจว่าใช้ยานี้ได้ไหม” ค้นได้ทุกตัว (ครอบคลุมยา IV ~167 ตัว) ไม่จำกัดเฉพาะยาในฐานแพ้ยา",
        "📋 เพิ่มทัวร์แนะนำการใช้งานหน้าแพ้ยาครั้งแรก"
      ]
    },
    {
      v: '5.56.0',
      date: '2026-07-23',
      title: "แพ้ยาหลายชนิด + ตรวจว่าใช้ยาได้ไหม",
      items: [
        "🛡️ หน้าแพ้ยา: เพิ่มยาที่แพ้ได้หลายตัวพร้อมกัน (ตั้งความรุนแรงแยกแต่ละตัว) แล้วรวมผลแพ้ข้ามให้อัตโนมัติ",
        "🎯 ถามได้ว่า “ใช้ยา ___ ได้ไหม” — ระบบเทียบกับยาที่แพ้ทุกตัวแล้วสรุปพร้อมเหตุผลรายตัว",
        "💊 เพิ่มกลุ่มยาใหม่: Tetracycline, Nitroimidazole และเพิ่ม Parecoxib (ยาฉีดแก้ปวด COX-2) ในกลุ่ม NSAID"
      ]
    },
    {
      v: '5.55.0',
      date: '2026-07-17',
      title: "แก้แถบเวอร์ชันเด้งซ้ำใน LINE",
      items: [
        "แก้แถบ 'มีเวอร์ชันใหม่' ที่เด้งซ้ำทุกครั้งเมื่อเปิดแอปผ่าน LINE (ปิดการเช็คเวอร์ชันใน LINE ที่ทำงานไม่ได้อยู่แล้วเพราะไม่มี service worker)",
        "เบราว์เซอร์ปกติ / ติดตั้งแอปไว้ ยังอัปเดตอัตโนมัติเหมือนเดิม"
      ]
    },
    {
      v: '5.54.0',
      date: '2026-07-17',
      title: "เชื่อมช่องทาง LINE — เช็คคู่ยา/ไต 🔗",
      items: [
        "รองรับลิงก์จากแชต LINE เปิดหน้าเช็คยาเข้ากันได้ (2 ตัว) และปรับขนาดยาไต ได้ตรงตัวยาเลย",
        "การใช้งานผ่านเบราว์เซอร์ปกติเหมือนเดิมทุกอย่าง"
      ]
    },
    {
      v: '5.53.0',
      date: '2026-07-17',
      title: "เตรียมช่องทาง LINE 🟢",
      items: [
        "รองรับการเปิดแอปผ่าน LINE ได้ลื่นขึ้น (แก้ปัญหาหน้าจอโหลดซ้ำเมื่อเปิดในแอป LINE)",
        "การใช้งานผ่านเบราว์เซอร์ปกติเหมือนเดิมทุกอย่าง"
      ]
    },
    {
      v: '5.52.0',
      date: '2026-07-08',
      title: "แจ้งเตือนอัปเดต + บังคับใช้เวอร์ชันล่าสุด",
      items: [
        "🎉 เพิ่มหน้าต่าง “มีอะไรใหม่” — เปิดแอพแล้วเห็นสรุปสิ่งที่อัปเดตทันที (แสดงครั้งเดียวต่อเวอร์ชัน)",
        "⚡ บังคับอัปเดตเป็นเวอร์ชันล่าสุดทุกครั้งที่เปิดแอพ ไม่ต้องล้างแคชเอง",
        "🔄 ตรวจจับเวอร์ชันที่ค้างในเครื่องได้แม่นขึ้น โหลดของใหม่ไวขึ้น และกันรีโหลดวนซ้ำ"
      ]
    },
  ];

  // Modal styling — uses the app's theme CSS variables so it auto-switches
  // light/dark (theme.css is loaded on every page; core.js is inlined per page).
  const _WN_CSS =
    '.wn-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;' +
    'justify-content:center;padding:16px;background:rgba(0,0,0,0.45);opacity:0;' +
    'transition:opacity .25s ease;-webkit-tap-highlight-color:transparent;}' +
    '.wn-overlay.wn-visible{opacity:1;}' +
    '.wn-sheet{background:var(--card,#fff);color:var(--text,#1e293b);' +
    'border:1px solid var(--card-border,#e2e8f0);border-radius:var(--radius-lg,16px);' +
    'box-shadow:var(--shadow-lg,0 8px 24px rgba(0,0,0,0.2));font-family:var(--sans,inherit);' +
    'width:100%;max-width:440px;max-height:82vh;display:flex;flex-direction:column;' +
    'overflow:hidden;transform:translateY(12px) scale(.98);transition:transform .25s ease;}' +
    '.wn-overlay.wn-visible .wn-sheet{transform:none;}' +
    '.wn-header{padding:20px 20px 12px;border-bottom:1px solid var(--card-border,#e2e8f0);}' +
    '.wn-title{font-size:19px;font-weight:800;}' +
    '.wn-sub{font-size:12.5px;color:var(--text2,#64748b);margin-top:3px;}' +
    '.wn-body{padding:6px 20px 10px;overflow-y:auto;}' +
    '.wn-rel{margin:8px 0;}' +
    '.wn-rel-head{font-size:12px;font-weight:700;color:var(--blue,#0ea5e9);letter-spacing:.3px;}' +
    '.wn-rel-title{font-size:14px;font-weight:700;margin:2px 0 4px;}' +
    '.wn-list{margin:0;padding:0;list-style:none;}' +
    '.wn-list li{padding:8px 0;font-size:13.5px;line-height:1.55;' +
    'border-top:1px solid var(--card-border,#eef2f7);}' +
    '.wn-rel .wn-list li:first-child{border-top:none;}' +
    '.wn-footer{padding:12px 20px 18px;border-top:1px solid var(--card-border,#e2e8f0);' +
    'display:flex;justify-content:flex-end;}' +
    '.wn-close{background:var(--blue,#0ea5e9);color:#fff;border:none;border-radius:10px;' +
    'padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}' +
    '.wn-close:hover{filter:brightness(1.05);}';

  // Semver-ish compare (x.y.z numeric): 1 if a>b, -1 if a<b, 0 if equal.
  function _wnCmp(a, b) {
    var pa = String(a).split('.'), pb = String(b).split('.');
    for (var i = 0; i < 3; i++) {
      var x = parseInt(pa[i], 10) || 0, y = parseInt(pb[i], 10) || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  function _wnEsc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _wnLang() {
    try {
      return (window.IVDrugRefI18n && IVDrugRefI18n.getCurrentLang &&
        IVDrugRefI18n.getCurrentLang()) || 'th';
    } catch (e) { return 'th'; }
  }

  // Build + show the What's New modal for the given release-note entries.
  function showWhatsNewModal(notes) {
    if (!notes || !notes.length) return;
    if (document.getElementById('whats-new-modal')) return;
    if (!document.getElementById('whats-new-styles')) {
      var st = document.createElement('style');
      st.id = 'whats-new-styles';
      st.textContent = _WN_CSS;
      document.head.appendChild(st);
    }
    var en = _wnLang() === 'en';
    var title = en ? "🎉 What's New" : '🎉 มีอะไรใหม่';
    var sub = en ? 'Updates in this version' : 'อัปเดตในเวอร์ชันนี้';
    var closeLbl = en ? 'Got it' : 'รับทราบ';
    var body = notes.map(function (n) {
      var items = (n.items || []).map(function (it) {
        return '<li>' + _wnEsc(it) + '</li>';
      }).join('');
      var head = 'v' + _wnEsc(n.v) + (n.date ? ' · ' + _wnEsc(n.date) : '');
      return '<div class="wn-rel">' +
        '<div class="wn-rel-head">' + head + '</div>' +
        (n.title ? '<div class="wn-rel-title">' + _wnEsc(n.title) + '</div>' : '') +
        '<ul class="wn-list">' + items + '</ul></div>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'whats-new-modal';
    overlay.className = 'wn-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', en ? "What's New" : 'มีอะไรใหม่');
    overlay.setAttribute('data-i18n-done', '1');
    overlay.innerHTML =
      '<div class="wn-sheet">' +
        '<div class="wn-header"><div class="wn-title">' + title + '</div>' +
        '<div class="wn-sub">' + sub + '</div></div>' +
        '<div class="wn-body">' + body + '</div>' +
        '<div class="wn-footer"><button type="button" class="wn-close">' + closeLbl + '</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.offsetHeight; // reflow so the fade/scale transition runs
    overlay.classList.add('wn-visible');

    function close() {
      overlay.classList.remove('wn-visible');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 260);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.querySelector('.wn-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
  }

  // Show the What's New popup on app open — only when the app version changed since
  // the user last saw it (localStorage.ivdr_lastSeenVersion). Brand-new installs are
  // seeded silently (no popup on the first ever run).
  function maybeShowWhatsNew() {
    var seen = null;
    try { seen = localStorage.getItem('ivdr_lastSeenVersion'); } catch (e) {}
    function markSeen() { try { localStorage.setItem('ivdr_lastSeenVersion', VERSION); } catch (e) {} }

    if (seen === VERSION) return;          // already seen this version

    if (!seen) {
      // No "seen" version stored yet. This is the FIRST release that tracks it, so
      // every prior user also lands here — don't silently skip them. Distinguish a
      // returning user (has prior app state from before this feature) from a truly
      // fresh install: show the current notes to returning users so this rollout is
      // visible on their next open; seed silently for a brand-new install.
      var returning = false;
      try {
        returning = !!(localStorage.getItem('anonUserId') ||
          localStorage.getItem('anonSessionDate') ||
          localStorage.getItem('drugData_v4') ||
          localStorage.getItem('drugFavorites'));
      } catch (e) {}
      markSeen();
      if (returning) {
        var cur = RELEASE_NOTES.filter(function (n) { return _wnCmp(n.v, VERSION) <= 0; });
        if (cur.length) showWhatsNewModal(cur.slice(0, 3));
      }
      return;
    }

    // Returning across an update: show every note newer than what they last saw.
    var fresh = RELEASE_NOTES.filter(function (n) {
      return _wnCmp(n.v, seen) > 0 && _wnCmp(n.v, VERSION) <= 0;
    });
    markSeen();                            // mark seen even if no notes, so it shows once
    if (fresh.length) showWhatsNewModal(fresh);
  }

  // Manual re-open (e.g. an About/menu link) — shows the latest few releases
  // regardless of the "seen" flag.
  function showWhatsNew() {
    var cur = RELEASE_NOTES.filter(function (n) { return _wnCmp(n.v, VERSION) <= 0; });
    if (cur.length) showWhatsNewModal(cur.slice(0, 5));
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
  const VERSION = '5.79.4';
  const APP_NAME = 'IV DrugRef';

  // ============================================================
  // INDEXEDDB HELPER — Offline analytics queue + drug data backup
  // ============================================================
  const IDB_NAME = 'iv-drugref-db';
  const IDB_VERSION = 1;
  let _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function(resolve, reject) {
      try {
        var req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('analyticsQueue')) {
            db.createObjectStore('analyticsQueue', { autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('drugDataBackup')) {
            db.createObjectStore('drugDataBackup', { keyPath: 'id' });
          }
        };
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror = function() { _dbPromise = null; reject(req.error); };
      } catch (e) { _dbPromise = null; reject(e); }
    });
    return _dbPromise;
  }

  function idbPut(storeName, data) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(data);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    }).catch(function() {});
  }

  function idbGetAll(storeName) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { reject(req.error); };
      });
    }).catch(function() { return []; });
  }

  function idbGet(storeName, key) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    }).catch(function() { return null; });
  }

  function idbClear(storeName) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    }).catch(function() {});
  }

  function idbCount(storeName) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).count();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    }).catch(function() { return 0; });
  }

  // ============================================================
  // ANALYTICS OFFLINE QUEUE — Flush when back online
  // ============================================================
  const ANALYTICS_QUEUE_MAX = 200;

  function flushAnalyticsQueue() {
    if (!navigator.onLine || !ANALYTICS_URL) return Promise.resolve();
    return idbGetAll('analyticsQueue').then(function(events) {
      if (!events || events.length === 0) return;
      var sendPromises = events.map(function(evt) {
        try {
          var payload = JSON.stringify(evt);
          if (navigator.sendBeacon) {
            navigator.sendBeacon(ANALYTICS_URL, payload);
          } else {
            fetch(ANALYTICS_URL, { method: 'POST', body: payload, keepalive: true }).catch(function() {});
          }
        } catch (e) {}
      });
      return idbClear('analyticsQueue');
    }).catch(function() {});
  }

  function queueAnalyticsEvent(data) {
    return idbCount('analyticsQueue').then(function(count) {
      if (count >= ANALYTICS_QUEUE_MAX) {
        // Trim oldest: clear and re-add is simplest; acceptable for analytics
        return idbClear('analyticsQueue').then(function() {
          return idbPut('analyticsQueue', data);
        });
      }
      return idbPut('analyticsQueue', data);
    }).catch(function() {});
  }

  // ============================================================
  // trapFocus — accessible modal focus management
  // Marks `el` as a dialog, moves focus in, traps Tab, and returns a release()
  // that restores focus to whatever was focused before it opened. Call on modal
  // open; call the returned fn on close. Safe no-op if el is missing.
  // ============================================================
  function trapFocus(el, opts) {
    if (!el) return function(){};
    opts = opts || {};
    var prevFocus = document.activeElement;
    el.setAttribute('role', el.getAttribute('role') || 'dialog');
    el.setAttribute('aria-modal', 'true');
    var SEL = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function focusables(){
      return Array.prototype.filter.call(el.querySelectorAll(SEL), function(n){
        return n.offsetParent !== null || n === document.activeElement; // visible only
      });
    }
    // Move focus into the dialog (first focusable, else the container itself).
    var f = focusables();
    if (f.length) { try { f[0].focus(); } catch(e){} }
    else { el.setAttribute('tabindex', '-1'); try { el.focus(); } catch(e){} }
    function onKey(e){
      if (e.key !== 'Tab') return;
      var list = focusables();
      if (!list.length) { e.preventDefault(); return; }
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    el.addEventListener('keydown', onKey);
    return function release(){
      el.removeEventListener('keydown', onKey);
      // Restore focus to the trigger (unless the caller opted out or it's gone).
      if (!opts.noRestore && prevFocus && typeof prevFocus.focus === 'function' &&
          document.contains(prevFocus)) {
        try { prevFocus.focus(); } catch(e){}
      }
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    // Version info
    VERSION,
    APP_NAME,

    // a11y
    trapFocus,

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
    flushAnalyticsQueue,
    getSessionId,
    getUserId,
    hasAnalyticsConsent,
    getAnalyticsUrl: function() { return ANALYTICS_URL; },
    getAdminGasUrl: function() { return ADMIN_GAS_URL; },

    // IndexedDB helpers
    idbPut,
    idbGet,
    idbGetAll,

    // Service Worker & Version Check
    registerSW,
    startVersionCheck,
    isLineInApp, // LINE in-app / LIFF WebView detection (used by site-chrome, index)

    // What's New popup (release notes)
    showWhatsNew,
    maybeShowWhatsNew,

    // Utility helpers
    generateId,
    debounce,
    fmt,
    dom,
    delegate,

    // Security — canonical HTML escaper (XSS hardening, ROADMAP P3.1). Use on any
    // user- or GAS/Sheet-derived string before putting it into innerHTML or a
    // quoted HTML attribute. Escapes & < > " ' ; nullish → '' (no "undefined").
    escHtml: function(s) {
      return (s == null ? '' : String(s))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // Clinical Decision Support — reference links
    REF_LINKS: {
      thaiFDA: 'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/FRM_SEARCH_DRUG.aspx',
      nlem: 'https://nlem.hss.moph.go.th/',
      kdigo: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/'
    },

    // Theme
    toggleTheme: null // set by ThemeManager below
  };
})();

// ============================================================
// THEME MANAGER — Unified dark/light toggle, persists to localStorage
// ============================================================
(function(){
  var STORAGE_KEY = 'ivdrug_theme';
  // SVG icons (Feather-style): sun, moon, monitor
  var SVG_SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var SVG_MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SVG_AUTO = '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  var LABELS = { light: '\u0E2A\u0E27\u0E48\u0E32\u0E07', dark: '\u0E21\u0E37\u0E14', auto: '\u0E15\u0E32\u0E21\u0E23\u0E30\u0E1A\u0E1A' };
  var CYCLE = ['auto','light','dark'];

  function getStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch(e) { return null; }
  }

  function getEffective(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(pref) {
    var effective = getEffective(pref);
    var root = document.documentElement;
    if (pref === 'light' || pref === 'dark') {
      root.setAttribute('data-theme', pref);
    } else {
      root.removeAttribute('data-theme');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = effective === 'dark' ? '#0f172a' : '#ffffff';
    updateButton(pref);
  }

  function updateButton(pref) {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    var effective = getEffective(pref);
    btn.innerHTML = pref === 'auto' ? SVG_AUTO : (effective === 'dark' ? SVG_SUN : SVG_MOON);
    btn.title = '\u0E18\u0E35\u0E21: ' + LABELS[pref || 'auto'];
  }

  function toggle() {
    var current = getStored() || 'auto';
    var idx = CYCLE.indexOf(current);
    var next = CYCLE[(idx + 1) % CYCLE.length];
    try { localStorage.setItem(STORAGE_KEY, next); } catch(e) {}
    apply(next);
    return next;
  }

  function injectButton() {
    // Pick the best container for each page layout
    var container = document.querySelector('.header-top')      // index, compatibility
                 || document.querySelector('.header-actions')   // dashboard
                 || document.querySelector('.header-inner')     // tdm
                 || document.querySelector('div.header')        // calculator, renal, vanco-tdm
                 || document.querySelector('.header');
    if (!container) return;
    if (document.getElementById('themeToggleBtn')) return; // already injected
    var btn = document.createElement('button');
    btn.id = 'themeToggleBtn';
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', '\u0E2A\u0E25\u0E31\u0E1A\u0E18\u0E35\u0E21');
    btn.onclick = function(e) { e.preventDefault(); toggle(); };
    container.appendChild(btn);
    updateButton(getStored() || 'auto');
  }

  // Initialize immediately to prevent flash
  apply(getStored() || 'auto');

  // Listen for OS theme changes (auto mode)
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      var pref = getStored() || 'auto';
      if (pref === 'auto') apply('auto');
    });
  } catch(e) {}

  // Inject toggle button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

  IVDrugRef.toggleTheme = toggle;
})();

// ============================================================
// NORMALIZE CACHED DRUG DATA — Fix GAS strings before index.js
// ============================================================
(function(){
  try{
    var raw=localStorage.getItem('drugData_v4');

    // If localStorage is empty, try restoring from IndexedDB backup
    if(!raw){
      IVDrugRef.idbGet('drugDataBackup','main').then(function(backup){
        if(backup&&backup.drugs&&backup.drugs.length>0){
          try{
            localStorage.setItem('drugData_v4',JSON.stringify(backup.drugs));
            localStorage.setItem('iv_drugref_last_sync',String(backup.timestamp||Date.now()));
            console.log('[Core] Restored '+backup.drugs.length+' drugs from IndexedDB backup');
            // Reload ONLY where the restored data is actually consumed: the
            // index page (drugList) with an empty DRUGS array. `window.DRUGS`
            // never exists (top-level `let` doesn't attach to window), so the
            // old guard was always-true and reloaded EVERY page once.
            var needsReload=false;
            try{
              needsReload=!!document.getElementById('drugList')&&
                (typeof DRUGS==='undefined'||!DRUGS||DRUGS.length===0);
            }catch(err){}
            if(needsReload)window.location.reload();
          }catch(e){}
        }
      });
      return;
    }

    var drugs=JSON.parse(raw);
    if(!Array.isArray(drugs))return;
    var fixed=false;
    // NOTE: no early `return` inside this forEach — a `return` after parsing
    // monitoring used to skip normalizing categories/reconst/… for that drug.
    drugs.forEach(function(d){
      if(d.monitoring&&typeof d.monitoring==='string'){
        var v=d.monitoring.trim(),vp=null;
        if(v[0]==='['){try{vp=JSON.parse(v)}catch(e){}}
        d.monitoring=vp||v.split(',').map(function(s){return s.trim()}).filter(Boolean);
        fixed=true;
      }
      if(d.categories&&typeof d.categories==='string'){
        var c=d.categories.trim(),cp=null;
        if(c[0]==='['){try{cp=JSON.parse(c)}catch(e){}}
        d.categories=cp||c.split(',').map(function(s){return s.trim()}).filter(Boolean);
        fixed=true;
      }
      ['reconst','dilution','admin','stability','compat'].forEach(function(k){
        if(d[k]&&typeof d[k]==='string'){try{d[k]=JSON.parse(d[k]);fixed=true}catch(e){}}
      });
    });
    if(fixed)localStorage.setItem('drugData_v4',JSON.stringify(drugs));

    // Backup to IndexedDB (fire-and-forget).
    // last_sync must reflect when data was actually FETCHED (drugData_v4_ts,
    // stamped by the fetch path) — stamping Date.now() on every page load made
    // the offline banner report week-old data as "just synced".
    if(drugs.length>0){
      var syncTs=Number(localStorage.getItem('drugData_v4_ts'));
      if(!isFinite(syncTs)||syncTs<=0){
        syncTs=Number(localStorage.getItem('iv_drugref_last_sync'))||Date.now();
      }
      localStorage.setItem('iv_drugref_last_sync',String(syncTs));
      IVDrugRef.idbPut('drugDataBackup',{id:'main',drugs:drugs,timestamp:syncTs});
    }
  }catch(e){}
})();

// ============================================================
// OFFLINE BANNER — Persistent indicator across all pages
// ============================================================
(function(){
  function formatThaiDate(ts){
    if(!ts)return 'ไม่ทราบ';
    var d=new Date(Number(ts));
    if(isNaN(d.getTime()))return 'ไม่ทราบ';
    var day=String(d.getDate()).padStart(2,'0');
    var month=String(d.getMonth()+1).padStart(2,'0');
    var year=d.getFullYear()+543; // Buddhist Era
    var hour=String(d.getHours()).padStart(2,'0');
    var min=String(d.getMinutes()).padStart(2,'0');
    return day+'/'+month+'/'+year+' '+hour+':'+min;
  }

  var banner=document.createElement('div');
  banner.id='offline-banner';
  banner.className='offline-banner';
  banner.setAttribute('role','status');
  banner.setAttribute('aria-live','polite');
  document.body.appendChild(banner);

  function showBanner(){
    var lastSync=localStorage.getItem('iv_drugref_last_sync');
    banner.textContent='\u26A0 \u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C\u0E42\u0E2B\u0E21\u0E14 \u2014 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D '+formatThaiDate(lastSync);
    banner.classList.add('visible');
    document.body.classList.add('has-offline-banner');
  }

  function hideBanner(){
    banner.classList.remove('visible');
    document.body.classList.remove('has-offline-banner');
    // Flush queued analytics after coming back online
    setTimeout(function(){
      if(IVDrugRef.flushAnalyticsQueue)IVDrugRef.flushAnalyticsQueue();
    },2000);
  }

  window.addEventListener('online',hideBanner);
  window.addEventListener('offline',showBanner);

  // Check initial state
  if(!navigator.onLine)showBanner();
})();

// ============================================================
// GLOBAL ESC KEY — Close topmost modal/sheet/overlay
// ============================================================
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;

  // Skip if user is in a contenteditable or input that handles Escape itself
  var tag = (document.activeElement || {}).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    document.activeElement.blur();
    return;
  }

  // --- index.html modals (highest z-index first) ---

  // Quick Actions panel/FAB (z:1001/350) — handled by quick-actions.js already

  // Filter sheet (z:1000)
  var filterSheet = document.getElementById('filterSheet');
  if (filterSheet && filterSheet.classList.contains('open')) {
    if (typeof closeFilterSheet === 'function') closeFilterSheet();
    return;
  }

  // NPS survey bottom sheet (dynamically injected)
  var npsSheet = document.getElementById('npsSheet');
  if (npsSheet && npsSheet.classList.contains('open')) {
    if (typeof dismissNPS === 'function') dismissNPS();
    return;
  }

  // Urgent alert modal (dynamically created, removed on close)
  var urgentModal = document.getElementById('urgentModal');
  if (urgentModal) {
    // closeUrgentModal is a delegate ACTION in the blob, not a global function —
    // fall back to removing the modal directly or Esc silently did nothing here.
    if (typeof closeUrgentModal === 'function') closeUrgentModal();
    else urgentModal.remove();
    return;
  }

  // Expanded drug card (toggleCard takes drug ID)
  var expandedCard = document.querySelector('[data-drug-id].expanded');
  if (expandedCard) {
    var drugId = parseInt(expandedCard.getAttribute('data-drug-id'));
    if (drugId && typeof toggleCard === 'function') toggleCard(drugId);
    return;
  }

  // --- admin.html modals (z:500) ---
  var diffModal = document.getElementById('diff-modal');
  if (diffModal && diffModal.classList.contains('open')) {
    if (typeof closeDiffModal === 'function') closeDiffModal();
    return;
  }
  var drugModal = document.getElementById('drug-modal');
  if (drugModal && drugModal.classList.contains('open')) {
    if (typeof closeDrugModal === 'function') closeDrugModal();
    return;
  }
  var compatModal = document.getElementById('compat-modal');
  if (compatModal && compatModal.classList.contains('open')) {
    if (typeof closeCompatModal === 'function') closeCompatModal();
    return;
  }
  var renalModal = document.getElementById('renal-modal');
  if (renalModal && renalModal.classList.contains('open')) {
    if (typeof closeRenalModal === 'function') closeRenalModal();
    return;
  }
});

// ============================================================
// AUTO-INITIALIZATION
// ============================================================
// Register service worker on page load
document.addEventListener('DOMContentLoaded', () => {
  IVDrugRef.registerSW();
  IVDrugRef.startVersionCheck();
  // Single source of truth for the displayed app version: fill any element with
  // a [data-app-version] attribute from IVDrugRef.VERSION so per-page header
  // badges never go stale on release (static text is the no-JS fallback).
  try {
    document.querySelectorAll('[data-app-version]').forEach(el => {
      el.textContent = 'v' + IVDrugRef.VERSION;
    });
  } catch (e) { /* non-critical */ }

  // "What's New" popup — show once when the app version changed since last open.
  // Deferred a tick so the page chrome/theme is in place before the modal appears.
  try {
    setTimeout(function () { IVDrugRef.maybeShowWhatsNew(); }, 800);
  } catch (e) { /* non-critical */ }
});

// Global entry point for a menu/About "มีอะไรใหม่" link to re-open the notes.
window.showWhatsNew = function () { try { IVDrugRef.showWhatsNew(); } catch (e) {} };
