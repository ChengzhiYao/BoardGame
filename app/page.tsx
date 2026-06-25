import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';

// 打开 / 时按"之前选过的语言(cookie) → 浏览器语言"自动跳到 /zh 或 /en。
export default function Page() {
  const c = cookies().get('lang')?.value;
  let lang: 'zh' | 'en' = 'zh';
  if (c === 'en' || c === 'zh') {
    lang = c;
  } else {
    const first = (headers().get('accept-language') || '').toLowerCase().split(',')[0] || '';
    lang = first.startsWith('en') ? 'en' : 'zh';
  }
  redirect('/' + lang);
}
