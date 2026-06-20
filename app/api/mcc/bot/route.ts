// MCC · 机器猫单步行动（房主端轮询）：护身铃 / 出牌 / 抽牌 / 响应窗口。乐观锁串行化。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { botAct, botReact, useWard } from '@/lib/mcc/engine';
import { mutateState } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id').eq('id', roomId).maybeSingle();
  if (!room || room.host_user_id !== user.id) return NextResponse.json({ ok: true });

  const out = await mutateState(admin, roomId, (s) => {
    if (s.status !== 'playing') return { skip: true };
    if (s.pending?.type === 'react') { botReact(s); return { acted: 'react' }; }
    if (s.pending?.type === 'ward' && s.bots.includes(s.pending.seat)) {
      useWard(s, s.pending.seat, Math.floor(Math.random() * (s.deck.length + 1)));
      return { acted: 'ward' };
    }
    if (!s.pending && s.bots.includes(s.turn)) { botAct(s, s.turn); return { acted: 'turn' }; }
    return { skip: true };
  });
  return NextResponse.json({ ok: true, ...(out.result || {}) });
}
