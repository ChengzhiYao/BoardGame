// 发邮件：先用 Resend；它发不出去（比如当天免费额度用完、临时出错）就自动换 Brevo，再不行换 Mailgun。
// 哪个服务没配 key 就跳过。各家免费额度：Resend 每天 100 封、Brevo 每天 300 封、Mailgun 每天 100 封。
// 写法跟 Resend 的接口一样（from / to / subject / html / text / reply_to / headers / bcc），老代码只要把 fetch 换成 mailFetch。
type Mail = { from?: string; to: string | string[]; subject: string; html?: string; text?: string; reply_to?: string | string[]; replyTo?: string | string[]; headers?: Record<string, string>; bcc?: string | string[]; cc?: string | string[] };
const arr = (v: any): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
const addr = (s: string) => { const m = String(s).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/); return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(s).trim() }; };

async function viaResend(m: Mail, from: string) {
  const key = process.env.RESEND_API_KEY; if (!key) return null;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: arr(m.to), subject: m.subject, html: m.html, text: m.text, reply_to: arr(m.reply_to || m.replyTo).length ? arr(m.reply_to || m.replyTo) : undefined, headers: m.headers, bcc: arr(m.bcc).length ? arr(m.bcc) : undefined, cc: arr(m.cc).length ? arr(m.cc) : undefined }) });
  return { ok: r.ok, status: r.status, detail: r.ok ? '' : (await r.text().catch(() => '')).slice(0, 300) };
}
async function viaBrevo(m: Mail, from: string) {
  const key = process.env.BREVO_API_KEY; if (!key) return null;
  const rt = arr(m.reply_to || m.replyTo)[0];
  const body: any = { sender: addr(from), to: arr(m.to).map((e) => addr(e)), subject: m.subject, htmlContent: m.html || undefined, textContent: m.text || (m.html ? undefined : ' ') };
  if (arr(m.bcc).length) body.bcc = arr(m.bcc).map((e) => addr(e));
  if (arr(m.cc).length) body.cc = arr(m.cc).map((e) => addr(e));
  if (rt) body.replyTo = addr(rt);
  if (m.headers) body.headers = m.headers;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, detail: r.ok ? '' : (await r.text().catch(() => '')).slice(0, 300) };
}
async function viaMailgun(m: Mail, from: string) {
  const key = process.env.MAILGUN_API_KEY, domain = process.env.MAILGUN_DOMAIN; if (!key || !domain) return null;
  const f = new URLSearchParams();
  f.append('from', from); arr(m.to).forEach((e) => f.append('to', e)); arr(m.bcc).forEach((e) => f.append('bcc', e)); arr(m.cc).forEach((e) => f.append('cc', e));
  f.append('subject', m.subject); if (m.html) f.append('html', m.html); if (m.text) f.append('text', m.text);
  const rt = arr(m.reply_to || m.replyTo)[0]; if (rt) f.append('h:Reply-To', rt);
  Object.entries(m.headers || {}).forEach(([k, v]) => f.append('h:' + k, v));
  const base = process.env.MAILGUN_BASE || 'https://api.mailgun.net';
  const r = await fetch(`${base}/v3/${domain}/messages`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from('api:' + key).toString('base64') }, body: f });
  return { ok: r.ok, status: r.status, detail: r.ok ? '' : (await r.text().catch(() => '')).slice(0, 300) };
}

export async function sendMail(m: Mail, defaultFrom = process.env.EMAIL_FROM || ''): Promise<{ ok: boolean; provider?: string; status?: number; detail?: string }> {
  const from = m.from || defaultFrom;
  let last: any = { ok: false, detail: 'no email provider configured' };
  for (const [name, fn] of [['resend', viaResend], ['brevo', viaBrevo], ['mailgun', viaMailgun]] as const) {
    try {
      const r = await fn(m, from); if (!r) continue;
      if (r.ok) return { ok: true, provider: name, status: r.status };
      last = { ok: false, provider: name, status: r.status, detail: r.detail };
      console.error('[mail]', name, r.status, r.detail);
    } catch (e: any) { last = { ok: false, provider: name, detail: String(e?.message || e) }; console.error('[mail]', name, e); }
  }
  return last;
}

// 老代码里 fetch('https://api.resend.com/emails', {...}) 的直接替身：收同样的参数，返回一个 Response
export async function mailFetch(_url: string, init: { body?: any }): Promise<Response> {
  let m: Mail; try { m = JSON.parse(String(init?.body || '{}')); } catch { return new Response('bad body', { status: 400 }); }
  const r = await sendMail(m);
  return new Response(JSON.stringify(r.ok ? { id: r.provider } : { error: r.detail || 'send failed' }), { status: r.ok ? 200 : (r.status && r.status >= 400 ? r.status : 502), headers: { 'Content-Type': 'application/json' } });
}
