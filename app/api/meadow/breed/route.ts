// 童话草原 · 繁衍：产下一窝幼崽（NPC，继承父母物种/数值，作为日后血脉的继承人）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { SP_BY_KEY } from '@/lib/meadow/data';
import { gameClock } from '@/lib/meadow/time';

function clampN(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, Math.round(v))); }

export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const admin = createAdminClient();
  const { data: p } = await admin.from('meadow_characters').select('*').eq('user_id', user.id).eq('status', 'alive').maybeSingle();
  if (!p) return NextResponse.json({ error: '你没有在世的动物' }, { status: 404 });
  if ((p.hunger || 0) >= 80) return NextResponse.json({ error: '你太饿了，养不起孩子' }, { status: 409 });
  const { count } = await admin.from('meadow_characters').select('id', { count: 'exact', head: true }).eq('parent_id', p.id).eq('status', 'alive');
  if ((count || 0) >= 5) return NextResponse.json({ error: '你的幼崽已经够多了' }, { status: 409 });

  const sp = SP_BY_KEY[p.species];
  const litter = p.diet === 'carnivore' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
  const lineage = p.lineage_id || p.id;
  const cubs: any[] = [];
  for (let i = 0; i < litter; i++) {
    const variant = sp?.variants?.length ? sp.variants[Math.floor(Math.random() * sp.variants.length)] : (sp?.zh || p.species);
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const attr: any = {};
    for (const k of Object.keys(p.attributes || {})) attr[k] = clampN((p.attributes[k] || 25) * (0.85 + Math.random() * 0.2), 5, 80);
    const traits = Array.from(new Set([...(sp?.innate || []), ...((p.traits || []).filter(() => Math.random() < 0.5))]));
    cubs.push({
      user_id: null, is_npc: true, parent_id: p.id, lineage_id: lineage, generation: (p.generation || 1) + 1,
      species: p.species, diet: p.diet, gender, variant, attributes: attr, instincts: p.instincts || {}, personality: p.personality || {}, traits,
      hunger: 0, location: p.location, status: 'alive',
    });
  }
  await admin.from('meadow_characters').insert(cubs);
  if (!p.lineage_id) await admin.from('meadow_characters').update({ lineage_id: p.id }).eq('id', p.id);
  await admin.from('meadow_characters').update({ hunger: Math.min(100, (p.hunger || 0) + 10), hunger_updated_at: new Date().toISOString() }).eq('id', p.id);
  await admin.from('meadow_events').insert({ character_id: p.id, game_label: gameClock().label, kind: 'breed', text: `你诞下了一窝幼崽（${litter} 只）。愿草原庇佑它们长大。` });
  return NextResponse.json({ ok: true, litter });
}
