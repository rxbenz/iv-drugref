// ============================================================================
// Drug–Drug Interaction (DDI) checker — Phase 0 (class-collision engine)
// ============================================================================
// This is PHARMACOLOGICAL interaction screening — distinct from the page's IV
// (physical/Y-site) compatibility. It runs on the SAME multi-drug picker on the
// compatibility page and appends its findings below the compatibility result.
//
// Model (hybrid, transparent, intentionally NOT a full Lexicomp clone):
//   A) Additive-risk CLASS tags per drug (QT, serotonergic, nephrotoxic,
//      bleeding, hyperK, ototoxic). When ≥2 selected drugs share a class, the
//      engine flags the additive risk automatically — scales without authoring
//      N² pairs.
//   B) A small set of CURATED explicit pairs for specific named interactions
//      that the class model can't express (e.g. valproate + carbapenem).
//
// SAFETY: decision-support only, NOT exhaustive. Every result shows mechanism +
// management + reference, and the section carries a "verify at source / not
// complete" disclaimer. Drug names are matched by lowercase keyword (same idea
// as the dose-calculator's _calcIdFor) and escaped before display.
// ============================================================================
(function () {
  'use strict';

  // ---- Additive-risk classes: ≥2 members in the list → additive-risk finding ----
  var CLASS_DEFS = {
    QT: {
      label: 'QT prolongation (เสี่ยง Torsades)', severity: 'major', icon: '💓',
      mechanism: 'ยาหลายตัวที่ยืด QT ใช้ร่วมกัน → ยืด QTc เสริมกัน → เสี่ยง Torsades de Pointes',
      management: 'เลี่ยงใช้ร่วมถ้าทำได้; ตรวจ ECG (baseline + ระหว่างให้), แก้ K⁺/Mg²⁺ ให้ปกติ, ระวังในผู้สูงอายุ/หัวใจ',
      ref: 'CredibleMeds; Lexicomp'
    },
    serotonergic: {
      label: 'Serotonin syndrome', severity: 'major', icon: '🧠',
      mechanism: 'ยา serotonergic หลายตัวร่วมกัน → serotonin มากเกิน → ไข้สูง, สั่น, clonus, สับสน',
      management: 'เฝ้าระวังอาการ (clonus/hyperthermia/agitation); เลี่ยงใช้ร่วมหลายตัว โดยเฉพาะกับ MAOI/linezolid',
      ref: 'Lexicomp'
    },
    nephrotoxic: {
      label: 'Additive nephrotoxicity (พิษต่อไต)', severity: 'major', icon: '🫘',
      mechanism: 'ยาพิษต่อไตหลายตัวร่วมกัน → เสริมความเสียหายต่อไต',
      management: 'ติดตาม SCr/UO ทุกวัน, ให้สารน้ำเพียงพอ, เลี่ยงใช้ร่วมถ้าทำได้, ปรับขนาดตามไต',
      ref: 'Lexicomp'
    },
    bleeding: {
      label: 'Additive bleeding risk (เลือดออก)', severity: 'major', icon: '🩸',
      mechanism: 'ยาที่เพิ่มความเสี่ยงเลือดออก (anticoagulant/antiplatelet/NSAID/thrombolytic) ร่วมกัน → เลือดออกมากขึ้น',
      management: 'ประเมินความเสี่ยง-ประโยชน์, ติดตามอาการเลือดออก/Hb, พิจารณา PPI ป้องกัน GI bleed',
      ref: 'Lexicomp'
    },
    hyperK: {
      label: 'Additive hyperkalemia (K⁺ สูง)', severity: 'moderate', icon: '⚡',
      mechanism: 'ยา/สารที่เพิ่ม K⁺ ร่วมกัน → K⁺ ในเลือดสูง → เสี่ยงหัวใจเต้นผิดจังหวะ',
      management: 'ติดตาม K⁺ และ ECG, ระวังในผู้ป่วยไตเสื่อม',
      ref: 'Lexicomp'
    },
    ototoxic: {
      label: 'Additive ototoxicity (พิษต่อหู)', severity: 'moderate', icon: '👂',
      mechanism: 'ยาพิษต่อหู (aminoglycoside/vancomycin/loop diuretic/cisplatin) ร่วมกัน → เสริมความเสียหายต่อการได้ยิน/สมดุล',
      management: 'ติดตามการได้ยิน/อาการเวียน, เลี่ยงใช้ร่วมระยะยาว, ติดตามระดับยา (TDM)',
      ref: 'Lexicomp'
    }
  };

  // keyword (lowercase substring of generic) → classes it belongs to
  var CLASS_RULES = [
    ['amiodarone', ['QT']], ['ciprofloxacin', ['QT']], ['levofloxacin', ['QT']],
    ['moxifloxacin', ['QT']], ['fluconazole', ['QT']], ['voriconazole', ['QT']],
    ['haloperidol', ['QT']], ['ondansetron', ['QT', 'serotonergic']], ['azithromycin', ['QT']],
    ['erythromycin', ['QT']], ['clarithromycin', ['QT']], ['methadone', ['QT']],
    ['fentanyl', ['serotonergic']], ['tramadol', ['serotonergic']], ['linezolid', ['serotonergic']],
    ['metoclopramide', ['serotonergic']], ['pethidine', ['serotonergic']], ['meperidine', ['serotonergic']],
    ['amikacin', ['nephrotoxic', 'ototoxic']], ['gentamicin', ['nephrotoxic', 'ototoxic']],
    ['streptomycin', ['nephrotoxic', 'ototoxic']], ['vancomycin', ['nephrotoxic', 'ototoxic']],
    ['colistin', ['nephrotoxic']], ['colistimethate', ['nephrotoxic']],
    ['amphotericin', ['nephrotoxic']], ['acyclovir', ['nephrotoxic']], ['ganciclovir', ['nephrotoxic']],
    ['cisplatin', ['nephrotoxic', 'ototoxic']], ['foscarnet', ['nephrotoxic']],
    ['diclofenac', ['nephrotoxic', 'bleeding']], ['ketorolac', ['nephrotoxic', 'bleeding']],
    ['parecoxib', ['nephrotoxic']], ['furosemide', ['ototoxic']],
    ['enoxaparin', ['bleeding']], ['heparin', ['bleeding']], ['warfarin', ['bleeding']],
    ['alteplase', ['bleeding']], ['tenecteplase', ['bleeding']], ['streptokinase', ['bleeding']],
    ['potassium', ['hyperK']]
  ];

  // ---- Curated explicit pairs (named interactions the class model can't express) ----
  // Match: a (or aAny[]) AND b (or bAny[]) both present among the selected drugs.
  var CURATED_DDI = [
    {
      a: 'valpro', bAny: ['meropenem', 'ertapenem', 'imipenem', 'penem'], severity: 'major',
      mechanism: 'Carbapenem ลดระดับ valproate ในเลือด 60–100% ภายใน 24 ชม. (กลไกหลายอย่างรวมกัน)',
      management: 'เลี่ยงคู่นี้; ถ้าจำเป็นต้องใช้ carbapenem → เปลี่ยน/เสริมยากันชักอื่น + ติดตามระดับ VPA และอาการชักใกล้ชิด',
      ref: 'Lexicomp; ASHP'
    },
    {
      a: 'linezolid',
      bAny: ['adrenaline', 'epinephrine', 'noradrenaline', 'norepinephrine', 'dopamine', 'ephedrine', 'phenylephrine'],
      severity: 'major',
      mechanism: 'Linezolid = weak MAOI → เสริมฤทธิ์ sympathomimetic → ความดันโลหิตสูงวิกฤต',
      management: 'เริ่ม vasopressor ขนาดต่ำแล้ว titrate ระวัง; เลี่ยงถ้าเป็นไปได้; เฝ้าระวัง BP',
      ref: 'Lexicomp'
    },
    {
      a: 'digoxin', bAny: ['furosemide', 'amphotericin'], severity: 'major',
      mechanism: 'ยาทำให้ K⁺/Mg²⁺ ต่ำ → เพิ่มความไวของหัวใจต่อ digoxin → ↑พิษ digoxin',
      management: 'ติดตามและแก้ K⁺/Mg²⁺ ให้ปกติ, ติดตามระดับ digoxin และ ECG',
      ref: 'Lexicomp'
    },
    {
      a: 'methotrexate', bAny: ['diclofenac', 'parecoxib', 'ketorolac', 'ibuprofen', 'naproxen'], severity: 'major',
      mechanism: 'NSAID ลดการขับ methotrexate ทางไต → ↑ระดับ/พิษ MTX (สำคัญมากใน high-dose MTX)',
      management: 'เลี่ยง NSAID ในช่วง high-dose MTX; ถ้า low-dose ติดตาม CBC/ไต',
      ref: 'Lexicomp'
    }
  ];

  var SEV_ORDER = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };

  function _classesFor(gl) {
    var set = {};
    for (var i = 0; i < CLASS_RULES.length; i++) {
      if (gl.indexOf(CLASS_RULES[i][0]) >= 0) {
        CLASS_RULES[i][1].forEach(function (c) { set[c] = 1; });
      }
    }
    return Object.keys(set);
  }
  function _matchKw(drugs, kw, kwAny) {
    if (kw) { for (var i = 0; i < drugs.length; i++) if (drugs[i].gl.indexOf(kw) >= 0) return drugs[i]; }
    if (kwAny) {
      for (var j = 0; j < drugs.length; j++) {
        for (var k = 0; k < kwAny.length; k++) if (drugs[j].gl.indexOf(kwAny[k]) >= 0) return drugs[j];
      }
    }
    return null;
  }

  // genericNames: array of drug generic strings → array of findings (severity-sorted).
  function check(genericNames) {
    var drugs = (genericNames || []).filter(Boolean).map(function (g) {
      var gl = String(g).toLowerCase();
      return { name: g, gl: gl, classes: _classesFor(gl) };
    });
    if (drugs.length < 2) return [];
    var findings = [];

    // A) class collisions
    Object.keys(CLASS_DEFS).forEach(function (cls) {
      var members = drugs.filter(function (d) { return d.classes.indexOf(cls) >= 0; });
      if (members.length >= 2) {
        var def = CLASS_DEFS[cls];
        findings.push({
          kind: 'class', cls: cls, severity: def.severity, icon: def.icon, title: def.label,
          drugs: members.map(function (m) { return m.name; }),
          mechanism: def.mechanism, management: def.management, ref: def.ref
        });
      }
    });

    // B) curated pairs
    CURATED_DDI.forEach(function (p) {
      var a = _matchKw(drugs, p.a, p.aAny);
      var b = _matchKw(drugs, p.b, p.bAny);
      if (a && b && a !== b) {
        findings.push({
          kind: 'pair', severity: p.severity, icon: '⚠️',
          title: a.name + ' + ' + b.name, drugs: [a.name, b.name],
          mechanism: p.mechanism, management: p.management, ref: p.ref
        });
      }
    });

    findings.sort(function (x, y) { return (SEV_ORDER[x.severity] || 9) - (SEV_ORDER[y.severity] || 9); });
    return findings;
  }

  var SEV_LABEL = {
    contraindicated: { t: 'ห้ามใช้ร่วม', c: '#dc2626', bg: '#fef2f2', bd: '#fecaca' },
    major: { t: 'รุนแรง (Major)', c: '#ea580c', bg: '#fff7ed', bd: '#fed7aa' },
    moderate: { t: 'ปานกลาง (Moderate)', c: '#ca8a04', bg: '#fefce8', bd: '#fde68a' },
    minor: { t: 'เล็กน้อย (Minor)', c: '#64748b', bg: '#f8fafc', bd: '#e2e8f0' }
  };
  function _esc(s) {
    return (window.IVDrugRef && IVDrugRef.escHtml) ? IVDrugRef.escHtml(s) : String(s == null ? '' : s);
  }

  // Build the DDI section HTML for the given selected generics.
  function renderHtml(genericNames) {
    var findings = check(genericNames);
    var head = '<div class="ddi-section"><div class="ddi-head">⚠️ อันตรกิริยาระหว่างยา (Drug Interaction)</div>';
    var disclaimer = '<div class="ddi-disclaimer">เป็นการคัดกรองเบื้องต้น (high-alert + class-based) '
      + '<strong>ไม่ครอบคลุมทุก interaction</strong> — ตรวจซ้ำกับแหล่งอ้างอิงและใช้วิจารณญาณเสมอ</div>';
    if (!findings.length) {
      return head + '<div class="ddi-none">✓ ไม่พบ interaction สำคัญในชุดที่คัดกรอง (ระหว่างยาที่เลือก)</div>'
        + disclaimer + '</div>';
    }
    var cards = findings.map(function (f) {
      var s = SEV_LABEL[f.severity] || SEV_LABEL.minor;
      return '<div class="ddi-card" style="border-color:' + s.bd + ';background:' + s.bg + ';">'
        + '<div class="ddi-card-top"><span class="ddi-badge" style="color:' + s.c + ';border-color:' + s.bd + ';">' + s.t + '</span>'
        + '<span class="ddi-title">' + f.icon + ' ' + _esc(f.title) + '</span></div>'
        + '<div class="ddi-drugs">' + f.drugs.map(_esc).join(' + ') + '</div>'
        + '<div class="ddi-row"><b>กลไก:</b> ' + _esc(f.mechanism) + '</div>'
        + '<div class="ddi-row"><b>จัดการ:</b> ' + _esc(f.management) + '</div>'
        + '<div class="ddi-ref">📚 ' + _esc(f.ref) + '</div></div>';
    }).join('');
    return head + cards + disclaimer + '</div>';
  }

  window.DrugInteractions = { check: check, renderHtml: renderHtml, _CLASS_DEFS: CLASS_DEFS, _CURATED: CURATED_DDI };
})();
