// 海龟汤提示：问满 8 题后每局最多要 2 次；另外玩家卡住 2 分钟没提问时，主持人主动给一句（每局 1 次，不占次数）。
// 只指方向，绝不说出答案。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
export const maxDuration = 45;
const HINT_AFTER = 8;
const HINT_MAX = 2;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, auto } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: puzzle } = await admin.from('soup_puzzles').select('*').eq('room_id', roomId).maybeSingle();
  if (!puzzle || puzzle.status !== 'playing') return NextResponse.json({ error: '这碗汤已经结束了' }, { status: 409 });
  const { data: msgs } = await admin.from('messages').select('sender_type, content, payload, created_at').eq('room_id', roomId).order('created_at', { ascending: true }).limit(200);
  const qs = (msgs || []).filter((m: any) => m.sender_type === 'player');
  const hints = (msgs || []).filter((m: any) => m.payload?.type === 'soup_hint');
  if (auto) {
    if (hints.some((h: any) => h.payload?.auto)) return NextResponse.json({ ok: false });
    const last = (msgs || []).slice(-1)[0];
    if (last && Date.now() - new Date(last.created_at).getTime() < 110000) return NextResponse.json({ ok: false });
  } else {
    if (qs.length < HINT_AFTER) return NextResponse.json({ error: `再问 ${HINT_AFTER - qs.length} 个问题就能要提示` }, { status: 409 });
    if (hints.filter((h: any) => !h.payload?.auto).length >= HINT_MAX) return NextResponse.json({ error: '这碗汤的提示已经用完了' }, { status: 409 });
  }
  const { data: bot } = await admin.from('soup_bottoms').select('bottom').eq('puzzle_id', puzzle.id).maybeSingle();
  const qa = (msgs || []).filter((m: any) => m.sender_type === 'player' || m.payload?.type === 'soup_answer' || m.payload?.type === 'soup_hint').map((m: any) => (m.sender_type === 'player' ? '问：' : '答：') + m.content).join('\n').slice(-2500);
  const { data: rm } = await admin.from('rooms').select('language').eq('id', roomId).maybeSingle();
  const en = rm?.language === 'en';
  try {
    const { data, usage } = await callLLMJson<any>({
      system: `你是海龟汤主持人。汤面：${puzzle.surface}\n汤底（绝密）：${bot?.bottom || ''}\n\n玩家已经问过：\n${qa || '（还没问）'}\n\n给玩家**一句**提示（20 字以内），指出一个他们还没注意到、但很关键的方向，像"想想他为什么要回去"、"注意那通电话的时间"。\n绝对不能说出汤底里的关键事实或答案本身，不能用"其实…"直接解释。语气神秘一点。${auto ? '玩家好像卡住了，这句要更温和、更好懂。' : ''}${en ? '\nReply in English.' : ''}\n只输出 JSON：{ "hint": "..." }`,
      messages: [{ role: 'user', content: '给一句提示' }],
      tier: 'aux', temperature: 0.6, maxTokens: 120, proseKey: 'hint',
    });
    const hint = String(data?.hint || '').trim();
    if (!hint) throw new Error('空提示');
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 0, content: hint, payload: { type: 'soup_hint', auto: !!auto } });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: '提示没想出来，再试一次：' + e.message }, { status: 500 });
  }
}
