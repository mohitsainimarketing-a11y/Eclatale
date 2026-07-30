self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || 'Eclatale', {
    body: data.message || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: { url: data.url || 'https://eclatale.com/dashboard' },
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
