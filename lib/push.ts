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

export function pushConfigured() { init(); return ready; }

// 详细版:返回失败原因,方便排查
export async function sendPushDetailed(sub: { endpoint: string; p256dh: string; auth: string }, payload: any): Promise<{ status: 'ok' | 'gone' | 'fail'; code?: number; error?: string }> {
  init();
  if (!ready) return { status: 'fail', error: 'VAPID 密钥没配置(NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)' };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      // high = 安卓省电(Doze)时也尽快送达;normal 会被系统拖很久甚至合并丢掉
      { urgency: 'high', TTL: 6 * 3600 }
    );
    return { status: 'ok' };
  } catch (e: any) {
    const code = e?.statusCode;
    if (code === 404 || code === 410) return { status: 'gone', code }; // 订阅失效
    return { status: 'fail', code, error: String(e?.body || e?.message || e).slice(0, 200) };
  }
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: any): Promise<'ok' | 'gone' | 'fail'> {
  return (await sendPushDetailed(sub, payload)).status;
}
