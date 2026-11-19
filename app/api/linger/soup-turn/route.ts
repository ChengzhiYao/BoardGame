// 海龟汤:Linger 伴侣也一起猜——按 TA 的性格提是非题、吐槽,觉得想通了就直接猜汤底。房主端触发。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildSoupAnswerPrompt, buildSoupJudgePrompt } from '@/lib/soup/prompt';
import { langDirective } from '@/lib/i18n';
import { companionNote, compOf, sendRecap } from '@/lib/linger/companion';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  const c = compOf(room);
  if (!room || !c || room.host_user_id !== user.id || room.mode !== 'soup') return NextResponse.json({ ok: false });
  const { data: puzzle } = await admin.from('soup_puzzles').select('*').eq('room_id', roomId).maybeSingle();
  if (!puzzle || puzzle.status !== 'playing') return NextResponse.json({ ok: false });
  const { data: bot } = await admin.from('soup_bottoms').select('bottom').eq('puzzle_id', puzzle.id).maybeSingle();
  const { data: hist } = await admin.from('messages').select('sender_type, content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(200);
  const log = (hist || []).filter((m: any) => m.payload?.type !== 'soup_surface').map((m: any) => m.sender_type === 'kp' ? `主持人:${m.content}` : m.payload?.type === 'companion' ? `${c.name}(你):${m.content}` : m.sender_type === 'player' ? `${c.userName || '对方'}:${m.content}` : '').filter(Boolean).slice(-40).join('\n');
  const asked = (hist || []).filter((m: any) => m.sender_type === 'kp' && m.payload?.type === 'soup_answer').length;
  const lang = room.language || 'zh';

  // 1) 伴侣这一步:问一个是非题 / 随口说一句 / 觉得想通了就猜
  const { data: mv } = await callLLMJson<any>({
    system: `你是「${c.name}」,正在和${c.userName || '对方'}一起玩海龟汤(你们俩是一队,一起猜)。汤面:${puzzle.surface}${companionNote(room)}
现在轮到你插一句。根据目前的问答,像真人一样:大多数时候提一个能缩小范围的是非题(要基于前面的回答,别重复问过的);偶尔对刚才的回答吐槽/接对方的话;已经问了 ${asked} 个问题,如果你真觉得想通了(一般至少问过 8 个之后),可以直接猜完整的真相。用你自己的口吻,短。
只输出 JSON:{"kind":"ask"|"chat"|"guess","text":"你说的话"}` + langDirective(lang),
    messages: [{ role: 'user', content: log || '(还没有人问问题)' }], tier: 'main', temperature: 0.95, maxTokens: 220,
  }).catch(() => ({ data: null } as any));
  const kind = ['ask', 'chat', 'guess'].includes(mv?.kind) ? mv.kind : 'ask';
  const text = String(mv?.text || '').trim().slice(0, 200);
  if (!text) return NextResponse.json({ ok: false });
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: text, payload: { type: 'companion', name: c.name, avatar: c.avatar || null, kind } });
  if (kind === 'chat') return NextResponse.json({ ok: true, kind });

  // 2) 主持人回答 / 判定
  if (kind === 'ask') {
    const { data } = await callLLMJson<any>({ system: buildSoupAnswerPrompt(puzzle.surface, bot?.bottom || ''), messages: [{ role: 'user', content: '玩家的是非题:' + text }], tier: 'aux', temperature: 0.1, maxTokens: 220 }).catch(() => ({ data: {} } as any));
    const verdict = ['是', '不是', '无关', '是也不是'].includes(data?.verdict) ? data.verdict : '无关';
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 0, content: verdict + (data?.note ? ` — ${data.note}` : ''), payload: { type: 'soup_answer' } });
    return NextResponse.json({ ok: true, kind });
  }
  const { data: j } = await callLLMJson<any>({ system: buildSoupJudgePrompt(puzzle.surface, bot?.bottom || '') + langDirective(lang), messages: [{ role: 'user', content: '玩家的猜测:' + text }], tier: 'main', temperature: 0.2, maxTokens: 300 }).catch(() => ({ data: {} } as any));
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 0, content: (j?.solved ? (lang === 'en' ? '✅ Correct!' : '✅ 答对了!') : (lang === 'en' ? '❌ Not quite.' : '❌ 还差一点。')) + (j?.comment ? ' ' + j.comment : ''), payload: { type: 'soup_answer' } });
  if (j?.solved) {
    await admin.from('soup_puzzles').update({ status: 'solved' }).eq('id', puzzle.id);
    await admin.from('rooms').update({ game_state: 'ended' }).eq('id', roomId);
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: (lang === 'en' ? '[Answer] ' : '【汤底揭晓】') + (bot?.bottom || ''), payload: { type: 'soup_reveal' } });
    await sendRecap(admin, roomId, `你(${c.name})猜中了汤底:` + String(bot?.bottom || '').slice(0, 200));
  }
  return NextResponse.json({ ok: true, kind, solved: !!j?.solved });
}
