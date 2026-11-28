// 首页动态背景:GET 读我选的;POST 换(只能换已经解锁的)
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { collect } from '@/lib/collection';
export const dynamic = 'force-dynamic';

async function me() { const { data: { user } } = await createServerClient().auth.getUser(); return user && !user.is_anonymous ? user : null; }

export async function GET() {
  const user = await me(); if (!user) return NextResponse.json({ ok: false });
  const { data } = await createAdminClient().from('profiles').select('home_bg').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ ok: true, bg: data?.home_bg || null });
}

export async function POST(req: Request) {
  const user = await me(); if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { bg } = await req.json().catch(() => ({} as any));
  const id = String(bg || 'night'); const admin = createAdminClient();
  if (id !== 'night') { const c: any = await collect(admin, user.id, 'zh', false); if (!c.prog?.bgs?.some((b: any) => b.id === id && b.unlocked)) return NextResponse.json({ ok: false, reason: 'locked' }, { status: 403 }); }
  const { data: p } = await admin.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (p) await admin.from('profiles').update({ home_bg: id }).eq('user_id', user.id); else await admin.from('profiles').insert({ user_id: user.id, home_bg: id });
  return NextResponse.json({ ok: true, bg: id });
}
