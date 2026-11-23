// 给这个故事的 3 个现成人物画肖像（第一次看到时画，之后跟着故事复用）。返回带头像的人物列表。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { makePortrait } from '@/lib/coc/art';
export const maxDuration = 120;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('campaign_id').eq('id', roomId).maybeSingle();
  const { data: camp } = await admin.from('campaigns').select('id, setting').eq('id', room?.campaign_id).maybeSingle();
  const setting = camp?.setting || {};
  const cast: any[] = Array.isArray(setting.cast) ? setting.cast : [];
  if (!cast.length) return NextResponse.json({ cast: [] });
  if (cast.every((c) => c.avatar)) return NextResponse.json({ cast });
  // 防止同一桌几个人同时点开时重复画
  const lockKey = `coc_portraits:${camp!.id}`;
  const { data: lk } = await admin.from('app_kv').select('value').eq('key', lockKey).maybeSingle();
  if (lk?.value?.at && Date.now() - lk.value.at < 90000) return NextResponse.json({ cast, pending: true });
  await admin.from('app_kv').upsert({ key: lockKey, value: { at: Date.now() } });
  const base = setting.lib_id || camp!.id;
  const out = await Promise.all(cast.map(async (c, i) => {
    if (c.avatar) return c;
    try { const url = await makePortrait(admin, `${base}-${i}`, c, setting.era, setting.theme); return url ? { ...c, avatar: url } : c; } catch { return c; }
  }));
  await admin.from('campaigns').update({ setting: { ...setting, cast: out } }).eq('id', camp!.id);
  if (setting.lib_id) await admin.from('module_library').update({ cast_list: out }).eq('id', setting.lib_id);
  await admin.from('api_usage').insert({ room_id: roomId, kind: 'image', model: 'portrait-low', prompt_tokens: out.filter((c, i) => c.avatar && !cast[i].avatar).length, cost: 0.003 * out.filter((c, i) => c.avatar && !cast[i].avatar).length });
  await admin.from('app_kv').delete().eq('key', lockKey);
  return NextResponse.json({ cast: out });
}
