// AI 陪伴专用 Service Worker(作用范围只有 /companion),
// 这样推送通知归属于"AI 陪伴"桌面应用,而不是谜夜。
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || '新消息';
  const url = data.url || '/companion?src=app';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/companion-192.png',   // 大图标:TA 的头像,像微信那样
      badge: '/companion-badge.png',              // 状态栏小图标:透明底单色聊天气泡
      data: { url },
      tag: 'companion',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/companion?src=app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes('/companion') && 'focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
