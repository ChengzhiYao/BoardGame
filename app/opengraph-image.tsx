// 链接分享预览图（og:image / twitter image）。代码生成 1200×630。
// 想换成自己的图：删掉本文件，放一张 app/opengraph-image.png（1200×630）即可自动生效。
import { ImageResponse } from 'next/og';

export const alt = 'Call of the Deep · Cthulhu co-op TRPG';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 28%, #16202b 0%, #07090c 72%)',
          color: '#e8e0cf',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 10, color: '#6f9a86', marginBottom: 22 }}>
          CTHULHU · CO-OP HORROR TRPG
        </div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, letterSpacing: 2 }}>
          CALL OF THE DEEP
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#a89e87', marginTop: 26, maxWidth: 860, textAlign: 'center' }}>
          Two investigators. One AI Keeper. A truth that never changes.
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#5f6b74', marginTop: 40, letterSpacing: 4 }}>
          ZH / EN
        </div>
      </div>
    ),
    { ...size }
  );
}
