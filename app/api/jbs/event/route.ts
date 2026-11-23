// 本幕时间过半：房主端调用一次，让本幕的突发事件发生，主持人立刻带一下场面。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { fireEvent } from '@/lib/jbs/stage';
import { dmBeat } from '@/lib/jbs/turn';
export const maxDuration = 90;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('id, host_user_id, jbs_act, jbs_phase, jbs_act_minutes, jbs_act_started_at, jbs_stage, language, companion').eq('id', roomId).maybeSingle();
  if (!room || room.host_user_id !== user.id || room.jbs_phase !== 'playing') return NextResponse.json({ ok: false });
  const started = room.jbs_act_started_at ? new Date(room.jbs_act_started_at).getTime() : Date.now();
  if (Date.now() - started < (room.jbs_act_minutes || 6) * 60000 * 0.45) return NextResponse.json({ ok: false, early: true });
  const { data: kr } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1);
  const cf = kr?.[0]?.case_file;
  if (!cf) return NextResponse.json({ ok: false });
  const ev = await fireEvent(admin, roomId, room, cf);
  if (!ev) return NextResponse.json({ ok: true, none: true });
  try {
    await dmBeat(admin, roomId, room, cf, `（突发事件）${ev}——请立刻带一下场面：1~2 句写出现场的反应，让在场的 AI 角色或配角当场有所动作或表态。不要主动公布线索。`, room.jbs_act || 1, ev);
  } catch (e: any) { await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀突发事件:' + e.message }); }
  return NextResponse.json({ ok: true });
}
