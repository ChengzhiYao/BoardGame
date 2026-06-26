// 生成一道海龟汤：汤面入库给玩家看，汤底单独存（机密），开始解谜。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildSoupGenPrompt } from '@/lib/soup/prompt';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, difficulty, supernatural, gore, tone } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  // 已有谜题则幂等返回
  const { data: existing } = await admin.from('soup_puzzles').select('id').eq('room_id', roomId).maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId);
  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildSoupGenPrompt({ difficulty, supernatural, gore, tone }),
      messages: [{ role: 'user', content: '请出一道原创海龟汤。' }],
      tier: 'main', temperature: 0.8, maxTokens: 1200,
    });

    const { data: puzzle } = await admin.from('soup_puzzles').insert({
      room_id: roomId, title: data.title, surface: data.surface, difficulty: data.difficulty || difficulty || '普通', status: 'playing',
    }).select().single();
    await admin.from('soup_bottoms').insert({ puzzle_id: puzzle.id, bottom: data.bottom });

    await admin.from('rooms').update({ game_state: 'playing', modules_generating: false }).eq('id', roomId);
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'kp', turn_no: 0,
      content: `【汤面】${data.surface}\n\n你们可以提是非题，我只回答：是 / 不是 / 无关 / 是也不是。想好真相后点「揭晓答案」。`,
      payload: { type: 'soup_surface' },
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '海龟汤生成:' + e.message });
    return NextResponse.json({ error: '出题失败：' + e.message }, { status: 500 });
  }
}
