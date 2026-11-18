'use client';
import { useEffect, useRef, useState } from 'react';
import { getClientLang } from '@/lib/i18n';
import { QUIZ } from '@/lib/companion/quiz';
import { STICKERS, STICKER_RE, PHOTO_RE } from '@/lib/companion/stickers';

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
  const [allowed, setAllowed] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [avatarGen, setAvatarGen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const setZoom = (on: boolean) => setZoomSrc(on ? avatarUrl : null);
  const [stickerOpen, setStickerOpen] = useState(false);
  // 独立桌面应用("放到桌面"):自己的图标/名字,打开直接进聊天
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [iosHint, setIosHint] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installHidden, setInstallHidden] = useState(true);
  const recogRef = useRef<any>(null);
  const [aiName, setAiName] = useState('夜');
  const [persona, setPersona] = useState('');
  const [job, setJob] = useState('');
  const [mood, setMood] = useState(60);
  const [affection, setAffection] = useState(10);
  const [freq, setFreq] = useState('daily');
  const [enabled, setEnabled] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushDiag, setPushDiag] = useState('');
  const [nextReachAt, setNextReachAt] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'welcome' | 'chat' | 'setup' | 'quiz'>('chat');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [gender, setGender] = useState<'f' | 'm' | 'any'>('f');
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  function flash(t: string) { setToast(t); setTimeout(() => setToast(''), 2600); }

  async function load() {
    try {
      const r = await fetch('/api/companion/state'); const d = await r.json();
      if (!d.loggedIn) { setLoggedIn(false); setLoaded(true); return; }
      setLoggedIn(true);
      if (d.allowed === false) { setAllowed(false); setLoaded(true); return; }
      setAllowed(true);
      setAiName(d.profile.aiName); setPersona(d.profile.persona); setJob(d.profile.job || ''); setFreq(d.profile.freq); setEnabled(d.profile.enabled); setMood(d.profile.mood ?? 60); setAffection(d.profile.affection ?? 10);
      setPushOn(d.pushOn); setNextReachAt(d.profile.nextReachAt || null); healPush(d.pushOn); setMsgs(d.messages || []); setAvatarUrl(d.profile.avatarUrl || null);
      if (!d.profile.avatarUrl && (d.profile.persona || d.profile.job)) genAvatar();
      if (!d.profile.persona && !(d.messages || []).length) setTab('welcome');
    } catch {}
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);
  // 回到页面时刷新一下,拿到你不在时 TA 发的消息
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible' && !responding.current) load(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('android');
  const [inMystApp, setInMystApp] = useState(false); // 在谜夜 App(而不是陪伴 App)里打开的
  useEffect(() => {
    const sa = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    let isCompanionApp = false; try { isCompanionApp = sessionStorage.getItem('companion_app') === '1'; } catch {}
    // iOS 添加到主屏幕时用的是当前网址(不带 src=app),在 iOS 上独立打开就当作陪伴 App
    if (/iphone|ipad|ipod/i.test(navigator.userAgent || '')) isCompanionApp = true;
    setStandalone(!!sa && isCompanionApp);
    if (sa && isCompanionApp) return;
    if (sa && !isCompanionApp) setInMystApp(true);
    try { if (localStorage.getItem('companion_install_dismissed') === '1') return; } catch {}
    setInstallHidden(false);
    const ua = navigator.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    setIosHint(ios);
    setPlatform(ios ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop');
    const grab = () => { if ((window as any).__bip) setInstallEvt((window as any).__bip); };
    grab();
    const onBIP = (e: any) => { e.preventDefault(); (window as any).__bip = e; setInstallEvt(e); };
    const onInstalled = () => { setInstallEvt(null); setInstallHidden(true); };
    window.addEventListener('bip-ready', grab);
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('bip-ready', grab); window.removeEventListener('beforeinstallprompt', onBIP); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  // 桌面图标的名字 = TA 的名字
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (link && aiName) link.href = '/api/companion/manifest?n=' + encodeURIComponent(aiName);
  }, [aiName]);
  async function installApp() {
    if (!installEvt) return;
    try { await installEvt.prompt(); await installEvt.userChoice; } catch {}
    (window as any).__bip = null; setInstallEvt(null);
  }
  function hideInstall() { setInstallHidden(true); try { localStorage.setItem('companion_install_dismissed', '1'); } catch {} }
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, tab]);

  async function saveSetup() {
    setBusy(true);
    const tzOffset = -Math.round(new Date().getTimezoneOffset() / 60);
    try { await fetch('/api/companion/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiName, persona, job, freq, enabled, tzOffset }) }); flash(L('已保存', 'Saved')); if (!avatarUrl) genAvatar(); } catch { flash(L('保存失败', 'Failed')); }
    setBusy(false);
  }

  async function runGenerate() {
    if (Object.keys(answers).length < QUIZ.length) { flash(L('先把问题都选一下', 'Answer all first')); return; }
    setGenerating(true);
    try {
      const r = await fetch('/api/companion/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, freeText, gender, lang: en ? 'en' : 'zh' }) });
      const d = await r.json();
      if (d.ok) { await load(); setTab('chat'); flash(L('你的伴侣诞生了 · ' + d.aiName, 'Meet ' + d.aiName)); genAvatar(); }
      else flash(L('生成失败,再试一次', 'Failed, try again'));
    } catch { flash(L('网络错误', 'Network error')); }
    setGenerating(false);
  }
  async function resetAll() {
    if (!window.confirm(L('确定重置?当前的 TA、聊天记录、好感都会清空,重新开始一次。', 'Reset? This wipes your companion, chat and affection, and starts over.'))) return;
    setBusy(true);
    try { await fetch('/api/companion/reset', { method: 'POST' }); setMsgs([]); setPersona(''); setJob(''); setAnswers({}); setFreeText(''); setMood(60); setAffection(10); setTab('welcome'); flash(L('已重置', 'Reset')); } catch { flash(L('失败', 'Failed')); }
    setBusy(false);
  }
  async function genAvatar() {
    setAvatarGen(true);
    try { const r = await fetch('/api/companion/avatar', { method: 'POST' }); const d = await r.json(); if (d.ok) setAvatarUrl(d.avatarUrl); } catch {}
    setAvatarGen(false);
  }
  function toggleVoice() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { flash(L('此浏览器不支持语音输入', 'Voice input not supported here')); return; }
    if (recording) { try { recogRef.current?.stop(); } catch {}; setRecording(false); return; }
    const r = new SR(); recogRef.current = r;
    r.lang = en ? 'en-US' : 'zh-CN'; r.interimResults = true; r.continuous = false;
    const base = text ? text + ' ' : '';
    r.onresult = (e: any) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setText(base + t); };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    try { r.start(); setRecording(true); } catch { setRecording(false); }
  }
  // 陪伴专用推送通道:Service Worker 作用范围只有 /companion,通知就归属"AI 陪伴"应用而不是谜夜
  async function companionReg() {
    const reg = await navigator.serviceWorker.register('/companion-sw.js', { scope: '/companion' });
    if (!reg.active) await new Promise<void>((res) => {
      const w = reg.installing || reg.waiting;
      if (!w) return res();
      w.addEventListener('statechange', () => { if (w.state === 'activated') res(); });
      setTimeout(res, 4000);
    });
    return reg;
  }
  // 把以前挂在谜夜整站(scope "/")上的旧订阅取消掉
  async function dropRootSub() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const root = regs.find((r) => new URL(r.scope).pathname === '/');
      const old = root ? await root.pushManager.getSubscription() : null;
      if (old) {
        await fetch('/api/companion/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remove: old.endpoint }) });
        await old.unsubscribe();
      }
    } catch {}
  }
  // 自愈:已授权通知但服务器上没订阅/订阅换了 → 自动重新登记(安卓上订阅会过期或被清)
  async function healPush(serverHas: boolean) {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; if (!vapid) return;
      await dropRootSub();
      const reg = await companionReg();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapid) });
      await fetch('/api/companion/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
      if (!serverHas) setPushOn(true);
    } catch {}
  }
  async function testPush() {
    setPushDiag(L('发送中…', 'Sending…'));
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') { setPushDiag(L('❌ 这个浏览器没给通知权限:到 手机设置 → 应用 → Chrome → 通知 打开,再到网站设置里允许 mystnight.com 通知', '❌ Notifications not allowed in this browser')); return; }
      const r = await fetch('/api/companion/push-test', { method: 'POST' }); const d = await r.json();
      if (d.reason === 'no_subs') { setPushDiag(L('❌ 服务器上没有你这台设备的订阅。点上面「开启主动推送」重新开一次', '❌ No subscription on server — enable push again')); setPushOn(false); return; }
      if (d.reason === 'no_vapid') { setPushDiag(L('❌ 服务器没配置推送密钥(VAPID)', '❌ VAPID keys missing on server')); return; }
      const res = (d.results || []).map((x: any) => `${x.host}: ${x.status}${x.code ? ' ' + x.code : ''}${x.error ? ' ' + x.error : ''}`).join(' | ');
      setPushDiag(d.ok ? L('✓ 已发出。几秒内没弹通知 → 检查手机系统通知权限 / 省电模式 / Chrome 后台限制。', '✓ Sent. If nothing pops up, check OS notification / battery settings.') + ' ' + res : L('❌ 发送失败:', '❌ Failed: ') + res);
      if (d.nextReachAt) setNextReachAt(d.nextReachAt);
    } catch { setPushDiag(L('❌ 网络错误', '❌ Network error')); }
  }
  async function enablePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { flash(L('此浏览器不支持推送', 'Push not supported here')); return; }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) { flash(L('推送未配置(缺 VAPID key)', 'Push not configured')); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { flash(L('你拒绝了通知权限', 'Notifications denied')); return; }
      await dropRootSub();
      const reg = await companionReg();
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapid) });
      await fetch('/api/companion/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
      setPushOn(true); flash(L('已开启推送 · 它会主动找你了', 'Push on — it will reach out'));
    } catch (e: any) { flash(L('开启失败:' + (e?.message || ''), 'Failed: ' + (e?.message || ''))); }
  }

  // 发消息不阻塞:随时可以连发。停顿几秒后才让 TA 一次性看完你发的所有消息再回。
  const replyTimer = useRef<any>(null);
  const responding = useRef(false);
  const again = useRef(false);
  const [typing, setTyping] = useState(false);
  const unshown = useRef<string[]>([]); // 已生成但还没显示出来的回复
  // 页面切到后台/被关掉:还没让 TA 回 → 立刻让服务器回并推送;已经回了但还在"打字" → 把没显示的推送过去
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      const body = (o: any) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o), keepalive: true } as RequestInit);
      if (replyTimer.current && !responding.current) {
        clearTimeout(replyTimer.current); replyTimer.current = null;
        fetch('/api/companion/chat', body({ respond: true, push: true, lang: en ? 'en' : 'zh' })).catch(() => {});
      } else if (unshown.current.length) {
        fetch('/api/companion/notify', body({ texts: unshown.current })).catch(() => {});
        unshown.current = [];
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
  }, []);
  function scheduleRespond() {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(respond, 2500 + Math.random() * 2500); // 你停手 2.5~5 秒后它才"看"
  }
  async function respond() {
    if (responding.current) { again.current = true; return; }
    responding.current = true; again.current = false;
    try {
      const r = await fetch('/api/companion/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respond: true, lang: en ? 'en' : 'zh' }) });
      const d = await r.json();
      if (d.ok) {
        if (typeof d.mood === 'number') setMood(d.mood);
        if (typeof d.affection === 'number') setAffection(d.affection);
        const list: string[] = Array.isArray(d.replies) ? d.replies : [];
        unshown.current = [...list];
        if (list.length) {
          const wait = Math.min(Math.max(1, d.delay || 2), 25) * 1000; // 不秒回,忙就慢
          const typeFor = Math.min(wait, 1500 + list[0].length * 150);
          await new Promise((res) => setTimeout(res, wait - typeFor));
          setTyping(true);
          await new Promise((res) => setTimeout(res, typeFor));
          for (let i = 0; i < list.length; i++) {
            if (i > 0) {
              setTyping(true);
              // 连发(3 条以上)就是一条接一条噼里啪啦地冒;少的时候按字数慢慢打
              const gap = list.length >= 3 ? 250 + Math.min(1200, list[i].length * 90) + Math.random() * 500 : 800 + Math.min(4000, list[i].length * 180) + Math.random() * 900;
              await new Promise((res) => setTimeout(res, gap));
            }
            setTyping(false);
            setMsgs((m) => [...m, { role: 'ai', text: list[i], ts: Date.now() }]);
            unshown.current = unshown.current.filter((t) => t !== list[i]);
          }
        }
        // TA 顺手发张生活照(异步出图,先显示"正在输入",图好了再冒出来)
        if (d.photo && d.photo.sig) {
          setTyping(true);
          try {
            const pr = await fetch('/api/companion/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d.photo, push: document.visibilityState === 'hidden' }) });
            const pd = await pr.json();
            if (pd.ok && pd.text) setMsgs((m) => [...m, { role: 'ai', text: pd.text, ts: Date.now() }]);
          } catch {}
          setTyping(false);
        }
        // list 为空 = 已读不回,过一阵它会自己回
      }
    } catch {}
    setTyping(false);
    responding.current = false;
    if (again.current) scheduleRespond(); // 它回的时候你又发了 → 再看一轮
  }
  async function send(raw?: string) {
    const t = (raw ?? text).trim(); if (!t) return;
    setMsgs((m) => [...m, { role: 'user', text: t, ts: Date.now() }]); if (raw === undefined) setText('');
    if (responding.current) again.current = true;
    try {
      const r = await fetch('/api/companion/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, lang: en ? 'en' : 'zh' }) });
      const d = await r.json();
      if (!d.ok) { flash(L('发送失败', 'Failed')); return; }
    } catch { flash(L('网络错误', 'Network error')); return; }
    scheduleRespond();
  }

  // 消息内容渲染:表情包 / 照片 / 文字
  function bubble(text: string, mine: boolean) {
    const t = text.trim();
    const st = t.match(STICKER_RE); const k = st && STICKERS[st[1].trim()];
    if (k) return <div className="w-24 h-24 rounded-2xl bg-white/5 flex flex-col items-center justify-center select-none"><span className="text-5xl leading-none">{k.e}</span><span className="text-[11px] text-parchment/70 mt-1.5">{k.t}</span></div>;
    const ph = t.match(PHOTO_RE);
    if (ph) return <img src={ph[1]} alt="" onClick={() => setZoomSrc(ph[1])} className="max-w-[60%] max-h-64 rounded-xl object-cover cursor-zoom-in border border-white/5" />;
    return <div className={`max-w-[72%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${mine ? 'rounded-br-md bg-[#2a5e3a] text-parchment' : 'rounded-bl-md bg-fog/80 border border-eldritch/25 text-parchment'}`}>{text}</div>;
  }

  if (!loaded) return <main className="min-h-screen" />;
  if (!allowed) return (
    <main className="min-h-screen flex items-center justify-center text-parchment px-6 text-center">
      <div className="max-w-xs"><div className="text-4xl mb-3">🌙</div><p className="font-serif text-lg mb-2">{L('AI 陪伴暂未开放', 'AI Companion — coming soon')}</p><p className="text-parchment/50 text-sm mb-4">{L('这个功能还在内测中,敬请期待。', 'This feature is in private testing. Stay tuned.')}</p><a href="/" className="underline text-eldritch text-sm">{L('← 返回首页', '← Home')}</a></div>
    </main>
  );
  if (!loggedIn) return (
    <main className="min-h-screen flex items-center justify-center text-parchment px-6 text-center">
      <div><p className="mb-3">{L('登录后即可拥有你的 AI 陪伴', 'Log in to meet your AI companion')}</p><a href="/" className="underline text-eldritch">{L('← 回首页登录', '← Home to log in')}</a></div>
    </main>
  );

  return (
    <main className="min-h-screen text-parchment max-w-xl mx-auto px-4 py-6 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {avatarUrl ? <img src={avatarUrl} alt="" onClick={() => setZoom(true)} className="cursor-zoom-in w-9 h-9 rounded-full object-cover border border-eldritch/40" /> : <span className="w-9 h-9 rounded-full bg-eldritch/40 flex items-center justify-center text-sm shrink-0">{(aiName || '?').slice(0,1)}</span>}
          <div className="leading-tight min-w-0"><div className="font-serif text-lg truncate">{aiName}</div><div className="text-[11px] text-parchment/40">{typing ? L('对方正在输入…','typing…') : avatarGen ? L('画像生成中…','drawing…') : L('在线','online')}</div></div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {tab === 'chat' && <button onClick={() => setTab('setup')} title={L('设定','Settings')} className="text-parchment/50 hover:text-parchment"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>}
          {tab === 'setup' && <button onClick={() => setTab('chat')} className="text-sm text-parchment/60 hover:text-parchment">{L('← 聊天','← Chat')}</button>}
        </div>
      </div>

      {!installHidden && !standalone && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-fog/90 border border-eldritch/30 px-3 py-2">
          <img src="/companion-192.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 text-[12px] leading-snug">
            <div className="text-parchment text-[13px]">{L('把 TA 放到手机桌面', 'Add to home screen')}</div>
            <div className="text-parchment/60">{
              inMystApp ? L('你现在在谜夜 App 里。用手机浏览器打开 mystnight.com/companion 才能单独添加', 'Open mystnight.com/companion in your browser to add it separately')
              : installEvt ? L('独立图标,点开直接聊天', 'Its own icon, opens straight to chat')
              : platform === 'ios' ? L('点 Safari 底部「分享」→「添加到主屏幕」', 'Share → Add to Home Screen')
              : platform === 'android' ? L('点 Chrome 右上角「⋮」→「添加到主屏幕」或「安装应用」', 'Chrome menu ⋮ → Add to Home screen / Install app')
              : L('点地址栏右侧的「安装」图标,或浏览器菜单 →「安装应用」', 'Use the install icon in the address bar')
            }</div>
          </div>
          {inMystApp && <button onClick={() => { try { navigator.clipboard.writeText(location.origin + '/companion'); flash(L('链接已复制', 'Link copied')); } catch {} }} className="shrink-0 px-3 py-1.5 rounded-lg border border-eldritch/40 text-sm">{L('复制链接', 'Copy link')}</button>}
          {!inMystApp && installEvt && <button onClick={installApp} className="shrink-0 px-3 py-1.5 rounded-lg bg-blood/85 hover:bg-blood border border-blood text-sm">{L('添加', 'Add')}</button>}
          <button onClick={hideInstall} aria-label="close" className="shrink-0 w-7 h-7 text-parchment/40 hover:text-parchment">✕</button>
        </div>
      )}
      {tab === 'welcome' ? (
        <div className="flex flex-col items-center justify-center text-center gap-5 py-10 min-h-[55vh]">
          <div className="w-20 h-20 rounded-full bg-gradient-to-b from-eldritch/40 to-blood/20 border border-eldritch/40 flex items-center justify-center text-4xl">🌙</div>
          <div>
            <h2 className="text-2xl font-serif mb-2">{L('遇见一个只属于你的 TA', 'Meet someone made for you')}</h2>
            <p className="text-parchment/55 text-sm leading-relaxed max-w-xs mx-auto">{L('TA 不是助手,是一个有职业、有脾气、有心情的"人"。会在你没找 TA 的时候主动想起你。先回答几个小问题,让我们为你把 TA 找出来——不是你挑的,是你遇到的。', 'Not an assistant — a person with a job, moods, a temper, who reaches out when you least expect it. Answer a few questions and we\'ll find them for you — not picked, discovered.')}</p>
          </div>
          <button onClick={() => setTab('quiz')} className="px-8 py-3 rounded-full bg-blood/80 hover:bg-blood border border-blood text-parchment">{L('开始遇见 →', 'Begin →')}</button>
          <button onClick={() => setTab('setup')} className="text-xs text-parchment/35 hover:text-parchment">{L('或者,我想自己捏一个', 'or set one up myself')}</button>
        </div>
      ) : tab === 'quiz' ? (
        <div className="space-y-5">
          <p className="text-parchment/70 text-sm leading-relaxed">{L('回答几个小问题,我们据此为你"生成"一个最配你的伴侣——不是让你自己挑,而是让你遇到。', "Answer a few questions and we'll conjure the companion that fits you — not picked, discovered.")}</p>
          <div>
            <div className="text-sm text-parchment/85 mb-2">{L('你想遇到的是', 'You want to meet')}</div>
            <div className="grid grid-cols-3 gap-2">
              {([['f', L('女生', 'A girl')], ['m', L('男生', 'A guy')], ['any', L('随缘', 'Either')]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setGender(k)}
                  className={`text-sm px-3 py-2 rounded-lg border transition ${gender === k ? 'bg-blood/30 border-blood text-parchment' : 'bg-ink/50 border-eldritch/30 text-parchment/70 hover:border-eldritch'}`}>{label}</button>
              ))}
            </div>
          </div>
          {QUIZ.map((q) => (
            <div key={q.id}>
              <div className="text-sm text-parchment/85 mb-2">{en ? q.en : q.zh}</div>
              <div className="grid grid-cols-1 gap-2">
                {q.opts.map((op) => (
                  <button key={op.key} onClick={() => setAnswers((a) => ({ ...a, [q.id]: op.key }))}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition ${answers[q.id] === op.key ? 'bg-blood/30 border-blood text-parchment' : 'bg-ink/50 border-eldritch/30 text-parchment/70 hover:border-eldritch'}`}>
                    {en ? op.en : op.zh}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="text-sm text-parchment/85 mb-2">{L('最后,一个最近让你着迷的东西 / 你偷偷的梦想(选填)', 'Last — something you are into / a secret dream (optional)')}</div>
            <input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder={L('一句话就好……', 'One line…')} className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
          </div>
          <button onClick={runGenerate} disabled={generating} className="w-full py-3 rounded-lg bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40">{generating ? L('正在生成 TA……', 'Conjuring…') : L('生成我的伴侣', 'Create my companion')}</button>
          <button onClick={() => setTab('setup')} className="w-full text-xs text-parchment/40 hover:text-parchment">{L('跳过,我自己手动设置', 'Skip — set up manually')}</button>
        </div>
      ) : tab === 'setup' ? (
        <div className="space-y-4">
          <div className="flex gap-4 text-xs text-parchment/60 rounded-lg bg-ink/50 border border-eldritch/20 px-3 py-2">
            <span>{L('心情', 'Mood')} <b className="text-amber-300">{mood}</b>/100</span>
            <span>{L('好感', 'Affection')} <b className="text-blood">{affection}</b>/100</span>
            <span className="text-parchment/35">{L('随聊天变化', 'changes as you talk')}</span>
          </div>
          {!pushOn ? <button onClick={enablePush} className="w-full py-2.5 rounded-lg bg-blood/80 hover:bg-blood border border-blood text-sm">{L('开启主动推送 · 让 TA 能主动找你', 'Enable push — let it reach out')}</button> : <div className="text-center text-xs text-green-400">{L('✓ 主动推送已开', '✓ Push on')}</div>}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-parchment/45">{nextReachAt ? L('TA 大概会在 ', 'Next reach-out ~ ') + new Date(nextReachAt).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + L(' 左右找你', '') : ''}</span>
            <button onClick={testPush} className="shrink-0 px-3 py-1.5 rounded border border-eldritch/40 text-parchment/70 hover:text-parchment">{L('发一条测试推送', 'Send test push')}</button>
          </div>
          {pushDiag && <div className="text-xs text-parchment/60 break-all">{pushDiag}</div>}
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
          <button onClick={genAvatar} disabled={avatarGen} className="w-full py-2 rounded border border-eldritch/40 text-parchment/70 hover:bg-eldritch/20 text-sm disabled:opacity-40">{avatarGen ? L('生成头像中…','drawing…') : L('重新生成头像','Regenerate avatar')}</button>
          <button onClick={resetAll} disabled={busy} className="w-full py-2 rounded border border-blood/40 text-blood/80 hover:bg-blood/10 text-sm disabled:opacity-40">{L('重置 · 重新开始 onboarding', 'Reset · start over')}</button>
          {!standalone && <a href="/" className="block text-center text-xs text-parchment/35 hover:text-parchment/70 pt-2">{L('返回谜夜首页', 'Back to MystNight')}</a>}
          <p className="text-xs text-parchment/40 leading-relaxed">{L('提示:在手机浏览器里把本页「添加到主屏」,再点上面「开启主动推送」,TA 才能在你没开 App 时也主动找你(iPhone 需 iOS16.4+ 且已添加到主屏)。', 'Tip: add this page to your home screen, then enable push, so it can reach you even when the app is closed (iPhone needs iOS 16.4+ and add-to-home-screen).')}</p>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto pb-4 min-h-[50vh]">
            <div className="text-center py-3"><span className="inline-block px-2.5 py-1 rounded bg-white/5 text-parchment/40 text-[11px]">{L(`你已添加了${aiName},现在可以开始聊天了。`, `You added ${aiName}. You can start chatting now.`)}</span></div>
            {msgs.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  {bubble(m.text, true)}
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2">
                  {avatarUrl ? <img src={avatarUrl} alt="" onClick={() => setZoom(true)} className="cursor-zoom-in w-7 h-7 rounded-full object-cover border border-eldritch/40 shrink-0" /> : <span className="w-7 h-7 rounded-full bg-eldritch/40 flex items-center justify-center text-xs shrink-0">{(aiName || '?').slice(0,1)}</span>}
                  {bubble(m.text, false)}
                </div>
              )
            ))}
            {typing && <div className="flex items-end gap-2">{avatarUrl ? <img src={avatarUrl} alt="" onClick={() => setZoom(true)} className="cursor-zoom-in w-7 h-7 rounded-full object-cover border border-eldritch/40 shrink-0" /> : <span className="w-7 h-7 rounded-full bg-eldritch/40 shrink-0" />}<div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-fog/80 border border-eldritch/25 text-parchment/40 text-sm">···</div></div>}
            <div ref={endRef} />
          </div>
          {stickerOpen && (
            <div className="grid grid-cols-5 gap-2 p-2 mb-1 rounded-xl bg-ink/95 border border-eldritch/30">
              {Object.entries(STICKERS).map(([name, k]) => (
                <button key={name} onClick={() => { send(`[sticker:${name}]`); setStickerOpen(false); }} className="flex flex-col items-center justify-center py-1.5 rounded-lg hover:bg-white/5">
                  <span className="text-3xl leading-none">{k.e}</span><span className="text-[10px] text-parchment/60 mt-1">{k.t}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 sticky bottom-0 pb-1">
            <button onClick={toggleVoice} title={L('语音输入','Voice')} className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${recording ? 'bg-blood/70 border-blood animate-pulse' : 'bg-ink border-eldritch/40 text-parchment/70 hover:text-parchment'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
            <button onClick={() => setStickerOpen((v) => !v)} title={L('表情','Stickers')} className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center text-lg ${stickerOpen ? 'bg-eldritch/30 border-eldritch' : 'bg-ink border-eldritch/40'}`}>😊</button>
            <input value={text} onChange={(e) => { setText(e.target.value); if (replyTimer.current && !responding.current) scheduleRespond(); }} onKeyDown={(e) => e.key === 'Enter' && send()} onFocus={() => setStickerOpen(false)} placeholder={recording ? L('在听……','listening…') : L('说点什么…', 'Say something…')} className="flex-1 min-w-0 px-3.5 py-2.5 rounded-full bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
            <button onClick={() => send()} disabled={!text.trim()} className="shrink-0 px-5 py-2.5 rounded-full bg-blood/80 hover:bg-blood border border-blood disabled:opacity-40 text-sm">{L('发送', 'Send')}</button>
          </div>
        </>
      )}
      {zoomSrc && (
        <div onClick={() => setZoomSrc(null)} className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out">
          <img src={zoomSrc} alt={aiName} className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl" />
          <button onClick={() => setZoomSrc(null)} aria-label="close" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white text-xl leading-none">×</button>
        </div>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-ink border border-eldritch/40 text-parchment text-sm shadow-xl">{toast}</div>}
    </main>
  );
}
