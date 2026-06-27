// 童话草原 · 出生揭晓：有趣、戳中人的人格解读 + 灵魂动物揭晓。
import { SP_BY_KEY, ATTR_ZH, INST_ZH, DIET_ZH, type Attr, type Inst } from './data';
import { AXIS_POLES, type Axis, type MeadowResult } from './persona';

export function buildAnimalRevealPrompt(r: MeadowResult, notable: string[]): string {
  const sp = SP_BY_KEY[r.speciesKey];
  const lean = (Object.keys(r.personality) as Axis[])
    .map((k) => ({ k, v: r.personality[k] }))
    .filter((x) => Math.abs(x.v) >= 2)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 5)
    .map((x) => AXIS_POLES[x.k][x.v > 0 ? 0 : 1])
    .join('、') || '平和均衡';
  const topI = (Object.keys(r.instincts) as Inst[]).sort((x, y) => r.instincts[y] - r.instincts[x]).slice(0, 2).map((k) => INST_ZH[k]).join('、');
  const topA = (Object.keys(r.attributes) as Attr[]).sort((x, y) => r.attributes[y] - r.attributes[x]).slice(0, 3).map((k) => `${ATTR_ZH[k]}${r.attributes[k]}`).join('、');
  const g = r.gender === 'male' ? '公' : '母';
  const choices = notable.length ? notable.map((s) => `「${s}」`).join('，') : '（未提供）';

  return `你是一位洞察人心、又带着童话温度的"灵魂解读者"。一个人刚做完一套动物人格测试，请给他一份**既准、又好玩、让人想截图分享**的人格解读，最后揭晓他的"灵魂动物"。

【这个人的测试画像（据此分析，别照搬术语）】
- 性格倾向：${lean}
- 最强本能：${topI}；突出资质：${topA}
- 命运掷定的灵魂动物：${r.variant}（${g} · ${sp.zh} · ${DIET_ZH[sp.diet]}）；天生特性：${r.traits.join('、') || '无'}
- 他的一些关键选择：${choices}

【要求】
- 用第二人称"你"，像在跟本人说话；**精准、具体、戳中人**，可以一针见血，但温暖、不刻薄。
- 不要堆形容词，要有"被看穿"的感觉，可引用他的选择当证据。
- title 给一个**有记忆点、让人想转发**的人格标签（4~8 字，如"孤胆谋略家""温柔的破局者""草原上的纵火者"）。
- why 把性格与"为什么是这种动物"扣在一起，让人会心一笑。

只输出 JSON：
{
  "title": "人格标签（4~8字）",
  "personality": "你是个怎样的人（2~3句性格画像）",
  "thinking": "你的思维与决策模式（2~3句：靠直觉还是推演？冒险还是稳妥？怎么权衡取舍）",
  "strength": "你最锋利的天赋（1~2句）",
  "shadow": "你的盲点/阴影面（1~2句，诚实但留情面）",
  "drive": "你内心真正的驱动力（1句）",
  "why": "所以命运把你写成一只${r.variant}——为什么（1~2句，扣住性格）"
}`;
}

// D&D 式回合：玩家用自然语言描述行动，旁白当 DM 据能力公正裁定并叙事。
export function buildMeadowTurnPrompt(char: any, ctx: { locationZh: string; danger: string; clock: string; recent: string }, action: string): string {
  const sp = SP_BY_KEY[char.species];
  const a = char.attributes || {}; const inst = char.instincts || {};
  const g = char.gender === 'male' ? '公' : '母';
  const stats = `体力${a.vit ?? '?'} 力量${a.str ?? '?'} 敏捷${a.agi ?? '?'} 感官${a.sen ?? '?'} 机敏${a.wit ?? '?'} 魅力${a.cha ?? '?'}`;
  const insts = (Object.keys(inst) as Inst[]).map((k) => `${INST_ZH[k]}${inst[k]}`).join(' ');
  return `你是《童话草原》这本童话书的旁白与裁判（像桌游 D&D 的 DM）。玩家扮演的动物：一只 ${char.variant}（${g} · ${sp?.zh} · ${DIET_ZH[char.diet as keyof typeof DIET_ZH] || char.diet}）。
天生特性：${(char.traits || []).join('、') || '无'}；能力：${stats}；本能：${insts || '一般'}。
此刻在【${ctx.locationZh}】（此处${ctx.danger}），${ctx.clock}，饥饿 ${char.hunger}/100（越高越饿，到 100 会饿死）。
最近发生：${ctx.recent || '（无）'}

玩家说它要做：「${action}」

请据这只动物的**体型、能力、食性、所在地、季节昼夜**，**公正地**裁定结果，用温暖又有张力的绘本口吻写 2~4 句第二人称叙事。规矩：
- 弱小做不到强大的事（兔子斗不过狼，不会飞的上不了树梢，没有翅膀飞不起来）；猎手捕猎成功率高，猎物大多只能逃。
- 在开阔/危险处行动可能撞上天敌；能否逃生看它的敏捷/逃逸与特性。觅食/进食降低饥饿；奔波/受伤/挨饿升高饥饿。
- 它可能受伤甚至**死亡**（被天敌咬杀、坠落、严寒、力竭等）；该死就死，但别无理由滥杀，也没有免死金牌。
- 不说教、不跳出童话、不替玩家做决定。

只输出 JSON：
{
  "narration": "2~4 句第二人称叙事",
  "hunger_delta": 行动后饥饿变化的整数（进食为负如 -30，奔波/受伤/挨饿为正如 +6，没明显变化填 0）,
  "moved_to": "若它移动到了别处，填地点 key（meadow=开阔草场 / warren=兔窟地洞 / oak=橡树林缘 / pond=芦苇池塘），否则填空串",
  "death": false,
  "death_cause": "若死亡填死因（如 被狼咬死 / 坠崖 / 冻死），否则空串"
}`;
}
