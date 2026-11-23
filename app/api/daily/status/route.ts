// 每日一汤状态：今天第几期、多少人挑战、我的成绩/排名/连续天数、今日排行、往期列表。没登录也能看。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureDaily, dayKey, streakOf, rankKey, type Lang } from '@/lib/soup/daily';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'zh';
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const today = dayKey(lang);
  const daily = await ensureDaily(admin, lang, today);
  if (!daily) return NextResponse.json({ ok: false });

  const { data: title } = await admin.from('soup_library').select('title').eq('id', daily.lib_id).maybeSingle();
  const { data: rows } = await admin.from('daily_results').select('user_id, questions, hints, seconds, solved').eq('day', today).eq('lang', lang).limit(2000);
  const list = (rows || []).slice().sort((a: any, b: any) => rankKey(a) - rankKey(b));
  const solvedN = list.filter((r: any) => r.solved).length;

  const top = list.slice(0, 10);
  const ids = top.map((r: any) => r.user_id);
  const { data: us } = ids.length ? await admin.from('users').select('id, display_name, avatar_url').in('id', ids) : { data: [] as any[] };
  const board = top.map((r: any, i: number) => {
    const u = (us || []).find((x: any) => x.id === r.user_id);
    return { rank: i + 1, name: u?.display_name || (lang === 'en' ? 'Player' : '玩家'), avatar: u?.avatar_url || null, questions: r.questions, hints: r.hints, seconds: r.seconds, solved: r.solved, me: r.user_id === user?.id };
  });

  let me: any = null, streak = 0, savedDays = 0, isProtected = false, playing: string | null = null;
  if (user) {
    const { data: mine } = await admin.from('daily_results').select('*').eq('user_id', user.id).eq('lang', lang).order('day', { ascending: false }).limit(400);
    const { data: p } = await admin.from('profiles').select('member_until, is_whitelisted, pass_until, party_until').eq('user_id', user.id).maybeSingle();
    const now = new Date();
    isProtected = !!(p?.is_whitelisted || [p?.member_until, p?.pass_until, p?.party_until].some((x: any) => x && new Date(x) > now));
    const s = streakOf((mine || []).map((r: any) => String(r.day)), today, isProtected);
    streak = s.streak; savedDays = s.savedDays;
    const t = (mine || []).find((r: any) => String(r.day) === today);
    if (t) {
      const rank = list.findIndex((r: any) => r.user_id === user.id) + 1;
      const beat = list.length > 1 ? Math.round(((list.length - rank) / (list.length - 1)) * 100) : 100;
      me = { ...t, rank, beat };
    } else {
      const { data: r } = await admin.from('rooms').select('id').eq('host_user_id', user.id).eq('daily_day', today).eq('language', lang).limit(1);
      playing = r?.[0]?.id || null;
    }
  }

  // 往期（最近 14 期）
  const { data: past } = await admin.from('daily_soup').select('day, no, lib_id').eq('lang', lang).lt('day', today).order('day', { ascending: false }).limit(14);
  const pids = (past || []).map((x: any) => x.lib_id);
  const { data: pt } = pids.length ? await admin.from('soup_library').select('id, title').in('id', pids) : { data: [] as any[] };
  const { data: myPast } = user && past?.length ? await admin.from('daily_results').select('day, solved, questions').eq('user_id', user.id).eq('lang', lang).in('day', past.map((x: any) => x.day)) : { data: [] as any[] };
  const archive = (past || []).map((x: any) => {
    const r = (myPast || []).find((y: any) => String(y.day) === String(x.day));
    return { day: x.day, no: x.no, title: (pt || []).find((y: any) => y.id === x.lib_id)?.title || '', result: r ? { solved: r.solved, questions: r.questions } : null };
  });

  return NextResponse.json({
    ok: true, day: today, no: daily.no, title: title?.title || '', players: list.length, solved: solvedN,
    me, playing, streak, savedDays, protected: isProtected, board, archive, loggedIn: !!user?.email,
  });
}
