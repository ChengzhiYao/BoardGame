// 血染 · 建局：生成原创身份并随机分配（真人也可为邪恶）→ 建 botc_players（真人座位 + AI 补位）
// → 私信各真人身份卡（含夜间能力）→ 进入第 1 天白天。第一夜为信息夜（无夜杀），真正的夜间行动从入夜后开始。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBotcSetupPrompt, nightOrderOf } from '@/lib/botc/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, size, theme } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  if (room.botc_phase === 'day' || room.botc_phase === 'night' || room.botc_phase === 'reveal') return NextResponse.json({ ok: true });

  const { data: players } = await admin.from('players').select('id, seat, user_id').eq('room_id', roomId);
  const realSeats = (players || []).map((p: any) => p.seat).filter((s: string) => /^[A-H]$/.test(s)).sort();
  const want = [4, 6, 8].includes(Number(size)) ? Number(size) : 6;
  const need = Math.max(realSeats.length, want);
  const finalSize = need <= 4 ? 4 : need <= 6 ? 6 : 8;

  const { data: claimed } = await admin.from('rooms').update({ botc_phase: 'locking', modules_generating: true })
    .eq('id', roomId).or('botc_phase.is.null,botc_phase.eq.lobby').select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, already: true });
  await admin.from('botc_players').delete().eq('room_id', roomId);
  await admin.from('botc_setup').delete().eq('room_id', roomId);
  await admin.from('botc_votes').delete().eq('room_id', roomId);
  await admin.from('botc_night').delete().eq('room_id', roomId);

  try {
    const { data: cf, usage } = await callLLMJson<any>({
      system: buildBotcSetupPrompt(finalSize, theme || '', realSeats) + langDirective(room.language),
      messages: [{ role: 'user', content: '请生成本局身份并分配。' }],
      tier: 'main', temperature: 0.8, maxTokens: 3800,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    let roles: any[] = Array.isArray(cf.roles) ? cf.roles : [];
    if (roles.length < finalSize) throw new Error('身份生成不足');
    roles = roles.slice(0, finalSize);
    for (const r of roles) { r.night_order = nightOrderOf(r.night_action || 'none'); }

    const { data: users } = await admin.from('users').select('id, display_name').in('id', (players || []).map((p: any) => p.user_id));
    const nameOfSeat = (seat: string) => { const p = players?.find((x: any) => x.seat === seat); return users?.find((u: any) => u.id === p?.user_id)?.display_name || '玩家'; };

    const assigned = new Set(roles.map((r) => r.seat).filter((s: string) => /^[A-H]$/.test(s)));
    const missing = realSeats.filter((s: string) => !assigned.has(s));
    let mi = 0;
    for (const r of roles) { if (mi >= missing.length) break; if (!/^[A-H]$/.test(r.seat)) r.seat = missing[mi++]; }
    for (const r of roles) { if (!/^[A-H]$/.test(r.seat)) r.seat = null; }

    const rows = roles.map((r: any, i: number) => ({
      room_id: roomId, seat: r.seat || null,
      display_name: r.seat ? nameOfSeat(r.seat) : (r.role || `AI-${i + 1}`),
      is_ai: !r.seat, alive: true,
    }));
    await admin.from('botc_players').insert(rows);
    await admin.from('botc_setup').insert({ room_id: roomId, data: { ...cf, roles, _notes: [] } });

    const en = room.language === 'en';
    const actLabel = (a: string) => a === 'kill' ? (en ? 'each night, kill one player' : '每夜杀一名玩家') : a === 'poison' ? (en ? 'each night, poison one player (their info turns false)' : '每夜投毒一名玩家（其信息变假）') : a === 'protect' ? (en ? 'each night, protect one player from death' : '每夜保护一名玩家免于死亡') : '';
    for (const r of roles) {
      if (!r.seat) continue;
      const team = r.team === 'demon' ? (en ? 'Demon (Evil)' : '恶魔（邪恶）') : r.team === 'minion' ? (en ? 'Minion (Evil)' : '爪牙（邪恶）') : r.team === 'outsider' ? (en ? 'Outsider (Good)' : '外来者（善良）') : (en ? 'Townsfolk (Good)' : '镇民（善良）');
      const nightLine = ['kill', 'poison', 'protect'].includes(r.night_action) ? (en ? `\nNight power: ${actLabel(r.night_action)}` : `\n夜间能力：${actLabel(r.night_action)}`) : '';
      const card = (en ? `Your role: 「${r.role}」 · ${team}\nAbility: ${r.ability || ''}` : `你的身份：「${r.role}」 · ${team}\n技能：${r.ability || ''}`) + nightLine + (r.first_night_info ? (en ? `\nNight 1 you learn: ${r.first_night_info}` : `\n首夜得知：${r.first_night_info}`) : '');
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: card, visibility: `seat:${r.seat}`, payload: { type: 'botc_role' } });
      if (['kill', 'poison', 'protect'].includes(r.night_action)) {
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: '', visibility: `seat:${r.seat}`, payload: { type: 'botc_role_action', action: r.night_action } });
      }
    }

    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 1, content: cf.opening || (en ? 'Night falls… and dawn breaks on Day 1. Discuss.' : '夜幕降临……第 1 天天亮了，请开始讨论。'), payload: { type: 'botc_st', sfx: ['cue_nightfall'] } });
    await admin.from('rooms').update({ game_state: 'playing', botc_phase: 'day', botc_day: 1, botc_size: finalSize, modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ botc_phase: 'lobby', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '血染建局:' + e.message });
    return NextResponse.json({ error: '建局失败：' + e.message }, { status: 500 });
  }
}
