// Google OAuth 回调：用 code 换取会话并写入 cookie，然后跳回。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const welcome = url.searchParams.get('welcome');
  if (code) {
    const supabase = createServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  const dest = welcome ? ('/welcome?next=' + encodeURIComponent(next)) : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
