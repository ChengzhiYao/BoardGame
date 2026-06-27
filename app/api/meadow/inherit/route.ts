// 童话草原 · 血脉传承：死亡后继承自己的一只在世幼崽，以它的身份继续。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { gameClock } from '@/lib/meadow/time';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { heir_id } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();

  const { data: alive } = await admin.from('meadow_characters').select('id').eq('user_id', user.id).eq('status', 'alive').maybeSingle();
  if (alive) return NextResponse.json({ error: '你已经有在世的动物了' }, { status: 409 });

  const { data: heir } = await admin.from('meadow_characters').select('*').eq('id', heir_id).eq('is_npc', true).eq('status', 'alive').maybeSingle();
  if (!heir) return NextResponse.json({ error: '这只幼崽已经不在了' }, { status: 404 });
  const { data: parent } = await admin.from('meadow_characters').select('user_id').eq('id', heir.parent_id).maybeSingle();
  if (!parent || parent.user_id !== user.id) return NextResponse.json({ error: '那不是你的血脉' }, { status: 403 });

  await admin.from('meadow_characters').update({ user_id: user.id, is_npc: false, hunger_updated_at: new Date().toISOString() }).eq('id', heir.id);
  await admin.from('meadow_events').insert({ character_id: heir.id, game_label: gameClock().label, kind: 'inherit', text: `你睁开眼睛——你是上一代的孩子，第 ${heir.generation} 代。血脉在草原上延续下去。` });
  return NextResponse.json({ ok: true });
}
