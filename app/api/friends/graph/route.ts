// 当前账号的好友图：已通过好友 / 收到的请求 / 发出的请求。回昵称+头像+id，不暴露邮箱。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ friends: [], incoming: [], outgoing: [] });
  const admin = createAdminClient();
  admin.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {}, () => {});
  const { data: rows } = await admin
    .from('friendships')
    .select('from_user, to_user, status')
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`);
  const ids = new Set<string>();
  (rows || []).forEach((r: any) => { ids.add(r.from_user); ids.add(r.to_user); });
  ids.delete(user.id);
  const nameMap: Record<string, string> = {};
  const avatarMap: Record<string, string | null> = {};
  const locMap: Record<string, string> = {};
  if (ids.size) {
    const { data: us } = await admin.from('users').select('id, display_name, avatar_url, city, region').in('id', Array.from(ids));
    (us || []).forEach((u: any) => { nameMap[u.id] = u.display_name || ('玩家·' + String(u.id).slice(0, 4)); avatarMap[u.id] = u.avatar_url || null; locMap[u.id] = u.city ? (u.region ? `${u.city}, ${u.region}` : u.city) : (u.region || ''); });
  }
  const nm = (id: string) => nameMap[id] || ('玩家·' + id.slice(0, 4));
  const node = (id: string) => ({ id, name: nm(id), avatar: avatarMap[id] || null, loc: locMap[id] || '' });
  const friends: any[] = [], incoming: any[] = [], outgoing: any[] = [];
  (rows || []).forEach((r: any) => {
    if (r.status === 'accepted') { const other = r.from_user === user.id ? r.to_user : r.from_user; friends.push(node(other)); }
    else if (r.status === 'pending') { if (r.to_user === user.id) incoming.push(node(r.from_user)); else outgoing.push(node(r.to_user)); }
  });
  return NextResponse.json({ friends, incoming, outgoing });
}
