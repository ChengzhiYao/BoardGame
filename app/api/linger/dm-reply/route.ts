// 前端发完私信后调一下:如果对方是 Linger 伴侣,等你停手几秒再让 TA 回(连发几条只回一次)。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { companionDmReply } from '@/lib/linger/account';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const to = String(b?.toUserId || '');
  if (!to) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: cu } = await admin.from('users').select('linger_agent_id, linger_owner').eq('id', to).maybeSingle();
  if (!cu?.linger_agent_id) return NextResponse.json({ ok: true, companion: false });
  if (cu.linger_owner && cu.linger_owner !== user.id) return NextResponse.json({ ok: true, companion: true, replies: [] });
  const started = Date.now();
  await new Promise((r) => setTimeout(r, 3500 + Math.random() * 2500)); // 像真人一样过一会儿才回
  // 这期间你又发了新消息 → 让最新那条触发的请求来回
  const { data: last } = await admin.from('dms').select('from_user, created_at').eq('from_user', user.id).eq('to_user', to).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last && new Date(last.created_at).getTime() > started + 300) return NextResponse.json({ ok: true, companion: true, skipped: true });
  const replies = await companionDmReply(admin, to, user.id);
  return NextResponse.json({ ok: true, companion: true, replies: replies.length });
}
