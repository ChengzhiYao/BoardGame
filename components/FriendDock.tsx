'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// 这个账号不进公共大厅 / 玩家目录 / 好友图（只保留白名单好友功能，男友侧仍可见）。
const HIDDEN = 'hattieichinose@gmail.com';

type Msg = { text: string; ts: number; mine: boolean };
type Peer = { uid: string; name: string; roomId?: string; userId?: string; avatar?: string | null };
type Node = { id: string; name: string; lastSeen?: number | null; avatar?: string | null };
type Notif = { id: string; text: string; ts: number };

function anonId() {
  try { let v = localStorage.getItem('lobbyUid'); if (!v) { v = 'g_' + Math.random().toString(36).slice(2, 9); localStorage.setItem('lobbyUid', v); } return v; }
  catch { return 'g_' + Math.random().toString(36).slice(2, 9); }
}
function guestName() {
  try { const n = localStorage.getItem('name'); if (n && n.trim()) return n.trim(); } catch {}
  return '访客' + anonId().slice(-4);
}

function Avatar({ url, name, online }: { url?: string | null; name: string; online?: boolean }) {
  return (
    <div className="relative shrink-0">
      {url
        ? <img src={url} alt="" className="w-7 h-7 rounded-full object-cover border border-eldritch/30" />
        : <span className="w-7 h-7 rounded-full bg-eldritch/40 flex items-center justify-center text-[11px] text-parchment">{(name || '?').slice(0, 1).toUpperCase()}</span>}
      {online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-fog" />}
    </div>
  );
}

function ago(ts?: number | null) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '刚刚'; if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60); if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24); if (d < 30) return d + ' 天前';
  const mo = Math.floor(d / 30); if (mo < 12) return mo + ' 个月前';
  return Math.floor(mo / 12) + ' 年前';
}

function ChatBox({ msgs, text, setText, send, empty, hint, disabled, footer }: { msgs: Msg[]; text: string; setText: (s: string) => void; send: () => void; empty: string; hint?: string; disabled?: boolean; footer?: ReactNode }) {
  return (
    <>
      <div className="h-40 overflow-y-auto px-3 py-2 space-y-1.5 flex flex-col">
        {msgs.length === 0 && <div className="text-xs text-parchment/35 m-auto">{empty}</div>}
        {msgs.map((m, i) => (<div key={i} className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-xs leading-snug ${m.mine ? 'self-end bg-blood/30 border border-blood/40' : 'self-start bg-ink/70 border border-eldritch/30'}`}>{m.text}</div>))}
      </div>
      {hint && !disabled && <div className="px-3 pt-1 text-[11px] text-parchment/45 leading-snug">{hint}</div>}
      {disabled ? (
        <div className="p-2 border-t border-eldritch/20">{footer}</div>
      ) : (
        <div className="flex gap-1.5 p-2 border-t border-eldritch/20">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="说点什么…" className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-xs outline-none focus:border-eldritch" />
          <button onClick={send} className="px-3 py-1.5 rounded-lg bg-eldritch/60 hover:bg-eldritch text-parchment text-xs shrink-0">发送</button>
        </div>
      )}
    </>
  );
}

export default function FriendDock() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ uid: string; userId?: string; name: string; email: string | null; whitelisted: boolean; avatar?: string | null } | null>(null);
  const [tab, setTab] = useState<'friends' | 'online' | 'players' | 'messages'>('online');
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [unread, setUnread] = useState(0);

  const [roster, setRoster] = useState<string[]>([]);
  const [fOnline, setFOnline] = useState<Record<string, { roomId?: string }>>({});
  const [gMsgs, setGMsgs] = useState<Msg[]>([]);
  const [gText, setGText] = useState('');

  const [people, setPeople] = useState<Peer[]>([]);
  const [lobbyById, setLobbyById] = useState<Record<string, { uid: string; name: string; roomId?: string; avatar?: string | null }>>({});
  const [peer, setPeer] = useState<Peer | null>(null);
  const [dms, setDms] = useState<Record<string, { name: string; msgs: Msg[] }>>({});
  const [dmText, setDmText] = useState('');
  const [thread, setThread] = useState<Record<string, Msg[]>>({});
  const [inbox, setInbox] = useState<{ userId: string; name: string; unread: number; lastTs: number; lastText: string }[]>([]);
  const [threadGated, setThreadGated] = useState(false);

  const [dir, setDir] = useState<Node[] | null>(null);
  const [invited, setInvited] = useState<Record<string, 'sending' | 'ok' | string>>({});

  const [graph, setGraph] = useState<{ friends: Node[]; incoming: Node[]; outgoing: Node[] }>({ friends: [], incoming: [], outgoing: [] });
  const [addState, setAddState] = useState<Record<string, string>>({});

  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [seenTs, setSeenTs] = useState(0);
  const [profile, setProfile] = useState<any | null>(null);

  const fChan = useRef<any>(null);
  const lChan = useRef<any>(null);
  const roomRef = useRef<string | undefined>(undefined);
  const openRef = useRef(false);
  const peerRef = useRef<string | null>(null);
  const prevOnlineRef = useRef<Set<string> | null>(null);
  useEffect(() => { openRef.current = open; if (open) setUnread(0); }, [open]);
  useEffect(() => { peerRef.current = peer?.uid || null; }, [peer]);

  const roomId = (() => { const m = pathname && pathname.match(/^\/room\/([^/?#]+)/); return m ? m[1] : undefined; })();
  useEffect(() => { roomRef.current = roomId; }, [roomId]);

  function pushNotif(id: string, text: string) {
    setNotifs((prev) => (prev.some((n) => n.id === id) ? prev : [{ id, text, ts: Date.now() }, ...prev].slice(0, 30)));
  }

  // 身份
  useEffect(() => {
    let on = true;
    const anon = () => { if (on) { setMe({ uid: anonId(), name: guestName(), email: null, whitelisted: false }); setTab('online'); } };
    fetch('/api/billing/status').then((r) => r.json()).then((d) => {
      if (!on) return;
      if (d && d.loggedIn && d.email) {
        const wl = !!d.whitelisted;
        setMe({ uid: d.email, userId: d.userId, name: String(d.email).split('@')[0], email: d.email, whitelisted: wl, avatar: d.avatarUrl || null });
        setTab(wl ? 'friends' : 'online');
        if (wl) {
          try { const k = 'mn_announce_at'; const last = Number(localStorage.getItem(k) || 0); if (Date.now() - last > 600000) { localStorage.setItem(k, String(Date.now())); fetch('/api/announce-online', { method: 'POST' }).catch(() => {}); } } catch {}
          fetch('/api/friends').then((x) => x.json()).then((fr) => { if (on) setRoster((fr.emails || []).filter((e: string) => e && e !== d.email)); }).catch(() => {});
        }
        loadGraph();
      } else anon();
    }).catch(anon);
    return () => { on = false; };
  }, []);

  // 白名单好友频道：在线状态 + 群聊
  useEffect(() => {
    if (!me || !me.whitelisted) return;
    const supabase = createClient();
    const ch = supabase.channel('friend-dock', { config: { presence: { key: me.email! } } });
    fChan.current = ch;
    fetch('/api/group-chat?channel=whitelist').then((r) => r.json()).then((d) => { if (d.messages) setGMsgs(d.messages.map((m: any) => ({ text: m.text, ts: m.ts, mine: m.mine }))); }).catch(() => {});
    const sync = () => { const st = ch.presenceState() as Record<string, any[]>; const map: Record<string, { roomId?: string }> = {}; Object.keys(st).forEach((key) => { if (key === me.email) return; const meta = (st[key] && st[key][0]) || {}; map[key] = { roomId: meta.roomId }; }); setFOnline(map); };
    ch.on('presence', { event: 'sync' }, sync);
    ch.on('broadcast', { event: 'msg' }, (p: any) => { const m = (p && p.payload) || {}; if (m.from === me.email) return; setGMsgs((prev) => [...prev.slice(-59), { text: m.text, ts: m.ts, mine: false }]); if (!openRef.current) setUnread((u) => u + 1); });
    ch.subscribe((s: string) => { if (s === 'SUBSCRIBED') ch.track({ name: me.name, roomId: roomRef.current, ts: Date.now() }); });
    return () => { try { supabase.removeChannel(ch); } catch {} fChan.current = null; };
  }, [me]);

  // 公共大厅：在线玩家 + 私聊（hattie 除外）
  useEffect(() => {
    if (!me || me.email === HIDDEN) return;
    const supabase = createClient();
    const ch = supabase.channel('lobby', { config: { presence: { key: me.uid } } });
    lChan.current = ch;
    const sync = () => {
      const st = ch.presenceState() as Record<string, any[]>;
      const list: Peer[] = []; const byId: Record<string, { uid: string; name: string; roomId?: string; avatar?: string | null }> = {};
      Object.keys(st).forEach((key) => {
        const meta = (st[key] && st[key][0]) || {};
        if (meta.userId && key !== me.uid) byId[meta.userId] = { uid: key, name: meta.name || '访客', roomId: meta.roomId, avatar: meta.avatar };
        if (key === me.uid) return;
        if (meta.email === HIDDEN) return;
        list.push({ uid: key, name: meta.name || '访客', roomId: meta.roomId, userId: meta.userId, avatar: meta.avatar });
      });
      setPeople(list); setLobbyById(byId);
    };
    ch.on('presence', { event: 'sync' }, sync);
    ch.on('broadcast', { event: 'dm' }, (p: any) => {
      const m = (p && p.payload) || {}; if (m.to !== me.uid) return;
      setDms((prev) => { const c = prev[m.from] || { name: m.fromName || '访客', msgs: [] }; return { ...prev, [m.from]: { name: m.fromName || c.name, msgs: [...c.msgs.slice(-59), { text: m.text, ts: m.ts, mine: false }] } }; });
      if (!openRef.current || peerRef.current !== m.from) setUnread((u) => u + 1);
    });
    ch.subscribe((s: string) => { if (s === 'SUBSCRIBED') ch.track({ uid: me.uid, userId: me.userId, name: me.name, email: me.email, avatar: me.avatar, roomId: roomRef.current, ts: Date.now() }); });
    return () => { try { supabase.removeChannel(ch); } catch {} lChan.current = null; };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    if (fChan.current && me.whitelisted) fChan.current.track({ name: me.name, roomId, ts: Date.now() }).catch(() => {});
    if (lChan.current && me.email !== HIDDEN) lChan.current.track({ uid: me.uid, userId: me.userId, name: me.name, email: me.email, avatar: me.avatar, roomId, ts: Date.now() }).catch(() => {});
  }, [roomId, me]);

  // 好友图轮询
  async function loadGraph() { try { const r = await fetch('/api/friends/graph'); const d = await r.json(); setGraph({ friends: d.friends || [], incoming: d.incoming || [], outgoing: d.outgoing || [] }); } catch {} }
  useEffect(() => { if (!me || !me.email) return; const id = setInterval(loadGraph, 20000); return () => clearInterval(id); }, [me]);
  useEffect(() => { if (!me || !me.email) return; loadInbox(); const id = setInterval(loadInbox, 12000); return () => clearInterval(id); }, [me]);
  useEffect(() => { if (!me?.userId || !peer?.userId) return; const id = setInterval(() => loadThread(peer.userId!), 6000); return () => clearInterval(id); }, [me, peer]);
  useEffect(() => { const mq = window.matchMedia('(min-width: 1024px)'); const on = () => setIsDesktop(mq.matches); on(); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);

  // 好友上线 → 推送通知（首个 sync 不通知）
  useEffect(() => {
    if (!me || !me.email) return;
    const cur = new Set<string>();
    const label: Record<string, string> = {};
    graph.friends.forEach((f) => { if (lobbyById[f.id]) { cur.add('g:' + f.id); label['g:' + f.id] = f.name; } });
    roster.forEach((e) => { if (fOnline[e]) { cur.add('w:' + e); label['w:' + e] = e.split('@')[0]; } });
    const prev = prevOnlineRef.current;
    if (prev) cur.forEach((k) => { if (!prev.has(k)) pushNotif('on:' + k + ':' + Math.floor(Date.now() / 60000), `${label[k]} 上线了`); });
    prevOnlineRef.current = cur;
  }, [lobbyById, fOnline, graph.friends, roster, me]);

  // 收到好友请求 → 通知
  useEffect(() => { graph.incoming.forEach((r) => pushNotif('req:' + r.id, `${r.name} 请求加你好友`)); }, [graph.incoming]);

  function sendGroup() { const t = gText.trim(); if (!t || !fChan.current || !me) return; fChan.current.send({ type: 'broadcast', event: 'msg', payload: { from: me.email, fromName: me.name, text: t, ts: Date.now() } }); setGMsgs((prev) => [...prev.slice(-59), { text: t, ts: Date.now(), mine: true }]); setGText(''); fetch('/api/group-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'whitelist', text: t }) }).catch(() => {}); }
  function openDm(p: Peer) {
    if (me?.userId && p.userId) { openThread(p.userId, p.name, p); return; }
    setDms((prev) => (prev[p.uid] ? prev : { ...prev, [p.uid]: { name: p.name, msgs: [] } })); setPeer(p); setTab('online');
  }
  function openThread(userId: string, name: string, p?: Peer) {
    setThreadGated(false);
    setPeer({ uid: p?.uid || ('u:' + userId), name, userId, roomId: p?.roomId });
    setTab('online'); setOpen(true); setBellOpen(false);
    setInbox((prev) => prev.map((t) => (t.userId === userId ? { ...t, unread: 0 } : t)));
    loadThread(userId);
  }
  async function loadThread(userId: string) {
    try { const r = await fetch('/api/dm?with=' + encodeURIComponent(userId)); const d = await r.json(); setThread((prev) => ({ ...prev, [userId]: d.messages || [] })); } catch {}
  }
  async function loadInbox() { try { const r = await fetch('/api/dm/inbox'); const d = await r.json(); setInbox(d.threads || []); } catch {} }
  async function sendDbDm(userId: string) {
    const t = dmText.trim(); if (!t) return;
    const r = await fetch('/api/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: userId, text: t }) }).catch(() => null);
    if (r && r.ok) { setThread((prev) => ({ ...prev, [userId]: [...(prev[userId] || []), { text: t, ts: Date.now(), mine: true }] })); setDmText(''); loadInbox(); }
    else if (r && r.status === 403) setThreadGated(true);
  }
  function sendDm() { const t = dmText.trim(); if (!t || !lChan.current || !me || !peer) return; const _pid = peer.userId; const _isFriend = !!_pid && graph.friends.some((f) => f.id === _pid); const _gated = !!me.email && me.email !== HIDDEN && !!_pid && !_isFriend; const _sent = (dms[peer.uid]?.msgs || []).filter((m) => m.mine).length; if (_gated && _sent >= 1) return; lChan.current.send({ type: 'broadcast', event: 'dm', payload: { to: peer.uid, from: me.uid, fromName: me.name, text: t, ts: Date.now() } }); setDms((prev) => { const c = prev[peer.uid] || { name: peer.name, msgs: [] }; return { ...prev, [peer.uid]: { name: c.name, msgs: [...c.msgs.slice(-59), { text: t, ts: Date.now(), mine: true }] } }; }); setDmText(''); }

  function openProfile(id: string) {
    setProfile({ loading: true });
    fetch('/api/player?id=' + encodeURIComponent(id)).then((r) => r.json()).then((d) => setProfile(d && d.ok ? d : { error: true })).catch(() => setProfile({ error: true }));
  }
  async function loadDir() { try { const r = await fetch('/api/players'); const d = await r.json(); setDir(d.players || []); const inv: Record<string, 'ok'> = {}; (d.invitedIds || []).forEach((id: string) => { inv[id] = 'ok'; }); setInvited((p) => ({ ...inv, ...p })); } catch { setDir([]); } }
  async function invite(id: string) {
    setInvited((p) => ({ ...p, [id]: 'sending' }));
    try {
      const r = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: id }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setInvited((p) => ({ ...p, [id]: 'ok' })); return; }
      const det = String(d.detail || '').toLowerCase();
      const sendHint = det.includes('not verified') || det.includes('verify') ? '域名未验证' : det.includes('own email') || det.includes('testing emails') ? '域名未验证(只能发你自己)' : det.includes('api key') || det.includes('unauthor') ? 'Key无效' : '发送失败';
      const msg = d.reason === 'dup' ? '刚邀请过' : d.reason === 'limit' ? '今日上限' : d.reason === 'no_provider' ? '邮件未配置' : d.reason === 'send_failed' ? sendHint : '失败';
      setInvited((p) => ({ ...p, [id]: msg }));
    } catch { setInvited((p) => ({ ...p, [id]: '失败' })); }
  }
  async function addFriend(id: string) {
    setAddState((p) => ({ ...p, [id]: '...' }));
    try { const r = await fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: id }) }); const d = await r.json().catch(() => ({})); if (r.ok && d.ok) { setAddState((p) => ({ ...p, [id]: d.accepted ? '已成为好友' : '已发送' })); loadGraph(); } else setAddState((p) => ({ ...p, [id]: d.reason === 'db' ? '需建表' : '失败' })); }
    catch { setAddState((p) => ({ ...p, [id]: '失败' })); }
  }
  async function respondReq(fromUserId: string, accept: boolean) {
    try { await fetch('/api/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromUserId, accept }) }); setNotifs((prev) => prev.filter((n) => n.id !== 'req:' + fromUserId)); loadGraph(); } catch {}
  }

  if (!me) return null;
  const showFriends = !!me.email;              // 任何登录账号都有好友
  const showOnline = me.email !== HIDDEN;
  const showPlayers = !!me.email && me.email !== HIDDEN;
  const activeDm = peer ? dms[peer.uid] : null;

  const friendIds = new Set(graph.friends.map((f) => f.id));
  const outIds = new Set(graph.outgoing.map((f) => f.id));
  const inIds = new Set(graph.incoming.map((f) => f.id));

  const anyFriendOnline = roster.some((e) => fOnline[e]) || graph.friends.some((f) => lobbyById[f.id]);
  const anyOnline = people.length > 0 || anyFriendOnline;
  const dmUnread = inbox.reduce((a, t) => a + t.unread, 0);
  const unseen = notifs.filter((n) => n.ts > seenTs).length + graph.incoming.length + dmUnread;
  const peopleBadge = dmUnread + graph.incoming.length + unread;

  const messagesBody = (
          <div className="max-h-72 overflow-y-auto px-3 py-2 space-y-2">
            {inbox.filter((t) => t.unread > 0).map((t) => (
              <div key={'dm' + t.userId} className="flex items-center gap-1.5 text-xs">
                <span className="truncate flex-1">💬 <b>{t.name}</b> 发来 {t.unread} 条消息</span>
                <button onClick={() => openThread(t.userId, t.name)} className="px-2 py-0.5 rounded bg-blood/80 hover:bg-blood text-parchment shrink-0">查看</button>
              </div>
            ))}
            {graph.incoming.map((r) => (
              <div key={'bi' + r.id} className="flex items-center gap-1.5 text-xs">
                <span className="truncate flex-1"><b>{r.name}</b> 请求加你好友</span>
                <button onClick={() => respondReq(r.id, true)} className="px-2 py-0.5 rounded bg-green-700/70 hover:bg-green-700 text-parchment shrink-0">同意</button>
                <button onClick={() => respondReq(r.id, false)} className="px-2 py-0.5 rounded bg-ink/70 border border-eldritch/30 text-parchment/60 shrink-0">拒绝</button>
              </div>
            ))}
            {notifs.filter((n) => !n.id.startsWith('req:')).map((n) => (
              <div key={n.id} className="text-xs text-parchment/80">🟢 {n.text}</div>
            ))}
            {graph.incoming.length === 0 && dmUnread === 0 && notifs.filter((n) => !n.id.startsWith('req:')).length === 0 && <div className="text-xs text-parchment/35 py-6 text-center">暂无消息</div>}
          </div>
  );
  function toggleBell() { setBellOpen((v) => { const nv = !v; if (nv) { setOpen(false); setSeenTs(Date.now()); } return nv; }); }
  function toggleDock() { setOpen((v) => { const nv = !v; if (nv) setBellOpen(false); return nv; }); }

  return (
    <div className={isDesktop ? 'fixed left-3 top-16 z-40 text-parchment' : 'fixed bottom-3 right-3 z-40 text-parchment'}>
      {(open || isDesktop) && (
        <div className={`${isDesktop ? 'w-72 max-h-[calc(100vh-5.5rem)] overflow-y-auto' : 'mb-2 w-72 overflow-hidden'} rounded-2xl border border-eldritch/30 bg-fog/95 backdrop-blur shadow-2xl`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-eldritch/20 sticky top-0 bg-fog/95 backdrop-blur z-10">
            <div className="flex gap-3 text-sm">
              {isDesktop && showFriends && <button onClick={() => setTab('messages')} className={tab === 'messages' ? 'text-parchment font-medium' : 'text-parchment/40 hover:text-parchment'}>消息{unseen > 0 && <span className="text-blood"> · {unseen}</span>}</button>}
              {showFriends && <button onClick={() => { setTab('friends'); setPeer(null); }} className={tab === 'friends' ? 'text-parchment font-medium' : 'text-parchment/40 hover:text-parchment'}>好友{anyFriendOnline && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 ml-1 align-middle animate-pulse" />}{graph.incoming.length > 0 && <span className="text-blood"> · {graph.incoming.length}</span>}</button>}
              {showOnline && <button onClick={() => setTab('online')} className={tab === 'online' ? 'text-parchment font-medium' : 'text-parchment/40 hover:text-parchment'}>在线{people.length > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 ml-1 align-middle animate-pulse" />}{people.length > 0 && <span className="text-green-400"> {people.length}</span>}</button>}
              {showPlayers && <button onClick={() => { setTab('players'); setPeer(null); if (dir === null) loadDir(); }} className={tab === 'players' ? 'text-parchment font-medium' : 'text-parchment/40 hover:text-parchment'}>玩家{Object.keys(lobbyById).length > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 ml-1 align-middle animate-pulse" />}</button>}
            </div>
            {!isDesktop && <button onClick={() => setOpen(false)} className="text-parchment/50 hover:text-parchment text-base leading-none px-1">–</button>}
          </div>
          {tab === 'messages' && isDesktop && messagesBody}

          {tab === 'friends' && showFriends && (
            <>
              {graph.incoming.length > 0 && (
                <div className="px-3 py-2 border-b border-eldritch/15 space-y-1.5">
                  <div className="text-[11px] text-blood/90">好友请求</div>
                  {graph.incoming.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <span className="truncate flex-1">{r.name}</span>
                      <button onClick={() => respondReq(r.id, true)} className="text-xs px-2 py-0.5 rounded bg-green-700/70 hover:bg-green-700 text-parchment shrink-0">同意</button>
                      <button onClick={() => respondReq(r.id, false)} className="text-xs px-2 py-0.5 rounded bg-ink/70 border border-eldritch/30 text-parchment/60 shrink-0">拒绝</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-3 py-2 space-y-1.5 border-b border-eldritch/15 max-h-44 overflow-y-auto">
                {roster.length === 0 && graph.friends.length === 0 && <div className="text-xs text-parchment/40 py-1">还没有好友 · 去「玩家」里加好友</div>}
                {roster.map((email) => { const onl = fOnline[email]; const name = email.split('@')[0];
                  return (<div key={'w' + email} className="flex items-center gap-2 text-sm">
                    <Avatar name={name} online={!!onl} />
                    <span className="truncate flex-1" title={email}>{name}</span>
                    {onl && onl.roomId && onl.roomId !== roomId
                      ? <button onClick={() => router.push('/room/' + onl.roomId)} className="text-xs px-2 py-0.5 rounded bg-blood/80 hover:bg-blood text-parchment shrink-0">加入</button>
                      : <span className="text-[10px] text-parchment/40 shrink-0">{onl ? (onl.roomId ? '同房' : '在线') : '离线'}</span>}
                  </div>); })}
                {graph.friends.map((f) => { const lob = lobbyById[f.id]; const onl = !!lob;
                  return (<div key={'g' + f.id} className="flex items-center gap-2 text-sm">
                    <Avatar url={f.avatar} name={f.name} online={onl} />
                    <span className="truncate flex-1">{f.name}</span>
                    {onl && lob!.roomId && lob!.roomId !== roomId && <button onClick={() => router.push('/room/' + lob!.roomId)} className="text-[10px] px-2 py-0.5 rounded bg-eldritch/40 text-parchment/70 shrink-0">加入</button>}
                    {onl ? <button onClick={() => openDm({ uid: lob!.uid, name: f.name, roomId: lob!.roomId, userId: f.id })} className="text-xs px-2 py-0.5 rounded bg-blood/80 hover:bg-blood text-parchment shrink-0">私聊</button> : <span className="text-[10px] text-parchment/40 shrink-0">离线</span>}
                  </div>); })}
              </div>
              {me.whitelisted && <ChatBox msgs={gMsgs} text={gText} setText={setGText} send={sendGroup} empty="打个招呼吧 👋" />}
            </>
          )}

          {tab === 'online' && showOnline && !peer && (
            <div className="px-3 py-2 min-h-[11rem] max-h-72 overflow-y-auto">
              {people.length === 0 && <div className="text-xs text-parchment/40 py-8 text-center">现在没有其他人在线</div>}
              {people.map((p) => (
                <div key={p.uid} className="flex items-center gap-2 text-sm py-1">
                  <Avatar url={p.avatar} name={p.name} online />
                  <span className="truncate flex-1">{p.name}</span>
                  {p.roomId && p.roomId !== roomId && <button onClick={() => router.push('/room/' + p.roomId)} className="text-[10px] px-2 py-0.5 rounded bg-eldritch/40 text-parchment/70 shrink-0">加入</button>}
                  <button onClick={() => openDm(p)} className="text-xs px-2 py-0.5 rounded bg-blood/80 hover:bg-blood text-parchment shrink-0">私聊</button>
                </div>
              ))}
            </div>
          )}
          {tab === 'online' && showOnline && peer && (() => {
            const pid = peer.userId;
            const dbMode = !!me.userId && !!pid;
            const msgs = dbMode ? (thread[pid!] || []) : (activeDm?.msgs || []);
            const isFriend = !!pid && friendIds.has(pid);
            const gated = !!me.email && me.email !== HIDDEN && !!pid && !isFriend;
            const sent = msgs.filter((m) => m.mine).length;
            const blocked = gated && (threadGated || sent >= 1);
            const rel = pid && friendIds.has(pid) ? 'friend' : pid && outIds.has(pid) ? 'out' : pid && inIds.has(pid) ? 'in' : 'none';
            const addBtn = rel === 'none'
              ? <button onClick={() => pid && addFriend(pid)} className="text-xs px-2 py-0.5 rounded bg-eldritch/50 hover:bg-eldritch text-parchment shrink-0">加好友</button>
              : rel === 'out' ? <span className="text-[10px] text-parchment/40 shrink-0">待通过</span>
              : rel === 'in' ? <button onClick={() => pid && respondReq(pid, true)} className="text-xs px-2 py-0.5 rounded bg-green-700/70 hover:bg-green-700 text-parchment shrink-0">同意</button>
              : <span className="text-[10px] text-green-400 shrink-0">好友</span>;
            return (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-eldritch/15 text-sm">
                <button onClick={() => setPeer(null)} className="text-parchment/50 hover:text-parchment">←</button>
                <span className="truncate flex-1">{peer.name}</span>
                {gated && addBtn}
              </div>
              <ChatBox
                msgs={msgs} text={dmText} setText={setDmText} send={() => (dbMode ? sendDbDm(pid!) : sendDm())}
                empty={dbMode ? `给 ${peer.name} 发消息 · 对方离线也能收到` : `和 ${peer.name} 私聊`}
                hint={gated ? '⚠️ 你们还不是好友，只能发 1 条消息 · 互相加好友后才能继续聊天' : undefined}
                disabled={blocked}
                footer={<div className="text-[11px] text-parchment/55 flex items-center gap-2"><span className="flex-1">已发 1 条 · 互相加好友后才能继续聊天</span>{addBtn}</div>}
              />
            </>
            ); })()}

          {tab === 'players' && showPlayers && (
            <div className="px-3 py-2 min-h-[11rem] max-h-72 overflow-y-auto">
              <div className="text-[11px] text-parchment/40 mb-1.5">注册玩家 · 加好友 或 发邮件邀请</div>
              {dir === null && <div className="text-xs text-parchment/40 py-6 text-center">加载中…</div>}
              {dir !== null && dir.length === 0 && <div className="text-xs text-parchment/40 py-6 text-center">还没有其他注册玩家</div>}
              {(dir || []).map((pp) => { const st = invited[pp.id]; const as = addState[pp.id];
                const rel = friendIds.has(pp.id) ? '好友' : outIds.has(pp.id) ? '待通过' : inIds.has(pp.id) ? 'incoming' : '';
                const online = !!lobbyById[pp.id];
                return (<div key={pp.id} className="flex items-center gap-2 text-sm py-1">
                  <button onClick={() => openProfile(pp.id)} title="查看资料" className="relative shrink-0">
                    {pp.avatar
                      ? <img src={pp.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-eldritch/30" />
                      : <span className="w-7 h-7 rounded-full bg-eldritch/40 flex items-center justify-center text-[11px] text-parchment">{pp.name.slice(0, 1).toUpperCase()}</span>}
                    {online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-fog" />}
                  </button>
                  <button onClick={() => openProfile(pp.id)} className="flex-1 min-w-0 leading-tight text-left">
                    <div className="truncate hover:text-parchment">{pp.name}</div>
                    <div className="text-[10px] text-parchment/35 truncate">{online ? '在线' : pp.lastSeen ? '最近在线 ' + ago(pp.lastSeen) : '从未上线'}</div>
                  </button>
                  {rel === '好友' ? <span className="text-[10px] text-green-400 shrink-0">好友</span>
                    : rel === '待通过' ? <span className="text-[10px] text-parchment/40 shrink-0">待通过</span>
                    : rel === 'incoming' ? <button onClick={() => respondReq(pp.id, true)} className="text-xs px-2 py-0.5 rounded bg-green-700/70 hover:bg-green-700 text-parchment shrink-0">同意</button>
                    : <button onClick={() => addFriend(pp.id)} className="text-xs px-1.5 py-0.5 rounded bg-eldritch/50 hover:bg-eldritch text-parchment shrink-0">{as || '加好友'}</button>}
                  <button onClick={() => openThread(pp.id, pp.name)} className="text-xs px-1.5 py-0.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment shrink-0">私聊</button>
                  {st === 'ok' ? <span className="text-[10px] text-green-400 shrink-0">✓邀请</span>
                    : st === 'sending' ? <span className="text-[10px] text-parchment/40 shrink-0">…</span>
                    : <button onClick={() => invite(pp.id)} className="text-xs px-2 py-0.5 rounded bg-blood/80 hover:bg-blood text-parchment shrink-0" title="邮件邀请一起玩">{st && st !== 'ok' ? st : '邀请'}</button>}
                </div>); })}
            </div>
          )}
        </div>
      )}

      {!isDesktop && bellOpen && (
        <div className="mb-2 w-64 rounded-2xl border border-eldritch/30 bg-fog/95 backdrop-blur shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-eldritch/20 text-sm">
            <span className="text-parchment/80">消息</span>
            <button onClick={() => setBellOpen(false)} className="text-parchment/50 hover:text-parchment text-base leading-none px-1">–</button>
          </div>
          {messagesBody}
        </div>
      )}

      {profile && (() => {
        const pid = profile.id as string | undefined;
        const rel = pid && friendIds.has(pid) ? 'friend' : pid && outIds.has(pid) ? 'out' : pid && inIds.has(pid) ? 'in' : 'none';
        return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setProfile(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-fog border border-eldritch/40 shadow-2xl overflow-hidden text-parchment" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-eldritch/20">
              <span className="text-sm text-parchment/70">玩家资料</span>
              <button onClick={() => setProfile(null)} className="text-parchment/50 hover:text-parchment text-base leading-none px-1">✕</button>
            </div>
            {profile.loading ? <div className="py-10 text-center text-parchment/40 text-sm">加载中…</div>
            : profile.error ? <div className="py-10 text-center text-parchment/40 text-sm">加载失败</div>
            : (<div className="px-4 py-4">
                <div className="flex items-center gap-3 mb-3">
                  {profile.avatar
                    ? <img src={profile.avatar} alt="" className="w-14 h-14 rounded-full object-cover border border-eldritch/40" />
                    : <span className="w-14 h-14 rounded-full bg-eldritch/40 flex items-center justify-center text-xl">{String(profile.name).slice(0, 1).toUpperCase()}</span>}
                  <div className="min-w-0">
                    <div className="text-lg font-serif truncate">{profile.name}</div>
                    <div className="text-[11px] text-parchment/40">{profile.lastSeen ? '最近在线 ' + ago(profile.lastSeen) : '从未上线'}{profile.joinedAt ? ' · 加入于 ' + new Date(profile.joinedAt).toLocaleDateString() : ''}</div>
                  </div>
                </div>
                {profile.bio && <div className="text-sm text-parchment/75 bg-ink/40 border border-eldritch/20 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap">{profile.bio}</div>}
                <div className="text-xs text-parchment/50 mb-1.5">玩过的游戏 · 共 {profile.gamesPlayed} 局</div>
                <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                  {(!profile.games || profile.games.length === 0) && <div className="text-xs text-parchment/35 py-2">还没有游戏记录</div>}
                  {(profile.games || []).map((g: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-eldritch/10 py-1">
                      <span className="text-parchment/80">{g.modeName}{g.ended ? '' : ' ·进行中'}</span>
                      <span className="text-parchment/35">{new Date(g.ts).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {rel === 'friend' ? <span className="flex-1 text-center text-xs text-green-400 py-2">已是好友</span>
                    : rel === 'out' ? <span className="flex-1 text-center text-xs text-parchment/40 py-2">好友请求待通过</span>
                    : rel === 'in' ? <button onClick={() => pid && (respondReq(pid, true), setProfile(null))} className="flex-1 py-2 rounded bg-green-700/70 hover:bg-green-700 text-sm">同意好友</button>
                    : <button onClick={() => pid && addFriend(pid)} className="flex-1 py-2 rounded bg-eldritch/50 hover:bg-eldritch text-sm">加好友</button>}
                  <button onClick={() => { if (pid) { openThread(pid, profile.name); setProfile(null); } }} className="flex-1 py-2 rounded bg-blood/80 hover:bg-blood text-sm">私聊</button>
                </div>
              </div>)}
          </div>
        </div>
        ); })()}
      {!isDesktop && <div className="flex items-center gap-2 justify-end">
        {showFriends && (
          <button onClick={toggleBell} title="消息" className="relative w-10 h-10 rounded-full bg-fog/95 border border-eldritch/40 backdrop-blur shadow-xl flex items-center justify-center hover:bg-fog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f2ead9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {unseen > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blood text-[10px] flex items-center justify-center">{unseen}</span>}
          </button>
        )}
        <button onClick={toggleDock} title="好友 / 在线 / 玩家" className="relative w-12 h-12 rounded-full bg-fog/95 border border-eldritch/40 backdrop-blur shadow-xl flex items-center justify-center hover:bg-fog">
          {anyOnline && <span className="absolute inset-0 rounded-full border-2 border-green-400/70 animate-ping pointer-events-none" />}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f2ead9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          {peopleBadge > 0 && <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-blood text-[10px] font-medium flex items-center justify-center border border-fog">{peopleBadge > 99 ? '99+' : peopleBadge}</span>}
        </button>
      </div>}
    </div>
  );
}
