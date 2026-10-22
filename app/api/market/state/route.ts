import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, defaultProfile, isProtected, isWorking, boughtToday, rankOf, questState, HOLD_CAP, START_CASH, START_PRICE, today, type MP } from '@/lib/market/engine';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ loggedIn: false });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);

  const { data: users } = await admin.from('users').select('id, display_name, avatar_url, email').not('email', 'is', null).limit(1000);
  const { data: profs } = await admin.from('market_profiles').select('*').limit(3000);
  const pmap: Record<string, MP> = {}; (profs || []).forEach((p: any) => { pmap[p.user_id] = p; });
  const umap: Record<string, any> = {}; (users || []).forEach((u: any) => { umap[u.id] = u; });
  const nm = (id: string) => pmap[id]?.nickname || umap[id]?.display_name || ('玩家·' + id.slice(0, 4));
  const av = (id: string) => umap[id]?.avatar_url || null;

  // 持有数 + 名下身价合计
  const holdCount: Record<string, number> = {}; const heldSum: Record<string, number> = {};
  (profs || []).forEach((p: any) => { if (p.owner_id) { holdCount[p.owner_id] = (holdCount[p.owner_id] || 0) + 1; heldSum[p.owner_id] = (heldSum[p.owner_id] || 0) + (p.price || 0); } });

  const prof = (id: string): MP => pmap[id] || defaultProfile(id);
  const myAssets = me.cash + (heldSum[user.id] || 0);

  // 我的队伍（我持有的）
  const team = (profs || []).filter((p: any) => p.owner_id === user.id).map((p: any) => ({
    id: p.user_id, name: nm(p.user_id), avatar: av(p.user_id), price: p.price, working: isWorking(p), protectedUntil: p.protected_until,
  }));

  // 市场列表
  const list = (users || []).filter((u: any) => u.id !== user.id && u.email !== HIDDEN).map((u: any) => {
    const p = prof(u.id);
    let status = 'buyable';
    if (p.opted_out) status = 'out';
    else if (p.owner_id === user.id) status = 'mine';
    else if (isProtected(p)) status = 'protected';
    else if (isWorking(p)) status = 'working';
    else if ((holdCount[u.id] || 0) >= HOLD_CAP) status = 'capped';
    else if (boughtToday(p) >= 2) status = 'soldout';
    return { id: u.id, name: nm(u.id), avatar: av(u.id), price: p.price, ownerId: p.owner_id, ownerName: p.owner_id ? nm(p.owner_id) : null, status };
  }).filter((r: any) => r.status !== 'out').sort((a: any, b: any) => b.price - a.price);

  // 排行榜（总资产）
  const lb = (users || []).filter((u: any) => u.email !== HIDDEN).map((u: any) => {
    const p = prof(u.id); return { id: u.id, name: nm(u.id), avatar: av(u.id), assets: (p.cash || START_CASH) + (heldSum[u.id] || 0), price: p.price };
  }).sort((a: any, b: any) => b.assets - a.assets).slice(0, 10);

  const { data: fd } = await admin.from('market_feed').select('text, created_at').order('created_at', { ascending: false }).limit(40);
  const feed = (fd || []).map((f: any) => ({ text: f.text, ts: new Date(f.created_at).getTime() }));

  return NextResponse.json({
    loggedIn: true,
    me: { id: user.id, name: nm(user.id), avatar: av(user.id), cash: me.cash, price: me.price, ownerId: me.owner_id, ownerName: me.owner_id ? nm(me.owner_id) : null,
      assets: myAssets, holdings: holdCount[user.id] || 0, holdCap: HOLD_CAP, protectedUntil: me.protected_until,
      dailyAvailable: me.last_daily !== today(), fateAvailable: me.last_fate !== today(), optedOut: me.opted_out,
      rank: rankOf(me.exp), quest: questState(me) },
    team, list: list.slice(0, 80), leaderboard: lb, feed,
  });
}
