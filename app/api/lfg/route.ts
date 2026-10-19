// 找队友公告板：GET 列出活跃公告(含作者/申请情况)；POST 发公告；DELETE 关闭自己的公告。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ loggedIn: false, posts: [] });
  const admin = createAdminClient();
  const { data: posts } = await admin.from('lfg_posts').select('id, author_user, game, times, note, created_at').eq('active', true).order('created_at', { ascending: false }).limit(60);
  const authorIds = Array.from(new Set((posts || []).map((p: any) => p.author_user)));
  const nameMap: Record<string, any> = {};
  if (authorIds.length) {
    const { data: us } = await admin.from('users').select('id, display_name, avatar_url, email').in('id', authorIds);
    (us || []).forEach((u: any) => { nameMap[u.id] = u; });
  }
  const postIds = (posts || []).map((p: any) => p.id);
  const { data: apps } = postIds.length ? await admin.from('lfg_applications').select('id, post_id, applicant_user, message, created_at').in('post_id', postIds) : { data: [] } as any;
  const appUserIds = Array.from(new Set((apps || []).map((a: any) => a.applicant_user)));
  const appNames: Record<string, string> = {};
  if (appUserIds.length) {
    const { data: au } = await admin.from('users').select('id, display_name').in('id', appUserIds);
    (au || []).forEach((u: any) => { appNames[u.id] = u.display_name || ('玩家·' + String(u.id).slice(0, 4)); });
  }
  const out = (posts || []).filter((p: any) => (nameMap[p.author_user]?.email) !== HIDDEN).map((p: any) => {
    const a = nameMap[p.author_user] || {};
    const mine = p.author_user === user.id;
    const postApps = (apps || []).filter((x: any) => x.post_id === p.id);
    return {
      id: p.id, game: p.game || '', times: p.times || '', note: p.note || '', ts: new Date(p.created_at).getTime(),
      author: { id: p.author_user, name: a.display_name || ('玩家·' + String(p.author_user).slice(0, 4)), avatar: a.avatar_url || null },
      mine, applied: postApps.some((x: any) => x.applicant_user === user.id), applicantCount: postApps.length,
      applicants: mine ? postApps.map((x: any) => ({ id: x.applicant_user, name: appNames[x.applicant_user] || '玩家', message: x.message || '', ts: new Date(x.created_at).getTime() })) : undefined,
    };
  });
  return NextResponse.json({ loggedIn: true, posts: out });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email || user.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const game = (b?.game || '').toString().trim().slice(0, 60);
  const times = (b?.times || '').toString().trim().slice(0, 60);
  const note = (b?.note || '').toString().trim().slice(0, 300);
  if (!game && !note) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const admin = createAdminClient();
  const { count } = await admin.from('lfg_posts').select('id', { count: 'exact', head: true }).eq('author_user', user.id).eq('active', true);
  if ((count || 0) >= 3) return NextResponse.json({ ok: false, reason: 'limit' }, { status: 429 });
  const { error } = await admin.from('lfg_posts').insert({ author_user: user.id, game, times, note });
  if (error) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  await admin.from('lfg_posts').update({ active: false }).eq('id', id).eq('author_user', user.id);
  return NextResponse.json({ ok: true });
}
