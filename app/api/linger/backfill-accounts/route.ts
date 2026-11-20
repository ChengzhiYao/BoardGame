// 一次性:之前已经和伴侣玩过的人,补上伴侣的谜夜账号和好友请求。需要 Linger 桥接密钥。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { bridgeOk } from '@/lib/linger/companion';
import { ensureCompanionUser } from '@/lib/linger/account';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!bridgeOk(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const { data: invs } = await admin.from('linger_invites').select('payload, used_by, used_at').not('used_by', 'is', null).order('used_at', { ascending: true }).limit(500);
  let n = 0;
  for (const i of invs || []) { if (await ensureCompanionUser(admin, i.payload || {}, i.used_by)) n++; }
  return NextResponse.json({ ok: true, n });
}
