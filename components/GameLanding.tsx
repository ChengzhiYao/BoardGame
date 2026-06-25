'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { seoGame, type Loc } from '@/lib/seo-content';
import { getClientLang, setClientLang, type Lang } from '@/lib/i18n';
import GameFeedback from './GameFeedback';

export default function GameLanding({ slug }: { slug: string }) {
  const g = seoGame(slug);
  const [lang, setLang] = useState<Lang>('zh');
  useEffect(() => { setLang(getClientLang()); }, []);
  if (!g) return null;
  const en = lang === 'en';
  const t: Loc = en ? g.en : g.zh;
  const switchLang = (l: Lang) => { setLang(l); setClientLang(l); };
  const playLabel = en ? `▶ Play ${t.name}` : `▶ 开始${t.name.replace(/（.*?）|\(.*?\)/, '')}`;

  return (
    <main className="min-h-screen text-parchment">
      <header className="max-w-4xl mx-auto flex items-center justify-between px-5 py-4">
        <Link href="/" className="font-serif text-xl text-parchment">谜夜<span className="text-blood">.</span><span className="text-parchment/40 text-sm ml-1.5">MystNight</span></Link>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full overflow-hidden border border-eldritch/30 text-xs">
            {(['zh', 'en'] as const).map((l) => <button key={l} onClick={() => switchLang(l)} className={`px-3 py-1.5 ${lang === l ? 'bg-eldritch/50 text-parchment' : 'bg-fog/60 text-parchment/50 hover:text-parchment'}`}>{l === 'zh' ? '中' : 'EN'}</button>)}
          </div>
          <Link href="/#games" className="px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm border border-blood">{en ? 'Enter app' : '进入游戏'}</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 pb-20">
        <nav className="text-xs text-parchment/40 mb-5"><Link href="/" className="hover:text-parchment">{en ? 'Home' : '首页'}</Link> / <span className="text-parchment/60">{t.name}</span></nav>
        <div className="font-mono text-[11px] tracking-[.2em] uppercase text-eldritch/80 mb-3">{t.players} · {t.time}</div>
        <h1 className="text-3xl sm:text-4xl font-serif text-parchment leading-tight mb-3">{t.name}</h1>
        <p className="text-lg text-parchment/70 mb-6">{t.tagline}</p>

        <div className="rounded-xl border border-eldritch/30 overflow-hidden bg-ink mb-8 shadow-2xl">
          <iframe src={`/screens.html#${g.gm}`} title={t.name} loading="lazy" scrolling="no" className="w-full block pointer-events-none" style={{ aspectRatio: '1180 / 720' }} />
        </div>

        <p className="text-parchment/85 leading-relaxed mb-9">{t.intro}</p>

        <h2 className="font-serif text-xl text-parchment mb-3">{en ? 'How it plays' : '怎么玩'}</h2>
        <ol className="space-y-2 mb-9">
          {t.play.map((p, i) => <li key={i} className="flex gap-3 text-parchment/80 leading-snug"><span className="font-mono text-eldritch shrink-0">{String(i + 1).padStart(2, '0')}</span><span>{p}</span></li>)}
        </ol>

        <h2 className="font-serif text-xl text-parchment mb-3">{en ? 'Why it is good' : '为什么好玩'}</h2>
        <p className="text-parchment/80 leading-relaxed mb-9">{t.why}</p>

        <h2 className="font-serif text-xl text-parchment mb-3">{en ? 'FAQ' : '常见问题'}</h2>
        <div className="space-y-4 mb-10">
          {t.faq.map((f, i) => (<div key={i}><div className="text-parchment font-medium mb-1">{f.q}</div><div className="text-parchment/65 text-sm leading-relaxed">{f.a}</div></div>))}
        </div>

        <div className="flex gap-3 flex-wrap mb-14">
          <Link href="/#games" className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">{playLabel}</Link>
          <Link href="/" className="px-6 py-3 rounded bg-fog border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20">{en ? 'All games' : '看全部游戏'}</Link>
        </div>

        <GameFeedback slug={slug} en={en} />
      </article>
    </main>
  );
}
