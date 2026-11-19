// Motion: turns the slides into an animated sequence (used for the live preview and video export).
import { isRtlLang, MOTION_TABLE, BASE } from './model.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const IN = 0.7, STAGGER = 0.13, TRANSITION = 0.5;

const EASE = {
  out: easeOut,
  inout: easeInOut,
  expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  back: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { const u = t - 1.5 / d; return n * u * u + 0.75; }
    if (t < 2.5 / d) { const u = t - 2.25 / d; return n * u * u + 0.9375; }
    const u = t - 2.625 / d; return n * u * u + 0.984375;
  },
};
const DEFS = new Map(MOTION_TABLE.map((r) => [r[0], { enter: r[3], by: r[4] || {} }]));

// Order elements enter in: backdrop shapes first, then text, then devices and the rest.
function entryRank(el) {
  if (el.type === 'shape') return 0;
  if (el.type === 'text') return 1;
  if (el.type === 'screenshot') return 2;
  return 3;
}
function entryOrder(elements, mode) {
  const idx = elements.map((_, i) => i);
  if (mode === 'top') return idx.sort((a, b) => elements[a].y - elements[b].y);
  if (mode === 'bottom') return idx.sort((a, b) => elements[b].y - elements[a].y);
  if (mode === 'center') { const d = (e) => Math.hypot(e.x - BASE.w / 2, e.y - BASE.h / 2); return idx.sort((a, b) => d(elements[a]) - d(elements[b])); }
  return idx.sort((a, b) => entryRank(elements[a]) - entryRank(elements[b]) || a - b);
}

export function elementMotion(preset, el, elements, t, rtl, float = false) {
  const def = DEFS.get(preset) || DEFS.get('rise');
  if (!def.enter && !float) return null;
  const base = def.enter || {};
  const spec = { dx: 0, dy: 0, scale: 1, sx: 1, rot: 0, ease: 'out', dur: IN, stag: STAGGER, fade: 2.2, ...base, ...(def.by[el.type] || {}) };
  const pos = entryOrder(elements, base.order).indexOf(elements.indexOf(el));
  const q = def.enter ? clamp01((t - 0.1 - pos * spec.stag) / spec.dur) : 1;
  const p = (EASE[spec.ease] || easeOut)(q), r = 1 - p;
  const flip = (rtl ? -1 : 1) * (spec.alt && pos % 2 ? -1 : 1);
  const m = {
    dx: r * spec.dx * flip,
    dy: r * spec.dy,
    scale: 1 + (spec.scale - 1) * r,
    sx: 1 + (spec.sx - 1) * r,
    rot: r * spec.rot * (spec.alt && pos % 2 ? -1 : 1),
    alpha: def.enter ? easeOut(clamp01(q * spec.fade)) : 1,
  };
  if (float && q >= 1) {
    // After arriving, drift a few units so the frame never looks frozen.
    const ph = t * 1.6 + pos * 1.3;
    m.dy += Math.sin(ph) * (el.type === 'screenshot' ? 10 : 6);
    if (el.type === 'shape' || el.type === 'sticker' || el.type === 'icon') m.rot += Math.sin(ph * 0.7) * 1.2;
  }
  return m;
}

// Slow move of the whole frame across one slide. u runs 0..1 over the slide's time on screen.
export function cameraAt(camera, u, rtl) {
  const e = easeInOut(clamp01(u));
  if (camera === 'zoom-in') return { k: 1 + 0.07 * e, ox: 0, oy: 0 };
  if (camera === 'zoom-out') return { k: 1.07 - 0.07 * e, ox: 0, oy: 0 };
  if (camera === 'pan-left') return { k: 1.07, ox: (0.03 - 0.06 * e) * (rtl ? -1 : 1), oy: 0 };
  if (camera === 'pan-up') return { k: 1.07, ox: 0, oy: 0.03 - 0.06 * e };
  return null;
}

export function videoDuration(project, motion = project.motion) {
  const n = project.slides.length, D = motion.seconds;
  const T = motion.transition === 'cut' ? 0 : Math.min(TRANSITION, D / 2);
  return n * D - (n - 1) * T;
}

// Draws the frame at `time` seconds onto `canvas`. `scratch` holds two reusable off-screen canvases.
export function renderVideoFrame(studio, canvas, time, { W, H, device, lang, motion }, scratch) {
  const { project } = studio;
  const { preset, transition, seconds: D, float, camera } = motion || project.motion;
  const T = transition === 'cut' ? 0 : Math.min(TRANSITION, D / 2);
  const step = D - T, n = project.slides.length;
  time = Math.max(0, time);
  const i = Math.min(n - 1, Math.floor(time / step));
  const local = time - i * step;
  const rtl = isRtlLang(lang || studio.lang);
  const draw = (target, index, t) => studio.render(target, project.slides[index], {
    W, H, device, lang, final: true,
    anim: (el, _idx, els) => elementMotion(preset, el, els, t, rtl, float),
    camera: cameraAt(camera, t / D, rtl),
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
