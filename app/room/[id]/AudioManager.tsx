'use client';
import { useEffect, useRef, useState } from 'react';
import { AUDIO_MAP, ONE_SHOT, SCARE, STINGERS, SCARE_BOOST, isCategory, type AudioCategory } from '@/lib/audio/manifest';
import { audioBus } from '@/lib/audio/bus';
import { subscribeVoiceControl, getVoiceControl, type VCtrl } from './voiceControl';
import { playSfx } from '@/lib/audio/sfx';

// 旁白内容 → 情绪（服务端给的状态是底，旁白里的事件临时盖上去，约 2 分钟后回落）
const MOOD: [RegExp, AudioCategory][] = [
  [/尸体|血迹|鲜血|死了|惨叫|尖叫|corpse|blood|scream|dead body/i, 'MONSTER_REVEAL'],
  [/追|快跑|逃|冲过来|扑过来|chase|run!|rushes? at|lunges/i, 'CHASE_SEQUENCE'],
  [/打斗|搏斗|开枪|刀|厮打|fight|gunshot|stab|attack/i, 'COMBAT'],
  [/低语|耳语|影子|镜子|幻觉|不对劲|whisper|shadow|mirror|something.?s wrong/i, 'PARANORMAL_EVENT'],
  [/真相|原来|终于明白|水落石出|the truth|finally understand/i, 'TRUTH_REVEAL'],
  [/发现|线索|找到了|注意到|clue|you find|you notice/i, 'INVESTIGATION_BREAKTHROUGH'],
];
// [[拟声]] → 音效
const SFX_WORDS: [RegExp, string][] = [
  [/吱呀|门|creak|door/i, 'creaking_door'],
  [/吼|咆哮|growl|roar/i, 'monster_growl'],
  [/风|呼——|呼呼|wind|howl/i, 'ambient_wind'],
  [/楼梯|stairs/i, 'footsteps_stairs'],
  [/脚步|嗒|踏|footstep|step/i, 'footsteps_wood'],
];

// 前端音乐状态机：AI 只返回 scene_state，这里负责淡入淡出、循环、单次、惊吓、音量。
export default function AudioManager({ state }: { state: string }) {
  const base = (isCategory((state || '').toUpperCase()) ? state.toUpperCase() : 'MENU') as AudioCategory;
  const [over, setOver] = useState<{ c: AudioCategory; until: number } | null>(null);
  const [tick, setTick] = useState(0);
  const cat: AudioCategory = over && Date.now() < over.until && !/ENDING|TRUTH_REVEAL|MENU|CHARACTER/.test(base) ? over.c : base;
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(0.6);
  const [voice, setVoice] = useState<VCtrl>(getVoiceControl());
  useEffect(() => subscribeVoiceControl(setVoice), []);

  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // 记住玩家的音乐开关和音量
  useEffect(() => { try { const m = localStorage.getItem('mn_music'); if (m === 'off') setMuted(true); const v = Number(localStorage.getItem('mn_vol')); if (v > 0 && v <= 1) setVol(v); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('mn_music', muted ? 'off' : 'on'); localStorage.setItem('mn_vol', String(vol)); } catch {} }, [muted, vol]);

  const bedRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<any>(null);
  const lastLoopCat = useRef<AudioCategory | null>(null);
  const lastTrack = useRef<Record<string, string>>({});
  const volRef = useRef(vol);
  const duckRef = useRef(false);
  const bedStart = useRef(0);
  const enabledRef = useRef(false);
  const mutedRef = useRef(muted);
  volRef.current = vol;
  mutedRef.current = muted;
  enabledRef.current = enabled;

  function pick(list: string[], key: string): string | null {
    if (!list.length) return null;
    let t = list[0];
    for (let i = 0; i < 6; i++) {
      t = list[Math.floor(Math.random() * list.length)];
      if (list.length === 1 || t !== lastTrack.current[key]) break;
    }
    lastTrack.current[key] = t;
    return t;
  }

  function bedVolume(c: AudioCategory) {
    const boost = SCARE.includes(c) ? SCARE_BOOST : 1;
    const duck = duckRef.current ? 0.35 : 1; // 旁白说话时把音乐压低
    return mutedRef.current ? 0 : Math.min(1, volRef.current * boost * duck);
  }

  function fadeVol(a: HTMLAudioElement, to: number) {
    const from = a.volume; let i = 0;
    const iv = setInterval(() => { i++; a.volume = Math.max(0, Math.min(1, from + (to - from) * (i / 12))); if (i >= 12) clearInterval(iv); }, 50);
  }

  function playStinger(mult = SCARE_BOOST) {
    const url = pick(STINGERS, 'stinger');
    if (!url) return;
    const a = new Audio(url);
    a.volume = mutedRef.current ? 0 : Math.min(1, volRef.current * mult);
    a.play().catch(() => {});
  }

  function crossfadeTo(url: string, target: number) {
    const old = bedRef.current;
    const oldStart = old ? old.volume : 0;
    const next = new Audio(url);
    next.loop = true;
    next.volume = 0;
    bedRef.current = next;
    bedStart.current = Date.now();
    next.play().catch(() => {});
    if (fadeRef.current) clearInterval(fadeRef.current);
    const steps = 60, dt = 50;
    let i = 0;
    fadeRef.current = setInterval(() => {
      i++;
      const p = i / steps;
      next.volume = mutedRef.current ? 0 : target * p;
      if (old) old.volume = mutedRef.current ? 0 : oldStart * (1 - p);
      if (i >= steps) {
        clearInterval(fadeRef.current);
        if (old) old.pause();
      }
    }, dt);
  }

  // 旁白事件：换情绪 / 配音效 / 喊叫时一记轻惊吓
  useEffect(() => {
    const onNarr = (e: any) => {
      const text: string = String(e?.detail?.text || '');
      if (!text) return;
      const plain = text.replace(/\[\[.+?\]\]/g, ' ');
      for (const [re, c] of MOOD) { if (re.test(plain)) { setOver({ c, until: Date.now() + 120000 }); break; } }
      const sfx = Array.from(text.matchAll(/\[\[(.+?)\]\]/g)).map((m) => m[1]);
      let delay = 400;
      for (const w of sfx.slice(0, 2)) { const hit = SFX_WORDS.find(([re]) => re.test(w)); if (hit) { const k = hit[1]; setTimeout(() => playSfx(k), delay); delay += 900; } }
      if (/!!.+?!!/s.test(text) && enabledRef.current) setTimeout(() => playStinger(0.8), 250);
    };
    const onSpeak = (e: any) => { duckRef.current = !!e?.detail; setSpeaking(!!e?.detail); if (bedRef.current && lastLoopCat.current) fadeVol(bedRef.current, bedVolume(lastLoopCat.current)); };
    window.addEventListener('mn-narr', onNarr);
    window.addEventListener('mn-speaking', onSpeak);
    // 情绪覆盖到期 → 回落；同一首放久了换一首同情绪的
    const iv = setInterval(() => setTick((x) => x + 1), 15000);
    return () => { window.removeEventListener('mn-narr', onNarr); window.removeEventListener('mn-speaking', onSpeak); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!enabled || !bedRef.current || !lastLoopCat.current) return;
    if (Date.now() - bedStart.current < 240000) return;
    const list = AUDIO_MAP[lastLoopCat.current];
    if (list.length < 2 || ONE_SHOT.includes(lastLoopCat.current)) return;
    const url = pick(list, lastLoopCat.current);
    if (url) crossfadeTo(url, bedVolume(lastLoopCat.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // 状态切换
  useEffect(() => {
    if (!enabled) return;

    if (ONE_SHOT.includes(cat)) {
      // 单次：在床乐之上播一遍，不改变床乐
      const url = pick(AUDIO_MAP[cat], cat);
      if (url) {
        const a = new Audio(url);
        a.volume = mutedRef.current ? 0 : Math.min(1, volRef.current);
        a.play().catch(() => {});
      }
      return;
    }

    if (SCARE.includes(cat)) playStinger(); // 惊吓一击（+50%）

    if (lastLoopCat.current === cat) {
      if (bedRef.current) bedRef.current.volume = bedVolume(cat);
      return;
    }
    const url = pick(AUDIO_MAP[cat], cat);
    if (url) {
      crossfadeTo(url, bedVolume(cat));
      lastLoopCat.current = cat;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, enabled]);

  // 音量 / 静音 实时调整床乐，并同步到共享 bus（音效层读取）
  useEffect(() => {
    audioBus.muted = muted;
    audioBus.musicVol = vol;
    if (bedRef.current && lastLoopCat.current) bedRef.current.volume = bedVolume(lastLoopCat.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, vol]);

  // 浏览器自动播放限制：首次任意交互后解锁
  useEffect(() => {
    if (enabled) return;
    const unlock = () => setEnabled(true);
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [enabled]);

  useEffect(() => () => { if (bedRef.current) bedRef.current.pause(); }, []);

  const voiceOn = !!voice && voice.mode !== 'off';
  const musicOn = !muted;
  const live = enabled && (speaking || musicOn);
  return (
    <>
      {open && <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />}
      <div className="fixed right-2.5 top-[58px] lg:top-auto lg:bottom-4 lg:right-4 z-[56] flex flex-col items-end">
        <button onClick={() => setOpen((v) => !v)} aria-label="声音" title="声音设置"
          className={`relative w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${open ? 'bg-[#c9a96e]/15 border-[#c9a96e]/50' : 'bg-[#0b0c0f]/75 border-[#d8c7a8]/15 hover:border-[#c9a96e]/40'}`}>
          {live ? (
            <span className="flex items-end gap-[2.5px] h-3.5">
              {[0, 1, 2, 3].map((k) => <span key={k} className="w-[2.5px] rounded-full bg-[#c9a96e] mn-eq" style={{ animationDelay: `${k * 0.13}s`, animationDuration: speaking ? '.55s' : '1.1s' }} />)}
            </span>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-parchment/70">
              <path d="M11 5L6 9H3v6h3l5 4z" />{musicOn || voiceOn ? <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" /> : <path d="M16 9l5 6M21 9l-5 6" />}
            </svg>
          )}
          {!enabled && (musicOn || voiceOn) && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#c9a96e] border-2 border-ink animate-pulse" />}
        </button>
        {!enabled && (musicOn || voiceOn) && !open && (
          <div className="mt-2 px-3 py-1.5 rounded-full bg-[#0b0c0f]/85 backdrop-blur border border-[#d8c7a8]/12 text-[11.5px] text-parchment/70 whitespace-nowrap nf-in">轻点任意处，开启声音</div>
        )}
        {open && (
          <div className="mt-2 w-[264px] rounded-xl bg-[#0f1013]/[0.97] backdrop-blur-xl border border-[#d8c7a8]/[0.14] shadow-[0_24px_60px_-12px_rgba(0,0,0,.9)] p-1.5 text-left nf-in">
            <div className="px-3 pt-2 pb-1.5 text-[10.5px] tracking-[.35em] text-[#c9a96e]/70">声音</div>
            {voice && (
              <button onClick={voice.cycle} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] text-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#c9a96e]/80 shrink-0"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] text-[#ece3cf]">旁白语音</span>
                  <span className={`block text-[11.5px] mt-0.5 ${voice.quota ? 'text-[#e0a070]' : 'text-parchment/45'}`}>{voice.quota ? '今天的免费语音用完了，明天再来' : voiceOn ? (speaking ? '正在朗读…' : 'AI 主持人会念出旁白 · 免费') : '只看文字，不朗读'}</span>
                </span>
                <Switch on={voiceOn} />
              </button>
            )}
            <div className="px-3 py-3 rounded-lg">
              <button onClick={() => setMuted((m) => !m)} className="w-full flex items-center gap-3 text-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#c9a96e]/80 shrink-0"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] text-[#ece3cf]">背景音乐与音效</span>
                  <span className="block text-[11.5px] mt-0.5 text-parchment/45">{musicOn ? '跟着剧情变化' : '已关闭'}</span>
                </span>
                <Switch on={musicOn} />
              </button>
              <div className={`mt-3.5 flex items-center gap-3 pl-[30px] transition-opacity ${musicOn ? '' : 'opacity-35 pointer-events-none'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-parchment/40 shrink-0"><path d="M11 5L6 9H3v6h3l5 4z" /></svg>
                <input type="range" min={0.05} max={1} step={0.05} value={vol} onChange={(e) => setVol(+e.target.value)} className="mn-range flex-1" style={{ ['--p' as any]: `${Math.round(((vol - 0.05) / 0.95) * 100)}%` }} aria-label="音乐音量" />
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-parchment/40 shrink-0"><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" /></svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${on ? 'bg-[#c9a96e]/85' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-[#f2ead9] shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  );

}
