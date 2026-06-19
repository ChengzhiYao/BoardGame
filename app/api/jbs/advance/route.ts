// 房主手动 / 倒计时自动推进剧本杀到下一幕。推进后由 DM 主动做"本幕开场"，让新的一幕真正发生。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson, type LLMMessage } from '@/lib/llm';
import { buildJbsDmPrompt } from '@/lib/jbs/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, toVote, auto } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, jbs_act, jbs_phase, jbs_act_minutes, jbs_act_started_at, jbs_total_acts, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以推进' }, { status: 403 });
  if (room.jbs_phase !== 'playing') return NextResponse.json({ error: '现在不能推进' }, { status: 409 });

  // 倒计时到点会自动推进（auto=true，无条件放行）；房主手动推进「下一幕」需先找到本幕关键线索。
  const minutes = room.jbs_act_minutes || 6;
  const cur = room.jbs_act || 1;

  if (!auto && !toVote) {
    const startedAt = room.jbs_act_started_at ? new Date(room.jbs_act_started_at).getTime() : 0;
    const timeUp = !startedAt || Date.now() >= startedAt + minutes * 60000;
    if (!timeUp) {
      try {
        const { count } = await admin.from('messages').select('id', { count: 'exact', head: true })
          .eq('room_id', roomId).eq('turn_no', cur)
          .filter('payload->>type', 'eq', 'jbs_evidence').filter('payload->>key', 'eq', 'true');
        if (!count) return NextResponse.json({ error: '本幕关键线索还没找到，先搜证；或等倒计时结束自动推进', needKey: true }, { status: 409 });
      } catch { /* 查询异常则放行，避免卡住 */ }
    }
  }
  const total = room.jbs_total_acts || 7;
  const voteAct = Math.max(2, total - 1);
  const nextAct = toVote ? voteAct : Math.min(total, cur + 1);
  const goVote = !!toVote || nextAct >= voteAct;
  const en = room.language === 'en';

  await admin.from('rooms').update({ jbs_act: nextAct, jbs_phase: goVote ? 'vote' : 'playing', jbs_act_started_at: new Date().toISOString() }).eq('id', roomId);
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: `▶ ${en ? `Act ${nextAct}` : `第 ${nextAct} 幕`}`, payload: { type: 'jbs_act' } });

  // DM 主动开场：让新的一幕真正推进（给出新进展/线索/AI 反应），不要干等玩家。
  try {
    const { data: kase } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).maybeSingle();
    const { data: chars } = await admin.from('jbs_characters').select('name, is_ai, assigned_seat').eq('room_id', roomId);
    if (kase) {
      const aiNames = (chars || []).filter((c: any) => c.is_ai).map((c: any) => c.name);
      const realRoster = (chars || []).filter((c: any) => !c.is_ai && c.assigned_seat).map((c: any) => ({ seat: c.assigned_seat, name: c.name }));
      const nameBySeat: Record<string, string> = {};
      realRoster.forEach((r: any) => { nameBySeat[r.seat] = r.name; });
      const { data: players } = await admin.from('players').select('id, seat').eq('room_id', roomId);
      const seatByPid: Record<string, string> = {};
      (players || []).forEach((p: any) => { seatByPid[p.id] = p.seat; });
      const { data: history } = await admin.from('messages').select('sender_type, content, payload, sender_player_id').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
      const base: LLMMessage[] = (history || []).slice(-14).map((m: any) => {
        if (m.sender_type === 'kp') return { role: 'assistant', content: m.content };
        let tag = '[系统]';
        if (m.payload?.type === 'jbs_ai') tag = `[${m.payload?.name || 'NPC'}·AI]`;
        else if (m.sender_type === 'player') tag = `[${nameBySeat[seatByPid[m.sender_player_id]] || '玩家'}·真人]`;
        return { role: 'user', content: `${tag} ${m.content}` } as LLMMessage;
      });
      const nudge = goVote
        ? `（幕转场）现在进入第 ${nextAct} 幕「最终指认」。请做一段简短的收束开场：把局势推到摊牌时刻，提示玩家即将进行最终指认，并让相关 AI 角色表态。不要剧透真相，不要替玩家下结论。next_act 保持 ${nextAct}。`
        : `（幕转场）现在进入第 ${nextAct} 幕。请你**主动**做本幕开场：交代本幕的场景、气氛与局势变化，让相关 AI 角色自然反应、把矛盾往前推。**但不要主动公布任何线索/证据（evidence_revealed 留空）**——线索只在玩家自己搜证时才给。不要干等玩家先开口。next_act 保持 ${nextAct}。`;
      const { data: out, usage } = await callLLMJson<any>({
        system: buildJbsDmPrompt(kase.case_file, nextAct, aiNames, realRoster, { elapsedMin: 0, actMin: minutes }) + langDirective(room.language),
        messages: [...base, { role: 'user', content: nudge }],
        tier: 'main', temperature: 0.85, maxTokens: 2200, retry: true,
      });
      await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

      if (out.narration) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: nextAct, content: out.narration, payload: { type: 'jbs_dm' } });
      for (const a of out.ai_lines || []) {
        if (!a?.text || !a?.name) continue;
        if (!aiNames.includes(a.name)) continue; // 硬过滤：绝不让 AI 顶替真人/未知角色发言
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: nextAct, content: a.text, payload: { type: 'jbs_ai', name: a.name } });
      }
      for (const ev of out.evidence_revealed || []) {
        if (!ev?.name) continue;
        const vis = ev.to === 'A' ? 'player_a' : ev.to === 'B' ? 'player_b' : 'public';
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: `🔍 ${ev.name}：${ev.desc || ''}`, visibility: vis, payload: { type: 'jbs_evidence', key: !!ev.key } });
      }
      for (const pn of out.private_notes || []) {
        if (!pn?.text || !['A', 'B'].includes(pn.to)) continue;
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: pn.text, visibility: pn.to === 'A' ? 'player_a' : 'player_b', payload: { type: 'private' } });
      }
      if (Array.isArray(out.resources) && out.resources.length) await admin.from('rooms').update({ jbs_resources: out.resources }).eq('id', roomId);
    }
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀幕转场:' + e.message });
  }

  return NextResponse.json({ ok: true, vote: goVote });
}
