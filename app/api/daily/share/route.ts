// 分享每日一汤成绩:记一次分享(算经验、成就、「信使」头像框)。不送免费局。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  const admin = createAdminClient();
  const { data: p } = await admin.from('profiles').select('share_count').eq('user_id', user.id).maybeSingle();
  const n = (p?.share_count || 0) + 1;
  if (p) await admin.from('profiles').update({ share_count: n }).eq('user_id', user.id); else await admin.from('profiles').insert({ user_id: user.id, share_count: 1 });
  return NextResponse.json({ ok: true, shares: n });
}
