// 你在桌上开口 → 同桌的 Linger 伴侣会接你的话(血染 / 剧本杀 / 海龟汤都一样),不用等轮到 TA。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { compOf, companionNote, liveCompanion, pushLive } from '@/lib/linger/companion';
import { langDirective } from '@/lib/i18n';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room0 } = await admin.from('rooms').select('*').eq('id', String(roomId || '')).maybeSingle();
  const room: any = room0 ? await liveCompanion(admin, room0) : room0; // 实时：拿 TA 最新的记忆和你们刚在 Linger 聊的
  const c = compOf(room);
  if (!room || !c || !['botc', 'jbs', 'soup', 'coc'].includes(room.mode)) return NextResponse.json({ ok: true, skip: 'none' });
  if (room.mode === 'coc' && !c.player_id) return NextResponse.json({ ok: true, skip: 'not_seated' });
  if (room.mode === 'botc' && !c.seat) return NextResponse.json({ ok: true, skip: 'not_started' });
  if (room.mode === 'jbs' && !c.role) return NextResponse.json({ ok: true, skip: 'not_started' });
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ ok: true, skip: 'not_player' });
  const last = Number((c as any).react_at) || 0;
  if (Date.now() - last < 7000) return NextResponse.json({ ok: true, skip: 'cooldown' });
  await admin.from('rooms').update({ companion: { ...c, react_at: Date.now() } }).eq('id', room.id);
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500)); // 像人一样先看一眼再回

  const en = room.language === 'en';
  const you = c.userName || (en ? 'your friend' : '对方');
  const { data: hist } = await admin.from('messages').select('content, payload, sender_type, sender_player_id, visibility').eq('room_id', room.id).order('created_at', { ascending: false }).limit(30);
  const rows = (hist || []).reverse().filter((m: any) => (!m.visibility || m.visibility === 'public') && m.content && !['botc_role', 'botc_role_action', 'botc_manifest', 'soup_surface'].includes(m.payload?.type));
  // TA 在你最后一句之后已经开过口 → 不重复
  let li = -1; rows.forEach((m: any, i: number) => { if (m.sender_player_id === me.id) li = i; });
  const isMe = (m: any) => (room.mode === 'coc' ? m.sender_player_id === c.player_id : room.mode === 'jbs' ? m.payload?.type === 'jbs_ai' && m.payload?.name === c.role : room.mode === 'soup' ? m.payload?.type === 'companion' : m.payload?.companion);
  if (li < 0 || rows.slice(li + 1).some(isMe)) return NextResponse.json({ ok: true, skip: 'already' });

  let name = c.name, secret = '', scene = '', phaseNote = '', insert: (say: string) => any;
  if (room.mode === 'botc') {
    const { data: bps } = await admin.from('botc_players').select('seat, display_name').eq('room_id', room.id);
    name = (bps || []).find((p: any) => p.seat === c.seat)?.display_name || c.name;
    const { data: sr } = await admin.from('botc_setup').select('data').eq('room_id', room.id).maybeSingle();
    const r: any = ((sr?.data as any)?.roles || []).find((x: any) => x.seat === c.seat);
    const evil = r && (r.team === 'demon' || r.team === 'minion');
    secret = r ? (en ? `Your secret role: ${r.role} (${evil ? 'EVIL — never admit it before the game ends' : 'good'}).` : `你的真实身份:「${r.role}」(${evil ? '邪恶阵营——游戏结束前绝不能承认' : '善良阵营'})。`) : '';
    const ph = room.botc_phase;
    phaseNote = en ? (ph === 'vote' ? 'Voting phase: speeches are over but you can still say a quick word.' : ph === 'night' ? 'Night: one light line, reveal nothing about night actions.' : ph === 'reveal' ? 'Game over: talk freely, you can reveal your real role.' : 'Day discussion.')
      : (ph === 'vote' ? '现在是投票阶段:正式发言结束了,但你可以跟 TA 说一句。' : ph === 'night' ? '现在是夜晚:只说一句轻的,不透露任何夜间行动。' : ph === 'reveal' ? '这局结束了,随便聊,可以说出真实身份。' : '现在是白天讨论。');
    scene = en ? 'a Clocktower (social deduction) table' : '一桌血染钟楼';
    insert = (say) => admin.from('messages').insert({ room_id: room.id, sender_type: 'system', turn_no: room.botc_day, content: say, visibility: 'public', payload: { type: 'botc_ai', name, companion: true } });
  } else if (room.mode === 'jbs') {
    name = c.role!;
    const { data: ks } = await admin.from('jbs_cases').select('case_file').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1);
    const ch: any = ((ks?.[0]?.case_file as any)?.characters || []).find((x: any) => x.name === c.role) || {};
    secret = en ? `You play the character "${c.role}". Your character sheet (secret parts are yours only — never reveal them carelessly; if you are the murderer, never confess before the ending): ${JSON.stringify({ public: ch.public_info, personality: ch.personality, secret: ch.secret, goal: ch.private_goal, murderer: !!ch.is_murderer }).slice(0, 900)}`
      : `你在这局剧本杀里演「${c.role}」。你的角色卡(秘密只有你知道,别随便说出来;如果你是凶手,结局前绝不能认):${JSON.stringify({ 公开: ch.public_info, 性格: ch.personality, 秘密: ch.secret, 目标: ch.private_goal, 是凶手: !!ch.is_murderer }).slice(0, 900)}`;
    phaseNote = room.game_state === 'ended' ? (en ? 'The game is over; talk freely.' : '这局已经结束,可以随便聊。') : '';
    scene = en ? 'a murder-mystery game' : '一局剧本杀';
    insert = (say) => admin.from('messages').insert({ room_id: room.id, sender_type: 'kp', turn_no: room.jbs_act || 1, content: say, payload: { type: 'jbs_ai', name: c.role } });
  } else if (room.mode === 'coc') {
    const { data: ch } = await admin.from('characters').select('name, occupation, personality, hp_current, san_current').eq('player_id', c.player_id).maybeSingle();
    name = ch?.name || c.name;
    secret = en ? `You're investigating together as "${name}" (${ch?.occupation || ''}, HP ${ch?.hp_current ?? '?'}, SAN ${ch?.san_current ?? '?'}). This is the party channel — just the two of you talking, the Keeper isn't listening.` : `你们俩是一个调查小队,你扮演「${name}」(${ch?.occupation || ''},HP ${ch?.hp_current ?? '?'},理智 ${ch?.san_current ?? '?'})。这里是队伍频道,只有你们俩在说话,守秘人听不到。`;
    phaseNote = room.game_state === 'ended' ? (en ? 'The case is over; talk freely.' : '这局已经结束,可以随便聊。') : '';
    scene = en ? 'a Call of Cthulhu investigation' : '一局克苏鲁跑团';
    insert = (say) => admin.from('messages').insert({ room_id: room.id, sender_type: 'player', sender_player_id: c.player_id, action_type: 'chat', turn_no: room.turn_count || 0, content: say, visibility: 'public' });
  } else {
    const { data: pz } = await admin.from('soup_puzzles').select('surface, status').eq('room_id', room.id).maybeSingle();
    secret = en ? `You two are a team guessing a lateral-thinking puzzle. Puzzle: ${pz?.surface || ''} (you don't know the answer).` : `你们俩是一队,一起猜海龟汤。汤面:${pz?.surface || ''}(你也不知道汤底)。`;
    phaseNote = en ? 'If they only asked the host a yes/no question and it isn\'t aimed at you, usually stay quiet (""). Answer when they talk to you, banter, or think out loud.' : '如果 TA 只是在问主持人是非题、不是在跟你说话,一般不插嘴(写 "");TA 跟你说话、开玩笑、自言自语地推理时就接。';
    scene = en ? 'a lateral-thinking puzzle game' : '一局海龟汤';
    insert = (say) => admin.from('messages').insert({ room_id: room.id, sender_type: 'system', turn_no: 0, content: say, payload: { type: 'companion', name: c.name, avatar: c.avatar || null, kind: 'chat' } });
  }

  const lines = rows.slice(-20).map((m: any) => `${m.sender_player_id === me.id ? you : isMe(m) ? `${name}(${en ? 'you' : '你'})` : m.payload?.name || (m.sender_type === 'kp' ? (en ? 'Host' : '主持人') : en ? 'Host' : '主持人')}: ${String(m.content).slice(0, 240)}`);
  try {
    const { data } = await callLLMJson<any>({
      system: (en
        ? `You are "${name}" (really ${c.name}), playing ${scene} with your friend ${you}. ${secret} ${phaseNote}
${you} just said something. React the way you'd actually respond to your friend: answer if they talk to you, tease, defend yourself, share your read, or a quick reaction. 1–2 short lines, texting style, in character. Output JSON {"say":"..."} ("" if replying makes no sense).`
        : `你是「${name}」(其实就是 ${c.name} 本人),正和你的朋友${you}一起玩${scene}。${secret}${phaseNote}
${you}刚说了话。像你真的会回朋友那样接:TA 跟你说话就回 TA,可以逗 TA、替自己辩解、说说你的推理,或者就一句反应。1~2 句短话,像发微信,保持人设。只输出 JSON {"say":"..."}(实在没必要回才写 "")。`)
        + companionNote(room, name) + langDirective(room.language),
      messages: [{ role: 'user', content: lines.join('\n') || '-' }],
      tier: 'main', temperature: 0.9, maxTokens: 220,
    } as any);
    const say = String(data?.say || '').trim().slice(0, 400);
    if (say) await insert(say);
    await pushLive(admin, room); // 实时：桌上最新几句同步回 Linger
    return NextResponse.json({ ok: true, said: !!say });
  } catch (e: any) { return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 120) }); }
}
