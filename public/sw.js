// Service Worker para PWA - PelADM
const APP_VERSION = '2.1.0';
const CACHE_NAME = `peladm-v${APP_VERSION}`;
const urlsToCache = [
  '/',
  '/login',
  '/cadastro-free',
  '/manifest.json'
];

// Instalação do Service Worker - força ativação imediata
self.addEventListener('install', (event) => {
  console.log(`[SW] Instalando versão ${APP_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Força o SW a ser ativado imediatamente
        return self.skipWaiting();
      })
  );
});

// Ativação do Service Worker - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log(`[SW] Ativando versão ${APP_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Força o SW a controlar todas as páginas imediatamente
      return self.clients.claim();
    })
    .then(() => {
      // Notifica todas as páginas abertas sobre a nova versão
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Estratégia: Network First (sempre busca da rede primeiro, cache apenas como fallback)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone da resposta para armazenar no cache
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tenta buscar do cache
        return caches.match(event.request);
      })
  );
});

// Verifica atualizações periodicamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
