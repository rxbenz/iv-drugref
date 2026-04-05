(function() {
  'use strict';

  // ============================================================
  // IV DrugRef Compatibility Module v5.0
  // Extracted from compatibility.html
  // ============================================================

const DRUGS=[{i:1,g:"Abciximab",t:"Abciximab Inj. 10 mg/5 mL",h:!0,c:["cardiovascular"],y:"Limited data",x:"ห้ามผสมกับยาอื่น (dedicated line)"},{i:2,g:"Acyclovir",t:"Acyclovir inj. 250 mg",h:!1,c:["antimicrobial"],y:"Ceftriaxone, Fluconazole, Meropenem, Ondansetron",x:"D10W, D20W, TPN, Blood products\\nDobutamine, Dopamine"},{i:3,g:"Adenosine",t:"Adenocor Inj. 6 mg/2 mL",h:!0,c:["cardiovascular"],y:"-",x:"-"},{i:4,g:"Adrenaline (Epinephrine)",t:"Adrenaline Inj. 1 mg/mL",h:!0,c:["icu","cardiovascular"],y:"Amiodarone, Atracurium, Calcium chloride, Cisatracurium, Dobutamine, Dopamine, Fentanyl, Heparin, KCl, Lidocaine, Lorazepam, Midazolam, Milrinone, Morphine, Nitroglycerin, Norepinephrine, Propofol, Rocuronium, Vecuronium",x:"NaHCO₃, Aminophylline, Thiopental"},{i:5,g:"Alteplase (rt-PA)",t:"Actilyse 50 mg",h:!0,c:["stroke"],y:"Dedicated line เท่านั้น\\nFlush NSS ก่อน-หลัง",x:"Heparin (แยก line)\\nMost drugs (dedicated line)"},{i:6,g:"Amikacin",t:"Amikacin Inj. 500 mg/2 mL",h:!1,c:["antimicrobial"],y:"Dexamethasone, Furosemide, Midazolam, Ondansetron",x:"Amphotericin B, Heparin, Phenytoin, Propofol"},{i:7,g:"Amiodarone",t:"Cordarone Inj. 150 mg/3 mL",h:!0,c:["cardiovascular","icu"],y:"Dobutamine (D5W), Dopamine (D5W), Insulin, Lidocaine, Midazolam, Morphine, Cisatracurium, Nitroglycerin",x:"NaHCO₃, Heparin, Furosemide, Thiopental\\nDiazepam, Phenytoin"},{i:8,g:"Amoxicillin/Clavulanic acid",t:"Augmentin Inj. 1.2 g",h:!1,c:["antimicrobial"],y:"Limited data",x:"Aminoglycosides (ห้ามผสม!)\\nSodium bicarbonate, Blood products"},{i:9,g:"Amphotericin B (conventional)",t:"Amphotericin B Inj. 50 mg",h:!0,c:["antimicrobial"],y:"Heparin (≤1 unit/mL เท่านั้น)",x:"NSS, Electrolyte solutions ทุกชนิด\\nMost drugs (give alone)"},{i:10,g:"Ampicillin",t:"Ampicillin Inj. 1 g",h:!1,c:["antimicrobial"],y:"Heparin, Midazolam",x:"Aminoglycosides (แยก line!)\\nSodium bicarbonate"},{i:11,g:"Ampicillin/Sulbactam",t:"Unasyn Inj. 1.5 g / 3 g",h:!1,c:["antimicrobial"],y:"Heparin",x:"Aminoglycosides\\nSodium bicarbonate"},{i:12,g:"Atracurium",t:"Atracurium Inj. 25/50 mg",h:!0,c:["icu"],y:"Cefazolin, Cefuroxime, Cimetidine, Dexmedetomidine, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, Hetastarch, Isoproterenol, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Phenylephrine, Propofol, Ranitidine, Sufentanil, TMP/SMX, Vancomycin",x:"Alkaline solutions (pH >8.5)\\nThiopental, Diazepam, Phenobarbital\\nPropofol (same syringe only — Y-site OK)"},{i:13,g:"Atropine",t:"Atropine Inj. 0.6 mg/mL",h:!1,c:["cardiovascular","icu"],y:"Dobutamine, Dopamine, Fentanyl, Glycopyrrolate, Heparin, Midazolam, Morphine, Neostigmine (same syringe OK)",x:"NaHCO₃ (some reports), Thiopental"},{i:14,g:"Benzathine Penicillin G",t:"Benzathine Penicillin G Inj. 1.2 MU",h:!0,c:["antimicrobial"],y:"N/A (IM only)",x:"N/A (IM only)"},{i:15,g:"Benztropine mesylate",t:"Benztropine Inj. 1 mg/mL",h:!1,c:["antiepileptic"],y:"Limited data",x:"Limited data"},{i:16,g:"Botulinum toxin type A",t:"Botox / Dysport Inj.",h:!0,c:[],y:"N/A (IM injection)",x:""},{i:17,g:"Bupivacaine",t:"Marcain Inj. 0.5%",h:!0,c:["analgesic"],y:"Fentanyl (epidural)\\nMorphine (epidural)",x:"Alkaline solutions"},{i:18,g:"Calcium gluconate",t:"Calcium gluconate 10%",h:!0,c:["icu"],y:"Dobutamine, Dopamine, Esmolol, Heparin, Hydrocortisone, KCl, Lidocaine, Midazolam, Morphine, Norepinephrine, Potassium phosphate (caution), Ranitidine",x:"Ceftriaxone (ห้ามเด็ดขาด!)\\nNaHCO₃, Phosphate solutions (concentrated), Amphotericin B\\nFluconazole, Magnesium sulfate (same line — precipitation risk)"},{i:19,g:"Cefazolin",t:"CeFAZolin Inj. 1 g",h:!1,c:["antimicrobial"],y:"Midazolam, Morphine, Heparin",x:"Amikacin (same bag), Aminoglycosides"},{i:20,g:"Cefoperazone/Sulbactam",t:"Sulperazon Inj. 1.5 g",h:!1,c:["antimicrobial"],y:"Heparin",x:"Aminoglycosides\\nCalcium (แยก line)"},{i:21,g:"Ceftazidime",t:"CefTAZidime Inj. 1 g",h:!1,c:["antimicrobial"],y:"Heparin, Midazolam",x:"Aminoglycosides (แยก line)\\nVancomycin, Amiodarone"},{i:22,g:"Ceftazidime/Avibactam",t:"Zavicefta Inj. 2/0.5 g",h:!1,c:["antimicrobial"],y:"Limited data → dedicated line preferred",x:"ข้อมูล compatibility จำกัด\\nแยก line เมื่อเป็นไปได้"},{i:23,g:"Ceftriaxone",t:"Ceftriaxone Inj. 1 g / 2 g",h:!1,c:["antimicrobial"],y:"Acyclovir, Metronidazole, Morphine",x:"Calcium solutions (ห้ามเด็ดขาด ในทารก!)\\nAminoglycosides, Vancomycin"},{i:24,g:"Chlorpheniramine",t:"Chlorpheniramine Inj. 10 mg/mL",h:!1,c:[],y:"Limited Y-site data — common IV push drugs",x:"Limited data"},{i:25,g:"Ciprofloxacin",t:"Ciprofloxacin Inj. 200 mg/100 mL",h:!1,c:["antimicrobial"],y:"Midazolam, Potassium chloride",x:"Heparin, NaHCO₃, Aminophylline\\nClindamycin, Dexamethasone (variable)\\nPhenytoin, Furosemide"},{i:26,g:"Cisatracurium",t:"Nimbex Inj. 2 mg/mL",h:!0,c:["icu"],y:"Alfentanil, Amiodarone, Dobutamine, Dopamine, Epinephrine, Esmolol, Fentanyl, Heparin, Insulin, KCl, Lidocaine, Lorazepam, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Phenylephrine, Propofol, Ranitidine, Remifentanil, Sufentanil",x:"Alkaline solutions (pH >8.5)\\nThiopental, Diazepam, Ketorolac\\nPropofol (same syringe only — Y-site OK)"},{i:27,g:"Clindamycin",t:"Clindamycin Inj. 600 mg",h:!1,c:["antimicrobial"],y:"Amikacin, Heparin, Midazolam, Morphine",x:"Calcium gluconate, Aminophylline\\nPhenytoin, Ciprofloxacin"},{i:28,g:"Colistimethate sodium (CMS)",t:"Colistin Inj. 150 mg CBA",h:!0,c:["antimicrobial"],y:"Limited data",x:"แยก line เมื่อเป็นไปได้"},{i:29,g:"Cotrimoxazole (TMP/SMX)",t:"Cotrimoxazole Inj. 480 mg/5 mL",h:!1,c:["antimicrobial"],y:"Limited data",x:"ห้ามผสมกับยาอื่นใน bag เดียวกัน\\nNSS (stability จำกัด)"},{i:30,g:"Cyclophosphamide",t:"Endoxan Inj. 500 mg / 1 g",h:!0,c:["immunotherapy"],y:"Ondansetron, Metoclopramide",x:"Amphotericin B"},{i:31,g:"Desmopressin (DDAVP)",t:"Minirin Inj. 4 mcg/mL",h:!0,c:["icu"],y:"Limited data",x:"Limited data"},{i:32,g:"Dexamethasone",t:"Dexamethasone Inj. 4-5 mg/mL",h:!1,c:["icu"],y:"Acyclovir, Amikacin, Aminophylline, Ceftazidime, Ceftriaxone, Cisplatin, Fentanyl, Fluconazole, Heparin, Lidocaine, Meropenem, Metronidazole, Morphine, Ondansetron, Pip/Tazo, Ranitidine",x:"Midazolam (variable), Vancomycin (variable)\\nCiprofloxacin, Doxorubicin"},{i:33,g:"Dexmedetomidine",t:"Dexmedetomidine Inj.",h:!0,c:["icu","analgesic"],y:"Alfentanil, Amiodarone, Atracurium, Cisatracurium, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, Insulin, KCl, Ketamine, Labetalol, Lidocaine, Midazolam, Milrinone, Morphine, Nicardipine, Nitroglycerin, Norepinephrine, Pancuronium, Propofol, Rocuronium, Vasopressin, Vecuronium",x:"Amphotericin B, Diazepam, Phenytoin, Blood products"},{i:34,g:"Diazepam",t:"Diazepam Inj. 10 mg/2 mL",h:!0,c:["antiepileptic","analgesic"],y:"-",x:"IV fluids ทุกชนิด (ห้ามเจือจาง)\\nAdsorbs to PVC → ใช้ glass/polyolefin"},{i:35,g:"Diclofenac",t:"Voltaren Inj. 75 mg/3 mL",h:!1,c:["analgesic"],y:"Limited data",x:"ห้ามผสมกับยาอื่นใน syringe\\nAcidic solutions"},{i:36,g:"Digoxin",t:"Digoxin Inj. 0.5 mg/2 mL",h:!0,c:["cardiovascular"],y:"-",x:"Dobutamine, Fluconazole, Insulin, Amiodarone"},{i:37,g:"Dimenhydrinate",t:"Dimenhydrinate Inj. 50 mg/mL",h:!1,c:[],y:"Limited data",x:"Aminophylline, Heparin\\nPhenobarbital, Thiopental"},{i:38,g:"Dobutamine",t:"DOBUTamine Inj. 250 mg/20 mL",h:!0,c:["icu","cardiovascular"],y:"Amiodarone, Atracurium, Calcium chloride, Cisatracurium, Dopamine, Esmolol, Fentanyl, Heparin, KCl, Lidocaine, Midazolam, Milrinone, Morphine, Nitroglycerin, Norepinephrine, Propofol, Ranitidine, Rocuronium, Vecuronium",x:"NaHCO₃, Furosemide, Diazepam\\nAcyclovir, Aminophylline, Phenytoin\\nAlteplase, Thiopental"},{i:39,g:"Dopamine",t:"Dopamine Inj. 250 mg/10 mL",h:!0,c:["icu","cardiovascular"],y:"Amiodarone (D5W), Atracurium, Calcium chloride, Cisatracurium, Dobutamine, Esmolol, Fentanyl, Heparin, KCl, Lidocaine, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Propofol, Rocuronium, Vecuronium",x:"NaHCO₃, Furosemide, Amphotericin B, Thiopental\\nAcyclovir, Diazepam, Phenytoin\\nInsulin (variable — concentration-dependent)\\nAlteplase (inactivation)"},{i:40,g:"Doripenem",t:"Doribax Inj. 500 mg",h:!1,c:["antimicrobial"],y:"Limited data",x:"ห้ามผสมกับยาอื่นใน bag"},{i:41,g:"Enoxaparin",t:"Clexane Inj. 40/60/80 mg",h:!0,c:["cardiovascular"],y:"-",x:"-"},{i:42,g:"Ephedrine",t:"Ephedrine Inj. 30 mg/mL",h:!1,c:["icu"],y:"Propofol, Fentanyl",x:"Alkaline solutions\\nThiopental, Phenobarbital"},{i:43,g:"Eptifibatide",t:"Integrilin Inj. 20 mg/10 mL",h:!0,c:["cardiovascular"],y:"Heparin, Atropine",x:"Furosemide"},{i:44,g:"Ertapenem",t:"Invanz Inj. 1 g",h:!1,c:["antimicrobial"],y:"Heparin, Metronidazole, Tigecycline",x:"D5W, LR, Dextrose-containing solutions ทุกชนิด!\\nห้ามผสมกับยาอื่นใน bag เดียวกัน"},{i:45,g:"Esmolol",t:"Esbloc Inj. 100 mg/10 mL",h:!0,c:["cardiovascular","icu"],y:"Amiodarone, Atracurium, Cisatracurium, Dopamine, Fentanyl, Heparin, Insulin, KCl, Lidocaine, Midazolam, Morphine, Nicardipine, Nitroglycerin, Norepinephrine, Propofol, Rocuronium, Vecuronium",x:"NaHCO₃, Furosemide, Diazepam\\nAmphotericin B, Thiopental"},{i:46,g:"Etomidate",t:"Etomidate Inj. 20 mg/10 mL",h:!0,c:["icu"],y:"Limited data",x:"Limited data"},{i:47,g:"Fentanyl",t:"Fentanyl Inj. 0.1 mg/2 mL",h:!0,c:["analgesic","icu"],y:"Amiodarone, Atracurium, Cisatracurium, Dexmedetomidine, Dobutamine, Dopamine, Esmolol, Heparin, Insulin, Ketamine, KCl, Labetalol, Lidocaine, Lorazepam, Midazolam, Milrinone, Morphine, Nicardipine, Nitroglycerin, Norepinephrine, Ondansetron, Propofol, Ranitidine, Rocuronium, Vecuronium",x:"Phenytoin, Thiopental\\nDiazepam, NaHCO₃ (alkaline solutions)"},{i:48,g:"Fluconazole",t:"Fluconazole Inj. 200 mg/100 mL",h:!1,c:["antimicrobial"],y:"Acyclovir, Amikacin, Aminophylline, Ceftazidime, Ceftriaxone, Dexamethasone, Dopamine, Fentanyl, Heparin, Insulin, KCl, Meropenem, Metronidazole, Midazolam, Morphine, Ondansetron, Phenylephrine, Pip/Tazo, Ranitidine, TMP/SMX, Vancomycin",x:"Amphotericin B, Calcium gluconate\\nCeftazidime (variable), Furosemide"},{i:49,g:"Fosfomycin",t:"Fosfomycin Inj. 2 g",h:!1,c:["antimicrobial"],y:"Limited data",x:"Limited data → แยก line preferred"},{i:50,g:"Furosemide",t:"Lasix Inj. 20 mg/2 mL",h:!1,c:["cardiovascular","icu"],y:"Amikacin, Cefotaxime, Heparin, Hydrocortisone, Insulin, KCl, Morphine, Nitroglycerin, Propofol, Ranitidine, Tobramycin",x:"Dobutamine, Dopamine, Milrinone (precipitates!)\\nVancomycin, Amiodarone, Ciprofloxacin\\nOndansetron (incompatible), Diazepam\\nMidazolam (variable at high conc)\\nNorepinephrine (variable — conc-dependent)"},{i:51,g:"Ganciclovir",t:"Cymevene Inj. 500 mg",h:!0,c:["antimicrobial"],y:"Limited data",x:"Foscarnet\\nห้ามผสมกับยาอื่น (dedicated line preferred)"},{i:52,g:"Gentamicin",t:"Gentamicin Inj. 80 mg/2 mL",h:!1,c:["antimicrobial"],y:"Acyclovir, Midazolam",x:"Beta-lactams (Penicillins, Cephalosporins) → ห้ามผสม!\\nHeparin, Furosemide (variable)"},{i:53,g:"Glucose 50% (Dextrose 50%)",t:"Glucose Inj. 50% 50 mL",h:!0,c:["icu"],y:"Insulin, KCl, Heparin, Aminophylline, Calcium gluconate",x:"Ampicillin (ลด stability)\\nPhenytoin (ตกตะกอน!)\\nNaHCO₃ (some), Diazepam"},{i:54,g:"Glyceryl trinitrate (NTG)",t:"NTG Inj. 50 mg/10 mL",h:!0,c:["cardiovascular","icu"],y:"Amiodarone, Atracurium, Cisatracurium, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, Insulin, KCl, Labetalol, Lidocaine, Midazolam, Milrinone, Morphine, Nicardipine, Norepinephrine, Propofol, Ranitidine, Rocuronium, Vecuronium",x:"Alteplase\\nPhenytoin, Diazepam"},{i:55,g:"Glycopyrrolate",t:"Glycopyrrolate Inj. 0.2 mg/mL",h:!1,c:["icu"],y:"Neostigmine (ผสม syringe เดียวกันได้)",x:"Limited data"},{i:56,g:"Haloperidol",t:"Haldol Inj. / Haldol Decanoate",h:!0,c:["icu"],y:"Midazolam, Fentanyl, Morphine",x:"Heparin, Phenytoin\\nFluconazole (some)"},{i:57,g:"Heparin",t:"Heparin Inj. 5000/25000 units",h:!0,c:["cardiovascular","icu"],y:"Aminophylline, Calcium gluconate, Cimetidine, Dobutamine, Dopamine, Esmolol, Fentanyl, Gentamicin, Hydrocortisone, Insulin, KCl, Lidocaine, Meropenem, Metronidazole, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Pip/Tazo, Propofol, Ranitidine",x:"Alteplase, Amiodarone, Amphotericin B, Daunorubicin\\nDiazepam, Doxorubicin, Phenytoin, Thiopental\\nVancomycin (incompatible — most institutions)"},{i:58,g:"Human Insulin (Regular)",t:"Actrapid HM 100 IU/mL",h:!0,c:["icu"],y:"Cimetidine, Dobutamine (variable), Esmolol, Fentanyl, Heparin, KCl, Lidocaine, Meropenem, Midazolam, Morphine, Nitroglycerin, Norepinephrine (variable), Propofol, Ranitidine, TPN",x:"NaHCO₃, Phenytoin, Thiopental\\nDopamine (variable — conc-dependent)\\nDiazepam"},{i:59,g:"Hydrocortisone",t:"Solu-Cortef Inj. 100 mg",h:!1,c:["icu"],y:"Aminophylline, Ampicillin, Cefazolin, Dopamine, Fentanyl, Furosemide, Heparin, Insulin, KCl, Lidocaine, Meropenem, Morphine, Norepinephrine, Ondansetron, Ranitidine",x:"Midazolam (variable), Phenytoin (mixed)\\nCiprofloxacin, Diazepam"},{i:60,g:"Hyoscine N-butylbromide",t:"Buscopan Inj. 20 mg/mL",h:!1,c:[],y:"Limited data",x:"Limited data"},{i:61,g:"Infliximab",t:"Remicade/Infliximab Inj. 100 mg",h:!0,c:["immunotherapy"],y:"ห้ามผสมกับยาอื่น",x:"ห้ามผสมกับยาอื่นทุกชนิด\\nPVC bag/tubing ใช้ได้"},{i:62,g:"IVIG (Immunoglobulin)",t:"IVIG Inj.",h:!0,c:["immunotherapy"],y:"ห้ามผสมกับยาอื่น",x:"ห้ามผสมกับยาอื่นทุกชนิด"},{i:63,g:"Ketamine",t:"Ketamine Inj. 500 mg/10 mL",h:!0,c:["icu","analgesic","antiepileptic"],y:"Propofol, Midazolam, Fentanyl, Morphine",x:"Barbiturates, Diazepam, NaHCO₃"},{i:64,g:"Labetalol",t:"Labetalol Inj. 100 mg/20 mL",h:!0,c:["stroke","cardiovascular","icu"],y:"Fentanyl, Midazolam, Morphine",x:"NaHCO₃, Furosemide (variable)"},{i:65,g:"Lacosamide",t:"Lacosamide Inj. 200 mg/20 mL",h:!1,c:["antiepileptic"],y:"NSS, D5W, LR compatible; limited drug-specific Y-site data",x:"Limited data — แยก line preferred for safety"},{i:66,g:"Levetiracetam",t:"Levetiracetam Inj. 500 mg/5 mL",h:!1,c:["antiepileptic"],y:"Lorazepam, Diazepam, Valproate",x:"Limited data"},{i:67,g:"Levofloxacin",t:"Cravit Inj. 750 mg",h:!1,c:["antimicrobial"],y:"Aminophylline, Dobutamine, Dopamine, Fentanyl, Insulin, Lidocaine, Morphine, Ondansetron, Phenylephrine",x:"Heparin, NaHCO₃, Mannitol\\nFurosemide, Acyclovir, Phenytoin"},{i:68,g:"Lidocaine",t:"Lidocaine Inj. 2%",h:!0,c:["cardiovascular","icu"],y:"Amiodarone, Atracurium, Cisatracurium, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, Insulin, KCl, Midazolam, Milrinone, Morphine, Nitroglycerin, Norepinephrine, Propofol",x:"Amphotericin B, Phenytoin\\nThiopental, Ceftriaxone (variable)"},{i:69,g:"Linezolid",t:"Zyvox Inj. 600 mg/300 mL",h:!1,c:["antimicrobial"],y:"Limited data → dedicated line preferred",x:"Amphotericin B, Chlorpromazine\\nDiazepam, Phenytoin, Thiopental\\nCeftriaxone (variable)"},{i:70,g:"Magnesium sulfate",t:"MgSO₄ Inj. 50%",h:!0,c:["icu","antiepileptic"],y:"Amikacin, Cefazolin, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, Hydrocortisone, Insulin, KCl, Meropenem, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Ondansetron, Pip/Tazo, Propofol",x:"Amphotericin B, Calcium (same line — precipitation risk!)\\nNaHCO₃, Thiopental"},{i:71,g:"Meropenem",t:"Meropenem Inj. 1 g",h:!1,c:["antimicrobial"],y:"Dexamethasone, Heparin, Metronidazole, Morphine",x:"Acyclovir, Amphotericin B, Diazepam, Ondansetron (variable)"},{i:72,g:"Mesna",t:"Mesna Inj. 400 mg",h:!1,c:["immunotherapy"],y:"Cyclophosphamide (ผสมใน bag เดียวกันได้)\\nIfosfamide",x:"Cisplatin\\nCarboplatin"},{i:73,g:"Methylprednisolone",t:"Solu-Medrol Inj. 500 mg / 1 g",h:!0,c:["immunotherapy","icu"],y:"Heparin, Metoclopramide, Ondansetron",x:"Calcium gluconate, Ciprofloxacin IV"},{i:74,g:"Metoclopramide",t:"Metoclopramide Inj. 10 mg/2 mL",h:!1,c:[],y:"Fentanyl, Midazolam, Morphine, KCl",x:"Cephalothin, NaHCO₃"},{i:75,g:"Metronidazole",t:"Metronidazole Inj. 500 mg/100 mL",h:!1,c:["antimicrobial"],y:"Ceftriaxone, Heparin, Midazolam, Meropenem, Pip/Tazo",x:"Amphotericin B"},{i:76,g:"Micafungin",t:"Micafungin Inj. 50 mg",h:!1,c:["antimicrobial"],y:"Limited data",x:"ห้ามผสมกับยาอื่น (precipitate risk)"},{i:77,g:"Midazolam",t:"Midazolam Inj. 5-15 mg",h:!0,c:["antiepileptic","analgesic","icu"],y:"Amikacin, Atracurium, Calcium gluconate, Cefazolin, Cisatracurium, Ciprofloxacin, Dobutamine, Dopamine, Esmolol, Fentanyl, Fluconazole, Gentamicin, Haloperidol, Heparin, Insulin, Ketamine, Lidocaine, Metronidazole, Morphine, Nitroglycerin, Norepinephrine, Pancuronium, Propofol, Ranitidine, Rocuronium, Vancomycin, Vecuronium",x:"Amphotericin B, NaHCO₃, Thiopental, Albumin\\nDexamethasone (variable), Furosemide (variable)\\nPhenytoin, Diazepam"},{i:78,g:"Morphine",t:"Morphine Inj. 10 mg/mL",h:!0,c:["analgesic"],y:"Amikacin, Atracurium, Cefazolin, Cisatracurium, Dobutamine, Dopamine, Esmolol, Fentanyl, Fluconazole, Heparin, Insulin, KCl, Ketamine, Lidocaine, Metoclopramide, Metronidazole, Midazolam, Milrinone, Nitroglycerin, Norepinephrine, Ondansetron, Propofol, Ranitidine, Rocuronium, Vancomycin, Vecuronium",x:"Amphotericin B, Phenytoin, Thiopental\\nDiazepam, Furosemide (variable)"},{i:79,g:"Naloxone",t:"Naloxone Inj. 0.4 mg/mL",h:!0,c:["icu"],y:"Heparin, KCl, Morphine (sequential), Propofol",x:"Alkaline solutions\\nAmphotericin B, NaHCO₃"},{i:80,g:"Neostigmine",t:"Neostigmine Inj. 2.5 mg/mL",h:!1,c:["icu"],y:"Limited data",x:"Limited data"},{i:81,g:"Nicardipine",t:"Nicardipine Inj. 10 mg/10 mL",h:!0,c:["stroke","cardiovascular","icu"],y:"Dexmedetomidine, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, Insulin, KCl, Lidocaine, Midazolam, Milrinone, Morphine, Nitroglycerin, Norepinephrine, Propofol",x:"NaHCO₃, Furosemide, Amp/Sulb, Thiopental\\nPhenytoin, Diazepam"},{i:82,g:"Nimodipine",t:"Nimodipine Inj./PO",h:!0,c:["stroke"],y:"-",x:"PVC (adsorbs!)\\nMost IV drugs (dedicated line)"},{i:83,g:"Norepinephrine (Levophed)",t:"Norepinephrine Inj. 4 mg/4 mL",h:!0,c:["icu"],y:"Amiodarone, Atracurium, Calcium chloride, Cisatracurium, Dobutamine, Dopamine, Esmolol, Fentanyl, Heparin, KCl, Labetalol, Lidocaine, Lorazepam, Midazolam, Milrinone, Morphine, Nitroglycerin, Propofol, Rocuronium, Vasopressin",x:"NaHCO₃, Amphotericin B, Thiopental\\nInsulin (variable — concentration-dependent)\\nDiazepam, Phenytoin, Furosemide (variable — conc-dependent)"},{i:84,g:"Omeprazole",t:"Omeprazole Inj. 40 mg",h:!1,c:[],y:"Limited data",x:"Midazolam (variable)"},{i:85,g:"Ondansetron",t:"Ondansetron Inj. 4/8 mg",h:!1,c:[],y:"Morphine, Fentanyl, Dexamethasone, KCl",x:"Acyclovir (variable), Amphotericin B"},{i:86,g:"Pantoprazole",t:"Pantoprazole Inj. 40 mg",h:!1,c:[],y:"Limited data",x:"Midazolam (variable), Zinc solutions"},{i:87,g:"Paracetamol (Acetaminophen) IV",t:"Paracetamol Inj. 10 mg/mL",h:!1,c:["analgesic"],y:"Limited data",x:"Diazepam, Chlorpromazine"},{i:88,g:"Parecoxib",t:"Dynastat Inj. 40 mg",h:!1,c:["analgesic"],y:"ห้ามผสมกับยาอื่น (precipitate risk)",x:"LR, opioids in same syringe"},{i:89,g:"Penicillin G (Benzylpenicillin)",t:"Penicillin G Inj. 5 MU",h:!1,c:["antimicrobial"],y:"Heparin, KCl",x:"Aminoglycosides (ห้ามผสม!)\\nAmphotericin B"},{i:90,g:"Pethidine (Meperidine)",t:"Pethidine Inj. 50 mg/mL",h:!0,c:["analgesic"],y:"Midazolam, Ondansetron",x:"Phenytoin, Thiopental, NaHCO₃"},{i:91,g:"Phenobarbital",t:"Phenobarbital Inj. 200 mg/mL",h:!0,c:["antiepileptic"],y:"Limited data",x:"Most drugs ห้ามผสม\\nAcidic solutions"},{i:92,g:"Phenylephrine",t:"Phenylephrine Inj. 500 mcg/10 mL",h:!0,c:["cardiovascular","icu"],y:"Amiodarone, Cisatracurium, Dexmedetomidine, Fentanyl, Heparin, KCl, Lidocaine, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Propofol, Remifentanil",x:"Alkaline solutions, Thiopental\\nNaHCO₃, Diazepam"},{i:93,g:"Phenytoin",t:"Dilantin Inj. 250 mg/5 mL",h:!0,c:["antiepileptic"],y:"-",x:"D5W (ตกตะกอน!)\\nMost drugs (แยก line)\\nLipid, TPN"},{i:94,g:"Phytomenadione (Vitamin K1)",t:"Vitamin K1 Inj. 10 mg/mL",h:!0,c:["icu"],y:"Heparin, Midazolam",x:"Phenytoin, Dobutamine"},{i:95,g:"Piperacillin/Tazobactam",t:"Tazocin Inj. 4.5 g",h:!1,c:["antimicrobial"],y:"Aminophylline, Cimetidine, Dexamethasone, Dopamine, Esmolol, Fentanyl, Fluconazole, Furosemide, Heparin, Insulin, KCl, Lidocaine, Lorazepam, Metronidazole, Midazolam, Morphine, Norepinephrine, Ondansetron, Ranitidine, Remifentanil",x:"Vancomycin (conc-dependent: compatible ≤5 mg/mL Vanco + 33.75 mg/mL Pip/Tazo in NSS)\\nAmikacin, Gentamicin (แยก line!)\\nAcyclovir, Amphotericin B"},{i:96,g:"Potassium chloride (KCl)",t:"KCl Inj. 1.5 g/10 mL (20 mEq/10 mL)",h:!0,c:["icu"],y:"Amiodarone, Aminophylline, Calcium gluconate, Cimetidine, Dobutamine, Dopamine, Esmolol, Fentanyl, Fluconazole, Furosemide, Heparin, Hydrocortisone, Insulin, Lidocaine, Meropenem, Midazolam, Milrinone, Morphine, Nitroglycerin, Norepinephrine, Ondansetron, Pip/Tazo, Propofol, Ranitidine",x:"Amphotericin B, Diazepam\\nPhenytoin, Methylprednisolone (concentrated)\\nMannitol (ห้าม add)"},{i:97,g:"Propofol",t:"Propofol Inj. 200 mg/20 mL",h:!0,c:["icu","analgesic"],y:"Alfentanil, Atracurium, Cisatracurium, Dexmedetomidine, Dobutamine, Dopamine, Esmolol, Fentanyl, Furosemide, Heparin, Insulin, Ketamine, KCl, Lidocaine, Lorazepam, Midazolam, Morphine, Norepinephrine, Rocuronium, Sufentanil, Vecuronium",x:"Blood products, Amphotericin B\\nCiprofloxacin, Doxorubicin, Gentamicin (variable)\\nMethylprednisolone, Methotrexate, Phenytoin\\nTobramycin, Diazepam, Thiopental, Vancomycin"},{i:98,g:"Protamine sulfate",t:"Protamine sulfate Inj. 50 mg/5 mL",h:!0,c:["icu"],y:"Limited data",x:"Cephalosporins, Penicillins"},{i:99,g:"Remdesivir",t:"Remdesivir Inj. 100 mg",h:!1,c:["antimicrobial"],y:"Limited data → dedicated line preferred",x:"ข้อมูลจำกัด"},{i:100,g:"Remifentanil",t:"Remifentanil Inj. 2 mg",h:!0,c:["icu","analgesic"],y:"Midazolam, Propofol",x:"Blood products\\nAlkaline solutions"},{i:101,g:"Rituximab",t:"MabThera/Rituximab Inj.",h:!0,c:["immunotherapy"],y:"Limited data",x:"ห้ามผสมกับยาอื่น"},{i:102,g:"Rocuronium",t:"Esmeron Inj. 50 mg/5 mL",h:!0,c:["icu"],y:"Alfentanil, Cefazolin, Dexmedetomidine, Dobutamine, Dopamine, Epinephrine, Esmolol, Fentanyl, Heparin, Hydrocortisone, Isoproterenol, KCl, Lidocaine, Lorazepam, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Propofol, Ranitidine, Sufentanil, Vancomycin",x:"Amphotericin B, Diazepam, Thiopental\\nKetorolac, Dexamethasone (variable)"},{i:103,g:"Sodium bicarbonate",t:"NaHCO₃ Inj. 7.5% 50 mL",h:!1,c:["icu"],y:"Limited compatibility",x:"Calcium salts (ตกตะกอน!)\\nCatecholamines (inactivation)\\nMost drugs → แยก line!"},{i:104,g:"Sodium Valproate",t:"Depakine Inj. 400 mg/4 mL",h:!0,c:["antiepileptic"],y:"Ceftazidime, Ceftriaxone, Heparin, KCl, Vancomycin",x:"⚠️ Meropenem/Carbapenem ทุกตัว! (ลด VPA level 60-100%)\\nPhenobarbital, Phenytoin (interaction)\\nDiazepam"},{i:105,g:"Streptomycin",t:"Streptomycin Inj. 1 g",h:!1,c:["antimicrobial"],y:"Limited data",x:"Beta-lactams"},{i:106,g:"Succinylcholine",t:"Suxamethonium Inj. 500 mg",h:!0,c:["icu"],y:"Limited data",x:"Alkaline solutions\\nThiopental (same syringe)"},{i:107,g:"Sugammadex",t:"Bridion Inj. 200 mg/2 mL",h:!1,c:["icu"],y:"-",x:"-"},{i:108,g:"Sulbactam (standalone)",t:"Sulbactam Inj. 2 g",h:!1,c:["antimicrobial"],y:"Limited data",x:"Aminoglycosides"},{i:109,g:"Tenecteplase",t:"Metalyse Inj.",h:!0,c:["stroke"],y:"Flush NSS ก่อน-หลัง",x:"D5W, Most drugs (dedicated line)"},{i:110,g:"Tetracosactide (ACTH)",t:"Synacthen Inj. 0.25 mg",h:!0,c:["antiepileptic"],y:"Limited data",x:"Limited data"},{i:111,g:"Thiopental",t:"Thiopental Inj. 500 mg / 1 g",h:!0,c:["icu","antiepileptic"],y:"Limited data",x:"Most drugs! (alkaline → precipitates กับ acidic drugs)\\nSuccinylcholine, Atracurium, Vecuronium (same syringe)"},{i:112,g:"Tigecycline",t:"Tygacil Inj. 50 mg",h:!1,c:["antimicrobial"],y:"Limited data",x:"Amphotericin B"},{i:113,g:"Tocilizumab",t:"Actemra Inj.",h:!1,c:["immunotherapy"],y:"-",x:"ห้ามผสมกับยาอื่น"},{i:114,g:"Tramadol",t:"Tramadol Inj. 50 mg/mL",h:!1,c:["analgesic"],y:"Midazolam, Ondansetron",x:"Diazepam, NSAIDs (same syringe)"},{i:115,g:"Tranexamic acid",t:"Transamin Inj.",h:!1,c:["stroke","icu"],y:"Heparin, KCl, Ranitidine",x:"Blood products (theoretical concern)\\nLimited published compatibility data"},{i:116,g:"Vancomycin",t:"Vancomycin Inj. 500 mg / 1 g",h:!1,c:["antimicrobial"],y:"Acyclovir, Amikacin (dilute separately), Atracurium, Cisatracurium, Dexmedetomidine, Diltiazem, Dopamine, Esmolol, Fentanyl, Heparin (variable), Insulin, KCl, Levofloxacin, Lidocaine, Lorazepam, Meropenem, Midazolam, Morphine, Nitroglycerin, Ondansetron, Propofol, Rocuronium, TMP/SMX",x:"Pip/Tazo (conc-dependent: compatible ≤5 mg/mL Vanco in NSS)\\nCeftazidime, Ceftriaxone (variable)\\nAmphotericin B, Albumin\\nPhenobarbital, Phenytoin, Thiopental"},{i:117,g:"Voriconazole",t:"Voriconazole Inj. 200 mg",h:!1,c:["antimicrobial"],y:"Limited data → dedicated line preferred",x:"Blood products, TPN\\n4.2% NaHCO₃"},{i:118,g:"Cefepime",t:"Maxipime Inj. 1 g / 2 g",h:!1,c:["antimicrobial","icu"],y:"Aminoglycosides, Heparin, Metronidazole, Morphine, Ondansetron",x:"Amphotericin B, Diazepam, Vancomycin (same line)"},{i:119,g:"Cefotaxime",t:"Claforan Inj. 1 g",h:!1,c:["antimicrobial","pediatric"],y:"Acyclovir, Dopamine, Heparin, Metronidazole, Midazolam, Morphine, Pip/Tazo",x:"Aminoglycosides (แยก line), NaHCO₃, Vancomycin\\nFluconazole (variable)"},{i:120,g:"Azithromycin IV",t:"Zithromax IV Inj. 500 mg",h:!1,c:["antimicrobial"],y:"Limited data → แยก line preferred",x:"Alkaline solutions"},{i:121,g:"Daptomycin",t:"Cubicin Inj. 350 mg / 500 mg",h:!1,c:["antimicrobial"],y:"Limited data → dedicated line preferred",x:"ห้ามผสมกับ dextrose-containing solutions\\nHeparin (incompatible)"},{i:122,g:"Caspofungin",t:"Cancidas Inj. 50 mg / 70 mg",h:!1,c:["antimicrobial"],y:"Limited data",x:"ห้ามผสม Dextrose ในขั้นตอน reconstitute\\nDiazepam"},{i:123,g:"Anidulafungin",t:"Eraxis Inj. 100 mg",h:!1,c:["antimicrobial"],y:"Limited data → dedicated line",x:"ห้ามผสมกับยาอื่นใน line เดียวกัน"},{i:124,g:"Liposomal Amphotericin B",t:"AmBisome Inj. 50 mg",h:!1,c:["antimicrobial"],y:"Limited — dedicated line preferred\\nFlush D5W ก่อน/หลัง",x:"ห้ามผสม NSS (ตกตะกอน)\\nห้ามใช้ filter <1μm\\nConventional AmB (ห้ามสับสน!)"},{i:125,g:"Teicoplanin",t:"Targocid Inj. 200 mg / 400 mg",h:!1,c:["antimicrobial"],y:"Heparin, KCl, Midazolam, Morphine",x:"Aminoglycosides (แยก syringe), Heparin (variable at high conc)"},{i:126,g:"Polymyxin B",t:"Polymyxin B Inj. 500,000 units",h:!1,c:["antimicrobial","icu"],y:"Limited data → dedicated line preferred",x:"Neuromuscular blocking agents (additive)\\nNephrotoxic drugs"},{i:127,g:"Cisplatin",t:"Cisplatin Inj. 50 mg/50 mL",h:!0,c:["oncology","had"],y:"Ondansetron, Dexamethasone, Mannitol, KCl",x:"ห้าม aluminum-containing sets\\nNaHCO₃"},{i:128,g:"Carboplatin",t:"Carboplatin Inj. 150 mg / 450 mg",h:!0,c:["oncology","had"],y:"Ondansetron, Dexamethasone",x:"ห้าม aluminum-containing sets\\nNaHCO₃"},{i:129,g:"Paclitaxel",t:"Taxol Inj. 30 mg/5 mL",h:!0,c:["oncology","had"],y:"Carboplatin, Cisplatin (ให้ paclitaxel ก่อน)",x:"PVC containers/tubing (DEHP leaching)\\nDoxorubicin"},{i:130,g:"Docetaxel",t:"Taxotere Inj. 20 mg / 80 mg",h:!0,c:["oncology","had"],y:"Limited data → dedicated line",x:"Alkaline solutions"},{i:131,g:"Doxorubicin",t:"Adriamycin Inj. 10 mg / 50 mg",h:!0,c:["oncology","had"],y:"Ondansetron, Dexamethasone, Cyclophosphamide",x:"Heparin, 5-FU (ห้าม mix)\\nAlkaline solutions (pH >7)"},{i:132,g:"5-Fluorouracil (5-FU)",t:"5-FU Inj. 500 mg / 1000 mg",h:!0,c:["oncology","had"],y:"Leucovorin (synergistic), Ondansetron",x:"Methotrexate (ห้าม mix)"},{i:133,g:"Gemcitabine",t:"Gemzar Inj. 200 mg / 1 g",h:!1,c:["oncology"],y:"Ondansetron, Dexamethasone",x:"Amphotericin B, Furosemide"},{i:134,g:"Etoposide (VP-16)",t:"Etoposide Inj. 100 mg/5 mL",h:!0,c:["oncology","had"],y:"Carboplatin, Cisplatin, Ondansetron",x:"Cefepime, Filgrastim"},{i:135,g:"Oxaliplatin",t:"Eloxatin Inj. 50 mg / 100 mg",h:!0,c:["oncology","had"],y:"Leucovorin (in D5W)",x:"⚠ ห้าม NSS / chloride\\nห้าม alkaline\\nห้าม aluminum"},{i:136,g:"Vincristine",t:"Vincristine Inj. 1 mg/mL",h:!0,c:["oncology","had"],y:"Limited data",x:"ห้ามผสมกับยาอื่น"},{i:137,g:"Methotrexate IV (high-dose)",t:"Methotrexate Inj. 500 mg / 1 g",h:!0,c:["oncology","had"],y:"Leucovorin (rescue, แยก line)",x:"PPIs (↑ MTX levels)\\nNSAIDs, Penicillins"},{i:138,g:"Irinotecan",t:"Campto Inj. 40 mg / 100 mg",h:!1,c:["oncology"],y:"Leucovorin, 5-FU (sequence)",x:"Limited data"},{i:139,g:"Ifosfamide",t:"Ifosfamide Inj. 1 g / 2 g",h:!0,c:["oncology","had"],y:"Mesna (MUST co-administer)",x:"Limited data"},{i:140,g:"Bevacizumab",t:"Avastin Inj. 100 mg / 400 mg",h:!1,c:["oncology","biologics"],y:"Limited → dedicated line",x:"ห้าม Dextrose solutions"},{i:141,g:"Trastuzumab",t:"Herceptin Inj. 440 mg",h:!1,c:["oncology","biologics"],y:"Limited → dedicated line",x:"ห้าม D5W\\nAnthracyclines (ห้ามพร้อมกัน)"},{i:142,g:"Calcium chloride 10%",t:"Calcium chloride 10% Inj.",h:!0,c:["emergency","icu","electrolytes"],y:"Dobutamine, Dopamine, Norepinephrine",x:"NaHCO₃ (ตกตะกอน!)\\nPhosphate solutions\\nCeftriaxone"},{i:143,g:"3% NaCl (Hypertonic saline)",t:"3% NaCl Inj. 500 mL",h:!0,c:["emergency","icu","neuro"],y:"ห้ามผสมกับยาอื่น",x:"ห้ามผสมกับยาอื่น → dedicated line"},{i:144,g:"20% Mannitol",t:"Mannitol 20% Inj. 250 mL / 500 mL",h:!0,c:["icu","neuro","emergency"],y:"ห้ามผสมกับยาอื่น",x:"Blood products\\nKCl (ห้าม add)"},{i:145,g:"Albumin 20%",t:"Albumin 20% Inj. 50 mL / 100 mL",h:!1,c:["icu","hepatology"],y:"Compatible NSS, D5W",x:"ห้ามผสม alcohol solutions\\nห้ามผสม amino acid solutions"},{i:146,g:"Potassium phosphate",t:"Potassium phosphate Inj.",h:!0,c:["icu","electrolytes"],y:"Compatible common IV fluids",x:"Calcium solutions (ตกตะกอน!)\\nNaHCO₃"},{i:147,g:"Diltiazem IV",t:"Herbesser Inj. 10 mg / 50 mg",h:!1,c:["cardiology","icu","emergency"],y:"Heparin, insulin, KCl",x:"Amphotericin B, Diazepam, Furosemide, Phenytoin, NaHCO₃"},{i:148,g:"Milrinone",t:"Milrinone Inj. 10 mg/10 mL",h:!1,c:["cardiology","icu"],y:"Amiodarone, Atracurium, Calcium chloride, Cisatracurium, Dexmedetomidine, Dobutamine, Dopamine, Epinephrine, Fentanyl, Heparin, Insulin, KCl, Lidocaine, Midazolam, Morphine, Nitroglycerin, Norepinephrine, Propofol, Rocuronium, Vasopressin, Vecuronium",x:"Furosemide (precipitates!), NaHCO₃\\nDiazepam, Thiopental, Procainamide"},{i:149,g:"Isoproterenol",t:"Isoproterenol Inj. 1 mg/5 mL",h:!1,c:["cardiology","icu","emergency"],y:"Limited → dedicated line",x:"NaHCO₃, Aminophylline"},{i:150,g:"Hydralazine IV",t:"Hydralazine Inj. 20 mg/mL",h:!1,c:["cardiology","emergency","obstetrics"],y:"Limited data",x:"Diazoxide"},{i:151,g:"Sodium nitroprusside",t:"Nipride Inj. 50 mg",h:!0,c:["cardiology","icu","emergency","had"],y:"ห้ามผสมกับยาอื่น → dedicated line",x:"Alkaline solutions"},{i:152,g:"N-Acetylcysteine IV (NAC)",t:"Acetylcysteine Inj. 200 mg/mL",h:!1,c:["antidote","emergency"],y:"Compatible D5W, NSS",x:"ห้ามผสมกับยาอื่นใน bag"},{i:153,g:"Flumazenil",t:"Anexate Inj. 0.5 mg/5 mL",h:!1,c:["antidote","emergency"],y:"Limited data",x:"ห้ามผสมกับยาอื่นใน syringe"},{i:154,g:"Lipid emulsion 20% (ILE)",t:"Intralipid 20%",h:!0,c:["antidote","emergency"],y:"ห้ามผสมกับยาอื่น → dedicated line",x:"ห้ามผสมกับยาอื่น"},{i:155,g:"Glucagon",t:"GlucaGen Inj. 1 mg",h:!1,c:["antidote","emergency"],y:"Limited data",x:"Insulin solutions"},{i:156,g:"Deferoxamine",t:"Desferal Inj. 500 mg / 2 g",h:!1,c:["antidote"],y:"Limited data",x:"Ascorbic acid >500 mg/d (cardiac risk)"},{i:157,g:"Sodium thiosulfate",t:"Sodium thiosulfate 25% Inj.",h:!1,c:["antidote"],y:"Limited data",x:"Limited data"},{i:158,g:"Digoxin-specific antibody (DigiFab)",t:"DigiFab Inj. 40 mg",h:!1,c:["antidote"],y:"ห้ามผสมกับยาอื่น",x:"ห้ามผสมกับยาอื่น"},{i:159,g:"Oxytocin",t:"Syntocinon Inj. 5 IU/mL",h:!0,c:["obstetrics","had"],y:"RL, NSS",x:"ห้ามผสมกับยาอื่นใน bag"},{i:160,g:"Carbetocin",t:"Pabal/Duratocin Inj. 100 mcg/mL",h:!1,c:["obstetrics"],y:"ไม่จำเป็นต้องผสม",x:"ห้ามผสมกับ Oxytocin"},{i:161,g:"Terbutaline IV",t:"Bricanyl Inj. 0.5 mg/mL",h:!1,c:["obstetrics","pulmonology"],y:"Compatible NSS, D5W",x:"ห้ามผสมกับ beta-blockers"},{i:162,g:"Natalizumab",t:"Tysabri Inj. 300 mg/15 mL",h:!1,c:["neurology","biologics"],y:"ห้ามผสมกับยาอื่น → dedicated line",x:"ห้ามผสมกับยาอื่น"},{i:163,g:"Eculizumab",t:"Soliris Inj. 300 mg/30 mL",h:!1,c:["neurology","hematology","biologics"],y:"ห้ามผสมกับยาอื่น",x:"ห้ามผสมกับยาอื่น → dedicated line"},{i:164,g:"Plasma Exchange (TPE)",t:"Albumin 5% + NSS / FFP (replacement)",h:!1,c:["neurology","icu"],y:"N/A (separate circuit)",x:""},{i:165,g:"Adalimumab",t:"Humira Inj. 40 mg (prefilled)",h:!1,c:["biologics","rheumatology","gi"],y:"N/A (SC)",x:"ห้าม mix กับยาอื่น"},{i:166,g:"Omalizumab",t:"Xolair Inj. 150 mg",h:!1,c:["biologics","pulmonology","dermatology"],y:"N/A (SC)",x:"ห้าม mix กับยาอื่น"},{i:167,g:"Pembrolizumab",t:"Keytruda Inj. 100 mg/4 mL",h:!1,c:["oncology","biologics","had"],y:"ห้ามผสมกับยาอื่น → dedicated line + filter",x:"ห้ามผสมกับยาอื่น"}];

// Build cross-reference map
const drugMap = {};
DRUGS.forEach(d => {
  drugMap[d.g.toLowerCase()] = d;
  // Also map common short names
  const short = d.g.split(' ')[0].toLowerCase();
  if (!drugMap[short]) drugMap[short] = d;
});

// ===== CURATED Y-SITE COMPATIBILITY DATABASE =====
// Source: Trissel's Handbook on Injectable Drugs, 21st Ed. + Lexicomp IV Compatibility
// c=compatible, i=incompatible, v=variable/conflicting data
const CURATED=[
['Norepinephrine','Dobutamine','c'],['Norepinephrine','Dopamine','c'],['Norepinephrine','Adrenaline','c'],
['Norepinephrine','Midazolam','c'],['Norepinephrine','Fentanyl','c'],['Norepinephrine','Morphine','c'],
['Norepinephrine','Heparin','c'],['Norepinephrine','Human Insulin','c'],['Norepinephrine','Potassium','c'],
['Norepinephrine','Furosemide','i'],['Norepinephrine','Pantoprazole','i'],['Norepinephrine','Sodium bicarbonate','i'],
['Norepinephrine','Phenytoin','i'],['Norepinephrine','Diazepam','i'],['Norepinephrine','Nicardipine','c'],
['Norepinephrine','Dexmedetomidine','c'],['Norepinephrine','Propofol','c'],['Norepinephrine','Amiodarone','c'],
['Norepinephrine','Vancomycin','c'],['Norepinephrine','Meropenem','c'],['Norepinephrine','Labetalol','c'],
['Dopamine','Dobutamine','c'],['Dopamine','Adrenaline','c'],['Dopamine','Midazolam','c'],
['Dopamine','Fentanyl','c'],['Dopamine','Heparin','c'],['Dopamine','Morphine','c'],
['Dopamine','Sodium bicarbonate','i'],['Dopamine','Furosemide','v'],['Dopamine','Human Insulin','v'],
['Dopamine','Phenytoin','i'],['Dopamine','Acyclovir','i'],['Dopamine','Nicardipine','c'],
['Dobutamine','Adrenaline','c'],['Dobutamine','Midazolam','c'],['Dobutamine','Fentanyl','c'],
['Dobutamine','Heparin','c'],['Dobutamine','Human Insulin','v'],['Dobutamine','Furosemide','i'],
['Dobutamine','Sodium bicarbonate','i'],['Dobutamine','Phenytoin','i'],['Dobutamine','Diazepam','i'],
['Dobutamine','Acyclovir','i'],['Dobutamine','Nicardipine','c'],['Dobutamine','Potassium','c'],
['Amiodarone','Midazolam','c'],['Amiodarone','Fentanyl','c'],['Amiodarone','Morphine','c'],
['Amiodarone','Dobutamine','c'],['Amiodarone','Dopamine','c'],['Amiodarone','Furosemide','i'],
['Amiodarone','Heparin','i'],['Amiodarone','Sodium bicarbonate','i'],['Amiodarone','Phenytoin','i'],
['Amiodarone','Potassium','c'],['Amiodarone','Human Insulin','c'],['Amiodarone','Dexmedetomidine','c'],
['Midazolam','Fentanyl','c'],['Midazolam','Morphine','c'],['Midazolam','Heparin','c'],
['Midazolam','Human Insulin','c'],['Midazolam','Potassium','c'],['Midazolam','Furosemide','v'],
['Midazolam','Sodium bicarbonate','i'],['Midazolam','Dexamethasone','c'],['Midazolam','Ondansetron','c'],
['Midazolam','Omeprazole','v'],['Midazolam','Propofol','c'],['Midazolam','Vancomycin','c'],
['Midazolam','Meropenem','c'],['Midazolam','Nicardipine','c'],['Midazolam','Labetalol','c'],
['Propofol','Fentanyl','c'],['Propofol','Morphine','c'],['Propofol','Potassium','c'],
['Propofol','Heparin','c'],['Propofol','Phenytoin','i'],['Propofol','Vancomycin','i'],
['Propofol','Meropenem','c'],['Propofol','Ketamine','c'],['Propofol','Dexmedetomidine','c'],
['Heparin','Human Insulin','c'],['Heparin','Potassium','c'],['Heparin','Morphine','c'],
['Heparin','Fentanyl','c'],['Heparin','Furosemide','c'],['Heparin','Dexamethasone','c'],
['Heparin','Pantoprazole','c'],['Heparin','Vancomycin','i'],['Heparin','Gentamicin','v'],
['Heparin','Ciprofloxacin','i'],['Heparin','Diazepam','i'],['Heparin','Phenytoin','i'],
['Heparin','Nicardipine','c'],['Heparin','Labetalol','c'],['Heparin','Meropenem','c'],
['Human Insulin','Potassium','c'],['Human Insulin','Sodium bicarbonate','i'],['Human Insulin','Phenytoin','i'],
['Furosemide','Morphine','c'],['Furosemide','Potassium','c'],['Furosemide','Dexamethasone','c'],
['Furosemide','Vancomycin','i'],['Furosemide','Ciprofloxacin','i'],['Furosemide','Ondansetron','i'],
['Furosemide','Nicardipine','i'],['Furosemide','Labetalol','i'],['Furosemide','Amiodarone','i'],
['Phenytoin','Fentanyl','i'],['Phenytoin','Morphine','i'],['Phenytoin','Vancomycin','i'],
['Phenytoin','Meropenem','i'],['Phenytoin','Potassium','i'],['Phenytoin','Dexamethasone','i'],
['Phenytoin','Dexmedetomidine','i'],['Phenytoin','Propofol','i'],['Phenytoin','Midazolam','i'],
['Vancomycin','Meropenem','c'],['Vancomycin','Midazolam','c'],['Vancomycin','Morphine','c'],
['Vancomycin','Fentanyl','c'],['Vancomycin','Potassium','c'],['Vancomycin','Ceftriaxone','i'],
['Vancomycin','Ceftazidime','i'],['Vancomycin','Piperacillin','i'],['Vancomycin','Dexamethasone','v'],
['Dexmedetomidine','Fentanyl','c'],['Dexmedetomidine','Midazolam','c'],['Dexmedetomidine','Morphine','c'],
['Dexmedetomidine','Amphotericin','i'],['Dexmedetomidine','Diazepam','i'],
['Nicardipine','Fentanyl','c'],['Nicardipine','Sodium bicarbonate','i'],['Nicardipine','Phenytoin','i'],
['Labetalol','Fentanyl','c'],['Labetalol','Morphine','c'],['Labetalol','Heparin','c'],
['Labetalol','Sodium bicarbonate','i'],['Labetalol','Potassium','c'],
['Meropenem','Fentanyl','c'],['Meropenem','Morphine','c'],['Meropenem','Dexamethasone','c'],
['Meropenem','Ondansetron','v'],['Meropenem','Potassium','c'],['Meropenem','Acyclovir','i'],['Meropenem','Diazepam','i'],
['Magnesium','Heparin','c'],['Magnesium','Human Insulin','c'],['Magnesium','Potassium','c'],
['Magnesium','Midazolam','c'],['Magnesium','Amphotericin','i'],['Magnesium','Sodium bicarbonate','i'],
['Magnesium','Calcium','i'],
['Ondansetron','Morphine','c'],['Ondansetron','Fentanyl','c'],['Ondansetron','Dexamethasone','c'],
['Ondansetron','Potassium','c'],['Ondansetron','Sodium bicarbonate','i'],
['Ketamine','Midazolam','c'],['Ketamine','Fentanyl','c'],['Ketamine','Morphine','c'],
['Ketamine','Diazepam','i'],['Ketamine','Sodium bicarbonate','i'],['Ketamine','Phenobarbital','i'],
['Calcium','Sodium bicarbonate','i'],['Calcium','Potassium','c'],
['Levetiracetam','Diazepam','v'],['Levetiracetam','Sodium Valproate','c'],
// Valproic+Meropenem: PK interaction (↓VPA 60-90%), NOT physical Y-site incompatibility — removed from compat matrix
['Methylprednisolone','Heparin','c'],['Methylprednisolone','Ondansetron','c'],
['Hydrocortisone','Heparin','c'],['Hydrocortisone','Midazolam','i'],
['Cisatracurium','Midazolam','c'],['Cisatracurium','Fentanyl','c'],['Cisatracurium','Morphine','c'],
['Cisatracurium','Propofol','c'],['Cisatracurium','Sodium bicarbonate','i'],
// New drugs: Oncology, Emergency, Cardiology
['Cisplatin','Ondansetron','c'],['Cisplatin','Dexamethasone','c'],['Cisplatin','Mannitol','c'],
['Cisplatin','Potassium','c'],['Cisplatin','Sodium bicarbonate','i'],
['Carboplatin','Ondansetron','c'],['Carboplatin','Dexamethasone','c'],['Carboplatin','Sodium bicarbonate','i'],
['Paclitaxel','Carboplatin','c'],['Paclitaxel','Cisplatin','c'],['Paclitaxel','Doxorubicin','i'],
['Doxorubicin','Ondansetron','c'],['Doxorubicin','Dexamethasone','c'],['Doxorubicin','Cyclophosphamide','c'],
['Doxorubicin','Heparin','i'],['Doxorubicin','5-Fluorouracil','i'],
['5-Fluorouracil','Ondansetron','c'],['5-Fluorouracil','Leucovorin','c'],['5-Fluorouracil','Methotrexate','i'],
['Gemcitabine','Ondansetron','c'],['Gemcitabine','Dexamethasone','c'],['Gemcitabine','Amphotericin','i'],['Gemcitabine','Furosemide','i'],
['Etoposide','Carboplatin','c'],['Etoposide','Cisplatin','c'],['Etoposide','Ondansetron','c'],['Etoposide','Cefepime','i'],
['Oxaliplatin','Leucovorin','c'],['Oxaliplatin','Sodium bicarbonate','i'],
['Cefepime','Midazolam','c'],['Cefepime','Fentanyl','c'],['Cefepime','Heparin','c'],
['Cefepime','Morphine','c'],['Cefepime','Vancomycin','i'],['Cefepime','Metronidazole','c'],
['Cefepime','Amphotericin','i'],
['Calcium chloride','Dobutamine','c'],['Calcium chloride','Dopamine','c'],['Calcium chloride','Norepinephrine','c'],
['Calcium chloride','Sodium bicarbonate','i'],['Calcium chloride','Ceftriaxone','i'],
['Diltiazem','Heparin','c'],['Diltiazem','Human Insulin','c'],['Diltiazem','Potassium','c'],
['Diltiazem','Amphotericin','i'],['Diltiazem','Furosemide','i'],['Diltiazem','Phenytoin','i'],['Diltiazem','Diazepam','i'],
['Milrinone','Heparin','c'],['Milrinone','Potassium','c'],['Milrinone','Morphine','c'],['Milrinone','Human Insulin','c'],
['Milrinone','Furosemide','i'],['Milrinone','Sodium bicarbonate','i'],
['Daptomycin','Dexamethasone','c'],['Daptomycin','Heparin','c'],
['Daptomycin','RL','i'],['Daptomycin','Sodium bicarbonate','i'],
['Caspofungin','Dexamethasone','c'],['Caspofungin','Meropenem','c'],
['Caspofungin','D5W','i'],['Caspofungin','Sodium bicarbonate','i'],
['Norepinephrine','Calcium chloride','c'],['Norepinephrine','Milrinone','c'],['Norepinephrine','Diltiazem','c'],
['Norepinephrine','Cefepime','c'],
['Dopamine','Calcium chloride','c'],['Dopamine','Milrinone','c'],['Dopamine','Diltiazem','c'],
['Heparin','Cefepime','c'],['Heparin','Diltiazem','c'],['Heparin','Milrinone','c'],
['Midazolam','Cefepime','c'],['Midazolam','Diltiazem','c'],
// Audit additions: critical missing pairs
['Phenytoin','D5W','i'],['Ceftriaxone','Calcium gluconate','i'],['Ceftriaxone','Calcium chloride','i'],
['Pantoprazole','Midazolam','v'],['Amphotericin B','NSS','i'],['20% Mannitol','Potassium chloride','i'],
];

// Build fast lookup: key = sorted pair of first-word-lowercase → status
const CURATED_MAP = {};
CURATED.forEach(([a, b, s]) => {
  const key = [normKey(a), normKey(b)].sort().join('|');
  CURATED_MAP[key] = s;
});

// ===== DYNAMIC COMPAT DATA — fetch from Google Sheets =====
const COMPAT_LS_KEY = 'ivdrug_compatPairsCache';
const COMPAT_LS_TS = 'ivdrug_compatPairsCacheTs';
const COMPAT_CACHE_TTL = 30 * 60 * 1000; // 30 min

function rebuildCuratedMap(pairs) {
  // pairs = [[drugA, drugB, result], ...]
  Object.keys(CURATED_MAP).forEach(k => delete CURATED_MAP[k]);
  pairs.forEach(([a, b, s]) => {
    const key = [normKey(a), normKey(b)].sort().join('|');
    CURATED_MAP[key] = s;
  });
}

function loadCompatPairsFromSheet() {
  // Check cache first
  try {
    const cached = localStorage.getItem(COMPAT_LS_KEY);
    const cachedTs = parseInt(localStorage.getItem(COMPAT_LS_TS) || '0');
    if (cached && (Date.now() - cachedTs) < COMPAT_CACHE_TTL) {
      const pairs = JSON.parse(cached);
      if (pairs.length > 0) {
        rebuildCuratedMap(pairs);
        console.log('[Compat] Loaded ' + pairs.length + ' pairs from cache');
      }
    }
  } catch (e) { /* ignore cache errors */ }

  // Fetch fresh data from admin GAS (where CompatPairs sheet lives)
  var gasUrl = (typeof IVDrugRef !== 'undefined' && IVDrugRef.getAdminGasUrl)
    ? IVDrugRef.getAdminGasUrl() : '';
  if (!gasUrl) return;

  fetch(gasUrl + '?action=compatpairs')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var pairs = data.pairs;
      if (Array.isArray(pairs) && pairs.length > 0) {
        rebuildCuratedMap(pairs);
        localStorage.setItem(COMPAT_LS_KEY, JSON.stringify(pairs));
        localStorage.setItem(COMPAT_LS_TS, String(Date.now()));
        console.log('[Compat] Synced ' + pairs.length + ' pairs from sheet');
      }
    })
    .catch(function() { /* silent — CURATED fallback is already loaded */ });
}

// Enhanced drug matching
function normKey(generic) {
  // Find first word that contains letters (skip "20%", "5%", etc.)
  const words = generic.toLowerCase().split(/[\s,()\/]+/);
  for (const w of words) {
    const cleaned = w.replace(/[^a-z]/g, '');
    if (cleaned.length > 0) return cleaned;
  }
  return generic.toLowerCase().replace(/[^a-z]/g, '');
}

function parseNames(text) {
  if (!text || text === '-' || text === 'N/A (IM injection)') return [];
  return text.split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && !s.startsWith('Limited') && !s.startsWith('Compatible') && !s.startsWith('Dedicated') && !s.startsWith('ห้าม') && !s.startsWith('แยก') && !s.startsWith('PVC') && !s.startsWith('Most'));
}

function findDrugMatch(name) {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.length < 3) return null;
  for (const d of DRUGS) {
    const dLower = d.g.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (dLower === lower || dLower.startsWith(lower) || lower.startsWith(dLower)) return d;
    const dFirst = d.g.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
    const nFirst = name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
    if (dFirst === nFirst && dFirst.length > 3) return d;
  }
  return null;
}

function getCompatibility(drugA, drugB) {
  if (drugA.i === drugB.i) return { status: 'self', detail: '', source: '' };
  
  const ka = normKey(drugA.g);
  const kb = normKey(drugB.g);
  const curatedKey = [ka, kb].sort().join('|');
  
  // 1) Check curated database first (highest confidence)
  if (CURATED_MAP[curatedKey]) {
    const s = CURATED_MAP[curatedKey];
    const status = s === 'c' ? 'compatible' : s === 'i' ? 'incompatible' : 'variable';
    return { status, detail: `${drugA.g} + ${drugB.g}`, source: 'curated' };
  }
  
  // 2) Check drug-specific compat fields (text-based cross-reference)
  const aYnames = parseNames(drugA.y);
  const aXnames = parseNames(drugA.x);
  const bYnames = parseNames(drugB.y);
  const bXnames = parseNames(drugB.x);
  
  const bInAcompat = aYnames.some(n => findDrugMatch(n)?.i === drugB.i);
  const aInBcompat = bYnames.some(n => findDrugMatch(n)?.i === drugA.i);
  const bInAincompat = aXnames.some(n => findDrugMatch(n)?.i === drugB.i);
  const aInBincompat = bXnames.some(n => findDrugMatch(n)?.i === drugA.i);
  
  if (bInAincompat || aInBincompat) {
    let detail = '';
    if (bInAincompat) detail += drugA.g + ': ' + drugA.x;
    if (aInBincompat) detail += (detail ? '\n\n' : '') + drugB.g + ': ' + drugB.x;
    return { status: 'incompatible', detail, source: 'drugfield' };
  }
  
  if (bInAcompat || aInBcompat) {
    let detail = '';
    if (bInAcompat) detail += drugA.g + ': ' + drugA.y;
    if (aInBcompat) detail += (detail ? '\n\n' : '') + drugB.g + ': ' + drugB.y;
    return { status: 'compatible', detail, source: 'drugfield' };
  }
  
  // 3) Check for variable hints
  const allText = (drugA.y + drugA.x + drugB.y + drugB.x).toLowerCase();
  if (allText.includes('variable')) return { status: 'variable', detail: 'Variable compatibility reported', source: 'text' };
  
  return { status: 'nodata', detail: 'ไม่มีข้อมูล compatibility โดยตรง\nตรวจสอบจาก Trissel\'s หรือ Lexicomp', source: 'none' };
}

// ===== CDS: ALTERNATIVE DRUG SUGGESTIONS =====
const GENERIC_CATS = ['icu', 'had', 'emergency', 'pediatric'];

function findAlternatives(incompatDrug, otherDrug) {
  const cats = (incompatDrug.c || []).filter(c => !GENERIC_CATS.includes(c));
  if (!cats.length) return [];
  const candidates = DRUGS.filter(d =>
    d.i !== incompatDrug.i &&
    d.i !== otherDrug.i &&
    (d.c || []).some(c => cats.includes(c))
  );
  const alts = [];
  for (const cand of candidates) {
    const r = getCompatibility(cand, otherDrug);
    if (r.status === 'compatible') {
      alts.push({ drug: cand, source: r.source });
    }
  }
  return alts
    .sort((a, b) => (a.source === 'curated' ? 0 : 1) - (b.source === 'curated' ? 0 : 1))
    .slice(0, 5);
}

function buildCdsAlternatives(drugA, drugB) {
  const altsA = findAlternatives(drugA, drugB);
  const altsB = findAlternatives(drugB, drugA);
  if (!altsA.length && !altsB.length) return '';

  const renderChips = (alts, targetSelect) => alts.map(a =>
    `<span class="cds-alt-chip" data-action="pickAlt" data-target="${targetSelect}" data-id="${a.drug.i}"` +
    ` title="${a.source === 'curated' ? '📚 Curated' : '💊 Drug field'}">${a.drug.g}</span>`
  ).join('');

  let html = '<div class="cds-alert suggest" style="margin-top:12px;">';
  html += '<div class="cds-alert-title">🔄 ทางเลือกยาที่เข้ากันได้ (Compatible Alternatives)</div>';
  html += '<div class="cds-alert-body">';
  if (altsA.length) {
    html += `<div style="margin-bottom:6px;font-weight:500;">แทน ${drugA.g}:</div>`;
    html += `<div class="cds-alt-chips">${renderChips(altsA, 'drugA')}</div>`;
  }
  if (altsB.length) {
    html += `<div style="margin-top:8px;margin-bottom:6px;font-weight:500;">แทน ${drugB.g}:</div>`;
    html += `<div class="cds-alt-chips">${renderChips(altsB, 'drugB')}</div>`;
  }
  html += '</div>';
  html += '<div class="cds-alert-ref">📚 <a href="' + (typeof IVDrugRef !== 'undefined' && IVDrugRef.REF_LINKS ? IVDrugRef.REF_LINKS.thaiFDA : '#') + '" target="_blank" rel="noopener">ค้นหายาใน Thai FDA</a></div>';
  html += '</div>';
  return html;
}

// ===== PAIR CHECKER =====
function populateSelects() {
  const sorted = [...DRUGS].sort((a, b) => a.g.localeCompare(b.g));
  ['drugA', 'drugB'].forEach(id => {
    const sel = document.getElementById(id);
    sorted.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.i;
      opt.textContent = d.g + (d.h ? ' ⚠' : '');
      sel.appendChild(opt);
    });
  });
  
  // Quick chips for ICU drugs
  const icuDrugs = DRUGS.filter(d => d.c.includes('icu') || d.c.includes('cardiovascular') || d.h);
  const chips = document.getElementById('quickChips');
  icuDrugs.sort((a,b) => a.g.localeCompare(b.g)).forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (d.h ? ' had' : '');
    btn.textContent = d.g.split(' ')[0] + (d.h ? ' ⚠' : '');
    btn.onclick = () => {
      const selA = document.getElementById('drugA');
      const selB = document.getElementById('drugB');
      if (!selA.value) { selA.value = d.i; checkPair(); }
      else if (!selB.value || selB.value === selA.value) { selB.value = d.i; checkPair(); }
      else { selA.value = selB.value; selB.value = d.i; checkPair(); }
    };
    chips.appendChild(btn);
  });
}

function checkPair() {
  const aId = parseInt(document.getElementById('drugA').value);
  const bId = parseInt(document.getElementById('drugB').value);
  const container = document.getElementById('pairResult');
  
  if (!aId || !bId) {
    container.innerHTML = '<div class="compat-result select-drugs">เลือกยา 2 ตัวเพื่อตรวจสอบ Compatibility</div>';
    return;
  }
  if (aId === bId) {
    container.innerHTML = '<div class="compat-result select-drugs">กรุณาเลือกยาคนละตัว</div>';
    return;
  }
  
  const drugA = DRUGS.find(d => d.i === aId);
  const drugB = DRUGS.find(d => d.i === bId);
  const result = getCompatibility(drugA, drugB);

  // Send analytics
  if (typeof IVDrugRef !== 'undefined' && IVDrugRef.sendAnalytics) {
    IVDrugRef.sendAnalytics({
      type: 'compat_usage',
      mode: 'pair',
      drug_a: drugA.g,
      drug_b: drugB.g,
      result_status: result.status,
      result_source: result.source,
      drugs_count: 2,
      pairs_total: 1,
      pairs_compatible: result.status === 'compatible' ? 1 : 0,
      pairs_incompatible: result.status === 'incompatible' ? 1 : 0
    });
  }

  const icons = { compatible: '✅', incompatible: '❌', variable: '⚠️', nodata: '❓' };
  const labels = { compatible: 'Y-site Compatible', incompatible: 'INCOMPATIBLE', variable: 'Variable / Caution', nodata: 'No Direct Data' };
  const srcLabels = { curated: '📚 Trissel\'s / Curated DB', drugfield: '💊 Drug-specific field', text: '📝 Text analysis', none: '—' };
  const srcBg = { curated: 'rgba(14,165,233,.08)', drugfield: 'rgba(5,150,105,.08)', text: 'rgba(217,119,6,.08)', none: 'rgba(100,116,139,.06)' };
  
  container.innerHTML = `
    <div class="compat-result ${result.status}">
      <div class="result-status">${icons[result.status]} ${labels[result.status]}</div>
      <div class="result-detail" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span>${drugA.g} + ${drugB.g}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 8px;border-radius:4px;background:${srcBg[result.source]}">${srcLabels[result.source]}</span>
      </div>
    </div>
    <div class="compat-details">
      <div class="detail-card">
        <div class="label green">✓ ${drugA.g} — Y-site Compatible</div>
        <div class="value">${drugA.y || '-'}</div>
      </div>
      <div class="detail-card">
        <div class="label red">✕ ${drugA.g} — Incompatible</div>
        <div class="value">${drugA.x || '-'}</div>
      </div>
      <div class="detail-card">
        <div class="label green">✓ ${drugB.g} — Y-site Compatible</div>
        <div class="value">${drugB.y || '-'}</div>
      </div>
      <div class="detail-card">
        <div class="label red">✕ ${drugB.g} — Incompatible</div>
        <div class="value">${drugB.x || '-'}</div>
      </div>
    </div>`;

  // CDS: Show alternative suggestions when incompatible
  if (result.status === 'incompatible') {
    container.innerHTML += buildCdsAlternatives(drugA, drugB);
  }
}

// ===== MATRIX VIEW =====
let matrixCat = 'icu';

function buildMatrixFilter() {
  const cats = [
    ['icu', '🏥 ICU/Critical'],
    ['cardiovascular', '❤️ Cardiovascular'],
    ['antimicrobial', '🦠 Antimicrobial'],
    ['antiepileptic', '⚡ Antiepileptic'],
    ['oncology', '🧬 Oncology'],
    ['emergency', '🚨 Emergency'],
    ['had', '⚠ High Alert'],
    ['all', '📋 All (167)']
  ];
  const container = document.getElementById('matrixFilter');
  cats.forEach(([val, label]) => {
    const btn = document.createElement('button');
    btn.className = 'fbtn' + (val === matrixCat ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => {
      matrixCat = val;
      container.querySelectorAll('.fbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMatrix();
    };
    container.appendChild(btn);
  });
}

function renderMatrix() {
  let drugs;
  if (matrixCat === 'all') drugs = [...DRUGS].sort((a,b) => a.g.localeCompare(b.g)).slice(0, 35);
  else if (matrixCat === 'had') drugs = DRUGS.filter(d => d.h).sort((a,b) => a.g.localeCompare(b.g)).slice(0, 30);
  else drugs = DRUGS.filter(d => d.c.includes(matrixCat)).sort((a,b) => a.g.localeCompare(b.g)).slice(0, 30);
  
  if (drugs.length < 2) {
    var ms = document.getElementById('matrixScroll'); if (ms) ms.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:20px 0;">ไม่พอสร้าง matrix</p>';
    return;
  }
  
  let html = '<table class="matrix-table"><tr><th class="corner"></th>';
  drugs.forEach(d => {
    const name = d.g.split(' ')[0].substring(0, 12);
    html += `<th class="col-header" title="${d.g}">${name}</th>`;
  });
  html += '</tr>';
  
  drugs.forEach((rowDrug, ri) => {
    const name = rowDrug.g.split(' ')[0].substring(0, 14);
    html += `<tr><td class="row-header" title="${rowDrug.g}">${name}${rowDrug.h ? ' ⚠' : ''}</td>`;
    drugs.forEach((colDrug, ci) => {
      if (ri === ci) {
        html += '<td><div class="matrix-cell self"></div></td>';
      } else {
        const result = getCompatibility(rowDrug, colDrug);
        const cls = result.status === 'compatible' ? 'c' : result.status === 'incompatible' ? 'i' : result.status === 'variable' ? 'v' : 'n';
        html += `<td><div class="matrix-cell ${cls}" data-a="${rowDrug.g}" data-b="${colDrug.g}" data-s="${result.status}"></div></td>`;
      }
    });
    html += '</tr>';
  });
  html += '</table>';
  var msEl = document.getElementById('matrixScroll'); if (msEl) msEl.innerHTML = html;
}

function showTooltip(e, el) {
  const tip = document.getElementById('matrixTooltip');
  if (!tip) return;
  const labels = { compatible: '✅ Compatible', incompatible: '❌ Incompatible', variable: '⚠️ Variable', nodata: '❓ No data' };
  tip.innerHTML = `<strong>${el.dataset.a}</strong> + <strong>${el.dataset.b}</strong><br>${labels[el.dataset.s]}`;
  tip.classList.add('show');
  const rect = el.getBoundingClientRect();
  tip.style.left = Math.min(rect.left, window.innerWidth - 270) + 'px';
  tip.style.top = (rect.top - 50) + 'px';
}
function hideTooltip() {
  var tip = document.getElementById('matrixTooltip'); if (tip) tip.classList.remove('show');
}

// ===== MULTI-DRUG CHECKER =====
let selectedMultiDrugs = [];

function filterSuggestions() {
  const input = document.getElementById('multiSearch');
  const val = input.value.trim().toLowerCase();
  const container = document.getElementById('drugSuggestions');
  
  if (val.length < 1) { container.classList.remove('show'); return; }
  
  const matches = DRUGS.filter(d => 
    !selectedMultiDrugs.includes(d.i) &&
    (d.g.toLowerCase().includes(val) || d.t.toLowerCase().includes(val))
  ).slice(0, 8);
  
  if (matches.length === 0) { container.classList.remove('show'); return; }
  
  container.innerHTML = matches.map(d => 
    `<div class="drug-sug-item" data-action="addMultiDrug" data-index="${d.i}">
      <span class="sug-generic">${d.g}</span>${d.h ? ' ⚠' : ''}
      <span class="sug-trade">${d.t}</span>
    </div>`
  ).join('');
  container.classList.add('show');
}

function addMultiDrug(id) {
  if (selectedMultiDrugs.includes(id)) return;
  selectedMultiDrugs.push(id);
  document.getElementById('multiSearch').value = '';
  document.getElementById('drugSuggestions').classList.remove('show');
  renderMultiDrugs();
  checkMultiCompat();
}

function removeMultiDrug(id) {
  selectedMultiDrugs = selectedMultiDrugs.filter(i => i !== id);
  renderMultiDrugs();
  checkMultiCompat();
}

function renderMultiDrugs() {
  const container = document.getElementById('selectedDrugs');
  container.innerHTML = selectedMultiDrugs.map(id => {
    const d = DRUGS.find(dr => dr.i === id);
    return `<span class="sel-chip ${d.h ? 'had-chip' : ''}">${d.g.split(' ')[0]}${d.h ? ' ⚠' : ''} <span class="remove" data-action="removeMultiDrug" data-id="${id}">×</span></span>`;
  }).join('');
}

function checkMultiCompat() {
  const container = document.getElementById('multiResults');
  if (selectedMultiDrugs.length < 2) {
    container.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:12px 0;">เลือกอย่างน้อย 2 ยาเพื่อตรวจสอบ</p>';
    return;
  }
  
  const pairs = [];
  for (let i = 0; i < selectedMultiDrugs.length; i++) {
    for (let j = i + 1; j < selectedMultiDrugs.length; j++) {
      const dA = DRUGS.find(d => d.i === selectedMultiDrugs[i]);
      const dB = DRUGS.find(d => d.i === selectedMultiDrugs[j]);
      const result = getCompatibility(dA, dB);
      pairs.push({ a: dA, b: dB, result });
    }
  }
  
  // Sort: incompatible first
  const order = { incompatible: 0, variable: 1, nodata: 2, compatible: 3 };
  pairs.sort((a, b) => order[a.result.status] - order[b.result.status]);
  
  const icons = { compatible: '✓', incompatible: '✕', variable: '!', nodata: '?' };
  const labels = { compatible: 'COMPAT', incompatible: 'INCOMPAT', variable: 'VARIABLE', nodata: 'NO DATA' };
  const cls = s => s === 'compatible' ? 'c' : s === 'incompatible' ? 'i' : s === 'variable' ? 'v' : 'n';
  
  const incompCount = pairs.filter(p => p.result.status === 'incompatible').length;
  const compatCount = pairs.filter(p => p.result.status === 'compatible').length;

  // Send analytics
  if (typeof IVDrugRef !== 'undefined' && IVDrugRef.sendAnalytics) {
    IVDrugRef.sendAnalytics({
      type: 'compat_usage',
      mode: 'multi',
      drug_a: '',
      drug_b: '',
      result_status: incompCount > 0 ? 'has_incompatible' : 'compatible',
      result_source: 'multi',
      drugs_count: selectedMultiDrugs.length,
      pairs_total: pairs.length,
      pairs_compatible: compatCount,
      pairs_incompatible: incompCount
    });
  }

  let summary = `<div style="font-size:12px;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:8px;">
    📊 ${pairs.length} pairs checked — 
    <span style="color:var(--green);font-weight:600">${compatCount} compatible</span>, 
    <span style="color:var(--red);font-weight:600">${incompCount} incompatible</span>, 
    <span style="color:var(--text3)">${pairs.length - compatCount - incompCount} no data/variable</span>
  </div>`;
  
  container.innerHTML = summary + pairs.map(p => `
    <div class="multi-pair">
      <div class="pair-icon ${cls(p.result.status)}">${icons[p.result.status]}</div>
      <span class="pair-names">${p.a.g.split(' ')[0]} + ${p.b.g.split(' ')[0]}</span>
      <span class="pair-type ${cls(p.result.status)}">${labels[p.result.status]}</span>
    </div>
  `).join('');
}

// ===== MODE SWITCHING =====
function switchMode(mode) {
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.getElementById('pairSection').classList.toggle('active', mode === 'pair');
  document.getElementById('matrixSection').classList.toggle('active', mode === 'matrix');
  document.getElementById('combinedSection').classList.toggle('active', mode === 'combined');

  if (mode === 'matrix') {
    renderMatrix();
    // Send analytics for matrix view
    if (typeof IVDrugRef !== 'undefined' && IVDrugRef.sendAnalytics) {
      IVDrugRef.sendAnalytics({
        type: 'compat_usage',
        mode: 'matrix_view',
        drug_a: '',
        drug_b: '',
        result_status: 'view',
        result_source: 'matrix',
        drugs_count: 0,
        pairs_total: 0,
        pairs_compatible: 0,
        pairs_incompatible: 0
      });
    }
  }
}

// Close suggestions on click outside
document.addEventListener('click', e => {
  if (!e.target.closest('.multi-drug-area')) {
    document.getElementById('drugSuggestions')?.classList.remove('show');
  }
});

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    // Fetch sheet-managed compat pairs (async, non-blocking — CURATED is fallback)
    loadCompatPairsFromSheet();

    populateSelects();
    buildMatrixFilter();
    checkMultiCompat();

    // Event delegation — replaces all inline handlers
    IVDrugRef.delegate(document, 'click', {
      switchMode: function(e, t) { switchMode(t.dataset.mode); },
      addMultiDrug: function(e, t) { addMultiDrug(+t.dataset.index); },
      removeMultiDrug: function(e, t) { removeMultiDrug(+t.dataset.id); },
      pickAlt: function(e, t) {
        var sel = document.getElementById(t.dataset.target);
        if (sel) { sel.value = t.dataset.id; checkPair(); }
      }
    });
    IVDrugRef.delegate(document, 'change', {
      checkPair: function() { checkPair(); }
    });
    IVDrugRef.delegate(document, 'input', {
      filterSuggestions: function() { filterSuggestions(); }
    });
    IVDrugRef.delegate(document, 'focusin', {
      filterSuggestions: function() { filterSuggestions(); }
    });

    // Matrix tooltip delegation
    var matrixEl = document.getElementById('matrixScroll');
    if (matrixEl) {
      matrixEl.addEventListener('mouseover', function(e) {
        var cell = e.target.closest('.matrix-cell');
        if (cell && cell.dataset.a) showTooltip(e, cell);
      });
      matrixEl.addEventListener('mouseout', function(e) {
        var cell = e.target.closest('.matrix-cell');
        if (cell) hideTooltip();
      });
    }

    // Send analytics
    if (typeof IVDrugRef !== 'undefined' && IVDrugRef.trackPageView) {
      IVDrugRef.trackPageView('compatibility');
    }
  });

})();
