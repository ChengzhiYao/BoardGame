// 频道群聊持久化。目前频道：'whitelist'（白名单好友群聊，仅白名单可读写）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export const dynamic = 'force-dynamic';

async function guard(channel: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return { user: null as any, admin: null as any, ok: false };
  const admin = createAdminClient();
  if (channel === 'whitelist') {
    const ent = await getEntitlement(admin, user);
    if (!ent.whitelisted) return { user, admin, ok: false };
  } else {
    return { user, admin, ok: false }; // 未知频道暂不开放
  }
  return { user, admin, ok: true };
}

export async function GET(req: Request) {
  const channel = new URL(req.url).searchParams.get('channel') || '';
  const g = await guard(channel);
  if (!g.ok) return NextResponse.json({ messages: [] });
  const { data } = await g.admin.from('group_messages').select('id, from_user, from_name, text, created_at')
    .eq('channel', channel).order('created_at', { ascending: true }).limit(100);
  const messages = (data || []).map((m: any) => ({ id: m.id, name: m.from_name, text: m.text, ts: new Date(m.created_at).getTime(), mine: m.from_user === g.user.id }));
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  let body: any = {}; try { body = await req.json(); } catch {}
  const channel = (body?.channel || '').toString();
  const text = (body?.text || '').toString().trim().slice(0, 1000);
  const g = await guard(channel);
  if (!g.ok) return NextResponse.json({ ok: false }, { status: 403 });
  if (!text) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const name = String(g.user.email).split('@')[0];
  const { error } = await g.admin.from('group_messages').insert({ channel, from_user: g.user.id, from_name: name, text });
  if (error) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
