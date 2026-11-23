// 开局后客户端悄悄叫一次：把这道题的汤面/汤底配音先做好存进题库（地址只存在服务器，不发给客户端，不会泄底）。
// 这样揭晓那一刻旁白能立刻开口。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { voicePuzzle } from '@/lib/soup/voice';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ ok: false }, { status: 403 });
  const { data: p } = await admin.from('soup_puzzles').select('lib_id').eq('room_id', roomId).maybeSingle();
  if (!p?.lib_id) return NextResponse.json({ ok: true, skipped: true });
  const { data: row } = await admin.from('soup_library').select('id, lang, surface, bottom, surface_audio, bottom_audio').eq('id', p.lib_id).maybeSingle();
  if (!row || (row.surface_audio && row.bottom_audio)) return NextResponse.json({ ok: true });
  try { await voicePuzzle(admin, row as any); } catch {}
  return NextResponse.json({ ok: true });
}
