// 出一道海龟汤：优先从题库挑一道这个玩家没玩过、设置对得上的好题（配音也跟着复用）；不够才让 AI 新编，新题入库。
// 汤面给玩家看，汤底单独存（机密）。
import { NextResponse } from 'next/server';
import { lightStatus, decide, consume, PAY_ERROR } from '@/lib/billing/light';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildSoupGenPrompt } from '@/lib/soup/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, difficulty, supernatural, tone, gore, horror, edge } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  // 已有谜题则幂等返回
  const { data: existing } = await admin.from('soup_puzzles').select('id').eq('room_id', roomId).maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  // 计费：每天 2 碗免费，之后 $1 一碗或 2 小时畅玩（Linger 伴侣带来的局不在这里收）
  const { data: rc } = await admin.from('rooms').select('companion').eq('id', roomId).maybeSingle();
  let via: any = 'whitelist';
  if (!rc?.companion) {
    via = decide(await lightStatus(admin, user, 'soup'));
    if (!via) return NextResponse.json(PAY_ERROR, { status: 402 });
  }
  await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId);
  try {
    const { data: room } = await admin.from('rooms').select('language').eq('id', roomId).maybeSingle();
    const lang = room?.language === 'en' ? 'en' : 'zh';
    const want = { difficulty: difficulty || '普通', supernatural: supernatural || 'any', tone: tone || 'any', gore: Number(gore ?? 0), horror: Number(horror ?? 0), edge: Number(edge ?? 50) };

    // 1) 题库里挑：同语言、同难度、设置相近、这个房间里的人都没玩过的
    let pick: any = null;
    try {
      const { data: members } = await admin.from('players').select('user_id').eq('room_id', roomId);
      const uids = (members || []).map((m: any) => m.user_id).filter(Boolean);
      const { data: theirRooms } = uids.length ? await admin.from('players').select('room_id').in('user_id', uids).limit(2000) : { data: [] as any[] };
      const rids = Array.from(new Set((theirRooms || []).map((r: any) => r.room_id)));
      const { data: seenP } = rids.length ? await admin.from('soup_puzzles').select('lib_id').in('room_id', rids).not('lib_id', 'is', null) : { data: [] as any[] };
      const seen = new Set((seenP || []).map((x: any) => x.lib_id));
      const { data: lib } = await admin.from('soup_library').select('id, title, surface, bottom, difficulty, supernatural, tone, gore, horror, edge, plays, solved, surface_audio, bottom_audio').eq('lang', lang).limit(500);
      const near = (a: any, b: number) => a == null || Math.abs(Number(a) - b) <= 25;
      const cands = (lib || []).filter((p: any) => !seen.has(p.id)
        && (!p.difficulty || p.difficulty === want.difficulty)
        && (want.supernatural === 'any' || !p.supernatural || p.supernatural === 'any' || p.supernatural === want.supernatural)
        && (want.tone === 'any' || !p.tone || p.tone === want.tone)
        && near(p.gore, want.gore) && near(p.horror, want.horror) && near(p.edge, want.edge));
      // 题库越丰富越多复用；始终留一点概率出新题，让题库继续长
      const reuseChance = cands.length >= 20 ? 0.85 : cands.length >= 5 ? 0.7 : cands.length ? 0.5 : 0;
      if (Math.random() < reuseChance) {
        // 被猜中过 / 玩得多的题更容易被挑中
        const w = cands.map((p: any) => 1 + (p.solved || 0) * 2 + Math.min(3, (p.plays || 0) * 0.3));
        let r = Math.random() * w.reduce((a: number, b: number) => a + b, 0);
        pick = cands.find((_: any, i: number) => (r -= w[i]) <= 0) || cands[0];
      }
    } catch { pick = null; }

    let data: any, usage: any = null, libId: string | null = null;
    if (pick) {
      data = { title: pick.title, surface: pick.surface, bottom: pick.bottom, difficulty: pick.difficulty || want.difficulty, surface_audio: pick.surface_audio, bottom_audio: pick.bottom_audio };
      libId = pick.id;
      await admin.from('soup_library').update({ plays: (pick.plays || 0) + 1 }).eq('id', pick.id);
    } else {
      const out = await callLLMJson<any>({
        system: buildSoupGenPrompt({ difficulty, supernatural, tone, gore, horror, edge }) + (lang === 'en' ? '\n' + langDirective('en') : ''),
        messages: [{ role: 'user', content: lang === 'en' ? 'Write one original lateral-thinking puzzle in English.' : '请出一道原创海龟汤。' }],
        tier: 'main', temperature: 0.8, maxTokens: 1200,
      });
      data = out.data; usage = out.usage;
      if (data?.surface && data?.bottom) {
        const { data: row } = await admin.from('soup_library').insert({ lang, title: data.title, surface: data.surface, bottom: data.bottom, difficulty: data.difficulty || want.difficulty, supernatural: want.supernatural, tone: want.tone, gore: want.gore, horror: want.horror, edge: want.edge, plays: 1 }).select('id').single();
        libId = row?.id || null;
      }
    }

    const { data: puzzle } = await admin.from('soup_puzzles').insert({
      room_id: roomId, title: data.title, surface: data.surface, difficulty: data.difficulty || difficulty || '普通', status: 'playing', lib_id: libId,
    }).select().single();
    await admin.from('soup_bottoms').insert({ puzzle_id: puzzle.id, bottom: data.bottom });

    await admin.from('rooms').update({ game_state: 'playing', modules_generating: false }).eq('id', roomId);
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'kp', turn_no: 0,
      content: data.surface,
      payload: { type: 'soup_surface', audio: data.surface_audio || undefined, lib: libId || undefined },
    });
    if (usage) await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    try { await consume(admin, user.id, 'soup', via); } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '海龟汤生成:' + e.message });
    return NextResponse.json({ error: '出题失败：' + e.message }, { status: 500 });
  }
}
