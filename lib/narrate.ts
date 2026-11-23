// 旁白排版：模型写轻量标记 → 前端用不同字体/字号/颜色/动效呈现；朗读前去掉标记。
// 标记：**动作/关键细节**  !!喊叫/突发!!  ((低语/心声))  [[拟声音效]]  对白用「」或“”。空行 = 一个节拍。

export const NARRATE_RULES_ZH = `
【旁白长度与排版·必须遵守】
- 每段旁白 2~4 个短节拍，节拍之间空一行；全段不超过 120 字（结局/开场最多 200 字；英文局不超过 70 词，对白用 “ ”）。一个节拍只写一件事：一个动作、一个声音、或一个细节。写完就停，把下一步留给玩家。
- 不堆形容词，不写环境长描写；一个感官细节就够。玩家要的信息（线索内容）照样写全，但用最短的话。
- 用这些标记让画面"演出来"（只在真正需要时用，每段最多 3 处）：
  **动作或关键细节**（如：**门把手在自己转动**）
  !!喊叫或突然的冲击!!（要短，≤8 字，如：!!别开门!!）
  ((低语、心声、听不清的声音))（如：((……你来晚了))）
  [[拟声]]（如：[[砰——]] [[吱呀]] [[滴答、滴答]]）
  人物说话一律用「」括起来。
- 标记要成对闭合，不要嵌套。`;

export const NARRATE_RULES_EN = `
[Narration length & markup — required]
- 2–4 short beats separated by a blank line; under 70 words total (opening/ending up to 120). One beat = one action, one sound, or one detail. Stop there and leave the next move to the players.
- No adjective piles or long scenery. Clue content stays complete, just terse.
- Stage it with markup (only where it matters, max 3 per passage):
  **action or key detail**   !!a shout or sudden impact!! (≤5 words)   ((a whisper or inner voice))   [[sound effect]] like [[BANG]]
  Put spoken lines in “double quotes”.
- Always close each mark; never nest them.`;

export const narrateRules = (lang?: string) => (lang === 'en' ? NARRATE_RULES_EN : NARRATE_RULES_ZH);

/** 去掉排版标记（朗读、摘要、通知用） */
export function stripMarks(t: string): string {
  return String(t || '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/!!(.+?)!!/gs, '$1')
    .replace(/\(\((.+?)\)\)/gs, '$1')
    .replace(/\[\[(.+?)\]\]/gs, '$1');
}

export type Seg = { k: 'text' | 'act' | 'shout' | 'whisper' | 'sfx' | 'say'; t: string };

const SFX_WORD = /^(砰|咚|嘭|轰|啪|哐|咔|嗒|吱呀|嘶|呼|叮|铛|哗|嗡|咯吱|滴答|噗|BANG|THUD|CRASH|CREAK|SLAM|KNOCK)/i;

/** 把一个节拍切成带样式的片段。旧消息没有标记时，自动识别对白、短促喊叫、拟声。 */
export function parseBeat(src: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*\*(.+?)\*\*|!!(.+?)!!|\(\((.+?)\)\)|\[\[(.+?)\]\]|「([^」]+)」|“([^”]+)”|"([^"\n]{2,})"/gs;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ k: 'text', t: src.slice(last, m.index) });
    if (m[1]) out.push({ k: 'act', t: m[1] });
    else if (m[2]) out.push({ k: 'shout', t: m[2] });
    else if (m[3]) out.push({ k: 'whisper', t: m[3] });
    else if (m[4]) out.push({ k: 'sfx', t: m[4] });
    else out.push({ k: 'say', t: m[5] || m[6] || m[7] });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ k: 'text', t: src.slice(last) });
  // 旧文本兜底：整个节拍只是一句很短的感叹 → 喊叫/拟声
  if (out.length === 1 && out[0].k === 'text') {
    const s = out[0].t.trim();
    if (s.length <= 10 && /[！!]$/.test(s)) out[0] = { k: SFX_WORD.test(s) ? 'sfx' : 'shout', t: s };
    else if (s.length <= 8 && /^[…\.]{1,}|——$/.test(s)) out[0] = { k: 'whisper', t: s };
  }
  return out;
}

/** 按空行切节拍；旧消息没有空行时，按句子把长段落切开（每拍约 1~2 句）。 */
export function splitBeats(text: string, lang?: string): string[] {
  const t = String(text || '').replace(/\r/g, '').trim();
  if (!t) return [];
  let beats = t.split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
  const long = lang === 'en' ? 220 : 90;
  const res: string[] = [];
  for (const b of beats) {
    if (b.length <= long || /\*\*|!!|\(\(|\[\[/.test(b) && b.length <= long * 1.5) { res.push(b); continue; }
    const sents = b.match(lang === 'en' ? /[^.!?]+[.!?]+["”]?\s*|[^.!?]+$/g : /[^。！？!?…]+(?:[。！？!?]+|…+)[」”]?|[^。！？!?…]+$/g) || [b];
    let cur = '';
    for (const s of sents) {
      if ((cur + s).length > long && cur) { res.push(cur.trim()); cur = ''; }
      cur += s;
    }
    if (cur.trim()) res.push(cur.trim());
  }
  beats = res;
  return beats;
}
