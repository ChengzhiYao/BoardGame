import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ loggedIn: false });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ loggedIn: true, allowed: false });
  const c = await ensureCompanion(admin, user.id);
  const { data: msgs } = await admin.from('companion_msgs').select('role, text, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(40);
  const { data: subs } = await admin.from('push_subs').select('id').eq('user_id', user.id).limit(1);
  return NextResponse.json({
    loggedIn: true, allowed: true,
    profile: { enabled: c.enabled, aiName: c.ai_name, avatarUrl: c.avatar_url || null, persona: c.persona, job: c.job, tone: c.tone, freq: c.freq, quietStart: c.quiet_start, quietEnd: c.quiet_end, tzOffset: c.tz_offset, mood: c.mood, affection: c.affection },
    pushOn: !!(subs && subs.length),
    messages: (msgs || []).reverse().map((m: any) => ({ role: m.role, text: m.text, ts: new Date(m.created_at).getTime() })),
  });
}
