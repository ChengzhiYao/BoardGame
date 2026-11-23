'use client';
// 输入框里的麦克风:点一下开始说,边说边出字(跟微信一样),再点一下停。文字放进输入框,可以改完再发。
// 手机浏览器自带语音识别的就用它(实时、免费);用不了(比如 App 里的内置网页)就每隔 1.5 秒把已经说的那段送去转写,一段段更新。
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toWav16 } from '@/lib/wav16';


function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) { try { if ((window as any).MediaRecorder?.isTypeSupported?.(m)) return m; } catch {} }
  return '';
}

export default function Dictate({ en, lang, compact, onStart, onLive, onError, panel, text, onCancel }: { en: boolean; lang?: 'zh' | 'en'; compact?: boolean; panel?: boolean; text?: string; onCancel?: () => void; onStart: () => void; onLive: (t: string, done: boolean) => void; onError: (m: string) => void }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const [st, setSt] = useState<'idle' | 'rec' | 'busy'>('idle');
  const [secs, setSecs] = useState(0);
  const r = useRef<any>({ chunks: [], t0: 0, last: '', inflight: false });
  // 像 Claude 的语音输入:下面一条实时波形,上面字一边说一边出来
  const [levels, setLevels] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [text]);
  function meter(stream: MediaStream | null) {
    try {
      if (!stream) throw 0;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize);
      r.current.ctx = ctx;
      r.current.lv = setInterval(() => { an.getFloatTimeDomainData(buf); let s2 = 0; for (let i = 0; i < buf.length; i++) s2 += buf[i] * buf[i]; const db = 20 * Math.log10(Math.sqrt(s2 / buf.length) + 1e-9); const v = Math.max(0.05, Math.min(1, (db + 60) / 45)); setLevels((x) => [...x.slice(-47), v]); }, 70);
    } catch {
      // 拿不到音量(有的手机浏览器识别时不让再开麦克风):用轻微起伏的假波形,至少看得出在听
      r.current.lv = setInterval(() => { const b = Math.max(0, (r.current.boost || 0)); r.current.boost = b * 0.85; setLevels((x) => [...x.slice(-47), 0.08 + Math.random() * (0.12 + b * 0.6)]); }, 90);
    }
  }
  function unmeter() { clearInterval(r.current.lv); try { r.current.ctx?.close(); } catch {} try { r.current.meterStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); } catch {} setLevels([]); }

  async function transcribe(blob: Blob): Promise<string> {
    const wav = await toWav16(blob).catch(() => '');
    let body: any = { wav };
    if (!wav) { const d: string = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.readAsDataURL(blob); }); body = { data: d }; }
    const res = await fetch('/api/stt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return String(d?.text || '');
  }

  async function start() {
    onStart();
    r.current = { chunks: [], t0: Date.now(), last: '', inflight: false, cancel: false };
    setSecs(0); r.current.t = setInterval(() => { const s = Math.floor((Date.now() - r.current.t0) / 1000); setSecs(s); if (s >= 60) stop(); }, 250);
    // 1) 浏览器自带的实时识别
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const inApp = (() => { try { return /; wv\)/i.test(navigator.userAgent); } catch { return false; } })();
    if (SR && !inApp) {
      try {
        const rec = new SR();
        rec.lang = (lang || (en ? 'en' : 'zh')) === 'en' ? 'en-US' : 'zh-CN';
        rec.continuous = !/Android/i.test(navigator.userAgent); rec.interimResults = true; // 安卓连续模式会重复出字：改成一句一句听，自动接着听
        let finalText = '';
        rec.onresult = (e: any) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t; else interim += t; }
          r.current.boost = 1.2; onLive(finalText + interim, false);
        };
        rec.onerror = (e: any) => { if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') { r.current.userStop = true; onError(L('没拿到麦克风权限', 'No microphone access')); } else if (e?.error === 'network') { r.current.userStop = true; onError(L('语音识别连不上网络，请重试', 'Speech service unreachable')); } };
        rec.onend = () => {
          // 安卓的连续识别说完一句会自己停：用户没点完成就接着听
          if (!r.current.cancel && !r.current.userStop && Date.now() - r.current.t0 < 60000) { try { rec.start(); return; } catch {} }
          clearInterval(r.current.t); unmeter(); if (!r.current.cancel) onLive(finalText, true); setSt('idle');
        };
        rec.start(); r.current.sr = rec; setSt('rec');
        // 不再另开麦克风画波形：安卓上会把麦克风抢走，识别就收不到声音。波形跟着识别出字的节奏跳。
        if (panel) { r.current.boost = 0; meter(null); }
        rec.onsoundstart = () => { r.current.boost = 1; };
        rec.onspeechend = () => { r.current.boost = 0; };
        return;
      } catch {}
    }
    // 2) 录音 + 每 1.5 秒把到目前为止说的整段送去转写
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } as any });
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      r.current.mr = mr; r.current.stream = stream; r.current.mime = mr.mimeType || mime || 'audio/webm';
      mr.ondataavailable = (e) => { if (e.data.size) r.current.chunks.push(e.data); };
      mr.onstop = () => finish();
      mr.start(300);
      if (panel) meter(stream);
      r.current.live = setInterval(async () => {
        if (r.current.inflight || !r.current.chunks.length) return;
        r.current.inflight = true;
        try { const t = await transcribe(new Blob(r.current.chunks, { type: r.current.mime })); if (t && r.current.mr && !r.current.cancel) { r.current.last = t; onLive(t, false); } } catch {}
        r.current.inflight = false;
      }, 1500);
      setSt('rec');
    } catch { clearInterval(r.current.t); onError(L('没拿到麦克风权限', 'No microphone access')); setSt('idle'); }
  }
  function cancel() { r.current.cancel = true; stop(); onCancel?.(); setSt('idle'); }
  function stop() {
    clearInterval(r.current.t); clearInterval(r.current.live); unmeter();
    if (r.current.sr) { r.current.userStop = true; try { r.current.sr.stop(); } catch {} return; }
    try { r.current.mr?.stop(); } catch { setSt('idle'); }
    r.current.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  }
  async function finish() {
    const blob = new Blob(r.current.chunks, { type: r.current.mime });
    r.current.mr = null;
    if (r.current.cancel || Date.now() - r.current.t0 < 600 || blob.size < 1500) { setSt('idle'); return; }
    setSt('busy');
    try { const t = await transcribe(blob); if (t) onLive(t, true); else if (!r.current.last) onError(L('没听清,再说一次?', "Didn't catch that")); else onLive(r.current.last, true); }
    catch { onError(L('网络错误', 'Network error')); }
    setSt('idle');
  }

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const sheet = panel && mounted && st !== 'idle' && createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] bg-[#16161b] border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,.45)] px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="max-w-2xl mx-auto">
        <div ref={boxRef} className="min-h-[52px] max-h-44 overflow-y-auto rounded-2xl bg-white/[0.04] px-4 py-3 text-[16px] leading-relaxed text-parchment whitespace-pre-wrap">
          {text?.trim() ? text : <span className="text-parchment/35">{st === 'busy' ? L('转写中…', 'Transcribing…') : L('正在听,说吧…', 'Listening…')}</span>}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={cancel} aria-label={L('取消', 'Cancel')} className="shrink-0 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-parchment/80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div className="flex-1 h-11 rounded-full bg-white/[0.05] flex items-center gap-[3px] px-4 overflow-hidden justify-end">
            {Array.from({ length: 48 }, (_, i) => levels[levels.length - 48 + i] ?? 0.05).map((v, i) => (
              <span key={i} className="w-[3px] shrink-0 rounded-full bg-parchment/80 transition-[height] duration-75" style={{ height: `${Math.round(4 + v * 26)}px` }} />
            ))}
          </div>
          <span className="shrink-0 w-10 text-right text-[13px] tabular-nums text-parchment/60">{mmss}</span>
          <button type="button" onClick={() => (st === 'rec' ? stop() : undefined)} disabled={st === 'busy'} aria-label={L('完成', 'Done')} className="shrink-0 w-11 h-11 rounded-full bg-parchment text-ink flex items-center justify-center disabled:opacity-60">
            {st === 'busy' ? <span className="w-4 h-4 rounded-full border-2 border-ink/25 border-t-ink animate-spin" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
          </button>
        </div>
      </div>
    </div>, document.body);
  return (
    <>{sheet}
    <button type="button" onClick={() => (st === 'idle' ? start() : st === 'rec' ? stop() : undefined)} disabled={st === 'busy'}
      title={L('语音转文字', 'Dictate')} aria-label={L('语音转文字', 'Dictate')}
      className={compact
        ? `relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition ${st === 'rec' ? 'bg-red-500/30 text-red-200 animate-pulse' : 'text-parchment/55 hover:text-parchment'}`
        : `shrink-0 h-10 rounded-full border flex items-center justify-center gap-1.5 transition ${st === 'rec' ? 'px-3 bg-red-500/20 border-red-400/60 text-red-200' : 'w-10 bg-ink border-eldritch/40 text-parchment/70 hover:text-parchment'}`}>
      {st === 'busy' ? <span className="w-4 h-4 rounded-full border-2 border-parchment/25 border-t-parchment/80 animate-spin" />
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
      {st === 'rec' && !compact && <span className="text-[12px] tabular-nums">{`${L('点击结束', 'Tap to stop')} ${secs}s`}</span>}
      {/* 输入框里的小麦克风:录音时不再盖住文字,改成在输入框上方飘一条提示(像微信) */}
      {st === 'rec' && compact && !panel && <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-[12px] text-red-200 tabular-nums shadow-lg">{L('正在听', 'Listening')} {secs}s · {L('点麦克风结束', 'tap mic to stop')}</span>}
    </button></>
  );
}
