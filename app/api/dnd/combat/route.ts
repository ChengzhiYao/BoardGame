// D&D · 战斗行动：攻击 / 施法 / 闪避 / 死亡豁免。引擎确定性结算，怪物自动行动。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { playerAttack, playerCastDamage, playerCastSpell, usePotion, playerDodgeOrHelp, deathSave, awardAndMaybeLevel, currentActor, endTurn, toggleRage, secondWind, pushLog } from '@/lib/dnd/engine';
import { loadState, mutateState as mutate2 } from '@/lib/dnd/db';
import { callLLMJson } from '@/lib/llm';
import { langDirective } from '@/lib/i18n';
import { mutateState } from '@/lib/dnd/db';

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, action, weaponIdx, cantripIdx, spellKey, targetId } = await req.json().catch(() => ({} as any));
  if (!roomId || !action) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const out = await mutateState(admin, roomId, (s) => {
    if (!s.combat?.active) return { ok: false, error: '现在不是战斗' };
    const cur = currentActor(s);
    if (!cur || cur.ref !== me.seat) return { ok: false, error: '还没轮到你' };
    const wasCombat = true;
    let r: { ok: boolean; error?: string };
    if (action === 'attack') r = playerAttack(s, me.seat, Number(weaponIdx) || 0, String(targetId || ''));
    else if (action === 'cast') r = playerCastDamage(s, me.seat, Number(cantripIdx) || 0, String(targetId || ''));
    else if (action === 'spell') r = playerCastSpell(s, me.seat, String(spellKey || ''), String(targetId || ''));
    else if (action === 'potion') { r = usePotion(s, me.seat); if (r.ok) endTurn(s); }
    else if (action === 'rage') r = toggleRage(s, me.seat);
    else if (action === 'secondwind') r = secondWind(s, me.seat);
    else if (action === 'dodge') r = playerDodgeOrHelp(s, me.seat, 'dodge');
    else if (action === 'death') r = deathSave(s, me.seat);
    else r = { ok: false, error: '未知战斗行动' };
    const ended = wasCombat && !s.combat?.active;
    if (r.ok && ended) awardAndMaybeLevel(s);
    return { ...r, ended, victory: s.seats.some((seat) => s.chars[seat]?.alive && s.chars[seat].hp > 0) };
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });

  // 战斗结束：让 DM 补一句战后旁白（尽力而为，失败则跳过）
  if (out.result?.ended) {
    try {
      const s2 = await loadState(admin, roomId);
      const recent = (s2?.log || []).slice(-8).map((l: any) => l.msg).join('\n');
      const { data: room } = await admin.from('rooms').select('language').eq('id', roomId).maybeSingle();
      const { data: nd } = await callLLMJson<any>({
        system: `你是 D&D 地下城主。用 1~2 句话为刚刚结束的战斗写一句${out.result.victory ? '胜利后的' : '失败/全灭后的'}战后旁白，第二人称、有画面感、不替玩家做决定。最近战况：\n${recent}\n只输出 JSON：{ "narration": "..." }` + langDirective(room?.language),
        messages: [{ role: 'user', content: '写战后旁白。' }], tier: 'aux', temperature: 0.8, maxTokens: 160,
      });
      if (nd?.narration) await mutate2(admin, roomId, (s) => { pushLog(s, String(nd.narration), 'dm'); return { ok: true }; });
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
