// 廉价时钟:只处理"已到自己定的下次时间"的用户 → 生成主动消息并推送 → 重排下次时间。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { genProactive, scheduleNext, heuristicNextHours, historyWithGaps, type Companion } from '@/lib/companion/engine';
import { sendPushDetailed } from '@/lib/push';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function inQuiet(c: Companion) {
  const localH = (new Date().getUTCHours() + (c.tz_offset || 0) + 24) % 24;
  const qs = c.quiet_start, qe = c.quiet_end;
  return qs <= qe ? (localH >= qs && localH < qe) : (localH >= qs || localH < qe);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const url = new URL(req.url);
  if (secret && auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  // 到点的:next_reach_at 为空(新用户,首次)或已过
  const { data: cs } = await admin.from('companion').select('*')
    .eq('enabled', true)
    .or(`next_reach_at.is.null,next_reach_at.lte.${nowIso}`)
    .limit(60);
  let sent = 0;
  const pushLog: any[] = [];
  for (const c of (cs || []) as Companion[]) {
    try {
      // 新用户还没设人设 → 先别主动,给个默认下次时间
      if (!c.persona && !c.job) { await admin.from('companion').update({ next_reach_at: scheduleNext(c, 8) }).eq('user_id', c.user_id); continue; }
      // 勿扰时段 → 顺延,不发
      if (inQuiet(c)) { await admin.from('companion').update({ next_reach_at: scheduleNext(c, 1) }).eq('user_id', c.user_id); continue; }
      const { data: recent } = await admin.from('companion_msgs').select('role, text, created_at').eq('user_id', c.user_id).order('created_at', { ascending: false }).limit(14);
      const rows = (recent || []).reverse();
      const history = historyWithGaps(rows, 'zh');
      // 最后一条是不是 AI 发的还没被回 → followup,否则 bored
      const lastAiWaiting = c.last_ai_at && (!c.last_user_at || new Date(c.last_ai_at) > new Date(c.last_user_at));
      // 最后一条是 TA 发的、你没回 → late(隔一阵才回);你发了 TA 没回 → followup;否则 bored
      const userWaiting = rows.length > 0 && rows[rows.length - 1].role !== 'ai';
      const msg = await genProactive(c, history, 'zh', userWaiting ? 'late' : lastAiWaiting ? 'followup' : 'bored');
      const next = scheduleNext(c, heuristicNextHours(c));
      if (!msg) { await admin.from('companion').update({ next_reach_at: next }).eq('user_id', c.user_id); continue; }
      await admin.from('companion_msgs').insert({ user_id: c.user_id, role: 'ai', text: msg });
      await admin.from('companion').update({ last_ai_at: new Date().toISOString(), last_proactive: new Date().toISOString(), next_reach_at: next }).eq('user_id', c.user_id);
      const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', c.user_id);
      if (!subs || !subs.length) pushLog.push({ u: c.user_id.slice(0, 6), push: 'no_subs' });
      for (const s of (subs || [])) {
        const res = await sendPushDetailed({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: c.ai_name, body: msg, url: '/companion' });
        if (res.status === 'gone') await admin.from('push_subs').delete().eq('id', s.id);
        pushLog.push({ u: c.user_id.slice(0, 6), push: res.status, code: res.code, error: res.error });
      }
      sent++;
    } catch (e: any) { pushLog.push({ u: c.user_id.slice(0, 6), error: String(e?.message || e).slice(0, 160) }); }
  }
  return NextResponse.json({ ok: true, due: (cs || []).length, sent, pushLog });
}
