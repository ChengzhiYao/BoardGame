// MCC · 出牌（行动牌）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { play } from '@/lib/mcc/engine';
import { loadState, persist } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, card, target } = await req.json().catch(() => ({} as any));
  if (!roomId || !card) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const state = await loadState(admin, roomId);
  if (!state) return NextResponse.json({ error: '对局未开始' }, { status: 409 });
  const r = play(state, me.seat, card, target);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  await persist(admin, roomId, state);
  return NextResponse.json({ ok: true, peek: r.peek });
}
