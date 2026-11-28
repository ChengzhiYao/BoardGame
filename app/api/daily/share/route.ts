// 分享每日一汤成绩:每天第一次分享,送 1 局轻玩法(海龟汤/猫猫诅咒)免费局。每天只能领一次。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: p } = await admin.from('profiles').select('light_credits, share_reward_day, share_count').eq('user_id', user.id).maybeSingle();
  // 每次分享都记一笔(成就和经验用),奖励每天只给一次
  if (p) await admin.from('profiles').update({ share_count: (p.share_count || 0) + 1 }).eq('user_id', user.id);
  if (p && String(p.share_reward_day || '') === today) return NextResponse.json({ ok: true, granted: false, credits: p.light_credits || 0 });
  const credits = (p?.light_credits || 0) + 1;
  if (p) {
    // 带上旧的日期做条件,防止同时点两次领两份
    let q = admin.from('profiles').update({ light_credits: credits, share_reward_day: today }).eq('user_id', user.id);
    q = p.share_reward_day ? q.eq('share_reward_day', p.share_reward_day) : q.is('share_reward_day', null);
    const { data: up } = await q.select('light_credits');
    if (!up || !up.length) return NextResponse.json({ ok: true, granted: false, credits: p.light_credits || 0 });
  } else {
    const { error } = await admin.from('profiles').insert({ user_id: user.id, light_credits: 1, share_reward_day: today, share_count: 1 });
    if (error) return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, granted: true, credits });
}
