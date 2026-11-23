// 落地页的真实数字（向下取整，绝不虚报），缓存 1 小时
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
export const revalidate = 3600;

export async function GET() {
  const admin = createAdminClient();
  const [{ count: moves }, { count: lines }] = await Promise.all([
    admin.from('messages').select('id', { count: 'exact', head: true }).eq('sender_type', 'player'),
    admin.from('messages').select('id', { count: 'exact', head: true }).eq('sender_type', 'kp'),
  ]);
  const { data: rooms } = await admin.from('messages').select('room_id').eq('sender_type', 'player').limit(20000);
  const games = new Set((rooms || []).map((r: any) => r.room_id)).size;
  const floor = (n: number, step: number) => Math.floor(n / step) * step;
  return NextResponse.json({ moves: floor(moves || 0, 100), lines: floor(lines || 0, 100), games: floor(games, 10) }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } });
}
