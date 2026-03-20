// Service Worker — IV Drug Quick Reference PWA
// Version: 4.1.2
// กลุ่มงานเภสัชกรรม สถาบันประสาทวิทยา

const CACHE_NAME = ‘iv-drugref-v4.1.2’;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน
const ASSETS_TO_CACHE = [
‘./’,
‘./index.html’,
‘./calculator.html’,
‘./vanco-tdm.html’,
‘./manifest.json’,
‘./icons/icon-192x192.png’,
‘./icons/icon-512x512.png’,
‘./dashboard.html’
];

// Install — cache core assets
self.addEventListener(‘install’, event => {
event.waitUntil(
caches.open(CACHE_NAME).then(cache => {
console.log(’[SW] Caching core assets’);
return cache.addAll(ASSETS_TO_CACHE);
}).then(() => self.skipWaiting())
);
});

// Activate — ลบ cache เก่า
self.addEventListener(‘activate’, event => {
event.waitUntil(
caches.keys().then(keys => {
return Promise.all(
keys.filter(key => key !== CACHE_NAME).map(key => {
console.log(’[SW] Removing old cache:’, key);
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
self.addEventListener(‘fetch’, event => {
const url = new URL(event.request.url);

// Analytics + Google Fonts → ไม่แทรก ปล่อย browser จัดการเอง
if (url.hostname === ‘script.google.com’ || url.hostname.includes(‘googleapis.com’) || url.hostname.includes(‘gstatic.com’)) {
return;
}

// HTML → Stale-While-Revalidate
if (event.request.mode === ‘navigate’ || event.request.url.endsWith(’.html’)) {
event.respondWith(
caches.match(event.request).then(cachedResponse => {
const networkFetch = fetch(event.request).then(networkResponse => {
if (networkResponse && networkResponse.status === 200) {
const clone = networkResponse.clone();
caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
// แจ้ง client ว่ามี content ใหม่
self.clients.matchAll().then(clients => {
clients.forEach(client => {
client.postMessage({ type: ‘NEW_VERSION’ });
});
});
}
return networkResponse;
}).catch(() => {
return cachedResponse || new Response(‘Offline’, { status: 503 });
});
return cachedResponse || networkFetch;
})
);
return;
}

// Assets → Cache-first with age check
event.respondWith(
caches.match(event.request).then(cachedResponse => {
if (cachedResponse) {
const dateHeader = cachedResponse.headers.get(‘date’);
if (dateHeader) {
const age = Date.now() - new Date(dateHeader).getTime();
if (age > CACHE_MAX_AGE_MS) {
return fetch(event.request).then(networkResponse => {
if (networkResponse && networkResponse.status === 200) {
const clone = networkResponse.clone();
caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
}
return networkResponse;
}).catch(() => cachedResponse);
}
}
return cachedResponse;
}
return fetch(event.request).then(networkResponse => {
if (networkResponse && networkResponse.status === 200) {
const clone = networkResponse.clone();
caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
}
return networkResponse;
});
})
);
});