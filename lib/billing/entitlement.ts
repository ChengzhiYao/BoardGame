// 开房资格：白名单永久免费、否则需有局数额度。被邀请的访客（匿名/无额度）不走这里。
export interface Entitlement {
  canHost: boolean;
  reason: 'ok' | 'login' | 'no_credits';
  whitelisted: boolean;
  credits: number;
  email: string | null;
}

export async function getEntitlement(admin: any, user: any): Promise<Entitlement> {
  // 匿名或无邮箱（没用 Google 登录）→ 不能开房
  if (!user || user.is_anonymous || !user.email) {
    return { canHost: false, reason: 'login', whitelisted: false, credits: 0, email: user?.email || null };
  }
  // 确保有 profile 行
  const { data: had } = await admin.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!had) await admin.from('profiles').insert({ user_id: user.id, email: user.email });
  const { data: wl } = await admin.from('whitelist_emails').select('email').eq('email', user.email).maybeSingle();
  const { data: p } = await admin.from('profiles').select('credits, is_whitelisted, free_granted').eq('user_id', user.id).maybeSingle();
  const whitelisted = !!wl || !!p?.is_whitelisted;
  let credits = p?.credits || 0;
  // 每个账号一次性赠送 1 局免费额度（新老账号都发，只发一次；用 free_granted 标记防重复）
  if (!whitelisted && !p?.free_granted) {
    try {
      const { data: g } = await admin.from('profiles').update({ credits: credits + 1, free_granted: true }).eq('user_id', user.id).eq('free_granted', false).select('credits');
      if (g && g.length) credits = g[0].credits;
    } catch { /* free_granted 列未迁移时跳过 */ }
  }
  if (whitelisted) return { canHost: true, reason: 'ok', whitelisted: true, credits, email: user.email };
  if (credits > 0) return { canHost: true, reason: 'ok', whitelisted: false, credits, email: user.email };
  return { canHost: false, reason: 'no_credits', whitelisted: false, credits, email: user.email };
}
