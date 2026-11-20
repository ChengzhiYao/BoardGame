// 你的 Linger 伴侣在谜夜的账号(没登录、只是游客玩也能看到 TA,能私信)
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ userId: null, companions: [] });
  const admin = createAdminClient();
  const { data } = await admin.from('users').select('id, display_name, avatar_url').eq('linger_owner', user.id).not('linger_agent_id', 'is', null);
  return NextResponse.json({ userId: user.id, companions: (data || []).map((u: any) => ({ id: u.id, name: u.display_name || 'TA', avatar: u.avatar_url || null })) });
}
