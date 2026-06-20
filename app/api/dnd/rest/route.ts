// D&D · 休整：房主让全队短休/长休。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { shortRest, longRest } from '@/lib/dnd/engine';
import { mutateState } from '@/lib/dnd/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, kind } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id').eq('id', roomId).maybeSingle();
  if (!room || room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以休整' }, { status: 403 });

  const out = await mutateState(admin, roomId, (s) => {
    if (s.combat?.active) return { ok: false, error: '战斗中无法休整' };
    if (kind === 'long') longRest(s); else shortRest(s);
    return { ok: true };
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
