// 童话草原 · 出生揭晓解读 prompt。
import { SP_BY_KEY, ATTR_ZH, INST_ZH, DIET_ZH, type Attr, type Inst } from './data';
import type { MeadowResult } from './persona';

export function buildAnimalRevealPrompt(r: MeadowResult, notable: string[]): string {
  const sp = SP_BY_KEY[r.speciesKey];
  const topA = (Object.keys(r.attributes) as Attr[])
    .sort((x, y) => r.attributes[y] - r.attributes[x]).slice(0, 3)
    .map((k) => `${ATTR_ZH[k]}${r.attributes[k]}`).join('、');
  const topI = (Object.keys(r.instincts) as Inst[]).sort((x, y) => r.instincts[y] - r.instincts[x])[0];
  const choices = notable.length ? notable.map((s) => `「${s}」`).join('，') : '（无）';
  return `你是《童话草原》这本童话书的旁白，温暖而有点狡黠。一只新生的灵魂刚做完性格测试，命运已把它定为一只【${sp.zh}】（${DIET_ZH[sp.diet]}）。
它最突出的天资：${topA}；最擅长的本能：${INST_ZH[topI]}；带着特性：${r.traits.join('、') || '无'}。
它在测试里的关键选择：${choices}。

请用温暖的绘本口吻写一段 120~200 字的第二人称解读：先描摹它是怎样的性子（引用上面的选择佐证），再揭晓它生为一只${sp.zh}、擅长什么、带着怎样的天赋，最后一句温柔地欢迎它睁开眼睛、来到草原。不要说教，也不要剧透危险。
只输出 JSON：{ "verdict": "整段解读文字" }`;
}
