#!/usr/bin/env node
/**
 * IV DrugRef PWA v5.0-modular — Build Script
 *
 * Inlines external CSS/JS back into single-file HTML for production deploy.
 * Supports two HTML patterns:
 *   1. <!-- BUILD:CSS --> / <!-- BUILD:JS --> markers
 *   2. Direct <link rel="stylesheet" href="css/..."> / <script src="js/..."> tags
 *
 * Usage:
 *   node build.js              # Production (inline, no minify)
 *   node build.js --prod       # Production (inline + CSS minify)
 *   node build.js --dev        # Dev mode (keep external refs, copy to dist)
 *
 * Note: JS is NOT minified because index.js is pre-obfuscated and terser
 *       breaks its string lookup tables and onclick handler references.
 *       CSS minification via clean-css is safe and still applied in --prod.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { fetchApprovedDrugs, validateSnapshot } = require('./drug-snapshot');

// Minification libraries (only required for --prod)
let CleanCSS;

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const CSS_DIR = path.join(ROOT, 'css');
const JS_DIR = path.join(ROOT, 'js');

const DEV_MODE = process.argv.includes('--dev');

// Auto-generate cache version from git commit hash
function getBuildVersion() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    return hash; // e.g. "9674759"
  } catch (e) {
    return Date.now().toString(36); // fallback if no git
  }
}
const PROD_MODE = process.argv.includes('--prod');

// Pages and their CSS/JS dependencies (order matters)
const PAGES = {
  'index.html':        { css: ['shared.css','theme.css','index.css','quick-actions.css','onboarding.css','site-chrome.css'],       js: ['error-tracker.js','liff-bridge.js','core.js','index.js','quick-actions.js','onboarding.js','survey.js','site-chrome.js'] },
  'calculator.html':   { css: ['shared.css','theme.css','calculator.css','quick-actions.css','onboarding.css','site-chrome.css'],  js: ['error-tracker.js','liff-bridge.js','core.js','pediatric-guard.js','share-export.js','calculator.js','quick-actions.js','onboarding.js','survey.js','site-chrome.js'] },
  'renal-dosing.html': { css: ['shared.css','theme.css','renal-dosing.css','quick-actions.css','onboarding.css','site-chrome.css'],js: ['error-tracker.js','core.js','pediatric-guard.js','renal-dosing.js','quick-actions.js','onboarding.js','survey.js','site-chrome.js'] },
  'compatibility.html':{ css: ['shared.css','theme.css','compatibility.css','quick-actions.css','onboarding.css','site-chrome.css'],js: ['error-tracker.js','core.js','drug-interactions.js','compat-drugs.js','compatibility.js','quick-actions.js','onboarding.js','survey.js','site-chrome.js'] },
  'interactions.html': { css: ['shared.css','theme.css','compatibility.css','quick-actions.css','onboarding.css','site-chrome.css'],js: ['error-tracker.js','core.js','drug-interactions.js','compat-drugs.js','interactions.js','quick-actions.js','onboarding.js','survey.js','site-chrome.js'] },
  'allergy.html':      { css: ['shared.css','theme.css','allergy.css','onboarding.css','site-chrome.css'],     js: ['error-tracker.js','liff-bridge.js','core.js','allergy-data.js','compat-drugs.js','share-export.js','allergy.js','onboarding.js','survey.js','site-chrome.js'] },
  'admin.html':        { css: ['shared.css','theme.css','admin.css'],       js: ['error-tracker.js','core.js','allergy-data.js','drug-interactions.js','curated-renal-drugs.js','admin-supabase.js','admin.js'] },
  'tdm.html':          { css: ['shared.css','theme.css','tdm.css','quick-actions.css','onboarding.css','site-chrome.css'],          js: ['error-tracker.js','liff-bridge.js','core.js','pediatric-guard.js','share-export.js','pk-models.js','tdm.js','quick-actions.js','onboarding.js','survey.js','site-chrome.js'] },
  'vanco-tdm.html':    { css: ['shared.css','theme.css','vanco-tdm.css','quick-actions.css','site-chrome.css'],    js: ['error-tracker.js','liff-bridge.js','core.js','pediatric-guard.js','share-export.js','pk-models.js','vanco-tdm.js','quick-actions.js','survey.js','site-chrome.js'] },
  'dashboard.html':    { css: ['shared.css','theme.css','dashboard.css'],    js: ['error-tracker.js','core.js','dashboard.js'] },
};

// Static files to copy to dist
const STATIC_FILES = [
  'manifest.json', 'sw.js', 'drugs-data.json',
  'i18n.js', 'translations-en.js', 'version.json'
];

// Missing-asset tracker: a typo in PAGES/STATIC_FILES must FAIL the build
// (previously it only warned, deploying a page with its JS/CSS silently empty).
const MISSING_FILES = [];

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ Not found: ${filePath}`);
    MISSING_FILES.push(filePath);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function concatCSS(files) {
  return files.map(f => readFile(path.join(CSS_DIR, f))).join('\n');
}

function concatJS(files) {
  return files.map(f => readFile(path.join(JS_DIR, f))).join('\n');
}

function minCSSSync(css) {
  if (!CleanCSS) CleanCSS = require('clean-css');
  const result = new CleanCSS({
    level: 2,
    returnPromise: false
  }).minify(css);
  if (result.errors.length) console.warn('  ⚠ CleanCSS errors:', result.errors);
  return result.styles;
}

function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}

function buildPage(htmlFile, cfg) {
  const srcPath = path.join(ROOT, htmlFile);
  if (!fs.existsSync(srcPath)) { console.log(`  ⚠ ${htmlFile} not found, skipping`); return null; }

  let html = readFile(srcPath);

  if (DEV_MODE) {
    // Dev: copy HTML as-is to dist (css/ and js/ dirs are copied in build()
    // so the external refs actually resolve — they used to 404).
    const outPath = path.join(DIST, htmlFile);
    fs.writeFileSync(outPath, html);
    return { file: htmlFile, size: html.length };
  }

  // --- Production: inline CSS (minified in --prod) ---
  let cssContent = concatCSS(cfg.css);
  if (PROD_MODE) cssContent = minCSSSync(cssContent);
  const cssTag = `<style>\n${cssContent}\n</style>`;

  // --- Production: inline JS (NO minification — preserves obfuscated code & onclick refs) ---
  let jsContent = concatJS(cfg.js);

  // Auto-inject build version into drugCacheVer (forces cache clear on every deploy)
  const buildVer = getBuildVersion();
  jsContent = jsContent.replace(
    /drugCacheVer","[^"]*"/g,
    `drugCacheVer","${buildVer}"`
  ).replace(
    /drugCacheVer"\)&&/g,  // the comparison check
    `drugCacheVer")&&`
  );
  // Replace the comparison value too: "v5.1"!==localStorage.getItem("drugCacheVer")
  jsContent = jsContent.replace(
    /"[^"]*"!==localStorage\.getItem\("drugCacheVer"\)/g,
    `"${buildVer}"!==localStorage.getItem("drugCacheVer")`
  );

  // Production: strip debug logging (keep console.warn/error). index.js line 7
  // is pre-obfuscated, so instead of deleting statements (which needs paren
  // balancing) we token-replace console.log/info/debug → a no-op shim. This is
  // safe (no `window.console`/`x.console.log` usage exists), preserves any side
  // effects in the arguments, and leaves dev builds (no --prod) fully logged.
  if (PROD_MODE) {
    const n = (jsContent.match(/console\.(log|info|debug)\b/g) || []).length;
    if (n > 0) {
      jsContent = 'var __ivNoLog=function(){};\n'
        + jsContent.replace(/console\.(log|info|debug)\b/g, '__ivNoLog');
      console.log(`  🧹 ${htmlFile}: stripped ${n} debug console.* call(s)`);
    }
  }

  const jsTag = `<script>\n${jsContent}\n</script>`;

  // Always remove external CSS <link> tags for our files
  for (const f of cfg.css) {
    const linkRe = new RegExp(`\\s*<link[^>]*href=["']css/${f.replace(/\./g, '\\.')}["'][^>]*>`, 'g');
    html = html.replace(linkRe, '');
  }
  // Always remove external JS <script src="js/..."> tags for our files
  for (const f of cfg.js) {
    const scriptRe = new RegExp(`\\s*<script[^>]*src=["']js/${f.replace(/\./g, '\\.')}["'][^>]*><\\/script>`, 'g');
    html = html.replace(scriptRe, '');
  }

  // Insert inlined CSS: at BUILD marker or before </head>
  if (html.includes('<!-- BUILD:CSS -->')) {
    html = html.replace('<!-- BUILD:CSS -->', cssTag);
  } else {
    html = html.replace('</head>', `${cssTag}\n</head>`);
  }

  // Insert inlined JS: at BUILD marker or before </body>
  if (html.includes('<!-- BUILD:JS -->')) {
    html = html.replace('<!-- BUILD:JS -->', jsTag);
  } else {
    html = html.replace('</body>', `${jsTag}\n</body>`);
  }

  const outPath = path.join(DIST, htmlFile);
  fs.writeFileSync(outPath, html);
  return { file: htmlFile, size: html.length };
}

/**
 * Overwrite dist/drugs-data.json with the live approved drugs.
 *
 * The committed snapshot has already been copied into dist/ by the static-file
 * loop, so it is the automatic fallback: this only replaces it when the fetch
 * both succeeds and passes validateSnapshot(). A Supabase outage therefore
 * costs freshness, never a deploy — and never a bad dataset, which is the one
 * outcome worth failing over (users read this file with no network).
 *
 * Set SKIP_DRUG_SNAPSHOT=1 to build offline without waiting for the fetch.
 */
async function refreshDrugSnapshot() {
  const label = 'drugs-data.json';
  const dst = path.join(DIST, 'drugs-data.json');

  if (process.env.SKIP_DRUG_SNAPSHOT) {
    console.log(`  ${label.padEnd(25)}⏭  refresh skipped (SKIP_DRUG_SNAPSHOT)`);
    return;
  }
  if (!fs.existsSync(dst)) {
    console.log(`  ${label.padEnd(25)}⚠ refresh skipped — no committed snapshot to fall back on`);
    return;
  }

  let baseline = 0;
  try {
    const committed = JSON.parse(fs.readFileSync(dst, 'utf8'));
    if (Array.isArray(committed)) baseline = committed.length;
  } catch (e) { /* unreadable baseline → floor check simply won't apply */ }

  const fetched = await fetchApprovedDrugs();
  const result = fetched.ok ? validateSnapshot(fetched.rows, baseline) : fetched;

  if (!result.ok) {
    console.log(`  ${label.padEnd(25)}⚠ kept committed snapshot (${baseline} drugs) — ${result.reason}`);
    return;
  }

  fs.writeFileSync(dst, JSON.stringify(result.drugs, null, 2) + '\n');
  const dropped = result.dropped ? `, ${result.dropped} unusable row(s) dropped` : '';
  console.log(`  ${label.padEnd(25)}🔄 refreshed from Supabase — ${result.drugs.length} drugs${dropped}`);
}

async function build() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   IV DrugRef PWA v5.0 — Build System                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const mode = DEV_MODE ? 'Development (external)' : PROD_MODE ? 'Production (inline + CSS minify)' : 'Production (inline)';
  console.log(`Mode: ${mode}\n`);

  // Create dist/
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  // Build pages
  console.log('📄 Building pages:\n');
  const results = [];
  for (const [file, cfg] of Object.entries(PAGES)) {
    process.stdout.write(`  ${file.padEnd(25)}`);
    const r = buildPage(file, cfg);
    if (r) {
      results.push(r);
      console.log(`✅ ${fmt(r.size)}`);
    } else {
      console.log('❌ SKIP');
    }
  }

  // Copy static files (no JS minification)
  console.log('\n📦 Copying static files:\n');
  for (const f of STATIC_FILES) {
    const src = path.join(ROOT, f);
    const dst = path.join(DIST, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`  ${f.padEnd(25)}✅ ${fmt(fs.statSync(src).size)}`);
    } else {
      console.log(`  ${f.padEnd(25)}⚠ not found`);
      MISSING_FILES.push(src);
    }
  }

  // Ship today's drug data as the offline fallback, not the day it was committed.
  await refreshDrugSnapshot();

  // Dev mode: the HTML keeps external css/js refs — copy the dirs so they resolve
  if (DEV_MODE) {
    fs.cpSync(CSS_DIR, path.join(DIST, 'css'), { recursive: true });
    fs.cpSync(JS_DIR, path.join(DIST, 'js'), { recursive: true });
    console.log('  css/, js/ (dev refs)     ✅');
  }

  // Auto-inject build version into version.json (preserves forceUpdate flag)
  const versionJsonPath = path.join(DIST, 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    const buildVer = getBuildVersion();
    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    versionData.version = buildVer;
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n');
    console.log(`\n🔖 version.json: version set to "${buildVer}", forceUpdate=${versionData.forceUpdate}`);
  }

  // Copy icons/
  const iconsSrc = path.join(ROOT, 'icons');
  const iconsDst = path.join(DIST, 'icons');
  if (fs.existsSync(iconsSrc)) {
    if (!fs.existsSync(iconsDst)) fs.mkdirSync(iconsDst, { recursive: true });
    const icons = fs.readdirSync(iconsSrc);
    icons.forEach(f => fs.copyFileSync(path.join(iconsSrc, f), path.join(iconsDst, f)));
    console.log(`  icons/ (${icons.length} files)       ✅`);
  }

  // Summary
  const totalSize = results.reduce((s, r) => s + r.size, 0);
  console.log('\n' + '━'.repeat(58));
  console.log(`\n📊 Summary: ${results.length} pages built, total HTML: ${fmt(totalSize)}`);
  console.log(`   Output: ${DIST}\n`);

  // Compare with source
  if (!DEV_MODE) {
    console.log('📐 Size comparison (modular → built):\n');
    for (const r of results) {
      const srcSize = fs.statSync(path.join(ROOT, r.file)).size;
      console.log(`  ${r.file.padEnd(25)} ${fmt(srcSize).padEnd(10)} → ${fmt(r.size).padEnd(10)} (${r.size > srcSize ? '+' : ''}${fmt(r.size - srcSize)})`);
    }
  }

  // ── Guard 1: any missing PAGES/STATIC file fails the build ──
  if (MISSING_FILES.length) {
    console.error('\n❌ Build FAILED — missing source files:');
    MISSING_FILES.forEach(f => console.error('   - ' + f));
    process.exit(1);
  }

  // ── Guard 2: every sw.js precache asset must exist in dist/ ──
  // A single 404 used to reject cache.addAll and break SW install for ALL
  // users (the v5.51.x stale-SW saga). Catch it at build time instead.
  if (!DEV_MODE) {
    const swSrc = readFile(path.join(ROOT, 'sw.js'));
    const listMatch = swSrc.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\]/);
    if (listMatch) {
      const assets = [...listMatch[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m => m[1]);
      const missing = assets.filter(a => !fs.existsSync(path.join(DIST, a)));
      if (missing.length) {
        console.error('\n❌ Build FAILED — sw.js precaches files missing from dist/:');
        missing.forEach(f => console.error('   - ' + f));
        process.exit(1);
      }
      console.log(`🛡  sw.js precache check: ${assets.length} assets OK`);
    }
  }

  console.log('\n✅ Build completed!\n');
}

build().catch(err => {
  console.error('\n❌ Build FAILED —', (err && err.stack) || err);
  process.exit(1);
});
