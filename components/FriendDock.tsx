'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Friend = { email: string; name: string; roomId?: string };
type Msg = { name: string; text: string; ts: number; mine: boolean };

export default function FriendDock() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const chRef = useRef<any>(null);
  const roomRef = useRef<string | undefined>(undefined);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; if (open) setUnread(0); }, [open]);

  const roomId = (() => { const m = pathname && pathname.match(/^\/room\/([^/?#]+)/); return m ? m[1] : undefined; })();
  useEffect(() => { roomRef.current = roomId; }, [roomId]);

  // only for logged-in whitelisted accounts
  useEffect(() => {
    let on = true;
    fetch('/api/billing/status').then((r) => r.json()).then((d) => {
      if (on && d && d.loggedIn && d.whitelisted && d.email) setMe({ email: d.email, name: String(d.email).split('@')[0] });
    }).catch(() => {});
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    const ch = supabase.channel('friend-dock', { config: { presence: { key: me.email } } });
    chRef.current = ch;
    const sync = () => {
      const st = ch.presenceState() as Record<string, any[]>;
      const list: Friend[] = [];
      Object.keys(st).forEach((key) => {
        if (key === me.email) return;
        const meta = (st[key] && st[key][0]) || {};
        list.push({ email: key, name: meta.name || key.split('@')[0], roomId: meta.roomId });
      });
      setFriends(list);
    };
    ch.on('presence', { event: 'sync' }, sync);
    ch.on('broadcast', { event: 'msg' }, (p: any) => {
      const m = (p && p.payload) || {};
      if (m.from === me.email) return;
      setMsgs((prev) => [...prev.slice(-59), { name: m.fromName || 'friend', text: m.text, ts: m.ts, mine: false }]);
      if (!openRef.current) setUnread((u) => u + 1);
    });
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') ch.track({ name: me.name, roomId: roomRef.current, ts: Date.now() });
    });
    return () => { try { supabase.removeChannel(ch); } catch {} chRef.current = null; };
  }, [me]);

  useEffect(() => {
    if (chRef.current && me) chRef.current.track({ name: me.name, roomId, ts: Date.now() }).catch(() => {});
  }, [roomId, me]);

  function send() {
    const t = text.trim();
    if (!t || !chRef.current || !me) return;
    chRef.current.send({ type: 'broadcast', event: 'msg', payload: { from: me.email, fromName: me.name, text: t, ts: Date.now() } });
    setMsgs((prev) => [...prev.slice(-59), { name: me.name, text: t, ts: Date.now(), mine: true }]);
    setText('');
  }

  if (!me) return null;

  return (
    <div className="fixed bottom-3 right-3 z-40 text-parchment">
      {open && (
        <div className="mb-2 w-72 rounded-2xl border border-eldritch/30 bg-fog/95 backdrop-blur shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-eldritch/20">
            <span className="text-sm font-medium">好友 · Friends</span>
            <button onClick={() => setOpen(false)} className="text-parchment/50 hover:text-parchment text-base leading-none px-1">–</button>
          </div>
          <div className="px-3 py-2 space-y-1.5 border-b border-eldritch/15">
            {friends.length === 0 && <div className="text-xs text-parchment/40 py-1">还没有好友在线</div>}
            {friends.map((f) => (
              <div key={f.email} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                {f.roomId && f.roomId !== roomId
                  ? <button onClick={() => router.push('/room/' + f.roomId)} className="text-xs px-2 py-0.5 rounded bg-blood/80 hover:bg-blood text-parchment shrink-0">加入</button>
                  : <span className="text-[10px] text-parchment/40 shrink-0">{f.roomId ? '同房' : '在线'}</span>}
              </div>
            ))}
          </div>
          <div className="h-44 overflow-y-auto px-3 py-2 space-y-1.5 flex flex-col">
            {msgs.length === 0 && <div className="text-xs text-parchment/35 m-auto">打个招呼吧 👋</div>}
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-xs leading-snug ${m.mine ? 'self-end bg-blood/30 border border-blood/40' : 'self-start bg-ink/70 border border-eldritch/30'}`}>{m.text}</div>
            ))}
          </div>
          <div className="flex gap-1.5 p-2 border-t border-eldritch/20">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="说点什么…"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-xs outline-none focus:border-eldritch" />
            <button onClick={send} className="px-3 py-1.5 rounded-lg bg-eldritch/60 hover:bg-eldritch text-parchment text-xs shrink-0">发送</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} title="好友"
        className="relative w-12 h-12 rounded-full bg-fog/95 border border-eldritch/40 backdrop-blur shadow-xl flex items-center justify-center hover:bg-fog">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f2ead9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        {friends.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-fog" />}
        {unread > 0 && <span className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-blood text-[10px] flex items-center justify-center">{unread}</span>}
      </button>
    </div>
  );
}
