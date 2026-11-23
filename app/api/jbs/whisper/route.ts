// 私下聊：玩家单独找一个 AI 角色或配角说话，只有这名玩家看得到（主持人知道）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { langDirective } from '@/lib/i18n';
import { NARRATE_RULES_ZH } from '@/lib/narrate';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, target, text } = await req.json().catch(() => ({} as any));
  const say = String(text || '').trim();
  if (!roomId || !target || !say) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('jbs_act, jbs_phase, jbs_stage, language').eq('id', roomId).maybeSingle();
  if (!room || room.jbs_phase !== 'playing') return NextResponse.json({ error: '现在不能私聊' }, { status: 409 });
  const { data: kr } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1);
  const cf = kr?.[0]?.case_file;
  if (!cf) return NextResponse.json({ error: '案件未生成' }, { status: 409 });
  const { data: chars } = await admin.from('jbs_characters').select('name, is_ai, assigned_seat').eq('room_id', roomId);
  const myName = (chars || []).find((c: any) => c.assigned_seat === me.seat)?.name || me.seat;
  const asChar = (cf.characters || []).find((c: any) => c.name === target);
  const isAiChar = !!asChar && !!(chars || []).find((c: any) => c.name === target && c.is_ai);
  const npc = (cf.npcs || []).find((n: any) => n.name === target);
  if (!isAiChar && !npc) return NextResponse.json({ error: '只能私下找 AI 角色或配角' }, { status: 400 });

  const vis = `seat:${me.seat}`;
  const act = room.jbs_act || 1;
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: me.id, turn_no: act, content: say, visibility: vis, payload: { type: 'jbs_whisper', with: target, from: 'me', by: myName } });
  const { data: past } = await admin.from('messages').select('content, payload').eq('room_id', roomId).eq('visibility', vis).filter('payload->>type', 'eq', 'jbs_whisper').filter('payload->>with', 'eq', target).order('created_at', { ascending: true }).limit(30);
  const { data: pub } = await admin.from('messages').select('content, payload').eq('room_id', roomId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(10);

  const persona = asChar
    ? `你是「${asChar.name}」（${asChar.occupation || ''}，${asChar.personality || ''}）。公开身份：${asChar.public_info || ''}。你的秘密：${asChar.secret || ''}。你的目标：${asChar.private_goal || ''}。你和别人的关系：${asChar.relationships || ''}。${cf.murderer === asChar.name ? '你就是真凶——绝不能承认，要撒谎、转移怀疑，但谎言要前后一致。' : ''}`
    : `你是配角「${npc.name}」（${npc.role || ''}）。${npc.look || ''} 你掌握：${npc.knows || ''}。你的性格和对调查者的态度：${npc.attitude || ''}。能让你开口的：${npc.price || ''}。`;
  const evid = (cf.evidence || []).map((e: any) => `${e.name}（${e.tier}）：${e.reveals}`).join('；');
  const sys = `${persona}
剧本杀《${cf.title || ''}》现在是第 ${act} 幕。「${myName}」把你拉到一边，**私下**和你说话，别人听不到。
【怎么演】完全用你本人的口吻说话，1~3 句，带一点动作或神情（用 **动作** 标）。私下比公开场合更松一点：可以透露公开时不肯说的事、提条件、试探对方、反过来套话；但你有自己的利益，不会无缘无故把一切都说出来。对方给的条件、拿出的证据、或者问到点子上，你才会吐露真东西。可以撒谎。
【绝不】说出完整真相或直接点名真凶（除非你就是在撒谎嫁祸）；不要替「${myName}」说话。
【线索】只有对方真正撬开你的嘴时，才可以给出一条与你有关的证据（从这里挑：${evid.slice(0, 1500)}），放进 clue；否则 clue 为 null。
最近公开发生的事：${(pub || []).reverse().map((m: any) => m.content).join(' / ').slice(0, 800)}
${NARRATE_RULES_ZH}
只输出 JSON：{ "reply": "你说的话", "clue": null 或 { "name":"证据名", "desc":"对方看到/听到的内容" } }`;
  const msgs = (past || []).slice(-12).map((m: any) => ({ role: m.payload?.from === 'me' ? 'user' as const : 'assistant' as const, content: m.content }));
  try {
    const { data: out, usage } = await callLLMJson<any>({ system: sys + langDirective(room.language), messages: msgs, tier: 'main', temperature: 0.85, maxTokens: 700, retry: true, proseKey: 'reply' });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    if (out.reply) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: act, content: out.reply, visibility: vis, payload: { type: 'jbs_whisper', with: target, from: 'them', by: myName, gender: (asChar || npc)?.gender } });
    if (out.clue?.name) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: act, content: `🔍 ${out.clue.name}：${out.clue.desc || ''}`, visibility: vis, payload: { type: 'jbs_evidence', key: false, via: target } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: (room.language === 'en' ? 'They said nothing: ' : '对方没开口：') + e.message }, { status: 500 });
  }
}
