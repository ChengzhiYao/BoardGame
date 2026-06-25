'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
export default function LangSwitch({ lang }: { lang: 'zh' | 'en' }) {
  const pathname = usePathname() || `/${lang}`;
  const to = (l: 'zh' | 'en') => pathname.replace(/^\/(zh|en)(?=\/|$)/, '/' + l);
  return (
    <div className="flex rounded-full overflow-hidden border border-eldritch/30 text-xs">
      {(['zh', 'en'] as const).map((l) => (
        <Link key={l} href={to(l)} className={`px-3 py-1.5 ${lang === l ? 'bg-eldritch/50 text-parchment' : 'bg-fog/60 text-parchment/50 hover:text-parchment'}`}>{l === 'zh' ? '中' : 'EN'}</Link>
      ))}
    </div>
  );
}
