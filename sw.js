/* Service Worker ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â BolÃƒÆ’Ã‚Â£o da Copa 2026 v2 (PWA)
 * EstratÃƒÆ’Ã‚Â©gia:
 *   - App shell (mesma origem): stale-while-revalidate (abre rÃƒÆ’Ã‚Â¡pido + offline).
 *   - API do Apps Script: SEMPRE rede, nunca cacheia (dados sempre frescos).
 *   - CDN (twemoji): cache-first (bandeiras carregam rÃƒÆ’Ã‚Â¡pido e ficam offline).
 */
// 'VERSION' ÃƒÆ’Ã‚Â© carimbado a cada deploy pelo deploy_Bolao-Copa-2026-v2.ps1
// (muda o sw.js ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ o navegador detecta atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ mostra o banner "Nova versÃƒÆ’Ã‚Â£o").
const VERSION = '20260614193327';
const CACHE = 'bolao-copa-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './login.html',
  './cadastro.html',
  './classificacao-grupos.html',
  './palpites.html',
  './comprovante.html',
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
  // NÃƒÆ’Ã†â€™O chama skipWaiting aqui: o novo SW fica "esperando" atÃƒÆ’Ã‚Â© o usuÃƒÆ’Ã‚Â¡rio
  // tocar em "Atualizar" no banner (ver listener 'message' abaixo).
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
  );
});

// A pÃƒÆ’Ã‚Â¡gina pede a troca imediata quando o usuÃƒÆ’Ã‚Â¡rio aceita atualizar.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  // CDNs estÃƒÆ’Ã‚Â¡ticos (twemoji etc.): cache-first
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
