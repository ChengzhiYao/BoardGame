// 给一组用户 id，返回他们当前所在的游戏房(mode+roomId)，服务端直接查，不依赖对方客户端上报。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: any = {}; try { b = await req.json(); } catch {}
  const ids: string[] = Array.isArray(b?.ids) ? b.ids.filter((x: any) => typeof x === 'string').slice(0, 100) : [];
  if (!ids.length) return NextResponse.json({ map: {} });
  const admin = createAdminClient();
  const { data: prs } = await admin.from('players').select('user_id, room_id, created_at').in('user_id', ids).order('created_at', { ascending: false }).limit(1000);
  const latest: Record<string, string> = {};
  (prs || []).forEach((p: any) => { if (p.user_id && !latest[p.user_id]) latest[p.user_id] = p.room_id; });
  const roomIds = Array.from(new Set(Object.values(latest)));
  const roomMap: Record<string, any> = {};
  if (roomIds.length) {
    const { data: rooms } = await admin.from('rooms').select('id, mode, game_state').in('id', roomIds);
    (rooms || []).forEach((r: any) => { roomMap[r.id] = r; });
  }
  const map: Record<string, { roomId: string; mode: string }> = {};
  for (const [uid, rid] of Object.entries(latest)) {
    const r = roomMap[rid];
    if (r && r.game_state !== 'ended') map[uid] = { roomId: rid, mode: r.mode || '' };
  }
  return NextResponse.json({ map });
}
