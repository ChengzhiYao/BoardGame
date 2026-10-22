import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, DAILY_REWARD, today } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  if (me.last_daily === today()) return NextResponse.json({ ok: false, reason: 'claimed' });
  await admin.from('market_profiles').update({ cash: me.cash + DAILY_REWARD, last_daily: today(), exp: me.exp + 3 }).eq('user_id', user.id);
  return NextResponse.json({ ok: true, reward: DAILY_REWARD, cash: me.cash + DAILY_REWARD });
}
