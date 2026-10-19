// 给某个注册玩家发游戏邀请邮件（Resend）。模板末尾附上发送者的邮箱。
// 需登录（有邮箱）。防刷：每人每天≤30 封，同一对 6 小时内只发一次。
// 隐藏 hattie：不能邀请她、也不会泄露她的邮箱。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  }
  let body: any = {};
  try { body = await req.json(); } catch {}
  const toUserId = body?.toUserId;
  if (!toUserId || typeof toUserId !== 'string') {
    return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from('users').select('id, email, display_name').eq('id', toUserId).maybeSingle();
  if (!target || !target.email || target.email === HIDDEN) {
    return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });
  }

  // 防刷（game_invites 表没迁移时静默跳过，不阻塞发送）
  try {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count } = await admin.from('game_invites').select('id', { count: 'exact', head: true }).eq('from_user', user.id).gte('created_at', dayAgo);
    if ((count || 0) >= 30) return NextResponse.json({ ok: false, reason: 'limit' }, { status: 429 });
    const sixAgo = new Date(Date.now() - 6 * 3600000).toISOString();
    const { count: dup } = await admin.from('game_invites').select('id', { count: 'exact', head: true }).eq('from_user', user.id).eq('to_user', toUserId).gte('created_at', sixAgo);
    if ((dup || 0) > 0) return NextResponse.json({ ok: false, reason: 'dup' }, { status: 429 });
  } catch {}

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: 'no_provider' }, { status: 503 });

  const from = process.env.NOTIFY_FROM || 'MystNight <onboarding@resend.dev>';
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
  const inviter = user.email;
  const fromName = inviter.split('@')[0];
  const toName = target.display_name || 'there';

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-weight:600">🎲 ${fromName} 邀请你一起玩 MystNight</h2>
    <p>Hi ${toName}，<b>${fromName}</b> 想邀请你来 MystNight 玩一局 AI 主持的剧本杀 / 推理 / 海龟汤 —— 两个人就能开局。</p>
    <p style="margin:18px 0"><a href="${site}" style="display:inline-block;background:#7a1f1f;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none">进入 MystNight 一起玩 →</a></p>
    <hr style="border:none;border-top:1px solid #eee;margin:22px 0"/>
    <p style="font-size:13px;color:#555"><b>${fromName}</b> wants to play a game with you on MystNight. Click above to join — <a href="${site}">${site}</a></p>
    <p style="font-size:13px;color:#888;margin-top:18px">邀请来自 / Invited by: <b>${inviter}</b>（可直接回复此邮件联系 TA）</p>
  </div>`;

  let r: Response;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: target.email, reply_to: inviter, subject: `🎲 ${fromName} 邀请你一起玩 MystNight`, html }),
    });
  } catch {
    return NextResponse.json({ ok: false, reason: 'send_failed' }, { status: 502 });
  }
  if (!r.ok) {
    const detail = (await r.text().catch(() => '')).slice(0, 300);
    return NextResponse.json({ ok: false, reason: 'send_failed', detail }, { status: 502 });
  }
  try { await admin.from('game_invites').insert({ from_user: user.id, to_user: toUserId }); } catch {}
  return NextResponse.json({ ok: true });
}
