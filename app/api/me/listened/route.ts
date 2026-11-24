// 听完（≥60%）一个故事就记一笔，用来算"故事迷""恐怖故事爱好者"这类称号
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ ok: false });
  const b = await req.json().catch(() => ({} as any));
  const ref = String(b.ref || '').slice(0, 120);
  if (!ref) return NextResponse.json({ ok: false });
  await createAdminClient().from('story_listens').upsert({ user_id: user.id, ref, kind: b.kind === 'ghost' ? 'ghost' : 'story', genre: String(b.genre || '').slice(0, 80), real: !!b.real, together: !!b.together }, { onConflict: 'user_id,ref', ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
