// Service Worker para PWA - PelADM
const APP_VERSION = '2.1.0';
const CACHE_NAME = `peladm-v${APP_VERSION}`;
const CACHE_ASSETS = `peladm-assets-v${APP_VERSION}`;

// URLs importantes para cachear (funcionam offline)
const urlsToCache = [
  '/',
  '/login',
  '/cadastro',
  '/cadastro-free',
  '/sorteio',
  '/fila',
  '/page-fila',
  '/regras',
  '/usuarios',
  '/manifest.json'
];

// Instalação do Service Worker - força ativação imediata
self.addEventListener('install', (event) => {
  console.log(`[SW] Instalando versão ${APP_VERSION}`);
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Cache de páginas aberto');
        return cache.addAll(urlsToCache);
      }),
      caches.open(CACHE_ASSETS).then((cache) => {
        console.log('[SW] Cache de assets aberto');
        // Assets serão adicionados conforme forem sendo usados
        return Promise.resolve();
      })
    ])
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
          if (cacheName !== CACHE_NAME && cacheName !== CACHE_ASSETS) {
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

// Estratégia híbrida: Cache First para páginas/assets, Network First para API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora requisições que não são GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignora requisições para APIs externas (Supabase, Google Ads, etc)
  if (url.origin !== location.origin && 
      !url.hostname.includes('supabase') &&
      !url.hostname.includes('googlesyndication')) {
    return;
  }
  
  // Para páginas HTML e assets estáticos: Cache First (funciona offline)
  if (request.destination === 'document' || 
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image' ||
      request.destination === 'font') {
    
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Servindo do cache:', request.url);
            
            // Atualiza cache em background (stale-while-revalidate)
            fetch(request).then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(request.destination === 'document' ? CACHE_NAME : CACHE_ASSETS)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  });
              }
            }).catch(() => {
              // Falhou ao atualizar, mas não importa pois já temos no cache
            });
            
            return cachedResponse;
          }
          
          // Não está no cache, busca da rede
          return fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(request.destination === 'document' ? CACHE_NAME : CACHE_ASSETS)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          });
        })
        .catch(() => {
          // Offline e não está no cache - retorna página offline customizada
          if (request.destination === 'document') {
            return new Response(
              '<html><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h1>📱 Modo Offline</h1><p>Esta página ainda não está disponível offline.</p><p>Conecte-se à internet para acessar.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        })
    );
    return;
  }
  
  // Para requisições de API (Supabase): Network First (tenta online primeiro)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Salva response em cache apenas se for bem sucedida
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_ASSETS)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Se falhar, tenta buscar do cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] API offline - usando cache:', request.url);
            return cachedResponse;
          }
          // Não tem no cache, retorna erro
          return new Response(
            JSON.stringify({ error: 'Offline - dados não disponíveis em cache' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        });
      })
  );
});

// Verifica atualizações periodicamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
