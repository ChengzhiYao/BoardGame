'use client';
import { useEffect, useRef, useState } from 'react';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/auth';
import { getClientLang } from '@/lib/i18n';

export default function EmailLogin({ onClose }: { onClose: () => void }) {
  const en = (() => { try { return getClientLang() === 'en'; } catch { return false; } })();
  const L = (zh: string, e: string) => (en ? e : zh);
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const pollRef = useRef<any>(null);

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  async function send() {
    if (!valid) { setErr(L('请输入有效邮箱', 'Enter a valid email')); return; }
    setBusy(true); setErr('');
    try { await sendEmailOtp(email.trim()); setStep('sent'); } catch (e: any) { setErr(e.message || L('发送失败', 'Failed to send')); }
    setBusy(false);
  }
  async function verify() {
    if (code.trim().length < 6) { setErr(L('请输入邮件里的验证码', 'Enter the code from the email')); return; }
    setBusy(true); setErr('');
    try { await verifyEmailOtp(email.trim(), code.trim()); window.location.reload(); } catch (e: any) { setErr(e.message || L('验证码无效或已过期', 'Invalid or expired code')); setBusy(false); }
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
              <div className="text-center py-1">
                <div className="text-3xl mb-2">📧</div>
                <p className="text-parchment/80 text-sm">{L('登录邮件已发到', 'Email sent to')}<br /><b className="text-parchment">{email}</b>{L('(可能在垃圾箱)', ' (check spam)')}</p>
              </div>
              <p className="text-parchment/55 text-xs leading-relaxed">{L('① 点邮件里的「登录链接」即可登录(同一浏览器打开,本页会自动继续)。', '① Click the sign-in link in the email (if opened in this browser, this page continues automatically).')}</p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-parchment/40"><span className="w-2 h-2 rounded-full bg-eldritch/60 animate-pulse" />{L('等待你点开链接…', 'Waiting for the link…')}</div>
              <div className="border-t border-eldritch/20 pt-3">
                <p className="text-parchment/55 text-xs leading-relaxed mb-2">{L('② 或者把邮件里的验证码填到这里,直接在本窗口登录(换了浏览器也适用):', '② Or enter the code from the email to sign in right here (works even across browsers):')}</p>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(e) => e.key === 'Enter' && verify()} placeholder={L('邮件里的验证码', 'Code from email')} inputMode="numeric" className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm tracking-[.3em] text-center" />
                <button onClick={verify} disabled={busy || code.length < 6} className="w-full mt-2 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40 text-sm">{busy ? L('登录中…', 'Signing in…') : L('验证并登录', 'Verify & sign in')}</button>
              </div>
              <button onClick={() => { setStep('email'); setErr(''); setCode(''); }} className="w-full text-xs text-parchment/40 hover:text-parchment pt-1">{L('← 换个邮箱 / 重新发送', '← Change email / resend')}</button>
            </>
          )}
          {err && <p className="text-blood text-sm">{err}</p>}
        </div>
      </div>
    </div>
  );
}
