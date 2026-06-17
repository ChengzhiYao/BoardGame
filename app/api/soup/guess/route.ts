// 玩家揭晓答案 → 判定是否说中汤底核心；中了就通关并揭晓汤底。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildSoupJudgePrompt } from '@/lib/soup/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, guess } = await req.json().catch(() => ({} as any));
  if (!roomId || !guess?.trim()) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: puzzle } = await admin.from('soup_puzzles').select('*').eq('room_id', roomId).maybeSingle();
  if (!puzzle || puzzle.status !== 'playing') return NextResponse.json({ error: '当前没有进行中的谜题' }, { status: 409 });
  const { data: bot } = await admin.from('soup_bottoms').select('bottom').eq('puzzle_id', puzzle.id).maybeSingle();
  const { data: rm } = await admin.from('rooms').select('language').eq('id', roomId).maybeSingle();
  const lang = rm?.language || 'zh';

  await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: me.id, action_type: 'free', content: '【揭晓】' + guess.trim(), turn_no: 0, visibility: 'public' });

  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildSoupJudgePrompt(puzzle.surface, bot?.bottom || '') + langDirective(lang),
      messages: [{ role: 'user', content: '玩家的猜测：' + guess.trim() }],
      tier: 'main', temperature: 0.2, maxTokens: 300,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 0, content: (data.solved ? (lang === 'en' ? '✅ Correct!' : '✅ 答对了！') : (lang === 'en' ? '❌ Not quite.' : '❌ 还差一点。')) + (data.comment ? ' ' + data.comment : ''), payload: { type: 'soup_answer' } });

    if (data.solved) {
      await admin.from('soup_puzzles').update({ status: 'solved' }).eq('id', puzzle.id);
      await admin.from('rooms').update({ game_state: 'ended' }).eq('id', roomId);
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: (lang === 'en' ? '[Answer] ' : '【汤底揭晓】') + (bot?.bottom || ''), payload: { type: 'soup_reveal' } });
    }
    return NextResponse.json({ ok: true, solved: !!data.solved });
  } catch (e: any) {
    return NextResponse.json({ error: '判定出错：' + e.message }, { status: 500 });
  }
}
