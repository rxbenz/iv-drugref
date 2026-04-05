const CURATED_RENAL_DRUGS = [
  // ── ANTIBIOTICS ──
  {id:'vancomycin',name:'Vancomycin','class':'abx',sub:'Glycopeptide',badges:['abx','renal','hd'],
    recommended:'15-20 mg/kg/dose q8-12h',
    dosingTable:[
      {range:'>80',dose:'15-20 mg/kg',freq:'q8-12h',note:'Normal dosing'},
      {range:'50–80',dose:'15-20 mg/kg',freq:'q12h',note:''},
      {range:'30–50',dose:'15-20 mg/kg',freq:'q24h',note:''},
      {range:'10–30',dose:'15-20 mg/kg',freq:'q24-48h',note:'Re-dose by trough'},
      {range:'<10 / HD',dose:'15-20 mg/kg',freq:'q48-72h',note:'Re-dose when trough <15-20'}
    ],
    info:'<strong>TDM:</strong> AUC/MIC 400-600 (preferred) | Trough 15-20 mcg/mL<br>เจาะ trough ก่อน dose ที่ 4<br><strong>HD:</strong> Re-dose 15-25 mg/kg post-HD, เจาะ pre-HD level<br><strong>CRRT:</strong> 15-20 mg/kg loading → 7.5-10 mg/kg q12h (adjust by level)',
    infoType:'blue',
    ref:'Rybak MJ, et al. Am J Health Syst Pharm. 2020;77(11):835-864 | Lexicomp 2024'},

  {id:'meropenem',name:'Meropenem','class':'abx',sub:'Carbapenem',badges:['abx','renal'],
    recommended:'1-2 g q8h',
    dosingTable:[
      {range:'>50',dose:'1–2 g',freq:'q8h',note:'No adjustment needed'},
      {range:'26–50',dose:'1 g',freq:'q12h',note:''},
      {range:'10–25',dose:'500 mg–1 g',freq:'q12h',note:''},
      {range:'<10 / HD',dose:'500 mg–1 g',freq:'q24h',note:'Give post-HD on HD days'}
    ],
    info:'<strong>Extended infusion:</strong> 3-4 hr infusion may improve PK/PD target attainment<br><strong>Seizure risk:</strong> ต่ำกว่า Imipenem แต่ยังต้องระวังใน CKD<br><strong>CRRT:</strong> 1 g q8h (CVVH/CVVHD/CVVHDF)',
    infoType:'blue',
    ref:'Lexicomp 2024 | Sanford Guide 2024'},

  {id:'imipenem',name:'Imipenem/Cilastatin','class':'abx',sub:'Carbapenem',badges:['abx','renal'],
    recommended:'500 mg q6h',
    dosingTable:[
      {range:'>70',dose:'500 mg',freq:'q6h',note:'Normal'},
      {range:'41–70',dose:'500 mg',freq:'q8h',note:''},
      {range:'21–40',dose:'250–500 mg',freq:'q8-12h',note:''},
      {range:'6–20',dose:'250 mg',freq:'q12h',note:''},
      {range:'<6 / HD',dose:'250 mg',freq:'q12h',note:'Supplement post-HD'}
    ],
    info:'<strong>⚠ Seizure risk สูงขึ้นใน renal impairment</strong> — ห้ามใช้ขนาด >500 mg/dose ถ้า CrCl <70<br><strong>CRRT:</strong> 500 mg q6-8h',
    infoType:'amber',
    ref:'Lexicomp 2024 | Package Insert'},

  {id:'ertapenem',name:'Ertapenem','class':'abx',sub:'Carbapenem',badges:['abx','renal','hd'],
    recommended:'1 g q24h',
    dosingTable:[
      {range:'>30',dose:'1 g',freq:'q24h',note:'No adjustment'},
      {range:'≤30 / HD',dose:'500 mg',freq:'q24h',note:'Give supplement 150 mg post-HD'}
    ],
    info:'<strong>HD:</strong> ถ้า dose ≤6 hr ก่อน HD → supplement 150 mg post-HD<br><strong>ไม่แนะนำ</strong>ใน CRRT (ข้อมูลจำกัด)',
    infoType:'blue',
    ref:'Lexicomp 2024 | Sanford Guide 2024'},

  {id:'piptazo',name:'Piperacillin/Tazobactam','class':'abx',sub:'Beta-lactam/BLI',badges:['abx','renal'],
    recommended:'4.5 g q6h',
    dosingTable:[
      {range:'>40',dose:'4.5 g',freq:'q6h',note:'Normal (EI: 4hr)'},
      {range:'20–40',dose:'3.375 g q6h หรือ 4.5 g',freq:'q8h',note:''},
      {range:'<20 / HD',dose:'2.25 g q6h หรือ 4.5 g',freq:'q12h',note:'Supplement 0.75 g post-HD'}
    ],
    info:'<strong>Extended infusion:</strong> 4 hr infusion recommended for PK/PD optimization<br><strong>⚠ หลีกเลี่ยงร่วม Vancomycin</strong> → ↑ risk AKI<br><strong>CRRT:</strong> 4.5 g q6-8h',
    infoType:'blue',
    ref:'Lexicomp 2024 | Rhodes NJ, et al. Pharmacotherapy 2015'},

  {id:'ceftriaxone',name:'Ceftriaxone','class':'abx',sub:'3rd gen Cephalosporin',badges:['abx'],
    recommended:'1–2 g q24h (ไม่ต้องปรับขนาดตามไต)',
    dosingTable:[
      {range:'All GFR',dose:'1–2 g',freq:'q24h',note:'ไม่ต้องปรับ (hepatic elimination ~40%)'},
      {range:'HD',dose:'1–2 g',freq:'q24h',note:'Not dialyzable; no supplement needed'}
    ],
    info:'<strong>ข้อดี:</strong> No renal dose adjustment needed<br><strong>⚠ Max 2g/day</strong> ใน combined hepatic + renal impairment<br><strong>ห้ามผสม</strong>ใน Ca²⁺-containing solutions (Ringer\'s, Hartmann\'s)',
    infoType:'teal',
    ref:'Lexicomp 2024'},

  {id:'ceftazidime',name:'Ceftazidime','class':'abx',sub:'3rd gen Cephalosporin (anti-Pseudomonas)',badges:['abx','renal','hd'],
    recommended:'1–2 g q8h',
    dosingTable:[
      {range:'>50',dose:'1–2 g',freq:'q8h',note:'Normal'},
      {range:'31–50',dose:'1 g',freq:'q12h',note:''},
      {range:'16–30',dose:'1 g',freq:'q24h',note:''},
      {range:'6–15',dose:'500 mg',freq:'q24h',note:''},
      {range:'<6 / HD',dose:'1 g loading → 500 mg',freq:'q24-48h',note:'Give post-HD'}
    ],
    info:'<strong>CRRT:</strong> 1-2 g q8-12h<br><strong>Extended infusion:</strong> อาจพิจารณา 3-4 hr infusion',
    infoType:'blue',
    ref:'Lexicomp 2024 | Sanford Guide 2024'},

  {id:'cefepime',name:'Cefepime','class':'abx',sub:'4th gen Cephalosporin',badges:['abx','renal'],
    recommended:'1–2 g q8h',
    dosingTable:[
      {range:'>60',dose:'1–2 g',freq:'q8h',note:'Normal'},
      {range:'30–60',dose:'1–2 g',freq:'q12h',note:''},
      {range:'11–29',dose:'1 g',freq:'q24h',note:''},
      {range:'≤10 / HD',dose:'500 mg–1 g',freq:'q24h',note:'Give post-HD'}
    ],
    info:'<strong>⚠ Neurotoxicity risk สูงขึ้นมาก</strong>เมื่อไม่ปรับ dose ใน CKD → confusion, seizures, myoclonus<br><strong>CRRT:</strong> 1-2 g q8-12h',
    infoType:'amber',
    ref:'Lexicomp 2024 | Payne LE, et al. Crit Care. 2017;21(1):276'},

  {id:'amikacin',name:'Amikacin','class':'abx',sub:'Aminoglycoside',badges:['abx','renal','hd'],
    recommended:'15 mg/kg q24h (extended-interval)',
    dosingTable:[
      {range:'≥60',dose:'15 mg/kg',freq:'q24h',note:'Extended-interval'},
      {range:'40–59',dose:'15 mg/kg',freq:'q36h',note:''},
      {range:'20–39',dose:'15 mg/kg',freq:'q48h',note:''},
      {range:'<20 / HD',dose:'15 mg/kg',freq:'By level',note:'Re-dose when trough <5'}
    ],
    info:'<strong>TDM:</strong> Peak 20-35 (extended) | Trough <5 mcg/mL<br><strong>Monitor:</strong> SCr, audiometry, vestibular function<br><strong>HD:</strong> Give post-HD, เจาะ level pre-next dose',
    infoType:'blue',
    ref:'Lexicomp 2024 | Nicolau DP, et al. AAC 1995'},

  // ── ANTIFUNGALS ──
  {id:'fluconazole',name:'Fluconazole','class':'af',sub:'Azole',badges:['af','renal'],
    recommended:'200-400 mg/day',
    dosingTable:[
      {range:'>50',dose:'200-400 mg',freq:'q24h',note:'Normal dose'},
      {range:'≤50 (no HD)',dose:'100-200 mg',freq:'q24h',note:'ลด 50%'},
      {range:'<10 / HD',dose:'100-200 mg',freq:'q24h post-HD',note:'ให้หลัง HD'}
    ],
    info:'<strong>HD:</strong> Fluconazole dialyzable — ให้ dose หลัง HD<br><strong>CRRT:</strong> ให้ normal dose (200-400 mg/day)<br><strong>Monitor:</strong> LFTs, QTc',
    infoType:'blue',
    ref:'Lexicomp 2024 | IDSA Candidiasis Guidelines 2016'},

  {id:'amphotericin-b',name:'Amphotericin B (Liposomal)','class':'af',sub:'Polyene',badges:['af','nephrotox'],
    recommended:'3-5 mg/kg/day (ไม่ต้องปรับ dose ตาม GFR)',
    dosingTable:[
      {range:'All GFR',dose:'3-5 mg/kg/day',freq:'q24h',note:'ไม่ต้องปรับ dose'},
      {range:'HD',dose:'3-5 mg/kg/day',freq:'q24h',note:'ไม่ถูก dialyze'}
    ],
    info:'<strong>⚠ Nephrotoxic:</strong> Monitor SCr, K+, Mg++ ทุกวัน<br>Liposomal form มี nephrotoxicity น้อยกว่า conventional<br>Pre-hydrate with NSS 500 mL ก่อนให้ยา<br><strong>CRRT:</strong> ไม่ต้องปรับ dose',
    infoType:'amber',
    ref:'Lexicomp 2024 | IDSA Aspergillosis Guidelines 2016'},

  {id:'voriconazole',name:'Voriconazole','class':'af',sub:'Azole',badges:['af','avoid'],
    recommended:'IV: 6 mg/kg q12h x2 → 4 mg/kg q12h; PO: 200-300 mg q12h',
    dosingTable:[
      {range:'>50',dose:'IV: 6→4 mg/kg; PO: 200-300 mg',freq:'q12h',note:'Normal'},
      {range:'≤50',dose:'⚠ PO only: 200-300 mg',freq:'q12h',note:'หลีกเลี่ยง IV (SBECD)'},
      {range:'<10 / HD',dose:'PO: 200 mg',freq:'q12h',note:'PO only'}
    ],
    info:'<strong>⚠ IV formulation:</strong> มี SBECD (sulfobutylether-β-cyclodextrin) ที่สะสมใน renal impairment<br>ถ้า CrCl ≤50 → เปลี่ยนเป็น PO หรือใช้ liposomal ampho B แทน<br><strong>TDM:</strong> Trough 1-5.5 mcg/mL<br><strong>Monitor:</strong> LFTs, visual disturbances',
    infoType:'amber',
    ref:'Lexicomp 2024 | IDSA Aspergillosis Guidelines 2016'},

  // ── ANTIVIRALS ──
  {id:'acyclovir',name:'Acyclovir','class':'av',sub:'Nucleoside Analog',badges:['av','renal','nephrotox'],
    recommended:'10 mg/kg q8h (HSV encephalitis)',
    dosingTable:[
      {range:'>50',dose:'10 mg/kg',freq:'q8h',note:'HSV encephalitis dose'},
      {range:'25–50',dose:'10 mg/kg',freq:'q12h',note:''},
      {range:'10–25',dose:'10 mg/kg',freq:'q24h',note:''},
      {range:'<10 / HD',dose:'5 mg/kg',freq:'q24h + post-HD',note:'Give dose post-HD'}
    ],
    info:'<strong>⚠ Nephrotoxic:</strong> Crystalluria risk — hydrate with NSS 1 L ก่อนให้ยา<br>Infuse over ≥1 hour<br><strong>HD:</strong> Give supplemental dose post-HD<br><strong>Monitor:</strong> SCr, urine output, neurological status',
    infoType:'amber',
    ref:'Lexicomp 2024 | Red Book 2024'},

  {id:'ganciclovir',name:'Ganciclovir','class':'av',sub:'Nucleoside Analog',badges:['av','renal','hd'],
    recommended:'5 mg/kg q12h (induction) → 5 mg/kg q24h (maintenance)',
    dosingTable:[
      {range:'≥70',dose:'5 mg/kg',freq:'q12h / q24h',note:'Induction / Maintenance'},
      {range:'50–69',dose:'2.5 mg/kg',freq:'q12h / q24h',note:''},
      {range:'25–49',dose:'2.5 / 1.25 mg/kg',freq:'q24h',note:''},
      {range:'10–24',dose:'1.25 / 0.625 mg/kg',freq:'q24h',note:''},
      {range:'<10 / HD',dose:'1.25 mg/kg',freq:'3x/wk post-HD',note:''}
    ],
    info:'<strong>Monitor:</strong> CBC 2-3x/wk (neutropenia risk), SCr<br><strong>HD:</strong> Give post-HD on dialysis days<br><strong>CRRT:</strong> 2.5 mg/kg q12h (induction) → q24h (maintenance)',
    infoType:'blue',
    ref:'Lexicomp 2024 | Transplant Infectious Disease Guidelines'},

  // ── ANTICOAGULANTS ──
  {id:'enoxaparin',name:'Enoxaparin','class':'ac',sub:'LMWH',badges:['ac','renal'],
    recommended:'Treatment: 1 mg/kg q12h | Prophylaxis: 40 mg q24h',
    dosingTable:[
      {range:'>30',dose:'1 mg/kg',freq:'q12h',note:'Treatment dose'},
      {range:'>30',dose:'40 mg',freq:'q24h',note:'Prophylaxis'},
      {range:'≤30',dose:'1 mg/kg',freq:'q24h ⚠',note:'ลด frequency'},
      {range:'≤30',dose:'30 mg',freq:'q24h',note:'Prophylaxis (ลด dose)'}
    ],
    info:'<strong>⚠ CrCl ≤30:</strong> LMWH สะสมได้ → พิจารณา UFH แทน<br><strong>Monitor:</strong> Anti-Xa level (target 0.5-1.0 IU/mL for treatment)<br><strong>Obesity:</strong> ใช้ actual body weight, cap ที่ 150 mg/dose<br><strong>HD:</strong> หลีกเลี่ยง LMWH → ใช้ UFH',
    infoType:'amber',
    ref:'Lexicomp 2024 | CHEST Guidelines 2021'},

  {id:'dabigatran',name:'Dabigatran','class':'ac',sub:'DOAC (Direct Thrombin Inhibitor)',badges:['ac','renal','avoid'],
    recommended:'150 mg BID (AF) | 150 mg BID (VTE treatment)',
    dosingTable:[
      {range:'>50',dose:'150 mg',freq:'BID',note:'Normal dose'},
      {range:'30–50',dose:'110 mg',freq:'BID',note:'ลด dose (age ≥80, P-gp inhib)'},
      {range:'<30',dose:'⚠ Contraindicated',freq:'—',note:'ห้ามใช้'}
    ],
    info:'<strong>⚠ Renal elimination 80%:</strong> ห้ามใช้ถ้า CrCl <30<br><strong>Drug interaction:</strong> P-gp inhibitors (verapamil, dronedarone) → ลด dose<br><strong>Reversal:</strong> Idarucizumab (Praxbind)<br><strong>HD:</strong> Dialyzable — สามารถ remove ได้ 60% ใน 2-3 ชม.',
    infoType:'red',
    ref:'Lexicomp 2024 | ESC AF Guidelines 2024'},

  // ── CARDIOVASCULAR ──
  {id:'digoxin',name:'Digoxin','class':'cv',sub:'Cardiac Glycoside',badges:['cv','renal','nephrotox'],
    recommended:'0.125-0.25 mg/day',
    dosingTable:[
      {range:'>50',dose:'0.125-0.25 mg',freq:'q24h',note:''},
      {range:'10–50',dose:'0.0625-0.125 mg',freq:'q24h',note:'ลด dose 50%'},
      {range:'<10 / HD',dose:'0.0625 mg',freq:'q48h',note:'By level'}
    ],
    info:'<strong>TDM:</strong> Target 0.5-0.9 ng/mL (HF) | 0.8-2.0 (AF)<br><strong>⚠ Toxicity risk:</strong> เพิ่มขึ้นเมื่อ K+ ต่ำ, renal impairment<br><strong>HD:</strong> Not significantly removed<br><strong>Drug interaction:</strong> Amiodarone, verapamil → ลด dose 50%',
    infoType:'amber',
    ref:'Lexicomp 2024 | ACC/AHA HF Guidelines 2022'},

  {id:'enalapril',name:'Enalapril','class':'cv',sub:'ACE Inhibitor',badges:['cv','renal'],
    recommended:'2.5-20 mg/day (titrate)',
    dosingTable:[
      {range:'>30',dose:'2.5-20 mg',freq:'q12-24h',note:'Titrate to response'},
      {range:'10–30',dose:'2.5-5 mg',freq:'q24h',note:'Start low'},
      {range:'<10 / HD',dose:'2.5 mg',freq:'q24h',note:'Dialyzable'}
    ],
    info:'<strong>⚠ Monitor:</strong> K+, SCr (ยอมรับ SCr เพิ่ม ≤30% จาก baseline)<br>ถ้า SCr เพิ่ม >30% หรือ K+ >5.5 → ลด dose หรือหยุด<br><strong>HD:</strong> Give supplemental dose post-HD (20-25% dialyzable)',
    infoType:'blue',
    ref:'Lexicomp 2024 | KDIGO CKD Guidelines 2024'},

  // ── ANALGESICS ──
  {id:'morphine',name:'Morphine','class':'analgesic',sub:'Opioid',badges:['analgesic','renal','avoid'],
    recommended:'Normal dose (titrate to pain)',
    dosingTable:[
      {range:'>50',dose:'Normal dose',freq:'q4h PRN',note:'Titrate to pain'},
      {range:'15–50',dose:'ลด 50-75%',freq:'q6-8h',note:'M6G สะสม'},
      {range:'<15 / HD',dose:'⚠ หลีกเลี่ยง',freq:'—',note:'ใช้ fentanyl แทน'}
    ],
    info:'<strong>⚠ Active metabolite M6G:</strong> สะสมใน renal impairment → respiratory depression, sedation<br><strong>Alternative:</strong> Fentanyl (no active metabolites, ไม่ต้องปรับ dose)<br><strong>HD:</strong> M6G ถูก dialyze ได้บางส่วน แต่ยังเสี่ยง',
    infoType:'red',
    ref:'Lexicomp 2024 | Dean M. J Pain Symptom Manage 2004'},

  {id:'gabapentin',name:'Gabapentin','class':'analgesic',sub:'Gabapentinoid',badges:['analgesic','renal'],
    recommended:'300-1200 mg TID',
    dosingTable:[
      {range:'≥60',dose:'300-1200 mg',freq:'TID',note:'Normal dose'},
      {range:'30–59',dose:'200-700 mg',freq:'BID',note:''},
      {range:'15–29',dose:'100-300 mg',freq:'q24h',note:''},
      {range:'<15 / HD',dose:'100-300 mg',freq:'post-HD',note:'Supplemental dose after HD'}
    ],
    info:'<strong>100% renal elimination:</strong> ต้องปรับ dose ตาม GFR เสมอ<br><strong>HD:</strong> Dialyzable — ให้ supplemental dose 125-350 mg post-HD<br><strong>Monitor:</strong> Sedation, dizziness, peripheral edema',
    infoType:'blue',
    ref:'Lexicomp 2024 | Bockbrader HN, et al. Clin Pharmacokinet 2010'},

  // ── NEUROLOGY ──
  {id:'levetiracetam',name:'Levetiracetam','class':'neuro',sub:'Antiepileptic',badges:['neuro','renal','hd'],
    recommended:'500-1500 mg BID',
    dosingTable:[
      {range:'>80',dose:'500-1500 mg',freq:'q12h',note:'Normal dose'},
      {range:'50–80',dose:'500-1000 mg',freq:'q12h',note:''},
      {range:'30–50',dose:'250-750 mg',freq:'q12h',note:''},
      {range:'<30 / HD',dose:'250-500 mg',freq:'q12h',note:'Supplement 250-500 mg post-HD'}
    ],
    info:'<strong>66% renal elimination:</strong> ต้องปรับ dose ตาม GFR<br><strong>HD:</strong> Dialyzable ~50% — ให้ supplemental dose 250-500 mg post-HD<br><strong>CRRT:</strong> 250-750 mg q12h<br><strong>IV ↔ PO:</strong> 1:1 conversion',
    infoType:'blue',
    ref:'Lexicomp 2024 | Epilepsia 2006'},

  {id:'phenobarbital',name:'Phenobarbital','class':'neuro',sub:'Barbiturate',badges:['neuro','hd'],
    recommended:'60-180 mg/day (ไม่ต้องปรับ dose แต่ระวัง sedation)',
    dosingTable:[
      {range:'>10',dose:'60-180 mg',freq:'q24h',note:'ไม่ต้องปรับ (hepatic metabolism)'},
      {range:'<10 / HD',dose:'60-180 mg',freq:'q24h',note:'Supplement post-HD'}
    ],
    info:'<strong>Primarily hepatic metabolism</strong> — ไม่ต้องปรับ dose ตาม GFR<br>แต่ active metabolite อาจสะสมใน severe renal impairment → ระวัง sedation<br><strong>HD:</strong> 20-50% dialyzable — give supplement post-HD<br><strong>TDM:</strong> Target 15-40 mcg/mL',
    infoType:'blue',
    ref:'Lexicomp 2024 | Winter\'s Basic Clinical Pharmacokinetics'},

  // ── CHEMOTHERAPY ──
  {id:'methotrexate',name:'Methotrexate (High-dose)','class':'chemo',sub:'Antimetabolite',badges:['chemo','renal','nephrotox'],
    recommended:'Per protocol + aggressive hydration + leucovorin rescue',
    dosingTable:[
      {range:'≥60',dose:'Per protocol',freq:'Per protocol',note:'ต้อง hydrate + alkalinize urine'},
      {range:'<60',dose:'⚠ Hold/Reduce',freq:'—',note:'Delay until GFR ≥60'}
    ],
    info:'<strong>⚠ Nephrotoxic:</strong> MTX precipitates ใน renal tubules<br><strong>Mandatory:</strong> Aggressive hydration (3 L/m²/day) + Urine alkalinization (pH >7)<br><strong>Leucovorin rescue:</strong> ต้องให้ตาม MTX level protocol<br><strong>HD:</strong> High-flux HD หรือ CWHD อาจช่วยลด level ได้<br><strong>Monitor:</strong> MTX level, SCr q6-12h, CBC, LFTs',
    infoType:'red',
    ref:'Lexicomp 2024 | NCCN Guidelines | Howard SC, et al. NEJM 2016'},

  {id:'cisplatin',name:'Cisplatin','class':'chemo',sub:'Platinum',badges:['chemo','nephrotox'],
    recommended:'Per protocol + aggressive hydration',
    dosingTable:[
      {range:'≥60',dose:'Per protocol',freq:'Per cycle',note:'Pre/post hydration mandatory'},
      {range:'45–59',dose:'ลด 25%',freq:'Per cycle',note:'พิจารณา carboplatin'},
      {range:'<45',dose:'⚠ Contraindicated',freq:'—',note:'ใช้ carboplatin แทน'}
    ],
    info:'<strong>⚠ Highly nephrotoxic:</strong> Causes dose-dependent tubular injury<br><strong>Mandatory hydration:</strong> NSS 1-2 L pre/post + mannitol<br><strong>Alternative:</strong> Carboplatin (AUC-based, less nephrotoxic)<br><strong>Monitor:</strong> SCr, Mg++, K+, audiometry',
    infoType:'red',
    ref:'Lexicomp 2024 | NCCN Guidelines'},

  // ── MISCELLANEOUS ──
  {id:'allopurinol',name:'Allopurinol','class':'misc',sub:'Xanthine Oxidase Inhibitor',badges:['misc','renal'],
    recommended:'100-300 mg/day',
    dosingTable:[
      {range:'>60',dose:'100-300 mg',freq:'q24h',note:'Titrate to uric acid <6'},
      {range:'30–60',dose:'100-200 mg',freq:'q24h',note:''},
      {range:'15–30',dose:'100 mg',freq:'q24h',note:''},
      {range:'<15 / HD',dose:'100 mg',freq:'q48h',note:'Post-HD on dialysis days'}
    ],
    info:'<strong>Active metabolite Oxipurinol:</strong> สะสมใน renal impairment → เสี่ยง hypersensitivity syndrome<br><strong>HLA-B*5801:</strong> Screen ก่อนเริ่มยา (โดยเฉพาะ Thai/Asian) — ลด risk SJS/TEN<br><strong>HD:</strong> Dialyzable — give post-HD<br><strong>Alternative:</strong> Febuxostat (ไม่ต้องปรับ dose)',
    infoType:'amber',
    ref:'Lexicomp 2024 | ACR Gout Guidelines 2020'},

  {id:'metformin',name:'Metformin','class':'misc',sub:'Biguanide',badges:['misc','renal','avoid'],
    recommended:'500-1000 mg BID (max 2000 mg/day)',
    dosingTable:[
      {range:'≥45',dose:'500-1000 mg',freq:'BID',note:'Normal dose'},
      {range:'30–44',dose:'500 mg',freq:'BID (max 1000)',note:'⚠ ลด dose + monitor'},
      {range:'<30',dose:'⚠ Contraindicated',freq:'—',note:'Lactic acidosis risk'}
    ],
    info:'<strong>⚠ Lactic acidosis:</strong> Risk เพิ่มเมื่อ GFR <30<br><strong>GFR 30-44:</strong> ลด dose + ห้ามเริ่มยาใหม่ (ให้ต่อได้ถ้าใช้อยู่แล้ว)<br><strong>Hold:</strong> ก่อน contrast media, surgery, หรือ acute illness<br><strong>HD:</strong> Dialyzable — มี case reports ใช้ HD รักษา metformin-associated lactic acidosis',
    infoType:'red',
    ref:'Lexicomp 2024 | KDIGO Diabetes & CKD 2022 | FDA Label 2024'}
];
