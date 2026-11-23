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

  window.startNightBg = function (cv, opts) {
    opts = opts || {};
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
    for (i = 0; i < (small ? 26 : 50); i++) flies.push({ x: Math.random(), y: 0.45 + Math.random() * 0.55, a: Math.random() * 6.28, s: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28 });
    for (i = 0; i < 5; i++) fog.push({ x: Math.random(), y: 0.62 + i * 0.09, w: 0.9 + Math.random() * 0.6, v: (0.004 + Math.random() * 0.006) * (i % 2 ? 1 : -1), a: 0.05 + Math.random() * 0.05 });

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
      sky.addColorStop(0, '#080a16'); sky.addColorStop(0.6, '#10131e'); sky.addColorStop(0.84, '#1a1c26'); sky.addColorStop(1, '#0a0b0f');
      ctx.globalAlpha = 1; ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // 闪电（远处，整屏轻闪两下）
      flash.next -= dt;
      if (flash.next <= 0 && flash.t < 0) { flash.t = 0; flash.next = 18 + Math.random() * 22; }
      var fl = 0;
      if (flash.t >= 0) { flash.t += dt; var q = flash.t; fl = q < 0.08 ? 1 : q < 0.16 ? 0.2 : q < 0.24 ? 0.7 : Math.max(0, 0.7 - (q - 0.24) * 2.5); if (q > 0.6) flash.t = -1; }

      // 星星
      for (var i = 0; i < stars.length; i++) { var s = stars[i]; var a = 0.35 + 0.35 * Math.sin(T * s.s + s.tw); ctx.globalAlpha = a; ctx.fillStyle = '#e8e2d0'; ctx.fillRect(s.x * W - mx * 8, s.y * H - my * 6, s.r, s.r); }

      // 月亮 + 光晕
      var mxp = W * (small ? 0.78 : 0.82) - mx * 14, myp = H * 0.16 - my * 10, mr = small ? 26 : 38;
      var halo = ctx.createRadialGradient(mxp, myp, mr * 0.6, mxp, myp, mr * 6);
      halo.addColorStop(0, 'rgba(230,220,190,.20)'); halo.addColorStop(1, 'rgba(230,220,190,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      var mg = ctx.createRadialGradient(mxp - mr * 0.3, myp - mr * 0.3, mr * 0.1, mxp, myp, mr);
      mg.addColorStop(0, '#f6eed6'); mg.addColorStop(1, '#d9cba4');
      ctx.beginPath(); ctx.arc(mxp, myp, mr, 0, 6.283); ctx.fillStyle = mg; ctx.fill();
      ctx.fillStyle = 'rgba(150,135,100,.28)';
      ctx.beginPath(); ctx.arc(mxp + mr * 0.25, myp + mr * 0.15, mr * 0.22, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(mxp - mr * 0.3, myp - mr * 0.25, mr * 0.13, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(mxp - mr * 0.1, myp + mr * 0.45, mr * 0.09, 0, 6.283); ctx.fill();
      // 一缕云从月前飘过
      var cx2 = ((T * 6) % (W + 300)) - 150;
      ctx.save(); ctx.translate(cx2, myp + mr * 0.2); ctx.scale(1, 0.18);
      var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 160); cg.addColorStop(0, 'rgba(20,24,38,.75)'); cg.addColorStop(1, 'rgba(20,24,38,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 160, 0, 6.283); ctx.fill(); ctx.restore();

      // 远山/屋脊剪影（钟楼）
      ctx.globalAlpha = 1; ctx.fillStyle = '#040508';
      ctx.beginPath(); var base = H * 0.86 - my * 12; ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 24) { var hh = base - (Math.sin(x * 0.011 + 1.3) * 16 + Math.sin(x * 0.027) * 9); ctx.lineTo(x - mx * 20, hh); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      var tx = W * 0.16 - mx * 20, ty = base - 18; // 钟楼
      ctx.fillRect(tx, ty - 70, 20, 90); ctx.fillRect(tx - 3, ty - 74, 26, 6); ctx.beginPath(); ctx.moveTo(tx - 3, ty - 74); ctx.lineTo(tx + 10, ty - 112); ctx.lineTo(tx + 23, ty - 74); ctx.fill(); ctx.fillRect(tx + 9, ty - 122, 2, 12);
      ctx.fillRect(tx + 34, ty - 18, 46, 40); ctx.beginPath(); ctx.moveTo(tx + 30, ty - 18); ctx.lineTo(tx + 57, ty - 40); ctx.lineTo(tx + 84, ty - 18); ctx.fill();
      var cand = 0.55 + 0.25 * Math.sin(T * 2.1) + 0.12 * Math.sin(T * 7.3); ctx.fillStyle = 'rgba(231,178,90,' + cand + ')'; ctx.shadowColor = '#e7b25a'; ctx.shadowBlur = 10; ctx.fillRect(tx + 7, ty - 55, 6, 9); ctx.fillRect(tx + 52, ty - 6, 8, 9); ctx.shadowBlur = 0;

      // 卡牌
      for (i = 0; i < cards.length; i++) {
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
        fg.addColorStop(0, 'rgba(120,150,145,' + f.a + ')'); fg.addColorStop(1, 'rgba(120,150,145,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, fw * 0.5, 0, 6.283); ctx.fill(); ctx.restore();
      }

      // 萤火
      for (i = 0; i < flies.length; i++) {
        var p = flies[i]; p.a += (Math.random() - 0.5) * 0.3; p.x += Math.cos(p.a) * p.s * dt * 0.02; p.y += Math.sin(p.a) * p.s * dt * 0.015;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0.4) p.y = 1; if (p.y > 1) p.y = 0.4;
        var gl = 0.5 + 0.5 * Math.sin(T * 2 + p.ph);
        ctx.globalAlpha = gl * 0.8; ctx.fillStyle = '#e7c27a'; ctx.shadowColor = '#e7c27a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x * W - mx * 25, p.y * H - my * 15, 1.4, 0, 6.283); ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 暗处一双眼睛：慢慢睁开、眨一下、闭上
      eyes.next -= dt;
      if (eyes.next <= 0 && eyes.t < 0) { eyes.t = 0; eyes.x = (Math.random() < 0.5 ? 0.06 + Math.random() * 0.22 : 0.72 + Math.random() * 0.22); eyes.y = 0.74 + Math.random() * 0.16; eyes.next = 10 + Math.random() * 14; }
      if (eyes.t >= 0) {
        eyes.t += dt; var e = eyes.t, open = e < 0.8 ? e / 0.8 : e < 2.2 ? 1 : e < 2.35 ? 0.1 : e < 3.4 ? 1 : Math.max(0, 1 - (e - 3.4) / 0.6);
        if (e > 4) eyes.t = -1;
        var ex = eyes.x * W, ey = eyes.y * H, sp = small ? 9 : 12;
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#e04848'; ctx.shadowColor = '#e04848'; ctx.shadowBlur = 14;
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
