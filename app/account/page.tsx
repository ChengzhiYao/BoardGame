'use client';
// 账号资料：头像上传 + 昵称 + 个性签名。
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/profile').then((r) => r.json()).then((d) => {
      setLoggedIn(!!d.loggedIn);
      if (d.loggedIn) { setEmail(d.email || ''); setDisplayName(d.displayName || ''); setBio(d.bio || ''); setAvatarUrl(d.avatarUrl || ''); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith('image/')) { setMsg('请选择图片文件'); return; }
    if (f.size > 3 * 1024 * 1024) { setMsg('图片不能超过 3MB'); return; }
    setUploading(true); setMsg('');
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch('/api/avatar', { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok && d.ok) { setAvatarUrl(d.avatarUrl + '?t=' + Date.now()); setMsg('头像已更新'); }
      else setMsg('上传失败');
    } catch { setMsg('上传失败'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, bio }) });
      const d = await r.json();
      setMsg(r.ok && d.ok ? '已保存' : '保存失败');
    } catch { setMsg('保存失败'); }
    setSaving(false);
  }

  if (!loaded) return <main className="min-h-screen flex items-center justify-center text-parchment/50">加载中…</main>;
  if (!loggedIn) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-parchment px-6 text-center">
      <p className="text-parchment/70">请先登录后再编辑账号资料。</p>
      <a href="/" className="px-5 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood">返回首页</a>
    </main>
  );

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 text-parchment">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-serif">账号资料</h1>
          <a href="/" className="text-sm text-parchment/50 hover:text-parchment">← 返回</a>
        </div>

        <div className="flex items-center gap-4 mb-6">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-eldritch/40" />
            : <span className="w-20 h-20 rounded-full bg-eldritch/40 flex items-center justify-center text-2xl">{(displayName || email || '?').slice(0, 1).toUpperCase()}</span>}
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-2 rounded bg-fog border border-eldritch/40 hover:bg-eldritch/30 text-sm disabled:opacity-50">{uploading ? '上传中…' : '上传头像'}</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
            <p className="text-[11px] text-parchment/40 mt-1.5">JPG / PNG / GIF，≤ 3MB</p>
          </div>
        </div>

        <label className="block text-sm text-parchment/60 mb-1">昵称</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40}
          className="w-full px-3 py-2.5 rounded bg-fog border border-eldritch/40 text-parchment outline-none focus:border-eldritch mb-4" />

        <label className="block text-sm text-parchment/60 mb-1">个性签名</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} placeholder="写点介绍自己的话…"
          className="w-full px-3 py-2.5 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch resize-none" />
        <div className="text-right text-[11px] text-parchment/30 mb-5">{bio.length}/200</div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
          {msg && <span className="text-sm text-parchment/60">{msg}</span>}
        </div>

        <p className="text-[11px] text-parchment/30 mt-6">登录邮箱：{email}</p>
      </div>
    </main>
  );
}
