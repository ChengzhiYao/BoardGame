// 账号资料：GET 取当前资料；POST 更新昵称/个性签名。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ loggedIn: false });
  const admin = createAdminClient();
  const { data } = await admin.from('users').select('display_name, bio, avatar_url').eq('id', user.id).maybeSingle();
  return NextResponse.json({ loggedIn: true, email: user.email, displayName: data?.display_name || '', bio: data?.bio || '', avatarUrl: data?.avatar_url || '' });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  let body: any = {}; try { body = await req.json(); } catch {}
  const patch: any = {};
  if (typeof body.displayName === 'string') { const n = body.displayName.trim().slice(0, 40); if (n) patch.display_name = n; }
  if (typeof body.bio === 'string') patch.bio = body.bio.trim().slice(0, 200);
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  const admin = createAdminClient();
  const { error } = await admin.from('users').update(patch).eq('id', user.id);
  if (error) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
