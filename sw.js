/* Service Worker — Bolão da Copa 2026 v2 (PWA)
 * Estratégia:
 *   - App shell (mesma origem): stale-while-revalidate (abre rápido + offline).
 *   - API do Apps Script: SEMPRE rede, nunca cacheia (dados sempre frescos).
 *   - CDN (twemoji): cache-first (bandeiras carregam rápido e ficam offline).
 */
const CACHE = 'bolao-copa-2026-v1';

const SHELL = [
  './',
  './index.html',
  './login.html',
  './cadastro.html',
  './classificacao-grupos.html',
  './palpites.html',
  './jogos.html',
  './ranking.html',
  './minha-pontuacao.html',
  './regulamento.html',
  './admin.html',
  './config.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // API do Apps Script: nunca interceptar/cachear (sempre rede)
  if (url.hostname.indexOf('script.google') >= 0) return;

  // App shell (mesma origem): stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fromNet = fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fromNet;
      })
    );
    return;
  }

  // CDNs estáticos (twemoji etc.): cache-first
  if (/jsdelivr|twemoji|cdnjs|unpkg|gstatic/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached))
    );
  }
});
