const CACHE_NAME = 'produktiv-v40';
const ASSETS = [
  './',
  './index.html',
  './reset.html',
  './manifest.json',
  './css/style.css',
  './js/icons.js',
  './js/db.js',
  './js/calc.js',
  './js/gestures.js',
  './js/sync.js',
  './js/app.js',
  './js/today.js',
  './js/holidays.js',
  './js/planner.js',
  './js/ai.js',
  './js/native.js',
  './js/tasks.js',
  './js/calendar.js',
  './js/notes.js',
  './js/focus.js',
  './js/habits.js',
  './js/profile.js',
  './js/exerciseDb.js',
  './js/exercises.js',
  './js/fitnessExtras.js',
  './js/workoutBuilder.js',
  './js/charts.js',
  './js/workoutSession.js',
  './js/progress.js',
  './js/fitnessDashboard.js',
  './js/hubs.js',
  './js/search.js',
  './js/settings.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Nur eigene Dateien und Schriften cachen – Sync- und KI-Anfragen gehen immer direkt ins Netz.
  const url = new URL(event.request.url);
  const isFont = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !isFont) return;

  if (isFont) {
    // Schriften ändern sich nie: aus dem Cache, sonst holen
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); }
      return res;
    })));
    return;
  }

  // Eigene Dateien: erst Netz (ohne HTTP-Cache), dann Cache. So erscheinen neue Versionen sofort, offline läuft die App trotzdem.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
