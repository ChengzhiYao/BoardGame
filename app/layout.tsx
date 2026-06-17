import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '克苏鲁调查团 · AI 守秘人',
  description: '双人联机 · AI 扮演 KP 的原创克苏鲁跑团',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
