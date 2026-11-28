// 频道群聊持久化。频道:'whitelist'(白名单好友群聊,仅白名单可读写);'public'(大厅公共频道:谁都能看,登录后能说话)。
// 公共频道的规矩:每条最多 300 字;3 秒内只能发 1 条、10 分钟最多 20 条;不能发外链;发之前过一遍内容审核;
// 站长可以删消息、禁言。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export const dynamic = 'force-dynamic';
const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();

async function who() {
  const { data: { user } } = await createServerClient().auth.getUser();
  return user && !user.is_anonymous && user.email ? user : null;
}

async function canRead(channel: string, user: any, admin: any) {
  if (channel === 'public') return true;
  if (channel === 'whitelist') { if (!user) return false; const ent = await getEntitlement(admin, user); return !!ent.whitelisted; }
  return false;
}

async function mutes(admin: any): Promise<Record<string, number>> {
  const { data } = await admin.from('app_kv').select('value').eq('key', 'public_mutes').maybeSingle();
  return (data?.value && typeof data.value === 'object') ? data.value : {};
}

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|cn|io|xyz|top|cc|me|app|link|gg|ru|tk)\b)/i;
const BAD_RE = /(约炮|裸聊|招嫖|色情|成人视频|av女优|加微信|加v|vx|qq群|兼职刷单|赌博|博彩|nude|porn|onlyfans|escort|nigg|fag)/i;

async function moderate(text: string): Promise<boolean> {
  try {
    const { callLLMJson } = await import('@/lib/llm');
    const p = callLLMJson<any>({
      system: 'You moderate a public chat in an online party-game site (adults and teens). Reply JSON {"ok":true|false}. ok=false only for: sexual content, harassment or slurs aimed at people, threats, self-harm encouragement, spam/ads or contact-info solicitation, doxxing. Normal game talk, mild swearing, jokes and spooky horror talk are ok.',
      messages: [{ role: 'user', content: text }], tier: 'aux', temperature: 0, maxTokens: 30,
    } as any);
    const r: any = await Promise.race([p, new Promise((res) => setTimeout(() => res(null), 4000))]);
    if (!r) return true; // 审核超时就放行(前面还有关键词过滤)
    return r.data?.ok !== false;
  } catch { return true; }
}

export async function GET(req: Request) {
  const u = new URL(req.url); const channel = u.searchParams.get('channel') || '';
  const user = await who(); const admin = createAdminClient();
  if (!(await canRead(channel, user, admin))) return NextResponse.json({ messages: [] });
  const after = u.searchParams.get('after');
  let q = admin.from('group_messages').select('id, from_user, from_name, text, created_at').eq('channel', channel);
  if (after) q = q.gt('created_at', after);
  const { data } = await q.order('created_at', { ascending: false }).limit(80);
  const rows = (data || []).reverse();
  const ids = Array.from(new Set(rows.map((m: any) => m.from_user).filter(Boolean)));
  const { data: us } = ids.length ? await admin.from('users').select('id, display_name, avatar_url').in('id', ids) : { data: [] as any[] };
  const messages = rows.map((m: any) => { const p = (us || []).find((x: any) => x.id === m.from_user);
    return { id: m.id, userId: m.from_user, name: p?.display_name || m.from_name, avatar: p?.avatar_url || null, text: m.text, at: m.created_at, ts: new Date(m.created_at).getTime(), mine: !!user && m.from_user === user.id }; });
  return NextResponse.json({ messages, isAdmin: !!user && String(user.email).toLowerCase() === ADMIN, canPost: !!user });
}

export async function POST(req: Request) {
  let body: any = {}; try { body = await req.json(); } catch {}
  const channel = String(body?.channel || '');
  const user = await who(); const admin = createAdminClient();
  if (!user) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  if (channel !== 'public' && !(await canRead(channel, user, admin))) return NextResponse.json({ ok: false }, { status: 403 });
  const isAdmin = String(user.email).toLowerCase() === ADMIN;

  // 站长:删消息 / 禁言
  if (body?.action === 'delete' && isAdmin) { await admin.from('group_messages').delete().eq('id', String(body.id || '')).eq('channel', channel); return NextResponse.json({ ok: true }); }
  if (body?.action === 'mute' && isAdmin) { const m = await mutes(admin); m[String(body.userId)] = Date.now() + (Number(body.hours) || 24) * 3600000; await admin.from('app_kv').upsert({ key: 'public_mutes', value: m }); return NextResponse.json({ ok: true }); }

  const text = String(body?.text || '').replace(/\s+/g, ' ').trim().slice(0, channel === 'public' ? 300 : 1000);
  if (!text) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const { data: me } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  const name = String(me?.display_name || String(user.email).split('@')[0]).slice(0, 30);

  if (channel === 'public' && !isAdmin) {
    const m = await mutes(admin); if (m[user.id] && m[user.id] > Date.now()) return NextResponse.json({ ok: false, reason: 'muted' }, { status: 403 });
    const { data: recent } = await admin.from('group_messages').select('created_at').eq('channel', 'public').eq('from_user', user.id).gte('created_at', new Date(Date.now() - 600000).toISOString()).order('created_at', { ascending: false }).limit(25);
    if ((recent || []).length && Date.now() - new Date(recent![0].created_at).getTime() < 3000) return NextResponse.json({ ok: false, reason: 'slow' }, { status: 429 });
    if ((recent || []).length >= 20) return NextResponse.json({ ok: false, reason: 'rate' }, { status: 429 });
    if (LINK_RE.test(text.replace(/mystnight\.com/gi, ''))) return NextResponse.json({ ok: false, reason: 'link' }, { status: 400 });
    if (BAD_RE.test(text) || !(await moderate(text))) return NextResponse.json({ ok: false, reason: 'blocked' }, { status: 400 });
  }
  const { data: row, error } = await admin.from('group_messages').insert({ channel, from_user: user.id, from_name: name, text }).select('id, created_at').single();
  if (error) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: row?.id, at: row?.created_at });
}
