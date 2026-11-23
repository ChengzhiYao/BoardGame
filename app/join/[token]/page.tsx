'use client';
// 邀请链接：必须先登录（Google / 邮箱），登录后自动回到这里加入房间。
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle } from '@/lib/auth';
import EmailLogin from '@/components/EmailLogin';
import { getClientLang } from '@/lib/i18n';

export default function JoinPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [need, setNeed] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState(false);
  const [en, setEn] = useState(false);

  useEffect(() => {
    setEn(getClientLang() === 'en');
    (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user || (user as any).is_anonymous || !user.email) { setNeed(true); return; }
      try {
        const res = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.token }) });
        const data = await res.json();
        if (res.status === 401) { setNeed(true); return; }
        if (!res.ok) throw new Error(data.error || '加入失败');
        try { localStorage.setItem('mn_returning', '1'); } catch {}
        router.replace(`/room/${data.roomId}`);
      } catch (e: any) { setErr(e.message); }
    })();
  }, [params.token, router]);

  const back = `/join/${params.token}`;
  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6">
      <iframe src="/coc3d-demo.html?embed=1&full=1&auto=1" title="" aria-hidden tabIndex={-1} className="fixed inset-0 w-full h-full border-0 pointer-events-none -z-20" />
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[rgba(12,13,16,.78)]" />
      {!need && !err && <div className="flex flex-col items-center gap-3 text-parchment/70"><span className="w-7 h-7 rounded-full border-2 border-[#c9a96e]/25 border-t-[#c9a96e] animate-spin" />{en ? 'Joining the table…' : '正在入座…'}</div>}
      {err && <div className="text-center space-y-3"><p className="text-parchment/75">{err}</p><a href="/play" className="text-[#c9a96e] border-b border-[#c9a96e]/40 text-sm">{en ? 'Go to my hall' : '去我的大厅'}</a></div>}
      {need && (
        <div className="w-full max-w-sm rounded-2xl border border-[#d8c7a8]/15 bg-[#0f1013]/90 backdrop-blur-md px-6 py-7 text-center nf-in">
          <div className="text-[10.5px] tracking-[.45em] pl-[.45em] text-[#c9a96e]/75">MYSTNIGHT</div>
          <h1 className="mt-3 font-serif font-semibold text-[24px] leading-snug text-[#efe6d2]">{en ? <>You’ve been invited<br />to tonight’s table</> : <>有人邀请你<br />今晚一起玩</>}</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-parchment/60">{en ? 'Sign in to take your seat. It’s free — and your games are saved.' : '登录就能入座，免费玩，你的每一局都会帮你存好。'}</p>
          <button onClick={() => signInWithGoogle(back).catch(() => {})} className="mt-6 w-full py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.12em]">{en ? 'Continue with Google' : '用 Google 登录并加入'}</button>
          <button onClick={() => setEmail(true)} className="mt-2.5 w-full py-3 rounded-xl border border-[#d8c7a8]/18 text-parchment/75 text-sm">{en ? 'Use email instead' : '用邮箱登录'}</button>
        </div>
      )}
      {email && <EmailLogin onClose={() => setEmail(false)} />}
    </main>
  );
}
