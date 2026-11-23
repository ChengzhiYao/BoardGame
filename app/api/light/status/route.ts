import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { lightStatus } from '@/lib/billing/light';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ login: false });
  const mode = new URL(req.url).searchParams.get('mode') || 'soup';
  return NextResponse.json(await lightStatus(createAdminClient(), user, mode));
}
