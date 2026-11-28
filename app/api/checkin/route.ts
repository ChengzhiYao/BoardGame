// 每日打卡:每天一次;每累计 5 次送 1 次免费豪华局(跑团 / 剧本杀 / 血染钟楼);也算经验和成就。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { CHECKIN_EVERY, streakFrom } from '@/lib/progress';
export const dynamic = 'force-dynamic';

// 用玩家本地的日期(客户端传),但只接受跟服务器 UTC 日期相差一天以内的
function dayOf(req: Request, body?: any): string {
  const q = String(body?.day || new URL(req.url).searchParams.get('day') || '');
  const now = Date.now(); const ok = [-1, 0, 1].map((k) => new Date(now + k * 86400000).toISOString().slice(0, 10));
  return /^\d{4}-\d{2}-\d{2}$/.test(q) && ok.includes(q) ? q : ok[1];
}

async function status(admin: any, userId: string, today: string) {
  const { data: rows } = await admin.from('checkins').select('day').eq('user_id', userId).order('day', { ascending: false }).limit(400);
  const days = (rows || []).map((r: any) => String(r.day));
  const total = days.length; const st = streakFrom(days, today);
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.parse(today + 'T12:00:00Z') - (6 - i) * 86400000).toISOString().slice(0, 10); return { day: d, done: days.includes(d) }; });
  return { checkedToday: days.includes(today), total, streak: st.current, best: st.best, week, toNext: CHECKIN_EVERY - (total % CHECKIN_EVERY), every: CHECKIN_EVERY };
}

export async function GET(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: true, loggedIn: false });
  const admin = createAdminClient();
  return NextResponse.json({ ok: true, loggedIn: true, ...(await status(admin, user.id, dayOf(req))) });
}

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient(); const today = dayOf(req, body);
  const { error } = await admin.from('checkins').insert({ user_id: user.id, day: today });
  const already = !!error; // 主键冲突 = 今天已经打过
  const st = await status(admin, user.id, today);
  let reward = 0, credits: number | null = null;
  if (!already) {
    // 该发几次奖励就补到几次(防止并发重复发)
    const owed = Math.floor(st.total / CHECKIN_EVERY);
    const { data: p } = await admin.from('profiles').select('credits, checkin_rewards').eq('user_id', user.id).maybeSingle();
    const given = p?.checkin_rewards || 0;
    if (owed > given) {
      reward = owed - given;
      if (p) {
        const { data: up } = await admin.from('profiles').update({ credits: (p.credits || 0) + reward, checkin_rewards: owed }).eq('user_id', user.id).eq('checkin_rewards', given).select('credits');
        if (!up?.length) reward = 0; else credits = up[0].credits;
      } else { await admin.from('profiles').insert({ user_id: user.id, credits: reward, checkin_rewards: owed }); credits = reward; }
    }
  }
  return NextResponse.json({ ok: true, already, reward, credits, ...st });
}
