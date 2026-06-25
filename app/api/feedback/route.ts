// 玩家留言：GET ?slug= 读取某游戏的留言；POST 提交留言（需有会话，匿名也可）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { SLUGS } from '@/lib/seo-content';

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug') || '';
  if (!SLUGS.includes(slug)) return NextResponse.json({ items: [] });
  const admin = createAdminClient();
  const { data } = await admin.from('game_feedback').select('name, rating, message, created_at').eq('game_slug', slug).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || '');
  const message = String(body.message || '').trim();
  const name = String(body.name || '').trim().slice(0, 40);
  let rating = parseInt(body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) rating = 0;
  if (!SLUGS.includes(slug)) return NextResponse.json({ ok: false, reason: 'slug' }, { status: 400 });
  if (message.length < 1 || message.length > 1000) return NextResponse.json({ ok: false, reason: 'len' }, { status: 400 });
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'auth' }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from('game_feedback').insert({ game_slug: slug, name: name || null, rating: rating || null, message });
  if (error) return NextResponse.json({ ok: false, reason: 'db' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
