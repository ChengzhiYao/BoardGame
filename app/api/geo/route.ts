// 返回调用者的城市（Vercel geo header）；登录用户顺便把城市存到 users，供玩家/好友列表显示。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function geoFrom(req: Request) {
  const dec = (h: string) => { const v = req.headers.get(h) || ''; try { return decodeURIComponent(v); } catch { return v; } };
  const city = dec('x-vercel-ip-city');
  const region = (req.headers.get('x-vercel-ip-country-region') || '').toUpperCase();
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const label = city ? (region ? `${city}, ${region}` : city) : (region || country || '');
  return { city, region, country, label };
}

export async function GET(req: Request) {
  const g = geoFrom(req);
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !user.is_anonymous && user.email && (g.city || g.region)) {
      const admin = createAdminClient();
      await admin.from('users').update({ city: g.city || null, region: g.region || null, country: g.country || null }).eq('id', user.id);
    }
  } catch {}
  return NextResponse.json(g);
}
