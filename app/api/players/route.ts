// 注册玩家目录：仅返回昵称（不暴露邮箱）。需登录（有邮箱的注册账号）才能看。
// 隐藏 hattie（不让她出现在任何人的玩家列表里）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ loggedIn: false, players: [] });
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id, display_name, email, created_at')
    .not('email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  const players = (data || [])
    .filter((u: any) => u.email && u.id !== user.id && u.email !== HIDDEN)
    .map((u: any) => ({ id: u.id, name: u.display_name || ('玩家·' + String(u.id).slice(0, 4)) }));
  return NextResponse.json({ loggedIn: true, players });
}
