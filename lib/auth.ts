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

// Google 登录。治本：若当前已是匿名号，用 linkIdentity 把 Google 绑到"同一个" id
// 上（匿名号转正，保留游戏记录），而不是另开新号。只有在没有会话或绑定失败
// （例如该 Google 账号此前已单独注册过）时，才退回普通 OAuth 登录。
export async function signInWithGoogle(next = '/upgrade') {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data: { user } } = await supabase.auth.getUser();
  if (user && user.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
    if (!error) return; // 成功发起绑定（会跳转到 Google）
    // 绑定失败（如身份已存在/未开启手动绑定）→ 退回普通登录
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw new Error('登录失败：' + error.message);
}

// 邮箱验证码登录。治本：若当前是匿名号，用 updateUser 把邮箱绑到同一个 id（转正），
// 否则走普通 signInWithOtp 新建/登录。验证码两种类型都试一遍，谁对用谁。
export async function sendEmailOtp(email: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && user.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email });
    if (!error) return; // 发了"确认邮箱"验证码（转正）
    // 该邮箱可能已被其它账号占用 → 退回普通验证码登录
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}
export async function verifyEmailOtp(email: string, token: string) {
  const supabase = createClient();
  // 转正走的是 email_change，普通登录走 email；先试 email_change 再试 email。
  const a = await supabase.auth.verifyOtp({ email, token, type: 'email_change' });
  if (!a.error) return;
  const b = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (b.error) throw new Error(b.error.message);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
