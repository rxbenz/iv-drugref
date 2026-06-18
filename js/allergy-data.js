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
    ccjm2025:   'Can my patient with a “sulfa allergy” receive celecoxib or other nonantimicrobial sulfonamides? Cleve Clin J Med 2025;92(3):147.',
    kowalski2013: 'Kowalski ML, et al. Classification and practical approach to the diagnosis and management of hypersensitivity to NSAIDs. Allergy 2013;68(10):1219-32.',
    dona2020:   'Doña I, et al. Progress in understanding hypersensitivity reactions to nonsteroidal anti-inflammatory drugs. Allergy 2020;75(3):561-575.',
    nsaidReview2026: 'Cross-Reactivity and Cross-Intolerance Among NSAIDs: COX-1-Mediated Mechanisms, COX-2 Inhibitors and Paracetamol. Int J Mol Sci 2026;27:3727.',
    cpic2017cbz: 'Phillips EJ, et al. CPIC Guideline for HLA Genotype and Use of Carbamazepine and Oxcarbazepine: 2017 Update. Clin Pharmacol Ther 2018;103(4):574-581.',
    cpic2020phenytoin: 'Karnes JH, et al. CPIC Guideline for CYP2C9 and HLA-B Genotypes and Phenytoin Dosing: 2020 Update. Clin Pharmacol Ther 2021;109(2):302-309.',
    aedCrossReview: 'Rashes and other hypersensitivity reactions associated with antiepileptic drugs: a review of current literature. Seizure 2019.',
    thaiHLA2022: 'Implementation of HLA-B*15:02 Genotyping as Standard-of-Care for Reducing Carbamazepine/Oxcarbazepine Induced Cutaneous ADR in Thailand. Front Pharmacol 2022;13:867490.',
    fqCohort2022: 'Immediate Hypersensitivity to Fluoroquinolones: A Cohort Assessing Cross-Reactivity. Open Forum Infect Dis 2022;9(4):ofac106.',
    fqInClass2023: 'In-Class Cross-Reactivity among Hospitalized Patients with Hypersensitivity Reactions to Fluoroquinolones. Antimicrob Agents Chemother 2023.',
    eaaci2025fq: 'Gelincik A, et al. Diagnosis of Quinolone Hypersensitivity: An EAACI Position Paper. Allergy 2025.',
    bhole2012: 'Bhole MV, et al. IgE-mediated allergy to local anaesthetics: separating fact from perception — a UK perspective. Br J Anaesth 2012;108(6):903-11.',
    harboe2010: 'Harboe T, et al. Suspected allergy to local anaesthetics: follow-up in 135 cases. Acta Anaesthesiol Scand 2010;54(5):536-42.'
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
    },
    {
      id: 'nsaid',
      label: 'NSAIDs',
      refs: ['kowalski2013', 'dona2020', 'khan2022', 'nsaidReview2026'],
      // chemical-class awareness: in the SINGLE-DRUG (selective) phenotype,
      // cross-reactivity follows CHEMICAL GROUP, not COX-1 potency. Each entry
      // carries `chem`; buildNblReport names the culprit's same-group siblings.
      chemGroupAware: true,
      chemLabels: {
        salicylate:    'Salicylate',
        propionic:     'Propionic acid (profen)',
        acetic:        'Acetic acid',
        oxicam:        'Oxicam (enolic acid)',
        fenamate:      'Fenamate (anthranilic acid)',
        coxib:         'Coxib (diaryl-substituted)',
        sulfonanilide: 'Sulfonanilide',
        aminophenol:   'Para-aminophenol'
      },
      // selectable allergens (the NSAID the patient reacted to)
      allergens: [
        { id: 'aspirin',      generic: 'Aspirin',        th: 'แอสไพริน',       trade: [], chem: 'salicylate' },
        { id: 'ibuprofen',    generic: 'Ibuprofen',      th: 'ไอบูโพรเฟน',     trade: ['Brufen'], chem: 'propionic' },
        { id: 'naproxen',     generic: 'Naproxen',       th: 'นาพรอกเซน',      trade: [], chem: 'propionic' },
        { id: 'diclofenac',   generic: 'Diclofenac',     th: 'ไดโคลฟีแนค',     trade: ['Voltaren'], chem: 'acetic' },
        { id: 'mefenamic',    generic: 'Mefenamic acid', th: 'กรดเมเฟนามิก',   trade: ['Ponstan'], chem: 'fenamate' },
        { id: 'ketorolac',    generic: 'Ketorolac',      th: 'คีโตโรแลค',      trade: [], chem: 'acetic' },
        { id: 'indomethacin', generic: 'Indomethacin',   th: 'อินโดเมทาซิน',   trade: [], chem: 'acetic' },
        { id: 'piroxicam',    generic: 'Piroxicam',      th: 'พิร็อกซิแคม',    trade: [], chem: 'oxicam' }
      ],
      // cross-reactive (avoid) — strong COX-1 inhibitors (pharmacologic, not structural)
      crossReason: 'ยับยั้ง COX-1 แรงเหมือนกัน → แพ้ข้ามเชิงเภสัชวิทยา (cross-reactive type)',
      crossReactive: [
        { id: 'aspirin',      generic: 'Aspirin (ขนาดยาแก้ปวด/ต้านอักเสบ)', th: 'แอสไพริน',     sub: 'Salicylate · COX-1 แรง', chem: 'salicylate' },
        { id: 'ibuprofen',    generic: 'Ibuprofen',    th: 'ไอบูโพรเฟน',  sub: 'Propionic acid · COX-1 แรง', chem: 'propionic' },
        { id: 'naproxen',     generic: 'Naproxen',     th: 'นาพรอกเซน',   sub: 'Propionic acid · COX-1 แรง', chem: 'propionic' },
        { generic: 'Ketoprofen', th: 'คีโตโพรเฟน',     sub: 'Propionic acid · COX-1 แรง', chem: 'propionic' },
        { id: 'diclofenac',   generic: 'Diclofenac',   th: 'ไดโคลฟีแนค',  sub: 'Acetic acid · COX-1 แรง', chem: 'acetic' },
        { id: 'indomethacin', generic: 'Indomethacin', th: 'อินโดเมทาซิน', sub: 'Acetic acid · COX-1 แรง', chem: 'acetic' },
        { id: 'ketorolac',    generic: 'Ketorolac',    th: 'คีโตโรแลค',   sub: 'Acetic acid · COX-1 แรง', chem: 'acetic' },
        { id: 'piroxicam',    generic: 'Piroxicam',    th: 'พิร็อกซิแคม', sub: 'Oxicam · COX-1 แรง', chem: 'oxicam' },
        { id: 'mefenamic',    generic: 'Mefenamic acid', th: 'กรดเมเฟนามิก', sub: 'Fenamate · COX-1 แรง', chem: 'fenamate' }
      ],
      // safe — COX-2 selective + weak COX-1 (tolerated by most cross-reactive patients)
      safeReason: 'COX-2 selective / weak COX-1 → ผู้ป่วย cross-reactive ส่วนใหญ่ใช้ได้',
      safe: [
        { generic: 'Celecoxib',  th: 'ซีลีค็อกซิบ',  sub: 'COX-2 selective', pct: 'แพ้ข้าม ~2%', chem: 'coxib',
          reason: 'COX-2 selective; oral challenge พบแพ้ข้ามเพียง ~2%' },
        { generic: 'Etoricoxib', th: 'อีโทริค็อกซิบ', sub: 'COX-2 selective', pct: 'แพ้ข้ามต่ำมาก', chem: 'coxib',
          reason: 'COX-2 selective; ทนได้ดีในผู้ป่วย cross-reactive' },
        { generic: 'Paracetamol (Acetaminophen)', th: 'พาราเซตามอล', sub: 'weak COX-1', pct: 'ส่วนใหญ่ใช้ได้', chem: 'aminophenol',
          reason: 'weak COX-1; ขนาดสูง (>1 g) อาจกระตุ้นอาการในผู้ป่วยส่วนน้อย' }
      ],
      // caution — preferential COX-2 (group-level, shown for all non-SCAR severities)
      caution: [
        { generic: 'Meloxicam',  th: 'เมล็อกซิแคม', sub: 'preferential COX-2', pct: 'แพ้ข้าม ~4%', chem: 'oxicam',
          reason: 'preferential COX-2; oral challenge พบแพ้ข้าม ~4% · เป็น Oxicam กลุ่มเดียวกับ piroxicam',
          advice: 'พิจารณาเริ่มขนาดต่ำ / graded challenge ตามดุลพินิจ' },
        { generic: 'Nimesulide', th: 'ไนเมซูไลด์',  sub: 'preferential COX-2', pct: 'แพ้ข้ามต่ำ', chem: 'sulfonanilide',
          reason: 'preferential COX-2; ส่วนใหญ่ใช้ได้แต่ควรระวัง',
          advice: 'พิจารณาเริ่มขนาดต่ำ / graded challenge ตามดุลพินิจ' }
      ],
      noteMild: 'ส่วนใหญ่เป็น cross-reactive (COX-1): เลี่ยง COX-1 แรงทั้งหมด · COX-2 selective/paracetamol มักใช้ได้',
      noteIge:  'ส่วนใหญ่เป็น cross-reactive (COX-1): เลี่ยง COX-1 แรงทั้งหมด · COX-2 selective/paracetamol มักใช้ได้',
      noteScar: 'SCAR จาก NSAID: มักเป็น single-drug (SNIDHR) → เลี่ยงตัวที่แพ้ + กลุ่มเคมีเดียวกันเด็ดขาด · ห้าม challenge · ปรึกษาผู้เชี่ยวชาญ',
      // SCAR: COX-2 selective / paracetamol become "caution" (conservative, like sulfa)
      scarCautionNote: 'กรณี SCAR: พิจารณาเลี่ยงถ้าไม่จำเป็น · ปรึกษาผู้เชี่ยวชาญก่อนใช้',
      // prominent callout: the single-drug (selective) scenario flips the whole logic.
      // buildNblReport appends the culprit's same-chemical-group siblings.
      singleDrugCallout: '⚠️ ถ้าแพ้ NSAID “ตัวเดียว” (เคยใช้ NSAID ตัวอื่นได้ปกติ หรือ anaphylaxis ต่อตัวเดียว) = single-drug (selective) ไม่ใช่ cross-reactive → เลี่ยงเฉพาะตัวที่แพ้ + กลุ่มเคมีเดียวกัน ส่วน NSAID กลุ่มเคมีอื่นใช้ได้ แม้เป็น COX-1 แรง'
    },
    {
      id: 'anticonvulsant',
      label: 'Anticonvulsants (aromatic)',
      refs: ['cpic2017cbz', 'cpic2020phenytoin', 'aedCrossReview', 'thaiHLA2022'],
      // Non-aromatic AEDs are the recommended switch after an aromatic-AED SCAR,
      // so they must STAY "safe" even at SCAR severity (unlike sulfa/NSAID).
      keepSafeOnScar: true,
      // selectable allergens (the aromatic AED the patient reacted to)
      allergens: [
        { id: 'carbamazepine', generic: 'Carbamazepine', th: 'คาร์บามาเซพีน',   trade: ['Tegretol'] },
        { id: 'oxcarbazepine', generic: 'Oxcarbazepine', th: 'ออกซ์คาร์บาเซพีน', trade: ['Trileptal'] },
        { id: 'phenytoin',     generic: 'Phenytoin',     th: 'เฟนิโทอิน',        trade: ['Dilantin'] },
        { id: 'phenobarbital', generic: 'Phenobarbital', th: 'ฟีโนบาร์บิทาล',    trade: [] },
        { id: 'lamotrigine',   generic: 'Lamotrigine',   th: 'ลาโมไทรจีน',       trade: ['Lamictal'] }
      ],
      // cross-reactive (avoid) — other aromatic AEDs (40-58%, higher in SCAR)
      crossReason: 'aromatic AED เหมือนกัน → แพ้ข้ามสูง (~40-58%, ยิ่งสูงใน SCAR)',
      crossReactive: [
        { id: 'carbamazepine', generic: 'Carbamazepine', th: 'คาร์บามาเซพีน',   sub: 'Aromatic AED · HLA-B*15:02' },
        { id: 'oxcarbazepine', generic: 'Oxcarbazepine', th: 'ออกซ์คาร์บาเซพีน', sub: 'Aromatic AED · HLA-B*15:02' },
        { id: 'phenytoin',     generic: 'Phenytoin',     th: 'เฟนิโทอิน',        sub: 'Aromatic AED' },
        { generic: 'Fosphenytoin', th: 'ฟอสเฟนิโทอิน', sub: 'Aromatic AED (prodrug ของ phenytoin)' },
        { id: 'phenobarbital', generic: 'Phenobarbital', th: 'ฟีโนบาร์บิทาล',    sub: 'Aromatic AED (barbiturate)' },
        { generic: 'Primidone', th: 'ไพรมิโดน', sub: 'Aromatic AED (เปลี่ยนเป็น phenobarbital)' },
        { id: 'lamotrigine',   generic: 'Lamotrigine',   th: 'ลาโมไทรจีน',       sub: 'Aromatic AED · เสี่ยง SJS เอง' }
      ],
      // safe — non-aromatic AEDs (no cross-reactivity; the recommended switch)
      safeReason: 'non-aromatic AED ไม่แพ้ข้ามกับ aromatic → เป็นยาที่แนะนำให้เปลี่ยนไปใช้',
      safe: [
        { generic: 'Valproic acid (Valproate)', th: 'กรดวาลโพรอิก', sub: 'Non-aromatic AED' },
        { generic: 'Levetiracetam', th: 'เลเวทิราเซแทม', sub: 'Non-aromatic AED' },
        { generic: 'Gabapentin',    th: 'กาบาเพนติน',   sub: 'Gabapentinoid' },
        { generic: 'Pregabalin',    th: 'พรีกาบาลิน',   sub: 'Gabapentinoid' },
        { generic: 'Topiramate',    th: 'โทพิราเมต',    sub: 'Non-aromatic AED' },
        { generic: 'Clonazepam',    th: 'โคลนาเซแพม',   sub: 'Benzodiazepine' },
        { generic: 'Lacosamide',    th: 'ลาโคซาไมด์',   sub: 'Non-aromatic AED' }
      ],
      // caution — zonisamide: sulfonamide-derivative (separate SJS mechanism)
      caution: [
        { generic: 'Zonisamide', th: 'โซนิซาไมด์', sub: 'Sulfonamide-derivative', pct: 'ระวัง',
          reason: 'sulfonamide-derivative (เสี่ยง SJS คนละกลไก) — ไม่ใช่ aromatic แต่ไม่ปลอดภัยสนิท',
          advice: 'พิจารณาเลี่ยงถ้ามี non-aromatic ตัวอื่น' }
      ],
      noteMild: 'ผื่น MPE: แพ้ข้าม aromatic ~8% — แนะนำเปลี่ยนเป็น non-aromatic AED เพื่อความปลอดภัย',
      noteIge:  'เปลี่ยนเป็น non-aromatic AED · เลี่ยง aromatic AED ทั้งกลุ่ม (ปฏิกิริยาเป็น T-cell delayed ไม่ใช่ IgE)',
      noteScar: 'SCAR จาก aromatic AED: เลี่ยง aromatic AED ทั้งหมดเด็ดขาด · ห้าม challenge · ใช้ non-aromatic เท่านั้น',
      scarCautionNote: 'กรณี SCAR: พิจารณาเลี่ยงถ้าไม่จำเป็น',
      // prominent HLA pharmacogenomic callout (highly relevant for Thai patients)
      singleDrugCallout: '🧬 HLA: ผู้ที่มี HLA-B*15:02 (พบในคนไทย ~8-27%) — CPIC: ห้ามใช้ carbamazepine + oxcarbazepine และเลี่ยง phenytoin/fosphenytoin ถ้ามีทางเลือก · HLA-A*31:01 → เลี่ยง carbamazepine · แนะนำตรวจ HLA-B*15:02 ก่อนเริ่ม carbamazepine/oxcarbazepine ในคนไทย'
    },
    {
      id: 'fluoroquinolone',
      label: 'Fluoroquinolones',
      refs: ['fqCohort2022', 'fqInClass2023', 'eaaci2025fq'],
      // modern evidence: low in-class cross-reactivity (~2-5%) -> other FQs are
      // "caution" (non-SCAR) and escalate to "avoid" only at SCAR.
      crossClassCaution: true,
      keepSafeOnScar: true,   // non-FQ antibiotics stay safe even at SCAR
      // selectable allergens (the fluoroquinolone the patient reacted to)
      allergens: [
        { id: 'ciprofloxacin', generic: 'Ciprofloxacin', th: 'ไซโพรฟล็อกซาซิน', trade: ['Cipro'] },
        { id: 'levofloxacin',  generic: 'Levofloxacin',  th: 'ลีโวฟล็อกซาซิน',  trade: ['Cravit'] },
        { id: 'moxifloxacin',  generic: 'Moxifloxacin',  th: 'ม็อกซิฟล็อกซาซิน', trade: ['Avelox'] },
        { id: 'ofloxacin',     generic: 'Ofloxacin',     th: 'ออฟล็อกซาซิน',    trade: [] },
        { id: 'norfloxacin',   generic: 'Norfloxacin',   th: 'นอร์ฟล็อกซาซิน',  trade: [] }
      ],
      // in-class (other FQs) — low cross-reactivity per modern cohorts
      crossReason: 'fluoroquinolone กลุ่มเดียวกัน — แพ้ข้ามต่ำ (~2-5%) ตามหลักฐานใหม่',
      crossReactive: [
        { id: 'ciprofloxacin', generic: 'Ciprofloxacin', th: 'ไซโพรฟล็อกซาซิน', sub: 'Fluoroquinolone', pct: '~2.5%' },
        { id: 'levofloxacin',  generic: 'Levofloxacin',  th: 'ลีโวฟล็อกซาซิน',  sub: 'Fluoroquinolone', pct: '~2.0%' },
        { id: 'moxifloxacin',  generic: 'Moxifloxacin',  th: 'ม็อกซิฟล็อกซาซิน', sub: 'Fluoroquinolone (เสี่ยงสูงสุด)', pct: '~5.3%',
          reason: 'moxifloxacin มีอัตราแพ้ข้ามสูงสุดในกลุ่ม (~5.3%) + โครงสร้างต่างจากตัวอื่น' },
        { id: 'ofloxacin',     generic: 'Ofloxacin',     th: 'ออฟล็อกซาซิน',    sub: 'Fluoroquinolone', pct: 'ข้อมูลจำกัด' },
        { id: 'norfloxacin',   generic: 'Norfloxacin',   th: 'นอร์ฟล็อกซาซิน',  sub: 'Fluoroquinolone', pct: 'ข้อมูลจำกัด' }
      ],
      // safe — non-FQ antibiotic classes (choose by infection type)
      safeReason: 'ยาต่างกลุ่ม (ไม่ใช่ FQ) → ไม่มีปัญหาแพ้ข้าม — เลือกตามชนิดการติดเชื้อ',
      safe: [
        { generic: 'Beta-lactam (ถ้าไม่แพ้)', th: 'กลุ่มเบต้าแลคแทม', sub: 'เช่น amoxicillin / cephalexin' },
        { generic: 'Azithromycin / Clarithromycin', th: 'กลุ่มแมโครไลด์', sub: 'Macrolide' },
        { generic: 'TMP-SMX (Cotrimoxazole)', th: 'โคไตรม็อกซาโซล', sub: 'Sulfonamide antibiotic' },
        { generic: 'Doxycycline', th: 'ด็อกซีไซคลิน', sub: 'Tetracycline' },
        { generic: 'Gentamicin / Amikacin', th: 'กลุ่มอะมิโนไกลโคไซด์', sub: 'Aminoglycoside' },
        { generic: 'Clindamycin', th: 'คลินดามัยซิน', sub: 'Lincosamide' },
        { generic: 'Metronidazole', th: 'เมโทรนิดาโซล', sub: 'Nitroimidazole' }
      ],
      noteMild: 'แพ้ข้ามในกลุ่มต่ำ (~2-5%) — ใช้ยานอกกลุ่ม FQ ก่อน; ถ้าจำเป็นต้องใช้ FQ ตัวอื่นยืนยันด้วย oral challenge',
      noteIge:  'แพ้ข้ามในกลุ่มต่ำ (~2-5%) — ใช้ยานอกกลุ่ม FQ ก่อน; ถ้าจำเป็นต้องใช้ FQ ตัวอื่นยืนยันด้วย oral challenge',
      noteScar: 'SCAR จาก FQ: เลี่ยง fluoroquinolone ทั้งกลุ่มเด็ดขาด · ห้าม challenge · ใช้ยานอกกลุ่มเท่านั้น',
      scarCautionNote: 'กรณี SCAR: เลี่ยงทั้งกลุ่ม',
      // prominent callout: the modern low-cross-reactivity nuance
      singleDrugCallout: '💡 หลักฐานใหม่ (2022-2025): แพ้ข้ามใน FQ ต่ำ (~2-5%) การเลี่ยงทั้งกลุ่มอาจไม่จำเป็น — แต่ oral challenge เป็นวิธีเดียวที่ยืนยัน tolerance ของ FQ ตัวอื่นได้ (skin test บอกได้แค่ว่าแพ้กลุ่ม) → ค่าเริ่มต้นที่ปลอดภัยสุดคือใช้ยานอกกลุ่ม FQ · SCAR = เลี่ยงทั้งกลุ่มเด็ดขาด'
    },
    // ── Local anesthetics — split into TWO groups by linkage chemistry ────────
    // Cross-reactivity is driven by the ester/amide linkage, not by "LA" as a
    // whole: ESTERS share a PABA metabolite (cross-react with each other); AMIDES
    // rarely cross-react and NEVER cross-react with esters. Modelling each linkage
    // as its own NBL group lets the existing engine express "other class is safe"
    // without per-allergen cross lists. True IgE LA allergy is rare (<1%) — most
    // reactions are non-allergic (vasovagal / epinephrine / anxiety / toxicity).
    {
      id: 'la-ester',
      label: 'Local Anesthetic — Ester (เอสเทอร์)',
      refs: ['bhole2012', 'harboe2010', 'khan2022'],
      keepSafeOnScar: true,   // amides are a different class → safe even at SCAR
      // selectable allergens (ester-type LAs)
      allergens: [
        { id: 'procaine',      generic: 'Procaine',      th: 'โพรเคน',     trade: ['Novocaine'] },
        { id: 'benzocaine',    generic: 'Benzocaine',    th: 'เบนโซเคน',   trade: ['ยาชาเฉพาะที่/อมแก้เจ็บคอ'] },
        { id: 'tetracaine',    generic: 'Tetracaine',    th: 'เตตราเคน',   trade: ['Amethocaine'] },
        { id: 'chloroprocaine', generic: 'Chloroprocaine', th: 'คลอโรโพรเคน', trade: ['Nesacaine'] }
      ],
      // in-class (other esters) — share the PABA metabolite → cross-react
      crossReason: 'ester เหมือนกัน → เมแทบอลิซึมเป็น PABA ร่วมกัน → แพ้ข้ามได้',
      crossReactive: [
        { id: 'procaine',      generic: 'Procaine',      th: 'โพรเคน',     sub: 'Ester LA (→ PABA)' },
        { id: 'benzocaine',    generic: 'Benzocaine',    th: 'เบนโซเคน',   sub: 'Ester LA (→ PABA)' },
        { id: 'tetracaine',    generic: 'Tetracaine',    th: 'เตตราเคน',   sub: 'Ester LA (→ PABA)' },
        { id: 'chloroprocaine', generic: 'Chloroprocaine', th: 'คลอโรโพรเคน', sub: 'Ester LA (→ PABA)' }
      ],
      // safe — amide LAs (no PABA, structurally unrelated → no cross-reactivity)
      safeReason: 'amide LA ไม่มี PABA และคนละโครงสร้าง → ไม่แพ้ข้ามกับ ester (เลือกชนิด preservative-free)',
      safe: [
        { generic: 'Lidocaine',    th: 'ลิโดเคน',     sub: 'Amide LA' },
        { generic: 'Mepivacaine',  th: 'เมพิวาเคน',   sub: 'Amide LA' },
        { generic: 'Bupivacaine',  th: 'บูพิวาเคน',   sub: 'Amide LA' },
        { generic: 'Ropivacaine',  th: 'โรพิวาเคน',   sub: 'Amide LA' },
        { generic: 'Prilocaine',   th: 'ไพรโลเคน',    sub: 'Amide LA' },
        { generic: 'Articaine',    th: 'อาร์ติเคน',   sub: 'Amide LA' }
      ],
      // preservative caveat: methylparaben ≈ PABA → may cross-react in ester allergy
      caution: [
        { generic: 'ยาที่ผสม methylparaben (multidose vial)', th: 'สูตรผสมสารกันเสีย methylparaben',
          sub: 'preservative ใกล้เคียง PABA', pct: 'ระวัง',
          reason: 'methylparaben มีโครงสร้างใกล้เคียง PABA → อาจกระตุ้นการแพ้ในคนที่แพ้ ester',
          advice: 'เลือกชนิด single-dose / preservative-free' }
      ],
      noteMild: 'แพ้ผื่นจาก ester LA: เลี่ยง ester ทั้งกลุ่ม (แพ้ข้ามผ่าน PABA) → ใช้ amide LA (เช่น lidocaine) ชนิด preservative-free',
      noteIge:  'IgE ต่อ ester LA: เลี่ยง ester ทั้งกลุ่ม → ใช้ amide LA ได้ (ไม่แพ้ข้าม) เลือกชนิด preservative-free',
      noteScar: 'SCAR จาก ester LA (พบยาก): เลี่ยง ester ทั้งกลุ่มเด็ดขาด · ห้าม challenge · ใช้ amide LA ภายใต้การดูแล',
      scarCautionNote: 'กรณี SCAR: ใช้ amide ภายใต้การดูแลผู้เชี่ยวชาญ',
      singleDrugCallout: '💡 ester LA แพ้ข้ามกันผ่านสาร PABA → ถ้าแพ้ ester ตัวหนึ่งให้ถือว่าเสี่ยงทั้งกลุ่ม แต่ใช้ amide LA (lidocaine ฯลฯ) ได้เพราะไม่แพ้ข้าม · ระวัง preservative methylparaben (ใกล้ PABA) → เลือก preservative-free · หมายเหตุ: แพ้ LA จริงพบ <1% ส่วนใหญ่เป็นปฏิกิริยาไม่ใช่ภูมิแพ้ (vasovagal/epinephrine)'
    },
    {
      id: 'la-amide',
      label: 'Local Anesthetic — Amide (เอไมด์)',
      refs: ['bhole2012', 'harboe2010', 'khan2022'],
      crossClassCaution: true, // amide↔amide cross-reactivity low/inconsistent
      keepSafeOnScar: true,    // esters are a different class → safe even at SCAR
      // selectable allergens (amide-type LAs)
      allergens: [
        { id: 'lidocaine',   generic: 'Lidocaine',   th: 'ลิโดเคน',   trade: ['Xylocaine'] },
        { id: 'bupivacaine', generic: 'Bupivacaine', th: 'บูพิวาเคน', trade: ['Marcaine'] },
        { id: 'mepivacaine', generic: 'Mepivacaine', th: 'เมพิวาเคน', trade: ['Scandonest'] },
        { id: 'ropivacaine', generic: 'Ropivacaine', th: 'โรพิวาเคน', trade: ['Naropin'] },
        { id: 'prilocaine',  generic: 'Prilocaine',  th: 'ไพรโลเคน',  trade: ['Citanest', 'EMLA (w/ lidocaine)'] },
        { id: 'articaine',   generic: 'Articaine',   th: 'อาร์ติเคน', trade: ['Septanest', 'Ubistesin'] }
      ],
      // in-class (other amides) — cross-reactivity low/inconsistent
      crossReason: 'amide เหมือนกัน — แพ้ข้ามไม่บ่อยและไม่แน่นอน',
      crossReactive: [
        { id: 'lidocaine',   generic: 'Lidocaine',   th: 'ลิโดเคน',   sub: 'Amide LA', pct: 'แพ้ข้ามต่ำ' },
        { id: 'bupivacaine', generic: 'Bupivacaine', th: 'บูพิวาเคน', sub: 'Amide LA', pct: 'แพ้ข้ามต่ำ' },
        { id: 'mepivacaine', generic: 'Mepivacaine', th: 'เมพิวาเคน', sub: 'Amide LA', pct: 'แพ้ข้ามต่ำ' },
        { id: 'ropivacaine', generic: 'Ropivacaine', th: 'โรพิวาเคน', sub: 'Amide LA', pct: 'แพ้ข้ามต่ำ' },
        { id: 'prilocaine',  generic: 'Prilocaine',  th: 'ไพรโลเคน',  sub: 'Amide LA', pct: 'แพ้ข้ามต่ำ' },
        { id: 'articaine',   generic: 'Articaine',   th: 'อาร์ติเคน', sub: 'Amide LA', pct: 'แพ้ข้ามต่ำ' }
      ],
      // safe — ester LAs (different class, no cross-reactivity)
      safeReason: 'ester LA คนละโครงสร้าง → ไม่แพ้ข้ามกับ amide (หรือใช้ amide ตัวอื่นที่ skin test + graded challenge ผ่าน)',
      safe: [
        { generic: 'Procaine',   th: 'โพรเคน',   sub: 'Ester LA' },
        { generic: 'Tetracaine', th: 'เตตราเคน', sub: 'Ester LA' },
        { generic: 'Benzocaine', th: 'เบนโซเคน', sub: 'Ester LA (เฉพาะที่)' },
        { generic: 'Amide LA ตัวอื่นที่ผ่าน skin test + graded challenge', th: 'amide ที่ทดสอบแล้วว่าใช้ได้',
          sub: 'ยืนยันโดยผู้เชี่ยวชาญ' }
      ],
      // additive caveat: metabisulfite in epinephrine-containing LA
      caution: [
        { generic: 'สูตรผสม epinephrine (มี metabisulfite)', th: 'ยาชาผสม adrenaline',
          sub: 'sodium metabisulfite = สารกันหืน', pct: 'ระวัง',
          reason: 'metabisulfite (ในสูตรผสม epi) เป็นสารก่อแพ้คนละตัว → ถ้าสงสัยให้ใช้สูตรไม่ผสม epi',
          advice: 'เลือกสูตร plain (ไม่ผสม adrenaline) ถ้าสงสัย metabisulfite' }
      ],
      noteMild: 'แพ้ผื่นจาก amide LA (พบน้อยมาก): แพ้ข้ามในกลุ่ม amide ต่ำ → ยืนยันด้วย skin test; ใช้ ester LA ได้ (ไม่แพ้ข้าม)',
      noteIge:  'IgE ต่อ amide LA: แพ้ข้ามในกลุ่ม amide ต่ำ/ไม่แน่นอน → ใช้ ester LA (ไม่แพ้ข้าม) หรือ amide ตัวอื่นที่ skin test ผ่าน',
      noteScar: 'SCAR จาก amide LA (พบยากมาก): เลี่ยง amide ทั้งกลุ่ม · ห้าม challenge · ใช้ ester LA ภายใต้การดูแล',
      scarCautionNote: 'กรณี SCAR: เลี่ยงทั้งกลุ่ม amide',
      singleDrugCallout: '💡 การแพ้ amide LA จริงพบ <1% — ส่วนใหญ่เป็นปฏิกิริยาไม่ใช่ภูมิแพ้ (vasovagal / ใจสั่นจาก epinephrine / วิตกกังวล / พิษจากยา) ควรซักประวัติให้แน่ใจก่อน · แพ้ข้าม amide↔amide ต่ำ/ไม่แน่นอน → ใช้ ester LA ได้ หรือยืนยัน amide ตัวอื่นด้วย skin test + graded challenge · ระวัง metabisulfite ในสูตรผสม epinephrine'
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

    // in-class cross-reactive drugs. Default = avoid (high). For groups where
    // modern evidence shows LOW in-class cross-reactivity (crossClassCaution,
    // e.g. fluoroquinolones ~2-5%), they are "caution" for non-SCAR severities
    // and only escalate to "avoid (high)" at SCAR. Exclude the culprit itself.
    const crossAsCaution = !!g.crossClassCaution && !isScar;
    const crossList = g.crossReactive.filter(function (d) { return d.id !== allergenId; }).map(function (d) {
      return {
        drug: { generic: d.generic, th: d.th, class: d.sub },
        decision: crossAsCaution ? 'caution' : 'avoid',
        tier: crossAsCaution ? 'low' : 'high',
        pct: d.pct || (crossAsCaution ? 'แพ้ข้ามต่ำ' : 'แพ้ข้ามได้'),
        reason: d.reason || g.crossReason, refs: g.refs,
        advice: d.advice || (isScar ? 'หลีกเลี่ยงทั้งหมด · ห้าม challenge' : '')
      };
    });

    // safe alternatives -> "safer" normally; downgraded to "caution" if SCAR —
    // UNLESS the group opts out (keepSafeOnScar: e.g. non-aromatic AEDs are the
    // recommended switch after an aromatic-AED SCAR, so they stay safe).
    // Items may carry their own pct/reason/advice; otherwise fall back to group.
    const scarDowngradesSafe = isScar && !g.keepSafeOnScar;
    const safeItems = g.safe.map(function (d) {
      return {
        drug: { generic: d.generic, th: d.th, class: d.sub },
        decision: scarDowngradesSafe ? 'caution' : 'safer',
        tier: scarDowngradesSafe ? 'moderate' : 'negligible',
        pct: scarDowngradesSafe ? 'ระวัง' : (d.pct || 'ไม่แพ้ข้าม'),
        reason: d.reason || g.safeReason, refs: g.refs,
        advice: scarDowngradesSafe ? g.scarCautionNote : (d.advice || '')
      };
    });

    // group-level caution items (e.g. NSAID preferential COX-2) — always caution
    // (independent of severity); SCAR keeps them in caution too.
    const cautionItems = (g.caution || []).map(function (d) {
      return {
        drug: { generic: d.generic, th: d.th, class: d.sub },
        decision: 'caution', tier: 'low', pct: d.pct || 'ระวัง',
        reason: d.reason || g.cautionReason || '', refs: g.refs,
        advice: d.advice || ''
      };
    });

    let note = g.noteIge;
    if (isScar) note = g.noteScar;
    else if (sev.id === 'mild' || sev.id === 'unknown') note = g.noteMild;

    // chemical-group-aware callout: in the single-drug (selective) phenotype,
    // cross-reactivity follows chemical class -> name the culprit's same-group
    // siblings present in the lists so the pharmacist sees what else to avoid.
    let callout = g.singleDrugCallout || '';
    if (callout && g.chemGroupAware && a.chem) {
      const lbl = (g.chemLabels && g.chemLabels[a.chem]) || a.chem;
      const sibs = [];
      ['crossReactive', 'caution', 'safe'].forEach(function (k) {
        (g[k] || []).forEach(function (d) {
          if (d.chem !== a.chem) return;
          if (d.id && d.id === allergenId) return;     // skip the culprit itself
          if (d.generic === a.generic) return;
          if (sibs.indexOf(d.th) < 0) sibs.push(d.th);
        });
      });
      callout += sibs.length
        ? ' — กลุ่มเคมีเดียวกัน (' + lbl + ') ที่ควรเลี่ยงด้วยถ้าเป็น single-drug: ' + sibs.join(', ')
        : ' — ยานี้อยู่กลุ่มเคมี ' + lbl + ' (ไม่มีตัวอื่นในรายการกลุ่มเดียวกัน)';
    }

    return {
      allergen: { generic: a.generic, th: a.th, class: g.label, trade: a.trade },
      severity: sev,
      severityNote: note,
      calloutNote: callout,
      avoid: crossAsCaution ? [] : crossList,
      caution: cautionItems
        .concat(crossAsCaution ? crossList : [])
        .concat(scarDowngradesSafe ? safeItems : []),
      safer: scarDowngradesSafe ? [] : safeItems,
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
