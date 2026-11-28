'use client';
// 推广计划:生成自己的推广链接,看点击 / 注册 / 付费 / 收入,填收款方式。简中 / 繁中 / 英文
import { useEffect, useState } from 'react';
import { signInWithGoogle, sendEmailOtp, verifyEmailOtp } from '@/lib/auth';

type Lg = 'zh' | 'tw' | 'en';
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const Card = ({ children, className = '' }: any) => <div className={`rounded-2xl border border-[#c9a96e]/20 bg-[#121318]/90 p-5 ${className}`}>{children}</div>;

export default function Partner() {
  const [lg, setLg] = useState<Lg>('zh');
  const [d, setD] = useState<any>(null);
  const [code, setCode] = useState('');
  const [payout, setPayout] = useState('');
  const [method, setMethod] = useState('PayPal');
  const [acct, setAcct] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [sent, setSent] = useState(false);
  const T = (zh: string, tw: string, en: string) => (lg === 'en' ? en : lg === 'tw' ? tw : zh);
  async function load() { const r = await fetch('/api/ref/me', { cache: 'no-store' }); const j = await r.json(); setD(j); setPayout(j?.partner?.payout || ''); }
  useEffect(() => {
    const n = (navigator.language || '').toLowerCase();
    setLg(/^zh-(tw|hk|mo|hant)/.test(n) ? 'tw' : n.startsWith('zh') ? 'zh' : 'en');
    load();
  }, []);
  async function create() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/ref/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', code, payout: `${method}: ${acct.trim()}` }) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) setMsg(j.reason === 'taken' ? T('这个代码已经被用了,换一个', '這個代碼已經被使用,請換一個', 'That code is taken — try another') : j.reason === 'payout' ? T('先填收款账号', '請先填寫收款帳號', 'Enter where we should pay you') : j.reason === 'short' ? T('代码至少 3 个字符', '代碼至少 3 個字元', 'At least 3 characters') : T('出错了,再试一次', '出錯了,請再試一次', 'Something went wrong'));
    await load(); setBusy(false);
  }
  async function savePayout() { setBusy(true); await fetch('/api/ref/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payout', payout }) }); setMsg(T('已保存', '已儲存', 'Saved')); setBusy(false); }
  const p = d?.partner; const s = d?.stats;
  const rate = p ? Math.round(p.rate * 100) : 40; const months = p?.months || 3;
  const inp = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-[#c9a96e]/60 text-[14px] text-parchment placeholder:text-parchment/30';
  const gold = 'bg-gradient-to-b from-[#ecd08f] to-[#c9a96e] text-[#1a140a] font-semibold';
  const whatName = (w?: string) => !w ? '' : w.startsWith('member_') || w.startsWith('renew_') ? T('会员', '會員', 'Membership') : w.startsWith('card') ? T('会员卡', '會員卡', 'Membership card') : w === 'party3h' ? T('派对包', '派對包', 'Party pass') : w === 'light1' ? T('单局', '單局', 'Single game') : w === 'pass2h' ? T('畅玩卡', '暢玩卡', 'Play pass') : w === 'custom1' ? T('定制剧本', '客製劇本', 'Custom script') : w.startsWith('games') ? T('豪华局', '豪華局', 'Premium games') : w;

  return (
    <main className="min-h-screen bg-[#0b0c0f] text-parchment" style={{ backgroundImage: 'radial-gradient(100% 50% at 50% 0%, rgba(201,169,110,.12), transparent 60%)' }}>
      <div className="max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-16 space-y-4">
        <div className="flex justify-between items-center px-1">
          <a href="/" className="font-serif text-[16px] text-[#efe6d2]">{lg === 'en' ? 'MystNight' : lg === 'tw' ? '謎夜' : '谜夜'} <span className="text-[11px] tracking-[.25em] text-[#c9a96e]/70 ml-1">PARTNERS</span></a>
          <div className="flex gap-1 text-[12px]">{(['zh', 'tw', 'en'] as Lg[]).map((k) => <button key={k} onClick={() => setLg(k)} className={`px-2 py-1 rounded-full ${lg === k ? 'bg-[#c9a96e]/20 text-[#e6c76e]' : 'text-parchment/40'}`}>{k === 'zh' ? '简' : k === 'tw' ? '繁' : 'EN'}</button>)}</div>
        </div>
        <Card>
          <h1 className="font-serif text-[22px] text-[#efe6d2]">{T('推荐谜夜,赚分成', '推薦謎夜,賺分潤', 'Share MystNight, earn commission')}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-parchment/70">{T(`用你的专属链接推荐别人。通过你的链接注册的玩家,前 ${months} 个月里每一笔付款(会员、派对包、单局都算),你都拿 ${rate}%。`, `用你的專屬連結推薦別人。透過你的連結註冊的玩家,前 ${months} 個月內每一筆付款(會員、派對包、單局都算),你都可以獲得 ${rate}%。`, `Share your personal link. For every player who signs up through it, you earn ${rate}% of every payment they make in their first ${months} months — memberships, party passes and single games all count.`)}</p>
          <ol className="mt-4 space-y-2 text-[13.5px] text-parchment/80">
            {[T('生成你的专属链接', '建立你的專屬連結', 'Get your personal link'), T('放到视频简介、置顶评论、社群、群聊', '放在影片說明欄、置頂留言、社群、群組', 'Put it in video descriptions, pinned comments, posts and group chats'), T('有人通过链接注册并付款,自动记到你名下,每月结算,没有最低门槛', '有人透過連結註冊並付款,系統自動記錄,每月結算,沒有最低提現門檻', 'Signups and payments are tracked automatically — paid out monthly, no minimum')].map((t, i) => <li key={i} className="flex gap-3"><span className={`w-6 h-6 shrink-0 rounded-full text-[12px] flex items-center justify-center ${gold}`}>{i + 1}</span><span className="pt-0.5">{t}</span></li>)}
          </ol>
        </Card>

        {!d ? <Card><div className="text-parchment/40 text-sm">…</div></Card> : !d.loggedIn ? (
          <Card>
            <div className="text-[14px] text-parchment/80 mb-3">{T('先登录,再生成你的推广链接', '請先登入,再建立你的推薦連結', 'Sign in to get your link')}</div>
            <button onClick={() => signInWithGoogle('/partner')} className={`w-full py-3 rounded-xl ${gold}`}>{T('用 Google 登录', '使用 Google 登入', 'Continue with Google')}</button>
            {!sent ? (
              <div className="flex gap-2 mt-3"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={T('或者用邮箱', '或使用 Email', 'or your email')} className={inp} />
                <button disabled={!email || busy} onClick={async () => { setBusy(true); try { await sendEmailOtp(email.trim()); setSent(true); } catch (e: any) { setMsg(e.message); } setBusy(false); }} className="px-4 shrink-0 rounded-xl border border-white/15 text-[13px]">{T('发验证码', '寄驗證碼', 'Send code')}</button></div>
            ) : (
              <div className="flex gap-2 mt-3"><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder={T('邮箱里的验证码', '信箱裡的驗證碼', 'Code from email')} className={inp} />
                <button disabled={!otp || busy} onClick={async () => { setBusy(true); try { await verifyEmailOtp(email.trim(), otp.trim()); await load(); } catch (e: any) { setMsg(e.message); } setBusy(false); }} className="px-4 shrink-0 rounded-xl border border-white/15 text-[13px]">{T('登录', '登入', 'Sign in')}</button></div>
            )}
          </Card>
        ) : !p ? (
          <Card>
            <div className="text-[14px] text-[#efe6d2] mb-2">{T('1. 收款方式', '1. 收款方式', '1. How should we pay you?')}</div>
            <div className="flex flex-wrap gap-2 mb-2">{['PayPal', 'Wise', T('银行转账', '銀行轉帳', 'Bank transfer'), T('其他', '其他', 'Other')].map((m) => <button key={m} onClick={() => setMethod(m)} className={`px-3 py-1.5 rounded-full border text-[13px] ${method === m ? 'border-[#c9a96e] bg-[#c9a96e]/15 text-[#e6c76e]' : 'border-white/10 text-parchment/60'}`}>{m}</button>)}</div>
            <input value={acct} onChange={(e) => setAcct(e.target.value)} placeholder={method === 'PayPal' ? T('PayPal 邮箱', 'PayPal 信箱', 'PayPal email') : method === 'Wise' ? T('Wise 邮箱', 'Wise 信箱', 'Wise email') : T('收款方式和账号', '收款方式和帳號', 'Payment method and account')} className={`${inp} mb-5`} />
            <div className="text-[14px] text-[#efe6d2] mb-2">{T('2. 链接代码(选填,不填就随机)', '2. 連結代碼(選填,不填則隨機)', '2. Link code (optional)')}</div>
            <div className="flex items-center gap-1 text-[14px]"><span className="text-parchment/40 shrink-0">mystnight.com/?ref=</span><input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24))} placeholder="yourname" className={inp} /></div>
            <button disabled={busy || acct.trim().length < 3} onClick={create} className={`mt-4 w-full disabled:opacity-50 py-3 rounded-xl ${gold}`}>{T('生成我的推广链接', '建立我的推薦連結', 'Create my link')}</button>
          </Card>
        ) : (<>
          <Card>
            <div className="text-[11px] tracking-[.25em] text-[#c9a96e]/70 mb-2">{T('你的推广链接', '你的推薦連結', 'YOUR LINK')}</div>
            <div className="text-[14px] break-all text-[#efe6d2] bg-black/30 border border-white/10 rounded-lg px-3 py-2.5">{p.link}</div>
            <button onClick={async () => { try { if ((navigator as any).share) await (navigator as any).share({ url: p.link }); else { await navigator.clipboard.writeText(p.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } } catch {} }} className={`mt-3 w-full py-2.5 rounded-xl ${gold}`}>{copied ? T('已复制', '已複製', 'Copied') : T('复制 / 分享', '複製 / 分享', 'Copy / Share')}</button>
            <p className="mt-3 text-[12px] text-parchment/50">{T(`分成 ${rate}% · 对方注册后的前 ${months} 个月 · 点开链接后 30 天内注册都算你的`, `分潤 ${rate}% · 對方註冊後的前 ${months} 個月 · 點開連結後 30 天內註冊都算你的`, `${rate}% commission · first ${months} months after signup · 30-day attribution window`)}</p>
          </Card>
          <Card>
            <div className="text-[11px] tracking-[.25em] text-[#c9a96e]/70 mb-3">{T('数据', '數據', 'STATS')}</div>
            <div className="grid grid-cols-3 gap-2.5 text-center">
              {[[T('点击', '點擊', 'Clicks'), p.clicks], [T('注册', '註冊', 'Signups'), s?.signups ?? 0], [T('付费玩家', '付費玩家', 'Paying'), s?.paying ?? 0]].map(([k, v]) => <div key={String(k)} className="rounded-xl bg-black/25 border border-white/[0.06] py-3"><div className="font-serif text-[20px] text-[#efe6d2]">{v}</div><div className="text-[11.5px] text-parchment/45 mt-0.5">{k}</div></div>)}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
              {[[T('总收入', '總收入', 'Earned'), usd(s?.earned || 0)], [T('待结算', '待結算', 'Pending'), usd(s?.pending || 0)], [T('已付', '已付', 'Paid'), usd(s?.paid || 0)]].map(([k, v], i) => <div key={String(k)}><div className={`font-serif text-[17px] ${i === 1 ? 'text-[#e6c76e]' : 'text-[#efe6d2]'}`}>{v}</div><div className="text-[11.5px] text-parchment/45">{k}</div></div>)}
            </div>
            {!!s?.recent?.length && (
              <div className="mt-4 border-t border-white/[0.06] pt-3 space-y-1.5">
                {s.recent.map((r: any, i: number) => <div key={i} className="flex justify-between text-[12.5px]"><span className="text-parchment/55">{new Date(r.at).toLocaleDateString()} · {whatName(r.what)} {usd(r.amount)}</span><span className={r.status === 'reversed' ? 'text-parchment/30 line-through' : r.status === 'paid' ? 'text-parchment/60' : 'text-[#e6c76e]'}>+{usd(r.commission)}</span></div>)}
              </div>
            )}
            <p className="mt-3 text-[11.5px] text-parchment/40">{T('每月结算一次,没有最低打款门槛,当月有多少打多少。', '每月結算一次,沒有最低提現門檻,當月有多少就付多少。', 'Paid monthly, no minimum — whatever you earned that month.')}</p>
          </Card>
          <Card>
            <div className="text-[11px] tracking-[.25em] text-[#c9a96e]/70 mb-2">{T('收款方式', '收款方式', 'HOW TO PAY YOU')}</div>
            <input value={payout} onChange={(e) => setPayout(e.target.value)} placeholder={T('比如:PayPal 邮箱', '例如:PayPal 信箱', 'e.g. PayPal email')} className={inp} />
            <button disabled={busy} onClick={savePayout} className="mt-3 px-4 py-2 rounded-lg border border-white/15 text-[13.5px]">{T('保存', '儲存', 'Save')}</button>
          </Card>
        </>)}
        {d?.isAdmin && <a href="/partner/admin" className="block text-center text-[13px] text-[#c9a96e] underline">{T('站长:所有推广人 / 打款', '站長:所有推薦人 / 付款', 'Owner: all partners / payouts')}</a>}
        {msg && <p className="text-center text-[13px] text-parchment/60">{msg}</p>}
        <p className="text-center text-[11px] text-parchment/35 px-4">{T('自己推荐自己、刷单等不计入。分成按对方实际付款金额计算,退款的订单会扣回。', '自己推薦自己、灌單等不列入計算。分潤依實際付款金額計算,退款的訂單會扣回。', 'Self-referrals and abuse are not eligible. Commission is based on amounts actually paid; refunded payments are reversed.')}</p>
      </div>
    </main>
  );
}
