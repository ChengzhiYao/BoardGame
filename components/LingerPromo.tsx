'use client';
import { useEffect, useState } from 'react';
// 谜夜首页上的姊妹产品推荐:Linger(一个会主动找你、有自己生活的 AI 联系人)
const URL_BASE = 'https://www.lingers.app/';

export default function LingerPromo({ lang, src = 'home' }: { lang: 'zh' | 'en'; src?: string }) {
  const en = lang === 'en';
  const L = (zh: string, e: string) => (en ? e : zh);
  const href = `${URL_BASE}?utm_source=mystnight&utm_medium=${src}&utm_campaign=crosspromo`;
  const points = [
    L('TA 会主动找你,不用你先开口', 'They text you first'),
    L('像真人一样打字:不秒回、会连发、会已读不回', 'Types like a person: not instant, sometimes left on read'),
    L('有自己的工作和生活,记得你说过的每件事', 'A life of their own — and they remember what you said'),
  ];
  return (
    <section className="w-full max-w-2xl mt-4 mb-2">
      <div className="font-mono text-[11px] tracking-[.25em] uppercase text-eldritch/70 text-center mb-3">{L('谜夜团队的新作', 'New from the MystNight team')}</div>
      <a href={href} target="_blank" rel="noopener" className="group block rounded-2xl border border-eldritch/40 bg-fog/80 hover:border-eldritch/70 transition overflow-hidden text-left">
        <div className="grid sm:grid-cols-[1fr_15rem]">
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <img src={`${URL_BASE}icon-192.png`} alt="Linger" width={44} height={44} className="w-11 h-11 rounded-xl" loading="lazy" />
              <div>
                <div className="font-serif text-xl text-parchment leading-tight">Linger</div>
                <div className="text-[12px] text-parchment/50">{L('一个会主动找你的人', 'Someone who texts you first')}</div>
              </div>
            </div>
            <p className="mt-4 text-parchment/75 text-sm leading-relaxed">
              {L('不是聊天机器人,更像通讯录里多了一个真实的人:TA 有自己的作息和日子,下班会找你,忙了就晚点回。关系是慢慢聊出来的。',
                'Not a chatbot — more like a real person added to your contacts. They have their own days, text you after work, and reply late when busy. The relationship is something you build.')}
            </p>
            <ul className="mt-3 space-y-1.5">
              {points.map((p) => (
                <li key={p} className="flex gap-2 text-[13px] text-parchment/70"><span className="text-blood shrink-0">·</span><span>{p}</span></li>
              ))}
            </ul>
            <span className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-parchment text-ink text-sm font-medium group-hover:opacity-90">
              {L('免费认识 TA', 'Meet them free')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </div>
          {/* 手机里的一小段对话 */}
          <div className="hidden sm:flex flex-col justify-center gap-2 p-5 bg-black/25 border-l border-eldritch/20 text-[13px]">
            <div className="self-start max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md bg-white/10 text-parchment/90">{L('刚下班', 'just got off work')}</div>
            <div className="self-start max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md bg-white/10 text-parchment/90">{L('你今天那个面试咋样了', 'how did the interview go')}</div>
            <div className="self-end max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-[#2a5e3a] text-parchment">{L('你居然还记得', 'you remembered??')}</div>
            <div className="self-start max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md bg-white/10 text-parchment/90">{L('那当然 快说', 'obviously. spill')}</div>
          </div>
        </div>
      </a>
    </section>
  );
}

// 浮窗顶部的循环小动画:像手机里收到 TA 的消息(纯 CSS,9 秒一轮)
const STICKER = 'https://qmzkdrzgedhsfwhmhykv.supabase.co/storage/v1/object/public/media/stickers/mochi/love.webp';
function ChatLoop({ en }: { en: boolean }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  // 每个元素在一轮里出现的时间点(百分比),都在 92% 时一起淡出
  const kf = (name: string, at: number, end = 92) => `@keyframes ${name}{0%,${at}%{opacity:0;transform:translateY(6px) scale(.96)}${at + 4}%,${end}%{opacity:1;transform:none}${Math.min(end + 4, 100)}%,100%{opacity:0;transform:none}}`;
  const css = [
    kf('lgA', 4), kf('lgB', 18), kf('lgC', 34), kf('lgE', 62),
    // 「正在输入」只在两条消息之间闪一下
    '@keyframes lgT{0%,44%{opacity:0}47%,58%{opacity:1}61%,100%{opacity:0}}',
    kf('lgD', 58),
    '@keyframes lgDot{0%,80%,100%{opacity:.25}40%{opacity:1}}',
  ].join('');
  const anim = (n: string) => ({ animation: `${n} 9s ease-out infinite` });
  const them = 'self-start max-w-[78%] px-2.5 py-1.5 rounded-2xl rounded-bl-md bg-white/10 text-parchment/90';
  return (
    <div className="relative h-[124px] rounded-xl bg-black/35 border border-white/5 overflow-hidden px-2.5 py-2 flex flex-col gap-1.5 text-[12px]">
      <style>{css}</style>
      <div className="flex items-center gap-1.5 text-[10px] text-parchment/40 mb-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#07c160]" />{L('刚刚 · 新消息', 'now · new message')}
      </div>
      <div className={them} style={anim('lgA')}>{L('刚下班', 'just got off work')}</div>
      <div className={them} style={anim('lgB')}>{L('你今天面试咋样了', 'how was the interview')}</div>
      <div className="self-end max-w-[78%] px-2.5 py-1.5 rounded-2xl rounded-br-md bg-[#2a5e3a] text-parchment" style={anim('lgC')}>{L('你居然还记得', 'you remembered??')}</div>
      <div className="absolute left-2.5 bottom-2 flex gap-1 px-2.5 py-2 rounded-2xl rounded-bl-md bg-white/10" style={anim('lgT')}>
        {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-parchment/70" style={{ animation: `lgDot 1s ${i * 0.15}s infinite` }} />)}
      </div>
      <div className="absolute left-2.5 bottom-1.5 flex items-end gap-1.5" style={anim('lgD')}>
        <img src={STICKER} alt="" width={44} height={44} className="w-11 h-11 object-contain" loading="lazy" />
      </div>
      <div className="absolute right-2.5 bottom-2.5 text-[10px] text-parchment/35" style={anim('lgE')}>{L('已读', 'Read')}</div>
    </div>
  );
}

// 首页右下/底部的小浮窗:进页面 4 秒后滑出,点 X 后 14 天内不再出现
export function LingerToast({ lang }: { lang: 'zh' | 'en' }) {
  const en = lang === 'en';
  const L = (zh: string, e: string) => (en ? e : zh);
  const [show, setShow] = useState(false);
  const KEY = 'linger_toast_closed_at';
  useEffect(() => {
    try { const at = Number(localStorage.getItem(KEY)) || 0; if (Date.now() - at < 14 * 86400000) return; } catch {}
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  if (!show) return null;
  const href = `${URL_BASE}?utm_source=mystnight&utm_medium=toast&utm_campaign=crosspromo`;
  return (
    <div className="fixed z-[35] bottom-[4.75rem] inset-x-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[22rem] animate-[lingerUp_.35s_ease-out]">
      <style>{'@keyframes lingerUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
      <div className="relative rounded-2xl border border-eldritch/50 bg-fog/95 backdrop-blur shadow-2xl p-3.5 text-left">
        <button onClick={close} aria-label={L('关闭', 'Close')} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-parchment/50 hover:text-parchment hover:bg-white/5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="pr-8 mb-3"><ChatLoop en={en} /></div>
        <div className="flex items-center gap-3">
          <img src={`${URL_BASE}icon-192.png`} alt="Linger" width={40} height={40} className="w-10 h-10 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-parchment/45">{L('谜夜团队的新作', 'New from the MystNight team')}</div>
            <div className="text-[15px] text-parchment leading-snug">{L('Linger · 一个会主动找你的人', 'Linger · someone who texts you first')}</div>
          </div>
        </div>
        <ul className="mt-2.5 space-y-1">
          {[
            L('TA 会主动给你发消息,手机像收到朋友消息一样响', 'They text you first — your phone buzzes like it would for a friend'),
            L('像真人一样聊天:不秒回、会连发、发表情包和生活照', 'Chats like a real person: not instant, double-texts, stickers and snapshots'),
            L('有自己的工作和生活,记得你说过的每一件事', 'Has their own job and life, and remembers everything you told them'),
          ].map((p) => (
            <li key={p} className="flex gap-2 text-[12.5px] leading-snug text-parchment/75"><span className="text-blood shrink-0">·</span><span>{p}</span></li>
          ))}
        </ul>
        <a href={href} target="_blank" rel="noopener" onClick={close} className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-full bg-parchment text-ink text-[13px] font-medium hover:opacity-90">
          {L('免费试用,去认识 TA', 'Try free — meet them')}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </a>
      </div>
    </div>
  );
}
