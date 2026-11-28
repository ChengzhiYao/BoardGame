'use client';
// 站长:推广人列表,待付金额,标记已付,调整分成比例 / 期限
import { useEffect, useState } from 'react';
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
export default function AdminPartners() {
  const [d, setD] = useState<any>(null);
  async function load() { const r = await fetch('/api/ref/admin', { cache: 'no-store' }); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  async function act(body: any) { await fetch('/api/ref/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); load(); }
  if (!d) return <main className="p-6 text-parchment/40">…</main>;
  if (!d.ok) return <main className="p-6 text-parchment/60">无权限</main>;
  return (
    <main className="min-h-screen bg-[#0b0c0f] text-parchment p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center justify-between"><h1 className="font-serif text-xl text-[#efe6d2]">推广人</h1><a href="/partner" className="text-sm text-[#c9a96e]">← 推广页</a></div>
        {!d.partners.length && <p className="text-parchment/50 text-sm">还没有人生成推广链接。推广页面:mystnight.com/partner</p>}
        {d.partners.map((p: any) => (
          <div key={p.code} className="rounded-xl border border-white/10 bg-[#121318] p-4 text-[13.5px]">
            <div className="flex flex-wrap justify-between gap-2"><div><b className="text-[#efe6d2]">{p.code}</b> · {p.email}</div><div className="text-parchment/50">点击 {p.clicks} · 注册 {p.signups} · 付费 {p.paying}</div></div>
            <div className="mt-2 flex flex-wrap gap-4"><span>总 {usd(p.earned)}</span><span className="text-[#e6c76e]">待付 {usd(p.pending)}</span><span className="text-parchment/50">已付 {usd(p.paid)}</span><span className="text-parchment/50">收款:{p.payout || '(没填)'}</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.pending > 0 && <button onClick={() => { if (confirm(`确认已经给 ${p.email} 打款 ${usd(p.pending)}?`)) act({ action: 'paid', code: p.code }); }} className="px-3 py-1.5 rounded-lg bg-[#c9a96e] text-[#1a140a] font-semibold">标记已付 {usd(p.pending)}</button>}
              <span className="text-parchment/50">分成</span>
              <input defaultValue={Math.round(p.rate * 100)} id={`r_${p.code}`} className="w-14 bg-black/30 border border-white/10 rounded px-2 py-1" />%
              <span className="text-parchment/50">前</span>
              <input defaultValue={p.months} id={`m_${p.code}`} className="w-14 bg-black/30 border border-white/10 rounded px-2 py-1" />个月
              <button onClick={() => act({ action: 'terms', code: p.code, rate: Number((document.getElementById(`r_${p.code}`) as HTMLInputElement).value) / 100, months: Number((document.getElementById(`m_${p.code}`) as HTMLInputElement).value) })} className="px-3 py-1.5 rounded-lg border border-white/15">保存</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
