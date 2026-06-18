// 再来一局：把当前房间重置回"选择模组"，清空上一局数据，扣主持 1 局（白名单不扣）。
// 仅房主可发起；局数不足 → 402，前端跳收费页。两名玩家留在同一房间继续。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('id, host_user_id').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) {
    return NextResponse.json({ error: '只有房主可以开下一局' }, { status: 403 });
  }

  const ent = await getEntitlement(admin, user);
  if (!ent.canHost) {
    return NextResponse.json(
      { error: ent.reason === 'login' ? '请先用 Google 登录' : '局数已用完，请充值后再来一局', reason: ent.reason },
      { status: 402 }
    );
  }

  for (const tbl of ['messages', 'dice_rolls', 'san_logs', 'clues', 'npcs', 'images', 'locations', 'timeline_events', 'characters']) {
    await admin.from(tbl).delete().eq('room_id', roomId);
  }
  await admin.from('players').update({ is_ready: false }).eq('room_id', roomId);

  await admin.from('rooms').update({
    game_state: 'module_selection',
    campaign_id: null,
    module_options: null,
    modules_generating: false,
    current_round: 1,
    turn_count: 0,
    suspicion: 0,
    scene_state: 'menu',
    audio_flags: {},
    world_flags: {},
    world_clock: [],
    deduction_count: 0,
    pending_actions: {},
    player_a_ready: false,
    player_b_ready: false,
    waiting_for: 'both',
    resolution_status: 'collecting',
    memory: { summary: '', key_facts: [], up_to_round: 0 },
  }).eq('id', roomId);

  if (!ent.whitelisted) {
    await admin.from('profiles').update({ credits: Math.max(0, (ent.credits || 0) - 1) }).eq('user_id', user.id);
  }

  return NextResponse.json({ ok: true });
}
