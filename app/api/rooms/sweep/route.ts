import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { closeStaleRooms } from '@/lib/rooms/sweep';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = createAdminClient();
  const res = await closeStaleRooms(admin, 5);
  return NextResponse.json({ ok: true, ...res });
}
