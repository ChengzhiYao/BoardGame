'use client';
// Linger 伴侣发来的邀请:自动登录(没账号就匿名),建好房间,直接进去和 TA 一起玩。
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ensureSession } from '@/lib/auth';

export default function WithCompanion() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState('正在进入房间…');
  useEffect(() => {
    (async () => {
      try {
        await ensureSession();
        const res = await fetch('/api/linger/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.token }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '进入失败');
        router.replace(`/room/${d.roomId}`);
      } catch (e: any) { setStatus(e.message); }
    })();
  }, [params.token, router]);
  return <main className="min-h-screen flex items-center justify-center text-parchment/80 px-6 text-center">{status}</main>;
}
