// 两人到齐后，从 lobby 推进到 module_selection（自愈/兜底用）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: players } = await admin.from('players').select('id').eq('room_id', roomId);
  if ((players?.length || 0) < 2) {
    return NextResponse.json({ error: '还需要第二位玩家加入' }, { status: 409 });
  }

  const { error } = await admin
    .from('rooms')
    .update({ game_state: 'module_selection' })
    .eq('id', roomId);
  if (error) {
    return NextResponse.json(
      { error: '推进失败（请确认已执行 migration_gamestate.sql）：' + error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
