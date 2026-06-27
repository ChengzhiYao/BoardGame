'use client';
// 童话草原 · 出生测试 + D&D 式生存世界（输入框→LLM 叙事；离线按性格自动行动）。
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { QUESTIONS } from '@/lib/meadow/persona';
import { SPECIES, ATTR_ZH, DIET_ZH, type Attr, type Diet } from '@/lib/meadow/data';
import { ensureSession } from '@/lib/auth';

type View = 'loading' | 'test' | 'result' | 'world' | 'dead';
const QUICK = [
  { zh: '觅食', text: '我四处觅食，找点能吃的。' },
  { zh: '捕猎', text: '我潜伏起来，伺机捕猎。' },
  { zh: '休息', text: '我找个隐蔽处，歇一会儿、警觉地观察四周。' },
];

export default function MeadowPage() {
  const [view, setView] = useState<View>('loading');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [reveal, setReveal] = useState<any>(null);
  const [species, setSpecies] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [world, setWorld] = useState<any>(null);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [showMig, setShowMig] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  const loadState = useCallback(async () => {
    const res = await fetch('/api/meadow/state'); const d = await res.json(); setWorld(d); return d;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await ensureSession(); } catch {}
      try {
        const d = await loadState();
        if (cancelled) return;
        if (d.character && d.character.status === 'dead') setView('dead');
        else if (d.character) setView('world');
        else setView('test');
      } catch { if (!cancelled) setView('test'); }
    })();
    return () => { cancelled = true; };
  }, [loadState]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [world, sending]);

  function startTest() { setAnswers(new Array(QUESTIONS.length).fill(null)); setIdx(0); setErr(''); setView('test'); }
  function answer(choice: number | null) {
    const next = answers.slice(); next[idx] = choice; setAnswers(next);
    if (idx + 1 >= QUESTIONS.length) submit(next); else setIdx(idx + 1);
  }
  async function submit(finalAnswers: (number | null)[]) {
    setView('loading'); setErr('');
    try {
      await ensureSession();
      const notable: string[] = [];
      finalAnswers.forEach((c, i) => { if (c !== null && notable.length < 5 && [0, 2, 7, 15, 21].includes(i)) notable.push(QUESTIONS[i].opts[c].zh); });
      const res = await fetch('/api/meadow/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: finalAnswers, notable }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '出错了');
      setResult(d.result); setReveal(d.reveal || null); setSpecies(d.species); setView('result');
    } catch (e: any) { setErr(e.message); setView('test'); }
  }
  async function act(text: string) {
    const t = text.trim(); if (!t || sending) return;
    setSending(true); setInput(''); setErr(''); setShowMig(false);
    try {
      const res = await fetch('/api/meadow/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '出错了');
      await loadState();
      if (d.dead) setView('dead');
    } catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  }
  async function enterWorld() { await loadState(); setView('world'); }

  if (view === 'loading') return shell(<div className="flex flex-col items-center gap-4"><div className="text-5xl animate-pulse">🌙</div><p className="text-parchment/70 font-serif">草原的风掀起书页……</p></div>);

  if (view === 'result') {
    const sp = species || {};
    const topA = result ? (Object.keys(result.attributes) as Attr[]).sort((a, b) => result.attributes[b] - result.attributes[a]).slice(0, 4) : [];
    return shell(
      <div className="w-full max-w-xl rounded-2xl border border-eldritch/30 bg-fog/40 p-7 flex flex-col items-center gap-4 text-center">
        <div className="text-7xl">{sp.emoji}</div>
        <div className="font-serif text-2xl text-parchment">你醒来，成为一只 {result?.variant || sp.zh}（{result?.gender === 'male' ? '公' : '母'}）</div>
        <div className="text-xs tracking-widest uppercase text-eldritch">{result ? DIET_ZH[result.diet as Diet] : ''}</div>
        {reveal?.title ? <div className="text-eldritch font-serif text-lg">「{reveal.title}」</div> : null}
        {reveal ? (
          <div className="w-full text-left flex flex-col gap-2.5 text-sm">
            <RevSec label="性格" text={reveal.personality} />
            <RevSec label="思维模式" text={reveal.thinking} />
            <RevSec label="你的锋芒" text={reveal.strength} />
            <RevSec label="你的盲点" text={reveal.shadow} />
            <RevSec label="内心驱动" text={reveal.drive} />
            <RevSec label={'为什么是' + (sp.zh || '它')} text={reveal.why} />
          </div>
        ) : <p className="text-parchment/70 text-sm">草原的风掀起书页，你睁开了眼睛。</p>}
        {result?.traits?.length ? <div className="flex flex-wrap gap-2 justify-center">{result.traits.map((tn: string) => <span key={tn} className="px-3 py-1 rounded-full bg-eldritch/25 border border-eldritch/40 text-parchment/80 text-xs">{tn}</span>)}</div> : null}
        {topA.length ? <div className="w-full grid grid-cols-2 gap-2">{topA.map((k) => <div key={k} className="flex items-center justify-between text-sm bg-ink/40 rounded px-3 py-1.5"><span className="text-parchment/60">{ATTR_ZH[k]}</span><span className="text-parchment font-mono">{result.attributes[k]}</span></div>)}</div> : null}
        <button onClick={enterWorld} className="mt-2 px-8 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">睁开眼睛 · 进入草原 →</button>
      </div>
    );
  }

  if (view === 'dead') {
    const c = world?.character || {};
    return shell(
      <div className="w-full max-w-md rounded-2xl border border-blood/40 bg-fog/40 p-7 flex flex-col items-center gap-4 text-center">
        <div className="text-6xl grayscale">{c.emoji || '🥀'}</div>
        <div className="font-serif text-2xl text-parchment">这一只 {c.variant || c.speciesZh || '动物'} 死了</div>
        <div className="text-parchment/60 text-sm">死因：{c.death_cause || '未知'}</div>
        <p className="text-parchment/55 text-sm">草原合上了这一页。但故事还没结束——命运会再翻开新的一页。</p>
        <button onClick={startTest} className="px-8 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">开始新的一生</button>
        <Link href="/" className="text-parchment/40 hover:text-parchment text-sm underline">← 返回首页</Link>
      </div>
    );
  }

  if (view === 'world') {
    const c = world?.character || {}; const clk = world?.clock || {}; const events = (world?.events || []).slice().reverse();
    const hungerColor = c.hunger >= 80 ? 'bg-rust' : c.hunger >= 50 ? 'bg-amber' : 'bg-green';
    return (
      <main className="h-[100svh] flex flex-col max-w-2xl w-full mx-auto px-4">
        <div className="rounded-xl border border-eldritch/30 bg-fog/40 p-4 mt-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{c.emoji}</span>
            <div className="text-left min-w-0">
              <div className="font-serif text-lg text-parchment truncate">一只 {c.variant || c.speciesZh}（{c.gender === 'male' ? '公' : '母'}）</div>
              <div className="text-xs text-eldritch truncate">{c.diet ? DIET_ZH[c.diet as Diet] : ''} · {c.locationZh} · <span className="text-parchment/45">此处{c.danger}</span></div>
            </div>
            <div className="ml-auto text-right text-[11px] text-parchment/50 shrink-0">{clk.label}</div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-parchment/50 mb-1"><span>饥饿</span><span>{c.hunger}/100</span></div>
            <div className="h-2 rounded-full bg-ink overflow-hidden"><div className={'h-full ' + hungerColor} style={{ width: c.hunger + '%' }} /></div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-2.5">
          {events.map((e: any) => e.kind === 'player'
            ? <div key={e.id} className="flex justify-end"><div className="max-w-[85%] px-3 py-2 rounded-lg bg-blood/20 border border-blood/30 text-parchment/90 text-sm">{e.text}</div></div>
            : <div key={e.id} className={'text-sm leading-relaxed ' + (e.kind === 'death' ? 'text-rust' : e.kind === 'auto' ? 'text-parchment/55 italic' : 'text-parchment/85')}><span className="text-parchment/30 text-[11px] mr-1.5">{e.game_label}</span>{e.text}</div>)}
          {sending && <div className="text-parchment/40 italic text-sm">草原在回应……</div>}
          <div ref={logEnd} />
        </div>

        <div className="pb-3 pt-1 flex flex-col gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => <button key={q.zh} onClick={() => act(q.text)} disabled={sending} className="px-3 py-1 rounded-full text-xs border border-eldritch/30 bg-fog text-parchment/70 hover:border-eldritch disabled:opacity-50">{q.zh}</button>)}
            <button onClick={() => setShowMig((v) => !v)} disabled={sending} className="px-3 py-1 rounded-full text-xs border border-eldritch/30 bg-fog text-parchment/70 hover:border-eldritch disabled:opacity-50">迁徙…</button>
            <Link href="/" className="px-3 py-1 rounded-full text-xs text-parchment/40 hover:text-parchment self-center">首页</Link>
          </div>
          {showMig && (
            <div className="flex flex-wrap gap-2">
              {(world?.locations || []).filter((l: any) => l.key !== c.location).map((l: any) => (
                <button key={l.key} onClick={() => act('我动身前往' + l.zh + '。')} disabled={sending} className="px-3 py-1 rounded-lg text-xs border border-eldritch/25 bg-fog/60 text-parchment/75 hover:border-eldritch disabled:opacity-50">{l.zh} · {l.danger}</button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && act(input)}
              placeholder="你想做什么……（比如：去溪边喝水、爬上橡树看看、伏击一只兔子）" disabled={sending}
              className="flex-1 min-w-0 px-4 py-2.5 rounded-lg bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
            <button onClick={() => act(input)} disabled={sending || !input.trim()} className="px-5 py-2.5 rounded-lg bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-40 shrink-0">{sending ? '…' : '行动'}</button>
          </div>
          {err && <p className="text-blood text-xs text-center">{err}</p>}
        </div>
      </main>
    );
  }

  // ---------- test ----------
  if (answers.length === 0) {
    const groups: [Diet, string][] = [['herbivore', '草食 · 猎物'], ['omnivore', '杂食'], ['carnivore', '肉食 · 猎手']];
    return shell(
      <>
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
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SPECIES.filter((s) => s.diet === diet).map((s) => (
                  <div key={s.key} className="rounded-lg border border-eldritch/25 bg-fog/40 p-2 flex flex-col items-center gap-0.5 text-center">
                    <span className="text-2xl">{s.emoji}</span><span className="text-parchment text-xs font-serif">{s.zh}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={startTest} className="px-8 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">开始测试 · 22 题</button>
        {err && <p className="text-blood text-sm">{err}</p>}
        <Link href="/" className="text-parchment/40 hover:text-parchment text-sm underline">← 返回首页</Link>
      </>
    );
  }
  const q = QUESTIONS[idx]; const pct = Math.round((idx / QUESTIONS.length) * 100);
  return shell(
    <div className="w-full max-w-xl">
      <div className="flex items-center justify-between text-xs text-parchment/50 mb-2">
        <span>第 {idx + 1} / {QUESTIONS.length} 题</span>
        {idx > 0 && <button onClick={() => setIdx(idx - 1)} className="underline hover:text-parchment">上一题</button>}
      </div>
      <div className="h-1.5 rounded-full bg-fog overflow-hidden mb-6"><div className="h-full bg-eldritch" style={{ width: pct + '%' }} /></div>
      <h2 className="text-xl font-serif text-parchment mb-5 leading-relaxed">{q.zh}</h2>
      <div className="flex flex-col gap-2.5">
        {q.opts.map((o, j) => <button key={j} onClick={() => answer(j)} className="text-left px-4 py-3 rounded-lg bg-fog border border-eldritch/30 text-parchment/85 hover:border-eldritch hover:bg-eldritch/15 transition">{o.zh}</button>)}
        <button onClick={() => answer(null)} className="text-center px-4 py-2 rounded-lg text-parchment/40 hover:text-parchment/70 text-sm">跳过本题（交给命运）</button>
      </div>
      {err && <p className="text-blood text-sm mt-3">{err}</p>}
    </div>
  );
}

function RevSec({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg bg-ink/30 border border-eldritch/15 px-3 py-2">
      <div className="text-[11px] tracking-widest uppercase text-eldritch/80 mb-0.5">{label}</div>
      <div className="text-parchment/85 leading-relaxed">{text}</div>
    </div>
  );
}
function shell(inner: any) {
  return <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-8">{inner}</main>;
}
