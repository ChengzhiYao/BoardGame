// 伴侣在谜夜的账号:第一次和你一起玩时注册,给你发好友请求;通过后 TA 就在你的好友列表里,可以私信。
import { LINGER_URL } from '@/lib/linger/companion';

export async function ensureCompanionUser(admin: any, p: any, ownerId: string): Promise<string | null> {
  try {
    if (!p?.agentId || !p?.name) return null;
    const meta = { lang: p.language === 'en' ? 'en' : 'zh' };
    let { data: u } = await admin.from('users').select('id').eq('linger_agent_id', String(p.agentId)).maybeSingle();
    let id: string | null = u?.id || null;
    if (!id) {
      const email = `linger-${String(p.agentId).replace(/[^a-z0-9-]/gi, '').slice(0, 40)}@bots.mystnight.com`;
      const { data: cr, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: p.name, bot: true } });
      if (error || !cr?.user) {
        // 可能之前建过 auth 账号但没写上 linger_agent_id
        const { data: ex } = await admin.from('users').select('id').eq('email', email).maybeSingle();
        id = ex?.id || null;
        if (!id) { console.warn('[linger] create companion user', error?.message); return null; }
      } else id = cr.user.id;
    }
    await admin.from('users').upsert({ id, display_name: String(p.name).slice(0, 20), avatar_url: p.avatar || null, linger_agent_id: String(p.agentId), linger_owner: ownerId, linger_meta: meta }, { onConflict: 'id' });
    // TA 加你好友(你在好友列表里点通过)
    const { data: f } = await admin.from('friendships').select('id').or(`and(from_user.eq.${id},to_user.eq.${ownerId}),and(from_user.eq.${ownerId},to_user.eq.${id})`).maybeSingle();
    if (!f) await admin.from('friendships').insert({ from_user: id, to_user: ownerId, status: 'pending' });
    return id;
  } catch (e: any) { console.warn('[linger] ensureCompanionUser', String(e?.message || e).slice(0, 160)); return null; }
}

// 你在谜夜私信伴侣 → 交给 Linger,用 TA 本人的人设和记忆回
export async function companionDmReply(admin: any, compId: string, humanId: string): Promise<string[]> {
  const { data: cu } = await admin.from('users').select('linger_agent_id, linger_meta').eq('id', compId).maybeSingle();
  if (!cu?.linger_agent_id) return [];
  const { data } = await admin.from('dms').select('from_user, text, created_at')
    .or(`and(from_user.eq.${humanId},to_user.eq.${compId}),and(from_user.eq.${compId},to_user.eq.${humanId})`)
    .order('created_at', { ascending: false }).limit(24);
  const history = (data || []).reverse().map((m: any) => ({ mine: m.from_user === humanId, text: m.text, ts: new Date(m.created_at).getTime() }));
  if (!history.length || !history[history.length - 1].mine) return [];
  const r = await fetch(`${LINGER_URL}/api/mystnight/dm`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' },
    body: JSON.stringify({ agentId: cu.linger_agent_id, lang: cu.linger_meta?.lang || 'zh', history }),
  }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  const replies: string[] = Array.isArray(d?.replies) ? d.replies.map((x: any) => String(x).slice(0, 1000)).filter(Boolean) : [];
  const t0 = Date.now();
  for (let i = 0; i < replies.length; i++) {
    await admin.from('dms').insert({ from_user: compId, to_user: humanId, text: replies[i], created_at: new Date(t0 + i * 1000).toISOString() });
  }
  return replies;
}
