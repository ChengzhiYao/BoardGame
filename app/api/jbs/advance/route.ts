// 房主手动 / 倒计时自动推进剧本杀到下一幕。推进后由 DM 主动做"本幕开场"，让新的一幕真正发生。
import { NextResponse } from 'next/server';
import { sendRecap } from '@/lib/linger/companion';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { moveScene } from '@/lib/jbs/stage';
import { dmBeat } from '@/lib/jbs/turn';

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, toVote, auto } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, jbs_act, jbs_phase, jbs_act_minutes, jbs_act_started_at, jbs_total_acts, jbs_type, language, jbs_stage, companion').eq('id', roomId).maybeSingle();
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
  const accuse = ['推理', '恐怖', '阵营'].includes(room.jbs_type || '推理'); // 仅指认型本进入「最终指认」；其余本由房主点「结局揭晓」结算
  const goVote = accuse && (!!toVote || nextAct >= voteAct);
  const en = room.language === 'en';

  await admin.from('rooms').update({ jbs_act: nextAct, jbs_phase: goVote ? 'vote' : 'playing', jbs_act_started_at: new Date().toISOString() }).eq('id', roomId);
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: `▶ ${en ? `Act ${nextAct}` : `第 ${nextAct} 幕`}`, payload: { type: 'jbs_act' } });

  // 新的一幕：换地点 → 开场演出 → 每个真人收到这一幕的新剧本页 → 主持人接着演出往下带
  try {
    const { data: kaseRows } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1);
    const cf = kaseRows?.[0]?.case_file;
    if (cf) {
      const actDef = cf.acts?.[nextAct - 1] || {};
      room.jbs_act = nextAct;
      await moveScene(admin, roomId, room, actDef.scene, nextAct);
      if (actDef.show) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: nextAct, content: actDef.show, payload: { type: 'jbs_dm', show: true } });
      const { data: chars } = await admin.from('jbs_characters').select('name, assigned_seat').eq('room_id', roomId);
      for (const c of chars || []) {
        if (!c.assigned_seat) continue;
        const full = (cf.characters || []).find((x: any) => x.name === c.name);
        for (const pg of (full?.act_pages || []).filter((x: any) => Number(x.act) === nextAct)) {
          await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: pg.text, visibility: `seat:${c.assigned_seat}`, payload: { type: 'jbs_page', act: nextAct } });
        }
      }
      const showNote = actDef.show ? `开场演出已经念给大家了：「${actDef.show}」。接着这段往下带，不要重复它。` : '';
      const nudge = goVote
        ? `（幕转场）现在进入第 ${nextAct} 幕「最终指认」。${showNote}请做一段简短的收束：把局势推到摊牌时刻，提示即将最终指认，让相关 AI 角色表态。不要剧透真相。`
        : `（幕转场）现在进入第 ${nextAct} 幕。${showNote}请主动带戏：交代这一幕的气氛与局势变化，让 AI 角色或配角自然反应、把矛盾往前推。不要主动公布线索（evidence_revealed 留空）。`;
      await dmBeat(admin, roomId, room, cf, nudge, nextAct);
    }
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀幕转场:' + e.message });
  }

  return NextResponse.json({ ok: true, vote: goVote });
}
