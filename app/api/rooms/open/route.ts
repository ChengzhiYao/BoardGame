// 大家正在玩的局：最近 10 分钟有动静、房主没关掉公开、还有空位或 AI 补位的
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { openSlots, OPEN_MODES } from '@/lib/rooms/open';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: { user } } = await createServerClient().auth.getUser();
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 10 * 60000).toISOString();
  const { data: rs } = await admin.from('rooms').select('id, name, mode, language, game_state, host_user_id, companion, daily_day, listed, last_active, jbs_act, jbs_total_acts, botc_day, botc_phase')
    .in('mode', OPEN_MODES).neq('game_state', 'ended').gte('last_active', cutoff).order('last_active', { ascending: false }).limit(40);
  const cands = (rs || []).filter((r: any) => r.listed !== false && !r.companion?.name && !r.daily_day && !(r.mode === 'coc' && r.game_state === 'playing'));
  if (!cands.length) return NextResponse.json({ rooms: [] });
  const { data: ps } = await admin.from('players').select('room_id, seat, user_id').in('room_id', cands.map((r: any) => r.id));
  const mine = new Set((ps || []).filter((p: any) => p.user_id === user?.id).map((p: any) => p.room_id));
  const { data: pend } = user ? await admin.from('join_requests').select('id, room_id, status').eq('user_id', user.id).eq('status', 'pending').gte('created_at', new Date(Date.now() - 3 * 60000).toISOString()) : { data: [] as any[] };
  const hostIds = Array.from(new Set(cands.map((r: any) => r.host_user_id)));
  const { data: us } = await admin.from('users').select('id, display_name, avatar_url').in('id', hostIds);
  const out: any[] = [];
  for (const r of cands) {
    if (mine.has(r.id)) continue;
    const players = (ps || []).filter((p: any) => p.room_id === r.id);
    const slots = await openSlots(admin, r, players);
    if (!slots.length) continue;
    const h = (us || []).find((u: any) => u.id === r.host_user_id);
    const en = r.language === 'en';
    const stage = r.game_state !== 'playing' ? (en ? 'Waiting to start' : '等人开局')
      : r.mode === 'jbs' ? (en ? `Act ${r.jbs_act || 1}/${r.jbs_total_acts || '?'}` : `第 ${r.jbs_act || 1}/${r.jbs_total_acts || '?'} 幕`)
      : r.mode === 'botc' ? (en ? `Day ${r.botc_day || 1}` : `第 ${r.botc_day || 1} 天`) : (en ? 'In play' : '正在打');
    out.push({ id: r.id, name: r.name, mode: r.mode, lang: r.language, host: { name: h?.display_name || (en ? 'Player' : '玩家'), avatar: h?.avatar_url || null }, humans: players.length, stage, playing: r.game_state === 'playing', slots: slots.slice(0, 8), pending: (pend || []).find((x: any) => x.room_id === r.id)?.id || null });
    if (out.length >= 8) break;
  }
  return NextResponse.json({ rooms: out });
}
