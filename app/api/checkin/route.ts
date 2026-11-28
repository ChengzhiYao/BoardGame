// 每日签到:每天一次。30 次一轮,每 2 次小奖(经验)、每 5 次大奖(头像框 / 动态背景 / 免费局),规则在 lib/progress。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ROUND, ROUND_NODES, rewardAt, gameNodesUpTo, posOf, streakFrom, FRAMES, BGS } from '@/lib/progress';
export const dynamic = 'force-dynamic';

// 用玩家本地的日期(客户端传),但只接受跟服务器 UTC 日期相差一天以内的
function dayOf(req: Request, body?: any): string {
  const q = String(body?.day || new URL(req.url).searchParams.get('day') || '');
  const now = Date.now(); const ok = [-1, 0, 1].map((k) => new Date(now + k * 86400000).toISOString().slice(0, 10));
  return /^\d{4}-\d{2}-\d{2}$/.test(q) && ok.includes(q) ? q : ok[1];
}

function label(r: ReturnType<typeof rewardAt>) {
  if (!r) return null;
  if (r.kind === 'frame') { const f = FRAMES.find((x) => x.id === r.id); return { ...r, zh: `头像框「${f?.zh}」`, en: `Frame: ${f?.en}`, css: f?.css }; }
  if (r.kind === 'bg') { const b = BGS.find((x) => x.id === r.id); return { ...r, zh: `动态背景「${b?.zh}」`, en: `Background: ${b?.en}`, css: b?.swatch, name: b?.zh, nameEn: b?.en }; }
  if (r.kind === 'light') return { ...r, zh: `免费海龟汤 ×${r.count}`, en: `${r.count} free light games` };
  if (r.kind === 'game') return { ...r, zh: `免费跑团 / 剧本杀 ×${r.count}`, en: `${r.count} free premium game` };
  return { ...r, zh: `经验 +${r.xp}`, en: `+${r.xp} XP` };
}

async function status(admin: any, userId: string, today: string) {
  const { data: rows } = await admin.from('checkins').select('day').eq('user_id', userId).order('day', { ascending: false }).limit(2000);
  const days = (rows || []).map((r: any) => String(r.day));
  const total = days.length; const st = streakFrom(days, today); const checkedToday = days.includes(today);
  // 本轮:已经签了 total 次;如果今天还没签,下一次是第 total+1 次
  const cur = checkedToday ? total : total + 1;
  const start = cur - posOf(cur); // 本轮开始前已经签了几次
  const nodes = ROUND_NODES.map((nd) => ({ n: nd.n, big: nd.big, done: start + nd.n <= total, reward: label(rewardAt(start + nd.n)) }));
  const next = nodes.find((x) => !x.done) || null; const nextBig = nodes.find((x) => !x.done && x.big) || null;
  return { checkedToday, total, round: Math.floor(start / ROUND) + 1, inRound: total - start, roundLen: ROUND, streak: st.current, best: st.best, nodes, next, nextBig };
}

export async function GET(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: true, loggedIn: false });
  return NextResponse.json({ ok: true, loggedIn: true, ...(await status(createAdminClient(), user.id, dayOf(req))) });
}

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient(); const today = dayOf(req, body);
  const { error } = await admin.from('checkins').insert({ user_id: user.id, day: today });
  const already = !!error; // 主键冲突 = 今天已经打过
  const st = await status(admin, user.id, today);
  let got: any = null;
  if (!already) {
    got = label(rewardAt(st.total));
    // 免费局:走到过几个发局的格子就补发到几个(checkin_rewards 记已发的格子数,防并发重复发)
    const hits = gameNodesUpTo(st.total);
    const { data: p } = await admin.from('profiles').select('credits, light_credits, checkin_rewards').eq('user_id', user.id).maybeSingle();
    const given = p?.checkin_rewards || 0;
    if (hits.length > given) {
      const add = hits.slice(given); const prem = add.filter((h) => h.kind === 'game').reduce((a, h) => a + h.count, 0); const lite = add.filter((h) => h.kind === 'light').reduce((a, h) => a + h.count, 0);
      if (p) await admin.from('profiles').update({ credits: (p.credits || 0) + prem, light_credits: (p.light_credits || 0) + lite, checkin_rewards: hits.length }).eq('user_id', user.id).eq('checkin_rewards', given);
      else await admin.from('profiles').insert({ user_id: user.id, credits: prem, light_credits: lite, checkin_rewards: hits.length });
    }
    // 解锁的框 / 背景 / 经验由 collect() 按签到次数算,这里刷新一下 users 上的等级
    try { const { collect } = await import('@/lib/collection'); await collect(admin, user.id, 'zh', false); } catch {}
  }
  return NextResponse.json({ ok: true, already, got, ...st });
}
