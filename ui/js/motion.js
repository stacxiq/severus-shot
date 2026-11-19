// Motion: turns the slides into an animated sequence (used for the live preview and video export).
import { isRtlLang } from './model.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const IN = 0.7, STAGGER = 0.13, TRANSITION = 0.5;

// Order elements enter in: backdrop shapes first, then text, then devices and the rest.
function entryRank(el) {
  if (el.type === 'shape') return 0;
  if (el.type === 'text') return 1;
  if (el.type === 'screenshot') return 2;
  return 3;
}

export function elementMotion(preset, el, elements, t, rtl, float = false) {
  if (preset === 'none' && !float) return null;
  const order = elements.map((e, i) => [entryRank(e), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((p) => p[1]);
  const pos = order.indexOf(elements.indexOf(el));
  const p = easeOut(clamp01((t - 0.1 - pos * STAGGER) / IN));
  const m = { dx: 0, dy: 0, scale: 1, alpha: preset === 'none' ? 1 : p, rot: 0 };
  const kind = preset === 'device' && el.type !== 'screenshot' ? 'fade' : preset;
  if (kind === 'rise') m.dy = (1 - p) * 140;
  else if (kind === 'pop') m.scale = 0.82 + 0.18 * p;
  else if (kind === 'slide') m.dx = (1 - p) * (rtl ? -340 : 340);
  else if (kind === 'device') { m.dy = (1 - p) * 900; m.alpha = clamp01(p * 3); }
  else if (kind === 'drop') {
    // Falls from above and settles with a small bounce.
    const q = clamp01((t - 0.1 - pos * STAGGER) / 0.9);
    const bounce = q < 0.6 ? (q / 0.6) ** 2 : 1 - Math.abs(Math.sin(((q - 0.6) / 0.4) * Math.PI)) * 0.12 * (1 - q);
    m.dy = -(1 - bounce) * 520; m.alpha = clamp01(q * 4);
  } else if (kind === 'zoom') m.scale = 1.35 - 0.35 * p;
  else if (kind === 'swing') { m.rot = (1 - p) * (pos % 2 ? 14 : -14); m.dy = (1 - p) * 60; }
  if (float && p >= 1) {
    // After arriving, drift a few units so the frame never looks frozen.
    const ph = t * 1.6 + pos * 1.3;
    m.dy += Math.sin(ph) * (el.type === 'screenshot' ? 10 : 6);
    if (el.type === 'shape' || el.type === 'sticker' || el.type === 'icon') m.rot = (m.rot || 0) + Math.sin(ph * 0.7) * 1.2;
  }
  return m;
}

export function videoDuration(project) {
  const n = project.slides.length, D = project.motion.seconds;
  const T = project.motion.transition === 'cut' ? 0 : Math.min(TRANSITION, D / 2);
  return n * D - (n - 1) * T;
}

// Draws the frame at `time` seconds onto `canvas`. `scratch` holds two reusable off-screen canvases.
export function renderVideoFrame(studio, canvas, time, { W, H, device, lang }, scratch) {
  const { project } = studio;
  const { preset, transition, seconds: D, float } = project.motion;
  const T = transition === 'cut' ? 0 : Math.min(TRANSITION, D / 2);
  const step = D - T, n = project.slides.length;
  time = Math.max(0, time);
  const i = Math.min(n - 1, Math.floor(time / step));
  const local = time - i * step;
  const rtl = isRtlLang(lang || studio.lang);
  const draw = (target, index, t) => studio.render(target, project.slides[index], {
    W, H, device, lang, final: true,
    anim: (el, _idx, els) => elementMotion(preset, el, els, t, rtl, float),
  });
  if (i === 0 || local >= T || T === 0) { draw(canvas, i, local); return; }
  const p = easeInOut(clamp01(local / T));
  draw(scratch.a, i - 1, time - (i - 1) * step);
  draw(scratch.b, i, local);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  if (transition === 'push') {
    const dir = rtl ? 1 : -1;
    ctx.drawImage(scratch.a, dir * p * W, 0);
    ctx.drawImage(scratch.b, dir * (p - 1) * W, 0);
  } else if (transition === 'up') {
    ctx.drawImage(scratch.a, 0, -p * H);
    ctx.drawImage(scratch.b, 0, (1 - p) * H);
  } else if (transition === 'zoom') {
    const za = 1 + p * 0.25, zb = 0.8 + p * 0.2;
    ctx.globalAlpha = 1 - p;
    ctx.drawImage(scratch.a, (W - W * za) / 2, (H - H * za) / 2, W * za, H * za);
    ctx.globalAlpha = p;
    ctx.drawImage(scratch.b, (W - W * zb) / 2, (H - H * zb) / 2, W * zb, H * zb);
    ctx.globalAlpha = 1;
  } else if (transition === 'wipe') {
    ctx.drawImage(scratch.a, 0, 0);
    const edge = rtl ? W * (1 - p) : 0, ww = W * p;
    ctx.save(); ctx.beginPath(); ctx.rect(edge, 0, ww, H); ctx.clip();
    ctx.drawImage(scratch.b, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(scratch.a, 0, 0);
    ctx.globalAlpha = p;
    ctx.drawImage(scratch.b, 0, 0);
    ctx.globalAlpha = 1;
  }
}
