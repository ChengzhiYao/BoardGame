// 白名单账号上线时调用：给其他白名单邮箱发「上线提醒」邮件（Resend）。
// 未配置 RESEND_API_KEY 时静默不发。客户端用 localStorage 防重复，无需建表。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'auth' });
  const admin = createAdminClient();
  const ent = await getEntitlement(admin, user);
  if (!ent.whitelisted) return NextResponse.json({ ok: false, reason: 'not_whitelisted' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: 'no_provider' });

  const { data } = await admin.from('whitelist_emails').select('email');
  const others = (data || []).map((r: any) => r.email).filter((e: string) => e && e !== user.email);
  if (others.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const from = process.env.NOTIFY_FROM || 'MystNight <onboarding@resend.dev>';
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
  const who = user.email.split('@')[0];
  let sent = 0;
  for (const to of others) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          subject: `🎲 ${who} 上线了 · ${who} is online on MystNight`,
          html: `<div style="font-family:system-ui,sans-serif"><p><b>${who}</b> 刚刚上线 MystNight，快去一起玩！</p><p><b>${who}</b> just came online — jump in.</p><p><a href="${site}">${site}</a></p></div>`,
        }),
      });
      if (r.ok) sent++;
    } catch {}
  }
  return NextResponse.json({ ok: true, sent });
}
