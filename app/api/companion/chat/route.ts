import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, genReply, updateMemory, type Companion } from '@/lib/companion/engine';
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

  // 取最近历史做上下文
  const { data: recent } = await admin.from('companion_msgs').select('role, text').eq('user_id', user.id).order('created_at', { ascending: false }).limit(16);
  const history: LLMMessage[] = (recent || []).reverse().map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

  let reply = '';
  try { reply = await genReply(c, history, lang); } catch { reply = lang === 'en' ? '…(I had trouble thinking just now, try again?)' : '…(我刚卡了一下，再说一次？)'; }
  await admin.from('companion_msgs').insert({ user_id: user.id, role: 'ai', text: reply });

  // 异步更新长期记忆（不阻塞返回太久）
  try {
    const exchange = `User: ${text}\n${c.ai_name}: ${reply}`;
    const mem = await updateMemory(c, exchange, lang);
    if (mem && mem !== c.memory) await admin.from('companion').update({ memory: mem }).eq('user_id', user.id);
  } catch {}

  return NextResponse.json({ ok: true, reply });
}
