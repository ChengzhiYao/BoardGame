// 输入框语音转文字的兜底(浏览器自带识别用不了时):转给 Linger 那边同一套转写。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LINGER_URL } from '@/lib/linger/companion';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.text();
  if (body.length > 12_500_000) return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 413 });
  try {
    const r = await fetch(`${LINGER_URL}/api/mystnight/stt`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body });
    const d = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: !!d?.ok, text: String(d?.text || '') });
  } catch { return NextResponse.json({ ok: false, text: '' }); }
}
