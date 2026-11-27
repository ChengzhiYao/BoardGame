// Supabase: MystNight runs on its own project (jyvnlqlonyueuxsybnzq, org MystNight) since 2026-11-27.
// 文件存储:配了 Cloudflare R2(R2_* 环境变量)就存 R2(下载流量免费),否则还用 Supabase Storage。
// 用法跟 supabase 的 storage 一样:store(admin).from('scene-images').upload / getPublicUrl / list(只支持按文件名精确查)。
// R2 里的路径 = <原 bucket>/<原路径>,公开地址 = R2_PUBLIC_URL/<原 bucket>/<原路径>。
import { createHash, createHmac } from 'crypto';

// 粘贴进 Vercel 的值可能带换行/空格:只取第一段
const tok = (v?: string) => String(v || '').trim().split(/\s+/)[0] || '';
const env = () => ({ acct: tok(process.env.R2_ACCOUNT_ID), key: tok(process.env.R2_ACCESS_KEY_ID), secret: tok(process.env.R2_SECRET_ACCESS_KEY), bucket: tok(process.env.R2_BUCKET), pub: tok(process.env.R2_PUBLIC_URL).replace(/\/+$/, '') });
export const r2On = () => { const e = env(); return !!(e.acct && e.key && e.secret && e.bucket && e.pub); };

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const hmac = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s).digest();
const enc = (p: string) => p.split('/').map((x) => encodeURIComponent(x)).join('/');

// 最小的 S3 SigV4 签名(R2 兼容 S3 接口)
export async function r2(method: 'PUT' | 'HEAD' | 'GET' | 'DELETE', key: string, body?: Buffer, contentType?: string): Promise<Response> {
  const e = env(); const host = `${e.acct}.r2.cloudflarestorage.com`; const path = `/${e.bucket}/${enc(key)}`;
  const now = new Date(); const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const day = amz.slice(0, 8);
  const ph = sha(body || '');
  const h: Record<string, string> = { host, 'x-amz-content-sha256': ph, 'x-amz-date': amz };
  if (contentType) h['content-type'] = contentType;
  const names = Object.keys(h).sort(); const signed = names.join(';');
  const creq = [method, path, '', names.map((n) => `${n}:${h[n]}\n`).join(''), signed, ph].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', amz, scope, sha(creq)].join('\n');
  const k = hmac(hmac(hmac(hmac('AWS4' + e.secret, day), 'auto'), 's3'), 'aws4_request');
  const sig = createHmac('sha256', k).update(sts).digest('hex');
  const headers: Record<string, string> = { ...h, Authorization: `AWS4-HMAC-SHA256 Credential=${e.key}/${scope}, SignedHeaders=${signed}, Signature=${sig}` }; delete headers.host;
  return fetch(`https://${host}${path}`, { method, headers, body: body ? new Uint8Array(body) : undefined, cache: 'no-store' });
}

type Up = { data: { path: string } | null; error: { message: string } | null };
export function store(admin: any): { from: (bucket: string) => any } {
  return {
    from(bucket: string): any {
      if (!r2On()) return store(admin).from(bucket);
      const k = (p: string) => `${bucket}/${p.replace(/^\/+/, '')}`;
      return {
        async upload(path: string, body: Buffer | Uint8Array | ArrayBuffer, opts: { contentType?: string } = {}): Promise<Up> {
          try { const buf = Buffer.isBuffer(body) ? body : Buffer.from(body as any); const r = await r2('PUT', k(path), buf, opts.contentType || 'application/octet-stream'); return r.ok ? { data: { path }, error: null } : { data: null, error: { message: `r2 ${r.status}` } }; }
          catch (e: any) { return { data: null, error: { message: String(e?.message || e) } }; }
        },
        getPublicUrl(path: string) { return { data: { publicUrl: `${env().pub}/${enc(k(path))}` } }; },
        // 只用来查「这个文件在不在」:list(目录, { search: 文件名 })
        async list(dir: string, o: { search?: string } = {}) {
          if (!o.search) return { data: [], error: null };
          try { const r = await r2('HEAD', k(`${dir}/${o.search}`)); return { data: r.ok ? [{ name: o.search }] : [], error: null }; } catch { return { data: [], error: null }; }
        },
      };
    },
  };
}
