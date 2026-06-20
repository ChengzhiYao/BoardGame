import { publicView, type State } from './engine';

export async function loadState(admin: any, roomId: string): Promise<State | null> {
  const { data } = await admin.from('dnd_state').select('state').eq('room_id', roomId).maybeSingle();
  return (data?.state as State) || null;
}

async function syncRoom(admin: any, roomId: string, state: State) {
  const phase = state.phase === 'ended' ? 'ended' : state.phase;
  await admin.from('rooms').update({ dnd_phase: phase, game_state: state.phase === 'ended' ? 'ended' : 'playing' }).eq('id', roomId);
}

export async function persist(admin: any, roomId: string, state: State) {
  const now = new Date().toISOString();
  await admin.from('dnd_state').upsert({ room_id: roomId, state, updated_at: now });
  await syncRoom(admin, roomId, state);
}

// 乐观锁串行写回（同 MCC）：并发的战斗行动/叙事不会互相覆盖。
export async function mutateState(admin: any, roomId: string, fn: (s: State) => any): Promise<{ ok: boolean; error?: string; result?: any; changed?: boolean }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await admin.from('dnd_state').select('state, updated_at').eq('room_id', roomId).maybeSingle();
    if (!data?.state) return { ok: false, error: '冒险尚未开始' };
    const prev = data.updated_at as string;
    const state = data.state as State;
    const before = JSON.stringify(state);
    const result = fn(state);
    if (JSON.stringify(state) === before) return { ok: true, result, changed: false };
    const now = new Date().toISOString();
    const { data: upd } = await admin.from('dnd_state').update({ state, updated_at: now }).eq('room_id', roomId).eq('updated_at', prev).select('room_id');
    if (upd && upd.length) { await syncRoom(admin, roomId, state); return { ok: true, result, changed: true }; }
    await new Promise((r) => setTimeout(r, 30 + attempt * 40));
  }
  return { ok: false, error: '状态繁忙，请重试' };
}

export { publicView };
