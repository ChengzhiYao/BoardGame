(function () {
  const id = document.body.dataset.song;
  const song = (window.SONGS || []).find(s => s.id === id);
  if (!song) { document.querySelector("main").innerHTML = "<p style='padding:40px 0'>找不到这首歌。</p>"; return; }

  const $ = s => document.querySelector(s);
  const media = `/music/media/${song.id}`, rv = song.rev ? `?r=${song.rev}` : "";   // rev：同一个编号换了歌时，让浏览器重新下载
  const fmt = t => { t = Math.max(0, t | 0); return `${(t / 60) | 0}:${String(t % 60).padStart(2, "0")}`; };

  // ── 填内容 ──
  document.title = song.title;
  document.documentElement.style.setProperty("--bg", `url(${media}/cover.jpg${rv})`);
  if (song.theme) {
    const th = song.theme, rs = document.documentElement.style;
    if (th.night) { rs.setProperty("--night", th.night); document.querySelector('meta[name="theme-color"]').content = th.night; }
    if (th.nightRgb) rs.setProperty("--night-rgb", th.nightRgb);
    if (th.glow) rs.setProperty("--glow", th.glow);
    if (th.accent) rs.setProperty("--accent", th.accent);
  }
  $("#cover").addEventListener("load", e => {
    const im = e.target; if (song.coverFill) { im.style.objectPosition = song.coverFill; return; }   // 横图也铺满整个方框（按指定焦点裁切）
    if (im.naturalWidth / im.naturalHeight > 1.15) $(".cover-wrap").classList.add("wide");
  });
  $("#cover").src = `${media}/cover.jpg${rv}`;
  $("#cover").alt = song.title;
  $(".gate-no").textContent = `No. ${song.id}`;
  $(".gate-title").textContent = song.title;
  $("#title").textContent = song.title;
  $("#sub").textContent = song.subtitle || "";
  $("#no").textContent = `No. ${song.id}`;
  $("#when").textContent = [song.date, song.place].filter(Boolean).join(" · ");

  const notes = (song.note || []).filter(Boolean);
  if (!notes.length) $(".letter").remove();
  else notes.forEach(t => { const p = document.createElement("p"); p.textContent = t; $("#note").appendChild(p); });

  // ── 音频 ──
  const audio = new Audio();
  audio.src = `${media}/audio.m4a${rv}`;
  audio.preload = "metadata";
  audio.setAttribute("playsinline", "");

  const root = document.body;
  const fill = $(".bar-fill"), knob = $(".bar-knob");
  const setProgress = () => {
    const d = audio.duration || 0, p = d ? audio.currentTime / d : 0;
    fill.style.width = knob.style.left = `${p * 100}%`;
    $("#cur").textContent = fmt(audio.currentTime);
    $("#dur").textContent = fmt(d);
  };
  audio.addEventListener("timeupdate", setProgress);
  audio.addEventListener("loadedmetadata", setProgress);
  audio.addEventListener("play", () => root.classList.add("playing"));
  audio.addEventListener("pause", () => root.classList.remove("playing"));
  audio.addEventListener("ended", () => { root.classList.remove("playing"); });

  const toggle = () => (audio.paused ? audio.play() : audio.pause());
  $("#play").addEventListener("click", toggle);
  $("#back").addEventListener("click", () => (audio.currentTime = Math.max(0, audio.currentTime - 10)));
  const loopBtn = $("#loop");
  loopBtn.addEventListener("click", () => { audio.loop = !audio.loop; loopBtn.classList.toggle("on", audio.loop); });

  // 拖动进度条
  const bar = $(".bar");
  const seek = e => {
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (audio.duration) audio.currentTime = p * audio.duration;
    setProgress();
  };
  bar.addEventListener("pointerdown", e => { bar.setPointerCapture(e.pointerId); seek(e); bar.onpointermove = seek; });
  bar.addEventListener("pointerup", () => (bar.onpointermove = null));

  // 锁屏/通知栏显示歌名
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title, artist: song.subtitle || "",
      artwork: [{ src: `${media}/cover.jpg${rv}`, sizes: "1024x1024", type: "image/jpeg" }]
    });
  }

  // ── 波形（跟着音乐跳；不支持就画静止的） ──
  const cv = $("#viz"), ctx = cv.getContext("2d");
  let analyser, freq;
  const BARS = 48;
  const size = () => { const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; };
  size(); addEventListener("resize", size);

  function initAnalyser() {
    if (analyser) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = .82;
      // 低通滤波：场景可以让音乐“沉进水里”变闷（window.__lowpass(频率)），平时完全不影响
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 22000; lp.Q.value = .7;
      src.connect(lp); lp.connect(analyser); analyser.connect(ac.destination);
      window.__ac = ac;   // 给场景用的音效（风声等）直接接到扬声器，不进波形
      window.__lowpass = f => lp.frequency.setTargetAtTime(Math.max(200, Math.min(22000, f)), ac.currentTime, .25);
      freq = new Uint8Array(analyser.frequencyBinCount);
      audio.addEventListener("play", () => ac.state === "suspended" && ac.resume());
    } catch (e) { analyser = null; }
  }

  const levels = new Float32Array(BARS);
  (function draw(t) {
    const w = cv.width, h = cv.height, mid = h / 2, gap = w / BARS, bw = Math.max(1.5, gap * .32);
    ctx.clearRect(0, 0, w, h);
    if (analyser && !audio.paused) analyser.getByteFrequencyData(freq);
    // 给背景场景用：是否在播放 + 当前响度
    window.__playing = !audio.paused;
    window.__time = audio.currentTime;
    if (audio.paused) window.__level = 0;
    else if (analyser) { let sum = 0; for (let i = 2; i < 40; i++) sum += freq[i]; window.__level = Math.min(1, Math.max(0, (sum / 38 / 255 - .25) * 1.8)); }
    else window.__level = .35;
    if (analyser && !audio.paused) { let b = 0; for (let i = 1; i < 6; i++) b += freq[i]; window.__bass = b / 5 / 255; } else window.__bass = 0;
    for (let i = 0; i < BARS; i++) {
      // 中间高两边低，像视频里的那条波形
      const k = Math.abs(i - (BARS - 1) / 2) / (BARS / 2);
      let target;
      if (analyser && !audio.paused) {
        const bin = Math.floor((1 - k) * freq.length * .55) + 2;
        target = (freq[bin] / 255) * (1 - k * .55);
      } else {
        target = .05 + .03 * Math.sin(t / 900 + i * .5);
      }
      levels[i] += (target - levels[i]) * .25;
      const bh = Math.max(bw, levels[i] * h * .92);
      ctx.fillStyle = `rgba(233,228,234,${.35 + levels[i] * .65})`;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(i * gap + (gap - bw) / 2, mid - bh / 2, bw, bh, bw / 2)
                    : ctx.rect(i * gap + (gap - bw) / 2, mid - bh / 2, bw, bh);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  })(0);

  // ── 歌词：逐字点亮 + 自动定位到正在唱的那一句 ──
  // 数据格式（songs.js）：lyrics: [{ t: 开始秒, e: 结束秒, w: [[字, 开始, 结束], ...], tr: "翻译(可选)" }, ...]
  // 没有 w 的行会按时长平均分给每个字
  // 歌词放在 /media/<id>/lyrics.json，没有这个文件就不显示歌词区
  fetch(`${media}/lyrics.json${rv}`).then(r => (r.ok ? r.json() : [])).catch(() => []).then(setupLyrics);
  function setupLyrics(lines) {
  if (!Array.isArray(lines) || !lines.length) { $("#lyricsBox").remove(); return; }
  root.classList.add("has-lyrics");
  const blood = song.lyricStyle === "blood";
  if (blood) root.classList.add("lyric-blood");
  if (song.lyricStyle === "beast") root.classList.add("lyric-beast");
  {
    const box = $("#lyricsBox"), scroller = $("#lyrics");
    const rows = lines.map((ln, i) => {
      const words = ln.w && ln.w.length ? ln.w : [...(ln.text || "")].map((c, k, arr) => {
        const d = (ln.e - ln.t) / arr.length; return [c, ln.t + k * d, ln.t + (k + 1) * d];
      });
      const el = document.createElement("div");
      el.className = "ly-line";
      const chars = [];
      // 把每个“词”拆成单字，时间按字数平分，这样逐字发光更细腻
      for (const [txt, s, e] of words) {
        const cs = [...txt], d = (e - s) / Math.max(1, cs.length);
        cs.forEach((c, k) => {
          const sp = document.createElement("span");
          sp.className = "ly-c"; sp.textContent = c;
          el.appendChild(sp);
          chars.push({ el: sp, s: s + k * d, e: s + (k + 1) * d });
        });
      }
      if (ln.tr) { const tr = document.createElement("span"); tr.className = "tr"; tr.textContent = ln.tr; el.appendChild(tr); }
      el.addEventListener("click", () => { audio.currentTime = Math.max(0, ln.t - .15); if (audio.paused) audio.play(); });
      scroller.appendChild(el);
      return { el, t: ln.t, e: ln.e, chars };
    });

    let active = -2;
    const center = i => {
      const r = rows[Math.max(0, i)].el;
      const y = r.offsetTop + r.offsetHeight / 2 - box.clientHeight / 2;
      scroller.style.transform = `translateY(${-y}px)`;
    };
    const tick = () => {
      const now = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < rows.length; i++) if (rows[i].t - .05 <= now) idx = i; else break;
      if (idx !== active) {
        rows.forEach((r, i) => {
          r.el.classList.toggle("active", i === idx);
          r.el.classList.toggle("done", i < idx);
          r.el.classList.toggle("near", Math.abs(i - idx) === 1);
          if (i !== idx && i >= idx) r.chars.forEach(c => { c.el.style.setProperty("--p", 0); c.el.classList.remove("lit", "drip"); c.dripped = false; });
        });
        active = idx; center(idx);
      }
      if (idx >= 0) for (const c of rows[idx].chars) {
        const p = Math.min(1, Math.max(0, (now - c.s) / Math.max(.05, c.e - c.s)));
        c.el.style.setProperty("--p", p.toFixed(3));
        c.el.classList.toggle("lit", now >= c.s && now < c.e + .35);
        if (blood && !c.dripped && now >= c.s && c.el.textContent.trim()) {   // 有的字滴下一道血痕
          c.dripped = true;
          if (Math.random() < .3) {
            const st = c.el.style;
            st.setProperty("--dx", `${20 + Math.random() * 60}%`); st.setProperty("--dh", `${4 + Math.random() * 9}px`);
            st.setProperty("--dw", `${1.1 + Math.random() * 1}px`); st.setProperty("--dd", `${1.8 + Math.random() * 2}s`);
            c.el.classList.add("drip");
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    addEventListener("resize", () => active >= -1 && center(active));
  }
  }

  // ── 开场 ──
  $(".gate").addEventListener("click", () => {
    initAnalyser();
    audio.play().catch(() => {});
    $(".gate").classList.add("gone");
    root.classList.add("ready");
  }, { once: true });
})();
