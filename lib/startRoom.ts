'use client';
// 开房（首页 / 我的大厅共用）：开好返回房间地址；要登录或要买局数时返回对应去处。
import { ensureSession } from '@/lib/auth';

const SUFFIX: Record<string, [string, string]> = {
  soup: [' 的海龟汤', '’s Lateral Mystery'], td: [' 的真心话大冒险', '’s Truth or Dare'], jbs: [' 的剧本杀', '’s Murder Mystery'],
  botc: [' 的血染', '’s Bloodbound'], mcc: [' 的午夜猫诅咒', '’s Cat Curse'], dnd: [' 的龙与地下城', '’s D&D Quest'],
  story: [' 的故事', '’s Story'], coc: [' 的调查', '’s Investigation'],
};

export async function startRoom(mode: string, name: string, lang: 'zh' | 'en', opts: { quick?: boolean } = {}): Promise<{ url?: string; login?: boolean; upgrade?: boolean; error?: string }> {
  try {
    await ensureSession(name);
    const sfx = SUFFIX[mode] || SUFFIX.coc;
    const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${name}${lang === 'en' ? sfx[1] : sfx[0]}`, displayName: name, mode, language: lang }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) {
      try { localStorage.setItem('pendingGame', JSON.stringify({ mode, name, language: lang, quick: !!opts.quick, ts: Date.now() })); } catch {}
      return data.reason === 'login' ? { login: true } : { upgrade: true };
    }
    if (!res.ok) return { error: data.error || (lang === 'en' ? 'Could not open the room' : '开房失败') };
    return { url: `/room/${data.roomId}${opts.quick && mode === 'soup' ? '?quick=1' : ''}` };
  } catch (e: any) { return { error: e?.message || 'error' }; }
}
