'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Player = { id: string; seat: string; user_id: string; is_online: boolean };
type UserRow = { id: string; display_name: string | null };
type Message = {
  id: string;
  sender_type: string;
  sender_player_id: string | null;
  action_type: string | null;
  content: string;
  created_at: string;
};

const ACTIONS: Record<string, string> = {
  investigate: '调查',
  talk: '交谈',
  combat: '战斗',
  move: '移动',
  free: '自由',
};

export default function RoomClient(props: {
  room: any;
  initialPlayers: Player[];
  initialUsers: UserRow[];
  initialMessages: Message[];
  myPlayerId: string | null;
  mySeat: string | null;
  userId: string;
  inviteToken: string;
  siteUrl: string;
}) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [players, setPlayers] = useState<Player[]>(props.initialPlayers);
  const [users, setUsers] = useState<UserRow[]>(props.initialUsers);
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [action, setAction] = useState('free');
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nameOfUser = (uid?: string | null) =>
    users.find((u) => u.id === uid)?.display_name || '调查员';
  const seatOfPlayer = (pid?: string | null) =>
    players.find((p) => p.id === pid)?.seat || '?';
  const nameOfPlayer = (pid?: string | null) => {
    const p = players.find((x) => x.id === pid);
    return p ? nameOfUser(p.user_id) : '调查员';
  };

  const inviteUrl = props.siteUrl
    ? `${props.siteUrl}/join/${props.inviteToken}`
    : `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${props.inviteToken}`;

  // 实时：新消息
  useEffect(() => {
    const ch = supabase
      .channel(`room-msgs-${props.room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) =>
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          )
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [props.room.id, supabase]);

  // 实时：有新玩家加入时，刷新服务端数据（拿到对方昵称/座位）
  useEffect(() => {
    const ch = supabase
      .channel(`room-players-${props.room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${props.room.id}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [props.room.id, supabase, router]);

  // 保持 props 刷新后同步到 state
  useEffect(() => setPlayers(props.initialPlayers), [props.initialPlayers]);
  useEffect(() => setUsers(props.initialUsers), [props.initialUsers]);

  // 在线状态（Presence）
  useEffect(() => {
    const ch = supabase.channel(`room-presence-${props.room.id}`, {
      config: { presence: { key: props.userId } },
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const map: Record<string, boolean> = {};
      Object.keys(state).forEach((k) => (map[k] = true));
      setOnline(map);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ seat: props.mySeat });
    });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [props.room.id, props.userId, props.mySeat, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const content = text.trim();
    if (!content || !props.myPlayerId || thinking) return;
    setText('');
    setThinking(true);
    try {
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id, content, action }),
      });
      const data = await res.json();
      if (!res.ok) alert('守秘人出错：' + (data.error || ''));
    } catch (e: any) {
      alert('发送失败：' + e.message);
    } finally {
      setThinking(false);
    }
  }

  const seatA = players.find((p) => p.seat === 'A');
  const seatB = players.find((p) => p.seat === 'B');

  function SeatBadge({ p, label }: { p?: Player; label: string }) {
    const isOnline = p ? !!online[p.user_id] : false;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-fog border border-eldritch/30">
        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-parchment/30'}`} />
        <span className="text-sm text-parchment/80">
          {label}：{p ? nameOfUser(p.user_id) : '空席（等待加入）'}
          {p && p.user_id === props.userId ? '（你）' : ''}
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* 顶栏 */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-eldritch/20">
        <div className="flex items-center gap-3">
          <span className="font-serif text-lg text-parchment">{props.room.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-eldritch/20 text-parchment/60">
            {statusLabel(props.room.status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SeatBadge p={seatA} label="A" />
          <SeatBadge p={seatB} label="B" />
        </div>
      </header>

      {/* 邀请条（仅在还没满员时显示） */}
      {!seatB && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-2 bg-fog/60 border-b border-eldritch/10">
          <span className="text-sm text-parchment/70">把邀请链接发给同伴：</span>
          <code className="text-xs px-2 py-1 rounded bg-ink border border-eldritch/30 text-eldritch break-all">
            {inviteUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs px-3 py-1 rounded bg-eldritch/40 hover:bg-eldritch/70 text-parchment"
          >
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      )}

      {/* 聊天区 */}
      <section className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-parchment/40 text-sm mt-10">
            还没有人开口。说点什么，让调查开始。
          </p>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            mine={m.sender_player_id === props.myPlayerId}
            who={
              m.sender_type === 'player'
                ? `${nameOfPlayer(m.sender_player_id)}（${seatOfPlayer(m.sender_player_id)}）`
                : m.sender_type === 'kp'
                ? '守秘人'
                : '系统'
            }
            action={m.action_type && m.action_type !== 'free' ? ACTIONS[m.action_type] : ''}
            content={m.content}
          />
        ))}
        {thinking && (
          <div className="flex flex-col items-start">
            <span className="text-xs text-parchment/40 mb-1">守秘人</span>
            <div className="px-4 py-2 rounded-lg bg-fog border border-eldritch/30 text-parchment/50 italic">
              守秘人正在凝视着深渊……
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </section>

      {/* 底栏：行动类型 + 输入 */}
      <footer className="px-5 py-3 border-t border-eldritch/20 flex items-center gap-2">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="px-2 py-2 rounded bg-fog border border-eldritch/30 text-parchment text-sm"
        >
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={props.myPlayerId ? '描述你的行动…' : '你不在这个房间里'}
          disabled={!props.myPlayerId}
          className="flex-1 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!props.myPlayerId}
          className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50"
        >
          发送
        </button>
      </footer>
    </main>
  );
}

function Bubble({
  mine,
  who,
  action,
  content,
}: {
  mine: boolean;
  who: string;
  action: string;
  content: string;
}) {
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-parchment/40 mb-1">
        {who}
        {action ? ` · ${action}` : ''}
      </span>
      <div
        className={`max-w-[75%] px-4 py-2 rounded-lg leading-relaxed ${
          mine
            ? 'bg-blood/30 border border-blood/40'
            : 'bg-fog border border-eldritch/30'
        } text-parchment/90`}
      >
        {content}
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  return (
    { waiting: '等待中', character_creation: '角色创建中', playing: '跑团中', ended: '已结束' }[
      s
    ] || s
  );
}
