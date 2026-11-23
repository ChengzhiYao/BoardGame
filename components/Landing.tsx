'use client';
// 落地页（给还没开过局的人）：先让他亲手试一碗海龟汤，再说为什么不一样、有什么玩法、要不要钱。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { type Lang } from '@/lib/i18n';
import Narration from '@/components/Narration';
import { TILE, ORDER, PricingStrip } from '@/components/HomeHub';
import { type GM } from '@/components/GameShowcase';
import { FREE_MODES } from '@/lib/pricing';
import { useIntroVoice } from '@/lib/useIntroVoice';

type Bi = { zh: string; en: string };
const L = (lang: Lang, b: Bi) => (lang === 'en' ? b.en : b.zh);

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { threshold: 0.18 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`${className} transition-all duration-[900ms] ease-out ${on ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

const Over = ({ children }: { children: ReactNode }) => <div className="text-[10.5px] sm:text-[11px] tracking-[.45em] pl-[.45em] uppercase text-[#c9a96e]/75">{children}</div>;

// ---------- 1. 第一屏 ----------
export function LandingHero({ lang, busy, onPlay, onMore, name, setName, needName }: { lang: Lang; busy: boolean; onPlay: () => void; onMore: () => void; name: string; setName: (v: string) => void; needName: boolean }) {
  const en = lang === 'en';
  return (
    <section className="relative w-full min-h-[100svh] flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
      <Reveal><Over>{en ? 'MystNight · AI-hosted mysteries' : 'MystNight · 谜夜'}</Over></Reveal>
      <Reveal delay={150}>
        <h1 className="mt-5 font-serif font-semibold text-[34px] leading-[1.35] sm:text-[56px] sm:leading-[1.25] tracking-[.04em] text-[#efe6d2] [text-shadow:0_2px_40px_rgba(0,0,0,.85)]">
          {en ? <>Tonight, an AI writes<br />a mystery that happens<br />only once.</> : <>今晚，<br />AI 为你们编一个<br />只发生一次的谜。</>}
        </h1>
      </Reveal>
      <Reveal delay={350}>
        <p className="mt-5 max-w-md mx-auto font-serif text-[15px] sm:text-[17px] leading-[1.9] text-parchment/75 [text-shadow:0_1px_14px_rgba(0,0,0,.9)]">
          {en ? 'Murder mysteries, lateral puzzles, Cthulhu nights — the host is AI and the story is made up live. Bring one friend, or come alone.' : '剧本杀、海龟汤、克苏鲁……主持人是 AI，故事是现场编的。叫上一个朋友，或者一个人来。'}
        </p>
      </Reveal>
      <Reveal delay={550} className="w-full max-w-xs mx-auto mt-8">
        <button onClick={onPlay} disabled={busy}
          className="w-full py-4 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.18em] text-[17px] shadow-[0_14px_50px_-12px_rgba(125,29,29,.85)] disabled:opacity-60">
          {busy ? (en ? 'Setting the table…' : '正在摆好桌子…') : (en ? 'Play free now' : '免费开一局')}
        </button>
        <div className="mt-3 text-[12px] tracking-[.12em] text-parchment/50">{en ? 'One-tap Google sign-in · free · no download' : 'Google 一键登录 · 免费 · 不用下载'}</div>
      </Reveal>
      <button onClick={onMore} className="mt-12 flex flex-col items-center gap-1.5 text-[11px] tracking-[.3em] text-parchment/45 hover:text-parchment/80">
        {en ? 'TRY ONE HERE' : '先在这里试一碗'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="animate-bounce"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </section>
  );
}

// ---------- 2. 试玩：一碗原创海龟汤（写好的剧本，不调用 AI） ----------
const DEMO = {
  surface: {
    zh: '他每天晚上九点，都会给隔壁打一个电话。\n\n**响三声，就挂。**\n\n十二年，从没断过。直到那天晚上——电话被接起来了。\n\n他听了两秒，挂掉，[[嘟——]]\n\n然后报了警。',
    en: 'Every night at nine, he called the house next door.\n\n**Three rings, then he hung up.**\n\nTwelve years, never missed. Until one night — someone picked up.\n\nHe listened for two seconds, hung up. [[click]]\n\nThen he called the police.',
  },
  qs: [
    { q: { zh: '接电话的是隔壁住的人吗？', en: 'Was it the neighbour who answered?' }, a: { zh: '不是。', en: 'No.' } },
    { q: { zh: '响三声挂断，是他们之间的约定？', en: 'Were the three rings a signal between them?' }, a: { zh: '是。这很关键。', en: 'Yes. That matters.' } },
    { q: { zh: '隔壁住的是一位老人？', en: 'Is the neighbour elderly?' }, a: { zh: '是。', en: 'Yes.' } },
    { q: { zh: '他是在讨债？', en: 'Was he chasing a debt?' }, a: { zh: '无关。', en: 'Irrelevant.' } },
    { q: { zh: '接电话的人不该在那里？', en: 'Should the person who answered not have been there?' }, a: { zh: '是。', en: 'Yes.' } },
  ],
  truth: {
    zh: '隔壁住着一位独居的老太太。\n\n他们约好：每晚九点他打过去，**响三声就挂**——意思是「我在，你也好好的」。老太太听见铃声就够了，十二年，从来不接。\n\n那天，电话被接起来了。\n\n((听筒里，是一个陌生男人在喘气。))',
    en: 'Next door lived an old woman, alone.\n\nTheir deal: every night at nine he would call, **let it ring three times, and hang up** — meaning "I’m here, and you’re fine." Hearing it was enough. For twelve years she never picked up.\n\nThat night, someone did.\n\n((On the line, a strange man was breathing.))',
  },
};

export function LandingDemo({ lang, onPlay, busy }: { lang: Lang; onPlay: () => void; busy: boolean }) {
  const en = lang === 'en';
  const [asked, setAsked] = useState<number[]>([]);
  const [typing, setTyping] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const v = useIntroVoice();
  const [which, setWhich] = useState<'demo_surface' | 'demo_truth' | null>(null);
  const listen = (k: 'demo_surface' | 'demo_truth') => { if (which === k && v.state !== 'idle') { v.stop(); setWhich(null); return; } setWhich(k); v.play(k, en ? 'en' : 'zh'); };
  const ListenBtn = ({ k }: { k: 'demo_surface' | 'demo_truth' }) => (
    <button onClick={() => listen(k)} className="ml-4 mt-2 inline-flex items-center gap-2 text-[12px] text-[#c9a96e] hover:text-[#e0c48c]">
      {which === k && v.state === 'loading' ? <span className="w-3 h-3 rounded-full border-2 border-[#c9a96e]/30 border-t-[#c9a96e] animate-spin" />
        : which === k && v.state === 'playing' ? <span className="flex items-end gap-[2px] h-3">{[0, 1, 2].map((x) => <span key={x} className="w-[2px] rounded-full bg-[#c9a96e] mn-eq" style={{ animationDelay: `${x * 0.15}s`, animationDuration: '.6s' }} />)}</span>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" /></svg>}
      {which === k && v.state === 'playing' ? (en ? 'Stop' : '停止') : (en ? 'Hear the host read it' : '听主持人读')}
    </button>
  );
  useEffect(() => { const b = boxRef.current; if (b) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); }, [asked, typing, revealed]);
  function ask(i: number) {
    if (typing !== null || asked.includes(i)) return;
    setAsked((a) => [...a, i]); setTyping(i);
    setTimeout(() => setTyping(null), 900);
  }
  const left = DEMO.qs.map((_, i) => i).filter((i) => !asked.includes(i));
  return (
    <section id="demo" className="w-full max-w-xl mx-auto px-5 py-20 sm:py-28">
      <Reveal className="text-center">
        <Over>{en ? 'Try it — right here' : '先尝一口'}</Over>
        <h2 className="mt-3 font-serif font-semibold text-[26px] sm:text-[34px] tracking-wide text-[#efe6d2]">{en ? 'A lateral puzzle' : '一碗海龟汤'}</h2>
        <p className="mt-2 text-[14px] text-parchment/55">{en ? 'Ask yes/no questions. The host only answers yes, no, or irrelevant.' : '只能问是非题。主持人只会回答：是、不是、无关。'}</p>
      </Reveal>
      <Reveal delay={150} className="mt-8">
        <div className="rounded-2xl border border-[#d8c7a8]/[0.14] bg-[#0b0c0f]/75 backdrop-blur-md shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#d8c7a8]/[0.08] text-[11px] tracking-[.25em] text-parchment/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a96e] animate-pulse" />{en ? 'LIVE · LATERAL SOUP' : '海龟汤 · 进行中'}
          </div>
          <div ref={boxRef} className="max-h-[62vh] overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
            <div><Narration text={L(lang, DEMO.surface)} lang={lang} fresh collapse={false} label={en ? 'The surface' : '汤面'} /><ListenBtn k="demo_surface" /></div>
            {asked.map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end"><span className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#7d1d1d]/40 border border-[#a83232]/30 text-[14px] text-parchment/90">{L(lang, DEMO.qs[i].q)}</span></div>
                <div className="flex justify-start">
                  <span className="px-3.5 py-2 rounded-2xl rounded-bl-md bg-white/[0.05] border border-[#d8c7a8]/10 font-serif text-[15px] text-[#efe6d2]">
                    {typing === i ? <span className="inline-flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-parchment/50 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}</span> : L(lang, DEMO.qs[i].a)}
                  </span>
                </div>
              </div>
            ))}
            {revealed && <div><Narration text={L(lang, DEMO.truth)} lang={lang} fresh collapse={false} tone="reveal" label={en ? 'The truth' : '汤底'} /><ListenBtn k="demo_truth" /></div>}
          </div>
          <div className="border-t border-[#d8c7a8]/[0.08] px-4 py-3.5">
            {!revealed ? (<>
              <div className="flex flex-wrap gap-2">
                {left.slice(0, 3).map((i) => (
                  <button key={i} onClick={() => ask(i)} disabled={typing !== null}
                    className="px-3 py-2 rounded-full border border-[#d8c7a8]/18 bg-white/[0.03] text-[13px] text-parchment/85 hover:border-[#c9a96e]/50 text-left disabled:opacity-50">{L(lang, DEMO.qs[i].q)}</button>
                ))}
              </div>
              {asked.length >= 2 && (
                <button onClick={() => { setRevealed(true); if (which === 'demo_surface' && v.state !== 'idle') { setWhich('demo_truth'); v.play('demo_truth', en ? 'en' : 'zh'); } }} className="mt-3 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{en ? 'I think I know — reveal the truth' : '我想到了，揭晓汤底'}</button>
              )}
            </>) : (
              <div className="text-center py-1">
                <div className="font-serif text-[15px] text-parchment/80">{en ? 'That was a scripted taste. Real games are made up live — and never repeat.' : '这一碗是写好的。真正开局时，每一碗都是 AI 现编的，不会重样。'}</div>
                <button onClick={onPlay} disabled={busy} className="mt-3 px-6 py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.15em] disabled:opacity-60">{busy ? (en ? 'Opening…' : '正在开局…') : (en ? 'Get a real one →' : '来一碗真的 →')}</button>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---------- 3. 为什么不一样 ----------
export function LandingWhy({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const items: { t: Bi; d: Bi }[] = [
    { t: { zh: '两个人，也能开一整桌', en: 'Two people can fill a whole table' }, d: { zh: '剧本杀缺人、跑团没主持？AI 当主持人，还会扮演所有空出来的角色——会撒谎，会甩锅，会栽赃你。', en: 'No host, not enough players? The AI runs the game and plays every empty seat — it lies, deflects, and frames you.' } },
    { t: { zh: '没有剧本，所以剧透不了', en: 'No script, so no spoilers' }, d: { zh: '每一局的案子、谜底、结局都在你们开局那一刻才生成。网上搜不到答案。', en: 'Every case, every answer, every ending is generated the moment you start. You can’t google it.' } },
    { t: { zh: '它会讲故事', en: 'It performs' }, d: { zh: '旁白有语气、会压低声音、会突然大喊；配乐跟着剧情变，该安静的时候安静，该吓你的时候吓你。', en: 'The narrator whispers and shouts; the music follows the story — quiet when it should be, sudden when it wants to scare you.' } },
  ];
  return (
    <section className="w-full max-w-xl mx-auto px-6 py-16 sm:py-24">
      <Reveal className="text-center"><Over>{en ? 'Why it’s different' : '为什么不一样'}</Over></Reveal>
      <div className="mt-10 space-y-12">
        {items.map((it, i) => (
          <Reveal key={i} delay={i * 120} className="flex gap-5 text-left">
            <span className="font-serif text-[40px] leading-none text-[#c9a96e]/55 w-8 shrink-0">{i + 1}</span>
            <div>
              <h3 className="font-serif font-semibold text-[20px] sm:text-[23px] text-[#efe6d2] leading-snug">{L(lang, it.t)}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.85] text-parchment/65">{L(lang, it.d)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------- 4. 玩法海报（横滑） ----------
const HOOK: Record<GM, Bi> = {
  soup: { zh: '「一个男人点了一碗海龟汤，喝了一口，就自杀了。」你只能问是非题。', en: 'A strange story. A hidden truth. You may only ask yes or no.' },
  jbs: { zh: '五个人，一具尸体，一个凶手。其中四个是 AI，它们每一个都在说谎。', en: 'Five suspects, one body, one killer. Four of them are AI — and all of them lie.' },
  coc: { zh: '你翻开日记的最后一页。你的理智，掉了 6 点。', en: 'You turn to the diary’s last page. You lose 6 sanity.' },
  botc: { zh: '天亮了。昨晚，有人死了。恶魔就坐在你们中间。', en: 'Dawn. Someone died last night. The demon is sitting among you.' },
  dnd: { zh: 'd20 掷出 1。你的剑，飞进了龙的嘴里。', en: 'Natural 1. Your sword flies straight into the dragon’s mouth.' },
  story: { zh: '关上灯。AI 给你读一个今晚才写出来的故事。', en: 'Lights off. The AI reads you a story written tonight.' },
  td: { zh: '它知道你们是谁、在哪、能玩多大。然后出一道刚刚好的题。', en: 'It knows who’s here and how far you’ll go — then asks exactly the right question.' },
  mcc: { zh: '抽到诅咒猫，你就出局。除非，你手里还有护符。', en: 'Draw the cursed cat and you’re out. Unless you still hold a charm.' },
  market: { zh: '买下你的朋友，抬高他的身价，再高价卖掉。', en: 'Buy your friend, pump their price, sell them high.' },
};

export function LandingGames({ lang, onPick }: { lang: Lang; onPick: (g: GM) => void }) {
  const en = lang === 'en';
  return (
    <section id="games" className="w-full py-16 sm:py-24">
      <Reveal className="text-center px-6">
        <Over>{en ? 'Nine ways to spend the night' : '九种过夜的方式'}</Over>
        <h2 className="mt-3 font-serif font-semibold text-[26px] sm:text-[34px] tracking-wide text-[#efe6d2]">{en ? 'Pick tonight’s game' : '今晚玩什么'}</h2>
      </Reveal>
      <Reveal delay={150}>
        <div className="mt-8 flex gap-3.5 overflow-x-auto snap-x snap-mandatory px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center sm:flex-wrap sm:overflow-visible">
          {ORDER.map((k) => {
            const t = TILE[k]; const free = FREE_MODES.includes(k);
            return (
              <button key={k} onClick={() => onPick(k)}
                className="snap-center shrink-0 w-[72vw] max-w-[280px] sm:w-[260px] h-[250px] sm:h-[260px] rounded-2xl text-left p-5 flex flex-col border border-[#d8c7a8]/[0.13] bg-gradient-to-b from-[#15161b]/85 to-[#0b0c0f]/90 backdrop-blur-md hover:border-[#c9a96e]/45 transition-colors">
                <div className="flex items-center justify-between">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-[#c9a96e]/80">{t.icon}</svg>
                  <span className={`text-[10.5px] tracking-[.15em] ${free ? 'text-[#9fbf9f]/85' : 'text-[#c9a96e]/85'}`}>{free ? (en ? 'FREE' : '免费') : (en ? '✦ PREMIUM' : '✦ 豪华')}</span>
                </div>
                <div className="mt-auto">
                  <div className="font-serif font-semibold text-[24px] text-[#efe6d2] leading-tight">{L(lang, t.short)}</div>
                  <p className="mt-2.5 font-serif text-[14px] leading-[1.75] text-parchment/65">{L(lang, HOOK[k])}</p>
                  <div className="mt-4 text-[12px] tracking-[.15em] text-[#c9a96e]">{en ? 'PLAY →' : '开一局 →'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

// ---------- 5. 真实数字 + 价格 + 常见问题 + 结尾 ----------
export function LandingProof({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const [s, setS] = useState<{ moves: number; lines: number; games: number } | null>(null);
  useEffect(() => { fetch('/api/public/stats').then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s || !s.moves) return null;
  const fmt = (n: number) => n.toLocaleString(en ? 'en-US' : 'zh-CN');
  const cells: [string, string][] = [
    [`${fmt(s.moves)}+`, en ? 'questions & moves from players' : '次玩家提问与行动'],
    [`${fmt(s.lines)}+`, en ? 'lines narrated by the AI host' : '段 AI 主持人的旁白'],
    [`${fmt(s.games)}+`, en ? 'nights played' : '个被玩完的夜晚'],
  ];
  return (
    <section className="w-full max-w-2xl mx-auto px-6 py-12">
      <Reveal className="grid grid-cols-3 gap-3 text-center">
        {cells.map(([n, l], i) => (
          <div key={i}>
            <div className="font-serif font-semibold text-[24px] sm:text-[34px] text-[#efe6d2]">{n}</div>
            <div className="mt-1 text-[11.5px] sm:text-[13px] text-parchment/50 leading-snug">{l}</div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

export function LandingFaq({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const qa: [Bi, Bi][] = [
    [{ zh: '要下载吗？要注册吗？', en: 'Do I need to download or sign up?' }, { zh: '不用下载，手机、电脑打开网页就能玩。用 Google 或邮箱一键登录就行，免费，你的每一局都会帮你存好。', en: 'No download — it runs in your browser. Sign in with Google or email in one tap; it’s free and your games are saved.' }],
    [{ zh: '一个人能玩吗？', en: 'Can I play alone?' }, { zh: '能。AI 会补齐所有空位。想和朋友玩，开局后把链接发给他就行。', en: 'Yes — the AI fills every empty seat. To play with a friend, just send them the link.' }],
    [{ zh: '收费吗？', en: 'Is it free?' }, { zh: '海龟汤、真心话、猫诅咒、身价场每周免费玩 2 小时；剧本杀、跑团等豪华玩法新号送 2 局。', en: 'Lateral Soup, Truth or Dare, Cat Curse and the Market are free for 2 hours a week; new accounts get 2 premium games.' }],
  ];
  return (
    <section className="w-full max-w-xl mx-auto px-6 py-12 space-y-8">
      <Reveal><PricingStrip lang={lang} /></Reveal>
      <Reveal delay={120} className="divide-y divide-[#d8c7a8]/[0.08] border-y border-[#d8c7a8]/[0.08]">
        {qa.map(([q, a], i) => (
          <details key={i} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="list-none cursor-pointer flex items-center justify-between font-serif text-[16px] text-[#ece3cf]">{L(lang, q)}<span className="text-parchment/40 transition-transform group-open:rotate-45 text-xl leading-none">+</span></summary>
            <p className="mt-2.5 text-[14px] leading-[1.8] text-parchment/60">{L(lang, a)}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}

export function LandingFinal({ lang, busy, onPlay }: { lang: Lang; busy: boolean; onPlay: () => void }) {
  const en = lang === 'en';
  return (
    <section className="w-full max-w-xl mx-auto px-6 pt-10 pb-24 text-center">
      <Reveal>
        <h2 className="font-serif font-semibold text-[28px] sm:text-[38px] leading-snug text-[#efe6d2]">{en ? <>The table is set.<br />Who’s coming tonight?</> : <>桌子已经摆好了。<br />今晚，谁来？</>}</h2>
        <button onClick={onPlay} disabled={busy}
          className="mt-8 w-full max-w-xs py-4 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.18em] text-[17px] shadow-[0_14px_50px_-12px_rgba(125,29,29,.85)] disabled:opacity-60">
          {busy ? (en ? 'Setting the table…' : '正在摆好桌子…') : (en ? 'Play free now' : '免费开一局')}
        </button>
        <div className="mt-3 text-[12px] tracking-[.12em] text-parchment/45">{en ? '30 seconds to your first question' : '30 秒后，你就能问出第一个问题'}</div>
      </Reveal>
    </section>
  );
}
