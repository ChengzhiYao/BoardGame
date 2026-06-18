// 创建房间：建 room（发邀请 token）+ 把创建者放进 A 座 + 建 room_settings。
// 这些写操作走服务端 admin 客户端（绕过 RLS），保证只有合法流程能写。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

function genToken() {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
  );
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();

  // 开房闸门：白名单或有局数额度才能开房（访客加入不经过这里）
  const ent = await getEntitlement(admin, user);
  if (!ent.canHost) {
    return NextResponse.json(
      { error: ent.reason === 'login' ? '开房需要先用 Google 登录' : '局数已用完，请购买后再开房', reason: ent.reason },
      { status: 402 }
    );
  }

  const token = genToken();

  const { data: room, error } = await admin
    .from('rooms')
    .insert({
      name: body.name?.trim() || '未命名调查',
      host_user_id: user.id,
      status: 'waiting',
      mode: ['soup', 'td', 'jbs'].includes(body.mode) ? body.mode : 'coc',
      language: ['zh', 'en'].includes(body.language) ? body.language : 'zh',
      invite_token: token,
      invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from('players')
    .insert({ room_id: room.id, user_id: user.id, seat: 'A', is_online: true });
  await admin.from('room_settings').insert({ room_id: room.id });
  if (body.displayName) {
    await admin.from('users').update({ display_name: body.displayName }).eq('id', user.id);
  }

  // 非白名单：开房成功扣 1 局
  if (!ent.whitelisted) {
    await admin.from('profiles').update({ credits: Math.max(0, (ent.credits || 0) - 1) }).eq('user_id', user.id);
  }

  return NextResponse.json({ roomId: room.id, inviteToken: token });
}
