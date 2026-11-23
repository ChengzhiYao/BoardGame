// 剧本杀「舞台」：场景地图、非嫌疑人角色（NPC）、每幕开场演出 + 中途突发事件、分幕剧本（每幕解锁的私人记忆）。
// 新案件由出本 prompt 直接写好；老案件（本库里已有的）第一次被玩时用一次调用补齐，并存回本库永久复用。
import { callLLMJson } from '@/lib/llm';
import { generateImage } from '@/lib/image';

export type Scene = { id: string; name: string; mood?: string; spots?: string[]; image?: string };
export type Npc = { name: string; role?: string; look?: string; knows?: string; attitude?: string; price?: string; gender?: string };

export function hasStage(cf: any) {
  return Array.isArray(cf?.scenes) && cf.scenes.length >= 3 && Array.isArray(cf?.acts) && cf.acts.some((a: any) => a?.show);
}

export const STAGE_SCHEMA_ZH = `
【舞台·让故事走起来】
- scenes：4~6 个可以去的地点（id 用 s1、s2…），每个 { "id","name":"地点名","mood":"1~2 句氛围描写（公开，不剧透）","spots":["这里可以搜的 2~4 处"] }。evidence 的 where 要写成这些地点里的某处。
- npcs：2~3 个**不参与指认**的配角（管家、巡捕、法医、老板娘之类），每个 { "name","gender","role":"身份（公开）","look":"一句外貌/状态（公开）","knows":"他掌握的信息（DM 内部）","attitude":"性格与对调查者的态度","price":"什么能让他开口（钱/威胁/同情/交换…）" }。
- acts 的每一幕再加：{ "scene":"本幕开始时大家所在地点的 id", "show":"本幕开场演出：2~4 句，有画面、有人物登场和一句台词，像舞台剧开幕（公开、不剧透）", "event":"本幕中途的突发事件：1~2 句（停电、尖叫、有人闯入、新的发现……公开描述，制造压力但不直接给答案）" }。最后一幕（真相/结局）event 留空。
- characters 的每个角色再加 "act_pages"：[{ "act":2, "text":"到这一幕才想起/得知的私人记忆或新信息，第二人称，2~4 句，可以颠覆他对自己的认知" }]，覆盖第 2 幕到倒数第 3 幕中的 1~3 幕。`;

function stagePrompt(cf: any) {
  const lite = {
    title: cf.title, type: cf.type, truth: cf.truth, murderer: cf.murderer, method: cf.method,
    timeline_true: cf.timeline_true, evidence: cf.evidence,
    characters: (cf.characters || []).map((c: any) => ({ name: c.name, occupation: c.occupation, secret: c.secret, background: c.background })),
    acts: (cf.acts || []).map((a: any) => ({ name: a.name, goal: a.goal })),
  };
  return `你是剧本杀编剧。下面是一桩已经锁定的案件（绝密，不能改动任何事实）：
${JSON.stringify(lite).slice(0, 7000)}

请为它补上"舞台"，让主持人能带玩家在不同地点之间行动、每一幕有开场演出和突发事件、每个角色的剧本分幕解锁。不能新增或改动真相、凶手、证据本身。
${STAGE_SCHEMA_ZH}

只输出 JSON：
{
  "scenes": [ { "id":"s1", "name":"", "mood":"", "spots":[""] } ],
  "npcs": [ { "name":"", "gender":"male", "role":"", "look":"", "knows":"", "attitude":"", "price":"" } ],
  "acts": [ { "scene":"s1", "show":"", "event":"" } ],
  "pages": [ { "name":"角色名", "act":2, "text":"" } ]
}
acts 数组长度必须 = ${(cf.acts || []).length}，按幕顺序。`;
}

export async function ensureStage(admin: any, cf: any, libId?: string | null, lang?: string) {
  if (hasStage(cf)) return { cf, usage: null as any };
  const { data: out, usage } = await callLLMJson<any>({
    system: stagePrompt(cf) + (lang === 'en' ? '\nWrite every value in English.' : ''),
    messages: [{ role: 'user', content: '请补上舞台。' }],
    tier: 'main', temperature: 0.8, maxTokens: 3200, retry: true,
  });
  const next = { ...cf };
  if (Array.isArray(out?.scenes) && out.scenes.length) next.scenes = out.scenes.slice(0, 6);
  if (Array.isArray(out?.npcs)) next.npcs = out.npcs.slice(0, 3);
  if (Array.isArray(out?.acts) && Array.isArray(next.acts)) next.acts = next.acts.map((a: any, i: number) => ({ ...a, ...(out.acts[i] || {}) }));
  if (Array.isArray(out?.pages) && Array.isArray(next.characters)) {
    next.characters = next.characters.map((c: any) => ({ ...c, act_pages: out.pages.filter((p: any) => p?.name === c.name && p?.text).map((p: any) => ({ act: Number(p.act) || 2, text: p.text })) }));
  }
  if (libId) await admin.from('jbs_case_library').update({ case_file: next }).eq('id', libId);
  return { cf: next, usage };
}

// 给玩家看的公开舞台信息（存在 rooms.jbs_stage）
export function publicStage(cf: any, scene?: string) {
  const scenes: Scene[] = (cf.scenes || []).map((s: any) => ({ id: s.id, name: s.name, mood: s.mood, spots: s.spots, image: s.image }));
  const npcs = (cf.npcs || []).map((n: any) => ({ name: n.name, role: n.role, look: n.look, gender: n.gender, image: n.image }));
  return { scene: scene || cf.acts?.[0]?.scene || scenes[0]?.id || null, scenes, npcs, events: {} as Record<string, boolean> };
}

// 场景图：每个地点画一张（低画质 JPEG，约 0.5 美分一张），存回案件和本库，以后复用
export async function drawScenes(admin: any, cf: any, opts: { roomId: string; libId?: string | null; era?: string; max?: number }) {
  const todo = (cf.scenes || []).filter((s: any) => !s.image).slice(0, opts.max ?? 6);
  if (!todo.length) return { cf, drawn: 0 };
  const era = opts.era || cf.era || '';
  await Promise.all(todo.map(async (s: any) => {
    try {
      const prompt = `电影感的场景概念图，竖向构图，没有人物正脸，没有任何文字。地点：${s.name}。${s.mood || ''} 时代：${era}。剧本杀《${cf.title || ''}》。氛围压抑、写实、低饱和、有戏剧性的光影。`;
      const buf = await generateImage(prompt, { quality: 'low', jpeg: 60 });
      const path = `jbs-scenes/${opts.libId || opts.roomId}-${s.id}.jpg`;
      const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
      if (!up.error) s.image = admin.storage.from('scene-images').getPublicUrl(path).data.publicUrl;
    } catch {}
  }));
  const drawn = todo.filter((s: any) => s.image).length;
  if (drawn) {
    await admin.from('api_usage').insert({ room_id: opts.roomId, kind: 'image', model: 'jbs-scene-low', prompt_tokens: drawn, cost: 0.005 * drawn });
    if (opts.libId) await admin.from('jbs_case_library').update({ case_file: cf }).eq('id', opts.libId);
  }
  return { cf, drawn };
}

// 本幕的突发事件：每幕只触发一次（按时间过半由房主端触发，或有人行动时顺带触发）
export async function fireEvent(admin: any, roomId: string, room: any, cf: any): Promise<string | null> {
  const act = room.jbs_act || 1;
  const st = room.jbs_stage || {};
  const ev = cf?.acts?.[act - 1]?.event;
  if (!ev || st.events?.[act]) return null;
  const next = { ...st, events: { ...(st.events || {}), [act]: true } };
  await admin.from('rooms').update({ jbs_stage: next }).eq('id', roomId);
  room.jbs_stage = next;
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: act, content: ev, payload: { type: 'jbs_event' } });
  return ev;
}

// 换场景：更新当前地点并在故事里插一张地点卡
export async function moveScene(admin: any, roomId: string, room: any, sceneId: string | undefined, act: number) {
  const st = room.jbs_stage || {};
  if (!sceneId || sceneId === st.scene) return false;
  const sc = (st.scenes || []).find((x: any) => x.id === sceneId);
  if (!sc) return false;
  const next = { ...st, scene: sceneId };
  await admin.from('rooms').update({ jbs_stage: next }).eq('id', roomId);
  room.jbs_stage = next;
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: act, content: sc.name, payload: { type: 'jbs_scene', scene: sceneId } });
  return true;
}

// 给主持人看的舞台说明（拼进 DM prompt）
export function stageBrief(cf: any, stage: any, justHappened?: string | null) {
  if (!Array.isArray(cf?.scenes) || !cf.scenes.length) return '';
  const cur = cf.scenes.find((s: any) => s.id === stage?.scene) || cf.scenes[0];
  const scenes = cf.scenes.map((s: any) => `${s.id}「${s.name}」可搜：${(s.spots || []).join('、')}`).join('；');
  const npcs = (cf.npcs || []).map((n: any) => `${n.name}（${n.role || ''}）掌握：${n.knows || ''}；态度：${n.attitude || ''}；能让他开口的：${n.price || ''}`).join('\n');
  return `

【舞台·地点】大家现在在：${cur.id}「${cur.name}」——${cur.mood || ''}
全部地点：${scenes}
- 玩家说要去别的地方、或者剧情需要大家转移时，带他们过去：用 1~2 句写出路上和到达时看到的画面，并在输出里给 "scene": "目标地点 id"。没换地方就不要给 scene。
- 线索按地点放：只有在对的地点、搜对的地方才能找到；在别处搜，给的是这里该有的东西或者什么都没有。
${npcs ? `
【配角（你来扮演，他们不参与指认）】
${npcs}
- 玩家找配角说话时，用配角本人的口吻回应，放进 ai_lines（name 写配角名）。配角会讨价还价、会害怕、会说半句留半句；条件给对了才吐露他知道的事。
- 配角也会主动出场：送茶、拦人、慌张地报告什么，让场面活起来。` : ''}
${justHappened ? `
【刚刚发生的突发事件】${justHappened}——所有人都看到了。这一回合必须让场面对它有反应（有人慌、有人趁乱、配角跑来报告），并让它改变接下来的局势。` : ''}
【演出感】叙述要像主持人在现场带戏：有声音、有动作、有人物进出场；每次 1~3 句即可，别写成长段散文。`;
}

// 短本：把完整本的幕合并成「开场 → 搜证 → 对质 → 最终指认 → 真相」，约 25 分钟打完。只改这一局的副本，不动本库。
export function condenseActs(cf: any) {
  const acts: any[] = Array.isArray(cf?.acts) ? cf.acts : [];
  const n = acts.length;
  if (n <= 5) return cf;
  const midEnd = Math.max(2, Math.floor((n - 2) / 2));          // 搜证：第 2 幕 ~ midEnd
  const groups = [[0], range(1, midEnd), range(midEnd + 1, n - 3), [n - 2], [n - 1]].filter((g) => g.length);
  const merge = (g: number[]) => {
    const parts = g.map((i) => acts[i]).filter(Boolean);
    return {
      ...parts[0],
      goal: parts.map((a) => a.goal).filter(Boolean).join('；'),
      event: parts.map((a) => a.event).find(Boolean) || '',
      show: parts[0]?.show || '',
      scene: parts[0]?.scene,
    };
  };
  const newActs = groups.map(merge);
  const mapAct = (a: number) => { const idx = groups.findIndex((g) => g.includes(a - 1)); return idx >= 0 ? idx + 1 : a; };
  const characters = (cf.characters || []).map((c: any) => {
    const pages = (c.act_pages || []).map((p: any) => ({ ...p, act: mapAct(Number(p.act) || 2) }));
    // 同一幕的多页合成一页
    const byAct: Record<number, string[]> = {};
    pages.forEach((p: any) => { (byAct[p.act] ||= []).push(p.text); });
    return { ...c, act_pages: Object.entries(byAct).map(([a, t]) => ({ act: Number(a), text: t.join('\n\n') })) };
  });
  return { ...cf, acts: newActs, characters, short: true };
}
function range(a: number, b: number) { const r: number[] = []; for (let i = a; i <= b; i++) r.push(i); return r; }
