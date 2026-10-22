import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, isProtected, isWorking, tradesToday, boughtToday, feed, questBump, HOLD_CAP, PRICE_MULT, OWNER_SHARE, SELF_SHARE, TRADES_PER_DAY, BOUGHT_PER_DAY, today } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const targetId = b?.targetId;
  if (!targetId || targetId === user.id) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });

  const admin = createAdminClient();
  const { data: tu } = await admin.from('users').select('id, display_name, email').eq('id', targetId).maybeSingle();
  if (!tu || !tu.email || tu.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });

  const me = await ensureProfile(admin, user.id);
  const t = await ensureProfile(admin, targetId);
  const { data: mu } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  const myName = mu?.display_name || '玩家'; const tName = tu.display_name || '玩家';

  if (t.opted_out) return NextResponse.json({ ok: false, reason: 'out' }, { status: 400 });
  if (t.owner_id === user.id) return NextResponse.json({ ok: false, reason: 'mine' }, { status: 400 });
  if (isProtected(t)) return NextResponse.json({ ok: false, reason: 'protected' }, { status: 400 });
  if (isWorking(t)) return NextResponse.json({ ok: false, reason: 'working' }, { status: 400 });
  if (tradesToday(me) >= TRADES_PER_DAY) return NextResponse.json({ ok: false, reason: 'trade_limit' }, { status: 400 });
  if (boughtToday(t) >= BOUGHT_PER_DAY) return NextResponse.json({ ok: false, reason: 'target_limit' }, { status: 400 });

  const { count: tHold } = await admin.from('market_profiles').select('user_id', { count: 'exact', head: true }).eq('owner_id', targetId);
  if ((tHold || 0) >= HOLD_CAP) return NextResponse.json({ ok: false, reason: 'capped' }, { status: 400 });

  const P = t.price;
  if (me.cash < P) return NextResponse.json({ ok: false, reason: 'poor', need: P, have: me.cash }, { status: 400 });

  const prevOwner = t.owner_id;
  const ownerShare = prevOwner ? Math.round(P * OWNER_SHARE) : 0;
  const selfCut = prevOwner ? Math.round(P * SELF_SHARE) : Math.round(P * 0.5);
  const newPrice = Math.round(P * PRICE_MULT);

  // apply
  await admin.from('market_profiles').update({ cash: me.cash - P, trades_today: tradesToday(me) + 1, trades_day: today(), exp: me.exp + 15, ...questBump(me, 'q_buy') }).eq('user_id', user.id);
  if (prevOwner && prevOwner !== targetId) {
    const { data: po } = await admin.from('market_profiles').select('cash').eq('user_id', prevOwner).maybeSingle();
    await admin.from('market_profiles').update({ cash: (po?.cash || 0) + ownerShare }).eq('user_id', prevOwner);
  }
  await admin.from('market_profiles').update({
    owner_id: user.id, price: newPrice, cash: t.cash + selfCut,
    bought_today: boughtToday(t) + 1, bought_day: today(), exp: t.exp + 10,
  }).eq('user_id', targetId);

  // 持有满 10 → 自己恢复自由（若正被持有）
  const { count: myHold } = await admin.from('market_profiles').select('user_id', { count: 'exact', head: true }).eq('owner_id', user.id);
  if ((myHold || 0) >= HOLD_CAP && me.owner_id) {
    await admin.from('market_profiles').update({ owner_id: null }).eq('user_id', user.id);
  }

  await admin.from('market_trades').insert({ buyer_id: user.id, seller_id: prevOwner, target_id: targetId, price: P });
  await feed(admin, `${myName} 以 ${P} 身价买下了 ${tName}`);
  return NextResponse.json({ ok: true, price: P, newPrice });
}
