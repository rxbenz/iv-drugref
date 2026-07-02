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
    },
    cnsDepress: {
      label: 'Additive CNS/respiratory depression (กดประสาท/การหายใจ)', severity: 'major', icon: '😴',
      mechanism: 'ยากดประสาทส่วนกลางหลายตัว (opioid/benzodiazepine/barbiturate/propofol/sedating antihistamine) ร่วมกัน → กดการหายใจและระดับความรู้สึกตัวเสริมกัน — โดยเฉพาะ opioid + benzodiazepine (US FDA Boxed Warning; UpToDate/Lexicomp Risk D)',
      management: 'opioid + benzodiazepine = คู่เสี่ยงสูงสุด (Boxed Warning) — เลี่ยง/ใช้ขนาดต่ำสุด-สั้นที่สุดถ้าจำเป็น. มัก “ตั้งใจ” ใช้ร่วมใน ICU ที่ monitor ได้ — ต้องเฝ้า RR/SpO₂/sedation score, มีอุปกรณ์ช่วยหายใจ + naloxone/flumazenil พร้อม; ระวังมากนอก ICU/ผู้สูงอายุ',
      ref: 'US FDA Boxed Warning; Lexicomp; UpToDate'
    },
    bradycardia: {
      label: 'Additive bradycardia / AV block (หัวใจเต้นช้า)', severity: 'major', icon: '🐢',
      mechanism: 'ยากดอัตราการเต้นหัวใจ/การนำไฟฟ้า (β-blocker + non-DHP CCB + digoxin + amiodarone + dexmedetomidine) ร่วมกัน → bradycardia/AV block รุนแรง',
      management: 'เลี่ยง IV β-blocker ร่วม IV diltiazem/verapamil; ติดตาม HR + ECG ต่อเนื่อง, เตรียม atropine/pacing',
      ref: 'Lexicomp'
    },
    hypotension: {
      label: 'Additive hypotension / vasodilation (ความดันต่ำ)', severity: 'moderate', icon: '📉',
      mechanism: 'ยาขยายหลอดเลือด/ลดความดันหลายตัว (nitrate/nitroprusside/hydralazine/dihydropyridine CCB/milrinone) ร่วมกัน → ความดันโลหิตตกเสริมกัน',
      management: 'titrate ทีละตัว, ติดตาม BP ใกล้ชิด (มัก invasive line), ระวัง reflex tachycardia',
      ref: 'Lexicomp'
    },
    anticholinergic: {
      label: 'Additive anticholinergic burden (ฤทธิ์ต้านโคลิเนอร์จิก)', severity: 'moderate', icon: '🌵',
      mechanism: 'ยาต้านโคลิเนอร์จิกหลายตัว (atropine/glycopyrrolate/hyoscine/antihistamine/benztropine) ร่วมกัน → ปากแห้ง, ปัสสาวะคั่ง, ลำไส้ไม่เคลื่อน (ileus), สับสน/เพ้อ',
      management: 'ประเมินความจำเป็น, ระวัง delirium ในผู้สูงอายุ + urinary retention/ileus, ติดตามอาการ',
      ref: 'Lexicomp'
    }
  };

  // keyword (lowercase substring of generic) → classes it belongs to.
  // Keywords must be substrings of an actual dataset generic (lowercased) to match.
  var CLASS_RULES = [
    // ---- QT prolongation ----
    ['amiodarone', ['QT', 'bradycardia']], ['ciprofloxacin', ['QT']], ['levofloxacin', ['QT']],
    ['moxifloxacin', ['QT']], ['fluconazole', ['QT']], ['voriconazole', ['QT']],
    ['haloperidol', ['QT']], ['ondansetron', ['QT', 'serotonergic']], ['azithromycin', ['QT']],
    ['erythromycin', ['QT']], ['clarithromycin', ['QT']], ['methadone', ['QT', 'serotonergic']],
    ['cotrimoxazole', ['QT', 'hyperK']], ['tigecycline', ['QT']], ['pentamidine', ['QT']],
    // ---- Serotonergic ----
    ['fentanyl', ['serotonergic']], ['remifentanil', ['serotonergic']], ['tramadol', ['serotonergic']],
    ['linezolid', ['serotonergic']], ['metoclopramide', ['serotonergic']],
    ['pethidine', ['serotonergic']], ['meperidine', ['serotonergic']],
    // ---- Nephrotoxic ----
    ['amikacin', ['nephrotoxic', 'ototoxic']], ['gentamicin', ['nephrotoxic', 'ototoxic']],
    ['streptomycin', ['nephrotoxic', 'ototoxic']], ['vancomycin', ['nephrotoxic', 'ototoxic']],
    ['colistin', ['nephrotoxic']], ['colistimethate', ['nephrotoxic']], ['polymyxin', ['nephrotoxic']],
    ['amphotericin', ['nephrotoxic', 'hyperK']], ['acyclovir', ['nephrotoxic']], ['ganciclovir', ['nephrotoxic']],
    ['cisplatin', ['nephrotoxic', 'ototoxic']], ['carboplatin', ['nephrotoxic']], ['foscarnet', ['nephrotoxic']],
    ['ifosfamide', ['nephrotoxic']], ['methotrexate', ['nephrotoxic']],
    ['diclofenac', ['nephrotoxic', 'bleeding']], ['ketorolac', ['nephrotoxic', 'bleeding']],
    ['parecoxib', ['nephrotoxic']], ['furosemide', ['ototoxic']],
    // ---- Bleeding ----
    ['enoxaparin', ['bleeding']], ['heparin', ['bleeding']], ['warfarin', ['bleeding']],
    ['alteplase', ['bleeding']], ['tenecteplase', ['bleeding']], ['streptokinase', ['bleeding']],
    ['abciximab', ['bleeding']], ['eptifibatide', ['bleeding']], ['tirofiban', ['bleeding']],
    // ---- Hyperkalemia ----
    ['potassium', ['hyperK']], ['spironolactone', ['hyperK']],
    // ---- CNS / respiratory depression ----
    ['morphine', ['cnsDepress']], ['fentanyl', ['cnsDepress']], ['remifentanil', ['cnsDepress']],
    ['pethidine', ['cnsDepress']], ['meperidine', ['cnsDepress']], ['tramadol', ['cnsDepress']],
    ['methadone', ['cnsDepress']], ['midazolam', ['cnsDepress']], ['diazepam', ['cnsDepress']],
    ['lorazepam', ['cnsDepress']], ['phenobarbital', ['cnsDepress']], ['thiopental', ['cnsDepress']],
    ['propofol', ['cnsDepress', 'hypotension']], ['ketamine', ['cnsDepress']],
    // ---- Bradycardia / AV block ----
    ['esmolol', ['bradycardia']], ['labetalol', ['bradycardia']], ['metoprolol', ['bradycardia']],
    ['propranolol', ['bradycardia']], ['diltiazem', ['bradycardia']], ['verapamil', ['bradycardia']],
    ['digoxin', ['bradycardia']], ['dexmedetomidine', ['bradycardia']],
    // ---- Hypotension / vasodilation ----
    ['glyceryl trinitrate', ['hypotension']], ['nitroglycerin', ['hypotension']], ['nitroprusside', ['hypotension']],
    ['hydralazine', ['hypotension']], ['nicardipine', ['hypotension']], ['nimodipine', ['hypotension']],
    ['milrinone', ['hypotension']],
    // ---- Anticholinergic ----
    ['atropine', ['anticholinergic']], ['glycopyrrolate', ['anticholinergic']],
    ['hyoscine', ['anticholinergic']], ['chlorpheniramine', ['anticholinergic', 'cnsDepress']],
    ['dimenhydrinate', ['anticholinergic', 'cnsDepress']], ['benztropine', ['anticholinergic']]
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
    },
    {
      a: 'methotrexate', bAny: ['cotrimoxazole', 'tmp', 'smx', 'trimethoprim', 'sulfamethoxazole'], severity: 'major',
      mechanism: 'Cotrimoxazole (TMP/SMX) เสริมฤทธิ์ต้านโฟเลต + ลดการขับ MTX ทางไต → กดไขกระดูกรุนแรง (pancytopenia)',
      management: 'เลี่ยงคู่นี้; ถ้าจำเป็นต้องติดตาม CBC ใกล้ชิด + พิจารณา leucovorin rescue',
      ref: 'Lexicomp'
    },
    {
      a: 'ceftriaxone', bAny: ['calcium chloride', 'calcium gluconate', 'calcium'], severity: 'major',
      mechanism: 'Ceftriaxone จับ calcium เกิดตะกอน ceftriaxone–calcium → ห้ามใช้ร่วม/ผสมสายเดียวกันในทารกแรกเกิด (<28 วัน) เด็ดขาด (เสียชีวิตได้)',
      management: 'ทารกแรกเกิด: ห้ามให้ ceftriaxone กับสารละลายที่มี calcium พร้อมกันโดยสิ้นเชิง; ผู้ป่วยอื่นให้แยกสาย/แยกเวลา + flush สายระหว่างยา',
      ref: 'US FDA; Lexicomp'
    },
    {
      a: 'digoxin', bAny: ['calcium chloride', 'calcium gluconate', 'calcium'], severity: 'major',
      mechanism: 'Calcium IV เพิ่มความไวของกล้ามเนื้อหัวใจต่อ digoxin → เสี่ยง arrhythmia รุนแรง (“stone heart”) โดยเฉพาะถ้า dig เป็นพิษ',
      management: 'เลี่ยง IV calcium ในผู้ป่วยที่ได้ digoxin/สงสัย dig toxicity; ถ้าจำเป็นให้ช้า ๆ + ติดตาม ECG',
      ref: 'Lexicomp'
    },
    {
      a: 'digoxin', b: 'amiodarone', severity: 'major',
      mechanism: 'Amiodarone ลดการขับ digoxin (ยับยั้ง P-gp) → ระดับ digoxin เพิ่ม ~2 เท่า → พิษ digoxin',
      management: 'ลดขนาด digoxin ลงครึ่งหนึ่งเมื่อเริ่ม amiodarone, ติดตามระดับ digoxin + ECG; ระวัง bradycardia เสริม',
      ref: 'Lexicomp'
    },
    {
      a: 'digoxin', bAny: ['diltiazem', 'verapamil'], severity: 'major',
      mechanism: 'Non-DHP CCB เพิ่มระดับ digoxin (ยับยั้ง P-gp) + เสริม bradycardia/AV block',
      management: 'ติดตามระดับ digoxin + HR/ECG, พิจารณาลดขนาด digoxin; ระวัง AV block',
      ref: 'Lexicomp'
    },
    {
      a: 'amiodarone', b: 'warfarin', severity: 'major',
      mechanism: 'Amiodarone ยับยั้ง CYP2C9 → ↑ฤทธิ์ warfarin → INR สูง/เลือดออก (ผลอยู่นานหลายสัปดาห์เพราะ amiodarone half-life ยาว)',
      management: 'ลดขนาด warfarin ~30–50% เมื่อเริ่ม amiodarone, ติดตาม INR ถี่ขึ้น',
      ref: 'Lexicomp'
    },
    {
      aAny: ['amikacin', 'gentamicin', 'streptomycin', 'tobramycin', 'neomycin'],
      bAny: ['atracurium', 'cisatracurium', 'rocuronium', 'vecuronium', 'pancuronium', 'succinylcholine'],
      severity: 'major',
      mechanism: 'Aminoglycoside เสริมฤทธิ์ยาคลายกล้ามเนื้อ (neuromuscular blockade) → อัมพาต/กดการหายใจนานขึ้น',
      management: 'เฝ้าระวังการฟื้นของกล้ามเนื้อ (train-of-four), อาจต้องช่วยหายใจนานขึ้น; ระวังในผู้ป่วยไตเสื่อม',
      ref: 'Lexicomp'
    },
    {
      a: 'magnesium',
      bAny: ['atracurium', 'cisatracurium', 'rocuronium', 'vecuronium', 'pancuronium', 'succinylcholine'],
      severity: 'moderate',
      mechanism: 'Magnesium เสริมฤทธิ์ยาคลายกล้ามเนื้อ → block ลึก/นานขึ้น',
      management: 'ลดขนาด NMBA, ติดตาม neuromuscular monitoring, ระวังกดการหายใจ',
      ref: 'Lexicomp'
    },
    {
      a: 'phenytoin', bAny: ['valpro'], severity: 'moderate',
      mechanism: 'Valproate แย่งจับโปรตีน + ยับยั้งเมแทบอลิซึมของ phenytoin → free phenytoin สูงขึ้น (total อาจดูปกติ)',
      management: 'แปลผลด้วย free phenytoin หรือปรับตาม albumin, ติดตามอาการพิษ (nystagmus/ataxia)',
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

  // ── Remote (admin-managed) override ─────────────────────────────────
  // The curated pairs + class tags above are the BUILT-IN defaults (and the
  // offline fallback). When the admin maintains them in Supabase (ddi_pairs /
  // ddi_class_rules, public-read), we replace the in-memory tables so the live
  // screen reflects edits without a code change — exactly like compatibility.js
  // pulls compat_pairs. If the tables are missing/empty or the fetch fails, the
  // built-in defaults stay. CLASS_DEFS (class metadata) is NOT remote — it's
  // structural and edited in code.
  var SB_URL = 'https://bzwbagojjpiazbeaahmg.supabase.co';
  var SB_KEY = 'sb_publishable_W-06i5yY0YHlcEGFVYQKnA_asoFaH4S';
  var LS_KEY = 'ddiData_v3', LS_TS = 'ddiData_v3_ts';   // v3: merge-over-defaults (was replace)
  var VALID_CLASSES = Object.keys(CLASS_DEFS);

  // Pristine code defaults — the guaranteed SAFETY FLOOR. loadRemote() MERGES the
  // admin's Supabase data OVER these; it never REPLACES them. This is deliberate:
  // for a clinical screen, an incomplete/stale remote table must NEVER be able to
  // silently drop a vetted interaction (that's exactly the Midazolam+Morphine bug —
  // the remote ddi_class_rules was missing cnsDepress tags and wiped the code set).
  // Captured once so every re-sync re-merges from the ORIGINAL defaults, not from a
  // previously-merged (possibly already-augmented) working set.
  var DEFAULT_CLASS_RULES = CLASS_RULES.slice();
  var DEFAULT_CURATED = CURATED_DDI.slice();

  // Tolerant array parse. A remote jsonb field SHOULD arrive as a real array (the
  // Supabase public read returns native JSON), but a manual SQL insert or a future
  // write path could stringify it ('["x"]'). Coerce defensively so ONE malformed
  // row can't throw inside the merge and abort the whole _applyRemote (which would
  // silently discard ALL remote pairs+rules AND skip the class-rule merge/onUpdate).
  function _arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    return [];
  }
  // Case-insensitive canonical class lookup: defaults use camelCase ('cnsDepress'),
  // but a remote token in any casing ('cnsdepress') should still resolve to the class.
  var _CLASS_CANON = {};
  VALID_CLASSES.forEach(function (c) { _CLASS_CANON[c.toLowerCase()] = c; });

  // Side-identity of a curated pair = sorted(sideA, sideB), IGNORING severity, so an
  // admin editing a pair's severity/mechanism overrides the default in place instead
  // of producing a duplicate finding.
  function _pairIdentity(p) {
    function side(single, anyRaw) {
      var any = _arr(anyRaw);
      return any.length
        ? any.map(function (x) { return String(x).toLowerCase().trim(); }).sort().join('+')
        : String(single || '').toLowerCase().trim();
    }
    return [side(p.a, p.aAny), side(p.b, p.bAny)].sort().join('|');
  }
  // Curated pairs: code ∪ remote by side-identity. A remote pair with the same
  // identity OVERRIDES the code default (admin can edit); new identities are added;
  // code pairs the admin never touched are always kept. aAny/bAny are coerced to real
  // arrays on store so downstream _matchKw never iterates a stray string.
  function _mergeCurated(remotePairs) {
    var map = {}, order = [];
    function put(p) {
      if (!p) return;
      var aA = _arr(p.aAny), bA = _arr(p.bAny);
      if (!((p.a || aA.length) && (p.b || bA.length))) return;
      var norm = Object.assign({}, p, { aAny: aA, bAny: bA });
      var id = _pairIdentity(norm); if (!(id in map)) order.push(id); map[id] = norm;
    }
    DEFAULT_CURATED.forEach(put);
    (_arr(remotePairs)).forEach(put);   // remote wins on same id
    return order.map(function (id) { return map[id]; });
  }
  // Class rules: code ∪ remote, classes UNIONed per keyword. The union means admin
  // can ADD keywords or ADD classes to a keyword, but can never REMOVE a code-vetted
  // safety tag from the live screen — the floor holds. (Removing/correcting a wrong
  // default tag is a code change, verified via docs/ddi-verify.html, by design.)
  function _mergeClassRules(remoteRules) {
    var map = {};   // keyword → { canonicalClass: 1 }
    function add(kw, classesRaw) {
      kw = String(kw == null ? '' : kw).toLowerCase().trim();
      if (!kw) return;
      if (!map[kw]) map[kw] = {};
      _arr(classesRaw).forEach(function (c) {
        var canon = _CLASS_CANON[String(c == null ? '' : c).toLowerCase().trim()];
        if (canon) map[kw][canon] = 1;
      });
    }
    DEFAULT_CLASS_RULES.forEach(function (r) { add(r[0], r[1] || []); });
    (_arr(remoteRules)).forEach(function (r) {
      if (r && r.keyword) add(r.keyword, r.classes);
    });
    return Object.keys(map).map(function (kw) { return [kw, Object.keys(map[kw])]; })
      .filter(function (x) { return x[1].length; });
  }

  // Install a remote payload ({pairs, rules}) MERGED over the code defaults.
  // Always returns true: the merge yields at least the code floor, so the working
  // tables are always (re)installed and the host re-renders. Idempotent — calling
  // with an empty/absent payload cleanly resets the working tables to pure defaults.
  function _applyRemote(payload) {
    payload = payload || {};
    CURATED_DDI = _mergeCurated(payload.pairs);
    CLASS_RULES = _mergeClassRules(payload.rules);
    if (typeof window.DrugInteractions === 'object' &&
        typeof window.DrugInteractions.onUpdate === 'function') {
      try { window.DrugInteractions.onUpdate(); } catch (e) { /* host re-render is best-effort */ }
    }
    return true;
  }

  // Returns {ok, data} so the caller can tell a real (possibly empty) answer from
  // a network failure — critical for fetch-first: an online empty table must use
  // code defaults, NOT a stale cache.
  function _supaGet(table) {
    return fetch(SB_URL + '/rest/v1/' + table + '?select=data', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) return { ok: false, data: [] };
      return r.json().then(function (rows) {
        return { ok: true, data: Array.isArray(rows) ? rows.map(function (x) { return x.data; }).filter(Boolean) : [] };
      });
    }).catch(function () { return { ok: false, data: [] }; });
  }

  // FETCH-FIRST: when online, the live Supabase answer is authoritative (so admin
  // edits always show); the localStorage cache is used ONLY as an offline fallback.
  // (The old warm-then-fetch order could leave a stale cached value on screen.)
  function loadRemote() {
    Promise.all([_supaGet('ddi_pairs'), _supaGet('ddi_class_rules')]).then(function (res) {
      var pRes = res[0], rRes = res[1];
      if (pRes.ok || rRes.ok) {
        // Got a real response from Supabase → use it (empty ⇒ code defaults stay).
        var payload = { pairs: pRes.data, rules: rRes.data };
        _applyRemote(payload);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(payload));
          localStorage.setItem(LS_TS, String(Date.now()));
        } catch (e) { /* storage full — non-fatal */ }
        if (window.console) console.log('[DDI] synced ' + payload.pairs.length + ' pairs / ' + payload.rules.length + ' class rules from Supabase (live)');
      } else {
        // Both fetches failed (offline) → warm from the last-synced cache.
        try {
          var c = localStorage.getItem(LS_KEY);
          if (c) { _applyRemote(JSON.parse(c)); if (window.console) console.log('[DDI] offline — using cached data'); }
        } catch (e) { /* ignore cache errors */ }
      }
    });
  }

  window.DrugInteractions = {
    check: check, renderHtml: renderHtml, loadRemote: loadRemote,
    onUpdate: null,                       // host (interactions.js) sets this to re-render
    // _CURATED / _CLASS_RULES_SEED expose the pristine BUILT-IN defaults (the merge
    // floor) so the admin "Import Defaults" seed always reflects the in-code defaults,
    // never the merged/remote working tables.
    _CLASS_DEFS: CLASS_DEFS, _CURATED: DEFAULT_CURATED, _CLASS_RULES_SEED: DEFAULT_CLASS_RULES,
    _applyRemote: _applyRemote        // exposed for tests (merge-over-defaults semantics)
  };

  // Auto-sync on load (browser only; the Node test harness has no fetch/localStorage
  // and never calls this, so the built-in defaults are what the tests lock).
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try { loadRemote(); } catch (e) { /* defaults remain */ }
  }
})();
