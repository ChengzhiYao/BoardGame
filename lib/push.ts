// Web Push 发送封装（服务端）。需要 VAPID 密钥（环境变量）。
import webpush from 'web-push';

let ready = false;
function init() {
  if (ready) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mystnight.com';
  if (pub && priv) { webpush.setVapidDetails(subject, pub, priv); ready = true; }
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: any): Promise<'ok' | 'gone' | 'fail'> {
  init();
  if (!ready) return 'fail';
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return 'ok';
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) return 'gone'; // 订阅失效
    return 'fail';
  }
}
