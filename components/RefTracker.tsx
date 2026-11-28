'use client';
// 任何页面带 ?ref=代码 打开时,记下推广人(30 天,第一次点的那个算数)。登录后由 /api/billing/status 把新用户记到推广人名下。
import { useEffect } from 'react';
export default function RefTracker() {
  useEffect(() => {
    try { const code = new URLSearchParams(location.search).get('ref'); if (code) fetch('/api/ref/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }).catch(() => {}); } catch {}
  }, []);
  return null;
}
