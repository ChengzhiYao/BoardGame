// 克苏鲁快速开局：AI 按这个故事配 3 个现成调查员（不剧透），玩家点一个就入戏。
// 题库里的故事：配好的人物跟着故事存起来，下一桌直接复用，不再花钱生成。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { langDirective } from '@/lib/i18n';
import { SKILLS } from '@/lib/coc/skills';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('campaign_id, language').eq('id', roomId).maybeSingle();
  if (!room?.campaign_id) return NextResponse.json({ error: '故事还没定好' }, { status: 409 });
  const { data: camp } = await admin.from('campaigns').select('id, title, premise, tone, setting').eq('id', room.campaign_id).maybeSingle();
  const setting = camp?.setting || {};
  if (Array.isArray(setting.cast) && setting.cast.length) return NextResponse.json({ cast: setting.cast });

  let cast: any[] | null = null;
  if (setting.lib_id) {
    const { data: lib } = await admin.from('module_library').select('cast_list').eq('id', setting.lib_id).maybeSingle();
    if (Array.isArray(lib?.cast_list) && lib!.cast_list.length) cast = lib!.cast_list;
  }
  if (!cast) {
    const en = room.language === 'en';
    const skillNames = SKILLS.map((s) => s.name).join('、');
    const { data } = await callLLMJson<any>({
      system: `你在为一场克苏鲁式恐怖调查准备 3 个现成的调查员角色卡，让玩家点一个就能直接开玩。
故事：《${camp?.title || ''}》 ${camp?.premise || ''}（时代：${setting.era || ''}；地点：${setting.place || ''}；基调：${camp?.tone || ''}）
要求：
- 3 个人物彼此差别大（职业、性格、擅长的方向不同），都和这个故事有自然的理由卷进来，但**绝不剧透真相**。
- 每个人要有让人想扮演的钩子：一句话来历（tagline，≤22 字，有画面感）、一个弱点（weakness，≤16 字）。
- signature 是他最拿手的一项技能，skills 是他擅长的 4~5 项技能，全部必须从这个列表里选原名：${skillNames}
- inventory 2~3 件随身物品（具体、符合时代）。
只输出 JSON：{ "cast": [ { "name": "", "gender": "male|female", "age": 30, "occupation": "", "tagline": "", "weakness": "", "personality": "", "background": "", "personal_goal": "", "fear": "", "appearance": "", "signature": "", "skills": [""], "inventory": [""] } ] }` + (en ? '\n' + langDirective('en') + '\nKeep skill names exactly as listed (Chinese), everything else in English.' : ''),
      messages: [{ role: 'user', content: en ? 'Create the 3 investigators.' : '请给出 3 个调查员。' }],
      tier: 'aux', temperature: 0.9, maxTokens: 1600,
    });
    cast = (Array.isArray(data?.cast) ? data.cast : []).slice(0, 3);
    if (!cast.length) return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 });
    if (setting.lib_id) await admin.from('module_library').update({ cast_list: cast }).eq('id', setting.lib_id);
  }
  await admin.from('campaigns').update({ setting: { ...setting, cast } }).eq('id', camp!.id);
  return NextResponse.json({ cast });
}
