// 轻量市场摘要（给右上角身价场 chip 用）：身价/现金/总资产/当前主人。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ loggedIn: false });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  const { data: held } = await admin.from('market_profiles').select('price').eq('owner_id', user.id);
  const heldSum = (held || []).reduce((a: number, h: any) => a + (h.price || 0), 0);
  let ownerName: string | null = null;
  if (me.owner_id) { const { data: o } = await admin.from('users').select('display_name').eq('id', me.owner_id).maybeSingle(); ownerName = o?.display_name || '玩家'; }
  return NextResponse.json({ loggedIn: true, price: me.price, cash: me.cash, assets: me.cash + heldSum, ownerId: me.owner_id, ownerName, optedOut: me.opted_out });
}
