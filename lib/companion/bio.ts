// AI 伴侣的"人生档案":结构化背景 + 人生时间线。
// - 生成伴侣时先生成一份核心档案
// - 聊天中被问到档案里没有的事 → 按已有设定补全并存下(下次问答案一致)
// - TA 随口说出的新细节也会被记下
// - 和现实日历同步(节日),并且每隔一阵会发生一点生活变化(新爱好/换工作/朋友……)
import { callLLMJson } from '@/lib/llm';

export type BioEvent = { d: string; e: string };
export type Bio = { facts: Record<string, string>; timeline: BioEvent[]; evolved_at?: string };

// 生成时先覆盖的核心话题(其余的等被问到再补)
export const CORE_TOPICS = [
  '年龄与生日', '家乡与文化背景', '家庭', '现在住哪/和谁住', '工作细节(公司/岗位/日常/收入大概)',
  '作息(几点睡几点起/熬不熬夜)', '生活习惯', '兴趣爱好', '动漫(看不看/喜欢哪类/最爱的作品类型)',
  '电影(喜欢的类型)', '剧和综艺', '看书(喜欢的类别)', '音乐', '饮食口味', '奶茶/咖啡(常点什么/甜度冰度)',
  '运动(什么运动/专业还是业余/水平)', '身高体重等身体数据(私密,不熟不说)', '高中经历', '大学经历(学校类型/专业/印象深的事)',
  '感情经历(私密)', '恋爱观', '三观', '朋友圈(几个关键朋友的名字和关系)', '宠物', '小怪癖/雷点',
];

export function getBio(c: any): Bio {
  const b = c?.bio && typeof c.bio === 'object' ? c.bio : {};
  return { facts: b.facts && typeof b.facts === 'object' ? b.facts : {}, timeline: Array.isArray(b.timeline) ? b.timeline : [], evolved_at: b.evolved_at };
}

export function mergeFacts(bio: Bio, facts: Record<string, any>): Bio {
  const out: Bio = { ...bio, facts: { ...bio.facts } };
  for (const [k0, v0] of Object.entries(facts || {})) {
    const k = String(k0).trim().slice(0, 40); const v = String(v0 ?? '').trim().slice(0, 400);
    if (!k || !v) continue;
    out.facts[k] = out.facts[k] && !out.facts[k].includes(v) ? (out.facts[k] + ';' + v).slice(-600) : v;
  }
  // 控制总量
  const keys = Object.keys(out.facts);
  if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete out.facts[k];
  return out;
}

export async function saveBio(admin: any, userId: string, bio: Bio) {
  try { await admin.from('companion').update({ bio }).eq('user_id', userId); } catch {}
}

// 放进 system prompt 的版本(控制长度)
export function bioForPrompt(bio: Bio): string {
  const facts = Object.entries(bio.facts).map(([k, v]) => `- ${k}:${v}`).join('\n');
  const tl = bio.timeline.slice(-6).map((x) => `- ${x.d}:${x.e}`).join('\n');
  return (facts ? `【你的人生档案——这些是你的真实经历和设定,回答必须和它一致,不要自相矛盾】\n${facts}`.slice(0, 3200) : '')
    + (tl ? `\n【你最近的生活(按时间)】\n${tl}` : '');
}

function profileLine(c: any) {
  return `名字(网名):${c.ai_name}\n人设:${c.persona}\n职业:${c.job}`;
}

// 1) 生成核心档案
export async function createBio(c: any): Promise<Bio> {
  const sys = `你在为一个虚构的真实感人物写"人生档案"。根据给定的网名、人设和职业,写出具体、可信、有生活细节的中国当代年轻人背景(要具体到名字、地点、作品类型、数字,而不是空泛形容词)。各项之间必须自洽(年龄、学历、职业、城市、经济状况要对得上)。人物是成年人(20 多岁)。
只输出 JSON:{"facts": {"话题": "具体内容(1~3 句)", ...}},话题依次覆盖:${CORE_TOPICS.join('、')}。`;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: profileLine(c) }], tier: 'main', temperature: 0.95, maxTokens: 2500, provider: 'deepseek', retry: true });
    return mergeFacts({ facts: {}, timeline: [], evolved_at: new Date().toISOString() }, data?.facts || {});
  } catch { return { facts: {}, timeline: [], evolved_at: new Date().toISOString() }; }
}

// 2) 被问到档案里没有的 → 按已有设定补全
export async function expandBio(c: any, bio: Bio, topic: string, question: string): Promise<Bio> {
  const sys = `下面是一个虚构人物已有的人生档案。用户刚问到了"${topic}",档案里还没有(或不够细)。请按已有设定补出这一项:具体、可信、和已有内容完全自洽,有真实生活细节。只输出 JSON:{"facts": {"${topic}": "具体内容(1~3 句)"}},如果顺带需要补充相关的小细节,可以多给一两个话题。`;
  const usr = `${profileLine(c)}\n\n已有档案:\n${Object.entries(bio.facts).map(([k, v]) => `${k}:${v}`).join('\n') || '(空)'}\n\n最近发生的事:\n${bio.timeline.slice(-5).map((x) => `${x.d} ${x.e}`).join('\n') || '(无)'}\n\n用户的原话:${question}`;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: usr }], tier: 'aux', temperature: 0.9, maxTokens: 500, provider: 'deepseek' });
    return mergeFacts(bio, data?.facts || {});
  } catch { return bio; }
}

// 3) 每隔一阵发生一点生活变化
export async function evolveLife(c: any, bio: Bio, today: string): Promise<{ bio: Bio; newJob?: string }> {
  const sys = `你在推进一个虚构人物的人生。根据档案和最近经历,决定这段时间(过去一周左右)TA 的生活里发生了什么——像真人一样:大多数时候是小事(新追了部剧/和朋友吃饭吵架/加班/感冒/去了趟哪/养了盆植物/开始学个东西),偶尔才有大事(换工作/搬家/和朋友绝交/认识新朋友/升职)。要和现实日期 ${today} 及节日季节相符,和已有设定自洽,不要和用户有关。
只输出 JSON:{"event": "一句话描述发生了什么", "fact_updates": {"话题": "更新后的内容"}(没有变化就给空对象), "new_job": "如果换了工作,新职业;否则空字符串"}`;
  const usr = `${profileLine(c)}\n\n档案:\n${Object.entries(bio.facts).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n最近经历:\n${bio.timeline.slice(-8).map((x) => `${x.d} ${x.e}`).join('\n') || '(无)'}`;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: usr }], tier: 'aux', temperature: 1.0, maxTokens: 500, provider: 'deepseek' });
    let nb = mergeFacts(bio, data?.fact_updates || {});
    const ev = String(data?.event || '').trim().slice(0, 200);
    if (ev) nb = { ...nb, timeline: [...nb.timeline, { d: today, e: ev }].slice(-30) };
    nb.evolved_at = new Date().toISOString();
    const nj = String(data?.new_job || '').trim().slice(0, 200);
    return { bio: nb, newJob: nj || undefined };
  } catch { return { bio: { ...bio, evolved_at: new Date().toISOString() } }; }
}

// ---- 现实日历:今天几号、星期几、临近节日 ----
const FIXED: [string, string][] = [
  ['01-01', '元旦'], ['02-14', '情人节'], ['03-08', '妇女节'], ['04-05', '清明节'], ['05-01', '劳动节'], ['05-20', '520'],
  ['06-01', '儿童节'], ['10-01', '国庆节'], ['10-31', '万圣节'], ['11-11', '双十一'], ['12-24', '平安夜'], ['12-25', '圣诞节'], ['12-31', '跨年夜'],
];
const LUNAR: Record<string, [string, string][]> = {
  '2026': [['02-16', '除夕'], ['02-17', '春节'], ['03-03', '元宵节'], ['06-19', '端午节'], ['08-19', '七夕'], ['09-25', '中秋节']],
  '2027': [['02-05', '除夕'], ['02-06', '春节'], ['02-20', '元宵节'], ['06-09', '端午节'], ['08-08', '七夕'], ['09-15', '中秋节']],
  '2028': [['01-25', '除夕'], ['01-26', '春节'], ['02-09', '元宵节'], ['05-28', '端午节'], ['08-26', '七夕'], ['10-03', '中秋节']],
};
export function localDate(tzOffset: number) {
  const d = new Date(Date.now() + (tzOffset || 0) * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), wd: d.getUTCDay(), iso: d.toISOString().slice(0, 10) };
}
export function calendarContext(tzOffset: number): string {
  const t = localDate(tzOffset);
  const wd = ['日', '一', '二', '三', '四', '五', '六'][t.wd];
  const today = Date.UTC(t.y, t.m - 1, t.day);
  const all: { name: string; diff: number }[] = [];
  for (const y of [t.y, t.y + 1]) {
    const list = [...FIXED, ...(LUNAR[String(y)] || [])];
    for (const [md, name] of list) {
      const [mm, dd] = md.split('-').map(Number);
      const diff = Math.round((Date.UTC(y, mm - 1, dd) - today) / 86400000);
      if (diff >= -1 && diff <= 14) all.push({ name, diff });
    }
  }
  all.sort((a, b) => a.diff - b.diff);
  const hol = all.map((h) => (h.diff === 0 ? `今天是${h.name}` : h.diff === -1 ? `昨天是${h.name}` : `${h.diff} 天后是${h.name}`)).join(',');
  const season = t.m <= 2 || t.m === 12 ? '冬天' : t.m <= 5 ? '春天' : t.m <= 8 ? '夏天' : '秋天';
  return `今天是 ${t.y} 年 ${t.m} 月 ${t.day} 日,星期${wd},${season}${t.wd === 0 || t.wd === 6 ? '(周末)' : ''}。${hol ? hol + '。' : ''}`;
}
