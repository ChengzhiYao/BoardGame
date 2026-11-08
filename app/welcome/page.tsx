'use client';
import { useEffect, useState } from 'react';

export default function Welcome() {
  const [next, setNext] = useState('/');
  const [sec, setSec] = useState(5);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dest = '/';
    try {
      const sp = new URLSearchParams(window.location.search);
      const n = sp.get('next');
      if (n && n.startsWith('/')) dest = n; // 只允许站内相对路径，避免开放重定向
    } catch {}
    setNext(dest);
    let err = false;
    try { err = new URLSearchParams(window.location.search).get('error') === '1'; } catch {}
    setFailed(err);
    if (err) return; // 失败不自动跳转
    const iv = setInterval(() => setSec((x) => (x > 0 ? x - 1 : 0)), 1000);
    const to = setTimeout(() => { window.location.href = dest; }, 5000);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, []);

  const go = () => { window.location.href = next; };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 text-parchment"
      style={{ background: 'radial-gradient(130% 90% at 50% 8%, #16202a 0%, #0c1016 42%, #07080b 78%)' }}>
      <div className="w-full max-w-sm text-center rounded-2xl border border-eldritch/30 bg-fog/60 backdrop-blur p-8">
        {failed ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blood/20 border border-blood/40 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c98a8a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </div>
            <h1 className="text-2xl font-serif mb-1">链接已失效</h1>
            <p className="text-parchment/50 text-sm mb-6">链接可能已过期或已使用过,请重新登录。<br /><span className="text-parchment/35">Link expired or already used — please sign in again.</span></p>
            <button onClick={go} className="w-full py-3 rounded-lg bg-blood/80 hover:bg-blood border border-blood text-parchment">
              返回重新登录 / Back to sign in →
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5ec97a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h1 className="text-2xl font-serif mb-1">登录成功</h1>
            <p className="text-parchment/50 text-sm mb-6">Signed in · 欢迎回到谜夜 MystNight</p>
            <button onClick={go} className="w-full py-3 rounded-lg bg-blood/80 hover:bg-blood border border-blood text-parchment">
              进入游戏 / Continue →
            </button>
            <p className="text-parchment/40 text-xs mt-4">
              若未自动跳转,{sec} 秒后自动带你进入;也可点上方按钮。<br />
              <span className="text-parchment/30">Redirecting in {sec}s — tap the button if it doesn’t.</span>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
