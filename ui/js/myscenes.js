// My scenes: the user's own mockup pictures (a photographed or rendered device), kept on this computer only.
// A scene is saved as one full-slide picture plus the corners of each screen in it; see registerUserScene in model.js.
import * as M from './model.js';
import { bridge, isTauri } from './bridge.js';
import { t, localize } from './i18n.js';

const $ = (s) => document.querySelector(s);
const OUT = 1.5; // saved pictures are 1.5x the design size, enough for every store size

// Lays a picture of any shape onto the tall slide: the device is fitted under the caption area, and where the
// picture ends the slide continues in the picture's own edge colour. Returns the baked canvas and the moved corners.
export function bakeScene(img, corners) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, B = M.BASE;
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const pad = 0.16, bw = (Math.max(...xs) - Math.min(...xs)) * (1 + pad * 2), bh = (Math.max(...ys) - Math.min(...ys)) * (1 + pad * 2);
  const bcx = (Math.min(...xs) + Math.max(...xs)) / 2, bcy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let s = Math.min(1180 / bw, 1750 / bh);
  s = Math.max(s, B.w / iw);
  const px = Math.min(0, Math.max(B.w - iw * s, B.w / 2 - bcx * s));
  let py = 1860 - bcy * s;
  if (py + ih * s < B.h) py = B.h - ih * s;
  if (py > 0 && ih * s >= B.h) py = 0;
  // Edge colour: the average of the picture's top rows.
  const probe = Object.assign(document.createElement('canvas'), { width: 32, height: 4 }), pc = probe.getContext('2d', { willReadFrequently: true });
  pc.drawImage(img, 0, 0, iw, Math.max(1, ih * 0.04), 0, 0, 32, 4);
  const d = pc.getImageData(0, 0, 32, 4).data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4, rgb = [r / n, g / n, b / n].map((v) => Math.round(v));
  const fill = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const ink = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) > 150 ? '#141414' : '#ffffff';
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(B.w * OUT), height: Math.round(B.h * OUT) }), ctx = canvas.getContext('2d');
  ctx.fillStyle = fill; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, px * OUT, py * OUT, iw * s * OUT, ih * s * OUT);
  if (py > 0) {
    const gr = ctx.createLinearGradient(0, py * OUT, 0, (py + 300) * OUT);
    gr.addColorStop(0, fill); gr.addColorStop(1, `rgba(${rgb.join(',')},0)`);
    ctx.fillStyle = gr; ctx.fillRect(0, py * OUT - 1, canvas.width, 301 * OUT);
  }
  return { canvas, fill, ink, quad: corners.map(([x, y]) => [Math.round((x * s + px) * 10) / 10, Math.round((y * s + py) * 10) / 10]) };
}

export function initMyScenes({ studio, toast, guard, pickImages }) {
  const dir = () => `${studio.dataDir}/Scenes`;
  let list = [];
  const abs = (p) => (!p || /^([a-zA-Z]:|\/|data:|blob:|https?:)/.test(p) ? p : `${dir()}/${p}`);
  const register = (sc) => M.registerUserScene({ ...sc, image: abs(sc.image), mask: abs(sc.mask), light: abs(sc.light) });
  const changed = () => document.dispatchEvent(new CustomEvent('templates-changed'));
  const store = () => bridge.writeText(`${dir()}/scenes.json`, JSON.stringify({ version: 1, scenes: list }, null, 1));

  async function load() {
    if (!isTauri || !studio.dataDir) return;
    try {
      const data = JSON.parse(await bridge.readText(`${dir()}/scenes.json`));
      list = Array.isArray(data.scenes) ? data.scenes : [];
      for (const sc of list) register(sc);
      if (list.length) changed();
    } catch (_) { /* no scenes yet */ }
  }

  /* ---------- the corner editor ---------- */
  const state = { img: null, src: '', pts: [], scale: 1, grab: -1 };
  const canvas = $('#sceneCanvas');
  function draw() {
    const { img, pts, scale } = state; if (!img) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const k = canvas.width / (img.naturalWidth * scale), P = pts.map(([x, y]) => [x * scale * k, y * scale * k]);
    ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = 'rgba(124,108,255,.22)'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = '#a79bff'; ctx.stroke();
    P.forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, 11 * k, 0, Math.PI * 2); ctx.fillStyle = '#7c6cff'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${12 * k}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 0.5 * k);
    });
  }
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * state.img.naturalWidth, (e.clientY - r.top) / r.height * state.img.naturalHeight]; };
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.img) return;
    const [x, y] = at(e); let best = -1, bd = Infinity;
    state.pts.forEach(([px, py], i) => { const dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = i; } });
    state.grab = best; state.pts[best] = [x, y]; canvas.setPointerCapture(e.pointerId); draw();
  });
  canvas.addEventListener('pointermove', (e) => { if (state.grab < 0) return; const [x, y] = at(e); state.pts[state.grab] = [Math.max(0, Math.min(state.img.naturalWidth, x)), Math.max(0, Math.min(state.img.naturalHeight, y))]; draw(); });
  const drop = () => { state.grab = -1; };
  canvas.addEventListener('pointerup', drop); canvas.addEventListener('pointercancel', drop);

  async function open() {
    if (!isTauri || !studio.dataDir) { toast(t('My scenes need the desktop app')); return; }
    const [src] = await pickImages(false);
    if (!src) return;
    await studio.loadImage(src);
    const img = studio.images.get(src);
    if (!img) { toast(studio.failedImages.get(src) || 'Could not open that picture'); return; }
    const w = img.naturalWidth, h = img.naturalHeight;
    state.img = img; state.src = src; state.scale = 1;
    // A first guess: an upright phone screen in the middle of the picture.
    const sh = h * 0.6, sw = sh * 0.46;
    state.pts = [[w / 2 - sw / 2, h / 2 - sh / 2], [w / 2 + sw / 2, h / 2 - sh / 2], [w / 2 + sw / 2, h / 2 + sh / 2], [w / 2 - sw / 2, h / 2 + sh / 2]];
    const fit = Math.min(1640 / w, 1000 / h, 1);
    canvas.width = Math.round(w * fit); canvas.height = Math.round(h * fit);
    canvas.style.width = `${Math.round(Math.min(820 / w, 500 / h, 1) * w)}px`;
    $('#sceneName').value = String(src).split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 60);
    const d = $('#sceneDlg'); localize(d); if (!d.open) d.showModal();
    draw();
  }

  async function save() {
    const { img, pts } = state; if (!img) return;
    const baked = bakeScene(img, pts);
    const id = `s${Date.now().toString(36)}`;
    await bridge.saveImage(`${dir()}/${id}.jpg`, baked.canvas.toDataURL('image/png').split(',')[1], 'jpg', 90);
    const sc = { id, label: $('#sceneName').value.trim() || 'My scene', image: `${id}.jpg`, fill: baked.fill, ink: baked.ink, screens: [{ quad: baked.quad, radius: Number($('#sceneRadius').value) / 100 }] };
    list.push(sc); await store(); register(sc);
    $('#sceneDlg').close(); state.img = null; changed(); toast(t('Scene saved'));
  }

  $('#tplAddScene').addEventListener('click', guard(open));
  $('#sceneSave').addEventListener('click', guard(save));
  document.addEventListener('scene-remove', guard(async (e) => {
    const id = e.detail, sc = M.USER_SCENES[id]; if (!sc) return;
    list = list.filter((x) => `mine-${String(x.id).replace(/[^a-z0-9-]/gi, '-')}` !== id);
    await store(); M.removeUserScene(id); changed(); toast(t('Scene removed'));
  }));
  return { load };
}
