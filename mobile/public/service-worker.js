self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(payload.title || 'ETD 2026', {
    body: payload.body || '',
    icon: '/app/pwa-icon.png',
    badge: '/app/pwa-icon.png',
    data: { href: data.href || '/app/' },
    tag: data.notification_id || undefined,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || '/app/', self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin + '/app/')) {
        await client.focus();
        client.postMessage({ type: 'etd-notification-click', data: event.notification.data });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
