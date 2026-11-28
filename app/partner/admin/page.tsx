'use client';
// 站长:加合作方(邀请制,用对方邮箱),合作方列表,待付金额,标记已付,调整分成比例 / 期限
import { useEffect, useState } from 'react';
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
export default function AdminPartners() {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState({ email: '', name: '', code: '', rate: '40', months: '3', note: '' }); const [msg, setMsg] = useState('');
  async function load() { const r = await fetch('/api/ref/admin', { cache: 'no-store' }); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  async function act(body: any) { const r = await fetch('/api/ref/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => ({})); load(); return r; }
  async function add() {
    setMsg('');
    const r: any = await act({ action: 'create', email: f.email, name: f.name, code: f.code, rate: Number(f.rate) / 100, months: Number(f.months), note: f.note });
    if (r?.ok) { setMsg(`已加好:mystnight.com/?ref=${r.code} · 让对方用 ${f.email} 登录 mystnight.com/partner`); setF({ email: '', name: '', code: '', rate: '40', months: '3', note: '' }); }
    else setMsg(r?.reason === 'taken' ? '代码已被用' : r?.reason === 'exists' ? '这个邮箱已经是合作方' : r?.reason === 'email' ? '邮箱不对' : '失败:' + (r?.reason || ''));
  }
  const inp = 'bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-[13.5px] outline-none focus:border-[#c9a96e]/60';
  if (!d) return <main className="p-6 text-parchment/40">…</main>;
  if (!d.ok) return <main className="p-6 text-parchment/60">无权限</main>;
  return (
    <main className="min-h-screen bg-[#0b0c0f] text-parchment p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center justify-between"><h1 className="font-serif text-xl text-[#efe6d2]">合作方</h1><a href="/partner" className="text-sm text-[#c9a96e]">← 合作方看到的页面</a></div>
        <div className="rounded-xl border border-[#c9a96e]/30 bg-[#121318] p-4 space-y-2.5">
          <div className="text-[14px] text-[#efe6d2]">加一个合作方(只有加进来的人才有链接,页面不公开)</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="对方登录用的邮箱" className={`${inp} col-span-2`} />
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="显示名(如 大範)" className={inp} />
            <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="链接代码(如 dafan)" className={inp} />
            <label className="flex items-center gap-1.5 text-[13px] text-parchment/60">分成 <input value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} className={`${inp} w-16`} />%</label>
            <label className="flex items-center gap-1.5 text-[13px] text-parchment/60">前 <input value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} className={`${inp} w-16`} />个月</label>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="备注(只有你看得到,如:固定费 $200 已付一半)" className={`${inp} col-span-2`} />
          </div>
          <button onClick={add} disabled={!f.email} className="px-4 py-2 rounded-lg bg-[#c9a96e] text-[#1a140a] font-semibold disabled:opacity-40">加好并生成链接</button>
          {msg && <div className="text-[13px] text-[#e6c76e] break-all">{msg}</div>}
        </div>
        {!d.partners.length && <p className="text-parchment/50 text-sm">还没有合作方。</p>}
        {d.partners.map((p: any) => (
          <div key={p.code} className="rounded-xl border border-white/10 bg-[#121318] p-4 text-[13.5px]">
            <div className="flex flex-wrap justify-between gap-2"><div><b className="text-[#efe6d2]">{p.name || p.code}</b> · mystnight.com/?ref={p.code} · {p.email}{!p.bound && <span className="ml-1 text-parchment/40">(还没登录过)</span>}{p.note && <div className="text-[12px] text-parchment/45 mt-0.5">{p.note}</div>}</div><div className="text-parchment/50">点击 {p.clicks} · 注册 {p.signups} · 付费 {p.paying}</div></div>
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
