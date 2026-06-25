import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MystNight — AI-hosted tabletop nights';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c0d10', color: '#d8c7a8' }}>
        <div style={{ fontSize: 122, fontWeight: 800, color: '#f2ead9', letterSpacing: 6 }}>MystNight</div>
        <div style={{ width: 96, height: 3, background: '#7d1d1d', margin: '34px 0' }} />
        <div style={{ fontSize: 40, color: '#a99c82', maxWidth: 940, textAlign: 'center' }}>{'AI-hosted murder mystery · Cthulhu · D&D · and more'}</div>
        <div style={{ fontSize: 27, color: '#6f6757', marginTop: 20 }}>{'For two players or a full table'}</div>
      </div>
    ),
    { ...size },
  );
}
