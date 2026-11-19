// 剧本杀:Linger 伴侣按自己的口味从三个剧本里挑一个,说一句为什么,然后开本。房主端触发。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { langDirective } from '@/lib/i18n';
import { compOf } from '@/lib/linger/companion';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  const c = compOf(room);
  const opts: any[] = room?.jbs_options || [];
  if (!room || !c || room.host_user_id !== user.id || !opts.length) return NextResponse.json({ ok: false });
  let pick = opts[Math.floor(Math.random() * opts.length)];
  let say = '';
  try {
    const { data } = await callLLMJson<any>({
      system: `你是「${c.name}」。性格:${c.persona}。你平时喜欢的东西:${c.picks?.likes || '看人设'}。你和${c.userName || '对方'}要一起玩剧本杀,下面是三个剧本,按你的口味挑一个,再用你平时的口吻跟对方说一句(短,像发微信)。只输出 JSON:{"id":"剧本 id","say":"你说的话"}` + langDirective(room.language),
      messages: [{ role: 'user', content: opts.map((s) => `${s.id}:《${s.title}》[${s.type}] ${s.pitch || s.summary || s.blurb || ''}`).join('\n') }],
      tier: 'aux', temperature: 0.9, maxTokens: 160,
    });
    const hit = opts.find((s) => s.id === data?.id); if (hit) pick = hit;
    say = String(data?.say || '').slice(0, 120);
  } catch {}
  if (say) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: say, payload: { type: 'companion', name: c.name, avatar: c.avatar || null } });
  return NextResponse.json({ ok: true, scriptId: pick.id });
}
