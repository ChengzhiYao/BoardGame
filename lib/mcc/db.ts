import { publicView, handRows, type State } from './engine';

export async function loadState(admin: any, roomId: string): Promise<State | null> {
  const { data } = await admin.from('mcc_games').select('state').eq('room_id', roomId).maybeSingle();
  return (data?.state as State) || null;
}

async function syncDerived(admin: any, roomId: string, state: State, now: string) {
  await admin.from('mcc_public').upsert({ room_id: roomId, data: publicView(state), updated_at: now });
  for (const r of handRows(state)) await admin.from('mcc_hands').upsert({ room_id: roomId, seat: r.seat, cards: r.cards });
  await admin.from('rooms').update({ mcc_phase: state.status === 'ended' ? 'ended' : 'playing', game_state: state.status === 'ended' ? 'ended' : 'playing' }).eq('id', roomId);
}

// 初始落库（开局）：直接 upsert 整份状态。
export async function persist(admin: any, roomId: string, state: State) {
  const now = new Date().toISOString();
  await admin.from('mcc_games').upsert({ room_id: roomId, state, updated_at: now });
  await syncDerived(admin, roomId, state, now);
}

// 串行化的「读取→修改→写回」：用 updated_at 做乐观锁（compare-and-set）。
// 多个请求（出嘶吼 / 结算 / 机器猫）并发时只有一个能写成功，其余自动用最新状态重试，
// 杜绝相互覆盖导致的「嘶吼丢失 / 计数错乱」。仅当 fn 真的改了状态才写库（避免无谓写入引发重试风暴）。
export async function mutateState(
  admin: any,
  roomId: string,
  fn: (s: State) => any,
): Promise<{ ok: boolean; error?: string; result?: any; changed?: boolean }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await admin.from('mcc_games').select('state, updated_at').eq('room_id', roomId).maybeSingle();
    if (!data?.state) return { ok: false, error: '对局未开始' };
    const prev = data.updated_at as string;
    const state = data.state as State;
    const before = JSON.stringify(state);
    const result = fn(state);
    const changed = JSON.stringify(state) !== before;
    if (!changed) return { ok: true, result, changed: false };
    const now = new Date().toISOString();
    const { data: upd } = await admin
      .from('mcc_games')
      .update({ state, updated_at: now })
      .eq('room_id', roomId)
      .eq('updated_at', prev)
      .select('room_id');
    if (upd && upd.length) {
      await syncDerived(admin, roomId, state, now);
      return { ok: true, result, changed: true };
    }
    await new Promise((r) => setTimeout(r, 30 + attempt * 40));
  }
  return { ok: false, error: '状态繁忙，请重试' };
}
