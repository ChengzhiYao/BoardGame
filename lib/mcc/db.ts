import { publicView, handRows, type State } from './engine';

export async function loadState(admin: any, roomId: string): Promise<State | null> {
  const { data } = await admin.from('mcc_games').select('state').eq('room_id', roomId).maybeSingle();
  return (data?.state as State) || null;
}
export async function persist(admin: any, roomId: string, state: State) {
  const now = new Date().toISOString();
  await admin.from('mcc_games').upsert({ room_id: roomId, state, updated_at: now });
  await admin.from('mcc_public').upsert({ room_id: roomId, data: publicView(state), updated_at: now });
  for (const r of handRows(state)) await admin.from('mcc_hands').upsert({ room_id: roomId, seat: r.seat, cards: r.cards });
  await admin.from('rooms').update({ mcc_phase: state.status === 'ended' ? 'ended' : 'playing', game_state: state.status === 'ended' ? 'ended' : 'playing' }).eq('id', roomId);
}
