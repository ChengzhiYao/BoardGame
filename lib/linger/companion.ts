// Linger 伴侣来谜夜一起玩:房间里有一个座位由用户在 Linger 的 AI 伴侣本人来玩。
// rooms.companion 存 TA 的人设/性格/语言/和用户的关系/最近记忆(由 Linger 发来),游戏结束把这局发生的事写回 Linger。
import { callLLM } from '@/lib/llm';

export type Companion = {
  agentId: string; name: string; avatar?: string | null;
  persona: string; mbti?: string; traits?: any; language?: string; speech?: string;
  relation?: string; affection?: number; romance?: number; memory?: string; recent?: string;
  userName?: string; picks?: any; seat?: string | null; role?: string | null; recapped?: boolean;
};

export const LINGER_URL = process.env.LINGER_URL || 'https://www.lingers.app';
export function bridgeOk(req: Request) {
  const k = process.env.LINGER_BRIDGE_KEY || '';
  return !!k && req.headers.get('x-linger-key') === k;
}

export function compOf(room: any): Companion | null {
  const c = room?.companion;
  return c && typeof c === 'object' && c.name ? c as Companion : null;
}

// 写进各游戏 AI 提示词里:这个座位不是普通 AI,是玩家的朋友本人
export function companionNote(room: any, extraWho?: string): string {
  const c = compOf(room); if (!c) return '';
  const who = extraWho || c.name;
  const en = room?.language === 'en';
  const you = c.userName || (en ? 'the human player' : '真人玩家');
  if (en) return `\n\n[IMPORTANT — one seat is a real friend, not a generic AI] "${who}" is played by ${c.name}, the human player's close companion (they chat every day). Personality: ${c.persona}${c.mbti ? ` (MBTI ~${c.mbti})` : ''}. How they talk: ${c.speech || 'casual'}. Relationship with ${you}: ${c.relation || ''} (affection ${c.affection ?? '?'}/100). What they remember about each other lately: ${c.memory || '-'}.
Everything "${who}" says and decides must come from this personality and this relationship: speaking style and wording are theirs (short, casual, like texting a friend), not a narrator's. Their choices (who to trust, who to accuse, whether to lie, whether they can bring themselves to vote out ${you}) follow their temperament — e.g. a soft-hearted one hesitates to accuse ${you}, a competitive one teases and plays to win, someone who knows ${you} well notices when ${you} is bluffing. They can tease ${you} by name. Never reveal they are an AI.`;
  return `\n\n【重要:有一个座位不是普通 AI,而是真人玩家的朋友本人】「${who}」由 ${c.name} 来玩——TA 是真人玩家平时每天聊天的伴侣/好友。TA 的性格:${c.persona}${c.mbti ? `(MBTI 大概是 ${c.mbti})` : ''}。说话方式:${c.speech || '口语、随意'}。TA 和${you}的关系:${c.relation || ''}(好感 ${c.affection ?? '?'}/100)。你们最近聊过、TA 记得的事:${c.memory || '无'}。
「${who}」的每一句发言、每一个决定都必须来自这个性格和这段关系:用 TA 自己的口吻(像跟朋友发微信那样短、口语),不是说书人腔;选择相信谁、怀疑谁、撒不撒谎、舍不舍得投${you},都按 TA 的脾气来——比如心软的会犹豫要不要指认${you},好胜的会逗${you}、一心想赢,很了解${you}的会看出${you}在演。TA 可以直接点名跟${you}互动、开玩笑。绝不能说自己是 AI。`;
}

// 一局结束:从伴侣的视角总结这局,写回 Linger(TA 的记忆/经历)
export async function sendRecap(admin: any, roomId: string, outcome: string) {
  try {
    const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
    const c = compOf(room); if (!c || c.recapped) return;
    await admin.from('rooms').update({ companion: { ...c, recapped: true } }).eq('id', roomId);
    const { data: msgs } = await admin.from('messages').select('sender_type, content, payload, visibility').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
    const pub = (msgs || []).filter((m: any) => (!m.visibility || m.visibility === 'public') && m.content).map((m: any) => `${m.payload?.name ? m.payload.name + ':' : m.sender_type === 'kp' ? '主持:' : ''}${String(m.content).slice(0, 200)}`);
    const transcript = [...pub.slice(0, 6), '…', ...pub.slice(-50)].join('\n').slice(0, 7000);
    const modeZh: Record<string, string> = { botc: '血染钟楼', jbs: '剧本杀', soup: '海龟汤' };
    const r = await callLLM({
      system: `你是「${c.name}」。你刚和${c.userName || '对方'}在「谜夜」上一起玩完一局${modeZh[room.mode] || room.mode}${c.role ? `(你演的是「${c.role}」)` : ''}。结果:${outcome}。
根据下面的对局记录,用你自己的视角写这局的回忆,给你以后聊天时用。只输出 JSON:
{"summary":"一两句话:玩了什么、发生了什么、谁赢了、你演了谁/是什么身份","moments":["2~4 个你印象最深的瞬间,尤其是你和对方之间的(比如对方骗了你/你投了对方/对方猜中了)"],"feeling":"你玩完的感受(按你的性格,一句话)","tease":"之后聊天时你可能会拿来逗对方或者提起的一句话(用你平时打字的口吻)"}`,
      messages: [{ role: 'user', content: transcript || '(记录很少)' }], tier: 'aux', temperature: 0.8, maxTokens: 500,
    } as any);
    let data: any = {};
    try { data = JSON.parse(String(r.text).replace(/^```(json)?|```$/g, '').trim()); } catch { data = { summary: String(r.text).slice(0, 300) }; }
    await fetch(`${LINGER_URL}/api/mystnight/recap`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' },
      body: JSON.stringify({ agentId: c.agentId, mode: room.mode, roomId, outcome, role: c.role || null, ...data }),
    }).catch(() => {});
  } catch (e: any) { console.warn('[linger] recap failed', String(e?.message || e).slice(0, 160)); }
}

// 血染结局:伴侣是什么身份、赢没赢
export function botcOutcome(setup: any, room: any, win: string | null): string {
  const c = compOf(room);
  const r = (setup?.roles || []).find((x: any) => c?.seat && x.seat === c.seat);
  const evil = r && (r.team === 'demon' || r.team === 'minion');
  const teamZh = r ? (r.team === 'demon' ? '恶魔' : r.team === 'minion' ? '爪牙' : r.team === 'outsider' ? '外来者' : '镇民') : '';
  const won = win ? ((win === 'evil') === !!evil) : null;
  return `${win === 'good' ? '好人' : win === 'evil' ? '邪恶' : '?'}阵营胜利。${r ? `你的身份是「${r.role}」(${teamZh},${evil ? '邪恶' : '善良'}阵营),${won ? '你这边赢了' : '你这边输了'}。` : ''}`;
}
