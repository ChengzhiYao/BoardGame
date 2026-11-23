// 一局结束后检查有没有新称号：和上次记下的比，新得的返回给前端弹一下
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { collect, BADGES } from '@/lib/collection';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ fresh: [] });
  const { lang } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { earned } = await collect(admin, user.id, lang === 'en' ? 'en' : 'zh', false);
  const { data: p } = await admin.from('profiles').select('badges').eq('user_id', user.id).maybeSingle();
  const had: string[] = Array.isArray(p?.badges) ? p!.badges : [];
  const fresh = earned.filter((id) => !had.includes(id));
  if (fresh.length) await admin.from('profiles').update({ badges: Array.from(new Set([...had, ...earned])) }).eq('user_id', user.id);
  return NextResponse.json({ fresh: BADGES.filter((b) => fresh.includes(b.id)).map((b) => ({ id: b.id, icon: b.icon, zh: b.zh, en: b.en, dzh: b.dzh, den: b.den })) });
}
