'use client';
// 账号资料 / Account profile：头像上传 + 昵称 + 个性签名。
import { useEffect, useRef, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

export default function AccountPage() {
  const [en, setEn] = useState(false);
  const L = (zh: string, e: string) => (en ? e : zh);
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

  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} }, []);
  useEffect(() => {
    fetch('/api/profile').then((r) => r.json()).then((d) => {
      setLoggedIn(!!d.loggedIn);
      if (d.loggedIn) { setEmail(d.email || ''); setDisplayName(d.displayName || ''); setBio(d.bio || ''); setAvatarUrl(d.avatarUrl || ''); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  function resizeImage(file: File, max: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d'); if (!ctx) return reject(new Error('no ctx'));
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('img'));
      img.src = URL.createObjectURL(file);
    });
  }
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith('image/')) { setMsg(L('请选择图片文件', 'Please choose an image')); return; }
    setUploading(true); setMsg('');
    try {
      let upload: File;
      if (f.type === 'image/gif') {
        if (f.size > 3 * 1024 * 1024) { setMsg(L('GIF 不能超过 3MB', 'GIF must be under 3MB')); setUploading(false); return; }
        upload = f;
      } else {
        const blob = await resizeImage(f, 512);
        upload = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      }
      const fd = new FormData(); fd.append('file', upload);
      const r = await fetch('/api/avatar', { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok && d.ok) { setAvatarUrl(d.avatarUrl + '?t=' + Date.now()); setMsg(L('头像已更新', 'Avatar updated')); }
      else setMsg(d.reason === 'upload' ? L('上传失败（请先在 Supabase 跑 SQL 建 avatars 桶）', 'Upload failed (create the avatars bucket via SQL first)') : L('上传失败', 'Upload failed'));
    } catch { setMsg(L('处理图片失败', 'Could not process image')); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, bio }) });
      const d = await r.json();
      setMsg(r.ok && d.ok ? L('已保存', 'Saved') : L('保存失败', 'Save failed'));
    } catch { setMsg(L('保存失败', 'Save failed')); }
    setSaving(false);
  }

  if (!loaded) return <main className="min-h-screen flex items-center justify-center text-parchment/50">{L('加载中…', 'Loading…')}</main>;
  if (!loggedIn) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-parchment px-6 text-center">
      <p className="text-parchment/70">{L('请先登录后再编辑账号资料。', 'Please sign in to edit your profile.')}</p>
      <a href="/" className="px-5 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood">{L('返回首页', 'Back to home')}</a>
    </main>
  );

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 text-parchment">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-serif">{L('账号资料', 'Account')}</h1>
          <a href="/" className="text-sm text-parchment/50 hover:text-parchment">{L('← 返回', '← Back')}</a>
        </div>

        <div className="flex items-center gap-4 mb-6">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-eldritch/40" />
            : <span className="w-20 h-20 rounded-full bg-eldritch/40 flex items-center justify-center text-2xl">{(displayName || email || '?').slice(0, 1).toUpperCase()}</span>}
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-2 rounded bg-fog border border-eldritch/40 hover:bg-eldritch/30 text-sm disabled:opacity-50">{uploading ? L('上传中…', 'Uploading…') : L('上传头像', 'Upload avatar')}</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
            <p className="text-[11px] text-parchment/40 mt-1.5">JPG / PNG / GIF, ≤ 3MB</p>
          </div>
        </div>

        <label className="block text-sm text-parchment/60 mb-1">{L('昵称', 'Display name')}</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40}
          className="w-full px-3 py-2.5 rounded bg-fog border border-eldritch/40 text-parchment outline-none focus:border-eldritch mb-4" />

        <label className="block text-sm text-parchment/60 mb-1">{L('个性签名', 'Bio')}</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} placeholder={L('写点介绍自己的话…', 'Say something about yourself…')}
          className="w-full px-3 py-2.5 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch resize-none" />
        <div className="text-right text-[11px] text-parchment/30 mb-5">{bio.length}/200</div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood disabled:opacity-50">{saving ? L('保存中…', 'Saving…') : L('保存', 'Save')}</button>
          {msg && <span className="text-sm text-parchment/60">{msg}</span>}
        </div>

        <p className="text-[11px] text-parchment/30 mt-6">{L('登录邮箱：', 'Email: ')}{email}</p>
      </div>
    </main>
  );
}
