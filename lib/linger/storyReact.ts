// 一起听故事：Linger 伴侣听到吓人/动人的地方，或者你发了弹幕/表情，TA 也会冒一句或者丢个表情。
import { callLLMJson } from '@/lib/llm';
import { compOf, liveCompanion, pushLive } from '@/lib/linger/companion';
import { STICKERS } from '@/components/Sticker';
import { stripMarks } from '@/lib/narrate';

export async function storyReact(admin: any, room0: any, opts: { para?: string; why: 'scary' | 'moving' | 'periodic' | 'user'; userSaid?: string }) {
  const c0 = compOf(room0);
  if (!c0?.player_id) return null;
  const last = Number((c0 as any).story_react_at) || 0;
  if (Date.now() - last < (opts.why === 'user' ? 6000 : 15000)) return null;
  await admin.from('rooms').update({ companion: { ...c0, story_react_at: Date.now() } }).eq('id', room0.id);
  const room: any = await liveCompanion(admin, room0);
  const c: any = compOf(room);
  const en = room.language === 'en';
  const you = c.userName || (en ? 'them' : '对方');
  const st = STICKERS.map((s) => s.k).join('|');
  const sys = en
    ? `You are ${c.name}, listening to a story together with ${you} (you two are close: ${c.relation || ''}). Your personality: ${c.persona}. How you talk: ${c.speech || 'casual texting'}. What you two remember lately: ${String(c.memory || '').slice(-600)}.
Right now the story says: "${stripMarks(opts.para || '').slice(0, 300)}".${opts.userSaid ? ` ${you} just reacted: "${opts.userSaid}".` : ''}
React like a real person listening next to them: either a very short comment (max 12 words, casual, like a live comment — no emoji, no "haha" spam) or just a sticker. Stickers: ${st} (scared, creep, wow, warm, cry, lol). Match your personality: a scaredy-cat clings and squeaks, a tease mocks ${you} for being scared, a calm one deadpans. Never say you are an AI.
Output JSON {"kind":"text"|"sticker","value":"..."}`
    : `你是${c.name}，正在和${you}一起听一个故事（你们很熟：${c.relation || ''}）。你的性格：${c.persona}。你说话的样子：${c.speech || '平时聊天那样'}。你们最近的事：${String(c.memory || '').slice(-600)}。
故事正讲到："${stripMarks(opts.para || '').slice(0, 300)}"。${opts.userSaid ? `${you}刚发了："${opts.userSaid}"。` : ''}
像真人坐在旁边一起听那样反应一下：要么发一句很短的弹幕（不超过 14 个字，口语，像直播间弹幕；不要表情符号、不要"哈哈哈哈"刷屏），要么只丢一个表情。表情可选：${st}（吓死、发毛、哇、好暖、想哭、哈哈）。按你的性格来：胆小的会缩一下、喊一声；爱逗人的会笑${you}胆小；淡定的会冷冷吐槽一句。绝不说自己是 AI。
输出 JSON {"kind":"text"|"sticker","value":"..."}`;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: en ? 'Your reaction:' : '你的反应：' }], tier: 'aux', temperature: 0.9, maxTokens: 120 });
    const kind = data?.kind === 'sticker' && STICKERS.some((s) => s.k === data.value) ? 'sticker' : 'text';
    const value = kind === 'sticker' ? data.value : String(data?.value || '').replace(/\p{Extended_Pictographic}/gu, '').trim().slice(0, 40);
    if (!value) return null;
    await admin.from('messages').insert({ room_id: room.id, sender_type: 'player', sender_player_id: c.player_id, action_type: 'chat', turn_no: 0, content: kind === 'text' ? value : '', payload: { type: 'story_live', kind, value } });
    pushLive(admin, room).catch(() => {});
    return { kind, value };
  } catch { return null; }
}
