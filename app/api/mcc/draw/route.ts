// MCC · 抽牌（回合收尾）。乐观锁串行化。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { draw } from '@/lib/mcc/engine';
import { mutateState } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const out = await mutateState(admin, roomId, (s) => draw(s, me.seat));
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });
  return NextResponse.json({ ok: true, drew: out.result.drew, eliminated: out.result.eliminated, needWard: out.result.needWard });
}
