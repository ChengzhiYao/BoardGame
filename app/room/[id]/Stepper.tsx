'use client';
// 克苏鲁开局只有三步：选故事 → 选身份 → 开场。
const GROUPS: { keys: string[]; zh: string; en: string }[] = [
  { keys: ['lobby', 'module_selection', 'case_locking'], zh: '选故事', en: 'Story' },
  { keys: ['character_creation', 'attribute_allocation', 'skill_allocation', 'character_confirmation', 'rule_briefing'], zh: '选身份', en: 'You' },
  { keys: ['playing', 'ended'], zh: '开场', en: 'Begin' },
];

export default function Stepper({ current, lang = 'zh' }: { current: string; lang?: string }) {
  const idx = Math.max(0, GROUPS.findIndex((g) => g.keys.includes(current)));
  const en = lang === 'en';
  return (
    <div className="mn-stepbar w-full" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-center gap-2.5 h-9">
        {GROUPS.map((g, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className={`flex items-center gap-1.5 text-[12px] tracking-[.12em] ${i === idx ? 'text-[#efe6d2]' : i < idx ? 'text-[#c9a96e]/70' : 'text-parchment/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-[#c9a96e] shadow-[0_0_8px_#c9a96e]' : i < idx ? 'bg-[#c9a96e]/60' : 'bg-parchment/20'}`} />
              {en ? g.en : g.zh}
            </span>
            {i < GROUPS.length - 1 && <span className={`w-5 h-px ${i < idx ? 'bg-[#c9a96e]/40' : 'bg-parchment/15'}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}
