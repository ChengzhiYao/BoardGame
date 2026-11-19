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
