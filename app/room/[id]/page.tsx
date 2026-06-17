// 房间页（服务端组件）：校验成员身份、取初始数据，交给 RoomClient 做实时渲染。
import { redirect } from 'next/navigation';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import RoomShell from './RoomShell';

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // RLS 保证：只有房间成员能读到这一行；非成员拿到 null
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

  // users 表 RLS 只允许读自己那行，这里用 admin 客户端读成员昵称（仅名字）
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

  // 线索 / NPC / 场景图（RLS 已按可见性过滤）；空也无妨
  const { data: clues } = await supabase
    .from('clues_player')
    .select('*')
    .eq('room_id', params.id)
    .order('created_at', { ascending: true });
  const { data: npcs } = await supabase
    .from('npcs')
    .select('*')
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

  const me = (players || []).find((p) => p.user_id === user.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';

  return (
    <RoomShell
      caseQuality={caseQuality}
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
    />
  );
}
