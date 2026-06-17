'use client';
import { useEffect, useRef, useState } from 'react';
import type { ShellProps } from './RoomShell';

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

  if (generating || (modules.length === 0 && busy)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
        <p className="text-parchment/60">{en ? 'The Keeper is dreaming up 3 original modules…' : '守秘人正在构思 3 个原创模组……'}</p>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-parchment/60">{en ? 'Waiting for the host to generate modules…' : '等待房主生成模组选项……'}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl flex flex-col gap-5">
      <h1 className="text-xl font-serif text-parchment text-center">{en ? 'Choose an investigation module' : '选择一个调查模组'}</h1>
      <p className="text-center text-parchment/50 text-sm">
        {en ? 'Discuss together, then either player picks. The truth is generated and locked once chosen.' : '两名玩家协商后，由任意一人点击选择。真相会在选定后于后台生成并锁定。'}
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        {modules.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 p-4 rounded-lg bg-fog border border-eldritch/30 hover:border-eldritch transition">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-lg text-parchment">{m.title}</h2>
              {m.genre && <span className="text-[10px] px-1.5 py-0.5 rounded bg-eldritch/20 border border-eldritch/40 text-eldritch">{m.genre}</span>}
              {m.from_library && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 border border-green-700/40 text-green-400">
                  {en ? '✓ Verified' : '✓ 已验证'}{m.quality_score ? ` · ${m.quality_score}${en ? '' : '分'}` : ''}
                </span>
              )}
            </div>
            <p className="text-eldritch text-sm italic">{m.tagline}</p>
            <p className="text-parchment/70 text-sm leading-relaxed flex-1">{m.hook}</p>
            <div className="text-xs text-parchment/40 space-y-0.5">
              <div>{en ? 'Era' : '时代'}：{m.era} ｜ {en ? 'Place' : '地点'}：{m.place}</div>
              <div>{en ? 'Difficulty' : '难度'}：{m.difficulty} ｜ {en ? 'Length' : '时长'}：{m.duration}</div>
            </div>
            <button onClick={() => select(m.id)} disabled={busy}
              className="mt-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm disabled:opacity-50">
              {en ? 'Pick this one' : '选择这个'}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={() => generate()} disabled={busy}
          className="px-4 py-2 rounded bg-fog border border-eldritch/40 text-parchment text-sm hover:bg-eldritch/20 disabled:opacity-50">
          {en ? 'Regenerate 3' : '重新生成 3 个'}
        </button>
        <button onClick={() => setShowCustom((v) => !v)} disabled={busy}
          className="px-4 py-2 rounded bg-fog border border-parchment/30 text-parchment text-sm hover:bg-parchment/10 disabled:opacity-50">
          {en ? 'Custom direction' : '自定义模组方向'}
        </button>
      </div>

      {showCustom && (
        <div className="p-4 rounded-lg bg-ink border border-eldritch/30 flex flex-col gap-4">
          <p className="text-xs text-parchment/50">
            {en ? 'Customization only affects style and mood — it never lets you decide the truth, killer, monster or ending.' : '自定义只影响风格与氛围，不会让你决定真相、凶手、怪物或结局。'}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm text-parchment/70">
                {f.label}
                <select value={custom[f.key] || ''} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })}
                  className="px-2 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment">
                  <option value="">{en ? 'Any' : '不限'}</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            {en ? 'Forbidden content (things to avoid)' : '禁止内容（不想出现的元素）'}
            <input value={custom.forbidden || ''} onChange={(e) => setCustom({ ...custom, forbidden: e.target.value })}
              placeholder={en ? 'e.g. not too gory, nothing involving children' : '例如：不要太血腥、不要儿童相关'}
              className="px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30" />
          </label>
          <button onClick={() => generate(custom)} disabled={busy}
            className="self-start px-5 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">
            {en ? 'Generate in this direction' : '按这个方向生成'}
          </button>
        </div>
      )}

      {err && <p className="text-blood text-sm text-center">{err}</p>}
    </div>
  );
}
