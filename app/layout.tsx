import './globals.css';
import type { Metadata, Viewport } from 'next';
import InstallPWA from './InstallPWA';
import FriendDock from '@/components/FriendDock';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
const TITLE = '谜夜 MystNight · AI 主持的在线剧本杀 / 克苏鲁 / 海龟汤';
const DESC = '叫上朋友，两个人就能开局。AI 当主持人，实时现编一场只属于今晚的游戏——剧本杀、克苏鲁跑团、海龟汤、真心话大冒险、D&D 等八种玩法，每局都不一样。An AI game master that writes the case, plays the suspects and runs the table — murder mystery, Cthulhu, D&D and more, for two players or a full table.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s · 谜夜 MystNight' },
  description: DESC,
  applicationName: 'MystNight 谜夜',
  keywords: ['谜夜', 'MystNight', 'AI 剧本杀', '在线剧本杀', '双人剧本杀', '克苏鲁跑团', 'COC 跑团', '海龟汤', '真心话大冒险', 'AI 游戏主持', 'AI 主持人', '在线桌游', '两人桌游', 'AI murder mystery', 'online murder mystery', 'AI game master', 'AI tabletop', 'Cthulhu RPG', 'lateral thinking puzzle'],
  authors: [{ name: 'MystNight' }],
  category: 'games',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  appleWebApp: { capable: true, title: 'MystNight', statusBarStyle: 'black-translucent' },
  openGraph: { title: TITLE, description: DESC, siteName: '谜夜 MystNight', type: 'website', url: SITE, locale: 'zh_CN', alternateLocale: ['en_US'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export const viewport: Viewport = { themeColor: '#0c0d10' };

const JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: '谜夜 MystNight', alternateName: 'MystNight', url: SITE, inLanguage: ['zh-CN', 'en'], description: DESC },
    { '@type': 'SoftwareApplication', name: '谜夜 MystNight', applicationCategory: 'GameApplication', operatingSystem: 'Web', url: SITE, description: DESC, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
        <InstallPWA />
        <FriendDock />
        {children}
      </body>
    </html>
  );
}
