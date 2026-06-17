'use client';
// 会话辅助：确保当前浏览器有一个登录身份（匿名登录），可选写入昵称。
// 匿名登录 = 玩家不用注册，进来自动获得一个账号，会话存在 cookie 里，
// 服务端路由也能读到，从而知道"是谁"。
import { createClient } from './supabase/client';

export async function ensureSession(displayName?: string) {
  const supabase = createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error('匿名登录失败：' + error.message);
    user = data.user;
  }

  if (displayName && user) {
    await supabase.from('users').update({ display_name: displayName }).eq('id', user.id);
  }
  return user;
}

// Google 登录（用于"开房当主持"，可记住身份与付费状态）。
export async function signInWithGoogle(next = '/upgrade') {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw new Error('登录失败：' + error.message);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
