// D&D · 建卡：玩家提交 种族/职业/背景/属性/技能 → 引擎派生完整角色卡。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { buildCharacter, RACES, CLASSES, BACKGROUNDS, ABILITIES, type Scores } from '@/lib/dnd/engine';
import { mutateState } from '@/lib/dnd/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, name, race, cls, background, scores, skills } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  if (!RACES[race] || !CLASSES[cls] || !BACKGROUNDS[background]) return NextResponse.json({ error: '种族/职业/背景无效' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const baseScores = {} as Scores;
  for (const a of ABILITIES) baseScores[a] = Math.max(3, Math.min(18, Math.round(Number(scores?.[a]) || 10)));
  const charName = String(name || '').trim().slice(0, 20) || '无名冒险者';
  const extraSkills = Array.isArray(skills) ? skills.slice(0, 6) : undefined;

  const out = await mutateState(admin, roomId, (s) => {
    if (s.phase !== 'creation' && s.phase !== 'explore') return { ok: false, error: '现在不能建卡' };
    if (!s.seats.includes(me.seat)) s.seats.push(me.seat);
    s.chars[me.seat] = buildCharacter({ seat: me.seat, name: charName, race, cls, background, baseScores, extraSkills });
    s.log.push({ msg: `🛡️ ${charName} —— ${RACES[race].cn}${CLASSES[cls].cn} 加入队伍。`, kind: 'sys' }); s.logSeq++;
    return { ok: true };
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
