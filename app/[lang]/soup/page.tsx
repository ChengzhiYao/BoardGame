import type { Metadata } from 'next';
import Link from 'next/link';
import { listSoups, tagsOf } from '@/lib/soupLib';
import SiteFooter from '@/components/SiteFooter';

export const revalidate = 3600;
export function generateStaticParams() { return [{ lang: 'zh' }, { lang: 'en' }]; }

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const en = params.lang === 'en';
  const title = en ? 'Lateral Thinking Puzzles — 100+ situation puzzles with an AI host' : '海龟汤题目大全 · 100+ 道原创海龟汤（含往期答案）';
  const description = en
    ? 'A growing collection of original lateral thinking (yes/no situation) puzzles. Read the setup, then play it with an AI host that answers yes or no — free, in your browser.'
    : '原创海龟汤题库：本格、变格、恐怖、温情、搞笑都有，往期每日一汤附汤底答案。每道题都能直接和 AI 主持人玩——只能问是非题，猜中才揭晓。免费、免下载。';
  return { title: { absolute: title + ' · 谜夜 MystNight' }, description, keywords: en ? ['lateral thinking puzzles', 'situation puzzles', 'yes no riddles', 'puzzles with answers'] : ['海龟汤', '海龟汤题目', '海龟汤题目及答案', '海龟汤大全', '情境推理', '恐怖海龟汤', '本格海龟汤', '变格海龟汤'],
    alternates: { canonical: `/${params.lang}/soup`, languages: { 'zh-CN': '/zh/soup', en: '/en/soup', 'x-default': '/zh/soup' } },
    openGraph: { title, description, url: `/${params.lang}/soup`, type: 'website' } };
}

export default async function SoupIndex({ params }: { params: { lang: string } }) {
  const lang = params.lang === 'en' ? 'en' : 'zh'; const en = lang === 'en';
  const list = await listSoups(lang);
  const answered = list.filter((p) => p.dailyNo);
  return (
    <main className="min-h-screen text-parchment" style={{ background: '#0c0d10' }}>
      <div className="max-w-3xl mx-auto px-5 pt-10 pb-6">
        <nav className="text-[12px] text-parchment/45"><Link href={`/${lang}`} className="hover:text-parchment">{en ? 'MystNight' : '谜夜'}</Link> / <span>{en ? 'Lateral Thinking Puzzles' : '海龟汤题库'}</span></nav>
        <h1 className="mt-4 font-serif font-semibold text-[30px] sm:text-[38px] leading-tight text-[#efe6d2]">{en ? 'Lateral Thinking Puzzles' : '海龟汤题目大全'}</h1>
        <p className="mt-3 text-[15px] leading-[1.9] text-parchment/70">
          {en ? `${list.length} original situation puzzles written for MystNight. Each one is a strange story with a hidden truth. Read the setup, then play it with our AI host: you may only ask yes/no questions, and the answer is revealed when you crack it. Past Daily Soup puzzles show their answers.`
            : `这里收录了谜夜的 ${list.length} 道原创海龟汤。每道题都是一个诡异的小故事，背后藏着一个真相。你可以先看汤面，再点「和 AI 一起玩」：AI 主持人只回答「是 / 不是 / 无关」，你问到真相为止。往期「每日一汤」的题目附汤底答案。`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/daily" className="h-10 px-4 rounded-xl flex items-center bg-[#2f6b5f] border border-[#8fd3b8]/45 text-[#f0faf6] text-[14px]">{en ? 'Today’s Daily Soup →' : '今天的每日一汤 →'}</Link>
          <Link href={`/${lang}/games/lateral-thinking`} className="h-10 px-4 rounded-xl flex items-center border border-white/15 text-parchment/80 text-[14px]">{en ? 'How to play' : '海龟汤怎么玩'}</Link>
        </div>
      </div>

      {answered.length > 0 && (
        <section className="max-w-3xl mx-auto px-5 pb-4">
          <h2 className="font-serif text-[20px] text-[#efe6d2] mb-3">{en ? 'Past Daily Soups (with answers)' : '往期每日一汤（附答案）'}</h2>
          <ul className="grid sm:grid-cols-2 gap-2.5">{answered.map((p) => <Card key={p.id} p={p} lang={lang} />)}</ul>
        </section>
      )}
      <section className="max-w-3xl mx-auto px-5 pb-10">
        <h2 className="font-serif text-[20px] text-[#efe6d2] mb-3 mt-4">{en ? 'All puzzles' : '全部题目'}</h2>
        <ul className="grid sm:grid-cols-2 gap-2.5">{list.filter((p) => !p.dailyNo).map((p) => <Card key={p.id} p={p} lang={lang} />)}</ul>
      </section>
      <SiteFooter lang={lang} />
    </main>
  );
}

function Card({ p, lang }: { p: any; lang: 'zh' | 'en' }) {
  const en = lang === 'en';
  return (
    <li>
      <Link href={`/${lang}/soup/${p.id}`} className="block h-full rounded-xl border border-white/[0.08] bg-[#121318] hover:border-[#c9a96e]/40 px-4 py-3.5">
        <div className="flex items-center gap-2"><span className="font-serif text-[16px] text-[#efe6d2] truncate">{p.title}</span>{p.dailyNo && <span className="shrink-0 text-[10.5px] text-[#8fd3b8]">{en ? `Daily #${p.dailyNo}` : `每日 #${p.dailyNo}`}</span>}</div>
        <p className="mt-1 text-[13px] leading-[1.7] text-parchment/60 line-clamp-2">{p.surface}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{tagsOf(p, en).map((t) => <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded bg-white/[0.05] text-parchment/50">{t}</span>)}</div>
      </Link>
    </li>
  );
}
