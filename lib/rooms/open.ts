// 公开的局：别人能看到正在开的房间，申请加入；房主同意后，新玩家坐进空位，或者顶替一个 AI 补位的角色继续玩。
import { mutateState } from '@/lib/mcc/db';

export const OPEN_MODES = ['jbs', 'botc', 'mcc', 'coc'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const CAP: Record<string, number> = { jbs: 8, botc: 8, mcc: 6, coc: 6 };
export type Slot = { key: string; label: string; sub?: string };

const lobbyish = (r: any) => r.game_state !== 'playing' && r.game_state !== 'ended';

// 这一局现在能让新人坐的位置
export async function openSlots(admin: any, room: any, players?: any[]): Promise<Slot[]> {
  const en = room.language === 'en';
  const ps = players || (await admin.from('players').select('seat, user_id').eq('room_id', room.id)).data || [];
  const cap = CAP[room.mode] || 2;
  if (lobbyish(room)) {
    // 还没开始：有空座就能进（克苏鲁也只在开场前进）
    return ps.length < cap ? [{ key: 'seat', label: en ? 'Open seat' : '空位' }] : [];
  }
  if (room.mode === 'jbs') {
    const { data: cs } = await admin.from('jbs_characters').select('name, occupation, is_ai, status').eq('room_id', room.id);
    const comp = room.companion?.role;
    if (ps.length >= cap) return [];
    return (cs || []).filter((c: any) => c.is_ai && c.status !== 'dead' && c.name !== comp).map((c: any) => ({ key: 'jbs:' + c.name, label: c.name, sub: c.occupation || '' }));
  }
  if (room.mode === 'botc') {
    if (room.botc_phase === 'reveal') return [];
    const { data: bs } = await admin.from('botc_players').select('seat, display_name, is_ai, alive').eq('room_id', room.id);
    const compSeat = room.companion?.seat;
    return (bs || []).filter((b: any) => b.is_ai && b.alive && b.seat !== compSeat && !ps.some((p: any) => p.seat === b.seat)).map((b: any) => ({ key: 'botc:' + b.seat, label: b.display_name }));
  }
  if (room.mode === 'mcc') {
    const { data: g } = await admin.from('mcc_games').select('state').eq('room_id', room.id).maybeSingle();
    const s = g?.state; if (!s || s.status === 'ended') return [];
    return (s.bots || []).filter((seat: string) => s.alive?.[seat] && !ps.some((p: any) => p.seat === seat)).map((seat: string) => ({ key: 'mcc:' + seat, label: s.names?.[seat] || seat }));
  }
  return [];
}

// 房主同意后：把人放进房间（空座，或接替 AI）。返回 { seat, replaced }。
export async function seatNewcomer(admin: any, room: any, userId: string, name: string, target?: string | null): Promise<{ seat: string; replaced?: string }> {
  const en = room.language === 'en';
  const { data: ps } = await admin.from('players').select('seat, user_id').eq('room_id', room.id);
  if ((ps || []).some((p: any) => p.user_id === userId)) return { seat: (ps || []).find((p: any) => p.user_id === userId).seat };
  const slots = await openSlots(admin, room, ps || []);
  if (!slots.length) throw new Error(en ? 'No seat left' : '已经没有空位了');
  const slot = slots.find((s) => s.key === target) || slots[0];
  const used = new Set((ps || []).map((p: any) => p.seat));
  const join = async (seat: string) => {
    const { error } = await admin.from('players').insert({ room_id: room.id, user_id: userId, seat, is_online: true });
    if (error) throw new Error(error.message);
    // 碰一下房间行：房里每个人的页面都会刷新，看到新来的人
    await admin.from('rooms').update({ last_active: new Date().toISOString() }).eq('id', room.id);
  };
  const announce = (content: string) => admin.from('messages').insert({ room_id: room.id, sender_type: 'system', turn_no: room.jbs_act || room.botc_day || 0, content, payload: { type: 'joined' } });

  if (slot.key === 'seat') {
    const seat = LETTERS.find((l) => !used.has(l))!;
    await join(seat);
    return { seat };
  }

  if (slot.key.startsWith('jbs:')) {
    const charName = slot.key.slice(4);
    const { data: cs } = await admin.from('jbs_characters').select('assigned_seat').eq('room_id', room.id);
    (cs || []).forEach((c: any) => c.assigned_seat && used.add(c.assigned_seat));
    const seat = LETTERS.find((l) => !used.has(l));
    if (!seat) throw new Error(en ? 'Room is full' : '房间满了');
    const { data: upd } = await admin.from('jbs_characters').update({ is_ai: false, assigned_seat: seat }).eq('room_id', room.id).eq('name', charName).eq('is_ai', true).select('name');
    if (!upd?.length) throw new Error(en ? 'Someone already took that role' : '这个角色刚被别人接走了');
    await join(seat);
    // 角色卡和私人任务：和开局时真人拿到的一样
    const { data: kase } = await admin.from('jbs_cases').select('case_file').eq('room_id', room.id).maybeSingle();
    const cf: any = kase?.case_file || {};
    const c = (cf.characters || []).find((x: any) => x.name === charName) || {};
    const card = (en ? `You are 「${charName}」 (${c.occupation || ''}) — you're taking over mid-game. Read the chat above to catch up.\n` : `你接替了「${charName}」（${c.occupation || ''}）——游戏已经开始了，往上翻翻聊天记录跟上进度。\n`)
      + (en ? 'Background: ' : '背景：') + (c.background || '') + '\n'
      + (en ? 'Secret (yours only): ' : '你的秘密（仅你可见）：') + (c.secret || '') + '\n'
      + (en ? 'Private goal: ' : '私人目标：') + (c.private_goal || '') + '\n'
      + (en ? 'Private task: ' : '私人任务：') + (c.private_task || '') + '\n'
      + (en ? 'Relationships: ' : '隐藏关系：') + (c.relationships || '')
      + (c.faction ? (en ? `\nFaction: ${c.faction}` : `\n所属阵营：${c.faction}`) : '');
    await admin.from('messages').insert({ room_id: room.id, sender_type: 'system', turn_no: room.jbs_act || 0, content: card, visibility: `seat:${seat}`, payload: { type: 'jbs_role' } });
    const factionWin = c.faction ? ((cf.factions || []).find((f: any) => f.name === c.faction)?.win || '') : '';
    const objs: { kind: string; text: string }[] = [];
    if (c.private_task) objs.push({ kind: 'task', text: String(c.private_task) });
    if (c.private_goal) objs.push({ kind: 'goal', text: String(c.private_goal) });
    if (c.faction && factionWin) objs.push({ kind: 'faction', text: `【阵营·${c.faction}】${factionWin}` });
    for (let i = 0; i < objs.length; i++) await admin.from('jbs_objectives').insert({ room_id: room.id, seat, idx: i, kind: objs[i].kind, text: objs[i].text, status: 'pending' });
    await announce(en ? `${name} takes over ${charName}.` : `${name} 接替了「${charName}」，现在由真人来演。`);
    return { seat, replaced: charName };
  }

  if (slot.key.startsWith('botc:')) {
    const seat = slot.key.slice(5);
    if (used.has(seat)) throw new Error(en ? 'Seat taken' : '这个位置刚被人坐了');
    const { data: upd } = await admin.from('botc_players').update({ is_ai: false, display_name: String(name).slice(0, 20) }).eq('room_id', room.id).eq('seat', seat).eq('is_ai', true).select('seat');
    if (!upd?.length) throw new Error(en ? 'Seat taken' : '这个位置刚被人坐了');
    await join(seat); // 这个座位的身份私信开局时就发了，坐进来就能看到
    await announce(en ? `${name} sits down in ${slot.label}'s seat.` : `${name} 坐进了「${slot.label}」的位置。`);
    return { seat, replaced: slot.label };
  }

  if (slot.key.startsWith('mcc:')) {
    const seat = slot.key.slice(4);
    if (used.has(seat)) throw new Error(en ? 'Seat taken' : '这个位置刚被人坐了');
    const r = await mutateState(admin, room.id, (s: any) => {
      if (!(s.bots || []).includes(seat)) return 'gone';
      s.bots = s.bots.filter((x: string) => x !== seat);
      s.names[seat] = String(name).slice(0, 16);
      s.log.push({ msg: en ? `🐾 ${name} takes over ${slot.label}.` : `🐾 ${name} 接手了「${slot.label}」的牌。` });
      return 'ok';
    });
    if (!r.ok || r.result === 'gone') throw new Error(en ? 'Seat taken' : '这个位置刚被人坐了');
    await join(seat);
    return { seat, replaced: slot.label };
  }
  throw new Error('bad slot');
}
