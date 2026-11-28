// 推广链接(跟 Linger 同一套):任何人都能生成自己的链接(mystnight.com/?ref=代码),别人通过它注册、之后付款,推广人拿分成。
// - 点链接:记一次点击,浏览器记 30 天(第一次点的那个推广人算数)
// - 30 天内注册的新用户 → 记到这个推广人名下(自己推荐自己不算)
// - 这个用户前 N 个月(默认 3)的每一笔付款(会员月费/年费、会员卡、派对包、单局、畅玩卡、定制剧本)→ 按比例(默认 40%)记一笔分成,状态"待付"
// - 退款的那笔分成自动作废;站长每月看待付金额,手动打款(PayPal 等)后标"已付"。没有最低打款门槛。
export const REF_COOKIE = 'mn_ref';
export const MIN_PAYOUT_USD = 0;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';

export function newCode(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 7; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
export const cleanCode = (c: any) => String(c || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);

// 用户登录后:如果浏览器里有推广代码,把这个新用户记到推广人名下
export async function claimReferral(admin: any, user: any, code: string) {
  code = cleanCode(code); if (!code || !user?.id) return;
  try {
    const created = new Date(user.created_at || 0).getTime();
    if (Date.now() - created > 30 * 86400000) return; // 老用户不算
    const { data: p } = await admin.from('ref_partners').select('code, user_id').eq('code', code).maybeSingle();
    if (!p || p.user_id === user.id) return;
    await admin.from('ref_signups').insert({ user_id: user.id, code });
  } catch {}
}

// 一笔付款成功:被推荐用户在窗口期内的付款记分成。key = Stripe 的 checkout session / invoice id(同一笔只记一次)
export async function recordCommission(admin: any, o: { key: string; userId: string | null; amount: number; currency?: string; paymentIntent?: string | null; invoice?: string | null; what?: string }) {
  try {
    const amount = Math.round(Number(o.amount || 0));
    if (!o.userId || !amount || !o.key) return;
    const { data: s } = await admin.from('ref_signups').select('code, created_at').eq('user_id', o.userId).maybeSingle();
    if (!s) return;
    const { data: p } = await admin.from('ref_partners').select('*').eq('code', s.code).maybeSingle();
    if (!p) return;
    const windowEnd = new Date(s.created_at).getTime() + (Number(p.months) || 3) * 31 * 86400000;
    if (Date.now() > windowEnd) return;
    const rate = Number(p.rate) || 0.4;
    const commission = Math.round(amount * rate);
    const { error } = await admin.from('ref_commissions').insert({ invoice_id: o.key, code: p.code, referred_user_id: o.userId, amount_cents: amount, commission_cents: commission, currency: (o.currency || 'usd').toLowerCase(), payment_intent: o.paymentIntent || null, stripe_invoice: o.invoice || null, what: o.what || null });
    if (error) return; // 同一笔已经记过
    try {
      const { sendMail } = await import('@/lib/mail');
      const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
      if (p.email) await sendMail({ to: p.email, subject: `你推薦的玩家付款了,你獲得 ${$(commission)} 分潤 · MystNight`, html: `<div style="font-family:-apple-system,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1f2937">你推薦的玩家剛剛在謎夜 MystNight 付款了。<br/>你獲得 <b>${$(commission)}</b>(${$(amount)} 的 ${Math.round(rate * 100)}%)。<br/><br/>查看收入:<a href="${SITE}/partner">${SITE.replace(/^https?:\/\//, '')}/partner</a><br/><br/><span style="color:#6b7280">Someone you referred just paid on MystNight. You earned ${$(commission)} (${Math.round(rate * 100)}% of ${$(amount)}).</span></div>`, text: `你獲得 ${$(commission)} 分潤 / You earned ${$(commission)} from a MystNight referral. ${SITE}/partner` });
    } catch {}
  } catch (e) { console.error('[ref commission]', e); }
}

// 退款:对应的分成作废
export async function reverseCommission(admin: any, paymentIntent?: string | null, invoice?: string | null) {
  try {
    if (paymentIntent) await admin.from('ref_commissions').update({ status: 'reversed' }).eq('payment_intent', paymentIntent).neq('status', 'paid');
    if (invoice) await admin.from('ref_commissions').update({ status: 'reversed' }).eq('stripe_invoice', invoice).neq('status', 'paid');
  } catch {}
}

export async function partnerStats(admin: any, code: string) {
  const [{ count: signups }, { data: comm }] = await Promise.all([
    admin.from('ref_signups').select('user_id', { count: 'exact', head: true }).eq('code', code),
    admin.from('ref_commissions').select('referred_user_id, commission_cents, status, amount_cents, created_at, what').eq('code', code).order('created_at', { ascending: false }),
  ]);
  const rows = comm || [];
  const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((a: number, r: any) => a + r.commission_cents, 0);
  return {
    signups: signups || 0, paying: new Set(rows.map((r: any) => r.referred_user_id)).size,
    earned: sum((r) => r.status !== 'reversed'), pending: sum((r) => r.status === 'pending'), paid: sum((r) => r.status === 'paid'),
    recent: rows.slice(0, 20).map((r: any) => ({ at: r.created_at, amount: r.amount_cents, commission: r.commission_cents, status: r.status, what: r.what })),
  };
}
