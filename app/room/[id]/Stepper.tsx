'use client';

const STEPS: { key: string; zh: string; en: string }[] = [
  { key: 'lobby', zh: '等待加入', en: 'Lobby' },
  { key: 'module_selection', zh: '选择模组', en: 'Choose Module' },
  { key: 'case_locking', zh: '锁定真相', en: 'Locking Truth' },
  { key: 'character_creation', zh: '创建角色', en: 'Create Character' },
  { key: 'attribute_allocation', zh: '分配属性', en: 'Stats' },
  { key: 'skill_allocation', zh: '分配技能', en: 'Skills' },
  { key: 'character_confirmation', zh: '确认角色', en: 'Confirm' },
  { key: 'rule_briefing', zh: '规则说明', en: 'Rules' },
  { key: 'playing', zh: '正式跑团', en: 'Investigating' },
  { key: 'ended', zh: '结局', en: 'Ending' },
];

export default function Stepper({ current, lang = 'zh' }: { current: string; lang?: string }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  const lbl = (s: { zh: string; en: string }) => (lang === 'en' ? s.en : s.zh);

  return (
    <div className="w-full border-b border-eldritch/20 bg-fog/40">
      <div className="lg:hidden px-4 py-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-blood/30 border border-blood text-parchment">
          {idx + 1}/{STEPS.length}
        </span>
        <span className="text-parchment/90">{STEPS[idx] ? lbl(STEPS[idx]) : current}</span>
      </div>
      <div className="hidden lg:block overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-3 min-w-max">
          {STEPS.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s.key} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${
                    active
                      ? 'bg-blood/30 border-blood text-parchment'
                      : done
                      ? 'bg-eldritch/20 border-eldritch/40 text-parchment/70'
                      : 'bg-transparent border-parchment/15 text-parchment/35'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      active ? 'bg-blood text-parchment' : done ? 'bg-eldritch/60 text-parchment' : 'bg-parchment/10'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {lbl(s)}
                </div>
                {i < STEPS.length - 1 && <span className="text-parchment/20">—</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
