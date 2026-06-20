// D&D · 探索中使用治疗药水（自饮）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { usePotion, buyPotion, buyGear, reviveAlly } from '@/lib/dnd/engine';
import { mutateState } from '@/lib/dnd/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, action, kind, key, targetSeat } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const out = await mutateState(admin, roomId, (s) => {
    if (s.combat?.active) return { ok: false, error: '战斗中请用战斗里的按钮' };
    if (action === 'buy' || action === 'buygear' || action === 'revive') {
      if (!s.safe) return { ok: false, error: '这里不是城镇/集市——要到安全的地方才能交易或复活' };
      if (action === 'buy') return buyPotion(s, me.seat);
      if (action === 'buygear') return buyGear(s, me.seat, String(kind || ''), String(key || ''));
      return reviveAlly(s, me.seat, String(targetSeat || ''));
    }
    return usePotion(s, me.seat); // 背包：随时可用自己已有的药水
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
