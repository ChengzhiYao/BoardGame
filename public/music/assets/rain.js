// 轻微的斜雨，呼应封面
(function () {
  const cv = document.getElementById("rain");
  if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = cv.getContext("2d");
  let w, h, drops = [];
  const dpr = Math.min(2, devicePixelRatio || 1);
  function resize() {
    w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr;
    const n = Math.round((innerWidth * innerHeight) / 9000);
    drops = Array.from({ length: n }, () => spawn(true));
  }
  function spawn(any) {
    return { x: Math.random() * w * 1.2, y: any ? Math.random() * h : -20, l: (8 + Math.random() * 18) * dpr,
             v: (5 + Math.random() * 6) * dpr, a: .06 + Math.random() * .16 };
  }
  addEventListener("resize", resize); resize();
  (function tick() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = dpr;
    for (const d of drops) {
      ctx.strokeStyle = `rgba(220,226,240,${d.a})`;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * .18, d.y + d.l); ctx.stroke();
      d.y += d.v; d.x -= d.v * .18;
      if (d.y > h) Object.assign(d, spawn(false));
    }
    requestAnimationFrame(tick);
  })();
})();
