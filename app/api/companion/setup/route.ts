import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });
  await ensureCompanion(admin, user.id);
  const patch: any = {};
  if (typeof b.aiName === 'string') patch.ai_name = b.aiName.trim().slice(0, 24) || '夜';
  if (typeof b.persona === 'string') patch.persona = b.persona.slice(0, 2000);
  if (typeof b.job === 'string') patch.job = b.job.slice(0, 500);
  if (typeof b.freq === 'string' && ['daily', 'twice', 'few'].includes(b.freq)) patch.freq = b.freq;
  if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
  if (Number.isInteger(b.quietStart)) patch.quiet_start = ((b.quietStart % 24) + 24) % 24;
  if (Number.isInteger(b.quietEnd)) patch.quiet_end = ((b.quietEnd % 24) + 24) % 24;
  if (Number.isInteger(b.tzOffset)) patch.tz_offset = Math.max(-12, Math.min(14, b.tzOffset));
  if (Object.keys(patch).length) await admin.from('companion').update(patch).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
