// MCC · 开局：洗牌发牌，初始化对局（仅房主，≥2 名玩家）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { newGame } from '@/lib/mcc/engine';
import { persist } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, aiFill, total } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, mcc_phase, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以开始' }, { status: 403 });
  if (room.mcc_phase === 'playing') return NextResponse.json({ ok: true });

  const { data: players } = await admin.from('players').select('seat, user_id').eq('room_id', roomId);
  const real = (players || []).filter((p: any) => /^[A-H]$/.test(p.seat));
  const useAi = !!aiFill;
  if (real.length < (useAi ? 1 : 2)) return NextResponse.json({ error: useAi ? '至少需要 1 名玩家' : '至少需要 2 名玩家' }, { status: 409 });
  const { data: users } = await admin.from('users').select('id, display_name').in('id', real.map((p: any) => p.user_id));
  const list: { seat: string; name: string; bot?: boolean }[] = real.map((p: any) => ({ seat: p.seat, name: users?.find((u: any) => u.id === p.user_id)?.display_name || `玩家${p.seat}` }));
  if (useAi) {
    const ALL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const want = Math.min(6, Math.max(real.length, [2, 3, 4, 5, 6].includes(Number(total)) ? Number(total) : 4));
    const used = new Set(list.map((p) => p.seat));
    let bn = 1;
    while (list.length < want) { const seat = ALL.find((x) => !used.has(x)); if (!seat) break; used.add(seat); list.push({ seat, name: `机器猫${bn++}`, bot: true }); }
  }
  if (list.length < 2) return NextResponse.json({ error: '至少需要 2 名玩家（或开启 AI 补位）' }, { status: 409 });
  list.sort((a, b) => a.seat.localeCompare(b.seat));

  await admin.from('mcc_hands').delete().eq('room_id', roomId);
  const state = newGame(list, (room as any).language);
  await persist(admin, roomId, state);
  return NextResponse.json({ ok: true });
}
