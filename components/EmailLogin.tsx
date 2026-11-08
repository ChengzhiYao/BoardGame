'use client';
import { useEffect, useRef, useState } from 'react';
import { sendEmailOtp } from '@/lib/auth';
import { getClientLang } from '@/lib/i18n';

export default function EmailLogin({ onClose }: { onClose: () => void }) {
  const en = (() => { try { return getClientLang() === 'en'; } catch { return false; } })();
  const L = (zh: string, e: string) => (en ? e : zh);
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pollRef = useRef<any>(null);

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  async function send() {
    if (!valid) { setErr(L('请输入有效邮箱', 'Enter a valid email')); return; }
    setBusy(true); setErr('');
    try { await sendEmailOtp(email.trim()); setStep('sent'); } catch (e: any) { setErr(e.message || L('发送失败', 'Failed to send')); }
    setBusy(false);
  }

  // 已发送后：在本页轮询登录状态。若用户在同一浏览器点了邮件里的链接（cookie 共享），
  // 这里会检测到已登录并自动刷新（刷新后会续上刚才想玩的那局）。
  useEffect(() => {
    if (step !== 'sent') return;
    pollRef.current = setInterval(async () => {
      try { const r = await fetch('/api/billing/status'); const d = await r.json(); if (d && d.loggedIn) { window.location.reload(); } } catch {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-fog border border-eldritch/40 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-eldritch/25">
          <span className="font-serif text-parchment">{L('邮箱登录', 'Sign in with email')}</span>
          <button onClick={onClose} className="text-parchment/60 hover:text-parchment text-sm px-2">✕</button>
        </div>
        <div className="px-4 py-4 space-y-3">
          {step === 'email' ? (
            <>
              <p className="text-parchment/55 text-sm">{L('输入邮箱,我们会发一封登录邮件。点开里面的链接就能登录,不用输验证码。', "Enter your email and we'll send you a sign-in link. Just click it — no code to type.")}</p>
              <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={L('你的邮箱', 'Your email')} className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
              <button onClick={send} disabled={busy || !valid} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40 text-sm">{busy ? L('发送中…', 'Sending…') : L('发送登录邮件', 'Send sign-in link')}</button>
            </>
          ) : (
            <>
              <div className="text-center py-2">
                <div className="text-3xl mb-2">📧</div>
                <p className="text-parchment/80 text-sm">{L('登录邮件已发到', 'Sign-in link sent to')}<br /><b className="text-parchment">{email}</b></p>
                <p className="text-parchment/50 text-xs mt-2 leading-relaxed">{L('点开邮件里的「登录链接」即可登录(可能在垃圾箱)。登录成功后本页会自动继续。', "Open the email and click the sign-in link (check spam). This page continues automatically once you're in.")}</p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-parchment/40"><span className="w-2 h-2 rounded-full bg-eldritch/60 animate-pulse" />{L('等待你点开链接…', 'Waiting for you to click the link…')}</div>
              <div className="rounded-lg bg-ink/50 border border-eldritch/20 px-3 py-2.5 text-[11px] text-parchment/50 leading-relaxed">
                {L('若链接在另一个浏览器 / App 里打开并显示「登录成功」,直接用那个窗口玩即可,这个窗口可以关掉。', 'If the link opened in another browser/app and showed “Signed in”, just use that window — you can close this one.')}
              </div>
              <button onClick={() => window.location.reload()} className="w-full py-2 rounded-lg bg-eldritch/40 hover:bg-eldritch/60 text-parchment/80 border border-eldritch/40 text-xs">{L('我已经登录了 · 刷新本页', "I'm signed in · refresh this page")}</button>
              <button onClick={() => { setStep('email'); setErr(''); }} className="w-full text-xs text-parchment/40 hover:text-parchment">{L('← 换个邮箱 / 重新发送', '← Change email / resend')}</button>
            </>
          )}
          {err && <p className="text-blood text-sm">{err}</p>}
        </div>
      </div>
    </div>
  );
}
