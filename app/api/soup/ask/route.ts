// 玩家提是非题 → 主持人据汤底裁定 是/不是/无关/是也不是。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildSoupAnswerPrompt } from '@/lib/soup/prompt';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, question } = await req.json().catch(() => ({} as any));
  if (!roomId || !question?.trim()) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: puzzle } = await admin.from('soup_puzzles').select('*').eq('room_id', roomId).maybeSingle();
  if (!puzzle || puzzle.status !== 'playing') return NextResponse.json({ error: '当前没有进行中的谜题' }, { status: 409 });
  const { data: bot } = await admin.from('soup_bottoms').select('bottom').eq('puzzle_id', puzzle.id).maybeSingle();

  // 落库玩家提问
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: me.id, action_type: 'free', content: question.trim(), turn_no: 0, visibility: 'public' });

  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildSoupAnswerPrompt(puzzle.surface, bot?.bottom || ''),
      messages: [{ role: 'user', content: '玩家的是非题：' + question.trim() }],
      tier: 'aux', temperature: 0.2, maxTokens: 120,
    });
    const verdict = ['是', '不是', '无关', '是也不是'].includes(data.verdict) ? data.verdict : '无关';
    const content = verdict + (data.note ? ` — ${data.note}` : '');
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 0, content, payload: { type: 'soup_answer' } });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: '回答出错：' + e.message }, { status: 500 });
  }
}
