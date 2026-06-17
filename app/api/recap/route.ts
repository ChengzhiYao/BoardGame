// 结局复盘：游戏结束后，解锁隐藏真相档案返回给玩家。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('game_state, campaign_id').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.game_state !== 'ended') {
    return NextResponse.json({ error: '游戏尚未结束，真相仍被封存。' }, { status: 409 });
  }

  const { data: campaign } = await admin.from('campaigns').select('title').eq('id', room.campaign_id).maybeSingle();
  const { data: truth } = await admin.from('hidden_case_files').select('*').eq('campaign_id', room.campaign_id).maybeSingle();

  const { data: players } = await admin.from('players').select('id, seat, user_id').eq('room_id', roomId);
  const { data: chars } = await admin.from('characters').select('*').eq('room_id', roomId);
  const { data: users } = await admin.from('users').select('id, display_name').in('id', (players || []).map((p: any) => p.user_id));
  const survivors = (chars || []).map((c: any) => {
    const p = players?.find((x: any) => x.id === c.player_id);
    const name = c.name || users?.find((u: any) => u.id === p?.user_id)?.display_name || '调查员';
    const f = c.status_flags || {};
    const out = f.dead ? '死亡' : f.retired || f.indef_insanity ? '永久疯狂 / 退场' : f.temp_insanity ? '临时疯狂（生还）' : '生还';
    return { seat: p?.seat, name, hp: c.hp_current, hp_max: c.hp_max, san: c.san_current, san_start: c.san_start, status: out, alive: !f.dead && !f.retired };
  });

  return NextResponse.json({
    title: campaign?.title,
    truth: truth?.truth,
    mastermind: truth?.mastermind,
    supernatural: truth?.supernatural,
    npcs: truth?.npc_secrets,
    timeline: truth?.timeline_true,
    key_clues: truth?.key_clues,
    red_herrings: truth?.red_herrings,
    survivors,
  });
}
