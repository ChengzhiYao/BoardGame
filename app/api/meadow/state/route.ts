// 童话草原 · 世界状态：在世则自动行动结算；已死则返回死者+可继承的在世幼崽。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { gameClock, advanceHunger, clamp01 } from '@/lib/meadow/time';
import { resolveAction, autoPolicy, locZh, locOf, dangerLabel, LOCATIONS } from '@/lib/meadow/world';
import { SP_BY_KEY } from '@/lib/meadow/data';

const AWAY_TICK_MS = 25 * 60 * 1000;
const MAX_TICKS = 8;

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ character: null, error: '未登录' }, { status: 401 });
  const admin = createAdminClient();
  const { data: ch } = await admin.from('meadow_characters').select('*').eq('user_id', user.id).eq('status', 'alive').maybeSingle();

  if (!ch) {
    // 没有在世动物：看最近死去的角色 + 它的在世幼崽（可继承）
    const { data: dead } = await admin.from('meadow_characters').select('*').eq('user_id', user.id).eq('status', 'dead').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!dead) return NextResponse.json({ character: null });
    const { data: heirs } = await admin.from('meadow_characters').select('id, species, variant, gender, generation').eq('parent_id', dead.id).eq('is_npc', true).eq('status', 'alive').limit(6);
    const dsp = SP_BY_KEY[dead.species];
    return NextResponse.json({
      character: null,
      dead_character: { variant: dead.variant, speciesZh: dsp?.zh, emoji: dsp?.emoji, death_cause: dead.death_cause, generation: dead.generation },
      heirs: (heirs || []).map((h: any) => ({ id: h.id, variant: h.variant, speciesZh: SP_BY_KEY[h.species]?.zh, emoji: SP_BY_KEY[h.species]?.emoji, gender: h.gender, generation: h.generation })),
    });
  }

  const now = Date.now();
  const since = now - new Date(ch.hunger_updated_at).getTime();
  let hunger = ch.hunger; let status = ch.status; let death = ch.death_cause; let location = ch.location;
  const newEvents: any[] = [];
  const clkNow = gameClock(now);

  if (status === 'alive' && since >= AWAY_TICK_MS) {
    const ticks = Math.min(MAX_TICKS, Math.floor(since / AWAY_TICK_MS));
    const recap: string[] = [];
    for (let i = 0; i < ticks; i++) {
      hunger = clamp01(advanceHunger(hunger, AWAY_TICK_MS));
      const kind = autoPolicy({ ...ch, location }, hunger);
      const res = resolveAction({ ...ch, location }, kind, { location, season: clkNow.season, night: clkNow.night });
      hunger = clamp01(hunger + res.hungerDelta);
      if (res.moveTo && LOCATIONS.find((l) => l.key === res.moveTo)) location = res.moveTo;
      if (res.events[0]) recap.push(res.events[0]);
      if (res.death) { status = 'dead'; death = res.death; break; }
      if (hunger >= 100) { status = 'dead'; death = '饿死'; break; }
    }
    const who = SP_BY_KEY[ch.species]?.zh || '动物';
    newEvents.push({ character_id: ch.id, game_label: clkNow.label, kind: 'auto', text: `（你不在时，这只${who}凭着自己的性子过活：${recap.filter(Boolean).slice(-3).join('；') || '安然度过了一段时光'}。）` });
    if (status === 'dead') newEvents.push({ character_id: ch.id, game_label: clkNow.label, kind: 'death', text: `——${death}。你回来时，它已不在了。` });
  } else {
    hunger = clamp01(advanceHunger(hunger, since));
    if (hunger >= 100 && status === 'alive') {
      status = 'dead'; death = '饿死';
      newEvents.push({ character_id: ch.id, game_label: clkNow.label, kind: 'death', text: '你饿得再也撑不住了，倒在草丛里——这一世，到此为止。' });
    }
  }

  if (newEvents.length) await admin.from('meadow_events').insert(newEvents);
  await admin.from('meadow_characters').update({
    hunger: Math.round(hunger), hunger_updated_at: new Date(now).toISOString(),
    location, status, death_cause: death, busy_until: null, current_action: null,
  }).eq('id', ch.id);

  const { data: events } = await admin.from('meadow_events').select('*').eq('character_id', ch.id).order('created_at', { ascending: false }).limit(30);
  const { count: kids } = await admin.from('meadow_characters').select('id', { count: 'exact', head: true }).eq('parent_id', ch.id).eq('status', 'alive');
  const sp = SP_BY_KEY[ch.species]; const lc = locOf(location);
  return NextResponse.json({
    character: {
      id: ch.id, species: ch.species, gender: ch.gender, variant: ch.variant, diet: ch.diet,
      attributes: ch.attributes, instincts: ch.instincts, traits: ch.traits, generation: ch.generation || 1, offspring: kids || 0,
      hunger: Math.round(hunger), location, locationZh: locZh(location), danger: dangerLabel(lc.exposure),
      status, death_cause: death, emoji: sp?.emoji, speciesZh: sp?.zh,
    },
    clock: clkNow,
    locations: LOCATIONS.map((l) => ({ key: l.key, zh: l.zh, danger: dangerLabel(l.exposure) })),
    events: events || [],
  });
}
