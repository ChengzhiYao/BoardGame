// AI 陪伴独立的桌面应用 manifest:自己的名字(=TA 的名字)、图标,打开直接进聊天,不经过谜夜首页。
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = (u.searchParams.get('n') || '').replace(/[<>"\\]/g, '').trim().slice(0, 24);
  const name = raw || 'AI 陪伴';
  return NextResponse.json({
    id: '/companion',
    name,
    short_name: name.slice(0, 12),
    description: 'TA 会主动找你聊天',
    start_url: '/companion?src=app',
    scope: '/companion',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1e1028',
    theme_color: '#1e1028',
    icons: [
      { src: '/companion-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/companion-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/companion-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
