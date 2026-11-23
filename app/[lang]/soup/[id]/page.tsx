import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSoup, listSoups, tagsOf } from '@/lib/soupLib';
import SiteFooter from '@/components/SiteFooter';
import PlaySoupButton from '@/components/PlaySoupButton';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { lang: string; id: string } }): Promise<Metadata> {
  const lang = params.lang === 'en' ? 'en' : 'zh'; const en = lang === 'en';
  const p = await getSoup(lang, params.id);
  if (!p) return {};
  const title = en ? `${p.title} — lateral thinking puzzle${p.bottom ? ' with answer' : ''}` : `海龟汤《${p.title}》${p.bottom ? '题目及答案' : '题目'}`;
  const description = p.surface.slice(0, 150);
  return { title: { absolute: `${title} · 谜夜 MystNight` }, description, alternates: { canonical: `/${lang}/soup/${p.id}` }, openGraph: { title, description, type: 'article', url: `/${lang}/soup/${p.id}` } };
}

export default async function SoupPage({ params }: { params: { lang: string; id: string } }) {
  const lang = params.lang === 'en' ? 'en' : 'zh'; const en = lang === 'en';
  const p = await getSoup(lang, params.id);
  if (!p) notFound();
  const all = await listSoups(lang);
  const i = all.findIndex((x) => x.id === p.id);
  const related = [...all.slice(i + 1, i + 5), ...all.slice(0, Math.max(0, 4 - (all.length - i - 1)))].filter((x) => x.id !== p.id).slice(0, 4);
  const url = `${SITE}/${lang}/soup/${p.id}`;
  const jsonld: any[] = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: en ? 'MystNight' : '谜夜', item: `${SITE}/${lang}` },
      { '@type': 'ListItem', position: 2, name: en ? 'Lateral Thinking Puzzles' : '海龟汤题库', item: `${SITE}/${lang}/soup` },
      { '@type': 'ListItem', position: 3, name: p.title, item: url } ] },
  ];
  if (p.bottom) jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: en ? `${p.title}: ${p.surface}` : `海龟汤《${p.title}》：${p.surface}`, acceptedAnswer: { '@type': 'Answer', text: p.bottom } }] });
  return (
    <main className="min-h-screen text-parchment" style={{ background: '#0c0d10' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <article className="max-w-2xl mx-auto px-5 pt-10 pb-8">
        <nav className="text-[12px] text-parchment/45"><Link href={`/${lang}`} className="hover:text-parchment">{en ? 'MystNight' : '谜夜'}</Link> / <Link href={`/${lang}/soup`} className="hover:text-parchment">{en ? 'Lateral Thinking Puzzles' : '海龟汤题库'}</Link></nav>
        <h1 className="mt-4 font-serif font-semibold text-[28px] sm:text-[34px] text-[#efe6d2]">{en ? p.title : `海龟汤：${p.title}`}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">{tagsOf(p, en).map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-parchment/55">{t}</span>)}{p.dailyNo && <span className="text-[11px] px-2 py-0.5 rounded bg-[#8fd3b8]/10 text-[#8fd3b8]">{en ? `Daily Soup #${p.dailyNo}` : `每日一汤第 ${p.dailyNo} 期`}</span>}</div>

        <section className="mt-6 rounded-2xl border border-white/[0.09] bg-[#121318] px-5 py-5">
          <h2 className="text-[11px] tracking-[.35em] text-[#c9a96e]/80">{en ? 'THE PUZZLE' : '汤面'}</h2>
          <p className="mt-3 font-serif text-[17px] leading-[1.95] text-[#efe6d2] whitespace-pre-wrap">{p.surface}</p>
        </section>

        <div className="mt-5"><PlaySoupButton id={p.id} en={en} /></div>
        <p className="mt-2 text-[12.5px] text-parchment/45">{en ? 'Ask yes/no questions; the AI host answers "yes", "no" or "irrelevant" until you crack it. Free, no download.' : '只能问「是 / 不是」的问题，AI 主持人回答「是 / 不是 / 无关」，直到你猜出真相。免费、免下载。'}</p>

        {p.bottom ? (
          <details className="mt-6 rounded-2xl border border-[#7d1d1d]/40 bg-[#1a0f10] px-5 py-4 group">
            <summary className="cursor-pointer list-none text-[14px] text-[#e8b4b4]">{en ? 'Show the answer (spoiler)' : '查看汤底（剧透）'} <span className="text-parchment/35 text-[12px]">▼</span></summary>
            <h2 className="sr-only">{en ? 'Answer' : '汤底答案'}</h2>
            <p className="mt-3 font-serif text-[16px] leading-[1.9] text-parchment/85 whitespace-pre-wrap">{p.bottom}</p>
          </details>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-4 text-[13.5px] leading-[1.8] text-parchment/55">
            {en ? 'The answer isn’t published — it’s still in play. Crack it with the AI host to see the truth. Answers appear here after a puzzle has been a Daily Soup.' : '这道汤的汤底还没公开——它还在题库里轮着出。和 AI 主持人玩一局，猜中就能看到真相；当过「每日一汤」之后，答案会公开在这里。'}
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-serif text-[19px] text-[#efe6d2]">{en ? 'How to play a lateral thinking puzzle' : '海龟汤怎么玩'}</h2>
          <ol className="mt-3 space-y-1.5 text-[14px] leading-[1.8] text-parchment/70 list-decimal pl-5">
            {(en ? ['Read the puzzle (the "soup surface").', 'Ask questions that can be answered yes or no.', 'Use the answers to rebuild the full story.', 'When you think you know, say the whole truth.'] : ['先读汤面：一个看起来说不通的故事。', '只能问能用「是 / 不是」回答的问题。', '根据回答一点点拼出完整经过。', '觉得想通了，就把整件事说出来揭晓。']).map((x) => <li key={x}>{x}</li>)}
          </ol>
        </section>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-[19px] text-[#efe6d2]">{en ? 'More puzzles' : '更多海龟汤'}</h2>
            <ul className="mt-3 space-y-2">{related.map((r) => <li key={r.id}><Link href={`/${lang}/soup/${r.id}`} className="block rounded-xl border border-white/[0.08] bg-[#121318] px-4 py-3 hover:border-[#c9a96e]/40"><span className="font-serif text-[15px] text-[#efe6d2]">{r.title}</span><span className="block text-[12.5px] text-parchment/50 line-clamp-1">{r.surface}</span></Link></li>)}</ul>
            <Link href={`/${lang}/soup`} className="mt-3 inline-block text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{en ? 'All puzzles →' : '全部题目 →'}</Link>
          </section>
        )}
      </article>
      <SiteFooter lang={lang} />
    </main>
  );
}
