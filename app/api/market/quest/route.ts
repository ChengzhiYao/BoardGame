import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, questState, QUEST_REWARD, today } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  const qs = questState(me);
  if (!qs.canClaim) return NextResponse.json({ ok: false, reason: 'notready' });
  await admin.from('market_profiles').update({ cash: me.cash + QUEST_REWARD, exp: me.exp + 20, q_claimed: true, quest_day: today(), q_buy: qs.buy, q_work: qs.work, q_social: qs.social }).eq('user_id', user.id);
  return NextResponse.json({ ok: true, reward: QUEST_REWARD });
}
