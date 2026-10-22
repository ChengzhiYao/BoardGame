// 邀请离线好友上线一起玩：给好友邮箱发一封邀请邮件（best-effort）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const toUserId = (body.userId || '').trim();
  if (!toUserId) return NextResponse.json({ error: '参数缺失' }, { status: 400 });
  try {
    const admin = createAdminClient();
    // 必须是好友关系
    const { data: fr } = await admin.from('friendships').select('id').eq('status', 'accepted').or(`and(from_user.eq.${user.id},to_user.eq.${toUserId}),and(from_user.eq.${toUserId},to_user.eq.${user.id})`).maybeSingle();
    if (!fr) return NextResponse.json({ error: '仅限好友', reason: 'notfriend' }, { status: 403 });
    // 10 分钟内只发一次，避免骚扰
    const tenAgo = new Date(Date.now() - 600000).toISOString();
    const { data: recent } = await admin.from('play_invites').select('id').eq('from_user', user.id).eq('to_user', toUserId).gte('created_at', tenAgo).maybeSingle();
    if (recent) return NextResponse.json({ ok: true, throttled: true });
    await admin.from('play_invites').insert({ from_user: user.id, to_user: toUserId });
    const { data: target } = await admin.from('users').select('email').eq('id', toUserId).maybeSingle();
    const key = process.env.RESEND_API_KEY;
    if (key && target?.email) {
      const { data: meRow } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
      const fromName = (meRow?.display_name || String(user.email).split('@')[0]);
      const from = process.env.NOTIFY_FROM || 'MystNight <onboarding@resend.dev>';
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
      const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
        <h2 style="font-weight:600">🎲 ${esc(fromName)} 邀请你来 MystNight 一起玩</h2>
        <p style="color:#444">你的好友 <b>${esc(fromName)}</b> 正在线上，想和你开一局——剧本杀、克苏鲁、海龟汤……两个人就能玩。</p>
        <p style="margin:18px 0"><a href="${site}" style="display:inline-block;background:#7a1f1f;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none">上线和 TA 一起玩 →</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
        <h3 style="font-weight:600;font-size:15px">🎲 ${esc(fromName)} invited you to play on MystNight</h3>
        <p style="color:#444;font-size:14px">Your friend is online and wants to start a game with you. Two players is all it takes.</p>
      </div>`;
      fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: target.email, reply_to: user.email, subject: `🎲 ${fromName} 邀请你来 MystNight 一起玩`, html }) }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'fail' }, { status: 500 }); }
}
