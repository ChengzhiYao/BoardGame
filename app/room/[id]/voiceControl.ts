// 把"角色语音"开关从房间组件提升到悬浮音频条（AudioManager）里：房间组件注册当前 {mode, cycle}，AudioManager 订阅渲染按钮。
export type VCtrl = { mode: 'off' | 'browser' | 'openai'; cycle: () => void } | null;

let current: VCtrl = null;
const subs = new Set<(c: VCtrl) => void>();

export function setVoiceControl(c: VCtrl) {
  current = c;
  subs.forEach((f) => f(c));
}
export function getVoiceControl(): VCtrl { return current; }
export function subscribeVoiceControl(f: (c: VCtrl) => void) {
  subs.add(f);
  return () => { subs.delete(f); };
}
