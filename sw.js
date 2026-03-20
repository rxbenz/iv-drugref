// Service Worker — IV Drug Quick Reference PWA
// Version: 3.0.0
// กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา

const CACHE_NAME = 'iv-drugref-v3.0.0';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './dashboard.html'
];

// Install — cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate — ลบ cache เก่า
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML → Stale-While-Revalidate (ส่ง cache ทันที แล้วดึง network มาอัปเดตเบื้องหลัง)
// - Analytics/Fonts → Network only (ไม่ cache)
// - Assets → Cache-first with 7-day expiry
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Analytics + Google Fonts → ไม่แทรก ปล่อย browser จัดการเอง
  if (url.hostname === 'script.google.com' || url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    return;
  }

  // HTML → Stale-While-Revalidate
  if (event.request.mode === 'navigate' || event.request.url.endsWith('.html')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const networkFetch = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            // แจ้ง client ว่ามี content ใหม่
            if (cachedResponse) {
              self.clients.matchAll().then(clients => {
                clients.forEach(c => c.postMessage({ type: 'UPDATE_AVAILABLE' }));
              });
            }
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // Other assets → Cache-first with expiry check
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // เช็คอายุ cache จาก date header
        const dateStr = cached.headers.get('date');
        if (dateStr) {
          const age = Date.now() - new Date(dateStr).getTime();
          if (age > CACHE_MAX_AGE_MS) {
            // หมดอายุ → ดึงใหม่เบื้องหลัง แต่ส่ง cache ไปก่อน
            fetch(event.request).then(fresh => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, fresh));
              }
            }).catch(() => {});
          }
        }
        return cached;
      }
      // ไม่มี cache → ดึงจาก network
      return fetch(event.request).then(response => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// รับ message จาก client
self.addEventListener('message', event => {
  // บังคับ clear cache แล้วดึงใหม่
  if (event.data === 'FORCE_UPDATE') {
    console.log('[SW] Force update requested');
    caches.delete(CACHE_NAME).then(() => {
      return caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE));
    }).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'UPDATE_COMPLETE' }));
      });
    });
  }

  // เช็ค index.html ใหม่จาก server
  if (event.data === 'CHECK_UPDATE') {
    fetch('./index.html', { cache: 'no-store' }).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(new Request('./index.html'), clone));
        self.clients.matchAll().then(clients => {
          clients.forEach(c => c.postMessage({ type: 'UPDATE_AVAILABLE' }));
        });
      }
    }).catch(() => {});
  }
});
