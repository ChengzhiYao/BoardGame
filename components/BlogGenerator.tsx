'use client';
import { useEffect, useState } from 'react';

export default function BlogGenerator({ lang }: { lang: 'zh' | 'en' }) {
  const en = lang === 'en';
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);
  const [pub, setPub] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => { fetch('/api/admin/stats').then((r) => setAdmin(r.ok)).catch(() => {}); }, []);
  if (!admin) return null;

  async function generate() {
    if (!topic.trim()) return;
    setBusy(true); setErr(''); setDraft(null);
    try {
      const r = await fetch('/api/blog/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, keywords, lang }) });
      const d = await r.json();
      if (r.ok && d.draft) setDraft(d.draft); else setErr(d.error || (en ? 'Failed' : '生成失败'));
    } catch { setErr(en ? 'Network error' : '网络错误'); } finally { setBusy(false); }
  }
  async function publish() {
    if (!draft) return;
    setPub(true); setErr('');
    try {
      const r = await fetch('/api/blog/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, score: draft.rating?.overall }) });
      const d = await r.json();
      if (r.ok && d.url) { window.location.href = d.url; } else setErr(d.error || (en ? 'Publish failed' : '发布失败'));
    } catch { setErr(en ? 'Network error' : '网络错误'); } finally { setPub(false); }
  }

  const rating = draft?.rating;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 mb-6">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-amber-300 text-sm font-medium">✨ {en ? 'AI blog generator (admin)' : 'AI 博客生成器（管理员）'}</button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between"><span className="text-amber-300 text-sm font-medium">✨ {en ? 'AI blog generator' : 'AI 博客生成器'}</span><button onClick={() => setOpen(false)} className="text-parchment/40 text-base leading-none">×</button></div>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={en ? 'Topic — what to write about' : '主题 / 想写什么（如：AI 海龟汤怎么玩）'} className="w-full px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={en ? 'Target keywords (optional)' : '目标关键词（可选，逗号分隔）'} className="w-full px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={generate} disabled={busy || !topic.trim()} className="px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm border border-blood disabled:opacity-50">{busy ? (en ? 'Generating…' : '生成中…（约 20s）') : draft ? (en ? '↻ Regenerate' : '↻ 重新生成') : (en ? 'Generate' : '生成')}</button>
            {draft && <button onClick={publish} disabled={pub} className="px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">{pub ? (en ? 'Publishing…' : '发布中…') : (en ? 'Publish (auto bilingual)' : '满意，发布（自动出双语）')}</button>}
          </div>
          {err && <div className="text-blood text-sm">{err}</div>}
          {draft && (
            <div className="rounded-lg border border-eldritch/25 bg-ink/50 p-4 mt-1">
              {rating && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-serif text-amber-300">{rating.overall}</span>
                  <span className="text-parchment/40 text-xs">/ 100{rating.cap ? ` · ${en ? 'capped at' : '封顶'} ${rating.cap}` : ''}</span>
                  <span className="text-parchment/50 text-xs flex-1 text-right truncate">{rating.verdict || ''}</span>
                </div>
              )}
              {rating?.dimensions && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                  {rating.dimensions.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]"><span className="text-parchment/50 w-16 shrink-0 truncate">{d.label}</span><div className="flex-1 h-1 rounded bg-fog overflow-hidden"><div className="h-full bg-eldritch" style={{ width: `${(d.score / 10) * 100}%` }} /></div><span className="text-parchment/40 w-4 text-right">{d.score}</span></div>
                  ))}
                </div>
              )}
              {rating?.improve && <div className="text-parchment/45 text-xs mb-3">💡 {rating.improve}</div>}
              <div className="text-parchment text-lg font-serif mb-1">{draft.title}</div>
              <div className="text-parchment/50 text-sm mb-2">{draft.excerpt}</div>
              <div className="text-[11px] text-parchment/30 mb-2">/{lang}/blog/{draft.slug}</div>
              <div className="blog-body text-parchment/75 text-sm leading-relaxed space-y-3 max-h-80 overflow-y-auto border-t border-eldritch/15 pt-3" dangerouslySetInnerHTML={{ __html: draft.html }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
