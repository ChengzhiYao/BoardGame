// 童话草原 · 发起一个时间占用行动（觅食/捕猎/休息/迁徙）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { advanceHunger } from '@/lib/meadow/time';
import { actionDuration, ACTIONS, LOCATIONS, type ActionKind } from '@/lib/meadow/world';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { kind, target } = await req.json().catch(() => ({} as any));
  if (!ACTIONS[kind as ActionKind]) return NextResponse.json({ error: '未知行动' }, { status: 400 });

  const admin = createAdminClient();
  const { data: ch } = await admin.from('meadow_characters').select('*').eq('user_id', user.id).eq('status', 'alive').maybeSingle();
  if (!ch) return NextResponse.json({ error: '你没有在世的动物' }, { status: 404 });
  const now = Date.now();
  if (ch.busy_until && now < new Date(ch.busy_until).getTime()) return NextResponse.json({ error: '你正忙着呢' }, { status: 409 });

  let tgt: string | undefined;
  if (kind === 'move') {
    if (!LOCATIONS.find((l) => l.key === target) || target === ch.location) return NextResponse.json({ error: '去不了那里' }, { status: 400 });
    tgt = target;
  }

  const hunger = Math.round(advanceHunger(ch.hunger, now - new Date(ch.hunger_updated_at).getTime()));
  const dur = actionDuration(ch, kind as ActionKind);
  const ends = new Date(now + dur * 1000).toISOString();
  await admin.from('meadow_characters').update({
    hunger, hunger_updated_at: new Date(now).toISOString(),
    current_action: { kind, started_at: new Date(now).toISOString(), ends_at: ends, ...(tgt ? { target: tgt } : {}) },
    busy_until: ends,
  }).eq('id', ch.id);
  return NextResponse.json({ ok: true, ends_at: ends, durationSec: dur, action: ACTIONS[kind as ActionKind].zh });
}
