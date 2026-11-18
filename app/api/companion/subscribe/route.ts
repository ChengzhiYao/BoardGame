import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isAllowed } from '@/lib/companion/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const admin0 = createAdminClient();
  // 删除旧的(挂在谜夜整站上的)订阅,避免一条消息推两次、还显示成谜夜
  if (b?.remove) {
    await admin0.from('push_subs').delete().eq('user_id', user.id).eq('endpoint', String(b.remove));
    if (!b?.sub) return NextResponse.json({ ok: true, removed: true });
  }
  const sub = b?.sub;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });
  await admin.from('push_subs').upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: 'endpoint' }
  );
  return NextResponse.json({ ok: true });
}
