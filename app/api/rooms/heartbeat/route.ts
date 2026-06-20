import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { closeStaleRooms } from '@/lib/rooms/sweep';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  const { data: member } = await admin
    .from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (member) {
    await admin.from('rooms').update({ last_active: new Date().toISOString() }).eq('id', roomId);
  }
  // 任何玩家活跃时顺带清扫其它闲置房间（不依赖 Vercel 套餐的 cron 频率）
  const swept = await closeStaleRooms(admin, 5);
  return NextResponse.json({ ok: true, swept: swept.closed });
}
