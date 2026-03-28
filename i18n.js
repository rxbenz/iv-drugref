/**
 * IV DrugRef PWA — Multi-language (i18n) Engine
 * Version: 2.0.0 — Complete rewrite with Thai word boundary detection
 * Supports: Thai (th) — default, English (en)
 *
 * Architecture:
 * 1. Section titles & labels — exact/contains matching on specific CSS class elements
 * 2. Pattern-based replacement — WITH Thai word boundary detection (prevents mid-word replacement)
 * 3. Page-specific handlers — for footer, filter chips, dynamic content
 * 4. MutationObserver — re-translates when DOM changes (card expansion, async data load)
 */

(function() {
  'use strict';

  // ─── Configuration ───────────────────────────────────────
  const STORAGE_KEY = 'ivdrugref_lang';
  const DEFAULT_LANG = 'th';
  const SUPPORTED_LANGS = ['th', 'en'];

  // ─── State ───────────────────────────────────────────────
  let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = DEFAULT_LANG;

  function getTranslations() {
    return window.IV_I18N_EN || {};
  }

  // ─── Thai Character Detection ────────────────────────────
  // Thai Unicode range: U+0E00 – U+0E7F
  function isThai(ch) {
    if (!ch) return false;
    var code = ch.charCodeAt(0);
    return code >= 0x0E00 && code <= 0x0E7F;
  }

  // ─── 1. SECTION TITLES & LABELS ──────────────────────────
  // Uses CONTAINS matching — finds Thai key inside element text
  // and replaces the ENTIRE element text with English equivalent

  function translateLabels(root) {
    if (currentLang === 'th') return;
    var t = getTranslations();
    if (!t.drugSections) return;

    var container = root || document;

    // Target: section-title, info-label, warning-box label, calc-note, calc-disclaimer
    var selectors = '.section-title, .info-label, .calc-note, .calc-disclaimer, .filter-label, .filter-sheet-title';
    var elements = container.querySelectorAll(selectors);

    elements.forEach(function(el) {
      if (el.hasAttribute('data-i18n-done')) return; // Already translated

      var text = el.textContent.trim();

      // Try exact match first
      if (t.drugSections[text]) {
        el.setAttribute('data-i18n-original-html', el.innerHTML);
        el.setAttribute('data-i18n-done', '1');
        el.textContent = t.drugSections[text];
        return;
      }

      // Try contains match — for section titles with emoji+Thai+English mixed
      var keys = Object.keys(t.drugSections);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (text.indexOf(key) !== -1 && key.length >= 3) {
          el.setAttribute('data-i18n-original-html', el.innerHTML);
          el.setAttribute('data-i18n-done', '1');
          // Replace just the matched part, keep structure
          // For section titles with icons, replace entire innerHTML
          if (el.classList.contains('section-title') && el.querySelector('.icon')) {
            var icon = el.querySelector('.icon').textContent;
            el.innerHTML = '<span class="icon">' + icon + '</span> ' + t.drugSections[key];
          } else {
            el.textContent = t.drugSections[key];
          }
          return;
        }
      }
    });
  }

  function revertLabels(root) {
    var container = root || document;
    var elements = container.querySelectorAll('[data-i18n-done]');
    elements.forEach(function(el) {
      var originalHTML = el.getAttribute('data-i18n-original-html');
      if (originalHTML) {
        el.innerHTML = originalHTML;
      }
      el.removeAttribute('data-i18n-done');
      el.removeAttribute('data-i18n-original-html');
    });
  }

  // ─── 2. PATTERN-BASED REPLACEMENT ────────────────────────
  // CRITICAL: Uses Thai word boundary detection
  // A pattern only matches if the character BEFORE and AFTER are NOT Thai
  // This prevents "เตรียม" from matching inside "การเตรียมยา"

  function replaceWithBoundary(text, thaiStr, englishStr) {
    var idx = 0;
    var result = '';
    while (idx < text.length) {
      var pos = text.indexOf(thaiStr, idx);
      if (pos === -1) {
        result += text.substring(idx);
        break;
      }

      // Check Thai word boundary
      var charBefore = pos > 0 ? text.charAt(pos - 1) : '';
      var charAfter = pos + thaiStr.length < text.length ? text.charAt(pos + thaiStr.length) : '';

      var thaiBefore = isThai(charBefore);
      var thaiAfter = isThai(charAfter);

      if (!thaiBefore && !thaiAfter) {
        // Safe to replace — not inside a compound Thai word
        result += text.substring(idx, pos) + englishStr;
        idx = pos + thaiStr.length;
      } else {
        // Inside a compound word — skip this match
        result += text.substring(idx, pos + thaiStr.length);
        idx = pos + thaiStr.length;
      }
    }
    return result;
  }

  function translatePatterns(root) {
    if (currentLang === 'th') return;
    var t = getTranslations();
    if (!t.patterns || t.patterns.length === 0) return;

    // IMPORTANT: Always scan ENTIRE body for patterns — TDM, renal, compat, dashboard
    // have content outside #drugList. Only use narrower root when passed explicitly (e.g. card click).
    var container = root || document.body;
    var walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          var tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
          if (parent.closest('.i18n-toggle')) return NodeFilter.FILTER_REJECT;
          // Skip elements already handled by translateLabels
          if (parent.hasAttribute('data-i18n-done')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[data-i18n-done]')) return NodeFilter.FILTER_REJECT;
          // Only process nodes containing Thai characters
          if (/[\u0E00-\u0E7F]/.test(node.textContent)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function(node) {
      var text = node.textContent;

      // Store original for reverting
      if (!node._i18nOriginal) {
        node._i18nOriginal = text;
      }

      // Apply full-phrase patterns — SORTED by Thai length DESC so longer phrases match first
      // This prevents "เวลาเจาะ" from matching before "📋 แนะนำเวลาเจาะ:"
      var fullPhrases = (t.fullPhrases || []).slice().sort(function(a, b) {
        return b.th.length - a.th.length;
      });
      fullPhrases.forEach(function(p) {
        if (text.indexOf(p.th) !== -1) {
          text = text.split(p.th).join(p.en);
        }
      });

      // Apply word patterns WITH Thai boundary checking
      t.patterns.forEach(function(p) {
        if (text.indexOf(p.th) !== -1) {
          text = replaceWithBoundary(text, p.th, p.en);
        }
      });

      if (text !== node.textContent) {
        node.textContent = text;
      }
    });
  }

  function revertPatterns(root) {
    var container = root || document.body;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (node._i18nOriginal) {
        node.textContent = node._i18nOriginal;
        delete node._i18nOriginal;
      }
    }
  }

  // ─── 3. DATA-I18N ATTRIBUTES ─────────────────────────────

  function translateDataAttrs(root) {
    if (currentLang === 'th') return;
    var t = getTranslations();
    if (!t.ui) return;

    var els = (root || document).querySelectorAll('[data-i18n]');
    els.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = resolveKey(t.ui, key);
      if (val !== undefined) {
        if (!el.hasAttribute('data-i18n-original')) {
          el.setAttribute('data-i18n-original', el.textContent);
        }
        el.textContent = val;
      }
    });

    var placeholders = (root || document).querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = resolveKey(t.ui, key);
      if (val !== undefined) {
        if (!el.hasAttribute('data-i18n-placeholder-original')) {
          el.setAttribute('data-i18n-placeholder-original', el.placeholder);
        }
        el.placeholder = val;
      }
    });
  }

  function revertDataAttrs(root) {
    var els = (root || document).querySelectorAll('[data-i18n-original]');
    els.forEach(function(el) {
      el.textContent = el.getAttribute('data-i18n-original');
      el.removeAttribute('data-i18n-original');
    });
    var phs = (root || document).querySelectorAll('[data-i18n-placeholder-original]');
    phs.forEach(function(el) {
      el.placeholder = el.getAttribute('data-i18n-placeholder-original');
      el.removeAttribute('data-i18n-placeholder-original');
    });
  }

  // ─── 4. PAGE-SPECIFIC HANDLERS ───────────────────────────

  function translatePageSpecific() {
    if (currentLang === 'th') return;
    var t = getTranslations();
    var page = detectPage();
    if (t.pages && t.pages[page] && typeof t.pages[page].apply === 'function') {
      t.pages[page].apply();
    }
  }

  function revertPageSpecific() {
    var t = getTranslations();
    var page = detectPage();
    if (t.pages && t.pages[page] && typeof t.pages[page].revert === 'function') {
      t.pages[page].revert();
    }
  }

  function detectPage() {
    var path = window.location.pathname;
    if (path.indexOf('calculator') !== -1) return 'calculator';
    if (path.indexOf('vanco-tdm') !== -1) return 'vancoTdm';
    if (path.indexOf('tdm') !== -1) return 'tdm';
    if (path.indexOf('renal') !== -1) return 'renal';
    if (path.indexOf('compatibility') !== -1 || path.indexOf('compat') !== -1) return 'compatibility';
    if (path.indexOf('dashboard') !== -1) return 'dashboard';
    return 'index';
  }

  // ─── Helper ──────────────────────────────────────────────

  function resolveKey(obj, key) {
    return key.split('.').reduce(function(o, k) { return o && o[k]; }, obj);
  }

  // ─── Toggle Button ──────────────────────────────────────

  function createToggleButton() {
    if (document.querySelector('.i18n-toggle')) return;

    var btn = document.createElement('button');
    btn.className = 'i18n-toggle';
    btn.setAttribute('aria-label', 'Toggle language');
    btn.innerHTML = currentLang === 'th'
      ? '<span class="i18n-flag">EN</span>'
      : '<span class="i18n-flag">TH</span>';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleLanguage();
    });

    var headerTop = document.querySelector('.header-top');
    var header = document.querySelector('.header');
    if (headerTop) {
      headerTop.appendChild(btn);
    } else if (header) {
      header.appendChild(btn);
    }
  }

  function updateToggleButton() {
    var btn = document.querySelector('.i18n-toggle');
    if (!btn) return;
    btn.innerHTML = currentLang === 'th'
      ? '<span class="i18n-flag">EN</span>'
      : '<span class="i18n-flag">TH</span>';
  }

  // ─── Styles ──────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('i18n-styles')) return;
    var style = document.createElement('style');
    style.id = 'i18n-styles';
    style.textContent = [
      '.i18n-toggle{font-family:"Plus Jakarta Sans","IBM Plex Sans Thai",sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;padding:5px 12px;border-radius:20px;border:1.5px solid rgba(14,165,233,.3);background:rgba(14,165,233,.08);color:#0ea5e9;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;margin-left:8px;-webkit-tap-highlight-color:transparent;user-select:none}',
      '.i18n-toggle:hover{background:rgba(14,165,233,.15);border-color:rgba(14,165,233,.5);box-shadow:0 2px 8px rgba(14,165,233,.15)}',
      '.i18n-toggle:active{transform:scale(.95)}',
      '.i18n-flag{font-size:12px;font-weight:800}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Language Switch ────────────────────────────────────

  function toggleLanguage() {
    setLanguage(currentLang === 'th' ? 'en' : 'th');
  }

  function setLanguage(lang) {
    if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;

    if (lang === 'en') {
      applyEnglish();
    } else {
      revertToThai();
    }
    updateToggleButton();
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
  }

  function applyEnglish() {
    // ORDER MATTERS: labels first (exact match), then page-specific, then patterns last
    translateLabels();
    translateDataAttrs();
    translatePageSpecific();
    translatePatterns();
  }

  function revertToThai() {
    revertLabels();
    revertDataAttrs();
    revertPageSpecific();
    revertPatterns();
  }

  // ─── MutationObserver ───────────────────────────────────

  var observer = null;
  function setupObserver() {
    if (observer) return;
    // Observe entire body — content lives in different containers across pages
    var target = document.body;
    observer = new MutationObserver(function(mutations) {
      if (currentLang === 'th') return;
      var hasNew = false;
      mutations.forEach(function(m) {
        if (m.addedNodes.length > 0 || (m.type === 'attributes' && m.attributeName === 'class')) {
          hasNew = true;
        }
      });
      if (hasNew) {
        clearTimeout(observer._debounce);
        observer._debounce = setTimeout(function() {
          translateLabels();
          translatePatterns();
        }, 80);
      }
    });
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // ─── Init ───────────────────────────────────────────────

  function init() {
    injectStyles();
    createToggleButton();
    if (currentLang === 'en') {
      requestAnimationFrame(function() { applyEnglish(); });
    }
    setupObserver();

    // Re-translate when drug card expands
    document.addEventListener('click', function(e) {
      if (currentLang === 'th') return;
      var card = e.target.closest('.drug-card');
      if (card) {
        setTimeout(function() {
          if (card.classList.contains('expanded')) {
            translateLabels(card);
            translatePatterns(card);
          }
        }, 150);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // ─── Public API ─────────────────────────────────────────
  window.IVDrugRefI18n = {
    setLanguage: setLanguage,
    getCurrentLang: function() { return currentLang; },
    toggleLanguage: toggleLanguage,
    translateElement: function(el) {
      if (currentLang === 'en') {
        translateLabels(el);
        translatePatterns(el);
      }
    }
  };

})();
