// MCC · 用护身铃化解诅咒猫并塞回牌堆。乐观锁串行化。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { useWard } from '@/lib/mcc/engine';
import { mutateState } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, pos } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const out = await mutateState(admin, roomId, (s) => useWard(s, me.seat, typeof pos === 'number' ? pos : s.deck.length));
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
