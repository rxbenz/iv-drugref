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
    harboe2010: 'Harboe T, et al. Suspected allergy to local anaesthetics: follow-up in 135 cases. Acta Anaesthesiol Scand 2010;54(5):536-42.',
    esur2025cm: 'ESUR Contrast Media Safety Committee. Hypersensitivity reactions to contrast media: Part 1 & 2 (updated guidelines). Eur Radiol 2025.',
    icmClass2024: 'Cross-reactivity in hypersensitivity reactions to contrast agents: new classification and guide for clinical practice. Eur Radiol 2024;34. (carbamoyl side-chain grouping)',
    icmSkinTest2024: 'Skin Test Reactivity Patterns in Patients Allergic to Iodinated Contrast Media: A Refined View. J Allergy Clin Immunol Pract 2024;12(11). (PMID 39056227)',
    acr2023cm: 'ACR Committee on Drugs and Contrast Media. ACR Manual on Contrast Media (2023) — premedication regimens & "no iodine allergy"/seafood myth.',
    ash2018hit: 'Cuker A, et al. American Society of Hematology 2018 guidelines for management of venous thromboembolism: heparin-induced thrombocytopenia. Blood Adv 2018;2(22):3360-92.',
    dthHeparin: 'Schindewolf M, et al. Delayed-type hypersensitivity to heparins/heparinoids — patterns of cross-reactivity; tolerance of fondaparinux. (Allergy 2007;62; PMID 17573880 / PMID 15025697)',
    vfr2021: 'Alvarez-Arango S, et al. Vancomycin Infusion Reaction — Moving Beyond "Red Man Syndrome". N Engl J Med 2021;384(14):1283-1286. (rate-related, non-IgE; rename)',
    vfrMgmt: 'Sivagnanam S, Deleu D. Red man syndrome. Crit Care 2003;7(2):119-120. + Martin/ASHP-IDSA vancomycin guidance — slow infusion ≥60 min/g (≤10 mg/min) ± antihistamine.',
    vancoHsr: 'Glycopeptide hypersensitivity — DRESS, linear IgA bullous dermatosis, anaphylaxis; vancomycin↔teicoplanin cross-reactivity variable (~10-15%). (Minhas 2016; An 2011; Hwang 2021)',
    // Parecoxib / COX-2 in NSAID hypersensitivity (pharmacist-verified 2026-07)
    colanardi2008: 'Colanardi MC, et al. Safety of parecoxib in patients with nonsteroidal anti-inflammatory drug-induced urticaria or angioedema. Ann Allergy Asthma Immunol 2008;100(1):82-85. (PMID 18254487 — n=79 incl. 31 multiple-class/cross-reactive, 0% reacted to parecoxib)',
    // Tetracycline group (pharmacist-verified 2026-07)
    maciag2020: 'Maciag MC, et al. Hypersensitivity to tetracyclines: skin testing, graded challenge, and desensitization regimens. Ann Allergy Asthma Immunol 2020;124(6):589-593. (cross-reactivity "not established"; skin test + graded challenge/desensitization enable use)',
    hamilton2019: 'Hamilton LA, Guarascio AJ. Tetracycline Allergy. Pharmacy (Basel) 2019;7(3):104.',
    tham1996: 'Tham SN, Kwok YK, Chan HL. Cross-reactivity in fixed drug eruptions to tetracyclines. Arch Dermatol 1996;132(9):1134-1135. (tetracycline↔doxycycline ~62.5%, ↔minocycline ~18.75%, 37.5% no cross-sensitivity)',
    correia1999: 'Correia O, Delgado L, Polonia J. Genital fixed drug eruption: cross-reactivity between doxycycline and minocycline. Clin Exp Dermatol 1999;24(2):137.',
    minoLupus: 'Minocycline-specific severe reactions — Shepherd J. Minocycline-induced lupus. J Am Board Fam Pract 2002;15(3):239-241; Brown RJ, et al. Minocycline-induced drug hypersensitivity syndrome followed by multiple autoimmune sequelae. Arch Dermatol 2009;145(1):63-66.',
    // Nitroimidazole group (pharmacist-verified 2026-07)
    gendelman2014: 'Gendelman SR, Pien LC, Gutta RC, Abouhassan SR. Modified oral metronidazole desensitization protocol. Allergy Rhinol (Providence) 2014;5(2):e66-e69. ("because of the similar chemical structure of nitroimidazoles, patients with hypersensitivity to metronidazole may also have hypersensitivity to tinidazole")',
    hollis2022: 'Hollis CC, Mlauzi C, Ashton M. Oral metronidazole desensitization for IgE-mediated hypersensitivity. Cureus 2022;14(7):e26849. (tinidazole "posed a serious risk" → desensitize metronidazole rather than switch)',
    cahill2021: 'Cahill JA, Sahota PS, Kan M. Failure of a single day metronidazole desensitization protocol, and success of a modified two-day protocol. Allergy Asthma Clin Immunol 2021;17(1):136.',
    // Opioid group (pharmacist-verified 2026-07)
    khalaf2025: 'Khalaf A, Lane M, Meyer Reid J. Opioid Allergy Cross-Reactivity: A Retrospective Study Across Three Opioid Classes. J Pain Palliat Care Pharmacother 2025. (NO cross-reactivity between opioid structural classes → 100% re-exposure tolerance)',
    baldo2018: 'Baldo BA. Opioid analgesic drugs: misuse, toxicity, and hypersensitivity (Editorial). J Allergy Clin Immunol Pract 2018. (pseudoallergy/histamine release vs true IgE; structural classes — morphine/codeine/meperidine release histamine, fentanyl minimal)',
    ashp2019: 'Assessment of opioid cross-reactivity and provider perceptions in hospitalized patients. Ann Pharmacother 2019;53(11):1117-1123.',
    // Corticosteroid group (pharmacist-verified 2026-07)
    baeck2011: 'Baeck M, Chemelle JA, Goossens A, Nicolas JF, Terreux R. Corticosteroid cross-reactivity: clinical and molecular modelling tools. Allergy 2011;66(10):1367-1374.',
    berbegal2016: 'Berbegal L, DeLeon FJ, Silvestre JF. Hypersensitivity Reactions to Corticosteroids. Actas Dermosifiliogr 2016;107(2):107-115. (Coopman A/B/C/D; betamethasone/dexamethasone tolerated in many cases)',
    chen2022cs: 'Chen JY, Yiannias JA, Hall MR, et al. Reevaluating Corticosteroid Classification Models in Patient Patch Testing. JAMA Dermatol 2022.',
    baker2015: 'Baker A, Empson M, The R, Fitzharris P. Skin testing for immediate hypersensitivity to corticosteroids: a case series and literature review. Clin Exp Allergy 2015;45(3):669-676.',
    jiaci2006cs: 'Immediate hypersensitivity to corticosteroids. J Investig Allergol Clin Immunol 2006;16(1):51-56. (the causative agent may be an excipient, not the steroid molecule)',
    guillet2025: 'Guillet C, et al. Anaphylaxis to carboxymethylcellulose in an intra-articular triamcinolone (Triamcort) injection — a case report. Front Allergy 2025;6:1663395. doi:10.3389/falgy.2025.1663395'
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

  // Shared non-immune management for local anesthetics (true IgE allergy <1%).
  const LA_PSEUDO = {
    title: 'ปฏิกิริยาต่อยาชาเฉพาะที่ (true allergy <1% — ส่วนใหญ่ไม่ใช่ภูมิแพ้)',
    points: [
      'การแพ้ LA แบบ IgE จริงพบ <1% — ส่วนใหญ่เป็น vasovagal (หน้ามืด/เป็นลม), ใจสั่นจาก epinephrine, วิตกกังวล หรือพิษจากยา (toxicity)',
      'สารก่อปฏิกิริยาที่แท้จริงมักเป็น "สารกันเสีย/กันหืน": methylparaben (ในขวด multidose) และ metabisulfite (ในสูตรผสม adrenaline)',
      '🎯 จัดการ: เลือก LA ชนิด preservative-free / single-dose และสูตร plain (ไม่ผสม adrenaline) ถ้าสงสัย metabisulfite',
      'ester↔amide ไม่แพ้ข้ามกัน — เปลี่ยนข้ามกลุ่มได้ · ถ้าสงสัยแพ้จริง → ส่ง skin test + graded challenge ยืนยัน'
    ],
    refs: ['bhole2012', 'harboe2010']
  };

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
      refs: ['kowalski2013', 'dona2020', 'khan2022', 'nsaidReview2026', 'colanardi2008'],
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
        { generic: 'Parecoxib', th: 'พาเรค็อกซิบ', sub: 'COX-2 selective (IV/IM)', pct: 'แพ้ข้ามต่ำมาก', chem: 'coxib',
          reason: 'COX-2 selective สูง (prodrug ของ valdecoxib, มีรูปแบบฉีด IV/IM); ผู้ป่วย NSAID cross-reactive ส่วนใหญ่ใช้ได้ (Colanardi 2008: n=79 รวมกลุ่ม cross-reactive 31 ราย แพ้ 0%) เทียบเท่า celecoxib/etoricoxib',
          advice: 'แนะนำยืนยันด้วย graded challenge ก่อนใช้จริง · มีหมู่ sulfonamide แต่เป็น non-antibiotic sulfonamide (ไม่มีหมู่ N4 arylamine) → ไม่แพ้ข้ามกับ sulfonamide antibiotic (CCJM 2025; Strom 2003) — ให้ในผู้แพ้ sulfa antibiotic ได้เหมือน celecoxib' },
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
      singleDrugCallout: '⚠️ ถ้าแพ้ NSAID “ตัวเดียว” (เคยใช้ NSAID ตัวอื่นได้ปกติ หรือ anaphylaxis ต่อตัวเดียว) = single-drug (selective) ไม่ใช่ cross-reactive → เลี่ยงเฉพาะตัวที่แพ้ + กลุ่มเคมีเดียวกัน ส่วน NSAID กลุ่มเคมีอื่นใช้ได้ แม้เป็น COX-1 แรง',
      // PHENOTYPE selector (EAACI/ENDA — Kowalski 2013, Doña 2020): NSAID
      // hypersensitivity splits into a cross-reactive (pharmacologic, COX-1) arm
      // and a single-drug (immunologic, chemical-group) arm — the two give
      // OPPOSITE recommendations, so make it an explicit input, not just a note.
      phenotypeLabel: 'ลักษณะการแพ้ NSAID',
      phenotypeDefault: 'cross',
      phenotypes: [
        { id: 'cross',  label: 'Cross-reactive: แพ้ NSAID หลายตัว / หืด-ริดสีดวงจมูก (NERD) / ลมพิษ (NECD-NIUA)',
          note: 'Cross-reactive (COX-1, pseudoallergy): เลี่ยง COX-1 แรงทั้งหมด · COX-2 selective/paracetamol มักใช้ได้' },
        { id: 'single', label: 'Single-drug: แพ้ NSAID ตัวเดียว (เคยใช้ตัวอื่นได้ / anaphylaxis ต่อตัวเดียว)',
          note: 'Single-drug (selective, immunologic): เลี่ยงเฉพาะตัวที่แพ้ + NSAID กลุ่มเคมีเดียวกัน · กลุ่มเคมีอื่นใช้ได้แม้เป็น COX-1 แรง' }
      ]
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
      singleDrugCallout: '💡 ester LA แพ้ข้ามกันผ่านสาร PABA → ถ้าแพ้ ester ตัวหนึ่งให้ถือว่าเสี่ยงทั้งกลุ่ม แต่ใช้ amide LA (lidocaine ฯลฯ) ได้เพราะไม่แพ้ข้าม · ระวัง preservative methylparaben (ใกล้ PABA) → เลือก preservative-free · หมายเหตุ: แพ้ LA จริงพบ <1% ส่วนใหญ่เป็นปฏิกิริยาไม่ใช่ภูมิแพ้ (vasovagal/epinephrine)',
      pseudo: LA_PSEUDO
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
      singleDrugCallout: '💡 การแพ้ amide LA จริงพบ <1% — ส่วนใหญ่เป็นปฏิกิริยาไม่ใช่ภูมิแพ้ (vasovagal / ใจสั่นจาก epinephrine / วิตกกังวล / พิษจากยา) ควรซักประวัติให้แน่ใจก่อน · แพ้ข้าม amide↔amide ต่ำ/ไม่แน่นอน → ใช้ ester LA ได้ หรือยืนยัน amide ตัวอื่นด้วย skin test + graded challenge · ระวัง metabisulfite ในสูตรผสม epinephrine',
      pseudo: LA_PSEUDO
    },
    // ── Iodinated contrast media (ICM) ───────────────────────────────────────
    // Cross-reactivity tracks the CARBAMOYL SIDE CHAIN, not "iodine": agents that
    // share a side-chain cluster cross-react strongly (~60-77%), agents from a
    // different cluster are lower-risk but unpredictable → confirm a safe
    // alternative with skin testing. Modelled with clusterAware so SAME-cluster
    // agents = avoid (high) and DIFFERENT-cluster = caution (skin-test to confirm).
    // Key myths busted in the callout: "iodine"/seafood allergy is unrelated;
    // routine premedication is no longer recommended (ESUR 2025, weak evidence).
    {
      id: 'icm',
      label: 'Iodinated Contrast Media (สารทึบรังสีไอโอดีน)',
      refs: ['esur2025cm', 'icmClass2024', 'icmSkinTest2024'],
      clusterAware: true,     // cross-reactivity by carbamoyl side-chain cluster
      keepSafeOnScar: true,   // gadolinium / non-contrast are a different class
      // clusters: A=classic dihydroxypropyl-carbamoyl, B=distinct side chain
      //   (common alternatives), C=mixed (iopromide), D=ionic (older agents)
      allergens: [
        { id: 'iohexol',     generic: 'Iohexol',     th: 'ไอโอเฮกซอล',   trade: ['Omnipaque'], cluster: 'carbamoylA' },
        { id: 'iomeprol',    generic: 'Iomeprol',    th: 'ไอโอเมพรอล',   trade: ['Iomeron'],   cluster: 'carbamoylA' },
        { id: 'ioversol',    generic: 'Ioversol',    th: 'ไอโอเวอร์ซอล', trade: ['Optiray'],   cluster: 'carbamoylA' },
        { id: 'iodixanol',   generic: 'Iodixanol',   th: 'ไอโอดิกซานอล', trade: ['Visipaque'], cluster: 'carbamoylA' },
        { id: 'iopamidol',   generic: 'Iopamidol',   th: 'ไอโอพามิดอล',  trade: ['Iopamiro', 'Isovue'], cluster: 'distinctB' },
        { id: 'iobitridol',  generic: 'Iobitridol',  th: 'ไอโอบิทริดอล', trade: ['Xenetix'],   cluster: 'distinctB' },
        { id: 'iopromide',   generic: 'Iopromide',   th: 'ไอโอโพรไมด์',  trade: ['Ultravist'], cluster: 'mixedC' },
        { id: 'ioxaglate',   generic: 'Ioxaglate',   th: 'ไอโอซากเลต',   trade: ['Hexabrix'],  cluster: 'ionicD' },
        { id: 'diatrizoate', generic: 'Diatrizoate', th: 'ไดอะไทรโซเอต', trade: ['Urografin', 'Gastrografin'], cluster: 'ionicD' }
      ],
      // all other ICM — engine assigns avoid/caution per cluster vs the culprit
      crossReason: 'สารทึบรังสีไอโอดีน — แพ้ข้ามตาม side chain (carbamoyl); side chain เดียวกัน = แพ้ข้ามสูง',
      crossReactive: [
        { id: 'iohexol',     generic: 'Iohexol',     th: 'ไอโอเฮกซอล',   sub: 'Side chain A (classic carbamoyl)', cluster: 'carbamoylA' },
        { id: 'iomeprol',    generic: 'Iomeprol',    th: 'ไอโอเมพรอล',   sub: 'Side chain A (classic carbamoyl)', cluster: 'carbamoylA' },
        { id: 'ioversol',    generic: 'Ioversol',    th: 'ไอโอเวอร์ซอล', sub: 'Side chain A (classic carbamoyl)', cluster: 'carbamoylA' },
        { id: 'iodixanol',   generic: 'Iodixanol',   th: 'ไอโอดิกซานอล', sub: 'Side chain A (classic carbamoyl, dimer)', cluster: 'carbamoylA' },
        { id: 'iopamidol',   generic: 'Iopamidol',   th: 'ไอโอพามิดอล',  sub: 'Side chain B (ต่างกลุ่ม)', cluster: 'distinctB' },
        { id: 'iobitridol',  generic: 'Iobitridol',  th: 'ไอโอบิทริดอล', sub: 'Side chain B (ต่างกลุ่ม)', cluster: 'distinctB' },
        { id: 'iopromide',   generic: 'Iopromide',   th: 'ไอโอโพรไมด์',  sub: 'Side chain C (ผสม)', cluster: 'mixedC' },
        { id: 'ioxaglate',   generic: 'Ioxaglate',   th: 'ไอโอซากเลต',   sub: 'Ionic dimer (ต่างกลุ่ม)', cluster: 'ionicD' },
        { id: 'diatrizoate', generic: 'Diatrizoate', th: 'ไดอะไทรโซเอต', sub: 'Ionic monomer (ต่างกลุ่ม)', cluster: 'ionicD' }
      ],
      // safe — structurally unrelated alternatives (no cross-reactivity with ICM)
      safeReason: 'คนละ class กับ ICM → ไม่แพ้ข้าม (เลือกตามความเหมาะสมของการตรวจ)',
      safe: [
        { generic: 'Gadolinium-based contrast (MRI)', th: 'สารทึบรังสีแกโดลิเนียม', sub: 'คนละ class — ไม่แพ้ข้ามกับ ICM' },
        { generic: 'การตรวจที่ไม่ใช้สารทึบรังสี / อัลตราซาวด์', th: 'ทางเลือกไม่ใช้ ICM', sub: 'พิจารณาตามข้อบ่งชี้' },
        { generic: 'ICM ตัวที่ skin test ผ่าน (ต่าง side chain)', th: 'ICM ที่ทดสอบแล้วว่าใช้ได้', sub: 'ยืนยันโดยผู้เชี่ยวชาญ' }
      ],
      noteMild: 'แพ้ ICM (non-immediate/ผื่น): เลี่ยงตัวเดิม + ตัว side chain เดียวกัน → เลือก side chain ต่างกลุ่ม และยืนยันด้วย skin test',
      noteIge:  'แพ้ ICM (immediate): เลี่ยงตัวเดิม + ตัว side chain เดียวกัน → เลือก side chain ต่างกลุ่มที่ skin test ผ่าน · premedication ไม่ใช่ทางออกที่เชื่อถือได้ (ESUR 2025)',
      noteScar: 'SCAR จาก ICM (พบยาก): เลี่ยง ICM ทั้งหมดเด็ดขาด · ห้าม challenge · พิจารณา GBCA/การตรวจอื่น',
      scarCautionNote: 'กรณี SCAR: เลี่ยง ICM ทั้งหมด',
      singleDrugCallout: '⚠️ ความเชื่อผิด: การแพ้ ICM "ไม่ใช่" การแพ้ไอโอดีน และ "ไม่เกี่ยวกับการแพ้อาหารทะเล/กุ้งหอยปูปลา" — ห้ามใช้ประวัติแพ้อาหารทะเลมาห้ามให้ ICM · 💡 การแพ้ข้ามขึ้นกับ side chain (carbamoyl): ตัว side chain เดียวกันแพ้ข้ามสูง (~60-77%) → เลือกตัว side chain ต่างกลุ่ม + ยืนยันด้วย skin test (วิธีเดียวที่เชื่อถือได้) · premedication ด้วย steroid/antihistamine ไม่แนะนำให้ใช้ routinely แล้ว (ESUR 2025 — หลักฐานไม่ดีพอ การเปลี่ยนตัวยาสำคัญกว่า) · Gadolinium (MRI) ไม่แพ้ข้ามกับ ICM',
      // Non-immune / pseudoallergy ACTIONABLE management (shown when the user
      // marks the reaction as non-immune). Most immediate ICM reactions are
      // non-IgE (direct mast-cell) — the priorities are myth-busting, switching
      // the agent (different side-chain cluster) + skin test, and using premed
      // only per institutional protocol (ESUR 2025 de-emphasises routine premed).
      pseudo: {
        title: 'การจัดการปฏิกิริยาต่อสารทึบรังสี (ส่วนใหญ่เป็น non-immune / pseudoallergy)',
        points: [
          '⚠️ "ไม่ใช่การแพ้ไอโอดีน" และ "ไม่เกี่ยวกับการแพ้อาหารทะเล" — ห้ามใช้ประวัติแพ้อาหารทะเลมาห้ามให้ ICM',
          'ปฏิกิริยา immediate ส่วนใหญ่เป็น non-IgE (direct mast-cell activation) แต่ที่รุนแรง (anaphylaxis แท้) ก็พบได้',
          '🎯 จัดการสำคัญสุด: เปลี่ยนเป็น ICM ตัว side chain (carbamoyl) ต่างกลุ่ม + ยืนยันด้วย skin test · ใช้ low-/iso-osmolar non-ionic',
          'Gadolinium (MRI) ไม่แพ้ข้ามกับ ICM — เป็นทางเลือกถ้าเหมาะกับการตรวจ'
        ],
        premedNote: 'Premedication: ESUR 2025 ไม่แนะนำใช้ routinely (หลักฐานไม่ดีพอ ไม่กันปฏิกิริยารุนแรงได้จริง — การเปลี่ยน agent สำคัญกว่า) ใช้เฉพาะรายที่จำเป็นตาม institutional protocol',
        premed: [
          { when: 'Elective (ACR)', what: 'Prednisolone 50 mg PO ที่ 13, 7 และ 1 ชม. ก่อนฉีด + Diphenhydramine 50 mg (PO/IV) ที่ 1 ชม. ก่อน' },
          { when: 'Urgent (ACR)', what: 'Hydrocortisone 200 mg IV q4h จนถึงเวลาฉีด + Diphenhydramine 50 mg IV 1 ชม. ก่อน' }
        ],
        refs: ['esur2025cm', 'acr2023cm', 'icmClass2024']
      }
    },
    // ── Heparins ─────────────────────────────────────────────────────────────
    // TWO distinct immune reactions, both with broad UFH<->LMWH cross-reactivity:
    //   (1) HIT (heparin-induced thrombocytopenia): anti-PF4/heparin antibodies →
    //       thrombocytopenia + thrombosis (life-threatening, NOT a rash). UFH↔LMWH
    //       cross-react ~50% in vivo → avoid ALL heparins. Switch to a non-heparin
    //       anticoagulant: argatroban/bivalirudin (DTIs, non-cross-reacting),
    //       fondaparinux, danaparoid, or a DOAC (ASH 2018).
    //   (2) Delayed-type hypersensitivity (DTH): eczematous plaques at SC injection
    //       site; broad UFH↔LMWH cross-reactivity (independent of MW); fondaparinux
    //       tolerated (~6% cross); IV UFH often tolerated despite SC DTH.
    // Whole-class cross-reactivity (like sulfonamide) → default avoid, not cluster-
    // aware. Alternatives stay safe even at SCAR (they ARE the recommended switch).
    {
      id: 'heparin',
      label: 'Heparins (เฮพาริน / LMWH)',
      refs: ['ash2018hit', 'dthHeparin'],
      keepSafeOnScar: true,   // non-heparin anticoagulants are the recommended switch
      allergens: [
        { id: 'heparin-ufh', generic: 'Heparin (UFH)', th: 'เฮพารินไม่แยกส่วน', trade: ['Heparin sodium'] },
        { id: 'enoxaparin',  generic: 'Enoxaparin',    th: 'อีน็อกซาพาริน',    trade: ['Clexane', 'Lovenox'] },
        { id: 'dalteparin',  generic: 'Dalteparin',    th: 'ดัลทีพาริน',       trade: ['Fragmin'] },
        { id: 'nadroparin',  generic: 'Nadroparin',    th: 'นาโดรพาริน',       trade: ['Fraxiparine'] },
        { id: 'tinzaparin',  generic: 'Tinzaparin',    th: 'ทินซาพาริน',       trade: ['Innohep'] }
      ],
      crossReason: 'แพ้ข้ามทั้งกลุ่ม heparin — HIT: UFH↔LMWH ~50% in vivo · DTH: แพ้ข้ามกว้าง (ไม่ขึ้นกับ MW)',
      crossReactive: [
        { id: 'heparin-ufh', generic: 'Heparin (UFH)', th: 'เฮพารินไม่แยกส่วน', sub: 'Unfractionated heparin' },
        { id: 'enoxaparin',  generic: 'Enoxaparin',    th: 'อีน็อกซาพาริน',    sub: 'LMWH' },
        { id: 'dalteparin',  generic: 'Dalteparin',    th: 'ดัลทีพาริน',       sub: 'LMWH' },
        { id: 'nadroparin',  generic: 'Nadroparin',    th: 'นาโดรพาริน',       sub: 'LMWH' },
        { id: 'tinzaparin',  generic: 'Tinzaparin',    th: 'ทินซาพาริน',       sub: 'LMWH' }
      ],
      // danaparoid: heparinoid with in-vitro cross-reactivity (rarely clinically
      // relevant in HIT) → caution, not a clean alternative.
      cautionReason: 'Danaparoid มี cross-reactivity ใน vitro (พบในร่างกายน้อย) — ใช้ใน HIT ได้แต่ต้องระวัง',
      caution: [
        { generic: 'Danaparoid', th: 'ดานาพารอยด์', sub: 'Heparinoid', pct: 'cross ใน vitro (in vivo น้อย)' }
      ],
      safeReason: 'ยาต้านการแข็งตัวที่ไม่ใช่ heparin — ไม่แพ้ข้ามกับ heparin (ทางเลือกที่แนะนำ)',
      safe: [
        { generic: 'Argatroban',  th: 'อาร์กาโทรแบน', sub: 'Direct thrombin inhibitor (DTI)', reason: 'ไม่แพ้ข้าม · ครึ่งชีวิตสั้น — เหมาะกรณีวิกฤต/ตับปกติ (ASH 2018)' },
        { generic: 'Bivalirudin', th: 'ไบวาลิรูดิน',  sub: 'Direct thrombin inhibitor (DTI)', reason: 'ไม่แพ้ข้าม · ครึ่งชีวิตสั้น — เหมาะกรณีวิกฤต/หัตถการ (ASH 2018)' },
        { generic: 'Fondaparinux', th: 'ฟอนดาพารินุกซ์', sub: 'Synthetic factor Xa inhibitor', reason: 'HIT: ตัวเลือกที่แนะนำ (ความเสี่ยงต่ำ) · DTH: ทนได้ดี (~6% cross)' },
        { generic: 'DOAC (Apixaban / Rivaroxaban / Dabigatran)', th: 'ยาต้านการแข็งตัวชนิดรับประทาน', sub: 'DOAC', reason: 'ทางเลือกในผู้ป่วยที่อาการคงที่ (ASH 2018)' }
      ],
      noteMild: 'แพ้ heparin (ผื่น/DTH): เลี่ยง heparin ทุกตัว (UFH+LMWH แพ้ข้ามกว้าง) → fondaparinux ทนได้ดี · IV UFH มักใช้ได้แม้แพ้ SC heparin (ปรึกษาผู้เชี่ยวชาญ)',
      noteIge:  'แพ้ heparin: เลี่ยง heparin ทุกตัว → ใช้ DTI (argatroban/bivalirudin), fondaparinux หรือ DOAC',
      noteScar: 'ปฏิกิริยารุนแรง/HIT with thrombosis: เลี่ยง heparin ทุกตัวเด็ดขาด → DTI (argatroban/bivalirudin) เป็นหลัก · ห้าม challenge',
      scarCautionNote: 'กรณีรุนแรง: ใช้ DTI เป็นหลัก',
      singleDrugCallout: '⚠️ แยก 2 ภาวะให้ชัด — (1) HIT (heparin-induced thrombocytopenia): ภูมิคุ้มกันต่อ PF4/heparin complex → เกล็ดเลือดต่ำ + ลิ่มเลือดอุดตัน (อันตรายถึงชีวิต ไม่ใช่ผื่นแพ้) · UFH↔LMWH แพ้ข้าม ~50% in vivo → เลี่ยง heparin ทุกตัว · ใช้ argatroban/bivalirudin (DTI), fondaparinux, danaparoid หรือ DOAC (ASH 2018) · ห้ามใช้ LMWH แทน UFH ใน HIT · (2) Delayed-type hypersensitivity: ผื่น eczema ที่จุดฉีด SC, UFH↔LMWH แพ้ข้ามกว้าง (ไม่ขึ้นกับ MW), fondaparinux ทนได้ดี (~6% cross) และ IV UFH มักใช้ได้แม้แพ้ SC heparin'
    },
    // ── Glycopeptides (Vancomycin / Teicoplanin) ─────────────────────────────
    // The classic teaching case for "not an allergy": vancomycin flushing
    // reaction (formerly red man syndrome) is a rate-related, non-IgE histamine
    // release — managed by SLOWING the infusion, NOT by abandoning the drug.
    // True glycopeptide hypersensitivity (DRESS, linear IgA, anaphylaxis) is
    // uncommon; vanco↔teicoplanin cross-reactivity is variable (~10-15%) →
    // caution, confirm an alternative by skin test. linezolid/daptomycin = clean
    // gram-positive alternatives (no cross-reactivity).
    {
      id: 'glycopeptide',
      label: 'Glycopeptides (Vancomycin / Teicoplanin)',
      refs: ['vfr2021', 'vfrMgmt', 'vancoHsr'],
      crossClassCaution: true,   // vanco<->teicoplanin cross variable -> caution
      keepSafeOnScar: true,      // linezolid/daptomycin are the recommended switch
      allergens: [
        { id: 'vancomycin',  generic: 'Vancomycin',  th: 'แวนโคไมซิน', trade: ['Vancocin'] },
        { id: 'teicoplanin', generic: 'Teicoplanin', th: 'ไทโคพลานิน', trade: ['Targocid'] }
      ],
      crossReason: 'Glycopeptide ด้วยกัน — แพ้ข้าม vanco↔teicoplanin แปรปรวน (~10-15%) → ระวัง/ยืนยันด้วย skin test',
      crossReactive: [
        { id: 'vancomycin',  generic: 'Vancomycin',  th: 'แวนโคไมซิน', sub: 'Glycopeptide' },
        { id: 'teicoplanin', generic: 'Teicoplanin', th: 'ไทโคพลานิน', sub: 'Glycopeptide' }
      ],
      safeReason: 'คนละ class กับ glycopeptide → ไม่แพ้ข้าม (ทางเลือกสำหรับเชื้อ gram-positive)',
      safe: [
        { generic: 'Linezolid',  th: 'ไลนีโซลิด',  sub: 'Oxazolidinone', reason: 'คนละ class — ไม่แพ้ข้าม' },
        { generic: 'Daptomycin', th: 'แดปโตไมซิน', sub: 'Lipopeptide',    reason: 'คนละ class — ไม่แพ้ข้าม (ห้ามใช้รักษาปอดอักเสบ)' }
      ],
      noteMild: 'แพ้ glycopeptide (ผื่นไม่รุนแรง): เลี่ยงตัวที่แพ้ · teicoplanin แพ้ข้ามแปรปรวน (~10-15%) → ยืนยันด้วย skin test ก่อนใช้ · ทางเลือกที่ไม่แพ้ข้าม: linezolid / daptomycin',
      noteIge:  'IgE/anaphylaxis ต่อ glycopeptide: เลี่ยงตัวที่แพ้ · teicoplanin เสี่ยงแพ้ข้าม → ใช้ linezolid / daptomycin · ถ้าจำเป็นต้องใช้ vancomycin จริง ๆ พิจารณา desensitization โดยผู้เชี่ยวชาญ',
      noteScar: 'SCAR จาก glycopeptide (เช่น DRESS, linear IgA bullous dermatosis): เลี่ยง glycopeptide ทั้งกลุ่มเด็ดขาด · ห้าม challenge/desensitization · ใช้ linezolid / daptomycin',
      scarCautionNote: 'กรณี SCAR: เลี่ยงทั้งกลุ่ม glycopeptide',
      singleDrugCallout: '💡 อาการ "หน้าแดง/คันระหว่างหยดยา (red man)" ที่พบบ่อยที่สุด = vancomycin flushing reaction ซึ่ง "ไม่ใช่การแพ้" แต่เป็นผลจากการให้เร็วเกินไป → เลือก "ไม่ใช่แพ้ภูมิคุ้มกัน" เพื่อดูวิธีจัดการ (ชะลออัตราการให้)',
      pseudo: {
        title: 'Vancomycin flushing reaction (เดิมเรียก "Red man syndrome") — ไม่ใช่การแพ้',
        points: [
          'เกิดจาก "อัตราการให้เร็วเกินไป" → histamine release โดยตรง (non-IgE) ไม่ใช่ภูมิแพ้',
          'อาการ: หน้า/คอ/ลำตัวส่วนบนแดง คัน ร้อนวูบ บางรายความดันตก — มักเกิดระหว่าง/ใกล้จบการ infuse',
          '🎯 ไม่ใช่ข้อห้ามใช้ vancomycin — ให้ "ช้าลง" ก็ใช้ต่อได้ ไม่ต้องเปลี่ยนยา'
        ],
        premedNote: 'แนวทางจัดการ (vancomycin flushing reaction):',
        premed: [
          { when: 'ชะลออัตราการให้', what: 'infuse ≥60 นาที/1 g (≤10 mg/min) · ถ้าเคยเกิด ยืดเป็น ≥90–120 นาที และเจือจางให้เหมาะสม' },
          { when: 'Premedication', what: 'Diphenhydramine 25–50 mg (PO/IV) 30–60 นาทีก่อนให้ ± H2 blocker · ถ้ากำลังเกิดให้หยุดชั่วคราว ให้ antihistamine แล้วเริ่มใหม่ในอัตราที่ช้าลง' }
        ],
        refs: ['vfr2021', 'vfrMgmt']
      }
    },
    // ── Tetracyclines ────────────────────────────────────────────────────────
    // In-class cross-reactivity is NOT well established (limited data), so other
    // tetracyclines are "caution" (non-SCAR) and escalate to "avoid" only at
    // SCAR — the same conservative stance as modern fluoroquinolone guidance.
    // Non-tetracycline antibiotics stay safe even at SCAR (keepSafeOnScar).
    // Pharmacist-verified 2026-07 (refs on the group) — see docs/allergy-nonbetalactam.md
    {
      id: 'tetracycline',
      label: 'Tetracyclines',
      refs: ['maciag2020', 'hamilton2019', 'tham1996', 'correia1999', 'minoLupus'],
      crossClassCaution: true,
      keepSafeOnScar: true,
      allergens: [
        { id: 'doxycycline',  generic: 'Doxycycline',  th: 'ด็อกซีไซคลิน', trade: ['Vibramycin'] },
        { id: 'minocycline',  generic: 'Minocycline',  th: 'ไมโนไซคลิน',   trade: ['Minocin'] },
        { id: 'tetracycline', generic: 'Tetracycline', th: 'เตตราไซคลิน',  trade: [] },
        { id: 'tigecycline',  generic: 'Tigecycline',  th: 'ไทเกไซคลิน',   trade: ['Tygacil'] }
      ],
      crossReason: 'tetracycline กลุ่มเดียวกัน — ข้อมูลแพ้ข้ามภายในกลุ่มจำกัด/ไม่ชัดเจน',
      crossReactive: [
        { id: 'doxycycline',  generic: 'Doxycycline',  th: 'ด็อกซีไซคลิน', sub: 'Tetracycline', pct: 'ข้อมูลจำกัด' },
        { id: 'minocycline',  generic: 'Minocycline',  th: 'ไมโนไซคลิน',   sub: 'Tetracycline (เสี่ยง DRESS/DILE เอง)', pct: 'ข้อมูลจำกัด',
          reason: 'minocycline สัมพันธ์กับ DRESS และ drug-induced lupus เฉพาะตัว (คนละกลไก) — ระวังเป็นพิเศษ' },
        { id: 'tetracycline', generic: 'Tetracycline', th: 'เตตราไซคลิน',  sub: 'Tetracycline', pct: 'ข้อมูลจำกัด' },
        { id: 'tigecycline',  generic: 'Tigecycline',  th: 'ไทเกไซคลิน',   sub: 'Glycylcycline (อนุพันธ์ tetracycline)', pct: 'ข้อมูลจำกัด' }
      ],
      safeReason: 'ยาต่างกลุ่ม (ไม่ใช่ tetracycline) → ไม่มีปัญหาแพ้ข้าม — เลือกตามชนิดการติดเชื้อ',
      safe: [
        { generic: 'Beta-lactam (ถ้าไม่แพ้)', th: 'กลุ่มเบต้าแลคแทม', sub: 'เช่น amoxicillin / cephalexin' },
        { generic: 'Azithromycin / Clarithromycin', th: 'กลุ่มแมโครไลด์', sub: 'Macrolide' },
        { generic: 'Clindamycin', th: 'คลินดามัยซิน', sub: 'Lincosamide' },
        { generic: 'TMP-SMX (Cotrimoxazole)', th: 'โคไตรม็อกซาโซล', sub: 'Sulfonamide antibiotic' }
      ],
      noteMild: 'แพ้ข้ามในกลุ่ม tetracycline "แปรปรวน/ยังไม่สรุป" — โดยทั่วไปเลือกยานอกกลุ่มก่อน; ถ้าจำเป็นต้องใช้ tetracycline ตัวอื่น ยืนยันความปลอดภัยด้วย skin test + graded challenge (Maciag 2020)',
      noteIge:  'แพ้ข้ามในกลุ่ม tetracycline "แปรปรวน/ยังไม่สรุป" — เลือกยานอกกลุ่มก่อน; ถ้าจำเป็นต้องใช้ tetracycline ตัวอื่น ยืนยันด้วย skin test + graded challenge; แพ้รุนแรง/จำเป็นจริง พิจารณา desensitization',
      noteScar: 'SCAR จาก tetracycline: เลี่ยง tetracycline ทั้งกลุ่มเด็ดขาด · ห้าม challenge · ใช้ยานอกกลุ่มเท่านั้น',
      scarCautionNote: 'กรณี SCAR: เลี่ยงทั้งกลุ่ม tetracycline',
      singleDrugCallout: '⚠️ แพ้ข้ามภายในกลุ่ม tetracycline "แปรปรวน/ยังไม่สรุป" (FDE: tetra↔doxy ~62.5%, tetra↔mino ~18.75%, ~37.5% ไม่แพ้ข้าม — Tham 1996) → ไม่จำเป็นต้อง avoid ยกกลุ่ม: ยา tetracycline ตัวอื่นมักใช้ได้หลังยืนยันด้วย skin test + graded challenge (Maciag 2020) · minocycline เสี่ยง DRESS / drug-induced lupus / Sweet syndrome เฉพาะตัว'
    },
    // ── Nitroimidazoles ──────────────────────────────────────────────────────
    // metronidazole ↔ tinidazole (and secnidazole/ornidazole) share the
    // 5-nitroimidazole nucleus and cross-reactivity IS reported → treat other
    // nitroimidazoles as "avoid" (default cross = high). Non-nitroimidazole
    // anaerobe cover stays safe even at SCAR (keepSafeOnScar).
    // Pharmacist-verified 2026-07 (refs on the group) — see docs/allergy-nonbetalactam.md
    {
      id: 'nitroimidazole',
      label: 'Nitroimidazoles',
      refs: ['gendelman2014', 'hollis2022', 'cahill2021'],
      keepSafeOnScar: true,
      allergens: [
        { id: 'metronidazole', generic: 'Metronidazole', th: 'เมโทรนิดาโซล', trade: ['Flagyl'] },
        { id: 'tinidazole',    generic: 'Tinidazole',    th: 'ทินิดาโซล',    trade: [] },
        { id: 'secnidazole',   generic: 'Secnidazole',   th: 'เซคนิดาโซล',   trade: [] },
        { id: 'ornidazole',    generic: 'Ornidazole',    th: 'ออร์นิดาโซล',   trade: [] }
      ],
      crossReason: '5-nitroimidazole เหมือนกัน → มีรายงานแพ้ข้ามภายในกลุ่ม',
      crossReactive: [
        { id: 'metronidazole', generic: 'Metronidazole', th: 'เมโทรนิดาโซล', sub: 'Nitroimidazole' },
        { id: 'tinidazole',    generic: 'Tinidazole',    th: 'ทินิดาโซล',    sub: 'Nitroimidazole' },
        { id: 'secnidazole',   generic: 'Secnidazole',   th: 'เซคนิดาโซล',   sub: 'Nitroimidazole' },
        { id: 'ornidazole',    generic: 'Ornidazole',    th: 'ออร์นิดาโซล',   sub: 'Nitroimidazole' }
      ],
      safeReason: 'ยาต่างกลุ่ม (ไม่ใช่ nitroimidazole) → ไม่แพ้ข้าม — เลือกตามชนิดการติดเชื้อ',
      safe: [
        { generic: 'Clindamycin', th: 'คลินดามัยซิน', sub: 'Lincosamide (คุม anaerobe)' },
        { generic: 'Amoxicillin-clavulanate (ถ้าไม่แพ้ beta-lactam)', th: 'อะม็อกซี-คลาวูลาเนต', sub: 'Beta-lactam/BLI (คุม anaerobe)' },
        { generic: 'Piperacillin-tazobactam (ถ้าไม่แพ้ beta-lactam)', th: 'ไพเพอราซิลลิน-ทาโซแบคแทม', sub: 'Beta-lactam/BLI (คุม anaerobe)' },
        { generic: 'Vancomycin (PO — สำหรับ C. difficile)', th: 'แวนโคไมซินชนิดกิน', sub: 'Glycopeptide (CDI)' }
      ],
      noteMild: 'มีรายงานแพ้ข้ามในกลุ่ม nitroimidazole (metronidazole↔tinidazole) — เลี่ยงทั้งกลุ่ม; ใช้ยานอกกลุ่มตามชนิดการติดเชื้อ',
      noteIge:  'เลี่ยง nitroimidazole ทั้งกลุ่ม (มีรายงานแพ้ข้ามหมู่ 5-nitroimidazole) · ใช้ยานอกกลุ่ม (clindamycin / beta-lactam-BLI ถ้าไม่แพ้)',
      noteScar: 'SCAR จาก nitroimidazole: เลี่ยงทั้งกลุ่มเด็ดขาด · ห้าม challenge · ใช้ยานอกกลุ่มเท่านั้น',
      scarCautionNote: 'กรณี SCAR: เลี่ยงทั้งกลุ่ม nitroimidazole',
      singleDrugCallout: '💡 metronidazole กับ nitroimidazole ตัวอื่น (tinidazole / secnidazole / ornidazole) มีหมู่ 5-nitroimidazole ร่วมกัน → แพ้ข้ามกันได้ (Gendelman 2014) จึงเลี่ยงทั้งกลุ่ม · ทางเลือกคุม anaerobe ทั่วไป: clindamycin หรือ beta-lactam/BLI (ถ้าไม่แพ้) · ⚠️ ยกเว้น trichomoniasis ที่มีแต่ nitroimidazole ได้ผล → แนวทางคือ desensitize metronidazole ภายใต้การเฝ้าระวัง (ไม่ใช่สลับไป tinidazole ที่แพ้ข้าม หรือยานอกกลุ่มที่ล้มเหลวสูง) (Hollis 2022; Cahill 2021)'
    },
    // ── Opioids ──────────────────────────────────────────────────────────────
    // MOST "opioid allergy" is NOT immune allergy: it is pseudoallergy (direct mast
    // cell histamine release by morphine/codeine/meperidine) or a side effect. TRUE
    // IgE allergy is rare and cross-reactivity follows the STRUCTURAL CLASS: Khalaf
    // 2025 found NO cross-reactivity between classes (100% tolerance); in-class risk
    // is low (≤~7%). Modelled clusterAware + clusterCaution → same class = caution,
    // different class = safer. `pseudo` block covers the histamine-release path.
    // Pharmacist-verified 2026-07 — see docs/allergy-nonbetalactam.md
    {
      id: 'opioid',
      label: 'Opioids',
      refs: ['khalaf2025', 'baldo2018', 'ashp2019'],
      clusterAware: true,
      clusterCaution: true,   // same structural class = caution (low), different = safer
      keepSafeOnScar: true,
      allergens: [
        { id: 'morphine',      generic: 'Morphine',      th: 'มอร์ฟีน',        trade: [],            cluster: 'phenanthrene' },
        { id: 'codeine',       generic: 'Codeine',       th: 'โคเดอีน',         trade: [],            cluster: 'phenanthrene' },
        { id: 'oxycodone',     generic: 'Oxycodone',     th: 'ออกซิโคโดน',      trade: ['OxyContin'], cluster: 'phenanthrene' },
        { id: 'hydromorphone', generic: 'Hydromorphone', th: 'ไฮโดรมอร์โฟน',    trade: ['Dilaudid'],  cluster: 'phenanthrene' },
        { id: 'fentanyl',      generic: 'Fentanyl',      th: 'เฟนทานิล',        trade: [],            cluster: 'phenylpiperidine' },
        { id: 'pethidine',     generic: 'Pethidine (Meperidine)', th: 'เพทิดีน', trade: [],            cluster: 'phenylpiperidine' },
        { id: 'tramadol',      generic: 'Tramadol',      th: 'ทรามาดอล',        trade: [],            cluster: 'phenylpropylamine' },
        { id: 'methadone',     generic: 'Methadone',     th: 'เมทาโดน',         trade: [],            cluster: 'diphenylheptane' }
      ],
      crossReason: 'opioid กลุ่มโครงสร้างเดียวกัน — แพ้ข้ามในกลุ่มต่ำ (≤~7%); คนละกลุ่มแทบไม่แพ้ข้าม (Khalaf 2025: 0%)',
      crossReactive: [
        { id: 'morphine',      generic: 'Morphine',      th: 'มอร์ฟีน',      sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { id: 'codeine',       generic: 'Codeine',       th: 'โคเดอีน',       sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { id: 'oxycodone',     generic: 'Oxycodone',     th: 'ออกซิโคโดน',    sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { id: 'hydromorphone', generic: 'Hydromorphone', th: 'ไฮโดรมอร์โฟน',  sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { generic: 'Hydrocodone',   th: 'ไฮโดรโคโดน',    sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { generic: 'Oxymorphone',   th: 'ออกซิมอร์โฟน',  sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { generic: 'Buprenorphine', th: 'บูพรีนอร์ฟีน',  sub: 'Phenanthrene (partial agonist)', cluster: 'phenanthrene' },
        { generic: 'Nalbuphine',    th: 'นาลบูฟีน',      sub: 'Phenanthrene', cluster: 'phenanthrene' },
        { id: 'fentanyl',      generic: 'Fentanyl',      th: 'เฟนทานิล',      sub: 'Phenylpiperidine', cluster: 'phenylpiperidine' },
        { generic: 'Alfentanil',   th: 'อัลเฟนทานิล',   sub: 'Phenylpiperidine', cluster: 'phenylpiperidine' },
        { generic: 'Sufentanil',   th: 'ซูเฟนทานิล',    sub: 'Phenylpiperidine', cluster: 'phenylpiperidine' },
        { generic: 'Remifentanil', th: 'เรมิเฟนทานิล',  sub: 'Phenylpiperidine', cluster: 'phenylpiperidine' },
        { id: 'pethidine',     generic: 'Pethidine (Meperidine)', th: 'เพทิดีน', sub: 'Phenylpiperidine', cluster: 'phenylpiperidine' },
        { id: 'methadone',     generic: 'Methadone',     th: 'เมทาโดน',       sub: 'Diphenylheptane', cluster: 'diphenylheptane' },
        { id: 'tramadol',      generic: 'Tramadol',      th: 'ทรามาดอล',      sub: 'Phenylpropylamine', cluster: 'phenylpropylamine' },
        { generic: 'Tapentadol',   th: 'ทาเพนทาดอล',    sub: 'Phenylpropylamine', cluster: 'phenylpropylamine' }
      ],
      safeReason: 'ยาแก้ปวดนอกกลุ่ม opioid → ไม่เกี่ยวข้องกับการแพ้ opioid (ใช้ได้)',
      safe: [
        { generic: 'Paracetamol (Acetaminophen)', th: 'พาราเซตามอล', sub: 'Non-opioid analgesic' },
        { generic: 'NSAID (ถ้าไม่แพ้)', th: 'ยากลุ่ม NSAID', sub: 'Non-opioid analgesic' }
      ],
      noteMild: 'ปฏิกิริยา opioid ส่วนใหญ่ = pseudoallergy (histamine) หรือผลข้างเคียง ไม่ใช่แพ้จริง — เลือก "ผลข้างเคียง/ไม่ทนยา" เพื่อดูวิธีจัดการ',
      noteIge:  'แพ้ opioid จริง (IgE) พบน้อย — แพ้ข้ามตามกลุ่มโครงสร้าง: คนละกลุ่ม (เช่น phenanthrene→fentanyl) แทบไม่แพ้ข้าม (Khalaf 2025: 0%); ในกลุ่มเดียวกันเสี่ยงต่ำ (≤~7%) — เริ่มขนาดน้อย/สังเกตอาการ',
      noteScar: 'SCAR จาก opioid (พบน้อยมาก): เลี่ยง opioid ที่แพ้ + กลุ่มโครงสร้างเดียวกัน · ห้าม challenge · ปรึกษาผู้เชี่ยวชาญ',
      scarCautionNote: 'กรณี SCAR: เลี่ยงกลุ่มโครงสร้างเดียวกัน · ใช้ยานอกกลุ่ม opioid',
      singleDrugCallout: '💡 อาการที่เรียกว่า "แพ้ opioid" ส่วนใหญ่ไม่ใช่การแพ้ทางภูมิคุ้มกัน — เป็น pseudoallergy (morphine/codeine/pethidine กระตุ้น histamine โดยตรง → คัน/ผื่น/หน้าแดง) หรือผลข้างเคียง (คลื่นไส้/ท้องผูก/ง่วง) → เลือก "ผลข้างเคียง/ไม่ทนยา" เพื่อดูวิธีจัดการ · แพ้จริง (IgE) พบน้อยมาก และเปลี่ยนไปกลุ่มโครงสร้างอื่นได้ (Khalaf 2025: แพ้ข้ามข้ามกลุ่ม 0%)',
      pseudo: {
        title: 'ปฏิกิริยาต่อ opioid ส่วนใหญ่ไม่ใช่การแพ้ (pseudoallergy / histamine release)',
        points: [
          '"แพ้ opioid" ที่พบบ่อยเป็นผลข้างเคียง (คลื่นไส้ อาเจียน ท้องผูก ง่วงซึม) หรือ pseudoallergy — ไม่ใช่ IgE',
          'morphine, codeine, pethidine (meperidine) กระตุ้น mast cell ปล่อย histamine โดยตรง → คัน ผื่น หน้าแดง ลมพิษเฉพาะที่ (ไม่ใช่แพ้ภูมิคุ้มกัน · ขึ้นกับขนาด/อัตราการให้)',
          'fentanyl, sufentanil, alfentanil, remifentanil, tramadol ปล่อย histamine น้อยมาก',
          '🎯 จัดการ: ถ้าเป็น pseudoallergy → เปลี่ยนเป็น opioid ที่ปล่อย histamine น้อย (fentanyl / hydromorphone / oxycodone) หรือให้ช้าลง ± antihistamine · true IgE allergy พบน้อยมาก'
        ],
        refs: ['baldo2018', 'ashp2019']
      }
    },
    // ── Corticosteroids ──────────────────────────────────────────────────────
    // Delayed (contact) allergy is the common form, classified by STRUCTURAL GROUP
    // A/B/C/D (Coopman 1989; Matura-Goossens D1/D2; Baeck 2011 molecular clusters).
    // Group C (betamethasone/dexamethasone) has the LOWEST cross-reactivity and is
    // the usual safe alternative. IMMEDIATE reactions/anaphylaxis are often to an
    // EXCIPIENT (succinate ester, carboxymethylcellulose, PEG), not the steroid.
    // Modelled clusterAware (same group = avoid, different = caution) + group C in
    // the safe list + a `pseudo` block for the excipient path.
    // Pharmacist-verified 2026-07 — see docs/allergy-nonbetalactam.md
    {
      id: 'corticosteroid',
      label: 'Corticosteroids',
      refs: ['baeck2011', 'berbegal2016', 'chen2022cs', 'baker2015', 'jiaci2006cs', 'guillet2025'],
      clusterAware: true,
      keepSafeOnScar: true,
      allergens: [
        { id: 'hydrocortisone',     generic: 'Hydrocortisone',     th: 'ไฮโดรคอร์ติโซน',  trade: [],            cluster: 'A' },
        { id: 'prednisolone',       generic: 'Prednisolone',       th: 'เพรดนิโซโลน',     trade: [],            cluster: 'A' },
        { id: 'methylprednisolone', generic: 'Methylprednisolone', th: 'เมทิลเพรดนิโซโลน', trade: ['Solu-Medrol'], cluster: 'A' },
        { id: 'triamcinolone',      generic: 'Triamcinolone',      th: 'ไทรแอมซิโนโลน',   trade: ['Kenacort'],  cluster: 'B' },
        { id: 'budesonide',         generic: 'Budesonide',         th: 'บูเดโซไนด์',      trade: [],            cluster: 'B' },
        { id: 'betamethasone',      generic: 'Betamethasone',      th: 'เบตาเมทาโซน',     trade: [],            cluster: 'C' },
        { id: 'dexamethasone',      generic: 'Dexamethasone',      th: 'เดกซาเมทาโซน',    trade: [],            cluster: 'C' },
        { id: 'clobetasol',         generic: 'Clobetasol propionate', th: 'โคลเบทาซอล',  trade: ['Dermovate'], cluster: 'D1' }
      ],
      crossReason: 'corticosteroid กลุ่มโครงสร้างเดียวกัน (Coopman A/B/C/D) → แพ้ข้ามกัน (A↔D2 มักจับกลุ่ม)',
      crossReactive: [
        { id: 'hydrocortisone',     generic: 'Hydrocortisone',     th: 'ไฮโดรคอร์ติโซน',  sub: 'Group A', cluster: 'A' },
        { id: 'prednisolone',       generic: 'Prednisolone',       th: 'เพรดนิโซโลน',     sub: 'Group A', cluster: 'A' },
        { generic: 'Prednisone',    th: 'เพรดนิโซน',      sub: 'Group A', cluster: 'A' },
        { id: 'methylprednisolone', generic: 'Methylprednisolone', th: 'เมทิลเพรดนิโซโลน', sub: 'Group A', cluster: 'A' },
        { generic: 'Cortisone acetate', th: 'คอร์ติโซน', sub: 'Group A', cluster: 'A' },
        { id: 'triamcinolone',      generic: 'Triamcinolone acetonide', th: 'ไทรแอมซิโนโลน', sub: 'Group B (acetonide)', cluster: 'B' },
        { id: 'budesonide',         generic: 'Budesonide',         th: 'บูเดโซไนด์',      sub: 'Group B (acetonide)', cluster: 'B' },
        { generic: 'Fluocinolone acetonide', th: 'ฟลูโอซิโนโลน', sub: 'Group B (acetonide)', cluster: 'B' },
        { generic: 'Desonide',      th: 'เดโซไนด์',       sub: 'Group B (acetonide)', cluster: 'B' },
        { id: 'clobetasol',         generic: 'Clobetasol propionate', th: 'โคลเบทาซอล', sub: 'Group D1', cluster: 'D1' },
        { generic: 'Betamethasone dipropionate', th: 'เบตาเมทาโซน ไดโพรพิโอเนต', sub: 'Group D1', cluster: 'D1' },
        { generic: 'Mometasone furoate', th: 'โมเมทาโซน', sub: 'Group D1', cluster: 'D1' },
        { generic: 'Hydrocortisone-17-butyrate', th: 'ไฮโดรคอร์ติโซน บิวทิเรต', sub: 'Group D2 (labile ester · A↔D2 cross)', cluster: 'D2' },
        { generic: 'Methylprednisolone aceponate', th: 'เมทิลเพรดนิโซโลน อะซีโพเนต', sub: 'Group D2', cluster: 'D2' },
        { generic: 'Prednicarbate', th: 'เพรดนิคาร์เบต', sub: 'Group D2', cluster: 'D2' }
      ],
      safeReason: 'กลุ่ม C (betamethasone/dexamethasone) แพ้ข้ามต่ำสุด → มักทนได้ (ทางเลือกแรก); ยืนยันด้วย test ถ้าจำเป็น',
      safe: [
        { generic: 'Betamethasone', th: 'เบตาเมทาโซน', sub: 'Group C — แพ้ข้ามต่ำสุด', pct: 'มักทนได้', cluster: 'C',
          reason: 'Group C แพ้ข้ามต่ำสุด (Actas 2016: tolerated in many cases) — ทางเลือกแรกในผู้แพ้ corticosteroid กลุ่มอื่น' },
        { generic: 'Dexamethasone', th: 'เดกซาเมทาโซน', sub: 'Group C — แพ้ข้ามต่ำสุด', pct: 'มักทนได้', cluster: 'C',
          reason: 'Group C แพ้ข้ามต่ำสุด — ทางเลือกแรก (ถ้าแพ้กลุ่ม C เอง ให้ประเมินเป็นราย ๆ)' }
      ],
      noteMild: 'corticosteroid ส่วนใหญ่เป็น delayed/contact allergy (จากยาทา) — จัดกลุ่ม A/B/C/D; เลี่ยงกลุ่มที่แพ้ · กลุ่ม C (betamethasone/dexamethasone) มักทนได้',
      noteIge:  'immediate/anaphylaxis ต่อ corticosteroid ฉีด: พิจารณาแพ้ "excipient" (succinate ester / CMC / PEG) ไม่ใช่ตัวสเตียรอยด์ — เลือกสูตรที่ไม่มี excipient นั้น · กลุ่ม C มักทนได้ · ยืนยันด้วย skin test',
      noteScar: 'SCAR จาก corticosteroid (พบน้อย): เลี่ยงกลุ่มที่แพ้ + โครงสร้างใกล้เคียง · ห้าม challenge · ปรึกษาผู้เชี่ยวชาญ',
      scarCautionNote: 'กรณี SCAR: เลี่ยงกลุ่มโครงสร้างเดียวกัน · ประเมินเป็นราย ๆ',
      singleDrugCallout: '💡 corticosteroid จัดกลุ่มโครงสร้าง A/B/C/D (Coopman/Baeck) — แพ้ข้ามภายในกลุ่มเดียวกัน (A↔D2 มักจับกลุ่ม) · กลุ่ม C (betamethasone/dexamethasone) แพ้ข้ามต่ำสุด = ทางเลือกแรก · ⚠️ ปฏิกิริยาเฉียบพลัน/anaphylaxis มักแพ้ "สารเพิ่ม (excipient)" ไม่ใช่ตัวสเตียรอยด์ — succinate ester (hydrocortisone/methylprednisolone succinate), carboxymethylcellulose (CMC · ในสูตร depot เช่น triamcinolone), PEG → เลือกสูตร/ยี่ห้อที่ไม่มี excipient นั้น (Guillet 2025)',
      pseudo: {
        title: 'ปฏิกิริยาเฉียบพลันต่อ corticosteroid — พิจารณา "สารเพิ่ม (excipient)"',
        points: [
          'immediate reaction / anaphylaxis ต่อ corticosteroid ฉีด มัก "ไม่ใช่" แพ้ตัวสเตียรอยด์ แต่แพ้ excipient (JIACI 2006; Baker 2015)',
          'excipient ที่พบบ่อย: succinate ester (hydrocortisone / methylprednisolone sodium succinate), carboxymethylcellulose (CMC / carmellose — ในสูตร depot เช่น triamcinolone/Triamcort — Guillet 2025), PEG',
          '🎯 จัดการ: เลือกสูตร/ยี่ห้อที่ไม่มี excipient ที่สงสัย (เช่น เปลี่ยน succinate → phosphate ester) · ยืนยันด้วย skin test',
          'delayed/contact allergy (จากยาทา) = แบบที่พบบ่อยสุด → ตรวจด้วย patch test'
        ],
        refs: ['guillet2025', 'jiaci2006cs', 'baker2015']
      }
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
  function buildReport(allergenId, severityId, opts) {
    opts = opts || {};
    // Phase 2 — reaction-nature gate: an intolerance / side-effect (nausea, GI
    // upset, headache…) is NOT an immune allergy, so the cross-reactivity
    // avoidance logic does not apply — short-circuit with an advisory instead.
    if (opts.nature === 'intolerance') return buildIntoleranceReport(allergenId);
    if (DRUG_BY_ID[allergenId]) return buildBetaLactamReport(allergenId, severityId);
    if (NBL_INDEX[allergenId])  return buildNblReport(allergenId, severityId, opts);
    return null;
  }

  // Resolve an allergen's display meta from either source (beta-lactam or NBL).
  function allergenMeta(allergenId) {
    const d = DRUG_BY_ID[allergenId];
    if (d) {
      const clsLabel = ({ penicillin: 'Penicillin', cephalosporin: 'Cephalosporin',
        carbapenem: 'Carbapenem', monobactam: 'Monobactam' })[d.class] || (d.class || '');
      return { generic: d.generic, th: d.th || '', class: clsLabel, trade: d.trade || [] };
    }
    const ref = NBL_INDEX[allergenId];
    if (ref) return { generic: ref.allergen.generic, th: ref.allergen.th || '',
      class: ref.group.label, trade: ref.allergen.trade || [] };
    return null;
  }

  // Intolerance / non-immune adverse reaction → not a true allergy. Returns a
  // report flagged notAllergy with an advisory; no avoid/caution/safer lists.
  function buildIntoleranceReport(allergenId) {
    const meta = allergenMeta(allergenId);
    if (!meta) return null;
    // Actionable pseudoallergy management for groups that define it (e.g. ICM):
    // shown instead of the generic "not an allergy" advisory.
    const ref = NBL_INDEX[allergenId];
    const pseudo = (ref && ref.group && ref.group.pseudo) || null;
    return {
      allergen: meta,
      severity: { id: 'intolerance', label: 'ไม่ใช่แพ้ภูมิคุ้มกัน (ผลข้างเคียง / pseudoallergy)', note: '' },
      severityNote: '',
      notAllergy: true,
      pseudo: pseudo,
      advisory: 'อาการที่ระบุเป็น “ผลข้างเคียง/ไม่ทนยา” (เช่น คลื่นไส้ อาเจียน ปวดท้อง ท้องเสีย ' +
        'ปวดศีรษะ ใจสั่น) ซึ่งไม่ใช่การแพ้ทางภูมิคุ้มกัน → โดยทั่วไป “ยังใช้ยาเดิมได้” ' +
        'ไม่จำเป็นต้องหลีกเลี่ยงยากลุ่มเดียวกัน พิจารณาจัดการอาการ (ปรับขนาด/อัตราการให้/' +
        'ให้พร้อมอาหาร/ยาบรรเทาอาการ) หรือเปลี่ยนยาตามความเหมาะสมทางคลินิก',
      caveat: '⚠️ ถ้าจริง ๆ มีผื่น ลมพิษ หน้า/ปากบวม หายใจลำบาก ความดันตก หรือผิวหนังลอก/' +
        'ตุ่มน้ำ (SCAR) — แสดงว่าอาจเป็น “การแพ้จริง” ให้เปลี่ยนตัวเลือกเป็น “แพ้จริง/สงสัยแพ้” ' +
        'เพื่อประเมินการแพ้ข้ามยา',
      avoid: [], caution: [], safer: [],
      nonBetaLactam: null, blocked: false,
      isNbl: !!NBL_INDEX[allergenId]
    };
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

  // Single-drug (selective) report for a chemical-group-aware group (NSAID):
  // partition every other NSAID in the group by whether it shares the culprit's
  // chemical group. Same group → avoid (immunologic cross-reactivity within the
  // chemical class); different group → tolerated (even strong COX-1 inhibitors).
  function buildNblSingleDrug(g, a, sev, isScar) {
    const lbl = (g.chemLabels && g.chemLabels[a.chem]) || a.chem || '';
    const seen = {};
    const pool = [];
    ['crossReactive', 'caution', 'safe'].forEach(function (k) {
      (g[k] || []).forEach(function (d) {
        if (d.id && d.id === a.id) return;
        if (d.generic === a.generic) return;
        const key = d.id || d.generic;
        if (seen[key]) return;
        seen[key] = true;
        pool.push(d);
      });
    });

    const avoid = [], safer = [], caution = [];
    pool.forEach(function (d) {
      const sameChem = !!d.chem && !!a.chem && d.chem === a.chem;
      if (sameChem) {
        avoid.push({
          drug: { generic: d.generic, th: d.th, class: d.sub },
          decision: 'avoid', tier: 'high', pct: 'กลุ่มเคมีเดียวกัน',
          reason: 'กลุ่มเคมีเดียวกับตัวที่แพ้ (' + lbl + ') → single-drug แพ้ข้ามภายในกลุ่มเคมี',
          refs: g.refs, advice: isScar ? 'หลีกเลี่ยงเด็ดขาด · ห้าม challenge' : 'หลีกเลี่ยง'
        });
      } else {
        (isScar ? caution : safer).push({
          drug: { generic: d.generic, th: d.th, class: d.sub },
          decision: isScar ? 'caution' : 'safer',
          tier: isScar ? 'moderate' : 'negligible',
          pct: isScar ? 'ระวัง' : 'กลุ่มเคมีอื่น',
          reason: 'single-drug: กลุ่มเคมีต่างจากตัวที่แพ้ → มักใช้ได้แม้เป็น COX-1 แรง',
          refs: g.refs,
          advice: isScar ? 'SCAR: พิจารณาเลี่ยงถ้าไม่จำเป็น / graded challenge ตามดุลพินิจผู้เชี่ยวชาญ' : ''
        });
      }
    });

    const note = isScar ? g.noteScar
      : 'Single-drug (selective): เลี่ยงเฉพาะตัวที่แพ้ + NSAID กลุ่มเคมีเดียวกัน (' + lbl + ') · NSAID กลุ่มเคมีอื่นมักใช้ได้';
    const sameSibs = avoid.map(function (x) { return x.drug.th; });
    const callout = '✅ Single-drug phenotype: ' + (sameSibs.length
      ? 'กลุ่มเคมีเดียวกัน (' + lbl + ') ที่ต้องเลี่ยงด้วย: ' + sameSibs.join(', ')
      : 'ไม่มี NSAID ตัวอื่นในกลุ่มเคมี ' + lbl + ' ในรายการ → เลี่ยงเฉพาะตัวที่แพ้');

    return {
      allergen: { generic: a.generic, th: a.th, class: g.label, trade: a.trade },
      severity: sev, severityNote: note, calloutNote: callout,
      avoid: avoid, caution: caution, safer: safer,
      nonBetaLactam: null, blocked: false, isNbl: true
    };
  }

  function buildNblReport(allergenId, severityId, opts) {
    opts = opts || {};
    const ref = NBL_INDEX[allergenId];
    const g = ref.group;
    const a = ref.allergen;
    const sev = SEVERITY_BY_ID[severityId] || SEVERITY_BY_ID.unknown;
    const isScar = !!sev.blockAllBetaLactam;   // the SCAR severity flag

    // SINGLE-DRUG (selective) phenotype — only for chemical-group-aware groups
    // (NSAID). Here cross-reactivity follows the CHEMICAL GROUP, not COX-1
    // potency, so the recommendation flips: avoid only the culprit + its
    // same-chemical-group siblings; every other chemical group is tolerated
    // (even strong COX-1 inhibitors). SCAR from an NSAID is also single-drug
    // (SNIDR) → route it here too, but keep the no-challenge guidance.
    if (g.chemGroupAware && (opts.phenotype === 'single' || isScar)) {
      return buildNblSingleDrug(g, a, sev, isScar);
    }

    // in-class cross-reactive drugs — each carries its own decision/tier so the
    // partition below is decision-driven (handles every group shape uniformly):
    //   • default                  → avoid (high)
    //   • crossClassCaution        → caution (low) non-SCAR; escalate avoid at SCAR
    //     (modern LOW in-class cross-reactivity, e.g. fluoroquinolones ~2-5%)
    //   • clusterAware             → per side-chain cluster: SAME cluster as culprit
    //     = avoid (high) (e.g. iodinated contrast sharing a carbamoyl side chain,
    //     ~60-77% cross-react); DIFFERENT cluster = caution (lower but unpredictable
    //     → confirm with skin testing). SCAR escalates all to avoid.
    // Exclude the culprit itself.
    const crossAsCaution = !!g.crossClassCaution && !isScar;
    const culpritCluster = a.cluster;
    const crossList = g.crossReactive.filter(function (d) { return d.id !== allergenId; }).map(function (d) {
      let decision, tier, pctDefault, reasonDefault;
      if (g.clusterAware) {
        const sameCluster = !!d.cluster && !!culpritCluster && d.cluster === culpritCluster;
        if (g.clusterCaution) {
          // opioid-style structural class: SAME class = caution (low in-class cross,
          // ≤~7%), DIFFERENT class = safer (cross-reactivity between classes ~0%,
          // Khalaf 2025). SCAR still escalates same/related to avoid.
          if (isScar) { decision = 'avoid'; tier = 'high'; }
          else if (sameCluster) { decision = 'caution'; tier = 'moderate'; }
          else { decision = 'safer'; tier = 'negligible'; }
          pctDefault = sameCluster ? 'กลุ่มโครงสร้างเดียวกัน (แพ้ข้ามต่ำ ≤~7%)' : 'คนละกลุ่มโครงสร้าง (แทบไม่แพ้ข้าม)';
          reasonDefault = sameCluster ? 'กลุ่มโครงสร้างเดียวกับตัวที่แพ้ → อาจแพ้ข้าม (ความเสี่ยงต่ำ)'
                                      : 'คนละกลุ่มโครงสร้างกับตัวที่แพ้ → แทบไม่แพ้ข้าม';
        } else if (isScar || sameCluster) { decision = 'avoid'; tier = 'high';
          pctDefault = sameCluster ? 'แพ้ข้ามสูง (side chain เดียวกัน)' : 'เสี่ยงแพ้ข้าม — ยืนยันด้วย skin test';
        } else { decision = 'caution'; tier = 'low';
          pctDefault = 'เสี่ยงแพ้ข้าม — ยืนยันด้วย skin test';
        }
      } else {
        decision = crossAsCaution ? 'caution' : 'avoid';
        tier = crossAsCaution ? 'low' : 'high';
        pctDefault = crossAsCaution ? 'แพ้ข้ามต่ำ' : 'แพ้ข้ามได้';
      }
      return {
        drug: { generic: d.generic, th: d.th, class: d.sub },
        decision: decision, tier: tier,
        pct: d.pct || pctDefault,
        reason: d.reason || reasonDefault || g.crossReason, refs: g.refs,
        advice: d.advice || (isScar ? 'หลีกเลี่ยงทั้งหมด · ห้าม challenge' : '')
      };
    });
    const crossAvoid = crossList.filter(function (x) { return x.decision === 'avoid'; });
    const crossCaution = crossList.filter(function (x) { return x.decision === 'caution'; });
    // clusterCaution groups (e.g. opioid) route DIFFERENT-cluster members to "safer"
    const crossSafer = crossList.filter(function (x) { return x.decision === 'safer'; });

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
      avoid: crossAvoid,
      caution: cautionItems
        .concat(crossCaution)
        .concat(scarDowngradesSafe ? safeItems : []),
      safer: scarDowngradesSafe ? [] : safeItems.concat(crossSafer),
      nonBetaLactam: null,   // for NBL the "safe" list already names the alternatives
      blocked: false,
      isNbl: true
    };
  }

  // --- 11. Apply remote (Sheet-authored) data over the hardcoded defaults -----
  // Mutates REFS + NBL_GROUPS in place and rebuilds NBL_INDEX so buildReport()
  // uses the admin-edited content. Beta-lactam (DRUGS/OVERRIDES) is not yet
  // Sheet-backed, so beta_lactam rows are ignored here (Stage B). Returns true
  // if usable NBL data was applied; false -> keep hardcoded defaults (offline /
  // not deployed / empty sheet).
  function _alParse(v, fb) {
    if (Array.isArray(v) || (v && typeof v === 'object')) return v;
    if (typeof v === 'string' && v.trim()) { try { return JSON.parse(v); } catch (e) { return fb; } }
    return fb;
  }
  function _alBool(v) { return v === true || v === 'true' || v === 'TRUE'; }

  // UNION a code list with a Sheet list by drug identity so a code-defined entry
  // is a guaranteed FLOOR (mirrors the DDI "safety floor" in js/drug-interactions.js:
  // an incomplete/stale Supabase table can never silently drop a vetted code
  // entry). The Sheet may OVERRIDE a same-identity entry (edit pct/reason/…) and
  // ADD new entries; it cannot DELETE a code entry. To remove/correct a wrong
  // code entry, change the code, not Supabase. Identity = id (preferred) else
  // normalized generic (normName is hoisted from section 12).
  function _alKey(d) { return (d && d.id) ? 'id:' + d.id : 'nm:' + normName(d && d.generic); }
  function _alMergeList(hcList, sheetVal) {
    var sheet = _alParse(sheetVal, null);
    if (!Array.isArray(sheet)) return (hcList || []).slice();   // no usable Sheet list → keep code floor
    var out = [], idx = {};
    (hcList || []).forEach(function (d) { idx[_alKey(d)] = out.length; out.push(d); });
    sheet.forEach(function (d) {
      var k = _alKey(d);
      if (idx[k] != null) out[idx[k]] = Object.assign({}, out[idx[k]], d);   // Sheet overrides same identity
      else { idx[k] = out.length; out.push(d); }                             // brand-new Sheet entry
    });
    return out;
  }

  function applyRemoteData(remote) {
    if (!remote) return false;
    // refs: merge remote citations over the hardcoded map (remote wins)
    (remote.refs || []).forEach(function (r) { if (r && r.key) REFS[r.key] = r.citation; });

    var rows = (remote.groups || []).filter(function (g) { return (g.type || 'nbl') !== 'beta_lactam'; });
    if (!rows.length) return false;   // nothing usable -> keep hardcoded NBL groups

    // Index the hardcoded groups so the Sheet can edit CONTENT (labels, notes,
    // drug lists, refs) while code-defined CLINICAL LOGIC (phenotypes selector,
    // chem-group / cluster awareness, chemLabels) is preserved. Without this,
    // Sheet data wiped fields like `phenotypes` (the NSAID selector vanished).
    var hardById = {};
    NBL_GROUPS.forEach(function (g) { hardById[g.id] = g; });
    function logicFlag(hcVal, sheetVal) { return hcVal != null ? hcVal : _alBool(sheetVal); }

    var built = rows.map(function (g) {
      var hc = hardById[g.id] || {};
      return Object.assign({}, hc, {   // start from code so logic fields survive
        id: g.id, label: g.label || hc.label || '',
        refs: _alParse(g.refs, hc.refs || []),
        // list fields UNION over the code floor (safety floor — see _alMergeList)
        allergens: _alMergeList(hc.allergens, g.allergens),
        crossReactive: _alMergeList(hc.crossReactive, g.crossReactive),
        safe: _alMergeList(hc.safe, g.safe),
        caution: _alMergeList(hc.caution, g.caution),
        crossReason: g.crossReason || hc.crossReason || '',
        cautionReason: g.cautionReason || hc.cautionReason || '',
        safeReason: g.safeReason || hc.safeReason || '',
        noteMild: g.noteMild || hc.noteMild || '',
        noteIge: g.noteIge || hc.noteIge || '',
        noteScar: g.noteScar || hc.noteScar || '',
        scarCautionNote: g.scarCautionNote || hc.scarCautionNote || '',
        singleDrugCallout: g.singleDrugCallout || hc.singleDrugCallout || '',
        // clinical-logic flags: prefer code; only take the Sheet's value when
        // code doesn't define one (e.g. a brand-new Sheet-only group).
        keepSafeOnScar: logicFlag(hc.keepSafeOnScar, g.keepSafeOnScar),
        clusterAware: logicFlag(hc.clusterAware, g.clusterAware),
        clusterCaution: logicFlag(hc.clusterCaution, g.clusterCaution),
        crossClassCaution: logicFlag(hc.crossClassCaution, g.crossClassCaution),
        chemGroupAware: logicFlag(hc.chemGroupAware, g.chemGroupAware),
        chemLabels: (hc.chemLabels != null ? hc.chemLabels : _alParse(g.chemLabels, '')),
        sortOrder: (g.sortOrder === '' || g.sortOrder == null)
          ? (hc.sortOrder != null ? hc.sortOrder : 999) : Number(g.sortOrder)
        // NOTE: phenotypes / phenotypeLabel / phenotypeDefault / clusters are
        // carried over automatically by the Object.assign(hc) base above.
      });
    }).filter(function (g) { return g.id && (g.allergens || []).length; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });

    if (!built.length) return false;

    // UNION-merge: Sheet rows override/extend, but hardcoded groups NOT present in
    // the Sheet are KEPT (so a code-only group — e.g. a newly added Glycopeptide
    // group, or LA pseudo content — never disappears just because the Sheet hasn't
    // been re-seeded). Admin can edit any group's content + add new groups; the
    // only thing the Sheet can't do is delete a code-defined group.
    var builtIds = {};
    built.forEach(function (g) { builtIds[g.id] = true; });
    var merged = built.slice();
    NBL_GROUPS.forEach(function (hc) { if (!builtIds[hc.id]) merged.push(hc); });
    merged.sort(function (a, b) {
      var ao = a.sortOrder == null ? 999 : a.sortOrder, bo = b.sortOrder == null ? 999 : b.sortOrder;
      return ao - bo;
    });

    NBL_GROUPS.length = 0;
    merged.forEach(function (g) { NBL_GROUPS.push(g); });
    Object.keys(NBL_INDEX).forEach(function (k) { delete NBL_INDEX[k]; });
    NBL_GROUPS.forEach(function (g) {
      (g.allergens || []).forEach(function (a) { NBL_INDEX[a.id] = { group: g, allergen: a }; });
    });
    return true;
  }

  // --- 12. Multi-allergen aggregation ----------------------------------------
  // Combine the single-allergen reports for SEVERAL culprit drugs into ONE
  // verdict per target drug (worst-case wins) and, optionally, answer the
  // clinician's real question: "the patient is allergic to A, B, C … can they
  // use <candidate>?". Pure/testable; REUSES buildReport unchanged (no new
  // clinical logic — only aggregation + a safe "worst-wins" combine rule).

  // Normalize a display generic to a stable match key. NBL report entries carry
  // only `generic` (no id), and a generic may include a Thai/qualifier suffix in
  // parentheses (e.g. "Aspirin (ขนาดยาแก้ปวด…)") — take the text before the first
  // "(" and lowercase it. Beta-lactam entries keep their real id (preferred).
  function normName(s) {
    return String(s == null ? '' : s).split('(')[0].toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Build a name→canonical-id alias so the SAME real drug collapses to one
  // bucket even when one source carries an `id` and another only a display name
  // (e.g. the tetracycline allergen `doxycycline` vs the fluoroquinolone group's
  // plain "Doxycycline" safe-alternative entry). Rebuilt per call so it always
  // reflects the current (possibly remote-merged) NBL_GROUPS.
  function _buildAlias() {
    var byId = {}, byNorm = {};
    function reg(id, generic) { if (id) { byId[id] = id; if (generic) byNorm[normName(generic)] = id; } }
    DRUGS.forEach(function (d) { reg(d.id, d.generic); });
    NBL_GROUPS.forEach(function (g) {
      (g.allergens || []).forEach(function (a) { reg(a.id, a.generic); });
      ['crossReactive', 'safe', 'caution'].forEach(function (k) {
        (g[k] || []).forEach(function (d) { if (d.id) reg(d.id, d.generic); });
      });
    });
    return { byId: byId, byNorm: byNorm };
  }
  function _canonKey(drug, alias) {
    if (!drug) return 'nm:';
    if (drug.id && alias.byId[drug.id]) return 'id:' + alias.byId[drug.id];
    if (drug.id) return 'id:' + drug.id;
    var nk = normName(drug.generic);
    return alias.byNorm[nk] ? 'id:' + alias.byNorm[nk] : 'nm:' + nk;
  }

  // Every selectable / targetable drug with a stable canonical key + display —
  // the candidate picker's universe (includes target-only drugs like parecoxib).
  function drugUniverse() {
    var alias = _buildAlias(), out = [], seen = {};
    function add(drug, gid, glabel) {
      var key = _canonKey(drug, alias);
      if (seen[key]) return;
      seen[key] = true;
      out.push({ key: key, generic: drug.generic, th: drug.th || '', gid: gid || '', glabel: glabel || '' });
    }
    DRUGS.forEach(function (d) { add(d, d.class, d.class); });
    NBL_GROUPS.forEach(function (g) {
      (g.allergens || []).forEach(function (a) { add(a, g.id, g.label); });
      ['crossReactive', 'safe', 'caution'].forEach(function (k) {
        (g[k] || []).forEach(function (d) { if (d.generic) add(d, g.id, g.label); });
      });
    });
    return out;
  }

  function _resolveCandidate(candidate, alias) {
    if (!candidate) return null;
    if (typeof candidate === 'object') {
      if (candidate.key) return { key: candidate.key, name: candidate.name || candidate.generic || '', th: candidate.th || '' };
      candidate = candidate.id || candidate.generic || candidate.name || '';
    }
    var s = String(candidate).trim();
    if (!s) return null;
    // already a canonical key form ('id:x' / 'nm:x') — resolve display via the universe
    if (/^(id|nm):/.test(s)) {
      var uk = drugUniverse();
      for (var q = 0; q < uk.length; q++) if (uk[q].key === s) return { key: uk[q].key, name: uk[q].generic, th: uk[q].th };
      return { key: s, name: s.replace(/^(id|nm):/, ''), th: '' };
    }
    if (DRUG_BY_ID[s]) return { key: _canonKey(DRUG_BY_ID[s], alias), name: DRUG_BY_ID[s].generic, th: DRUG_BY_ID[s].th };
    if (NBL_INDEX[s]) { var a = NBL_INDEX[s].allergen; return { key: _canonKey({ id: s, generic: a.generic }, alias), name: a.generic, th: a.th || '' }; }
    var nk = normName(s), uni = drugUniverse();
    for (var i = 0; i < uni.length; i++) {
      if (uni[i].key === 'id:' + s || uni[i].key === 'nm:' + nk || normName(uni[i].generic) === nk) {
        return { key: uni[i].key, name: uni[i].generic, th: uni[i].th };
      }
    }
    return { key: (alias.byNorm[nk] ? 'id:' + alias.byNorm[nk] : 'nm:' + nk), name: s, th: '' };
  }

  var BUCKET_RANK = { safer: 1, caution: 2, avoid: 3 };
  var RANK_BUCKET = { 0: 'safer', 1: 'safer', 2: 'caution', 3: 'avoid' };

  // selections: [{ id, severity, nature?, phenotype? }]  (per-drug settings)
  // candidate:  a drug id / generic / universe item {key,…}  (optional)
  function buildMultiReport(selections, candidate) {
    selections = (selections || []).filter(function (s) { return s && s.id; });
    var alias = _buildAlias();
    var allergens = [];         // resolved per-allergen meta + full single report
    var intoleranceNotes = [];  // nature=intolerance advisories (shown separately)
    var byTarget = {};          // canonKey -> { drug, verdicts:[] }

    function ensureTarget(key, drug) {
      if (!byTarget[key]) byTarget[key] = { key: key, drug: drug, verdicts: [] };
      return byTarget[key];
    }

    selections.forEach(function (s) {
      var meta = allergenMeta(s.id);
      if (!meta) return;
      var opts = {};
      if (s.nature === 'intolerance') opts.nature = 'intolerance';
      if (s.phenotype) opts.phenotype = s.phenotype;
      var rep = buildReport(s.id, s.severity, opts);
      if (!rep) return;
      allergens.push({ id: s.id, meta: meta, severity: rep.severity, nature: s.nature || 'allergy',
        phenotype: s.phenotype || '', calloutNote: rep.calloutNote || '', report: rep });

      if (rep.notAllergy) {
        // intolerance = not an immune allergy → the drug itself is NOT
        // contraindicated and there is NO cross-reactivity to avoid; surface an
        // advisory instead of feeding avoid/caution/safer buckets.
        intoleranceNotes.push({ allergen: meta, advisory: rep.advisory || '', caveat: rep.caveat || '', pseudo: rep.pseudo || null });
        return;
      }

      // the culprit itself is ALWAYS avoid (the patient is allergic to it) —
      // this must override any other allergen's report that lists it as "safe"
      // (e.g. Doxycycline sits in Ciprofloxacin's safe list, but the patient is
      // also allergic to Doxycycline → it must land in the avoid bucket).
      var selfKey = _canonKey({ id: s.id, generic: meta.generic }, alias);
      ensureTarget(selfKey, { id: s.id, generic: meta.generic, th: meta.th, class: meta.class })
        .verdicts.push({ allergenId: s.id, allergenName: meta.generic, bucket: 'avoid', tier: 'high',
          pct: 'ยาที่แพ้เอง', reason: 'ยาตัวเดียวกับที่ผู้ป่วยแพ้', refs: [], advice: '', self: true });

      ['avoid', 'caution', 'safer'].forEach(function (bucket) {
        (rep[bucket] || []).forEach(function (it) {
          var key = _canonKey(it.drug, alias);
          ensureTarget(key, it.drug).verdicts.push({ allergenId: s.id, allergenName: meta.generic,
            bucket: bucket, tier: it.tier, pct: it.pct, reason: it.reason, refs: it.refs || [], advice: it.advice || '' });
        });
      });
    });

    function worstOf(verdicts) {
      var rank = 0, worst = null;
      verdicts.forEach(function (v) { var r = BUCKET_RANK[v.bucket] || 0; if (r > rank) { rank = r; worst = v; } });
      return { rank: rank, worst: worst || verdicts[0] };
    }
    function dedupeRefs(verdicts) {
      var seen = {}, out = [];
      verdicts.forEach(function (v) { (v.refs || []).forEach(function (k) { if (!seen[k]) { seen[k] = true; out.push(k); } }); });
      return out;
    }
    function driversOf(verdicts) {
      return verdicts.map(function (v) {
        return { allergenId: v.allergenId, allergenName: v.allergenName, bucket: v.bucket,
          tier: v.tier, pct: v.pct, reason: v.reason, advice: v.advice || '', self: !!v.self };
      });
    }

    var avoid = [], caution = [], safer = [];
    Object.keys(byTarget).forEach(function (key) {
      var t = byTarget[key];
      var w = worstOf(t.verdicts);
      var worst = w.worst;
      var row = { drug: t.drug, tier: worst.tier, pct: worst.pct, reason: worst.reason,
        advice: worst.advice || '', refs: dedupeRefs(t.verdicts), decision: RANK_BUCKET[w.rank],
        drivers: driversOf(t.verdicts) };
      if (w.rank >= 3) avoid.push(row);
      else if (w.rank === 2) caution.push(row);
      else safer.push(row);
    });

    function tierOrder(t) { return TIERS[t] ? TIERS[t].order : 99; }
    avoid.sort(function (x, y) { return tierOrder(x.tier) - tierOrder(y.tier); });
    caution.sort(function (x, y) { return tierOrder(x.tier) - tierOrder(y.tier); });
    safer.sort(function (x, y) { return tierOrder(y.tier) - tierOrder(x.tier); });

    // candidate ("can they use X?") = pure lookup into the aggregated index
    var candOut = null;
    if (candidate) {
      var c = _resolveCandidate(candidate, alias);
      if (c) {
        var t = byTarget[c.key];
        if (t) {
          var w = worstOf(t.verdicts);
          candOut = { key: c.key, name: c.name, th: c.th, bucket: RANK_BUCKET[w.rank],
            tier: w.worst ? w.worst.tier : '', related: true, drivers: driversOf(t.verdicts),
            unrelated: allergens.filter(function (al) {
              return !t.verdicts.some(function (v) { return v.allergenId === al.id; });
            }).map(function (al) { return al.meta.generic; }) };
        } else {
          candOut = { key: c.key, name: c.name, th: c.th, bucket: 'unknown', tier: '',
            related: false, drivers: [], unrelated: allergens.map(function (al) { return al.meta.generic; }) };
        }
      }
    }

    var refKeys = {};
    [avoid, caution, safer].forEach(function (list) {
      list.forEach(function (row) { (row.refs || []).forEach(function (k) { refKeys[k] = true; }); });
    });

    return { multi: true, allergens: allergens, intoleranceNotes: intoleranceNotes,
      candidate: candOut, avoid: avoid, caution: caution, safer: safer, refs: Object.keys(refKeys) };
  }

  root.AllergyData = {
    REFS: REFS, TIERS: TIERS, CLUSTERS: CLUSTERS, DRUGS: DRUGS, DRUG_BY_ID: DRUG_BY_ID,
    applyRemoteData: applyRemoteData,
    OVERRIDES: OVERRIDES, SEVERITY: SEVERITY, NON_BETA_LACTAM: NON_BETA_LACTAM,
    NBL_GROUPS: NBL_GROUPS, NBL_INDEX: NBL_INDEX,
    computeRelation: computeRelation, buildReport: buildReport,
    buildMultiReport: buildMultiReport, drugUniverse: drugUniverse, normName: normName
  };

  // Node/test export (browser ignores)
  if (typeof module !== 'undefined' && module.exports) { module.exports = root.AllergyData; }
})(typeof window !== 'undefined' ? window : globalThis);
