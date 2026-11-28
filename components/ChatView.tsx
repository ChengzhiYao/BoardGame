'use client';
// 聊天窗口(私聊 / 大厅公共频道共用)。手机上是全屏的聊天页(像微信/iMessage):顶栏、按发送人分组的气泡、
// 时间分隔、跟着键盘走的输入框;电脑上嵌在侧边面板里。
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ChatMsg = { id?: string; text: string; ts?: number; mine?: boolean; name?: string; avatar?: string | null; userId?: string; pending?: boolean; failed?: boolean };

function Ava({ url, name, size = 32 }: { url?: string | null; name: string; size?: number }) {
  const s = { width: size, height: size };
  return url
    ? <img src={url} alt="" style={s} className="rounded-full object-cover border border-white/10 shrink-0" />
    : <span style={s} className="rounded-full bg-[#2a2530] border border-white/10 flex items-center justify-center text-[12px] text-parchment/80 shrink-0">{(name || '?').slice(0, 1).toUpperCase()}</span>;
}

function hhmm(ts: number, en?: boolean) {
  const d = new Date(ts); const now = new Date();
  const t = d.toLocaleTimeString(en ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: !!en });
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return (en ? 'Yesterday ' : '昨天 ') + t;
  return d.toLocaleDateString(en ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' }) + ' ' + t;
}

export default function ChatView(props: {
  full?: boolean; en?: boolean;
  title: string; subtitle?: ReactNode; avatar?: { url?: string | null; name: string } | null; right?: ReactNode; onBack?: () => void;
  msgs: ChatMsg[]; showSender?: boolean; empty?: ReactNode;
  text: string; setText: (s: string) => void; send: () => void;
  hint?: ReactNode; disabled?: boolean; footer?: ReactNode; placeholder?: string; maxLen?: number;
  onAvatar?: (m: ChatMsg) => void; onMsgMenu?: (m: ChatMsg) => ReactNode | null;
}) {
  const { full, en, msgs } = props;
  const L = (zh: string, e: string) => (en ? e : zh);
  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [vh, setVh] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const lastLen = useRef(0);

  // 手机全屏时:高度跟着可见区域走(键盘弹出时输入框不会被挡住)
  useEffect(() => {
    if (!full || typeof window === 'undefined') return;
    const vv = (window as any).visualViewport;
    const on = () => setVh(vv ? vv.height : window.innerHeight);
    on(); vv?.addEventListener('resize', on); window.addEventListener('resize', on);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { vv?.removeEventListener('resize', on); window.removeEventListener('resize', on); document.body.style.overflow = prev; };
  }, [full]);

  // 新消息:在底部就跟着滚,不在底部就提示「N 条新消息」
  useLayoutEffect(() => {
    const el = listRef.current; if (!el) return;
    const grew = msgs.length > lastLen.current; const mineLast = msgs[msgs.length - 1]?.mine;
    if (lastLen.current === 0 || atBottom || mineLast) { el.scrollTop = el.scrollHeight; setNewCount(0); }
    else if (grew) setNewCount((n) => n + (msgs.length - lastLen.current));
    lastLen.current = msgs.length;
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [vh]);

  // 输入框随内容长高(最多 4 行)
  useEffect(() => { const t = taRef.current; if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 112) + 'px'; }, [props.text]);

  const onScroll = () => { const el = listRef.current; if (!el) return; const b = el.scrollHeight - el.scrollTop - el.clientHeight < 60; setAtBottom(b); if (b) setNewCount(0); };
  const toBottom = () => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); };
  const canSend = !!props.text.trim() && !props.disabled;
  const doSend = () => { if (!canSend) return; props.send(); requestAnimationFrame(() => taRef.current?.focus()); };

  const rows: ReactNode[] = [];
  let prev: ChatMsg | null = null;
  msgs.forEach((m, i) => {
    const ts = m.ts || 0; const gap = prev && ts && prev.ts ? ts - prev.ts : Infinity;
    if (ts && (gap > 5 * 60000 || !prev)) rows.push(<div key={'t' + i} className="text-center text-[11px] text-parchment/35 py-2">{hhmm(ts, en)}</div>);
    const sameSender = !!prev && gap < 5 * 60000 && !!prev.mine === !!m.mine && (prev.userId || prev.name) === (m.userId || m.name);
    const next = msgs[i + 1]; const lastOfGroup = !next || !!next.mine !== !!m.mine || (next.userId || next.name) !== (m.userId || m.name) || ((next.ts || 0) - ts > 5 * 60000);
    const others = !m.mine;
    const key = m.id || String(i);
    const menu = props.onMsgMenu && menuFor === key ? props.onMsgMenu(m) : null;
    rows.push(
      <div key={key} className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'} ${sameSender ? 'mt-0.5' : 'mt-2.5'}`}>
        {others && props.showSender && (lastOfGroup
          ? <button onClick={() => props.onAvatar?.(m)} className="shrink-0"><Ava url={m.avatar} name={m.name || '?'} size={30} /></button>
          : <span className="w-[30px] shrink-0" />)}
        <div className={`max-w-[78%] flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
          {others && props.showSender && !sameSender && <div className="text-[11px] text-parchment/45 mb-0.5 px-1 truncate max-w-full">{m.name}</div>}
          <div
            onContextMenu={props.onMsgMenu ? (e) => { e.preventDefault(); setMenuFor(menuFor === key ? null : key); } : undefined}
            onClick={props.onMsgMenu ? () => setMenuFor(menuFor === key ? null : key) : undefined}
            className={`px-3.5 py-2 text-[15px] leading-[1.45] whitespace-pre-wrap break-words ${m.mine
              ? `bg-[#8e2a2a] text-[#fbefe6] rounded-[20px] ${lastOfGroup ? 'rounded-br-[6px]' : ''}`
              : `bg-[#22232a] text-parchment rounded-[20px] ${lastOfGroup ? 'rounded-bl-[6px]' : ''}`} ${m.pending ? 'opacity-60' : ''} ${m.failed ? 'ring-1 ring-red-500/70' : ''}`}>
            {m.text}
          </div>
          {m.failed && <div className="text-[11px] text-red-400/80 mt-0.5 px-1">{L('没发出去', 'Not sent')}</div>}
          {menu && <div className="mt-1 flex gap-1.5">{menu}</div>}
        </div>
      </div>,
    );
    prev = m;
  });

  const body = (
    <div className={`flex flex-col ${full ? 'h-full' : 'h-[22rem]'} min-h-0 bg-[#111216]`}>
      {/* 顶栏 */}
      <div className={`flex items-center gap-2.5 px-3 ${full ? 'pt-[max(10px,env(safe-area-inset-top))] pb-2.5' : 'py-2'} border-b border-white/[0.07] bg-[#15161b]/95 backdrop-blur shrink-0`}>
        {props.onBack && (
          <button onClick={props.onBack} aria-label={L('返回', 'Back')} className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-parchment/80 hover:bg-white/[0.06] active:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}
        {props.avatar && <Ava url={props.avatar.url} name={props.avatar.name} size={full ? 36 : 30} />}
        <div className="flex-1 min-w-0 leading-tight">
          <div className={`${full ? 'text-[16px]' : 'text-[14px]'} font-medium text-parchment truncate`}>{props.title}</div>
          {props.subtitle && <div className="text-[11.5px] text-parchment/45 truncate">{props.subtitle}</div>}
        </div>
        {props.right}
      </div>
      {/* 消息 */}
      <div className="relative flex-1 min-h-0">
        <div ref={listRef} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">
          {msgs.length === 0 ? <div className="h-full flex items-center justify-center text-center text-[13px] text-parchment/40 px-8 leading-relaxed">{props.empty}</div> : rows}
        </div>
        {newCount > 0 && (
          <button onClick={toBottom} className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#2a2b33] border border-white/10 text-[12.5px] text-parchment shadow-lg">
            {L(`${newCount} 条新消息 ↓`, `${newCount} new ↓`)}
          </button>
        )}
      </div>
      {props.hint && !props.disabled && <div className="px-4 pt-2 text-[12px] text-parchment/50 leading-snug shrink-0">{props.hint}</div>}
      {/* 输入框 */}
      <div className={`px-2.5 pt-2 ${full ? 'pb-[max(10px,env(safe-area-inset-bottom))]' : 'pb-2'} shrink-0`}>
        {props.disabled ? <div className="px-2 py-2 text-[12.5px] text-parchment/60">{props.footer}</div> : (
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 rounded-[22px] bg-[#1c1d23] border border-white/[0.09] focus-within:border-[#c9a96e]/50 px-3.5 py-2">
              <textarea ref={taRef} rows={1} value={props.text} maxLength={props.maxLen || 1000}
                onChange={(e) => props.setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); doSend(); } }}
                placeholder={props.placeholder || L('说点什么…', 'Say something…')}
                className="block w-full resize-none bg-transparent outline-none text-[16px] leading-[1.4] text-parchment placeholder:text-parchment/35 max-h-28" />
            </div>
            <button onClick={doSend} disabled={!canSend} aria-label={L('发送', 'Send')}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition bg-[#a83232] text-white disabled:bg-white/[0.06] disabled:text-parchment/30 active:scale-95">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!full) return <div className="overflow-hidden">{body}</div>;
  // 用 portal 挂到 body 上:外层面板有 backdrop-blur,会让 fixed 定位失效
  const sheet = (
    <div className="fixed inset-x-0 top-0 z-[95] text-parchment" style={{ height: vh ? vh + 'px' : '100dvh' }}>
      {body}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet;
}
