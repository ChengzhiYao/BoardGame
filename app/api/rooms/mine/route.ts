// 我还没结束的房间（首页「回到房间」用）
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ROOM_IDLE_MIN } from '@/lib/rooms/sweep';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ rooms: [] });
  const admin = createAdminClient();
  const { data: ps } = await admin.from('players').select('room_id').eq('user_id', user.id).is('left_at', null).order('joined_at', { ascending: false }).limit(30);
  const ids = Array.from(new Set((ps || []).map((p: any) => p.room_id).filter(Boolean)));
  if (!ids.length) return NextResponse.json({ rooms: [] });
  const cutoff = new Date(Date.now() - ROOM_IDLE_MIN * 60000).toISOString();
  const { data: rooms } = await admin.from('rooms').select('id, name, mode, game_state, last_active, host_user_id').in('id', ids).neq('game_state', 'ended').gte('last_active', cutoff).order('last_active', { ascending: false }).limit(3);
  return NextResponse.json({ rooms: (rooms || []).map((r: any) => ({ id: r.id, name: r.name, mode: r.mode, at: r.last_active, state: r.game_state, host: r.host_user_id === user.id })) });
}
