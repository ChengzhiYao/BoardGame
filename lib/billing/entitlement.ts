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
  await admin.from('profiles').upsert({ user_id: user.id, email: user.email }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { data: wl } = await admin.from('whitelist_emails').select('email').eq('email', user.email).maybeSingle();
  const { data: p } = await admin.from('profiles').select('credits, is_whitelisted').eq('user_id', user.id).maybeSingle();
  const whitelisted = !!wl || !!p?.is_whitelisted;
  const credits = p?.credits || 0;
  if (whitelisted) return { canHost: true, reason: 'ok', whitelisted: true, credits, email: user.email };
  if (credits > 0) return { canHost: true, reason: 'ok', whitelisted: false, credits, email: user.email };
  return { canHost: false, reason: 'no_credits', whitelisted: false, credits, email: user.email };
}
