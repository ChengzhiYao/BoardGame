// MCC · 响应窗口到点则结算（任何成员可触发，仅在到点时生效；房主端轮询）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { resolvePending } from '@/lib/mcc/engine';
import { loadState, persist } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const state = await loadState(admin, roomId);
  if (!state || !state.pending || state.pending.type !== 'react') return NextResponse.json({ ok: true });
  if (Date.now() < state.pending.until) return NextResponse.json({ ok: true, waiting: true });
  resolvePending(state);
  await persist(admin, roomId, state);
  return NextResponse.json({ ok: true, resolved: true });
}
