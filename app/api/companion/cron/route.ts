// 定时任务：给到点的用户生成一条主动消息并推送。Vercel Cron 调用。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { genProactive, isDue, type Companion } from '@/lib/companion/engine';
import type { LLMMessage } from '@/lib/llm';
import { sendPush } from '@/lib/push';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  // 简单保护：带上 CRON_SECRET 或来自 Vercel Cron
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const url = new URL(req.url);
  if (secret && auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: cs } = await admin.from('companion').select('*').eq('enabled', true).limit(500);
  const due = (cs || []).filter((c: any) => isDue(c as Companion));
  let sent = 0;
  for (const c of due) {
    try {
      const { data: recent } = await admin.from('companion_msgs').select('role, text').eq('user_id', c.user_id).order('created_at', { ascending: false }).limit(10);
      const history: LLMMessage[] = (recent || []).reverse().map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      const msg = await genProactive(c as Companion, history, 'zh');
      if (!msg) continue;
      await admin.from('companion_msgs').insert({ user_id: c.user_id, role: 'ai', text: msg });
      await admin.from('companion').update({ last_sent: new Date().toISOString() }).eq('user_id', c.user_id);
      const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', c.user_id);
      for (const s of (subs || [])) {
        const res = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: c.ai_name, body: msg, url: '/companion' });
        if (res === 'gone') await admin.from('push_subs').delete().eq('id', s.id);
      }
      sent++;
    } catch {}
  }
  return NextResponse.json({ ok: true, checked: (cs || []).length, due: due.length, sent });
}
