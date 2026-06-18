// 房间页（服务端组件）：校验成员身份、取初始数据，交给 RoomShell 做实时渲染。
import { redirect } from 'next/navigation';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import RoomShell from './RoomShell';

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!room) {
    return (
      <main className="min-h-screen flex items-center justify-center text-parchment/70">
        房间不存在，或你不在其中。
      </main>
    );
  }

  const { data: players } = await supabase
    .from('players')
    .select('id, seat, user_id, is_online')
    .eq('room_id', params.id);

  const admin = createAdminClient();
  const ids = (players || []).map((p) => p.user_id);
  const { data: users } = ids.length
    ? await admin.from('users').select('id, display_name').in('id', ids)
    : { data: [] as any[] };

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', params.id)
    .order('created_at', { ascending: true })
    .limit(200);

  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('room_id', params.id);

  const { data: clues } = await supabase
    .from('clues_player')
    .select('*')
    .eq('room_id', params.id)
    .order('created_at', { ascending: true });
  // 只取前端安全字段：绝不下发 secret / goal / memory / relationships（这些是 KP 侧机密）
  const { data: npcs } = await supabase
    .from('npcs')
    .select('id, name, role, description, disposition, status, visible_to, first_seen_turn')
    .eq('room_id', params.id);
  const { data: images } = await supabase
    .from('images')
    .select('*')
    .eq('room_id', params.id)
    .order('created_at', { ascending: true });

  const { data: campaign } = room.campaign_id
    ? await supabase.from('campaigns').select('setting').eq('id', room.campaign_id).maybeSingle()
    : { data: null };
  const caseQuality = (campaign?.setting as any)?.quality || null;

  const { data: soup } = room.mode === 'soup'
    ? await supabase.from('soup_puzzles').select('surface').eq('room_id', params.id).maybeSingle()
    : { data: null };

  // 剧本杀：角色名册（公开字段，RLS 允许成员读）
  const { data: jbsCharacters } = room.mode === 'jbs'
    ? await supabase.from('jbs_characters').select('name, occupation, public_info, is_ai, assigned_seat, status').eq('room_id', params.id)
    : { data: [] as any[] };

  const me = (players || []).find((p) => p.user_id === user.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';

  return (
    <RoomShell
      caseQuality={caseQuality}
      soupSurface={(soup as any)?.surface || ''}
      room={room}
      initialPlayers={players || []}
      initialUsers={(users as any[]) || []}
      initialMessages={messages || []}
      initialCharacters={characters || []}
      initialClues={clues || []}
      initialNpcs={npcs || []}
      initialImages={images || []}
      myPlayerId={me?.id || null}
      mySeat={me?.seat || null}
      userId={user.id}
      inviteToken={room.invite_token}
      siteUrl={site}
      jbsCharacters={(jbsCharacters as any[]) || []}
    />
  );
}
