// 建卡分步流程。两名玩家都完成当前步，房间才推进到下一步。
// step: info | attributes | skills | confirm | briefing_ack
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const { roomId, step, data } = body;
  if (!roomId || !step) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  // briefing_ack 不写 character，写 players.is_ready
  if (step === 'briefing_ack') {
    await admin.from('players').update({ is_ready: true }).eq('id', me.id);
    await maybeStartPlaying(admin, roomId);
    return NextResponse.json({ ok: true });
  }

  // 找/建本玩家的角色行
  let { data: ch } = await admin
    .from('characters')
    .select('id, creation_stage')
    .eq('player_id', me.id)
    .maybeSingle();
  if (!ch) {
    const { data: created } = await admin
      .from('characters')
      .insert({ room_id: roomId, player_id: me.id })
      .select('id, creation_stage')
      .single();
    ch = created;
  }

  const patch: any = { ...(data || {}) };
  let targetStage = ch!.creation_stage;

  if (step === 'info') targetStage = Math.max(targetStage, 1);
  else if (step === 'attributes') targetStage = Math.max(targetStage, 2);
  else if (step === 'skills') {
    targetStage = Math.max(targetStage, 3);
    patch.is_complete = true;
  } else if (step === 'confirm') {
    targetStage = Math.max(targetStage, 4);
    patch.confirmed = true;
  } else {
    return NextResponse.json({ error: '未知步骤' }, { status: 400 });
  }
  patch.creation_stage = targetStage;

  const { error: upErr } = await admin.from('characters').update(patch).eq('id', ch!.id);
  if (upErr) {
    return NextResponse.json({ error: '保存失败：' + upErr.message + '（请确认已运行最新的 migration_RUN_THIS.sql）' }, { status: 500 });
  }

  // 检查是否两人都完成本步，推进房间
  await maybeAdvanceRoom(admin, roomId, step);

  return NextResponse.json({ ok: true });
}

async function maybeAdvanceRoom(admin: any, roomId: string, step: string) {
  const { data: players } = await admin.from('players').select('id').eq('room_id', roomId);
  const { data: chars } = await admin
    .from('characters')
    .select('creation_stage, confirmed')
    .eq('room_id', roomId);
  const need = (players?.length || 0);
  if (need < 2) return;

  const reach = (n: number) =>
    (chars?.filter((c: any) => (c.creation_stage || 0) >= n).length || 0) >= need;

  if (step === 'info' && reach(1)) {
    await setState(admin, roomId, 'attribute_allocation');
  } else if (step === 'attributes' && reach(2)) {
    await setState(admin, roomId, 'skill_allocation');
  } else if (step === 'skills' && reach(3)) {
    await setState(admin, roomId, 'character_confirmation');
  } else if (step === 'confirm') {
    const allConfirmed = (chars?.filter((c: any) => c.confirmed).length || 0) >= need;
    if (allConfirmed) await setState(admin, roomId, 'rule_briefing');
  }
}

async function setState(admin: any, roomId: string, state: string) {
  await admin.from('rooms').update({ game_state: state }).eq('id', roomId);
}

// 两人都在规则说明里点了"准备好" → 进入 playing，并发出开场场景（从库里读，不重复生成）
async function maybeStartPlaying(admin: any, roomId: string) {
  const { data: players } = await admin
    .from('players')
    .select('id, is_ready')
    .eq('room_id', roomId);
  const ready = (players?.filter((p: any) => p.is_ready).length || 0);
  if ((players?.length || 0) < 2 || ready < 2) return;

  const { data: room } = await admin.from('rooms').select('campaign_id, game_state').eq('id', roomId).maybeSingle();
  if (!room || room.game_state === 'playing') return;

  let opening = '雾气在四周缓缓聚拢。你们的调查，从这里开始。';
  let openingGuidance: any = null;
  if (room.campaign_id) {
    const { data: campaign } = await admin
      .from('campaigns')
      .select('setting')
      .eq('id', room.campaign_id)
      .maybeSingle();
    if (campaign?.setting?.opening_scene) opening = campaign.setting.opening_scene;
    if (campaign?.setting?.opening_guidance) openingGuidance = campaign.setting.opening_guidance;
  }

  await admin.from('rooms').update({ game_state: 'playing', turn_count: 1 }).eq('id', roomId);
  // 初始两名调查员同处开场地点
  const startLoc = openingGuidance?.location || null;
  if (startLoc) await admin.from('characters').update({ current_location: startLoc }).eq('room_id', roomId);
  await admin.from('messages').insert({
    room_id: roomId,
    sender_type: 'kp',
    content: opening,
    turn_no: 1,
    payload: openingGuidance ? { guidance: openingGuidance } : {},
  });
}
