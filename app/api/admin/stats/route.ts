// 管理员专用统计：仅 ADMIN_EMAIL（默认 yxhzdm@gmail.com）可读，返回在线/活跃数据。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();
  if (!user?.email || user.email.toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 10 * 60000).toISOString();

  const { data: recent } = await admin.from('messages').select('room_id, sender_player_id, sender_type').gte('created_at', since).limit(5000);
  const activeRoomSet = new Set<string>();
  const activePlayerSet = new Set<string>();
  (recent || []).forEach((m: any) => {
    if (m.room_id) activeRoomSet.add(m.room_id);
    if (m.sender_type === 'player' && m.sender_player_id) activePlayerSet.add(m.sender_player_id);
  });

  const [{ count: playingRooms }, { count: totalRooms }, { count: totalPlayers }, { count: onlineFlag }] = await Promise.all([
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('game_state', 'playing'),
    admin.from('rooms').select('id', { count: 'exact', head: true }),
    admin.from('players').select('id', { count: 'exact', head: true }),
    admin.from('players').select('id', { count: 'exact', head: true }).eq('is_online', true),
  ]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const { count: roomsToday } = await admin.from('rooms').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString());

  return NextResponse.json({
    activePlayers: activePlayerSet.size,
    activeRooms: activeRoomSet.size,
    onlineFlag: onlineFlag || 0,
    playingRooms: playingRooms || 0,
    totalRooms: totalRooms || 0,
    totalPlayers: totalPlayers || 0,
    roomsToday: roomsToday || 0,
  });
}
