import type { ReactNode } from 'react';
import Link from 'next/link';
import LangSwitch from '@/components/LangSwitch';
import SiteFooter from '@/components/SiteFooter';

export default function BlogLayout({ children, params }: { children: ReactNode; params: { lang: string } }) {
  const lang = params.lang === 'en' ? 'en' : 'zh';
  const en = lang === 'en';
  return (
    <div className="min-h-screen text-parchment">
      <header className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
        <Link href="/" className="font-serif text-xl">谜夜<span className="text-blood">.</span><span className="text-parchment/40 text-sm ml-1.5">MystNight</span></Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href={`/${lang}/blog`} className="text-parchment/70 hover:text-parchment">{en ? 'Blog' : '博客'}</Link>
          <LangSwitch lang={lang} />
          <Link href="/#games" className="px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">{en ? 'Play now' : '开始玩'}</Link>
        </nav>
      </header>
      {children}
      <SiteFooter lang={lang} />
    </div>
  );
}
