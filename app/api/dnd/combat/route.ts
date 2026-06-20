// D&D · 战斗行动：攻击 / 施法 / 闪避 / 死亡豁免。引擎确定性结算，怪物自动行动。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { playerAttack, playerCastDamage, playerDodgeOrHelp, deathSave, awardAndMaybeLevel, currentActor } from '@/lib/dnd/engine';
import { mutateState } from '@/lib/dnd/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, action, weaponIdx, cantripIdx, targetId } = await req.json().catch(() => ({} as any));
  if (!roomId || !action) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const out = await mutateState(admin, roomId, (s) => {
    if (!s.combat?.active) return { ok: false, error: '现在不是战斗' };
    const cur = currentActor(s);
    if (!cur || cur.ref !== me.seat) return { ok: false, error: '还没轮到你' };
    let r: { ok: boolean; error?: string };
    if (action === 'attack') r = playerAttack(s, me.seat, Number(weaponIdx) || 0, String(targetId || ''));
    else if (action === 'cast') r = playerCastDamage(s, me.seat, Number(cantripIdx) || 0, String(targetId || ''));
    else if (action === 'dodge') r = playerDodgeOrHelp(s, me.seat, 'dodge');
    else if (action === 'death') r = deathSave(s, me.seat);
    else r = { ok: false, error: '未知战斗行动' };
    if (r.ok && !s.combat?.active) awardAndMaybeLevel(s);
    return r;
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
