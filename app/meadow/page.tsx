'use client';
// 童话草原 · 出生测试闭环：介绍 → 22 题 → 揭晓你是哪种动物。
import { useState } from 'react';
import Link from 'next/link';
import { QUESTIONS } from '@/lib/meadow/persona';
import { SPECIES, ATTR_ZH, DIET_ZH, type Attr, type Diet } from '@/lib/meadow/data';
import { ensureSession } from '@/lib/auth';

type Phase = 'intro' | 'test' | 'loading' | 'result';

export default function MeadowPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<any>(null);
  const [reveal, setReveal] = useState('');
  const [species, setSpecies] = useState<any>(null);
  const [err, setErr] = useState('');

  function startTest() {
    setAnswers(new Array(QUESTIONS.length).fill(null));
    setIdx(0); setErr(''); setPhase('test');
  }

  function answer(choice: number | null) {
    const next = answers.slice();
    next[idx] = choice;
    setAnswers(next);
    if (idx + 1 >= QUESTIONS.length) submit(next);
    else setIdx(idx + 1);
  }

  async function submit(finalAnswers: (number | null)[]) {
    setPhase('loading'); setErr('');
    try {
      await ensureSession();
      const notable: string[] = [];
      finalAnswers.forEach((c, i) => {
        if (c !== null && notable.length < 5 && [0, 2, 7, 15, 21].includes(i)) notable.push(QUESTIONS[i].opts[c].zh);
      });
      const res = await fetch('/api/meadow/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers, notable }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '出错了');
      setResult(d.result); setReveal(d.reveal || ''); setSpecies(d.species); setPhase('result');
    } catch (e: any) { setErr(e.message); setPhase('test'); }
  }

  if (phase === 'intro') {
    const groups: [Diet, string][] = [['herbivore', '草食 · 猎物'], ['omnivore', '杂食'], ['carnivore', '肉食 · 猎手']];
    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-16 gap-8">
        <div className="w-full max-w-3xl text-center flex flex-col items-center gap-4">
          <div className="text-5xl">🌾🦊🐇🦉</div>
          <h1 className="text-3xl sm:text-5xl font-serif text-parchment">童话草原</h1>
          <p className="text-parchment/70 max-w-xl leading-relaxed">一本旧童话书里的小草原。动物都会说话——可童话不等于无害：狐狸真的会吃掉兔子，寒冬真的会饿死田鼠。</p>
          <p className="text-parchment/55 max-w-xl leading-relaxed text-sm">先做一份动物人格测试，命运会按你的性子，把你生成草原上的一种动物。</p>
        </div>
        <div className="w-full max-w-3xl space-y-5">
          {groups.map(([diet, title]) => (
            <div key={diet}>
              <div className="text-xs tracking-widest uppercase mb-2 text-eldritch">{title}</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SPECIES.filter((s) => s.diet === diet).map((s) => (
                  <div key={s.key} className="rounded-lg border border-eldritch/25 bg-fog/40 p-2 flex flex-col items-center gap-0.5 text-center">
                    <span className="text-2xl">{s.emoji}</span>
                    <span className="text-parchment text-xs font-serif">{s.zh}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={startTest} className="px-8 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">开始测试 · 22 题</button>
        {err && <p className="text-blood text-sm">{err}</p>}
        <Link href="/" className="text-parchment/40 hover:text-parchment text-sm underline">← 返回首页</Link>
      </main>
    );
  }

  if (phase === 'test') {
    const q = QUESTIONS[idx];
    const pct = Math.round((idx / QUESTIONS.length) * 100);
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-6">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between text-xs text-parchment/50 mb-2">
            <span>第 {idx + 1} / {QUESTIONS.length} 题</span>
            {idx > 0 && <button onClick={() => setIdx(idx - 1)} className="underline hover:text-parchment">上一题</button>}
          </div>
          <div className="h-1.5 rounded-full bg-fog overflow-hidden mb-6"><div className="h-full bg-eldritch" style={{ width: pct + '%' }} /></div>
          <h2 className="text-xl font-serif text-parchment mb-5 leading-relaxed">{q.zh}</h2>
          <div className="flex flex-col gap-2.5">
            {q.opts.map((o, j) => (
              <button key={j} onClick={() => answer(j)}
                className="text-left px-4 py-3 rounded-lg bg-fog border border-eldritch/30 text-parchment/85 hover:border-eldritch hover:bg-eldritch/15 transition">
                {o.zh}
              </button>
            ))}
            <button onClick={() => answer(null)} className="text-center px-4 py-2 rounded-lg text-parchment/40 hover:text-parchment/70 text-sm">跳过本题（交给命运）</button>
          </div>
        </div>
        {err && <p className="text-blood text-sm">{err}</p>}
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 text-center">
        <div className="text-5xl animate-pulse">🌙</div>
        <p className="text-parchment/70 font-serif">命运正在翻动书页，决定你将醒来成为谁……</p>
      </main>
    );
  }

  const sp = species || {};
  const topAttrs = result ? (Object.keys(result.attributes) as Attr[]).sort((a, b) => result.attributes[b] - result.attributes[a]).slice(0, 4) : [];
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 gap-6">
      <div className="w-full max-w-xl rounded-2xl border border-eldritch/30 bg-fog/40 p-7 flex flex-col items-center gap-4 text-center">
        <div className="text-7xl">{sp.emoji}</div>
        <div className="font-serif text-2xl text-parchment">你醒来，成为一只 {sp.zh}</div>
        <div className="text-xs tracking-widest uppercase text-eldritch">{result ? DIET_ZH[result.diet as Diet] : ''}</div>
        <p className="text-parchment/80 leading-relaxed whitespace-pre-line text-sm">{reveal || '草原的风掀起书页，你睁开了眼睛。'}</p>
        {result?.traits?.length ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {result.traits.map((tn: string) => (
              <span key={tn} className="px-3 py-1 rounded-full bg-eldritch/25 border border-eldritch/40 text-parchment/80 text-xs">{tn}</span>
            ))}
          </div>
        ) : null}
        {topAttrs.length ? (
          <div className="w-full grid grid-cols-2 gap-2 mt-2">
            {topAttrs.map((k) => (
              <div key={k} className="flex items-center justify-between text-sm bg-ink/40 rounded px-3 py-1.5">
                <span className="text-parchment/60">{ATTR_ZH[k]}</span>
                <span className="text-parchment font-mono">{result.attributes[k]}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-parchment/45 text-sm max-w-md text-center">（草原世界还在搭建中——很快你就能真正在这片草原上觅食、躲藏、繁衍、活下去。）</p>
      <div className="flex gap-3">
        <button onClick={() => setPhase('intro')} className="px-6 py-2.5 rounded bg-fog border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20 text-sm">再活一次（重测）</button>
        <Link href="/" className="px-6 py-2.5 rounded bg-fog border border-parchment/20 text-parchment/60 text-sm">返回首页</Link>
      </div>
    </main>
  );
}
