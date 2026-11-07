// Service Worker de DESARROLLO (sin precache de workbox).
// public/sw.js es generado por npm run build (y los handlers push se
// inyectan con scripts/append-sw-handlers.cjs), por lo que en dev suele
// quedar desincronizado: precachea chunks con hashes de builds viejos y
// el install cuelga -> register()/serviceWorker.ready no resuelven nunca.
// Este SW minimalista se registra en desarrollo y expone los mismos
// handlers de push que el de producción.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const { title, body, order_id } = data;
    const tag = 'order-' + order_id;
    const url = order_id ? '/admin/dashboard?selectedOrderId=' + order_id : undefined;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: url ? { url } : undefined,
        requireInteraction: true,
        tag,
      })
    );
  } catch (e) {
    console.error('[SW-dev] Error parsing push data:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/admin/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
