// 首页「回到房间」里点 ✕：房主 → 结束这局；被邀请的人 → 只是自己退出，别人照玩。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { sendRecap, compOf } from '@/lib/linger/companion';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ ok: false }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('host_user_id, companion').eq('id', roomId).maybeSingle();
  if (room?.host_user_id === user.id) {
    await admin.from('rooms').update({ game_state: 'ended' }).eq('id', roomId);
    await admin.from('players').update({ is_online: false }).eq('room_id', roomId);
    // 和 Linger 伴侣玩到一半走了：也让 TA 记住这局
    if (compOf(room) && !(room as any).companion?.recapped) {
      const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('room_id', roomId).eq('sender_type', 'player');
      if ((count || 0) >= 2) await sendRecap(admin, roomId, '这局还没玩完,对方就先结束离开了。');
    }
    return NextResponse.json({ ok: true, ended: true });
  }
  await admin.from('players').update({ left_at: new Date().toISOString(), is_online: false }).eq('id', me.id);
  return NextResponse.json({ ok: true, ended: false });
}
