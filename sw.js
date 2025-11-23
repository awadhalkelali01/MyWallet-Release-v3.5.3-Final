const CACHE_VERSION = "mywallet-v4.1";
const CACHE_NAME = `${CACHE_VERSION}-cache`;

const ASSETS = [
  "/",
  "/index.html",
  "/banks.html",
  "/gold.html",
  "/Zakat-overview.html",
  "/debts.html",
  "/settings.html",

  "/style.css",
  "/app.js",
  "/core_logic.js",
  "/banks.js",
  "/debts.js",
  "/gold.js",
  "/settings.js",
  "/manifest.json",

  "/icons/wallet-icon-192.png",
  "/icons/wallet-icon-512.png"
];


// Install Service Worker
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch Strategy: Cache First, Then Network
self.addEventListener("fetch", event => {
  // تجاهل طلبات POST أو طلبات خارجية
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then(networkResponse => {
          // تجاهل الردود غير الصالحة
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // تخزين نسخة من الملف
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // في حالة عدم وجود إنترنت وليس لدينا كاش
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});

// Activate and clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});


