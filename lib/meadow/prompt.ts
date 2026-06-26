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
