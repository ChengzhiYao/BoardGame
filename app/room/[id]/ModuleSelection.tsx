'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ShellProps } from './RoomShell';
import PosterCard from './PosterCard';

const EN = (l?: string) => l === 'en';

const FIELDS_ZH: { key: string; label: string; options: string[] }[] = [
  { key: 'horror_type', label: '恐怖类型', options: ['中式恐怖', '日式怪谈', '克苏鲁', '民俗恐怖', '校园怪谈', '都市传说'] },
  { key: 'era', label: '时代背景', options: ['现代', '民国', '古代', '近未来'] },
  { key: 'place', label: '地点', options: ['村庄', '医院', '学校', '旅馆', '废弃楼', '山中寺庙'] },
  { key: 'style', label: '风格', options: ['调查推理', '心理恐怖', '生存恐怖', '悬疑反转'] },
  { key: 'difficulty', label: '难度', options: ['普通', '困难', '高死亡率'] },
  { key: 'duration', label: '时长', options: ['1小时', '2-3小时', '4小时+'] },
];
const FIELDS_EN: { key: string; label: string; options: string[] }[] = [
  { key: 'horror_type', label: 'Horror type', options: ['Chinese horror', 'Japanese kaidan', 'Cthulhu', 'Folk horror', 'Campus ghost story', 'Urban legend'] },
  { key: 'era', label: 'Era', options: ['Modern', 'Early 20th century', 'Ancient', 'Near future'] },
  { key: 'place', label: 'Place', options: ['Village', 'Hospital', 'School', 'Inn', 'Abandoned building', 'Mountain temple'] },
  { key: 'style', label: 'Style', options: ['Investigation', 'Psychological horror', 'Survival horror', 'Twist mystery'] },
  { key: 'difficulty', label: 'Difficulty', options: ['Normal', 'Hard', 'High lethality'] },
  { key: 'duration', label: 'Length', options: ['1 hour', '2-3 hours', '4 hours+'] },
];

export default function ModuleSelection(props: ShellProps) {
  const lang = props.room.language || 'zh';
  const en = EN(lang);
  const FIELDS = en ? FIELDS_EN : FIELDS_ZH;
  const modules: any[] = props.room.module_options || [];
  const generating = props.room.modules_generating;
  const [busy, setBusy] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const triggered = useRef(false);

  useEffect(() => {
    if (modules.length === 0 && !generating && props.mySeat === 'A' && !triggered.current) {
      triggered.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(customDirection?: Record<string, string>) {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/modules/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id, customDirection: customDirection || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Generation failed' : '生成失败'));
      setShowCustom(false);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function select(moduleId: string) {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/modules/select', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id, moduleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Selection failed' : '选择失败'));
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { try { audioRef.current?.pause(); } catch {} }, []);
  async function listen(m: any) {
    try { audioRef.current?.pause(); } catch {}
    if (playing === m.id) { setPlaying(null); return; }
    setPlaying(m.id);
    let url = m.hook_audio as string | undefined;
    if (!url) {
      try { const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, text: `${m.title}。${m.hook}`, narrator: true, lang }) }); url = (await r.json())?.url; } catch {}
    }
    if (!url) { setPlaying(null); return; }
    const a = new Audio(url); audioRef.current = a; a.onended = () => setPlaying(null); a.onerror = () => setPlaying(null); a.play().catch(() => setPlaying(null));
  }

  const Over = ({ children }: { children: ReactNode }) => <div className="text-[10.5px] tracking-[.4em] pl-[.4em] uppercase text-[#c9a96e]/75">{children}</div>;

  if (generating || (modules.length === 0 && busy)) {
    return (
      <div className="w-full flex flex-col items-center gap-6 pt-4">
        <div className="text-center"><Over>{en ? 'The Keeper is writing' : '守秘人正在构思'}</Over><h1 className="mt-2 font-serif text-[24px] text-[#efe6d2]">{en ? 'Three stories for tonight' : '今晚的三个故事'}</h1></div>
        <div className="w-full flex gap-3.5 overflow-hidden px-1">
          {[0, 1, 2].map((k) => <div key={k} className="shrink-0 w-[78vw] max-w-[300px] h-[380px] rounded-2xl border border-[#d8c7a8]/[0.1] bg-gradient-to-b from-white/[0.04] to-transparent animate-pulse" style={{ animationDelay: `${k * 200}ms` }} />)}
        </div>
        {props.mySeat === 'A' && <button onClick={() => generate()} disabled={busy} className="text-[12px] text-parchment/40 hover:text-parchment/70">{en ? 'Taking too long? Retry' : '太久了？重试一下'}</button>}
        {err && <p className="text-[#e06060] text-sm">{err}</p>}
      </div>
    );
  }

  if (modules.length === 0) {
    const isHost = props.mySeat === 'A';
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center pt-10">
        <p className="font-serif text-parchment/65">{isHost ? (en ? 'The stories didn’t finish.' : '故事没写完。') : (en ? 'Waiting for the host…' : '等房主开始……')}</p>
        {isHost && <button onClick={() => generate()} disabled={busy} className="px-6 py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.12em] disabled:opacity-50">{busy ? (en ? 'Writing…' : '正在写…') : (en ? 'Write three stories' : '写三个故事')}</button>}
        {err && <p className="text-[#e06060] text-sm">{err}</p>}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 pt-2">
      <div className="text-center px-4">
        <Over>{en ? 'Step 1 · Pick a story' : '第一步 · 选一个故事'}</Over>
        <h1 className="mt-2 font-serif font-semibold text-[25px] sm:text-[30px] text-[#efe6d2]">{en ? 'Which one tonight?' : '今晚，走进哪一个？'}</h1>
        <p className="mt-1.5 text-[12.5px] text-parchment/45">{en ? 'Swipe · tap 🔊 to hear the Keeper' : '左右滑动 · 点「听」让守秘人读给你'}</p>
      </div>

      <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory px-[9vw] sm:px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center sm:flex-wrap sm:overflow-visible">
        {modules.map((m, k) => (
          <PosterCard key={m.id} m={m} index={k} total={modules.length} en={en} footer={
            <div className="flex items-center gap-2.5">
              <button onClick={() => listen(m)} className="shrink-0 h-11 px-4 rounded-xl border border-white/20 bg-black/20 text-[13px] text-white/85 flex items-center gap-2">
                {playing === m.id ? <span className="flex items-end gap-[2px] h-3">{[0, 1, 2].map((x) => <span key={x} className="w-[2px] rounded-full bg-white/80 mn-eq" style={{ animationDelay: `${x * 0.15}s`, animationDuration: '.6s' }} />)}</span> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" /></svg>}
                {playing === m.id ? (en ? 'Stop' : '停') : (en ? 'Listen' : '听')}
              </button>
              <button onClick={() => select(m.id)} disabled={busy} className="flex-1 h-11 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.12em] disabled:opacity-50">{busy ? '…' : (en ? 'This one' : '就这个')}</button>
            </div>
          } />
        ))}
      </div>

      <div className="flex items-center justify-center gap-5 text-[13px]">
        <button onClick={() => generate()} disabled={busy} className="text-parchment/55 hover:text-parchment disabled:opacity-50">{en ? '↻ Three more' : '↻ 换三个'}</button>
        <span className="w-px h-3 bg-parchment/15" />
        <button onClick={() => setShowCustom(true)} disabled={busy} className="text-parchment/55 hover:text-parchment disabled:opacity-50">{en ? 'Set a direction' : '按我的口味写'}</button>
      </div>
      {err && <p className="text-[#e06060] text-sm text-center">{err}</p>}

      {showCustom && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowCustom(false)}>
          <div className="w-full sm:max-w-md max-h-[88svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#0f1013] border border-[#d8c7a8]/15 px-5 pt-5 space-y-4 text-left" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div><div className="font-serif text-lg text-[#efe6d2]">{en ? 'Your kind of story' : '按你的口味写'}</div><p className="mt-1 text-[12px] text-parchment/45">{en ? 'Only sets the mood — never the truth or the ending.' : '只决定风格和氛围，不会让你提前知道真相或结局。'}</p></div>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <div className="text-[12px] tracking-wider text-parchment/45 mb-1.5">{f.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {[en ? 'Any' : '不限', ...f.options].map((o, oi) => {
                    const v = oi === 0 ? '' : o; const on = (custom[f.key] || '') === v;
                    return <button key={o} onClick={() => setCustom({ ...custom, [f.key]: v })} className={`px-3 py-1.5 rounded-lg text-[13px] border ${on ? 'bg-[#c9a96e]/[0.16] border-[#c9a96e]/50 text-[#efe6d2]' : 'border-[#d8c7a8]/[0.12] text-parchment/55'}`}>{o}</button>;
                  })}
                </div>
              </div>
            ))}
            <input value={custom.forbidden || ''} onChange={(e) => setCustom({ ...custom, forbidden: e.target.value })} placeholder={en ? 'Anything to avoid? (optional)' : '不想出现的内容？（可不填）'} className="w-full px-4 py-3 rounded-xl bg-ink border border-[#d8c7a8]/15 text-parchment placeholder:text-parchment/35 outline-none focus:border-[#c9a96e]/50" />
            <button onClick={() => generate(custom)} disabled={busy} className="w-full py-3.5 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.15em] disabled:opacity-50">{en ? 'Write these' : '按这个写'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
