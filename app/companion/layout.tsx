import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'AI 陪伴',
  manifest: '/api/companion/manifest',
  icons: { icon: '/companion-192.png', apple: '/companion-180.png' },
  appleWebApp: { capable: true, title: 'AI 陪伴', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { themeColor: '#1e1028' };

export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
