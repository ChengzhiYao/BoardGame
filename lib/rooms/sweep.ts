// 关闭闲置房间：last_active 超过 N 分钟且尚未结束的房间 → game_state='ended'，玩家标记下线。
// 若 last_active 列尚未迁移，查询会报错并安全返回 0（不影响其它功能）。
// 离开房间后 3 小时内都能从首页回来；超过才算散场
export const ROOM_IDLE_MIN = 180;
export async function closeStaleRooms(admin: any, minutes = ROOM_IDLE_MIN) {
  const cutoff = new Date(Date.now() - minutes * 60000).toISOString();
  const { data: stale, error } = await admin
    .from('rooms')
    .select('id')
    .neq('game_state', 'ended')
    .lt('last_active', cutoff);
  if (error || !stale || stale.length === 0) return { closed: 0, ids: [] as string[] };
  const ids = stale.map((r: any) => r.id);
  await admin.from('rooms').update({ game_state: 'ended' }).in('id', ids);
  await admin.from('players').update({ is_online: false }).in('room_id', ids);
  return { closed: ids.length, ids };
}
