// 浏览器端 Supabase 客户端：用 anon key，受 RLS 约束。
// 用于前端订阅 Realtime、读玩家自己有权看的数据。
'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
