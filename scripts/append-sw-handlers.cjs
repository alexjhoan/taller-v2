// scripts/append-sw-handlers.cjs
// Post-build: inyecta handlers 'push' y 'notificationclick' en public/sw.js

const fs = require('fs');
const path = require('path');

console.log('[append-sw-handlers] START');

const SW_FILE = path.resolve('public/sw.js');

const PUSH_HANDLER = `
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const { title, body, order_id } = data;
    // order_id=0 => push de prueba: tag único para que cada push se muestre
    // como notificación NUEVA (con tag repetido Chrome reemplaza en silencio
    // y parece que "no llega"). requireInteraction solo para órdenes reales.
    const esPrueba = !order_id;
    const tag = esPrueba ? 'test-' + Date.now() : 'order-' + order_id;
    const url = order_id ? '/admin/dashboard?selectedOrderId=' + order_id : undefined;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: url ? { url } : undefined,
        requireInteraction: !esPrueba,
        tag,
      })
    );
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }
});
`;

const CLICK_HANDLER = `
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
`;

console.log('[append-sw-handlers] START');
console.log('[append-sw-handlers] SW_FILE:', SW_FILE);

if (!fs.existsSync(SW_FILE)) {
  throw new Error('SW no encontrado en ' + SW_FILE + '. ¿Corriste "npm run build"?');
}

let content = fs.readFileSync(SW_FILE, 'utf8');
console.log('[append-sw-handlers] SW length:', content.length);
console.log('[append-sw-handlers] Has push (single):', content.includes("self.addEventListener('push'"));
console.log('[append-sw-handlers] Has push (double):', content.includes('self.addEventListener("push"'));

// Idempotencia
if (content.includes("self.addEventListener('push'") || content.includes('self.addEventListener("push"')) {
  console.log('[append-sw-handlers] Handlers ya presentes, omitiendo.');
} else {
  content = content.trimEnd() + '\n' + PUSH_HANDLER + '\n' + CLICK_HANDLER + '\n';
  fs.writeFileSync(SW_FILE, content, 'utf8');
  console.log('[append-sw-handlers] Handlers push + notificationclick inyectados en', SW_FILE);
}

console.log('[append-sw-handlers] DONE');