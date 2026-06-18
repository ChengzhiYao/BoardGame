import './globals.css';
import type { Metadata } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://board-game-tau-eight.vercel.app';
const TITLE = '谜夜 · MystNight';
const DESC = '叫上朋友，两人即可开局。AI 主持一场现编的故事——剧本杀 / 推理探案 / 海龟汤。An AI host spins up a fresh murder mystery for you and a friend. Two players, infinite cases.';

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
