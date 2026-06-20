// 管理员专用统计：仅 ADMIN_EMAIL（默认 yxhzdm@gmail.com）可读。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { closeStaleRooms } from '@/lib/rooms/sweep';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();
  if (!user?.email || user.email.toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  await closeStaleRooms(admin, 5);
  const since10 = new Date(Date.now() - 10 * 60000).toISOString();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const { data: recent } = await admin.from('messages').select('room_id, sender_player_id, sender_type').gte('created_at', since10).limit(5000);
  const activeRoomSet = new Set<string>();
  const activePlayerSet = new Set<string>();
  (recent || []).forEach((m: any) => {
    if (m.room_id) activeRoomSet.add(m.room_id);
    if (m.sender_type === 'player' && m.sender_player_id) activePlayerSet.add(m.sender_player_id);
  });

  const { data: pl } = await admin.from('players').select('user_id').limit(100000);
  const distinctUsers = new Set((pl || []).map((p: any) => p.user_id).filter(Boolean)).size;

  const { data: msgs } = await admin.from('messages').select('room_id, created_at').limit(100000);
  const span: Record<string, { min: number; max: number }> = {};
  (msgs || []).forEach((m: any) => {
    const t = new Date(m.created_at).getTime();
    const r = span[m.room_id];
    if (!r) span[m.room_id] = { min: t, max: t };
    else { if (t < r.min) r.min = t; if (t > r.max) r.max = t; }
  });
  let totalMs = 0; const durs: number[] = [];
  Object.values(span).forEach((r) => { const d = r.max - r.min; if (d > 0) { totalMs += d; durs.push(d); } });
  const gamesPlayed = Object.keys(span).length;
  const totalPlayMinutes = Math.round(totalMs / 60000);
  const avgGameMinutes = durs.length ? Math.round((totalMs / durs.length) / 60000) : 0;

  const [
    { count: gamesFinished }, { count: playingRooms }, { count: totalRooms },
    { count: totalMessages }, { count: roomsToday }, { count: playersToday },
    { count: cocN }, { count: soupN }, { count: tdN }, { count: jbsN },
  ] = await Promise.all([
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('game_state', 'ended'),
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('game_state', 'playing'),
    admin.from('rooms').select('id', { count: 'exact', head: true }),
    admin.from('messages').select('id', { count: 'exact', head: true }),
    admin.from('rooms').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    admin.from('players').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('mode', 'coc'),
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('mode', 'soup'),
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('mode', 'td'),
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('mode', 'jbs'),
  ]);

  return NextResponse.json({
    activePlayers: activePlayerSet.size,
    activeRooms: activeRoomSet.size,
    distinctUsers,
    gamesPlayed,
    gamesFinished: gamesFinished || 0,
    playingRooms: playingRooms || 0,
    totalRooms: totalRooms || 0,
    totalMessages: totalMessages || 0,
    totalPlayMinutes,
    avgGameMinutes,
    roomsToday: roomsToday || 0,
    playersToday: playersToday || 0,
    modes: { coc: cocN || 0, soup: soupN || 0, td: tdN || 0, jbs: jbsN || 0 },
  });
}
