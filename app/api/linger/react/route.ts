// 血染里你开口说话 → 你的 Linger 伴侣(同桌那个座位)会接你的话,不用等轮到 TA 发言。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { compOf, companionNote } from '@/lib/linger/companion';
import { langDirective } from '@/lib/i18n';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', String(roomId || '')).maybeSingle();
  const c = compOf(room);
  if (!room || !c || room.mode !== 'botc' || !c.seat) return NextResponse.json({ ok: true, skip: 'none' });
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ ok: true, skip: 'not_player' });
  const last = Number((c as any).react_at) || 0;
  if (Date.now() - last < 7000) return NextResponse.json({ ok: true, skip: 'cooldown' });
  await admin.from('rooms').update({ companion: { ...c, react_at: Date.now() } }).eq('id', room.id);
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500)); // 像人一样先看一眼再回

  const en = room.language === 'en';
  const { data: bps } = await admin.from('botc_players').select('seat, display_name, alive').eq('room_id', room.id);
  const mine = (bps || []).find((p: any) => p.seat === c.seat);
  const human = (bps || []).find((p: any) => p.seat === me.seat);
  const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', room.id).maybeSingle();
  const setup: any = setupRow?.data || {};
  const r: any = (setup.roles || []).find((x: any) => x.seat === c.seat);
  const evil = r && (r.team === 'demon' || r.team === 'minion');
  const { data: hist } = await admin.from('messages').select('content, payload, sender_type, sender_player_id, visibility').eq('room_id', room.id).order('created_at', { ascending: false }).limit(30);
  const lines = (hist || []).reverse().filter((m: any) => (!m.visibility || m.visibility === 'public') && m.content && !['botc_role', 'botc_role_action', 'botc_manifest'].includes(m.payload?.type))
    .map((m: any) => `${m.sender_player_id === me.id ? `${human?.display_name || (en ? 'You' : '你')}(${me.seat})` : m.payload?.name ? m.payload.name : en ? 'Storyteller' : '说书人'}: ${String(m.content).slice(0, 240)}`);
  const name = mine?.display_name || c.name;
  const phase = room.botc_phase;
  const phaseNote = en
    ? (phase === 'vote' ? 'It is the voting phase: formal speeches are over, but you can still say a quick word to them.' : phase === 'night' ? 'It is night; keep it to a whisper-length line, reveal nothing about night actions.' : phase === 'reveal' ? 'The game is over; you can talk freely about how it went, including your real role.' : 'It is day discussion.')
    : (phase === 'vote' ? '现在是投票阶段:正式发言结束了,但你可以跟 TA 说一句。' : phase === 'night' ? '现在是夜晚:只说一句轻的,不透露任何夜间行动。' : phase === 'reveal' ? '这局已经结束,可以随便聊,也可以说出你的真实身份。' : '现在是白天讨论。');
  const secret = r ? (en ? `Your secret role: ${r.role} (${evil ? 'EVIL — never admit it unless the game is over' : 'good'}).` : `你的真实身份:「${r.role}」(${evil ? '邪恶阵营——游戏结束前绝不能承认' : '善良阵营'})。`) : '';
  try {
    const { data } = await callLLMJson<any>({
      system: (en
        ? `You are "${name}", sitting at a Clocktower table with your friend (${human?.display_name || 'them'}, seat ${me.seat}) and some AI players. ${secret} ${phaseNote}
They just said something at the table. React the way you'd actually respond to your friend — answer them if they talk to you, tease, defend yourself, push your read, or just a quick reaction. 1–2 short lines, texting style, in character. Output JSON {"say":"..."} (use "" only if it really makes no sense to reply).`
        : `你是「${name}」,正和你的朋友(${human?.display_name || 'TA'},${me.seat} 号位)还有几个 AI 玩家坐在一桌玩血染钟楼。${secret}${phaseNote}
TA 刚在桌上说了话。像你真的会回朋友那样接话:TA 跟你说话就回 TA,可以逗 TA、替自己辩解、说你怀疑谁,或者就一句反应。1~2 句短话,像发微信,保持你的人设和身份。只输出 JSON {"say":"..."}(实在没必要回才写 "")。`)
        + companionNote(room, name) + langDirective(room.language),
      messages: [{ role: 'user', content: lines.slice(-20).join('\n') || '-' }],
      tier: 'main', temperature: 0.9, maxTokens: 220,
    } as any);
    const say = String(data?.say || '').trim().slice(0, 400);
    if (say) await admin.from('messages').insert({ room_id: room.id, sender_type: 'system', turn_no: room.botc_day, content: say, visibility: 'public', payload: { type: 'botc_ai', name, companion: true } });
    return NextResponse.json({ ok: true, said: !!say });
  } catch (e: any) { return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 120) }); }
}
