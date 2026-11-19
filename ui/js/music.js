// Built-in background music, synthesised in the app (original, so free to use in any video).
export const TRACKS = { calm: 'Calm pad', upbeat: 'Upbeat pulse', lofi: 'Lo-fi keys', bright: 'Bright pluck' };

const N = (semi) => 220 * 2 ** (semi / 12); // semitones from A3
const SONGS = {
  calm: { bpm: 72, chords: [[0, 4, 7, 11], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]], pad: 'sine', drums: false, arp: false },
  upbeat: { bpm: 118, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]], pad: 'triangle', drums: true, arp: true },
  lofi: { bpm: 84, chords: [[-2, 2, 5, 9], [-7, -3, 0, 5], [-4, 0, 3, 7], [-9, -5, -2, 3]], pad: 'triangle', drums: true, arp: false },
  bright: { bpm: 104, chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], pad: 'sine', drums: false, arp: true },
};

function tone(ctx, out, { freq, start, dur, type = 'sine', gain = 0.1, attack = 0.02, release = 0.2, cutoff = 0 }) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.setValueAtTime(gain, Math.max(start + attack, start + dur - release));
  g.gain.linearRampToValueAtTime(0, start + dur);
  let node = osc;
  if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; osc.connect(f); node = f; }
  node.connect(g); g.connect(out);
  osc.start(start); osc.stop(start + dur + 0.05);
}
function kick(ctx, out, start) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.frequency.setValueAtTime(140, start);
  osc.frequency.exponentialRampToValueAtTime(42, start + 0.16);
  g.gain.setValueAtTime(0.5, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
  osc.connect(g); g.connect(out); osc.start(start); osc.stop(start + 0.3);
}
function hat(ctx, out, start, noise, level = 0.07) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
  g.gain.setValueAtTime(level, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
  src.connect(f); f.connect(g); g.connect(out); src.start(start); src.stop(start + 0.08);
}

// Renders `seconds` of a track and returns an AudioBuffer.
export async function renderTrack(id, seconds, sampleRate = 44100) {
  const song = SONGS[id] || SONGS.calm;
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, 0.35);
  master.gain.setValueAtTime(0.9, Math.max(0.4, seconds - 1.1));
  master.gain.linearRampToValueAtTime(0, seconds);
  master.connect(ctx.destination);
  const noise = ctx.createBuffer(1, sampleRate * 0.1, sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i += 1) nd[i] = Math.random() * 2 - 1;
  const beat = 60 / song.bpm, bar = beat * 4;
  for (let b = 0; b * bar < seconds; b += 1) {
    const t0 = b * bar, chord = song.chords[b % song.chords.length];
    for (const semi of chord) {
      tone(ctx, master, { freq: N(semi), start: t0, dur: bar * 1.02, type: song.pad, gain: 0.07, attack: 0.25, release: 0.5, cutoff: 1800 });
      tone(ctx, master, { freq: N(semi) * 1.004, start: t0, dur: bar * 1.02, type: 'sine', gain: 0.035, attack: 0.3, release: 0.5 });
    }
    tone(ctx, master, { freq: N(chord[0] - 12), start: t0, dur: bar, type: 'sine', gain: 0.16, attack: 0.02, release: 0.3 });
    for (let s = 0; s < 8; s += 1) {
      const ts = t0 + s * (beat / 2);
      if (ts >= seconds) break;
      if (song.arp) tone(ctx, master, { freq: N(chord[s % chord.length] + 12), start: ts, dur: beat * 0.45, type: 'triangle', gain: 0.08, attack: 0.005, release: beat * 0.3, cutoff: 3200 });
      if (song.drums) {
        if (s % 4 === 0 || (id === 'upbeat' && s % 2 === 0)) kick(ctx, master, ts);
        if (s % 2 === 1) hat(ctx, master, ts, noise, id === 'lofi' ? 0.045 : 0.07);
      }
    }
  }
  return ctx.startRendering();
}

// AudioBuffer -> 16-bit PCM WAV, as base64.
export function wavBase64(buffer) {
  const ch = Math.min(2, buffer.numberOfChannels), len = buffer.length, rate = buffer.sampleRate;
  const bytes = new Uint8Array(44 + len * ch * 2), dv = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i += 1) for (let c = 0; c < ch; c += 1) { const v = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
