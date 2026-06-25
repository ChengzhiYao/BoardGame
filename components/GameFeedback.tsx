'use client';
import { useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';

type Item = { name: string | null; rating: number | null; message: string; created_at: string };

export default function GameFeedback({ slug, en }: { slug: string; en: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function load() { try { const r = await fetch(`/api/feedback?slug=${encodeURIComponent(slug)}`); const d = await r.json(); setItems(d.items || []); } catch {} }
  useEffect(() => { load(); }, [slug]);

  async function submit() {
    const msg = message.trim();
    if (!msg) return;
    setBusy(true);
    try {
      await ensureSession(name.trim() || undefined);
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, name: name.trim(), message: msg, rating }) });
      if (r.ok) { setMessage(''); setRating(0); setDone(true); await load(); setTimeout(() => setDone(false), 2500); }
    } finally { setBusy(false); }
  }

  return (
    <section className="border-t border-eldritch/20 pt-8">
      <h2 className="font-serif text-xl text-parchment mb-1">{en ? 'Player feedback' : '玩家留言'}</h2>
      <p className="text-parchment/45 text-sm mb-5">{en ? 'Played it? Leave your thoughts and help shape this game.' : '玩过这个游戏？留下你的想法，帮我们把它做得更好。'}</p>

      <div className="rounded-xl border border-eldritch/25 bg-fog/40 p-4 mb-6">
        <div className="flex gap-2 mb-2 items-center">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={en ? 'Your name (optional)' : '昵称（可选）'} className="flex-1 min-w-0 px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch" />
          <div className="flex items-center gap-0.5 shrink-0">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} className={`text-lg ${n <= rating ? 'text-amber-400' : 'text-parchment/25'}`}>★</button>)}
          </div>
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder={en ? 'Your feedback…' : '写下你的反馈…'} className="w-full px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch resize-none" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-eldritch">{done ? (en ? 'Thanks! Posted ✓' : '已提交，谢谢 ✓') : ''}</span>
          <button onClick={submit} disabled={busy || !message.trim()} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm border border-blood disabled:opacity-50">{busy ? (en ? 'Posting…' : '提交中…') : (en ? 'Post' : '发表留言')}</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <div className="text-parchment/35 text-sm">{en ? 'No feedback yet — be the first.' : '还没有留言，来做第一个。'}</div>}
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-eldritch/20 bg-fog/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-parchment text-sm font-medium">{it.name || (en ? 'Anonymous' : '匿名玩家')}</span>
              {it.rating ? <span className="text-amber-400 text-xs">{'★'.repeat(it.rating)}</span> : null}
              <span className="text-parchment/30 text-[11px] ml-auto">{new Date(it.created_at).toLocaleDateString()}</span>
            </div>
            <div className="text-parchment/75 text-sm leading-relaxed whitespace-pre-wrap">{it.message}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
