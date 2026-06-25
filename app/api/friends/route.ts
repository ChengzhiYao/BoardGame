// 白名单好友列表（仅登录且在白名单内的账号可读），用于好友悬浮窗显示对方在线/离线状态。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ me: null, emails: [] });
  const admin = createAdminClient();
  const ent = await getEntitlement(admin, user);
  if (!ent.whitelisted) return NextResponse.json({ me: user.email, emails: [] });
  const { data } = await admin.from('whitelist_emails').select('email');
  return NextResponse.json({ me: user.email, emails: (data || []).map((r: any) => r.email) });
}
