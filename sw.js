// ============================================================================
// IV Drug Reference PWA — Service Worker v5.17.5
// Based on V4.7.1 with modular file structure support
// Added: Push notifications, urgent alert background sync, separate drug data cache
// Changed: version.json excluded from cache (always network) for force-update support
// v5.7.5: Global ESC key to close modals/sheets/overlays
// v5.9.3: Pediatric Safety Guard (blocks adult-only Bayesian TDM in <18 yr;
//         warns for calculator/renal-dosing). Reconciles version drift.
// v5.10.0: Vancomycin PK coefficient correction (Phase 2b) — all 5 models
//          re-derived from primary papers; fixes inflated AUC (under-dosing).
// v5.11.0: Pediatric vancomycin Bayesian unblocked for age 1-17 via Colin 2019
//          model (age-routed); infant <1 still blocked. Adult path unchanged.
// v5.11.1: Peds peak/trough disclaimer (1-comp approximation; AUC₂₄ is the
//          reliable peds target). UI-only; no calc change.
// v5.12.0: 2-comp PK engine (peak/trough fidelity); shared pk-models.js +
//          VancoPK.engine; compatibility salt-key disambiguation (no cross-salt
//          leak); XSS hardening (IVDrugRef.escHtml); prod console.log strip;
//          automated clinical test suite + CI.
// v5.13.0: Compatibility UI redesign — unified search-driven Check (typeahead +
//          chips; 2 drugs = pair detail, 3+ = grouped-by-status); replaces the
//          3-tab/dropdown layout. Mobile-first. Compat render now escaped.
// v5.14.0: IV fluids as selectable entities + drug–fluid DILUENT compatibility
//          (NSS/½NS/D5W/D5NSS/D5N2S/RL + D10W/SWFI/balanced). Derived only from
//          curated DB + drug .x/.y fields; no-data→verify. fluidKey fixes the
//          D5W/D10W digit-strip key collision. Badged as admixture (not Y-site).
// v5.15.0: Seed pharmacist-reviewed drug–fluid diluent pairs into CURATED
//          (32 pairs: amiodarone/nitroprusside/propofol D5W-only, tenecteplase &
//          hydralazine + dextrose = incompat, albumin+SWFI, RL incompatibilities,
//          furosemide/norepi/epi cautions). Sourced (docs/drug-fluid-compatibility.md).
// v5.15.1: Fix — drug–fluid pairs vanished after the Google-Sheet compat sync.
//          rebuildCuratedMap() rebuilt CURATED_MAP from sheet (drug-drug only),
//          wiping the code-side fluid pairs. Moved them to FLUID_CURATED +
//          re-applied (fill-if-missing) after every (re)build.
// v5.15.2: Version-display fix — stale header badges (TDM v1.0, Vanco v2.0,
//          Compat v5.0) + core.js VERSION (was 5.11.1) now driven by a single
//          source: core.js fills [data-app-version] from IVDrugRef.VERSION.
// v5.15.3: Safety + UX. C1: block calc on blank patient fields (validate raw
//          before defaulting; wired vanco-tdm). UX: answer-first drug cards
//          (diluent+rate line), "ตรวจ IV Compatibility" cross-link, and ?search=
//          /?drug= deep-link support (fixes the FAB quick-search link).
// v5.16.0: Allergy cross-reactivity feature + backend. Allergy page reads
//          admin-edited data from Google Sheet (cache+fallback); admin Allergy
//          tab (seed/CRUD); analytics→dashboard 🛡️ tab; fixed lowercase
//          analytics event names (dose_calc/tdm_usage/... now reach their
//          sheets); renal page reads from Sheet; admin Settings zero-config
//          (built-in Client ID + Apps Script URL defaults).
// v5.17.0: Navigation/footer redesign (P3.4). One shared collapsible left-rail
//          drawer (site-chrome.js/.css) across all 7 user pages — replaces the
//          per-page bottom-nav (open by default, swipe/scroll/tap to hide).
//          Removed index's redundant header tool-cards; compact footer + info
//          modal (disclaimer/license/refs) injected on sub-pages with version
//          single-sourced from IVDrugRef.VERSION. Allergen search starts empty
//          with a guide prompt.
// v5.17.1: Nav polish — left rail now PERSISTS open/closed across page nav
//          (sessionStorage; no more "disappears, press back"); content is pushed
//          right (no overlap); removed auto-hide-on-scroll + scrim (hide only via
//          ‹‹ / swipe-left / Esc). Forces SW cache refresh app-wide.
// v5.17.2: Allergy picker — live typeahead results list (shows matches as you
//          type, Enter picks the top, arrows navigate) + group chips that
//          filter & show the list. Replaces the native <select> that only
//          revealed results once opened.
// v5.17.3: Fix allergy group-chip flicker (chip rebuild detached the click
//          target so the outside-click handler closed the list) — now updates
//          chip state in place + stops propagation; the list stays open.
//          Sub-page headers decluttered: removed the back/cross-link buttons
//          that duplicated the left rail.
// v5.17.4: site-chrome nav/footer/About modal now render their own TH/EN text
//          (from IVDrugRefI18n) + marked data-i18n-done so the global i18n engine
//          no longer half-translates them; fixed the duplicated "Neurological
//          Institute of Thailand" in the About box.
// v5.17.5: Dashboard analytics fetch is now cache-busted (?_=ts + no-store) so
//          new Sheet rows show on Refresh instead of a stale cached response;
//          load toast shows backend GAS version + server time for diagnosis.
// ============================================================================

const CACHE_NAME = 'iv-drugref-v5.17.5';
const DRUG_DATA_CACHE = 'iv-drugref-data-v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Urgent alert polling config
const ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec';
const URGENT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let urgentPollTimer = null;

// Core assets (app shell) — cached on install
// Note: CSS and page-specific JS are inlined into HTML by the build system.
// Only list files that actually exist in the dist/ output.
const ASSETS_TO_CACHE = [
  // Pages (CSS & JS are inlined by build.js)
  './',
  './index.html',
  './calculator.html',
  './vanco-tdm.html',
  './tdm.html',
  './renal-dosing.html',
  './compatibility.html',
  './allergy.html',
  './dashboard.html',
  './admin.html',

  // Data & config
  './drugs-data.json',
  './manifest.json',

  // Standalone JS (not inlined — loaded separately)
  './error-tracker.js',
  './i18n.js',
  './translations-en.js',

  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// ─── Install: Cache core assets (wait for user prompt before activating) ───
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
    // No skipWaiting() — new SW waits until user accepts the update prompt
  );
});

// ─── Activate: Clean old caches + start urgent polling ───
self.addEventListener('activate', (e) => {
  const KEEP_CACHES = [CACHE_NAME, DRUG_DATA_CACHE, 'iv-drugref-urgent-meta'];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !KEEP_CACHES.includes(k))
          .map(k => {
            console.log('[SW] Removing old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => {
        startUrgentPolling();
        return self.clients.claim();
      })
  );
});

// ─── Fetch: Smart caching strategies ───
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip Google Apps Script & external API calls (never cache)
  if (url.hostname === 'script.google.com' ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // version.json must ALWAYS go to network (for force-update detection)
  if (e.request.url.includes('version.json')) {
    return;
  }

  // Strategy for drugs-data.json: Network-first with cache fallback
  // This ensures users get fresh data when online but still work offline
  if (e.request.url.includes('drugs-data.json')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DRUG_DATA_CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(e.request);
        })
    );
    return;
  }

  // Strategy for HTML pages: Stale-while-revalidate
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
              // Notify clients of new version
              self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                  client.postMessage({ type: 'NEW_VERSION' });
                });
              });
            }
            return response;
          })
          .catch(() => cached || new Response('Offline', { status: 503 }));

        return cached || networkFetch;
      })
    );
    return;
  }

  // Strategy for other assets: Cache-first with network fallback + stale check
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Check if cache is stale
        const dateHeader = cached.headers.get('date');
        if (dateHeader) {
          const age = Date.now() - new Date(dateHeader).getTime();
          if (age > CACHE_MAX_AGE_MS) {
            // Stale: try network, fallback to stale cache
            return fetch(e.request)
              .then(response => {
                if (response && response.status === 200) {
                  const clone = response.clone();
                  caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
              })
              .catch(() => cached);
          }
        }
        return cached;
      }

      // Not in cache: fetch from network and cache
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Push Notification Handler ───
// Receives push messages from server (or triggered by urgent alert polling)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: '⚠️ IV DrugRef Alert', body: 'มี urgent drug update', type: 'safety_alert', severity: 'high' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const severityIcons = {
    critical: '🚨',
    high: '⚠️',
    medium: 'ℹ️'
  };
  const icon = severityIcons[data.severity] || '⚠️';

  const options = {
    body: data.body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    tag: 'urgent-alert-' + (data.id || Date.now()),
    renotify: true,
    requireInteraction: data.severity === 'critical',
    vibrate: data.severity === 'critical' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: {
      url: './',
      alertId: data.id,
      type: data.type,
      drugName: data.drugName,
      severity: data.severity
    },
    actions: [
      { action: 'view', title: '📋 ดูรายละเอียด' },
      { action: 'dismiss', title: 'ปิด' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(`${icon} ${data.title}`, options)
  );
});

// ─── Notification Click Handler ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open app or focus existing window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Try to focus an existing window
        for (const client of clients) {
          if (client.url.includes('index.html') || client.url.endsWith('/')) {
            client.postMessage({
              type: 'URGENT_ALERT_CLICK',
              alertId: event.notification.data.alertId,
              drugName: event.notification.data.drugName
            });
            return client.focus();
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(event.notification.data.url || './');
      })
  );
});

// ─── Message Handler: Urgent alert commands from client ───
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'START_URGENT_POLL':
      startUrgentPolling();
      break;
    case 'STOP_URGENT_POLL':
      stopUrgentPolling();
      break;
    case 'CHECK_URGENT_NOW':
      checkUrgentAlerts();
      break;
    case 'SHOW_URGENT_NOTIFICATION':
      showUrgentNotification(event.data.alert);
      break;
  }
});

// ─── Urgent Alert Polling (Background) ───
function startUrgentPolling() {
  if (urgentPollTimer) clearInterval(urgentPollTimer);
  console.log('[SW] Starting urgent alert polling (every 5 min)');
  checkUrgentAlerts(); // check immediately
  urgentPollTimer = setInterval(() => checkUrgentAlerts(), URGENT_POLL_INTERVAL_MS);
}

function stopUrgentPolling() {
  if (urgentPollTimer) {
    clearInterval(urgentPollTimer);
    urgentPollTimer = null;
    console.log('[SW] Stopped urgent alert polling');
  }
}

async function checkUrgentAlerts() {
  try {
    // Read last check timestamp from a simple indexedDB-like approach via cache
    const lastCheck = await getLastUrgentCheck();
    const url = `${ANALYTICS_URL}?action=checkUrgentAlerts&since=${lastCheck}`;

    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return;

    const result = await response.json();
    if (!result.alerts || !result.alerts.length) return;

    // Save server time for next check
    if (result.serverTime) {
      await saveLastUrgentCheck(result.serverTime);
    }

    // Show notifications for NEW alerts only
    const newAlerts = result.alerts.filter(a => a.isNew);
    for (const alert of newAlerts) {
      await showUrgentNotification(alert);
    }

    // Notify all clients about active alerts (new or existing)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'URGENT_ALERTS_UPDATE',
        alerts: result.alerts,
        hasNew: result.hasNew
      });
    });

  } catch (err) {
    console.warn('[SW] Urgent alert check failed:', err.message);
  }
}

async function showUrgentNotification(alert) {
  const severityIcons = { critical: '🚨', high: '⚠️', medium: 'ℹ️' };
  const icon = severityIcons[alert.severity] || '⚠️';

  const typeLabels = {
    recall: '🔴 Drug Recall',
    safety_alert: '⚠️ Safety Alert',
    shortage: '📦 Drug Shortage',
    formulation_change: '💊 Formulation Change'
  };

  await self.registration.showNotification(
    `${icon} ${typeLabels[alert.type] || 'Drug Alert'}: ${alert.drugName || 'IV DrugRef'}`,
    {
      body: alert.title + (alert.message ? '\n' + alert.message : ''),
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-96x96.png',
      tag: 'urgent-' + alert.id,
      renotify: true,
      requireInteraction: alert.severity === 'critical',
      vibrate: alert.severity === 'critical' ? [300, 100, 300, 100, 300] : [200, 100, 200],
      data: {
        url: './',
        alertId: alert.id,
        type: alert.type,
        drugName: alert.drugName,
        severity: alert.severity
      },
      actions: [
        { action: 'view', title: '📋 ดูรายละเอียด' },
        { action: 'dismiss', title: 'ปิด' }
      ]
    }
  );
}

// ─── Simple timestamp storage via Cache API ───
async function getLastUrgentCheck() {
  try {
    const cache = await caches.open('iv-drugref-urgent-meta');
    const resp = await cache.match('last-check');
    if (resp) return parseInt(await resp.text()) || 0;
  } catch (e) {}
  return 0;
}

async function saveLastUrgentCheck(ts) {
  try {
    const cache = await caches.open('iv-drugref-urgent-meta');
    await cache.put('last-check', new Response(String(ts)));
  } catch (e) {}
}

// ─── Error Handling in Service Worker ───
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.message);
  // Notify all clients about SW error
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_ERROR',
        error: {
          message: event.message || 'Unknown SW error',
          filename: event.filename || 'sw.js',
          lineno: event.lineno || 0
        }
      });
    });
  });
});

self.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  console.error('[SW] Unhandled rejection:', reason);
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_ERROR',
        error: {
          message: reason ? (reason.message || String(reason)) : 'Unknown SW rejection',
          filename: 'sw.js',
          lineno: 0
        }
      });
    });
  });
});
