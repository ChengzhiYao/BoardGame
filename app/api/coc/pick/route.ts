// 克苏鲁快速开局：选一个现成调查员 → 自动掷属性、按他擅长的方向分技能、发随身资源 → 准备好；人齐了就开场。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { rollAttributes, derive } from '@/lib/coc/create';
import { SKILLS, baseFor, skillPointPool, SKILL_CAP } from '@/lib/coc/skills';
import { maybeStartPlaying } from '@/lib/coc/start';

// 擅长技能 → 相关属性（让人物数值和人设对得上）
const ATTR_OF: Record<string, keyof ReturnType<typeof rollAttributes>> = {
  斗殴: 'str', 攀爬: 'str', 手枪: 'dex', 闪避: 'dex', 潜行: 'dex', 锁匠: 'dex', 驾驶汽车: 'dex',
  图书馆使用: 'edu', 历史: 'edu', 考古学: 'edu', 医学: 'edu', 会计: 'edu', 神秘学: 'edu',
  说服: 'app', 话术: 'app', 乔装: 'app', 心理学: 'int_attr', 侦查: 'int_attr', 聆听: 'int_attr', 恐吓: 'pow',
};

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, idx } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('campaign_id, language').eq('id', roomId).maybeSingle();
  const { data: camp } = await admin.from('campaigns').select('setting').eq('id', room?.campaign_id).maybeSingle();
  const cast: any[] = camp?.setting?.cast || [];
  const c = cast[Number(idx)];
  if (!c) return NextResponse.json({ error: '没有这个角色' }, { status: 400 });
  const { data: others } = await admin.from('characters').select('player_id, name').eq('room_id', roomId);
  if ((others || []).some((o: any) => o.name === c.name && o.player_id !== me.id)) return NextResponse.json({ error: '这个人物已经被队友选了', taken: true }, { status: 409 });

  const en = room?.language === 'en';
  const row = makeRow(c, roomId, me.id, en);
  const { data: ex } = await admin.from('characters').select('id').eq('player_id', me.id).maybeSingle();
  const res = ex ? await admin.from('characters').update(row).eq('id', ex.id) : await admin.from('characters').insert(row);
  if (res.error) return NextResponse.json({ error: '保存失败：' + res.error.message }, { status: 500 });
  await admin.from('players').update({ is_ready: true }).eq('id', me.id);
  // 和 Linger 伴侣一起玩：TA 也挑一个剩下的人物（按 TA 的性格挑最像自己的那个）
  try {
    const { data: rm } = await admin.from('rooms').select('companion').eq('id', roomId).maybeSingle();
    const comp: any = rm?.companion;
    if (comp?.player_id) {
      const { data: has } = await admin.from('characters').select('id').eq('player_id', comp.player_id).maybeSingle();
      if (!has) {
        const { data: taken } = await admin.from('characters').select('name').eq('room_id', roomId);
        const free = cast.map((x: any, i: number) => ({ x, i })).filter(({ x }) => !(taken || []).some((t: any) => t.name === x.name));
        const want = String(comp.persona || '') + ' ' + String(comp.mbti || '');
        const pickOne = free.sort((p, q) => score(q.x, want) - score(p.x, want))[0];
        if (pickOne) {
          await admin.from('characters').insert(makeRow(pickOne.x, roomId, comp.player_id, en));
          await admin.from('players').update({ is_ready: true }).eq('id', comp.player_id);
          await admin.from('rooms').update({ companion: { ...comp, role: pickOne.x.name } }).eq('id', roomId);
          await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: comp.player_id, action_type: 'chat', turn_no: 0, content: en ? `I'll be ${pickOne.x.name}.` : `那我当${pickOne.x.name}吧。` });
        }
      }
    }
  } catch {}
  await maybeStartPlaying(admin, roomId);
  return NextResponse.json({ ok: true });
}
// 按一张现成人物卡生成完整调查员（掷属性、分技能、发资源）
function makeRow(c: any, roomId: string, playerId: string, en: boolean) {
  // 属性：掷骰，再把擅长方向抬一点
  const a = rollAttributes();
  const want = new Set<string>([c.signature, ...(c.skills || [])].map((n: string) => ATTR_OF[n]).filter(Boolean) as string[]);
  want.forEach((k) => { (a as any)[k] = Math.max((a as any)[k], 60 + Math.floor(Math.random() * 3) * 5); });
  const d = derive(a);

  // 技能：点数先给拿手技能，再给擅长的几项，剩下的给侦查/聆听/闪避这类通用的
  let pool = skillPointPool(a);
  const alloc: Record<string, number> = {};
  const give = (name: string, cap: number) => {
    const def = SKILLS.find((s) => s.name === name); if (!def || pool <= 0) return;
    const base = baseFor(def, a); const room_ = Math.max(0, Math.min(cap, SKILL_CAP) - base - (alloc[name] || 0));
    const g = Math.min(room_, pool); alloc[name] = (alloc[name] || 0) + g; pool -= g;
  };
  if (c.signature) give(c.signature, 75);
  for (const n of (c.skills || []).slice(0, 5)) give(n, 60);
  for (const n of ['侦查', '聆听', '闪避', '心理学', '图书馆使用', '急救']) give(n, 50);
  const skills: any = {};
  for (const def of SKILLS) { const base = baseFor(def, a); const add = alloc[def.name] || 0; skills[def.name] = { base, occupation: add, interest: 0, total: base + add }; }

  const inv: string[] = Array.isArray(c.inventory) ? c.inventory.slice(0, 3) : [];
  const K = en ? { ammo: 'Ammo', light: 'Light', lamp: 'Lamp oil' } : { ammo: '弹药', light: '手电电量', lamp: '灯油' };
  const resources: any = {};
  if (inv.some((i) => /手枪|左轮|pistol|revolver/i.test(i))) resources[K.ammo] = 6;
  else if (inv.some((i) => /猎枪|霰弹|步枪|shotgun|rifle/i.test(i))) resources[K.ammo] = 4;
  if (inv.some((i) => /手电|flashlight|torch/i.test(i))) resources[K.light] = 5;
  if (inv.some((i) => /油灯|煤油|提灯|lamp|lantern/i.test(i))) resources[K.lamp] = 4;

  const row: any = {
    room_id: roomId, player_id: playerId,
    name: c.name, gender: c.gender === 'female' ? 'female' : 'male', age: Number(c.age) || 30, occupation: c.occupation || '', appearance: c.appearance || '',
    personality: c.personality || '', background: c.background || c.tagline || '', personal_goal: c.personal_goal || '', fear: c.fear || c.weakness || '',
    inventory: inv, ...a, ...d, skills, resources, creation_stage: 4, is_complete: true, confirmed: true,
    ...(c.avatar ? { avatar_url: c.avatar } : {}),
  };
  return row;
}

// 粗略匹配：人物卡的性格/职业和伴侣人设重合的字越多越像
function score(c: any, want: string) {
  const t = `${c.personality || ''}${c.occupation || ''}${c.tagline || ''}`;
  let n = 0; for (const ch of new Set(t.split(''))) if (ch.trim() && want.includes(ch)) n++;
  return n + Math.random() * 2;
}
