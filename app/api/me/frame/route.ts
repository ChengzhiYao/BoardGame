// 戴上 / 摘下头像框(只能戴已经解锁的)
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { collect } from '@/lib/collection';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ ok: false }, { status: 401 });
  const { frame } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const id = frame ? String(frame) : null;
  if (id) {
    const c: any = await collect(admin, user.id, 'zh', false);
    if (!c.prog?.frames?.some((f: any) => f.id === id && f.unlocked)) return NextResponse.json({ ok: false, reason: 'locked' }, { status: 403 });
  }
  const { data: p } = await admin.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (p) await admin.from('profiles').update({ avatar_frame: id }).eq('user_id', user.id); else await admin.from('profiles').insert({ user_id: user.id, avatar_frame: id });
  await admin.from('users').update({ frame: id }).eq('id', user.id);
  return NextResponse.json({ ok: true, frame: id });
}
