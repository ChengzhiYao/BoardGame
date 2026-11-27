// 一次性:把 Supabase Storage 里的老文件按顺序搬到 Cloudflare R2(路径不变:<bucket>/<path>)。
// 调用要带 r2_migrate 表里那一行的 token(只有能直接改数据库的人知道)。每次搬一批,返回下一批的游标。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { r2, r2On } from '@/lib/store';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const fetchCache = 'force-no-store'; // 不然读进度那一下会被 Next 缓存,每次都从头搬

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams; const admin = createAdminClient();
  const { data: st } = await admin.from('r2_migrate').select('*').eq('id', 1).maybeSingle();
  if (!st?.token || sp.get('t') !== st.token) return NextResponse.json({ ok: false }, { status: 403 });
  if (!r2On()) return NextResponse.json({ ok: false, reason: 'r2_env_missing' });
  const n = Math.min(60, Number(sp.get('n')) || 30);
  const { data: objs, error } = await admin.rpc('r2_objects', { after_key: st.cursor || '', n });
  if (error) return NextResponse.json({ ok: false, reason: error.message });
  if (!objs?.length) return NextResponse.json({ ok: true, finished: true, done: st.done, failed: st.failed });
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
  let ok = 0, bad = 0; const errs: string[] = [];
  await Promise.all(objs.map(async (o: any) => {
    try {
      const enc = String(o.name).split('/').map(encodeURIComponent).join('/');
      const r = await fetch(`${base}/${o.bucket}/${enc}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`get ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      const p = await r2('PUT', o.k, buf, o.mime || r.headers.get('content-type') || 'application/octet-stream');
      if (!p.ok) throw new Error(`put ${p.status}`);
      ok++;
    } catch (e: any) { bad++; if (errs.length < 5) errs.push(`${o.k}: ${String(e?.message || e).replace(/Credential=\S+/g, 'Credential=…').slice(0, 80)}`); }
  }));
  const last = objs[objs.length - 1].k;
  await admin.from('r2_migrate').update({ cursor: last, done: (st.done || 0) + ok, failed: (st.failed || 0) + bad, updated_at: new Date().toISOString() }).eq('id', 1);
  return NextResponse.json({ ok: true, finished: false, batch: objs.length, moved: ok, failed: bad, errs, cursor: last, done: (st.done || 0) + ok });
}
