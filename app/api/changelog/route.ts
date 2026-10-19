// 更新公告：GET 列出(任何人可读) + 是否管理员；POST/DELETE 仅管理员。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();

async function who() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user?.email && user.email.toLowerCase() === ADMIN;
  return { user, isAdmin, admin: createAdminClient() };
}

export async function GET() {
  const { isAdmin, admin } = await who();
  const { data } = await admin.from('changelog').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(20);
  const entries = (data || []).map((e: any) => ({ id: e.id, title: e.title || '', body: e.body || '', ts: new Date(e.created_at).getTime() }));
  return NextResponse.json({ entries, isAdmin });
}

export async function POST(req: Request) {
  const { isAdmin, admin } = await who();
  if (!isAdmin) return NextResponse.json({ ok: false }, { status: 403 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const title = (b?.title || '').toString().trim().slice(0, 120);
  const body = (b?.body || '').toString().trim().slice(0, 1000);
  if (!title && !body) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const { error } = await admin.from('changelog').insert({ title, body });
  if (error) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { isAdmin, admin } = await who();
  if (!isAdmin) return NextResponse.json({ ok: false }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  await admin.from('changelog').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
