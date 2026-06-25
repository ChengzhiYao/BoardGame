// 页面打点：每次页面加载记一条（路径 + 来源 + 匿名访客id），给 Admin 看流量/自然搜索。
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';

const BOT = /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|chrome-lighthouse|preview|monitor|pingdom|gtmetrix|ahrefs|semrush|petalbot|yandexbot)/i;
const self = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com').replace(/^https?:\/\//, '').replace(/^www\./, '');

function refHost(ref: string): string {
  if (!ref) return 'direct';
  try { const h = new URL(ref).hostname.replace(/^www\./, ''); if (h === self || h.endsWith('mystnight.com')) return 'internal'; return h.slice(0, 80); } catch { return 'direct'; }
}

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  const res = new NextResponse(null, { status: 204 });
  if (BOT.test(ua)) return res;
  let body: any = {}; try { body = await req.json(); } catch {}
  let path = String(body.path || '/').slice(0, 200);
  if (path.startsWith('/room')) path = '/room';
  else if (path.startsWith('/join')) path = '/join';
  const ref = refHost(String(body.ref || ''));
  let vid = cookies().get('vid')?.value;
  if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); res.cookies.set('vid', vid, { maxAge: 31536000, path: '/', sameSite: 'lax' }); }
  try { const admin = createAdminClient(); await admin.from('page_views').insert({ path, ref, vid }); } catch {}
  return res;
}
