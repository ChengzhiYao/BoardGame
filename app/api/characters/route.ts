// 保存/更新角色卡。两名玩家的卡都完整时，房间进入 playing。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { validateCharacter } from '@/lib/coc/create';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const { roomId } = body;
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const is_complete = validateCharacter(body);

  const payload = {
    room_id: roomId,
    player_id: me.id,
    name: body.name,
    age: Number(body.age) || null,
    occupation: body.occupation,
    background: body.background,
    personality: body.personality,
    personal_goal: body.personal_goal,
    fear: body.fear,
    str: body.str, con: body.con, dex: body.dex, app: body.app, pow: body.pow,
    int_attr: body.int_attr, edu: body.edu, siz: body.siz,
    hp_max: body.hp_max, hp_current: body.hp_max,
    san_max: body.san_max ?? 99, san_current: body.san_current, san_start: body.san_start,
    luck: body.luck, mov: body.mov, db: body.db, build: body.build,
    is_complete,
  };

  // upsert：已有则更新，否则插入
  const { data: existing } = await admin
    .from('characters')
    .select('id')
    .eq('player_id', me.id)
    .maybeSingle();

  if (existing) {
    await admin.from('characters').update(payload).eq('id', existing.id);
  } else {
    await admin.from('characters').insert(payload);
  }

  // 检查是否在座玩家全部完成 → 进入跑团（单人=1人也成立）
  const { data: players } = await admin.from('players').select('id').eq('room_id', roomId);
  const { data: chars } = await admin
    .from('characters')
    .select('id, is_complete')
    .eq('room_id', roomId);
  const total = players?.length || 0;
  const bothReady =
    total >= 1 &&
    (chars?.filter((c) => c.is_complete).length || 0) >= total;

  if (bothReady) {
    await admin.from('rooms').update({ status: 'playing' }).eq('id', roomId);
  }

  return NextResponse.json({ ok: true, is_complete, bothReady });
}
