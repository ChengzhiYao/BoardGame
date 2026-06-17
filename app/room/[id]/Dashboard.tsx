'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Stepper from './Stepper';
import { playSfx } from '@/lib/audio/sfx';
import type { ShellProps } from './RoomShell';
import { tr } from '@/lib/i18n';

const EN = (l?: string) => l === 'en';

const ACTION_LABELS: Record<string, Record<string, string>> = {
  zh: { investigate: '调查', talk: '交谈', combat: '战斗', move: '移动', free: '自由', chat: '对话' },
  en: { investigate: 'Investigate', talk: 'Talk', combat: 'Fight', move: 'Move', free: 'Free', chat: 'Talk' },
};
const IMG_TYPE: Record<string, Record<string, string>> = {
  zh: { scene_image: '场景', npc_portrait: 'NPC', clue_evidence: '证物', monster_image: '怪物', event_illustration: '事件' },
  en: { scene_image: 'Scene', npc_portrait: 'NPC', clue_evidence: 'Evidence', monster_image: 'Monster', event_illustration: 'Event' },
};
const THREADS_L: Record<string, Record<string, string>> = {
  zh: { A: '建筑历史', B: '失踪 / 死亡', C: 'NPC 异常', D: '超自然现象', E: '关键物品 / 仪式', 其他: '其他线索' },
  en: { A: 'History', B: 'Missing / Death', C: 'NPC Anomaly', D: 'Supernatural', E: 'Key Item / Ritual', 其他: 'Other' },
};
const ACT = (lang: string, k: string) => (ACTION_LABELS[EN(lang) ? 'en' : 'zh'][k] || '');

export default function Dashboard(props: ShellProps) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const lang = props.room.language || 'zh';
  const t = tr(lang);
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [action, setAction] = useState('free');
  const [thinking, setThinking] = useState(false);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [genImg, setGenImg] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'story' | 'chars' | 'clues'>('story');
  const bottomRef = useRef<HTMLDivElement>(null);
  const ended = props.room.game_state === 'ended';

  const players = props.initialPlayers;
  const users = props.initialUsers;
  const characters = props.initialCharacters;
  const dflt = EN(lang) ? 'Investigator' : '调查员';
  const nameOfUser = (uid?: string) => users.find((u) => u.id === uid)?.display_name || dflt;
  const playerById = (pid?: string | null) => players.find((p) => p.id === pid);
  const charOfSeat = (seat: string) => {
    const p = players.find((x) => x.seat === seat);
    return characters.find((c) => c.player_id === p?.id);
  };
  const charNameOrUser = (seat: string) => {
    const p = players.find((x) => x.seat === seat);
    return charOfSeat(seat)?.name || nameOfUser(p?.user_id);
  };

  useEffect(() => {
    let tm: any;
    const ch = supabase
      .channel(`room-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => {
          const m = payload.new;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          const sfx = m.payload?.sfx;
          if (Array.isArray(sfx)) sfx.forEach((k: string) => playSfx(k));
          if (tm) clearTimeout(tm);
          tm = setTimeout(() => router.refresh(), 500);
        })
      .subscribe();
    return () => { if (tm) clearTimeout(tm); supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  useEffect(() => {
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = props.initialMessages.filter((m) => !ids.has(m.id));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [props.initialMessages]);

  useEffect(() => {
    const ch = supabase.channel(`room-presence-${props.room.id}`, { config: { presence: { key: props.userId } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const map: Record<string, boolean> = {};
      Object.keys(state).forEach((k) => (map[k] = true));
      setOnline(map);
    }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await ch.track({ seat: props.mySeat }); });
    return () => { supabase.removeChannel(ch); };
  }, [props.room.id, props.userId, props.mySeat, supabase]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const room = props.room;
  const myReady = props.mySeat === 'A' ? room.player_a_ready : room.player_b_ready;
  const resolving = room.resolution_status === 'resolving';
  const myPending = room.pending_actions?.[props.mySeat as string]?.content;
  const myChar = charOfSeat(props.mySeat as string);
  const myOut = !!myChar && ((myChar.status_flags?.dead || myChar.status_flags?.retired) || (myChar.hp_current ?? 1) <= 0 || (myChar.san_current ?? 1) <= 0);

  async function sendChat() {
    const c = text.trim();
    if (!c || !props.myPlayerId) return;
    setText('');
    const { error } = await supabase.from('messages').insert({
      room_id: room.id, sender_type: 'player', sender_player_id: props.myPlayerId,
      action_type: 'chat', content: c, visibility: 'public', turn_no: room.current_round || 1,
    });
    if (error) alert((EN(lang) ? 'Send failed: ' : '发送失败：') + error.message);
  }
  async function submitAction(content: string, act: string = action) {
    const c = (content || '').trim();
    if (!c || !props.myPlayerId || myReady || resolving || ended || myOut) return;
    setText(''); setThinking(true);
    try {
      const res = await fetch('/api/round/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, content: c, action_type: act }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || (EN(lang) ? 'Submit failed' : '提交失败'));
    } catch (e: any) { alert((EN(lang) ? 'Submit failed: ' : '提交失败：') + e.message); }
    finally { setThinking(false); }
  }
  async function withdrawAction() {
    try {
      await fetch('/api/round/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: room.id }) });
    } catch {}
  }
  function submitFromInput() { submitAction(text, action); }

  const guidance = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === 'kp' && messages[i].payload?.guidance) return messages[i].payload.guidance;
    }
    return null;
  })();

  async function makeImage(imageId: string) {
    setGenImg(imageId);
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id, imageId }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || (EN(lang) ? 'Image failed' : '出图失败'));
    } catch (e: any) { alert((EN(lang) ? 'Image failed: ' : '出图失败：') + e.message); }
    finally { setGenImg(null); }
  }

  const suggestedImages = props.initialImages.filter((i) => i.status === 'suggested' || i.status === 'generating' || i.status === 'failed');
  const doneImages = props.initialImages.filter((i) => i.status === 'done');

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <Stepper current={props.room.game_state} lang={lang} />

      {ended && <EndedBanner roomId={props.room.id} lang={lang} />}

      <div className="flex items-center justify-between px-4 py-2 text-xs text-parchment/50 border-b border-eldritch/10">
        <span>{t('dash_round', { n: props.room.current_round || 1 })}</span>
        <SuspicionMeter value={props.room.suspicion || 0} lang={lang} />
        <span>{t('dash_img_budget')} {props.room.image_used}/{props.room.image_budget}</span>
      </div>
      <WorldClock clock={props.room.world_clock} round={props.room.current_round || 1} lang={lang} />

      <div className="lg:hidden flex border-b border-eldritch/15 text-sm">
        {(['story', 'chars', 'clues'] as const).map((k) => (
          <button key={k} onClick={() => setMobileTab(k)}
            className={`flex-1 py-2.5 ${mobileTab === k ? 'bg-blood/25 text-parchment border-b-2 border-blood' : 'text-parchment/50'}`}>
            {t(`tab_${k}`)}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[260px_1fr_300px] overflow-hidden">
        <aside className={`border-r border-eldritch/15 p-3 space-y-3 overflow-y-auto min-h-0 lg:block ${mobileTab === 'chars' ? 'block flex-1' : 'hidden'}`}>
          {(['A', 'B'] as const).map((seat) => {
            const p = players.find((x) => x.seat === seat);
            return <CharacterCard key={seat} seat={seat} char={charOfSeat(seat)} name={nameOfUser(p?.user_id)} online={!!online[p?.user_id as string]} lang={lang} />;
          })}
        </aside>

        <section className={`flex-col overflow-hidden min-h-0 lg:flex ${mobileTab === 'story' ? 'flex flex-1' : 'hidden'}`}>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m) => (
              <MessageRow key={m.id} m={m} mine={m.sender_player_id === props.myPlayerId}
                seat={playerById(m.sender_player_id)?.seat} who={nameOfUser(playerById(m.sender_player_id)?.user_id)} lang={lang} />
            ))}
            {(thinking || resolving) && <div className="text-center text-parchment/40 italic text-sm">{t('resolving')}</div>}
            {!ended && guidance && (
              <GuidanceBlock g={guidance} mySeat={props.mySeat} lang={lang} disabled={!props.myPlayerId || myReady || resolving || myOut} onPick={(opt) => submitAction(opt, 'investigate')} />
            )}
            {!ended && !guidance && !resolving && (
              <div className="mx-auto max-w-2xl text-center text-sm text-parchment/45 italic border border-eldritch/20 rounded-lg px-4 py-3">
                {t('guide_hint')}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <RoundStatus room={room} nameA={charNameOrUser('A')} nameB={charNameOrUser('B')} lang={lang} />

            {myOut && !ended ? (
              <div className="text-center text-sm text-blood py-1">{t('out_notice')}</div>
            ) : myReady && !ended ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-eldritch shrink-0">{t('submitted')}</span>
                <span className="flex-1 text-parchment/80 truncate">{myPending}</span>
                <button onClick={withdrawAction} disabled={resolving}
                  className="px-3 py-1.5 rounded bg-fog border border-parchment/30 text-parchment/80 text-xs disabled:opacity-40">
                  {resolving ? t('resolving_short') : t('withdraw')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${props.mySeat === 'A' ? 'bg-eldritch/30' : 'bg-blood/30'} text-parchment shrink-0`}>{t('you')} · {props.mySeat}</span>
                  <select value={action} onChange={(e) => setAction(e.target.value)} disabled={ended}
                    className="px-2 py-2 rounded bg-fog border border-eldritch/30 text-parchment text-sm disabled:opacity-40 shrink-0">
                    {['investigate', 'talk', 'combat', 'move', 'free'].map((k) => <option key={k} value={k}>{ACT(lang, k)}</option>)}
                  </select>
                  <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitFromInput()}
                    placeholder={ended ? t('ended_input_ph') : t('input_ph')} disabled={!props.myPlayerId || ended}
                    className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
                </div>
                <div className="flex gap-2">
                  <button onClick={sendChat} disabled={!props.myPlayerId || ended}
                    className="flex-1 px-3 py-2 rounded bg-fog border border-eldritch/40 text-parchment text-sm hover:bg-eldritch/20 disabled:opacity-50">{t('btn_chat')}</button>
                  <button onClick={submitFromInput} disabled={!props.myPlayerId || thinking || resolving || ended}
                    className="flex-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">{t('btn_submit')}</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className={`border-l border-eldritch/15 p-3 space-y-4 overflow-y-auto min-h-0 lg:block ${mobileTab === 'clues' ? 'block flex-1' : 'hidden'}`}>
          <Panel title={t('panel_scene')}>
            {suggestedImages.map((img) => (
              <div key={img.id} className="mb-3 p-2 rounded bg-fog border border-eldritch/40">
                <div className="text-xs text-eldritch mb-1">{EN(lang) ? 'Suggested image · ' : '建议配图 · '}{IMG_TYPE[EN(lang) ? 'en' : 'zh'][img.image_type] || IMG_TYPE[EN(lang) ? 'en' : 'zh'].scene_image}</div>
                <div className="text-[11px] text-parchment/50 mb-2 line-clamp-3">{img.prompt}</div>
                <button onClick={() => makeImage(img.id)} disabled={genImg === img.id || img.status === 'generating'}
                  className="w-full px-3 py-1.5 rounded bg-eldritch/50 hover:bg-eldritch text-parchment text-xs disabled:opacity-50">
                  {genImg === img.id || img.status === 'generating' ? (EN(lang) ? 'Generating…' : '出图中…') : img.status === 'failed' ? (EN(lang) ? 'Retry' : '重试出图') : (EN(lang) ? 'Generate this image' : '生成这张配图')}
                </button>
              </div>
            ))}
            {doneImages.length === 0 && suggestedImages.length === 0 && <Empty text={t('scene_empty')} />}
            <div className="space-y-2">
              {doneImages.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.storage_url} alt="" className="rounded border border-eldritch/30 w-full" />
              ))}
            </div>
          </Panel>

          <Panel title={t('panel_clue')}>
            {props.initialClues.length === 0 ? <Empty text={t('clue_empty')} /> : (
              <ClueBoard clues={props.initialClues} roomId={props.room.id} lang={lang} />
            )}
          </Panel>

          <Panel title={t('panel_npc')}>
            {props.initialNpcs.length === 0 ? <Empty text={t('npc_empty')} /> : (
              <ul className="space-y-1">
                {props.initialNpcs.map((n) => (
                  <li key={n.id} className="text-sm text-parchment/80">{n.name} <span className="text-parchment/40 text-xs">{n.role}</span></li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function MessageRow({ m, mine, seat, who, lang }: { m: any; mine: boolean; seat?: string; who: string; lang: string }) {
  const t = tr(lang);
  const type = m.payload?.type;
  if (m.sender_type === 'system' && type === 'ending') {
    return (
      <div className="mx-auto max-w-2xl text-center my-2">
        <div className="px-5 py-4 rounded-lg bg-blood/20 border border-blood/50 text-parchment leading-relaxed">{m.content}</div>
      </div>
    );
  }
  if (m.sender_type === 'system') {
    if (type === 'world') {
      return <div className="mx-auto max-w-2xl text-center text-sm text-amber-400/90 bg-amber-900/15 border border-amber-700/30 rounded px-3 py-1.5">{m.content}</div>;
    }
    if (type === 'private') {
      return (
        <div className="mx-auto max-w-2xl rounded-lg bg-blood/10 border border-blood/30 px-4 py-2 text-parchment/85 italic text-sm">
          <span className="text-[10px] text-blood not-italic">{EN(lang) ? 'Only you · ' : '仅你可见 · '}</span>{m.content}
        </div>
      );
    }
    if (type === 'deduction') {
      return <div className="mx-auto max-w-2xl text-center text-sm text-emerald-300 bg-emerald-900/15 border border-emerald-700/30 rounded px-3 py-1.5">{m.content}</div>;
    }
    const color = type === 'dice' ? 'text-eldritch' : type === 'san' ? 'text-blood' : type === 'combat' ? 'text-red-400' : 'text-parchment/50';
    return <div className={`text-center text-sm ${color}`}>{m.content}</div>;
  }
  if (m.sender_type === 'kp') {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-[11px] uppercase tracking-widest text-eldritch/70 mb-1">{t('kp')}</div>
        <div className="px-4 py-3 rounded-lg bg-eldritch/10 border border-eldritch/30 text-parchment/90 leading-relaxed italic">{m.content}</div>
      </div>
    );
  }
  const isA = seat === 'A';
  const act = m.action_type && m.action_type !== 'free' ? ACT(lang, m.action_type) : '';
  return (
    <div className={`flex flex-col ${isA ? 'items-start' : 'items-end'}`}>
      <span className="text-xs text-parchment/40 mb-1">{who}（{seat}）{act ? ` · ${act}` : ''}{mine ? ` · ${t('you')}` : ''}</span>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg leading-relaxed text-parchment/90 border ${isA ? 'bg-eldritch/20 border-eldritch/40' : 'bg-blood/25 border-blood/40'}`}>{m.content}</div>
    </div>
  );
}

function CharacterCard({ seat, char, name, online, lang }: { seat: string; char: any; name: string; online: boolean; lang: string }) {
  const accent = seat === 'A' ? 'border-eldritch/50' : 'border-blood/50';
  const flags = char?.status_flags || {};
  const STAT = EN(lang)
    ? { retired: 'Out', indef: 'Insane', temp: 'Temp. insane', dying: 'Dying', wounded: 'Wounded', ok: 'Normal' }
    : { retired: '退场', indef: '长期疯狂', temp: '临时疯狂', dying: '濒死', wounded: '受伤', ok: '正常' };
  const status = flags.retired ? STAT.retired : flags.indef_insanity ? STAT.indef : flags.temp_insanity ? STAT.temp : flags.dying ? STAT.dying : flags.wounded ? STAT.wounded : STAT.ok;
  return (
    <div className={`p-3 rounded-lg bg-fog border ${accent}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-10 h-10 rounded-full overflow-hidden border ${accent} bg-ink flex items-center justify-center shrink-0`}>
          {char?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : <span className="text-parchment/30 text-xs">{seat}</span>}
        </div>
        <span className="font-serif text-parchment flex-1">{char?.name || name}</span>
        <span className="flex items-center gap-1 text-xs text-parchment/50">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-parchment/30'}`} />{seat}
        </span>
      </div>
      {char ? (
        <div className="space-y-2 text-xs text-parchment/70">
          <div>{char.occupation}</div>
          {char.current_location && <div className="text-eldritch">📍 {char.current_location}</div>}
          <Bar label="HP" value={char.hp_current} max={char.hp_max} color="bg-blood" />
          <Bar label="SAN" value={char.san_current} max={char.san_max} color="bg-eldritch" />
          <div>{EN(lang) ? 'Luck' : '幸运'} {char.luck} ｜ {EN(lang) ? 'Status: ' : '状态：'}<span className={status === STAT.ok ? '' : 'text-blood'}>{status}</span></div>
          {Array.isArray(char.inventory) && char.inventory.length > 0 && (
            <div className="text-parchment/50">{EN(lang) ? 'Items: ' : '道具：'}{char.inventory.join('、')}</div>
          )}
          {char.resources && Object.keys(char.resources).length > 0 && (
            <div className="text-amber-400/80">{EN(lang) ? 'Resources: ' : '资源：'}{Object.entries(char.resources).map(([k, v]) => `${k} ${v}`).join('　')}</div>
          )}
        </div>
      ) : <div className="text-xs text-parchment/40">{EN(lang) ? 'No character sheet yet' : '尚未创建角色卡'}</div>}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-parchment/50"><span>{label}</span><span>{value}/{max}</span></div>
      <div className="h-1.5 rounded bg-ink overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-xs uppercase tracking-widest text-parchment/40 mb-2">{title}</h3>{children}</div>;
}

function ClueBoard({ clues, roomId, lang }: { clues: any[]; roomId: string; lang: string }) {
  const router = useRouter();
  const t = tr(lang);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function deduce() {
    if (sel.length < 2 || busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/clues/combine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, clueIds: sel }),
      });
      const d = await res.json();
      if (!res.ok) setMsg(d.error || (EN(lang) ? 'Deduction failed' : '推理失败'));
      else if (d.combines) { setMsg('🧩 ' + d.conclusion); setSel([]); router.refresh(); }
      else setMsg(d.message || (EN(lang) ? 'These clues don’t add up to anything new yet.' : '这些线索暂时拼不出新结论。'));
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  const T = THREADS_L[EN(lang) ? 'en' : 'zh'];
  const deductions = clues.filter((c) => c.kind === 'deduction');
  const facts = clues.filter((c) => c.kind !== 'deduction');
  const groups: Record<string, any[]> = {};
  for (const c of facts) {
    const k = ['A', 'B', 'C', 'D', 'E'].includes(c.thread) ? c.thread : '其他';
    (groups[k] = groups[k] || []).push(c);
  }
  const order = ['A', 'B', 'C', 'D', 'E', '其他'].filter((k) => groups[k]?.length);

  return (
    <div className="space-y-3">
      {deductions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 mb-1">{EN(lang) ? '🧩 Deductions' : '🧩 已得推论'}</div>
          <ul className="space-y-2">
            {deductions.map((c) => (
              <li key={c.id} className="text-sm text-emerald-200/90 border-l-2 border-emerald-500/60 pl-2">
                <div className="font-medium">{c.title}</div>
                <div className="text-parchment/40 text-[10px]">{c.source}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {order.map((k) => (
        <div key={k}>
          <div className="text-[10px] uppercase tracking-wider text-eldritch/70 mb-1">{T[k]}</div>
          <ul className="space-y-1.5">
            {groups[k].map((c) => {
              const on = sel.includes(c.id);
              return (
                <li key={c.id} onClick={() => toggle(c.id)}
                  className={`text-sm border-l-2 pl-2 py-0.5 cursor-pointer rounded-r ${on ? 'border-eldritch bg-eldritch/15' : 'border-eldritch/50 hover:bg-fog/60'}`}>
                  <div className="flex items-start gap-1.5">
                    <span className={`mt-0.5 w-3 h-3 rounded-sm border shrink-0 ${on ? 'bg-eldritch border-eldritch' : 'border-parchment/40'}`} />
                    <div>
                      <div className="font-medium text-parchment/80">{c.title}</div>
                      <div className="text-parchment/50 text-xs">{c.description}</div>
                      {c.visible_to !== 'all' && <span className="text-[10px] text-blood">{EN(lang) ? 'Only you · tell your partner' : '仅你可见 · 需告知队友'}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="pt-1 border-t border-eldritch/15 space-y-1.5">
        <button onClick={deduce} disabled={sel.length < 2 || busy}
          className="w-full px-3 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch/70 text-parchment text-xs disabled:opacity-40">
          {busy ? t('deducing') : t('deduce_btn', { n: sel.length })}
        </button>
        <div className="text-[10px] text-parchment/35">{t('deduce_hint')}</div>
        {msg && <div className="text-xs text-emerald-300/90">{msg}</div>}
      </div>
    </div>
  );
}

function WorldClock({ clock, round, lang }: { clock: any[]; round: number; lang: string }) {
  const t = tr(lang);
  const events = (Array.isArray(clock) ? clock : [])
    .filter((e) => e && !e.fired && !e.hidden && (Number(e.due_round) || 0) >= round)
    .sort((a, b) => (a.due_round || 0) - (b.due_round || 0))
    .slice(0, 2);
  if (!events.length) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-xs border-b border-amber-700/20 bg-amber-900/10 text-amber-300/90 overflow-x-auto">
      <span className="shrink-0">{t('clock_flow')}</span>
      {events.map((e) => {
        const left = Math.max(0, (e.due_round || 0) - round);
        return <span key={e.id} className="shrink-0 text-amber-200/80">· {e.label}（{t('rounds_left', { n: left })}）</span>;
      })}
    </div>
  );
}

function RoundStatus({ room, nameA, nameB, lang }: { room: any; nameA: string; nameB: string; lang: string }) {
  const a = room.player_a_ready, b = room.player_b_ready;
  const resolving = room.resolution_status === 'resolving';
  const submitted = EN(lang) ? 'submitted' : '已提交';
  const acting = EN(lang) ? 'acting…' : '行动中…';
  const Pill = ({ ready, name, seat }: { ready: boolean; name: string; seat: string }) => (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${ready ? 'border-green-500/50 text-green-400 bg-green-900/15' : 'border-parchment/20 text-parchment/45'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-green-400' : 'bg-parchment/30 animate-pulse'}`} />
      {seat}·{name} {ready ? submitted : acting}
    </span>
  );
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <Pill ready={a} name={nameA} seat="A" />
      <Pill ready={b} name={nameB} seat="B" />
      {resolving ? (
        <span className="text-xs text-amber-400">{EN(lang) ? 'Keeper is resolving…' : '守秘人结算中…'}</span>
      ) : a && b ? null : (
        <span className="text-xs text-parchment/40">{EN(lang) ? 'Resolves once both submit' : '两人都提交后开始结算'}</span>
      )}
    </div>
  );
}

function SuspicionMeter({ value, lang }: { value: number; lang: string }) {
  const color = value >= 12 ? 'text-red-500' : value >= 8 ? 'text-orange-400' : value >= 5 ? 'text-amber-400' : value >= 3 ? 'text-yellow-500' : 'text-parchment/50';
  const notesZh = ['高危', '警察介入', '区域封锁', '有人巡逻', 'NPC警惕', '平静'];
  const notesEn = ['Critical', 'Police closing in', 'Area locked down', 'Patrols out', 'NPCs wary', 'Calm'];
  const N = EN(lang) ? notesEn : notesZh;
  const note = value >= 15 ? N[0] : value >= 12 ? N[1] : value >= 8 ? N[2] : value >= 5 ? N[3] : value >= 3 ? N[4] : N[5];
  return (
    <span className={`flex items-center gap-1 ${color}`}>
      {EN(lang) ? 'Suspicion' : '嫌疑'} {value} · {note}
    </span>
  );
}
function Empty({ text }: { text: string }) { return <div className="text-xs text-parchment/30 italic">{text}</div>; }

function GuidanceBlock({ g, mySeat, disabled, onPick, lang }: { g: any; mySeat: string | null; disabled: boolean; onPick: (opt: string) => void; lang: string }) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const norm = (Array.isArray(g.options) ? g.options : []).map((o: any) =>
    typeof o === 'string' ? { for: 'all', text: o } : { for: o.for || 'all', text: o.text || '' }
  );
  const myOptions = norm.filter((o: any) => o.text && (o.for === 'all' || o.for === mySeat));
  const seatKey = mySeat === 'A' ? 'a' : 'b';
  const mine = g[seatKey] || { location: g.location, goal: g.goal, investigables: g.investigables };
  const L = EN(lang)
    ? { loc: 'Location', goal: 'Goal', inv: 'You can investigate', choose: `You (${mySeat}) can`, free: 'Or type any free action below — do whatever you want.' }
    : { loc: '你的位置', goal: '你的目标', inv: '你身边可调查', choose: `你（${mySeat}）可以选择`, free: '或在下方输入框「自由行动」，做任何你想做的事。' };
  return (
    <div className="mx-auto max-w-2xl mt-1 rounded-lg border border-eldritch/40 bg-fog/60 p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {mine.location && <div><span className="text-eldritch text-xs">【{L.loc}】</span><span className="text-parchment/90"> {mine.location}</span></div>}
        {mine.goal && <div><span className="text-eldritch text-xs">【{L.goal}】</span><span className="text-parchment/90"> {mine.goal}</span></div>}
      </div>
      {Array.isArray(mine.investigables) && mine.investigables.length > 0 && (
        <div className="text-sm">
          <span className="text-eldritch text-xs">【{L.inv}】</span>
          <span className="text-parchment/70"> {mine.investigables.join(' · ')}</span>
        </div>
      )}
      {myOptions.length > 0 && (
        <div className="space-y-2">
          <div className="text-eldritch text-xs">【{L.choose}】</div>
          <div className="grid gap-2">
            {myOptions.map((opt: any, i: number) => (
              <button key={i} onClick={() => onPick(opt.text)} disabled={disabled}
                className="text-left px-3 py-2 rounded bg-ink/60 hover:bg-eldritch/25 border border-eldritch/30 text-parchment/90 text-sm disabled:opacity-40">
                <span className="text-eldritch mr-2">{letters[i] || '·'}.</span>{opt.text}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-parchment/40">{L.free}</div>
        </div>
      )}
    </div>
  );
}

function EndedBanner({ roomId, lang }: { roomId: string; lang: string }) {
  const t = tr(lang);
  const [recap, setRecap] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const L = EN(lang)
    ? { truth: 'Truth: ', mind: 'Mastermind: ', sup: 'Supernatural: ', npc: 'NPC secrets: ', clues: 'Key clues: ', lie: 'lie: ', revealing: 'Unsealing the truth…' }
    : { truth: '真相：', mind: '幕后黑手：', sup: '超自然：', npc: 'NPC 秘密：', clues: '关键线索：', lie: '谎言：', revealing: '正在揭开封存的真相……' };

  async function load() {
    setOpen(true);
    if (recap) return;
    try {
      const res = await fetch('/api/recap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecap(data);
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="bg-blood/15 border-b border-blood/40 px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-parchment font-serif">{t('ended_banner')}</span>
        <button onClick={load} className="px-4 py-1.5 rounded bg-blood/70 hover:bg-blood text-parchment text-sm">{t('view_recap')}</button>
      </div>
      {open && (
        <div className="max-w-4xl mx-auto mt-3 p-4 rounded-lg bg-ink border border-blood/40 text-sm text-parchment/85 space-y-3">
          {err && <p className="text-blood">{err}</p>}
          {recap && (
            <>
              {Array.isArray(recap.survivors) && recap.survivors.length > 0 && (
                <div className="flex flex-wrap gap-3 pb-2 border-b border-blood/20">
                  {recap.survivors.map((s: any, i: number) => (
                    <span key={i} className={`text-xs ${s.alive ? 'text-green-400' : 'text-blood'}`}>
                      {s.seat}·{s.name}：{s.status}（SAN {s.san}/{s.san_start}，HP {s.hp}/{s.hp_max}）
                    </span>
                  ))}
                </div>
              )}
              <div><span className="text-eldritch">{L.truth}</span>{recap.truth}</div>
              <div><span className="text-eldritch">{L.mind}</span>{recap.mastermind?.identity} —— {recap.mastermind?.motive}</div>
              {recap.supernatural?.nature && <div><span className="text-eldritch">{L.sup}</span>{recap.supernatural.nature}</div>}
              {Array.isArray(recap.npcs) && recap.npcs.length > 0 && (
                <div><span className="text-eldritch">{L.npc}</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {recap.npcs.map((n: any, i: number) => <li key={i}>{n.name}：{n.secret}{n.lie ? `（${L.lie}${n.lie}）` : ''}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(recap.key_clues) && (
                <div><span className="text-eldritch">{L.clues}</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {recap.key_clues.map((c: any, i: number) => <li key={i}>{c.clue} → {c.reveals}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
          {!recap && !err && <p className="text-parchment/50">{L.revealing}</p>}
        </div>
      )}
    </div>
  );
}
