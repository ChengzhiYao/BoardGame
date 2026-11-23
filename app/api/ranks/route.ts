// 排行榜数据：?win=week|all → 每个分类的前 30 名 + 我的名次 / 超过了多少玩家
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { CATS, rankAll, rankCat } from '@/lib/ranks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const win = new URL(req.url).searchParams.get('win') === 'week' ? 'week' : 'all';
  const { data: { user } } = await createServerClient().auth.getUser();
  const admin = createAdminClient();
  const rows = await rankAll(admin, win);
  const out: any = {};
  const ids = new Set<string>();
  for (const c of CATS) {
    if (c === 'badges' && win === 'week') continue;
    const r = rankCat(rows, c, user?.id);
    out[c] = { top: r.list.slice(0, 30), total: r.total, me: r.mine };
    r.list.slice(0, 30).forEach((x) => ids.add(x.id));
  }
  const { data: us } = ids.size ? await admin.from('users').select('id, display_name, avatar_url').in('id', Array.from(ids)) : { data: [] as any[] };
  const people: Record<string, any> = {};
  for (const u of us || []) people[u.id] = { name: u.display_name || '玩家', avatar: u.avatar_url || null };
  return NextResponse.json({ win, players: rows.length, cats: out, people, me: user?.id || null });
}
