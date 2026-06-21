export async function loadStory(admin: any, roomId: string): Promise<any | null> {
  const { data } = await admin.from('story_state').select('state').eq('room_id', roomId).maybeSingle();
  return data?.state || null;
}
export async function persistStory(admin: any, roomId: string, state: any) {
  await admin.from('story_state').upsert({ room_id: roomId, state, updated_at: new Date().toISOString() });
  await admin.from('rooms').update({ story_phase: state.phase, game_state: state.phase === 'reading' ? 'playing' : 'playing' }).eq('id', roomId);
}
