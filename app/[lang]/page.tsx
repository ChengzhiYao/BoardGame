import type { Metadata } from 'next';
import Link from 'next/link';
import { SEO_GAMES } from '@/lib/seo-content';
import { POSTS } from '@/lib/blog';

export const dynamicParams = false;
export function generateStaticParams() { return [{ lang: 'zh' }, { lang: 'en' }]; }

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const en = params.lang === 'en';
  const title = en ? 'MystNight · AI-hosted tabletop nights for two or more' : '谜夜 MystNight · AI 主持的在线剧本杀 / 克苏鲁 / 海龟汤';
  const description = en
    ? 'One AI engine runs eight tabletop games — murder mystery, Cthulhu, D&D, lateral-thinking soup and more. Two players or a full table, every game generated live.'
    : '一个 AI 引擎跑八种桌游——剧本杀、克苏鲁跑团、海龟汤、D&D 等，两个人就能开局，每局都不一样。';
  return {
    title, description,
    alternates: { canonical: `/${en ? 'en' : 'zh'}`, languages: { 'zh-CN': '/zh', en: '/en' } },
    openGraph: { title, description, url: `/${en ? 'en' : 'zh'}`, type: 'website', siteName: '谜夜 MystNight', locale: en ? 'en_US' : 'zh_CN' },
  };
}

export default function Page({ params }: { params: { lang: string } }) {
  const en = params.lang === 'en';
  const lang = en ? 'en' : 'zh';
  return (
    <main className="max-w-5xl mx-auto px-5">
      <section className="text-center py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl font-serif text-parchment mb-4">{en ? 'AI-hosted tabletop nights' : 'AI 主持的桌游之夜'}</h1>
        <p className="max-w-2xl mx-auto text-parchment/70 leading-relaxed mb-7">
          {en
            ? 'Grab a friend — two people are enough to start. An AI host writes the case, plays the suspects and runs the table: murder mystery, Cthulhu, D&D, lateral-thinking soup, truth or dare, an original card game and clocktower-style social deduction. No two games are ever the same.'
            : '叫上朋友，两个人就能开局。AI 当主持人，现场为你们编一场只属于今晚的游戏：剧本杀、克苏鲁跑团、D&D、海龟汤、真心话大冒险、原创卡牌、血染钟楼式社交推理——每一局都不一样。'}
        </p>
        <Link href="/#games" className="inline-block px-7 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">{en ? '▶ Play now' : '▶ 开始玩'}</Link>
      </section>

      <section className="grid sm:grid-cols-2 gap-4 pb-10">
        {SEO_GAMES.map((g) => {
          const t = en ? g.en : g.zh;
          return (
            <Link key={g.slug} href={`/games/${g.slug}`} className="block rounded-xl border border-eldritch/25 bg-fog/40 hover:bg-fog/70 hover:border-eldritch/50 transition p-5">
              <div className="font-mono text-[10px] tracking-[.18em] uppercase text-eldritch/80 mb-1.5">{t.players} · {t.time}</div>
              <h2 className="font-serif text-xl text-parchment mb-1.5">{t.name}</h2>
              <p className="text-parchment/65 text-sm leading-relaxed">{t.tagline}</p>
              <span className="inline-block mt-3 text-eldritch text-sm">{en ? 'View details →' : '查看详情 →'}</span>
            </Link>
          );
        })}
      </section>

      <section className="pb-6">
        <h2 className="font-serif text-2xl text-parchment mb-4">{en ? 'From the blog' : '博客文章'}</h2>
        <div className="space-y-3">
          {POSTS.map((p) => {
            const t = en ? p.en : p.zh;
            return (
              <Link key={p.slug} href={`/${lang}/blog/${p.slug}`} className="block rounded-lg border border-eldritch/20 bg-fog/30 hover:bg-fog/60 transition p-4">
                <div className="text-parchment font-medium">{t.title}</div>
                <div className="text-parchment/55 text-sm mt-1">{t.excerpt}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
