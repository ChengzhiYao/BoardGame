import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const sub = b?.sub;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  await admin.from('push_subs').upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: 'endpoint' }
  );
  return NextResponse.json({ ok: true });
}
