import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { closeStaleRooms, ROOM_IDLE_MIN } from '@/lib/rooms/sweep';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = createAdminClient();
  const res = await closeStaleRooms(admin, ROOM_IDLE_MIN);
  return NextResponse.json({ ok: true, ...res });
}
