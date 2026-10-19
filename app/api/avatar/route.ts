// 头像上传：multipart file → Supabase Storage(avatars 桶) → 存 users.avatar_url。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, reason: 'nofile' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ ok: false, reason: 'type' }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return NextResponse.json({ ok: false, reason: 'toolarge' }, { status: 400 });
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${user.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from('avatars').upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ ok: false, reason: 'upload', detail: upErr.message }, { status: 500 });
  const { data: pub } = admin.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = pub.publicUrl;
  await admin.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id);
  return NextResponse.json({ ok: true, avatarUrl });
}
