'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { seoGame, type Loc } from '@/lib/seo-content';
import { useRouter } from 'next/navigation';
import { getClientLang, setClientLang, type Lang } from '@/lib/i18n';
import GameFeedback from './GameFeedback';

export default function GameLanding({ slug, forcedLang }: { slug: string; forcedLang?: Lang }) {
  const router = useRouter();
  const g = seoGame(slug);
  const [lang, setLang] = useState<Lang>(forcedLang || 'zh');
  useEffect(() => { if (!forcedLang) setLang(getClientLang()); }, [forcedLang]);
  if (!g) return null;
  const en = lang === 'en';
  const t: Loc = en ? g.en : g.zh;
  const switchLang = (l: Lang) => { setClientLang(l); if (forcedLang) router.push(`/${l}/games/${slug}`); else setLang(l); };
  const playLabel = en ? `▶ Play ${t.name}` : `▶ 开始${t.name.replace(/（.*?）|\(.*?\)/, '')}`;

  return (
    <main className="min-h-screen text-parchment">
      <header className="max-w-4xl mx-auto flex items-center justify-between px-5 py-4">
        <Link href="/" className="font-serif text-xl text-parchment">谜夜<span className="text-[#e06060]">.</span><span className="text-parchment/40 text-sm ml-1.5">MystNight</span></Link>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full overflow-hidden border border-white/10 text-xs">
            {(['zh', 'en'] as const).map((l) => <button key={l} onClick={() => switchLang(l)} className={`px-3 py-1.5 ${lang === l ? 'bg-white/[0.06] text-parchment' : 'bg-[#121318] text-parchment/50 hover:text-parchment'}`}>{l === 'zh' ? '中' : 'EN'}</button>)}
          </div>
          <Link href="/#games" className="px-4 py-2 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] text-parchment text-sm border border-[#a83232]/60">{en ? 'Enter app' : '进入游戏'}</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 pb-20">
        <nav className="text-xs text-parchment/40 mb-5"><Link href="/" className="hover:text-parchment">{en ? 'Home' : '首页'}</Link> / <span className="text-parchment/60">{t.name}</span></nav>
        <div className="font-mono text-[11px] tracking-[.2em] uppercase text-[#c9a96e] mb-3">{t.players} · {t.time}</div>
        <h1 className="text-3xl sm:text-4xl font-serif text-parchment leading-tight mb-3">{t.name}</h1>
        <p className="text-lg text-parchment/70 mb-6">{t.tagline}</p>

        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0e0f13] mb-8 shadow-2xl">
          <iframe src={`/screens.html#${g.gm}`} title={t.name} loading="lazy" scrolling="no" className="w-full block pointer-events-none" style={{ aspectRatio: '1180 / 720' }} />
        </div>

        <p className="text-parchment/85 leading-relaxed mb-9">{t.intro}</p>

        <h2 className="font-serif text-xl text-parchment mb-3">{en ? 'How it plays' : '怎么玩'}</h2>
        <ol className="space-y-2 mb-9">
          {t.play.map((p, i) => <li key={i} className="flex gap-3 text-parchment/80 leading-snug"><span className="font-mono text-[#c9a96e] shrink-0">{String(i + 1).padStart(2, '0')}</span><span>{p}</span></li>)}
        </ol>

        <h2 className="font-serif text-xl text-parchment mb-3">{en ? 'Why it is good' : '为什么好玩'}</h2>
        <p className="text-parchment/80 leading-relaxed mb-9">{t.why}</p>

        <h2 className="font-serif text-xl text-parchment mb-3">{en ? 'FAQ' : '常见问题'}</h2>
        <div className="space-y-4 mb-10">
          {t.faq.map((f, i) => (<div key={i}><div className="text-parchment font-medium mb-1">{f.q}</div><div className="text-parchment/65 text-sm leading-relaxed">{f.a}</div></div>))}
        </div>

        <div className="flex gap-3 flex-wrap mb-14">
          <Link href="/#games" className="px-6 py-3 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] text-parchment border border-[#a83232]/60">{playLabel}</Link>
          <Link href="/" className="px-6 py-3 rounded-xl bg-[#121318] border border-white/10 text-parchment/80 hover:bg-white/[0.06]">{en ? 'All games' : '看全部游戏'}</Link>
        </div>

        <GameFeedback slug={slug} en={en} />
      </article>
    </main>
  );
}
