// 加入房间：用邀请 token 找房间，校验是否已满，给新玩家分配空座（A/B）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const token = (body.token || '').trim();
  if (!token) return NextResponse.json({ error: '缺少邀请码' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin
    .from('rooms')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();
  if (!room) return NextResponse.json({ error: '邀请码无效或已失效' }, { status: 404 });

  const { data: players } = await admin.from('players').select('*').eq('room_id', room.id);
  const mine = players?.find((p) => p.user_id === user.id);
  if (mine) {
    if (body.displayName) {
      await admin.from('users').update({ display_name: body.displayName }).eq('id', user.id);
    }
    return NextResponse.json({ roomId: room.id });
  }

  // 容量：剧本杀最多 8 名真人（AI 补满其余），其它模式仍是 2 人。
  const SEATS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const cap = (room.mode === 'jbs' || room.mode === 'botc') ? 8 : (room.mode === 'coc' || room.mode === 'mcc' || room.mode === 'dnd') ? 6 : 2;
  if ((players?.length || 0) >= cap) {
    return NextResponse.json({ error: `房间已满（${cap}/${cap}）` }, { status: 403 });
  }

  const taken = new Set(players?.map((p) => p.seat));
  const seat = SEATS.slice(0, cap).find((s) => !taken.has(s)) || 'A';
  const { error } = await admin
    .from('players')
    .insert({ room_id: room.id, user_id: user.id, seat, is_online: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.displayName) {
    await admin.from('users').update({ display_name: body.displayName }).eq('id', user.id);
  }

  // 不再自动跳步：CoC 现支持 1~6 人，由房主在大厅手动点"开始"，以便等更多同伴加入。

  return NextResponse.json({ roomId: room.id });
}
