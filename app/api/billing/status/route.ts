// 当前账号的开房额度状态（给收费页 / 落地页用）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ loggedIn: false });
  }
  const admin = createAdminClient();
  await admin.from('profiles').upsert({ user_id: user.id, email: user.email }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { data: wl } = await admin.from('whitelist_emails').select('email').eq('email', user.email).maybeSingle();
  const { data: p } = await admin.from('profiles').select('credits, is_whitelisted').eq('user_id', user.id).maybeSingle();
  const whitelisted = !!wl || !!p?.is_whitelisted;
  return NextResponse.json({ loggedIn: true, email: user.email, whitelisted, credits: p?.credits || 0 });
}
