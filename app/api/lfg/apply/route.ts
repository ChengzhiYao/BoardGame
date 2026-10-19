// 申请加入一条组队公告：记录 + 给发布者发邮件(含申请人邮箱与留言)。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const postId = b?.postId; const message = (b?.message || '').toString().trim().slice(0, 300);
  if (!postId) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  const { data: post } = await admin.from('lfg_posts').select('id, author_user, game, note, active').eq('id', postId).maybeSingle();
  if (!post || !post.active) return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });
  if (post.author_user === user.id) return NextResponse.json({ ok: false, reason: 'self' }, { status: 400 });
  const { error } = await admin.from('lfg_applications').insert({ post_id: postId, applicant_user: user.id, message });
  if (error && !String(error.message).includes('duplicate')) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });

  // 邮件通知发布者
  try {
    const key = process.env.RESEND_API_KEY;
    const { data: author } = await admin.from('users').select('email').eq('id', post.author_user).maybeSingle();
    const { data: meRow } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
    if (key && author?.email) {
      const from = process.env.NOTIFY_FROM || 'MystNight <onboarding@resend.dev>';
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
      const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const applicant = meRow?.display_name || String(user.email).split('@')[0];
      const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
        <h2 style="font-weight:600">🙋 ${esc(applicant)} 申请加入你的组队公告</h2>
        <p style="color:#555">你的公告：${esc(post.game || '')} ${esc(post.note || '')}</p>
        ${message ? `<blockquote style="border-left:3px solid #7a1f1f;margin:14px 0;padding:6px 14px;color:#333;background:#faf7f2">${esc(message)}</blockquote>` : ''}
        <p style="margin:18px 0"><a href="${site}" style="display:inline-block;background:#7a1f1f;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none">回到 MystNight 查看 →</a></p>
        <p style="font-size:13px;color:#888;margin-top:18px">申请人 / From: <b>${esc(String(user.email))}</b></p>
      </div>`;
      fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: author.email, reply_to: user.email, subject: `🙋 ${applicant} 申请加入你的组队公告`, html }) }).catch(() => {});
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
