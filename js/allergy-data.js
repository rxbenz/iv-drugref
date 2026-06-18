/**
 * js/allergy-data.js — Allergy cross-reactivity data + engine (Phase 2)
 *
 * Hybrid model (decision: option C):
 *   1) R1 side-chain CLUSTERS + DRUGS registry  (structural base)
 *   2) computeRelation() rule engine            (auto-derives tier/%)
 *   3) OVERRIDES for special pairs              (curated, evidence-pinned)
 *   4) SEVERITY gating                         (mild / IgE / SCAR / unknown)
 *
 * All clinical values are verified against primary full-text and approved by
 * the project-owner pharmacist (2026-06-18). Source of truth + citations:
 *   docs/allergy-cross-reactivity.md  (Phase 1, beta-lactam scope)
 *
 * Scope: beta-lactam only. Non-beta-lactam = alternatives list (NON_BETA_LACTAM).
 * UI strings are Thai; code/comments English (project convention).
 */
;(function (root) {
  'use strict';

  // --- 1. References (cited by tiers/overrides) -----------------------------
  const REFS = {
    khan2022:   'Khan DA, et al. Drug allergy: 2022 practice parameter update. JACI 2022;150(6):1333-1393.',
    blumenthal2019: 'Blumenthal KG, et al. Antibiotic allergy. Lancet 2019;393:183-198.',
    picard2019: 'Picard M, et al. Cross-reactivity to cephalosporins & carbapenems: two systematic reviews & meta-analyses. JACI Pract 2019;7(8):2722-2738.',
    zagursky2018: 'Zagursky RJ, Pichichero ME. Cross-reactivity in beta-lactam allergy. JACI Pract 2018;6(1):72-81.',
    romano2016: 'Romano A, et al. Cross-reactivity & tolerability of aztreonam/cephalosporins in T-cell-mediated penicillin hypersensitivity. JACI 2016.',
    pharmReview: 'Cephalosporins: A Focus on Side Chains and beta-Lactam Cross-Reactivity. Pharmacy (review) PMC6789778.',
    jaa2021:    'beta-Lactam Allergy and Cross-Reactivity: A Clinician’s Guide. J Asthma Allergy 2021. PMC7822086.',
    trubiano2022: 'Trubiano JA, et al. The assessment of severe cutaneous adverse drug reactions. Aust Prescr 2022.',
    strom2003:  'Strom BL, et al. Absence of cross-reactivity between sulfonamide antibiotics and sulfonamide nonantibiotics. N Engl J Med 2003;349(17):1628-35.',
    brackett2004: 'Brackett CC, et al. Likelihood and mechanisms of cross-allergenicity between sulfonamide antibiotics and other drugs containing a sulfonamide functional group. Pharmacotherapy 2004;24(7):856-70.',
    ccjm2025:   'Can my patient with a “sulfa allergy” receive celecoxib or other nonantimicrobial sulfonamides? Cleve Clin J Med 2025;92(3):147.'
  };

  // --- 2. Risk tiers (rule defaults; % anchored to Picard 2019) -------------
  const TIERS = {
    high:       { id: 'high',       label: 'แพ้ข้ามสูง',  color: 'red',    order: 0 },
    moderate:   { id: 'moderate',   label: 'ปานกลาง',     color: 'orange', order: 1 },
    low:        { id: 'low',        label: 'ต่ำ',          color: 'yellow', order: 2 },
    negligible: { id: 'negligible', label: 'น้อยมาก',      color: 'green',  order: 3 }
  };

  // --- 3. R1 side-chain clusters (drugs in same cluster cross-react) --------
  const CLUSTERS = {
    aminobenzyl:        { id: 'aminobenzyl',        label: 'aminobenzyl (ampicillin-type)' },
    hydroxyaminobenzyl: { id: 'hydroxyaminobenzyl', label: 'hydroxy-aminobenzyl (amoxicillin-type)' },
    methoxyimino:       { id: 'methoxyimino',       label: 'aminothiazole-methoxyimino' },
    alkoxyimino:        { id: 'alkoxyimino',        label: 'aminothiazole-alkoxyimino (ceftazidime/aztreonam)' }
    // cefazolin = no cluster (unique side chain) -> handled by `unique` flag
  };

  // --- 4. Drug registry -----------------------------------------------------
  // class: penicillin | cephalosporin | carbapenem | monobactam
  // cluster: key of CLUSTERS or null. unique:true => no shared side chain.
  const DRUGS = [
    // Penicillins
    { id: 'amoxicillin',   generic: 'Amoxicillin',   th: 'อะม็อกซิซิลลิน', trade: ['Amoxil', 'Ranoxyl'], class: 'penicillin', cluster: 'hydroxyaminobenzyl' },
    { id: 'ampicillin',    generic: 'Ampicillin',    th: 'แอมพิซิลลิน',     trade: [],                    class: 'penicillin', cluster: 'aminobenzyl' },
    { id: 'penicillinG',   generic: 'Penicillin G',  th: 'เพนิซิลลิน จี',   trade: ['Benzylpenicillin'],  class: 'penicillin', cluster: null },
    { id: 'penicillinV',   generic: 'Penicillin V',  th: 'เพนิซิลลิน วี',   trade: [],                    class: 'penicillin', cluster: null },
    { id: 'piperacillin',  generic: 'Piperacillin',  th: 'ไพเพอราซิลลิน',  trade: ['Tazocin (w/ tazobactam)'], class: 'penicillin', cluster: null },
    { id: 'cloxacillin',   generic: 'Cloxacillin',   th: 'คล็อกซาซิลลิน',  trade: [],                    class: 'penicillin', cluster: null },
    { id: 'dicloxacillin', generic: 'Dicloxacillin', th: 'ไดคล็อกซาซิลลิน', trade: [],                   class: 'penicillin', cluster: null },
    // Cephalosporins
    { id: 'cefazolin',   generic: 'Cefazolin',   th: 'เซฟาโซลิน',   trade: [],            class: 'cephalosporin', cluster: null, unique: true },
    { id: 'cephalexin',  generic: 'Cephalexin',  th: 'เซฟาเล็กซิน', trade: ['Keflex'],    class: 'cephalosporin', cluster: 'aminobenzyl' },
    { id: 'cefaclor',    generic: 'Cefaclor',    th: 'เซฟาคลอร์',   trade: [],            class: 'cephalosporin', cluster: 'aminobenzyl' },
    { id: 'cephradine',  generic: 'Cephradine',  th: 'เซฟราดีน',    trade: [],            class: 'cephalosporin', cluster: 'aminobenzyl' },
    { id: 'cefadroxil',  generic: 'Cefadroxil',  th: 'เซฟาดร็อกซิล', trade: [],           class: 'cephalosporin', cluster: 'hydroxyaminobenzyl' },
    { id: 'cefprozil',   generic: 'Cefprozil',   th: 'เซฟโพรซิล',   trade: [],            class: 'cephalosporin', cluster: 'hydroxyaminobenzyl' },
    { id: 'cefuroxime',  generic: 'Cefuroxime',  th: 'เซฟูร็อกซิม', trade: ['Zinnat'],    class: 'cephalosporin', cluster: 'methoxyimino' },
    { id: 'cefotaxime',  generic: 'Cefotaxime',  th: 'เซโฟแทกซิม',  trade: ['Claforan'],  class: 'cephalosporin', cluster: 'methoxyimino' },
    { id: 'ceftriaxone', generic: 'Ceftriaxone', th: 'เซฟไตรอะโซน', trade: ['Rocephin'],  class: 'cephalosporin', cluster: 'methoxyimino' },
    { id: 'cefpodoxime', generic: 'Cefpodoxime', th: 'เซฟโพดอกซิม', trade: [],            class: 'cephalosporin', cluster: 'methoxyimino' },
    { id: 'cefepime',    generic: 'Cefepime',    th: 'เซเฟพีม',     trade: ['Maxipime'],  class: 'cephalosporin', cluster: 'methoxyimino' },
    { id: 'ceftazidime', generic: 'Ceftazidime', th: 'เซฟตาซิดีม',  trade: ['Fortum'],    class: 'cephalosporin', cluster: 'alkoxyimino' },
    { id: 'cefixime',    generic: 'Cefixime',    th: 'เซฟิกซิม',    trade: [],            class: 'cephalosporin', cluster: null },
    { id: 'cefdinir',    generic: 'Cefdinir',    th: 'เซฟดิเนียร์', trade: [],            class: 'cephalosporin', cluster: null },
    // Carbapenems
    { id: 'meropenem',  generic: 'Meropenem',  th: 'เมอโรพีเนม',  trade: ['Meronem'],   class: 'carbapenem', cluster: null },
    { id: 'imipenem',   generic: 'Imipenem',   th: 'ไอมิพีเนม',   trade: ['Tienam (w/ cilastatin)'], class: 'carbapenem', cluster: null },
    { id: 'ertapenem',  generic: 'Ertapenem',  th: 'เออร์ตาพีเนม', trade: ['Invanz'],   class: 'carbapenem', cluster: null },
    // Monobactam
    { id: 'aztreonam',  generic: 'Aztreonam',  th: 'อะซทรีโอแนม', trade: ['Azactam'],   class: 'monobactam', cluster: 'alkoxyimino' }
  ];

  const DRUG_BY_ID = DRUGS.reduce(function (m, d) { m[d.id] = d; return m; }, {});

  // --- 5. Curated overrides (pair-specific; highest precedence) -------------
  // key: 'allergenId|targetId'  (use '*' wildcard on either side)
  const OVERRIDES = {
    // Cefazolin as target: unique side chain -> negligible even from anaphylaxis
    '*|cefazolin': {
      decision: 'safer', tier: 'negligible', pct: '~0.7%',
      reason: 'R1 ไม่ซ้ำกับ beta-lactam ใดเลย', refs: ['khan2022', 'jaa2021']
    },
    // Ceftazidime <-> Aztreonam: identical R1 (handled by cluster too, but pin
    // an explicit, citable note both directions)
    'ceftazidime|aztreonam': {
      decision: 'avoid', tier: 'high', pct: 'แพ้ข้ามได้',
      reason: 'R1 เหมือนกันเป๊ะ (alkoxyimino)', refs: ['khan2022']
    },
    'aztreonam|ceftazidime': {
      decision: 'avoid', tier: 'high', pct: 'แพ้ข้ามได้',
      reason: 'R1 เหมือนกันเป๊ะ (alkoxyimino)', refs: ['khan2022']
    }
  };

  // --- 6. Severity gating ---------------------------------------------------
  const SEVERITY = [
    { id: 'mild',    label: 'ผื่น maculopapular ไม่รุนแรง', blockAllBetaLactam: false, noChallenge: false,
      note: 'low-risk: ทางเลือก R1 ต่างใช้ได้; direct oral challenge ได้ ไม่ต้อง skin test', refs: ['khan2022'] },
    { id: 'ige',     label: 'IgE: ลมพิษ / angioedema / anaphylaxis', blockAllBetaLactam: false, noChallenge: false,
      note: 'risk-stratify; high-risk ต้อง skin test ก่อน challenge; เลือก cefazolin/carbapenem/aztreonam/R1 ต่าง', refs: ['khan2022', 'blumenthal2019'] },
    { id: 'scar',    label: 'SCAR: SJS / TEN / DRESS / AGEP', blockAllBetaLactam: true, noChallenge: true,
      note: 'หลีกเลี่ยง beta-lactam ทั้งหมด + ยาโครงสร้างใกล้เคียง; ห้าม challenge/desensitization เด็ดขาด', refs: ['khan2022', 'trubiano2022'] },
    { id: 'unknown', label: 'ไม่ทราบ / ไม่ระบุ', blockAllBetaLactam: false, noChallenge: true,
      note: 'ข้อมูลไม่พอ: ระวังไว้ก่อน เลือกทางเลือกความเสี่ยงต่ำสุด', refs: ['khan2022'] }
  ];
  const SEVERITY_BY_ID = SEVERITY.reduce(function (m, s) { m[s.id] = s; return m; }, {});

  // --- 7. Non-beta-lactam alternatives (by structural class) ----------------
  const NON_BETA_LACTAM = [
    { class: 'Macrolide',      drugs: ['Azithromycin', 'Clarithromycin'] },
    { class: 'Fluoroquinolone', drugs: ['Levofloxacin', 'Ciprofloxacin'] },
    { class: 'Lincosamide',    drugs: ['Clindamycin'] },
    { class: 'Glycopeptide',   drugs: ['Vancomycin'] },
    { class: 'Tetracycline',   drugs: ['Doxycycline'] },
    { class: 'Others',         drugs: ['TMP-SMX', 'Metronidazole', 'Nitrofurantoin'] }
  ];

  // --- 8. Engine: compute the relationship allergen -> target ---------------
  // Returns { decision:'avoid'|'safer', tier, pct, reason, refs:[], advice }
  function computeRelation(allergenId, targetId) {
    const a = DRUG_BY_ID[allergenId];
    const t = DRUG_BY_ID[targetId];
    if (!a || !t) return null;

    // (0) overrides first (most specific wins)
    const ov = OVERRIDES[a.id + '|' + t.id] || OVERRIDES['*|' + t.id] || OVERRIDES[a.id + '|*'];
    if (ov) return Object.assign({ advice: '' }, ov);

    // (1) same drug
    if (a.id === t.id) {
      return { decision: 'avoid', tier: 'high', pct: 'ยาตัวเดียวกัน', reason: 'ยาตัวเดียวกับที่แพ้', refs: ['khan2022'], advice: '' };
    }
    // (2) shared R1 cluster -> high (covers amox/amp clusters, ceftaz<->aztreonam)
    if (a.cluster && a.cluster === t.cluster) {
      return { decision: 'avoid', tier: 'high', pct: '~16%', pctCI: '11–24',
        reason: 'R1 side chain เดียวกัน (' + CLUSTERS[a.cluster].label + ')', refs: ['picard2019', 'zagursky2018'], advice: '' };
    }
    // (3) penicillin <-> penicillin (whole class) -> high
    if (a.class === 'penicillin' && t.class === 'penicillin') {
      return { decision: 'avoid', tier: 'high', pct: 'ถือว่าแพ้ทั้งกลุ่ม', reason: 'แกน penicillin เดียวกัน', refs: ['khan2022'], advice: '' };
    }
    // (4) target carbapenem -> negligible
    if (t.class === 'carbapenem') {
      return { decision: 'safer', tier: 'negligible', pct: '0.87%', pctCI: '0.32–2.32',
        reason: 'carbapenem แพ้ข้ามต่ำมาก', refs: ['picard2019', 'khan2022'], advice: 'Khan: ให้ได้ทุกกรณีไม่ต้องทดสอบ (ยกเว้น SCAR)' };
    }
    // (5) target monobactam (aztreonam), no shared cluster -> negligible
    if (t.class === 'monobactam') {
      return { decision: 'safer', tier: 'negligible', pct: '<1%',
        reason: 'monobactam ไม่แพ้ข้ามกับ penicillin', refs: ['khan2022'], advice: 'ยกเว้นแพ้ ceftazidime (R1 เดียวกัน)' };
    }
    // (6) default cross penicillin<->cephalosporin or ceph<->ceph (diff R1) -> low
    return { decision: 'safer', tier: 'low', pct: '2.11%', pctCI: '0.98–4.46',
      reason: 'R1 ต่างกัน (ยังเป็น beta-lactam)', refs: ['picard2019', 'khan2022'],
      advice: 'ผื่นไม่รุนแรง พิจารณาใช้ได้/graded challenge ตามดุลพินิจ' };
  }

  // --- 9. Non-beta-lactam groups (Phase 4.1; verified 2026-06-18) -----------
  // Different mechanism than R1 side chains -> curated per group, NOT via
  // computeRelation. See docs/allergy-nonbetalactam.md.
  const NBL_GROUPS = [
    {
      id: 'sulfonamide',
      label: 'Sulfonamides',
      refs: ['strom2003', 'brackett2004', 'khan2022', 'ccjm2025'],
      // selectable allergens (the sulfonamide ANTIBIOTIC the patient reacted to)
      allergens: [
        { id: 'cotrimoxazole', generic: 'Trimethoprim-Sulfamethoxazole', th: 'โคไตรม็อกซาโซล', trade: ['Bactrim', 'Septrin'] },
        { id: 'sulfadiazine',  generic: 'Sulfadiazine',  th: 'ซัลฟาไดอะซีน',  trade: [] },
        { id: 'sulfasalazine', generic: 'Sulfasalazine', th: 'ซัลฟาซาลาซีน', trade: ['Salazopyrin'] }
      ],
      // cross-reactive (avoid) — other sulfonamide ANTIBIOTICS (share N4 arylamine)
      crossReason: 'sulfonamide antibiotic เหมือนกัน (มีหมู่ N4 arylamine + วงแทนที่ N1)',
      crossReactive: [
        { id: 'sulfadiazine',  generic: 'Sulfadiazine',  th: 'ซัลฟาไดอะซีน',  sub: 'Sulfonamide antibiotic' },
        { id: 'sulfasalazine', generic: 'Sulfasalazine', th: 'ซัลฟาซาลาซีน', sub: 'Sulfonamide antibiotic' },
        { generic: 'Sulfacetamide', th: 'ซัลฟาเซตาไมด์', sub: 'Sulfonamide antibiotic (เฉพาะที่/ตา)' },
        { id: 'cotrimoxazole', generic: 'Cotrimoxazole (TMP-SMX)', th: 'โคไตรม็อกซาโซล', sub: 'Sulfonamide antibiotic' }
      ],
      // safe — NON-antibiotic sulfonamides (no N4 arylamine -> no immune cross-reactivity)
      safeReason: 'non-antibiotic sulfonamide ไม่มีหมู่ N4 arylamine → ไม่แพ้ข้ามเชิงภูมิคุ้มกัน (Strom 2003)',
      safe: [
        { generic: 'Hydrochlorothiazide', th: 'ไฮโดรคลอโรไทอะไซด์', sub: 'Thiazide diuretic' },
        { generic: 'Furosemide',   th: 'ฟูโรซีไมด์',   sub: 'Loop diuretic' },
        { generic: 'Acetazolamide', th: 'อะเซตาโซลาไมด์', sub: 'Carbonic anhydrase inhibitor' },
        { generic: 'Celecoxib',    th: 'ซีลีค็อกซิบ',  sub: 'COX-2 selective NSAID' },
        { generic: 'Glipizide',    th: 'กลิพิไซด์',    sub: 'Sulfonylurea' },
        { generic: 'Sumatriptan',  th: 'ซูมาทริปแทน',  sub: 'Triptan' }
      ],
      // per-severity guidance note shown at the top of the report
      noteMild: 'Low-risk: Khan 2022 แนะนำ direct oral challenge ต่อ TMP-SMX ได้',
      noteIge: 'หลีกเลี่ยง sulfonamide antibiotic; non-antibiotic sulfonamide ใช้ได้',
      noteScar: 'อาการรุนแรง (SCAR): หลีกเลี่ยง sulfonamide antibiotic ทั้งหมด · ห้าม challenge',
      // SCAR: non-antibiotic sulfonamides become "caution" (per pharmacist decision)
      scarCautionNote: 'กรณี SCAR: พิจารณาหลีกเลี่ยงถ้าไม่จำเป็น (แม้ทางทฤษฎีไม่แพ้ข้าม)'
    }
  ];

  const NBL_INDEX = {};   // allergenId -> { group, allergen }
  NBL_GROUPS.forEach(function (g) {
    g.allergens.forEach(function (a) { NBL_INDEX[a.id] = { group: g, allergen: a }; });
  });

  // --- 10. Build report ------------------------------------------------------
  // Dispatch: beta-lactam allergen -> R1 engine; non-beta-lactam -> curated group.
  // Both return { allergen, severity, severityNote, avoid:[], caution:[],
  //   safer:[], nonBetaLactam|null, blocked, isNbl }
  function buildReport(allergenId, severityId) {
    if (DRUG_BY_ID[allergenId]) return buildBetaLactamReport(allergenId, severityId);
    if (NBL_INDEX[allergenId])  return buildNblReport(allergenId, severityId);
    return null;
  }

  function buildBetaLactamReport(allergenId, severityId) {
    const a = DRUG_BY_ID[allergenId];
    const sev = SEVERITY_BY_ID[severityId] || SEVERITY_BY_ID.unknown;

    const avoid = [];
    const safer = [];
    DRUGS.forEach(function (t) {
      if (t.id === a.id) return;
      const r = computeRelation(a.id, t.id);
      if (!r) return;
      const row = Object.assign({ drug: t }, r);
      // SCAR: every beta-lactam goes to "avoid" regardless of structural tier
      if (sev.blockAllBetaLactam) {
        avoid.push(Object.assign({}, row, { decision: 'avoid', sevOverride: true }));
      } else if (r.decision === 'avoid') {
        avoid.push(row);
      } else {
        safer.push(row);
      }
    });

    avoid.sort(function (x, y) { return TIERS[x.tier].order - TIERS[y.tier].order; });
    safer.sort(function (x, y) { return TIERS[y.tier].order - TIERS[x.tier].order; });

    return {
      allergen: a,
      severity: sev,
      severityNote: sev.note,
      avoid: avoid,
      caution: [],
      safer: sev.blockAllBetaLactam ? [] : safer,
      nonBetaLactam: NON_BETA_LACTAM,
      blocked: sev.blockAllBetaLactam,
      isNbl: false
    };
  }

  function buildNblReport(allergenId, severityId) {
    const ref = NBL_INDEX[allergenId];
    const g = ref.group;
    const a = ref.allergen;
    const sev = SEVERITY_BY_ID[severityId] || SEVERITY_BY_ID.unknown;
    const isScar = !!sev.blockAllBetaLactam;   // the SCAR severity flag

    // cross-reactive antibiotics -> always avoid (high); exclude the drug the
    // patient is actually allergic to (don't list it against itself)
    const avoid = g.crossReactive.filter(function (d) { return d.id !== allergenId; }).map(function (d) {
      return {
        drug: { generic: d.generic, th: d.th, class: d.sub },
        decision: 'avoid', tier: 'high', pct: 'แพ้ข้ามได้',
        reason: g.crossReason, refs: g.refs,
        advice: isScar ? 'หลีกเลี่ยงทั้งหมด · ห้าม challenge' : ''
      };
    });

    // non-antibiotic sulfonamides -> safe normally; "caution" if SCAR
    const safeItems = g.safe.map(function (d) {
      return {
        drug: { generic: d.generic, th: d.th, class: d.sub },
        decision: isScar ? 'caution' : 'safer',
        tier: isScar ? 'moderate' : 'negligible',
        pct: isScar ? 'ระวัง' : 'ไม่แพ้ข้าม',
        reason: g.safeReason, refs: g.refs,
        advice: isScar ? g.scarCautionNote : ''
      };
    });

    let note = g.noteIge;
    if (isScar) note = g.noteScar;
    else if (sev.id === 'mild' || sev.id === 'unknown') note = g.noteMild;

    return {
      allergen: { generic: a.generic, th: a.th, class: g.label, trade: a.trade },
      severity: sev,
      severityNote: note,
      avoid: avoid,
      caution: isScar ? safeItems : [],
      safer: isScar ? [] : safeItems,
      nonBetaLactam: null,   // for NBL the "safe" list already names the alternatives
      blocked: false,
      isNbl: true
    };
  }

  root.AllergyData = {
    REFS: REFS, TIERS: TIERS, CLUSTERS: CLUSTERS, DRUGS: DRUGS, DRUG_BY_ID: DRUG_BY_ID,
    OVERRIDES: OVERRIDES, SEVERITY: SEVERITY, NON_BETA_LACTAM: NON_BETA_LACTAM,
    NBL_GROUPS: NBL_GROUPS, NBL_INDEX: NBL_INDEX,
    computeRelation: computeRelation, buildReport: buildReport
  };

  // Node/test export (browser ignores)
  if (typeof module !== 'undefined' && module.exports) { module.exports = root.AllergyData; }
})(typeof window !== 'undefined' ? window : globalThis);
