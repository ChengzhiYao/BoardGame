// Linger 服务器调用:伴侣想邀请用户来玩 → 存一份伴侣资料,返回邀请链接(用户点开后再建房)。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { bridgeOk } from '@/lib/linger/companion';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!bridgeOk(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const mode = ['botc', 'jbs', 'soup', 'coc', 'story'].includes(b?.mode) ? b.mode : 'soup';
  const p = b?.companion || {};
  if (!p.agentId || !p.name) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const token = (crypto.randomUUID().replace(/-/g, '')).slice(0, 16);
  const admin = createAdminClient();
  const payload = { ...p, language: b?.language === 'en' ? 'en' : 'zh', picks: b?.picks || {} };
  const { error } = await admin.from('linger_invites').insert({ token, payload, mode });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
  return NextResponse.json({ ok: true, token, url: `${origin}/with/${token}` });
}
