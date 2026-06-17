// 服务端 Supabase 客户端。
// - createServerClient(): 跟随登录用户身份，受 RLS 约束（用于读玩家自己的数据）。
// - createAdminClient(): 用 service_role key，绕过 RLS（用于读真相、写骰子/SAN/状态）。
//   ⚠️ createAdminClient 只能在服务端调用，绝不能在前端 import。

import { createServerClient as _createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createServerClient() {
  const cookieStore = cookies();
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component 中调用 set 会抛错，可忽略 */ }
        },
      },
    }
  );
}

// 绕过 RLS 的管理客户端：读隐藏真相、写不可篡改日志、改房间状态等。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
