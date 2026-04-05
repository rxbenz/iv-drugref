# IV DrugRef PWA v5.0 - Modular Architecture

## Overview

Refactored slim HTML files for the IV DrugRef Progressive Web Application v5.0, implementing a clean modular architecture with **markup-only HTML** and **external CSS/JS references**.

## Project Structure

```
v5.0-modular/
├── tdm.html                 (313 lines, 19 KB) — Multi-drug TDM Hub
├── renal-dosing.html        (172 lines, 7.0 KB) — Renal dosing calculator
├── calculator.html          (121 lines, 4.6 KB) — IV dose calculator
├── compatibility.html       (134 lines, 6.7 KB) — Drug compatibility checker
├── vanco-tdm.html          (81 lines, 6.4 KB) — Vancomycin Bayesian TDM
├── FILES_SUMMARY.txt        — Detailed file specifications
└── README.md               — This file
```

## Key Features

### Markup-Only Design
- **No inline `<style>` blocks** — All CSS via external references
- **No inline `<script>` blocks** — All JS via external files
- **Clean separation** — HTML contains only semantic markup and event handlers
- **Build system ready** — `<!-- BUILD:CSS -->` and `<!-- BUILD:JS -->` markers

### Consistent Navigation
- Bottom navigation bar on all pages
- 5 main sections: Home | Calculator | TDM | Renal | Compatibility
- Active state indicators per page

### Responsive Design
- Mobile-first viewport configuration
- Proper meta tags (charset, viewport, theme-color)
- Safe area insets for notched devices
- PWA manifest and icon references

### Theme Support
- **Light theme**: calculator.html, renal-dosing.html
- **Dark theme**: tdm.html, vanco-tdm.html, compatibility.html
- CSS variables for theming via external stylesheet

## File Descriptions

| File | Purpose | Theme | Status |
|------|---------|-------|--------|
| **tdm.html** | Therapeutic Drug Monitoring Hub with 4 drug modules (Vancomycin, Phenytoin, Aminoglycosides, Valproate) | Dark | ✓ Complete |
| **renal-dosing.html** | Renal function calculator (Cockcroft-Gault, CKD-EPI 2021) with drug dosing adjustments | Light | ✓ Complete |
| **calculator.html** | IV drug dosing calculator with patient parameters and renal adjustments | Light | ✓ Complete |
| **compatibility.html** | IV drug compatibility checker with pair mode, matrix view, and multi-drug analysis | Dark | ✓ Complete |
| **vanco-tdm.html** | Specialized Vancomycin TDM using Bayesian MAP + MCMC | Dark | ✓ Complete |

## HTML Structure

### Head Section
```html
<head>
  <!-- Meta tags for PWA -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0f172a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  
  <!-- Resources -->
  <link rel="manifest" href="manifest.json">
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192x192.png">
  
  <!-- BUILD:CSS -->
  <link rel="stylesheet" href="css/shared.css">
  <link rel="stylesheet" href="css/theme-dark.css">
  <link rel="stylesheet" href="css/tdm.css">
</head>
```

### Body Structure
```html
<body class="theme-dark">
  <!-- Header with back button and page title -->
  <div class="header">...</div>
  
  <!-- Main content with container -->
  <div class="container">
    <!-- Page-specific sections -->
  </div>
  
  <!-- Bottom navigation bar -->
  <nav class="bottom-nav">...</nav>
  
  <!-- BUILD:JS -->
  <script src="js/core.js"></script>
  <script src="js/tdm.js"></script>
  <script src="translations-en.js"></script>
  <script src="i18n.js"></script>
</body>
```

## Build System Integration

### CSS Pipeline
```
<!-- BUILD:CSS -->
├── css/shared.css         (Common styles)
├── css/theme-dark.css     (Dark theme) OR css/theme-light.css (Light theme)
└── css/{page}.css         (Page-specific styles)
```

### JavaScript Pipeline
```
<!-- BUILD:JS -->
├── js/core.js             (Core utilities)
├── js/{page}.js           (Page logic)
├── translations-en.js     (Language strings)
└── i18n.js               (i18n system)
```

## CSS Classes & Conventions

### Theme Classes
- `.theme-dark` — Applied to body on dark pages
- `.theme-light` — (Optional) Light theme indicator

### Layout Classes
- `.header` — Top navigation header
- `.container` — Main content wrapper (max-width: 640px)
- `.section` — Content card/section
- `.card` — TDM/Compat specific card
- `.bottom-nav` — Fixed bottom navigation

### Component Classes
- `.btn-primary` — Primary action button
- `.info-box` — Information box (blue, amber, red, purple variants)
- `.disclaimer` — Warning disclaimer text
- `.field-grid`, `.field-row` — Form layouts
- `.drug-grid`, `.drug-list` — Drug selection layouts

## Progressive Enhancement

### Event Handlers
HTML elements retain inline event handlers for progressive enhancement:
```html
<input type="number" id="ptWt" oninput="updateCrCl(); calculate();">
<button onclick="runBayesian()">Run Calculation</button>
```

### Inline Styles
Minimal inline `style=""` attributes preserved for:
- Display toggles (`display: none`)
- Real-time updates
- Dynamic theming

### JavaScript Dependencies
All JavaScript is loaded at page bottom for:
- Non-blocking DOM rendering
- Progressive script loading
- Defer-able asset bundling

## Standards Compliance

✓ HTML5 DOCTYPE  
✓ Semantic HTML  
✓ Responsive viewport  
✓ PWA-ready (manifest, icons, service worker support)  
✓ Accessibility basics (semantic tags, form labels)  
✓ Mobile-friendly (touch targets, viewport)  
✓ Thai language support (lang="th")  

## Migration from v4.6.0

### What Changed
- Removed all `<style>` blocks → External CSS only
- Removed all `<script>` blocks → External JS only
- Added `<!-- BUILD:CSS -->` markers
- Added `<!-- BUILD:JS -->` markers
- Added bottom navigation bar
- Standardized meta tags and PWA support

### What's the Same
- HTML structure and markup
- Content and form elements
- Event handler attributes
- CSS class names and selectors
- JavaScript function names

## Next Steps

1. **Create CSS files**
   - `css/shared.css` — Common styles, variables, resets
   - `css/theme-dark.css` — Dark theme colors
   - `css/theme-light.css` — Light theme colors
   - `css/tdm.css` — TDM-specific styles
   - `css/renal-dosing.css` — Renal dosing styles
   - `css/calculator.css` — Calculator styles
   - `css/compatibility.css` — Compatibility styles
   - `css/vanco-tdm.css` — Vancomycin TDM styles

2. **Create JavaScript modules**
   - `js/core.js` — Shared utilities (cockcroft, schwartz, etc.)
   - `js/tdm.js` — TDM logic
   - `js/renal-dosing.js` — Renal dosing logic
   - `js/calculator.js` — Calculator logic
   - `js/compatibility.js` — Compatibility checker logic
   - `js/vanco-tdm.js` — Vancomycin TDM logic
   - `translations-en.js` — English translations
   - `i18n.js` — i18n system

3. **Build pipeline**
   - Minify CSS and JavaScript
   - Bundle assets via `<!-- BUILD:* -->` markers
   - Generate source maps
   - Create distribution bundle

## Version Info

- **PWA Version**: 5.0
- **Architecture**: Modular (HTML+CSS+JS separation)
- **Original Version**: 4.6.0 (refactored from)
- **Created**: 2026-03-27
- **Language**: Thai (with i18n support)
- **Target**: Progressive Web App (PWA)

---

**Created by**: Claude Code  
**For**: IV DrugRef Pharmacy Team  
**Status**: Refactoring phase complete ✓
