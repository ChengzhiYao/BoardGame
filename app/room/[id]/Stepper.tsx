'use client';

const STEPS: { key: string; label: string }[] = [
  { key: 'lobby', label: '等待加入' },
  { key: 'module_selection', label: '选择模组' },
  { key: 'case_locking', label: '锁定真相' },
  { key: 'character_creation', label: '创建角色' },
  { key: 'attribute_allocation', label: '分配属性' },
  { key: 'skill_allocation', label: '分配技能' },
  { key: 'character_confirmation', label: '确认角色' },
  { key: 'rule_briefing', label: '规则说明' },
  { key: 'playing', label: '正式跑团' },
  { key: 'ended', label: '结局' },
];

export default function Stepper({ current }: { current: string }) {
  const idx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="w-full border-b border-eldritch/20 bg-fog/40">
      {/* 手机/中屏：只显示当前步骤 */}
      <div className="lg:hidden px-4 py-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-blood/30 border border-blood text-parchment">
          {idx + 1}/{STEPS.length}
        </span>
        <span className="text-parchment/90">{STEPS[idx]?.label || current}</span>
      </div>

      {/* 桌面端（宽屏）：完整步骤条 */}
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
                  {s.label}
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
