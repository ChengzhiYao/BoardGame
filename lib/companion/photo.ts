// 生活照任务的签名:chat 接口决定要发照片时签一个 token,photo 接口校验后才真的出图(防止被随便调用刷钱)
import crypto from 'crypto';
const secret = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'companion';
export const PHOTO_DAILY_LIMIT = 4;
export function signPhoto(uid: string, desc: string, ts: number) {
  return crypto.createHmac('sha256', secret()).update(`${uid}|${ts}|${desc}`).digest('hex').slice(0, 32);
}
export function verifyPhoto(uid: string, desc: string, ts: number, sig: string) {
  if (!sig || Date.now() - ts > 10 * 60 * 1000) return false; // 10 分钟内有效
  const a = Buffer.from(signPhoto(uid, desc, ts)); const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export async function photosToday(admin: any, uid: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from('companion_msgs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('role', 'ai').like('text', '[photo:%').gte('created_at', since);
  return count || 0;
}
