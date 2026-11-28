'use client';
// 合作伙伴后台(邀请制):站长手动加的合作方用受邀邮箱登录后,看自己的专属链接、数据、收入,填收款方式。简中 / 繁中 / 英文。
// 不公开、不介绍成「人人可参加的推广计划」:没被邀请的人只看到「没有合作资料」。
import { useEffect, useState } from 'react';
import { signInWithGoogle, sendEmailOtp, verifyEmailOtp } from '@/lib/auth';

type Lg = 'zh' | 'tw' | 'en';
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const Card = ({ children, className = '' }: any) => <div className={`rounded-2xl border border-[#c9a96e]/20 bg-[#121318]/90 p-5 ${className}`}>{children}</div>;

export default function Partner() {
  const [lg, setLg] = useState<Lg>('zh');
  const [d, setD] = useState<any>(null);
  const [payout, setPayout] = useState('');
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
          <a href="/" className="font-serif text-[16px] text-[#efe6d2]">{lg === 'en' ? 'MystNight' : lg === 'tw' ? '謎夜' : '谜夜'} <span className="text-[11px] tracking-[.25em] text-[#c9a96e]/70 ml-1">PARTNER</span></a>
          <div className="flex gap-1 text-[12px]">{(['zh', 'tw', 'en'] as Lg[]).map((k) => <button key={k} onClick={() => setLg(k)} className={`px-2 py-1 rounded-full ${lg === k ? 'bg-[#c9a96e]/20 text-[#e6c76e]' : 'text-parchment/40'}`}>{k === 'zh' ? '简' : k === 'tw' ? '繁' : 'EN'}</button>)}</div>
        </div>
        {!d ? <Card><div className="text-parchment/40 text-sm">…</div></Card> : !d.loggedIn ? (
          <Card>
            <div className="text-[14px] text-parchment/80 mb-3">{T('合作伙伴登录 · 请使用收到邀请的邮箱', '合作夥伴登入 · 請使用收到邀請的信箱', 'Partner sign-in · use the email you were invited with')}</div>
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
            <div className="text-[14px] text-parchment/75 leading-relaxed">{T(`这个账号(${d.email})没有合作资料。如果你是谜夜的合作伙伴,请换成收到邀请的那个邮箱登录。`, `這個帳號(${d.email})沒有合作資料。如果你是謎夜的合作夥伴,請改用收到邀請的信箱登入。`, `No partnership is set up for ${d.email}. If you're a MystNight partner, sign in with the email you were invited with.`)}</div>
          </Card>
        ) : (<>
          <Card className="border-[#c9a96e]/35" >
            <div className="text-[11px] tracking-[.25em] text-[#c9a96e]/75">{T('专属合作', '專屬合作', 'EXCLUSIVE PARTNERSHIP')}</div>
            <h1 className="mt-1.5 font-serif text-[22px] text-[#efe6d2]">{p.name ? `${p.name} × ` : ''}{T('谜夜', '謎夜', 'MystNight')}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-parchment/70">{T(`通过你的专属链接注册的玩家,前 ${months} 个月里每一笔付款(会员、派对包、单局都算),你都拿 ${rate}%。系统自动记录,每笔都会邮件通知你;每月结算,没有最低门槛。`, `透過你的專屬連結註冊的玩家,前 ${months} 個月內每一筆付款(會員、派對包、單局都算),你都可以獲得 ${rate}%。系統自動記錄,每一筆都會寄信通知你;每月結算,沒有最低提現門檻。`, `Every player who signs up through your link: you earn ${rate}% of every payment they make in their first ${months} months — memberships, party passes and single games all count. Tracked automatically with an email for each one; paid monthly, no minimum.`)}</p>
          </Card>
          {!p.payout && <Card className="border-[#e6c76e]/50"><div className="text-[14px] text-[#e6c76e]">{T('先在下面填一下收款方式(比如 PayPal 邮箱),我们好给你打款。', '請先在下方填寫收款方式(例如 PayPal 信箱),方便我們付款給你。', 'Please add how we should pay you (e.g. your PayPal email) below.')}</div></Card>}
          <Card>
            <div className="text-[11px] tracking-[.25em] text-[#c9a96e]/70 mb-2">{T('你的专属链接', '你的專屬連結', 'YOUR LINK')}</div>
            <div className="text-[14px] break-all text-[#efe6d2] bg-black/30 border border-white/10 rounded-lg px-3 py-2.5">{p.link}</div>
            <button onClick={async () => { try { if ((navigator as any).share) await (navigator as any).share({ url: p.link }); else { await navigator.clipboard.writeText(p.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } } catch {} }} className={`mt-3 w-full py-2.5 rounded-xl ${gold}`}>{copied ? T('已复制', '已複製', 'Copied') : T('复制 / 分享', '複製 / 分享', 'Copy / Share')}</button>
            <p className="mt-3 text-[12px] text-parchment/50">{T('放在视频简介第一行、置顶评论、社群贴文都可以。点开链接后 30 天内注册的都算你的。', '放在影片說明欄第一行、置頂留言、社群貼文都可以。點開連結後 30 天內註冊的都算你的。', 'Use it in your description, pinned comment and posts. Anyone who signs up within 30 days of clicking counts as yours.')}</p>
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
            <input value={payout} onChange={(e) => setPayout(e.target.value)} placeholder={T('比如:PayPal 邮箱', '例如:PayPal 信箱', 'e.g. PayPal: you@email.com')} className={inp} />
            <button disabled={busy} onClick={savePayout} className="mt-3 px-4 py-2 rounded-lg border border-white/15 text-[13.5px]">{T('保存', '儲存', 'Save')}</button>
          </Card>
        </>)}
        {d?.isAdmin && <a href="/partner/admin" className="block text-center text-[13px] text-[#c9a96e] underline">站长:合作方 / 打款</a>}
        {msg && <p className="text-center text-[13px] text-parchment/60">{msg}</p>}
        <p className="text-center text-[11px] text-parchment/35 px-4">{d?.partner ? T('分成按对方实际付款金额计算,退款的订单会扣回。', '分潤依實際付款金額計算,退款的訂單會扣回。', 'Commission is based on amounts actually paid; refunded payments are reversed.') : ''}</p>
      </div>
    </main>
  );
}
