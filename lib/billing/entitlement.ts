// 开房资格：白名单永久免费、否则需有局数额度。被邀请的访客（匿名/无额度）不走这里。
import { weekStart, monthStart, FREE_WEEKLY_SECONDS, MEMBER_PREMIUM_PLAYS, FREE_PLAYS_ON_SIGNUP, FREE_GRANTS_PER_IP, FREE_GRANT_WINDOW_DAYS } from '@/lib/pricing';
export interface Entitlement {
  canHost: boolean;
  reason: 'ok' | 'login' | 'no_credits';
  whitelisted: boolean;
  member: boolean;
  credits: number;
  email: string | null;
  freeSecondsUsed: number;
  freeSecondsLimit: number;
  memberPremiumUsed: number;
  memberPremiumLimit: number;
}

export async function getEntitlement(admin: any, user: any, ip?: string): Promise<Entitlement> {
  // 匿名或无邮箱（没用 Google 登录）→ 不能开房
  if (!user || user.is_anonymous || !user.email) {
    return { canHost: false, reason: 'login', whitelisted: false, member: false, credits: 0, email: user?.email || null, freeSecondsUsed: 0, freeSecondsLimit: FREE_WEEKLY_SECONDS, memberPremiumUsed: 0, memberPremiumLimit: MEMBER_PREMIUM_PLAYS };
  }
  // 确保有 profile 行
  const { data: had } = await admin.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!had) await admin.from('profiles').insert({ user_id: user.id, email: user.email });
  const { data: wl } = await admin.from('whitelist_emails').select('email').eq('email', user.email).maybeSingle();
  const { data: p } = await admin.from('profiles').select('credits, is_whitelisted, free_granted, member_until').eq('user_id', user.id).maybeSingle();
  const member = !!(p?.member_until && new Date(p.member_until) > new Date());
  let freeSecondsUsed = 0;
  try {
    const { data: fu } = await admin.from('free_usage').select('seconds').eq('user_id', user.id).eq('week_start', weekStart()).maybeSingle();
    freeSecondsUsed = fu?.seconds || 0;
  } catch {}
  let memberPremiumUsed = 0;
  if (member) {
    try {
      const { data: pu } = await admin.from('premium_usage').select('plays').eq('user_id', user.id).eq('month_start', monthStart()).maybeSingle();
      memberPremiumUsed = pu?.plays || 0;
    } catch {}
  }
  const whitelisted = !!wl || !!p?.is_whitelisted;
  let credits = p?.credits || 0;
  // 每个账号一次性赠送免费额度（只发一次；用 free_granted 标记防重复）。
  // 防刷：同一 IP 在窗口期内发放次数达上限后，新账号只标记 free_granted 但不送局数（0 局）。
  // 仅在拿得到 IP 的调用处（看首页 / 开房）才发放，避免无 IP 旁路绕过限额。
  if (!whitelisted && !p?.free_granted && ip) {
    try {
      const since = new Date(Date.now() - FREE_GRANT_WINDOW_DAYS * 86400000).toISOString();
      const { count } = await admin.from('ip_free_grants').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since);
      const overLimit = (count || 0) >= FREE_GRANTS_PER_IP;
      const grant = overLimit ? 0 : FREE_PLAYS_ON_SIGNUP;
      const { data: g } = await admin.from('profiles').update({ credits: credits + grant, free_granted: true }).eq('user_id', user.id).eq('free_granted', false).select('credits');
      if (g && g.length) {
        credits = g[0].credits;
        if (!overLimit) { try { await admin.from('ip_free_grants').insert({ ip, user_id: user.id }); } catch {} }
      }
    } catch { /* 相关表/列未迁移时跳过 */ }
  }
  // 会员：免费模式无限 + 豪华大作每月 N 次；用完豪华次数后可用购买的局数
  const canHost = whitelisted || (member && memberPremiumUsed < MEMBER_PREMIUM_PLAYS) || credits > 0;
  return {
    canHost, reason: canHost ? 'ok' : 'no_credits',
    whitelisted, member, credits, email: user.email,
    freeSecondsUsed, freeSecondsLimit: FREE_WEEKLY_SECONDS,
    memberPremiumUsed, memberPremiumLimit: MEMBER_PREMIUM_PLAYS,
  };
}
