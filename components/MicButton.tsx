'use client';
import { toast } from '@/components/Toast';
// 输入框旁边的麦克风：点一下说话，底部弹出 Claude 式面板（上面实时出字、下面波形），说完点 ✓ 文字进输入框，可以改了再发。
import { useRef, useState } from 'react';
import Dictate from './Dictate';

export default function MicButton({ value, onChange, en, compact = true }: { value: string; onChange: (v: string) => void; en: boolean; compact?: boolean }) {
  const base = useRef('');
  const [live, setLive] = useState('');
  return (
    <Dictate en={en} lang={en ? 'en' : 'zh'} compact={compact} panel text={live}
      onStart={() => { base.current = value ? value.replace(/\s+$/, '') + (en ? ' ' : '') : ''; setLive(''); }}
      onLive={(t, done) => { setLive(t); if (done) { onChange(base.current + t); setLive(''); } }}
      onCancel={() => setLive('')}
      onError={(m) => { try { toast(m); } catch {} }} />
  );
}
