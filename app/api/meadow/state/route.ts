// 童话草原 · 读取世界状态：惰性结算行动（含季节/被捕食/迁徙）+ 推进饥饿 + 判定死亡。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { gameClock, advanceHunger, clamp01 } from '@/lib/meadow/time';
import { resolveAction, locZh, locOf, dangerLabel, LOCATIONS } from '@/lib/meadow/world';
import { SP_BY_KEY } from '@/lib/meadow/data';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ character: null, error: '未登录' }, { status: 401 });
  const admin = createAdminClient();
  const { data: ch } = await admin.from('meadow_characters').select('*').eq('user_id', user.id).eq('status', 'alive').maybeSingle();
  if (!ch) return NextResponse.json({ character: null });

  const now = Date.now();
  let hunger = advanceHunger(ch.hunger, now - new Date(ch.hunger_updated_at).getTime());
  let current = ch.current_action;
  let busy = ch.busy_until;
  let status = ch.status; let death = ch.death_cause;
  let location = ch.location;
  const newEvents: any[] = [];

  if (current && current.ends_at && now >= new Date(current.ends_at).getTime()) {
    const clk = gameClock(now);
    const res = resolveAction(ch, current.kind, { location: ch.location, season: clk.season, night: clk.night, target: current.target });
    hunger = clamp01(hunger + res.hungerDelta);
    if (res.moveTo && LOCATIONS.find((l) => l.key === res.moveTo)) location = res.moveTo;
    for (const t of res.events) newEvents.push({ character_id: ch.id, game_label: clk.label, kind: current.kind, text: t });
    if (res.death) { status = 'dead'; death = res.death; }
    current = null; busy = null;
  }
  if (hunger >= 100 && status === 'alive') {
    status = 'dead'; death = '饿死';
    newEvents.push({ character_id: ch.id, game_label: gameClock(now).label, kind: 'death', text: '你再也撑不住了，倒在草丛里——这一世，到此为止。' });
  }
  if (newEvents.length) await admin.from('meadow_events').insert(newEvents);
  await admin.from('meadow_characters').update({
    hunger: Math.round(hunger), hunger_updated_at: new Date(now).toISOString(),
    current_action: current, busy_until: busy, status, death_cause: death, location,
  }).eq('id', ch.id);

  const { data: events } = await admin.from('meadow_events').select('*').eq('character_id', ch.id).order('created_at', { ascending: false }).limit(20);
  const sp = SP_BY_KEY[ch.species];
  const lc = locOf(location);
  return NextResponse.json({
    character: {
      id: ch.id, species: ch.species, gender: ch.gender, variant: ch.variant, diet: ch.diet, attributes: ch.attributes, instincts: ch.instincts,
      traits: ch.traits, hunger: Math.round(hunger), location, locationZh: locZh(location), danger: dangerLabel(lc.exposure),
      status, death_cause: death, busy_until: busy, current_action: current,
      emoji: sp?.emoji, speciesZh: sp?.zh,
    },
    clock: gameClock(now),
    locations: LOCATIONS.map((l) => ({ key: l.key, zh: l.zh, danger: dangerLabel(l.exposure) })),
    events: events || [],
  });
}
