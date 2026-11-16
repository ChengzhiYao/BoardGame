// 定时"心跳":逐个用户让 AI 自主判断是否现在主动发消息(无聊/催)。可被 Vercel Cron 或外部 cron 调。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { decideReachOut, genProactive, type Companion } from '@/lib/companion/engine';
import type { LLMMessage } from '@/lib/llm';
import { sendPush } from '@/lib/push';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const url = new URL(req.url);
  if (secret && auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: cs } = await admin.from('companion').select('*').eq('enabled', true).limit(300);
  let sent = 0, checked = 0;
  for (const c of (cs || []) as Companion[]) {
    checked++;
    try {
      const d = await decideReachOut(c, 'zh');
      if (!d.go) continue;
      const { data: recent } = await admin.from('companion_msgs').select('role, text').eq('user_id', c.user_id).order('created_at', { ascending: false }).limit(10);
      const history: LLMMessage[] = (recent || []).reverse().map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      const msg = await genProactive(c, history, 'zh', d.reason);
      if (!msg) continue;
      const now = new Date().toISOString();
      await admin.from('companion_msgs').insert({ user_id: c.user_id, role: 'ai', text: msg });
      await admin.from('companion').update({ last_ai_at: now, last_proactive: now, last_sent: now }).eq('user_id', c.user_id);
      const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', c.user_id);
      for (const s of (subs || [])) {
        const res = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: c.ai_name, body: msg, url: '/companion' });
        if (res === 'gone') await admin.from('push_subs').delete().eq('id', s.id);
      }
      sent++;
    } catch {}
  }
  return NextResponse.json({ ok: true, checked, sent });
}
