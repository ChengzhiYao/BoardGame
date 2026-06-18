// 房主手动推进剧本杀到下一幕（或直接进入最终指认）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, toVote } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, jbs_act, jbs_phase, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以推进' }, { status: 403 });
  if (room.jbs_phase !== 'playing') return NextResponse.json({ error: '现在不能推进' }, { status: 409 });

  const cur = room.jbs_act || 1;
  const nextAct = toVote ? 6 : Math.min(7, cur + 1);
  const goVote = !!toVote || nextAct >= 6;
  await admin.from('rooms').update({ jbs_act: nextAct, jbs_phase: goVote ? 'vote' : 'playing', jbs_act_started_at: new Date().toISOString() }).eq('id', roomId);
  if (!goVote) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: `▶ ${room.language === 'en' ? `Act ${nextAct}` : `第 ${nextAct} 幕`}`, payload: { type: 'jbs_act' } });
  return NextResponse.json({ ok: true, vote: goVote });
}
