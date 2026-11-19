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

export function elementMotion(preset, el, elements, t, rtl) {
  if (preset === 'none') return null;
  const order = elements.map((e, i) => [entryRank(e), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((p) => p[1]);
  const pos = order.indexOf(elements.indexOf(el));
  const p = easeOut(clamp01((t - 0.1 - pos * STAGGER) / IN));
  const m = { dx: 0, dy: 0, scale: 1, alpha: p };
  const kind = preset === 'device' && el.type !== 'screenshot' ? 'fade' : preset;
  if (kind === 'rise') m.dy = (1 - p) * 140;
  else if (kind === 'pop') m.scale = 0.82 + 0.18 * p;
  else if (kind === 'slide') m.dx = (1 - p) * (rtl ? -340 : 340);
  else if (kind === 'device') { m.dy = (1 - p) * 900; m.alpha = clamp01(p * 3); }
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
  const { preset, transition, seconds: D } = project.motion;
  const T = transition === 'cut' ? 0 : Math.min(TRANSITION, D / 2);
  const step = D - T, n = project.slides.length;
  time = Math.max(0, time);
  const i = Math.min(n - 1, Math.floor(time / step));
  const local = time - i * step;
  const rtl = isRtlLang(lang || studio.lang);
  const draw = (target, index, t) => studio.render(target, project.slides[index], {
    W, H, device, lang, final: true,
    anim: (el, _idx, els) => elementMotion(preset, el, els, t, rtl),
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
  } else {
    ctx.drawImage(scratch.a, 0, 0);
    ctx.globalAlpha = p;
    ctx.drawImage(scratch.b, 0, 0);
    ctx.globalAlpha = 1;
  }
}
