// 私信收件箱：按对话聚合，返回对方昵称 + 未读数 + 最近时间。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ threads: [], totalUnread: 0 });
  const admin = createAdminClient();
  const { data } = await admin.from('dms').select('from_user, to_user, text, created_at, read_at')
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
    .order('created_at', { ascending: false }).limit(500);
  const map: Record<string, { userId: string; unread: number; lastTs: number; lastText: string }> = {};
  (data || []).forEach((m: any) => {
    const other = m.from_user === user.id ? m.to_user : m.from_user;
    const ts = new Date(m.created_at).getTime();
    if (!map[other]) map[other] = { userId: other, unread: 0, lastTs: ts, lastText: m.text };
    if (m.to_user === user.id && !m.read_at) map[other].unread++;
  });
  const ids = Object.keys(map);
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await admin.from('users').select('id, display_name').in('id', ids);
    (us || []).forEach((u: any) => { names[u.id] = u.display_name || ('玩家·' + String(u.id).slice(0, 4)); });
  }
  const threads = ids.map((id) => ({ ...map[id], name: names[id] || ('玩家·' + id.slice(0, 4)) })).sort((a, b) => b.lastTs - a.lastTs);
  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);
  return NextResponse.json({ threads, totalUnread });
}
