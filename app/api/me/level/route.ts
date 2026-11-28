// 我的等级(首页问候下面那条):现算一遍经验和等级,顺便存到 users 上
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { collect } from '@/lib/collection';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ ok: false });
  const lang = new URL(req.url).searchParams.get('lang') === 'en' ? 'en' : 'zh';
  const c: any = await collect(createAdminClient(), user.id, lang, false);
  const p = c.prog || null;
  return NextResponse.json({ ok: !!p, level: p?.level, title: p?.title, cur: p?.cur, span: p?.span, frame: p?.frame });
}
