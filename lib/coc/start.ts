// 在座玩家都准备好 → 进入正式跑团，并发出开场旁白（从库里读，不重复生成；有配音就带上）。
// 两人都在规则说明里点了"准备好" → 进入 playing，并发出开场场景（从库里读，不重复生成）
export async function maybeStartPlaying(admin: any, roomId: string) {
  const { data: players } = await admin
    .from('players')
    .select('id, is_ready')
    .eq('room_id', roomId);
  const ready = (players?.filter((p: any) => p.is_ready).length || 0);
  const total = (players?.length || 0);
  if (total < 1 || ready < total) return; // 在座玩家全部点了"准备好"即可开场（单人=1人）

  const { data: room } = await admin.from('rooms').select('campaign_id, game_state').eq('id', roomId).maybeSingle();
  if (!room || room.game_state === 'playing') return;

  let opening = '雾气在四周缓缓聚拢。你们的调查，从这里开始。';
  let openingGuidance: any = null;
  let openingAudio: string | undefined;
  if (room.campaign_id) {
    const { data: campaign } = await admin
      .from('campaigns')
      .select('setting')
      .eq('id', room.campaign_id)
      .maybeSingle();
    if (campaign?.setting?.opening_scene) opening = campaign.setting.opening_scene;
    if (campaign?.setting?.opening_guidance) openingGuidance = campaign.setting.opening_guidance;
    if (campaign?.setting?.opening_audio) openingAudio = campaign.setting.opening_audio;
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
    payload: { ...(openingGuidance ? { guidance: openingGuidance } : {}), ...(openingAudio ? { audio: openingAudio } : {}) },
  });
}
