// 邮件登录确认：用 token_hash 验证（不依赖发起登录的浏览器，任何浏览器点链接都能登录）。
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') || 'email') as EmailOtpType;
  let next = url.searchParams.get('next') || '/';
  if (!next.startsWith('/')) next = '/'; // 防开放重定向

  if (token_hash) {
    const supabase = createServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL('/welcome?next=' + encodeURIComponent(next), url.origin));
    }
  }
  return NextResponse.redirect(new URL('/welcome?error=1&next=' + encodeURIComponent(next), url.origin));
}
