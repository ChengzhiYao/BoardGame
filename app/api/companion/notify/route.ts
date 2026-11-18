// 回复已生成但页面在"假装打字"时被关掉/切到后台 → 把还没显示的消息推送到手机。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
import { sendPush } from '@/lib/push';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const texts: string[] = Array.isArray(b?.texts) ? b.texts.map((t: any) => String(t).slice(0, 300)).slice(0, 3) : [];
  if (!texts.length) return NextResponse.json({ ok: true });
  // 只推送服务器上确实存在的最近 AI 消息,防止乱推
  const { data: recent } = await admin.from('companion_msgs').select('text, role').eq('user_id', user.id).eq('role', 'ai').order('created_at', { ascending: false }).limit(6);
  const ok = texts.filter((t) => (recent || []).some((r: any) => r.text === t));
  if (!ok.length) return NextResponse.json({ ok: true });
  const c = await ensureCompanion(admin, user.id);
  const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', user.id);
  for (const s of (subs || [])) {
    const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: c.ai_name, body: ok.join('\n'), url: '/companion' });
    if (r === 'gone') await admin.from('push_subs').delete().eq('id', s.id);
  }
  return NextResponse.json({ ok: true, pushed: ok.length });
}
