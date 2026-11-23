// 场景图：开本后房主端调用一次，把还没画的地点画出来（存回本库，以后复用）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { drawScenes, publicStage } from '@/lib/jbs/stage';
export const maxDuration = 120;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, jbs_stage, jbs_options').eq('id', roomId).maybeSingle();
  if (!room || room.host_user_id !== user.id) return NextResponse.json({ ok: false });
  const { data: kr } = await admin.from('jbs_cases').select('id, case_file').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1);
  const kase = kr?.[0];
  if (!kase?.case_file?.scenes?.length) return NextResponse.json({ ok: true, none: true });
  const lockKey = `jbs_scenes:${roomId}`;
  const { data: lk } = await admin.from('app_kv').select('value').eq('key', lockKey).maybeSingle();
  if (lk?.value?.at && Date.now() - lk.value.at < 100000) return NextResponse.json({ ok: true, pending: true });
  await admin.from('app_kv').upsert({ key: lockKey, value: { at: Date.now() } });
  const libId = (room.jbs_options || []).find((o: any) => o?.from_library && o?.title === kase.case_file?.title)?.from_library || null;
  const { cf, drawn } = await drawScenes(admin, kase.case_file, { roomId, libId });
  if (drawn) {
    await admin.from('jbs_cases').update({ case_file: cf }).eq('id', kase.id);
    const pub = publicStage(cf, room.jbs_stage?.scene);
    await admin.from('rooms').update({ jbs_stage: { ...(room.jbs_stage || {}), scenes: pub.scenes } }).eq('id', roomId);
  }
  await admin.from('app_kv').delete().eq('key', lockKey);
  return NextResponse.json({ ok: true, drawn });
}
