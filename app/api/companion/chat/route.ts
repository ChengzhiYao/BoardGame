// 聊天:发消息只存(不阻塞,可以连发);停顿后客户端调 respond,AI 一次性看完你发的所有未回消息再决定怎么回。
import { NextResponse } from 'next/server';
import { previewText } from '@/lib/companion/stickers';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push';
import { signPhoto, photosToday, PHOTO_DAILY_LIMIT } from '@/lib/companion/photo';
import { ensureCompanion, planReaction, genMessages, replyDelaySec, updateMemory, clamp, scheduleNext, heuristicNextHours, isAllowed, type MsgRow } from '@/lib/companion/engine';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const lang: 'zh' | 'en' = b?.lang === 'en' ? 'en' : 'zh';
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });

  // ---- 模式 1:只存用户消息,立刻返回 ----
  if (!b?.respond) {
    const text = (b?.text || '').toString().trim().slice(0, 1000);
    if (!text) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
    await admin.from('companion_msgs').insert({ user_id: user.id, role: 'user', text });
    // 兜底:万一页面没来得及让 TA 回(你发完就退出了),几分钟后由定时任务"隔一阵才回"并推送到手机
    const fallback = new Date(Date.now() + (3 + Math.random() * 5) * 60000).toISOString();
    await admin.from('companion').update({ last_user_at: new Date().toISOString(), next_reach_at: fallback }).eq('user_id', user.id);
    return NextResponse.json({ ok: true, stored: true });
  }

  // ---- 模式 2:respond —— 看完所有未回的消息再反应 ----
  const c = await ensureCompanion(admin, user.id);
  const { data: recent } = await admin.from('companion_msgs').select('role, text, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(24);
  const rows: MsgRow[] = (recent || []).reverse();
  if (!rows.length || rows[rows.length - 1].role === 'ai') return NextResponse.json({ ok: true, replies: [], nothing: true });
  let k = rows.length; while (k > 0 && rows[k - 1].role !== 'ai') k--;
  const pending = rows.slice(k).map((r) => r.text);

  const plan = await planReaction(c, rows, lang);
  const newMood = clamp((c.mood || 60) + plan.moodDelta, 0, 100);
  const newAff = clamp((c.affection || 10) + plan.affDelta, 0, 100);
  // 聊完后多久会主动找你:不超过频率设定给的上限(否则天天聊天会把主动消息一直往后推,永远等不到)
  const nextReach = scheduleNext(c, Math.min(plan.nextHours, heuristicNextHours(c)));

  if (plan.action === 'ignore') {
    // 已读不回:先不回,cron 到点后"隔一阵才回";你再发消息也会重新触发
    await admin.from('companion').update({ mood: newMood, affection: newAff, next_reach_at: nextReach }).eq('user_id', user.id);
    return NextResponse.json({ ok: true, replies: [], delay: 0, mood: newMood, affection: newAff });
  }

  let replies: string[];
  try { replies = await genMessages(c, rows, plan, lang); }
  catch { replies = [lang === 'en' ? 'hang on' : '等下']; }
  const delay = replyDelaySec(plan.busy, newMood);

  for (const r of replies) await admin.from('companion_msgs').insert({ user_id: user.id, role: 'ai', text: r });
  await admin.from('companion').update({ mood: newMood, affection: newAff, last_ai_at: new Date().toISOString(), next_reach_at: nextReach }).eq('user_id', user.id);

  try {
    const mem = await updateMemory(c, `User: ${pending.join(' / ')}\n${c.ai_name}: ${replies.join(' / ')}`, lang);
    if (mem && mem !== c.memory) await admin.from('companion').update({ memory: mem }).eq('user_id', user.id);
  } catch {}

  // 生活照:模型想发 + 没超每日上限 + 配了出图 key → 给前端一个签名任务,由 /photo 接口异步出图(不拖慢文字回复)
  let photo: any = null;
  if (plan.photo && (process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY)) {
    try {
      if ((await photosToday(admin, user.id)) < PHOTO_DAILY_LIMIT) {
        const ts = Date.now();
        photo = { desc: plan.photoDesc, ts, sig: signPhoto(user.id, plan.photoDesc, ts) };
      }
    } catch {}
  }
  // 页面已经退到后台时(push:true),直接推送到手机
  if (b?.push) await pushTo(admin, user.id, c.ai_name, replies.join('\n'), c.avatar_url);
  return NextResponse.json({ ok: true, replies, reply: replies.join('\n'), delay, mood: newMood, affection: newAff, photo });
}

async function pushTo(admin: any, userId: string, title: string, body: string, icon?: string | null) {
  try {
    const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', userId);
    for (const s of (subs || [])) {
      const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title, body: previewText(body), url: '/companion?src=app', icon: icon || undefined });
      if (r === 'gone') await admin.from('push_subs').delete().eq('id', s.id);
    }
  } catch {}
}
