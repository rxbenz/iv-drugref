// ============================================================================
// IV Drug Reference PWA — Service Worker v5.0.0
// Based on V4.7.1 with modular file structure support
// Added: Push notifications, urgent alert background sync, separate drug data cache
// ============================================================================

const CACHE_NAME = 'iv-drugref-v5.0.0';
const DRUG_DATA_CACHE = 'iv-drugref-data-v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Urgent alert polling config
const ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbxsNFG4Ayq9OOYe53pEhd88_sA2saHwSjCph6EloEQ2K_f34DTeL1CmDrs0Q2X_csKP/exec';
const URGENT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let urgentPollTimer = null;

// Core assets (app shell) — cached on install
const ASSETS_TO_CACHE = [
  // Pages
  './',
  './index.html',
  './calculator.html',
  './vanco-tdm.html',
  './tdm.html',
  './renal-dosing.html',
  './compatibility.html',
  './dashboard.html',
  './admin.html',

  // Data
  './drugs-data.json',
  './manifest.json',

  // CSS modules
  './css/shared.css',
  './css/theme-light.css',
  './css/theme-dark.css',
  './css/index.css',
  './css/tdm.css',
  './css/renal-dosing.css',
  './css/calculator.css',
  './css/compatibility.css',
  './css/dashboard.css',
  './css/vanco-tdm.css',
  './css/admin.css',

  // JS modules
  './js/error-tracker.js',
  './js/core.js',
  './js/index.js',
  './js/tdm.js',
  './js/renal-dosing.js',
  './js/calculator.js',
  './js/compatibility.js',
  './js/dashboard.js',
  './js/vanco-tdm.js',
  './js/admin.js',
  './i18n.js',
  './translations-en.js',

  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// ─── Install: Cache core assets ───
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
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
