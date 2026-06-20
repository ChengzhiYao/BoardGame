// MCC · 响应窗口到点则结算。加宽限期：到点后再等一会儿，吸收客户端刷新延迟，
// 让"画面上还显示窗口"的真人即便手慢一点也能赶上嘶吼。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { resolvePending } from '@/lib/mcc/engine';
import { mutateState } from '@/lib/mcc/db';

const GRACE_MS = 1300;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const out = await mutateState(admin, roomId, (s) => {
    if (!s.pending || s.pending.type !== 'react') return { skip: true };
    if (Date.now() < s.pending.until + GRACE_MS) return { waiting: true };
    resolvePending(s);
    return { resolved: true };
  });
  return NextResponse.json({ ok: true, ...(out.result || {}) });
}
