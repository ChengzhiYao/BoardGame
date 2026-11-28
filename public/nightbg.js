/* 谜夜动态背景：月夜 + 雾 + 漂浮翻转的游戏卡牌 + 萤火 + 暗处眨眼的眼睛 + 远处闪电。
   纯 2D canvas，手机也流畅；页面隐藏时暂停；尊重“减少动态效果”。
   用法：window.startNightBg(canvas) → 返回 stop() */
(function () {
  var ICONS = [
    { c: '#3f9d8e', p: ['M3 11h18a9 9 0 0 1-18 0z', 'M8 7.5c0-1.5 1-1.5 1-3M12 7.5c0-1.5 1-1.5 1-3M16 7.5c0-1.5 1-1.5 1-3'] }, // 海龟汤
    { c: '#c0453f', p: ['M14.5 3.5l6 6-8.5 8.5-3-3z', 'M9 15l-5.5 5.5M5.5 13.5l5 5'] }, // 剧本杀
    { c: '#4f9a6a', p: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'] }, // 克苏鲁
    { c: '#9a5bc4', p: ['M19.5 13.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z', 'M12 10v3.5l2.5 2M9 2.5h6M12 2.5v3.5'] }, // 血染钟楼
    { c: '#d9a441', p: ['M12 2l9 5v10l-9 5-9-5V7z', 'M12 2L7 11h10zM7 11l5 11 5-11M3 7l4 4M21 7l-4 4'] }, // D&D
    { c: '#5aa0c4', p: ['M2 5.5c3-1 7-1 10 1 3-2 7-2 10-1v13c-3-1-7-1-10 1-3-2-7-2-10-1z', 'M12 6.5v13'] }, // 讲故事
    { c: '#d9668f', p: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z', 'M12 8v4.5M12 15.5v.2'] }, // 真心话
    { c: '#8f7bd6', p: ['M4 20V9l3-5.5 3.5 4h3L17 3.5 20 9v11z', 'M9 13.5h.01M15 13.5h.01M10.5 17h3'] }, // 猫诅咒
  ];


  // 主题:同一套夜景,换天空、月亮、雾、飘落物、闪电、暗处的眼睛。新主题只要往这里加一项。
  // p = 飘的东西:fly 萤火 / snow 雪 / petal 花瓣 / ember 火星 / rain 雨 / bubble 气泡
  var THEMES = {
    night:     { sky: ['#080a16', '#10131e', '#1a1c26', '#0a0b0f'], moon: ['#f6eed6', '#d9cba4'], halo: '230,220,190', fog: '120,150,145', ground: '#040508', star: '#e8e2d0', p: 'fly', pc: '#e7c27a', flash: [18, 22], eyes: '#e04848', cards: 1 },
    snow:      { sky: ['#0b1526', '#1a2840', '#2a3a52', '#0d1420'], moon: ['#f4f8ff', '#c9d6ea'], halo: '200,220,255', fog: '170,190,215', ground: '#060a12', star: '#e6eeff', p: 'snow', pc: '#eef4ff', flash: 0, eyes: 0, cards: 1 },
    sakura:    { sky: ['#1a0f22', '#2e1a34', '#4a2a48', '#140b16'], moon: ['#fff0f4', '#f0c9d6'], halo: '255,200,220', fog: '200,150,180', ground: '#0c060c', star: '#ffe6ef', p: 'petal', pc: '#f5b8cc', flash: 0, eyes: 0, cards: 1 },
    storm:     { sky: ['#05070c', '#0e121c', '#1c2230', '#07080b'], moon: 0, halo: '160,180,220', fog: '110,125,150', ground: '#020305', star: '#9aa6c0', p: 'rain', pc: '#9fb3d6', flash: [5, 8], eyes: '#e04848', cards: 1 },
    bloodmoon: { sky: ['#14060a', '#240a10', '#3a0f14', '#0b0507'], moon: ['#ff9b8a', '#b3271f'], halo: '220,60,50', fog: '150,60,60', ground: '#070203', star: '#f0c8c0', p: 'ember', pc: '#ff7a45', flash: [25, 25], eyes: '#ff3030', cards: 1 },
    abyss:     { sky: ['#02100f', '#06201f', '#0b2a2c', '#020809'], moon: 0, halo: '60,200,190', fog: '40,140,130', ground: '#010405', star: '#7fe0d4', p: 'bubble', pc: '#6fe3d6', flash: 0, eyes: '#5fffe0', cards: 1 },
    // —— 签到背景第二批:每个都带一个独有的场景元素(aurora 极光带 / pumpkins+bat 南瓜灯和蝙蝠 / meteor 流星 / beam 灯塔光柱 / ufo 飞碟 / graves+wisp 墓碑鬼火 / eclipse 日冕 / trails 星轨 / rift 天空裂隙 / city 霓虹楼群)
    aurora:    { sky: ['#030a12', '#081a24', '#10262c', '#04080b'], moon: ['#eef8f4', '#bcd8cc'], halo: '150,230,200', fog: '90,150,150', ground: '#020607', star: '#d8f4ec', p: 'snow', pc: '#dff6ff', pn: [36, 70], flash: 0, eyes: 0, cards: 1, aurora: 1 },
    pumpkin:   { sky: ['#0e0612', '#1e0c1e', '#3a1622', '#0c0507'], moon: ['#ffd08a', '#e0762a'], halo: '255,140,50', fog: '150,80,90', ground: '#060204', star: '#ffd8c0', p: 'bat', pc: '#050205', pn: [8, 14], flash: 0, eyes: '#ffa030', cards: 1, pumpkins: 1 },
    meteor:    { sky: ['#03040c', '#0a0d20', '#141833', '#05060c'], moon: 0, halo: '140,160,255', fog: '90,100,150', ground: '#020308', star: '#e8ecff', p: 'fly', pc: '#bcd0ff', flash: 0, eyes: 0, cards: 1, meteor: 1 },
    harbor:    { sky: ['#070c12', '#0f1820', '#1c2630', '#080b0e'], moon: 0, halo: '220,230,240', fog: '150,165,175', fogK: 1.8, ground: '#030507', star: '#c8d2dc', p: 'rain', pc: '#7f8fa0', pn: [40, 80], flash: 0, eyes: '#e0c060', cards: 1, beam: 1 },
    ufo:       { sky: ['#030a0a', '#07161a', '#0e2426', '#040808'], moon: 0, halo: '140,255,180', fog: '90,150,120', ground: '#010403', star: '#d0ffe8', p: 'fly', pc: '#9dffb0', flash: 0, eyes: 0, cards: 1, ufo: 1 },
    graveyard: { sky: ['#050a0c', '#0a1618', '#122224', '#05090a'], moon: ['#e8f2ee', '#a8c4bc'], halo: '150,220,210', fog: '100,150,150', fogK: 1.4, ground: '#020405', star: '#cfe8e2', p: 'wisp', pc: '#7af0ff', pn: [9, 14], flash: 0, eyes: '#e04848', cards: 1, graves: 1 },
    eclipse:   { sky: ['#07050e', '#100a1c', '#1c1226', '#06050a'], moon: 0, halo: '255,150,80', haloA: '.24', fog: '110,80,120', ground: '#030205', star: '#f0e2ff', p: 'fly', pc: '#ffcf8a', flash: 0, eyes: '#ff5030', cards: 1, eclipse: 1 },
    startrail: { sky: ['#02040a', '#071022', '#0e1a30', '#04060c'], moon: 0, halo: '120,150,220', fog: '80,100,140', ground: '#010207', star: '#e4ecff', p: 'fly', pc: '#9fc4ff', flash: 0, eyes: 0, cards: 1, trails: 1 },
    rift:      { sky: ['#06040e', '#0e0a20', '#1a1230', '#06040a'], moon: 0, halo: '170,120,255', fog: '110,80,170', ground: '#030208', star: '#e0d4ff', p: 'ember', pc: '#c08aff', flash: [9, 9], eyes: '#c08aff', cards: 1, rift: 1 },
    neon:      { sky: ['#06040c', '#120a1e', '#20102a', '#07050a'], moon: 0, halo: '255,60,170', fog: '140,80,160', ground: '#040308', star: '#b8a8d8', p: 'rain', pc: '#b8a8e8', flash: [20, 20], eyes: '#ff3070', cards: 1, city: 1 },
  };
  window.MN_BG_THEMES = THEMES;

  window.startNightBg = function (cv, opts) {
    opts = opts || {};
    var th = THEMES[opts.theme] || THEMES.night;
    var ctx = cv.getContext('2d');
    if (!ctx) return function () {};
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, raf = 0, last = performance.now(), T = 0, running = true;
    var mx = 0, my = 0, tmx = 0, tmy = 0;
    var paths = ICONS.map(function (ic) { return { c: ic.c, p: ic.p.map(function (d) { try { return new Path2D(d); } catch (e) { return null; } }) }; });

    function resize() {
      W = cv.clientWidth || window.innerWidth; H = cv.clientHeight || window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    var small = W < 640;
    var stars = [], cards = [], flies = [], fog = [];
    for (var i = 0; i < (small ? 70 : 140); i++) stars.push({ x: Math.random(), y: Math.random() * 0.65, r: Math.random() * 1.2 + 0.2, tw: Math.random() * 6.28, s: 0.5 + Math.random() * 1.5 });
    var NC = small ? 11 : 16;
    function newCard(init) {
      var z = 0.35 + Math.random() * 0.65; // 深度：越大越近
      return {
        x: Math.random(), y: init ? Math.random() * 1.2 : 1.15 + Math.random() * 0.2, z: z,
        vy: (0.006 + Math.random() * 0.008) * z, sway: Math.random() * 6.28, rot: (Math.random() - 0.5) * 0.5, vr: (Math.random() - 0.5) * 0.08,
        flip: Math.random() * 6.28, vf: 0.25 + Math.random() * 0.35, ic: Math.floor(Math.random() * paths.length),
      };
    }
    for (i = 0; i < NC; i++) cards.push(newCard(true));
    cards.sort(function (a, b) { return a.z - b.z; });
    var NP = th.pn ? th.pn[small ? 0 : 1] : (th.p === 'rain' ? (small ? 90 : 180) : th.p === 'snow' || th.p === 'petal' ? (small ? 60 : 110) : (small ? 26 : 50));
    for (i = 0; i < NP; i++) flies.push({ x: Math.random(), y: 0.45 + Math.random() * 0.55, a: Math.random() * 6.28, s: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28 });
    for (i = 0; i < 5; i++) fog.push({ x: Math.random(), y: 0.62 + i * 0.09, w: 0.9 + Math.random() * 0.6, v: (0.004 + Math.random() * 0.006) * (i % 2 ? 1 : -1), a: 0.05 + Math.random() * 0.05 });

    // 新主题的场景元素(只在对应主题里生成)
    var trails = [], meteors = [], graves = [], blds = [], wins = [], metNext = 1;
    if (th.trails) for (i = 0; i < (small ? 80 : 160); i++) trails.push({ r: 0.03 + Math.pow(Math.random(), 0.8) * 0.8, a: Math.random() * 6.283, len: 0.35 + Math.random() * 0.5, w: 0.5 + Math.random() * 1.1, al: 0.18 + Math.random() * 0.4, c: Math.random() < 0.2 ? '#ffe2b8' : Math.random() < 0.5 ? '#cfe0ff' : '#eef2ff' });
    if (th.meteor) for (i = 0; i < 3; i++) meteors.push({ t: -1, x: 0, y: 0, vx: 0, vy: 0, life: 1, tl: 150 });
    if (th.graves) { var gx = [0.36, 0.44, 0.52, 0.61, 0.69, 0.8, 0.9]; for (i = 0; i < gx.length; i++) graves.push({ x: gx[i] + (Math.random() - 0.5) * 0.03, w: 10 + Math.random() * 8, h: 16 + Math.random() * 16, k: i % 3 === 1 ? 1 : 0, tilt: (Math.random() - 0.5) * 0.18 }); }
    if (th.city) {
      var bx = 0.3;
      while (bx < 1.02) { var bw = 26 + Math.random() * 40, bh = 40 + Math.random() * 110; blds.push({ x: bx, w: bw, h: bh, neon: Math.random() < 0.4 ? (Math.random() < 0.5 ? '#ff3fa4' : '#3ff0ff') : 0, ph: Math.random() * 20 }); bx += (bw + 3 + Math.random() * 8) / Math.max(W, 320); }
      for (i = 0; i < blds.length; i++) for (var wy = 10; wy < blds[i].h - 6; wy += 11) for (var wx = 5; wx < blds[i].w - 6; wx += 8) if (Math.random() < 0.22) wins.push(i, wx, wy, Math.random() < 0.7 ? 0 : 1);
    }
    var pumps = [], riftP = [];
    if (th.pumpkins) { var px0 = [0.34, 0.47, 0.6, 0.83, 0.93]; for (i = 0; i < px0.length; i++) pumps.push({ x: px0[i] + (Math.random() - 0.5) * 0.03, r: 12 + Math.random() * 7, ph: Math.random() * 6.28 }); }
    if (th.rift) { for (i = 0; i <= 12; i++) riftP.push((i % 2 ? 1 : -1) * (0.3 + Math.random() * 0.7) * (1 - Math.abs(i - 6) / 7)); }
    function ridge(X) { var x0 = X + mx * 20; return H * 0.86 - my * 12 - (Math.sin(x0 * 0.011 + 1.3) * 16 + Math.sin(x0 * 0.027) * 9); }

    var eyes = { t: -1, x: 0, y: 0, next: 6 + Math.random() * 8 };
    var flash = { t: -1, next: 14 + Math.random() * 16 };

    function onMove(e) { var p = e.touches ? e.touches[0] : e; tmx = (p.clientX / W - 0.5); tmy = (p.clientY / H - 0.5); }
    function onOrient(e) { if (e.gamma == null) return; tmx = Math.max(-0.5, Math.min(0.5, e.gamma / 60)); tmy = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90)); }
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    function onVis() { running = !document.hidden; if (running) { last = performance.now(); loop(); } else cancelAnimationFrame(raf); }
    document.addEventListener('visibilitychange', onVis);

    function card(c, t) {
      var size = (small ? 46 : 62) * (0.55 + c.z * 0.75);
      var w = size, h = size * 1.45;
      var px = c.x * W + Math.sin(T * 0.3 + c.sway) * 18 * c.z - mx * 40 * c.z;
      var py = c.y * H - my * 30 * c.z;
      var f = Math.cos(c.flip) - 0.35; // <0 看到正面图标（正面时间更长）
      f = Math.max(-1, Math.min(1, f * 1.4));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(c.rot + Math.sin(T * 0.4 + c.sway) * 0.08);
      ctx.scale(Math.max(0.04, Math.abs(f)), 1);
      ctx.globalAlpha = 0.35 + c.z * 0.6;
      var r = 7 * c.z + 3;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -h / 2); ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r); ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r); ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); ctx.closePath();
      var ic = paths[c.ic];
      if (f < 0) {
        // 正面：深色卡面 + 发光的游戏图标
        var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#1b1d25'); g.addColorStop(1, '#101117');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = ic.c; ctx.lineWidth = 1.2; ctx.globalAlpha *= 0.9; ctx.stroke();
        ctx.save(); ctx.translate(-w * 0.36, -w * 0.36); ctx.scale(w * 0.72 / 24, w * 0.72 / 24);
        ctx.shadowColor = ic.c; ctx.shadowBlur = 16; ctx.strokeStyle = ic.c; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (var k = 0; k < ic.p.length; k++) if (ic.p[k]) ctx.stroke(ic.p[k]);
        ctx.restore();
      } else {
        // 背面：暗红卡背 + 月牙纹
        var g2 = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g2.addColorStop(0, '#3a1216'); g2.addColorStop(1, '#1a0b0e');
        ctx.fillStyle = g2; ctx.fill();
        ctx.strokeStyle = 'rgba(217,164,65,.55)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, w * 0.2, 0, 6.283); ctx.strokeStyle = 'rgba(217,164,65,.45)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(w * 0.07, -w * 0.04, w * 0.16, 0, 6.283); ctx.fillStyle = '#2a0e12'; ctx.fill();
      }
      ctx.restore();
    }

    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
      mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;

      // 夜空
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.6, th.sky[1]); sky.addColorStop(0.84, th.sky[2]); sky.addColorStop(1, th.sky[3]);
      ctx.globalAlpha = 1; ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // 闪电（远处，整屏轻闪两下）
      flash.next -= dt;
      if (th.flash && flash.next <= 0 && flash.t < 0) { flash.t = 0; flash.next = th.flash[0] + Math.random() * th.flash[1]; }
      var fl = 0;
      if (flash.t >= 0) { flash.t += dt; var q = flash.t; fl = q < 0.08 ? 1 : q < 0.16 ? 0.2 : q < 0.24 ? 0.7 : Math.max(0, 0.7 - (q - 0.24) * 2.5); if (q > 0.6) flash.t = -1; }

      // 星星
      for (var i = 0; i < stars.length; i++) { var s = stars[i]; var a = 0.35 + 0.35 * Math.sin(T * s.s + s.tw); ctx.globalAlpha = a; ctx.fillStyle = th.star; ctx.fillRect(s.x * W - mx * 8, s.y * H - my * 6, s.r, s.r); }

      // 星轨:绕天极慢慢转的弧线
      if (th.trails) {
        var plx = W * 0.5 - mx * 8, ply = H * 0.1 - my * 6, RR = Math.max(W, H);
        ctx.lineCap = 'round';
        for (i = 0; i < trails.length; i++) {
          var tr = trails[i], a0 = tr.a + T * 0.035;
          ctx.globalAlpha = tr.al; ctx.strokeStyle = tr.c; ctx.lineWidth = tr.w;
          ctx.beginPath(); ctx.arc(plx, ply, tr.r * RR, a0, a0 + tr.len); ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      // 极光:三条飘动的光带 + 竖直的光丝
      if (th.aurora) {
        ctx.globalCompositeOperation = 'lighter';
        var AC = ['120,255,190', '90,210,255', '190,130,255'];
        for (var k = 0; k < 3; k++) {
          var by = H * (small ? 0.13 + k * 0.06 : 0.12 + k * 0.075), amp = H * 0.05, step = small ? 16 : 20;
          var ag = ctx.createLinearGradient(0, by - amp * 1.4, 0, by + H * 0.2);
          ag.addColorStop(0, 'rgba(' + AC[k] + ',0)'); ag.addColorStop(0.3, 'rgba(' + AC[k] + ',' + (0.16 - k * 0.035) + ')'); ag.addColorStop(1, 'rgba(' + AC[k] + ',0)');
          ctx.globalAlpha = 1; ctx.fillStyle = ag; ctx.beginPath();
          for (x = -20; x <= W + 20; x += step) { var ay = by + Math.sin(x * 0.0035 + T * 0.22 + k * 2) * amp + Math.sin(x * 0.009 - T * 0.37 + k) * amp * 0.3; if (x === -20) ctx.moveTo(x - mx * 10, ay); else ctx.lineTo(x - mx * 10, ay); }
          for (x = W + 20; x >= -20; x -= step) { var ay2 = by + Math.sin(x * 0.0035 + T * 0.22 + k * 2) * amp + Math.sin(x * 0.009 - T * 0.37 + k) * amp * 0.3 + H * (0.1 + 0.05 * Math.sin(x * 0.006 + T * 0.3 + k)); ctx.lineTo(x - mx * 10, ay2); }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgb(' + AC[k] + ')';
          for (x = 0; x <= W; x += 7) {
            var rs = Math.sin(x * 0.07 + T * 1.1 + k * 3) * Math.sin(x * 0.013 - T * 0.5); if (rs < 0.35) continue;
            var ry = by + Math.sin(x * 0.0035 + T * 0.22 + k * 2) * amp + Math.sin(x * 0.009 - T * 0.37 + k) * amp * 0.3;
            ctx.globalAlpha = (rs - 0.35) * 0.14; ctx.fillRect(x - mx * 10, ry - 4, 1.5, H * 0.09);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // 流星:一次最多三颗,斜着划过
      if (th.meteor) {
        metNext -= dt;
        if (metNext <= 0 && !reduce) {
          metNext = 0.7 + Math.random() * 2.3;
          for (i = 0; i < meteors.length; i++) if (meteors[i].t < 0) {
            var mt = meteors[i], ang = 2.35 + (Math.random() - 0.5) * 0.35, sp2 = (small ? 520 : 820) * (0.7 + Math.random() * 0.5);
            mt.t = 0; mt.x = W * (0.25 + Math.random() * 0.85); mt.y = H * (-0.05 + Math.random() * 0.3); mt.vx = Math.cos(ang) * sp2; mt.vy = Math.sin(ang) * sp2; mt.life = 0.5 + Math.random() * 0.6; mt.tl = (small ? 90 : 140) + Math.random() * 100; break;
          }
        }
        for (i = 0; i < meteors.length; i++) {
          var m = meteors[i]; if (m.t < 0) continue;
          m.t += dt; if (m.t > m.life) { m.t = -1; continue; }
          var hx = m.x + m.vx * m.t - mx * 8, hy = m.y + m.vy * m.t - my * 6, vl = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          var tx2 = hx - m.vx / vl * m.tl, ty2 = hy - m.vy / vl * m.tl, ma = Math.sin(3.1416 * m.t / m.life);
          var mgr = ctx.createLinearGradient(hx, hy, tx2, ty2); mgr.addColorStop(0, 'rgba(240,244,255,.95)'); mgr.addColorStop(1, 'rgba(160,180,255,0)');
          ctx.globalAlpha = ma; ctx.strokeStyle = mgr; ctx.lineWidth = small ? 1.2 : 1.6; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx2, ty2); ctx.stroke();
          ctx.fillStyle = '#f4f6ff'; ctx.shadowColor = '#bcd0ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        }
      }

      // 裂隙:天幕上一道发紫光的裂缝,一呼一吸,偶尔猛地一亮
      if (th.rift) {
        var rx = W * (small ? 0.42 : 0.4) - mx * 10, ry0 = H * 0.07, rlen = H * (small ? 0.32 : 0.4), rw = small ? 13 : 20;
        var rp = 0.6 + 0.25 * Math.sin(T * 1.3) + 0.15 * Math.sin(T * 4.7) + (fl > 0 ? 0.6 * fl : 0);
        ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (k = 0; k < 2; k++) {
          ctx.beginPath();
          for (i = 0; i < riftP.length; i++) { var rX = rx + riftP[i] * rw + Math.sin(T * 2 + i) * 0.8, rY = ry0 + rlen * i / 12; if (i) ctx.lineTo(rX, rY); else ctx.moveTo(rX, rY); }
          if (k === 0) { ctx.globalAlpha = 0.5 * rp; ctx.strokeStyle = '#9a5cff'; ctx.shadowColor = '#a070ff'; ctx.shadowBlur = small ? 18 : 28; ctx.lineWidth = small ? 4 : 6; }
          else { ctx.globalAlpha = 0.75 * rp; ctx.strokeStyle = '#f0e6ff'; ctx.shadowBlur = 6; ctx.lineWidth = 1.6; }
          ctx.stroke();
        }
        var rg = ctx.createRadialGradient(rx, ry0 + rlen / 2, 0, rx, ry0 + rlen / 2, rlen * 0.9);
        rg.addColorStop(0, 'rgba(150,90,255,' + (0.1 * rp) + ')'); rg.addColorStop(1, 'rgba(150,90,255,0)');
        ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      }
      // 月亮 + 光晕
      var mxp = W * (small ? 0.87 : 0.82) - mx * 14, myp = H * (small ? 0.09 : 0.16) - my * 10, mr = small ? 20 : 38;
      var halo = ctx.createRadialGradient(mxp, myp, mr * 0.6, mxp, myp, mr * 6);
      halo.addColorStop(0, 'rgba(' + th.halo + ',' + (th.haloA || (th.moon ? '.20' : '.08')) + ')'); halo.addColorStop(1, 'rgba(' + th.halo + ',0)');
      ctx.globalAlpha = 1; ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      if (th.moon) {
        var mg = ctx.createRadialGradient(mxp - mr * 0.3, myp - mr * 0.3, mr * 0.1, mxp, myp, mr);
        mg.addColorStop(0, th.moon[0]); mg.addColorStop(1, th.moon[1]);
        ctx.beginPath(); ctx.arc(mxp, myp, mr, 0, 6.283); ctx.fillStyle = mg; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.14)';
        ctx.beginPath(); ctx.arc(mxp + mr * 0.25, myp + mr * 0.15, mr * 0.22, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(mxp - mr * 0.3, myp - mr * 0.25, mr * 0.13, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(mxp - mr * 0.1, myp + mr * 0.45, mr * 0.09, 0, 6.283); ctx.fill();
      }
      // 月食:黑色月面 + 日冕 + 一侧的钻石环
      if (th.eclipse) {
        var er = mr * 1.05, pul = 0.5 + 0.5 * Math.sin(T * 0.8);
        ctx.strokeStyle = 'rgb(255,170,100)'; ctx.lineWidth = 1;
        for (k = 0; k < 14; k++) { var ea = k * 0.4488 + T * 0.03 + (k % 2) * 0.2, el = er * (1.45 + 0.35 * Math.sin(T * 0.6 + k * 1.7)); ctx.globalAlpha = 0.1 + 0.06 * pul; ctx.beginPath(); ctx.moveTo(mxp + Math.cos(ea) * er, myp + Math.sin(ea) * er); ctx.lineTo(mxp + Math.cos(ea) * el, myp + Math.sin(ea) * el); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.shadowColor = 'rgba(255,140,60,1)'; ctx.shadowBlur = (small ? 22 : 36) + 10 * pul; ctx.fillStyle = '#07040a';
        ctx.beginPath(); ctx.arc(mxp, myp, er, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,196,140,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 0.7 + 0.3 * pul; ctx.strokeStyle = '#fff2dc'; ctx.lineWidth = 2.2; ctx.shadowColor = '#fff2dc'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(mxp, myp, er, -1.15, -0.55); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(mxp + Math.cos(-0.85) * er, myp + Math.sin(-0.85) * er, 2.4, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      // 一缕云从月前飘过
      var cx2 = ((T * 6) % (W + 300)) - 150;
      ctx.save(); ctx.translate(cx2, myp + mr * 0.2); ctx.scale(1, 0.18);
      var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 160); cg.addColorStop(0, 'rgba(20,24,38,.75)'); cg.addColorStop(1, 'rgba(20,24,38,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 160, 0, 6.283); ctx.fill(); ctx.restore();

      // 远山/屋脊剪影（钟楼）
      ctx.globalAlpha = 1; ctx.fillStyle = th.ground;
      ctx.beginPath(); var base = H * 0.86 - my * 12; ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 24) { var hh = base - (Math.sin(x * 0.011 + 1.3) * 16 + Math.sin(x * 0.027) * 9); ctx.lineTo(x - mx * 20, hh); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      var tx = W * 0.16 - mx * 20, ty = base - 18; // 钟楼
      ctx.fillRect(tx, ty - 70, 20, 90); ctx.fillRect(tx - 3, ty - 74, 26, 6); ctx.beginPath(); ctx.moveTo(tx - 3, ty - 74); ctx.lineTo(tx + 10, ty - 112); ctx.lineTo(tx + 23, ty - 74); ctx.fill(); ctx.fillRect(tx + 9, ty - 122, 2, 12);
      ctx.fillRect(tx + 34, ty - 18, 46, 40); ctx.beginPath(); ctx.moveTo(tx + 30, ty - 18); ctx.lineTo(tx + 57, ty - 40); ctx.lineTo(tx + 84, ty - 18); ctx.fill();
      var cand = 0.55 + 0.25 * Math.sin(T * 2.1) + 0.12 * Math.sin(T * 7.3); ctx.fillStyle = 'rgba(231,178,90,' + cand + ')'; ctx.shadowColor = '#e7b25a'; ctx.shadowBlur = 10; ctx.fillRect(tx + 7, ty - 55, 6, 9); ctx.fillRect(tx + 52, ty - 6, 8, 9); ctx.shadowBlur = 0;

      // 万圣夜:山脊上一排南瓜灯,刻出来的脸里烛火摇晃
      if (th.pumpkins) {
        for (i = 0; i < pumps.length; i++) {
          var pk = pumps[i], pr = pk.r * (small ? 0.75 : 1), pX = pk.x * W - mx * 20, pY = ridge(pX) - pr * 0.55;
          var pf = 0.7 + 0.2 * Math.sin(T * 6 + pk.ph) + 0.1 * Math.sin(T * 17 + pk.ph);
          ctx.globalAlpha = 1; ctx.fillStyle = '#1c0c05';
          ctx.beginPath(); ctx.ellipse(pX - pr * 0.4, pY, pr * 0.6, pr * 0.78, 0, 0, 6.283); ctx.ellipse(pX + pr * 0.4, pY, pr * 0.6, pr * 0.78, 0, 0, 6.283); ctx.fill();
          ctx.beginPath(); ctx.ellipse(pX, pY, pr * 0.7, pr * 0.85, 0, 0, 6.283); ctx.fill();
          ctx.fillRect(pX - 1.5, pY - pr * 1.05, 3, pr * 0.3);
          ctx.globalAlpha = pf; ctx.fillStyle = '#ffa030'; ctx.shadowColor = '#ff8a20'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(pX - pr * 0.55, pY - pr * 0.15); ctx.lineTo(pX - pr * 0.2, pY - pr * 0.15); ctx.lineTo(pX - pr * 0.37, pY - pr * 0.45); ctx.closePath();
          ctx.moveTo(pX + pr * 0.55, pY - pr * 0.15); ctx.lineTo(pX + pr * 0.2, pY - pr * 0.15); ctx.lineTo(pX + pr * 0.37, pY - pr * 0.45); ctx.closePath();
          ctx.moveTo(pX - pr * 0.6, pY + pr * 0.15); ctx.lineTo(pX - pr * 0.3, pY + pr * 0.32); ctx.lineTo(pX - pr * 0.15, pY + pr * 0.2); ctx.lineTo(pX, pY + pr * 0.36); ctx.lineTo(pX + pr * 0.15, pY + pr * 0.2); ctx.lineTo(pX + pr * 0.3, pY + pr * 0.32); ctx.lineTo(pX + pr * 0.6, pY + pr * 0.15); ctx.lineTo(pX, pY + pr * 0.6); ctx.closePath();
          ctx.fill(); ctx.shadowBlur = 0;
        }
      }
      // 飞碟:悬在半空左右漂,底下的牵引光柱一阵一阵地打开
      if (th.ufo) {
        var ux = W * (0.5 + 0.18 * Math.sin(T * 0.13)) - mx * 18, uy = H * (small ? 0.3 : 0.32) + Math.sin(T * 0.9) * 6 - my * 10, us = small ? 0.75 : 1;
        var cyc = (T % 11) / 11, uon = cyc < 0.45 ? Math.min(1, cyc * 12) * Math.min(1, (0.45 - cyc) * 12) : 0;
        if (uon > 0) {
          var gy2 = H * 0.9, ub = ctx.createLinearGradient(0, uy, 0, gy2);
          ub.addColorStop(0, 'rgba(150,255,190,' + (0.22 * uon) + ')'); ub.addColorStop(1, 'rgba(150,255,190,0)');
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85 + 0.15 * Math.sin(T * 9); ctx.fillStyle = ub;
          ctx.beginPath(); ctx.moveTo(ux - 12 * us, uy + 4); ctx.lineTo(ux + 12 * us, uy + 4); ctx.lineTo(ux + 70 * us, gy2); ctx.lineTo(ux - 70 * us, gy2); ctx.closePath(); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#9dffd0'; ctx.shadowColor = '#9dffd0'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.ellipse(ux, uy - 6 * us, 11 * us, 9 * us, 0, 3.1416, 6.283); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.fillStyle = '#141c1c';
        ctx.beginPath(); ctx.ellipse(ux, uy, 34 * us, 7 * us, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(160,220,200,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ux, uy - 1, 33 * us, 5.5 * us, 0, 3.4, 6.0); ctx.stroke();
        for (k = 0; k < 7; k++) { var la = (k / 7) * 6.283 + T * 2.2, lc = Math.cos(la); if (Math.sin(la) < 0) continue; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(la); ctx.fillStyle = k % 2 ? '#ffd860' : '#7dffb0'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(ux + lc * 28 * us, uy + 2 * us, 1.8, 0, 6.283); ctx.fill(); }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      // 墓园:歪斜的墓碑和十字架
      if (th.graves) {
        ctx.globalAlpha = 1; ctx.fillStyle = th.ground;
        for (i = 0; i < graves.length; i++) {
          var gv = graves[i], gX = gv.x * W - mx * 20, gs = small ? 0.75 : 1, gY = ridge(gX) + 5;
          ctx.save(); ctx.translate(gX, gY); ctx.rotate(gv.tilt); ctx.scale(gs, gs);
          if (gv.k) { ctx.fillRect(-2, -gv.h - 12, 4, gv.h + 12); ctx.fillRect(-8, -gv.h - 4, 16, 4); }
          else { ctx.beginPath(); ctx.moveTo(-gv.w / 2, 0); ctx.lineTo(-gv.w / 2, -gv.h); ctx.arc(0, -gv.h, gv.w / 2, 3.1416, 0); ctx.lineTo(gv.w / 2, 0); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
      // 霓虹:雨夜楼群,零星亮窗,招牌灯管偶尔闪断
      if (th.city) {
        var cs = small ? 0.72 : 1, cbase = H * 0.9 - my * 14;
        ctx.globalAlpha = 1; ctx.fillStyle = '#05040a';
        for (i = 0; i < blds.length; i++) { var bd = blds[i]; ctx.fillRect(bd.x * W - mx * 24, cbase - bd.h * cs, bd.w * cs, H); }
        for (i = 0; i < wins.length; i += 4) { var wb = blds[wins[i]]; ctx.globalAlpha = 0.32; ctx.fillStyle = wins[i + 3] ? '#8fd0ff' : '#ffd890'; ctx.fillRect(wb.x * W - mx * 24 + wins[i + 1] * cs, cbase - wb.h * cs + wins[i + 2] * cs, 3 * cs, 4 * cs); }
        for (i = 0; i < blds.length; i++) {
          bd = blds[i]; if (!bd.neon) continue;
          var nOn = Math.sin(T * 13 + bd.ph) * Math.sin(T * 3.1 + bd.ph * 2) > 0.85 ? 0.15 : 0.9;
          ctx.globalAlpha = nOn; ctx.fillStyle = bd.neon; ctx.shadowColor = bd.neon; ctx.shadowBlur = 12;
          var nx = bd.x * W - mx * 24 + (bd.w * cs) * 0.5 - 2;
          if (bd.h > 90) ctx.fillRect(nx, cbase - bd.h * cs + 12, 3, Math.min(46, bd.h * 0.35) * cs); else ctx.fillRect(nx - 8 * cs, cbase - bd.h * cs + 8, 18 * cs, 2.5);
        }
        ctx.shadowBlur = 0;
        var wet = ctx.createLinearGradient(0, cbase, 0, H); wet.addColorStop(0, 'rgba(255,63,164,.10)'); wet.addColorStop(1, 'rgba(63,240,255,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = wet; ctx.fillRect(0, cbase, W, H - cbase);
      }
      // 雾港:岬角上的灯塔,光柱缓缓扫过海雾
      if (th.beam) {
        var lx = W * (small ? 0.8 : 0.76) - mx * 20, lb = ridge(lx) + 4, lh = small ? 62 : 86, lyy = lb - lh - 8;
        ctx.globalAlpha = 1; ctx.fillStyle = th.ground;
        ctx.beginPath(); ctx.moveTo(lx - 9, lb); ctx.lineTo(lx - 5.5, lb - lh); ctx.lineTo(lx + 5.5, lb - lh); ctx.lineTo(lx + 9, lb); ctx.closePath(); ctx.fill();
        ctx.fillRect(lx - 8, lb - lh - 2, 16, 3); ctx.fillRect(lx - 5, lb - lh - 14, 10, 12);
        ctx.beginPath(); ctx.moveTo(lx - 7, lb - lh - 14); ctx.lineTo(lx, lb - lh - 22); ctx.lineTo(lx + 7, lb - lh - 14); ctx.fill();
        var ba = reduce ? 2.2 : T * 0.55, dir = Math.cos(ba), face = Math.sin(ba);
        var L = W * 1.15 * dir, spr = (small ? 26 : 40) + (1 - Math.abs(dir)) * (small ? 40 : 70);
        ctx.globalCompositeOperation = 'lighter';
        var bgr = ctx.createLinearGradient(lx, lyy, lx + L, lyy);
        var bA = (0.1 + 0.12 * Math.abs(dir)) * (face > 0 ? 1 : 0.55);
        bgr.addColorStop(0, 'rgba(255,240,200,' + bA + ')'); bgr.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = bgr; ctx.beginPath(); ctx.moveTo(lx, lyy - 2); ctx.lineTo(lx + L, lyy - spr - 10); ctx.lineTo(lx + L, lyy + spr * 0.7); ctx.lineTo(lx, lyy + 2); ctx.closePath(); ctx.fill();
        var gl2 = face > 0 ? Math.pow(Math.max(0, 1 - Math.abs(dir)), 3) : 0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffe9b8'; ctx.shadowColor = '#ffe0a0'; ctx.shadowBlur = 10 + gl2 * 40;
        ctx.beginPath(); ctx.arc(lx, lyy, 2.6 + gl2 * 3, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      }

      // 卡牌
      for (i = 0; th.cards && i < cards.length; i++) {
        var c = cards[i];
        if (!reduce) { c.y -= c.vy * dt * 2.2; c.flip += c.vf * dt; c.rot += c.vr * dt * 0.2; }
        if (c.y < -0.25) { cards[i] = newCard(false); cards[i].z = c.z; }
        card(c, T);
      }

      // 雾
      for (i = 0; i < fog.length; i++) {
        var f = fog[i]; f.x += f.v * dt; if (f.x > 1.3) f.x = -0.3; if (f.x < -0.3) f.x = 1.3;
        var fx = f.x * W - mx * 30, fy = f.y * H, fw = f.w * W;
        ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.22);
        var fg = ctx.createRadialGradient(0, 0, 0, 0, 0, fw * 0.5);
        fg.addColorStop(0, 'rgba(' + th.fog + ',' + (th.fogK ? Math.min(0.3, f.a * th.fogK) : f.a) + ')'); fg.addColorStop(1, 'rgba(' + th.fog + ',0)');
        ctx.globalAlpha = 1; ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, fw * 0.5, 0, 6.283); ctx.fill(); ctx.restore();
      }

      // 飘的东西(按主题:萤火 / 雪 / 花瓣 / 火星 / 雨 / 气泡)
      var pt = th.p;
      for (i = 0; i < flies.length; i++) {
        var p = flies[i];
        if (pt === 'fly') {
          p.a += (Math.random() - 0.5) * 0.3; p.x += Math.cos(p.a) * p.s * dt * 0.02; p.y += Math.sin(p.a) * p.s * dt * 0.015;
          if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0.4) p.y = 1; if (p.y > 1) p.y = 0.4;
          var gl = 0.5 + 0.5 * Math.sin(T * 2 + p.ph);
          ctx.globalAlpha = gl * 0.8; ctx.fillStyle = th.pc; ctx.shadowColor = th.pc; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(p.x * W - mx * 25, p.y * H - my * 15, 1.4, 0, 6.283); ctx.fill();
          continue;
        }
        if (pt === 'wisp') {
          // 鬼火:低处游荡的冷色火团,一缩一放,拖一截向上的火舌
          if (!reduce) { p.a += (Math.random() - 0.5) * 0.12; p.x += Math.cos(p.a) * p.s * dt * 0.012; p.y += Math.sin(p.a) * p.s * dt * 0.006; }
          if (p.x < 0.02) p.x = 0.98; if (p.x > 0.98) p.x = 0.02; if (p.y < 0.6) p.y = 0.92; if (p.y > 0.94) p.y = 0.62;
          var wg = 0.55 + 0.45 * Math.sin(T * 1.7 + p.ph) * Math.sin(T * 0.6 + p.ph * 2), wr = (small ? 2.4 : 3.2) * (0.7 + p.s * 0.5);
          var WX = p.x * W - mx * 25, WY = p.y * H - my * 15 + Math.sin(T * 1.3 + p.ph) * 4;
          ctx.globalAlpha = 0.35 + 0.55 * wg; ctx.fillStyle = th.pc; ctx.shadowColor = th.pc; ctx.shadowBlur = 18;
          ctx.beginPath(); ctx.arc(WX, WY, wr, 0, 3.1416); ctx.quadraticCurveTo(WX - wr + Math.sin(T * 4 + p.ph) * 2, WY - wr * 2, WX + Math.sin(T * 3 + p.ph) * 2.5, WY - wr * 3.6); ctx.quadraticCurveTo(WX + wr, WY - wr * 1.6, WX + wr, WY); ctx.fill();
          ctx.globalAlpha *= 0.8; ctx.fillStyle = '#e8fdff'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(WX, WY - wr * 0.2, wr * 0.45, 0, 6.283); ctx.fill();
          continue;
        }
        if (p.init !== pt) { p.init = pt; p.y = Math.random(); p.x = Math.random(); }
        var fall = pt === 'rain' ? 1.6 : pt === 'snow' ? 0.06 : pt === 'petal' ? 0.07 : pt === 'ember' ? -0.07 : pt === 'bat' ? 0.003 : -0.05;
        if (!reduce) { p.y += fall * p.s * dt * (pt === 'rain' ? 1 : 1.4); p.x += (pt === 'rain' ? 0.12 : pt === 'bat' ? (p.ph > 3.14 ? 1 : -1) * (0.04 + 0.05 * p.s) : Math.sin(T * 0.8 + p.ph) * 0.015) * dt; }
        if (pt === 'bat') { if (p.y > 0.55) p.y = 0.05 + Math.random() * 0.45; }
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); } if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        if (p.x > 1.05) p.x = -0.05; if (p.x < -0.05) p.x = 1.05;
        var X = p.x * W - mx * 25 * p.s, Y = p.y * H - my * 15 * p.s;
        ctx.shadowBlur = 0; ctx.fillStyle = th.pc; ctx.strokeStyle = th.pc;
        if (pt === 'snow') { ctx.globalAlpha = 0.5 + 0.4 * p.s; ctx.beginPath(); ctx.arc(X, Y, 0.8 + p.s * 1.8, 0, 6.283); ctx.fill(); }
        else if (pt === 'rain') { ctx.globalAlpha = 0.25 + 0.3 * p.s; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 3, Y + 14 * p.s + 6); ctx.stroke(); }
        else if (pt === 'petal') { ctx.save(); ctx.translate(X, Y); ctx.rotate(T * 1.2 + p.ph); ctx.globalAlpha = 0.55 + 0.35 * p.s; ctx.beginPath(); ctx.ellipse(0, 0, 3.5 * (0.6 + p.s), 1.8 * (0.6 + p.s), 0, 0, 6.283); ctx.fill(); ctx.restore(); }
        else if (pt === 'ember') { var fl2 = 0.5 + 0.5 * Math.sin(T * 6 + p.ph); ctx.globalAlpha = 0.4 + 0.5 * fl2; ctx.shadowColor = th.pc; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(X, Y, 0.8 + p.s * 1.2, 0, 6.283); ctx.fill(); }
        else if (pt === 'bat') {
          // 蝙蝠:扑棱着翅膀横穿夜空
          var bsz = (small ? 6 : 9) * (0.6 + p.s * 0.8), flp = Math.sin(T * (12 + p.s * 6) + p.ph);
          ctx.globalAlpha = 0.85; ctx.fillStyle = th.pc; ctx.save(); ctx.translate(X, Y + Math.sin(T * 1.7 + p.ph) * 10); ctx.beginPath();
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(-bsz * 0.6, -bsz * flp * 0.9, -bsz * 1.6, -bsz * flp * 0.5); ctx.quadraticCurveTo(-bsz * 0.9, bsz * 0.1, -bsz * 0.3, bsz * 0.35);
          ctx.lineTo(0, bsz * 0.2); ctx.lineTo(bsz * 0.3, bsz * 0.35); ctx.quadraticCurveTo(bsz * 0.9, bsz * 0.1, bsz * 1.6, -bsz * flp * 0.5); ctx.quadraticCurveTo(bsz * 0.6, -bsz * flp * 0.9, 0, 0);
          ctx.fill(); ctx.restore();
        }
        else if (pt === 'bubble') { ctx.globalAlpha = 0.25 + 0.35 * p.s; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, 1.5 + p.s * 3, 0, 6.283); ctx.stroke(); }
      }
      ctx.shadowBlur = 0;

      // 暗处一双眼睛：慢慢睁开、眨一下、闭上
      eyes.next -= dt;
      if (th.eyes && eyes.next <= 0 && eyes.t < 0) { eyes.t = 0; eyes.x = (Math.random() < 0.5 ? 0.06 + Math.random() * 0.22 : 0.72 + Math.random() * 0.22); eyes.y = 0.74 + Math.random() * 0.16; eyes.next = 10 + Math.random() * 14; }
      if (eyes.t >= 0) {
        eyes.t += dt; var e = eyes.t, open = e < 0.8 ? e / 0.8 : e < 2.2 ? 1 : e < 2.35 ? 0.1 : e < 3.4 ? 1 : Math.max(0, 1 - (e - 3.4) / 0.6);
        if (e > 4) eyes.t = -1;
        var ex = eyes.x * W, ey = eyes.y * H, sp = small ? 9 : 12;
        ctx.globalAlpha = 0.9; ctx.fillStyle = th.eyes || '#e04848'; ctx.shadowColor = th.eyes || '#e04848'; ctx.shadowBlur = 14;
        for (var j = -1; j <= 1; j += 2) { ctx.beginPath(); ctx.ellipse(ex + j * sp, ey, 3.2, Math.max(0.3, 2.4 * open), 0, 0, 6.283); ctx.fill(); }
        ctx.shadowBlur = 0;
      }

      // 闪电白光
      if (fl > 0) { ctx.globalAlpha = fl * 0.22; ctx.fillStyle = '#cfd8ff'; ctx.fillRect(0, 0, W, H); }

      // 底部压暗，保证前景文字可读
      var vg = ctx.createLinearGradient(0, H * 0.35, 0, H);
      vg.addColorStop(0, 'rgba(7,8,11,0)'); vg.addColorStop(1, 'rgba(7,8,11,.65)');
      ctx.globalAlpha = 1; ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    function loop() { if (!running) return; frame(performance.now()); raf = requestAnimationFrame(loop); }
    if (reduce) frame(performance.now()); else loop();
    if (opts.snapshotAt) { /* 测试截图用：快进 */ for (var n = 0; n < opts.snapshotAt * 30; n++) frame(last + 33); }

    return function stop() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onOrient); document.removeEventListener('visibilitychange', onVis);
    };
  };
})();
