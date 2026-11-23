'use client';
// 把录好的音频(webm/mp4)在手机上解码,转成 16kHz 单声道 16 位 WAV(DeepSeek 语音识别只收 WAV / Ogg Opus)
export async function toWav16(blob: Blob, maxSec = 60): Promise<string> {
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return '';
  const ctx = new AC();
  try {
    const ab = await blob.arrayBuffer();
    const audio: AudioBuffer = await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    const sr = 16000; const len = Math.min(Math.ceil(audio.duration * sr), maxSec * sr);
    const OAC: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    let pcm: Float32Array;
    if (OAC) {
      const off = new OAC(1, len, sr); const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start(0);
      pcm = (await off.startRendering()).getChannelData(0);
    } else { // 没有离线上下文:简单抽样
      const ch = audio.getChannelData(0); const r = audio.sampleRate / sr; pcm = new Float32Array(len);
      for (let i = 0; i < len; i++) pcm[i] = ch[Math.min(ch.length - 1, Math.floor(i * r))];
    }
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) { const v = Math.max(-1, Math.min(1, pcm[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    const bytes = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  } catch { return ''; } finally { try { ctx.close(); } catch {} }
}
