// 剧本杀：让主持人主动"带一下戏"（幕转场 / 突发事件），并把输出写进房间。
import { callLLMJson, type LLMMessage } from '@/lib/llm';
import { buildJbsDmPrompt } from '@/lib/jbs/prompt';
import { langDirective } from '@/lib/i18n';
import { companionNote } from '@/lib/linger/companion';
import { moveScene } from '@/lib/jbs/stage';

export async function historyFor(admin: any, roomId: string, n = 16) {
  const { data: chars } = await admin.from('jbs_characters').select('name, is_ai, assigned_seat').eq('room_id', roomId);
  const realRoster = (chars || []).filter((c: any) => !c.is_ai && c.assigned_seat).map((c: any) => ({ seat: c.assigned_seat, name: c.name }));
  const aiNames = (chars || []).filter((c: any) => c.is_ai).map((c: any) => c.name);
  const nameBySeat: Record<string, string> = {};
  realRoster.forEach((r: any) => { nameBySeat[r.seat] = r.name; });
  const { data: players } = await admin.from('players').select('id, seat').eq('room_id', roomId);
  const seatByPid: Record<string, string> = {};
  (players || []).forEach((p: any) => { seatByPid[p.id] = p.seat; });
  const { data: history } = await admin.from('messages').select('sender_type, content, payload, sender_player_id').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
  const base: LLMMessage[] = (history || []).slice(-n).map((m: any) => toLLM(m, nameBySeat, seatByPid));
  return { base, aiNames, realRoster, nameBySeat, seatByPid };
}

export function toLLM(m: any, nameBySeat: Record<string, string>, seatByPid: Record<string, string>): LLMMessage {
  const t = m.payload?.type;
  if (m.sender_type === 'kp' && t !== 'jbs_ai') return { role: 'assistant', content: m.content };
  let tag = '[系统]';
  if (t === 'jbs_ai') tag = `[${m.payload?.name || 'NPC'}·AI]`;
  else if (t === 'jbs_whisper') tag = m.payload?.from === 'me' ? `[私下·${m.payload?.by || '玩家'}对${m.payload?.with}说]` : `[私下·${m.payload?.with}回${m.payload?.by || '玩家'}]`;
  else if (t === 'jbs_event') tag = '[突发事件]';
  else if (t === 'jbs_scene') tag = '[换到地点]';
  else if (m.sender_type === 'player') tag = `[${nameBySeat[seatByPid[m.sender_player_id]] || '玩家'}·真人]`;
  return { role: 'user', content: `${tag} ${m.content}` };
}

export async function dmBeat(admin: any, roomId: string, room: any, cf: any, nudge: string, act: number, justHappened?: string | null) {
  const { base, aiNames, realRoster } = await historyFor(admin, roomId, 14);
  const npcNames = (cf?.npcs || []).map((n: any) => n.name).filter(Boolean);
  const { data: out, usage } = await callLLMJson<any>({
    system: buildJbsDmPrompt(cf, act, aiNames, realRoster, { elapsedMin: 0, actMin: room.jbs_act_minutes || 6 }, undefined, room.jbs_stage, justHappened) + companionNote(room, room.companion?.role || undefined) + langDirective(room.language),
    messages: [...base, { role: 'user', content: nudge }],
    tier: 'main', temperature: 0.85, maxTokens: 2200, retry: true, proseKey: 'narration',
  });
  await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
  await writeOut(admin, roomId, room, out, act, [...aiNames, ...npcNames]);
  return out;
}

export async function writeOut(admin: any, roomId: string, room: any, out: any, act: number, speakers: string[]) {
  if (out?.narration) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: act, content: out.narration, payload: { type: 'jbs_dm' } });
  if (out?.scene) await moveScene(admin, roomId, room, String(out.scene), act);
  for (const a of out?.ai_lines || []) {
    if (!a?.text || !a?.name || !speakers.includes(a.name)) continue; // 绝不让 AI 顶替真人
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: act, content: a.text, payload: { type: 'jbs_ai', name: a.name } });
  }
  for (const ev of out?.evidence_revealed || []) {
    if (!ev?.name) continue;
    const vis = /^[A-H]$/.test(String(ev.to)) ? `seat:${ev.to}` : 'public';
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: act, content: `🔍 ${ev.name}：${ev.desc || ''}`, visibility: vis, payload: { type: 'jbs_evidence', key: !!ev.key } });
  }
  for (const pn of out?.private_notes || []) {
    if (!pn?.text || !/^[A-H]$/.test(String(pn.to))) continue;
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: act, content: pn.text, visibility: `seat:${pn.to}`, payload: { type: 'private' } });
  }
  if (Array.isArray(out?.resources) && out.resources.length) await admin.from('rooms').update({ jbs_resources: out.resources }).eq('id', roomId);
}
