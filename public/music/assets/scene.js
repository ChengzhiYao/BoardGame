// ─────────────────────────────────────────────
//  背景场景：跟着歌曲播放变化
//  每首歌在 songs.js 里写 scene: "rain"（以后可以加 snow / stars / petals …）
//  player.js 会持续写入：
//    window.__playing  是否在播放
//    window.__level    当前音乐响度 0~1（副歌更响 → 场景更浓）
// ─────────────────────────────────────────────
(function () {
  const cv = document.getElementById("scene");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0;
  const rand = (a, b) => a + Math.random() * (b - a);

  const SCENES = {};

  // ═════════ 雨：呼应封面 —— 斜雨、溅起的水花、被风吹着翻转的纸片、远处模糊的城市灯光 ═════════
  SCENES.rain = () => {
    const LAYERS = [ // 远 → 近
      { n: 160, len: [6, 12], v: [7, 10], a: [.05, .12], w: .7 },
      { n: 110, len: [12, 22], v: [11, 15], a: [.10, .20], w: 1 },
      { n: 50, len: [22, 38], v: [17, 23], a: [.16, .30], w: 1.3 }
    ];
    let drops = [], splashes = [], papers = [], lights = [], glass = [];

    function init() {
      drops = [];
      LAYERS.forEach((L, li) => {
        const n = Math.round(L.n * Math.min(1.6, (W * H) / (dpr * dpr) / 330000));
        for (let i = 0; i < n; i++) drops.push(newDrop(li, true));
      });
      lights = Array.from({ length: 22 }, () => ({
        x: rand(0, W), y: H * rand(.72, 1.02), r: rand(10, 34) * dpr,
        hue: [12, 345, 30, 210, 350][(Math.random() * 5) | 0], ph: rand(0, 6.28), sp: rand(.4, 1.2), drift: rand(-.04, .04)
      }));
      papers = Array.from({ length: 6 }, () => newPaper(true));
      glass = Array.from({ length: 9 }, () => newGlass(true));
    }
    function newDrop(li, any) {
      const L = LAYERS[li];
      return { li, k: Math.random(), x: rand(-.1, 1.3) * W, y: any ? rand(0, H) : rand(-60, -10) * dpr,
        len: rand(...L.len) * dpr, v: rand(...L.v) * dpr, a: rand(...L.a) };
    }
    function newPaper(any) {
      return { x: any ? rand(0, W) : W + 30 * dpr, y: any ? rand(0, H) : rand(-.1, .6) * H,
        s: rand(9, 18) * dpr, rot: rand(0, 6.28), vr: rand(-.025, .025), flip: rand(0, 6.28), vf: rand(.02, .05),
        vx: rand(-1.4, -.6) * dpr, vy: rand(.5, 1.2) * dpr, sh: rand(.6, 1), k: Math.random() };
    }
    function newGlass(any) { // 贴在“玻璃”上慢慢滑下的水珠
      return { x: rand(0, W), y: any ? rand(0, H) : rand(-20, 0), r: rand(1.5, 3.5) * dpr, v: 0, wait: rand(60, 600), trail: [] };
    }

    let t = 0;
    function draw(I, level) {
      t++;
      const wind = .2 + Math.sin(t / 260) * .05 + level * .06; // 斜度，随“风”轻轻摆
      // 远处灯光
      for (const l of lights) {
        const pulse = .5 + .5 * Math.sin(t * .01 * l.sp + l.ph);
        const a = (.05 + .07 * pulse + level * .12) * (.35 + I * .65);
        l.x += l.drift * dpr; if (l.x < -50) l.x = W + 40; if (l.x > W + 50) l.x = -40;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `hsla(${l.hue},70%,70%,${a})`); g.addColorStop(1, `hsla(${l.hue},70%,60%,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 6.29); ctx.fill();
      }
      // 雨
      ctx.lineCap = "round";
      for (const d of drops) {
        if (d.k > I) continue; // 强度决定有多少雨滴在下
        const L = LAYERS[d.li], sp = d.v * (.75 + I * .5);
        ctx.strokeStyle = `rgba(214,222,240,${d.a * (.6 + I * .6)})`;
        ctx.lineWidth = L.w * dpr;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * wind, d.y + d.len); ctx.stroke();
        d.y += sp; d.x -= sp * wind;
        if (d.y > H) {
          if (d.li === 2 && splashes.length < 60) splashes.push({ x: d.x, y: H - rand(0, H * .12), r: 0, a: .28 });
          Object.assign(d, newDrop(d.li, false), { k: d.k });
        }
      }
      // 水花
      splashes = splashes.filter(s => s.a > .01);
      for (const s of splashes) {
        s.r += .6 * dpr; s.a *= .9;
        ctx.strokeStyle = `rgba(220,228,245,${s.a})`; ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.8, s.r * .5, 0, 0, 6.29); ctx.stroke();
      }
      // 纸片（封面里飞着的那些）
      for (const p of papers) {
        if (p.k > I * 1.4) continue;
        p.x += p.vx * (1 + level); p.y += p.vy; p.rot += p.vr; p.flip += p.vf;
        if (p.x < -40 * dpr || p.y > H + 40 * dpr) Object.assign(p, newPaper(false));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(p.flip), 1);
        const lum = 82 + 12 * Math.sin(p.flip);
        ctx.fillStyle = `hsla(220,20%,${lum}%,${.5 * p.sh})`;
        ctx.beginPath(); ctx.moveTo(-p.s, -p.s * .45); ctx.lineTo(p.s * .9, -p.s * .7); ctx.lineTo(p.s, p.s * .5); ctx.lineTo(-p.s * .7, p.s * .6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // 玻璃上的水珠：雨越大越多，偶尔顺着往下滑，留下水痕
      for (const g of glass) {
        if (I < .25) continue;
        if (g.wait > 0) g.wait--; else g.v = Math.min(3 * dpr, g.v + .05 * dpr);
        g.y += g.v; g.x += Math.sin(g.y * .05) * .3;
        if (g.v > 0) { g.trail.push([g.x, g.y]); if (g.trail.length > 40) g.trail.shift(); }
        if (g.y > H + 10) Object.assign(g, newGlass(false));
        ctx.strokeStyle = "rgba(220,230,250,.06)"; ctx.lineWidth = g.r * .8;
        if (g.trail.length > 1) { ctx.beginPath(); g.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
        const gr = ctx.createRadialGradient(g.x - g.r * .3, g.y - g.r * .3, 0, g.x, g.y, g.r);
        gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(200,215,240,.05)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.29); ctx.fill();
      }
    }
    return { init, draw };
  };

  // ═════════ 草原：金色黄昏 ↔ 月夜（跟着歌词里的 “Every night…” 切换） ═════════
  SCENES.meadow = (song) => {
    let motes = [], seeds = [], blades = [], stars = [], flies = [];
    const acts = song.acts || [];
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      motes = Array.from({ length: Math.round(70 * area) }, () => newMote(true));
      seeds = Array.from({ length: 9 }, () => newSeed(true));
      stars = Array.from({ length: Math.round(120 * area) }, () => ({ x: rand(0, W), y: rand(0, H * .62), r: rand(.4, 1.4) * dpr, ph: rand(0, 6.28), sp: rand(.5, 2) }));
      flies = Array.from({ length: Math.round(26 * area) }, () => ({ x: rand(0, W), y: rand(H * .45, H), ph: rand(0, 6.28), sp: rand(.3, .8), ax: rand(.3, 1), ay: rand(.2, .7) }));
      blades = [];
      const n = Math.round(W / (5 * dpr));
      for (let i = 0; i < n; i++) blades.push({ x: (i + rand(-.4, .4)) * 5 * dpr, h: rand(.05, .14) * H * (1 + Math.sin(i * .07) * .3), ph: rand(0, 6.28), lean: rand(-.3, .3), tone: rand(0, 1) });
    }
    function newMote(any) { // 阳光里浮动的金色微尘
      return { x: rand(0, W), y: any ? rand(0, H) : H + 10, r: rand(.8, 2.4) * dpr, vy: rand(-.15, -.45) * dpr, ph: rand(0, 6.28), a: rand(.15, .5) };
    }
    function newSeed(any) { // 被风吹走的蒲公英绒毛
      return { x: any ? rand(0, W) : -30 * dpr, y: any ? rand(0, H * .8) : rand(H * .2, H * .8), s: rand(4, 8) * dpr, vx: rand(.5, 1.3) * dpr, ph: rand(0, 6.28), rot: rand(0, 6.28) };
    }
    let night = 0, t = 0;
    function draw(I, level) {
      t++;
      const now = window.__time || 0;
      const want = acts.some(([a, b, m]) => m === "night" && now >= a && now < b) && window.__playing ? 1 : 0;
      night += (want - night) * .012;           // 黄昏 ↔ 夜晚 慢慢过渡
      const day = 1 - night, wind = Math.sin(t / 300) * .5 + .7 + level * .8;

      // 夜色：整个画面压暗、偏蓝
      if (night > .01) { ctx.fillStyle = `rgba(10,16,34,${night * .55})`; ctx.fillRect(0, 0, W, H); }
      // 太阳 / 月亮 的光晕（右上）
      const sx = W * .82, sy = H * .07, sr = Math.max(W, H) * .55;
      let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, `rgba(255,196,110,${(.22 + level * .12) * day * I})`); g.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (night > .01) {
        g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * .5);
        g.addColorStop(0, `rgba(210,225,255,${.28 * night})`); g.addColorStop(.06, `rgba(200,215,255,${.16 * night})`); g.addColorStop(1, "rgba(180,200,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16 * dpr); g.addColorStop(0, `rgba(245,248,255,${.55 * night})`); g.addColorStop(1, "rgba(240,244,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 16 * dpr, 0, 6.29); ctx.fill();
        for (const s of stars) {
          const a = night * (.35 + .65 * (.5 + .5 * Math.sin(t * .02 * s.sp + s.ph)));
          ctx.fillStyle = `rgba(230,236,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill();
        }
      }
      // 金色微尘（白天）
      if (day > .01) for (const m of motes) {
        m.y += m.vy * (1 + I); m.x += Math.sin(t * .01 + m.ph) * .3 * dpr + wind * .15 * dpr;
        if (m.y < -10 || m.x > W + 10) Object.assign(m, newMote(false), { x: rand(-.2, 1) * W });
        const a = m.a * day * I * (.6 + .4 * Math.sin(t * .03 + m.ph));
        const gg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
        gg.addColorStop(0, `rgba(255,224,150,${a})`); gg.addColorStop(1, "rgba(255,210,120,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, 6.29); ctx.fill();
      }
      // 萤火虫（夜晚）
      if (night > .01) for (const f of flies) {
        f.ph += .01 * f.sp;
        const x = f.x + Math.sin(f.ph * 1.3) * 40 * f.ax * dpr, y = f.y + Math.cos(f.ph) * 30 * f.ay * dpr;
        const a = night * (.3 + .7 * Math.max(0, Math.sin(t * .04 * f.sp + f.ph * 3)));
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 9 * dpr);
        gg.addColorStop(0, `rgba(220,255,160,${a})`); gg.addColorStop(1, "rgba(200,255,140,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 9 * dpr, 0, 6.29); ctx.fill();
      }
      // 蒲公英绒毛
      for (const s of seeds) {
        if (I < .2) continue;
        s.x += s.vx * wind; s.y += Math.sin(t * .015 + s.ph) * .4 * dpr - .1 * dpr; s.rot += .01;
        if (s.x > W + 30 * dpr) Object.assign(s, newSeed(false));
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        ctx.strokeStyle = `rgba(255,246,225,${(.55 * day + .35 * night) * I})`; ctx.lineWidth = .6 * dpr;
        for (let k = 0; k < 10; k++) { const an = k / 10 * 6.28; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * s.s, Math.sin(an) * s.s); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s.s * 1.6); ctx.stroke();
        ctx.restore();
      }
      // 前景的草：跟着风和音乐摆动
      const base = H + 2;
      for (const b of blades) {
        const sway = (Math.sin(t * .02 + b.ph + b.x * .004) * .5 + .6) * wind * .22 + b.lean * .2;
        const tipx = b.x + sway * b.h, tipy = base - b.h;
        const lum = 10 + b.tone * 8;
        ctx.strokeStyle = `hsla(${32 - night * 10},${40 - night * 15}%,${lum}%,${.85})`;
        ctx.lineWidth = (1.4 + b.tone) * dpr;
        ctx.beginPath(); ctx.moveTo(b.x, base); ctx.quadraticCurveTo(b.x + sway * b.h * .3, base - b.h * .55, tipx, tipy); ctx.stroke();
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 夜里的公园：满月、路灯、湖面的光、飘落的叶子、拟声词、落到掌心的那一点光 ═════════
  SCENES.nightwalk = (song) => {
    let stars = [], motes = [], leaves = [], shimmer = [], words = [];
    const sparks = song.sparks || [], sfx = (song.sfx || []).slice().sort((a, b) => a[0] - b[0]);
    // 拟声词用手写感的字体
    if (sfx.length && !document.getElementById("sfx-font")) {
      const l = document.createElement("link"); l.id = "sfx-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap"; document.head.appendChild(l);
    }
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      stars = Array.from({ length: Math.round(90 * area) }, () => ({ x: rand(0, W), y: rand(0, H * .55), r: rand(.4, 1.2) * dpr, ph: rand(0, 6.28), sp: rand(.4, 1.6) }));
      motes = Array.from({ length: 22 }, () => ({ a: rand(0, 6.28), r: rand(.2, 1), sp: rand(.004, .012) * (Math.random() < .5 ? -1 : 1), y: rand(.15, .55), s: rand(1, 2.2) * dpr }));
      leaves = Array.from({ length: 7 }, () => newLeaf(true));
      shimmer = Array.from({ length: Math.round(40 * area) }, () => ({ x: rand(0, W), y: H * rand(.9, 1), w: rand(8, 40) * dpr, ph: rand(0, 6.28), sp: rand(.2, .6) * dpr }));
    }
    function newLeaf(any) {
      return { x: any ? rand(0, W) : rand(.3, 1.2) * W, y: any ? rand(0, H) : -20 * dpr, s: rand(5, 9) * dpr, rot: rand(0, 6.28), vr: rand(-.04, .04),
        vx: rand(-1, -.3) * dpr, vy: rand(.5, 1.1) * dpr, ph: rand(0, 6.28), k: Math.random() };
    }
    let t = 0, lastNow = 0, flick = 1;
    function draw(I, level, fx) {
      t++;
      const now = window.__time || 0, playing = !!window.__playing;
      // 满月（左上，柔光）
      const mx = W * .16, my = H * .09, mr = Math.max(W, H) * .42;
      let g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      g.addColorStop(0, `rgba(200,215,255,${.16 + .14 * I})`); g.addColorStop(.05, `rgba(190,205,250,${.1 + .08 * I})`); g.addColorStop(1, "rgba(160,180,240,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createRadialGradient(mx, my, 0, mx, my, 22 * dpr);
      g.addColorStop(0, `rgba(250,250,255,${.35 + .3 * I})`); g.addColorStop(.75, `rgba(235,240,255,${.25 + .2 * I})`); g.addColorStop(1, "rgba(230,236,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 22 * dpr, 0, 6.29); ctx.fill();
      for (const s of stars) { ctx.fillStyle = `rgba(220,230,255,${(.15 + .45 * (.5 + .5 * Math.sin(t * .02 * s.sp + s.ph))) * (.4 + .6 * I)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); }

      // 路灯（右上）：暖色光锥，偶尔“滋滋”闪一下
      if (Math.random() < .004) flick = .45; flick += (1 - flick) * .08;
      const lx = W * .88, ly = H * .05, la = (.1 + .08 * I + level * .08) * flick;
      g = ctx.createRadialGradient(lx, ly, 0, lx, ly, H * .75);
      g.addColorStop(0, `rgba(255,230,170,${la * 2.2})`); g.addColorStop(.12, `rgba(255,222,160,${la})`); g.addColorStop(1, "rgba(255,215,150,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - 10 * dpr, ly); ctx.lineTo(lx - H * .42, H); ctx.lineTo(lx + H * .3, H); ctx.lineTo(lx + 10 * dpr, ly); ctx.closePath(); ctx.fill();
      g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26 * dpr); g.addColorStop(0, `rgba(255,240,200,${.6 * flick})`); g.addColorStop(1, "rgba(255,230,180,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 26 * dpr, 0, 6.29); ctx.fill();
      // 灯下打转的小虫光点
      for (const m of motes) {
        m.a += m.sp; const x = lx + Math.cos(m.a) * m.r * W * .12, y = H * m.y + Math.sin(m.a * 1.7) * 20 * dpr;
        ctx.fillStyle = `rgba(255,236,190,${(.25 + .35 * I) * flick})`; ctx.beginPath(); ctx.arc(x, y, m.s, 0, 6.29); ctx.fill();
      }
      // 湖面反光
      for (const s of shimmer) {
        s.x += s.sp; if (s.x > W + 40 * dpr) s.x = -40 * dpr;
        const a = (.06 + .12 * Math.max(0, Math.sin(t * .03 + s.ph))) * (.4 + .6 * I) * (1 + level);
        ctx.fillStyle = `rgba(200,215,255,${a})`; ctx.fillRect(s.x, s.y, s.w, 1.2 * dpr);
      }
      // 叶子
      for (const l of leaves) {
        if (l.k > .3 + I * .7) continue;
        l.x += l.vx * (1 + level * 1.5) + Math.sin(t * .02 + l.ph) * .4 * dpr; l.y += l.vy; l.rot += l.vr;
        if (l.y > H + 20 * dpr || l.x < -30 * dpr) Object.assign(l, newLeaf(false));
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
        ctx.fillStyle = "rgba(20,30,48,.75)"; ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * .45, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = "rgba(120,140,180,.25)"; ctx.lineWidth = .6 * dpr; ctx.beginPath(); ctx.moveTo(-l.s, 0); ctx.lineTo(l.s, 0); ctx.stroke();
        ctx.restore();
      }
      // “一线微光坠入这昏暗的夜，停在掌心” —— 光从天上落到封面里男孩的掌心
      const img = document.getElementById("cover"), tgt = song.sparkTarget || [.5, .5];
      for (const s0 of sparks) {
        const dt = now - s0; if (dt < 0 || dt > 10 || !img) continue;
        const r = img.getBoundingClientRect();
        const tx = (r.left + r.width * tgt[0]) * dpr, ty = (r.top + r.height * tgt[1]) * dpr;
        const fall = Math.min(1, dt / 2.8), ease = 1 - Math.pow(1 - fall, 3);
        const x = tx + (1 - ease) * W * .12, y = -20 * dpr + (ty + 20 * dpr) * ease;
        const fade = dt > 8 ? 1 - (dt - 8) / 2 : 1;
        const pulse = fall >= 1 ? .85 + .15 * Math.sin(dt * 4) : 1;
        if (fall < 1) {
          const tg = fx.createLinearGradient(x + W * .02, y - 110 * dpr, x, y);
          tg.addColorStop(0, "rgba(255,240,190,0)"); tg.addColorStop(1, "rgba(255,240,190,.6)");
          fx.strokeStyle = tg; fx.lineWidth = 2 * dpr; fx.beginPath(); fx.moveTo(x + W * .02, y - 110 * dpr); fx.lineTo(x, y); fx.stroke();
        }
        const R = (fall >= 1 ? 46 : 22) * dpr * pulse;
        const gg = fx.createRadialGradient(x, y, 0, x, y, R);
        gg.addColorStop(0, `rgba(255,252,232,${.95 * fade})`); gg.addColorStop(.1, `rgba(255,236,170,${.65 * fade})`); gg.addColorStop(1, "rgba(255,220,140,0)");
        fx.fillStyle = gg; fx.beginPath(); fx.arc(x, y, R, 0, 6.29); fx.fill();
      }
      // 拟声词：唱到对应位置时，在画面边上轻轻浮现
      if (playing) {
        if (Math.abs(now - lastNow) < 1.2) for (const [ts, txt] of sfx) if (ts > lastNow && ts <= now) {
          words.push({ txt, x: W * rand(.06, .72), y: H * rand(.12, .88), born: t, s: rand(18, 26) * dpr, rot: rand(-.18, .18) });
        }
        lastNow = now;
      }
      words = words.filter(w => t - w.born < 150);
      for (const w of words) {
        const age = (t - w.born) / 150, a = age < .15 ? age / .15 : 1 - (age - .15) / .85;
        fx.save(); fx.translate(w.x, w.y - age * 30 * dpr); fx.rotate(w.rot);
        fx.font = `${w.s}px "ZCOOL KuaiLe", "Noto Sans SC", sans-serif`;
        fx.fillStyle = `rgba(232,238,252,${.8 * a})`; fx.shadowColor = "rgba(255,230,180,.7)"; fx.shadowBlur = 10 * dpr;
        fx.fillText(w.txt, 0, 0); fx.restore();
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 城市：金色的雾、楼缝里的光、天际线的窗、泡泡糖；鸽子 / 红绿灯 / 地铁 跟着歌词出现 ═════════
  SCENES.city = (song) => {
    let wins = [], dust = [], bubbles = [], pops = [], sky = [];
    const ev = song.events || {};
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      // 天际线：底部一排高低不同的楼
      sky = []; wins = [];
      let x = -10 * dpr;
      while (x < W + 20 * dpr) {
        const bw = rand(28, 70) * dpr, bh = H * rand(.06, .2) * (Math.random() < .12 ? 1.5 : 1);
        sky.push({ x, w: bw, h: bh, spire: Math.random() < .15 });
        for (let wy = H - bh + 8 * dpr; wy < H - 6 * dpr; wy += 11 * dpr)
          for (let wx = x + 5 * dpr; wx < x + bw - 6 * dpr; wx += 10 * dpr)
            if (Math.random() < .3) wins.push({ x: wx, y: wy, on: Math.random(), ph: rand(0, 6.28), lime: Math.random() < .06 });
        x += bw + rand(0, 6) * dpr;
      }
      dust = Array.from({ length: Math.round(60 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(.6, 2) * dpr, vx: rand(.05, .3) * dpr, vy: rand(-.15, .05) * dpr, ph: rand(0, 6.28) }));
      bubbles = [];
    }
    function bubble(burst) {
      bubbles.push({ x: rand(.05, .95) * W, y: H + 20 * dpr, r: rand(6, burst ? 20 : 14) * dpr, vy: rand(.5, 1.3) * dpr * (burst ? 1.6 : 1), ph: rand(0, 6.28), life: rand(.45, .9) * H });
    }
    const active = (list, now, len) => (list || []).map(t0 => now - t0).find(d => d >= 0 && d < len);
    let t = 0;
    function draw(I, level, fx) {
      t++;
      const now = window.__time || 0;
      // 金色的雾
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(120,200,120,${.05 * I})`); g.addColorStop(.5, `rgba(255,190,70,${.08 + .06 * I})`); g.addColorStop(1, `rgba(255,150,40,${.1 * I})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 楼缝里斜射下来的光
      for (let k = 0; k < 3; k++) {
        const cx = W * (.55 + k * .2) + Math.sin(t * .002 + k) * 40 * dpr, a = (.05 + .04 * Math.sin(t * .006 + k * 2) + level * .05) * I;
        ctx.save(); ctx.translate(cx, -20 * dpr); ctx.rotate(.38);
        g = ctx.createLinearGradient(0, 0, 0, H * 1.3); g.addColorStop(0, `rgba(255,220,130,${a})`); g.addColorStop(1, "rgba(255,210,120,0)");
        ctx.fillStyle = g; ctx.fillRect(-30 * dpr, 0, (40 + k * 20) * dpr, H * 1.3); ctx.restore();
      }
      // 浮尘
      for (const d of dust) {
        d.x += d.vx * (1 + level * 2); d.y += d.vy; if (d.x > W + 5) d.x = -5; if (d.y < -5) d.y = H + 5;
        ctx.fillStyle = `rgba(255,226,150,${(.15 + .25 * Math.sin(t * .02 + d.ph) ** 2) * I})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.29); ctx.fill();
      }
      // 天际线 + 窗户（音乐越响亮的窗越多）
      ctx.fillStyle = `rgba(20,16,8,${.4 + .2 * I})`;
      for (const b of sky) {
        ctx.fillRect(b.x, H - b.h, b.w, b.h);
        if (b.spire) { ctx.beginPath(); ctx.moveTo(b.x + b.w * .3, H - b.h); ctx.lineTo(b.x + b.w * .5, H - b.h - 40 * dpr); ctx.lineTo(b.x + b.w * .7, H - b.h); ctx.fill(); }
      }
      const thr = 1 - (.25 + .45 * I + level * .3);
      for (const w of wins) {
        if (w.on < thr) continue;
        const a = (.18 + .25 * Math.sin(t * .01 + w.ph) ** 2) * I;
        ctx.fillStyle = w.lime ? `rgba(170,255,110,${a})` : `rgba(255,214,140,${a})`;
        ctx.fillRect(w.x, w.y, 3 * dpr, 4 * dpr);
      }
      // 泡泡糖：时不时冒一个粉色泡泡；唱到 “ガムの甘さを…” 时冒一串
      if (I > .3 && Math.random() < .003 + level * .006) bubble(false);
      if (active(ev.gum, now, 3) !== undefined && Math.random() < .1) bubble(true);
      bubbles = bubbles.filter(b => { b.y -= b.vy; b.life -= b.vy; if (b.life <= 0) { pops.push({ x: b.x, y: b.y, r: b.r, a: .7 }); return false; } return true; });
      for (const b of bubbles) {
        const x = b.x + Math.sin(t * .02 + b.ph) * 8 * dpr;
        g = ctx.createRadialGradient(x - b.r * .35, b.y - b.r * .35, b.r * .1, x, b.y, b.r);
        g.addColorStop(0, "rgba(255,225,235,.55)"); g.addColorStop(.7, "rgba(255,140,175,.28)"); g.addColorStop(1, "rgba(255,120,160,.45)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.29); ctx.fill();
      }
      pops = pops.filter(p => (p.a *= .86) > .02);
      for (const p of pops) { ctx.strokeStyle = `rgba(255,170,195,${p.a})`; ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.8 - p.a), 0, 6.29); ctx.stroke(); }

      // ── 以下画在最上层，跟着歌词出现 ──
      // 红绿灯：“赤か白か 明かりが跳ねて”—— 红色手掌和白色小人来回跳
      let d = active(ev.signal, now, 4.5);
      if (d !== undefined) {
        const a = Math.min(1, d * 3, (4.5 - d) * 2), red = Math.floor(d * 2.2) % 2 === 0;
        const x = W * .82, y = H * .2, s = 30 * dpr;
        fx.fillStyle = `rgba(10,10,10,${.65 * a})`; fx.beginPath(); fx.roundRect ? fx.roundRect(x - s, y - s, s * 2, s * 2, 8 * dpr) : fx.rect(x - s, y - s, s * 2, s * 2); fx.fill();
        fx.save(); fx.translate(x, y); fx.shadowBlur = 14 * dpr;
        if (red) { // 手掌
          fx.fillStyle = fx.shadowColor = `rgba(255,90,50,${a})`;
          fx.beginPath(); fx.roundRect ? fx.roundRect(-9 * dpr, -2 * dpr, 18 * dpr, 16 * dpr, 4 * dpr) : fx.rect(-9 * dpr, -2 * dpr, 18 * dpr, 16 * dpr); fx.fill();
          for (let k = 0; k < 4; k++) fx.fillRect((-9 + k * 4.8) * dpr, -14 * dpr, 3.4 * dpr, 13 * dpr);
          fx.fillRect(9 * dpr, 2 * dpr, 6 * dpr, 3.4 * dpr);
        } else { // 走路的小人
          fx.fillStyle = fx.strokeStyle = fx.shadowColor = `rgba(245,245,240,${a})`; fx.lineWidth = 3.4 * dpr; fx.lineCap = "round";
          fx.beginPath(); fx.arc(0, -13 * dpr, 4 * dpr, 0, 6.29); fx.fill();
          fx.beginPath(); fx.moveTo(0, -8 * dpr); fx.lineTo(-1 * dpr, 4 * dpr); fx.lineTo(-7 * dpr, 15 * dpr); fx.moveTo(-1 * dpr, 4 * dpr); fx.lineTo(6 * dpr, 15 * dpr);
          fx.moveTo(-7 * dpr, -1 * dpr); fx.lineTo(0, -6 * dpr); fx.lineTo(7 * dpr, 0); fx.stroke();
        }
        fx.restore();
      }
      // 鸽子：“首に星の印の鳩が 肩先をかすめてゆく” —— 从右上飞过
      d = active(ev.pigeon, now, 3.2);
      if (d !== undefined) {
        const p = d / 3.2, x = W * (1.1 - p * 1.3), y = H * (.12 + p * .25 + Math.sin(p * 6) * .02), s = (40 + p * 40) * dpr, flap = Math.sin(d * 18);
        fx.save(); fx.translate(x, y); fx.fillStyle = `rgba(92,98,112,${.95 * Math.min(1, (1 - p) * 4)})`;
        fx.beginPath(); fx.ellipse(0, 0, s * .55, s * .2, -.1, 0, 6.29); fx.fill();            // 身体
        fx.beginPath(); fx.arc(-s * .5, -s * .1, s * .14, 0, 6.29); fx.fill();               // 头
        fx.beginPath(); fx.moveTo(-s * .1, -s * .05); fx.quadraticCurveTo(s * .1, -s * (.2 + .6 * flap), s * .45, -s * (.1 + .7 * flap)); fx.lineTo(s * .2, 0); fx.fill(); // 翅膀
        fx.beginPath(); fx.moveTo(s * .5, 0); fx.lineTo(s * .85, -s * .1); fx.lineTo(s * .85, s * .12); fx.fill(); // 尾巴
        fx.fillStyle = "rgba(150,230,160,.8)"; fx.beginPath(); fx.arc(-s * .4, s * .02, s * .05, 0, 6.29); fx.fill(); // 脖子上的星纹
        fx.restore();
      }
      // 地铁：唱到地铁时，一列车的光从屏幕底部呼啸而过（最后一次是渐渐远去）
      const trains = ev.subway || [];
      trains.forEach((t0, i) => {
        const dd = now - t0, far = i === trains.length - 1, len = far ? 4 : 2.2;
        if (dd < 0 || dd > len) return;
        const p = dd / len, y = H * .84, h = 34 * dpr;
        const head = far ? W * (1.2 - p * .6) : -W * .3 + p * W * 1.9;
        const a = far ? (1 - p) : Math.min(1, (1 - p) * 3, p * 6);
        g = ctx.createLinearGradient(head - W * .9, 0, head, 0);
        g.addColorStop(0, "rgba(255,230,160,0)"); g.addColorStop(.85, `rgba(255,236,180,${.5 * a})`); g.addColorStop(1, `rgba(255,250,230,${.85 * a})`);
        ctx.fillStyle = g; ctx.fillRect(head - W * .9, y, W * .9, h);
        ctx.fillStyle = `rgba(255,248,220,${.6 * a})`;
        for (let k = 0; k < 12; k++) ctx.fillRect(head - k * 40 * dpr - 24 * dpr, y + 9 * dpr, 22 * dpr, 11 * dpr);
      });
    }
    return { init, draw, wet: false };
  };

  // ═════════ 拼贴：封面变成一个跟着音乐实时剪辑的 MV（怪异 jazz 风格） ═════════
  // 用你拍的 footage：在鼓点上跳切、定格、分屏、镜像、撞色；唱到关键句时浮现书法字
  SCENES.collage = (song) => {
    const V = song.visual || {}, base = `/music/media/${song.id}/`;
    const POOLS = V.pools || {}, cues = (V.cues || []).slice().sort((a, b) => a[0] - b[0]);
    const TINTS = V.tints || [[60, 220, 170], [150, 90, 255], [255, 170, 60], [255, 70, 120], null];
    // 视频（静音、循环、隐藏），只把正在用的几个开着播放
    const vids = {};
    for (const name of V.clips || []) {
      const v = document.createElement("video");
      v.src = `${base}clips/${name}.mp4`; v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = "auto";
      v.style.display = "none"; document.body.appendChild(v); vids[name] = v;
    }
    const kanji = {};
    for (const k of V.kanji || []) { const im = new Image(); im.src = `${base}kanji-${k}.png`; kanji[k] = im; }
    // 封面里的画布
    let cv2, c2, S = 0, still, sc, grain = [];
    function ensureCanvas() {
      if (cv2) return true;
      const wrap = document.querySelector(".cover-wrap"); if (!wrap) return false;
      cv2 = document.createElement("canvas");
      cv2.style.cssText = "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.2s";
      wrap.insertBefore(cv2, wrap.querySelector(".cover-shade"));
      c2 = cv2.getContext("2d");
      S = cv2.width = cv2.height = Math.min(720, Math.round(wrap.clientWidth * dpr));
      still = document.createElement("canvas"); still.width = still.height = S; sc = still.getContext("2d");
      for (let k = 0; k < 4; k++) { // 预先做几帧胶片颗粒
        const g = document.createElement("canvas"); g.width = g.height = 256; const gx = g.getContext("2d");
        const id = gx.createImageData(256, 256);
        for (let i = 0; i < id.data.length; i += 4) { const n = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; }
        gx.putImageData(id, 0, 0); grain.push(g);
      }
      return true;
    }
    const pick = arr => arr[(Math.random() * arr.length) | 0];
    const cueAt = now => { let c = cues[0]; for (const q of cues) if (q[0] <= now) c = q; else break; return c || [0, "all"]; };

    let cur = null, alt = null, mode = "plain", tint = TINTS[0], tintAmt = .6;
    let wasPaused = false, freezeUntil = 0, flash = 0, lastBeat = 0, ema = .2, lastCue = null, kanjiShow = null, beatCount = 0, started = false, zoom = 1;
    function playOnly(names) {
      for (const [n, v] of Object.entries(vids)) {
        if (names.includes(n)) { if (v.paused) v.play().catch(() => {}); } else if (!v.paused) v.pause();
      }
    }
    function setPool(poolName, strong) {
      const pool = POOLS[poolName] || POOLS.all || Object.keys(vids);
      cur = pick(pool); alt = pick(pool.length > 1 ? pool.filter(x => x !== cur) : pool);
      playOnly([cur, alt]);
    }
    function onBeat(now, poolName, wild) {
      beatCount++;
      const pool = POOLS[poolName] || POOLS.all || Object.keys(vids);
      const r = Math.random();
      if (r < (wild ? .55 : .3)) { cur = pick(pool); alt = pick(pool); playOnly([cur, alt]); }      // 跳切
      if (beatCount % (wild ? 2 : 4) === 0) {                                                          // 换一种剪法
        const modes = wild ? ["strips", "mirror", "quad", "stutter", "plain", "kaleido"] : ["plain", "plain", "strips", "mirror", "quad", "stutter"];
        mode = pick(modes);
        if (mode === "stutter") { sc.drawImage(cv2, 0, 0); freezeUntil = now + rand(.25, .6); }
      }
      if (beatCount % 8 === 0 || (wild && Math.random() < .3)) { tint = pick(TINTS); tintAmt = rand(.35, .8); }
      if (wild && Math.random() < .25) flash = 1;
      zoom = 1.06;
    }
    function drawClip(name, x, y, w, h, mirror) {
      const v = vids[name]; if (!v || v.readyState < 2) return false;
      c2.save();
      if (mirror) { c2.translate(x + w, y); c2.scale(-1, 1); x = 0; y = 0; }
      const z = zoom, dw = w * z, dh = h * z;
      c2.drawImage(v, x - (dw - w) / 2, y - (dh - h) / 2, dw, dh);
      c2.restore(); return true;
    }

    let t = 0;
    function draw(I, level) {
      t++;
      if (!ensureCanvas()) return;
      const now = window.__time || 0, playing = !!window.__playing, bass = window.__bass || 0;
      if (playing && !started) { started = true; cv2.style.opacity = 1; }
      if (!started) return;
      if (!playing) { if (!wasPaused) { Object.values(vids).forEach(v => v.pause()); wasPaused = true; } }
      else if (wasPaused) { wasPaused = false; if (cur) playOnly([cur, alt]); }
      const cue = cueAt(now), poolName = cue[1], wild = poolName === "wild", outro = poolName === "outro";
      if (cue !== lastCue) { lastCue = cue; setPool(poolName); if (cue[2]) kanjiShow = { k: cue[2], t0: cue[0] }; mode = wild ? "strips" : "plain"; tint = pick(TINTS); tintAmt = rand(.4, .75); }
      // 鼓点检测：低频突然变强
      ema += (bass - ema) * .05;
      if (playing && bass > ema * 1.22 && bass > .3 && now - lastBeat > (wild ? .2 : .32)) { lastBeat = now; if (!outro) onBeat(now, poolName, wild); }
      zoom += (1 - zoom) * .12;

      // ── 画面 ──
      c2.globalCompositeOperation = "source-over"; c2.globalAlpha = 1;
      if (now < freezeUntil) c2.drawImage(still, 0, 0);
      else {
        c2.fillStyle = "#000"; c2.fillRect(0, 0, S, S);
        const m = outro ? "plain" : mode;
        if (m === "plain") drawClip(cur, 0, 0, S, S);
        else if (m === "mirror") { c2.save(); c2.beginPath(); c2.rect(0, 0, S / 2, S); c2.clip(); drawClip(cur, 0, 0, S, S); c2.restore(); c2.save(); c2.beginPath(); c2.rect(S / 2, 0, S / 2, S); c2.clip(); drawClip(cur, 0, 0, S, S, true); c2.restore(); }
        else if (m === "quad") { drawClip(cur, 0, 0, S / 2, S / 2); drawClip(alt, S / 2, 0, S / 2, S / 2); drawClip(alt, 0, S / 2, S / 2, S / 2, true); drawClip(cur, S / 2, S / 2, S / 2, S / 2, true); }
        else if (m === "strips") { // 竖条交错两段画面
          drawClip(cur, 0, 0, S, S);
          const n = 7, w = S / n;
          for (let k = 1; k < n; k += 2) { c2.save(); c2.beginPath(); c2.rect(k * w, 0, w, S); c2.clip(); drawClip(alt, 0, 0, S, S); c2.restore(); }
        } else if (m === "kaleido") {
          for (let k = 0; k < 4; k++) { c2.save(); c2.translate(S / 2, S / 2); c2.rotate(k * Math.PI / 2); c2.beginPath(); c2.moveTo(0, 0); c2.lineTo(S, 0); c2.lineTo(S, S); c2.closePath(); c2.clip(); c2.scale(k % 2 ? -1 : 1, 1); drawClip(cur, -S / 2, -S / 2, S, S); c2.restore(); }
        } else drawClip(cur, 0, 0, S, S);
        // 撞色：先去色，再染上一种颜色
        if (tint && !outro) {
          c2.globalCompositeOperation = "saturation"; c2.globalAlpha = tintAmt; c2.fillStyle = "#808080"; c2.fillRect(0, 0, S, S);
          c2.globalCompositeOperation = "color"; c2.globalAlpha = tintAmt * .85; c2.fillStyle = `rgb(${tint})`; c2.fillRect(0, 0, S, S);
        } else if (!tint && !outro) {
          c2.globalCompositeOperation = "saturation"; c2.globalAlpha = 1; c2.fillStyle = "#808080"; c2.fillRect(0, 0, S, S);
          c2.globalCompositeOperation = "source-over"; c2.globalAlpha = .12; c2.fillStyle = "#000"; c2.fillRect(0, 0, S, S);
        }
        c2.globalCompositeOperation = "source-over"; c2.globalAlpha = 1;
      }
      // 负片闪一下
      if (flash > .05) { c2.globalCompositeOperation = "difference"; c2.globalAlpha = flash; c2.fillStyle = "#fff"; c2.fillRect(0, 0, S, S); flash *= .7; }
      // 胶片颗粒 + 暗角
      c2.globalCompositeOperation = "overlay"; c2.globalAlpha = .18 + bass * .12;
      const gr = grain[t % grain.length]; const ox = Math.random() * 64, oy = Math.random() * 64;
      for (let gx = -ox; gx < S; gx += 256) for (let gy = -oy; gy < S; gy += 256) c2.drawImage(gr, gx, gy);
      c2.globalCompositeOperation = "source-over"; c2.globalAlpha = 1;
      const vg = c2.createRadialGradient(S / 2, S / 2, S * .35, S / 2, S / 2, S * .75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)"); c2.fillStyle = vg; c2.fillRect(0, 0, S, S);
      // 书法字：半透明暗色方块 + 发光的字（跟你 MV 里的样子一样）
      if (kanjiShow) {
        const dt = now - kanjiShow.t0, im = kanji[kanjiShow.k];
        if (dt < 0 || dt > 4.2) kanjiShow = null;
        else if (im && im.complete && im.naturalWidth) {
          const a = Math.min(1, dt * 3, (4.2 - dt) * 1.5), sz = 1 + dt * .02;
          const r = im.naturalWidth / im.naturalHeight, top = S * .05, bh = S * .46, bw = Math.max(S * .3, bh * r * 1.15);
          c2.globalAlpha = a * .5; c2.fillStyle = "#1b1b1b"; c2.fillRect(S / 2 - bw / 2, top, bw, bh);
          c2.globalAlpha = a; const ih = bh * .9 * sz, iw = ih * r;
          c2.drawImage(im, S / 2 - iw / 2, top + bh / 2 - ih / 2, iw, ih); c2.globalAlpha = 1;
        }
      }
      drawBackground(now, poolName, I, level, bass, fx);
    }

    // ═══ 页面背景：生命的循环 ═══
    // 1) 整页背景 = 正在播放的 MV 画面，放大模糊（颜色跟着剪辑一起变）
    // 2) 蜂群绕着封面飞，鼓点一响就被惊散
    // 3) 从底部升起的发光“养分”（亡骸 → 养分 → 下一代）
    // 4) 按歌词换氛围：海 → 海浪线；阳光 → 金色光；亡骸 / 心跳 → 暗红色的心跳；间奏 → 跟着节拍滑过的色条
    // 5) 书法字出现时，背后浮着一个巨大的、几乎透明的同一个字
    let live, lc, bees = [], motes = [], mood = { sea: 0, sun: 0, red: 0, wild: 0, bee: 0 }, beatPulse = 0, prevBeat = 0, bgReady = false;
    function setupBg() {
      bgReady = true;
      live = document.createElement("canvas"); live.width = live.height = 48; lc = live.getContext("2d");
      live.style.cssText = "position:fixed;inset:-12%;width:124%;height:124%;z-index:-3;filter:blur(36px) saturate(1.35) brightness(.5);opacity:0;transition:opacity 2s;pointer-events:none";
      document.body.insertBefore(live, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.transition = "opacity 2s";
      bees = Array.from({ length: 34 }, (_, i) => ({ x: rand(0, W), y: rand(0, H), vx: 0, vy: 0, a: rand(0, 6.28), r: rand(.3, .62), sp: rand(.004, .012) * (Math.random() < .5 ? 1 : -1), s: rand(.8, 1.4), k: i / 34, ph: rand(0, 6.28) }));
      motes = Array.from({ length: 70 }, () => newMote(true));
    }
    function newMote(any) { return { x: rand(0, W), y: any ? rand(0, H) : H + 10 * dpr, r: rand(1, 3) * dpr, vy: rand(.3, 1) * dpr, ph: rand(0, 6.28), a: rand(.2, .6) }; }
    function bee(x, y, s, ang, flap, a, g) {
      g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a;
      g.fillStyle = "rgba(235,240,255,.45)";                                    // 翅膀
      g.beginPath(); g.ellipse(-1 * s, -3.2 * s * flap, 3.2 * s, 1.6 * s, -.5, 0, 6.29); g.fill();
      g.beginPath(); g.ellipse(-1 * s, 3.2 * s * flap, 3.2 * s, 1.6 * s, .5, 0, 6.29); g.fill();
      g.fillStyle = "#e8b23a"; g.beginPath(); g.ellipse(0, 0, 4.4 * s, 2.1 * s, 0, 0, 6.29); g.fill();   // 身体
      g.fillStyle = "#1a1408"; g.fillRect(-1.6 * s, -2.1 * s, 1.1 * s, 4.2 * s); g.fillRect(.8 * s, -2 * s, 1.1 * s, 4 * s);  // 条纹
      g.beginPath(); g.arc(4.6 * s, 0, 1.5 * s, 0, 6.29); g.fill();             // 头
      g.restore(); g.globalAlpha = 1;
    }
    function drawBackground(now, poolName, I, level, bass, fx) {
      if (!bgReady) setupBg();
      // 1) 模糊的 MV 当背景
      lc.drawImage(cv2, 0, 0, 48, 48);
      if (live.style.opacity !== "1") { live.style.opacity = "1"; const bd = document.querySelector(".backdrop"); if (bd) bd.style.opacity = ".15"; }
      // 氛围渐变
      const want = { sea: poolName === "sea" ? 1 : 0, sun: poolName === "sun" ? 1 : 0, red: (poolName === "corpse" || poolName === "hand") ? 1 : 0,
        wild: poolName === "wild" ? 1 : 0, bee: (poolName === "bee" || poolName === "gold" || poolName === "outro") ? 1 : 0 };
      for (const k in mood) mood[k] += (want[k] - mood[k]) * .02;
      if (lastBeat !== prevBeat) { prevBeat = lastBeat; beatPulse = 1; for (const b of bees) { const dx = b.x - W / 2, dy = b.y - H * .4, d = Math.hypot(dx, dy) || 1; b.vx += dx / d * 5 * dpr; b.vy += dy / d * 5 * dpr; } }
      beatPulse *= .9;
      const col = tint || [210, 210, 210];
      // 4) 氛围
      if (mood.sun > .01) { // 阳光
        const g = ctx.createRadialGradient(W * .2, -H * .05, 0, W * .2, -H * .05, H * .9);
        g.addColorStop(0, `rgba(255,190,90,${.35 * mood.sun})`); g.addColorStop(1, "rgba(255,160,60,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (mood.red > .01) { // 心跳：暗红色从四周一下一下地压进来
        const p = .5 + beatPulse * .5, g = ctx.createRadialGradient(W / 2, H * .4, H * .2, W / 2, H * .4, H * .85);
        g.addColorStop(0, "rgba(120,10,20,0)"); g.addColorStop(1, `rgba(120,10,24,${.45 * mood.red * p})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (mood.sea > .01) { // 海浪线
        ctx.lineWidth = 1.4 * dpr;
        for (let k = 0; k < 7; k++) {
          const y0 = H * (.72 + k * .045), amp = (6 + k * 2) * dpr * (1 + bass);
          ctx.strokeStyle = `rgba(190,225,255,${(.12 + k * .03) * mood.sea})`; ctx.beginPath();
          for (let x = 0; x <= W; x += 12 * dpr) { const y = y0 + Math.sin(x * .008 / dpr + t * .03 + k) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
      }
      if (mood.wild > .01) { // 间奏：竖色条跟着节拍滑过
        for (let k = 0; k < 6; k++) {
          const x = ((t * (2 + k) * dpr + k * W / 3) % (W * 1.4)) - W * .2, w = (20 + k * 14) * dpr;
          ctx.fillStyle = `rgba(${col},${(.05 + beatPulse * .12) * mood.wild})`; ctx.fillRect(x, 0, w, H);
        }
      }
      // 5) 巨大的透明书法字
      if (kanjiShow) {
        const im = kanji[kanjiShow.k], dt = now - kanjiShow.t0;
        if (im && im.complete && im.naturalWidth) {
          const a = Math.min(1, dt * 1.5, (4.2 - dt)) * .09, r = im.naturalWidth / im.naturalHeight, h = H * .95, w = h * r;
          ctx.globalAlpha = Math.max(0, a); ctx.drawImage(im, W / 2 - w / 2 + Math.sin(dt) * 10 * dpr, H * .03 - dt * 6 * dpr, w, h); ctx.globalAlpha = 1;
        }
      }
      // 3) 升起的养分
      for (const m of motes) {
        m.y -= m.vy * (1 + bass * 2); m.x += Math.sin(t * .01 + m.ph) * .4 * dpr;
        if (m.y < -10) Object.assign(m, newMote(false));
        const a = m.a * I * (.5 + .5 * Math.sin(t * .03 + m.ph)), g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, 6.29); ctx.fill();
      }
      // 2) 蜂群：绕着封面打转，鼓点时散开；唱到蜜蜂时更多
      const wrap = document.querySelector(".cover-wrap"), rc = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerWidth };
      const cx = (rc.left + rc.width / 2) * dpr, cy = (rc.top + rc.height / 2) * dpr, R = Math.max(rc.width, rc.height) * dpr;
      const active = Math.round(10 + 24 * Math.max(mood.bee, mood.wild * .6));
      bees.forEach((b, i) => {
        if (i >= active) return;
        b.a += b.sp * (1 + level);
        const tx = cx + Math.cos(b.a) * R * (b.r + .25), ty = cy + Math.sin(b.a * 1.3 + b.ph) * R * (b.r + .1);
        b.vx += (tx - b.x) * .004; b.vy += (ty - b.y) * .004; b.vx *= .93; b.vy *= .93;
        b.vx += rand(-.3, .3) * dpr; b.vy += rand(-.3, .3) * dpr;
        b.x += b.vx; b.y += b.vy;
        bee(b.x, b.y, b.s * dpr * 2.4, Math.atan2(b.vy, b.vx), Math.sin(t * 1.7 + i), .85 * I, ctx);
      });
    }
    return { init() {}, draw, wet: false };
  };

  // ═════════ 坠入雨中：真实的雨（三层景深 + 水花）、车窗上的雨珠、云雾、在雨天的天空里游过的大鲸鱼 ═════════
  // 用手指点背景会荡开涟漪（“我用指尖轻轻触碰落下的雨”）
  SCENES.fallrain = (song) => {
    const ev = song.events || {};
    let far = [], mid = [], near = [], splashes = [], beads = [], slides = [], clouds = [], ripples = [], gusts = [], calls = [];
    // ── 预先画好的贴图 ──
    function sprite(w, h, fn) { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); return c; }
    const STREAK = sprite(8, 96, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(220,232,248,0)"); gr.addColorStop(.75, "rgba(225,236,250,.55)"); gr.addColorStop(1, "rgba(240,246,255,.95)"); g.fillStyle = gr; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 6.29); g.fill(); });
    const BOKEH = sprite(32, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(220,232,248,0)"); gr.addColorStop(.5, "rgba(225,236,250,.25)"); gr.addColorStop(1, "rgba(235,242,255,.35)"); g.fillStyle = gr; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 6.29); g.fill(); });
    const BEAD = sprite(64, 64, (g, w) => { // 车窗上的水珠：折射出上亮下暗，底部有一圈深色边，左上角一个高光
      const r = w / 2 - 2;
      let gr = g.createRadialGradient(w / 2, w * .62, r * .2, w / 2, w / 2, r);
      gr.addColorStop(0, "rgba(235,242,252,.35)"); gr.addColorStop(.7, "rgba(160,180,205,.25)"); gr.addColorStop(.92, "rgba(30,42,60,.45)"); gr.addColorStop(1, "rgba(20,30,45,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(w / 2, w / 2, r, 0, 6.29); g.fill();
      gr = g.createRadialGradient(w * .38, w * .32, 0, w * .38, w * .32, r * .38); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(w * .38, w * .32, r * .38, 0, 6.29); g.fill();
    });
    function init() {
      const area = Math.min(1.7, (W * H) / (dpr * dpr) / 330000);
      const mk = (n, len, wd, sp, al) => Array.from({ length: Math.round(n * area) }, () => ({ x: rand(-.2, 1.2) * W, y: rand(-.2, 1) * H, len: rand(...len) * dpr, w: rand(...wd) * dpr, sp: rand(...sp) * dpr, a: rand(...al), k: Math.random() }));
      far = mk(240, [10, 20], [.6, 1], [16, 22], [.18, .4]);
      mid = mk(110, [26, 46], [1, 1.6], [26, 34], [.3, .55]);
      near = mk(14, [70, 120], [5, 9], [42, 56], [.25, .5]);
      beads = Array.from({ length: Math.round(170 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: (Math.random() < .85 ? rand(1.2, 3) : rand(3.5, 6)) * dpr, k: Math.random() }));
      slides = Array.from({ length: 7 }, () => newSlide(true));
      clouds = Array.from({ length: 10 }, () => ({ x: rand(-.3, 1.3) * W, y: rand(-.1, 1.1) * H, r: rand(.3, .7) * Math.max(W, H), v: rand(.1, .35) * dpr, a: rand(.04, .09), front: Math.random() < .4 }));
    }
    function newSlide(any) { return { x: rand(.03, .97) * W, y: any ? rand(0, H) : rand(-.1, .4) * H, r: rand(5, 9) * dpr, v: 0, wait: rand(60, 500), trail: [] }; }
    // 触碰雨滴
    addEventListener("pointerdown", e => {
      if (e.target.closest && e.target.closest("button,.bar,.ly-line,a,.gate")) return;
      touch(e.clientX * dpr, e.clientY * dpr, 1);
    });
    function touch(x, y, s) { ripples.push({ x, y, r: 0, a: .55 * s }); for (const b of beads) { const d = Math.hypot(b.x - x, b.y - y); if (d < 90 * dpr) { b.x += (b.x - x) / (d || 1) * 18 * dpr; b.y += (b.y - y) / (d || 1) * 18 * dpr; } } }
    const inWin = (list, now, len) => (list || []).some(t0 => now >= t0 && now < t0 + len);

    // ── 大鲸鱼（座头鲸），头朝左，长度 L ──
    const UP = [[0, 0], [.025, -.06], [.12, -.1], [.3, -.125], [.5, -.12], [.68, -.085], [.84, -.04], [.93, -.02]];
    const LO = [[.93, .02], [.84, .035], [.66, .07], [.45, .12], [.25, .14], [.1, .1], [.02, .05], [0, 0]];
    function whalePath(g, L, ph) {
      const bend = x => Math.sin(ph) * .04 * x * x;   // 身体后半段随着摆尾轻轻弯
      const P = pts => pts.map(([x, y]) => [x * L, (y + bend(x)) * L]);
      const pts = P(UP.concat(LO));
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
      g.closePath();
      return bend;
    }
    function drawWhale(g, x, y, L, ph, a, t) {
      g.save(); g.translate(x, y); g.rotate(-.05 + Math.sin(t * .006) * .03); g.globalAlpha = a;
      const gr = g.createLinearGradient(0, -.13 * L, 0, .14 * L);
      gr.addColorStop(0, "#1b2836"); gr.addColorStop(.55, "#2c3d50"); gr.addColorStop(1, "#6f8296");
      const bend = whalePath(g, L, ph); g.fillStyle = gr; g.fill();
      // 尾鳍
      const tx = .93 * L, ty = bend(.93) * L, fl = Math.sin(ph) * .09 * L;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + .05 * L, ty - .02 * L + fl, tx + .13 * L, ty - .1 * L + fl * 1.4);
      g.quadraticCurveTo(tx + .08 * L, ty + fl * .6, tx + .13 * L, ty + .1 * L + fl * 1.4); g.quadraticCurveTo(tx + .05 * L, ty + .02 * L + fl, tx, ty); g.fillStyle = "#223244"; g.fill();
      // 长长的胸鳍（座头鲸的特征），慢慢划动
      const fa = Math.sin(ph * .5) * .15;
      g.save(); g.translate(.24 * L, .1 * L); g.rotate(.85 + fa);
      g.beginPath(); g.moveTo(0, -.025 * L); g.quadraticCurveTo(.18 * L, -.03 * L, .32 * L, 0); g.quadraticCurveTo(.18 * L, .035 * L, 0, .03 * L); g.closePath();
      g.fillStyle = "#3a4d62"; g.fill(); g.restore();
      // 腹部的褶皱线
      g.strokeStyle = "rgba(170,190,210,.25)"; g.lineWidth = Math.max(1, L * .002);
      for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(.04 * L, (.04 + k * .012) * L); g.quadraticCurveTo(.2 * L, (.09 + k * .012) * L, .38 * L, (.08 + k * .008) * L); g.stroke(); }
      // 眼睛
      g.fillStyle = "rgba(10,15,22,.9)"; g.beginPath(); g.arc(.13 * L, .035 * L, L * .006, 0, 6.29); g.fill();
      g.restore(); g.globalAlpha = 1;
    }
    function whaleState(now) { // 每次出现游 28 秒，从右往左穿过天空
      for (const t0 of ev.whale || []) {
        const d = now - t0; if (d < 0 || d > 28) continue;
        const p = d / 28, L = Math.min(W * 1.15, H * .9);
        return { x: W + L * .15 - p * (W + L * 1.4), y: H * (.4 + Math.sin(p * 3.1) * .06), L, p };
      }
      return null;
    }

    let t = 0, calm = 0, light = 0, autoT = 0, lastNow = 0;
    function draw(I, level, fx) {
      t++;
      const now = window.__time || 0, playing = !!window.__playing;
      const wantCalm = inWin(ev.calm, now, 6) ? 1 : 0, wantLight = inWin(ev.symphony, now, 9) ? 1 : 0;
      calm += (wantCalm - calm) * .03; light += (wantLight - light) * .015;
      const slow = 1 - calm * .88;                         // “Softly / Silently” → 雨变成慢动作
      const wind = .12 + Math.sin(t * .003) * .04 + (inWin(ev.wind, now, 6) ? .14 : 0);
      if (playing && inWin(ev.wind, now, 6) && Math.random() < .035) gusts.push({ y: rand(.1, .9) * H, x: -W * .3, v: rand(14, 22) * dpr, a: rand(.05, .1), h: rand(30, 80) * dpr });
      if (playing && inWin(ev.touch, now, 8) && t - autoT > 55) { autoT = t; touch(rand(.15, .85) * W, rand(.3, .85) * H, .7); }
      // 鲸鸣：声波从鲸鱼身上荡开
      if (playing) { for (const tc of ev.call || []) if (tc > lastNow && tc <= now) calls.push({ born: t }); lastNow = now; }

      const cloud = front => { for (const c of clouds) { if (c.front !== front) continue; c.x -= c.v; if (c.x < -c.r) { c.x = W + c.r; c.y = rand(-.1, 1.1) * H; }
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r); g.addColorStop(0, `rgba(205,218,232,${c.a * (.5 + I * .5)})`); g.addColorStop(1, "rgba(195,210,228,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.29); ctx.fill(); } };
      cloud(false);
      // 鲸鱼：半透明地从整个画面前面游过（和封面里坠落的人在同一片天空）
      const wh = whaleState(now);
      if (wh) {
        const fade = Math.min(1, wh.p * 5, (1 - wh.p) * 5);
        drawWhale(fx, wh.x, wh.y, wh.L, t * .025 * (1 - calm * .7), .4 * fade, t);
        calls = calls.filter(c => t - c.born < 200);
        for (const c of calls) {
          const age = (t - c.born) / 200;
          for (let k = 0; k < 3; k++) { const rr = (age * 1.2 - k * .12) * wh.L * .7; if (rr <= 0) continue;
            fx.strokeStyle = `rgba(225,236,250,${.35 * (1 - age)})`; fx.lineWidth = 1.6 * dpr; fx.beginPath(); fx.ellipse(wh.x + .1 * wh.L, wh.y, rr, rr * .55, 0, 0, 6.29); fx.stroke(); }
        }
      }
      cloud(true);
      // 云缝里透下来的光
      if (light > .01) for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.translate(W * (.15 + k * .22) + Math.sin(t * .004 + k) * 30 * dpr, -40 * dpr); ctx.rotate(-.25 + k * .05);
        const g = ctx.createLinearGradient(0, 0, 0, H * 1.2); g.addColorStop(0, `rgba(255,248,225,${.13 * light})`); g.addColorStop(1, "rgba(255,245,220,0)");
        ctx.fillStyle = g; ctx.fillRect(-25 * dpr, 0, (50 + k * 18) * dpr, H * 1.2); ctx.restore();
      }
      // 雨：远 → 中 → 近
      const amount = .25 + I * .75;
      const rain = (arr, img, splash) => {
        ctx.save(); ctx.transform(1, 0, -wind, 1, 0, 0);
        for (const d of arr) {
          if (d.k > amount) continue;
          d.y += d.sp * slow; if (d.y > H) { if (splash && splashes.length < 50 && Math.random() < .5) splashes.push({ x: d.x - wind * H, y: H - rand(0, 30) * dpr, age: 0 }); d.y = -d.len - rand(0, 200) * dpr; d.x = rand(-.2, 1.3) * W; }
          ctx.globalAlpha = d.a * (.6 + I * .4); ctx.drawImage(img, d.x + wind * d.y, d.y, d.w, d.len * (calm > .5 ? .6 : 1));
        }
        ctx.restore(); ctx.globalAlpha = 1;
      };
      rain(far, STREAK, false); rain(mid, STREAK, true);
      // 水花：小小的皇冠形
      splashes = splashes.filter(s => (s.age += slow) < 14);
      for (const s of splashes) { const p = s.age / 14; ctx.strokeStyle = `rgba(225,235,250,${.4 * (1 - p)})`; ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(s.x - 3 * dpr * p, s.y, 4 * dpr * p, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke(); ctx.beginPath(); ctx.arc(s.x + 3 * dpr * p, s.y, 4 * dpr * p, Math.PI * 1.4, Math.PI * 1.9); ctx.stroke(); }
      rain(near, BOKEH, false);
      // 风
      gusts = gusts.filter(g => (g.x += g.v) < W * 1.3);
      for (const g of gusts) { const gr = ctx.createLinearGradient(g.x - W * .4, 0, g.x, 0); gr.addColorStop(0, "rgba(230,238,248,0)"); gr.addColorStop(1, `rgba(230,238,248,${g.a})`); ctx.fillStyle = gr; ctx.fillRect(g.x - W * .4, g.y - g.h / 2, W * .4, g.h); }
      // 车窗上的雨珠：雨越大越多；大颗的会顺着玻璃滑下来，留下一串小水珠
      for (const b of beads) { if (b.k > .2 + I * .8) continue; ctx.drawImage(BEAD, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); }
      for (const s of slides) {
        if (I < .2) continue;
        if (s.wait > 0) s.wait -= slow; else { s.v = Math.min(2.6 * dpr, s.v + .04 * dpr) * (Math.random() < .03 ? .2 : 1); s.y += s.v * slow; s.x += Math.sin(s.y * .03) * .25 * dpr; }
        if (s.v > 0 && t % 3 === 0) { s.trail.push({ x: s.x + rand(-1, 1) * dpr, y: s.y - s.r * .6, r: rand(1, 2.2) * dpr }); if (s.trail.length > 45) s.trail.shift(); }
        if (s.y > H + 20 * dpr) Object.assign(s, newSlide(false));
        for (const tr of s.trail) ctx.drawImage(BEAD, tr.x - tr.r, tr.y - tr.r, tr.r * 2, tr.r * 2);
        ctx.drawImage(BEAD, s.x - s.r, s.y - s.r * 1.15, s.r * 2, s.r * 2.3);
      }
      // 涟漪（最上层）
      ripples = ripples.filter(r => (r.a *= .965) > .01);
      for (const r of ripples) { r.r += 2.2 * dpr;
        for (let k = 0; k < 3; k++) { const rr = r.r - k * 14 * dpr; if (rr <= 0) continue; fx.strokeStyle = `rgba(240,246,255,${r.a * (1 - k * .3)})`; fx.lineWidth = 1.3 * dpr; fx.beginPath(); fx.ellipse(r.x, r.y, rr, rr * .92, 0, 0, 6.29); fx.stroke(); } }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 十字架：封面变成一段按歌词推进的默片（你的插画），背景是灰烬、荆棘和心跳的红光；结尾黑暗散去，迎来黎明 ═════════
  SCENES.cross = (song) => {
    const V = song.story || {}, base = `/music/media/${song.id}/`;
    const shots = (V.shots || []).slice().sort((a, b) => a[0] - b[0]);
    const imgs = {};
    for (const [, k] of shots) if (!imgs[k]) { const im = new Image(); im.src = `${base}story/${k}.jpg`; imgs[k] = im; }
    const hand = new Image(); hand.src = `${base}handcross.png`;
    const handsImg = new Image(); handsImg.src = `${base}hands.png`; let handsLit = null;
    const inWin = (list, now, len) => (list || []).some(t0 => now >= t0 && now < t0 + len);
    const dawnAt = V.dawn || 1e9;

    // ── 封面里的画布 ──
    let cv2, c2, S = 0, grain = [];
    function ensureCanvas() {
      if (cv2) return true;
      const wrap = document.querySelector(".cover-wrap"); if (!wrap) return false;
      cv2 = document.createElement("canvas");
      cv2.style.cssText = "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 2s";
      wrap.insertBefore(cv2, wrap.querySelector(".cover-shade"));
      c2 = cv2.getContext("2d"); S = cv2.width = cv2.height = Math.min(800, Math.round(wrap.clientWidth * dpr));
      for (let k = 0; k < 4; k++) { const g = document.createElement("canvas"); g.width = g.height = 256; const gx = g.getContext("2d"), id = gx.createImageData(256, 256);
        for (let i = 0; i < id.data.length; i += 4) { const n = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; } gx.putImageData(id, 0, 0); grain.push(g); }
      return true;
    }
    const MOVES = { in: [1.0, 1.18, 0, 0, 0, 0], out: [1.2, 1.02, 0, 0, 0, 0], left: [1.15, 1.15, .06, -.06, 0, 0], right: [1.15, 1.15, -.06, .06, 0, 0], up: [1.15, 1.15, 0, 0, .06, -.06], down: [1.15, 1.15, 0, 0, -.06, .06] };
    function shotAt(now) { let i = 0; for (let k = 0; k < shots.length; k++) if (shots[k][0] <= now) i = k; return i; }
    function drawShot(i, now, alpha, pulse) {
      const sh = shots[i]; if (!sh) return; const im = imgs[sh[1]]; if (!im || !im.complete || !im.naturalWidth) return;
      const end = shots[i + 1] ? shots[i + 1][0] : sh[0] + 20, p = Math.min(1, Math.max(0, (now - sh[0]) / (end - sh[0] + 1.5)));
      const e = p * p * (3 - 2 * p), m = MOVES[sh[2]] || MOVES.in;
      const sc = (m[0] + (m[1] - m[0]) * e) * (1 + pulse * .015), dx = (m[2] + (m[3] - m[2]) * e) * S, dy = (m[4] + (m[5] - m[4]) * e) * S;
      c2.globalAlpha = alpha; const w = S * sc;
      c2.drawImage(im, (S - w) / 2 + dx, (S - w) / 2 + dy, w, w); c2.globalAlpha = 1;
    }

    // ── 背景元素 ──
    let ash = [], embers = [], vines = [], dust = [], lights = [], drips = [], cracks = [], hands = [], smoke = [];
    const SMOKE = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(90,14,18,.55)"); gr.addColorStop(.5, "rgba(60,10,14,.25)"); gr.addColorStop(1, "rgba(40,6,10,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; })();
    function crackPath(x, y, ang, len, depth, out) { // 分叉的裂缝
      const pts = [[x, y]]; let cx = x, cy = y, a = ang;
      const n = 8 + (Math.random() * 6 | 0);
      for (let i = 0; i < n; i++) { a += rand(-.7, .7); cx += Math.cos(a) * len / n; cy += Math.sin(a) * len / n; pts.push([cx, cy]);
        if (depth < 2 && Math.random() < .22) crackPath(cx, cy, a + rand(-1, 1), len * .45, depth + 1, out); }
      out.push({ pts, w: (2.6 - depth) * dpr });
    }
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      ash = Array.from({ length: Math.round(110 * area) }, () => newAsh(true));
      embers = Array.from({ length: 34 }, () => newEmber(true));
      lights = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(1, 3) * dpr, v: rand(.3, 1) * dpr, ph: rand(0, 6.28) }));
      smoke = Array.from({ length: 9 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(.35, .7) * Math.max(W, H), vx: rand(-.25, .25) * dpr, vy: rand(-.15, .05) * dpr, ph: rand(0, 6.28) }));
      // 荆棘：四周往里长，粗细不一
      vines = [];
      const starts = [];
      for (let k = 0; k < 16; k++) { const side = k % 4; // 0 左 1 右 2 下 3 下角
        if (side === 0) starts.push([-10 * dpr, rand(.3, 1) * H, rand(-.6, .3)]);
        else if (side === 1) starts.push([W + 10 * dpr, rand(.3, 1) * H, Math.PI + rand(-.3, .6)]);
        else starts.push([rand(0, 1) * W, H + 10 * dpr, -Math.PI / 2 + rand(-.7, .7)]); }
      for (const [sx, sy, sa] of starts) {
        const pts = []; let x = sx, y = sy, ang = sa; const seg = rand(10, 16) * dpr, n = 30 + (Math.random() * 16 | 0);
        for (let i = 0; i < n; i++) { pts.push([x, y]); ang += rand(-.28, .28); x += Math.cos(ang) * seg; y += Math.sin(ang) * seg; }
        vines.push({ pts, spikes: pts.map((_, i) => i % 2 ? (Math.random() < .5 ? 1 : -1) * rand(.6, 1.2) : 0), w: rand(2, 4.5) * dpr, flowers: pts.map((_, i) => i > 4 && Math.random() < .14), ph: rand(0, 6.28) });
      }
      // 从底部伸上来的手
      hands = Array.from({ length: 11 }, (_, i) => ({ x: (i + .5) / 11 * W + rand(-20, 20) * dpr, h: rand(.18, .38) * H, s: rand(.8, 1.3) * dpr, tilt: rand(-.35, .35), ph: rand(0, 6.28), spread: rand(.1, .35), delay: Math.random() }));
      drips = [];
      cracks = [];
    }
    function newAsh(any) { return { x: rand(0, W), y: any ? rand(0, H) : -10 * dpr, r: rand(.8, 2.4) * dpr, vy: rand(.3, .9) * dpr, ph: rand(0, 6.28), rot: rand(0, 6.28) }; }
    function newEmber(any) { return { x: rand(0, W), y: any ? rand(0, H) : H + 10 * dpr, r: rand(1, 2.6) * dpr, vy: rand(.4, 1.3) * dpr, ph: rand(0, 6.28) }; }
    function newDrip() { const m = Math.min(H * .38, 320 * dpr), big = Math.random() < .35, sc = Math.min(1.5, Math.max(.8, W / dpr / 700));
      return { x: rand(.02, .98) * W, len: 0, max: rand(.2, 1) * m, v: rand(.25, .9) * dpr, w: (big ? rand(12, 22) : rand(6, 12)) * dpr * sc, pause: 0, k: rand(.3, .7), bead: 0 }; }
    let falling = [], filmPh = rand(0, 6.28);
    function drawHand(g, x, base, h, s, tilt, spread, grab) {
      g.save(); g.translate(x, base); g.rotate(tilt);
      const armW = 26 * s, palmW = 44 * s, palmH = 50 * s;
      g.fillRect(-armW / 2, -h, armW, h + 10 * dpr);                                      // 手臂
      g.beginPath(); g.ellipse(0, -h - palmH * .3, palmW / 2, palmH / 2, 0, 0, 6.29); g.fill();   // 手掌
      const fingers = [[-.4, 0.95, -.35], [-.15, 1.15, -.1], [.1, 1.2, .05], [.32, 1.05, .2]];
      for (const [fx0, fl, fa] of fingers) { // 四根手指，抓握时弯曲
        g.save(); g.translate(fx0 * palmW, -h - palmH * .65); g.rotate(fa * (1 + spread) - grab * .5 * Math.sign(fx0 + .01));
        g.beginPath(); g.roundRect ? g.roundRect(-5 * s, -fl * 42 * s, 10 * s, fl * 42 * s, 5 * s) : g.rect(-5 * s, -fl * 42 * s, 10 * s, fl * 42 * s); g.fill(); g.restore();
      }
      g.save(); g.translate(-palmW * .5, -h - palmH * .15); g.rotate(-.9 - spread); g.beginPath(); g.roundRect ? g.roundRect(-5 * s, -34 * s, 11 * s, 34 * s, 5 * s) : g.rect(-5 * s, -34 * s, 11 * s, 34 * s); g.fill(); g.restore(); // 拇指
      g.restore();
    }

    let t = 0, started = false, lastBeat = 0, ema = .2, pulse = 0, dawn = 0, grow = 0, crossA = 0, shake = 0, hell = 0, reach = 0, bleed = 0, live = null, lc = null;
    function draw(I, level, fx) {
      t++;
      if (!ensureCanvas()) return;
      const now = window.__time || 0, playing = !!window.__playing, bass = window.__bass || 0;
      if (playing && !started) { started = true; cv2.style.opacity = 1; }
      ema += (bass - ema) * .05;
      if (playing && bass > ema * 1.2 && bass > .3 && now - lastBeat > .35) { lastBeat = now; pulse = 1; if (inWin(V.steps, now, 4.5)) { shake = 1; for (let k = 0; k < 10; k++) dust.push({ x: rand(.05, .95) * W, y: H - rand(0, 24) * dpr, vx: rand(-1.2, 1.2) * dpr, vy: -rand(.5, 2.4) * dpr, a: .45 }); } }
      pulse *= .9; shake *= .85;
      dawn += ((now >= dawnAt ? 1 : 0) - dawn) * .006;
      grow += ((playing ? Math.min(1, .25 + now / 60) : grow) * (1 - dawn * .25) - grow) * .01;
      crossA += ((inWin(V.cross, now, 10) ? 1 : 0) - crossA) * .02;
      hell += (((inWin(V.hell, now, 6) ? 1 : 0) + .25) * (1 - dawn) - hell) * .03;      // 地狱的裂缝亮度
      reach += (((inWin(V.reach, now, 9) ? 1 : 0) * .7 + .3 + level * .3) * (1 - dawn) - reach) * .02;  // 手伸多高

      // ── 封面：默片 ──
      if (started) {
        c2.globalCompositeOperation = "source-over"; c2.fillStyle = "#000"; c2.fillRect(0, 0, S, S);
        const i = shotAt(now), sh = shots[i], fadeIn = Math.min(1, (now - sh[0]) / 1.4);
        if (fadeIn < 1 && i > 0) drawShot(i - 1, now, 1, pulse);
        drawShot(i, now, fadeIn, pulse);
        c2.fillStyle = `rgba(0,0,0,${.06 + Math.random() * .06})`; c2.fillRect(0, 0, S, S);
        c2.globalCompositeOperation = "overlay"; c2.globalAlpha = .22;
        const gr = grain[t % grain.length], ox = Math.random() * 64, oy = Math.random() * 64;
        for (let gx = -ox; gx < S; gx += 256) for (let gy = -oy; gy < S; gy += 256) c2.drawImage(gr, gx, gy);
        c2.globalCompositeOperation = "source-over"; c2.globalAlpha = 1;
        if (Math.random() < .03) { c2.fillStyle = "rgba(255,255,255,.08)"; c2.fillRect(Math.random() * S, 0, 1.5 * dpr, S); }
        const vg = c2.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S * .75);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${.7 - dawn * .3})`); c2.fillStyle = vg; c2.fillRect(0, 0, S, S);
        if (dawn > .01) { const lg = c2.createLinearGradient(0, 0, 0, S); lg.addColorStop(0, `rgba(255,230,190,${.22 * dawn})`); lg.addColorStop(1, "rgba(255,230,190,0)"); c2.fillStyle = lg; c2.fillRect(0, 0, S, S); }
        // 整页背景 = 当前镜头放大模糊
        if (!live) {
          live = document.createElement("canvas"); live.width = live.height = 64; lc = live.getContext("2d");
          live.style.cssText = "position:fixed;inset:-12%;width:124%;height:124%;z-index:-3;filter:blur(30px) brightness(.42) contrast(1.15);pointer-events:none;opacity:0;transition:opacity 2s";
          document.body.insertBefore(live, document.body.firstChild);
          const bd = document.querySelector(".backdrop"); if (bd) { bd.style.transition = "opacity 2s"; bd.style.opacity = ".1"; }
          requestAnimationFrame(() => (live.style.opacity = 1));
        }
        lc.drawImage(cv2, 0, 0, 64, 64);
      }

      // ── 背景 ──
      ctx.save(); if (shake > .02) ctx.translate(rand(-1, 1) * 5 * dpr * shake, rand(-1, 1) * 5 * dpr * shake);
      const wrap = document.querySelector(".cover-wrap"), rc = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerWidth };
      const cx = (rc.left + rc.width / 2) * dpr, cy = (rc.top + rc.height / 2) * dpr, R = Math.max(rc.width, rc.height) * dpr * .5;
      if (!cracks.length && wrap) for (let k = 0; k < 11; k++) { const a = k / 11 * 6.28 + rand(-.2, .2); crackPath(cx + Math.cos(a) * R * .98, cy + Math.sin(a) * R * .98, a, R * rand(.35, .8), 0, cracks); }
      // 暗红烟雾
      for (const m of smoke) { m.x += m.vx; m.y += m.vy; if (m.x < -m.r) m.x = W + m.r; if (m.x > W + m.r) m.x = -m.r; if (m.y < -m.r) m.y = H + m.r;
        ctx.globalAlpha = (.55 + .25 * Math.sin(t * .005 + m.ph)) * I * (1 - dawn * .7); ctx.drawImage(SMOKE, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2); }
      ctx.globalAlpha = 1;
      // 心跳红光
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .75);
      g.addColorStop(0, `rgba(190,22,30,${(.2 + pulse * .25) * I * (1 - dawn * .85)})`); g.addColorStop(1, "rgba(120,10,16,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 地狱的裂缝：发光的红色裂纹，跟着心跳明暗；黎明时变成金色然后愈合
      if (hell > .02 && dawn < .98) {
        const glow = Math.min(1, (hell + pulse * .35) * (1 - dawn) * (1 - dawn));
        const col = "255,70,40";
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (const c of cracks) {
          for (const [lw, al] of [[c.w * 5, .12], [c.w * 2, .35], [c.w * .7, .95]]) {
            ctx.strokeStyle = `rgba(${col},${al * glow * I})`; ctx.lineWidth = lw; ctx.beginPath();
            c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
          }
        }
      }
      // 巨大的光十字 + 带十字的手
      if (crossA > .01) {
        const ch = H * .95, cw = ch * .55, x0 = W / 2, y0 = H * .48;
        g = ctx.createLinearGradient(x0, y0 - ch / 2, x0, y0 + ch / 2); g.addColorStop(0, `rgba(255,120,110,${.22 * crossA})`); g.addColorStop(1, "rgba(255,90,80,0)");
        ctx.fillStyle = g; ctx.fillRect(x0 - ch * .035, y0 - ch / 2, ch * .07, ch); ctx.fillRect(x0 - cw / 2, y0 - ch * .26, cw, ch * .07);
        if (hand.complete && hand.naturalWidth) { const hh = H * .8, hw = hh * hand.naturalWidth / hand.naturalHeight; ctx.globalAlpha = .18 * crossA; ctx.drawImage(hand, x0 - hw / 2, H - hh + (1 - crossA) * 80 * dpr, hw, hh); ctx.globalAlpha = 1; }
      }
      // 从底部伸上来的手：用你插画里的手（抠出来的），指尖被上方的红光照亮
      if (reach > .02 && handsImg.complete && handsImg.naturalWidth) {
        if (!handsLit) { // 预先做一份染色版：指尖偏红、手腕往下渐暗
          handsLit = document.createElement("canvas"); handsLit.width = handsImg.naturalWidth; handsLit.height = handsImg.naturalHeight;
          const hg = handsLit.getContext("2d"); hg.drawImage(handsImg, 0, 0); hg.globalCompositeOperation = "source-atop";
          const lg = hg.createLinearGradient(0, 0, 0, handsLit.height); lg.addColorStop(0, "rgba(200,40,40,.45)"); lg.addColorStop(.5, "rgba(80,10,12,.35)"); lg.addColorStop(1, "rgba(0,0,0,.75)");
          hg.fillStyle = lg; hg.fillRect(0, 0, handsLit.width, handsLit.height);
        }
        const r = handsLit.height / handsLit.width;
        // 宽屏时不放大，而是并排多放几组（交替镜像），大小按屏幕高度来
        const row = (wid, hgt, y, alpha, mirror0, swayK) => {
          const n = Math.ceil(W / wid / 2) + 1;
          for (let k = -n; k <= n; k++) {
            ctx.save(); ctx.globalAlpha = alpha; ctx.translate(W / 2 + k * wid + Math.sin(t * .006 * swayK + k) * 10 * dpr, y);
            if ((k + mirror0) % 2) ctx.scale(-1, 1);
            ctx.drawImage(handsLit, -wid / 2, 0, wid, hgt); ctx.restore();
          }
        };
        const bw = Math.min(W * 1.1, H * 1.15), bh = bw * r;
        row(bw, bh, H - bh * Math.min(1, reach * .85) + bh * .12, .45 * I, 1, 1);
        const fw = Math.min(W * 1.45, H * 1.4), fh = fw * r;
        row(fw, fh, H - fh * Math.min(1, reach) + fh * .05 + Math.sin(t * .01) * 4 * dpr, I, 0, 1.3);
        ctx.globalAlpha = 1;
      }
      // 荆棘：粗枝 + 尖刺 + 红色轮廓光；黎明时开出白色小花
      ctx.lineCap = "round";
      for (const v of vines) {
        const n = Math.floor(v.pts.length * grow); if (n < 2) continue;
        const sway = i => Math.sin(t * .008 + v.ph + i * .2) * i * .15 * dpr;
        for (const [col, extra] of [[`rgba(150,20,24,${.4 * I * (1 - dawn * .6)})`, 2 * dpr], [`rgba(8,6,6,${.95 * I})`, 0]]) {
          ctx.strokeStyle = col; ctx.fillStyle = col;
          ctx.lineWidth = v.w + extra; ctx.beginPath(); ctx.moveTo(v.pts[0][0], v.pts[0][1]);
          for (let i = 1; i < n; i++) ctx.lineTo(v.pts[i][0] + sway(i), v.pts[i][1]); ctx.stroke();
          for (let i = 1; i < n; i++) if (v.spikes[i]) {
            const x = v.pts[i][0] + sway(i), y = v.pts[i][1], a = Math.atan2(y - v.pts[i - 1][1], x - v.pts[i - 1][0] - sway(i - 1)) + v.spikes[i] * 1.1, L = (8 + v.w) * 1.4 + extra;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a + 1.57) * v.w * .6, y + Math.sin(a + 1.57) * v.w * .6); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.lineTo(x + Math.cos(a - 1.57) * v.w * .6, y + Math.sin(a - 1.57) * v.w * .6); ctx.fill();
          }
        }
        if (dawn > .05) for (let i = 1; i < n; i++) if (v.flowers[i]) {
          const x = v.pts[i][0] + sway(i), y = v.pts[i][1], fs = (4 + 3 * Math.sin(i)) * dpr * Math.min(1, dawn * 1.5);
          for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + t * .002; ctx.fillStyle = `rgba(250,246,240,${.85 * dawn})`; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * fs, y + Math.sin(a) * fs, fs * .8, fs * .5, a, 0, 6.29); ctx.fill(); }
          ctx.fillStyle = `rgba(255,214,120,${dawn})`; ctx.beginPath(); ctx.arc(x, y, fs * .45, 0, 6.29); ctx.fill();
        }
      }
      // 灰烬 / 火星
      for (const a of ash) {
        a.y += a.vy * (1 - dawn); a.x += Math.sin(t * .01 + a.ph) * .3 * dpr; a.rot += .02;
        if (a.y > H + 10) Object.assign(a, newAsh(false));
        ctx.fillStyle = `rgba(165,158,150,${(.25 + .2 * Math.sin(t * .02 + a.ph)) * I * (1 - dawn)})`;
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot); ctx.fillRect(-a.r, -a.r * .5, a.r * 2, a.r); ctx.restore();
      }
      for (const e of embers) {
        e.y -= e.vy * (1 + hell); e.x += Math.sin(t * .02 + e.ph) * .5 * dpr; if (e.y < -10) Object.assign(e, newEmber(false));
        const a = (.35 + .5 * Math.sin(t * .05 + e.ph) ** 2) * I * (1 - dawn);
        g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4); g.addColorStop(0, `rgba(255,100,50,${a})`); g.addColorStop(1, "rgba(255,60,30,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, 6.29); ctx.fill();
      }
      dust = dust.filter(d => (d.a *= .96) > .02);
      for (const d of dust) { d.x += d.vx; d.y += d.vy; d.vy += .02 * dpr; ctx.fillStyle = `rgba(150,140,130,${d.a})`; ctx.beginPath(); ctx.arc(d.x, d.y, 2.2 * dpr, 0, 6.29); ctx.fill(); }
      // 黎明
      if (dawn > .01) {
        g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,216,170,${.34 * dawn})`); g.addColorStop(.6, `rgba(255,190,150,${.09 * dawn})`); g.addColorStop(1, "rgba(255,190,150,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const sg = ctx.createRadialGradient(W / 2, -H * .1, 0, W / 2, -H * .1, Math.max(W, H) * .8);
        sg.addColorStop(0, `rgba(255,232,195,${.28 * dawn})`); sg.addColorStop(.5, `rgba(255,214,170,${.08 * dawn})`); sg.addColorStop(1, "rgba(255,210,170,0)");
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        for (const l of lights) { l.y -= l.v; if (l.y < -10) { l.y = H + 10; l.x = rand(0, W); }
          const a = dawn * (.25 + .35 * Math.sin(t * .03 + l.ph) ** 2), gg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 3);
          gg.addColorStop(0, `rgba(255,236,200,${a})`); gg.addColorStop(1, "rgba(255,230,190,0)"); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 3, 0, 6.29); ctx.fill(); }
      }
      ctx.restore();
    }
    return { init, draw, wet: false };
  };

  // ═════════ 幻影：画面从中间分成两个世界 ═════════
  // 左边 = 我的幻象（冷色，倒挂的城市从天上垂下来，光点往上飘）
  // 右边 = 你的现实（暖色，曼哈顿的天际线立在地上，光点往下落）
  // 中间一道发光的缝正好在两人指尖之间；两根“命运的线”从两边靠近，只在歌词唱到时交错一下又分开
  // 点屏幕：点到的那边荡开涟漪，另一个世界在镜像的位置也荡开一圈
  SCENES.illusion = (song) => {
    const ev = song.events || {}, tgt = song.sparkTarget || [.5, .44];
    const COOL = [150, 170, 255], WARM = [255, 190, 130];
    let city = [], up = [], down = [], ripples = [], waves = [], seamX = 0, lastNow = 0;
    const inWin = (list, now, len) => (list || []).some(t0 => now >= t0 && now < t0 + len);
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      city = []; let x = -10 * dpr;
      while (x < W + 20 * dpr) { const bw = rand(26, 60) * dpr, bh = H * rand(.08, .24) * (Math.random() < .12 ? 1.5 : 1);
        const wins = []; for (let wy = 8 * dpr; wy < bh - 6 * dpr; wy += 11 * dpr) for (let wx = 5 * dpr; wx < bw - 6 * dpr; wx += 9 * dpr) if (Math.random() < .3) wins.push([wx, wy, Math.random()]);
        city.push({ x, w: bw, h: bh, wins, spire: Math.random() < .12 }); x += bw + rand(0, 5) * dpr; }
      up = Array.from({ length: Math.round(60 * area) }, () => ({ x: rand(0, 1), y: rand(0, H), r: rand(1, 2.6) * dpr, v: rand(.2, .7) * dpr, ph: rand(0, 6.28) }));
      down = Array.from({ length: Math.round(60 * area) }, () => ({ x: rand(0, 1), y: rand(0, H), r: rand(1, 2.6) * dpr, v: rand(.2, .7) * dpr, ph: rand(0, 6.28) }));
    }
    addEventListener("pointerdown", e => {
      if (e.target.closest && e.target.closest("button,.bar,.ly-line,a,.gate")) return;
      const x = e.clientX * dpr, y = e.clientY * dpr, left = x < seamX;
      ripples.push({ x, y, r: 0, a: .6, col: left ? COOL : WARM });
      ripples.push({ x: 2 * seamX - x, y, r: 0, a: .45, col: left ? WARM : COOL, delay: 12 });   // 另一个世界的镜像
    });
    function skyline(g, side, I, level, t) { // side: -1 左边倒挂在上方，1 右边立在下方
      g.save(); g.beginPath(); side < 0 ? g.rect(0, 0, seamX, H) : g.rect(seamX, 0, W - seamX, H); g.clip();
      const col = side < 0 ? "16,18,40" : "30,20,14";
      for (const b of city) {
        const y0 = side < 0 ? 0 : H - b.h;
        g.fillStyle = `rgba(${col},${.75 * I})`; g.fillRect(b.x, y0, b.w, b.h);
        if (b.spire) { g.beginPath(); if (side < 0) { g.moveTo(b.x + b.w * .3, b.h); g.lineTo(b.x + b.w * .5, b.h + 36 * dpr); g.lineTo(b.x + b.w * .7, b.h); } else { g.moveTo(b.x + b.w * .3, H - b.h); g.lineTo(b.x + b.w * .5, H - b.h - 36 * dpr); g.lineTo(b.x + b.w * .7, H - b.h); } g.fill(); }
        for (const [wx, wy, k] of b.wins) { if (k < .55 - level * .3) continue;
          const a = (.25 + .3 * Math.sin(t * .01 + k * 9) ** 2) * I, c = side < 0 ? COOL : WARM;
          g.fillStyle = `rgba(${c},${a})`; g.fillRect(b.x + wx, side < 0 ? b.h - wy - 4 * dpr : H - b.h + wy, 3 * dpr, 4 * dpr); }
      }
      g.restore();
    }
    let t = 0, glow = 0, cross = 0, dark = 0, beam = 0, end = 0;
    function draw(I, level, fx) {
      t++;
      const now = window.__time || 0, playing = !!window.__playing;
      const wrap = document.querySelector(".cover-wrap"), img = document.getElementById("cover");
      const rc = wrap ? wrap.getBoundingClientRect() : { left: 0, width: innerWidth };
      seamX = (rc.left + rc.width / 2) * dpr;
      glow += (((inWin(ev.cross, now, 6) || inWin(ev.touch, now, 5)) ? 1 : .35 + level * .3) - glow) * .04;
      cross += ((inWin(ev.fate, now, 6) ? 1 : 0) - cross) * .03;
      dark += ((inWin(ev.dark, now, 5) ? 1 : 0) - dark) * .03;
      beam += ((inWin(ev.search, now, 6) ? 1 : 0) - beam) * .03;
      end += ((inWin(ev.end, now, 30) ? 1 : 0) - end) * .01;

      // 两个世界的底色
      let g = ctx.createLinearGradient(0, 0, seamX, 0); g.addColorStop(0, `rgba(40,46,110,${.32 * I})`); g.addColorStop(1, `rgba(80,70,170,${.18 * I})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, seamX, H);
      g = ctx.createLinearGradient(seamX, 0, W, 0); g.addColorStop(0, `rgba(190,120,70,${.16 * I})`); g.addColorStop(1, `rgba(150,80,40,${.3 * I})`);
      ctx.fillStyle = g; ctx.fillRect(seamX, 0, W - seamX, H);
      // 城市：左边倒挂、右边立着
      skyline(ctx, -1, I * (1 - end * .7), level, t); skyline(ctx, 1, I * (1 - end * .7), level, t);
      // “深埋地底的黑暗”：底部涌上来一片暗
      if (dark > .01) { g = ctx.createLinearGradient(0, H, 0, H * .4); g.addColorStop(0, `rgba(0,0,0,${.7 * dark})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // “寻找光”：幻象那边一道光慢慢扫过
      if (beam > .01) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, seamX, H); ctx.clip(); ctx.translate(seamX * .5 + Math.sin(t * .01) * seamX * .4, -20 * dpr); ctx.rotate(Math.sin(t * .007) * .4);
        g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(210,220,255,${.22 * beam})`); g.addColorStop(1, "rgba(200,210,255,0)"); ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-6 * dpr, 0); ctx.lineTo(6 * dpr, 0); ctx.lineTo(90 * dpr, H); ctx.lineTo(-90 * dpr, H); ctx.fill(); ctx.restore(); }
      // 光点：幻象往上飘，现实往下落
      for (const p of up) { p.y -= p.v * (1 + level); if (p.y < -5) p.y = H + 5; const x = p.x * seamX + Math.sin(t * .01 + p.ph) * 6 * dpr;
        ctx.fillStyle = `rgba(${COOL},${(.25 + .35 * Math.sin(t * .03 + p.ph) ** 2) * I})`; ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.29); ctx.fill(); }
      for (const p of down) { p.y += p.v * (1 + level); if (p.y > H + 5) p.y = -5; const x = seamX + p.x * (W - seamX) + Math.sin(t * .01 + p.ph) * 6 * dpr;
        ctx.fillStyle = `rgba(${WARM},${(.25 + .35 * Math.sin(t * .03 + p.ph) ** 2) * I})`; ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.29); ctx.fill(); }
      // 命运的线：从两边伸向中间。平时停在缝前，唱到时交错穿过又分开
      const thread = (side, col, ph) => {
        const reachX = seamX - side * 14 * dpr + side * -cross * W * .28;   // 交错时越过中线
        ctx.strokeStyle = `rgba(${col},${(.45 + cross * .35) * I})`; ctx.lineWidth = 1.6 * dpr; ctx.shadowColor = `rgba(${col},.8)`; ctx.shadowBlur = 8 * dpr;
        ctx.beginPath(); const x0 = side < 0 ? 0 : W;
        for (let k = 0; k <= 60; k++) { const p = k / 60, x = x0 + (reachX - x0) * p, y = H * .5 + Math.sin(p * 7 + t * .02 + ph) * H * .12 * (1 - p * .6) + Math.sin(p * 17 + t * .03) * 6 * dpr;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke(); ctx.shadowBlur = 0;
      };
      thread(-1, COOL, 0); thread(1, WARM, 2);
      // 中间的缝
      g = ctx.createLinearGradient(seamX - 40 * dpr, 0, seamX + 40 * dpr, 0);
      g.addColorStop(0, "rgba(200,200,255,0)"); g.addColorStop(.5, `rgba(240,236,255,${(.18 + glow * .35 + end * .3) * I})`); g.addColorStop(1, "rgba(255,220,200,0)");
      ctx.fillStyle = g; ctx.fillRect(seamX - (40 + end * 120) * dpr, 0, (80 + end * 240) * dpr, H);
      ctx.fillStyle = `rgba(255,255,255,${(.35 + glow * .5) * I})`; ctx.fillRect(seamX - .6 * dpr, 0, 1.2 * dpr, H);
      // “すれ違う声”：两边各自发出的声波，彼此穿过
      if (playing) { for (const t0 of ev.voices || []) if (t0 > lastNow && t0 <= now) for (let k = 0; k < 3; k++) { waves.push({ x: seamX * .3, col: COOL, born: t + k * 25 }); waves.push({ x: seamX + (W - seamX) * .7, col: WARM, born: t + k * 25 }); } lastNow = now; }
      waves = waves.filter(w => t - w.born < 240);
      for (const w of waves) { const age = (t - w.born) / 240; if (age < 0) continue; const r = age * W * .9;
        ctx.strokeStyle = `rgba(${w.col},${.35 * (1 - age)})`; ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); ctx.arc(w.x, H * .5, r, 0, 6.29); ctx.stroke(); }
      // 涟漪（最上层）
      ripples = ripples.filter(r => (r.a *= .965) > .01);
      for (const r of ripples) { if (r.delay > 0) { r.delay--; continue; } r.r += 2.2 * dpr;
        for (let k = 0; k < 3; k++) { const rr = r.r - k * 14 * dpr; if (rr <= 0) continue; fx.strokeStyle = `rgba(${r.col},${r.a * (1 - k * .3)})`; fx.lineWidth = 1.4 * dpr; fx.beginPath(); fx.arc(r.x, r.y, rr, 0, 6.29); fx.stroke(); } }
      // 指尖相触：唱到 “触れて / 触れ合う一瞬” 时，封面里两人的指尖之间亮起一点光，然后消散
      if (img) for (const t0 of ev.touch || []) {
        const d = now - t0; if (d < 0 || d > 5) continue;
        const r = img.getBoundingClientRect(), x = (r.left + r.width * tgt[0]) * dpr, y = (r.top + r.height * tgt[1]) * dpr;
        const a = Math.min(1, d * 2.5) * Math.max(0, 1 - Math.max(0, d - 2.5) / 2.5), R = (14 + d * 22) * dpr;
        g = fx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(255,255,255,${.95 * a})`); g.addColorStop(.25, `rgba(230,215,255,${.5 * a})`); g.addColorStop(1, "rgba(220,200,255,0)");
        fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, R, 0, 6.29); fx.fill();
        for (const [col, dir] of [[COOL, -1], [WARM, 1]]) { fx.strokeStyle = `rgba(${col},${.5 * a})`; fx.lineWidth = 1.5 * dpr; fx.beginPath(); fx.arc(x + dir * d * 6 * dpr, y, d * 30 * dpr, 0, 6.29); fx.stroke(); }
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 从海面沉入深海，最后在深渊里看见银河 ═════════
  // 阶段（秒数在 songs.js 的 phases 里）：海面 → 入水（水面从底部涨上来）→ 下沉（越来越暗、越来越模糊、音乐变闷）
  // → 深渊（漆黑里出现发光生物）→ 绽放（“海はなんて美しいんだろう”）→ 银河（光点化成星星，展开整片银河）
  SCENES.abyss = (song) => {
    const P = song.phases || {};
    const seg = (now, a, b) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    let snow = [], bubbles = [], plankton = [], jellies = [], stars = [], shooting = [], galaxyImg = null, foam = [];
    const pick = a => a[(Math.random() * a.length) | 0];
    function buildGalaxy() { // 银河预先画好（几千颗星 + 星云），每帧只贴一次，手机也跑得动
      const L = Math.hypot(W, H), c = document.createElement("canvas"); c.width = c.height = Math.ceil(L); const g = c.getContext("2d");
      const ang = W < H ? -1.05 : -.55, cx = L / 2, cy = L / 2 - H * .05;
      const along = (u, v) => [cx + Math.cos(ang) * u - Math.sin(ang) * v, cy + Math.sin(ang) * u + Math.cos(ang) * v];
      // 星云：沿着银河带的彩色光雾
      const neb = [[120, 80, 255], [255, 90, 190], [80, 170, 255], [190, 120, 255], [255, 170, 120]];
      for (let k = 0; k < 70; k++) {
        const u = rand(-.6, .6) * L, v = (Math.random() - .5) * H * .22 * (1 - Math.abs(u) / L), [x, y] = along(u, v), r = rand(.06, .2) * L, col = pick(neb);
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${rand(.06, .15)})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // 银河中心的亮带
      for (let k = 0; k < 40; k++) { const u = rand(-.55, .55) * L, [x, y] = along(u, (Math.random() - .5) * H * .05), r = rand(.04, .1) * L;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,240,225,.13)"); gr.addColorStop(1, "rgba(255,235,220,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      // 暗尘带
      g.globalCompositeOperation = "destination-out";
      for (let k = 0; k < 26; k++) { const u = rand(-.5, .5) * L, [x, y] = along(u, (Math.random() - .5) * H * .03), r = rand(.02, .05) * L;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.globalCompositeOperation = "source-over";
      // 星星：银河带里密，外面稀
      const n = Math.round(3400 * Math.min(1.6, (W * H) / (dpr * dpr) / 330000));
      for (let k = 0; k < n; k++) {
        let x, y; if (Math.random() < .6) { const u = rand(-.65, .65) * L, v = (Math.random() + Math.random() + Math.random() - 1.5) * H * .14; [x, y] = along(u, v); } else { x = rand(0, L); y = rand(0, L); }
        const r = Math.random() ** 3 * 1.4 * dpr + .3 * dpr, hue = Math.random() < .2 ? (Math.random() < .5 ? "200,220,255" : "255,225,200") : "255,255,255";
        g.fillStyle = `rgba(${hue},${rand(.35, 1)})`; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
      }
      return c;
    }
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      snow = Array.from({ length: Math.round(110 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(.5, 1.8) * dpr, v: rand(.2, .7) * dpr, ph: rand(0, 6.28) }));
      plankton = Array.from({ length: Math.round(170 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(.8, 2.4) * dpr, ph: rand(0, 6.28), sp: rand(.5, 1.6), k: Math.random(), col: pick(["120,230,255", "90,200,255", "160,140,255", "110,255,220"]), vx: rand(-.15, .15) * dpr, vy: rand(-.25, -.05) * dpr }));
      jellies = Array.from({ length: 5 }, (_, i) => ({ x: rand(.1, .9) * W, y: rand(.3, 1.1) * H, s: rand(18, 38) * dpr, ph: rand(0, 6.28), v: rand(.15, .35) * dpr, k: i / 5, col: pick(["150,220,255", "190,160,255", "120,255,230"]) }));
      stars = Array.from({ length: Math.round(160 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(.6, 1.8) * dpr, ph: rand(0, 6.28), sp: rand(.5, 2) }));
      foam = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(.78, 1) * H, w: rand(20, 80) * dpr, ph: rand(0, 6.28) }));
      galaxyImg = buildGalaxy();
    }
    function jelly(g, j, t, a) { // 发光水母：半透明的伞 + 飘动的触须，一收一放地游
      const pulse = .85 + .15 * Math.sin(t * .04 + j.ph), s = j.s * pulse;
      const gl = g.createRadialGradient(j.x, j.y, 0, j.x, j.y, s * 3); gl.addColorStop(0, `rgba(${j.col},${.25 * a})`); gl.addColorStop(1, `rgba(${j.col},0)`);
      g.fillStyle = gl; g.beginPath(); g.arc(j.x, j.y, s * 3, 0, 6.29); g.fill();
      g.strokeStyle = `rgba(${j.col},${.5 * a})`; g.lineWidth = 1 * dpr;
      for (let k = 0; k < 6; k++) { const x0 = j.x + (k - 2.5) / 2.5 * s * .8; g.beginPath(); g.moveTo(x0, j.y);
        for (let q = 1; q <= 10; q++) g.lineTo(x0 + Math.sin(t * .03 + k + q * .5 + j.ph) * 4 * dpr, j.y + q * s * .28); g.stroke(); }
      const bell = g.createRadialGradient(j.x, j.y - s * .3, 0, j.x, j.y, s);
      bell.addColorStop(0, `rgba(255,255,255,${.55 * a})`); bell.addColorStop(.5, `rgba(${j.col},${.35 * a})`); bell.addColorStop(1, `rgba(${j.col},${.08 * a})`);
      g.fillStyle = bell; g.beginPath(); g.ellipse(j.x, j.y, s, s * .7 * (2 - pulse), 0, Math.PI, 0); g.quadraticCurveTo(j.x, j.y + s * .25, j.x - s, j.y); g.fill();
    }
    let t = 0, lastBubble = 0, lp = 22000, coverF = "";
    function draw(I, level, fx) {
      t++;
      const now = window.__time || 0, playing = !!window.__playing;
      const rise = seg(now, P.enter, P.under);                                      // 水面上涨 0→1
      const depth = seg(now, P.under, P.head) * .7 + seg(now, P.head, P.abyss) * .3; // 越来越深 0→1
      const bio = Math.max(seg(now, P.abyss, P.bloom) * .35, seg(now, P.bloom, P.bloom + 5));   // 发光生物
      const gal = seg(now, P.melt, P.dream);                                        // 银河 0→1
      const fade = seg(now, P.light, P.light + 5) * (1 - seg(now, P.light + 6, P.dream));      // “光离我而去”：短暂暗下去
      // 音乐变闷：只剩呼吸声时沉下去，“意識は澄んでいく”时清澈回来
      if (window.__lowpass) {
        const m = Math.max(seg(now, P.muffle, P.muffle + 5) * (1 - seg(now, P.clear, P.clear + 6)), 0);
        const want = Math.round(22000 * Math.pow(900 / 22000, m));
        if (Math.abs(want - lp) > 50) { lp = want; window.__lowpass(lp); }
      }
      // 封面：沉得越深越暗、越冷、越模糊；银河时亮回来一些
      const wrapImg = document.getElementById("cover");
      const blur = seg(now, P.blur, P.blur + 6) * (1 - seg(now, P.clear, P.clear + 8)) * 2.2;
      const br = 1 - depth * .55 + gal * .3, sat = 1 - depth * .4 + gal * .2, hue = -depth * 25;
      const f = `brightness(${br.toFixed(2)}) saturate(${sat.toFixed(2)}) hue-rotate(${hue.toFixed(0)}deg) blur(${blur.toFixed(1)}px)`;
      if (wrapImg && f !== coverF) { coverF = f; wrapImg.style.filter = f; }
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.opacity = String(1 - Math.max(depth, rise * .5) * .9);
      // 歌词发光的颜色：海面暖 → 深海青 → 银河淡紫
      const glow = gal > .3 ? "225,210,255" : rise > .5 ? "140,225,255" : "255,214,170";
      document.documentElement.style.setProperty("--glow", glow);

      // ── 1. 海面（夕阳 + 海浪 + 浪花） ──
      const surf = 1 - rise;
      if (surf > .01) {
        let g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(60,120,170,${.5 * surf})`); g.addColorStop(.45, `rgba(255,160,80,${.5 * surf})`); g.addColorStop(.62, `rgba(255,205,135,${.45 * surf})`); g.addColorStop(.63, `rgba(30,80,110,${.35 * surf})`); g.addColorStop(1, `rgba(20,60,80,${.45 * surf})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        g = ctx.createRadialGradient(W * .78, H * .6, 0, W * .78, H * .6, H * .6); g.addColorStop(0, `rgba(255,225,160,${.55 * surf})`); g.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.lineWidth = 1.2 * dpr;
        for (let k = 0; k < 12; k++) { const y0 = H * (.64 + k * .03); ctx.strokeStyle = `rgba(255,${210 - k * 6},${160 - k * 6},${(.3 + level * .2) * surf * (1 - k * .05)})`; ctx.beginPath();
          for (let x = 0; x <= W; x += 14 * dpr) { const y = y0 + Math.sin(x * .01 / dpr + t * .02 + k) * (2 + k * .8) * dpr; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
        for (const fo of foam) { fo.x += .3 * dpr; if (fo.x > W + fo.w) fo.x = -fo.w; ctx.fillStyle = `rgba(255,250,240,${(.12 + .1 * Math.sin(t * .03 + fo.ph)) * surf})`; ctx.fillRect(fo.x, fo.y + Math.sin(t * .02 + fo.ph) * 3 * dpr, fo.w, 1.5 * dpr); }
      }
      // ── 2. 水下（随深度从青绿变深蓝再变黑），水面从底部涨上来 ──
      if (rise > 0) {
        const wl = H * (1 - rise);   // 水面所在高度
        const c1 = [22 - depth * 20, 110 - depth * 100, 130 - depth * 112], c2 = [8 - depth * 8, 50 - depth * 47, 80 - depth * 74];
        ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, wl);
        for (let x = 0; x <= W; x += 12 * dpr) ctx.lineTo(x, wl + Math.sin(x * .012 / dpr + t * .04) * 6 * dpr * (1 - rise * .6));
        ctx.lineTo(W, H); ctx.closePath(); ctx.clip();
        let g = ctx.createLinearGradient(0, wl, 0, H); g.addColorStop(0, `rgba(${c1.map(Math.round)},.92)`); g.addColorStop(1, `rgba(${c2.map(Math.round)},.97)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // 从水下往上看：水面的波光 + 光柱，越深越弱
        const light = (1 - depth) * (1 - fade * .5);
        if (light > .02) {
          ctx.strokeStyle = `rgba(200,245,255,${.2 * light})`; ctx.lineWidth = 1.5 * dpr;   // 焦散（水面的光纹）
          for (let k = 0; k < 9; k++) { ctx.beginPath(); const y0 = Math.max(wl, 0) + k * 14 * dpr;
            for (let x = 0; x <= W; x += 10 * dpr) { const y = y0 + Math.sin(x * .03 / dpr + t * .05 + k * 1.7) * 5 * dpr + Math.sin(x * .011 / dpr - t * .03 + k) * 7 * dpr; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.globalAlpha = 1 - k / 9; ctx.stroke(); } ctx.globalAlpha = 1;
          for (let k = 0; k < 6; k++) { ctx.save(); ctx.translate(W * (.1 + k * .17) + Math.sin(t * .005 + k) * 30 * dpr, Math.max(wl, 0) - 20 * dpr); ctx.rotate(.12 - k * .04);
            const lg = ctx.createLinearGradient(0, 0, 0, H * .9); lg.addColorStop(0, `rgba(190,240,255,${.16 * light * (.6 + .4 * Math.sin(t * .02 + k))})`); lg.addColorStop(1, "rgba(160,230,255,0)");
            ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-8 * dpr, 0); ctx.lineTo(8 * dpr, 0); ctx.lineTo((50 + k * 8) * dpr, H * .9); ctx.lineTo(-(50 + k * 8) * dpr, H * .9); ctx.fill(); ctx.restore(); }
        }
        // 海雪：往上飘（因为人在往下沉）
        for (const s of snow) { s.y -= s.v * (1 + depth); s.x += Math.sin(t * .01 + s.ph) * .2 * dpr; if (s.y < -5) { s.y = H + 5; s.x = rand(0, W); }
          ctx.fillStyle = `rgba(220,235,245,${(.25 + .25 * Math.sin(t * .02 + s.ph) ** 2) * (1 - gal) * Math.min(1, rise * 2)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); }
        // 气泡：呼吸时一串串冒上去，失去意识后就没有了
        const breath = rise > .1 && now < (P.head + 4);
        if (playing && breath && now - lastBubble > rand(2.6, 4)) { lastBubble = now;
          const wrap = document.querySelector(".cover-wrap"), rc = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerWidth };
          const bx = (rc.left + rc.width / 2) * dpr, by = (rc.top + rc.height * .9) * dpr;
          for (let k = 0; k < 14; k++) bubbles.push({ x: bx + rand(-30, 30) * dpr, y: by + rand(0, 40) * dpr, r: rand(2, 7) * dpr, v: rand(1.2, 2.6) * dpr, ph: rand(0, 6.28) }); }
        bubbles = bubbles.filter(b => (b.y -= b.v) > Math.max(wl, -20));
        for (const b of bubbles) { b.x += Math.sin(t * .1 + b.ph) * .6 * dpr;
          ctx.strokeStyle = "rgba(220,245,255,.55)"; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29); ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .25, 0, 6.29); ctx.fill(); }
        ctx.restore();
        // 水面那条亮线（还没完全没入水中的时候）
        if (rise < .98) { ctx.strokeStyle = `rgba(230,250,255,${.6 * (1 - rise)})`; ctx.lineWidth = 2 * dpr; ctx.beginPath();
          for (let x = 0; x <= W; x += 12 * dpr) { const y = wl + Math.sin(x * .012 / dpr + t * .04) * 6 * dpr * (1 - rise * .6); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      }
      // ── 3. 深渊里的发光生物 ──
      if (bio > .01) {
        for (const p of plankton) {
          if (p.k > bio * 1.05) continue;
          p.x += p.vx; p.y += p.vy; if (p.y < -5) { p.y = H + 5; p.x = rand(0, W); }
          // 银河时：发光生物慢慢变成星星（颜色变白，漂移停下）
          const tw = .4 + .6 * Math.sin(t * .03 * p.sp + p.ph) ** 2, col = gal > .5 ? "255,250,240" : p.col;
          const a = tw * bio * (1 - gal * .6), R = p.r * (2.5 + bio * 2);
          const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); gl.addColorStop(0, `rgba(${col},${a})`); gl.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.29); ctx.fill();
        }
        for (const j of jellies) { if (j.k > bio) continue; j.y -= j.v * (1 + .5 * Math.sin(t * .04 + j.ph)); j.x += Math.sin(t * .006 + j.ph) * .3 * dpr; if (j.y < -j.s * 4) { j.y = H + j.s * 2; j.x = rand(.1, .9) * W; } jelly(ctx, j, t, bio * (1 - gal * .7)); }
      }
      // 绽放时的光潮：一圈发光的波从封面中心荡到整个屏幕
      const wrapR = document.querySelector(".cover-wrap"), rcc = wrapR ? wrapR.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerWidth };
      const ccx = (rcc.left + rcc.width / 2) * dpr, ccy = (rcc.top + rcc.height / 2) * dpr, maxR = Math.hypot(W, H);
      const bw = now - P.bloom;
      if (bw > 0 && bw < 6) { const r = bw / 6 * maxR, a = 1 - bw / 6;
        for (const [dr, al, col] of [[0, .5, "140,240,255"], [-40, .3, "170,150,255"], [-90, .2, "120,255,220"]]) { const rr = r + dr * dpr; if (rr <= 0) continue;
          ctx.strokeStyle = `rgba(${col},${al * a})`; ctx.lineWidth = (10 - dr / 15) * dpr; ctx.beginPath(); ctx.arc(ccx, ccy, rr, 0, 6.29); ctx.stroke(); }
        for (const p of plankton) { const d = Math.hypot(p.x - ccx, p.y - ccy); if (Math.abs(d - r) < 60 * dpr) { const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
          gl.addColorStop(0, `rgba(${p.col},${.9 * a})`); gl.addColorStop(1, `rgba(${p.col},0)`); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 8, 0, 6.29); ctx.fill(); } } }
      // 宇宙打开：中心先爆开一片光，再慢慢褪去，露出银河
      const ow = now - P.dream;
      if (ow > -1.5 && ow < 7) { const a = ow < 0 ? (ow + 1.5) / 1.5 : Math.max(0, 1 - ow / 7), r = (ow < 0 ? (ow + 1.5) / 1.5 * .35 : .35 + ow / 7 * .9) * maxR;
        const gl = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, r); gl.addColorStop(0, `rgba(255,250,240,${.75 * a})`); gl.addColorStop(.3, `rgba(220,200,255,${.4 * a})`); gl.addColorStop(1, "rgba(160,140,255,0)");
        ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
        for (let k = 0; k < 24; k++) { const an = k / 24 * 6.28 + t * .002, L2 = r * (1.2 + .3 * Math.sin(k * 3.7)); ctx.strokeStyle = `rgba(255,250,240,${.18 * a})`; ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx + Math.cos(an) * L2, ccy + Math.sin(an) * L2); ctx.stroke(); } }
      // ── 4. 银河 ──
      if (gal > .01 && galaxyImg) {
        ctx.globalAlpha = gal * (1 - fade * .6); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * .00004); ctx.drawImage(galaxyImg, -galaxyImg.width / 2, -galaxyImg.height / 2); ctx.restore(); ctx.globalAlpha = 1;
        for (const s of stars) { const a = gal * (.3 + .7 * Math.sin(t * .02 * s.sp + s.ph) ** 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill();
          if (s.r > 1.5 * dpr) { ctx.fillStyle = `rgba(255,255,255,${a * .4})`; ctx.fillRect(s.x - s.r * 3, s.y - .4 * dpr, s.r * 6, .8 * dpr); ctx.fillRect(s.x - .4 * dpr, s.y - s.r * 3, .8 * dpr, s.r * 6); } }
        if (gal > .6 && Math.random() < .012) shooting.push({ x: rand(0, W), y: rand(0, H * .5), vx: rand(6, 11) * dpr * (Math.random() < .5 ? 1 : -1), vy: rand(2, 5) * dpr, life: 1 });
      }
      shooting = shooting.filter(s => (s.life -= .025) > 0);
      for (const s of shooting) { s.x += s.vx; s.y += s.vy;
        const g = ctx.createLinearGradient(s.x - s.vx * 10, s.y - s.vy * 10, s.x, s.y); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(255,255,255,${s.life})`);
        ctx.strokeStyle = g; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.moveTo(s.x - s.vx * 10, s.y - s.vy * 10); ctx.lineTo(s.x, s.y); ctx.stroke(); }
      // 封面上也蒙一层：水下的波光 / 银河的星光
      const img = wrapImg; if (img && (rise > .5 || gal > .1)) {
        const r = img.getBoundingClientRect(), x0 = r.left * dpr, y0 = r.top * dpr, w0 = r.width * dpr, h0 = r.height * dpr;
        fx.save(); fx.beginPath(); fx.rect(x0, y0, w0, h0); fx.clip();
        if (rise > .5 && depth < .9) { fx.strokeStyle = `rgba(190,240,255,${.12 * (rise - .5) * 2 * (1 - depth)})`; fx.lineWidth = 1.2 * dpr;
          for (let k = 0; k < 6; k++) { fx.beginPath(); for (let x = x0; x <= x0 + w0; x += 10 * dpr) { const y = y0 + h0 * (k + .5) / 6 + Math.sin(x * .03 / dpr + t * .05 + k) * 6 * dpr; x === x0 ? fx.moveTo(x, y) : fx.lineTo(x, y); } fx.stroke(); } }
        if (gal > .1) for (let k = 0; k < 14; k++) { const sx = x0 + ((k * 97.3 + 13) % 1) * w0, sy = y0 + (((k * 61.7) % 100) / 100) * h0 * .55; const a = gal * .8 * Math.sin(t * .03 + k) ** 2;
          fx.fillStyle = `rgba(255,255,255,${a})`; fx.beginPath(); fx.arc(sx, sy, 1.2 * dpr, 0, 6.29); fx.fill(); }
        fx.restore();
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 黑夜的野兽：红黑炭笔质感，鼓点驱动的震动、爪痕、封面故障；人群里的红眼、电线上的乌鸦、猎枪瞄准镜、速度线 ═════════
  SCENES.beast = (song) => {
    const ev = song.events || {};
    const inWin = (list, now, len) => (list || []).some(t0 => now >= t0 && now < t0 + len);
    const win = (list, now) => (list || []).some(([a, b]) => now >= a && now < b);
    let scratch = null, crowd = [], crows = [], claws = [], rings = [], ink = [], lines = [];
    function buildScratch() { // 预先画好红黑炭笔的划痕底纹
      const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
      g.lineCap = "round";
      for (let k = 0; k < Math.round(900 * Math.min(1.6, (W * H) / (dpr * dpr) / 330000)); k++) {
        const x = rand(0, W), y = rand(0, H), a = rand(-.6, .6) + (Math.random() < .5 ? 0 : Math.PI / 2.4), L = rand(20, 140) * dpr;
        g.strokeStyle = Math.random() < .7 ? `rgba(190,40,25,${rand(.04, .14)})` : `rgba(0,0,0,${rand(.1, .3)})`; g.lineWidth = rand(.6, 2.4) * dpr;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
      return c;
    }

    // ── 炭笔质感的工具：抖动的轮廓 + 交叉排线 ──
    const jit = (v, k) => v + (Math.random() - .5) * k * dpr;
    function sketchFill(g, path, dark, hatchCol, density) {
      g.save(); path(g); g.fillStyle = dark; g.fill(); g.clip();
      const bb = g.__bb || [0, 0, W, H]; g.lineCap = "round";
      for (let k = 0; k < density; k++) { // 斜向排线
        const x = rand(bb[0], bb[2]), y = rand(bb[1], bb[3]), a = Math.random() < .6 ? -1.05 : .5, L = rand(10, 40) * dpr;
        g.strokeStyle = Math.random() < .55 ? hatchCol : "rgba(0,0,0,.55)"; g.lineWidth = rand(.5, 1.4) * dpr;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
      g.restore();
      for (let k = 0; k < 2; k++) { g.save(); g.translate(rand(-1, 1) * dpr, rand(-1, 1) * dpr); path(g); g.strokeStyle = `rgba(0,0,0,${.5 - k * .2})`; g.lineWidth = (1.6 - k * .6) * dpr; g.stroke(); g.restore(); } // 叠两道笔触的轮廓
    }
    // 纽约街区：高低错落、逐层收窄、水塔、天线、空调箱、消防梯、零星亮着的窗
    function buildCity() {
      const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
      const ground = H * .78; let x = -10 * dpr;
      const blds = [];
      while (x < W + 20 * dpr) { const w = rand(.08, .17) * Math.max(W, 700 * dpr) * (W < H ? .9 : .5), h = rand(.14, .42) * H; blds.push({ x, w, h, set: Math.random() < .45, tank: Math.random() < .35, ant: Math.random() < .3, fire: Math.random() < .5 }); x += w * rand(.82, 1.0); }
      for (const b of blds) {
        const top = ground - b.h, path = gg => {
          gg.beginPath(); gg.moveTo(jit(b.x, 1), H); gg.lineTo(jit(b.x, 1), top + (b.set ? b.h * .18 : 0));
          if (b.set) { const s1 = b.w * .15; gg.lineTo(jit(b.x + s1, 1), top + b.h * .18); gg.lineTo(jit(b.x + s1, 1), top + b.h * .08); gg.lineTo(jit(b.x + s1 * 2, 1), top + b.h * .08); gg.lineTo(jit(b.x + s1 * 2, 1), top); gg.lineTo(jit(b.x + b.w - s1 * 2, 1), top); gg.lineTo(jit(b.x + b.w - s1 * 2, 1), top + b.h * .08); gg.lineTo(jit(b.x + b.w - s1, 1), top + b.h * .08); gg.lineTo(jit(b.x + b.w - s1, 1), top + b.h * .18); gg.lineTo(jit(b.x + b.w, 1), top + b.h * .18); }
          else { for (let q = 0; q <= 6; q++) gg.lineTo(jit(b.x + b.w * q / 6, 1.2), jit(top, 1.5)); }
          gg.lineTo(jit(b.x + b.w, 1), H); gg.closePath(); };
        g.__bb = [b.x, top, b.x + b.w, H];
        sketchFill(g, path, "rgba(14,4,4,.96)", "rgba(150,30,22,.35)", Math.round(b.w * b.h / (dpr * dpr) / 90));
        // 窗户：几排小格，少数透着暗红的光
        for (let wy = top + b.h * .25; wy < ground - 10 * dpr; wy += 13 * dpr) for (let wx = b.x + 6 * dpr; wx < b.x + b.w - 8 * dpr; wx += 10 * dpr) {
          const r = Math.random(); if (r < .07) { g.fillStyle = `rgba(255,${rand(60, 120)},${rand(30, 60)},${rand(.35, .7)})`; g.fillRect(jit(wx, .5), jit(wy, .5), 4.5 * dpr, 6 * dpr); }
          else if (r < .4) { g.fillStyle = "rgba(60,14,10,.5)"; g.fillRect(wx, wy, 4.5 * dpr, 6 * dpr); } }
        // 消防梯：外墙上的之字形
        if (b.fire) { const fx0 = b.x + b.w * rand(.2, .5), fw = b.w * .3; g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 1.1 * dpr;
          for (let fy = top + b.h * .3; fy < ground - 14 * dpr; fy += 18 * dpr) { g.beginPath(); g.moveTo(fx0, fy); g.lineTo(fx0 + fw, fy); g.moveTo(fx0, fy + 18 * dpr); g.lineTo(fx0 + fw, fy); g.stroke(); } }
        // 水塔：圆桶 + 锥顶 + 支架
        if (b.tank) { const tx = b.x + b.w * rand(.25, .65), tw = Math.min(b.w * .28, 26 * dpr), tb = top - 6 * dpr, th = tw * 1.1;
          g.fillStyle = "rgba(10,3,3,.95)"; g.strokeStyle = "rgba(10,3,3,.95)"; g.lineWidth = 1.4 * dpr;
          g.beginPath(); g.moveTo(tx, tb + 6 * dpr); g.lineTo(tx + tw * .2, tb); g.moveTo(tx + tw, tb + 6 * dpr); g.lineTo(tx + tw * .8, tb); g.stroke();
          g.beginPath(); g.rect(tx, tb - th, tw, th); g.fill(); g.beginPath(); g.moveTo(tx - 2 * dpr, tb - th); g.lineTo(tx + tw / 2, tb - th - tw * .45); g.lineTo(tx + tw + 2 * dpr, tb - th); g.fill();
          g.strokeStyle = "rgba(120,24,18,.5)"; for (let q = 1; q < 4; q++) { g.beginPath(); g.moveTo(tx, tb - th * q / 4); g.lineTo(tx + tw, tb - th * q / 4); g.stroke(); } }
        if (b.ant) { const ax = b.x + b.w * rand(.3, .7); g.strokeStyle = "rgba(10,3,3,.95)"; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(ax, top); g.lineTo(ax, top - b.h * .3); g.stroke();
          g.lineWidth = 1 * dpr; g.beginPath(); g.moveTo(ax - 6 * dpr, top - b.h * .22); g.lineTo(ax + 6 * dpr, top - b.h * .22); g.stroke(); }
        if (Math.random() < .5) { g.fillStyle = "rgba(10,3,3,.95)"; g.fillRect(b.x + b.w * rand(.1, .7), top - 7 * dpr, rand(10, 18) * dpr, 7 * dpr); }   // 空调箱
      }
      // 地面以下压暗
      const gr = g.createLinearGradient(0, ground - H * .05, 0, H); gr.addColorStop(0, "rgba(8,2,2,0)"); gr.addColorStop(1, "rgba(8,2,2,.95)"); g.fillStyle = gr; g.fillRect(0, ground - H * .05, W, H);
      g.__bb = null; return c;
    }
    // 一个人的剪影：头（发型/帽子/兜帽）、脖子、斜肩、垂下的手臂、外套
    function personPath(x, base, h, kind) {
      const hw = h * .075, sh = h * .2, neck = h * .035, head = base - h, ch = base - h + hw * 2.3;
      return g => {
        g.beginPath();
        // 身体轮廓（从左下顺时针）
        const coat = kind.coat ? h * .04 : 0;
        g.moveTo(x - sh - coat, base);
        g.bezierCurveTo(x - sh - coat * .5, base - h * .35, x - sh * 1.02, ch + h * .12, x - sh * .92, ch + h * .07);   // 左臂外侧
        g.quadraticCurveTo(x - sh * .7, ch + neck * .6, x - hw * .55, ch + neck * .2);                                 // 左肩到脖子（斜肩）
        g.lineTo(x - hw * .5, ch - neck * .2);
        g.ellipse(x, head + hw * 1.15, hw * 1.02, hw * 1.25, 0, Math.PI * .62, Math.PI * 2.38);                         // 头
        g.lineTo(x + hw * .55, ch + neck * .2);
        g.quadraticCurveTo(x + sh * .7, ch + neck * .6, x + sh * .92, ch + h * .07);
        g.bezierCurveTo(x + sh * 1.02, ch + h * .12, x + sh + coat * .5, base - h * .35, x + sh + coat, base);
        g.closePath();
        if (kind.hood) { g.moveTo(x - hw * 1.35, head + hw * 1.6); g.quadraticCurveTo(x - hw * 1.4, head - hw * .15, x, head - hw * .2); g.quadraticCurveTo(x + hw * 1.4, head - hw * .15, x + hw * 1.35, head + hw * 1.6); g.closePath(); }
        if (kind.cap) { g.moveTo(x - hw * 1.05, head + hw * .55); g.quadraticCurveTo(x, head - hw * .35, x + hw * 1.05, head + hw * .55); g.lineTo(x + hw * 1.9, head + hw * .7); g.lineTo(x + hw * 1.05, head + hw * .75); g.closePath(); }
        if (kind.hair) { g.moveTo(x - hw * 1.05, head + hw); g.quadraticCurveTo(x - hw * 1.5, ch + h * .06, x - hw * 1.2, ch + h * .1); g.lineTo(x - hw * .6, ch); g.closePath();
          g.moveTo(x + hw * 1.05, head + hw); g.quadraticCurveTo(x + hw * 1.5, ch + h * .06, x + hw * 1.2, ch + h * .1); g.lineTo(x + hw * .6, ch); g.closePath(); }
        if (kind.bag) { g.moveTo(x + sh * .6, ch + h * .08); g.quadraticCurveTo(x + sh * 1.25, ch + h * .1, x + sh * 1.2, ch + h * .32); g.lineTo(x + sh * .8, ch + h * .33); g.closePath(); }
      };
    }
    function buildCrowd() { // 三排人：越远越小、越淡，中间隔着红雾
      const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); const people = [];
      const rows = [[.15, "rgba(40,10,8,.9)", .55], [.21, "rgba(22,6,5,.95)", .8], [.3, "rgba(7,2,2,.98)", 1]];
      rows.forEach(([hh, col, depthK], ri) => {
        let x = rand(-30, 0) * dpr;
        while (x < W + 30 * dpr) {
          const h = hh * H * rand(.85, 1.12), base = H + h * (ri === 2 ? .22 : .32) - ri * 2 * dpr;
          const kind = { hood: Math.random() < .22, cap: Math.random() < .14, hair: Math.random() < .2, bag: Math.random() < .15, coat: Math.random() < .4 };
          if (kind.hood) kind.cap = kind.hair = false;
          g.__bb = [x - h * .35, base - h * 1.05, x + h * .35, base];
          sketchFill(g, personPath(x, base, h, kind), col, `rgba(140,28,20,${.25 * depthK})`, Math.round(h * h / (dpr * dpr) / 120));
          people.push({ x, base, h, row: ri, eye: ri > 0 && Math.random() < .2, ph: rand(0, 6.28) });
          x += h * rand(.26, .42);
        }
        if (ri < 2) { const fog = g.createLinearGradient(0, H * .55, 0, H); fog.addColorStop(0, "rgba(120,20,14,0)"); fog.addColorStop(1, `rgba(120,20,14,${.18 - ri * .06})`); g.fillStyle = fog; g.fillRect(0, 0, W, H); }
      });
      g.__bb = null; return { c, people };
    }
    let cityImg = null, crowdImg = null;
    function init() {
      scratch = buildScratch(); cityImg = buildCity(); const cr = buildCrowd(); crowdImg = cr.c;
      crowd = cr.people;
      crows = Array.from({ length: 4 }, (_, i) => ({ x: W * (.58 + i * .1), turn: rand(0, 6.28), fly: rand(0, 1) }));
    }
    function claw(x, y, s) { claws.push({ x, y, s, ang: rand(-.9, -.5) + (Math.random() < .5 ? 0 : Math.PI), born: 0 }); for (let k = 0; k < 16; k++) ink.push({ x, y, vx: rand(-6, 6) * dpr, vy: rand(-6, 3) * dpr, r: rand(2, 6) * dpr, a: .9 }); }
    let t = 0, lastBeat = 0, ema = .2, pulse = 0, shake = 0, lastNow = 0, calm = 0, eyes = .4;
    function draw(I, level, fx) {
      t++;
      const now = window.__time || 0, playing = !!window.__playing, bass = window.__bass || 0;
      calm += ((win(ev.calm, now) ? 1 : 0) - calm) * .03;                  // “本当は強くない” 那段安静下来
      eyes += (((inWin(ev.eyes, now, 6) ? 1 : .45) * (1 - calm * .7)) - eyes) * .04;
      // 鼓点
      ema += (bass - ema) * .05;
      if (playing && bass > ema * 1.18 && bass > .28 && now - lastBeat > .22) { lastBeat = now; pulse = 1; shake = 1 - calm * .8;
        rings.push({ r: 0, a: .5 * (1 - calm * .7) });
        if (Math.random() < .25 * (1 - calm)) claw(rand(.1, .9) * W, rand(.15, .85) * H, rand(.7, 1.2)); }
      pulse *= .86; shake *= .8;
      // 唱到 roar / 破坏 时：必出爪痕；副歌回来那一下：巨大冲击波
      if (playing) { for (const t0 of ev.claw || []) if (t0 > lastNow && t0 <= now) { claw(W * .3, H * .35, 1.5); claw(W * .7, H * .6, 1.3); }
        for (const t0 of ev.blast || []) if (t0 > lastNow && t0 <= now) { for (let k = 0; k < 3; k++) rings.push({ r: -k * 60 * dpr, a: 1 }); shake = 2.5; for (let k = 0; k < 40; k++) ink.push({ x: W / 2, y: H * .45, vx: rand(-14, 14) * dpr, vy: rand(-14, 10) * dpr, r: rand(2, 8) * dpr, a: 1 }); }
        lastNow = now; }

      ctx.save();
      const sx = rand(-1, 1) * 9 * dpr * shake, sy = rand(-1, 1) * 9 * dpr * shake, z = 1 + pulse * .025;
      ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      // 红黑底 + 炭笔划痕
      let g = ctx.createRadialGradient(W / 2, H * .4, 0, W / 2, H * .4, Math.max(W, H) * .8);
      g.addColorStop(0, `rgba(${170 - calm * 90},${30 - calm * 10},${20 + calm * 30},${(.5 + pulse * .25) * I})`); g.addColorStop(1, `rgba(20,4,4,${.7 * I})`);
      ctx.fillStyle = g; ctx.fillRect(-20 * dpr, -20 * dpr, W + 40 * dpr, H + 40 * dpr);
      if (scratch) { ctx.globalAlpha = (.8 + pulse * .2) * I; ctx.drawImage(scratch, (t % 4 < 2 ? 0 : 1) * dpr, 0); ctx.globalAlpha = 1; }
      // 远处的城市剪影
      if (cityImg) { ctx.globalAlpha = I; ctx.drawImage(cityImg, 0, 0); ctx.globalAlpha = 1; }
      // 电线杆 + 电线 + 乌鸦（唱到乌鸦时出现，转头盯着你；唱到“死体”时又回来）
      const crowA = Math.max(win(ev.crows, now) ? 1 : 0, 0);
      // 电线杆（几道抖动的笔触叠出来）+ 横担 + 电线
      ctx.strokeStyle = `rgba(8,2,2,${.92 * I})`; ctx.lineCap = "round";
      for (let k = 0; k < 3; k++) { const o = (k - 1) * 1.6 * dpr; ctx.lineWidth = (4 - k) * dpr;
        ctx.beginPath(); ctx.moveTo(W * .82 + o, H * .8); ctx.lineTo(W * .82 + o + .8 * dpr, H * .45); ctx.lineTo(W * .82 + o - .5 * dpr, H * .12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * .7, H * .15 + o * .5); ctx.lineTo(W * .95, H * .152 + o * .5); ctx.stroke(); }
      ctx.lineWidth = 1.2 * dpr; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-10, H * (.2 + k * .03)); ctx.quadraticCurveTo(W * .4, H * (.27 + k * .03), W * .72, H * .15); ctx.stroke(); }
      // 乌鸦：停在横担上，红眼睛，时不时转头
      if (crowA > 0) crows.forEach((c, i) => {
        const s = Math.max(14, Math.min(W, H) / dpr * .03) * dpr, cx = W * (.72 + i * .065), cy = H * .15 - s * .55, look = Math.sin(t * .02 + c.turn) > .5 ? -1 : 1;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(look, 1); ctx.fillStyle = "rgba(4,1,1,.97)";
        ctx.beginPath(); ctx.ellipse(0, 0, s * .62, s * .42, -.35, 0, 6.29); ctx.fill();                               // 身体
        ctx.beginPath(); ctx.arc(s * .52, -s * .42, s * .27, 0, 6.29); ctx.fill();                                      // 头
        ctx.beginPath(); ctx.moveTo(s * .72, -s * .5); ctx.lineTo(s * 1.15, -s * .36); ctx.lineTo(s * .72, -s * .3); ctx.fill(); // 喙
        ctx.beginPath(); ctx.moveTo(-s * .5, s * .05); ctx.lineTo(-s * 1.25, s * .42); ctx.lineTo(-s * 1.1, s * .5); ctx.lineTo(-s * .35, s * .32); ctx.fill(); // 尾巴
        ctx.strokeStyle = "rgba(4,1,1,.97)"; ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); ctx.moveTo(-s * .05, s * .35); ctx.lineTo(-s * .05, s * .55); ctx.moveTo(s * .15, s * .35); ctx.lineTo(s * .15, s * .55); ctx.stroke(); // 爪
        ctx.fillStyle = "rgba(255,60,40,.95)"; ctx.beginPath(); ctx.arc(s * .6, -s * .47, s * .065, 0, 6.29); ctx.fill(); ctx.restore();
      });
      // 冲击波
      rings = rings.filter(r => (r.a *= .93) > .02);
      for (const r of rings) { r.r += 18 * dpr; if (r.r <= 0) continue; ctx.strokeStyle = `rgba(255,${80 + calm * 100},${50 + calm * 150},${r.a})`; ctx.lineWidth = 4 * dpr * r.a + dpr; ctx.beginPath(); ctx.arc(W / 2, H * .42, r.r, 0, 6.29); ctx.stroke(); }
      // 人群（预先画好的三排）+ 其中几双红眼
      if (crowdImg) { ctx.globalAlpha = I; ctx.drawImage(crowdImg, Math.sin(t * .01) * 2 * dpr, Math.sin(t * .013) * 1.5 * dpr); ctx.globalAlpha = 1; }
      for (const p of crowd) { if (!p.eye) continue; const blink = Math.sin(t * .03 + p.ph) > .93 ? .1 : 1, ex = p.x + Math.sin(t * .01) * 2 * dpr, ey = p.base - p.h + p.h * .075 * 1.2;
        const sz = p.h / H * 26 * dpr;
        for (const dx of [-.032, .032]) { const x = ex + dx * p.h, gl = ctx.createRadialGradient(x, ey, 0, x, ey, sz);
          gl.addColorStop(0, `rgba(255,70,50,${eyes * blink})`); gl.addColorStop(1, "rgba(255,40,30,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, ey, sz, 0, 6.29); ctx.fill();
          ctx.fillStyle = `rgba(255,225,205,${eyes * blink})`; ctx.fillRect(x - sz * .3, ey - sz * .08, sz * .6, sz * .16); } }
      ctx.restore();

      // ── 最上层 ──
      // 速度线：奔跑 / 副歌
      if (win(ev.run, now) && playing) { for (let k = 0; k < 3; k++) lines.push({ y: rand(0, H), x: W + rand(0, 100) * dpr, len: rand(.2, .6) * W, v: rand(40, 70) * dpr, w: rand(1, 3) * dpr }); }
      lines = lines.filter(l => (l.x -= l.v) + l.len > 0);
      for (const l of lines) { const lg = fx.createLinearGradient(l.x, 0, l.x + l.len, 0); lg.addColorStop(0, "rgba(255,240,230,.5)"); lg.addColorStop(1, "rgba(255,240,230,0)"); fx.fillStyle = lg; fx.fillRect(l.x, l.y, l.len, l.w); }
      // 爪痕：三道撕开的口子，里面透出红白的光
      claws = claws.filter(c => ++c.born < 70);
      for (const c of claws) {
        const p = Math.min(1, c.born / 5), a = c.born < 5 ? 1 : 1 - (c.born - 5) / 65, L = 260 * dpr * c.s * p;
        fx.save(); fx.translate(c.x, c.y); fx.rotate(c.ang);
        for (let k = -1; k <= 1; k++) { fx.save(); fx.translate(0, k * 26 * dpr * c.s);
          fx.fillStyle = `rgba(255,60,40,${.55 * a})`; fx.beginPath(); fx.moveTo(-L / 2, 0); fx.quadraticCurveTo(0, -9 * dpr * c.s, L / 2, 0); fx.quadraticCurveTo(0, 5 * dpr * c.s, -L / 2, 0); fx.fill();
          fx.fillStyle = `rgba(255,245,235,${.9 * a})`; fx.beginPath(); fx.moveTo(-L / 2.2, 0); fx.quadraticCurveTo(0, -3 * dpr * c.s, L / 2.2, 0); fx.quadraticCurveTo(0, 1.5 * dpr * c.s, -L / 2.2, 0); fx.fill(); fx.restore(); }
        fx.restore();
      }
      ink = ink.filter(d => (d.a *= .94) > .03);
      for (const d of ink) { d.x += d.vx; d.y += d.vy; d.vy += .4 * dpr; fx.fillStyle = `rgba(20,2,2,${d.a})`; fx.beginPath(); fx.arc(d.x, d.y, d.r, 0, 6.29); fx.fill(); }
      // 猎枪瞄准镜：搜寻 → 锁定封面 → 枪响（白闪）
      const img = document.getElementById("cover");
      for (const t0 of ev.scope || []) { const d = now - t0; if (d < 0 || d > 6.2 || !img) continue;
        const r = img.getBoundingClientRect(), tx = (r.left + r.width * .45) * dpr, ty = (r.top + r.height * .35) * dpr;
        const lock = Math.min(1, Math.max(0, (d - 2.5) / 2)), e = lock * lock * (3 - 2 * lock);
        const x = (W * (.5 + .35 * Math.sin(d * 1.7)) ) * (1 - e) + tx * e, y = (H * (.5 + .3 * Math.cos(d * 1.3))) * (1 - e) + ty * e, R = (90 - 30 * e) * dpr;
        if (d < 5.1) { fx.strokeStyle = `rgba(255,50,40,${.85})`; fx.lineWidth = 2 * dpr; fx.beginPath(); fx.arc(x, y, R, 0, 6.29); fx.stroke();
          fx.beginPath(); fx.arc(x, y, R * .55, 0, 6.29); fx.globalAlpha = .4; fx.stroke(); fx.globalAlpha = 1;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { fx.beginPath(); fx.moveTo(x + dx * R * .25, y + dy * R * .25); fx.lineTo(x + dx * R * 1.25, y + dy * R * 1.25); fx.stroke(); }
          fx.fillStyle = "rgba(255,50,40,.95)"; fx.beginPath(); fx.arc(x, y, 2.5 * dpr, 0, 6.29); fx.fill(); }
        if (d > 5.1 && d < 6.2) { const a = 1 - (d - 5.1) / 1.1; fx.fillStyle = `rgba(255,250,240,${.85 * a})`; fx.fillRect(0, 0, W, H); shake = 3; }
      }
      // 封面故障：鼓点时横向错位 + 红蓝分离
      if (img && img.complete && pulse > .35 && calm < .5) {
        const r = img.getBoundingClientRect(), x0 = r.left * dpr, y0 = r.top * dpr, w0 = r.width * dpr, h0 = r.height * dpr, iw = img.naturalWidth, ih = img.naturalHeight;
        for (let k = 0; k < 6; k++) { const sy = Math.random(), sh = rand(.02, .09), off = rand(-1, 1) * 26 * dpr * pulse;
          fx.globalAlpha = .9; fx.drawImage(img, 0, sy * ih, iw, sh * ih, x0 + off, y0 + sy * h0, w0, sh * h0); }
        fx.globalCompositeOperation = "screen"; fx.globalAlpha = .35 * pulse;
        fx.fillStyle = "rgb(255,0,40)"; fx.fillRect(x0 + 6 * dpr * pulse, y0, w0, h0 * .02); fx.fillStyle = "rgb(0,200,255)"; fx.fillRect(x0 - 6 * dpr * pulse, y0 + h0 * rand(.2, .8), w0, 2 * dpr);
        fx.globalCompositeOperation = "source-over"; fx.globalAlpha = 1;
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 蜘蛛 ═════════
  // 封面先慢慢褪色（失去感觉）→ 心跳一下，颜色和余烬一起回来 → 蜕壳：封面变成一层灰色的旧壳，裂纹从里面透出红光，
  // 旧壳一片片朝你剥落、碎屑飞满整个屏幕，露出底下鲜亮的新封面 → 潜伏：灯暗下去，黑暗里睁开红色的眼睛 →
  // 吐丝：一根根发光的蛛丝射过整个屏幕，蛛网一圈圈织出来，跟着鼓点颤 → 一只蜘蛛顺着丝垂到封面角上，影子投在封面上 →
  // “我是蜘蛛”反复时，黑暗里的眼睛越来越多 → 最后沉入黑暗，只剩露珠在闪
  SCENES.spider = (song) => {
    const ev = song.events || {};
    const seg = (now, a, b) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    const ease = x => 1 - Math.pow(1 - x, 3);
    const sprite = (r, stops) => { const c = document.createElement("canvas"); c.width = c.height = r * 2; const g = c.getContext("2d"), gr = g.createRadialGradient(r, r, 0, r, r, r);
      stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; };
    const GLOW = sprite(32, [[0, "rgba(255,255,255,1)"], [.25, "rgba(235,240,255,.5)"], [1, "rgba(220,230,255,0)"]]);
    const EMB = sprite(32, [[0, "rgba(255,230,180,1)"], [.2, "rgba(255,140,60,.75)"], [1, "rgba(255,70,30,0)"]]);
    const EYE = sprite(32, [[0, "rgba(255,235,225,1)"], [.18, "rgba(255,60,45,.95)"], [.5, "rgba(200,20,20,.25)"], [1, "rgba(160,0,0,0)"]]);
    let embers = [], dust = [], webs = [], threads = [], eyes = [], chips = [], sheds = [], beam = null, sdw = null;
    let lastNow = 0, t = 0, ema = .2, beat = 0, lastBeat = -9, lastTn = 0, spY = null, spV = 0, emberKick = 0;
    const preBeats = []; { let x = .5; while (x < 17.6) { preBeats.push(x); x += .85 + Math.pow(x / 16, 1.6) * 1.7; } }
    const gs = (x, m, w) => Math.exp(-Math.pow((x - m) / w, 2));
    const ecg = ph => -.18 * gs(ph, 0, .014) + gs(ph, .035, .013) - .32 * gs(ph, .065, .016) + .22 * gs(ph, .26, .05);
    const lub = ph => gs(ph, .035, .05) + .6 * gs(ph, .25, .06);
    function beatBefore(x) { const rg = ev.reignite || 21.3;
      if (x >= rg) { const k = Math.floor((x - rg) / .78); return k < 10 ? [rg + k * .78, k ? 1 : 1.8] : null; }
      let bt = null; for (const p of preBeats) if (p <= x) bt = p; else break; return bt === null ? null : [bt, Math.max(.22, 1 - bt / 19)]; }
    function hbAt(x, fn) { const r = beatBefore(x); if (!r) return 0; const ph = x - r[0]; return ph > 1.2 ? 0 : fn(ph) * r[1]; }
    let smokes = [], oldWeb = null;
    function buildBroken(cx, cy, R) {   // 一张早就被废弃的破网：断掉的辐射丝、零散的螺旋、垂下来的断丝
      const n = 11, lines = [];
      const angs = Array.from({ length: n }, (_, i) => .1 + i / n * 1.75 + rand(-.06, .06));   // 只在右下方向展开（挂在角落里）
      const len = angs.map(() => R * (Math.random() < .35 ? rand(.35, .7) : rand(.85, 1.05)));
      angs.forEach((a, i) => lines.push({ pts: [[cx, cy], [cx + Math.cos(a) * len[i], cy + Math.sin(a) * len[i]]], sw: 0 }));
      for (let k = 1; k < 12; k++) { const f = k / 12;
        for (let i = 0; i < n - 1; i++) { if (Math.random() > .5 || len[i] < R * f || len[i + 1] < R * f) continue;
          const p1 = [cx + Math.cos(angs[i]) * R * f, cy + Math.sin(angs[i]) * R * f], p2 = [cx + Math.cos(angs[i + 1]) * R * f, cy + Math.sin(angs[i + 1]) * R * f];
          lines.push({ pts: [p1, [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + R * .02], p2], sw: f }); } }
      for (let i = 0; i < n; i++) if (len[i] < R * .8) { const e = lines[i].pts[1]; lines.push({ pts: [e, [e[0] + rand(-10, 10) * dpr, e[1] + R * rand(.15, .35)]], sw: 1, hang: true }); }
      return lines;
    }
    let wrapEl = null, imgEl, mainEl, ccv, cc, lastFilter = "", lastScale = "", lastShake = "";

    function els() {
      if (wrapEl) return true;
      wrapEl = document.querySelector(".cover-wrap"); imgEl = document.querySelector("#cover"); mainEl = document.querySelector("main");
      if (!wrapEl || !imgEl) { wrapEl = null; return false; }
      ccv = document.createElement("canvas");
      ccv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      wrapEl.insertBefore(ccv, wrapEl.querySelector(".cover-shade")); cc = ccv.getContext("2d");
      return true;
    }
    function buildWeb(cx, cy, R) {
      const n = 24, rad = [], spiral = [], dew = [];
      const angs = Array.from({ length: n }, (_, i) => i / n * 6.283 + rand(-.07, .07));
      angs.forEach(a => { const r = R * rand(.85, 1.05); rad.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, r]); });
      const turns = 28;
      for (let k = 0; k < turns; k++) { const f = 1 - k / turns * .88, ring = [];
        angs.forEach((a, i) => { const r = rad[i][2] * f * .95; ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r + (Math.sin(a) > 0 ? r * .025 : 0)]);
          if (Math.random() < .14) dew.push([ring[i][0], ring[i][1], rand(1.2, 3) * dpr, rand(0, 6.28), k / turns]); });
        spiral.push(ring); }
      return { cx, cy, rad, spiral, dew };
    }
    function edgePt(side) { return side === 0 ? [rand(0, W), -10] : side === 1 ? [W + 10, rand(0, H)] : side === 2 ? [rand(0, W), H + 10] : [-10, rand(0, H)]; }
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000), M = Math.min(W, H);
      embers = Array.from({ length: Math.round(60 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(3, 8) * dpr, v: rand(.3, 1) * dpr, ph: rand(0, 6.28), vx: 0, vy: 0 }));
      dust = Array.from({ length: Math.round(90 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(1.5, 4) * dpr, v: rand(.05, .2) * dpr, ph: rand(0, 6.28) }));
      webs = [buildWeb(W * .1, H * .08, M * .62), buildWeb(W * .92, H * .84, M * .52)];
      threads = Array.from({ length: 9 }, (_, i) => { const s1 = (i * 3) % 4, s2 = (s1 + 1 + (i % 3)) % 4; const A = edgePt(s1), B = edgePt(s2 === s1 ? (s1 + 2) % 4 : s2);
        return { A, B, sag: rand(.04, .12), ph: rand(0, 6.28), sp: rand(.5, 1.2), wave: i < 5 ? 0 : 1, delay: (i < 5 ? i : i - 5) * .45 }; });
      eyes = Array.from({ length: 44 }, (_, k) => { let x, y; do { x = rand(0, W); y = rand(0, H); } while (Math.abs(x - W / 2) < W * .2 && Math.abs(y - H * .4) < H * .18 && W > H);
        return { x, y, s: rand(.6, 1.4) * dpr, k, ph: rand(0, 50), tilt: rand(-.5, .5) }; });
      // 左上角照下来的冷光（小画布画好再放大 = 边缘自然柔和）
      beam = document.createElement("canvas"); beam.width = 160; beam.height = 160 * H / W | 0 || 160; const bg = beam.getContext("2d"), bw = beam.width, bh = beam.height;
      const lg = bg.createLinearGradient(0, 0, bw * .8, bh); lg.addColorStop(0, "rgba(200,205,225,.55)"); lg.addColorStop(1, "rgba(200,205,225,0)");
      bg.fillStyle = lg; bg.beginPath(); bg.moveTo(bw * .05, 0); bg.lineTo(bw * .38, 0); bg.lineTo(bw * 1.1, bh); bg.lineTo(bw * .45, bh); bg.closePath(); bg.fill();
      embers.forEach(e => (e.die = rand(13.3, 16.8)));
      oldWeb = buildBroken(-W * .01, -H * .01, Math.min(W, H) * .5);
      sdw = document.createElement("canvas"); sdw.width = sdw.height = 72;
    }
    // ── 蜘蛛：头胸部 + 有光泽的腹部 + 8 条三节的腿 + 8 只眼 ──
    function spider(g, x, y, s, eyeA, flex, col = "rgba(14,13,15,.98)") {
      g.save(); g.translate(x, y); g.fillStyle = g.strokeStyle = col; g.lineCap = g.lineJoin = "round";
      for (let side = -1; side <= 1; side += 2) for (let k = 0; k < 4; k++) {
        const w = Math.sin(t * .06 + k * 1.3 + side) * .07 * (1 + flex);
        const base = [side * s * .22, -s * .15 + k * s * .14];
        const out = side * (k < 2 ? 1 : .9), up = k < 2 ? -1 : 1;
        const knee = [base[0] + out * s * (.8 + k * .08), base[1] - s * (.55 - k * .1) + up * s * .2 * k / 3 + w * s];
        const ank = [knee[0] + out * s * (.55 + .1 * (k === 0 || k === 3)), knee[1] + s * (k < 2 ? -.15 + k * .45 : .55 + (k - 2) * .35) * (1 - flex * .3)];
        const foot = [ank[0] + out * s * .25, ank[1] + s * (k < 2 ? (k === 0 ? -.35 : .2) : .35)];
        g.lineWidth = s * .13; g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(knee[0], knee[1]); g.stroke();
        g.lineWidth = s * .09; g.beginPath(); g.moveTo(knee[0], knee[1]); g.lineTo(ank[0], ank[1]); g.stroke();
        g.lineWidth = s * .055; g.beginPath(); g.moveTo(ank[0], ank[1]); g.lineTo(foot[0], foot[1]); g.stroke();
      }
      g.beginPath(); g.ellipse(0, -s * .02, s * .36, s * .42, 0, 0, 6.29); g.fill();                    // 头胸部
      g.beginPath(); g.ellipse(0, -s * .98, s * .58, s * .74, 0, 0, 6.29); g.fill();                    // 腹部（朝上，蜘蛛头朝下挂着）
      if (col.startsWith("rgba(14")) {
        const sh = g.createRadialGradient(-s * .18, -s * 1.2, 0, -s * .18, -s * 1.2, s * .6);
        sh.addColorStop(0, "rgba(150,150,170,.35)"); sh.addColorStop(1, "rgba(150,150,170,0)"); g.fillStyle = sh;
        g.beginPath(); g.ellipse(0, -s * .98, s * .58, s * .74, 0, 0, 6.29); g.fill();
        g.fillStyle = "rgba(190,25,25,.85)";                                                            // 腹部的红色沙漏纹
        g.beginPath(); g.moveTo(0, -s * 1.42); g.lineTo(s * .13, -s * 1.18); g.lineTo(0, -s * 1.02); g.lineTo(-s * .13, -s * 1.18); g.closePath();
        g.moveTo(0, -s * .95); g.lineTo(s * .1, -s * .75); g.lineTo(0, -s * .58); g.lineTo(-s * .1, -s * .75); g.closePath(); g.fill();
        g.globalCompositeOperation = "lighter";
        for (const [ex, ey, er] of [[-.1, .3, .1], [.1, .3, .1], [-.22, .22, .07], [.22, .22, .07], [-.05, .4, .055], [.05, .4, .055], [-.28, .32, .05], [.28, .32, .05]]) {
          g.globalAlpha = eyeA; g.drawImage(EYE, ex * s - er * s * 3, ey * s - er * s * 3, er * s * 6, er * s * 6); }
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      }
      g.restore();
    }
    // ── 旧壳：把封面变成一层干裂、灰白的皮 ──
    function buildHusk(w, h, ir) {
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
      g.fillStyle = "#1d1a17"; g.fillRect(0, 0, w, h);
      try { g.drawImage(imgEl, ir.x, ir.y, ir.w, ir.h); } catch (e) {}
      try { const id = g.getImageData(0, 0, w, h), d = id.data;
        for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255, v = Math.pow(l, 1.2) * .7 + .06 + (Math.random() - .5) * .07;
          d[i] = v * 236; d[i + 1] = v * 220; d[i + 2] = v * 198; }
        g.putImageData(id, 0, 0); } catch (e) {}
      g.strokeStyle = "rgba(8,6,4,.4)"; g.lineWidth = 1;
      for (let k = 0; k < 160; k++) { let x = rand(0, w), y = rand(0, h); g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rand(-1, 1) * w * .025; y += rand(-1, 1) * h * .025; g.lineTo(x, y); } g.stroke(); }
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.5)"); g.fillStyle = vg; g.fillRect(0, 0, w, h);
      return c;
    }
    function sizeCC() {
      const wr = wrapEl.getBoundingClientRect(), w = Math.round(wr.width * dpr), h = Math.round(wr.height * dpr);
      if (ccv.width !== w || ccv.height !== h) { ccv.width = w; ccv.height = h; }
      return wr;
    }
    function startShed() {
      if (!els()) return;
      const wr = sizeCC(), ir0 = imgEl.getBoundingClientRect(), w = ccv.width, h = ccv.height;
      const husk = buildHusk(w, h, { x: (ir0.left - wr.left) * dpr, y: (ir0.top - wr.top) * dpr, w: ir0.width * dpr, h: ir0.height * dpr });
      const ix = w * rand(.4, .6), iy = h * rand(.28, .42), R = Math.hypot(Math.max(ix, w - ix), Math.max(iy, h - iy)) * 1.02;
      const n = 13, rings = [0, .07, .16, .28, .43, .62, .84, 1.1], K = rings.length;
      const ang = Array.from({ length: n }, (_, i) => (i + rand(-.3, .3)) / n * 6.2832);
      const V = rings.map((r, k) => ang.map(a => { const rr = r * R * (k ? rand(.86, 1.14) : 0), aa = a + (k ? rand(-.06, .06) : 0); return [ix + Math.cos(aa) * rr, iy + Math.sin(aa) * rr]; }));
      const mid = (p, q, j) => [(p[0] + q[0]) / 2 + rand(-j, j), (p[1] + q[1]) / 2 + rand(-j, j)];
      const Mr = [], Mc = [];
      for (let k = 0; k < K; k++) { Mr.push([]); Mc.push([]); const j = R * .04 * (k + 1) / K;
        for (let i = 0; i < n; i++) { Mc[k].push(mid(V[k][i], V[k][(i + 1) % n], j)); if (k < K - 1) Mr[k].push(mid(V[k][i], V[k + 1][i], j)); } }
      const pcs = [], path = new Path2D();
      for (let k = 0; k < K - 1; k++) for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n, poly = [V[k][i], Mc[k][i], V[k][i2], Mr[k][i2], V[k + 1][i2], Mc[k + 1][i], V[k + 1][i], Mr[k][i]];
        const cx = poly.reduce((s, p) => s + p[0], 0) / 8, cy = poly.reduce((s, p) => s + p[1], 0) / 8;
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; poly.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
        x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
        if (x1 - x0 < 1 || y1 - y0 < 1) continue;
        pcs.push({ poly: poly.map(([x, y]) => [x - cx, y - cy]), cx, cy, bb: [x0, y0, x1 - x0, y1 - y0], d: Math.hypot(cx - ix, cy - iy) / R,
          dir: Math.atan2(cy - iy, cx - ix), sp: rand(.5, 1.1), vr: rand(-2.5, 2.5), tilt: rand(1.5, 4) });
      }
      for (let i = 0; i < n; i++) for (let k = 0; k < K - 1; k++) { path.moveTo(...V[k][i]); path.lineTo(...Mr[k][i]); path.lineTo(...V[k + 1][i]); }
      for (let k = 1; k < K; k++) for (let i = 0; i < n; i++) { path.moveTo(...V[k][i]); path.lineTo(...Mc[k][i]); path.lineTo(...V[k][(i + 1) % n]); }
      sheds.push({ t0: performance.now(), husk, pcs, path, ix, iy, R, h, wr, burst: false });
    }
    function drawSheds(tn) {
      let shake = 0, bloom = 0;
      sheds = sheds.filter(s => tn - s.t0 < 3300);
      for (const s of sheds) {
        const age = (tn - s.t0) / 1000, appear = seg(age, 0, .45), crackR = ease(seg(age, .3, 1.0)) * s.R;
        const fl = Math.exp(-Math.pow((age - 1.05) / .09, 2));
        if (age > 1.0) shake = Math.max(shake, Math.max(0, 1 - (age - 1.0) / .6));
        if (age > 1.05) bloom = Math.max(bloom, Math.max(0, 1 - (age - 1.05) / 1.8));
        if (age > 1.05 && !s.burst) { s.burst = true; burst(s); }
        for (const p of s.pcs) {
          const ft = age - 1.08 - p.d * .8; let x = p.cx, y = p.cy, sc = 1, rot = 0, a = appear, sx = 1;
          if (ft > 0) { const dist = ft * s.R * .5 * p.sp; x += Math.cos(p.dir) * dist; y += Math.sin(p.dir) * dist + ft * ft * s.h * 1.1;
            sc = 1 + ft * 1.2; rot = p.vr * ft; sx = Math.cos(ft * p.tilt); a *= Math.max(0, 1 - ft / .8); }
          if (a <= .01) continue;
          cc.save(); cc.globalAlpha = a; cc.translate(x, y); cc.rotate(rot); cc.scale(sc * sx, sc);
          cc.beginPath(); p.poly.forEach(([qx, qy], k) => (k ? cc.lineTo(qx, qy) : cc.moveTo(qx, qy))); cc.closePath();
          cc.save(); cc.clip(); const [bx, by, bw, bh] = p.bb;
          cc.drawImage(s.husk, bx, by, bw, bh, bx - p.cx, by - p.cy, bw, bh);
          if (ft > 0) { cc.fillStyle = `rgba(0,0,0,${Math.min(.55, ft * .9 + (1 - Math.abs(sx)) * .4)})`; cc.fill(); }
          cc.restore();
          if (ft > 0) { cc.strokeStyle = "rgba(255,232,210,.6)"; cc.lineWidth = 1.2 * dpr; cc.stroke(); }
          cc.restore();
        }
        const ca = age < 1.1 ? 1 : Math.max(0, 1 - (age - 1.1) / .35);
        if (ca > 0 && crackR > 0) {
          cc.save(); cc.beginPath(); cc.arc(s.ix, s.iy, crackR, 0, 6.29); cc.clip(); cc.globalCompositeOperation = "lighter"; cc.lineCap = "round";
          cc.strokeStyle = `rgba(255,70,25,${(.22 + fl * .5) * ca})`; cc.lineWidth = (9 + fl * 10) * dpr; cc.stroke(s.path);
          cc.strokeStyle = `rgba(255,130,60,${.55 * ca})`; cc.lineWidth = 3.2 * dpr; cc.stroke(s.path);
          cc.strokeStyle = `rgba(255,240,215,${.95 * ca})`; cc.lineWidth = 1.1 * dpr; cc.stroke(s.path);
          cc.restore();
          const r0 = Math.max(crackR * .25, 30 * dpr);
          cc.save(); cc.globalCompositeOperation = "lighter"; cc.globalAlpha = Math.min(1, .35 * ca + fl * .9);
          cc.drawImage(EMB, s.ix - r0, s.iy - r0, r0 * 2, r0 * 2); cc.restore();
        }
        if (fl > .02) { cc.fillStyle = `rgba(255,225,200,${fl * .35})`; cc.fillRect(0, 0, ccv.width, ccv.height); }
      }
      return { shake, bloom };
    }
    function burst(s) {   // 旧壳的碎屑从封面飞出去，撒满整个屏幕
      const ox = s.wr.left * dpr, oy = s.wr.top * dpr, cx = ox + s.ix, cy = oy + s.iy;
      for (let k = 0; k < 110; k++) {
        const a = rand(0, 6.28), r = rand(0, s.R * .9), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, sp = rand(250, 1100) * dpr;
        chips.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(100, 400) * dpr, rot: rand(0, 6), vr: rand(-12, 12), sz: rand(2, 8) * dpr,
          ember: Math.random() < .3, life: 0, max: rand(1.2, 2.4), sh: Array.from({ length: 4 }, (_, i) => [Math.cos(i * 1.57 + rand(-.5, .5)) * rand(.5, 1), Math.sin(i * 1.57 + rand(-.5, .5)) * rand(.5, 1)]) });
      }
      emberKick = 1;
    }
    function drawWeb(w, p, I, alpha, dewA, sweep) {
      ctx.lineCap = "round"; ctx.strokeStyle = `rgba(215,218,232,${(.3 + beat * .3) * alpha * I})`; ctx.lineWidth = 1 * dpr;
      const rp = Math.min(1, p / .3), vib = beat * 2.5 * dpr;
      ctx.beginPath();
      w.rad.forEach(([x, y], i) => { if (i / w.rad.length > rp) return; const f = Math.min(1, rp * 1.5); ctx.moveTo(w.cx, w.cy); ctx.lineTo(w.cx + (x - w.cx) * f, w.cy + (y - w.cy) * f + Math.sin(t * .9 + i) * vib); });
      ctx.stroke();
      const sp = Math.max(0, (p - .3) / .7), total = w.spiral.length * w.rad.length, upto = Math.floor(sp * total);
      ctx.lineWidth = .8 * dpr; ctx.strokeStyle = `rgba(228,230,242,${(.34 + beat * .3) * alpha * I})`; ctx.beginPath(); let cnt = 0;
      for (let k = 0; k < w.spiral.length && cnt < upto; k++) { const ring = w.spiral[k], dy = Math.sin(t * .9 + k * .7) * vib;
        for (let i = 0; i < ring.length && cnt < upto; i++, cnt++) { const a = ring[i], b = ring[(i + 1) % ring.length];
          ctx.moveTo(a[0], a[1] + dy); ctx.quadraticCurveTo((a[0] + b[0]) / 2 + (w.cx - (a[0] + b[0]) / 2) * .035, (a[1] + b[1]) / 2 + (w.cy - (a[1] + b[1]) / 2) * .035 + dy, b[0], b[1] + dy); } }
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      for (const [x, y, r, ph, kf] of w.dew) { if (kf > sp) continue;
        const d = Math.hypot(x - w.cx, y - w.cy) / (Math.min(W, H) * .6), shine = Math.max(0, 1 - Math.abs(d - sweep) * 5);
        ctx.globalAlpha = Math.min(1, (.3 + .7 * shine + .2 * Math.sin(t * .05 + ph) + beat * .3) * dewA); const rr = r * (3 + shine * 2);
        ctx.drawImage(GLOW, x - rr, y - rr, rr * 2, rr * 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }

    function draw(I, level, fx) {
      t++;
      const tn = performance.now(), dt = Math.min(.05, (tn - (lastTn || tn)) / 1000); lastTn = tn;
      const now = window.__time || 0, playing = !!window.__playing, bass = window.__bass || 0;
      const rg = ev.reignite || 21.3, endT = ev.end || 1e9;
      if (!els()) return;
      const wr = sizeCC();
      cc.clearRect(0, 0, ccv.width, ccv.height);
      ema += (bass - ema) * .05; if (playing && bass > ema * 1.18 && bass > .26 && now - lastBeat > .3) { lastBeat = now; beat = 1; } beat *= .88;
      if (playing) { for (const t0 of ev.shed || []) if (t0 > lastNow && t0 <= now && now - t0 < .8) startShed();
        if (rg > lastNow && rg <= now && now - rg < .8) { emberKick = 1.4; beat = 1.6; } }
      const prevNow = lastNow; lastNow = now;
      const life = now < rg ? 1 - seg(now, 0, 16) * .9 : .3 + seg(now, rg, rg + 2.5) * .7;
      const dark = seg(now, endT, endT + 4);
      const lurk = ev.lurk ? seg(now, ev.lurk, ev.lurk + 1.2) * (1 - seg(now, ev.lurk + 9, ev.lurk + 11)) : 0;
      const m0 = (ev.mantra || [])[0] || 1e9;
      const S = drawSheds(tn);
      emberKick *= .985;
      const hs = hbAt(now, lub), hb = Math.max(hs, now > rg ? beat * (now < rg + 9 ? 1 : .45) : 0);
      const bulb = now < rg ? (1 - seg(now, 10.7, 16) * .8) * ((now > 10.7 && now < 13.8 && Math.random() < .13) ? .12 : 1) : .3 + .7 * seg(now, rg, rg + .6);

      // 封面：慢慢褪色 → 心跳后颜色回来；蜕壳后一阵新生的亮光；结尾沉下去
      let desat = now < rg ? seg(now, 2, 17) * .92 : .92 * (1 - ease(seg(now, rg, rg + 2.2)));
      desat = Math.max(desat, seg(now, endT, endT + 5));
      const br = 1 - desat * .3 - dark * .55 - lurk * .3 + S.bloom * .75 + hb * .1;
      const f = `grayscale(${desat.toFixed(2)}) brightness(${br.toFixed(2)})${S.bloom > .01 ? ` saturate(${(1 + S.bloom * .7).toFixed(2)})` : ""}`;
      if (f !== lastFilter) { imgEl.style.filter = f; lastFilter = f; }
      const scl = (1 + hb * .022 + S.shake * .015).toFixed(4);
      if (scl !== lastScale) { wrapEl.style.scale = scl; lastScale = scl; }
      const sh = S.shake > .01 ? `${(rand(-1, 1) * 9 * S.shake).toFixed(1)}px ${(rand(-1, 1) * 7 * S.shake).toFixed(1)}px` : "";
      if (sh !== lastShake && mainEl) { mainEl.style.translate = sh; lastShake = sh; }

      // ── 背景 ──
      const vis = I * (1 - dark);
      ctx.globalAlpha = .55 * vis * bulb * (1 - lurk * .75) * (.9 + .1 * Math.sin(t * .013)); ctx.drawImage(beam, 0, 0, W, H); ctx.globalAlpha = 1;
      const cx = (wr.left + wr.width / 2) * dpr, cy = (wr.top + wr.height / 2) * dpr;
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .65);
      g.addColorStop(0, `rgba(200,45,25,${(.07 + hb * .2) * life * vis})`); g.addColorStop(1, "rgba(150,30,20,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of sheds) { const age = (tn - s.t0) / 1000 - 1.05; if (age < 0 || age > 1.4) continue;   // 蜕壳的冲击波
        const r = age * Math.max(W, H) * .9; ctx.strokeStyle = `rgba(255,170,120,${.3 * (1 - age / 1.4)})`; ctx.lineWidth = (14 - age * 8) * dpr;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.stroke(); }
      ctx.globalCompositeOperation = "lighter";
      for (const d of dust) { d.y -= d.v; d.x += Math.sin(t * .006 + d.ph) * .2 * dpr; if (d.y < -5) d.y = H + 5;
        const inBeam = Math.max(0, 1 - Math.abs(d.x / W - (.2 + .55 * d.y / H)) * 3.5);
        ctx.globalAlpha = (.08 + .3 * inBeam) * (.6 + .4 * Math.sin(t * .02 + d.ph)) * vis * (.4 + .6 * bulb) * (1 - lurk * .7); ctx.drawImage(GLOW, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2); }
      for (const e of embers) {
        e.y -= e.v * (.3 + life) * (1 + emberKick * 5); e.x += Math.sin(t * .02 + e.ph) * .5 * dpr + (e.x - cx) * .004 * emberKick;
        if (e.y < -20 || e.x < -20 || e.x > W + 20) { e.y = H + 10; e.x = rand(0, W); }
        if (playing && now < rg && prevNow < e.die && e.die <= now) smokes.push({ x: e.x, y: e.y, t0: tn });
        let ea = (.25 + .55 * Math.sin(t * .05 + e.ph) ** 2) * life * vis * (1 + emberKick), er = e.r;
        if (now < rg && now >= e.die) continue;
        if (now < rg && now > e.die - .3) { ea = Math.min(1, ea * 3); er *= 1.8; }               // 熄灭前最后亮一下
        ctx.globalAlpha = Math.min(1, ea); ctx.drawImage(EMB, e.x - er, e.y - er, er * 2, er * 2); }
      ctx.globalCompositeOperation = "source-over";
      smokes = smokes.filter(m => tn - m.t0 < 2200);
      for (const m of smokes) { const age = (tn - m.t0) / 1000;                                   // 熄灭后升起的一缕烟
        for (let j = 0; j < 7; j++) { const r = (5 + age * 12 + j * 2) * dpr, x = m.x + Math.sin(age * 2.6 + j * .8) * (4 + age * 10) * dpr, y = m.y - (age * 45 + j * 7) * dpr;
          ctx.globalAlpha = .13 * (1 - age / 2.2) * (1 - j / 7) * vis; ctx.drawImage(GLOW, x - r, y - r, r * 2, r * 2); } }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

      if (oldWeb) { const oa = (.22 + .1 * bulb) * vis * (1 - seg(now, 63, 68) * .5);
        ctx.strokeStyle = `rgba(205,208,220,${oa})`; ctx.lineWidth = .9 * dpr; ctx.beginPath();
        for (const l of oldWeb) { const sw = Math.sin(t * .012 + l.sw * 3) * l.sw * 6 * dpr;
          l.pts.forEach(([x, y], i) => { const k = l.hang ? i : 1; (i ? ctx.lineTo(x + sw * k, y) : ctx.moveTo(x + (l.hang ? sw : sw * (i ? 1 : 0)), y)); }); }
        ctx.stroke(); }
      // 蜘蛛垂下来的位置：挂在封面右上角
      const spAt = ((ev.spider || [])[0]) || 1e9, down = now >= spAt;
      const tx = (wr.left + wr.width * .84) * dpr, ty = down ? (wr.top + wr.height * .2) * dpr : -120 * dpr, ss = Math.max(16, wr.width * .068) * dpr;
      if (spY === null) spY = -200 * dpr;
      if (Math.abs(now - spAt) > 4 || !playing) { if (!down) spY = -200 * dpr; }
      spV += ((ty - spY) * (down ? .006 : .02) - spV * .12); spY += spV;
      const spVisible = spY > -150 * dpr;
      const eyeA = Math.min(1, (now >= m0 ? .95 : .45) + beat * .3 + lurk * .3) * (1 - dark * .6);
      if (spVisible) {   // 大影子：小画布画蜘蛛再放大（自然模糊），投在背景墙上，也投在封面上
        const sg = sdw.getContext("2d"); sg.clearRect(0, 0, 72, 72); spider(sg, 36, 48, 10, 0, 0, "rgba(0,0,0,1)");
        const k = 5.5; ctx.globalAlpha = .4 * vis; ctx.drawImage(sdw, tx - ss * 3, spY - ss * 3, ss * k * 2.2, ss * k * 2.2); ctx.globalAlpha = 1;
        const ox = (tx - wr.left * dpr) - ss * 5.8, oy = (spY - wr.top * dpr) + ss * .4;
        cc.globalAlpha = .38 * (1 - dark); cc.drawImage(sdw, ox, oy, ss * 9, ss * 9); cc.globalAlpha = 1;
      }

      const numb = now < rg ? seg(now, 1.5, 17) : Math.max(0, 1 - seg(now, rg, rg + 1.4));
      if (numb > .01) { const w = ccv.width, h = ccv.height, R = Math.hypot(w, h) / 2, ng = cc.createRadialGradient(w / 2, h * .45, R * (1 - numb * .78), w / 2, h * .45, R * 1.05);
        ng.addColorStop(0, "rgba(165,172,186,0)"); ng.addColorStop(1, `rgba(165,172,186,${.45 * numb})`); cc.fillStyle = ng; cc.fillRect(0, 0, w, h); }
      // 黑暗里睁开的眼睛：潜伏时几双，“我是蜘蛛”反复时越来越多
      ctx.fillStyle = `rgba(0,0,0,${Math.min(.92, .6 * lurk + .85 * dark)})`; if (lurk + dark > .01) ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (const e of eyes) {
        let open = 0;
        if (ev.lurk && e.k < 7) open = seg(now, ev.lurk + .8 + e.k * .9, ev.lurk + 1.3 + e.k * .9) * (.4 + .6 * lurk);
        (ev.mantra || []).forEach((m, j) => { const n0 = j ? 18 : 0; open = Math.max(open, seg(now, m + (e.k - n0) * .32, m + (e.k - n0) * .32 + .4) * (e.k < (j ? 44 : 22) ? 1 : 0)); });
        open *= 1 - dark; if (open < .02) continue;
        const blink = Math.abs(Math.sin((t + e.ph * 40) * .012)) > .985 ? .1 : 1, a = open * (.55 + .3 * Math.sin(t * .04 + e.ph) + beat * .3);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.tilt); ctx.scale(1, blink); ctx.globalAlpha = Math.min(1, a);
        const s = e.s * 15;
        for (const [ex, ey, er] of [[-.55, 0, 1], [.55, 0, 1], [-1.3, -.35, .65], [1.3, -.35, .65], [-.25, .7, .45], [.25, .7, .45]]) ctx.drawImage(EYE, ex * s - er * s, ey * s - er * s, er * s * 2, er * s * 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

      // 蛛网（结尾黑暗里也还留着露珠的光）
      const sweep = (t * .006) % 2;
      (ev.weave || []).forEach((t0, wi) => { const w = webs[wi]; if (!w || now < t0) return; drawWeb(w, Math.min(1, (now - t0) / 12), 1, 1 - dark * .85, 1, sweep); });

      // ── 最上层：射过整个屏幕的蛛丝 ──
      fx.lineCap = "round";
      for (const th of threads) {
        const t0 = (ev.weave || [])[th.wave]; if (t0 === undefined || now < t0 + th.delay) continue;
        const p = ease(Math.min(1, (now - t0 - th.delay) / .55)), [ax, ay] = th.A, [bx, by] = th.B;
        const mx = (ax + bx) / 2, my = (ay + by) / 2 + Math.hypot(bx - ax, by - ay) * th.sag, nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
        const amp = (beat * 7 + 1.2) * dpr, N = 28, pts = [];
        for (let i = 0; i <= N; i++) { const u = i / N * p, v = 1 - u, x = v * v * ax + 2 * v * u * mx + u * u * bx, y = v * v * ay + 2 * v * u * my + u * u * by;
          const o = Math.sin(u * Math.PI) * amp * Math.sin(t * .7 + th.ph); pts.push([x + nx / nl * o, y + ny / nl * o]); }
        fx.strokeStyle = `rgba(230,232,245,${.26 * (1 - dark * .9) * I})`; fx.lineWidth = .9 * dpr;
        fx.beginPath(); pts.forEach(([x, y], i) => (i ? fx.lineTo(x, y) : fx.moveTo(x, y))); fx.stroke();
        fx.globalCompositeOperation = "lighter";
        const head = p < 1 ? pts[N] : pts[Math.floor(((t * .004 * th.sp + th.ph) % 1) * N)], hr = (p < 1 ? 16 : 7) * dpr;
        fx.globalAlpha = (p < 1 ? 1 : .55) * (1 - dark) * I; fx.drawImage(GLOW, head[0] - hr, head[1] - hr, hr * 2, hr * 2);
        fx.globalAlpha = 1; fx.globalCompositeOperation = "source-over";
      }
      const ecgA = seg(now, .2, 1.2) * (1 - seg(now, rg + 5, rg + 8)) * (1 - dark);
      if (ecgA > .01) {   // 心电图：越跳越慢、越来越弱，最后拉成一条直线；“心脏再次跳动”时猛地跳起来
        const base = Math.max(14, wr.top - 7) * dpr, N = 180, span = 3.4, amp = 20 * dpr;
        const lg = fx.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, "rgba(255,60,50,0)"); lg.addColorStop(.85, `rgba(255,70,55,${.85 * ecgA})`); lg.addColorStop(1, `rgba(255,190,170,${ecgA})`);
        fx.beginPath(); let hy = base;
        for (let i = 0; i <= N; i++) { const x = i / N * W, tt = now - span * (1 - i / N); hy = base - hbAt(tt, ecg) * amp + Math.sin(tt * 90) * .4 * dpr; i ? fx.lineTo(x, hy) : fx.moveTo(x, hy); }
        fx.strokeStyle = lg; fx.lineWidth = 1.4 * dpr; fx.stroke();
        fx.globalCompositeOperation = "lighter"; fx.globalAlpha = .35; fx.lineWidth = 5 * dpr; fx.stroke();
        fx.globalAlpha = ecgA; fx.drawImage(EMB, W - 12 * dpr, hy - 12 * dpr, 24 * dpr, 24 * dpr); fx.globalAlpha = 1; fx.globalCompositeOperation = "source-over";
      }
      const hT = ev.husk || 16.3;
      if (now >= hT && now < rg + 2) {   // 那具“死去的躯壳”：半透明的蜕下来的旧皮，挂在角落；心跳回来时掉下去碎掉
        const k = ease(seg(now, hT, hT + 2.8)), hx = (wr.left + wr.width * .14) * dpr, hss = Math.max(13, wr.width * .05) * dpr;
        let hy = -60 * dpr + ((wr.top + wr.height * .14) * dpr + 60 * dpr) * k, rot = Math.sin(t * .015) * .14, a = 1;
        if (now >= rg) { const ft = now - rg; hy += ft * ft * 900 * dpr; rot += ft * 2.2; a = Math.max(0, 1 - ft / 1.3); }
        else { fx.strokeStyle = "rgba(215,215,225,.35)"; fx.lineWidth = .8 * dpr; fx.beginPath(); fx.moveTo(hx, 0); fx.lineTo(hx, hy - hss * 1.6); fx.stroke(); }
        fx.save(); fx.translate(hx, hy); fx.rotate(rot);
        spider(fx, 0, 0, hss, 0, 0, `rgba(225,214,196,${.3 * a})`); spider(fx, 0, -hss * .03, hss * .9, 0, 0, `rgba(255,248,236,${.12 * a})`); fx.restore();
      }
      if (spVisible) {
        fx.strokeStyle = `rgba(225,228,240,${.5 * I})`; fx.lineWidth = .9 * dpr; fx.beginPath(); fx.moveTo(tx, 0); fx.lineTo(tx, spY - ss * 1.6); fx.stroke();
        spider(fx, tx, spY, ss, eyeA, Math.min(1, Math.abs(spV) / (4 * dpr)));
      }
      // 碎屑
      chips = chips.filter(c => (c.life += dt) < c.max && c.y < H + 50);
      for (const c of chips) {
        c.vy += 1400 * dpr * dt; c.vx *= .985; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
        const a = Math.min(1, (1 - c.life / c.max) * 1.5);
        if (c.ember) { fx.globalCompositeOperation = "lighter"; fx.globalAlpha = a; const r = c.sz * 1.6; fx.drawImage(EMB, c.x - r, c.y - r, r * 2, r * 2); fx.globalAlpha = 1; fx.globalCompositeOperation = "source-over"; continue; }
        fx.save(); fx.translate(c.x, c.y); fx.rotate(c.rot); fx.scale(1, Math.cos(c.rot * 1.7));
        fx.beginPath(); c.sh.forEach(([x, y], i) => (i ? fx.lineTo(x * c.sz, y * c.sz) : fx.moveTo(x * c.sz, y * c.sz))); fx.closePath();
        fx.fillStyle = `rgba(150,138,124,${.9 * a})`; fx.fill(); fx.strokeStyle = `rgba(255,236,215,${.6 * a})`; fx.lineWidth = .8 * dpr; fx.stroke(); fx.restore();
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ You Can Do It：从沼泽深处冲出水面，一路飞上黄昏的天空 ═════════
  // 开头沉在昏暗的沼泽水底，头顶只有一点光；“砰！砰！咚！”在水里炸开电光 → “飛び出せよ”冲破水面，水花四溅，
  // 镜头一路升上黄昏的天空 → 云层朝身后飞过，风的光线划过 → 副歌全速飞行，金色的太阳光芒 → “心の檻を壊して”一排栏杆被撞碎 →
  // “今 飛べ！”冲破一整层云，飞到云海上面 → 第二段脚下是灯火闪烁的城市 → “世界が回る”整片天空旋转 → 结尾慢下来，只剩暖光
  SCENES.sky = (song) => {
    const ev = song.events || {};
    const seg = (now, a, b) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    const ease = x => 1 - Math.pow(1 - x, 3);
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const sprite = (r, stops) => { const c = document.createElement("canvas"); c.width = c.height = r * 2; const g = c.getContext("2d"), gr = g.createRadialGradient(r, r, 0, r, r, r);
      stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; };
    const GLOW = sprite(32, [[0, "rgba(255,255,255,1)"], [.3, "rgba(255,250,235,.45)"], [1, "rgba(255,240,220,0)"]]);
    const WARM = sprite(64, [[0, "rgba(255,246,220,1)"], [.12, "rgba(255,214,150,.8)"], [.4, "rgba(255,170,90,.25)"], [1, "rgba(255,140,60,0)"]]);
    const CYAN = sprite(32, [[0, "rgba(230,255,250,1)"], [.3, "rgba(120,230,210,.45)"], [1, "rgba(60,180,160,0)"]]);
    const MURK = sprite(64, [[0, "rgba(14,12,26,.85)"], [.6, "rgba(14,12,26,.35)"], [1, "rgba(14,12,26,0)"]]);
    // 太阳的光芒
    const RAYS = (() => { const S = 160, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
      g.translate(S / 2, S / 2); for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + rand(-.1, .1), w = rand(.02, .06), L = S / 2 * rand(.6, 1);
        const gr = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); gr.addColorStop(0, "rgba(255,225,170,.45)"); gr.addColorStop(.6, "rgba(255,210,150,.12)"); gr.addColorStop(1, "rgba(255,200,130,0)");
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L); g.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L); g.closePath(); g.fill(); }
      return c; })();

    // ── 云：用分形噪声画出来，从右下方被夕阳照亮（和封面一样金色的云底），做冷色/金色两套 ──
    function makeNoise(seed) {
      let s = seed * 7919 + 13; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
      const P = new Uint8Array(512); for (let i = 0; i < 512; i++) P[i] = p[i & 255]; const V = new Float32Array(256).map(() => r());
      return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = V[P[(xi & 255) + P[yi & 255]]], b = V[P[((xi + 1) & 255) + P[yi & 255]]], c = V[P[(xi & 255) + P[(yi + 1) & 255]]], d = V[P[((xi + 1) & 255) + P[(yi + 1) & 255]]];
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    }
    let SPR = null;
    function buildClouds() {   // 一团团球形的“棉絮”叠出积云：每团按球面法线受光（夕阳在右侧），边缘用噪声吃掉一点，显得蓬松
      const w = 340, h = 180, cool = [], gold = [];
      const Lx = .72, Ly = .2, Lz = .66;
      for (let k = 0; k < 7; k++) {
        const N = makeNoise(k * 3 + 7), puffs = [];
        const n = 34 + k * 2;
        for (let i = 0; i < n; i++) { const u = rand(.08, .92), mound = Math.sin(u * Math.PI), r = (14 + mound * 34) * rand(.7, 1.15);
          puffs.push([u * w, h * .72 - r * rand(.15, .85) - mound * rand(0, 26), r]); }
        puffs.sort((p, q) => p[1] - q[1] ? q[2] - p[2] : 0);
        const mk = (sh, lit, rim) => {
          const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), id = g.createImageData(w, h), d = id.data;
          const buf = new Float32Array(w * h * 4);
          for (const [px, py, r] of puffs) {
            const x0 = Math.max(0, px - r | 0), x1 = Math.min(w - 1, px + r | 0), y0 = Math.max(0, py - r | 0), y1 = Math.min(h - 1, py + r | 0);
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
              const dx = (x - px) / r, dy = (y - py) / r, dd = dx * dx + dy * dy; if (dd >= 1) continue;
              const nz = Math.sqrt(1 - dd), nn = N(x / 9, y / 9), edge = Math.sqrt(dd) + (nn - .5) * .45;
              let al = Math.min(1, Math.max(0, (1 - edge) / .42)); if (y > h * .7) al *= Math.max(0, 1 - (y - h * .7) / (h * .08));
              if (al <= 0) continue;
              const ndl = Math.max(0, dx * Lx + dy * Ly + nz * Lz), sh2 = .4 + .6 * Math.pow(ndl, 1.3) + (nn - .5) * .16;
              const ci = (y * w + x) * 4, cr = [0, 1, 2].map(j => sh[j] + (lit[j] - sh[j]) * Math.min(1, sh2) + rim[j] * Math.pow(ndl, 6) * .5);
              const oa = buf[ci + 3], na = al + oa * (1 - al);
              for (let j = 0; j < 3; j++) buf[ci + j] = (cr[j] * al + buf[ci + j] * oa * (1 - al)) / na;
              buf[ci + 3] = na;
            }
          }
          for (let i = 0; i < w * h; i++) { d[i * 4] = Math.min(255, buf[i * 4]); d[i * 4 + 1] = Math.min(255, buf[i * 4 + 1]); d[i * 4 + 2] = Math.min(255, buf[i * 4 + 2]); d[i * 4 + 3] = buf[i * 4 + 3] * 240; }
          g.putImageData(id, 0, 0); return c; };
        cool.push(mk([62, 74, 104], [150, 160, 186], [255, 196, 140]));
        gold.push(mk([128, 110, 142], [255, 206, 162], [255, 246, 220]));
      }
      SPR = { cool, gold, w, h }; window.__skySPR = SPR;
    }

    let clouds = [], streaks = [], silt = [], bubbles = [], drops = [], rings = [], arcs = [], gbub = [], fogs = [], lights = [], shards = [], puffs = [];
    let D = 0, t = 0, lastNow = 0, lastTn = 0, ema = .2, beat = 0, lastBeatT = -9, speed = .3, boost = 0, kick = 0, flash = 0, flashCol = "255,250,235";
    let wrapEl = null, lastScale = "", spawnAcc = 0, gmS = null, nearArmed = true, lastWhoosh = 0;
    const DIR = (() => { const x = -1, y = .42, l = Math.hypot(x, y); return [x / l, y / l]; })();   // 云往左下飞过 = 我们往右上飞

    // ═══ 声效：全部用 Web Audio 现场合成（风声、呼啸、玻璃碎裂、穿云的闷响、心跳、风铃） ═══
    const SFX = (() => {
      let ac = null, out, white, brown, wg, wf, wl, hg, hf, wp;
      function ready() {
        if (ac) return true; ac = window.__ac; if (!ac) return false;
        out = ac.createGain(); out.gain.value = .6; out.connect(ac.destination);
        const L = ac.sampleRate * 3; white = ac.createBuffer(2, L, ac.sampleRate); brown = ac.createBuffer(2, L, ac.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const w = white.getChannelData(ch), br = brown.getChannelData(ch); let last = 0;
          for (let i = 0; i < L; i++) { const r = Math.random() * 2 - 1; w[i] = r; last = (last + .02 * r) / 1.02; br[i] = last * 3.5; } }
        // 持续的风声：低沉的棕噪声 + 高速时的尖啸
        const s1 = ac.createBufferSource(); s1.buffer = brown; s1.loop = true;
        wf = ac.createBiquadFilter(); wf.type = "bandpass"; wf.Q.value = .7; wf.frequency.value = 400;
        wl = ac.createBiquadFilter(); wl.type = "lowpass"; wl.frequency.value = 3000;
        wp = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
        wg = ac.createGain(); wg.gain.value = 0; s1.connect(wf); wf.connect(wl); wl.connect(wg); wg.connect(wp); wp.connect(out); s1.start();
        const s2 = ac.createBufferSource(); s2.buffer = white; s2.loop = true;
        hf = ac.createBiquadFilter(); hf.type = "bandpass"; hf.Q.value = 6; hf.frequency.value = 1800;
        hg = ac.createGain(); hg.gain.value = 0; s2.connect(hf); hf.connect(hg); hg.connect(out); s2.start();
        return true;
      }
      const at = () => ac.currentTime;
      function pan(node, p) { if (!ac.createStereoPanner) return node; const pn = ac.createStereoPanner(); pn.pan.value = p; node.connect(pn); return pn; }
      function env(g, t, a, d, v) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
      function whoosh(dur = .8, f0 = 300, f1 = 2600, vol = .5, p = 0, p1 = null) {
        if (!ready()) return; const t = at(), s = ac.createBufferSource(); s.buffer = white;
        const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.4; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * .55); f.frequency.exponentialRampToValueAtTime(f0 * .8, t + dur);
        const g = ac.createGain(); env(g, t, dur * .4, dur * .6, vol);
        s.connect(f); f.connect(g); let n = g;
        if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.setValueAtTime(p, t); if (p1 !== null) pn.pan.linearRampToValueAtTime(p1, t + dur); g.connect(pn); n = pn; }
        n.connect(out); s.start(t, rand(0, 2)); s.stop(t + dur + .1);
      }
      function thump(f0 = 90, f1 = 38, dur = .5, vol = .7, delay = 0) {
        if (!ready()) return; const t = at() + delay, o = ac.createOscillator(), g = ac.createGain();
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, .008, dur, vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
      }
      function ping(freq, t, dur, vol, type = "sine", p = 0) {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq; env(g, t, .003, dur, vol); o.connect(g); pan(g, p).connect(out); o.start(t); o.stop(t + dur + .05);
      }
      function noiseHit(t, dur, hp, vol, p = 0) {
        const s = ac.createBufferSource(); s.buffer = white; const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
        const g = ac.createGain(); env(g, t, .002, dur, vol); s.connect(f); f.connect(g); pan(g, p).connect(out); s.start(t, rand(0, 2)); s.stop(t + dur + .05);
      }
      function crack() { if (!ready()) return; const t = at(); noiseHit(t, .09, 2200, .7); for (let i = 0; i < 6; i++) noiseHit(t + rand(.01, .16), .03, 4000, .25, rand(-.8, .8)); thump(140, 60, .25, .35); }
      function shatter() { if (!ready()) return; const t = at(); noiseHit(t, .5, 2800, .55); noiseHit(t, .25, 900, .3); thump(110, 45, .35, .4);
        for (let i = 0; i < 46; i++) ping(rand(2400, 7800), t + Math.pow(Math.random(), 1.6) * 1.3, rand(.08, .35), rand(.02, .06), "sine", rand(-1, 1)); }
      function chime(n = 12, spread = 1.4, vol = .05) { if (!ready()) return; const t = at(), sc = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3];
        for (let i = 0; i < n; i++) ping(1046 * sc[rand(0, sc.length) | 0], t + rand(0, spread), rand(.6, 1.4), vol, "triangle", rand(-.9, .9)); }
      function wind(vel, mist, playing) {
        if (!ready()) return; const t = at(), k = playing ? Math.min(1, vel / 900) : 0;
        wg.gain.setTargetAtTime(playing ? .05 + k * .32 : 0, t, .25);
        wf.frequency.setTargetAtTime(220 + k * 900, t, .3); wl.frequency.setTargetAtTime(mist > .2 ? 700 : 3200, t, .2);
        hg.gain.setTargetAtTime(playing ? Math.max(0, k - .45) * .05 : 0, t, .3); hf.frequency.setTargetAtTime(1400 + k * 1600 + Math.sin(t * .7) * 300, t, .4);
        if (wp.pan) wp.pan.setTargetAtTime(Math.sin(t * .23) * .4, t, .5);
      }
      return { whoosh, thump, crack, shatter, chime, wind };
    })();
    // ═══ 3D：镜头一路向上攀升，一层层穿过云 ═══
    let G3 = null;
    function start3D() {
      if (G3) return; G3 = { ok: false };
      const go = () => { try { G3 = build3D(); } catch (e) { console.warn("sky3d", e); G3 = { ok: false, failed: true }; } };
      if (window.THREE) return go();
      const s = document.createElement("script"); s.src = "/music/assets/three.min.js"; s.onload = go; s.onerror = () => (G3 = { ok: false, failed: true });
      document.head.appendChild(s);
    }
    function build3D() {
      const T = window.THREE; T.ColorManagement.enabled = false;
      const cvs = document.createElement("canvas");
      cvs.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none";
      document.body.insertBefore(cvs, document.body.firstChild);
      const bdrop = document.querySelector(".backdrop"); if (bdrop) bdrop.style.display = "none";
      const gl = new T.WebGLRenderer({ canvas: cvs, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      gl.outputColorSpace = T.LinearSRGBColorSpace;
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(62, 1, 4, 30000); cam.rotation.order = "YXZ";
      const resize3 = () => { gl.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = cam.aspect < 1 ? 80 : 62; cam.updateProjectionMatrix(); };
      resize3(); addEventListener("resize", resize3);

      // 天空穹顶：地平线的暖色、头顶的深蓝、太阳的光晕，最后几秒出现星星
      const U = { top: { value: new T.Color() }, hor: { value: new T.Color() }, bot: { value: new T.Color() }, sunCol: { value: new T.Color(1, .8, .55) },
        sunDir: { value: new T.Vector3(.5, .07, -1).normalize() }, night: { value: 0 }, sunI: { value: 1 } };
      const dome = new T.Mesh(new T.SphereGeometry(20000, 32, 16), new T.ShaderMaterial({ uniforms: U, side: T.BackSide, depthWrite: false, fog: false,
        vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform vec3 top, hor, bot, sunCol, sunDir; uniform float night, sunI; varying vec3 vDir;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
          void main(){ vec3 d = normalize(vDir); float y = d.y;
            vec3 c = y > 0. ? mix(hor, top, pow(clamp(y, 0., 1.), .42)) : mix(hor, bot, pow(clamp(-y, 0., 1.), .35));
            float s = max(dot(d, sunDir), 0.);
            c += sunCol * (pow(s, 5.) * .32 + pow(s, 48.) * .7 + pow(s, 700.) * 2.5) * sunI;
            vec3 q = floor(d * 420.); float st = step(.9978, h(q)) * smoothstep(.08, .5, y) * night;
            c += vec3(st) * (.5 + .5 * h(q + 3.));
            gl_FragColor = vec4(c, 1.); }` }));
      dome.renderOrder = -10; scene.add(dome);
      scene.fog = new T.Fog(0xffffff, 1500, 16000);

      // 一团团云的贴图：几颗球形的棉絮叠在一起，按球面受光（夕阳在右前方偏低的位置）
      function puffTex(k) {
        const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), id = g.createImageData(S, S), d = id.data;
        const N = makeNoise(k * 11 + 3), buf = new Float32Array(S * S * 4), Lx = .7, Ly = .3, Lz = .65;
        const ps = Array.from({ length: 16 }, () => { const a = rand(0, 6.28), r = rand(0, .22); return [.5 + Math.cos(a) * r, .53 + Math.sin(a) * r * .6, rand(.12, .24)]; });
        ps.sort((p, q) => p[1] - q[1]);
        for (const [px, py, pr] of ps) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const dx = (x / S - px) / pr, dy = (y / S - py) / pr, dd = dx * dx + dy * dy; if (dd >= 1) continue;
          const nz = Math.sqrt(1 - dd), nn = N(x / 14, y / 14), edge = Math.sqrt(dd) + (nn - .5) * .5;
          const al = Math.min(1, Math.max(0, (1 - edge) / .6)) * .9; if (al <= 0) continue;
          const ndl = Math.max(0, dx * Lx + dy * Ly + nz * Lz), sh = Math.min(1, .45 + .55 * Math.pow(ndl, 1.1) + (nn - .5) * .12);
          const col = [146 + 109 * sh, 142 + 104 * sh, 152 + 86 * sh];
          const ci = (y * S + x) * 4, oa = buf[ci + 3], na = al + oa * (1 - al);
          for (let j = 0; j < 3; j++) buf[ci + j] = (col[j] * al + buf[ci + j] * oa * (1 - al)) / na;
          buf[ci + 3] = na;
        }
        for (let i = 0; i < S * S; i++) { d[i * 4] = buf[i * 4]; d[i * 4 + 1] = buf[i * 4 + 1]; d[i * 4 + 2] = buf[i * 4 + 2]; d[i * 4 + 3] = buf[i * 4 + 3] * 235; }
        g.putImageData(id, 0, 0); const t3 = new T.CanvasTexture(c); return t3;
      }
      const texs = [0, 1, 2, 3, 4].map(puffTex);
      const mats = []; texs.forEach(tx => { for (let r = 0; r < 4; r++) mats.push(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, fog: true, rotation: r * 1.57 + rand(-.3, .3) })); });

      // 太阳的光晕
      const sunTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, "rgba(255,250,230,1)"); gr.addColorStop(.08, "rgba(255,226,170,.9)"); gr.addColorStop(.3, "rgba(255,180,110,.25)"); gr.addColorStop(1, "rgba(255,150,80,0)");
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
      const sun = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
      sun.renderOrder = -5; scene.add(sun);

      // 往下掠过的光尘：速度越快拉得越长
      const NP = 260, pPos = new Float32Array(NP * 3), seeds = Array.from({ length: NP }, () => [rand(-900, 900), rand(0, 1700), rand(-1800, 150)]);
      const pGeo = new T.BufferGeometry(); pGeo.setAttribute("position", new T.BufferAttribute(pPos, 3));
      const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, "rgba(255,245,220,1)"); gr.addColorStop(.3, "rgba(255,220,160,.5)"); gr.addColorStop(1, "rgba(255,200,140,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c); })();
      const pMat = new T.PointsMaterial({ map: dotTex, size: 9, sizeAttenuation: true, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, fog: false });
      const parts = new T.Points(pGeo, pMat); parts.frustumCulled = false; scene.add(parts);

      // ── 高度 = 速度对时间的积分（预先算好，拖动进度条也能对得上） ──
      const E = ev, inCh = t => (E.chorus || []).some(([a, b]) => t >= a && t < b);
      const f0 = (E.fly || [])[0] || 1e9, f1 = (E.fly || [])[1] || 1e9;
      const spd = t => {
        let v = t < (E.breach || 4.6) ? 35 : 150;
        if (t > 11.9) v = 260; if (t > 16) v = 330; if (t > 32) v = 460; if (inCh(t)) v = 700; if (t > f0 + .6 && t < 63) v = 380; if (t > 63) v = 360; if (t > 78.4) v = 520;
        if (inCh(t) && t > 87) v = 760; if (t > f1 + .6) v = 440; if (t > 116.6) v = 420; if (t > (E.outro || 123)) v = 300; if (t > (E.end || 139)) v = 110;
        for (const t0 of [E.breach || 4.6, ...(E.go || []), ...(E.dash || []), ...(E.wall || []), f0, f1]) if (t >= t0) v += 900 * Math.exp(-(t - t0) / .5);
        return v;
      };
      const DT = .05, NT = Math.ceil(165 / DT), A = new Float32Array(NT + 2); { let vv = 60, alt = 0; for (let i = 0; i <= NT + 1; i++) { vv += (spd(i * DT) - vv) * (1 - Math.exp(-DT / .45)); A[i] = alt; alt += vv * DT; } }
      const altAt = t => { const f = Math.max(0, Math.min(NT, t / DT)), i = f | 0; return A[i] + (A[i + 1] - A[i]) * (f - i); };

      // ── 云层：普通的薄云层 + “今 飛べ”时要冲破的厚云层（顶面正好在那一刻的高度）+ “檻を壊して”时撞穿的云墙 ──
      const rng = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) / 4294967296); };
      const specs = [], R0 = rng(5), forced = [];
      const tc = E.clear || 22.7, aOC = altAt(tc);
      [tc, f0, f1].forEach(t => t < 1e8 && forced.push({ y: altAt(t), th: t === tc ? 380 : 300, kind: "top" }));
      (E.wall || []).forEach(t => forced.push({ y: altAt(t), th: 90, kind: "wall" }));
      for (let y = 380, maxA = altAt(160) + 4000; y < maxA; y += 520 + R0() * 620)
        if (!forced.some(f => Math.abs(f.y - y) < 520)) specs.push({ y, th: 70 + R0() * 120, kind: "deck" });
      specs.push(...forced); specs.forEach((s, i) => (s.seed = i * 7 + 3));
      const live = new Map();
      function buildLayer(s) {
        const r = rng(s.seed), grp = new T.Group(), top = s.kind === "top";
        const nCl = top ? 34 : s.kind === "wall" ? 12 : 8 + (r() * 5 | 0);
        for (let c = 0; c < nCl; c++) {
          const near = c < (top ? 8 : s.kind === "wall" ? 7 : 2);
          const cx = near ? (top || s.kind === "wall" ? (r() - .5) * 800 : (r() < .5 ? -1 : 1) * (450 + r() * 600)) : (r() - .5) * (top ? 16000 : 9000), cz = near ? -r() * 800 + 150 : -r() * (top ? 15000 : 9000) + 700;
          const cr = top ? 700 + r() * 900 : 350 + r() * 550, np = top ? 12 : 9 + (r() * 6 | 0);
          for (let p = 0; p < np; p++) {
            const sp = new T.Sprite(mats[r() * mats.length | 0]), sc = (top ? 700 : 380) + r() * (top ? 800 : 480);
            const u = r(), up = u * u;                                                  // 底部平、顶上鼓起来
            const yy = top ? s.y - sc * .42 - r() * s.th : s.y - s.th * .5 + up * s.th * 1.6;
            sp.position.set(cx + (r() - .5) * cr * 2 * (1 - up * .4), yy, cz + (r() - .5) * cr * 1.4 * (1 - up * .4));
            sp.scale.set(sc, sc * (.75 + r() * .2), 1); grp.add(sp);
          }
        }
        scene.add(grp); return grp;
      }
      function manage(alt) {
        for (const s of specs) { const on = s.y > alt - (s.kind === "top" ? 5200 : 1400) && s.y < alt + 4200;
          if (on && !live.has(s)) live.set(s, buildLayer(s));
          if (!on && live.has(s)) { scene.remove(live.get(s)); live.delete(s); } }
      }
      const pitchAt = t => {
        let p = .08 + .28 * ease(seg(t, 2, 14));
        const dip = (t0, t1) => { const a = ease(seg(t, t0 + .2, t0 + 1.8)), b = ease(seg(t, t1 - 2, t1)); return a * (1 - b); };
        p -= .55 * Math.max(dip(f0, 64.5), dip(f1, 118));
        p += .5 * ease(seg(t, (E.end || 139), (E.end || 139) + 7));
        return p;
      };
      const C = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      const tmp = new T.Vector3();
      function render(now, gm, beat, kick, spin, t) {
        const alt = altAt(now), vel = (altAt(now + .05) - alt) / .05;
        manage(alt);
        const hi = seg(now, f1 + .5, f1 + 3) * (1 - seg(now, (E.outro || 123), (E.outro || 123) + 4)), en = seg(now, E.end || 139, (E.end || 139) + 8);
        // 天空的颜色只跟高度有关：阴云下面灰蓝、昏暗、看不到太阳 → 冲出阴云是金色的黄昏 → 越往上头顶越深 → 最高处出现星星
        const aTop = altAt(150), clr = ease(seg(alt, aOC - 120, aOC + 260)), u = Math.max(0, Math.min(1, (alt - aOC) / (aTop - aOC)));
        const low = Math.min(1, alt / Math.max(1, aOC));
        const pal = (st, x) => { for (let i = 1; i < st.length; i++) if (x <= st[i][0]) { const k = (x - st[i - 1][0]) / (st[i][0] - st[i - 1][0]); return C(st[i - 1][1], st[i][1], k); } return st[st.length - 1][1]; };
        const topA = pal([[0, [.12, .28, .52]], [.35, [.10, .22, .46]], [.6, [.08, .16, .40]], [.85, [.05, .09, .26]], [1, [.03, .05, .14]]], u);
        const horA = pal([[0, [1, .72, .46]], [.35, [1, .68, .40]], [.6, [1, .6, .36]], [.85, [.96, .5, .36]], [1, [.86, .42, .34]]], u);
        const botA = pal([[0, [.62, .52, .5]], [.6, [.56, .44, .46]], [1, [.24, .2, .28]]], u);
        const topB = C([.22, .25, .32], [.17, .21, .31], low), horB = C([.40, .40, .45], [.46, .42, .45], low), botB = [.18, .2, .25];
        let top = C(topB, topA, clr), hor = C(horB, horA, clr), bot = C(botB, botA, clr);
        const night = clr * Math.max(0, (u - .82) / .18);
        U.top.value.setRGB(...top); U.hor.value.setRGB(...hor); U.bot.value.setRGB(...bot); U.night.value = night; U.sunI.value = clr * (1 + gm * .3 + beat * .15);
        const fogC = C(hor, top, .45); scene.fog.color.setRGB(...fogC); scene.fog.far = 7000 + clr * 11000; scene.fog.near = 600 + clr * 1200;
        const tint = C(C([.52, .55, .64], [.62, .64, .72], low), pal([[0, [1, .93, .85]], [.5, [1, .86, .8]], [.85, [.95, .74, .74]], [1, [.78, .62, .7]]], u), clr);
        mats.forEach(m => m.color.setRGB(...tint));
        cam.position.set(Math.sin(now * .13) * 60, alt, Math.sin(now * .09) * 30);
        cam.rotation.set(pitchAt(now) + Math.sin(t * .9) * kick * .006, Math.sin(now * .05) * .06, spin + Math.sin(now * .21) * .03);
        dome.position.copy(cam.position);
        tmp.copy(U.sunDir.value).multiplyScalar(15000).add(cam.position); sun.position.copy(tmp); const ss = 5200 * (1 + gm * .4); sun.scale.set(ss, ss, 1);
        sun.material.opacity = (.75 + gm * .25) * clr;
        // 光尘
        for (let i = 0; i < NP; i++) { const [x, oy, z] = seeds[i]; const y = ((oy - alt) % 1700 + 1700) % 1700 + alt - 600; pPos.set([x + Math.sin(now * .7 + i) * 20, y, z], i * 3); }
        pGeo.attributes.position.needsUpdate = true; pMat.opacity = (.25 + Math.min(.45, vel / 1600) + beat * .2) * (1 - en * .5);
        // 镜头钻进云里时的白雾
        let mist = 0, near = 9, nearX = 0;
        for (const g2 of live.values()) for (const sp of g2.children) { const d = sp.position.distanceTo(cam.position) / (sp.scale.x * .5);
          if (d < .8) mist = Math.max(mist, 1 - Math.max(0, (d - .3) / .5)); if (d < near) { near = d; nearX = sp.position.x - cam.position.x; } }
        gl.render(scene, cam);
        return { mist: Math.min(.75, mist * .8), tint, vel, near, nearX };
      }
      return { ok: true, render, canvas: cvs };
    }
    function init() {
      start3D();
      if (!SPR) buildClouds();
      D = Math.hypot(W, H);
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      clouds = Array.from({ length: 34 }, (_, i) => ({ x: rand(-D / 2, D / 2), y: rand(-D / 2, D / 2), z: .3 + Math.pow(i / 33, 1.3) * 1.5, k: i % 7, fl: Math.random() < .5 }));
      streaks = Array.from({ length: 46 }, () => ({ x: rand(-D / 2, D / 2), y: rand(-D / 2, D / 2), l: rand(.06, .22), z: rand(.6, 1.8), w: rand(.6, 1.6) }));
      silt = Array.from({ length: Math.round(80 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(1, 3) * dpr, ph: rand(0, 6.28), v: rand(.1, .4) * dpr }));
      bubbles = Array.from({ length: Math.round(26 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(1.5, 5) * dpr, v: rand(.4, 1.4) * dpr, ph: rand(0, 6.28) }));
      lights = Array.from({ length: Math.round(260 * area) }, () => { const d = Math.pow(Math.random(), 1.7);
        return { x: rand(0, W * 1.3), d, r: (1 + (1 - d) * 4) * dpr * rand(.6, 1.2), ph: rand(0, 6.28), c: Math.random() < .7 ? [255, rand(170, 215) | 0, 120] : Math.random() < .5 ? [255, 245, 230] : [150, 200, 255] }; });
    }
    const fire = (list, now, prev, fn) => (list || []).forEach(t0 => { if (t0 > prev && t0 <= now && now - t0 < .6) fn(t0); });
    const ring = (x, y, col, big = 1) => rings.push({ x, y, t0: performance.now(), col, big });
    function arc(col) {   // 一道电光：从屏幕边缘劈向中间
      const x0 = rand(0, W), y0 = Math.random() < .5 ? -10 : rand(0, H * .4), x1 = W * rand(.3, .7), y1 = H * rand(.35, .65), pts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14, j = Math.sin(u * Math.PI) * Math.min(W, H) * .07; pts.push([x0 + (x1 - x0) * u + rand(-j, j), y0 + (y1 - y0) * u + rand(-j, j)]); }
      arcs.push({ pts, t0: performance.now(), col });
    }
    // ── “break it! break it!”：第一下屏幕被砸出裂纹，第二下整块玻璃碎掉、一片片掉下去 ──
    let glass = null;
    function makeGlass() {
      const ix = W * rand(.42, .6), iy = H * rand(.3, .42), R = Math.hypot(Math.max(ix, W - ix), Math.max(iy, H - iy)) * 1.03;
      const n = 15, rings = [0, .045, .1, .18, .29, .43, .6, .8, 1.05], K = rings.length;
      const ang = Array.from({ length: n }, (_, i) => (i + rand(-.35, .35)) / n * 6.2832);
      const V = rings.map((r, k) => ang.map(a => { const rr = r * R * (k ? rand(.85, 1.15) : 0), aa = a + (k ? rand(-.05, .05) : 0); return [ix + Math.cos(aa) * rr, iy + Math.sin(aa) * rr]; }));
      const mid = (p, q, j) => [(p[0] + q[0]) / 2 + rand(-j, j), (p[1] + q[1]) / 2 + rand(-j, j)];
      const Mr = [], Mc = [];
      for (let k = 0; k < K; k++) { Mr.push([]); Mc.push([]); const j = R * .03 * (k + 1) / K;
        for (let i = 0; i < n; i++) { Mc[k].push(mid(V[k][i], V[k][(i + 1) % n], j)); if (k < K - 1) Mr[k].push(mid(V[k][i], V[k + 1][i], j)); } }
      const pcs = [], radial = new Path2D(), ringP = new Path2D();
      for (let k = 0; k < K - 1; k++) for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n, poly = [V[k][i], Mc[k][i], V[k][i2], Mr[k][i2], V[k + 1][i2], Mc[k + 1][i], V[k + 1][i], Mr[k][i]];
        const pcx = poly.reduce((s, p) => s + p[0], 0) / 8, pcy = poly.reduce((s, p) => s + p[1], 0) / 8;
        if (pcx < -R * .1 || pcx > W + R * .1 || pcy < -R * .1 || pcy > H + R * .1) continue;
        pcs.push({ poly: poly.map(([x, y]) => [x - pcx, y - pcy]), cx: pcx, cy: pcy, d: Math.hypot(pcx - ix, pcy - iy) / R, dir: Math.atan2(pcy - iy, pcx - ix),
          sp: rand(.4, 1.1), vr: rand(-3, 3), tilt: rand(2, 6), sheen: rand(.04, .14) });
      }
      for (let i = 0; i < n; i++) for (let k = 0; k < K - 1; k++) { radial.moveTo(...V[k][i]); radial.lineTo(...Mr[k][i]); radial.lineTo(...V[k + 1][i]); }
      for (let k = 2; k < K; k++) for (let i = 0; i < n; i++) if (Math.random() < .75) { ringP.moveTo(...V[k][i]); ringP.lineTo(...Mc[k][i]); ringP.lineTo(...V[k][(i + 1) % n]); }
      return { ix, iy, R, pcs, radial, ringP, t0: performance.now(), t1: 0, snap: null };
    }
    function snapScreen() {   // 把当前画面（天空 + 封面）拍下来，碎片上贴的就是它
      const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
      try { if (G3 && G3.ok) g.drawImage(G3.canvas, 0, 0, W, H); g.drawImage(ctx.canvas, 0, 0); } catch (e) {}
      const img = document.querySelector("#cover");
      if (wrapEl && img) { const wr = wrapEl.getBoundingClientRect(), ir = img.getBoundingClientRect();
        g.save(); g.beginPath(); g.rect(wr.left * dpr, wr.top * dpr, wr.width * dpr, wr.height * dpr); g.clip();
        g.fillStyle = "#151c2a"; g.fill(); try { g.drawImage(img, ir.left * dpr, ir.top * dpr, ir.width * dpr, ir.height * dpr); } catch (e) {}
        const sg = g.createLinearGradient(0, wr.top * dpr, 0, wr.bottom * dpr); sg.addColorStop(.55, "rgba(16,24,38,0)"); sg.addColorStop(1, "rgba(16,24,38,.85)"); g.fillStyle = sg; g.fillRect(wr.left * dpr, wr.top * dpr, wr.width * dpr, wr.height * dpr);
        g.restore(); }
      return c;
    }
    function drawGlass(fx, tn) {
      if (!glass) return;
      const age = Math.max(0, (tn - glass.t0) / 1000), cg = Math.max(.01, ease(Math.min(1, age / .14)));
      if (!glass.t1) {   // 只是裂了：裂纹从撞击点一下子爬满屏幕
        if (age > 6) { glass = null; return; }
        fx.save(); fx.beginPath(); fx.arc(glass.ix, glass.iy, glass.R * cg, 0, 6.29); fx.clip(); fx.lineJoin = "round";
        fx.strokeStyle = "rgba(10,14,24,.35)"; fx.lineWidth = 2.4 * dpr; fx.save(); fx.translate(dpr, dpr); fx.stroke(glass.radial); fx.stroke(glass.ringP); fx.restore();
        fx.strokeStyle = "rgba(255,255,255,.85)"; fx.lineWidth = 1 * dpr; fx.stroke(glass.radial); fx.lineWidth = .8 * dpr; fx.strokeStyle = "rgba(240,248,255,.7)"; fx.stroke(glass.ringP);
        fx.globalCompositeOperation = "lighter"; fx.strokeStyle = `rgba(200,225,255,${.25 + .15 * Math.sin(age * 9)})`; fx.lineWidth = 4 * dpr; fx.stroke(glass.radial);
        fx.restore();
        const r = 40 * dpr * (1 + (1 - cg)); fx.globalCompositeOperation = "lighter"; fx.globalAlpha = .9; fx.drawImage(GLOW, glass.ix - r, glass.iy - r, r * 2, r * 2); fx.globalAlpha = 1; fx.globalCompositeOperation = "source-over";
        return;
      }
      const ft0 = Math.max(0, (tn - glass.t1) / 1000); if (ft0 > 2.2) { glass = null; return; }
      for (const p of glass.pcs) {
        const ft = Math.max(0, ft0 - p.d * .35);
        const dist = ft * glass.R * .35 * p.sp, x = p.cx + Math.cos(p.dir) * dist, y = p.cy + Math.sin(p.dir) * dist + ft * ft * H * 1.3;
        if (y - glass.R * .3 > H) continue;
        const sc = 1 + ft * .25, sx = Math.cos(ft * p.tilt), a = Math.max(0, 1 - ft / 1.4);
        fx.save(); fx.globalAlpha = a; fx.translate(x, y); fx.rotate(p.vr * ft); fx.scale(sc * sx, sc);
        fx.beginPath(); p.poly.forEach(([qx, qy], k) => (k ? fx.lineTo(qx, qy) : fx.moveTo(qx, qy))); fx.closePath();
        fx.save(); fx.clip(); fx.drawImage(glass.snap, -p.cx, -p.cy);
        const sh = fx.createLinearGradient(-60 * dpr, -60 * dpr, 60 * dpr, 60 * dpr); sh.addColorStop(0, `rgba(255,255,255,${p.sheen + (1 - Math.abs(sx)) * .25})`); sh.addColorStop(.5, "rgba(255,255,255,0)"); sh.addColorStop(1, `rgba(180,210,255,${p.sheen * .6})`);
        fx.fillStyle = sh; fx.fill(); fx.restore();
        fx.strokeStyle = "rgba(255,255,255,.75)"; fx.lineWidth = 1.2 * dpr; fx.stroke(); fx.restore();
      }
    }
    function center() { const r = wrapEl ? wrapEl.getBoundingClientRect() : null; return r ? [(r.left + r.width / 2) * dpr, (r.top + r.height / 2) * dpr] : [W / 2, H / 2]; }

    function draw(I, level, fx) {
      t++;
      const tn = performance.now(), dt = Math.min(.05, (tn - (lastTn || tn)) / 1000); lastTn = tn;
      const now = window.__time || 0, playing = !!window.__playing, bass = window.__bass || 0, prev = lastNow; lastNow = now;
      if (!wrapEl) wrapEl = document.querySelector(".cover-wrap");
      ema += (bass - ema) * .05; if (playing && bass > ema * 1.18 && bass > .26 && now - lastBeatT > .28) { lastBeatT = now; beat = 1; } beat *= .88;
      const [cx, cy] = center();
      const chorus = (ev.chorus || []).some(([a, b]) => now >= a && now < b) ? 1 : 0;

      // ── 时间线上的瞬间 ──
      if (playing) {
        fire(ev.bang, now, prev, () => { SFX.thump(70, 36, .45, .3); flash = Math.max(flash, .3); flashCol = "255,236,200"; kick = 1; ring(cx, cy, "255,214,160"); });
        fire([ev.breach], now, prev, () => { SFX.whoosh(1.4, 180, 3200, .75, -.4, .4); flash = .7; flashCol = "255,246,225"; kick = 1.3; boost = 4; ring(cx, cy, "255,236,200", 1.8); });
        fire(ev.wall, now, prev, () => { SFX.whoosh(1.1, 150, 1800, .7); SFX.thump(70, 30, .7, .55); flash = Math.max(flash, .55); flashCol = "255,244,225"; kick = 1.3; boost = Math.min(5, boost + 3);   // 撞穿挡在面前的一堵云墙
          if (!(G3 && G3.ok)) for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + rand(-.25, .25); puffs.push({ a, k: i % 7, t0: tn, sp: rand(.6, 1), fl: Math.random() < .5, small: 1 }); } });
        fire(ev.boom, now, prev, () => { SFX.thump(62, 40, .35, .55); kick = 1; ring(cx, cy, "255,120,90", 1.2); });
        fire([ev.clear], now, prev, () => { flash = .8; flashCol = "255,236,200"; kick = 1.2; SFX.whoosh(1.6, 150, 3200, .75, -.3, .3); SFX.chime(12, 1.8, .04); });
        fire(ev.flash, now, prev, () => { flash = Math.max(flash, .55); flashCol = "255,250,240"; });
        fire(ev.brk, now, prev, t0 => { kick = 1.5; ring(cx, cy, "255,230,190");
          if (t0 === (ev.brk || [])[0] || !glass) { glass = makeGlass(); if (t0 === (ev.brk || [])[0]) SFX.crack(); }
          if (t0 !== (ev.brk || [])[0]) SFX.shatter();
          if (t0 !== (ev.brk || [])[0]) { glass.snap = snapScreen(); glass.t1 = performance.now(); flash = Math.max(flash, .5); flashCol = "235,245,255"; } });
        fire(ev.go, now, prev, () => { SFX.whoosh(.55, 400, 3400, .45, rand(-.5, .5)); boost = Math.min(5, boost + 2.4); kick = .8; });
        fire(ev.clap, now, prev, () => { kick = 1; flash = Math.max(flash, .25); flashCol = "255,240,210"; ring(cx, cy, "255,240,210", .8); });
        fire(ev.dash, now, prev, () => { SFX.whoosh(.55, 350, 3000, .45, rand(-.5, .5)); boost = Math.min(5, boost + 2.6); });
        fire(ev.shout, now, prev, () => { SFX.whoosh(.6, 500, 2800, .35, rand(-.6, .6)); kick = 1.2; ring(cx, cy, "255,215,150", 1.6); });
        fire(ev.jump, now, prev, () => { kick = .9; });
        fire(ev.burst, now, prev, () => { SFX.whoosh(.9, 300, 2600, .5); SFX.chime(10, 1.2, .045); kick = 1.3; flash = Math.max(flash, .5); flashCol = "255,225,170"; ring(cx, cy, "255,200,130", 2);
          for (let i = 0; i < 70; i++) { const a = rand(0, 6.28), sp = rand(300, 1200) * dpr; shards.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(2, 6) * dpr, life: 0, max: rand(.8, 1.8), rot: rand(0, 6), vr: rand(-8, 8) }); } });
        fire(ev.fly, now, prev, () => { SFX.whoosh(1.8, 120, 3600, .85, -.3, .3); SFX.thump(80, 28, 1, .6); SFX.chime(14, 2, .04); flash = 1; flashCol = "255,248,230"; kick = 1.5; boost = 5;
          if (!(G3 && G3.ok)) for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + rand(-.2, .2); puffs.push({ a, k: i % 7, t0: tn, sp: rand(.8, 1.3), fl: Math.random() < .5 }); } });
        fire([ev.spin && ev.spin[0]], now, prev, () => SFX.whoosh(1.9, 300, 2000, .55, -.9, .9));
        fire([(ev.spin || [])[1]], now, prev, () => { SFX.chime(16, 1.6, .05);     // “バラバラでもいい”：碎成一片片金色的光
          for (let i = 0; i < 90; i++) { const a = rand(0, 6.28), sp = rand(80, 500) * dpr; shards.push({ x: cx + rand(-60, 60) * dpr, y: cy + rand(-60, 60) * dpr, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(2, 5) * dpr, life: 0, max: rand(1.5, 3), rot: rand(0, 6), vr: rand(-4, 4) }); } });
      }

      // ── 速度：沼泽里几乎不动 → 副歌全速 → 结尾慢下来 ──
      const br = ev.breach || 4.6;
      let target = now < br ? .45 : 1;
      if (now > 32) target = 1.5; if (chorus) target = 3.2; if (now > 63) target = 1.2; if (now > 78.4) target = 1.8;
      if (now > 104.7) target = 2.6; if (now > (ev.outro || 123)) target = 1.6; if (now > (ev.end || 139)) target = .25;
      if (!playing) target *= .25;
      speed += (target + beat * .4 - speed) * .03; boost *= .975; kick *= .9;
      const v = speed + boost;
      if (!(G3 && G3.ok)) SFX.wind(v * 250, 0, playing);

      // ── 天空颜色：冷色黄昏 → 金色 ──
      let gm = seg(now, br, 14) * .35; if (now > 32) gm = .5; if (chorus) gm = .9; if (now > 63) gm = .55; if (now > (ev.repaint || 70.4)) gm = .85; if (now > 104.7) gm = 1;
      if (now > (ev.end || 139)) gm = 1 - seg(now, ev.end, ev.end + 8) * .2;
      gmS = gmS === null ? gm : gmS + (gm - gmS) * .02; gm = gmS;
      const top = mix([20, 34, 58], [32, 60, 98], gm), midC = mix([50, 74, 104], [104, 122, 142], gm), bot = mix([176, 112, 72], [255, 184, 104], gm);
      const rise = 1;
      const skyOff = (rise - 1) * H * .7;
      let g; const sz0 = Math.max(W, H) * .3;
      const sp = ev.spin || [1e9, 1e9], spin = ease(seg(now, sp[0], sp[1])) * 6.283;
      const use3D = G3 && G3.ok;
      if (use3D) {
        const r3 = G3.render(now, gm, beat, kick, spin, t);
        SFX.wind(r3.vel, r3.mist, playing);
        if (playing && r3.near < 1.5 && nearArmed && tn - lastWhoosh > 450) { nearArmed = false; lastWhoosh = tn; SFX.whoosh(.9, 250, 1500, .35, Math.max(-.9, Math.min(.9, r3.nearX / 600)), -Math.max(-.9, Math.min(.9, r3.nearX / 600)) * .3); }
        if (r3.near > 2.2) nearArmed = true;
        if (r3.mist > .01) { ctx.fillStyle = `rgba(${r3.tint.map(v => Math.min(255, v * 250 | 0))},${r3.mist})`; ctx.fillRect(0, 0, W, H); }
      } else {
      g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${top})`); g.addColorStop(.55, `rgb(${midC})`); g.addColorStop(1, `rgb(${bot})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 太阳 + 光芒（右下方，和封面一样）
      const sx = W * .92, sy = H * .42 + (1 - rise) * H * .5, sunA = (.35 + gm * .3) * (.75 + chorus * .25 + beat * .12);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = sunA; const SR = Math.max(W, H) * (.45 + gm * .2); ctx.drawImage(WARM, sx - SR, sy - SR, SR * 2, SR * 2);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * .0008); ctx.globalAlpha = (.07 + gm * .12 + chorus * .07) * (1 - seg(now, ev.end || 139, (ev.end || 139) + 8) * .5);
      const RR = Math.max(W, H) * 1.4; ctx.drawImage(RAYS, -RR, -RR, RR * 2, RR * 2); ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

      // ── 云和风：整片天空可以旋转（“世界が回る”） ──
      ctx.save(); ctx.translate(W / 2, H / 2 + skyOff); ctx.rotate(spin);
      const moveK = dt * dpr * 60 * 2.2;
      const drawCloud = (c, a) => {
        const s = sz0 * c.z, w = s, h = s * SPR.h / SPR.w, x = c.x, y = c.y;
        if (x + w / 2 < -D / 2 - w || x - w / 2 > D / 2 + w) return;
        ctx.globalAlpha = a * (1 - gm); ctx.save(); ctx.translate(x, y); if (c.fl) ctx.scale(-1, 1);
        ctx.drawImage(SPR.cool[c.k], -w / 2, -h / 2, w, h); ctx.globalAlpha = a * gm; ctx.drawImage(SPR.gold[c.k], -w / 2, -h / 2, w, h); ctx.restore();
      };
      for (const c of clouds) {
        c.x += DIR[0] * v * c.z * moveK; c.y += DIR[1] * v * c.z * moveK;
        const s = sz0 * c.z, lim = D / 2 + s;
        if (c.x < -lim) { c.x = lim; c.y = rand(-D / 2, D / 2) - D * .2; } if (c.y > lim) { c.y = -lim; c.x = rand(-D / 2, D / 2) + D * .2; }
        if (c.z > 1.25) continue;
        drawCloud(c, (.3 + .55 * Math.min(1, c.z)) * I);
      }
      // 风的光线：速度越快越多越长
      const sa = Math.min(1, Math.max(0, (v - .7) / 2.2)) * I;
      if (sa > .01) { ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
        for (const s of streaks) { s.x += DIR[0] * v * s.z * moveK * 2.6; s.y += DIR[1] * v * s.z * moveK * 2.6;
          if (s.x < -D / 2 || s.y > D / 2) { s.x = rand(0, D / 2) + D * .1; s.y = rand(-D / 2, 0) - D * .05; if (s.x > D / 2) s.x = D / 2; }
          const L = s.l * D * Math.min(1.6, v / 2.2), x2 = s.x - DIR[0] * L, y2 = s.y - DIR[1] * L;
          const lg = ctx.createLinearGradient(s.x, s.y, x2, y2); lg.addColorStop(0, `rgba(255,236,200,${.55 * sa})`); lg.addColorStop(1, "rgba(255,220,170,0)");
          ctx.strokeStyle = lg; ctx.lineWidth = s.w * dpr; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(x2, y2); ctx.stroke(); }
        ctx.globalCompositeOperation = "source-over"; }
      for (const c of clouds) if (c.z > 1.25) drawCloud(c, .92 * I);
      ctx.restore(); ctx.globalAlpha = 1;

      // ── 云海：冲破云层之后，脚下是一整片被夕阳照亮的云海 ──
      const seaA = Math.max(seg(now, (ev.fly || [])[0] || 1e9, ((ev.fly || [])[0] || 1e9) + 1) * (1 - seg(now, 63, 65.5)), seg(now, 104.5, 106) * (1 - seg(now, 116.5, 119)));
      if (seaA > .01) { const n = 9, s = W / n * 2.6, off = (t * v * dpr * 1.6) % (W / n);
        for (let i = -2; i < n + 2; i++) { const x = i * W / n - off, y = H * (.9 + .05 * Math.sin(i * 1.7)) + (1 - seaA) * H * .3;
          ctx.globalAlpha = seaA * I * .85; ctx.drawImage(SPR.gold[(i + 70) % 7], x - s / 2, y - s * .3, s, s * SPR.h / SPR.w); } ctx.globalAlpha = 1; }
      }

      // ── 城市的灯火（第二段：ザワザワ鳴る街） ──
      const cityR = ev.city || [1e9, 1e9], cityA = seg(now, cityR[0], cityR[0] + 1.5) * (1 - seg(now, cityR[1] - .5, cityR[1] + 1));
      if (cityA > .01) {
        const lift = (1 - ease(cityA)) * H * .35 - kick * 8 * dpr, top0 = H * .7 + lift;
        g = ctx.createLinearGradient(0, top0, 0, H); g.addColorStop(0, "rgba(10,14,28,0)"); g.addColorStop(.35, `rgba(10,14,28,${.75 * cityA})`); g.addColorStop(1, `rgba(6,8,18,${.95 * cityA})`);
        ctx.fillStyle = g; ctx.fillRect(0, top0, W, H - top0);
        ctx.globalCompositeOperation = "lighter";
        for (const L of lights) { L.x -= v * dpr * .5 * (.3 + L.d); if (L.x < -10) L.x += W * 1.3;
          const y = top0 + H * .08 + L.d * H * .24, tw = .55 + .45 * Math.sin(t * .05 + L.ph * 7) ** 2;
          ctx.globalAlpha = Math.min(1, cityA * tw * (.5 + L.d * .5) * I); const r = L.r * 3; ctx.drawImage(GLOW, L.x - r, y - r, r * 2, r * 2);
          ctx.globalAlpha *= .5; ctx.drawImage(WARM, L.x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }

      // ── 沼泽水底：开头整个画面沉在里面，冲出水面时整片往下退 ──
      if (rise < 1) {
        const oy = rise * H * 1.15;
        g = ctx.createLinearGradient(0, oy, 0, oy + H); g.addColorStop(0, "#14382f"); g.addColorStop(.35, "#0a201b"); g.addColorStop(1, "#020807");
        ctx.fillStyle = g; ctx.fillRect(0, oy, W, H + 10);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 5; i++) {          // 水面上透下来的光柱，轻轻摇晃
          const x = W * (.15 + i * .18) + Math.sin(t * .01 + i * 2) * W * .04, w = W * (.05 + .03 * Math.sin(t * .007 + i));
          const lg = ctx.createLinearGradient(0, oy, 0, oy + H * .9); lg.addColorStop(0, `rgba(150,230,200,${.16 + .06 * Math.sin(t * .02 + i)})`); lg.addColorStop(1, "rgba(80,180,150,0)");
          ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x - w * .5, oy); ctx.lineTo(x + w * .5, oy); ctx.lineTo(x + w * 2.2, oy + H * .9); ctx.lineTo(x - w * 1.2, oy + H * .9); ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = .8; const tr = Math.max(W, H) * .7; ctx.drawImage(CYAN, W / 2 - tr, oy - tr * .55, tr * 2, tr * 1.1); ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(200,255,240,.55)"; ctx.lineWidth = 2 * dpr; ctx.beginPath();   // 波动的水面
        for (let x = 0; x <= W; x += 12 * dpr) { const y = oy + Math.sin(x / (40 * dpr) + t * .06) * 3 * dpr + Math.sin(x / (17 * dpr) - t * .09) * 1.5 * dpr; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        for (const s of silt) { s.y += Math.sin(t * .01 + s.ph) * .2; s.x += s.v * .3; if (s.x > W) s.x = 0;
          ctx.globalAlpha = .25 + .2 * Math.sin(t * .03 + s.ph); ctx.drawImage(CYAN, s.x - s.r, oy + s.y - s.r, s.r * 2, s.r * 2); }
        for (const b of bubbles) { b.y -= b.v * (1 + flash * 4); if (b.y < 0) b.y = H; const x = b.x + Math.sin(t * .04 + b.ph) * 4 * dpr;
          ctx.globalAlpha = .6; ctx.strokeStyle = "rgba(200,255,240,.7)"; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x, oy + b.y, b.r, 0, 6.29); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
      // 冲出水面的水花
      drops = drops.filter(d => (d.life = (tn - (d.t0 ??= tn)) / 1000) < 2.2 && d.y < H + 40);
      if (drops.length) { ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
        for (const d of drops) { d.vy += 2400 * dpr * dt; d.x += d.vx * dt; d.y += d.vy * dt;
          ctx.strokeStyle = `rgba(215,250,245,${.7 * (1 - d.life / 2.2)})`; ctx.lineWidth = d.r; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * .02, d.y - d.vy * .02); ctx.stroke(); }
        ctx.globalCompositeOperation = "source-over"; }

      // ── “シュワシュワ泡立つ夢がモヤモヤを飲み込んでく”：金色气泡升起，把灰暗的雾吞掉 ──
      const bb = ev.bubbles || 1e9, fogT = ev.fog || 1e9;
      if (now > bb - 1 && now < fogT + 3) {
        if (!fogs.length) for (let i = 0; i < 7; i++) fogs.push({ x: rand(0, W), y: rand(H * .1, H * .9), r: rand(.25, .45) * Math.max(W, H), ph: rand(0, 6) });
        const fa = seg(now, bb - 1, bb) * (1 - ease(seg(now, fogT, fogT + 2)));
        for (const f of fogs) { const r = f.r * (1 - seg(now, fogT, fogT + 2) * .7); ctx.globalAlpha = fa * .7; ctx.drawImage(MURK, f.x + Math.sin(t * .01 + f.ph) * 20 * dpr - r, f.y - r, r * 2, r * 2); }
        ctx.globalAlpha = 1;
        if (playing && now < fogT + 1.5) { spawnAcc += dt * 70; while (spawnAcc > 1) { spawnAcc--; gbub.push({ x: rand(0, W), y: H + 20, r: rand(3, 13) * dpr, vy: -rand(120, 360) * dpr, ph: rand(0, 6), t0: tn, life: 0 }); } }
      } else fogs = [];
      gbub = gbub.filter(b => b.y > -30 && tn - b.t0 < 6000 && (b.life += dt) >= 0);
      if (gbub.length) { ctx.globalCompositeOperation = "lighter";
        for (const b of gbub) { b.y += b.vy * dt; const x = b.x + Math.sin(b.life * 3 + b.ph) * 10 * dpr;
          ctx.globalAlpha = .55; ctx.drawImage(WARM, x - b.r * 1.6, b.y - b.r * 1.6, b.r * 3.2, b.r * 3.2);
          ctx.globalAlpha = .8; ctx.strokeStyle = "rgba(255,236,190,.8)"; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.29); ctx.stroke();
          ctx.drawImage(GLOW, x - b.r * .55 - b.r * .2, b.y - b.r * .55 - b.r * .2, b.r * .4, b.r * .4); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }

      // 冲击波
      rings = rings.filter(r => tn - r.t0 < 1300);
      ctx.globalCompositeOperation = "lighter";
      for (const r of rings) { const a = Math.max(0, (tn - r.t0) / 1300), R = (.25 + ease(a) * .6) * Math.max(W, H) * r.big;
        ctx.globalAlpha = .55 * Math.pow(1 - a, 2); ctx.drawImage(WARM, r.x - R, r.y - R, R * 2, R * 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

      // 结尾：心里的光——封面后面一团越来越暖的光
      const endA = seg(now, ev.outro || 123, (ev.end || 139) + 4);
      if (endA > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = endA * .8 * (1 + beat * .3); const R = Math.max(W, H) * (.4 + endA * .4);
        ctx.drawImage(WARM, cx - R, cy - R, R * 2, R * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }

      // ════ 最上层 ════
      // 电光
      arcs = arcs.filter(a => tn - a.t0 < 320);
      for (const a of arcs) { const k = Math.min(1, 1 - (tn - a.t0) / 320), col = a.col === "cyan" ? "170,255,240" : "255,225,170";
        fx.globalCompositeOperation = "lighter"; fx.lineJoin = "round";
        [[9, .18], [3.5, .5], [1.2, 1]].forEach(([lw, al]) => { fx.strokeStyle = `rgba(${col},${al * k})`; fx.lineWidth = lw * dpr; fx.beginPath(); a.pts.forEach(([x, y], i) => (i ? fx.lineTo(x, y) : fx.moveTo(x, y))); fx.stroke(); });
        fx.globalCompositeOperation = "source-over"; }
      // “心の檻を壊して”：一排栏杆挡在面前，然后被撞碎
      for (const [c0, c1] of ev.cage || []) {
        if (now < c0 || now > c1 + 1.6) continue;
        const n = 9, gap = W / n, inA = ease(seg(now, c0, c0 + .35)), br2 = now > c1 ? now - c1 : 0;
        if (br2 > 0 && br2 < .2) { flash = Math.max(flash, .7); flashCol = "255,240,215"; kick = 1.4; }
        for (let i = 0; i < n; i++) { const x0 = gap * (i + .5);
          for (let p = 0; p < 6; p++) { const y0 = H / 6 * p, h = H / 6;
            let x = x0, y = y0 - (1 - inA) * H, rot = 0, a = 1;
            if (br2 > 0) { const dirx = (x0 - cx) / W, diry = (y0 + h / 2 - cy) / H; x += dirx * br2 * 2200 * dpr; y += diry * br2 * 1800 * dpr + br2 * br2 * 900 * dpr; rot = (i + p) % 2 ? br2 * 5 : -br2 * 5; a = Math.max(0, 1 - br2 / 1.4); }
            fx.save(); fx.translate(x, y + h / 2); fx.rotate(rot); fx.globalAlpha = a * .8;
            const lg = fx.createLinearGradient(-5 * dpr, 0, 5 * dpr, 0); lg.addColorStop(0, "rgba(20,22,30,.9)"); lg.addColorStop(.7, "rgba(60,62,72,.9)"); lg.addColorStop(1, "rgba(255,210,150,.9)");
            fx.fillStyle = lg; fx.fillRect(-4 * dpr, -h / 2, 8 * dpr, h - (br2 > 0 ? 3 * dpr : 0)); fx.restore(); } }
        fx.globalAlpha = 1;
      }
      // “今 飛べ！”：冲破一整层云——云团从中间朝四周猛地散开
      puffs = puffs.filter(p => tn - p.t0 < 1500);
      for (const p of puffs) { const a = Math.max(0, (tn - p.t0) / 1500), d = (.22 + Math.pow(a, 1.4) * .9) * D * p.sp, s = sz0 * (p.small ? .6 + a * 3.5 : .8 + a * 5);
        const x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d; fx.globalAlpha = Math.min(1, (1 - a) * 1.6, a * 8) * .85;
        fx.save(); fx.translate(x, y); if (p.fl) fx.scale(-1, 1); fx.drawImage(SPR.gold[p.k], -s / 2, -s * SPR.h / SPR.w / 2, s, s * SPR.h / SPR.w); fx.restore(); }
      fx.globalAlpha = 1;
      // 金色碎光
      shards = shards.filter(s => (s.life = (tn - (s.t0 ??= tn)) / 1000) < s.max);
      if (shards.length) { fx.globalCompositeOperation = "lighter";
        for (const s of shards) { s.vx *= .97; s.vy = s.vy * .97 + 60 * dpr * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
          const a = Math.pow(1 - s.life / s.max, 1.5) * (.6 + .4 * Math.sin(s.life * 14 + s.rot)); fx.globalAlpha = a; fx.drawImage(WARM, s.x - s.r * 3, s.y - s.r * 3, s.r * 6, s.r * 6);
          fx.globalAlpha = a * .9; fx.drawImage(GLOW, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }
        fx.globalAlpha = 1; fx.globalCompositeOperation = "source-over"; }
      // “明日を塗り替えろ”：一道光从左扫到右，把天空刷成更亮的颜色
      const rp = ev.repaint || 1e9;
      if (now > rp && now < rp + 1.3) { const k = (now - rp) / 1.3, x = -W * .3 + k * W * 1.6;
        const lg = fx.createLinearGradient(x - W * .25, 0, x + W * .05, 0); lg.addColorStop(0, "rgba(255,220,160,0)"); lg.addColorStop(.85, `rgba(255,236,200,${.35 * (1 - k)})`); lg.addColorStop(1, "rgba(255,255,240,0)");
        fx.globalCompositeOperation = "lighter"; fx.fillStyle = lg; fx.fillRect(0, 0, W, H); fx.globalCompositeOperation = "source-over"; }
      drawGlass(fx, tn);
      // 全屏闪光
      if (flash > .01) { fx.globalCompositeOperation = "lighter"; const fg = fx.createRadialGradient(W * .85, H * .4, 0, W * .85, H * .4, Math.max(W, H) * 1.1);
        fg.addColorStop(0, `rgba(${flashCol},${flash * .6})`); fg.addColorStop(1, `rgba(${flashCol},${flash * .15})`); fx.fillStyle = fg; fx.fillRect(0, 0, W, H); fx.globalCompositeOperation = "source-over"; }
      flash *= .9;
      // 封面跟着鼓点、冲击轻轻一跳
      if (wrapEl) { const sc = (1 + Math.min(1.5, kick) * .02 + (chorus ? beat * .01 : 0)).toFixed(4); if (sc !== lastScale) { wrapEl.style.scale = sc; lastScale = sc; } }
    }
    return { init, draw, wet: false };
  };

  // ═════════ Meaningless：意识流剪辑——摄影片段跟着歌词一段段切换，女孩一直在画面中间 ═════════
  // 片段已经按歌词时间剪成一条和歌一样长的视频（montage.mp4），这里让它和音乐严格同步；
  // 切换的瞬间闪一下、画面撕裂；副歌唱到“背叛、嫉妒、失望”时画面错位抖动；
  // Bridge 整个画面像信号坏掉一样破碎；最后“我的世界一直在崩塌”，女孩一条条碎裂、坠落，沉入黑暗
  SCENES.montage = (song) => {
    const ev = song.events || {};
    const seg = (now, a, b) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    let wrapEl = null, bgv = null, mv = null, girlEl = null, girlImg = null, tiny = null, tg = null, grain = [], lastNow = 0, flash = 0, tear = 0, strips = null;
    function setup() {
      if (wrapEl) return true;
      wrapEl = document.querySelector(".cover-wrap"); if (!wrapEl) return false;
      mv = document.createElement("video");
      mv.src = `/music/media/${song.id}/${song.montage}?r=${song.rev || 0}`; mv.muted = true; mv.playsInline = true; mv.preload = "auto";
      mv.setAttribute("playsinline", ""); mv.setAttribute("muted", "");
      mv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.2s";
      girlEl = document.createElement("img"); girlEl.src = `/music/media/${song.id}/${song.girl}?r=${song.rev || 0}`; girlEl.alt = "";
      girlEl.style.cssText = "position:absolute;bottom:0;left:50%;height:100%;width:auto;transform:translateX(-50%);opacity:0;transition:opacity 1.2s;pointer-events:none;filter:contrast(1.05)";
      const shade = wrapEl.querySelector(".cover-shade"); wrapEl.insertBefore(mv, shade); wrapEl.insertBefore(girlEl, shade);
      girlImg = girlEl;
      // 背景：同一条片段清晰地铺满整个屏幕（压暗一点，让中间的封面和歌词更突出）
      bgv = document.createElement("video"); bgv.src = mv.src; bgv.muted = true; bgv.playsInline = true; bgv.preload = "auto";
      bgv.setAttribute("playsinline", ""); bgv.setAttribute("muted", "");
      bgv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;opacity:0;transition:opacity 1.2s;filter:brightness(.5) contrast(1.05);pointer-events:none";
      document.body.insertBefore(bgv, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      tiny = document.createElement("canvas"); tiny.width = 160; tiny.height = 90; tg = tiny.getContext("2d");
      for (let k = 0; k < 3; k++) { const c = document.createElement("canvas"); c.width = c.height = 200; const g = c.getContext("2d"), id = g.createImageData(200, 200);
        for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
        g.putImageData(id, 0, 0); grain.push(c); }
      return true;
    }
    function init() {}
    // 封面框里：视频（object-fit:cover）和女孩各自在画布上的位置
    function rects() {
      const r = wrapEl.getBoundingClientRect(), x = r.left * dpr, y = r.top * dpr, w = r.width * dpr, h = r.height * dpr;
      const s = Math.max(w / 960, h / 540), vw = 960 * s, vh = 540 * s;
      const gh = h, gw = gh * (girlImg.naturalWidth || 1001) / (girlImg.naturalHeight || 1024);
      return { x, y, w, h, vx: x + (w - vw) / 2, vy: y + (h - vh) / 2, vs: s, gx: x + (w - gw) / 2, gy: y, gw, gh };
    }
    // 画一条横向的“撕裂”：同一条带子的视频 + 女孩，往旁边错开
    function slice(fx, R, y0, hh, dx, a) {
      fx.save(); fx.globalAlpha = a; fx.beginPath(); fx.rect(R.x, y0, R.w, hh); fx.clip();
      try { fx.drawImage(mv, (R.x - R.vx) / R.vs - dx / R.vs, (y0 - R.vy) / R.vs, R.w / R.vs, hh / R.vs, R.x, y0, R.w, hh); } catch (e) {}
      if (girlImg.complete) { const sy = (y0 - R.gy) / R.gh * girlImg.naturalHeight, sh = hh / R.gh * girlImg.naturalHeight;
        fx.drawImage(girlImg, 0, sy, girlImg.naturalWidth, sh, R.gx + dx, y0, R.gw, hh); }
      fx.restore();
    }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      // ── 视频跟音乐严格同步 ──
      for (const v of [mv, bgv]) if (v.readyState >= 1) {
        if (playing) { if (v.paused) v.play().catch(() => {}); if (Math.abs(v.currentTime - now) > .18) v.currentTime = now; v.style.opacity = 1; }
        else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - now) > .1 && now > 0) v.currentTime = now; }
      }
      if (playing) girlEl.style.opacity = strips ? 0 : 1;
      const R = rects();
      // ── 背景：同一段画面放大、虚化、压暗，铺满整个屏幕 ──
      const vg = ctx.createRadialGradient(W / 2, H * .4, Math.min(W, H) * .2, W / 2, H * .4, Math.max(W, H) * .8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.7)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      // 胶片颗粒
      ctx.globalAlpha = .07; ctx.globalCompositeOperation = "overlay"; const gp = ctx.createPattern(grain[(Math.random() * 3) | 0], "repeat"); ctx.fillStyle = gp; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      if (!playing && now === 0) return;

      // ── 每一次切换：闪一下 + 撕裂一下 ──
      if (playing) for (const c of ev.cuts || []) if (c > prev && c <= now && now - c < .4) { flash = Math.max(flash, .35); tear = Math.max(tear, .6); }
      const inG = (ev.glitch || []).some(([a, b]) => now >= a && now < b), brk = ev.breaking && now >= ev.breaking[0] && now < ev.breaking[1];
      const col = ev.collapse || 1e9;
      let g = tear; if (inG) g = Math.max(g, .35 + level * .6); if (brk) g = Math.max(g, .9);
      if (now > col - 2.5 && now < col) g = Math.max(g, seg(now, col - 2.5, col) * .8);
      tear *= .86;
      if (g > .05 && mv.readyState >= 2 && !strips) {
        const n = 2 + (g * 7 | 0), top = R.y, bottom = R.y + R.h * .72;
        for (let i = 0; i < n; i++) { if (Math.random() > .55 + g * .4) continue;
          const hh = (4 + Math.random() * (10 + g * 40)) * dpr, y0 = top + Math.random() * (bottom - top - hh), dx = (Math.random() - .5) * g * 90 * dpr;
          slice(fx, R, y0, hh, dx, .9);
          if (Math.random() < g * .5) { fx.globalCompositeOperation = "lighter"; fx.fillStyle = `rgba(255,255,255,${.08 + g * .15})`; fx.fillRect(R.x, y0 + hh * .5, R.w, Math.max(1, dpr)); fx.globalCompositeOperation = "source-over"; } }
        if (brk || inG) { fx.fillStyle = `rgba(0,0,0,${.15 * g})`; for (let y = R.y; y < R.y + R.h; y += 3 * dpr) fx.fillRect(R.x, y, R.w, dpr); }  // 扫描线
      }
      if (flash > .01) { fx.save(); fx.beginPath(); fx.rect(R.x, R.y, R.w, R.h); fx.clip(); fx.fillStyle = `rgba(255,255,255,${flash})`; fx.fillRect(R.x, R.y, R.w, R.h); fx.restore(); }
      flash *= .8;

      // ── 结尾：“我的世界一直在崩塌”——女孩碎成一条条，往下坠落，消失在黑暗里 ──
      if (playing && col > prev && col <= now && now - col < .5 && girlImg.complete) {
        strips = []; const n = 28;
        for (let i = 0; i < n; i++) { const y0 = R.gy + R.gh * i / n; strips.push({ y0, h: R.gh / n + 1, dx: 0, vy: 0, vx: (Math.random() - .5) * 60 * dpr, d: Math.random() * .9 + (1 - i / n) * .6, rot: 0 }); }
        strips.t0 = performance.now();
      }
      if (strips && (now < col - .2)) { strips = null; }        // 往回拖进度条时恢复
      if (strips) {
        girlEl.style.opacity = 0;
        const age = (performance.now() - strips.t0) / 1000;
        fx.save(); fx.beginPath(); fx.rect(R.x, R.y, R.w, R.h); fx.clip();
        for (const s of strips) { const ft = Math.max(0, age - s.d), jit = age < s.d ? (Math.random() - .5) * 6 * dpr * Math.min(1, age / s.d) : 0;
          const yy = s.y0 + ft * ft * 700 * dpr, xx = R.gx + jit + s.vx * ft, a = Math.max(0, 1 - ft / 1.6);
          if (a <= 0) continue; fx.globalAlpha = a;
          const sy = (s.y0 - R.gy) / R.gh * girlImg.naturalHeight, sh = s.h / R.gh * girlImg.naturalHeight;
          fx.drawImage(girlImg, 0, sy, girlImg.naturalWidth, sh, xx, yy, R.gw, s.h); }
        fx.restore(); fx.globalAlpha = 1;
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 黒い輪あそび：黑死病时代的童谣 ═════════
  // 封面框里是空荡的中世纪街道，人物（女孩、母亲、鸟嘴医生……）跟着歌词一个个出现又消失；
  // 背景是同一条街，压暗成旧纸的颜色。灰烬一直在落，红色的花瓣、身上开出的黑斑、钟声的震动、敲门、堆土、
  // 门上画的圈、落下的黑羽毛、城市变成棺材；最后“ばたり”一下全黑，再浮现出现代的那张照片
  SCENES.plague = (song) => {
    const ev = song.events || {};
    const seg = (now, a, b) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    const ease = x => 1 - Math.pow(1 - x, 3);
    let wrapEl = null, mainEl = null, bgEl = null, street = null, imgs = {}, layA = null, layB = null, cur = "", modern = null;
    let ash = [], petals = [], blots = [], feathers = [], puffs = [], lastNow = 0, shake = 0, toll = 0, lastShake = "";
    const BLOT = [];
    function mkBlot(seed) {   // 一块墨渍：很多小圆叠起来，边缘渗开
      const S = 220, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
      for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, r = Math.pow(Math.random(), .7) * S * .3, x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r, rr = (1 - r / (S * .32)) * S * .14 + 3;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, "rgba(8,5,4,.92)"); gr.addColorStop(.7, "rgba(22,10,8,.6)"); gr.addColorStop(1, "rgba(40,12,10,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.29); g.fill(); }
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = S * (.3 + Math.random() * .15); g.fillStyle = "rgba(18,10,6,.55)"; g.beginPath(); g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 1 + Math.random() * 4, 0, 6.29); g.fill(); }
      return c;
    }
    function setup() {
      if (wrapEl) return true;
      wrapEl = document.querySelector(".cover-wrap"); mainEl = document.querySelector("main"); if (!wrapEl) return false;
      const base = `/music/media/${song.id}/`;
      street = document.createElement("img"); street.src = base + "cover.jpg" + (song.rev ? "?r=" + song.rev : "");
      street.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:filter .8s";
      const mk = () => { const im = document.createElement("img"); im.style.cssText = "position:absolute;left:50%;bottom:0;transform:translateX(-50%);max-width:100%;height:92%;object-fit:contain;object-position:bottom;opacity:0;transition:opacity .7s, transform 1.2s;pointer-events:none"; return im; };
      layA = mk(); layB = mk();
      modern = document.createElement("img"); modern.src = base + "modern.jpg";
      modern.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 3s;pointer-events:none;filter:contrast(1.05)";
      const shade = wrapEl.querySelector(".cover-shade");
      [street, layA, layB, modern].forEach(e => wrapEl.insertBefore(e, shade));
      wrapEl.classList.remove("wide");
      const cv0 = document.querySelector("#cover"); if (cv0) cv0.style.visibility = "hidden";
      for (const k of song.chars || []) { const im = new Image(); im.src = `${base}c/${k}.webp`; imgs[k] = im; }
      bgEl = document.createElement("div");
      bgEl.style.cssText = `position:fixed;inset:-4%;z-index:-3;background:url(${base}cover.jpg${song.rev ? "?r=" + song.rev : ""}) center/cover;filter:brightness(.42) sepia(.35);animation:kb14 60s ease-in-out infinite alternate;pointer-events:none`;
      const st = document.createElement("style"); st.textContent = "@keyframes kb14{from{transform:scale(1)}to{transform:scale(1.12) translate(-2%,1%)}}"; document.head.appendChild(st);
      document.body.insertBefore(bgEl, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      for (let i = 0; i < 6; i++) BLOT.push(mkBlot(i));
      return true;
    }
    function init() {
      const area = Math.min(1.6, (W * H) / (dpr * dpr) / 330000);
      ash = Array.from({ length: Math.round(110 * area) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(.8, 2.6) * dpr, vy: rand(.2, .7) * dpr, ph: rand(0, 6.28), sp: rand(.5, 1.5) }));
    }
    function shotAt(now) { let k = ""; for (const [t, key] of ev.shots || []) if (t <= now) k = key; else break; return k; }
    let act = null;
    function show(key) {
      if (key === cur) return; cur = key;
      const old = act || layB; act = old === layA ? layB : layA; old.style.opacity = 0;
      const im = imgs[key]; if (!im) return;
      const l = act; l.src = im.src; const wide = key === "couple" || key === "cradle";
      l.style.height = key === "couple" ? "auto" : (key === "girlfull" || key === "doctor") ? "96%" : "88%"; l.style.width = key === "couple" ? "100%" : "auto";
      l.style.transform = "translateX(-50%) scale(1.04)"; requestAnimationFrame(() => { l.style.opacity = 1; l.style.transform = "translateX(-50%) scale(1)"; });
    }
    const fire = (list, now, prev, fn) => (list || []).forEach(t0 => { if (t0 > prev && t0 <= now && now - t0 < .5) fn(t0); });
    function inR(list, now) { return (list || []).some(([a, b]) => now >= a && now < b); }

    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const r = wrapEl.getBoundingClientRect(), R = { x: r.left * dpr, y: r.top * dpr, w: r.width * dpr, h: r.height * dpr }, cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      // ── 人物切换 ──
      const shot = shotAt(now), ghost = inR(ev.ghost, now);
      show(shot);
      if (ghost && act && act.style.opacity !== "0") act.style.opacity = (.6 + .15 * Math.sin(now * 3)).toFixed(2);
      // 街道的色调：越往后越暗
      const dim = Math.min(.45, now / 600) + seg(now, ev.empty || 1e9, (ev.empty || 1e9) + 10) * .15;
      street.style.filter = `sepia(.25) brightness(${(1 - dim).toFixed(2)}) contrast(1.05)`;
      // “ばたり”：一下子全黑，然后慢慢浮现出现代的那张照片
      const bt = ev.batari || 1e9, black = now >= bt && now < bt + 2.4;
      modern.style.opacity = now >= bt + 2.4 ? 1 : 0;
      if (black || now >= bt) { layA.style.opacity = 0; layB.style.opacity = 0; }

      // ── 钟声：画面往里一沉，四周一圈暗光扩散 ──
      if (playing) {
        fire(ev.bells, now, prev, () => { toll = 1; });
        fire(ev.knocks, now, prev, () => { shake = 1; });
        fire(ev.soil, now, prev, () => { for (let i = 0; i < 26; i++) puffs.push({ x: cx + rand(-R.w * .4, R.w * .4), y: R.y + R.h * rand(.85, 1), vx: rand(-40, 40) * dpr, vy: -rand(30, 120) * dpr, r: rand(10, 30) * dpr, t0: performance.now() }); });
        fire(ev.spots, now, prev, () => { for (let i = 0; i < 5; i++) { let x, y; do { x = rand(0, W); y = rand(0, H); } while (Math.hypot(x - cx, y - (R.y + R.h * .4)) < Math.min(R.w, R.h) * .38);
          blots.push({ x, y, s: rand(.35, .9) * Math.min(W, H) * .3, k: (Math.random() * 6) | 0, t0: now + i * .25, rot: rand(0, 6) }); } });
        fire(ev.feathers, now, prev, t0 => { const k = (ev.feathers || []).indexOf(t0);
          for (let i = 0; i < (k === 3 ? 1 : 7); i++) feathers.push({ x: cx + rand(-R.w * .45, R.w * .45), y: R.y - rand(10, 80) * dpr, vx: rand(-10, 10), vy: rand(30, 60) * dpr, rot: rand(0, 6), vr: rand(-1, 1), s: rand(10, 18) * dpr, kind: k, t0: performance.now(), ph: rand(0, 6) }); });
      }
      // 往回拖进度条时清掉“未来”的墨渍
      blots = blots.filter(b => b.t0 <= now + 2);
      toll *= .94; shake *= .85;
      const sh = shake > .02 ? `${(rand(-1, 1) * 6 * shake).toFixed(1)}px ${(rand(-1, 1) * 4 * shake).toFixed(1)}px` : "";
      if (sh !== lastShake && mainEl) { mainEl.style.translate = sh; lastShake = sh; }
      if (wrapEl) wrapEl.style.scale = (1 - toll * .012).toFixed(4);

      // ── 背景层（在封面后面）──
      const coffin = seg(now, ev.coffin || 1e9, (ev.coffin || 1e9) + 2.5) * (1 - seg(now, (ev.coffin || 1e9) + 6, (ev.coffin || 1e9) + 10));
      let vgA = .55 + toll * .25 + coffin * .4 + dim * .4;
      const vg = ctx.createRadialGradient(W / 2, H * .42, Math.min(W, H) * (.28 - coffin * .15), W / 2, H * .42, Math.max(W, H) * (.75 - coffin * .3));
      vg.addColorStop(0, "rgba(10,6,3,0)"); vg.addColorStop(1, `rgba(10,6,3,${Math.min(.97, vgA)})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (toll > .05) { const rr = (1 - toll) * Math.max(W, H) * .9 + R.w * .4; ctx.strokeStyle = `rgba(30,18,10,${toll * .5})`; ctx.lineWidth = 30 * dpr * toll; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.29); ctx.stroke(); }

      // ── 最上层 ──
      // 灰烬（“Ashes”时更多更快）
      const ashK = (inR(ev.ashes, now) ? 2.2 : 1) * (now >= bt && now < bt + 2.4 ? 0 : 1);
      for (const a of ash) { a.y += a.vy * ashK * (playing ? 1 : .3); a.x += Math.sin(now * a.sp + a.ph) * .4 * dpr; if (a.y > H + 5) { a.y = -5; a.x = rand(0, W); }
        fx.fillStyle = `rgba(${a.ph > 3 ? "210,200,185" : "60,50,45"},${(.35 + .25 * Math.sin(now * 2 + a.ph)) * Math.min(1, ashK)})`; fx.fillRect(a.x, a.y, a.r * 1.4, a.r); }
      // 红色的花瓣
      if (playing && inR(ev.petals, now) && Math.random() < .35) petals.push({ x: rand(0, W), y: -10, vx: rand(-20, 20) * dpr, vy: rand(40, 90) * dpr, rot: rand(0, 6), vr: rand(-2, 2), s: rand(4, 9) * dpr, ph: rand(0, 6), t0: performance.now() });
      const tn = performance.now();
      petals = petals.filter(p => p.y < H + 20 && tn - p.t0 < 15000);
      for (const p of petals) { const dt = 1 / 60; p.y += p.vy * dt; p.x += (p.vx + Math.sin(tn / 600 + p.ph) * 30 * dpr) * dt; p.rot += p.vr * dt;
        fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot); fx.scale(1, Math.cos(tn / 400 + p.ph));
        fx.fillStyle = "rgba(150,20,22,.85)"; fx.beginPath(); fx.ellipse(0, 0, p.s, p.s * .6, 0, 0, 6.29); fx.fill();
        fx.fillStyle = "rgba(200,50,45,.6)"; fx.beginPath(); fx.ellipse(-p.s * .2, -p.s * .1, p.s * .5, p.s * .3, 0, 0, 6.29); fx.fill(); fx.restore(); }
      // 黑斑：在屏幕边缘一块块渗开
      for (const b of blots) { const g = ease(seg(now, b.t0, b.t0 + 3)); if (g <= 0) continue; const s = b.s * (.3 + .7 * g) * (1 + Math.sin(now * .5 + b.rot) * .02);
        fx.save(); fx.globalAlpha = .85 * g * (now >= bt ? Math.max(0, 1 - (now - bt) / 2) : 1); fx.translate(b.x, b.y); fx.rotate(b.rot); fx.drawImage(BLOT[b.k], -s / 2, -s / 2, s, s); fx.restore(); }
      fx.globalAlpha = 1;
      // 堆土扬起的尘
      puffs = puffs.filter(p => tn - p.t0 < 2500);
      for (const p of puffs) { const a = (tn - p.t0) / 2500, x = p.x + p.vx * a * 2, y = p.y + p.vy * a * 2, rr = p.r * (1 + a * 2);
        const gr = fx.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(90,70,50,${.35 * (1 - a)})`); gr.addColorStop(1, "rgba(90,70,50,0)"); fx.fillStyle = gr; fx.beginPath(); fx.arc(x, y, rr, 0, 6.29); fx.fill(); }
      // “白い扉に丸を描く”：一个墨色的圈被一笔画出来
      const cT = ev.circle || 1e9;
      if (now > cT && now < cT + 9) { const p = ease(seg(now, cT, cT + 1.6)), a = 1 - seg(now, cT + 6, cT + 9);
        fx.save(); fx.translate(cx + R.w * .18, R.y + R.h * .32); fx.strokeStyle = `rgba(20,12,8,${.85 * a})`; fx.lineCap = "round";
        for (let k = 0; k < 2; k++) { fx.lineWidth = (7 - k * 3) * dpr; fx.beginPath(); const rad = R.w * .13 + k * 2 * dpr; fx.ellipse(0, 0, rad, rad * 1.08, -.2, -1.4, -1.4 + p * 6.5); fx.stroke(); }
        fx.restore(); }
      // 黑羽毛：一羽落下、二羽燃烧、三羽化成光消失、四羽在风里轻轻飘
      feathers = feathers.filter(f => tn - f.t0 < 9000 && f.y < H + 40);
      for (const f of feathers) { const age = (tn - f.t0) / 1000, dt = 1 / 60; f.y += f.vy * dt * (f.kind === 3 ? .4 : 1); f.x += Math.sin(age * 2 + f.ph) * 1.2 * dpr; f.rot = Math.sin(age * 1.6 + f.ph) * .8;
        let a = 1; if (f.kind === 2) a = Math.max(0, 1 - age / 3);
        fx.save(); fx.translate(f.x, f.y); fx.rotate(f.rot); fx.globalAlpha = a;
        const burn = f.kind === 1 ? Math.min(1, age / 2.5) : 0;
        fx.fillStyle = burn > 0 ? `rgb(${20 + burn * 180 | 0},${12 + burn * 60 | 0},8)` : (f.kind === 2 ? "rgba(235,225,205,1)" : "rgba(14,10,10,1)");
        fx.beginPath(); fx.moveTo(0, -f.s); fx.quadraticCurveTo(f.s * .45, -f.s * .2, 0, f.s); fx.quadraticCurveTo(-f.s * .35, -f.s * .2, 0, -f.s); fx.fill();
        fx.strokeStyle = "rgba(60,50,45,.8)"; fx.lineWidth = dpr * .8; fx.beginPath(); fx.moveTo(0, -f.s); fx.lineTo(0, f.s * 1.3); fx.stroke();
        fx.restore();
        if (burn > .3) { fx.globalCompositeOperation = "lighter"; for (let k = 0; k < 2; k++) { fx.fillStyle = `rgba(255,${120 + Math.random() * 80 | 0},40,${.6 * (1 - burn * .5)})`; fx.fillRect(f.x + rand(-6, 6) * dpr, f.y + rand(-12, 4) * dpr, 2 * dpr, 2 * dpr); } fx.globalCompositeOperation = "source-over"; if (burn >= 1) f.y = H + 100; }
      }
      fx.globalAlpha = 1;
      // “ばたり”：全黑
      if (black) { fx.fillStyle = `rgba(0,0,0,${now < bt + 1.8 ? 1 : 1 - (now - bt - 1.8) / .6})`; fx.fillRect(0, 0, W, H); }
    }
    return { init, draw, wet: false };
  };

  // ═════════ Send My Love Across the Night：3D 宇宙航行 ═════════
  // 全屏 WebGL 着色器：在星海里飞行（星星从中心迎面扑来、速度快时拉成光线）、穿过星云；
  // 副歌时前方出现一个球形虫洞（里面是另一片星系、边缘有引力透镜的光环），“send my love across the night”冲进去 → 虫洞隧道；
  // 出来是一个巨大的黑洞（吸积盘 + 越过顶上的透镜光弧）；“darkness nearly swallows me whole”时被拉近；
  // “Yet a spark keeps me alive”一道闪光；随后超光速跨越星空；最后来到一颗行星上空，地平线升起晨光
  SCENES.cosmos = (song) => {
    const ev = song.events || {};
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    let gl = null, prog = null, cv = null, U = {}, ok = false, lastNow = 0, flash = 0, beatE = 0;
    // 速度曲线 → 积分成“飞了多远”，拖动进度条也能对上
    const speedAt = t => {
      let v = .05;
      if (t > 4) v = .08; if (t > 24) v = .16; if (t > 46) v = .22; if (t > 67) v = .18; if (t > 85.8) v = .3;
      if (t > 91.2) v = .55; if (t > 108.5) v = .05; if (t > 143.2) v = .25; if (t > 148.2) v = .7; if (t > 166) v = .2; if (t > 176) v = .06; if (t > 200) v = .03;
      for (const t0 of [24.4, 91.2, 101.6, 148.2]) if (t >= t0) v += .5 * Math.exp(-(t - t0) / .8);
      return v;
    };
    // 沿途经过的星球：tc = 擦身而过的时刻，(x,y) = 经过时在屏幕上的方向，s = 大小，type = 0 岩石 1 气态 2 带环 3 冰
    const BODIES = [
      { tc: 26, x: -.95, y: -.35, s: .9, type: 2, c: [.78, .66, .48] },
      { tc: 44, x: .85, y: .25, s: .35, type: 0, c: [.62, .34, .24] },
      { tc: 60, x: -.7, y: .3, s: .3, type: 3, c: [.55, .72, .9] },
      { tc: 63, x: -.52, y: .42, s: .07, type: 0, c: [.6, .6, .62] },
      { tc: 82, x: .9, y: -.3, s: .7, type: 1, c: [.75, .55, .38] },
      { tc: 152, x: -.8, y: .2, s: .4, type: 1, c: [.45, .55, .8] },
      { tc: 157, x: .75, y: -.25, s: .25, type: 0, c: [.5, .42, .36] },
      { tc: 162, x: .5, y: .4, s: .5, type: 2, c: [.7, .62, .55] },
      // 擦身而过的巨石
      { tc: 30.5, x: .7, y: -.55, s: .22, type: 4, c: [.2, .18, .16], sd: 3 },
      { tc: 35.2, x: -.6, y: .45, s: .14, type: 4, c: [.28, .23, .19], sd: 11 },
      { tc: 40.8, x: -.25, y: -.7, s: .3, type: 4, c: [.22, .21, .21], sd: 23 },
      { tc: 151, x: .55, y: .5, s: .18, type: 4, c: [.24, .21, .18], sd: 31 },
      { tc: 159.5, x: -.5, y: -.45, s: .24, type: 4, c: [.2, .19, .18], sd: 47 },
    ];
    const DT = .05, NT = Math.ceil(250 / DT), Z = new Float32Array(NT + 2);
    { let z = 0, vv = .05; for (let i = 0; i <= NT + 1; i++) { vv += (speedAt(i * DT) - vv) * .05; Z[i] = z; z += vv * DT; } }
    const zAt = t => { const f = Math.max(0, Math.min(NT, t / DT)), i = f | 0; return Z[i] + (Z[i + 1] - Z[i]) * (f - i); };

    const FS = `precision highp float;
uniform vec2 R; uniform float T,Zp,warp,worm,tun,bh,bhs,pl,dawn,fl,beat,fade,neb,roll,ast; uniform vec4 P[3]; uniform vec4 Q[3];
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n));}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
vec3 stars(vec2 uv,float z,float st,float seed){
  vec3 c=vec3(0);
  for(int i=0;i<7;i++){
    float fi=float(i);
    float dp=fract(fi/7.+z);
    float sc=mix(22.,.9,dp*dp);
    float fd=smoothstep(0.,.25,dp)*smoothstep(1.,.8,dp);
    vec2 p=uv*sc+fi*37.1+seed;
    vec2 id=floor(p),f=fract(p)-.5;
    vec2 o=h22(id)-.5;
    vec2 dv=f-o*.75;
    vec2 dr=normalize(uv+1e-4);
    float al=dot(dv,dr),pe=dot(dv,vec2(-dr.y,dr.x));
    al/=1.+st*dp*14.*length(uv);
    float d=length(vec2(al,pe));
    float b=h21(id+3.1);
    float on=step(.62,b);
    float s=(smoothstep(.05,0.,d)*.8+.0025/(d*d+.0025)*.25)*on*(.3+b);
    vec3 col=mix(vec3(.7,.82,1.),vec3(1.,.86,.7),h21(id+9.));
    c+=col*s*fd*(.6+.4*sin(T*3.+b*40.));
  }
  return c;
}
vec3 nebula(vec2 uv,float z){
  vec2 q=uv*1.2+vec2(z*.03,z*.05);
  float n=fbm(q+fbm(q*1.7+T*.01));
  float m=fbm(q*2.2-3.);
  vec3 c=mix(vec3(.18,.08,.32),vec3(.05,.16,.38),m);
  c=mix(c,vec3(.55,.25,.35),smoothstep(.55,.8,fbm(q*.8+9.)));
  return c*pow(n,2.6)*1.6;
}
vec3 galaxy(vec2 p){ // 虫洞里看到的另一片星系
  float r=length(p),a=atan(p.y,p.x);
  float arm=.5+.5*sin(a*2.-log(r+.05)*5.+T*.05);
  vec3 c=vec3(1.,.82,.6)*exp(-r*5.)*1.6+vec3(.5,.6,1.)*arm*exp(-r*2.2)*fbm(p*6.)*1.2;
  return c;
}
float crat(vec2 p){
  vec2 id=floor(p),f=fract(p); float h=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 g=vec2(i,j); vec2 c=g+h22(id+g)*.8+.1; float cr=.18+.3*h21(id+g+3.1);
    if(h21(id+g+9.7)>.55) continue;
    float d=length(f-c)/cr;
    h+=-.55*smoothstep(1.,.15,d)+.25*smoothstep(.7,1.,d)*smoothstep(1.35,1.,d);
  }
  return h;
}
float rh(vec2 p,float sd){ return fbm(p*2.2+sd)*.9+crat(p*1.4+sd)*.35+crat(p*3.3+sd*1.7)*.15; }
vec4 rock(vec2 uv,float z){
  vec3 c=vec3(0); float cov=0.;
  vec3 Ls=normalize(vec3(.65,.35,.55));
  for(int i=0;i<4;i++){
    float fi=float(i);
    float dp=fract(fi/4.+z*1.3);
    float sc=mix(9.,1.1,dp*dp);
    vec2 p=uv*sc+fi*71.3;
    vec2 id=floor(p),f=fract(p)-.5;
    float hb=h21(id+7.7);
    if(hb>.2*ast) continue;
    float hs=h21(id+1.3);
    float rr=mix(.025,.27,pow(hs,2.6));              // 大部分是小碎石，偶尔一块巨石
    vec2 o=(h22(id)-.5)*max(0.,.96-2.*rr*1.75);
    vec2 dv=f-o;
    if(length(dv)>rr*1.9) continue;
    float sd=hb*413.+hs*97.;
    float spin=(h21(id+5.)-.5)*.9*T+sd;
    float cs=cos(spin),sn=sin(spin);
    float el=1.+1.6*h21(id+2.2)*h21(id+8.8);          // 拉长程度不同
    vec2 q=mat2(cs,-sn,sn,cs)*dv; q.x/=el; q*= (1.+.25*h21(id+6.));
    vec2 dir=normalize(q+1e-5);
    float lump=(vn(dir*1.6+sd)-.5)*.75+(vn(dir*4.1+sd*1.3)-.5)*.35+(vn(dir*10.+sd)-.5)*.12;
    float rad=rr*(1.+lump)/el*1.1;
    float l=length(q)/rad;
    float aa=2.5/(R.y*sc*rad);
    float m=smoothstep(1.,1.-aa,l);
    if(m<=0.) continue;
    vec2 lp=q/rr*1.15;
    float e=.04;
    float h0=rh(lp,sd), hx=rh(lp+vec2(e,0),sd), hy=rh(lp+vec2(0,e),sd);
    vec2 g=vec2(hx-h0,hy-h0)/e;
    vec2 dvr=mat2(cs,sn,-sn,cs)*(q/rad);               // 法线转回屏幕方向
    vec2 gr=mat2(cs,sn,-sn,cs)*g;
    float zz=sqrt(max(0.,1.-min(l*l,1.)));
    vec3 n=normalize(vec3(dvr*1.25-gr*.16,zz*.85+.04));
    float df=max(dot(n,Ls),0.);
    float kind=h21(id+11.);
    vec3 alb=kind<.5?vec3(.16,.15,.14):kind<.85?vec3(.27,.22,.18):vec3(.3,.29,.3);
    alb*=.8+.4*fbm(lp*2.5+sd);
    alb*=1.+.35*smoothstep(-.1,.3,h0-.45);
    vec3 rc=alb*(df*2.3)+alb*vec3(.25,.32,.5)*.07*max(-n.x,0.);
    rc+=vec3(1.,.9,.75)*pow(max(dot(reflect(-Ls,n),vec3(0,0,1)),0.),12.)*.05*(kind>.85?3.:1.);
    float ao=smoothstep(-.5,.2,h0-.5);
    rc*=.6+.4*ao;
    float fd=smoothstep(0.,.3,dp)*smoothstep(1.,.85,dp);
    c=mix(c,rc,m*fd); cov=max(cov,m*fd);
  }
  return vec4(c,cov);
}
vec4 bigrock(vec2 d,vec3 base,float sd,float pr){
  float spin=T*.12+sd, cs=cos(spin), sn=sin(spin);
  vec2 q=mat2(cs,-sn,sn,cs)*d; q.x/=1.45;
  vec2 dir=normalize(q+1e-5);
  float lump=(vn(dir*1.5+sd)-.5)*.7+(vn(dir*3.8+sd)-.5)*.4+(vn(dir*9.+sd)-.5)*.16+(vn(dir*22.+sd)-.5)*.05;
  float rad=(1.+lump)*.78;
  float l=length(q)/rad;
  float aa=2./(R.y*pr*rad);
  float m=smoothstep(1.,1.-aa,l);
  if(m<=0.) return vec4(0);
  vec2 lp=q*2.6; float e=.025;
  float h0=rh(lp,sd), hx=rh(lp+vec2(e,0),sd), hy=rh(lp+vec2(0,e),sd);
  vec2 g=mat2(cs,sn,-sn,cs)*(vec2(hx-h0,hy-h0)/e);
  vec2 dvr=mat2(cs,sn,-sn,cs)*(q/rad); dvr.x*=1.;
  float zz=sqrt(max(0.,1.-min(l*l,1.)));
  vec3 n=normalize(vec3(dvr*1.2-g*.12,zz*.85+.04));
  float df=max(dot(n,normalize(vec3(.65,.35,.55))),0.);
  vec3 alb=base*(.8+.4*fbm(lp*3.+sd))*(1.+.3*smoothstep(-.1,.3,h0-.45));
  vec3 rc=alb*df*2.2+alb*vec3(.25,.32,.5)*.06*max(-n.x,0.);
  rc*=.6+.4*smoothstep(-.5,.2,h0-.5);
  return vec4(rc,m);
}
vec4 planet(vec2 uv,vec4 p,vec4 q){
  vec2 d=(uv-p.xy)/p.z;
  if(q.w>3.5) return bigrock(d,q.rgb,p.w,p.z);
  float r=length(d), aa=1.5/(R.y*p.z);
  float type=q.w;
  vec3 base=q.rgb;
  vec4 res=vec4(0);
  vec3 L=normalize(vec3(.65,.35,.55));
  float ringF=0.; vec3 ringC=vec3(0);
  if(type>1.5&&type<2.5){
    float ct=cos(.35),st=sin(.35); vec2 rd=mat2(ct,-st,st,ct)*d; vec2 e=vec2(rd.x,rd.y/.26); float rr=length(e);
    float band=smoothstep(1.35,1.42,rr)*smoothstep(2.3,2.15,rr)*(.6+.4*sin(rr*38.))*(1.-.75*smoothstep(1.76,1.79,rr)*smoothstep(1.88,1.85,rr));
    ringC=mix(vec3(.85,.75,.6),base,.3)*(.45+.55*clamp(-rd.x*.3+.7,0.,1.));
    if(rd.y>0.){ res=vec4(ringC,band*.9); } else { ringF=band*.9; }
  }
  if(r<1.+aa){
    float z=sqrt(max(0.,1.-r*r));
    vec3 n=vec3(d,z);
    float df=max(dot(n,L),0.);
    float sd=q.x*13.+q.y*7.;
    vec3 sc;
    if(type<.5){ float t=fbm(d*2.2+sd); sc=base*(.65+.55*t)*(1.+.35*crat(d*3.+sd)+.15*crat(d*7.+sd)); }
    else if(type<1.5){ float bnd=sin(d.y*14.+fbm(d*vec2(2.,6.)+sd)*4.); sc=mix(base,base*vec3(1.3,1.1,.9),.5+.5*bnd); }
    else if(type<2.5){ float bnd=sin(d.y*9.+fbm(d*vec2(1.5,5.)+sd)*2.5); sc=mix(base,base*1.25,.5+.5*bnd); }
    else { float t=fbm(d*4.+sd); sc=mix(base,vec3(.92,.96,1.),t*t); }
    vec3 pc=sc*(.03+1.05*df);
    pc+=mix(base,vec3(.6,.75,1.),.5)*pow(1.-z,3.)*(.25+.9*df)*.8;
    float m=smoothstep(1.+aa,1.-aa,r);
    res=vec4(mix(res.rgb,pc,m),max(res.a,m));
  }
  if(ringF>0.){ res=vec4(mix(res.rgb,ringC,ringF),max(res.a,ringF)); }
  float glow=exp(-max(r-1.,0.)*6.)*step(1.,r)*.12;
  res.rgb+=mix(base,vec3(.6,.75,1.),.5)*glow*(1.-res.a);
  res.a=max(res.a,glow*.0);
  return res;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  float cr=cos(roll),sr=sin(roll); uv=mat2(cr,-sr,sr,cr)*uv;
  float L=length(uv);
  vec3 col=vec3(0);
  // —— 背景：引力透镜（虫洞/黑洞周围的星光被推开） ——
  vec2 su=uv;
  float wr=worm*.75;
  if(wr>0.){ su=uv*(1.+wr*wr*.9/(L*L+.002)); }
  float rs=bhs*bh;
  if(rs>0.){ su=uv+normalize(uv+1e-4)*rs*rs*1.6/max(L,rs*.9); }
  vec3 bg=stars(su,Zp,warp,0.)+nebula(su,Zp)*neb;
  col=bg;
  if(ast>0.){ vec4 rk=rock(uv,Zp); col=mix(col,rk.rgb,rk.a); }
  for(int i=0;i<3;i++){ if(P[i].z>0.){ vec4 pp=planet(uv,P[i],Q[i]); col=mix(col,pp.rgb,pp.a); } }
  // —— 虫洞 ——
  if(wr>0.){
    float inside=smoothstep(wr,wr*.97,L);
    vec2 ip=uv/max(wr,.001);
    vec2 lens=ip*(1.-.35*dot(ip,ip));
    vec3 other=galaxy(lens*.9)+stars(lens*1.6,Zp*.3,0.,51.)*1.3;
    col=mix(col,other,inside);
    col+=vec3(.6,.75,1.)*exp(-pow((L-wr)/(.006+wr*.012),2.))*.45+vec3(.5,.6,1.)*exp(-pow((L-wr)/(.03+wr*.05),2.))*.18;
    col+=vec3(.5,.6,1.)*exp(-max(L-wr,0.)*8./max(wr,.05))*.15*(1.-inside);
  }
  // —— 虫洞隧道 ——
  if(tun>0.){
    float a=atan(uv.y,uv.x)/6.2832;
    float d=.32/max(L,.02);
    float t1=fbm(vec2(a*6.,d*.6+Zp*2.2));
    float t2=pow(fbm(vec2(a*40.,d*.15+Zp*4.)),3.)*3.;
    vec3 tc=mix(vec3(.12,.18,.45),vec3(.85,.9,1.),t1*t1)*t1*1.3+vec3(1.,.8,.6)*t2;
    tc*=smoothstep(.0,.25,L)*(.6+.4*smoothstep(1.4,.3,L))*(.55+.45*sin(d*9.+Zp*26.+a*6.2832));
    tc+=vec3(1.,.95,.85)*exp(-L*7.)*1.4;
    col=mix(col,tc,tun);
  }
  // —— 黑洞 ——
  if(rs>0.){
    float sh=smoothstep(rs*1.01,rs*.97,L);
    vec2 q=vec2(uv.x,(uv.y+rs*.04)/.11);
    float rq=length(q);
    float ang=atan(q.y,q.x);
    float disk=smoothstep(rs*1.3,rs*1.55,rq)*smoothstep(rs*3.3,rs*1.8,rq)*(1.4-rq/(rs*3.3));
    float tex=.45+.75*fbm(vec2(ang*2.-T*.5*rs/max(rq,.01)*3.,rq*14./rs*.2));
    float dop=1.+.55*(-uv.x/max(rq,.01));
    vec3 dc=vec3(1.,.72,.42)*tex*dop*1.4;
    float near=disk*step(q.y,0.);
    float far=disk*step(0.,q.y)*(1.-sh);
    float arcT=smoothstep(rs*1.1,rs*1.22,L)*smoothstep(rs*2.1,rs*1.45,L)*smoothstep(-.1*rs,.5*rs,uv.y);
    float arcB=smoothstep(rs*1.04,rs*1.1,L)*smoothstep(rs*1.35,rs*1.15,L)*smoothstep(.1*rs,-.4*rs,uv.y);
    float tA=.5+.8*fbm(vec2(atan(uv.y,uv.x)*3.-T*.4,L*10./rs));
    col*=1.-sh;
    col+=vec3(1.,.78,.5)*(arcT*1.1+arcB*.6)*tA*bh*(1.+.6*(-uv.x/max(L,.01)));
    col+=dc*far*bh;
    col=mix(col,col*(1.-near)+dc*near,bh);
    col+=vec3(1.,.85,.6)*exp(-pow((L-rs*1.06)/(rs*.035),2.))*.8*bh;
    col+=vec3(1.,.7,.4)*exp(-L/(rs*3.))*.12*bh*(1.-sh);
  }
  // —— 行星与晨光 ——
  if(pl>0.){
    float Rp=1.6; vec2 pc=vec2(.05,-Rp-.12-(1.-pl)*1.2);
    float pd=length(uv-pc);
    float body=smoothstep(Rp+.004,Rp-.004,pd);
    vec2 sp=(uv-pc)/Rp;
    float land=fbm(sp*vec2(5.,9.)+vec2(T*.004,0.));
    vec3 surf=mix(vec3(.02,.05,.12),vec3(.06,.08,.1),smoothstep(.45,.6,land));
    float sa=asin(clamp((.5*R.x/R.y*.6-.05)/Rp,-.6,.6)); vec2 sun=pc+vec2(sin(sa),cos(sa))*(Rp+.004);
    float lit=smoothstep(.9,0.,length(uv-sun))*dawn;
    surf+=vec3(.9,.55,.35)*lit*.35*(.5+land);
    col=mix(col,surf,body);
    float atm=exp(-abs(pd-Rp)/.018)*(.35+.65*smoothstep(1.4,0.,length(uv-sun)));
    col+=mix(vec3(.25,.45,1.),vec3(1.,.65,.4),dawn*smoothstep(1.,0.,length(uv-sun)))*atm*(.6+dawn);
    float sd=length(uv-sun);
    col+=vec3(1.,.85,.65)*(exp(-sd*9.)*1.6+exp(-sd*2.5)*.35)*dawn;
    col+=vec3(1.,.8,.6)*exp(-abs(uv.y-sun.y)*120.)*exp(-abs(uv.x-sun.x)*1.2)*.6*dawn;
  }
  col+=vec3(1.,.95,.9)*fl;
  col*=1.+beat*.12;
  col=1.-exp(-col*1.25);
  col*=1.-.35*dot(uv*.7,uv*.7);
  gl_FragColor=vec4(col*fade,1.);
}`;
    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      gl = cv.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["R", "T", "Zp", "warp", "worm", "tun", "bh", "bhs", "pl", "dawn", "fl", "beat", "fade", "neb", "roll", "ast", "P", "Q"]) U[k] = gl.getUniformLocation(prog, k);
      return (ok = true);
    }
    function init() {}
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      // 画布分辨率：按屏幕的 0.6 倍渲染再放大（宇宙本来就柔和，换来流畅）
      const sc = Math.min(window.devicePixelRatio || 1, 1.5) * .6, w = Math.round(innerWidth * sc), h = Math.round(innerHeight * sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const b = window.__bass || 0; beatE += (b - beatE) * .1; const beat = Math.max(0, b - beatE) * 2;
      if (playing) for (const [t0, a] of [[24.4, .35], [91.2, .9], [101.6, .5], [108.5, 1], [138.3, .9], [148.2, .4], [185.1, .4]]) if (t0 > prev && t0 <= now && now - t0 < .5) flash = Math.max(flash, a);
      flash *= .93;
      const v = (zAt(now + .1) - zAt(now)) / .1;
      const worm = sm(84.5, 91.4, now) * (1 - sm(91.2, 91.9, now)) * (.15 + 1.9 * Math.pow(sm(84.5, 91.4, now), 2.2));
      const tun = sm(90.9, 91.6, now) * (1 - sm(107.8, 108.8, now));
      const bh = sm(108.4, 111, now) * (1 - sm(144, 150, now));
      const bhs = .1 + .12 * sm(110, 130, now) + .16 * sm(133, 137.5, now) - .1 * sm(140, 146, now);
      const pl = sm(165, 176, now), dawn = sm(180, 194, now);
      const neb = .55 + .45 * (1 - tun) - .4 * bh;
      const fade = (now === 0 ? .7 : Math.min(1, .3 + now / 3)) * (1 - sm(232, 239.8, now));
      gl.uniform2f(U.R, w, h); gl.uniform1f(U.T, now); gl.uniform1f(U.Zp, zAt(now));
      gl.uniform1f(U.warp, Math.min(1.5, Math.max(0, (v - .12) * 2.2)));
      gl.uniform1f(U.worm, worm); gl.uniform1f(U.tun, tun); gl.uniform1f(U.bh, bh); gl.uniform1f(U.bhs, bhs);
      gl.uniform1f(U.pl, pl); gl.uniform1f(U.dawn, dawn); gl.uniform1f(U.fl, flash); gl.uniform1f(U.beat, playing ? beat : 0);
      gl.uniform1f(U.fade, fade); gl.uniform1f(U.neb, neb); gl.uniform1f(U.roll, Math.sin(now * .03) * .08 + tun * now * .15);
      const zn = zAt(now), vis = [];
      for (const bd of BODIES) {
        const depth = (zAt(bd.tc) - zn) * 6 + .32;
        if (depth < .06 || depth > 14) continue;
        const k = 1 / depth, r = bd.s * .55 * k, x = bd.x * .55 * k, y = bd.y * .55 * k;
        if (Math.abs(x) - r > 1.6 || Math.abs(y) - r > 1.2) continue;
        const fi = Math.min(1, (14 - depth) / 4);
        vis.push({ depth, v: [x, y, r, bd.sd || 0], q: [bd.c[0] * fi, bd.c[1] * fi, bd.c[2] * fi, bd.type] });
      }
      vis.sort((a, b) => b.depth - a.depth);
      const near = vis.slice(-3), Pv = new Float32Array(12), Qv = new Float32Array(12);
      near.forEach((o, i) => { Pv.set(o.v, i * 4); Qv.set(o.q, i * 4); });
      gl.uniform4fv(U.P, Pv); gl.uniform4fv(U.Q, Qv);
      gl.uniform1f(U.ast, Math.max(sm(26, 30, now) * (1 - sm(44, 48, now)), sm(148, 151, now) * (1 - sm(163, 167, now))) * (1 - tun));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { init, draw, wet: false };
  };

  // ═════════ 15 近づく：想靠近，又不敢靠近 ═════════
  // 黑白 VHS 画面里那个戴笑脸面具的人。前奏只有呼吸——镜头吸气时靠近、呼气时退开；
  // 螺旋楼梯那段画面开始旋转；猫狗吵闹那段镜头乱切、画面撕裂；「もういい…全部」彻底崩坏，黑羽毛炸开；
  // 静默之后回到呼吸，心跳敲着画面；「そして落ちていく」开始坠落，最后像老电视一样关机、消失。
  SCENES.approach = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const BEAT = .3455, B0 = 34.06;                  // 鼓点：约 174 BPM
    // 镜头取景：[焦点x, 焦点y, 放大倍数]（坐标是封面图里的位置）
    const SHOTS = [[.5, .5, 1], [.47, .2, 2.6], [.42, .1, 2.2], [.49, .36, 2.4], [.7, .42, 1.7], [.47, .2, 4.2], [.45, .78, 2], [.6, .3, 1.35]];
    let gl, prog, cv, U = {}, ok = false, tex = null, imgReady = false, IW = 1536, IH = 1024;
    let fc, fx2, feathers = [], sprites = [], lastNow = 0, beatE = 0, kick = 0, hit = 0;

    const FS = `precision highp float;
uniform sampler2D tex; uniform vec2 R,IM; uniform vec3 S0,S1;
uniform float T,mixS,twirl,split,tear,blocks,ghost,inv,light,lightR,dark,fall,fallV,crt,fade,beat,pulse,grain,strobe,seed;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 toImg(vec2 p,vec3 s){ // p: 屏幕坐标（以中心为原点、按高归一）
  float ar=IM.x/IM.y, sar=R.x/R.y;
  float k=max(sar/ar,1.);              // cover 铺满
  vec2 q=p/(s.z*k); q.x/=ar;
  return vec2(s.x,1.-s.y)+q;
}
float lum(vec2 u){ if(u.x<0.||u.x>1.||u.y<0.||u.y>1.) return 0.; return dot(texture2D(tex,u).rgb,vec3(.299,.587,.114)); }
vec3 samp(vec2 p,vec3 s,float sp){
  vec2 o=vec2(sp,0.);                  // 色差按屏幕距离算，放大镜头时不会糊成彩虹
  return vec3(lum(toImg(p+o,s)),lum(toImg(p,s)),lum(toImg(p-o,s)));
}
void main(){
  vec2 fc=gl_FragCoord.xy;
  vec2 p=(fc-.5*R)/R.y;
  // 老电视关机：先压成一条线，再缩成一个点
  float cy=1.-smoothstep(0.,.55,crt)*.995, cx=1.-smoothstep(.5,1.,crt)*.995;
  if(crt>0.){ if(abs(p.y)>.5*cy+.0015||abs(p.x)>.5*R.x/R.y*cx+.0015){ gl_FragColor=vec4(0,0,0,1); return; } p.y/=cy; p.x/=cx; }
  // 坠落：画面往上滑走
  p.y-=fall;
  // 撕裂：横向条带错位（跟着鼓点）
  float row=floor(fc.y/R.y*48.), tq=floor(T*14.+seed);
  float tr=h21(vec2(row,tq)); float tb=step(1.-tear*.55,tr)*(h21(vec2(row+7.,tq))-.5)*tear*.5;
  float fine=(h21(vec2(floor(fc.y*.5),tq))-.5)*.004*(.3+tear);
  p.x+=tb+fine;
  // 跟踪噪带：一条横带慢慢往上滚
  float band=fract(T*.07+seed*.1); float bd=exp(-pow((fc.y/R.y-band)*14.,2.));
  p.x+=(h21(vec2(floor(fc.y),T))-.5)*.02*bd;
  // 方块错位
  vec2 bid=floor(fc/R.y*vec2(9.,9.)); float bh=h21(bid+tq*1.7);
  if(bh<blocks*.35){ p+=(vec2(h21(bid+3.1+tq),h21(bid+5.7+tq))-.5)*.35; }
  // 螺旋：绕着画面中心旋转，越靠近中心转得越多
  float r=length(p); float a=twirl*exp(-r*1.6)*6.2832;
  p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;
  float sp=split*.012+beat*.004;
  vec3 c=samp(p,S0,sp);
  if(mixS>0.){ c=mix(c,samp(p,S1,sp),mixS); }
  // 残影：另一个自己在旁边，靠近又退开
  if(ghost>0.){ vec3 g=samp(p+vec2(.06*sin(T*1.7)+.03,.0)*ghost,S0,sp*2.); c=max(c,g*.55*ghost); }
  // 呼吸的光：一束光打在人身上，吸气时亮
  vec2 lc=vec2(0.,.06);
  float sp2=exp(-dot(p-lc,p-lc)/(lightR*lightR));
  c*=mix(dark,1.,clamp(light*(.35+.65*sp2),0.,1.4));
  c*=1.+pulse*.55*exp(-r*1.8);
  // 坠落时的竖向速度线
  if(fallV>0.){ float col=floor(fc.x/3.); float hv=h21(vec2(col,1.)); float yy=fract(fc.y/R.y*.6+T*fallV*(.5+hv)+hv*9.);
    c+=vec3(step(.985,hv)*smoothstep(.0,.3,yy)*smoothstep(.6,.3,yy))*fallV*.9; }
  c=mix(c,1.-c,inv);
  if(crt>0.) c=mix(c,vec3(1.),smoothstep(.25,.7,crt)*.85);
  c+=strobe;
  // VHS：扫描线、颗粒、色噪
  c*=.86+.14*sin(fc.y*3.14159*.9);
  float n=h21(fc+fract(T*61.7)*vec2(97.,13.));
  c+=(n-.5)*grain;
  c+=bd*(n-.4)*.35;
  c*=1.-.45*dot(p*.9,p*.9);
  gl_FragColor=vec4(clamp(c,0.,1.)*fade,1.);
}`;

    // 黑羽毛：先在离屏画布里画好几种形状，再当贴图用
    function makeFeather(seed) {
      const W = 120, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d"); const R = (k) => hash(seed * 13.1 + k);
      const bend = (R(1) - .5) * 26, len = H * (.82 + R(2) * .14), w0 = W * (.28 + R(3) * .12);
      const qx = (t) => W / 2 + bend * Math.sin(t * Math.PI * .9);
      g.translate(0, H * .06);
      // 羽片：一根根羽枝
      for (let i = 0; i < 150; i++) {
        const t = .08 + .9 * (i / 150), side = i % 2 ? 1 : -1;
        const wl = w0 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** .7 * (1 - .15 * R(10 + i));
        if (R(200 + i) < .05) continue;            // 偶尔断开的缝隙
        const x0 = qx(t), y0 = t * len, ang = (side > 0 ? -.55 : -Math.PI + .55) - .1 * side;
        const x1 = x0 + Math.cos(ang) * wl, y1 = y0 + Math.sin(ang) * wl * .55 - 2;
        const gv = 22 + R(400 + i) * 26 + (side > 0 ? 34 : 0) | 0;   // 迎光的一侧亮一点，羽毛才看得出来
        g.strokeStyle = `rgba(${gv},${gv},${gv + 4},.95)`;
        g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 - 3, x1, y1); g.stroke();
      }
      // 羽轴的一点高光
      g.strokeStyle = "rgba(120,120,125,.55)"; g.lineWidth = 1.4; g.beginPath();
      for (let k = 0; k <= 30; k++) { const t = k / 30; g.lineTo(qx(t), t * len); } g.stroke();
      g.strokeStyle = "rgba(10,10,12,.9)"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(qx(.92), .92 * len); g.lineTo(qx(1) + 1, len + 12); g.stroke();
      return c;
    }
    function spawn(mode, n, W, H) {
      for (let i = 0; i < n; i++) {
        const s = (.35 + Math.random() * .75) * Math.min(W, H) / 900;
        let f = { spr: sprites[(Math.random() * sprites.length) | 0], s, rot: Math.random() * 6.28, vr: (Math.random() - .5) * 2, ph: Math.random() * 6.28, life: 0 };
        if (mode === "burst") { const a = Math.random() * 6.28, v = (300 + Math.random() * 900) * Math.min(W, H) / 900; Object.assign(f, { x: W * .5 + (Math.random() - .5) * 40, y: H * .38, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, vr: (Math.random() - .5) * 9, drag: 1.6 }); }
        else if (mode === "rise") Object.assign(f, { x: Math.random() * W, y: H + 80 + Math.random() * H * .3, vx: (Math.random() - .5) * 40, vy: -(500 + Math.random() * 700) * H / 900, drag: 0 });
        else Object.assign(f, { x: Math.random() * W, y: -60 - Math.random() * H * .4, vx: (Math.random() - .5) * 30, vy: (40 + Math.random() * 50) * H / 900, drag: 0, sway: 1 });
        feathers.push(f);
      }
    }
    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      fc = document.createElement("canvas");
      fc.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none";
      document.body.insertBefore(fc, cv.nextSibling); fx2 = fc.getContext("2d");
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      for (let i = 0; i < 6; i++) sprites.push(makeFeather(i + 1));
      gl = cv.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["tex", "R", "IM", "S0", "S1", "T", "mixS", "twirl", "split", "tear", "blocks", "ghost", "inv", "light", "lightR", "dark", "fall", "fallV", "crt", "fade", "beat", "pulse", "grain", "strobe", "seed"]) U[k] = gl.getUniformLocation(prog, k);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const im = new Image(); im.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); IW = im.width; IH = im.height; imgReady = true; };
      im.src = `/music/media/${song.id}/bg.jpg?r=${song.rev || 0}`;
      return (ok = true);
    }
    // 某一时刻的取景：前奏和尾声是整幅画面，中段按小节（或每一拍）切镜头
    function shotAt(t) {
      let per = 0;
      if (t > 53.4 && t < 83.6) per = BEAT * 4;
      else if (t >= 83.6 && t < 94.2) per = BEAT * 2;
      else if (t >= 94.2 && t < 119) per = BEAT;
      if (!per) return { a: SHOTS[0], b: SHOTS[0], k: 0 };
      const n = Math.floor((t - B0) / per), a = SHOTS[(hash(n) * SHOTS.length) | 0];
      return { a, b: a, k: 0, n };
    }
    function init() {}
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = (window.__time || 0) + 3,   // 时间线按带 3 秒前奏的版本写的，音频文件少了这 3 秒
            playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const sc = Math.min(window.devicePixelRatio || 1, 1.5) * .75, w = Math.round(innerWidth * sc), h = Math.round(innerHeight * sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const b = window.__bass || 0; beatE += (b - beatE) * .1; const beat = playing ? Math.max(0, b - beatE) * 2 : 0;
      kick = Math.max(kick * .86, beat);

      // —— 时间线 ——
      const intro = 1 - sm(33, 34.5, now), out = sm(121.5, 123.5, now) * (1 - sm(144, 147, now));
      const breathT = now < 60 ? now : now - 122.4;
      const breath = .5 - .5 * Math.cos(breathT / 4.15 * 6.2832);         // 一呼一吸约 4 秒
      const verse = sm(33.6, 35, now) * (1 - sm(52.5, 54, now));
      const chaos = sm(53.2, 54, now) * (1 - sm(119, 119.4, now));
      const peak = sm(83.4, 84.2, now) * (1 - sm(119, 119.4, now));
      const ruin = sm(94, 94.4, now) * (1 - sm(118.8, 119.3, now));
      const hush = sm(119, 119.3, now) * (1 - sm(121.4, 123, now));
      const falling = sm(144, 157, now);
      // 镜头
      const sh = shotAt(now);
      let S = sh.a.slice();
      if (!sh.n && sh.n !== 0) {
        // 前奏：吸气靠近，呼气退开，同时整体一点点逼近
        const push = 1 + .5 * sm(0, 33, now) * intro + verse * .45 + out * (.25 + .2 * sm(122, 144, now));
        S = [.47, .42 - .22 * Math.min(1, (push - 1) / .9), push * (1 + .07 * breath * (intro + out))];
      }
      S[2] *= 1 + kick * .04 * chaos;
      { const ar = IW / IH, sar = w / h, k = Math.max(sar / ar, 1), hy = .5 / (S[2] * k), hx = sar / 2 / (S[2] * k) / ar;
        S[0] = hx >= .5 ? .5 : Math.min(1 - hx, Math.max(hx, S[0])); S[1] = hy >= .5 ? .5 : Math.min(1 - hy, Math.max(hy, S[1])); }
      const twirl = verse * (.04 + .1 * sm(33.6, 52, now)) * Math.sin(now * .35) + ruin * .05 * Math.sin(now * 1.3) + falling * .08;
      const tear = .08 + verse * .25 + chaos * (.25 + kick * 1.4) + peak * .4 + ruin * (.35 + kick * .9) + hush * .1 + falling * .5;
      const blocks = chaos * kick * .5 + peak * .2 + ruin * (.18 + kick * .5);
      const split = .25 + verse * .6 + chaos * (1 - ruin) * (.7 + kick * 1.6) + ruin * (.5 + kick * .9) + falling * 1.2;
      const ghost = verse * .6 * (.5 + .5 * Math.sin(now * .9)) + out * .35 * breath;
      const nb = Math.floor((now - B0) / BEAT);
      const inv = ruin * (hash(nb * 3.3) < .22 ? 1 : 0) + peak * (1 - ruin) * (hash(nb * 5.1) < .1 ? 1 : 0);
      const strobe = (peak * (1 - ruin) * (hash(nb * 7.7) < .3 ? .35 : 0) + ruin * kick * .25) * (playing ? 1 : 0);
      const light = sm(144, 146.5, now) * (1.05 + kick * .3) + (intro + out) * (.35 + .75 * breath) + (verse + chaos) * (1 - hush) * (1 - out) * (.95 + kick * .3);
      const dark = .04 + .1 * chaos;
      const pulse = sm(133.8, 135, now) * (1 - sm(143, 146, now)) * kick * 1.6 + out * kick * .4;
      const fall = Math.pow(falling, 2.2) * 1.15;
      const crt = sm(156.6, 157.7, now);
      const fade = Math.min(1, .25 + Math.max(0, now - 3) / 2.5) * (1 - hush * .82) * (1 - sm(157.7, 158.2, now) * .0);

      gl.uniform1i(U.tex, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(U.R, w, h); gl.uniform2f(U.IM, IW, IH);
      gl.uniform3f(U.S0, S[0], S[1], S[2]); gl.uniform3f(U.S1, 0, 0, 1); gl.uniform1f(U.mixS, 0);
      gl.uniform1f(U.T, now); gl.uniform1f(U.twirl, twirl); gl.uniform1f(U.split, split); gl.uniform1f(U.tear, Math.min(1.6, tear));
      gl.uniform1f(U.blocks, Math.min(1, blocks)); gl.uniform1f(U.ghost, ghost); gl.uniform1f(U.inv, inv); gl.uniform1f(U.strobe, strobe);
      gl.uniform1f(U.light, imgReady ? light : 0); gl.uniform1f(U.lightR, .45 + .25 * breath * (intro + out) + .4 * chaos); gl.uniform1f(U.dark, dark);
      gl.uniform1f(U.fall, fall); gl.uniform1f(U.fallV, 0); gl.uniform1f(U.crt, crt); gl.uniform1f(U.fade, fade);
      gl.uniform1f(U.beat, beat * chaos); gl.uniform1f(U.pulse, pulse); gl.uniform1f(U.grain, .1 + .08 * chaos + .2 * hush); gl.uniform1f(U.seed, Math.floor(now / 2.7));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // —— 黑羽毛 ——
      const W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (fc.width !== Math.round(W * dpr)) { fc.width = Math.round(W * dpr); fc.height = Math.round(H * dpr); }
      if (seek) feathers = [];
      if (playing && !seek) {
        if (prev < 94.2 && now >= 94.2) spawn("burst", 70, W, H);                 // 全部毁灭——羽毛炸开
        if (ruin > 0 && Math.random() < dt * 14) spawn("burst", 1, W, H);
        if (out > 0 && Math.random() < dt * 1.6 * (1 - falling)) spawn("drift", 1, W, H);
        if (falling > .05 && Math.random() < dt * 22 * falling) spawn("rise", 1, W, H);
      }
      fx2.setTransform(dpr, 0, 0, dpr, 0, 0); fx2.clearRect(0, 0, W, H);
      const fallOff = crt > 0 ? 1 - crt : 1;
      for (const f of feathers) {
        f.life += dt;
        if (f.drag) { const k = Math.exp(-f.drag * dt); f.vx *= k; f.vy = f.vy * k + 60 * dt; }
        if (f.sway) { f.vx = Math.sin(now * 1.3 + f.ph) * 38; f.vr = Math.sin(now * 1.1 + f.ph) * .9; }
        f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        fx2.save(); fx2.translate(f.x, f.y); fx2.rotate(f.rot);
        const flip = Math.cos(now * 2.2 + f.ph); fx2.scale(f.s * (.6 + .4 * Math.abs(flip)), f.s);
        fx2.globalAlpha = fallOff * Math.min(1, f.life * 4);
        fx2.drawImage(f.spr, -60, -180); fx2.restore();
      }
      feathers = feathers.filter(f => f.y < H + 300 && f.y > -500 && f.x > -300 && f.x < W + 300 && f.life < 30);
    }
    return { init, draw, wet: false };
  };

  // ═════════ 16 Number Twelve：没有名字的人造人 ═════════
  // 背景：一个孩子独自在废墟里游荡（实拍片段，按歌词剪好，和音乐同步），上面叠一层淡淡的 12 号画面（双重曝光）；
  // 封面框里：12 号的几张画跟着歌词切换，叠着一只 12 小时的钟——每一声 Tick，指针跳一格；
  // 「Again and again」时画面被撕开、又拼回去，指针倒着转；最后一声「twelve」，指针停在 12 上
  SCENES.twelve = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const IMGS = { a12: "a12.jpg", ruins: "ruins.jpg", hand: "hand.jpg", face: "face.jpg", eyes: "eyes.jpg" };
    // 封面框里的画面：[开始时间, 哪张画, 焦点x]
    const SHOTS = [[0, "face", .5], [21.5, "eyes", .5], [33.1, "a12", .3], [41.6, "ruins", .5], [55.3, "hand", .55], [61.9, "face", .5],
      [83.4, "ruins", .5], [96.3, "a12", .3], [106.8, "hand", .55], [124.6, "ruins", .5], [131.1, "face", .5], [143.8, "eyes", .5]];
    // 每一声 Tick 的时间
    const TICK_LINES = [[0, 1.04], [5.08, 6.32], [10.24, 11.56], [15.9, 16.82], [32.3, 33.18], [96.44, 98]];
    const TICKS = []; for (const [a, b] of TICK_LINES) for (let k = 0; k < 3; k++) TICKS.push(a + (b - a) * k / 3 + .05);
    for (const t of [144.1, 147.9, 151.7]) TICKS.push(t);
    const TWELVES = [11.9, 18.9, 26.6, 29.1, 33.2, 33.6, 34.0, 37.0, 37.4, 37.8, 98.0, 98.45, 98.9, 101.8, 102.25, 102.7, 131.5, 155.5];
    const AGAIN = [[65.5, 81], [133.9, 143.3]];      // 倒着转、画面撕裂的段落
    const DOUBLE = { face: .2, eyes: .22, a12: .18, ruins: .14, hand: .2 };
    let wrapEl, bgv, ck, cg, imgs = {}, layers = [], cur = "", lastNow = 0, flash = 0, sparks = [];

    function setup() {
      if (wrapEl) return true;
      wrapEl = document.querySelector(".cover-wrap"); if (!wrapEl) return false;
      const shade = wrapEl.querySelector(".cover-shade");
      for (const k in IMGS) { const im = new Image(); im.src = `/music/media/${song.id}/${IMGS[k]}?r=${song.rev || 0}`; imgs[k] = im; }
      // 两层图片轮流淡入淡出
      for (let i = 0; i < 2; i++) {
        const el = document.createElement("img"); el.alt = "";
        el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.4s ease, transform 14s linear;transform:scale(1.04);pointer-events:none";
        wrapEl.insertBefore(el, shade); layers.push(el);
      }
      ck = document.createElement("canvas");
      ck.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      wrapEl.insertBefore(ck, shade); cg = ck.getContext("2d");
      bgv = document.createElement("video"); bgv.src = `/music/media/${song.id}/${song.montage}?r=${song.rev || 0}`; bgv.muted = true; bgv.playsInline = true; bgv.preload = "auto";
      bgv.setAttribute("playsinline", ""); bgv.setAttribute("muted", "");
      bgv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;opacity:0;transition:opacity 1.5s;filter:brightness(.62) contrast(1.05);pointer-events:none";
      document.body.insertBefore(bgv, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.opacity = .35;
      return true;
    }
    const shotAt = t => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[0]) s = x; return s; };
    // 钟的指针：每一声 Tick 跳一格（30°）；Again 的段落倒着转；最后停在 12
    function handAngle(t) {
      let n = 0; for (const x of TICKS) if (t >= x) n += sm(x, x + .08, t); else break;
      let a = n * 30;
      a -= 1080 * sm(AGAIN[0][0], AGAIN[0][1], t) + 720 * sm(AGAIN[1][0], AGAIN[1][1], t);
      a += 4 * Math.max(0, t - 1);            // 平时也在慢慢走
      if (t > 155.3) { const k = sm(155.3, 155.7, t), tgt = Math.round(a / 360) * 360; a = a + (tgt - a) * k; }
      return a * Math.PI / 180;
    }
    function init() {}
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      // ── 背景视频严格跟音乐同步 ──
      if (bgv.readyState >= 1) {
        if (playing) { if (bgv.paused) bgv.play().catch(() => {}); if (Math.abs(bgv.currentTime - now) > .2) bgv.currentTime = now; bgv.style.opacity = 1; }
        else { if (!bgv.paused) bgv.pause(); if (now > 0 && Math.abs(bgv.currentTime - now) > .1) bgv.currentTime = now; }
      }
      // ── 封面框：换画 ──
      const sh = (playing || now > 0) ? shotAt(now) : null;
      if (sh && sh[1] !== cur) {
        cur = sh[1]; const [a, b] = layers[0].style.opacity === "1" ? [layers[0], layers[1]] : [layers[1], layers[0]];
        b.src = imgs[cur].src; b.style.objectPosition = `${sh[2] * 100}% 50%`;
        b.style.transition = "none"; b.style.transform = "scale(1.12)"; void b.offsetWidth;
        b.style.transition = "opacity 1.4s ease, transform 14s linear"; b.style.opacity = "1"; b.style.transform = "scale(1.02)";
        a.style.opacity = "0";
      }
      // ── 背景：12 号的画淡淡叠在废墟上（双重曝光）──
      if (cur && imgs[cur].complete && imgs[cur].naturalWidth) {
        const im = imgs[cur], s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * (1.06 + .04 * Math.sin(now * .05));
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = (DOUBLE[cur] || .18) * (playing ? 1 : .6);
        ctx.drawImage(im, (W - im.naturalWidth * s) / 2, (H - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); ctx.restore();
      }
      const vg = ctx.createRadialGradient(W / 2, H * .42, Math.min(W, H) * .25, W / 2, H * .42, Math.max(W, H) * .78);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.72)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      // 灰烬里的火星，慢慢往上飘
      if (playing && !seek && Math.random() < dt * 9) sparks.push({ x: Math.random() * W, y: H + 10, vy: -(20 + Math.random() * 45) * dpr, vx: (Math.random() - .5) * 12 * dpr, r: (.6 + Math.random() * 1.4) * dpr, ph: Math.random() * 6, life: 0 });
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const p of sparks) { p.life += dt; p.x += (p.vx + Math.sin(now * 1.3 + p.ph) * 8 * dpr) * dt; p.y += p.vy * dt;
        const a = Math.min(1, p.life) * (.35 + .35 * Math.sin(now * 4 + p.ph)) * Math.max(0, 1 - p.life / 14);
        ctx.fillStyle = `rgba(255,${150 + (p.ph * 15 | 0)},90,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
      ctx.restore(); sparks = sparks.filter(p => p.y > -20 && p.life < 14);

      // ── 封面框里的钟 ──
      const r = wrapEl.getBoundingClientRect(), cw = Math.round(r.width * dpr), chh = Math.round(r.height * dpr);
      if (ck.width !== cw || ck.height !== chh) { ck.width = cw; ck.height = chh; }
      cg.clearRect(0, 0, cw, chh);
      if (!playing && now === 0) return;
      const inAgain = AGAIN.some(([a, b]) => now >= a && now < b);
      // 「Again and again」：画面被撕开，一条条错位，再拼回去
      if (inAgain) {
        const vis = layers.find(l => l.style.opacity === "1");
        const im = vis && imgs[cur];
        if (im && im.complete) {
          const s = Math.max(cw / im.naturalWidth, chh / im.naturalHeight) * 1.02, ox = (cw - im.naturalWidth * s) * sh[2], oy = (chh - im.naturalHeight * s) / 2;
          const beat = (now * 2.9) % 1, n = 6 + (Math.random() * 6 | 0);
          for (let i = 0; i < n; i++) {
            if (Math.random() > .5 + .4 * (1 - beat)) continue;
            const hh = (6 + Math.random() * 40) * dpr, y0 = Math.random() * (chh - hh), dx = (Math.random() - .5) * 70 * dpr * (1 - beat * .7);
            cg.drawImage(im, (0 - ox) / s, (y0 - oy) / s, cw / s, hh / s, dx, y0, cw, hh);
          }
          cg.fillStyle = "rgba(0,0,0,.18)"; for (let y = 0; y < chh; y += 3 * dpr) cg.fillRect(0, y, cw, dpr);
        }
      }
      // 每一声「twelve」：钟面上的 XII 亮一下
      if (playing) for (const t of TWELVES) if (t > prev && t <= now && now - t < .4) flash = Math.max(flash, t > 155 ? 1 : .55);
      flash *= .92;
      const cx = cw / 2, cy = chh * .42, R = Math.min(cw, chh) * .36;
      const show = .55 + .45 * sm(0, 2, now);
      cg.save(); cg.translate(cx, cy);
      cg.strokeStyle = `rgba(240,232,216,${.28 * show})`; cg.lineWidth = 1 * dpr;
      cg.beginPath(); cg.arc(0, 0, R, 0, 6.2832); cg.stroke();
      cg.strokeStyle = `rgba(240,232,216,${.14 * show})`; cg.beginPath(); cg.arc(0, 0, R * .93, 0, 6.2832); cg.stroke();
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * 6.2832, big = i % 5 === 0, l = big ? R * .085 : R * .03;
        cg.strokeStyle = `rgba(240,232,216,${(big ? .45 : .2) * show})`; cg.lineWidth = (big ? 1.4 : .8) * dpr;
        cg.beginPath(); cg.moveTo(Math.sin(a) * R, -Math.cos(a) * R); cg.lineTo(Math.sin(a) * (R - l), -Math.cos(a) * (R - l)); cg.stroke();
      }
      // XII
      cg.font = `${R * .16}px "Cormorant Garamond", "Times New Roman", serif`; cg.textAlign = "center"; cg.textBaseline = "middle";
      cg.shadowColor = `rgba(255,214,150,${flash})`; cg.shadowBlur = 18 * dpr * flash;
      cg.fillStyle = `rgba(255,${238 - flash * 20},${220 - flash * 60},${(.5 + .5 * flash) * show})`; cg.fillText("XII", 0, -R * .78);
      cg.shadowBlur = 0;
      // 指针
      const ang = handAngle(now);
      cg.rotate(ang);
      cg.strokeStyle = `rgba(250,244,232,${.75 * show})`; cg.lineWidth = 1.4 * dpr;
      cg.beginPath(); cg.moveTo(0, R * .14); cg.lineTo(0, -R * .86); cg.stroke();
      cg.rotate(-ang);
      cg.fillStyle = `rgba(250,244,232,${.85 * show})`; cg.beginPath(); cg.arc(0, 0, 2.6 * dpr, 0, 6.2832); cg.fill();
      cg.restore();
      // 最后一声 twelve：一道光
      if (flash > .02) { cg.fillStyle = `rgba(255,236,205,${flash * .18})`; cg.fillRect(0, 0, cw, chh); }
      if (now > 156) { cg.fillStyle = `rgba(0,0,0,${sm(158, 168, now) * .85})`; cg.fillRect(0, 0, cw, chh); }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 堕ちろ（Fallen）：在黑暗里挣扎的人 ═════════
  // 几乎全黑的画面里只有他。四周的黑暗像烟一样往里爬，鼓点一下下把它震回去（感官在抗拒）；
  // 每一句命令（忘れろ、黙れ、疑え……）都有一个巨大的汉字砸在他身后；
  // 「堕ちろ」画面整个往下坠、拖出一串残影；「壊れろ」画面碎成玻璃片；「祈れ」头顶落下一道光
  SCENES.fallen = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const FALL = [20.98, 39.0, 44.76, 78.3, 83.98], BREAK = [23.2, 40.38, 46.04, 79.82, 85.58], PRAY = [24.88, 41.74, 47.5, 81.3, 87.06];
    // 每一个命令词：[时间, 字, 大小]
    const WORDS = [[4.12, "息", .8], [6.34, "目", .8], [8.94, "始", .9], [20.98, "堕", 1.25], [23.2, "壊", 1.15], [24.88, "祈", 1.05],
      [27.44, "信", .85], [29.04, "縋", .85], [33.36, "耐", .85], [34.92, "演", .85], [39.0, "堕", 1.25], [40.38, "壊", 1.15], [41.74, "祈", 1.05],
      [44.76, "堕", 1.25], [46.04, "壊", 1.15], [47.5, "祈", 1.05], [53.28, "忘", .9], [54.92, "捨", .9], [59.06, "黙", .9], [60.74, "塞", .9],
      [64.78, "沈", .9], [66.18, "裂", .95], [70.08, "疑", .85], [70.96, "拒", .85], [71.64, "従", .85], [72.28, "考", .85], [73.24, "跪", .85],
      [74.22, "媚", .85], [78.3, "堕", 1.25], [79.82, "壊", 1.15], [81.3, "祈", 1.05], [83.98, "堕", 1.3], [85.58, "壊", 1.2], [87.06, "祈", 1.1], [87.5, "終", 1.4]];
    const last = (arr, t, win) => { let r = -1e9; for (const x of arr) if (x <= t && t - x < win) r = x; return r; };
    let gl, prog, cv, U = {}, ok = false, tex, imgReady = false, IW = 1536, IH = 1024, tc, tg, lastNow = 0, beatE = 0, kick = 0, shake = 0;

    const FS = `precision highp float;
uniform sampler2D tex; uniform vec2 R,IM; uniform vec3 S;
uniform float T,drop,trail,shard,shardSeed,beam,darkV,light,flick,kick,shake,fade,split,inv;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n));}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
vec2 toImg(vec2 p){ float ar=IM.x/IM.y, sar=R.x/R.y; float k=max(sar/ar,1.); vec2 q=p/(S.z*k); q.x/=ar; return vec2(S.x,1.-S.y)+q; }
float lum(vec2 u){ if(u.x<0.||u.x>1.||u.y<0.||u.y>1.) return .02; return dot(texture2D(tex,u).rgb,vec3(.299,.587,.114)); }
vec3 img(vec2 p,float sp){ vec2 o=vec2(sp,0.); return vec3(lum(toImg(p+o)),lum(toImg(p)),lum(toImg(p-o))); }
void main(){
  vec2 fc=gl_FragCoord.xy; vec2 p=(fc-.5*R)/R.y;
  p+=vec2(sin(T*61.)*.6,cos(T*47.)*.6)*shake*.012;
  // 壊れろ：碎成玻璃片，每一片各自错开、转一点
  float crack=0., shardL=1.;
  if(shard>0.){
    vec2 g=p*4.2+shardSeed; vec2 ig=floor(g),fg=fract(g); float d1=9.,d2=9.; vec2 cid=vec2(0);
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec2 o=vec2(i,j); vec2 c=o+h22(ig+o); float d=length(fg-c); if(d<d1){d2=d1;d1=d;cid=ig+o;} else if(d<d2) d2=d; }
    float a=(h21(cid)-.5)*.16*shard; vec2 c0=(cid+.5-shardSeed)/4.2;
    p=c0+mat2(cos(a),-sin(a),sin(a),cos(a))*(p-c0)+(h22(cid+3.)-.5)*.07*shard;
    float rr=length(p-vec2(.12,.05));
    crack=smoothstep(.012,.0,d2-d1)*shard*(.25+.75*h21(cid+7.))*smoothstep(1.1,.2,rr);
    shardL=(.82+.36*h21(cid+11.))*(1.+.25*shard*smoothstep(.06,.0,d2-d1));
  }
  // 堕ちろ：往下坠，上面拖着一串残影
  p.y+=drop;
  vec3 c=img(p,split);
  if(trail>0.){ for(int k=1;k<6;k++){ float fk=float(k); c=max(c,img(p+vec2(0.,fk*.045*trail),split*2.)*(1.-fk/6.)*.75*trail); } }
  // 光：主光 + 坏掉的日光灯一样的闪
  float key=exp(-dot(p-vec2(.25,.15),p-vec2(.25,.15))*1.6);
  c*=(.18+light*(.55+.9*key))*(1.-flick*.75);
  // 祈れ：头顶落下一道光
  if(beam>0.){ float bx=abs(p.x-.18); float b=exp(-bx*bx*90.)*(.6+.4*smoothstep(.6,-.5,p.y));
    float dust=step(.985,h21(floor(fc/2.)+floor(T*20.)))*exp(-bx*bx*40.);
    c+=vec3(1.,.97,.9)*(b*.55+dust*.6)*beam; c*=1.+beam*.5*exp(-bx*bx*30.); }
  // 黑暗从四周爬进来（烟一样），鼓点把它震回去
  float n=fbm(p*2.6+vec2(T*.05,-T*.11));
  float edge=length(p*vec2(.75,1.))+(n-.5)*.55;
  float m=smoothstep(.75-darkV*.55+kick*.12,.25-darkV*.35+kick*.12,-edge+.9);
  c*=1.-m*.96;
  c*=mix(1.,shardL,shard);
  c+=vec3(.92,.95,1.)*crack*.9;
  c=mix(c,1.-c,inv);
  c*=.9+.1*sin(fc.y*2.1);
  c+=(h21(fc+fract(T*37.)*91.)-.5)*.07;
  c*=1.-.5*dot(p,p);
  gl_FragColor=vec4(clamp(c,0.,1.)*fade,1.);
}`;
    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      tc = document.createElement("canvas");
      tc.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none";
      document.body.insertBefore(tc, cv.nextSibling); tg = tc.getContext("2d");
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      gl = cv.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["tex", "R", "IM", "S", "T", "drop", "trail", "shard", "shardSeed", "beam", "darkV", "light", "flick", "kick", "shake", "fade", "split", "inv"]) U[k] = gl.getUniformLocation(prog, k);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const im = new Image(); im.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); IW = im.width; IH = im.height; imgReady = true; };
      im.src = `/music/media/${song.id}/bg.jpg?r=${song.rev || 0}`;
      return (ok = true);
    }
    function init() {}
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const sc = Math.min(window.devicePixelRatio || 1, 1.5) * .75, w = Math.round(innerWidth * sc), h = Math.round(innerHeight * sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const b = window.__bass || 0; beatE += (b - beatE) * .1; const beat = playing ? Math.max(0, b - beatE) * 2 : 0;
      kick = Math.max(kick * .84, beat);
      const intro = 1 - sm(19.5, 21, now);
      const lf = last(FALL, now, 2), lb = last(BREAK, now, 2), lp = last(PRAY, now, 3);
      const fa = now - lf, ba = now - lb, pa = now - lp;
      const drop = fa < 1.2 ? Math.sin(Math.min(1, fa / .55) * Math.PI) * .32 * Math.exp(-fa * 1.2) : 0;
      const trail = fa < 1.2 ? Math.exp(-fa * 2.6) : 0;
      const shard = ba < 1.6 ? (ba < .08 ? ba / .08 : Math.exp(-(ba - .08) * 2.4)) : 0;
      const beam = pa < 3 ? Math.min(1, pa / .12) * Math.exp(-pa * .9) : 0;
      // 前奏：坏掉的灯一点点亮起来；「目を開け」时闪一下
      const flick = intro * (now < 6.34 ? .7 : (Math.sin(now * 37) > .6 ? .55 : 0) * (1 - sm(9, 19, now))) + (playing && Math.random() < .03 * (1 - intro) ? .4 : 0);
      const light = (.35 + .65 * sm(4, 19, now)) * (1 + kick * .25) * (1 - sm(101.6, 102.2, now));
      const darkV = .35 + .5 * sm(10, 20, now) + .25 * Math.sin(now * .4) * (1 - intro) + .3 * sm(51, 53, now) * (1 - sm(53.2, 54, now)) + .3 * sm(89, 101, now);
      shake = Math.max(shake * .85, kick * (1 - intro) * .9, fa < .3 ? 1.6 : 0, ba < .25 ? 1.3 : 0);
      const push = 1.08 + .1 * sm(0, 20, now) + kick * .05 * (1 - intro) + .12 * sm(87.5, 89, now);
      const ar = IW / IH, sar = w / h, kk = Math.max(sar / ar, 1), hx = sar / 2 / (push * kk) / ar;
      const fxp = hx >= .5 ? .5 : Math.min(1 - hx, Math.max(hx, sar < 1 ? .66 : .6));
      const inv = playing && (ba < .06 || (now > 87.5 && now < 87.56)) ? 1 : 0;
      gl.uniform1i(U.tex, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(U.R, w, h); gl.uniform2f(U.IM, IW, IH); gl.uniform3f(U.S, fxp, .46, push);
      gl.uniform1f(U.T, now); gl.uniform1f(U.drop, drop); gl.uniform1f(U.trail, trail); gl.uniform1f(U.shard, shard); gl.uniform1f(U.shardSeed, (lb * 7.3) % 10);
      gl.uniform1f(U.beam, beam); gl.uniform1f(U.darkV, Math.min(1.2, darkV)); gl.uniform1f(U.light, imgReady ? light : 0); gl.uniform1f(U.flick, flick);
      gl.uniform1f(U.kick, kick * (1 - intro)); gl.uniform1f(U.shake, shake); gl.uniform1f(U.fade, Math.min(1, .3 + now / 2) * (1 - sm(101.8, 102.4, now)));
      gl.uniform1f(U.split, .002 + kick * .006 + trail * .01 + shard * .012); gl.uniform1f(U.inv, inv);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // —— 命令词：巨大的汉字砸下来 ——
      const W2 = innerWidth, H2 = innerHeight, dp = Math.min(window.devicePixelRatio || 1, 2);
      if (tc.width !== Math.round(W2 * dp)) { tc.width = Math.round(W2 * dp); tc.height = Math.round(H2 * dp); }
      tg.setTransform(dp, 0, 0, dp, 0, 0); tg.clearRect(0, 0, W2, H2);
      let wd = null; for (const x of WORDS) if (x[0] <= now && now - x[0] < 1.6) wd = x;
      if (wd) {
        const age = now - wd[0], hit = Math.min(1, age / .07), a = (age < .07 ? hit : Math.exp(-(age - .07) * 2.2)) * .9;
        const big = Math.min(W2, H2) * .62 * wd[2] * (1.35 - .35 * hit + age * .04);
        const x0 = W2 * (W2 > H2 ? .3 : .5), y0 = H2 * (W2 > H2 ? .5 : .62);
        tg.save(); tg.translate(x0 + (Math.random() - .5) * 10 * Math.exp(-age * 6), y0); tg.textAlign = "center"; tg.textBaseline = "middle";
        tg.font = `${big}px "Zen Old Mincho", "Noto Serif SC", serif`;
        tg.globalCompositeOperation = "lighter";
        tg.fillStyle = `rgba(255,40,40,${a * .35})`; tg.fillText(wd[1], -6 * (1 - hit * .5), 0);
        tg.fillStyle = `rgba(40,200,255,${a * .3})`; tg.fillText(wd[1], 6 * (1 - hit * .5), 0);
        tg.globalCompositeOperation = "source-over";
        tg.fillStyle = `rgba(250,250,250,${a * .78})`; tg.fillText(wd[1], 0, 0);
        tg.restore();
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 废墟中的少女：疯狂的余波之后，重新归于宁静 ═════════
  // 一整片被摧毁的城市、巨大的骸骨、一盏路灯下长椅上的少女。
  // 前面流星零零落落；音乐涨起来时流星雨越来越密（疯狂的余波）；最后流星一颗颗消失，只剩路灯、灰尘和她
  SCENES.ruins = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    // 背景画面（同一个场景的几种状态）：[开始时间, 图]
    // 这几张画是同一场流星雨连续落下的几帧，按顺序循环播放，流星就一遍遍落下来
    const SEQ = ["storm", "more", "fading"], STEP = .85, XF = .35;   // 另外两张天空的笔触不一样，不放进循环
    const FILES = { storm: "p_storm.jpg", more: "p_more.jpg", fading: "p_fading.jpg", few: "p_few.jpg", still: "p_still.jpg" };
    const GIRL = [.255, .845], LAMP = [.18, .535];      // 少女、路灯在画里的位置
    let imgs = {}, lastNow = 0, mets = [], dust = [], wrapEl = null;
    const density = t => .15 + .5 * sm(12, 30, t) + 1.6 * sm(44, 50, t) * (1 - sm(82, 92, t)) - .15 * sm(92, 100, t);
    function setup() {
      if (wrapEl) return true;
      wrapEl = document.querySelector(".cover-wrap"); if (!wrapEl) return false;
      for (const k in FILES) { if (imgs[FILES[k]]) { imgs[k] = imgs[FILES[k]]; continue; } const im = new Image(); im.src = `/music/media/${song.id}/${FILES[k]}?r=${song.rev || 0}`; imgs[k] = imgs[FILES[k]] = im; }
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      for (let i = 0; i < 70; i++) dust.push({ x: Math.random(), y: Math.random(), s: .4 + Math.random() * 1.2, v: .002 + Math.random() * .006, ph: Math.random() * 6.28 });
      return true;
    }
    // 把画按 cover 方式铺进一个框，并以少女为中心慢慢推近
    function place(im, x, y, w, h, z, fxp, fyp, fitH) {
      const s = (fitH ? h / im.naturalHeight : Math.max(w / im.naturalWidth, h / im.naturalHeight)) * z, dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      let ox = x + w / 2 - fxp * dw, oy = y + h / 2 - fyp * dh;
      ox = dw <= w ? x + (w - dw) / 2 : Math.min(x, Math.max(x + w - dw, ox)); oy = Math.min(y, Math.max(y + h - dh, oy));
      return { ox, oy, s, dw, dh };
    }
    function plateAt(t) { const f = t / STEP, i = Math.floor(f), k = sm(1 - XF / STEP, 1, f - i); return { a: SEQ[i % SEQ.length], b: SEQ[(i + 1) % SEQ.length], k }; }
    function paint(g, x, y, w, h, now, z, alphaMul, fitH) {
      const P = plateAt(now);
      const fxp = .5 + (GIRL[0] - .5) * sm(0, 106, now) * .55, fyp = .5 + (GIRL[1] - .5) * sm(0, 106, now) * .5;
      let L = null;
      for (const [k, al] of [[P.a, 1], [P.b, P.k]]) {
        const im = imgs[k]; if (!im || !im.complete || !im.naturalWidth || al <= 0) continue;
        L = place(im, x, y, w, h, z, fxp, fyp, fitH);
        g.globalAlpha = al * alphaMul; g.drawImage(im, L.ox, L.oy, L.dw, L.dh);
      }
      g.globalAlpha = 1; return L;
    }
    function init() {}
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const z = 1 + .05 * sm(0, 106, now);
      // ── 背景：同一个废墟，跟着音乐换状态，镜头慢慢推向少女 ──
      ctx.fillStyle = "#07080b"; ctx.fillRect(0, 0, W, H);
      // 宽屏上按高度完整显示整幅画（不裁切、不放大），两边渐隐到黑里
      const L = paint(ctx, 0, 0, W, H, now, z, .78, true);
      if (L && L.dw < W + 2) { const e = Math.min(W * .12, L.dw * .1);
        for (const [x0, dir] of [[L.ox, 1], [L.ox + L.dw, -1]]) { const g = ctx.createLinearGradient(x0, 0, x0 + dir * e, 0); g.addColorStop(0, "#07080b"); g.addColorStop(1, "rgba(7,8,11,0)"); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x0 + dir * e), 0, e, H); } }
      // ── 流星（画上本来的流星之外，再加真正在动的）──
      if (seek) mets = [];
      if (false) { let n = density(now) * dt * 3.2; while (Math.random() < n) { n -= 1;
        const big = Math.random() < .12;
        mets.push({ x: .3 + Math.random() * .85, y: -.05 + Math.random() * .35, len: (big ? .22 : .08 + Math.random() * .1), sp: (big ? .5 : .35 + Math.random() * .4), w: big ? 2.2 : 1 + Math.random() * .8, life: 0, max: .7 + Math.random() * .9 }); } }
      const ang = Math.PI * .79, cx = Math.cos(ang), cy = Math.sin(ang);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      for (const m of mets) {
        m.life += dt; const a = Math.min(1, m.life / .08) * Math.max(0, 1 - m.life / m.max);
        const hx = (m.x + cx * m.sp * m.life) * W, hy = (m.y + cy * m.sp * m.life) * H * 1.5;
        const tx = hx - cx * m.len * W, ty = hy - cy * m.len * H * 1.5;
        const gr = ctx.createLinearGradient(hx, hy, tx, ty);
        gr.addColorStop(0, `rgba(255,236,200,${.9 * a})`); gr.addColorStop(.15, `rgba(255,200,140,${.5 * a})`); gr.addColorStop(1, "rgba(255,180,120,0)");
        ctx.strokeStyle = gr; ctx.lineWidth = m.w * dpr; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(255,245,225,${a})`; ctx.beginPath(); ctx.arc(hx, hy, m.w * 1.1 * dpr, 0, 6.283); ctx.fill();
      }
      mets = mets.filter(m => m.life < m.max);
      // 路灯的光：很轻地呼吸、偶尔闪一下
      if (L) {
        const lx = L.ox + LAMP[0] * L.dw, ly = L.oy + LAMP[1] * L.dh, R0 = Math.min(W, H) * .32;
        const fl = .85 + .1 * Math.sin(now * 1.7) + (Math.random() < .01 ? -.3 : 0);
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R0); g.addColorStop(0, `rgba(255,190,110,${.22 * fl})`); g.addColorStop(.35, `rgba(255,170,90,${.07 * fl})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(lx - R0, ly - R0, R0 * 2, R0 * 2);
      }
      // 空气里的灰尘
      for (const d of dust) { if (playing) { d.y -= d.v * dt * 6; d.x += Math.sin(now * .3 + d.ph) * .0004; if (d.y < -.02) { d.y = 1.02; d.x = Math.random(); } }
        ctx.fillStyle = `rgba(255,220,180,${.12 + .1 * Math.sin(now + d.ph)})`; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.s * dpr, 0, 6.283); ctx.fill(); }
      ctx.restore();
      const vg = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .3, W / 2, H * .45, Math.max(W, H) * .8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.6)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      // 结尾慢慢暗下去，只剩路灯
      const end = sm(98, 106, now); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end * .7})`; ctx.fillRect(0, 0, W, H); }

      // ── 封面框里：同样的画面跟着换（不加流星，安静一点）──
      if (playing || now > 0) {
        const r = wrapEl.getBoundingClientRect(), x = r.left * dpr, y = r.top * dpr, w = r.width * dpr, h = r.height * dpr;
        const rad = (parseFloat(getComputedStyle(wrapEl).borderTopLeftRadius) || 0) * dpr;
        fx.save(); fx.beginPath(); if (fx.roundRect) fx.roundRect(x, y, w, h, rad); else fx.rect(x, y, w, h); fx.clip();
        const P = plateAt(now);
        { fx.globalAlpha = Math.min(1, now / 2); paint(fx, x, y, w, h, now, 1 + .03 * sm(0, 106, now), Math.min(1, now / 2)); }
        fx.restore();
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ Kodo（孤独）：孤独的吸血鬼 ═════════
  // 永夜里一轮苍白的月亮，画面随着心跳一下下搏动；血一滴滴落进黑暗里，像墨在水里一样慢慢晕开，
  // 再一点点褪色、消失——拥有过的一切都会被时间带走。「血と涙が視界を染めて」时视野被染红、月亮变成血月；
  // 「あの光へ手を伸ばしている」时上方透出一道光；最后只剩下等待
  SCENES.kodo = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    // 血滴落下的时间（跟着歌词，副歌后越来越密）
    const DROPS = [];
    for (const t of [23.6, 31.2, 35.7, 43.1, 48.0, 53.4, 58.9, 66, 73.0, 77.8, 83.6, 86, 88.5, 91, 94.5, 100.4, 106.1, 111.4, 118.2, 125.7, 127.6, 129.5, 131.5,
      133.5, 135.5, 142.4, 147.9, 156, 160, 164, 168, 173.9, 181.9, 194.8, 202, 205, 208, 211, 214, 217, 220, 223, 226]) DROPS.push(t);
    const N = 16;
    let gl, prog, cv, U = {}, ok = false, lastNow = 0, beatE = 0, beatV = 0;
    const FS = `precision highp float;
uniform vec2 R; uniform float T,beat,stain,lightV,scream,moonR,moonL,fade; uniform vec4 B[${N}];
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
void main(){
  vec2 fc=gl_FragCoord.xy; vec2 p=(fc-.5*R)/R.y;
  float ar=R.x/R.y;
  p*=1.-beat*.012;                       // 心跳：整个画面轻轻一缩
  // 永夜：深色的雾在慢慢流动
  float fog=fbm(p*1.3+vec2(T*.012,-T*.008)+fbm(p*2.+T*.01)*.6);
  vec3 col=mix(vec3(.014,.01,.013),vec3(.07,.04,.05),fog*fog*1.3);
  // 月亮：有明暗斑块、边缘变暗、外面一圈光晕，云从前面慢慢飘过
  vec2 mc=vec2(ar*.5-.3,.29); vec2 mq=(p-mc)/.105; float mr=length(mq);
  float maria=smoothstep(.42,.72,fbm(mq*1.1+3.7))*.42+(fbm(mq*3.5+1.3)-.5)*.16;
  vec3 mcol=mix(vec3(.93,.91,.87),vec3(.82,.1,.08),moonR);
  float disc=smoothstep(1.,.97,mr);
  vec3 moon=mcol*(1.-maria)*pow(max(0.,1.-mr*mr),.22);
  float halo=exp(-max(mr-1.,0.)*1.6)*.16+exp(-max(mr-1.,0.)*5.)*.22;
  float cl=smoothstep(.45,.75,fbm(p*vec2(1.4,3.2)+vec2(T*.02,0.)));
  col=mix(col,moon,disc*moonL*(1.-cl*.65));
  col+=mcol*halo*moonL*(1.-cl*.4)*(1.-disc);
  // 血：落进黑暗里，像墨在水里一样拉出一缕缕往下沉的丝，再慢慢褪色、散掉
  for(int i=0;i<${N};i++){
    vec4 b=B[i]; if(b.z<0.) continue;
    float age=b.z; vec2 c=b.xy; float sd=b.w*17.3;
    float fallT=.5;
    if(age<fallT){
      float k=age/fallT; vec2 dp=vec2(c.x,mix(.6,c.y,k*k));
      vec2 q=(p-dp)*vec2(1.,.55); float d=length(q);
      col=mix(col,vec3(.6,.03,.05),smoothstep(.011,.007,d));
      col+=vec3(1.,.75,.75)*smoothstep(.004,.0,length(p-dp-vec2(-.003,.005)))*.7;
      continue;
    }
    float a2=age-fallT;
    vec2 q=p-c;
    float L=.06+.55*(1.-exp(-a2*.09))*b.w;
    float wd=.03+.1*(1.-exp(-a2*.12))*b.w;
    float yy=clamp(-q.y/L,0.,1.);
    vec2 w1=vec2(fbm(q*3.+sd+vec2(0.,a2*.06)),fbm(q*3.+sd+5.2-vec2(0.,a2*.05)));
    vec2 qw=q+(w1-.5)*(.18+.25*yy)*b.w;
    float fil=fbm(qw*vec2(7.,3.5)+sd*2.+vec2(0.,a2*.08));
    float rg=1.-abs(2.*fbm(qw*vec2(11.,4.)+sd*3.+vec2(0.,a2*.1))-1.); rg=pow(rg,6.);   // 细丝
    float cone=exp(-pow(qw.x/(wd*(.4+1.4*yy)),2.))*smoothstep(.02,-.02,qw.y)*smoothstep(-L*1.05,-L*.5,qw.y);
    float head=exp(-dot(qw,qw)/(wd*wd*.25));
    float dens=(cone*(pow(fil,2.4)*1.6+rg*1.6)+head*.7)*exp(-a2/24.)*smoothstep(0.,.25,a2);
    vec3 ink=mix(vec3(.35,.01,.03),vec3(.98,.16,.15),clamp(pow(fil,1.5)+rg*.6,0.,1.));
    ink=mix(vec3(.16,.07,.08),ink,exp(-a2/16.));
    col=mix(col,ink,clamp(dens,0.,1.)*.85);
    col+=vec3(.9,.15,.15)*exp(-a2*2.5)*exp(-dot(q,q)*500.)*.5;
  }
  col+=vec3(.55,.0,.03)*scream*(.15+beat*.35)*smoothstep(.2,.9,length(p));   // 嘶吼：四周随着心跳泛红
  // 视野被血和泪染红
  if(stain>0.){
    float e=length(p*vec2(.85,1.))+(fbm(p*3.+T*.05)-.5)*.35;
    float m=smoothstep(.95-stain*.75,.55-stain*.7,-e+.95);
    col=mix(col,vec3(.38,.01,.03)+vec3(.25,.02,.03)*fbm(p*7.),m*.92);
  }
  // 上方透出的一道光
  if(lightV>0.){
    vec2 lc=vec2(0.,.75); float l=exp(-length((p-lc)*vec2(1.6,1.))*2.2);
    float rays=.5+.5*sin(atan(p.x-lc.x,p.y-lc.y)*24.+T*.4);
    col+=vec3(1.,.95,.88)*(l*.9+l*rays*.25)*lightV;
  }
  col*=1.+beat*.18;
  col+=vec3(.5,0.,.02)*beat*.06*smoothstep(.3,.9,length(p));   // 心跳时边缘泛红
  col+=(h21(fc+fract(T*13.)*71.)-.5)*.02;
  col*=1.-.4*dot(p*.8,p*.8);
  gl_FragColor=vec4(clamp(col,0.,1.)*fade,1.);
}`;
    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      gl = cv.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["R", "T", "beat", "stain", "lightV", "scream", "moonR", "moonL", "fade", "B"]) U[k] = gl.getUniformLocation(prog, k);
      return (ok = true);
    }
    function init() {}
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing; lastNow = now;
      const sc = Math.min(window.devicePixelRatio || 1, 1.5) * .85, w = Math.round(innerWidth * sc), h = Math.round(innerHeight * sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const bs = window.__bass || 0; beatE += (bs - beatE) * .08; beatV = Math.max(beatV * .82, playing ? Math.max(0, bs - beatE) * 2.5 : 0);
      // 没有明显鼓点的段落，也保持一个慢慢的心跳（约 64 次/分）
      const hb = t => { const ph = (t * 64 / 60) % 1; return Math.exp(-ph * 14) + .6 * Math.exp(-Math.max(0, ph - .18) * 14) * (ph > .18 ? 1 : 0); };
      const beat = Math.min(1.2, beatV + (playing ? hb(now) * .55 : 0));
      const ar = w / h, Bv = new Float32Array(N * 4).fill(-1);
      const recent = DROPS.filter(t => t <= now && now - t < 60).slice(-N);
      recent.forEach((t, i) => {
        const k = DROPS.indexOf(t), sx = (hash(k * 3.1) - .5) * ar * .85, sy = (hash(k * 7.7) - .5) * .7 - .05;
        Bv.set([sx, sy, now - t, .7 + hash(k * 1.9) * .7], i * 4);
      });
      const stain = sm(127.4, 132, now) * (1 - sm(139, 147, now));
      const lightV = sm(147.6, 150, now) * (1 - sm(153, 158, now)) * .9;
      const scream = sm(83.3, 84.5, now) * (1 - sm(92.5, 94, now)) + sm(154.3, 156, now) * (1 - sm(170, 173.5, now)) * .8;
      const moonR = Math.max(stain, sm(197, 205, now) * (1 - sm(228, 236, now)));
      const moonL = (.35 + .65 * sm(1, 20, now)) * (1 - .5 * sm(184, 197, now) + .5 * sm(197, 205, now));
      const fade = Math.min(1, .35 + now / 3) * (1 - sm(234, 239.5, now));
      gl.uniform2f(U.R, w, h); gl.uniform1f(U.T, now); gl.uniform1f(U.beat, beat); gl.uniform1f(U.stain, stain); gl.uniform1f(U.lightV, lightV);
      gl.uniform1f(U.scream, scream); gl.uniform1f(U.moonR, moonR); gl.uniform1f(U.moonL, moonL); gl.uniform1f(U.fade, fade); gl.uniform4fv(U.B, Bv);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { init, draw, wet: false };
  };

  // ═════════ 全力以赴的笨蛋（おつかれさま）═════════
  // 夜里的雨，一直下。躺在湿透的草地上的他。屏幕像一块玻璃，雨点打上去、顺着往下滑（像眼泪）；
  // 越唱越重：雨更大、风更斜，英文段偶尔远处打闪；
  // 唱到「おつかれさま」那一刻雨停了，云散开，一层很暖的光落下来，萤火一样的小光点慢慢升起——像终于有人对他说了这句话
  SCENES.otsukare = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const CALM = 100.6;                                  // 「おつかれさま」
    const FLASH = [58.7, 62.2, 64.3, 86.1, 88.6, 90.9];  // 英文段远处的闪电
    let im = null, lastNow = 0, rain = [], drops = [], motes = [], fl = 0, ready = false;
    function setup() {
      if (im) return true;
      im = new Image(); im.onload = () => (ready = true); im.src = `/music/media/${song.id}/cover.jpg?r=${song.rev || 0}`;
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      return true;
    }
    const rainAmt = t => (.35 + .3 * sm(10, 26, t) + .25 * sm(36, 46, t) + .3 * sm(56, 60, t) * (1 - sm(68, 72, t)) + .2 * sm(80, 86, t)) * (1 - sm(CALM - 1.2, CALM + 1.5, t));
    function init() { rain = []; drops = []; }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const warm = sm(CALM - .5, CALM + 4, now), ra = rainAmt(now);
      ctx.fillStyle = "#05070c"; ctx.fillRect(0, 0, W, H);
      // ── 他（封面），宽屏上按高度完整显示，两边渐隐 ──
      let L = null;
      if (ready) {
        const z = 1 + .06 * sm(0, 135, now), s = Math.max(H / im.naturalHeight, W > H ? 0 : W / im.naturalWidth) * z;
        const dw = im.naturalWidth * s, dh = im.naturalHeight * s, ox = (W - dw) / 2, oy = (H - dh) / 2 - (dh - H) * .1;
        ctx.globalAlpha = .8 + .2 * warm; ctx.drawImage(im, ox, oy, dw, dh); ctx.globalAlpha = 1; L = { ox, oy, dw, dh };
        if (dw < W) { const e = Math.min(W * .12, dw * .1);
          for (const [x0, dir] of [[ox, 1], [ox + dw, -1]]) { const g = ctx.createLinearGradient(x0, 0, x0 + dir * e, 0); g.addColorStop(0, "#05070c"); g.addColorStop(1, "rgba(5,7,12,0)"); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x0 + dir * e), 0, e, H); } }
      }
      // ── 天色：雨里是冷的蓝；おつかれさま 之后，暖光从上面落下来 ──
      ctx.save();
      ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = `rgba(${170 + warm * 85 | 0},${185 + warm * 60 | 0},${228 - warm * 18 | 0},1)`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "screen";
      if (warm > 0) { const g = ctx.createRadialGradient(W * .55, -H * .15, 0, W * .55, -H * .15, Math.max(W, H) * 1.1);
        g.addColorStop(0, `rgba(255,214,150,${.6 * warm})`); g.addColorStop(.5, `rgba(255,185,110,${.2 * warm})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // 闪电
      if (playing) for (const t of FLASH) if (t > prev && t <= now && now - t < .3) fl = Math.max(fl, .5 + Math.random() * .3);
      if (fl > .01) { ctx.fillStyle = `rgba(200,215,255,${fl * .35})`; ctx.fillRect(0, 0, W, H); if (Math.random() < .2) fl *= .5; }
      fl *= .85;
      ctx.restore();
      // ── 雨丝（斜着落，越到副歌越密）──
      if (seek) { rain = []; drops = []; motes = []; }
      const wind = .18 + .12 * sm(56, 60, now) * (1 - sm(68, 72, now)) + .08 * Math.sin(now * .3);
      const target = Math.round(ra * 520 * Math.min(1.4, W * H / (1400 * 900 * dpr * dpr) + .3));
      while (rain.length < target) rain.push({ x: Math.random() * W * 1.3 - W * .15, y: Math.random() * H, v: (1400 + Math.random() * 900) * dpr, l: (14 + Math.random() * 26) * dpr, a: .08 + Math.random() * .22 });
      if (rain.length > target) rain.length = target;
      ctx.save(); ctx.lineCap = "round";
      for (const r of rain) {
        if (playing) { r.y += r.v * dt; r.x += r.v * wind * dt; if (r.y > H + 30) { r.y = -40 - Math.random() * 100; r.x = Math.random() * W * 1.3 - W * .15; } }
        ctx.strokeStyle = `rgba(200,215,240,${r.a})`; ctx.lineWidth = Math.max(1, dpr * .9);
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.l * wind, r.y - r.l); ctx.stroke();
      }
      ctx.restore();
      // ── 屏幕上的水珠：打上去、停一会、顺着往下滑，留下一道水痕（像眼泪）──
      if (playing && !seek && L && Math.random() < dt * 14 * ra) {
        const r0 = (3 + Math.pow(Math.random(), 2.5) * 12) * dpr;
        drops.push({ x: Math.random() * W, y: Math.random() * H * .9, r: r0, vy: 0, hold: .4 + Math.random() * 3, life: 0, trail: [] });
      }
      for (const d of drops) {
        d.life += dt;
        if (d.life > d.hold && d.r > 4 * dpr) { d.vy = Math.min(d.vy + 260 * dpr * dt, 220 * dpr); d.y += d.vy * dt; d.x += Math.sin(d.y * .03) * .3; if (d.trail.length === 0 || d.y - d.trail[d.trail.length - 1][1] > 3 * dpr) d.trail.push([d.x, d.y]); }
        const fade = Math.min(1, d.life * 6) * (warm > 0 ? 1 - warm : 1);
        if (fade <= .01) continue;
        // 水痕
        if (d.trail.length > 1) { ctx.strokeStyle = `rgba(210,225,245,${.07 * fade})`; ctx.lineWidth = d.r * .7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(d.trail[0][0], d.trail[0][1]); for (const p of d.trail) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        // 水珠里倒映着上下颠倒、放大的画面
        ctx.save(); ctx.globalAlpha = .85 * fade; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 1.12, 0, 0, 6.283); ctx.clip();
        if (ready) { const k = 2.4, sw = d.r * 2 * k; const sx = (d.x - L.ox) / L.dw * im.naturalWidth, sy = (d.y - L.oy) / L.dh * im.naturalHeight, ss = sw / L.dw * im.naturalWidth;
          ctx.translate(d.x, d.y); ctx.scale(1, -1); ctx.drawImage(im, sx - ss / 2, sy - ss / 2, ss, ss, -d.r * 1.1, -d.r * 1.2, d.r * 2.2, d.r * 2.4); ctx.setTransform(1, 0, 0, 1, 0, 0); }
        ctx.restore();
        const g = ctx.createRadialGradient(d.x - d.r * .35, d.y - d.r * .4, 0, d.x, d.y, d.r * 1.15);
        g.addColorStop(0, `rgba(255,255,255,${.5 * fade})`); g.addColorStop(.25, `rgba(255,255,255,${.06 * fade})`); g.addColorStop(.85, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${.35 * fade})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 1.12, 0, 0, 6.283); ctx.fill();
      }
      drops = drops.filter(d => d.y < H + 20 && d.life < 14).slice(-90);
      // ── 雨停之后：萤火一样的暖色光点慢慢往上飘 ──
      if (playing && !seek && warm > .2 && Math.random() < dt * 10 * warm * (1 - sm(128, 135, now))) motes.push({ x: Math.random() * W, y: H * (.55 + Math.random() * .5), vy: -(10 + Math.random() * 22) * dpr, ph: Math.random() * 6.28, r: (1 + Math.random() * 1.8) * dpr, life: 0 });
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const m of motes) {
        m.life += dt; m.y += m.vy * dt; m.x += Math.sin(now * .8 + m.ph) * 12 * dpr * dt;
        const a = Math.min(1, m.life / 1.5) * Math.max(0, 1 - m.life / 12) * (.5 + .5 * Math.sin(now * 2.3 + m.ph));
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 6); g.addColorStop(0, `rgba(255,230,170,${.8 * a})`); g.addColorStop(.3, `rgba(255,200,120,${.18 * a})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(m.x - m.r * 6, m.y - m.r * 6, m.r * 12, m.r * 12);
      }
      ctx.restore(); motes = motes.filter(m => m.life < 12);
      const vg = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .3, W / 2, H * .45, Math.max(W, H) * .8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${.6 - .25 * warm})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const end = sm(131, 135.5, now); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end * .6})`; ctx.fillRect(0, 0, W, H); }
    }
    return { init, draw, wet: false };
  };

  // ═════════ もう疲れた：对这个世界最后的抗议 ═════════
  // 满屏是乱涂的颜料和那张咧着嘴的脸。随着鼓点轻轻震；
  // 画面像被抽干力气一样一点点往下「化」掉（一条条往下淌）；
  // 黑色的乱线一笔一笔涂上来，越涂越满；「どこが美しい？」颜色被抽干；「繰り返す苦痛」画面一遍遍重复；
  // 最后，所有东西一起沉进黑暗里
  SCENES.tired = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    let gl, prog, cv, U = {}, ok = false, tex, imgReady = false, IW = 1536, IH = 1024, sc2, sg, lastNow = 0, beatE = 0, kick = 0, pen = null;
    const FS = `precision highp float;
uniform sampler2D tex; uniform vec2 R,IM; uniform vec3 S;
uniform float T,sat,sag,split,kick,rep,dark,fade,cold;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec2 toImg(vec2 p){ float ar=IM.x/IM.y, sar=R.x/R.y; float k=max(sar/ar,1.); vec2 q=p/(S.z*k); q.x/=ar; return vec2(S.x,1.-S.y)+q; }
vec3 smp(vec2 u){ u=clamp(u,.001,.999); return texture2D(tex,u).rgb; }
void main(){
  vec2 fc=gl_FragCoord.xy; vec2 p=(fc-.5*R)/R.y;
  p+=vec2(sin(T*53.),cos(T*41.))*kick*.004;
  // 一遍遍重复：画面切成几条，每条都是同一段
  if(rep>0.){ float n=floor(mix(1.,5.,rep)); float y=fract((p.y+.5)*n)/n-.5+ .5/n; p.y=mix(p.y,y*(1.+.2*rep),rep); }
  // 往下化：每一列往下淌的程度不同
  float col=fc.x/R.y*60.;
  float drip=vn(vec2(col*.25,3.))*.65+vn(vec2(col*1.3,7.))*.25+vn(vec2(col*4.,11.))*.1;
  p.y+=sag*(.04+.22*pow(drip,2.2))*smoothstep(-.6,.5,p.y);
  vec2 u=toImg(p); float sp=split*.004+kick*.003;
  vec3 c=vec3(smp(u+vec2(sp,0.)).r,smp(u).g,smp(u-vec2(sp,0.)).b);
  float l=dot(c,vec3(.299,.587,.114));
  c=mix(vec3(l),c,sat);
  c=mix(c,vec3(l)*vec3(.82,.9,1.05),cold);
  c*=1.+kick*.12;
  float e=length(p*vec2(.8,1.));
  c*=1.-dark*smoothstep(.15,.95-dark*.45,e);     // 四周的黑暗慢慢合拢
  c+=(h21(fc+fract(T*29.)*77.)-.5)*.05;
  c*=1.-.35*dot(p,p);
  gl_FragColor=vec4(clamp(c,0.,1.)*fade,1.);
}`;
    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      sc2 = document.createElement("canvas");          // 乱线一笔笔累积在这张画布上
      sc2.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none";
      document.body.insertBefore(sc2, cv.nextSibling); sg = sc2.getContext("2d");
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      gl = cv.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["tex", "R", "IM", "S", "T", "sat", "sag", "split", "kick", "rep", "dark", "fade", "cold"]) U[k] = gl.getUniformLocation(prog, k);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const im = new Image(); im.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); IW = im.width; IH = im.height; imgReady = true; };
      im.src = `/music/media/${song.id}/cover.jpg?r=${song.rev || 0}`;
      return (ok = true);
    }
    function init() {}
    // 一笔乱线：带一点抖动的连续折线，像用炭笔狠狠划过去
    function stroke(Wc, Hc, red) {
      const n = 8 + (Math.random() * 18 | 0); let x = Math.random() * Wc, y = Math.random() * Hc, a = Math.random() * 6.28;
      const len = Math.min(Wc, Hc) * (.03 + Math.random() * .06);
      sg.beginPath(); sg.moveTo(x, y);
      for (let i = 0; i < n; i++) { a += (Math.random() - .5) * 2.2; x += Math.cos(a) * len; y += Math.sin(a) * len; sg.lineTo(x, y); }
      sg.strokeStyle = red ? `rgba(${150 + Math.random() * 60 | 0},${10 + Math.random() * 20 | 0},${15 + Math.random() * 20 | 0},${.35 + Math.random() * .35})` : `rgba(8,6,6,${.25 + Math.random() * .4})`;
      sg.lineWidth = (.6 + Math.random() * 2.4) * Math.min(window.devicePixelRatio || 1, 2); sg.lineJoin = "round"; sg.stroke();
    }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const sc = Math.min(window.devicePixelRatio || 1, 1.5) * .8, w = Math.round(innerWidth * sc), h = Math.round(innerHeight * sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const bs = window.__bass || 0; beatE += (bs - beatE) * .1; kick = Math.max(kick * .84, playing ? Math.max(0, bs - beatE) * 2 : 0);
      // 镜头：慢慢在这张乱糟糟的画上游移，偶尔贴近那张脸
      const face = sm(10, 20, now) * (1 - sm(42, 52, now)) + sm(85, 95, now) * (1 - sm(105, 112, now));
      const fxp = .5 + .06 * Math.sin(now * .05) - .02 * face, fyp = .45 + .04 * Math.cos(now * .04) - .1 * face, z = 1.08 + .45 * face + .05 * Math.sin(now * .07);
      const tiredness = sm(0, 134, now);
      const sag = .15 + .5 * sm(52, 58, now) * (1 - sm(61, 64, now)) + .35 * tiredness + .9 * sm(125, 134, now);
      const sat = 1 - .35 * tiredness - .6 * sm(73.5, 75, now) * (1 - sm(79, 85, now));
      const cold = .7 * sm(73.5, 75, now) * (1 - sm(79, 85, now));
      const rep = sm(79.5, 80.2, now) * (1 - sm(84.5, 85.5, now)) + .5 * sm(95.3, 96, now) * (1 - sm(104.8, 105.8, now));
      const dark = .15 + .35 * tiredness + .5 * sm(117.6, 134, now);
      const fade = Math.min(1, .3 + now / 2) * (1 - sm(131, 134, now) * .92);
      gl.uniform1i(U.tex, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(U.R, w, h); gl.uniform2f(U.IM, IW, IH); gl.uniform3f(U.S, fxp, fyp, z);
      gl.uniform1f(U.T, now); gl.uniform1f(U.sat, sat); gl.uniform1f(U.sag, sag); gl.uniform1f(U.split, 1 + 2 * kick); gl.uniform1f(U.kick, kick);
      gl.uniform1f(U.rep, rep); gl.uniform1f(U.dark, Math.min(1, dark)); gl.uniform1f(U.fade, imgReady ? fade : 0); gl.uniform1f(U.cold, cold);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // —— 乱线累积 ——
      const dp = Math.min(window.devicePixelRatio || 1, 2), Wc = Math.round(innerWidth * dp), Hc = Math.round(innerHeight * dp);
      if (sc2.width !== Wc || sc2.height !== Hc || seek) { sc2.width = Wc; sc2.height = Hc; }
      if (playing && !seek) {
        const rate = (2 + 10 * level + 8 * kick + 6 * tiredness) * (1 - sm(117, 125, now));
        let n = rate * dt; while (Math.random() < n) { n -= 1; stroke(Wc, Hc, Math.random() < .18); }
        // 慢慢褪掉一点，不至于全黑
        sg.globalCompositeOperation = "destination-out"; sg.fillStyle = `rgba(0,0,0,${.012 + .1 * sm(125, 133, now)})`; sg.fillRect(0, 0, Wc, Hc); sg.globalCompositeOperation = "source-over";
      }
    }
    return { init, draw, wet: false };
  };

  // ═════════ 光明之路（Shining Road）：再一次，飞翔 ═════════
  // 站在悬崖边、向着太阳伸出手的她。开头还是「夜の底」，天色慢慢亮起来；
  // 「さあ、行こう！」时太阳完全升起，光芒一圈圈转动；金色的羽毛乘着风往上飘，小鸟成群飞过；
  // 「空はまだ開いている！」光一下子炸开、羽毛扬起；「高く、高く」镜头抬向天空
  SCENES.shining = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const SUN = [.665, .225];                                     // 太阳在画里的位置
    const BURST = [85.9, 163.36, 192.62];                         // 光炸开的时刻
    let im = null, ready = false, lastNow = 0, feathers = [], birds = [], motes = [], spr = [], flash = 0, beatE = 0, kick = 0;
    function featherSprite(seed) {
      const c = document.createElement("canvas"); c.width = 90; c.height = 260; const g = c.getContext("2d");
      const R = k => { const x = Math.sin(seed * 91.7 + k * 12.9) * 43758.5; return x - Math.floor(x); };
      const len = 220, bend = (R(1) - .5) * 18, qx = t => 45 + bend * Math.sin(t * 2.8);
      g.translate(0, 18);
      for (let i = 0; i < 120; i++) { const t = .06 + .92 * i / 120, side = i % 2 ? 1 : -1, wl = 26 * Math.sin(Math.min(1, t * 1.1) * Math.PI) ** .6;
        const x0 = qx(t), y0 = t * len, a = side > 0 ? -.6 : -Math.PI + .6;
        g.strokeStyle = `rgba(255,${240 + R(i) * 15 | 0},${215 + R(i + 9) * 30 | 0},${.55 + R(i + 3) * .35})`; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * wl * .5, y0 - 4, x0 + Math.cos(a) * wl, y0 + Math.sin(a) * wl * .5); g.stroke(); }
      g.strokeStyle = "rgba(255,250,235,.95)"; g.lineWidth = 1.6; g.beginPath(); for (let k = 0; k <= 30; k++) g.lineTo(qx(k / 30), k / 30 * len * 1.04); g.stroke();
      return c;
    }
    function setup() {
      if (im) return true;
      im = new Image(); im.onload = () => (ready = true); im.src = `/music/media/${song.id}/cover.jpg?r=${song.rev || 0}`;
      for (let i = 0; i < 5; i++) spr.push(featherSprite(i + 1));
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      return true;
    }
    function addFeather(burst) {
      const s = (.25 + Math.random() * .4) * Math.min(W, H) / 900;
      feathers.push(burst
        ? { x: W * (.35 + Math.random() * .4), y: H * (.5 + Math.random() * .3), vx: (Math.random() - .3) * 260 * dpr, vy: -(120 + Math.random() * 300) * dpr, s, r: Math.random() * 6.28, vr: (Math.random() - .5) * 3, ph: Math.random() * 6.28, life: 0, max: 7 + Math.random() * 4 }
        : { x: -W * .05 + Math.random() * W * .6, y: H * (.6 + Math.random() * .45), vx: (40 + Math.random() * 90) * dpr, vy: -(25 + Math.random() * 55) * dpr, s, r: Math.random() * 6.28, vr: (Math.random() - .5) * 1.2, ph: Math.random() * 6.28, life: 0, max: 14 + Math.random() * 6 });
    }
    function init() { feathers = []; birds = []; motes = []; }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const bs = window.__bass || 0; beatE += (bs - beatE) * .1; kick = Math.max(kick * .86, playing ? Math.max(0, bs - beatE) * 2 : 0);
      // 天色：夜 → 黎明 → 朝阳
      const dawn = sm(4, 63, now), full = sm(58, 66, now);
      const up = sm(136, 140, now) * (1 - sm(150, 158, now));       // 高く、高く：镜头抬向天空
      ctx.fillStyle = "#070912"; ctx.fillRect(0, 0, W, H);
      let L = null;
      if (ready) {
        const z = 1.04 + .06 * sm(0, 232, now) + .12 * up;
        const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * z, dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        const fxp = .55 + .05 * Math.sin(now * .03), fyp = .5 - .25 * up;
        let ox = W / 2 - fxp * dw, oy = H / 2 - fyp * dh; ox = Math.min(0, Math.max(W - dw, ox)); oy = Math.min(0, Math.max(H - dh, oy));
        ctx.globalAlpha = .45 + .55 * dawn; ctx.drawImage(im, ox, oy, dw, dh); ctx.globalAlpha = 1; L = { ox, oy, dw, dh };
      }
      // 夜色：一层冷蓝，随黎明慢慢退去
      ctx.save(); ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgb(${110 + 145 * dawn | 0},${120 + 135 * dawn | 0},${170 + 85 * dawn | 0})`; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // ── 太阳的光芒：慢慢转动，跟着鼓点呼吸 ──
      if (L) {
        const sx = L.ox + SUN[0] * L.dw, sy = L.oy + SUN[1] * L.dh, Rr = Math.max(W, H) * 1.2, a0 = now * .03;
        if (playing) for (const t of BURST) if (t > prev && t <= now && now - t < .4) { flash = 1; for (let i = 0; i < 26; i++) addFeather(true); }
        flash *= .965;
        const glow = (.25 + .45 * full + .3 * kick * full + .6 * flash) * dawn;
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 18; i++) {
          const a = a0 + i / 18 * Math.PI * 2 + Math.sin(i * 7.3) * .08, wdt = .025 + .02 * Math.sin(i * 3.1 + now * .4);
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Rr);
          g.addColorStop(0, `rgba(255,236,190,${.16 * glow})`); g.addColorStop(.35, `rgba(255,214,150,${.05 * glow})`); g.addColorStop(1, "rgba(255,200,140,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, Rr, a - wdt, a + wdt); ctx.closePath(); ctx.fill();
        }
        const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.min(W, H) * (.45 + .3 * flash));
        g2.addColorStop(0, `rgba(255,248,225,${.55 * glow})`); g2.addColorStop(.25, `rgba(255,220,160,${.2 * glow})`); g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
        if (flash > .02) { ctx.fillStyle = `rgba(255,240,215,${flash * .28})`; ctx.fillRect(0, 0, W, H); }
        ctx.restore();
      }
      // ── 鸟群：从太阳那边飞过 ──
      if (seek) { feathers = []; birds = []; motes = []; }
      if (playing && !seek && full > .5 && Math.random() < dt * .25) {
        const n = 3 + (Math.random() * 6 | 0), y0 = H * (.12 + Math.random() * .25), dir = Math.random() < .5 ? 1 : -1, sp = (60 + Math.random() * 50) * dpr;
        for (let i = 0; i < n; i++) birds.push({ x: dir > 0 ? -40 - i * 30 * dpr : W + 40 + i * 30 * dpr, y: y0 + (Math.random() - .5) * 60 * dpr + i * 6 * dpr, vx: dir * sp * (.9 + Math.random() * .2), s: (4 + Math.random() * 4) * dpr, ph: Math.random() * 6.28, f: 5 + Math.random() * 3 });
      }
      ctx.save(); ctx.strokeStyle = "rgba(40,30,40,.75)"; ctx.lineCap = "round";
      for (const b of birds) { if (playing) b.x += b.vx * dt; const fl = Math.sin(now * b.f + b.ph); ctx.lineWidth = Math.max(1, b.s * .22);
        ctx.beginPath(); ctx.moveTo(b.x - b.s, b.y - fl * b.s * .55); ctx.quadraticCurveTo(b.x - b.s * .4, b.y - b.s * .1, b.x, b.y); ctx.quadraticCurveTo(b.x + b.s * .4, b.y - b.s * .1, b.x + b.s, b.y - fl * b.s * .55); ctx.stroke(); }
      ctx.restore(); birds = birds.filter(b => b.x > -200 && b.x < W + 200);
      // ── 金色的羽毛，乘着风往上飘 ──
      if (playing && !seek) { const rate = (.4 + 1.6 * full + 2.5 * sm(120, 126, now) * (1 - sm(150, 156, now))) * dawn; if (Math.random() < dt * rate) addFeather(false); }
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const f of feathers) {
        f.life += dt; if (f.vy < -140 * dpr) f.vy *= .985; f.vx *= .995;
        f.x += (f.vx + Math.sin(now * .9 + f.ph) * 30 * dpr) * dt; f.y += f.vy * dt; f.r += f.vr * dt;
        const a = Math.min(1, f.life * 1.5) * Math.max(0, 1 - f.life / f.max);
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.scale(f.s * (.55 + .45 * Math.abs(Math.cos(now * 1.4 + f.ph))), f.s); ctx.globalAlpha = a * .85;
        ctx.drawImage(spr[(f.ph * 10 | 0) % spr.length], -45, -130); ctx.restore();
      }
      ctx.restore(); feathers = feathers.filter(f => f.life < f.max && f.y > -300);
      // 风里的光点
      if (playing && !seek && Math.random() < dt * 14 * dawn) motes.push({ x: -10, y: Math.random() * H, vx: (80 + Math.random() * 160) * dpr, vy: -(5 + Math.random() * 25) * dpr, r: (.6 + Math.random() * 1.4) * dpr, life: 0 });
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const m of motes) { if (playing) { m.x += m.vx * dt; m.y += m.vy * dt; } m.life += dt; ctx.fillStyle = `rgba(255,235,190,${.5 * Math.min(1, m.life)})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill(); }
      ctx.restore(); motes = motes.filter(m => m.x < W + 20);
      const vg = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .45, Math.max(W, H) * .85);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${.55 - .3 * dawn})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const end = sm(222, 231, now); if (end > 0) { ctx.fillStyle = `rgba(255,245,225,${end * .35})`; ctx.fillRect(0, 0, W, H); }
    }
    return { init, draw, wet: false };
  };

  // ═════════ Smiling Before Goodbye：和过去的自己告别 ═════════
  // 黄昏的花田、铁路道口、微笑着的他。道口的红灯一左一右交替闪着；花瓣被风吹着飘过；
  // 「Where have all the flowers gone?」颜色一点点褪掉；「We smile」时暖光重新回来；
  // 最后一句「goodbye」，一列火车从道口后面驶过，过去的一切跟着它离开，天色暗下来，亮起一颗星
  SCENES.goodbye = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const LAMPS = [[.1785, .4255], [.2065, .4255]];          // 道口两盏红灯在画里的位置
    const TRAIN = [-2, -1];                                  // （火车会盖在花和道口前面，显得假，先不用）
    let im = null, ready = false, lastNow = 0, petals = [], petalSpr = [];
    function petal(seed) {
      const c = document.createElement("canvas"); c.width = 40; c.height = 24; const g = c.getContext("2d");
      const tint = seed % 3 === 0 ? [255, 210, 220] : [255, 246, 236];
      const gr = g.createLinearGradient(0, 12, 40, 12); gr.addColorStop(0, `rgba(${tint},.95)`); gr.addColorStop(1, `rgba(${tint},.55)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(2, 12); g.bezierCurveTo(10, -1, 30, 1, 38, 9); g.lineTo(35, 12); g.lineTo(38, 15); g.bezierCurveTo(30, 23, 10, 25, 2, 12); g.fill();
      g.strokeStyle = "rgba(200,170,160,.35)"; g.lineWidth = .8; g.beginPath(); g.moveTo(3, 12); g.lineTo(33, 12); g.stroke();
      return c;
    }
    function setup() {
      if (im) return true;
      im = new Image(); im.onload = () => (ready = true); im.src = `/music/media/${song.id}/cover.jpg?r=${song.rev || 0}`;
      for (let i = 0; i < 6; i++) petalSpr.push(petal(i));
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      return true;
    }
    function init() { petals = []; }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const grey = sm(186, 194, now) * (1 - sm(238, 248, now));           // 花和颜色都去哪了
      const dusk = sm(150, 300, now);                                       // 天慢慢暗下去
      const warmBack = sm(244, 252, now) * (1 - sm(286, 296, now));         // We smile：暖光回来
      ctx.fillStyle = "#0b0a0c"; ctx.fillRect(0, 0, W, H);
      let L = null;
      if (ready) {
        const z = 1.02 + .08 * sm(0, 304, now), s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * z, dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        const fxp = W > H ? 0 : .6, fyp = .5;   // 宽屏靠左对齐，封面上的标题不被裁掉
        let ox = W / 2 - fxp * dw, oy = H / 2 - fyp * dh; ox = Math.min(0, Math.max(W - dw, ox)); oy = Math.min(0, Math.max(H - dh, oy));
        ctx.filter = grey > .01 ? `saturate(${1 - .85 * grey}) brightness(${1 - .15 * grey})` : "none";
        ctx.drawImage(im, ox, oy, dw, dh); ctx.filter = "none"; L = { ox, oy, dw, dh };
      }
      if (seek) petals = [];
      if (L) {
        const P = (u, v) => [L.ox + u * L.dw, L.oy + v * L.dh];
        // ── 火车：从道口后面驶过（只在他左边的那段地平线上看得到）──
        const tk = (now - TRAIN[0]) / (TRAIN[1] - TRAIN[0]);
        if (tk > 0 && tk < 1) {
          const [x0, yTop] = P(0, .548), [xClip, yBot] = P(.505, .584), hh = yBot - yTop, carW = L.dw * .095, n = 10, tx = x0 - carW * n + tk * (carW * n + (xClip - x0) + carW);
          ctx.save(); ctx.beginPath(); ctx.rect(x0, yTop - 4, xClip - x0, hh + 8); ctx.clip();
          for (let i = 0; i < n; i++) { const cx = tx + i * carW, gap = 1.5 * dpr;
            const body = ctx.createLinearGradient(0, yTop, 0, yBot); body.addColorStop(0, "rgba(58,48,50,.96)"); body.addColorStop(.18, "rgba(30,26,30,.97)"); body.addColorStop(1, "rgba(16,14,18,.98)");
            ctx.fillStyle = body; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx, yTop, carW - gap, hh, [hh * .25, hh * .25, 1, 1]); else ctx.rect(cx, yTop, carW - gap, hh); ctx.fill();
            ctx.fillStyle = "rgba(255,196,130,.75)"; ctx.fillRect(cx + carW * .06, yTop + hh * .3, carW * .86, Math.max(1, hh * .16));   // 一排连起来的车窗灯光
            ctx.fillStyle = "rgba(20,18,22,.9)"; for (let k = 1; k < 7; k++) ctx.fillRect(cx + carW * (.06 + k * .123), yTop + hh * .3, Math.max(1, dpr), Math.max(1, hh * .16)); }
          ctx.restore();
        }
        // ── 道口的红灯，一左一右交替闪 ──
        const ring = sm(0, 2, now) * (1 - sm(292, 300, now));
        const ph = Math.floor(now * 1.6) % 2;
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        LAMPS.forEach(([u, v], i) => {
          const on = (i === ph ? 1 : .08) * ring; if (on < .02) return;
          const [x, y] = P(u, v), r = L.dw * .03;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,90,60,${.9 * on})`); g.addColorStop(.25, `rgba(255,60,40,${.35 * on})`); g.addColorStop(1, "rgba(255,40,30,0)");
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        });
        ctx.restore();
      }
      // ── 天色：金色黄昏 → 暮色；We smile 时暖光回来 ──
      ctx.save(); ctx.globalCompositeOperation = "multiply";
      const dk = dusk * (1 - .6 * warmBack);
      ctx.fillStyle = `rgb(${255 - 120 * dk | 0},${255 - 105 * dk | 0},${255 - 50 * dk | 0})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "screen";
      const sun = (.25 + .35 * warmBack) * (1 - .7 * grey) * (1 - .6 * dusk + .6 * warmBack);
      const g = ctx.createRadialGradient(W * .3, H * .48, 0, W * .3, H * .48, Math.max(W, H) * .8);
      g.addColorStop(0, `rgba(255,190,110,${.5 * sun})`); g.addColorStop(.4, `rgba(255,150,80,${.15 * sun})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 最后亮起一颗星
      const star = sm(292, 298, now);
      if (star > 0 && L) { const x = L.ox + .82 * L.dw, y = L.oy + .12 * L.dh, r = 3 * dpr * (1 + .2 * Math.sin(now * 3));
        const sg = ctx.createRadialGradient(x, y, 0, x, y, r * 8); sg.addColorStop(0, `rgba(255,250,235,${star})`); sg.addColorStop(.2, `rgba(255,240,210,${.3 * star})`); sg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = sg; ctx.fillRect(x - r * 8, y - r * 8, r * 16, r * 16); }
      ctx.restore();
      // ── 被风吹过的花瓣 ──
      const rate = (1.2 + 2.5 * level) * (1 - .8 * grey) * (1 - sm(296, 304, now));
      if (playing && !seek && Math.random() < dt * rate * 3) petals.push({ x: W + 20, y: Math.random() * H * .9, vx: -(90 + Math.random() * 120) * dpr, vy: (10 + Math.random() * 30) * dpr, r: Math.random() * 6.28, vr: (Math.random() - .5) * 4, s: (.35 + Math.random() * .5) * dpr, ph: Math.random() * 6.28, spr: petalSpr[(Math.random() * petalSpr.length) | 0] });
      for (const p of petals) {
        if (playing) { p.x += p.vx * dt; p.y += (p.vy + Math.sin(now * 1.7 + p.ph) * 25 * dpr) * dt; p.r += p.vr * dt; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(p.s, p.s * (.4 + .6 * Math.abs(Math.sin(now * 2 + p.ph)))); ctx.globalAlpha = .85 * (1 - .6 * grey);
        ctx.drawImage(p.spr, -20, -12); ctx.restore();
      }
      petals = petals.filter(p => p.x > -60 && p.y < H + 40);
      const vg = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .45, Math.max(W, H) * .8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${.35 + .3 * dusk})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    return { init, draw, wet: false };
  };

  // ═════════ 光明之路（Shining Road）：穿过云层，飞向宇宙 ═════════
  // 3D 的云。开头在乌云和暴雨里摸索方向，镜头左右张望，闪电在云里亮起；
  // 「もっと遠くまで」开始往上爬，「さあ、行こう！」冲出云层，夕阳下的云海；
  // 「空はまだ開いている！」光炸开；「高く、高く」抬头往上；第二次副歌穿过一道彩虹；
  // 最后越过强风一路往上，天变黑、地平线弯成弧形、满天星星——自由
  SCENES.skyflight = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const TL = song.tl || {};
    const tPre = TL.pre ?? 47, tGo = TL.go ?? 57, tSky = TL.sky || [78, 150], tHigh = TL.high ?? 125, tRb = TL.rb ?? 152, tSpace = TL.space ?? 172, tEnd = TL.end ?? 207;
    const TOP = 3;
    let gl, prog, cv, U = {}, ok = false, lastNow = 0, beatE = 0, kick = 0, rain = [], zTab = null;
    // 闪电：只在暴雨段，时间固定（拖进度条也一样）
    const BOLTS = []; { let t = 3.2, k = 1; while (t < tGo - 4) { BOLTS.push([t, k]); const r = Math.sin(k * 91.3) * 43758.5; t += 3 + 5 * (r - Math.floor(r)); k++; } }
    const FS = `precision highp float;
uniform vec2 R; uniform float T,storm,space,flash,cov,rbA,burst,fade,curv,glare; uniform sampler2D NZ;
uniform vec3 CP,CF,CR,CU,LP,SUN,RB;
float noise(vec3 x){vec3 p=floor(x),f=fract(x);f=f*f*(3.-2.*f);vec2 uv=(p.xy+vec2(37.,17.)*p.z)+f.xy;vec2 rg=texture2D(NZ,(uv+.5)/256.).yx;return mix(rg.x,rg.y,f.z);}
float map(vec3 p,float t){
  vec2 dh=p.xz-CP.xz; float y=p.y+dot(dh,dh)*curv;
  if(y<0.||y>${TOP}.) return 0.;
  vec3 q=p*vec3(.42,.55,.42)+vec3(T*.04,-T*.01,T*.015);
  float f=.5*noise(q); q=q*2.03; f+=.25*noise(q); q=q*2.01;
  float l1=1.-smoothstep(18.,55.,t), l2=1.-smoothstep(6.,22.,t);
  f+=.125*noise(q)*l1+.0625*(1.-l1); q=q*2.02; f+=.045*noise(q)*l2+.022*(1.-l2);
  float h=y/${TOP}.;
  float d=clamp((f-(1.-cov)-.42*h*h)*3.2,0.,1.)*smoothstep(0.,.35,y)*smoothstep(${TOP}.,${TOP}.-.25,y);
  return d*mix(1.,smoothstep(.9,2.6,length(p-CP)),storm);
}
float h31(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
vec3 sky(vec3 rd){
  float sd=max(dot(rd,SUN),0.);
  vec3 c=mix(vec3(1.,.56,.32),vec3(.36,.36,.68),smoothstep(-.02,.35,rd.y));
  c=mix(c,vec3(.14,.15,.36),smoothstep(.3,.95,rd.y));
  c+=vec3(1.,.55,.25)*pow(sd,6.)*.32+vec3(1.,.75,.45)*pow(sd,40.)*.35*(1.+glare)+vec3(1.,.85,.6)*pow(sd,700.)*1.2*(1.+.5*glare)+vec3(1.,.93,.78)*smoothstep(.99988,.99993,sd)*2.2*(1.-space);
  vec3 st=mix(vec3(.05,.055,.07),vec3(.1,.11,.14),smoothstep(-.3,.6,rd.y));
  c=mix(c,st,storm);
  // 宇宙：黑色的天、星星、地球边缘那一圈蓝色的大气
  float kd=max(CP.y-${TOP}.,.01)*curv*4.; float dip=sqrt(kd/(1.+kd));
  float e=rd.y+dip;
  vec3 s=vec3(.004,.006,.014);
  vec3 g=rd*260.; vec3 cl=floor(g); float hs=h31(cl);
  if(hs>.985){ vec3 o=g-cl-.5; float st2=smoothstep(.22,.0,length(o))*(hs-.985)*70.; s+=vec3(.9,.92,1.)*st2*(.6+.4*sin(T*2.+hs*90.)); }
  s+=vec3(.3,.55,1.)*exp(-max(e,0.)*22.)*.75+vec3(.4,.6,1.)*exp(-max(e,0.)*6.)*.12;
  s+=vec3(1.,.9,.75)*(pow(sd,300.)*.7+pow(sd,14.)*.06)+vec3(1.)*smoothstep(.99988,.99993,sd)*4.;
  c=mix(c,mix(vec3(.1,.17,.42),vec3(.25,.4,.75),exp(-max(rd.y+dip,0.)*5.)),smoothstep(0.,.55,space));
  return mix(c,s,smoothstep(.3,1.,space));
}
vec3 rainbow(float x){ // x: 0 内侧(紫) → 1 外侧(红)
  vec3 c=.5+.5*cos(6.2832*(vec3(0.,.33,.67)-x*.85+.05));
  return c*smoothstep(0.,.18,x)*smoothstep(1.,.82,x);
}
void main(){
  vec2 fc=gl_FragCoord.xy; vec2 uv=(fc-.5*R)/R.y;
  vec3 rd=normalize(CF*1.25+uv.x*CR+uv.y*CU), ro=CP;
  vec3 bg=sky(rd);
  // 云层的进入、离开距离（带一点地球的弧度）
  float a=max((1.-rd.y*rd.y)*curv,1e-7), b=rd.y, t0=0., t1=0.; bool hitB=false; float farHit=-1.;
  float far=mix(110.,16.,storm)*(1.-.85*space);
  { float c=ro.y-${TOP}.; float D=b*b-4.*a*c; float rT1=1e9,rT2=1e9;
    if(D>=0.){ float s=sqrt(D); float q=-.5*(b+(b<0.?-s:s)); float r1=q/a,r2=c/q; rT1=min(r1,r2); rT2=max(r1,r2); }
    float c2=ro.y; float D2=b*b-4.*a*c2; float rB=1e9;
    if(D2>=0.){ float s=sqrt(D2); float q=-.5*(b+(b<0.?-s:s)); float r1=q/a,r2=c2/q; float m=min(r1,r2); rB=m>0.?m:max(r1,r2); if(rB<0.)rB=1e9; }
    if(ro.y>${TOP}.){ if(rT1>0.&&rT1<1e8){ t0=rT1; t1=min(rB,rT2); if(t0>=far) farHit=t0; } else { t0=1.; t1=0.; } }
    else { t0=0.; t1=min(rT1>0.?rT1:rT2, rB); }
    hitB=rB<=t1&&rB<far; t1=min(t1,far);
  }
  vec4 sum=vec4(0.); float Trb=1., tp=rd.z>0.?(RB.z-ro.z)/rd.z:-1.;
  if(tp<t0) Trb=1.;
  if(t1>t0){
    float t=t0+max(.09,.055*t0)*h31(vec3(fc,3.7)); float dt;
    vec3 shadeD=mix(vec3(.34,.30,.52),vec3(.07,.075,.09),storm), shadeL=mix(vec3(1.,.74,.5),vec3(.34,.36,.42),storm);
    shadeL=mix(shadeL,vec3(1.,.97,.92),space*.6);
    for(int i=0;i<84;i++){
      if(sum.a>.985||t>t1) break;
      vec3 p=ro+rd*t; float d=map(p,t);
      dt=max(.08,.042*t);
      if(tp>0.&&t<tp) Trb=1.-sum.a;
      if(d>.01){
        float dl=map(p+SUN*.6,t);
        float dif=clamp((d-dl)/.8,0.,1.);
        float hy=clamp(p.y/${TOP}.,0.,1.);
        vec3 lin=mix(vec3(.5,.48,.7),vec3(.2,.21,.26)+vec3(.5,.52,.6)*hy*hy,storm)+dif*shadeL*1.7;
        vec3 col=mix(shadeL*.9+.2,shadeD,smoothstep(0.,1.,d))*lin;
        col+=vec3(1.,.7,.4)*pow(max(dot(rd,SUN),0.),6.)*(1.-d)*.45*(1.-storm);
        col+=vec3(.75,.8,1.)*flash*3.*exp(-length(p-LP)*.55);
        col=mix(col,bg,1.-exp(-t*mix(.012,.0035,space)));
        float al=1.-exp(-d*dt*mix(4.,3.,storm));
        sum+=vec4(col*al,al)*(1.-sum.a);
      }
      t+=dt;
    }
    if(tp>0.&&t<tp) Trb=1.-sum.a;
    // 下面是看不到底的云海：没画满的地方用云的底色补上
    if(hitB&&t>=t1){ vec3 fl=mix(mix(vec3(.62,.46,.5),vec3(.06,.065,.08),storm),bg,1.-exp(-t1*mix(.012,.0035,space))); sum.rgb+=fl*(1.-sum.a); sum.a=1.; }
  }
  // 太远、来不及一步步算的云海：直接用远处云的颜色，盖上一层大气的蓝
  if(farHit>0.){ vec3 hp=ro+rd*farHit; vec2 hq=hp.xz*.06; float cn=.5*noise(vec3(hq,1.))+.25*noise(vec3(hq*2.1,5.))+.15*noise(vec3(hq*4.3,9.));
    vec3 ec=(.55+.75*smoothstep(.35,.75,cn))*mix(vec3(.82,.74,.78),vec3(1.05,1.08,1.15),space)*(.55+.45*smoothstep(-.2,.6,dot(normalize(vec3(rd.x,0.,rd.z)),normalize(vec3(SUN.x,0.,SUN.z)))));
    ec=mix(ec,mix(bg,vec3(.35,.55,1.)*.75,space),1.-exp(-farHit*mix(.012,.0022,space))); sum.rgb+=ec*(1.-sum.a); sum.a=1.; }
  vec3 col=bg*(1.-sum.a)+sum.rgb;
  // 彩虹：一道很大的圆弧，立在前面的云海上，越飞越近，从身边穿过去
  if(rbA>0.&&tp>.2){
    vec3 hp=ro+rd*tp; float r=length(hp.xy-RB.xy);
    float x=(r-2.)/.75;
    if(x>0.&&x<1.) col+=rainbow(x)*.42*rbA*Trb*smoothstep(.2,2.5,tp)*smoothstep(${TOP}.-.6,${TOP}.+.4,hp.y);
  }
  col+=vec3(.85,.88,1.)*flash*.12*storm;
  col+=vec3(1.,.85,.62)*burst*.35;
  col=1.-exp(-col*1.25);
  col+=(h31(vec3(fc,fract(T*7.)*13.))-.5)*.012;
  float vg=1.-.28*dot(uv*.85,uv*.85);
  gl_FragColor=vec4(clamp(col*vg,0.,1.)*fade,1.);
}`;
    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      gl = cv.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["R", "T", "storm", "space", "flash", "cov", "rbA", "burst", "fade", "curv", "glare", "NZ", "CP", "CF", "CR", "CU", "LP", "SUN", "RB"]) U[k] = gl.getUniformLocation(prog, k);
      // 噪声贴图：G 通道是 R 通道错开 (37,17) 的拷贝，用来做便宜的 3D 噪声
      const N = 256, r = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) r[i] = Math.random() * 256 | 0;
      const px = new Uint8Array(N * N * 4);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; px[i] = r[y * N + x]; px[i + 1] = r[((y - 17) & 255) * N + ((x - 37) & 255)]; px[i + 3] = 255; }
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      // 飞行的距离：按速度积分好，拖进度条也能直接查到
      zTab = new Float32Array(Math.ceil(tEnd * 4) + 40); let z = 0;
      for (let i = 0; i < zTab.length; i++) { zTab[i] = z; z += speed(i / 4) / 4; }
      return (ok = true);
    }
    function speed(t) { return .55 + .45 * sm(tPre - 2, tGo, t) + 1.4 * sm(tGo - 1, tGo + 4, t) + .7 * sm(tSky[0] - 1, tSky[0] + 2, t) * (1 - sm(tSky[0] + 8, tSky[0] + 14, t)) + .6 * sm(tHigh - 2, tHigh + 3, t) + 3 * sm(tSpace, tSpace + 12, t) * (1 - .7 * sm(tEnd - 20, tEnd - 4, t)); }
    const zAt = t => { if (!zTab) return 0; const i = Math.max(0, t * 4), j = Math.min(zTab.length - 2, i | 0); return zTab[j] + (zTab[j + 1] - zTab[j]) * (i - j); };
    const xAt = t => .9 * Math.sin(t * .045) + .4 * Math.sin(t * .11 + 2);
    const alt = t => 1.4 + .25 * Math.sin(t * .37) * (1 - sm(tPre, tGo, t)) + 2.35 * sm(tPre - 1, tGo + .5, t) + .3 * Math.sin(t * .21) * sm(tGo, tGo + 6, t)
      + 1.3 * sm(tHigh - 1, tHigh + 5, t) * (1 - sm(tHigh + 12, tHigh + 22, t)) + 110 * Math.pow(sm(tSpace, tEnd - 6, t), 1.7);
    function init() { rain = []; }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      const cssW = document.documentElement.clientWidth || innerWidth, cssH = innerHeight;
      const k = Math.min(Math.min(window.devicePixelRatio || 1, 2), Math.sqrt(360000 / (cssW * cssH))), w = Math.round(cssW * k), h = Math.round(cssH * k);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const bs = window.__bass || 0; beatE += (bs - beatE) * .1; kick = Math.max(kick * .86, playing ? Math.max(0, bs - beatE) * 2 : 0);
      const storm = 1 - sm(tGo - 5, tGo + 2, now), space = sm(tSpace + 6, tEnd - 12, now);
      // 镜头：暴雨里左右张望、颠簸；冲出云层后平稳；「高く」时抬头；最后看向地平线和星空
      const search = 1 - sm(tPre, tGo, now);
      const yaw = (.42 * Math.sin(now * .13) + .22 * Math.sin(now * .29 + 1.3)) * search + .07 * Math.sin(now * .05) * (1 - search) * (1 - sm(tRb - 8, tRb - 4, now) * (1 - sm(tRb + 2, tRb + 6, now)));
      const shake = storm * (.012 + .02 * kick);
      const pitch = .02 + .16 * sm(tPre, tGo - 2, now) * (1 - sm(tGo, tGo + 4, now)) - .07 * sm(tGo, tGo + 5, now) + .4 * sm(tHigh - .5, tHigh + 3, now) * (1 - sm(tHigh + 8, tHigh + 15, now))
        + .12 * sm(tSpace - 2, tSpace + 6, now) * (1 - sm(tSpace + 14, tSpace + 24, now)) - .34 * sm(tSpace + 4, tEnd - 10, now) + shake * Math.sin(now * 23);
      const roll = .07 * Math.sin(now * .31) * storm - .35 * (.42 * .13 * Math.cos(now * .13) + .22 * .29 * Math.cos(now * .29 + 1.3)) * search * 6 * .25 + .04 * Math.sin(now * .09) * (1 - storm) + shake * Math.sin(now * 31);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const F = [sy * cp, sp, cy * cp], R0 = [cy, 0, -sy], U0 = [-sy * sp, cp, -cy * sp];
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const Rr = R0.map((v, i) => v * cr + U0[i] * sr), Ur = U0.map((v, i) => -R0[i] * sr + v * cr);
      // 闪电
      let flash = 0, LP = [0, 1.5, 0];
      for (const [t, k2] of BOLTS) { const a = now - t; if (a >= 0 && a < 1.2) { const f = a < .08 ? 1 : a < .16 ? .25 : a < .26 ? .85 : Math.exp(-(a - .26) * 6) * .6; flash = Math.max(flash, f * (.6 + .4 * Math.abs(Math.sin(k2 * 7.1))));
        LP = [xAt(now) + Math.sin(k2 * 3.7) * 5, 1 + Math.abs(Math.sin(k2 * 5.3)) * 1.6, zAt(now) + 4 + Math.abs(Math.sin(k2 * 2.3)) * 7]; } }
      let burst = 0; for (const t of tSky) { const a = now - t; if (a >= 0 && a < 6) burst = Math.max(burst, Math.exp(-a * 1.1)); }
      const glare = 1.5 * burst + .4 * kick * (1 - storm);
      const sunY = -.02 + .13 * sm(tGo - 3, tGo + 25, now) - .03 * space;
      const S = [-.28, sunY, 1], sl = Math.hypot(...S); S.forEach((v, i) => (S[i] = v / sl));
      const rbA = sm(tRb - 16, tRb - 9, now) * (1 - sm(tRb + .5, tRb + 2.5, now));
      const cov = .6 - .04 * storm - .04 * sm(tGo, tGo + 10, now) + .03 * space;
      const fade = Math.min(1, .3 + now / 2.5) * (1 - .55 * sm(tEnd - 3, tEnd + 1, now));
      gl.uniform2f(U.R, w, h); gl.uniform1f(U.T, now); gl.uniform1f(U.storm, storm); gl.uniform1f(U.space, space); gl.uniform1f(U.flash, flash);
      gl.uniform1f(U.cov, cov); gl.uniform1f(U.rbA, rbA); gl.uniform1f(U.burst, burst); gl.uniform1f(U.fade, fade); gl.uniform1f(U.curv, 1 / 1500); gl.uniform1f(U.glare, glare);
      gl.uniform3f(U.CP, xAt(now), alt(now), zAt(now)); gl.uniform3fv(U.CF, F); gl.uniform3fv(U.CR, Rr); gl.uniform3fv(U.CU, Ur);
      gl.uniform3fv(U.LP, LP); gl.uniform3fv(U.SUN, S); gl.uniform3f(U.RB, xAt(tRb), TOP - .35, zAt(tRb));
      gl.uniform1i(U.NZ, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // ── 暴雨：迎面打过来的雨丝（全分辨率画在上层）──
      if (seek) rain = [];
      const rainAmt = storm * (1 - sm(tPre + 2, tGo - 1, now) * .7);
      const nR = Math.round(260 * rainAmt * Math.min(1.5, W * H / (1400 * 900 * dpr * dpr) + .4));
      while (rain.length < nR) rain.push({ x: (Math.random() - .5) * 14, y: (Math.random() - .5) * 9 + 1, z: .4 + Math.random() * 6 });
      if (rain.length > nR) rain.length = nR;
      if (nR > 0) {
        const f = H * .62, vz = (speed(now) * 2.2 + 1.5), fall = 5.5;
        ctx.save(); ctx.lineCap = "round";
        for (const d of rain) {
          if (playing) { d.z -= vz * dt; d.y -= fall * dt; d.x += .8 * dt; }
          if (d.z < .25 || d.y < -3) { d.x = (Math.random() - .5) * 14; d.y = (Math.random() - .5) * 8 + 2.5; d.z = 3 + Math.random() * 4; continue; }
          const sx = W / 2 + d.x / d.z * f, sy2 = H / 2 - d.y / d.z * f, ex = W / 2 + (d.x - .8 * .05) / (d.z + vz * .05) * f, ey = H / 2 - (d.y + fall * .05) / (d.z + vz * .05) * f;
          const a = Math.min(.45, .7 / d.z) * rainAmt * (1 + 1.5 * flash);
          ctx.strokeStyle = `rgba(200,210,230,${a})`; ctx.lineWidth = Math.max(.7, 1.6 / d.z) * dpr;
          ctx.beginPath(); ctx.moveTo(sx, sy2); ctx.lineTo(ex, ey); ctx.stroke();
        }
        ctx.restore();
      }
    }
    return { init, draw, wet: false };
  };


  // ═════════ この季節の終わり：写给过去、现在和未来的自己 ═════════
  // 背景：海边山坡上一棵孤零零的树，前面是一丛白百合（和封面里他手上的花一样），远处是海。
  // 季节跟着歌词走：开头是夏天「残酷な日差し」刺眼的阳光、地面的热浪；
  // 「夏も冬も秋も過ぎて、美しい春が」时，树、天、地面、飘落的东西跟着转一圈：夏 → 冬 → 秋 → 春；
  // 「光と海がひとつに溶ける」光把画面融成一片；「氷のように冷たくて」冬天，霜从四周爬进来；
  // 「静けさの中で終わる」雪静静地下；「何を失くしたのかさえ忘れてゆく」画面一块块褪成空白（秋天）；
  // 「それでも涙だけは」眼泪一样的水珠顺着屏幕往下流；最后停在春天。
  // 封面里：把他从黑底里抠出来，身后是这片风景（褪了色、像回忆），再叠两个放大的、半透明的他。
  SCENES.summerend = (song) => {
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const TL = song.tl || {};
    const env = (L, t, fi = 1, fo = 1.5) => { let v = 0; for (const [a, b] of L || []) v = Math.max(v, sm(a - fi, a + fi, t) * (1 - sm(b - fo, b + fo, t))); return v; };
    // 季节关键帧 [时间, 季节, 过渡秒数]：0 夏 1 秋 2 冬 3 春
    const KEYS = [[0, 0, 1]];
    for (const [s0, w0, a0, h0] of TL.seasons || []) KEYS.push([s0, 0, 1.2], [w0, 2, 1.4], [a0, 1, 1.4], [h0, 3, 1.6]);
    for (const k of TL.sk || []) KEYS.push(k);
    KEYS.sort((a, b) => a[0] - b[0]);
    function seasonW(t) {
      let w = [1, 0, 0, 0];
      for (const [kt, s, d] of KEYS) { const f = sm(kt - d, kt, t); if (f <= 0) break; w = w.map((v, i) => v * (1 - f) + (i === s ? f : 0)); }
      return w;
    }
    const HZ = .5;
    const groundV = (u) => .28 + .30 * (1 - sm(-.05, .62, u));
    let gl, prog, cv, U = {}, ok = false, lastNow = 0, CX = .5;
    let fall = [], tears = [], spr = { petal: [], pink: [], leaf: [] }, flake;
    let tree = null, lily = null, treeKey = "", lilyKey = "";

    const FS = `precision highp float;
uniform vec2 R; uniform float T,su,au,wi,sp,heat,melt,cold,quiet,forget,fade,sat,pale,CX;
const float HZ=.5;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
float fb3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s/.875;}
float ground(float u){
  float k=clamp((u+.05)/.67,0.,1.); k=k*k*(3.-2.*k);
  return .28+.30*(1.-k)+.010*(vn(vec2(u*9.,1.))-.5)+.0035*(vn(vec2(u*45.,2.))-.5);
}
void main(){
  vec2 fc=gl_FragCoord.xy, q=fc/R; float ar=R.x/R.y, px=1./R.y;
  float u=CX+(q.x-.5)*ar/1.7778, v=q.y;
  // 夏天的热浪：地面附近的空气在扭
  float hw=heat*su*.0022*smoothstep(.62,.3,v);
  u+=(fb3(vec2(u*30.,v*22.-T*1.4))-.5)*hw; v+=(fb3(vec2(u*24.+3.,v*18.-T*1.1))-.5)*hw;
  vec3 skyTop=su*vec3(.15,.36,.70)+au*vec3(.27,.30,.45)+wi*vec3(.47,.52,.59)+sp*vec3(.38,.55,.80);
  vec3 skyHz =su*vec3(.80,.87,.93)+au*vec3(.97,.74,.50)+wi*vec3(.78,.80,.83)+sp*vec3(.95,.86,.87);
  vec2 sunP=su*vec2(.80,.88)+au*vec2(.80,.565)+wi*vec2(.70,.80)+sp*vec2(.74,.82);
  vec3 sunC=su*vec3(1.,.95,.82)+au*vec3(1.,.70,.40)+wi*vec3(.92,.94,.97)+sp*vec3(1.,.91,.86);
  float sunI=su*(1.+.4*heat)+au*.95+wi*.22+sp*.7;
  float sd=length((vec2(u,v)-sunP)*vec2(1.7778,1.));
  float g=ground(u);
  vec3 c;
  if(v>HZ){
    // ── 天空 ──
    float tv=clamp((v-HZ)/(1.-HZ),0.,1.);
    c=mix(skyHz,skyTop,pow(tv,.6));
    c+=sunC*(exp(-sd*4.)*.30+exp(-sd*22.)*.35)*sunI;
    c=mix(c,vec3(1.,.99,.96)*1.25,smoothstep(.026,.021,sd)*min(1.,sunI)*(1.-.7*wi));
    // 云：靠近地平线压扁
    float cov=su*.34+au*.46+wi*.62+sp*.42;
    vec2 cp=vec2(u*1.7+T*.004,(v-HZ)*4.2/(.3+tv))+vec2(0.,2.);
    float cn=fbm(cp);
    float cd=smoothstep(1.-cov,1.-cov+.22,cn)*smoothstep(HZ-.01,HZ+.04,v);
    vec2 sdir=normalize(sunP-vec2(u,v)+1e-4);
    float lit=clamp(.55+(cn-fbm(cp+sdir*vec2(.25,.6)))*3.,0.,1.)*(1.-.5*wi)+.5*wi;
    vec3 cs=mix(mix(skyTop,skyHz,.45)*.85+vec3(.08),vec3(.55,.57,.61),wi*.6);
    vec3 cl=mix(vec3(.98),sunC,.35+.3*au);
    c=mix(c,mix(cs,cl,lit),cd*.92);
    c+=sunC*exp(-sd*9.)*cd*.25*sunI;
    // 远处的岛
    float ih=.016*smoothstep(.84,.95,u)*smoothstep(1.25,1.05,u)*(.6+.4*vn(vec2(u*28.,3.)))+.006*smoothstep(-.3,-.1,u)*smoothstep(.1,-.05,u);
    if(v<HZ+ih&&v>=HZ) c=mix(c,mix(skyHz,skyTop,.5)*.85,.55);
  } else {
    // ── 海 ──
    float dz=HZ-v+.003, z=1./dz;
    vec3 deep=su*vec3(.04,.20,.36)+au*vec3(.10,.13,.22)+wi*vec3(.17,.21,.26)+sp*vec3(.08,.24,.36);
    c=mix(mix(skyHz,deep,.6),deep,smoothstep(0.,.05,dz));
    c+=skyHz*.10*smoothstep(.04,0.,dz);
    float wn=fb3(vec2(u*1.78*z*.35,z*.9+T*.12));
    c*=.9+.22*wn;
    float col=exp(-pow((u-sunP.x)*1.7778*(3.+z*.02),2.));
    float gl=pow(vn(vec2(u*1.78*z*2.2,z*3.5+T*1.3)),9.)*col;
    c+=sunC*gl*(1.2+1.5*heat+2.5*melt)*min(1.,sunI);
    c+=sunC*col*.10*sunI*smoothstep(.06,0.,dz);
  }
  if(v<=g+px*1.5){
    // ── 地面：草坡 / 雪坡 ──
    float e=max(0.,g-v);
    vec3 gb=su*vec3(.42,.50,.21)+au*vec3(.58,.43,.21)+wi*vec3(1.,1.,1.)+sp*vec3(.40,.57,.26);
    float patch=mix(fbm(vec2(u*5.,v*13.)),.6,wi*.6);
    float gs=fb3(vec2(u*1.78*260.,v*38.));
    float wl=fb3(vec2(u*3.2-T*.10,v*9.+T*.02));
    float tex=(.78+.36*patch)*(.84+.32*gs*(1.-wi))*(.88+.24*wl*(1.-.8*wi));
    vec3 gc=gb*tex;
    gc=mix(gc,gc*vec3(.82,.88,1.05),wi*smoothstep(.0,.3,e));            // 雪的阴影偏蓝
    gc*=mix(1.,mix(.55,.85,wi),smoothstep(0.,.33,e));                                // 越靠近自己越暗
    gc+=sunC*.14*exp(-e*70.)*sunI;                                       // 坡顶被光勾一道边
    gc=mix(gc,mix(skyHz,gc,.6),exp(-e*25.)*.35);                         // 远处的空气
    // 草里星星点点的白花（冬天被雪盖住），春天多一些淡粉和黄
    vec2 fcell=vec2(u*1.78,v)*R.y/3.2, fp=floor(fcell);
    float fl=step(.993-.006*sp-.002*su,h21(fp))*(1.-wi)*smoothstep(.0,.04,e)*smoothstep(.5,.3,length(fract(fcell)-.5));
    vec3 fcol=mix(vec3(.96,.95,.92),h21(fp+7.)>.5?vec3(.98,.80,.86):vec3(.98,.92,.62),sp*.6);
    gc=mix(gc,fcol*(.7+.3*(1.-smoothstep(0.,.3,e))),fl*.85);
    // 雪地里一闪一闪
    gc+=vec3(1.)*step(.997,h21(floor(fc/1.5)+floor(T*3.)))*wi*.35;
    c=mix(c,gc,smoothstep(g+px*1.2,g-px*1.2,v));
  }
  float l=dot(c,vec3(.299,.587,.114));
  // 夏天的阳光把画面晒得发白；光和海融在一起
  c=mix(c,1.-(1.-c)*(1.-c),heat*su*.25);
  c+=vec3(1.,.97,.92)*melt*(.22+.5*smoothstep(.4,1.,l));
  // 冷：颜色被抽走；霜从四周爬进来
  if(cold>0.){
    c=mix(c,vec3(l)*vec3(.74,.87,1.1)+vec3(0.,.02,.05),cold*.7);
    vec2 e2=q-.5; float ed=length(e2*vec2(ar/1.6,1.))*1.35;
    float fr=fbm(q*vec2(ar,1.)*5.)*.6+fbm(q*vec2(ar,1.)*22.)*.4;
    float frost=smoothstep(1.05-cold*.3,1.2-cold*.3,ed+fr*.35)*cold;
    float cr=fbm(q*vec2(ar,1.)*60.);
    c=mix(c,vec3(.84,.91,1.)*(.8+.35*cr),frost*.7);
    c+=vec3(.85,.93,1.)*pow(cr,8.)*frost*.4;
  }
  float ll=dot(c,vec3(.299,.587,.114)); c=mix(vec3(ll),c,sat*(1.-.55*quiet));
  if(forget>0.){
    float fm=fbm(q*vec2(ar,1.)*3.2+vec2(0.,T*.01));
    float gone=smoothstep(fm-.14,fm+.14,forget*.7);
    c=mix(c,vec3(.93,.92,.9)*(.92+.08*fm),min(1.,forget*.35+gone*.6));
  }
  c=mix(c,vec3(.95,.94,.92),pale);
  vec2 e=q-.5; c*=1.-.28*dot(e,e)*(1.+quiet);
  c*=.84-.2*smoothstep(.45,1.,1.-q.y);                    // 压暗一点，标题和歌词才看得清
  c+=(h21(fc+fract(T*13.)*71.)-.5)*.016;
  gl_FragColor=vec4(clamp(c,0.,1.)*fade,1.);
}`;

    // ───── 小图：花瓣、落叶、雪 ─────
    function petalSprite(tint) {
      const c = document.createElement("canvas"); c.width = 40; c.height = 26; const g = c.getContext("2d");
      const gr = g.createLinearGradient(0, 13, 40, 13); gr.addColorStop(0, `rgba(${tint},.95)`); gr.addColorStop(1, `rgba(${tint},.6)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(2, 13); g.bezierCurveTo(10, 0, 30, 2, 38, 11); g.bezierCurveTo(36, 13, 36, 14, 38, 16); g.bezierCurveTo(30, 24, 10, 26, 2, 13); g.fill();
      g.strokeStyle = "rgba(190,175,170,.35)"; g.lineWidth = .8; g.beginPath(); g.moveTo(3, 13); g.lineTo(32, 13); g.stroke();
      return c;
    }
    function leafSprite(col) {
      const c = document.createElement("canvas"); c.width = 44; c.height = 28; const g = c.getContext("2d");
      g.fillStyle = `rgb(${col})`; g.beginPath(); g.moveTo(3, 14); g.bezierCurveTo(12, 1, 32, 2, 41, 14); g.bezierCurveTo(32, 26, 12, 27, 3, 14); g.fill();
      g.strokeStyle = "rgba(60,30,10,.45)"; g.lineWidth = 1; g.beginPath(); g.moveTo(1, 14); g.lineTo(38, 14); g.stroke();
      g.globalCompositeOperation = "source-atop"; const sh = g.createLinearGradient(0, 0, 0, 28); sh.addColorStop(0, "rgba(255,240,200,.25)"); sh.addColorStop(1, "rgba(40,15,0,.3)"); g.fillStyle = sh; g.fillRect(0, 0, 44, 28);
      return c;
    }
    function flakeSprite() {
      const c = document.createElement("canvas"); c.width = c.height = 16; const g = c.getContext("2d");
      const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(.45, "rgba(250,252,255,.7)"); gr.addColorStop(1, "rgba(240,246,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 16, 16); return c;
    }

    // ───── 树：一次生成，按季节画成几张图，播放时按比例叠 ─────
    function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
    function buildTree(Hpx) {
      const r = rng(20261018), unit = Hpx;          // 1 = 屏幕高度
      const segs = [], tips = [];
      function br(x, y, a, len, w, d) {
        const bend = (r() - .5) * .3, mx = x + Math.sin(a + bend) * len * .5, my = y - Math.cos(a + bend) * len * .5;
        const ex = x + Math.sin(a) * len, ey = y - Math.cos(a) * len;
        segs.push({ x, y, mx, my, ex, ey, w0: w, w1: w * .78, d });
        if (d >= 8 || len < .01) { tips.push([ex, ey, d]); return; }
        if (d >= 4) tips.push([mx, my, d]);
        // 主枝继续往前走，旁边分出一两根侧枝；越往上越往外摊开
        const up = -a * .4;
        br(ex, ey, a + up + (r() - .5) * .35, len * (.78 + r() * .1), w * .78, d + 1);
        const side = (d + (r() < .25 ? 1 : 0)) % 2 ? 1 : -1, ns = d < 1 ? 0 : (r() < .45 ? 2 : 1);
        for (let i = 0; i < ns; i++) {
          const sgn = i === 0 ? side : -side;
          br(ex, ey, a + sgn * (.55 + r() * .45), len * (.62 + r() * .14), w * .6, d + 1);
        }
      }
      br(0, 0, .03, .12, .022, 0);
      // 范围
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const s of segs) { x0 = Math.min(x0, s.ex, s.x); x1 = Math.max(x1, s.ex, s.x); y0 = Math.min(y0, s.ey, s.y); y1 = Math.max(y1, s.ey, s.y); }
      const pad = .07; x0 -= pad; x1 += pad; y0 -= pad; y1 += .02;
      const cw = Math.ceil((x1 - x0) * unit), ch = Math.ceil((y1 - y0) * unit), X = (x) => (x - x0) * unit, Y = (y) => (y - y0) * unit;
      const mk = () => { const c = document.createElement("canvas"); c.width = cw; c.height = ch; return c; };
      // 枝干
      const bc = mk(), bg = bc.getContext("2d");
      const drawBranches = (g, col, top) => {
        for (const s of segs) {
          const ang = Math.atan2(s.ey - s.y, s.ex - s.x), nx = -Math.sin(ang), ny = Math.cos(ang);
          const w0 = s.w0 * unit * .5, w1 = s.w1 * unit * .5;
          g.fillStyle = col; g.beginPath();
          g.moveTo(X(s.x) + nx * w0, Y(s.y) + ny * w0); g.quadraticCurveTo(X(s.mx) + nx * (w0 + w1) / 2, Y(s.my) + ny * (w0 + w1) / 2, X(s.ex) + nx * w1, Y(s.ey) + ny * w1);
          g.lineTo(X(s.ex) - nx * w1, Y(s.ey) - ny * w1); g.quadraticCurveTo(X(s.mx) - nx * (w0 + w1) / 2, Y(s.my) - ny * (w0 + w1) / 2, X(s.x) - nx * w0, Y(s.y) - ny * w0);
          g.closePath(); g.fill();
          if (top) { // 积雪：落在枝条朝上的一侧
            const up = ny < 0 ? 1 : -1, sw = Math.max(.8, w0 * .55);
            if (Math.abs(Math.cos(ang)) > .35 && s.d >= 1) { g.strokeStyle = top; g.lineWidth = sw; g.lineCap = "round"; g.beginPath(); g.moveTo(X(s.x) + nx * w0 * up, Y(s.y) + ny * w0 * up); g.quadraticCurveTo(X(s.mx) + nx * w0 * up, Y(s.my) + ny * w0 * up, X(s.ex) + nx * w1 * up, Y(s.ey) + ny * w1 * up); g.stroke(); }
          }
        }
      };
      drawBranches(bg, "rgb(46,38,34)");
      // 树干上一点光
      const snowC = mk(); drawBranches(snowC.getContext("2d"), "rgba(0,0,0,0)", "rgba(244,247,252,.95)");
      // 叶子 / 花：每个枝头一团小点
      const dots = [];
      const cxm = tips.reduce((a, t) => a + t[0], 0) / tips.length, cym = tips.reduce((a, t) => a + t[1], 0) / tips.length;
      for (const [tx, ty, d] of tips) {
        const term = d >= 8 || segs.length < 0, n = 16, rad = .022;
        for (let i = 0; i < n; i++) {
          const a = r() * 6.283, rr = Math.sqrt(r()) * rad, x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr * .8;
          const lx = (x - cxm) * .8 - (y - cym) * 1.1;                    // 光从右上方来
          dots.push({ x, y, L: Math.max(0, Math.min(1, .5 + lx * 4 + (r() - .5) * .5)), s: .0024 + r() * .0026, a: r() * 3.14, k: r() });
        }
      }
      dots.sort((a, b) => a.L - b.L);
      const pal = {
        0: [[30, 52, 28], [92, 122, 52], [150, 172, 82]],
        1: [[110, 38, 18], [196, 96, 34], [240, 170, 62]],
        3: [[214, 150, 170], [244, 205, 214], [255, 240, 242]],
      };
      const leafC = {};
      for (const k of [0, 1, 3]) {
        const c = mk(), g = c.getContext("2d"), P = pal[k];
        for (const p of dots) {
          if (k === 1 && p.k < .3) continue;
          const t = p.L, A = t < .5 ? P[0] : P[1], B = t < .5 ? P[1] : P[2], f = t < .5 ? t * 2 : t * 2 - 2 + 1;
          const j = (p.k - .5) * 18;
          g.fillStyle = `rgb(${A[0] + (B[0] - A[0]) * f + j | 0},${A[1] + (B[1] - A[1]) * f + j | 0},${A[2] + (B[2] - A[2]) * f + j * .6 | 0})`;
          g.beginPath(); g.ellipse(X(p.x), Y(p.y), p.s * unit * (k === 3 ? .9 : 1.1), p.s * unit * .6, p.a, 0, 6.283); g.fill();
        }
        leafC[k] = c;
      }
      return { bc, snowC, leafC, ox: -x0 * unit, oy: -y0 * unit, w: cw, h: ch, unit, top: y0, cx: cxm, cy: cym };
    }

    // ───── 白百合：前景两丛，跟封面里他手上的花一样 ─────
    function buildLily(Hpx) {
      const S = Math.round(Hpx * .34), c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), r = rng(77);
      const u = S / 100;
      const stems = [[50, 100, 40, 30, -20], [50, 100, 62, 22, 14], [50, 100, 28, 46, -38], [50, 100, 72, 42, 30]];
      // 叶子
      for (let i = 0; i < 9; i++) {
        const bx = 50 + (r() - .5) * 18, len = 30 + r() * 30, a = (r() - .5) * 1.6;
        g.strokeStyle = `rgb(${38 + r() * 20 | 0},${62 + r() * 24 | 0},${36 + r() * 12 | 0})`; g.lineWidth = u * (2.2 + r() * 1.3); g.lineCap = "round";
        g.beginPath(); g.moveTo(bx * u, 100 * u); g.quadraticCurveTo((bx + Math.sin(a) * len * .4) * u, (100 - len * .7) * u, (bx + Math.sin(a) * len) * u, (100 - len * Math.cos(a * .6)) * u); g.stroke();
      }
      const heads = [];
      for (const [x0, y0, x1, y1, ang] of stems) {
        g.strokeStyle = "rgb(56,84,44)"; g.lineWidth = u * 1.3; g.beginPath(); g.moveTo(x0 * u, y0 * u); g.quadraticCurveTo((x0 + x1) / 2 * u, (y0 + y1) / 2 * u + 8 * u, x1 * u, y1 * u); g.stroke();
        heads.push([x1, y1, ang]);
      }
      for (const [hx, hy, ang] of heads) {
        g.save(); g.translate(hx * u, hy * u); g.rotate(ang * 1.9 * Math.PI / 180); g.scale(u * 1.15, u * 1.15);
        // 侧面的百合：细长的花筒，口上张开六片尖花瓣，花瓣尖往外卷；后面的花瓣暗一点
        const petal = (a, len, wid, light, curl) => {
          g.save(); g.translate(0, -8); g.rotate(a);
          const gr = g.createLinearGradient(0, 0, 0, -len);
          gr.addColorStop(0, `rgb(${222 * light | 0},${228 * light | 0},${206 * light | 0})`); gr.addColorStop(.4, `rgb(${246 * light | 0},${245 * light | 0},${238 * light | 0})`); gr.addColorStop(1, `rgb(${252 * light | 0},${251 * light | 0},${247 * light | 0})`);
          g.fillStyle = gr; g.beginPath(); g.moveTo(-wid * .35, 0);
          g.bezierCurveTo(-wid, -len * .45, -wid * .5 + curl * len * .2, -len * .85, curl * len * .32, -len);
          g.bezierCurveTo(wid * .5 + curl * len * .2, -len * .82, wid, -len * .45, wid * .35, 0); g.closePath(); g.fill();
          g.strokeStyle = `rgba(160,166,140,${.5 * light})`; g.lineWidth = .35; g.beginPath(); g.moveTo(0, -.5); g.quadraticCurveTo(curl * len * .05, -len * .6, curl * len * .3, -len * .97); g.stroke();
          g.restore();
        };
        // 花筒
        let tg = g.createLinearGradient(0, 0, 0, -9); tg.addColorStop(0, "rgb(96,126,70)"); tg.addColorStop(.6, "rgb(214,222,196)"); tg.addColorStop(1, "rgb(236,236,228)");
        g.fillStyle = tg; g.beginPath(); g.moveTo(-.8, 0); g.quadraticCurveTo(-1.2, -5, -3, -8.6); g.lineTo(3, -8.6); g.quadraticCurveTo(1.2, -5, .8, 0); g.closePath(); g.fill();
        for (const [a, l] of [[-.5, .74], [.5, .74], [0, .8]]) petal(a, 10.5, 3.4, l, a ? Math.sign(a) : 0);
        // 花蕊
        g.lineWidth = .3; g.strokeStyle = "rgba(150,165,110,.9)";
        for (const a of [-.2, -.07, .07, .2]) { const ex = Math.sin(a) * 10, ey = -8 - Math.cos(a) * 10; g.beginPath(); g.moveTo(0, -7); g.lineTo(ex, ey); g.stroke(); g.fillStyle = "rgb(168,104,52)"; g.beginPath(); g.ellipse(ex, ey, .9, .45, a, 0, 6.283); g.fill(); }
        for (const [a, l] of [[-.95, 1], [.95, 1], [-.25, .97], [.3, .97]]) petal(a, 11, 3.6, l, Math.sign(a));
        g.restore();
      }
      return { c, S };
    }

    function setup() {
      if (cv) return ok;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;background:#000";
      document.body.insertBefore(cv, document.body.firstChild);
      const bd = document.querySelector(".backdrop"); if (bd) bd.style.display = "none";
      for (let i = 0; i < 4; i++) { spr.petal.push(petalSprite("255,250,244")); spr.pink.push(petalSprite("255,214,226")); }
      for (const col of ["196,96,34", "222,140,48", "150,58,26", "176,120,40"]) spr.leaf.push(leafSprite(col));
      flake = flakeSprite();
      gl = cv.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: true });
      if (!gl) return (ok = false);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return (ok = false);
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["R", "T", "su", "au", "wi", "sp", "heat", "melt", "cold", "quiet", "forget", "fade", "sat", "pale", "CX"]) U[k] = gl.getUniformLocation(prog, k);
      return (ok = true);
    }

    // ───── 封面：身后是他自己的那张场景图（夏末的墓园），镜头慢慢移，颜色跟着季节变 ─────
    let cc, ccv, fig, figOK = false, bgi, bgOK = false, gcv, gc, wrapEl, shown = false;
    function coverSetup() {
      if (ccv) return true;
      wrapEl = document.querySelector(".cover-wrap"); if (!wrapEl) return false;
      fig = new Image(); fig.onload = () => (figOK = true); fig.src = `/music/media/${song.id}/figure.webp?r=${song.rev || 0}`;
      bgi = new Image(); bgi.onload = () => (bgOK = true); bgi.src = `/music/media/${song.id}/bg.webp?r=${song.rev || 0}`;
      ccv = document.createElement("canvas");
      ccv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity 1.5s";
      wrapEl.insertBefore(ccv, wrapEl.querySelector(".cover-shade")); cc = ccv.getContext("2d");
      gcv = document.createElement("canvas"); gc = gcv.getContext("2d");
      return true;
    }
    // 从场景图里取一块正方形：cx、cy 是取景中心（0–1），z 越大越近
    function bgSquare(g, S, cx, cy, z) {
      const iw = bgi.naturalWidth, ih = bgi.naturalHeight, sz = Math.min(iw, ih) / z;
      const sx = Math.max(0, Math.min(iw - sz, cx * iw - sz / 2)), sy = Math.max(0, Math.min(ih - sz, cy * ih - sz / 2));
      g.drawImage(bgi, sx, sy, sz, sz, 0, 0, S, S);
    }
    // 季节调色：夏原样，秋偏暖，冬偏冷发灰，春偏粉
    function grade(g, S, P, k) {
      const tints = [[P.au, "rgb(214,128,52)", .30], [P.wi, "rgb(168,186,212)", .42], [P.sp, "rgb(236,170,190)", .24]];
      if (P.wi > .01) { g.globalCompositeOperation = "saturation"; g.globalAlpha = .55 * P.wi * k; g.fillStyle = "#808080"; g.fillRect(0, 0, S, S); }
      for (const [w, c, a] of tints) if (w > .01) { g.globalCompositeOperation = "color"; g.globalAlpha = w * a * k; g.fillStyle = c; g.fillRect(0, 0, S, S); }
      if (P.forget > .01) { g.globalCompositeOperation = "saturation"; g.globalAlpha = .7 * P.forget * k; g.fillStyle = "#808080"; g.fillRect(0, 0, S, S); }
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    }
    function coverDraw(now, P) {
      if (!coverSetup() || !figOK || !bgOK) return;
      const S = Math.min(1100, Math.round(wrapEl.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
      if (!S) return;
      if (ccv.width !== S) { ccv.width = ccv.height = S; gcv.width = gcv.height = S; }
      if (!shown) { shown = true; ccv.style.opacity = "1"; }
      cc.globalCompositeOperation = "source-over"; cc.globalAlpha = 1;
      cc.fillStyle = "#0a0b0d"; cc.fillRect(0, 0, S, S);
      // 1) 身后的场景：从左边的小路慢慢移到右边的墓碑，再回来（约四分钟一个来回）
      const ph = .5 - .5 * Math.cos(now * .026);
      cc.globalAlpha = .62 + .12 * P.melt - .12 * P.quiet;
      bgSquare(cc, S, .3 + .42 * ph, .5, 1.04 + .08 * Math.sin(now * .017));
      cc.globalAlpha = 1; grade(cc, S, P, 1);
      let g = cc.createRadialGradient(S * .5, S * .4, S * .2, S * .5, S * .5, S * .8);
      g.addColorStop(0, "rgba(8,9,11,0)"); g.addColorStop(1, "rgba(8,9,11,.7)"); cc.fillStyle = g; cc.fillRect(0, 0, S, S);
      // 2) 叠影：两边各一个半透明的他，影子里是这张图的另一处（天空和树荫）
      const fw = S * .9, fh = fw * 1.5, fx = (S - fw) / 2, fy = S * .05 + Math.sin(now * .04) * S * .006;
      const ghosts = [
        { s: .74, dx: -.31 + .015 * Math.sin(now * .05), dy: .1 + .008 * Math.sin(now * .07), a: .5, cx: .36 + .05 * Math.sin(now * .019), cy: .28, z: 1.6 },
        { s: .74, dx: .31 + .015 * Math.sin(now * .043 + 2), dy: .1, a: .5, cx: .5 + .05 * Math.sin(now * .023 + 1), cy: .26, z: 1.8 },
      ];
      const ga = (1 - .85 * P.forget) * (1 - .4 * P.quiet);
      if (ga > .01) for (const o of ghosts) {
        gc.globalCompositeOperation = "source-over"; gc.globalAlpha = 1; gc.clearRect(0, 0, S, S);
        bgSquare(gc, S, o.cx, o.cy, o.z); grade(gc, S, P, 1);
        gc.globalCompositeOperation = "destination-in"; gc.globalAlpha = 1;
        const w = fw * o.s, h = w * 1.5; gc.drawImage(fig, S * .5 - w / 2 + o.dx * S, fy + o.dy * S, w, h);
        cc.globalCompositeOperation = "screen"; cc.globalAlpha = o.a * ga; cc.drawImage(gcv, 0, 0);
      }
      cc.globalCompositeOperation = "source-over"; cc.globalAlpha = 1;
      // 3) 他本人：整个上半身在框里，头顶留一点空
      cc.drawImage(fig, fx, fy, fw, fh);
      if (P.pale > .01) { cc.globalAlpha = P.pale * .8; cc.fillStyle = "rgb(236,234,230)"; cc.fillRect(0, 0, S, S); cc.globalAlpha = 1; }
    }

    function init() { fall = []; tears = []; }
    function draw(I, level, fx) {
      if (!setup()) return;
      const now = window.__time || 0, playing = !!window.__playing, prev = lastNow; lastNow = now;
      const dt = Math.min(.1, Math.max(0, now - prev)), seek = Math.abs(now - prev) > .5;
      // 画布：总像素控制在一百四十万左右
      const k = Math.min(1.5, Math.sqrt(1.4e6 / (innerWidth * innerHeight)), window.devicePixelRatio || 1);
      const w = Math.round(innerWidth * k), h = Math.round(innerHeight * k);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      const ar = W / H; CX = ar >= 1.7778 ? .5 : .5 - .2 * Math.min(1, (1.7778 - ar) / 1.2);
      const [su, au, wi, sp] = seasonW(now);
      const heat = env(TL.heat, now, 2, 3), melt = env(TL.melt, now, .8, 2), cold = env(TL.cold, now, .8, 2.5), quiet = env(TL.quiet, now, 1.5, 3);
      const forget = env(TL.forget, now, 3, 4), tearV = env(TL.tears, now, .5, 3);
      const end = TL.end || 243, pale = .45 * sm(end - 12, end - 1, now);
      const sat = 1 - .3 * sm(30, end, now);
      const fade = Math.min(1, .35 + now / 2.5) * (1 - .75 * sm(end - 3, end + .5, now));
      gl.uniform2f(U.R, w, h); gl.uniform1f(U.T, now); gl.uniform1f(U.CX, CX);
      for (const [kk, vv] of [["su", su], ["au", au], ["wi", wi], ["sp", sp], ["heat", heat], ["melt", melt], ["cold", cold], ["quiet", quiet], ["forget", forget], ["fade", fade], ["sat", sat], ["pale", pale]]) gl.uniform1f(U[kk], vv);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // 世界坐标 → 屏幕：横向 1 个单位 = 1.7778 × 屏高
      const sx = (u) => W / 2 + (u - CX) * 1.7778 * H, sy = (v) => H * (1 - v);
      // ── 树 ──
      const key = String(Math.round(H / 40));
      if (key !== treeKey) { treeKey = key; tree = buildTree(H * .76); }
      const tu = .2, base = groundV(tu) - .012, tX = sx(tu), tY = sy(base);
      const sway = .010 * Math.sin(now * .55) + .006 * Math.sin(now * 1.3 + 1) + .004 * level;
      const veil = fade * (1 - .45 * forget) * (1 - .6 * pale);
      ctx.save(); ctx.globalAlpha = veil;
      ctx.setTransform(1, 0, -sway, 1, tX + sway * tY, 0);   // 以树根为轴，上面轻轻晃
      const dx = -tree.ox, dy = tY - tree.oy;
      ctx.drawImage(tree.bc, dx, dy);
      if (wi > .01) { ctx.globalAlpha = veil * wi; ctx.drawImage(tree.snowC, dx, dy); }
      for (const [s, ww] of [[0, su], [1, au], [3, sp]]) if (ww > .01) { ctx.globalAlpha = veil * Math.min(1, ww * 1.15); ctx.drawImage(tree.leafC[s], dx, dy); }
      ctx.restore();
      // ── 前景的白百合 ──
      const lk = String(Math.round(Math.min(H, W * .95) / 40));
      if (lk !== lilyKey) { lilyKey = lk; lily = buildLily(Math.min(H, W * .95) * 1.3); }
      const lA = fade * (1 - .55 * wi) * (1 - .5 * forget) * (1 - .7 * pale);
      for (const [lx, flip, sc, ph] of [[.035, 1, 1, 0], [.97, -1, .82, 2]]) {
        const S = lily.S * sc, bx = W * lx, by = H + S * .06, sw2 = .05 * Math.sin(now * .8 + ph) + .025 * Math.sin(now * 1.9 + ph);
        ctx.save(); ctx.globalAlpha = lA; ctx.translate(bx, by); ctx.scale(flip, 1); ctx.transform(1, 0, -sw2, 1, 0, 0);
        ctx.drawImage(lily.c, -S / 2, -S, S, S); ctx.restore();
      }
      coverDraw(now, { su, au, wi, sp, melt, cold, quiet, forget, pale, level: level || 0, treeX: Math.max(.15, Math.min(.85, (tX + (tree.cx * tree.unit)) / W)) });
      // ── 飘落：夏天几片白花瓣，秋天落叶，冬天下雪，春天粉色花瓣 ──
      if (seek) { fall = []; tears = []; }
      if (playing && !seek) {
        const rate = (1 + 1.5 * level) * (1 - sm(end - 8, end, now));
        const spawn = (r, f) => { const n = r * dt; for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++) fall.push(f()); };
        spawn(rate * (1.2 * su * (1 - .6 * quiet) + 7 * sp), () => ({ t: 0, pink: Math.random() < sp, x: -30, y: H * (.05 + Math.random() * .7), vx: (60 + Math.random() * 80) * dpr, vy: (8 + Math.random() * 22) * dpr, r: Math.random() * 6.28, vr: (Math.random() - .5) * 3, s: (.3 + Math.random() * .45) * dpr, ph: Math.random() * 6.28 }));
        spawn(rate * 3.2 * au, () => ({ t: 1, x: tX + (Math.random() - .3) * tree.w * .9, y: tY - tree.h * (.4 + Math.random() * .5), vx: (20 + Math.random() * 50) * dpr, vy: (35 + Math.random() * 35) * dpr, r: Math.random() * 6.28, vr: (Math.random() - .5) * 4, s: (.35 + Math.random() * .4) * dpr, ph: Math.random() * 6.28, i: Math.random() * 4 | 0 }));
        spawn((22 * wi + 30 * cold) * (1 - .3 * quiet), () => { const z = Math.random(); return { t: 2, x: Math.random() * W * 1.1, y: -10, vx: (8 + 10 * z) * dpr, vy: (22 + 50 * z) * dpr, s: (.25 + z * .75) * dpr, ph: Math.random() * 6.28 }; });
      }
      for (const p of fall) {
        if (playing) {
          const slow = 1 - .5 * quiet;
          if (p.t === 2) { p.x += (p.vx + Math.sin(now * .9 + p.ph) * 14 * dpr) * dt * slow; p.y += p.vy * dt * slow; }
          else { p.x += p.vx * dt * slow; p.y += (p.vy + Math.sin(now * 1.3 + p.ph) * 22 * dpr) * dt * slow; p.r += p.vr * dt * slow; }
        }
        ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = .85 * (1 - .6 * forget) * fade;
        if (p.t === 2) { ctx.drawImage(flake, -8 * p.s, -8 * p.s, 16 * p.s, 16 * p.s); }
        else {
          ctx.rotate(p.r); ctx.scale(p.s, p.s * (.35 + .65 * Math.abs(Math.sin(now * 1.8 + p.ph))));
          if (p.t === 1) ctx.drawImage(spr.leaf[p.i], -22, -14); else ctx.drawImage((p.pink ? spr.pink : spr.petal)[(p.ph * 10 | 0) % 4], -20, -13);
        }
        ctx.restore();
      }
      fall = fall.filter(p => p.x < W + 60 && p.y < H + 40 && p.x > -80);
      // ── 眼泪：屏幕上的水珠，停一下再顺着往下流，留下一道水痕 ──
      if (playing && !seek && tearV > .3 && Math.random() < dt * 2.2 * tearV) tears.push({ x: W * (.15 + Math.random() * .7), y: H * (.05 + Math.random() * .4), r: (3 + Math.random() * 4) * dpr, v: 0, hold: .3 + Math.random() * 1.2, life: 0, trail: [] });
      for (const d of tears) {
        if (playing) { d.life += dt; if (d.life > d.hold) { d.v = Math.min(d.v + 180 * dpr * dt, 160 * dpr); d.y += d.v * dt; d.x += Math.sin(d.y * .02) * .25; if (!d.trail.length || d.y - d.trail[d.trail.length - 1][1] > 3 * dpr) d.trail.push([d.x, d.y]); } }
        const a = Math.min(1, d.life * 5) * Math.max(0, 1 - Math.max(0, d.life - 9) / 3);
        if (d.trail.length > 1) { ctx.strokeStyle = `rgba(225,235,250,${.12 * a})`; ctx.lineWidth = d.r * .6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(d.trail[0][0], d.trail[0][1]); for (const p of d.trail) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        const g = ctx.createRadialGradient(d.x - d.r * .35, d.y - d.r * .4, 0, d.x, d.y, d.r * 1.2);
        g.addColorStop(0, `rgba(255,255,255,${.7 * a})`); g.addColorStop(.3, `rgba(235,242,255,${.15 * a})`); g.addColorStop(.85, `rgba(200,215,235,${.08 * a})`); g.addColorStop(1, `rgba(20,25,35,${.35 * a})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 1.25, 0, 0, 6.283); ctx.fill();
      }
      tears = tears.filter(d => d.y < H + 20 && d.life < 12);
    }
    return { init, draw, wet: false };
  };


  SCENES.none = () => ({ init() {}, draw() {} });

  // ═════════ 引擎 ═════════
  const id = document.body.dataset.song;
  const song = (window.SONGS || []).find(s => s.id === id) || {};
  // 第二层画布：盖在页面最上面（不挡点击），用来画落到掌心的光、拟声词
  const fxc = document.createElement("canvas");
  fxc.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:15";
  document.body.appendChild(fxc);
  const fx = fxc.getContext("2d");
  const scene = (SCENES[song.scene] || SCENES.none)(song);
  function resize() { const cw = document.documentElement.clientWidth || innerWidth;   // 不含滚动条的宽度，画布才不会被横向挤压
    W = cv.width = fxc.width = Math.round(cw * dpr); H = cv.height = fxc.height = Math.round(innerHeight * dpr); scene.init(); }
  addEventListener("resize", resize); resize();

  // 会动的封面：songs.js 里写 coverVideo: "clips/xxx.mp4"，开始播放后封面换成这段循环动画
  let cvid = null;
  if (song.coverVideo) {
    const wrap = document.querySelector(".cover-wrap");
    cvid = document.createElement("video");
    cvid.src = `/music/media/${song.id}/${song.coverVideo}`; cvid.muted = true; cvid.loop = true; cvid.playsInline = true;
    cvid.setAttribute("playsinline", ""); cvid.setAttribute("muted", ""); cvid.preload = "auto";
    cvid.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.5s";
    if (wrap) wrap.insertBefore(cvid, wrap.querySelector(".cover-shade"));
  }
  function updateCoverVideo() {
    if (!cvid) return;
    if (window.__playing) { if (cvid.paused) cvid.play().then(() => (cvid.style.opacity = 1)).catch(() => {}); }
    else if (!cvid.paused) cvid.pause();
  }

  let I = 0, lv = 0, started = false;
  (function loop() {
    const playing = !!window.__playing;
    if (playing) started = true;
    lv += ((window.__level || 0) - lv) * .08;
    // 播放时：雨慢慢下大，副歌更大；暂停时：变成毛毛雨；还没开始：不下
    const target = playing ? Math.min(1, .5 + lv * .9) : started ? .12 : 0;
    I += (target - I) * (target > I ? .006 : .02);
    updateCoverVideo();
    if (scene.wet !== false) document.documentElement.style.setProperty("--wet", I.toFixed(3));
    ctx.clearRect(0, 0, W, H); fx.clearRect(0, 0, W, H);
    if (!reduce) scene.draw(I, lv, fx);
    requestAnimationFrame(loop);
  })();
})();
