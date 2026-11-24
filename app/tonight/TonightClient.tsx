'use client';
// 今夜怪谈播放器：一句一句播（讲述人和每个角色是不同的声音），字幕跟着走，背景有很轻的夜声。
import { useEffect, useRef, useState } from 'react';
import { getClientLang } from '@/lib/i18n';
import Icon from '@/components/Icon';
import { parseBeat } from '@/lib/narrate';

// 每种故事风格一套卡片配色
const STY: Record<string, { c: string; zh: string; en: string; icon: string }> = {
  city: { c: '#8c9bff', zh: '城市夜晚', en: 'City night', icon: 'lantern' }, home: { c: '#e8a87c', zh: '住处', en: 'At home', icon: 'key' },
  hospital: { c: '#8fd3b8', zh: '医院', en: 'Hospital', icon: 'scroll' }, school: { c: '#c9b8ff', zh: '学校', en: 'School', icon: 'clock' },
  village: { c: '#c9a96e', zh: '乡下老家', en: 'Back home', icon: 'candle' }, water: { c: '#6fb7d9', zh: '水边', en: 'By the water', icon: 'moon' },
  road: { c: '#f0a35a', zh: '路上', en: 'On the road', icon: 'eye' }, old: { c: '#b89a7a', zh: '旧物', en: 'Old things', icon: 'ghost' },
};
const sty = (k?: string) => STY[k || 'city'] || STY.city;
function Fear({ n, c }: { n: number; c: string }) {
  return <span className="inline-flex items-end gap-[3px]">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="w-[4px] rounded-sm" style={{ height: 5 + i * 2.5, background: i <= n ? c : 'rgba(255,255,255,.12)' }} />)}</span>;
}
// 一句话里的排版标记 → 夸张的视觉：动作加粗发光、喊叫放大抖动、低语变小变淡、拟声做成发光的标签
function Beat({ text, cur }: { text: string; cur: boolean }) {
  const segs = parseBeat(text);
  return <>{segs.map((g, i) => {
    if (g.k === 'act') return <b key={i} className="font-semibold text-[#ffd98f] [text-shadow:0_0_14px_rgba(255,190,90,.35)]">{g.t}</b>;
    if (g.k === 'shout') return <span key={i} className={`inline-block mx-0.5 font-black text-[1.55em] leading-none text-[#ff5a4f] [text-shadow:0_0_22px_rgba(255,60,50,.6)] ${cur ? 'gs-shake' : ''}`}>{g.t}</span>;
    if (g.k === 'whisper') return <span key={i} className="italic text-[0.86em] tracking-[.18em] text-[#b9c6dd]/75 [text-shadow:0_0_10px_rgba(150,170,210,.35)]">{g.t}</span>;
    if (g.k === 'sfx') return <span key={i} className={`inline-block mx-1 px-2 py-0.5 rounded-md border border-[#e8a87c]/40 bg-[#e8a87c]/10 text-[0.78em] tracking-[.32em] text-[#f2c09a] align-middle ${cur ? 'gs-pulse' : ''}`}>{g.t}</span>;
    if (g.k === 'say') return <span key={i} className="text-[#fff0dc]">「{g.t}」</span>;
    return <span key={i}>{g.t}</span>;
  })}</>;
}

export default function TonightClient({ initial }: { initial: any }) {
  const [en, setEn] = useState(false);
  const [d, setD] = useState<any>(initial ? { ok: true, story: initial, archive: [] } : null);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const bed = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<any>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const L = (zh: string, e: string) => (en ? e : zh);

  async function load(id?: string) {
    const lang = (() => { try { return getClientLang(); } catch { return 'zh'; } })();
    const r = await fetch(`/api/ghost?lang=${lang}${id ? `&id=${id}` : ''}`).then((x) => x.json()).catch(() => null);
    if (r) { stop(); setIdx(-1); setEnded(false); setD(r); if (id) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} load(); return () => stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = d?.story;
  const lines: any[] = s?.lines || [];
  const castOf = (who: string) => (s?.cast || []).find((c: any) => c.name === who);

  function stop() { clearTimeout(timer.current); try { audio.current?.pause(); } catch {} try { bed.current?.pause(); } catch {} setPlaying(false); }
  function playAt(i: number) {
    clearTimeout(timer.current);
    if (i >= lines.length) { setPlaying(false); setEnded(true); setIdx(lines.length); try { bed.current?.pause(); } catch {} return; }
    setIdx(i); setEnded(false); setPlaying(true);
    if (!bed.current) { bed.current = new Audio('/audio/veil-of-night/loop1.ogg'); bed.current.loop = true; bed.current.volume = 0.1; }
    bed.current.play().catch(() => {});
    const l = lines[i];
    if (!l?.audio) { timer.current = setTimeout(() => playAt(i + 1), 1800); return; }
    try { audio.current?.pause(); } catch {}
    const a = new Audio(l.audio); audio.current = a;
    a.onended = () => { const next = lines[i + 1]; const gap = next && next.who !== l.who ? 650 : 280; timer.current = setTimeout(() => playAt(i + 1), gap); };
    a.onerror = () => { timer.current = setTimeout(() => playAt(i + 1), 600); };
    a.play().catch(() => setPlaying(false));
    // 预加载下一句
    if (lines[i + 1]?.audio) { const p = new Audio(); p.preload = 'auto'; p.src = lines[i + 1].audio; }
  }
  function toggle() {
    if (playing) { stop(); return; }
    if (idx >= 0 && idx < lines.length && audio.current && audio.current.src) { setPlaying(true); audio.current.play().catch(() => {}); bed.current?.play().catch(() => {}); return; }
    playAt(idx >= 0 && idx < lines.length ? idx : 0);
  }
  useEffect(() => { if (idx >= 0) lineRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [idx]);

  const mins = s?.seconds ? Math.max(1, Math.round(s.seconds / 60)) : null;
  const voices = 1 + (s?.cast?.length || 0);
  const prog = lines.length ? Math.max(0, Math.min(1, (idx + (ended ? 1 : 0)) / lines.length)) : 0;

  async function share() {
    const t = L(`今夜怪谈《${s?.title}》：${s?.teaser || ''} mystnight.com/tonight`, `Tonight’s ghost story “${s?.title}”: ${s?.teaser || ''} mystnight.com/tonight`);
    try { if ((navigator as any).share) { await (navigator as any).share({ text: t }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(t); } catch {}
  }

  return (
    <main className="min-h-[100svh] text-parchment pb-40">
      <style>{`@keyframes gsFlicker{0%,100%{opacity:.85;transform:scale(1)}40%{opacity:1;transform:scale(1.04)}60%{opacity:.75;transform:scale(.98)}}.gs-flame{animation:gsFlicker 2.6s ease-in-out infinite}@keyframes gsShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-2px,1px) rotate(-1deg)}40%{transform:translate(2px,-1px) rotate(1deg)}60%{transform:translate(-1px,-1px)}80%{transform:translate(1px,1px)}}.gs-shake{animation:gsShake .35s linear 3}@keyframes gsPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,168,124,0)}50%{box-shadow:0 0 18px 2px rgba(232,168,124,.45)}}.gs-pulse{animation:gsPulse 1.4s ease-in-out 2}`}</style>
      <div aria-hidden className="fixed inset-0 -z-10 transition-[background] duration-[2000ms]" style={{ background: playing ? 'radial-gradient(80% 45% at 50% 18%, rgba(120,30,30,.22), transparent 70%), #07080a' : 'radial-gradient(80% 45% at 50% 18%, rgba(201,140,80,.16), transparent 70%), #0a0b0e' }} />
      <a href="/play" className="fixed left-3 z-30 h-8 px-3 rounded-full flex items-center text-[12.5px] text-parchment/70 border border-white/10 bg-black/50 backdrop-blur" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>{L('← 大厅', '← Hall')}</a>

      <div className="max-w-xl mx-auto px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
        {!s ? (
          <div className="pt-24 text-center text-parchment/50">{d && !d.ok ? L('今晚的故事还在路上，晚点再来。', 'Tonight’s story is on its way — check back soon.') : '…'}</div>
        ) : (
          <>
            {(() => { const t = sty(s.style); return (
              <div className="relative overflow-hidden rounded-3xl border px-5 pt-6 pb-5 text-center" style={{ borderColor: t.c + '55', background: `radial-gradient(120% 80% at 50% 0%, ${t.c}33, transparent 60%), linear-gradient(180deg, rgba(20,18,16,.92), rgba(8,8,10,.95))` }}>
                <span aria-hidden className="absolute -right-6 -bottom-8 opacity-[0.12]" style={{ color: t.c }}><Icon n={t.icon} size={150} stroke={1} /></span>
                <div className="relative mx-auto w-10 h-14"><span className="gs-flame absolute left-1/2 -translate-x-1/2 top-0 w-5 h-8 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[radial-gradient(circle_at_50%_70%,#fff3c4,#f0a35a_45%,rgba(192,69,63,0)_75%)] blur-[1px]" /><span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-3 h-6 rounded-sm bg-[#e9dcc2]/80" /></div>
                <div className="relative mt-3 text-[10.5px] tracking-[.45em] pl-[.45em]" style={{ color: t.c }}>{d?.locked ? L('往期怪谈', 'FROM THE ARCHIVE') : s.no ? L(`今夜怪谈 · 第 ${s.no} 夜`, `TONIGHT · NIGHT ${s.no}`) : L('今夜怪谈', 'TONIGHT')}</div>
                <h1 className="relative mt-2 font-serif font-semibold text-[32px] leading-tight text-[#f7ecd8] [text-shadow:0_2px_30px_rgba(0,0,0,.9)]">{s.title}</h1>
                {s.teaser && <p className="relative mt-2 font-serif italic text-[15px] text-parchment/70">{s.teaser}</p>}
                <div className="relative mt-4 flex items-center justify-center gap-3 text-[12px] text-parchment/50 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border" style={{ borderColor: t.c + '55', color: t.c }}><Icon n={t.icon} size={12} />{en ? t.en : t.zh}</span>
                  <span className="inline-flex items-center gap-1.5">{L('吓人程度', 'Fear')} <Fear n={s.fear || 3} c={t.c} /></span>
                  <span>{L(`讲述：${s.teller?.name || '朋友'}`, `Told by ${s.teller?.name || 'a friend'}`)}{mins ? L(` · 约 ${mins} 分钟`, ` · ~${mins} min`) : ''}{L(` · ${voices} 个声音`, ` · ${voices} voices`)}</span>
                </div>
              </div>
            ); })()}

            {d?.locked ? (
              <div className="mt-8 rounded-2xl border border-[#c9a96e]/30 bg-[#14120d]/80 px-5 py-5 text-center">
                <div className="flex justify-center text-[#c9a96e]"><Icon n="lock" size={24} /></div>
                <div className="mt-1 font-serif text-[17px] text-[#f2e6d0]">{L('往期怪谈是会员专属', 'Past stories are for members')}</div>
                <p className="mt-1.5 text-[13px] text-parchment/55">{L('今晚的那一篇人人免费。会员、畅玩卡、派对夜卡可以听全部往期。', 'Tonight’s story is free for everyone. Members and pass holders can listen to every past night.')}</p>
                <div className="mt-4 flex justify-center gap-2.5"><a href="/upgrade" className="h-10 px-5 rounded-xl bg-[#c9a96e] text-[#14110a] text-[14px] flex items-center">{L('看看会员', 'See membership')}</a><button onClick={() => load()} className="h-10 px-4 rounded-xl border border-white/15 text-[13.5px]">{L('听今晚的', 'Tonight’s story')}</button></div>
              </div>
            ) : (
              <>
                <div className="mt-7 flex justify-center">
                  <button onClick={toggle} className={`w-20 h-20 rounded-full flex items-center justify-center border transition ${playing ? 'border-[#c0453f]/60 bg-[#2a0e0e]/80 shadow-[0_0_50px_-8px_rgba(192,69,63,.7)]' : 'border-[#e8a87c]/50 bg-[#1a140e]/80 shadow-[0_0_50px_-10px_rgba(232,168,124,.6)]'}`} aria-label="play">
                    {playing ? <svg width="26" height="26" viewBox="0 0 24 24" fill="#f2e6d0"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg> : <svg width="28" height="28" viewBox="0 0 24 24" fill="#f2e6d0"><path d="M8 5l11 7-11 7z" /></svg>}
                  </button>
                </div>
                <p className="mt-3 text-center text-[12px] text-parchment/40">{idx < 0 ? L('戴上耳机，关掉灯', 'Headphones on, lights off') : ended ? L('讲完了', 'The end') : L(`${idx + 1} / ${lines.length}`, `${idx + 1} / ${lines.length}`)}</p>

                <div className="mt-8 space-y-4">
                  {lines.map((l, i) => {
                    const c = l.who !== 'teller' ? castOf(l.who) : null;
                    const cur = i === idx, past = idx >= 0 && i < idx;
                    return (
                      <div key={i} ref={(el) => { lineRefs.current[i] = el; }} onClick={() => playAt(i)} className={`cursor-pointer transition-all duration-500 ${cur ? 'opacity-100' : past ? 'opacity-35' : idx < 0 ? 'opacity-80' : 'opacity-50'}`}>
                        {c && <div className={`mb-1 text-[11px] tracking-[.15em] ${c.gender === 'female' ? 'text-[#e8a0b8]' : 'text-[#8fb8e8]'}`}>{c.name}</div>}
                        <p className={`font-serif leading-[1.9] transition-all duration-500 ${c ? 'pl-3 border-l-2 ' + (c.gender === 'female' ? 'border-[#e8a0b8]/50' : 'border-[#8fb8e8]/50') : ''} ${cur ? 'text-[18.5px] text-[#fff4e0]' : 'text-[16px] text-parchment/85'}`}>{c ? <>「<Beat text={l.text} cur={cur} />」</> : <Beat text={l.text} cur={cur} />}</p>
                      </div>
                    );
                  })}
                </div>

                {ended && (
                  <div className="mt-10 rounded-2xl border border-[#e8a87c]/30 bg-[#14120d]/80 px-5 py-5 text-center">
                    <div className="font-serif text-[18px] text-[#f2e6d0]">{L('今晚的故事讲完了', 'That’s tonight’s story')}</div>
                    <p className="mt-1 text-[13px] text-parchment/55">{L('明晚换一个新的。睡不着的话……', 'A new one tomorrow night. Can’t sleep?')}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <a href="/zh/games/cthulhu" className="h-11 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[13.5px] flex items-center justify-center">{L('自己走进一个怪谈', 'Step into one yourself')}</a>
                      <button onClick={share} className="h-11 rounded-xl border border-white/15 text-[13.5px]">{L('分享给朋友', 'Share')}</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {(d?.archive?.length || 0) > 0 && (
              <section className="mt-12">
                <div className="text-[11px] tracking-[.28em] text-parchment/40 mb-2">{L('往期怪谈', 'PAST NIGHTS')}{!d.canPast && <span className="ml-2 tracking-normal text-[#c9a96e]/70">{L('· 会员可听', '· members')}</span>}</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {d.archive.map((a: any) => { const t = sty(a.style); return (
                    <button key={a.id} onClick={() => load(a.id)} className="relative overflow-hidden text-left rounded-2xl border p-3.5 min-h-[150px] flex flex-col" style={{ borderColor: t.c + '44', background: `radial-gradient(130% 90% at 100% 0%, ${t.c}2e, transparent 60%), #101114` }}>
                      <span aria-hidden className="absolute -right-4 -bottom-5 opacity-[0.12]" style={{ color: t.c }}><Icon n={t.icon} size={84} stroke={1} /></span>
                      <span className="relative flex items-center justify-between text-[10.5px]" style={{ color: t.c }}><span>{a.no ? L(`第 ${a.no} 夜`, `Night ${a.no}`) : ''}</span>{d.canPast ? <Icon n="play" size={13} /> : <Icon n="lock" size={13} />}</span>
                      <span className="relative mt-auto font-serif text-[16px] leading-snug text-[#f7ecd8] line-clamp-2">{a.title}</span>
                      <span className="relative mt-1 text-[11.5px] leading-snug text-parchment/50 line-clamp-2">{a.teaser}</span>
                      <span className="relative mt-2"><Fear n={a.fear || 3} c={t.c} /></span>
                    </button>
                  ); })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {s && !d?.locked && idx >= 0 && !ended && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-[#07080a]/90 backdrop-blur-xl border-t border-white/[0.06]" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <div className="h-[2px] bg-white/[0.06]"><div className="h-full bg-[#e8a87c] transition-all duration-500" style={{ width: `${prog * 100}%` }} /></div>
          <div className="max-w-xl mx-auto px-6 pt-2.5 flex items-center justify-between">
            <button onClick={() => playAt(Math.max(0, idx - 1))} className="w-11 h-11 text-parchment/70 text-[18px]" aria-label="prev"><Icon n="prev" size={20} className="mx-auto" /></button>
            <button onClick={toggle} className="w-12 h-12 rounded-full bg-[#f2e6d0] text-[#0a0b0e] flex items-center justify-center"><Icon n={playing ? 'pause' : 'play'} size={20} /></button>
            <button onClick={() => playAt(idx + 1)} className="w-11 h-11 text-parchment/70 text-[18px]" aria-label="next"><Icon n="next" size={20} className="mx-auto" /></button>
          </div>
        </div>
      )}
    </main>
  );
}
