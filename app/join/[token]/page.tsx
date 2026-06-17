'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ensureSession } from '@/lib/auth';

export default function JoinPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState('正在加入房间…');

  useEffect(() => {
    (async () => {
      try {
        await ensureSession();
        const res = await fetch('/api/rooms/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '加入失败');
        router.replace(`/room/${data.roomId}`);
      } catch (e: any) {
        setStatus(e.message);
      }
    })();
  }, [params.token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center text-parchment/80">
      {status}
    </main>
  );
}
