# TDM Hub Module (tdm.js) - Extraction & Refactoring Summary

## Overview
Extracted and refactored ~1290 lines of JavaScript from `/sessions/compassionate-fervent-cerf/mnt/IV_drugref PWA/V 4.6.0/tdm.html` (lines 933-2214) into a modular, self-contained ES5 IIFE module.

## File Location
**Output:** `/sessions/compassionate-fervent-cerf/mnt/IV DrugRef PWA Development/v5.0-modular/js/tdm.js`
- **Size:** 76 KB
- **Lines:** 1,584 (including comments and formatting)
- **Syntax Status:** ✅ Valid (Node.js syntax check passed)

## Key Refactoring Changes

### 1. Removed from Original (Now in core.js)
- ✂️ `cockcroft()` → Use `IVDrugRef.calcCockcroftGault()` instead
- ✂️ `schwartz()` → Use `IVDrugRef.calcSchwartz()` instead
- ✂️ `sendAnalytics()` (local implementation) → Use `IVDrugRef.sendAnalytics()` instead
- ✂️ Session tracking code → Use `IVDrugRef.trackPageView()` instead
- ✂️ Page view tracking → Use `IVDrugRef.trackPageView('tdm')` instead

### 2. Refactored to Use core.js
- ✏️ `getPatient()` - Now calls `IVDrugRef.getPatientFromForm()` as base, adds TDM-specific fields (alb, dialysis)
- ✏️ `updateCrCl()` - Refactored to use `IVDrugRef.calcCockcroftGault()` and `IVDrugRef.calcSchwartz()` for pediatric
- ✏️ All `sendAnalytics()` calls → Now use `IVDrugRef.sendAnalytics()`

### 3. Module Structure
```javascript
const TDMHub = (function() {
  // Private functions and modules
  // ...
  return {
    // Public API
    init, switchDrug, 
    VancoTDM_*, PhenytoinTDM_*, 
    AminoglycosideTDM_*, ValproateTDM_*
  };
})();
```

### 4. Preserved TDM-Specific Logic
✅ All TDM drug calculation modules preserved with full functionality:
- **VancoTDM** - Bayesian MAP + MCMC sampling for vancomycin dosing
- **PhenytoinTDM** - Winter-Tozer correction + Michaelis-Menten kinetics
- **AminoglycosideTDM** - Hartford nomogram + 1-compartment PK
- **ValproateTDM** - Free level correction + dose-level relationships

### 5. Drug-Specific Modules
Each module is a self-contained IIFE with:
- **PK Models** - Pharmacokinetic parameters per population/indication
- **Sampling Tools** - Level adequacy checks, recommendation timing
- **Graphics** - Canvas-based concentration-time curve visualization
- **Bayesian Inference** - MAP estimation and MCMC sampling (Vancomycin)
- **Dose Optimization** - Dynamic dose recommendations with range selection
- **Analytics Integration** - Comprehensive drug usage tracking

### 6. Event Listeners & Initialization
- ✅ All patient field listeners attached in `DOMContentLoaded` block
- ✅ Phenytoin auto-correction on patient parameter change
- ✅ Vancomycin optimizer listeners for dose/interval changes
- ✅ Window resize handler for responsive graph rendering
- ✅ Page view tracking via `IVDrugRef.trackPageView('tdm')`

### 7. Public API (Accessible from HTML)
The module exports these methods for onclick handlers in HTML:

**Drug Switching:**
- `TDMHub.switchDrug(drug)`

**Vancomycin:**
- `TDMHub.VancoTDM_run()` - Run Bayesian MAP + MCMC
- `TDMHub.VancoTDM_init()` - Initialize dose/level inputs
- `TDMHub.VancoTDM_addDose()` / `removeDose(i)`
- `TDMHub.VancoTDM_setDose(i, k, v)`
- `TDMHub.VancoTDM_addLevel()` / `removeLevel(i)`
- `TDMHub.VancoTDM_setLevel(i, k, v)`
- `TDMHub.VancoTDM_setModel(id)`
- `TDMHub.VancoTDM_updateOpt()`

**Phenytoin:**
- `TDMHub.PhenytoinTDM_run()` - Run Winter-Tozer + MM calculation

**Aminoglycosides:**
- `TDMHub.AminoglycosideTDM_updateUI()` - Update dose recommendations
- `TDMHub.AminoglycosideTDM_run()` - Run Hartford nomogram + PK

**Valproate:**
- `TDMHub.ValproateTDM_run()` - Run free level correction + dose calc

**Utilities:**
- `TDMHub.updateCrCl()` - Update patient CrCl
- `TDMHub.getPatient()` - Get patient data from form

## Code Quality
✅ **Well-commented** - Organized sections with clear headers
✅ **Consistent style** - Matches original code formatting and patterns
✅ **No external dependencies** - Uses only standard JS + IVDrugRef core
✅ **Modular design** - Each drug module is self-contained IIFE
✅ **Error handling** - Input validation and null checks throughout
✅ **Analytics integrated** - All calculations tracked via `IVDrugRef.sendAnalytics()`

## Integration Points with core.js
The module depends on these IVDrugRef functions:
- `calcCockcroftGault(age, wt, scr, sex, ht)` - CrCl calculation
- `calcSchwartz(ht, scr)` - Pediatric eGFR
- `getPatientFromForm(fieldIds)` - Extract patient data from form
- `sendAnalytics(data)` - Send usage analytics
- `trackPageView(pageName)` - Track page view entry/exit

## HTML Integration Notes
The HTML file (`tdm.html`) should:
1. Include `<script src="js/core.js"></script>` before tdm.js
2. Include `<script src="js/tdm.js"></script>` after core.js
3. Keep all existing HTML element IDs unchanged (inputs use ptAge, ptWt, etc.)
4. All onclick handlers should reference `TDMHub` namespace functions

## Version Info
- **Module Name:** TDMHub
- **Version:** 1.0
- **Format:** ES5 IIFE + modular sub-modules
- **Created:** 2026-03-27
- **Source:** IV DrugRef PWA v4.6.0 tdm.html
