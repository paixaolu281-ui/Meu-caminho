'use strict';
/* Meu Caminho — service worker v6.
   - Cache novo "meu-caminho-v6"; caches antigos (v1, v2…) são apagados na ativação.
   - skipWaiting + clients.claim: a nova versão assume sem esperar o app fechar.
   - Páginas (index.html): rede primeiro, cache como reserva offline (evita ficar preso em versão antiga).
   - Demais arquivos: cache primeiro, atualizando em segundo plano. */
const CACHE = 'meu-caminho-v6';
const ARQUIVOS = ['./', './index.html', './style.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARQUIVOS.map(a => fetch(a, { cache: 'reload' }).then(r => { if (r.ok) return c.put(a, r); }).catch(() => { })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const guarda = res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; };
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(guarda).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(cached => {
    const rede = fetch(req).then(guarda).catch(() => cached);
    return cached || rede;
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(l => (l.length ? l[0].focus() : self.clients.openWindow('./index.html'))));
});
