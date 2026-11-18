import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'AI 陪伴',
  manifest: '/api/companion/manifest',
  icons: { icon: '/companion-192.png', apple: '/companion-180.png' },
  appleWebApp: { capable: true, title: 'AI 陪伴', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { themeColor: '#1e1028' };

// 尽早接住 Chrome 的"可安装"事件(它常在 React 挂载前就触发,晚了就收不到了)
const EARLY = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;window.dispatchEvent(new Event('bip-ready'));});
try{if(location.search.indexOf('src=app')>=0)sessionStorage.setItem('companion_app','1');}catch(e){}`;

export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return <><script dangerouslySetInnerHTML={{ __html: EARLY }} />{children}</>;
}
