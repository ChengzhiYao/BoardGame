'use client';
import { type ReactNode, type ReactElement } from 'react';
import { type Lang } from '@/lib/i18n';

export type GM = 'story' | 'coc' | 'jbs' | 'dnd' | 'soup' | 'td' | 'mcc' | 'botc';
type Bi = { zh: string; en: string };
const pick = (lang: Lang, b: Bi) => (lang === 'en' ? b.en : b.zh);

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-eldritch/30 bg-ink overflow-hidden shadow-[0_30px_70px_-35px_rgba(0,0,0,.9)]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-eldritch/20">
        <span className="w-2 h-2 rounded-full bg-blood/70" />
        <span className="w-2 h-2 rounded-full bg-eldritch/60" />
        <span className="w-2 h-2 rounded-full bg-parchment/25" />
        <span className="ml-2 text-[10px] font-mono text-parchment/40 tracking-wider truncate">{label}</span>
      </div>
      <div className="p-4 h-[252px] sm:h-[284px] overflow-hidden">{children}</div>
    </div>
  );
}

// ---- per-game preview mocks (evoke the real screens, on the app's tokens) ----
function StoryMock() {
  return (
    <Frame label="mystnight · storyteller">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-fog border border-eldritch/30">
          <span className="w-8 h-8 rounded-full bg-ink border border-eldritch/40 grid place-items-center text-parchment text-[10px]">❚❚</span>
          <div className="flex-1 h-1.5 rounded bg-ink overflow-hidden"><div className="h-full w-2/5 bg-blood rounded" /></div>
          <span className="text-[10px] text-parchment/40">Azure</span>
        </div>
        <div className="flex gap-1.5 justify-center my-2.5 flex-wrap">
          {['Gentle ♀', 'Deep ♂', 'Healing', 'Eerie'].map((v, i) => (
            <span key={v} className={`text-[10px] px-2 py-0.5 rounded-full border ${i === 0 ? 'bg-blood/30 border-blood text-parchment' : 'border-eldritch/30 text-parchment/50'}`}>{v}</span>
          ))}
        </div>
        <p className="font-serif text-parchment/45 text-xs leading-relaxed">The clock in the hall had no hands, only a voice…</p>
        <p className="font-serif text-parchment text-xs leading-relaxed mt-2">…and every night it told her how many days she had left.</p>
      </div>
    </Frame>
  );
}
function CocMock() {
  return (
    <Frame label="mystnight · investigation">
      <div className="grid grid-cols-3 gap-2 h-full text-[10px]">
        <div className="space-y-1.5">
          <div className="text-parchment/40">Investigator</div>
          <div className="rounded bg-fog border border-eldritch/30 p-1.5">
            <div className="text-parchment text-[11px] font-serif">E. Vance</div>
            <div className="mt-1 flex items-center gap-1"><span className="text-parchment/40">HP</span><div className="flex-1 h-1 rounded bg-ink overflow-hidden"><div className="h-full w-4/5 bg-blood" /></div></div>
            <div className="mt-0.5 flex items-center gap-1"><span className="text-parchment/40">SAN</span><div className="flex-1 h-1 rounded bg-ink overflow-hidden"><div className="h-full w-1/2 bg-eldritch" /></div></div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="rounded bg-blood/15 border border-blood/30 p-1.5 text-parchment/80 font-serif leading-snug">Beneath the altar, something has waited a long time.</div>
          <div className="rounded bg-eldritch/15 border border-eldritch/30 p-1 text-eldritch">🎲 Spot 45 → 32 ✓</div>
          <div className="rounded bg-blood/10 border border-blood/25 p-1 text-parchment/70 italic">Only you · a child's locket</div>
        </div>
        <div className="space-y-1">
          <div className="text-parchment/40">Clues</div>
          <div className="text-eldritch">▸ Brass key</div>
          <div className="text-eldritch">▸ Torn letter</div>
          <div className="mt-1 rounded bg-ink border border-eldritch/30 h-14 grid place-items-center text-parchment/20">scene</div>
        </div>
      </div>
    </Frame>
  );
}
function JbsMock() {
  const acts = ['Open', 'Search', 'Relate', 'Evid', 'Talk', 'Accuse', 'Reveal'];
  return (
    <Frame label="mystnight · murder mystery">
      <div className="h-full flex flex-col text-[10px]">
        <div className="flex gap-1 mb-2">{acts.map((a, i) => (
          <span key={a} className={`flex-1 text-center py-0.5 rounded ${i < 4 ? 'bg-eldritch/25 text-parchment/70' : i === 4 ? 'bg-blood/40 text-parchment border border-blood' : 'bg-fog text-parchment/30'}`}>{a}</span>
        ))}</div>
        <div className="rounded bg-blood/15 border border-blood/30 p-2 font-serif text-parchment/85 leading-snug">“I saw Ellis by the greenhouse at ten. Ask him what he was <i>really</i> doing.” <span className="text-blood not-italic">— Margot (AI)</span></div>
        <div className="mt-2 rounded bg-amber-500/10 border border-amber-500/30 p-1.5 text-amber-300">🔍 Evidence unlocked · the rewritten will</div>
        <div className="mt-auto flex gap-1.5"><span className="flex-1 text-center py-1 rounded border border-eldritch/40 text-parchment/60">Accuse Margot</span><span className="px-2 py-1 rounded bg-blood/80 text-parchment">⚖ Lock</span></div>
      </div>
    </Frame>
  );
}
function DndMock() {
  const acts: [string, string][] = [['🗡', 'Sword'], ['✦', 'Bolt'], ['🛡', 'Dodge'], ['🧪', 'Potion']];
  return (
    <Frame label="mystnight · d&d">
      <div className="h-full flex flex-col text-[10px]">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded bg-fog border border-blood/40 p-1.5"><div className="text-parchment font-serif">Kael <span className="text-sky-400 border border-sky-400/40 rounded px-1 text-[9px]">AC16</span></div><div className="mt-1 h-1 rounded bg-ink overflow-hidden"><div className="h-full w-3/4 bg-blood" /></div></div>
          <div className="rounded bg-fog border border-eldritch/30 p-1.5"><div className="text-parchment font-serif">Lyra <span className="text-sky-400 border border-sky-400/40 rounded px-1 text-[9px]">AC12</span></div><div className="mt-1 h-1 rounded bg-ink overflow-hidden"><div className="h-full w-1/2 bg-blood" /></div></div>
        </div>
        <div className="rounded bg-blood/15 border border-blood/40 p-2 text-center"><div className="text-parchment text-[11px]">☠ Bugbear Reaver</div><div className="mx-auto mt-1 h-1.5 w-32 rounded bg-ink overflow-hidden"><div className="h-full w-2/5 bg-blood" /></div><div className="text-parchment/50 mt-0.5">HP 19/41 · AC14</div></div>
        <div className="mt-auto flex gap-1.5 justify-center">{acts.map(([ic, n], k) => (
          <span key={n} className={`px-2 py-1 rounded border text-center leading-tight ${k === 0 ? 'border-blood bg-blood/20 text-parchment' : 'border-eldritch/30 text-parchment/60'}`}>{ic}<br />{n}</span>
        ))}</div>
      </div>
    </Frame>
  );
}
function SoupMock() {
  return (
    <Frame label="mystnight · lateral soup">
      <div className="h-full flex flex-col text-[10px]">
        <div className="rounded bg-eldritch/15 border border-eldritch/40 p-2 font-serif text-parchment/80 leading-snug">📌 A man tastes albatross soup at an inn, then ends his life that night. Why?</div>
        <div className="mt-2 space-y-1.5">
          <div className="ml-auto w-fit max-w-[82%] rounded-lg bg-fog border border-eldritch/30 px-2 py-1 text-parchment">Had he eaten albatross before?</div>
          <div className="w-fit rounded-lg bg-blood/15 border border-blood/30 px-2 py-1 text-red-400">No</div>
          <div className="ml-auto w-fit max-w-[82%] rounded-lg bg-fog border border-eldritch/30 px-2 py-1 text-parchment">Did the taste tell him something?</div>
          <div className="w-fit rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-emerald-300">Yes — and that matters</div>
        </div>
      </div>
    </Frame>
  );
}
function TdMock() {
  return (
    <Frame label="mystnight · truth or dare">
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-xl border border-blood/50 bg-blood/10 p-4 max-w-xs">
          <div className="text-[10px] tracking-[.2em] text-blood">DARE · FOR RIN</div>
          <p className="font-serif text-parchment text-xs mt-1.5 leading-relaxed">Call the third contact in your phone and announce, completely straight-faced, that you're becoming a professional clown.</p>
          <div className="text-[9px] text-parchment/40 mt-2">drawn live · scaled to “spicy” · respects your off-limits list</div>
        </div>
        <div className="flex gap-2"><span className="px-4 py-1.5 rounded bg-eldritch/50 text-parchment text-[11px]">Draw Truth</span><span className="px-4 py-1.5 rounded bg-blood/70 text-parchment text-[11px]">Draw Dare</span></div>
      </div>
    </Frame>
  );
}
function MccMock() {
  const cards: [string, string][] = [['🐈', 'CURSE'], ['🔔', 'WARD'], ['🙀', 'HISS'], ['🪞', 'MIRROR'], ['🐾', 'SWAP']];
  return (
    <Frame label="mystnight · midnight cat curse">
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="text-[10px] text-parchment/50">Deck 21 · <span className="text-amber-300">your turn</span></div>
        <div className="flex justify-center">{cards.map(([e, n], i) => (
          <div key={n} style={{ transform: `rotate(${(i - 2) * 7}deg) translateY(${Math.abs(i - 2) * 6}px)` }} className="w-12 -mx-1 rounded-lg bg-[#070708] border border-parchment/20 p-1 text-center shadow-lg">
            <div className="aspect-square rounded bg-ink grid place-items-center text-lg">{e}</div>
            <div className="text-[7px] tracking-[.15em] text-parchment/70 mt-1">{n}</div>
          </div>
        ))}</div>
        <div className="text-[10px] text-parchment/40">drag up to play · tap to target</div>
      </div>
    </Frame>
  );
}
function BotcMock() {
  const seats: [string, string, string][] = [['A · Maya', 'Empath?', ''], ['B · Theo', 'executed', 'dead'], ['C · You', 'Washerwoman', 'you'], ['D · Rin', 'nominated', 'nom'], ['E · Ada', '—', ''], ['F · Bot', 'AI seat', 'ai']];
  return (
    <Frame label="mystnight · bloodbound">
      <div className="h-full flex flex-col text-[10px]">
        <div className="grid grid-cols-3 gap-1.5">{seats.map(([n, r, s]) => (
          <div key={n} className={`rounded p-1.5 border text-center ${s === 'you' ? 'border-blood bg-blood/15' : s === 'nom' ? 'border-amber-500/50 bg-amber-500/10' : s === 'dead' ? 'border-eldritch/20 opacity-40 line-through' : s === 'ai' ? 'border-dashed border-eldritch/40' : 'border-eldritch/30'}`}>
            <div className="text-parchment">{n}</div><div className="text-parchment/40 text-[9px]">{r}</div>
          </div>
        ))}</div>
        <div className="mt-auto rounded-full bg-amber-500/10 border border-amber-500/40 px-3 py-1.5 text-center text-amber-200">Rin is on the block — <b>3 votes</b>, 2 needed</div>
      </div>
    </Frame>
  );
}

type Game = { key: GM; Mock: () => ReactElement; name: Bi; meta: Bi; blurb: Bi; rules: Bi[] };
const GAMES: Game[] = [
  {
    key: 'story', Mock: StoryMock,
    name: { zh: '讲故事', en: 'Storyteller' },
    meta: { zh: '1–6 人 · 约 10 分钟 · 朗读', en: '1–6 players · ~10 min · narrated' },
    blurb: { zh: 'AI 构思、反复打磨、并用真人嗓音朗读一个只属于今晚的原创故事——还配着会呼吸的背景音乐。', en: 'An AI plans, refines and reads aloud an original story made just for tonight — with music that breathes under every line.' },
    rules: [
      { zh: '选题材与心情（恐怖 / 温柔 / 治愈…）', en: 'Pick a genre and a mood' },
      { zh: 'AI 反复起草并自评，直到故事真的好看', en: 'AI drafts and self-scores until it truly lands' },
      { zh: '挑嗓音与语速，卡拉OK式逐句高亮朗读', en: 'Choose a voice; listen with karaoke highlighting' },
      { zh: '配乐随段落切换，双人实时同步聆听', en: 'Music shifts per paragraph, synced for two' },
    ],
  },
  {
    key: 'coc', Mock: CocMock,
    name: { zh: '调查跑团（CoC）', en: 'Cthulhu Investigation' },
    meta: { zh: '1–6 人 · 30–60 分钟 · 探案', en: '1–6 players · 30–60 min · investigate' },
    blurb: { zh: 'AI 当守密人，跑一场有理智值、骰子检定和层层线索的克苏鲁式恐怖探案，场景配图自动生成。', en: 'An AI Keeper runs a cosmic-horror case with sanity, real dice checks and layered clues — scene art generated on the fly.' },
    rules: [
      { zh: '建你的调查员：属性、职业、技能', en: 'Build your investigator — stats and skills' },
      { zh: '调查现场，行动触发真实技能检定', en: 'Investigate; actions trigger real skill rolls' },
      { zh: '理智会流失，多条线索要自己拼合', en: 'Sanity drains; combine clues to deduce' },
      { zh: '世界按你的行为反应，绝不喂答案', en: 'The world reacts — it never spoon-feeds you' },
    ],
  },
  {
    key: 'jbs', Mock: JbsMock,
    name: { zh: '剧本杀', en: 'Murder Mystery' },
    meta: { zh: '1–8 人 · 40–90 分钟 · 推理', en: '1–8 players · 40–90 min · deduction' },
    blurb: { zh: '选个剧本，AI 现场生成一桩真相被锁定的案子——凶手、动机、时间线、证据全都自洽，你来指认。', en: 'Pick a script; the AI generates a case whose truth is locked — culprit, motive, timeline, evidence — and you accuse the killer.' },
    rules: [
      { zh: '选题材、人数与每幕节奏', en: 'Choose theme, headcount and pacing' },
      { zh: '每人拿到一个带秘密的角色', en: 'Everyone gets a role with a secret' },
      { zh: '七幕搜证、讨论、对峙', en: 'Seven acts of evidence and confrontation' },
      { zh: 'AI 嫌疑人会撒谎、甩锅、栽赃你', en: 'AI suspects lie, scheme and try to frame you' },
    ],
  },
  {
    key: 'dnd', Mock: DndMock,
    name: { zh: '龙与地下城（D&D）', en: 'Dungeons & Dragons' },
    meta: { zh: '1–6 人 · 30–90 分钟 · 冒险', en: '1–6 players · 30–90 min · adventure' },
    blurb: { zh: 'AI 当地下城主带你闯一场冒险：真实的 d20 战斗、护甲、生命、法术位与升级，全由引擎精算。', en: 'An AI Dungeon Master runs the adventure; a real d20 engine owns AC, HP, spell slots and levelling.' },
    rules: [
      { zh: '选职业、定下你的英雄', en: 'Pick a class and shape your hero' },
      { zh: '探索、对话、做出选择', en: 'Explore, talk, make choices' },
      { zh: '回合制战斗，骰子与伤害由代码计算', en: 'Turn-based combat; dice and damage are real code' },
      { zh: '打怪、升级、捡装备', en: 'Fight, level up, loot' },
    ],
  },
  {
    key: 'soup', Mock: SoupMock,
    name: { zh: '海龟汤', en: 'Lateral Soup' },
    meta: { zh: '2–8 人 · 15–30 分钟 · 谜题', en: '2–8 players · 15–30 min · riddle' },
    blurb: { zh: 'AI 守着一个诡异的谜底，你们只能问是非题，一点点逼近真相——它几十轮都不会说漏嘴。', en: 'The AI guards a strange hidden answer; you ask only yes/no questions and close in — it never leaks, for dozens of turns.' },
    rules: [
      { zh: 'AI 给出一个诡异的「汤面」', en: 'The AI presents a strange scenario' },
      { zh: '你们只能提是非题', en: 'You may only ask yes/no questions' },
      { zh: 'AI 答：是 / 不是 / 无关 / 是也不是', en: 'It answers yes / no / irrelevant / partly' },
      { zh: '想到真相就揭晓', en: 'Reveal once you think you have it' },
    ],
  },
  {
    key: 'td', Mock: TdMock,
    name: { zh: '真心话大冒险', en: 'Truth or Dare' },
    meta: { zh: '2–10 人 · 随意 · 派对', en: '2–10 players · any length · party' },
    blurb: { zh: 'AI 按你们设定的尺度和场合现场出题，贴合在场的人，还会避开你列的禁区——绝不重样。', en: 'The AI invents prompts live, scaled to your intensity and setting, aware of who is playing — and never repeats.' },
    rules: [
      { zh: '设定尺度与所处环境', en: 'Set the intensity and the setting' },
      { zh: '列出不想出现的内容（禁区）', en: 'List anything off-limits' },
      { zh: '轮流抽真心话或大冒险', en: 'Take turns drawing truth or dare' },
      { zh: 'AI 现场生成，贴合场合与人', en: 'Fresh, context-aware prompts every time' },
    ],
  },
  {
    key: 'mcc', Mock: MccMock,
    name: { zh: '午夜猫诅咒', en: 'Midnight Cat Curse' },
    meta: { zh: '2–6 人 · 10–20 分钟 · 卡牌', en: '2–6 players · 10–20 min · cards' },
    blurb: { zh: '一款完全原创的卡牌游戏：抽到诅咒猫就出局，除非你有护符。最后活着的那只猫赢——AI 随时补满空位。', en: 'A from-scratch card game — draw the curse cat and you are out, unless you are warded. Last cat standing wins; AI fills empty seats.' },
    rules: [
      { zh: '轮流从牌堆抽牌', en: 'Take turns drawing from the deck' },
      { zh: '抽到诅咒猫即出局，除非用护符挡下', en: 'Curse cat = out, unless you ward it' },
      { zh: '用嘶吼 / 镜爪等反应牌互相算计', en: 'Use Hiss, Mirror and reaction cards' },
      { zh: 'AI 补位，单人双人也能随时开局', en: 'AI fills seats — play solo or as a pair anytime' },
    ],
  },
  {
    key: 'botc', Mock: BotcMock,
    name: { zh: '血染钟楼（社交推理）', en: 'Bloodbound' },
    meta: { zh: '1–8 人 · 30–60 分钟 · 社交推理', en: '1–8 players · 30–60 min · social deduction' },
    blurb: { zh: '类狼人杀的隐藏身份推理：好人对邪恶。AI 当说书人主持夜晚、白天、投票，并补满空位——任何人都可能是恶魔，包括你。', en: 'Werewolf-style hidden-role deduction. An AI Storyteller runs nights, days and votes and fills empty seats — anyone could be evil, including you.' },
    rules: [
      { zh: 'AI 发放隐藏身份', en: 'The AI deals secret roles' },
      { zh: '夜晚行动，白天发言讨论', en: 'Act at night, talk through the day' },
      { zh: '提名、投票、处决', en: 'Nominate, vote and execute' },
      { zh: '好人找出恶魔即获胜', en: 'Good wins by finding the demon' },
    ],
  },
];

export default function GameShowcase({ lang, busy, onPlay }: { lang: Lang; busy: boolean; onPlay: (m: GM) => void }) {
  return (
    <div id="games" className="w-full max-w-5xl mx-auto flex flex-col gap-16 sm:gap-24 px-1 mt-12 mb-10">
      {GAMES.map((g, i) => (
        <section key={g.key} className="grid md:grid-cols-2 gap-7 md:gap-10 items-center">
          <div className={i % 2 ? 'md:order-2' : ''}><g.Mock /></div>
          <div className={`text-left ${i % 2 ? 'md:order-1' : ''}`}>
            <div className="font-mono text-[11px] tracking-[.22em] uppercase text-eldritch/80 mb-2">{String(i + 1).padStart(2, '0')} · {pick(lang, g.meta)}</div>
            <h3 className="text-2xl sm:text-[28px] font-serif text-parchment leading-tight mb-2.5">{pick(lang, g.name)}</h3>
            <p className="text-parchment/65 text-sm leading-relaxed mb-4">{pick(lang, g.blurb)}</p>
            <div className="font-mono text-[10px] tracking-[.18em] uppercase text-parchment/40 mb-2">{lang === 'en' ? 'How it plays' : '怎么玩'}</div>
            <ul className="space-y-1.5 mb-6">
              {g.rules.map((r, k) => (
                <li key={k} className="flex gap-2.5 text-sm text-parchment/75 leading-snug">
                  <span className="font-mono text-eldritch shrink-0 mt-px">{String(k + 1).padStart(2, '0')}</span>
                  <span>{pick(lang, r)}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => onPlay(g.key)} disabled={busy}
              className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50 transition">
              {busy ? (lang === 'en' ? 'Opening…' : '正在开启…') : `▶ ${lang === 'en' ? 'Play ' + g.name.en : '开始' + g.name.zh.replace(/（.*?）/, '')}`}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
