// Google OAuth 回调：用 code 换取会话并写入 cookie，然后跳回。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const welcome = url.searchParams.get('welcome');
  if (code) {
    const supabase = createServerClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    try { if (data?.user?.id) await createAdminClient().from('users').update({ last_seen: new Date().toISOString() }).eq('id', data.user.id); } catch {}
  }
  const dest = welcome ? ('/welcome?next=' + encodeURIComponent(next)) : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
