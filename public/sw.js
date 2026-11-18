const VERSION = 'mystnight-v2';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => {});

// 主动型 AI 陪伴：收到服务器推送 → 显示通知
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || '夜';
  const body = data.body || '';
  const url = data.url || '/companion';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/companion-192.png',
      badge: '/companion-badge.png',
      data: { url },
      tag: 'companion',
      renotify: true,
    })
  );
});

// 点通知 → 打开/聚焦陪伴页
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/companion';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
