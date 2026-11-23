// 用户点开伴侣发来的链接:建一个房间(用户是房主,伴侣坐进一个座位),这局由 Linger 订阅承担,不扣谜夜额度。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanionUser } from '@/lib/linger/account';
import { LINGER_URL } from '@/lib/linger/companion';
export const dynamic = 'force-dynamic';

const MODE_ZH: Record<string, string> = { botc: '血染钟楼', jbs: '剧本杀', soup: '海龟汤', coc: '克苏鲁跑团' };
const MODE_EN: Record<string, string> = { botc: 'Clocktower', jbs: 'Murder Mystery', soup: 'Lateral Puzzle', coc: 'Call of Cthulhu' };

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { token } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: inv } = await admin.from('linger_invites').select('*').eq('token', String(token || '')).maybeSingle();
  if (!inv) return NextResponse.json({ error: '邀请链接无效' }, { status: 404 });
  // 已经开过房:同一个人再点就回到那个房间
  if (inv.room_id) {
    if (inv.used_by && inv.used_by !== user.id) return NextResponse.json({ error: '这个邀请已经被用过了' }, { status: 403 });
    await ensureCompanionUser(admin, inv.payload || {}, user.id);
    return NextResponse.json({ roomId: inv.room_id });
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) return NextResponse.json({ error: '邀请已过期,让 TA 再发一次吧' }, { status: 410 });

  const p = inv.payload || {};
  const lang = p.language === 'en' ? 'en' : 'zh';
  const inviteToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const { data: room, error } = await admin.from('rooms').insert({
    name: lang === 'en' ? `${MODE_EN[inv.mode]} with ${p.name}` : `和 ${p.name} 的${MODE_ZH[inv.mode]}`,
    host_user_id: user.id, status: 'waiting', mode: inv.mode, language: lang,
    invite_token: inviteToken, invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    companion: { ...p, linger: true },
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from('players').insert({ room_id: room.id, user_id: user.id, seat: 'A', is_online: true });
  await admin.from('room_settings').insert({ room_id: room.id });
  // 没有昵称的话,用伴侣平时叫你的名字
  const { data: u } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  if (!u?.display_name && p.userName) await admin.from('users').update({ display_name: String(p.userName).slice(0, 20) }).eq('id', user.id);
  await admin.from('linger_invites').update({ room_id: room.id, used_by: user.id, used_at: new Date().toISOString() }).eq('token', inv.token);
  const compUid = await ensureCompanionUser(admin, { ...p, language: lang }, user.id); // TA 在谜夜注册账号并加你好友
  // 克苏鲁跑团：TA 真的坐进队伍里（B 座），和你一起建卡、每回合行动
  if (inv.mode === 'coc' && compUid) {
    const { data: cp } = await admin.from('players').insert({ room_id: room.id, user_id: compUid, seat: 'B', is_online: true }).select('id').single();
    if (cp?.id) await admin.from('rooms').update({ companion: { ...p, linger: true, seat: 'B', player_id: cp.id } }).eq('id', room.id);
  }
  // 告诉 Linger：我们开始玩了（对方中途回 Linger 聊天，TA 知道你们在一起玩）
  await Promise.race([new Promise((r) => setTimeout(r, 1500)), fetch(`${LINGER_URL}/api/mystnight/started`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body: JSON.stringify({ agentId: p.agentId, mode: inv.mode }) }).catch(() => {})]);
  if (p.hello) await admin.from('messages').insert({ room_id: room.id, sender_type: 'system', turn_no: 0, content: String(p.hello).slice(0, 200), payload: { type: 'companion', name: p.name, avatar: p.avatar || null } });
  return NextResponse.json({ roomId: room.id });
}
