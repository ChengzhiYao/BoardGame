// 「我的大厅 · 玩过的局」：最近结束的房间 + 人数 + 时长 + 结局一句话
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { stripMarks } from '@/lib/narrate';
export const dynamic = 'force-dynamic';

const END_TYPES = ['ending', 'soup_reveal', 'jbs_reveal', 'botc_reveal'];

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ rooms: [] });
  const admin = createAdminClient();
  const { data: ps } = await admin.from('players').select('room_id').eq('user_id', user.id).order('joined_at', { ascending: false }).limit(60);
  const ids = Array.from(new Set((ps || []).map((p: any) => p.room_id).filter(Boolean)));
  if (!ids.length) return NextResponse.json({ rooms: [] });
  const { data: rooms } = await admin.from('rooms').select('id, name, mode, created_at, last_active, game_state').in('id', ids).eq('game_state', 'ended').order('created_at', { ascending: false }).limit(20);
  const list = rooms || [];
  if (!list.length) return NextResponse.json({ rooms: [] });
  const rid = list.map((r: any) => r.id);
  const [{ data: pl }, { data: ends }, { data: cnt }] = await Promise.all([
    admin.from('players').select('room_id').in('room_id', rid),
    admin.from('messages').select('room_id, content, payload, created_at').in('room_id', rid).in('payload->>type', END_TYPES).order('created_at', { ascending: false }).limit(200),
    admin.from('messages').select('room_id').in('room_id', rid).eq('sender_type', 'player').limit(5000),
  ]);
  const people: Record<string, number> = {}; (pl || []).forEach((p: any) => { people[p.room_id] = (people[p.room_id] || 0) + 1; });
  const moves: Record<string, number> = {}; (cnt || []).forEach((m: any) => { moves[m.room_id] = (moves[m.room_id] || 0) + 1; });
  const ending: Record<string, string> = {};
  (ends || []).forEach((m: any) => { if (!ending[m.room_id]) ending[m.room_id] = stripMarks(String(m.content || '')).replace(/\s+/g, ' ').trim().slice(0, 90); });
  return NextResponse.json({
    rooms: list
      .filter((r: any) => (moves[r.id] || 0) > 0 || ending[r.id]) // 开了房却一步没玩的不算
      .map((r: any) => ({
        id: r.id, name: r.name, mode: r.mode, at: r.created_at,
        mins: Math.max(1, Math.round((new Date(r.last_active || r.created_at).getTime() - new Date(r.created_at).getTime()) / 60000)),
        people: people[r.id] || 1, ending: ending[r.id] || '',
      })),
  });
}
