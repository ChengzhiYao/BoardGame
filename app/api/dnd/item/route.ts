// D&D · 探索中使用治疗药水（自饮）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { usePotion, buyPotion } from '@/lib/dnd/engine';
import { mutateState } from '@/lib/dnd/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, action } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const out = await mutateState(admin, roomId, (s) => {
    if (s.combat?.active) return { ok: false, error: '战斗中请用战斗里的按钮' };
    if (action === 'buy') return buyPotion(s, me.seat);
    return usePotion(s, me.seat);
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  if (!out.result?.ok) return NextResponse.json({ error: out.result?.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
