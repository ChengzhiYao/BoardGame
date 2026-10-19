// 公开玩家资料：昵称/头像/签名/最近在线/加入时间 + 玩过的游戏历史。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

const MODE_ZH: Record<string, string> = {
  coc: '克苏鲁的呼唤', soup: '海龟汤', td: '真心话大冒险', jbs: '剧本杀',
  botc: '血染钟楼', mcc: '午夜猫咒', dnd: '龙与地下城', story: '讲故事', meadow: '童话草原',
};

export async function GET(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: u } = await admin.from('users').select('id, display_name, email, bio, avatar_url, last_seen, created_at').eq('id', id).maybeSingle();
  if (!u || !u.email || u.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });

  const { data: prs } = await admin.from('players').select('room_id, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(50);
  const roomIds = Array.from(new Set((prs || []).map((p: any) => p.room_id)));
  let games: any[] = [];
  if (roomIds.length) {
    const { data: rooms } = await admin.from('rooms').select('id, mode, game_state, name, created_at').in('id', roomIds);
    const byId: Record<string, any> = {}; (rooms || []).forEach((r: any) => { byId[r.id] = r; });
    const seen = new Set<string>();
    for (const pr of (prs || [])) {
      if (seen.has(pr.room_id)) continue; seen.add(pr.room_id);
      const r = byId[pr.room_id]; if (!r) continue;
      games.push({ mode: r.mode, modeName: MODE_ZH[r.mode] || r.mode, ended: r.game_state === 'ended', ts: new Date(r.created_at || pr.created_at).getTime() });
    }
    games.sort((a, b) => b.ts - a.ts);
  }
  return NextResponse.json({
    ok: true,
    id: u.id,
    name: u.display_name || ('玩家·' + String(u.id).slice(0, 4)),
    avatar: u.avatar_url || null,
    bio: u.bio || '',
    lastSeen: u.last_seen ? new Date(u.last_seen).getTime() : null,
    joinedAt: u.created_at ? new Date(u.created_at).getTime() : null,
    gamesPlayed: roomIds.length,
    games: games.slice(0, 20),
  });
}
