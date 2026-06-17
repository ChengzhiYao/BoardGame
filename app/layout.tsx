import './globals.css';
import type { Metadata } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://board-game-tau-eight.vercel.app';
const TITLE = '克苏鲁调查团 · Call of the Deep';
const DESC = '双人联机 · AI 守秘人的原创克苏鲁跑团。Two-player co-op Cthulhu TRPG run by an AI Keeper.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  openGraph: {
    title: TITLE,
    description: DESC,
    siteName: '克苏鲁调查团 / Call of the Deep',
    type: 'website',
    url: SITE,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
