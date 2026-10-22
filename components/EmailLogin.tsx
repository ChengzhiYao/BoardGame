'use client';
import { useState } from 'react';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/auth';
import { getClientLang } from '@/lib/i18n';

export default function EmailLogin({ onClose }: { onClose: () => void }) {
  const en = (() => { try { return getClientLang() === 'en'; } catch { return false; } })();
  const L = (zh: string, e: string) => (en ? e : zh);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  async function send() {
    if (!valid) { setErr(L('请输入有效邮箱', 'Enter a valid email')); return; }
    setBusy(true); setErr('');
    try { await sendEmailOtp(email.trim()); setStep('code'); } catch (e: any) { setErr(e.message || L('发送失败', 'Failed to send')); }
    setBusy(false);
  }
  async function verify() {
    if (code.trim().length < 6) { setErr(L('请输入 6 位验证码', 'Enter the 6-digit code')); return; }
    setBusy(true); setErr('');
    try { await verifyEmailOtp(email.trim(), code.trim()); window.location.reload(); } catch (e: any) { setErr(e.message || L('验证码错误', 'Invalid code')); setBusy(false); }
  }

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
              <p className="text-parchment/55 text-sm">{L('输入邮箱,我们会发一个 6 位验证码过去。', "Enter your email and we'll send a 6-digit code.")}</p>
              <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={L('你的邮箱', 'Your email')} className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
              <button onClick={send} disabled={busy || !valid} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40 text-sm">{busy ? L('发送中…', 'Sending…') : L('发送验证码', 'Send code')}</button>
            </>
          ) : (
            <>
              <p className="text-parchment/55 text-sm">{L('验证码已发到 ', 'Code sent to ')}<b className="text-parchment">{email}</b>{L('(可能在垃圾箱)。', ' (check spam).')}</p>
              <input autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && verify()} placeholder={L('6 位验证码', '6-digit code')} inputMode="numeric" className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm tracking-[.3em] text-center" />
              <button onClick={verify} disabled={busy || code.length < 6} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40 text-sm">{busy ? L('登录中…', 'Signing in…') : L('验证并登录', 'Verify & sign in')}</button>
              <button onClick={() => { setStep('email'); setCode(''); setErr(''); }} className="w-full text-xs text-parchment/40 hover:text-parchment">{L('← 换个邮箱 / 重新发送', '← Change email / resend')}</button>
            </>
          )}
          {err && <p className="text-blood text-sm">{err}</p>}
        </div>
      </div>
    </div>
  );
}
