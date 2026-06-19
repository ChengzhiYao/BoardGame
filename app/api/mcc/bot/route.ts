// MCC · 机器猫单步行动（房主端轮询）：处理 bot 的护身铃 / 出牌 / 抽牌。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { botAct, useWard } from '@/lib/mcc/engine';
import { loadState, persist } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id').eq('id', roomId).maybeSingle();
  if (!room || room.host_user_id !== user.id) return NextResponse.json({ ok: true });
  const state = await loadState(admin, roomId);
  if (!state || state.status !== 'playing') return NextResponse.json({ ok: true });

  if (state.pending?.type === 'ward' && state.bots.includes(state.pending.seat)) {
    useWard(state, state.pending.seat, Math.floor(Math.random() * (state.deck.length + 1)));
    await persist(admin, roomId, state); return NextResponse.json({ ok: true, acted: 'ward' });
  }
  if (!state.pending && state.bots.includes(state.turn)) {
    botAct(state, state.turn);
    await persist(admin, roomId, state); return NextResponse.json({ ok: true, acted: 'turn' });
  }
  return NextResponse.json({ ok: true });
}
