'use client';
// 童话草原 · 出生测试 + 生存世界（×10 时钟 / 饥饿 / 觅食·捕猎·休息）。
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { QUESTIONS } from '@/lib/meadow/persona';
import { SPECIES, ATTR_ZH, DIET_ZH, type Attr, type Diet } from '@/lib/meadow/data';
import { ensureSession } from '@/lib/auth';

type View = 'loading' | 'test' | 'result' | 'world' | 'dead';
const ACTS = [
  { kind: 'forage', zh: '觅食', desc: '翻找能吃的（草食收益高）' },
  { kind: 'hunt', zh: '捕猎', desc: '扑倒猎物（肉食收益高，有风险）' },
  { kind: 'rest', zh: '休息躲藏', desc: '安全地歇一会儿' },
];

export default function MeadowPage() {
  const [view, setView] = useState<View>('loading');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [reveal, setReveal] = useState('');
  const [species, setSpecies] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [world, setWorld] = useState<any>(null);
  const [err, setErr] = useState('');
  const [netBusy, setNetBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  const loadState = useCallback(async () => {
    const res = await fetch('/api/meadow/state');
    const d = await res.json();
    setWorld(d);
    return d;
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

  useEffect(() => {
    if (view !== 'world') return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    const p = setInterval(() => { loadState().then((d) => { if (d.character?.status === 'dead') setView('dead'); }); }, 5000);
    return () => { clearInterval(t); clearInterval(p); };
  }, [view, loadState]);

  const ca = world?.character?.current_action;
  const endsMs = ca?.ends_at ? new Date(ca.ends_at).getTime() : 0;
  const remaining = endsMs ? Math.max(0, Math.ceil((endsMs - nowTick) / 1000)) : 0;
  useEffect(() => {
    if (view === 'world' && ca && remaining === 0) {
      loadState().then((d) => { if (d.character?.status === 'dead') setView('dead'); });
    }
  }, [view, ca, remaining, loadState]);

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
      setResult(d.result); setReveal(d.reveal || ''); setSpecies(d.species); setView('result');
    } catch (e: any) { setErr(e.message); setView('test'); }
  }
  async function act(kind: string, target?: string) {
    setNetBusy(true); setErr('');
    try {
      const res = await fetch('/api/meadow/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, target }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '出错了');
      await loadState();
    } catch (e: any) { setErr(e.message); }
    finally { setNetBusy(false); }
  }
  async function enterWorld() { await loadState(); setView('world'); }

  if (view === 'loading') return shell(<div className="flex flex-col items-center gap-4"><div className="text-5xl animate-pulse">🌙</div><p className="text-parchment/70 font-serif">草原的风掀起书页……</p></div>);

  if (view === 'result') {
    const sp = species || {};
    const topA = result ? (Object.keys(result.attributes) as Attr[]).sort((a, b) => result.attributes[b] - result.attributes[a]).slice(0, 4) : [];
    return shell(
      <div className="w-full max-w-xl rounded-2xl border border-eldritch/30 bg-fog/40 p-7 flex flex-col items-center gap-4 text-center">
        <div className="text-7xl">{sp.emoji}</div>
        <div className="font-serif text-2xl text-parchment">你醒来，成为一只 {sp.zh}</div>
        <div className="text-xs tracking-widest uppercase text-eldritch">{result ? DIET_ZH[result.diet as Diet] : ''}</div>
        <p className="text-parchment/80 leading-relaxed whitespace-pre-line text-sm">{reveal || '草原的风掀起书页，你睁开了眼睛。'}</p>
        {result?.traits?.length ? <div className="flex flex-wrap gap-2 justify-center">{result.traits.map((tn: string) => <span key={tn} className="px-3 py-1 rounded-full bg-eldritch/25 border border-eldritch/40 text-parchment/80 text-xs">{tn}</span>)}</div> : null}
        {topA.length ? <div className="w-full grid grid-cols-2 gap-2 mt-1">{topA.map((k) => <div key={k} className="flex items-center justify-between text-sm bg-ink/40 rounded px-3 py-1.5"><span className="text-parchment/60">{ATTR_ZH[k]}</span><span className="text-parchment font-mono">{result.attributes[k]}</span></div>)}</div> : null}
        <button onClick={enterWorld} className="mt-2 px-8 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">睁开眼睛 · 进入草原 →</button>
      </div>
    );
  }

  if (view === 'dead') {
    const c = world?.character || {};
    return shell(
      <div className="w-full max-w-md rounded-2xl border border-blood/40 bg-fog/40 p-7 flex flex-col items-center gap-4 text-center">
        <div className="text-6xl grayscale">{c.emoji || '🥀'}</div>
        <div className="font-serif text-2xl text-parchment">这一只 {c.speciesZh || '动物'} 死了</div>
        <div className="text-parchment/60 text-sm">死因：{c.death_cause || '未知'}</div>
        <p className="text-parchment/55 text-sm">草原合上了这一页。但故事还没结束——命运会再翻开新的一页。</p>
        <button onClick={startTest} className="px-8 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">开始新的一生</button>
        <Link href="/" className="text-parchment/40 hover:text-parchment text-sm underline">← 返回首页</Link>
      </div>
    );
  }

  if (view === 'world') {
    const c = world?.character || {}; const clk = world?.clock || {}; const events = world?.events || [];
    const busyNow = !!c.current_action;
    const hungerColor = c.hunger >= 80 ? 'bg-rust' : c.hunger >= 50 ? 'bg-amber' : 'bg-green';
    return shell(
      <div className="w-full max-w-xl flex flex-col gap-4">
        <div className="rounded-2xl border border-eldritch/30 bg-fog/40 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{c.emoji}</span>
            <div className="text-left">
              <div className="font-serif text-xl text-parchment">一只 {c.speciesZh}</div>
              <div className="text-xs text-eldritch">{c.diet ? DIET_ZH[c.diet as Diet] : ''} · {c.locationZh} · <span className="text-parchment/45">此处{c.danger}</span></div>
            </div>
            <div className="ml-auto text-right text-xs text-parchment/50">{clk.label}</div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-parchment/50 mb-1"><span>饥饿</span><span>{c.hunger}/100</span></div>
            <div className="h-2 rounded-full bg-ink overflow-hidden"><div className={'h-full ' + hungerColor} style={{ width: c.hunger + '%' }} /></div>
          </div>
          {c.traits?.length ? <div className="flex flex-wrap gap-1.5">{c.traits.map((tn: string) => <span key={tn} className="px-2 py-0.5 rounded-full bg-eldritch/20 border border-eldritch/30 text-parchment/70 text-[11px]">{tn}</span>)}</div> : null}
        </div>

        {busyNow ? (
          <div className="rounded-xl border border-eldritch/30 bg-eldritch/10 p-5 text-center">
            <div className="text-parchment/80 font-serif mb-1">正在{ACTS.find((x) => x.kind === c.current_action.kind)?.zh || '行动'}……</div>
            <div className="text-3xl font-mono text-eldritch">{mmss(remaining)}</div>
            <div className="text-xs text-parchment/40 mt-1">（关掉页面也在继续，回来时自动结算）</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ACTS.map((a) => (
                <button key={a.kind} onClick={() => act(a.kind)} disabled={netBusy}
                  className="rounded-xl border border-eldritch/30 bg-fog hover:bg-eldritch/15 hover:border-eldritch p-3 text-center disabled:opacity-50 transition">
                  <div className="text-parchment font-serif">{a.zh}</div>
                  <div className="text-[11px] text-parchment/45 mt-0.5">{a.desc}</div>
                </button>
              ))}
            </div>
            <div>
              <div className="text-xs text-parchment/40 mb-1.5">迁徙到别处（约 2 分钟，途中可能遇袭）</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(world?.locations || []).filter((l: any) => l.key !== c.location).map((l: any) => (
                  <button key={l.key} onClick={() => act('move', l.key)} disabled={netBusy}
                    className="rounded-lg border border-eldritch/25 bg-fog/60 hover:border-eldritch p-2 text-center disabled:opacity-50">
                    <div className="text-parchment/85 text-sm">{l.zh}</div>
                    <div className="text-[10px] text-parchment/40">{l.danger}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-eldritch/20 bg-ink/30 p-4 max-h-[40vh] overflow-y-auto">
          <div className="text-xs tracking-widest uppercase text-parchment/40 mb-2">草原日志</div>
          <div className="flex flex-col gap-2">
            {events.map((e: any) => (
              <div key={e.id} className="text-sm text-parchment/75 leading-snug"><span className="text-parchment/35 text-[11px] mr-1.5">{e.game_label}</span>{e.text}</div>
            ))}
            {!events.length && <div className="text-parchment/40 text-sm">还没有发生什么。去做点什么吧。</div>}
          </div>
        </div>
        {err && <p className="text-blood text-sm text-center">{err}</p>}
        <Link href="/" className="text-parchment/40 hover:text-parchment text-sm underline text-center">← 返回首页</Link>
      </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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

function shell(inner: any) {
  return <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-8">{inner}</main>;
}
function mmss(s: number) { const m = Math.floor(s / 60); const r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
