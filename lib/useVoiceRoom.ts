'use client';
// 一起听故事的语音：房里的人点开麦克风说话，其他人直接听到（浏览器之间点对点连，Supabase 广播只用来交换连接信息）。
// 麦克风默认关。房里有 Linger 伴侣时，把你说的话一句句转成文字交给伴侣，TA 就"听到"了。
import { useEffect, useRef, useState } from 'react';
import { toWav16 } from '@/lib/wav16';

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
type Peer = { pc: RTCPeerConnection; el: HTMLAudioElement; q: RTCIceCandidateInit[] };

export function useVoiceRoom(supabase: any, roomId: string, myPid: string | null | undefined, opts: { onUtterance?: (text: string) => void } = {}) {
  const [micOn, setMicOn] = useState(false);
  const [micErr, setMicErr] = useState('');
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [linked, setLinked] = useState(0); // 连上的人数
  const peers = useRef(new Map<string, Peer>());
  const ch = useRef<any>(null);
  const local = useRef<MediaStream | null>(null);
  const ac = useRef<AudioContext | null>(null);
  const meters = useRef(new Map<string, () => number>());
  const utter = useRef(opts.onUtterance); utter.current = opts.onUtterance;
  const vad = useRef<any>({});

  const send = (m: any) => { try { ch.current?.send({ type: 'broadcast', event: 'sig', payload: { ...m, from: myPid } }); } catch {} };
  const actx = () => { if (!ac.current) { const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext; ac.current = AC ? new AC() : null; } try { ac.current?.resume(); } catch {} return ac.current; };
  function meter(pid: string, stream: MediaStream) {
    const c = actx(); if (!c) return;
    try {
      const an = c.createAnalyser(); an.fftSize = 512; c.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize);
      meters.current.set(pid, () => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); });
    } catch {}
  }
  const count = () => setLinked([...peers.current.values()].filter((p) => p.pc.connectionState === 'connected').length);
  function close(pid: string) { const p = peers.current.get(pid); if (!p) return; try { p.pc.close(); } catch {} try { p.el.srcObject = null; } catch {} peers.current.delete(pid); meters.current.delete(pid); count(); }
  function make(pid: string, offerer: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const el = new Audio(); el.autoplay = true; (el as any).playsInline = true;
    const p: Peer = { pc, el, q: [] }; peers.current.set(pid, p);
    if (offerer) { const tr = pc.addTransceiver('audio', { direction: 'sendrecv' }); const tk = local.current?.getAudioTracks()[0]; if (tk) tr.sender.replaceTrack(tk).catch(() => {}); }
    pc.ontrack = (e) => { const st = e.streams[0] || new MediaStream([e.track]); el.srcObject = st; el.play().catch(() => {}); meter(pid, st); };
    pc.onicecandidate = (e) => { if (e.candidate) send({ t: 'cand', to: pid, c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') close(pid); else count(); };
    return p;
  }
  async function offer(pid: string) {
    const p = make(pid, true);
    try { await p.pc.setLocalDescription(await p.pc.createOffer()); send({ t: 'offer', to: pid, sdp: p.pc.localDescription }); } catch { close(pid); }
  }
  const alive = (pid: string) => { const p = peers.current.get(pid); return !!p && !['failed', 'closed'].includes(p.pc.connectionState); };

  useEffect(() => {
    if (!myPid || typeof window === 'undefined' || !(window as any).RTCPeerConnection) return;
    const c = supabase.channel(`voice-${roomId}`, { config: { broadcast: { self: false } } });
    c.on('broadcast', { event: 'sig' }, async ({ payload: m }: any) => {
      if (!m?.from || m.from === myPid || (m.to && m.to !== myPid)) return;
      if (m.t === 'hello') {
        if (alive(m.from)) return;
        if (myPid < m.from) offer(m.from); else if (!m.to) send({ t: 'hello', to: m.from }); // 号小的一方发起，避免两边同时发
      } else if (m.t === 'offer') {
        if (peers.current.has(m.from)) close(m.from);
        const p = make(m.from, false);
        try {
          await p.pc.setRemoteDescription(m.sdp);
          const tr = p.pc.getTransceivers()[0]; if (tr) { tr.direction = 'sendrecv'; const tk = local.current?.getAudioTracks()[0]; if (tk) await tr.sender.replaceTrack(tk).catch(() => {}); }
          await p.pc.setLocalDescription(await p.pc.createAnswer()); send({ t: 'answer', to: m.from, sdp: p.pc.localDescription });
          for (const x of p.q.splice(0)) await p.pc.addIceCandidate(x).catch(() => {});
        } catch { close(m.from); }
      } else if (m.t === 'answer') {
        const p = peers.current.get(m.from); if (!p) return;
        try { await p.pc.setRemoteDescription(m.sdp); for (const x of p.q.splice(0)) await p.pc.addIceCandidate(x).catch(() => {}); } catch {}
      } else if (m.t === 'cand') {
        const p = peers.current.get(m.from); if (!p) return;
        if (p.pc.remoteDescription) p.pc.addIceCandidate(m.c).catch(() => {}); else p.q.push(m.c);
      } else if (m.t === 'bye') close(m.from);
    }).subscribe((st: string) => { if (st === 'SUBSCRIBED') send({ t: 'hello' }); });
    ch.current = c;
    const again = setInterval(() => { if (!document.hidden) send({ t: 'hello' }); }, 20000);
    // 谁在说话：头像亮起来
    const tick = setInterval(() => {
      const next: Record<string, boolean> = {};
      meters.current.forEach((f, pid) => { if (pid === myPid && !local.current) return; next[pid] = f() > 0.025; });
      setSpeaking((o) => (JSON.stringify(o) === JSON.stringify(next) ? o : next));
    }, 150);
    const bye = () => send({ t: 'bye' });
    window.addEventListener('pagehide', bye);
    return () => { bye(); window.removeEventListener('pagehide', bye); clearInterval(again); clearInterval(tick); peers.current.forEach((_, k) => close(k)); supabase.removeChannel(c); ch.current = null; stopMic(); try { ac.current?.close(); } catch {} ac.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myPid]);

  // 把自己说的话切成一句一句（说完停顿约 0.9 秒算一句），转成文字给伴侣
  function startVad(stream: MediaStream) {
    const get = meters.current.get(myPid || 'me'); if (!get || !(window as any).MediaRecorder) return;
    const v = vad.current; v.on = true; v.rec = null; v.quiet = 0; v.t0 = 0;
    v.iv = setInterval(() => {
      const loud = get() > 0.03;
      if (loud && !v.rec) {
        try { const r = new MediaRecorder(stream); const chunks: Blob[] = []; r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          r.onstop = async () => { const ms = Date.now() - v.t0; if (ms < 700 || !utter.current) return; try { const wav = await toWav16(new Blob(chunks, { type: r.mimeType }), 20); if (!wav) return; const d = await fetch('/api/stt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wav }) }).then((x) => x.json()); const t = String(d?.text || '').trim(); if (t.length >= 2) utter.current?.(t); } catch {} };
          r.start(); v.rec = r; v.t0 = Date.now(); v.quiet = 0; } catch {}
      } else if (v.rec) {
        v.quiet = loud ? 0 : v.quiet + 100;
        if (v.quiet >= 900 || Date.now() - v.t0 > 15000) { try { v.rec.stop(); } catch {} v.rec = null; }
      }
    }, 100);
  }
  function stopVad() { const v = vad.current; clearInterval(v.iv); try { v.rec?.stop(); } catch {} v.rec = null; }

  async function startMic() {
    setMicErr('');
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      local.current = st; const tk = st.getAudioTracks()[0];
      peers.current.forEach((p) => { p.pc.getTransceivers().forEach((tr) => { if (tr.receiver.track?.kind === 'audio') tr.sender.replaceTrack(tk).catch(() => {}); }); });
      meter(myPid || 'me', st); setMicOn(true);
      if (utter.current) startVad(st);
    } catch { setMicErr('没拿到麦克风权限'); setMicOn(false); }
  }
  function stopMic() {
    stopVad();
    peers.current.forEach((p) => p.pc.getTransceivers().forEach((tr) => { tr.sender.replaceTrack(null).catch(() => {}); }));
    try { local.current?.getTracks().forEach((t) => t.stop()); } catch {}
    local.current = null; meters.current.delete(myPid || 'me'); setMicOn(false);
  }
  const toggleMic = () => (micOn ? stopMic() : startMic());
  // 有的手机要用户点一下才肯放对方的声音：播放键 / 麦克风键点下去时顺手叫醒
  const unlock = () => { actx(); peers.current.forEach((p) => p.el.play().catch(() => {})); };
  return { micOn, micErr, toggleMic, speaking, linked, unlock };
}
