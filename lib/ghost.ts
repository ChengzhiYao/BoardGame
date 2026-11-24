// 今夜怪谈：每天一个免费的恐怖故事。像一个普通人深夜发语音给你讲他遇到的怪事，讲述人和故事里每个角色用不同的 Fish 声音（男角色男声、女角色女声）。
// 故事和配音都提前做好存起来（Linger 每 10 分钟叫一次补货），每天发一篇；往期是会员 / 畅玩卡专属。
import { callLLMJson } from '@/lib/llm';
import { LINGER_URL } from '@/lib/linger/companion';
import { dayKey, type Lang } from '@/lib/soup/daily';
import { buildStoryCuesPrompt, STORY_MOODS, STORY_SFX } from '@/lib/story/prompt';
import { stripMarks } from '@/lib/narrate';

// Fish 声音（都是 Linger 挑过的真人感声音，不用动漫 / 明星声音）
const V = {
  zh: {
    tellerM: ['591cbde691fd40ebac212f16d05bf334', '22dd5bf942eb4aab962cc45c2211cb38', '6b7a5c52b74f4857af47e650e50f9861'],
    tellerF: ['3d6ab498555245338c55a6a268a44659', '60d377ebaae44829ad4425033b94fdea', '9a57d4b15e80433da1191abd881ed6ea', 'd07fa5f0fa974967bfc2c1256c8c2034'],
    m: ['7a02aebcd8f94d8283a02842ce4ddd33', 'd346bcafdd4e4da986090b556f551542', '22dd5bf942eb4aab962cc45c2211cb38', '6b7a5c52b74f4857af47e650e50f9861', '591cbde691fd40ebac212f16d05bf334'],
    f: ['26c259f0f07247c98899ae4cfa1774be', '23e171c3bbaa4642badf9c98ca31835c', '2c0b44c053ed40788650a9d9d90d1f20', '5a5f9f8cd244462493916d5652e7c913', '74c6aba5cbf94a15bbdc547ffce5cb38', '97b816cc8f924ea5b5e1b3327927f346', '7b577042ea3d46e0a152e0172cef78c8'],
  },
  en: {
    tellerM: ['c5f56a6cc2ec4fa8920cb4c5889a3fb7', '3778d9610ede45cda7976d2dc51ed369'],
    tellerF: ['b347db033a6549378b48d00acb0d06cd', '933563129e564b19a115bedd57b7406a'],
    m: ['3778d9610ede45cda7976d2dc51ed369', 'c5f56a6cc2ec4fa8920cb4c5889a3fb7'],
    f: ['f48d143a59a946ab87c0130fd081f349', 'e9b134e4c0b547a3894793be502314f1', '98655a12fa944e26b274c535e5e03842', '933563129e564b19a115bedd57b7406a'],
  },
};

const TOPICS_ZH = ['夜班便利店', '老小区的电梯', '出租屋隔壁的邻居', '一张奇怪的外卖单', '高速服务区的厕所', '医院住院部的夜班', '大学宿舍楼', '老家奶奶的房子', '刚搬进去的新房', '网约车的夜单', '酒店走廊尽头的房间', '地铁末班车', '一段婚礼录像', '二手市场买的旧手机', '小区监控里的人', '山里的民宿', '做入殓师的朋友', '寺庙借宿的一晚', '合租的室友', '婴儿监视器', '加班到半夜的写字楼', '驾校夜训', '老式照相馆', '游泳馆闭馆后', '县城的录像厅', '小时候的捉迷藏', '一个总打错的电话', '村口的老井', '新买的二手衣柜', '同学聚会少了一个人'];
const TOPICS_EN = ['a night shift at a gas station', 'an old apartment elevator', 'the neighbor through the wall', 'a strange food delivery order', 'a rest stop bathroom at 3am', 'a hospital night shift', 'a college dorm', 'grandma’s old house', 'the house we just moved into', 'a late-night rideshare pickup', 'the room at the end of a hotel hallway', 'the last train', 'a wedding video', 'a second-hand phone', 'a figure on the building security camera', 'a cabin rental in the woods', 'a friend who works at a funeral home', 'a babysitting job', 'a baby monitor', 'an office building after midnight'];

export const STYLES = ['city', 'home', 'hospital', 'school', 'village', 'water', 'road', 'old'] as const;

const MARK_ZH = `排版标记（屏幕上会把这些放大成特效，念的时候会变成对应的语气）——每行最多 1 处，全篇 15–25 处，用在最吓人、最有画面的地方：
  **动作或关键细节**（如：**门把手自己转了半圈**）
  !!喊叫或突然的冲击!!（≤6 字，如：!!谁在那!!）
  ((低语、听不清的声音、心里的声音))（如：((你也看见了对吧))）
  [[拟声]]（如：[[咚、咚、咚]] [[吱呀——]] [[滴答]]）
  另外可以在语气变化的话前面写 {sighing} {scared} {soft tone} {chuckling} {in a hurry} {crying} 之一，每 4–5 行最多一个。`;
const MARK_EN = `Markup (shown as big on-screen effects and voiced with matching delivery) — at most one per line, 15–25 in the whole story, on the scariest, most visual moments:
  **an action or key detail**   !!a shout or sudden shock!! (≤4 words)   ((a whisper, a faint voice, an inner voice))   [[sound]] like [[knock, knock, knock]] [[creeeak]]
  You may also put {sighing} {scared} {soft tone} {chuckling} {in a hurry} {crying} before a line where the tone changes, at most one every 4–5 lines.`;

export function ghostPrompt(lang: Lang, topic: string, avoid: string[]) {
  if (lang === 'en') return `You write "Tonight's Ghost Story": an ordinary person tells a friend, late at night in a long voice note, a creepy thing that really happened to them (or someone close). It is SPOKEN audio — it must sound like a real person talking, not a novel, not an announcer.
How real people talk: short sentences, a few fillers ("like", "okay so", "I swear", "you know?") but not every line; they interrupt themselves, go back to add a detail, admit what they're unsure about, react to their own story ("I still get chills"). Concrete everyday details (time, weather, smell, what someone wore). Fear builds slowly from small wrong details; end with a chilling twist or a lingering detail. No gore; no real people, brands or real addresses.
Never write emoji, emoticons, "lol", "haha" spam or chat slang — this is read aloud.
Topic: ${topic}. Don't repeat these: ${avoid.join(' / ') || 'none'}.
When someone else in the story speaks, put their words on their own line spoken by that character (they get a different voice). The teller does everything else. 2–4 characters, each with a gender.
${MARK_EN}
Length: 35–55 lines, 1,300–1,900 words, each line under 60 words.
Pick a style for the cover card: city | home | hospital | school | village | water | road | old.
Output JSON {"title":"…","teaser":"one hooking line, no spoilers","style":"…","fear":1-5,"teller":{"name":"…","gender":"male|female","age":25},"cast":[{"name":"…","gender":"male|female","age":30}],"lines":[{"who":"teller","text":"…"},{"who":"<cast name>","text":"…"}]}`;
  return `你在写「今夜怪谈」：一个普通人深夜给朋友发一段长语音，讲一件自己（或身边的人）真实遇到过的怪事。这是要念出来的语音，必须像真人在说话——不像小说，不像电台主播，不像 AI。
真人说话是这样的：短句；偶尔有口头禅（"就是""然后""我跟你说""你知道吗""说实话""反正"），但别句句都有；会自己打断自己（"不对，是周三"）、回头补一个细节、承认自己也说不清；会对自己讲的事有反应（"我现在想起来还发毛"）。细节要具体、日常（几点、什么天气、闻到什么、谁穿了什么）。不用书面词（"然而""此时""仿佛""映入眼帘""心中一凛"这类一律不要）。
恐怖靠一点点"不对劲"慢慢堆起来，结尾给一个让人后背发凉的反转，或者一个留在心里的细节。不要血腥猎奇；不出现真实的人名、品牌、具体门牌地址。
绝对不要写表情符号、颜文字、"hhh""哈哈哈哈""LL""orz""QAQ"这类聊天用语——这是要念出来的。
题材：${topic}。别和这些重复：${avoid.join(' / ') || '无'}。
故事里别人说的话，单独成一行，由那个角色说（会换成 TA 自己的声音念）；其余都是讲述人说。角色 2–4 个，标好性别。
${MARK_ZH}
长度：35–55 行，全文 1800–2600 字，每行不超过 110 字。
给封面卡选一个风格：city(城市夜晚) | home(住处) | hospital(医院) | school(学校) | village(乡下老家) | water(水边) | road(路上/车里) | old(老物件/旧时代)。
输出 JSON {"title":"标题（像一条语音的标题，6-12 字）","teaser":"一句勾人但不剧透的话","style":"…","fear":1到5,"teller":{"name":"讲述人的名字或称呼","gender":"male|female","age":26},"cast":[{"name":"…","gender":"male|female","age":30}],"lines":[{"who":"teller","text":"…"},{"who":"角色名","text":"…"}]}`;
}


export async function writeGhost(admin: any, lang: Lang) {
  const { data: recent } = await admin.from('ghost_stories').select('title').eq('lang', lang).order('created_at', { ascending: false }).limit(30);
  const topics = lang === 'en' ? TOPICS_EN : TOPICS_ZH;
  let topic = topics[Math.floor(Math.random() * topics.length)];
  // 优先用网上收集来的真人经历（定时任务每天收、打过分）：只借梗概和关键情节，全部用自己的话重新讲
  const { data: seeds } = await admin.from('ghost_seeds').select('*').eq('lang', lang).eq('status', 'new').order('score', { ascending: false }).limit(1);
  const seed = seeds?.[0];
  if (seed) {
    await admin.from('ghost_seeds').update({ status: 'using' }).eq('id', seed.id);
    topic = lang === 'en'
      ? `Adapt this real-sounding experience someone shared online. Use ONLY its premise and key beats; retell it completely in your own words as a new person's voice note — new names, new details, no sentences copied. Premise: ${seed.premise}${seed.beats ? ` Key beats: ${seed.beats}` : ''}${seed.setting ? ` Setting: ${seed.setting}` : ''}`
      : `改编一个网友分享的"亲身经历"。只借它的梗概和关键情节，用一个新的讲述人、全新的名字和细节完整地重新讲一遍，不要照抄原文任何句子。梗概：${seed.premise}${seed.beats ? ` 关键情节：${seed.beats}` : ''}${seed.setting ? ` 场景：${seed.setting}` : ''}`;
  }
  const { data } = await callLLMJson<any>({ system: ghostPrompt(lang, topic, (recent || []).map((r: any) => r.title).filter(Boolean)), messages: [{ role: 'user', content: lang === 'en' ? 'Write tonight’s story.' : '写今晚的故事。' }], tier: 'main', temperature: 0.95, maxTokens: 6000 });
  const noChat = (t: string) => t.replace(/\p{Extended_Pictographic}|[\u{1F300}-\u{1FAFF}]/gu, '').replace(/(?:h{3,}|哈{4,}|LL|orz|QAQ|TAT|233+|\(\s*[^()\s]{1,4}\s*\))/gi, (m) => (/^哈/.test(m) ? '哈哈' : '')).replace(/\s{2,}/g, ' ').trim();
  const lines = (Array.isArray(data?.lines) ? data.lines : []).map((l: any) => ({ who: String(l.who || 'teller'), text: noChat(String(l.text || '')) })).filter((l: any) => l.text);
  if (!data?.title || lines.length < 20) throw new Error('story too short');
  // 配声音：讲述人一个，角色按性别各一个，互相不撞
  // 声音尽量不重复：最近 12 篇里用得最少的优先，同一篇里也不撞
  const pool = V[lang];
  const { data: rec } = await admin.from('ghost_stories').select('teller, cast_list').eq('lang', lang).order('created_at', { ascending: false }).limit(12);
  const uses: Record<string, number> = {};
  for (const r of rec || []) { const t = r.teller?.voice; if (t) uses[t] = (uses[t] || 0) + 2; for (const c of r.cast_list || []) if (c.voice) uses[c.voice] = (uses[c.voice] || 0) + 1; }
  const used = new Set<string>();
  const least = (opts: string[]) => { const free = opts.filter((v) => !used.has(v)); const o = free.length ? free : opts; const m = Math.min(...o.map((v) => uses[v] || 0)); const c = o.filter((v) => (uses[v] || 0) === m); const v = c[Math.floor(Math.random() * c.length)]; used.add(v); return v; };
  const tg = data.teller?.gender === 'female' ? 'female' : 'male';
  const tellerVoice = least(tg === 'female' ? pool.tellerF : pool.tellerM);
  const cast = (Array.isArray(data.cast) ? data.cast : []).slice(0, 5).map((c: any) => {
    const g = c.gender === 'female' ? 'female' : 'male';
    return { name: String(c.name || ''), gender: g, age: Number(c.age) || null, voice: least(g === 'female' ? pool.f : pool.m) };
  });
  const { data: row } = await admin.from('ghost_stories').insert({
    lang, title: String(data.title).slice(0, 40), teaser: String(data.teaser || '').slice(0, 120),
    style: (STYLES as readonly string[]).includes(data.style) ? data.style : 'city', fear: Math.max(1, Math.min(5, Number(data.fear) || 3)),
    teller: { name: String(data.teller?.name || (lang === 'en' ? 'A friend' : '朋友')), gender: tg, age: Number(data.teller?.age) || null, voice: tellerVoice },
    cast_list: cast, lines, status: 'draft', seed_id: seed?.id || null,
  }).select('id').single();
  if (seed) await admin.from('ghost_seeds').update({ status: 'used', story_id: row?.id || null }).eq('id', seed.id);
  if (row?.id) await cueGhost(admin, row.id);
  return row?.id;
}

// 每句配氛围：背景氛围乐类别 + 音效 + 惊吓一击（跟讲故事模式同一套声音库）
export async function cueGhost(admin: any, id: string) {
  const { data: s } = await admin.from('ghost_stories').select('id, lang, lines').eq('id', id).maybeSingle();
  const lines: any[] = s?.lines || [];
  if (!lines.length) return;
  const paras = lines.map((l) => stripMarks(stripCue(l.text)));
  try {
    const { data } = await callLLMJson<any>({ system: buildStoryCuesPrompt(paras, s.lang === 'en' ? 'horror, true-story voice note' : '恐怖 / 真实经历怪谈', s.lang), messages: [{ role: 'user', content: '逐句配乐。' }], tier: 'aux', temperature: 0.4, maxTokens: 2600 });
    const raw: any[] = Array.isArray(data?.cues) ? data.cues : [];
    const words = STORY_MOODS.map((m) => m.word);
    const cues = paras.map((_, i) => { const c = raw.find((x) => Number(x?.i) === i) || raw[i] || {}; return { mood: words.includes(c.mood) ? c.mood : 'eerie', sfx: (Array.isArray(c.sfx) ? c.sfx : []).filter((k: string) => STORY_SFX.includes(k)).slice(0, 2), stinger: !!c.stinger }; });
    await admin.from('ghost_stories').update({ cues }).eq('id', id);
  } catch {}
}

const stripCue = (t: string) => String(t || '').replace(/\{[a-z][a-z ]{1,24}\}\s*/gi, '').trim();
export const displayText = stripCue;

// 一句一句配音（可分几轮做完）；全配完就标成 ready。返回 'quota' 表示 Fish 免费额度这一小时用完了。
export async function voiceGhost(admin: any, id: string, deadline: number): Promise<'done' | 'partial' | 'quota'> {
  const { data: s } = await admin.from('ghost_stories').select('*').eq('id', id).maybeSingle();
  if (!s) return 'done';
  const lang: Lang = s.lang === 'en' ? 'en' : 'zh';
  const lines: any[] = s.lines || [];
  const voiceOf = (who: string) => who === 'teller' ? s.teller?.voice : ((s.cast_list || []).find((c: any) => c.name === who)?.voice || s.teller?.voice);
  let quota = false;
  const todo = lines.map((l, i) => ({ l, i })).filter(({ l }) => !l.audio);
  for (let k = 0; k < todo.length && Date.now() < deadline && !quota; k += 4) {
    await Promise.all(todo.slice(k, k + 4).map(async ({ l, i }) => {
      try {
        const r = await fetch(`${LINGER_URL}/api/mystnight/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body: JSON.stringify({ text: l.text, voice: voiceOf(l.who), lang, speed: l.who === 'teller' ? 0.96 : 1 }) });
        if (r.status === 429) { quota = true; return; }
        if (!r.ok) return;
        const buf = Buffer.from(await r.arrayBuffer());
        const path = `tts/ghost-${id}-${i}.mp3`;
        const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
        if (!up.error) { lines[i] = { ...l, audio: admin.storage.from('scene-images').getPublicUrl(path).data.publicUrl, secs: Math.round(buf.length / 16000 * 10) / 10 }; }
      } catch {}
    }));
    await admin.from('ghost_stories').update({ lines }).eq('id', id);
  }
  const done = lines.every((l) => l.audio);
  if (done) await admin.from('ghost_stories').update({ status: 'ready', seconds: Math.round(lines.reduce((a, l) => a + (l.secs || 0), 0)) }).eq('id', id);
  return done ? 'done' : quota ? 'quota' : 'partial';
}

// 今晚的故事：已经排好的用它；没有就从做好的里挑最早的一篇排到今天
export async function tonight(admin: any, lang: Lang) {
  const day = dayKey(lang);
  const { data: have } = await admin.from('ghost_stories').select('*').eq('lang', lang).eq('day', day).maybeSingle();
  if (have) return have;
  const { data: next } = await admin.from('ghost_stories').select('id').eq('lang', lang).eq('status', 'ready').is('day', null).order('created_at').limit(1);
  if (!next?.[0]) {
    // 还没有新的：先拿最近一篇顶上（不改它的日期）
    const { data: last } = await admin.from('ghost_stories').select('*').eq('lang', lang).not('day', 'is', null).order('day', { ascending: false }).limit(1);
    return last?.[0] || null;
  }
  const { data: mx } = await admin.from('ghost_stories').select('no').eq('lang', lang).not('no', 'is', null).order('no', { ascending: false }).limit(1);
  const no = (mx?.[0]?.no || 0) + 1;
  await admin.from('ghost_stories').update({ day, no }).eq('id', next[0].id).is('day', null);
  const { data: row } = await admin.from('ghost_stories').select('*').eq('lang', lang).eq('day', day).maybeSingle();
  return row;
}

export function publicStory(s: any, full: boolean) {
  return {
    id: s.id, lang: s.lang, title: s.title, teaser: s.teaser, day: s.day, no: s.no, seconds: s.seconds, style: s.style || 'city', fear: s.fear || 3, real: !!s.seed_id,
    teller: { name: s.teller?.name, gender: s.teller?.gender }, cast: (s.cast_list || []).map((c: any) => ({ name: c.name, gender: c.gender })),
    lines: full ? (s.lines || []).map((l: any, i: number) => ({ who: l.who, text: stripCue(l.text), audio: l.audio || null, cue: (s.cues || [])[i] || null })) : [],
  };
}
