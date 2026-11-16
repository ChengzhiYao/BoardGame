'use client';
import { useEffect, useRef, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

type Msg = { role: 'ai' | 'user'; text: string; ts: number };

function urlB64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function CompanionPage() {
  const en = (() => { try { return getClientLang() === 'en'; } catch { return false; } })();
  const L = (zh: string, e: string) => (en ? e : zh);
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(true);
  const [aiName, setAiName] = useState('夜');
  const [persona, setPersona] = useState('');
  const [job, setJob] = useState('');
  const [mood, setMood] = useState(60);
  const [affection, setAffection] = useState(10);
  const [freq, setFreq] = useState('daily');
  const [enabled, setEnabled] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'chat' | 'setup'>('chat');
  const [toast, setToast] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  function flash(t: string) { setToast(t); setTimeout(() => setToast(''), 2600); }

  async function load() {
    try {
      const r = await fetch('/api/companion/state'); const d = await r.json();
      if (!d.loggedIn) { setLoggedIn(false); setLoaded(true); return; }
      setLoggedIn(true);
      setAiName(d.profile.aiName); setPersona(d.profile.persona); setJob(d.profile.job || ''); setFreq(d.profile.freq); setEnabled(d.profile.enabled); setMood(d.profile.mood ?? 60); setAffection(d.profile.affection ?? 10);
      setPushOn(d.pushOn); setMsgs(d.messages || []);
      if (!d.profile.persona && !(d.messages || []).length) setTab('setup');
    } catch {}
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, tab]);

  async function saveSetup() {
    setBusy(true);
    const tzOffset = -Math.round(new Date().getTimezoneOffset() / 60);
    try { await fetch('/api/companion/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiName, persona, job, freq, enabled, tzOffset }) }); flash(L('已保存', 'Saved')); } catch { flash(L('保存失败', 'Failed')); }
    setBusy(false);
  }

  async function enablePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { flash(L('此浏览器不支持推送', 'Push not supported here')); return; }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) { flash(L('推送未配置(缺 VAPID key)', 'Push not configured')); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { flash(L('你拒绝了通知权限', 'Notifications denied')); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapid) });
      await fetch('/api/companion/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
      setPushOn(true); flash(L('已开启推送 · 它会主动找你了', 'Push on — it will reach out'));
    } catch (e: any) { flash(L('开启失败:' + (e?.message || ''), 'Failed: ' + (e?.message || ''))); }
  }

  async function send() {
    const t = text.trim(); if (!t || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: t, ts: Date.now() }]); setText(''); setBusy(true);
    try {
      const r = await fetch('/api/companion/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, lang: en ? 'en' : 'zh' }) });
      const d = await r.json();
      if (d.ok) {
        if (typeof d.mood === 'number') setMood(d.mood);
        if (typeof d.affection === 'number') setAffection(d.affection);
        const wait = Math.min(Math.max(1, d.delay || 2), 25) * 1000; // 不秒回,最多等 25s(忙就慢)
        await new Promise((res) => setTimeout(res, wait));
        setMsgs((m) => [...m, { role: 'ai', text: d.reply, ts: Date.now() }]);
      } else flash(L('发送失败', 'Failed'));
    } catch { flash(L('网络错误', 'Network error')); }
    setBusy(false);
  }

  if (!loaded) return <main className="min-h-screen" />;
  if (!loggedIn) return (
    <main className="min-h-screen flex items-center justify-center text-parchment px-6 text-center">
      <div><p className="mb-3">{L('登录后即可拥有你的 AI 陪伴', 'Log in to meet your AI companion')}</p><a href="/" className="underline text-eldritch">{L('← 回首页登录', '← Home to log in')}</a></div>
    </main>
  );

  return (
    <main className="min-h-screen text-parchment max-w-xl mx-auto px-4 py-6 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-serif">{aiName}<span className="text-parchment/40 text-sm ml-2">{L('你的 AI 陪伴', 'your AI companion')}</span></h1>
        <a href="/" className="text-sm text-parchment/50 hover:text-parchment">{L('← 返回', '← Home')}</a>
      </div>
      <div className="flex gap-2 mb-4 text-sm">
        <button onClick={() => setTab('chat')} className={`px-3 py-1.5 rounded-full border ${tab === 'chat' ? 'bg-eldritch/40 border-eldritch' : 'border-eldritch/30 text-parchment/60'}`}>{L('聊天', 'Chat')}</button>
        <button onClick={() => setTab('setup')} className={`px-3 py-1.5 rounded-full border ${tab === 'setup' ? 'bg-eldritch/40 border-eldritch' : 'border-eldritch/30 text-parchment/60'}`}>{L('设定', 'Setup')}</button>
        {!pushOn && <button onClick={enablePush} className="ml-auto px-3 py-1.5 rounded-full bg-blood/80 hover:bg-blood border border-blood text-sm">{L('开启主动推送', 'Enable push')}</button>}
        {pushOn && <span className="ml-auto text-xs text-green-400 self-center">{L('✓ 推送已开', '✓ Push on')}</span>}
      </div>

      {tab === 'setup' ? (
        <div className="space-y-4">
          <div className="flex gap-4 text-xs text-parchment/60 rounded-lg bg-ink/50 border border-eldritch/20 px-3 py-2">
            <span>{L('心情', 'Mood')} <b className="text-amber-300">{mood}</b>/100</span>
            <span>{L('好感', 'Affection')} <b className="text-blood">{affection}</b>/100</span>
            <span className="text-parchment/35">{L('随聊天变化', 'changes as you talk')}</span>
          </div>
          <div>
            <label className="text-sm text-parchment/60">{L('TA 的名字', 'Its name')}</label>
            <input value={aiName} onChange={(e) => setAiName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded bg-ink border border-eldritch/40 text-parchment outline-none focus:border-eldritch" />
          </div>
          <div>
            <label className="text-sm text-parchment/60">{L('TA 的性格 / 你希望 TA 是什么样', "Its personality / how you want it")}</label>
            <textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={5} placeholder={L('例如:温柔、爱调侃、关心我的作息,聊音乐和电影,像多年老友……', 'e.g. warm, teasing, cares about my sleep, loves music & films, like an old friend…')} className="w-full mt-1 px-3 py-2 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch resize-none text-sm" />
          </div>
          <div>
            <label className="text-sm text-parchment/60">{L('TA 的职业 / 工作', 'Its job')}</label>
            <input value={job} onChange={(e) => setJob(e.target.value)} placeholder={L('例如:医院夜班护士 / 自由插画师 / 咖啡店店员……', 'e.g. night-shift nurse / freelance illustrator / barista…')} className="w-full mt-1 px-3 py-2 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
            <p className="text-[11px] text-parchment/40 mt-1">{L('TA 会按这份工作的作息过日子——上班忙时回得慢,下班才松弛。', 'It lives by this job — slower when working, freer off hours.')}</p>
          </div>
          <div>
            <label className="text-sm text-parchment/60">{L('主动找你的频率', 'How often it reaches out')}</label>
            <div className="flex gap-2 mt-1">
              {[['daily', L('每天', 'Daily')], ['twice', L('一天两次', 'Twice a day')], ['few', L('每周几次', 'A few / week')]].map(([k, lbl]) => (
                <button key={k} onClick={() => setFreq(k)} className={`px-3 py-1.5 rounded-full border text-sm ${freq === k ? 'bg-eldritch/40 border-eldritch' : 'border-eldritch/30 text-parchment/60'}`}>{lbl}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-parchment/70"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{L('开启主动陪伴', 'Companion active')}</label>
          <button onClick={saveSetup} disabled={busy} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40">{busy ? L('保存中…', 'Saving…') : L('保存设定', 'Save')}</button>
          <p className="text-xs text-parchment/40 leading-relaxed">{L('提示:在手机浏览器里把本页「添加到主屏」,再点上面「开启主动推送」,TA 才能在你没开 App 时也主动找你(iPhone 需 iOS16.4+ 且已添加到主屏)。', 'Tip: add this page to your home screen, then enable push, so it can reach you even when the app is closed (iPhone needs iOS 16.4+ and add-to-home-screen).')}</p>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto pb-4 min-h-[50vh]">
            {msgs.length === 0 && <div className="text-center text-parchment/40 text-sm py-12">{L('还没有对话。去「设定」里描述 TA,开启推送,TA 就会主动来找你。你也可以现在先打个招呼 👋', 'No messages yet. Set it up, enable push, and it will reach out. Or say hi now 👋')}</div>}
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'ml-auto bg-blood/30 border border-blood/40' : 'mr-auto bg-fog/70 border border-eldritch/30'}`}>{m.text}</div>
            ))}
            {busy && <div className="mr-auto px-3.5 py-2 rounded-2xl bg-fog/70 border border-eldritch/30 text-parchment/40 text-sm">…</div>}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-ink/0">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={L('说点什么…', 'Say something…')} className="flex-1 px-3.5 py-2.5 rounded-full bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
            <button onClick={send} disabled={busy || !text.trim()} className="px-5 rounded-full bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40 text-sm">{L('发送', 'Send')}</button>
          </div>
        </>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-ink border border-eldritch/40 text-parchment text-sm shadow-xl">{toast}</div>}
    </main>
  );
}
