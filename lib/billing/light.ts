// 轻玩法计费：海龟汤每天 2 局免费、猫猫诅咒每天 1 局免费；之后 $1 一局，或 $10 买 2 小时所有轻玩法随便玩。
// 会员：每日免费局之外，再有每周 2 小时轻玩法时长。真心话：每周 2 小时。身价场：永久免费。
import { getEntitlement } from '@/lib/billing/entitlement';

export const DAILY_FREE: Record<string, number> = { soup: 2, mcc: 1 };
export const PER_GAME_MODES = Object.keys(DAILY_FREE);
export const WEEKLY_MODES = ['td'];
export const FOREVER_FREE = ['market'];
export const LIGHT_PRICE = 100;   // 美分：$1 一局
export const PASS_PRICE = 1000;   // 美分：$10 两小时
export const PASS_HOURS = 2;

export const today = () => new Date().toISOString().slice(0, 10);

export type Via = 'whitelist' | 'pass' | 'daily' | 'member_week' | 'credit';

export async function lightStatus(admin: any, user: any, mode: string) {
  const ent = await getEntitlement(admin, user);
  const { data: p } = await admin.from('profiles').select('light_credits, pass_until').eq('user_id', user.id).maybeSingle();
  const { data: d } = await admin.from('daily_free').select('plays').eq('user_id', user.id).eq('day', today()).eq('mode', mode).maybeSingle();
  const total = DAILY_FREE[mode] || 0;
  const passUntil = p?.pass_until && new Date(p.pass_until) > new Date() ? p.pass_until : null;
  return {
    login: !!ent.email,
    whitelisted: ent.whitelisted,
    member: ent.member,
    dailyTotal: total,
    freeLeft: Math.max(0, total - (d?.plays || 0)),
    credits: p?.light_credits || 0,
    passUntil,
    memberWeekLeft: ent.member ? Math.max(0, ent.freeSecondsLimit - ent.freeSecondsUsed) : 0,
  };
}

export function decide(st: Awaited<ReturnType<typeof lightStatus>>): Via | null {
  if (st.whitelisted) return 'whitelist';
  if (st.passUntil) return 'pass';
  if (st.freeLeft > 0) return 'daily';
  if (st.member && st.memberWeekLeft > 0) return 'member_week';
  if (st.credits > 0) return 'credit';
  return null;
}

export async function consume(admin: any, userId: string, mode: string, via: Via) {
  if (via === 'daily') {
    const { data: d } = await admin.from('daily_free').select('plays').eq('user_id', userId).eq('day', today()).eq('mode', mode).maybeSingle();
    await admin.from('daily_free').upsert({ user_id: userId, day: today(), mode, plays: (d?.plays || 0) + 1 }, { onConflict: 'user_id,day,mode' });
  } else if (via === 'credit') {
    const { data: p } = await admin.from('profiles').select('light_credits').eq('user_id', userId).maybeSingle();
    await admin.from('profiles').update({ light_credits: Math.max(0, (p?.light_credits || 0) - 1) }).eq('user_id', userId);
  }
}

export const PAY_ERROR = { error: '今天的免费局用完了', reason: 'light_pay' };
