// 联系客服：访客留言 → 发邮件到管理员邮箱（收件人是 Resend 账号本人，无需验证域名即可送达）。
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const ADMIN = process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com';

export async function POST(req: Request) {
  let b: any = {}; try { b = await req.json(); } catch {}
  const message = (b?.message || '').toString().trim().slice(0, 2000);
  const email = (b?.email || '').toString().trim().slice(0, 200);
  if (!message) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: 'no_provider' }, { status: 503 });
  const from = process.env.NOTIFY_FROM || 'MystNight <onboarding@resend.dev>';
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-weight:600">📩 MystNight 客服留言</h2>
    <blockquote style="border-left:3px solid #7a1f1f;margin:14px 0;padding:8px 14px;color:#333;background:#faf7f2;white-space:pre-wrap">${esc(message)}</blockquote>
    <p style="font-size:13px;color:#888">联系邮箱 / From: <b>${validEmail ? esc(email) : '（未留邮箱）'}</b></p>
  </div>`;
  let r: Response;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: ADMIN, ...(validEmail ? { reply_to: email } : {}), subject: '📩 MystNight 客服留言', html }),
    });
  } catch { return NextResponse.json({ ok: false, reason: 'send_failed' }, { status: 502 }); }
  if (!r.ok) { const detail = (await r.text().catch(() => '')).slice(0, 200); return NextResponse.json({ ok: false, reason: 'send_failed', detail }, { status: 502 }); }
  return NextResponse.json({ ok: true });
}
