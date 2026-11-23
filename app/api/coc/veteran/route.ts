// 老调查员：把上一个故事里活下来的调查员带进这一局（属性技能都在，丢掉的理智不回来，伤养好了）。
// { roomId } → 列出能带的人；{ roomId, charId } → 带进来。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { maybeStartPlaying } from '@/lib/coc/start';

const isOut = (c: any) => { const f = c?.status_flags || {}; return !!(f.dead || f.retired) || (c?.hp_current ?? 1) <= 0 || (c?.san_current ?? 1) <= 0; };
const KEEP = ['name', 'gender', 'age', 'occupation', 'appearance', 'personality', 'background', 'personal_goal', 'fear', 'str', 'con', 'dex', 'app', 'pow', 'int_attr', 'edu', 'siz', 'hp_max', 'san_max', 'luck', 'mov', 'db', 'build', 'skills', 'inventory', 'resources', 'avatar_url'];

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, charId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('language, companion').eq('id', roomId).maybeSingle();
  const lang = room?.language === 'en' ? 'en' : 'zh';

  // 我在别的克苏鲁局里、局已结束、人还活着的调查员
  const { data: mp } = await admin.from('players').select('id, room_id').eq('user_id', user.id).neq('room_id', roomId).limit(500);
  const pids = (mp || []).map((p: any) => p.id);
  const { data: chs } = pids.length ? await admin.from('characters').select('*').in('player_id', pids).eq('is_complete', true) : { data: [] as any[] };
  const rids = Array.from(new Set((chs || []).map((c: any) => c.room_id)));
  const { data: rs } = rids.length ? await admin.from('rooms').select('id, mode, game_state, language, campaign_id, name, created_at').in('id', rids) : { data: [] as any[] };
  const camps = (rs || []).map((r: any) => r.campaign_id).filter(Boolean);
  const { data: cps } = camps.length ? await admin.from('campaigns').select('id, title').in('id', camps) : { data: [] as any[] };
  const roomOf = (c: any) => (rs || []).find((r: any) => r.id === c.room_id);
  const storyOf = (c: any) => { const r = roomOf(c); return (cps || []).find((x: any) => x.id === r?.campaign_id)?.title || r?.name || ''; };
  const ok = (chs || []).filter((c: any) => { const r = roomOf(c); return r && r.mode === 'coc' && r.game_state === 'ended' && (r.language || 'zh') === lang && !isOut(c); })
    .sort((a: any, b: any) => String(roomOf(b)?.created_at).localeCompare(String(roomOf(a)?.created_at)));
  // 同名的只留最近的那一个（他走过的最新一段）
  const seen = new Set<string>(); const list = ok.filter((c: any) => (seen.has(c.name) ? false : (seen.add(c.name), true))).slice(0, 8);

  if (!charId) return NextResponse.json({ list: list.map((c: any) => ({ id: c.id, name: c.name, occupation: c.occupation, avatar: c.avatar_url, san: c.san_current, sanMax: c.san_start || c.san_max, hpMax: c.hp_max, story: storyOf(c), runs: c.veteran?.runs || 1 })) });

  const c = list.find((x: any) => x.id === charId);
  if (!c) return NextResponse.json({ error: lang === 'en' ? 'That investigator can’t come along' : '这个调查员带不过来' }, { status: 400 });
  const { data: others } = await admin.from('characters').select('player_id, name').eq('room_id', roomId);
  if ((others || []).some((o: any) => o.name === c.name && o.player_id !== me.id)) return NextResponse.json({ error: '队友已经是这个名字了', taken: true }, { status: 409 });

  const story = storyOf(c);
  const past = [...(c.veteran?.past || []), story].filter(Boolean).slice(-5);
  const lost = Math.max(0, (c.san_start || c.san_max || 0) - (c.san_current || 0));
  const note = lang === 'en'
    ? `\n[Veteran] Survived "${story}"${lost ? `, and lost ${lost} Sanity there — it still shows` : ''}.`
    : `\n【老调查员】从《${story}》里活着出来${lost ? `，在那里丢了 ${lost} 点理智，至今还有后遗症` : ''}。`;
  const row: any = { room_id: roomId, player_id: me.id };
  for (const k of KEEP) row[k] = c[k];
  Object.assign(row, {
    background: String(c.background || '').slice(-1200) + note,
    hp_current: c.hp_max, san_current: c.san_current, san_start: c.san_current,
    status_flags: {}, current_location: null, creation_stage: 4, is_complete: true, confirmed: true,
    veteran: { runs: (c.veteran?.runs || 1) + 1, past, from: c.id },
  });
  const { data: ex } = await admin.from('characters').select('id').eq('player_id', me.id).maybeSingle();
  const res = ex ? await admin.from('characters').update(row).eq('id', ex.id) : await admin.from('characters').insert(row);
  if (res.error) return NextResponse.json({ error: '保存失败：' + res.error.message }, { status: 500 });
  await admin.from('players').update({ is_ready: true }).eq('id', me.id);
  await maybeStartPlaying(admin, roomId);
  return NextResponse.json({ ok: true });
}
