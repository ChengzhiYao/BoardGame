import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { closeStaleRooms, ROOM_IDLE_MIN } from '@/lib/rooms/sweep';
import { getEntitlement } from '@/lib/billing/entitlement';
import { FREE_MODES, weekStart } from '@/lib/pricing';

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
    await admin.from('players').update({ left_at: null }).eq('id', member.id);
  }
  // 免费游戏：给房主累计本周免费游玩时长（非会员/白名单才计）
  try {
    const { data: room } = await admin.from('rooms').select('mode, host_user_id').eq('id', roomId).maybeSingle();
    if (room && FREE_MODES.includes(room.mode) && room.host_user_id === user.id) {
      const ent = await getEntitlement(admin, user);
      const { data: pp } = await admin.from('profiles').select('pass_until').eq('user_id', user.id).maybeSingle();
      const onPass = !!(pp?.pass_until && new Date(pp.pass_until) > new Date());
      // 只有会员玩海龟汤/猫诅咒时计时（会员每周 2 小时）；真心话、身价场永久免费不计；畅玩卡期间不计
      const counts = (room.mode === 'soup' || room.mode === 'mcc') && ent.member;
      if (counts && !ent.whitelisted && !onPass) {
        const ws = weekStart();
        const { data: fu } = await admin.from('free_usage').select('seconds').eq('user_id', user.id).eq('week_start', ws).maybeSingle();
        await admin.from('free_usage').upsert({ user_id: user.id, week_start: ws, seconds: (fu?.seconds || 0) + 60 }, { onConflict: 'user_id,week_start' });
      }
    }
  } catch {}
  // 任何玩家活跃时顺带清扫其它闲置房间（不依赖 Vercel 套餐的 cron 频率）
  const swept = await closeStaleRooms(admin, ROOM_IDLE_MIN);
  return NextResponse.json({ ok: true, swept: swept.closed });
}
