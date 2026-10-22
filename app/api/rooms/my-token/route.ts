// 返回我所在房间的邀请码（仅当我是该房间的玩家时）——用于邀请好友加入。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ token: '' });
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ token: '' }, { status: 401 });
  const admin = createAdminClient();
  const { data: mine } = await admin.from('players').select('id').eq('room_id', id).eq('user_id', user.id).maybeSingle();
  if (!mine) return NextResponse.json({ token: '' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('invite_token, mode').eq('id', id).maybeSingle();
  return NextResponse.json({ token: room?.invite_token || '', mode: room?.mode || '' });
}
