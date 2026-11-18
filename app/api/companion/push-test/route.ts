// 测试推送:立刻给自己所有已订阅的设备发一条,并返回每一步的结果,方便排查"为什么收不到"。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
import { sendPushDetailed, pushConfigured } from '@/lib/push';
export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });
  const c = await ensureCompanion(admin, user.id);
  if (!pushConfigured()) return NextResponse.json({ ok: false, reason: 'no_vapid' });
  const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', user.id);
  if (!subs || !subs.length) return NextResponse.json({ ok: false, reason: 'no_subs' });
  const results: any[] = [];
  for (const s of subs) {
    const r = await sendPushDetailed({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: c.ai_name || '夜', body: '在吗', url: '/companion' });
    if (r.status === 'gone') await admin.from('push_subs').delete().eq('id', s.id);
    results.push({ host: (() => { try { return new URL(s.endpoint).host; } catch { return '?'; } })(), ...r });
  }
  return NextResponse.json({ ok: results.some((r) => r.status === 'ok'), results, enabled: c.enabled, nextReachAt: c.next_reach_at });
}
