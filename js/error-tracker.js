// ============================================================================
// IV DrugRef PWA — Error Tracker v1.0
// Hybrid error tracking: client-side capture + GAS remote reporting
// ============================================================================
// Features:
// - Global error capture (window.onerror, unhandledrejection)
// - Non-intrusive toast notification for users
// - In-memory error log with localStorage persistence for debugging
// - Offline queue → auto-flush to GAS when back online
// - Deduplication (same error within 60s = skip)
// - Rate limiting (max 10 reports per minute to GAS)
// - Email alert for critical errors via GAS
// ============================================================================

(function () {
  'use strict';

  // ─── Configuration ───
  const CONFIG = {
    // GAS endpoint (same as analytics)
    GAS_URL: 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec',

    // LocalStorage keys
    LS_ERROR_LOG: 'iv_drugref_error_log',
    LS_ERROR_QUEUE: 'iv_drugref_error_queue',

    // Limits
    MAX_LOG_ENTRIES: 50,        // Keep last 50 errors in localStorage
    MAX_QUEUE_SIZE: 20,         // Max queued errors before flush
    DEDUP_WINDOW_MS: 60000,     // 60s dedup window
    RATE_LIMIT_PER_MIN: 10,     // Max 10 reports/minute to GAS
    TOAST_DURATION_MS: 5000,    // Toast visible for 5s
    FLUSH_INTERVAL_MS: 30000,   // Auto-flush queue every 30s

    // Severity levels
    SEVERITY: {
      LOW: 'low',           // Minor UI glitch
      MEDIUM: 'medium',     // Feature broken but app usable
      HIGH: 'high',         // Core feature broken
      CRITICAL: 'critical'  // App crash / data corruption
    },

    // App metadata
    APP_VERSION: '5.3.8',
    APP_NAME: 'IV DrugRef PWA'
  };

  // ─── State ───
  let recentErrors = [];        // For dedup tracking
  let rateLimitCount = 0;       // Reports sent this minute
  let flushTimer = null;
  let toastContainer = null;

  // ─── Utility: Get current page name ───
  function getPageName() {
    const path = window.location.pathname;
    const file = path.split('/').pop() || 'index.html';
    return file.replace('.html', '');
  }

  // ─── Utility: Generate error fingerprint for dedup ───
  // Use message + filename (not full source path or line — those change per build in minified code)
  function errorFingerprint(message, source) {
    const filename = String(source || 'unknown').split('/').pop().split('?')[0];
    const msgNorm = String(message || '').substring(0, 120); // Normalize length for dedup
    return `${msgNorm}|${filename}`;
  }

  // ─── Utility: Check dedup ───
  function isDuplicate(fingerprint) {
    const now = Date.now();
    // Clean old entries
    recentErrors = recentErrors.filter(e => now - e.time < CONFIG.DEDUP_WINDOW_MS);
    // Check if exists
    if (recentErrors.some(e => e.fp === fingerprint)) return true;
    recentErrors.push({ fp: fingerprint, time: now });
    return false;
  }

  // ─── Utility: Classify severity ───
  // Uses exact regex patterns instead of loose includes() to prevent false positives
  // e.g., "fetching user dose data" won't trigger HIGH just because "dose" appears
  function classifySeverity(error) {
    const msg = (error.message || '').toLowerCase();
    const type = (error.type || '').toLowerCase();

    // Critical: data corruption, JSON parse failure, script crash
    if (/json\.parse|syntaxerror.*json|unexpected token/.test(msg)) return CONFIG.SEVERITY.CRITICAL;
    if (/data\s*corruption|corrupt/i.test(msg)) return CONFIG.SEVERITY.CRITICAL;
    if (/maximum call stack|out of memory|aw,?\s*snap/i.test(msg)) return CONFIG.SEVERITY.CRITICAL;

    // High: null refs, CORS/security blocks, quota exceeded, core calculation errors
    if (/cannot read propert|null is not|undefined is not a function/.test(msg)) return CONFIG.SEVERITY.HIGH;
    if (/\bcors\b|blocked by cors|access-control-allow|securityerror/.test(msg)) return CONFIG.SEVERITY.HIGH;
    if (/quotaexceeded|quota_exceeded/.test(msg)) return CONFIG.SEVERITY.HIGH;
    if (/dose.*calc.*fail|calc.*error|nan.*result/i.test(msg)) return CONFIG.SEVERITY.HIGH;

    // Medium: network failures, type/reference errors, storage issues
    if (/\bfetch\b.*fail|networkerror|net::err_|failed to fetch/i.test(msg)) return CONFIG.SEVERITY.MEDIUM;
    if (type === 'unhandled_rejection') return CONFIG.SEVERITY.MEDIUM;
    if (/typeerror|referenceerror/.test(msg)) return CONFIG.SEVERITY.MEDIUM;
    if (type === 'resource_error') return CONFIG.SEVERITY.MEDIUM;

    // Default: everything else
    return CONFIG.SEVERITY.LOW;
  }

  // ─── Utility: Collect context (PII-safe) ───
  function collectContext() {
    return {
      page: getPageName(),
      // Strip query params and hash to avoid leaking user-specific data
      url: window.location.origin + window.location.pathname,
      // Truncate UA to just browser name/version (no detailed device fingerprint)
      userAgent: (function() {
        var ua = navigator.userAgent || '';
        var m = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
        return m ? m[0] : ua.substring(0, 50);
      })(),
      online: navigator.onLine,
      timestamp: new Date().toISOString(),
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      screenSize: `${screen.width}x${screen.height}`,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      appVersion: CONFIG.APP_VERSION
    };
  }

  // ─── Toast UI ───
  function createToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'iv-error-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      pointer-events: none;
      max-width: 90vw;
    `;
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  const MAX_TOASTS = 3; // Prevent toast storm during error cascade

  function showToast(message, severity) {
    if (!document.body) return; // Not ready yet

    const container = createToastContainer();

    // Limit visible toasts — remove oldest if at max
    while (container.children.length >= MAX_TOASTS) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');

    const colors = {
      low: { bg: '#f0f4f8', border: '#94a3b8', text: '#475569', icon: 'ℹ️' },
      medium: { bg: '#fef9c3', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
      high: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '🔴' },
      critical: { bg: '#fecaca', border: '#dc2626', text: '#7f1d1d', icon: '🚨' }
    };
    const c = colors[severity] || colors.medium;

    toast.style.cssText = `
      background: ${c.bg};
      border: 1px solid ${c.border};
      border-radius: 12px;
      padding: 10px 16px;
      font-family: 'IBM Plex Sans Thai', sans-serif;
      font-size: 13px;
      color: ${c.text};
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      pointer-events: auto;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
      max-width: 100%;
      text-align: center;
      line-height: 1.4;
    `;

    // User-friendly message (not raw error)
    const userMsg = severity === 'critical' || severity === 'high'
      ? `${c.icon} เกิดข้อผิดพลาด กรุณา refresh หน้า`
      : `${c.icon} เกิดข้อผิดพลาดเล็กน้อย`;

    toast.textContent = userMsg;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Auto dismiss
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, CONFIG.TOAST_DURATION_MS);

    // Click to dismiss
    toast.addEventListener('click', () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    });
  }

  // ─── LocalStorage Log ───
  function saveToLog(entry) {
    try {
      let log = JSON.parse(localStorage.getItem(CONFIG.LS_ERROR_LOG) || '[]');
      log.unshift(entry);
      if (log.length > CONFIG.MAX_LOG_ENTRIES) {
        log = log.slice(0, CONFIG.MAX_LOG_ENTRIES);
      }
      localStorage.setItem(CONFIG.LS_ERROR_LOG, JSON.stringify(log));
    } catch (e) {
      // localStorage full or unavailable — silently fail
    }
  }

  // ─── Queue for GAS reporting ───
  function addToQueue(entry) {
    try {
      let queue = JSON.parse(localStorage.getItem(CONFIG.LS_ERROR_QUEUE) || '[]');
      queue.push(entry);
      if (queue.length > CONFIG.MAX_QUEUE_SIZE) {
        queue = queue.slice(-CONFIG.MAX_QUEUE_SIZE); // Keep newest
      }
      localStorage.setItem(CONFIG.LS_ERROR_QUEUE, JSON.stringify(queue));
    } catch (e) { /* silently fail */ }
  }

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.LS_ERROR_QUEUE) || '[]');
    } catch (e) {
      return [];
    }
  }

  function clearQueue() {
    try {
      localStorage.removeItem(CONFIG.LS_ERROR_QUEUE);
    } catch (e) { /* silently fail */ }
  }

  // ─── Send to GAS (returns true on success attempt, false on skip) ───
  function sendToGAS(entries) {
    if (!navigator.onLine || entries.length === 0) return false;
    if (rateLimitCount >= CONFIG.RATE_LIMIT_PER_MIN) return false;

    rateLimitCount += entries.length;

    const payload = JSON.stringify({
      type: 'error_report',
      errors: entries,
      batch_size: entries.length,
      reported_at: new Date().toISOString()
    });

    try {
      if (navigator.sendBeacon) {
        return navigator.sendBeacon(CONFIG.GAS_URL, payload);
      } else {
        fetch(CONFIG.GAS_URL, {
          method: 'POST',
          body: payload,
          mode: 'no-cors',
          keepalive: true
        }).catch(() => {}); // Will retry on next flush
        return true;
      }
    } catch (e) { return false; }
  }

  // ─── Flush queue (only clear on successful send) ───
  function flushQueue() {
    const queue = getQueue();
    if (queue.length === 0 || !navigator.onLine) return;

    const sent = sendToGAS(queue);
    if (sent) {
      clearQueue(); // Only clear if send was attempted successfully
    }
    // If send failed (rate limit, offline), queue persists for next flush
  }

  // ─── Core: Process error ───
  function processError(errorInfo) {
    const fp = errorFingerprint(errorInfo.message, errorInfo.source);
    if (isDuplicate(fp)) return;

    const severity = classifySeverity(errorInfo);
    const context = collectContext();

    const entry = {
      ...errorInfo,
      severity,
      context,
      fingerprint: fp,
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };

    // 1. Console log (always)
    console.error(`[ErrorTracker] ${severity.toUpperCase()}:`, errorInfo.message, entry);

    // 2. Save to localStorage log
    saveToLog(entry);

    // 3. Show toast (only for medium+ severity)
    if (severity !== CONFIG.SEVERITY.LOW) {
      showToast(errorInfo.message, severity);
    }

    // 4. Queue for GAS reporting
    addToQueue(entry);

    // 5. If critical or high, flush immediately
    if (severity === CONFIG.SEVERITY.CRITICAL || severity === CONFIG.SEVERITY.HIGH) {
      flushQueue();
    }
  }

  // ─── Global Error Handlers ───

  // Catch synchronous errors
  window.onerror = function (message, source, line, col, error) {
    processError({
      type: 'runtime_error',
      message: String(message),
      source: source || 'unknown',
      line: line || 0,
      col: col || 0,
      stack: error ? error.stack : 'N/A'
    });
    return false; // Don't suppress default console error
  };

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    processError({
      type: 'unhandled_rejection',
      message: reason ? (reason.message || String(reason)) : 'Unknown rejection',
      source: 'Promise',
      line: 0,
      col: 0,
      stack: reason && reason.stack ? reason.stack : 'N/A'
    });
  });

  // Catch resource loading errors (images, scripts, etc.)
  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window) {
      const tag = event.target.tagName || 'unknown';
      const src = event.target.src || event.target.href || 'unknown';
      processError({
        type: 'resource_error',
        message: `Failed to load ${tag}: ${src}`,
        source: src,
        line: 0,
        col: 0,
        stack: 'N/A'
      });
    }
  }, true); // Capture phase to catch resource errors

  // ─── Service Worker error messages ───
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'SW_ERROR') {
        processError({
          type: 'service_worker_error',
          message: event.data.error.message,
          source: event.data.error.filename || 'sw.js',
          line: event.data.error.lineno || 0,
          col: 0,
          stack: 'Service Worker context'
        });
      }
    });
  }

  // ─── Network error monitoring ───
  window.addEventListener('online', function () {
    // Flush queued errors when back online
    setTimeout(flushQueue, 2000);
  });

  // ─── Periodic flush ───
  flushTimer = setInterval(flushQueue, CONFIG.FLUSH_INTERVAL_MS);

  // ─── Rate limit reset ───
  setInterval(function () {
    rateLimitCount = 0;
  }, 60000);

  // ─── Public API (for manual error reporting) ───
  window.IVErrorTracker = {
    /**
     * Manually report an error
     * @param {string} message - Error description
     * @param {string} severity - 'low'|'medium'|'high'|'critical'
     * @param {object} extra - Additional context
     */
    report: function (message, severity, extra) {
      processError({
        type: 'manual_report',
        message: String(message),
        source: getPageName(),
        line: 0,
        col: 0,
        stack: new Error().stack || 'N/A',
        extra: extra || {}
      });
    },

    /**
     * Get error log from localStorage
     * @returns {Array} Error entries
     */
    getLog: function () {
      try {
        return JSON.parse(localStorage.getItem(CONFIG.LS_ERROR_LOG) || '[]');
      } catch (e) {
        return [];
      }
    },

    /**
     * Clear error log
     */
    clearLog: function () {
      localStorage.removeItem(CONFIG.LS_ERROR_LOG);
      localStorage.removeItem(CONFIG.LS_ERROR_QUEUE);
      console.log('[ErrorTracker] Log cleared');
    },

    /**
     * Force flush queued errors to GAS
     */
    flush: flushQueue,

    /**
     * Get current queue size
     */
    queueSize: function () {
      return getQueue().length;
    }
  };

  // ─── Initial flush on load ───
  window.addEventListener('load', function () {
    // Flush any queued errors from previous sessions
    setTimeout(flushQueue, 3000);
  });

  console.log('[ErrorTracker] Initialized — v1.0 | Page:', getPageName());
})();
