import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, genReplyRich, replyDelaySec, updateMemory, clamp, scheduleNext } from '@/lib/companion/engine';
import type { LLMMessage } from '@/lib/llm';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const text = (b?.text || '').toString().trim().slice(0, 1000);
  if (!text) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const lang: 'zh' | 'en' = b?.lang === 'en' ? 'en' : 'zh';
  const admin = createAdminClient();
  const c = await ensureCompanion(admin, user.id);

  await admin.from('companion_msgs').insert({ user_id: user.id, role: 'user', text });

  const { data: recent } = await admin.from('companion_msgs').select('role, text').eq('user_id', user.id).order('created_at', { ascending: false }).limit(16);
  const history: LLMMessage[] = (recent || []).reverse().map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

  let rich;
  try { rich = await genReplyRich(c, history, lang); }
  catch { rich = { reply: lang === 'en' ? '…(hang on)' : '…(等下)', busy: 0.3, moodDelta: 0, affDelta: 0 }; }

  const newMood = clamp((c.mood || 60) + rich.moodDelta, 0, 100);
  const newAff = clamp((c.affection || 10) + rich.affDelta, 0, 100);
  const delay = replyDelaySec(rich.busy, newMood);

  await admin.from('companion_msgs').insert({ user_id: user.id, role: 'ai', text: rich.reply });
  const now = new Date().toISOString();
  const nextReach = scheduleNext(c, rich.nextHours);
  await admin.from('companion').update({ mood: newMood, affection: newAff, last_user_at: now, last_ai_at: now, next_reach_at: nextReach }).eq('user_id', user.id);

  try {
    const mem = await updateMemory(c, `User: ${text}\n${c.ai_name}: ${rich.reply}`, lang);
    if (mem && mem !== c.memory) await admin.from('companion').update({ memory: mem }).eq('user_id', user.id);
  } catch {}

  return NextResponse.json({ ok: true, reply: rich.reply, delay, mood: newMood, affection: newAff });
}
