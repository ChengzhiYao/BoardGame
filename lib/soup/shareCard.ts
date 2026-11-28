'use client';
// 每日一汤成绩卡(竖版图片,不剧透):第几期、几问破案、用了几个提示、击败多少人、连续天数、每一问的色块、网址。
const COLORS: Record<string, string> = { '🟩': '#4f9d6b', '🟥': '#b8463f', '⬜': '#3a3d44', '🟨': '#c9a54a', '✅': '#8fd3b8', '💡': '#e6c76e' };

export async function renderDailyCard(o: { no: number; solved: boolean; questions: number; hints: number; beat?: number; rank?: number; players?: number; streak?: number; grid: string; en: boolean }): Promise<Blob | null> {
  const W = 1080, H = 1350; const L = (zh: string, e: string) => (o.en ? e : zh);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f1f1c'); g.addColorStop(0.55, '#0c0e12'); g.addColorStop(1, '#151018');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 雾
  const rg = ctx.createRadialGradient(W * 0.8, H * 0.15, 20, W * 0.8, H * 0.15, 520); rg.addColorStop(0, 'rgba(143,211,184,0.18)'); rg.addColorStop(1, 'rgba(143,211,184,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const serif = '"Songti SC","Noto Serif CJK SC","Source Han Serif SC",Georgia,serif';
  const sans = '-apple-system,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
  const X = 96;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(143,211,184,0.9)'; ctx.font = `500 34px ${sans}`;
  ctx.fillText(L(`谜夜 · 每日一汤  第 ${o.no} 期`, `MYSTNIGHT · DAILY SOUP #${o.no}`), X, 170);
  ctx.fillStyle = '#eef7f2'; ctx.font = `700 112px ${serif}`;
  ctx.fillText(o.solved ? L(`${o.questions} 问破案`, `Solved in ${o.questions}`) : L('这碗没喝完', 'Not cracked'), X, 320);
  ctx.fillStyle = 'rgba(230,245,239,0.72)'; ctx.font = `400 40px ${sans}`;
  const sub: string[] = [];
  sub.push(o.hints ? L(`用了 ${o.hints} 个提示`, `${o.hints} hint${o.hints > 1 ? 's' : ''}`) : L('没用提示', 'no hints'));
  if (o.solved && o.beat != null) sub.push(L(`击败 ${o.beat}% 的人`, `beat ${o.beat}% of players`));
  ctx.fillText(sub.join(' · '), X, 400);
  if ((o.streak || 0) > 1) { ctx.fillStyle = '#f0a35a'; ctx.font = `500 38px ${sans}`; ctx.fillText(L(`🔥 连续 ${o.streak} 天`, `🔥 ${o.streak}-day streak`), X, 470); }
  // 色块(每一问一个,10 个一行)
  const cells = Array.from(o.grid || '').filter((c) => COLORS[c]);
  const sz = 64, gap = 18, top = 560;
  cells.slice(0, 60).forEach((c, i) => {
    const x = X + (i % 10) * (sz + gap), y = top + Math.floor(i / 10) * (sz + gap);
    ctx.fillStyle = COLORS[c]; ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(x, y, sz, sz, 14) : ctx.rect(x, y, sz, sz); ctx.fill();
  });
  // 底部
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(X, H - 260, W - X * 2, 2);
  ctx.fillStyle = '#eef7f2'; ctx.font = `600 52px ${serif}`; ctx.fillText(L('你能几问破案?', 'How fast can you crack it?'), X, H - 175);
  ctx.fillStyle = 'rgba(230,245,239,0.6)'; ctx.font = `400 34px ${sans}`; ctx.fillText(L('全站每天同一道海龟汤 · 免费', 'One lateral-thinking puzzle a day · free'), X, H - 120);
  ctx.fillStyle = 'rgba(143,211,184,0.95)'; ctx.font = `500 36px ui-monospace,Menlo,monospace`; ctx.fillText('mystnight.com/daily', X, H - 66);
  return await new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}
