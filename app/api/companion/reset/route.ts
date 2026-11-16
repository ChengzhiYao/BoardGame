// 重置陪伴:清空人设/记忆/心情/好感 + 删除对话,回到 onboarding。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isAllowed } from '@/lib/companion/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });
  await admin.from('companion_msgs').delete().eq('user_id', user.id);
  await admin.from('companion').update({
    ai_name: '夜', persona: '', job: '', memory: '', mood: 60, affection: 10,
    last_user_at: null, last_ai_at: null, last_proactive: null, next_reach_at: null,
  }).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
