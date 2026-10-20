// 返回某房间的游戏类型（仅 mode，无敏感信息），用于在线列表显示"正在玩什么"。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ mode: '' });
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('rooms').select('mode, game_state').eq('id', id).maybeSingle();
    return NextResponse.json({ mode: data?.mode || '', state: data?.game_state || '' });
  } catch { return NextResponse.json({ mode: '' }); }
}
