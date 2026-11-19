// Canvas renderer. One code path draws the editor preview, the exports and agent previews.
import { BASE, elementText, isRtlText, isRtlLang } from './model.js';

const GENERIC = new Set(['system-ui', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'ui-sans-serif', 'ui-serif', 'ui-rounded', 'ui-monospace']);
export function cssFamily(family) {
  const f = String(family || 'system-ui').replace(/["';{}\\<>]/g, '').trim() || 'system-ui';
  return GENERIC.has(f) ? f : `"${f}"`;
}
export function fontSpec(el, px) {
  return `${el.italic ? 'italic ' : ''}${el.fontWeight || 400} ${px}px ${cssFamily(el.fontFamily)}, "Inter", "IBM Plex Sans Arabic", system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
}

// The design canvas is scaled uniformly to fit the target size and centred, so a layout keeps
// its proportions on every store size; the background always fills the whole canvas.
export function makeEnv(W, H, device = 'phone') {
  const s = Math.min(W / BASE.w, H / BASE.h);
  return { W, H, sx: s, sy: s, s, device };
}
export const toCanvasX = (env, x) => env.W / 2 + (x - BASE.w / 2) * env.sx;
export const toCanvasY = (env, y) => env.H / 2 + (y - BASE.h / 2) * env.sy;

// Reads any CSS colour back as [r, g, b, a] using the canvas itself.
export function rgba(ctx, color) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  const v = String(ctx.fillStyle);
  ctx.restore();
  if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/[\d.]+/g) || [0, 0, 0, 1];
  return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
}
// amount > 0 lightens towards white, < 0 darkens towards black.
function shade(ctx, color, amount, alpha) {
  const [r, g, b, a] = rgba(ctx, color);
  const t = amount > 0 ? 255 : 0, k = Math.abs(amount);
  const mix = (c) => Math.round(c + (t - c) * k);
  return `rgba(${mix(r)},${mix(g)},${mix(b)},${alpha === undefined ? a : alpha})`;
}

export const FRAME_GEOM = {
  phone: { bezel: 0.04, radius: 0.165 },
  'phone-notch': { bezel: 0.045, radius: 0.15 },
  android: { bezel: 0.03, radius: 0.115 },
  tablet: { bezel: 0.038, radius: 0.065 },
  clay: { bezel: 0.055, radius: 0.17 },
  outline: { bezel: 0.04, radius: 0.16 },
  glass: { bezel: 0.04, radius: 0.15 },
  none: { bezel: 0, radius: 0.06 },
};

function rr(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih);
  const sw = w / k, sh = h / k;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function drawBackground(ctx, bg, env, opts) {
  const { W, H } = env;
  ctx.save();
  if (bg.type === 'gradient') {
    const rad = ((bg.angle - 90) * Math.PI) / 180;
    const cx = Math.cos(rad), cy = Math.sin(rad);
    const L = (Math.abs(W * cx) + Math.abs(H * cy)) / 2;
    const g = ctx.createLinearGradient(W / 2 - cx * L, H / 2 - cy * L, W / 2 + cx * L, H / 2 + cy * L);
    for (const st of bg.stops) g.addColorStop(st.pos, st.color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === 'image') {
    ctx.fillStyle = bg.color || '#000';
    ctx.fillRect(0, 0, W, H);
    const img = opts.getImage(bg.src);
    if (img) {
      const blur = (bg.blur || 0) * env.s;
      if (blur > 0.5 && opts.createCanvas) {
        // Portable blur (canvas filters are missing in some web views): halve the picture
        // repeatedly, then double it back up. Each smooth resize step softens it further.
        const steps = Math.max(1, Math.min(7, Math.round(Math.log2(blur) + 1)));
        let cur = opts.createCanvas(Math.max(2, Math.round(W / 2)), Math.max(2, Math.round(H / 2)));
        let c = cur.getContext('2d');
        c.imageSmoothingQuality = 'high';
        drawCover(c, img, 0, 0, cur.width, cur.height);
        const resize = (src, w, h) => {
          const next = opts.createCanvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
          const n = next.getContext('2d');
          n.imageSmoothingEnabled = true;
          n.imageSmoothingQuality = 'high';
          n.drawImage(src, 0, 0, src.width, src.height, 0, 0, next.width, next.height);
          return next;
        };
        for (let i = 1; i < steps; i += 1) cur = resize(cur, cur.width / 2, cur.height / 2);
        for (let i = 1; i < steps; i += 1) cur = resize(cur, cur.width * 2, cur.height * 2);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cur, 0, 0, cur.width, cur.height, 0, 0, W, H);
      } else {
        drawCover(ctx, img, 0, 0, W, H);
      }
    }
    if (bg.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${bg.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = bg.color || '#101218';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

export function layoutText(ctx, el, text, s, lang) {
  const px = el.fontSize * s;
  ctx.font = fontSpec(el, px);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(el.letterSpacing || 0) * s}px`;
  const maxW = el.w * s;
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const next = `${line} ${words[i]}`;
      if (ctx.measureText(next).width <= maxW) line = next;
      else { lines.push(line); line = words[i]; }
    }
    lines.push(line);
  }
  const lineH = px * el.lineHeight;
  const rtl = el.dir === 'rtl' || (el.dir === 'auto' && (isRtlText(text) || (!/[A-Za-z]/.test(text) && isRtlLang(lang))));
  return { lines, lineH, height: Math.max(lineH, lines.length * lineH), px, rtl };
}

function drawText(ctx, el, env, opts) {
  const text = elementText(el, opts.lang, opts.languages);
  const L = layoutText(ctx, el, text, env.s, opts.lang);
  const w = el.w * env.s;
  let align = el.align;
  if (align === 'start') align = L.rtl ? 'right' : 'left';
  ctx.direction = L.rtl ? 'rtl' : 'ltr';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = el.color;
  if (el.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = L.px * 0.18;
    ctx.shadowOffsetY = L.px * 0.06;
  }
  const x = align === 'left' ? -w / 2 : align === 'right' ? w / 2 : 0;
  L.lines.forEach((line, i) => ctx.fillText(line, x, -L.height / 2 + L.lineH * (i + 0.5)));
  return { w, h: L.height };
}

export function effectiveFrame(el, env) {
  if (el.frame !== 'auto') return el.frame;
  return env.device === 'tablet' ? 'tablet' : 'phone';
}

// Size of a screenshot element on the canvas. On tablet canvases an "auto" frame becomes a tablet.
export function screenshotBox(el, env, opts) {
  let w = el.w * env.s, h = el.h * env.s;
  const frame = effectiveFrame(el, env);
  if (el.frame === 'auto' && frame === 'tablet') {
    const img = opts.getImage(el.srcTablet || '');
    const iw = img && (img.naturalWidth || img.width), ih = img && (img.naturalHeight || img.height);
    const aspect = iw && ih ? iw / ih : 0.75;
    w = h * aspect;
    const maxW = env.W * 0.86;
    if (w > maxW) { h *= maxW / w; w = maxW; }
  }
  return { w, h, frame };
}

function drawScreenshot(ctx, el, env, opts) {
  const { w, h, frame } = screenshotBox(el, env, opts);
  const img = opts.getImage((frame === 'tablet' && el.srcTablet) || el.src);
  const x = -w / 2, y = -h / 2;
  const G = FRAME_GEOM[frame];
  const bezel = w * G.bezel, R = w * G.radius, fc = el.frameColor;
  const realistic = frame === 'phone' || frame === 'phone-notch' || frame === 'android' || frame === 'tablet';

  // Body, with the drop shadow.
  ctx.save();
  if (el.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.36)';
    ctx.shadowBlur = w * 0.1;
    ctx.shadowOffsetY = w * 0.04;
  }
  rr(ctx, x, y, w, h, R);
  if (realistic) {
    // Brushed-metal rim: light catches the edges, darker in between.
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, shade(ctx, fc, 0.42));
    g.addColorStop(0.06, shade(ctx, fc, 0.1));
    g.addColorStop(0.5, shade(ctx, fc, -0.12));
    g.addColorStop(0.94, shade(ctx, fc, 0.1));
    g.addColorStop(1, shade(ctx, fc, 0.36));
    ctx.fillStyle = g;
    ctx.fill();
  } else if (frame === 'clay') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(ctx, fc, 0.1));
    g.addColorStop(1, shade(ctx, fc, -0.1));
    ctx.fillStyle = g;
    ctx.fill();
  } else if (frame === 'glass') {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
  } else if (frame === 'outline') {
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(1.5, w * 0.012);
    ctx.strokeStyle = fc;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1b1e26';
    ctx.fill();
  }
  ctx.restore();

  if (realistic) {
    // Side buttons, then the black glass border inside the metal rim.
    ctx.fillStyle = shade(ctx, fc, -0.05);
    if (frame !== 'tablet') {
      const bw = w * 0.013;
      rr(ctx, x + w - 1, y + h * 0.215, bw, h * 0.095, bw / 2); ctx.fill();
      rr(ctx, x - bw + 1, y + h * 0.15, bw, h * 0.032, bw / 2); ctx.fill();
      rr(ctx, x - bw + 1, y + h * 0.205, bw, h * 0.058, bw / 2); ctx.fill();
      rr(ctx, x - bw + 1, y + h * 0.275, bw, h * 0.058, bw / 2); ctx.fill();
    }
    const rim = w * 0.011;
    rr(ctx, x + rim, y + rim, w - rim * 2, h - rim * 2, R - rim);
    ctx.fillStyle = '#06070a';
    ctx.fill();
  } else if (frame === 'glass') {
    rr(ctx, x + 1, y + 1, w - 2, h - 2, R);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, w * 0.005);
    ctx.stroke();
  } else if (frame === 'clay') {
    rr(ctx, x + w * 0.006, y + w * 0.006, w - w * 0.012, h - w * 0.012, R - w * 0.006);
    ctx.strokeStyle = shade(ctx, fc, 0.25, 0.5);
    ctx.lineWidth = Math.max(1, w * 0.006);
    ctx.stroke();
  }

  const sxr = x + bezel, syr = y + bezel, sw = w - bezel * 2, sh = h - bezel * 2;
  const SR = Math.max(0, R - bezel);
  ctx.save();
  rr(ctx, sxr, syr, sw, sh, SR);
  ctx.clip();
  if (img) {
    ctx.imageSmoothingQuality = 'high';
    drawCover(ctx, img, sxr, syr, sw, sh);
  } else {
    const g = ctx.createLinearGradient(sxr, syr, sxr, syr + sh);
    g.addColorStop(0, '#3a4152');
    g.addColorStop(1, '#232733');
    ctx.fillStyle = g;
    ctx.fillRect(sxr, syr, sw, sh);
    if (!opts.final) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `600 ${w * 0.06}px "Inter", "IBM Plex Sans Arabic", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'ltr';
      ctx.fillText(opts.placeholder || 'Drop a screenshot', 0, 0);
    }
  }
  if (el.glare) {
    // A diagonal sheen across the glass.
    const g = ctx.createLinearGradient(sxr, syr, sxr + sw, syr + sh * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.46, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sxr, syr);
    ctx.lineTo(sxr + sw * 0.95, syr);
    ctx.lineTo(sxr + sw * 0.2, syr + sh * 0.75);
    ctx.lineTo(sxr, syr + sh * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Camera cut-outs.
  ctx.fillStyle = '#05060a';
  if (frame === 'phone') {
    rr(ctx, -w * 0.145, syr + w * 0.03, w * 0.29, w * 0.082, w * 0.041);
    ctx.fill();
    ctx.fillStyle = '#12152080';
    ctx.beginPath();
    ctx.arc(w * 0.09, syr + w * 0.071, w * 0.016, 0, Math.PI * 2);
    ctx.fill();
  } else if (frame === 'phone-notch') {
    rr(ctx, -w * 0.2, syr - w * 0.06, w * 0.4, w * 0.125, w * 0.05);
    ctx.fill();
  } else if (frame === 'android') {
    ctx.beginPath();
    ctx.arc(0, syr + w * 0.06, w * 0.022, 0, Math.PI * 2);
    ctx.fill();
  } else if (frame === 'tablet') {
    ctx.fillStyle = '#1a1d26';
    ctx.beginPath();
    ctx.arc(0, y + bezel / 2, w * 0.006, 0, Math.PI * 2);
    ctx.fill();
  }
  return { w, h };
}

function drawImageEl(ctx, el, env, opts) {
  const w = el.w * env.s, h = el.h * env.s;
  const img = opts.getImage(el.src);
  ctx.save();
  rr(ctx, -w / 2, -h / 2, w, h, el.radius * env.s);
  ctx.clip();
  if (img) {
    ctx.imageSmoothingQuality = 'high';
    drawCover(ctx, img, -w / 2, -h / 2, w, h);
  } else if (!opts.final) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  return { w, h };
}

// Small deterministic random generator so a blob keeps its outline between renders.
function rng(seed) {
  let t = (seed + 1) * 0x9e3779b9;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function drawShape(ctx, el, env) {
  const w = el.w * env.s, h = el.h * env.s, rx = w / 2, ry = h / 2;
  const lw = Math.min(el.stroke * env.s, Math.min(w, h) / 2);
  let paint = el.fill;
  if (el.fill2 && el.shape !== 'glow') {
    paint = ctx.createLinearGradient(0, -ry, 0, ry);
    paint.addColorStop(0, el.fill);
    paint.addColorStop(1, el.fill2);
  }
  ctx.fillStyle = paint;
  ctx.strokeStyle = paint;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const polygon = (pts) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); };
  switch (el.shape) {
    case 'ellipse':
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'ring':
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, rx - lw / 2), Math.max(1, ry - lw / 2), 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'arc':
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, rx - lw / 2), Math.max(1, ry - lw / 2), 0, Math.PI, Math.PI * 2); ctx.stroke();
      break;
    case 'glow': {
      const [r, g, b] = rgba(ctx, el.fill);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.save();
      ctx.scale(rx, ry);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
    case 'blob': {
      const rand = rng(el.seed), n = 8, pts = [];
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2, k = 0.72 + rand() * 0.28;
        pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
      }
      // Smooth closed curve through the midpoints.
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      ctx.beginPath();
      ctx.moveTo(...mid(pts[n - 1], pts[0]));
      for (let i = 0; i < n; i += 1) ctx.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]));
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? 0.42 : 1;
        pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
      }
      polygon(pts);
      break;
    }
    case 'sparkle':
      // Four points with curved, pinched sides.
      ctx.beginPath();
      ctx.moveTo(0, -ry);
      ctx.quadraticCurveTo(rx * 0.12, -ry * 0.12, rx, 0);
      ctx.quadraticCurveTo(rx * 0.12, ry * 0.12, 0, ry);
      ctx.quadraticCurveTo(-rx * 0.12, ry * 0.12, -rx, 0);
      ctx.quadraticCurveTo(-rx * 0.12, -ry * 0.12, 0, -ry);
      ctx.closePath(); ctx.fill();
      break;
    case 'triangle':
      polygon([[0, -ry], [rx, ry], [-rx, ry]]);
      break;
    case 'dots': {
      const r = Math.max(1, (el.stroke * env.s) / 2), gap = r * 4.2;
      const cols = Math.max(1, Math.floor((w - 2 * r) / gap) + 1), rows = Math.max(1, Math.floor((h - 2 * r) / gap) + 1);
      const x0 = -((cols - 1) * gap) / 2, y0 = -((rows - 1) * gap) / 2;
      ctx.beginPath();
      for (let i = 0; i < Math.min(cols, 60); i += 1) for (let j = 0; j < Math.min(rows, 60); j += 1) { ctx.moveTo(x0 + i * gap + r, y0 + j * gap); ctx.arc(x0 + i * gap, y0 + j * gap, r, 0, Math.PI * 2); }
      ctx.fill();
      break;
    }
    case 'squiggle': {
      const amp = Math.max(1, ry - lw / 2), len = w - lw, waves = Math.max(1, Math.round(len / Math.max(1, h * 1.6)));
      ctx.beginPath();
      for (let i = 0; i <= 80; i += 1) {
        const t = i / 80, px = -len / 2 + t * len, py = Math.sin(t * waves * Math.PI * 2) * amp;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      break;
    }
    default:
      rr(ctx, -rx, -ry, w, h, el.shape === 'pill' ? Math.min(w, h) / 2 : el.radius * env.s);
      ctx.fill();
  }
  return { w, h };
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? 0.45 : 1;
    ctx.lineTo(cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k);
  }
  ctx.closePath();
  ctx.fill();
}
const stickerFont = (el, px, weight = 700) => `${weight} ${px}px ${cssFamily(el.fontFamily)}, "Inter", "IBM Plex Sans Arabic", system-ui, sans-serif`;
function fitText(ctx, el, text, maxW, px, weight) {
  let size = px;
  ctx.font = stickerFont(el, size, weight);
  const w = ctx.measureText(text).width;
  if (w > maxW && w > 0) { size = Math.max(6, (size * maxW) / w); ctx.font = stickerFont(el, size, weight); }
  return size;
}

// Stickers and small components: one element each, drawn from code so they stay sharp at any size.
function drawSticker(ctx, el, env) {
  const w = el.w * env.s, h = el.h * env.s, x = -w / 2, y = -h / 2;
  const lines = String(el.text || '').split('\n');
  const rtl = isRtlText(el.text);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (el.kind) {
    case 'rating': {
      const hasText = !!lines[0];
      const r = h * 0.42, gap = r * 2.15, starsW = gap * 4 + r * 2;
      ctx.font = stickerFont(el, h * 0.78, 800);
      const tw = hasText ? ctx.measureText(lines[0]).width + h * 0.3 : 0;
      const k = Math.min(1, w / (starsW + tw));
      ctx.save();
      ctx.scale(k, k);
      let sx = -(starsW + tw) / 2;
      if (hasText) {
        ctx.fillStyle = el.color;
        ctx.textAlign = 'left';
        ctx.direction = 'ltr';
        ctx.fillText(lines[0], sx, h * 0.03);
        sx += tw;
      }
      ctx.fillStyle = el.fill;
      for (let i = 0; i < 5; i += 1) star(ctx, sx + r + i * gap, 0, r);
      ctx.restore();
      break;
    }
    case 'laurel': {
      // Two mirrored branches of leaves around the text.
      ctx.fillStyle = el.fill;
      const R = Math.min(w * 0.44, h * 0.46), n = 9;
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i += 1) {
          const u = i / (n - 1), phi = ((22 + u * 132) * Math.PI) / 180;
          ctx.save();
          ctx.translate(side * R * Math.sin(phi), R * Math.cos(phi));
          ctx.rotate(Math.atan2(-Math.sin(phi), side * Math.cos(phi)) + side * 0.55);
          ctx.beginPath();
          ctx.ellipse(0, 0, R * 0.17 * (0.75 + 0.25 * Math.sin(u * Math.PI)), R * 0.065, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = el.color;
      const inner = R * 1.25;
      if (lines[0]) { fitText(ctx, el, lines[0], inner, h * 0.34, 800); ctx.fillText(lines[0], 0, lines[1] ? -h * 0.1 : 0); }
      if (lines[1]) { fitText(ctx, el, lines[1], inner, h * 0.12, 600); ctx.fillText(lines[1], 0, h * 0.17); }
      break;
    }
    case 'pill': {
      ctx.fillStyle = el.fill;
      rr(ctx, x, y, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = el.color;
      fitText(ctx, el, lines[0] || '', w - h * 0.8, h * 0.46, 700);
      ctx.fillText(lines[0] || '', 0, h * 0.02);
      break;
    }
    case 'bubble': {
      const bh = h * 0.8, r = Math.min(bh * 0.32, w * 0.2);
      ctx.fillStyle = el.fill;
      rr(ctx, x, y, w, bh, r);
      ctx.fill();
      ctx.beginPath();
      const tx = rtl ? w * 0.22 : -w * 0.22;
      ctx.moveTo(tx - w * 0.07, y + bh - 2);
      ctx.lineTo(tx + w * 0.07, y + bh - 2);
      ctx.lineTo(tx - (rtl ? -1 : 1) * w * 0.05, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = el.color;
      const size = Math.min(bh * 0.3, (bh * 0.72) / lines.length);
      lines.forEach((ln, i) => { fitText(ctx, el, ln, w * 0.86, size, 700); ctx.fillText(ln, 0, y + bh / 2 + (i - (lines.length - 1) / 2) * size * 1.2); });
      break;
    }
    case 'burst': {
      ctx.fillStyle = el.fill;
      ctx.beginPath();
      for (let i = 0; i < 32; i += 1) {
        const a = (i / 32) * Math.PI * 2, k = i % 2 ? 0.84 : 1;
        ctx.lineTo(Math.cos(a) * (w / 2) * k, Math.sin(a) * (h / 2) * k);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = el.color;
      fitText(ctx, el, lines[0] || '', w * 0.62, h * 0.26, 800);
      ctx.fillText(lines[0] || '', 0, h * 0.01);
      break;
    }
    case 'notification': {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = h * 0.3;
      ctx.shadowOffsetY = h * 0.1;
      ctx.fillStyle = el.fill;
      rr(ctx, x, y, w, h, h * 0.26);
      ctx.fill();
      ctx.restore();
      const pad = h * 0.18, ic = h - pad * 2;
      const ix = rtl ? x + w - pad - ic : x + pad;
      const g = ctx.createLinearGradient(ix, y + pad, ix + ic, y + pad + ic);
      g.addColorStop(0, '#8b5cf6');
      g.addColorStop(1, '#22d3ee');
      ctx.fillStyle = g;
      rr(ctx, ix, y + pad, ic, ic, ic * 0.26);
      ctx.fill();
      const tx = rtl ? ix - pad * 0.8 : ix + ic + pad * 0.8, maxW = w - ic - pad * 3;
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillStyle = el.color;
      fitText(ctx, el, lines[0] || '', maxW, h * 0.23, 700);
      ctx.fillText(lines[0] || '', tx, lines[1] ? -h * 0.14 : 0);
      if (lines[1]) {
        ctx.globalAlpha *= 0.65;
        fitText(ctx, el, lines[1], maxW, h * 0.17, 500);
        ctx.fillText(lines[1], tx, h * 0.17);
      }
      break;
    }
    case 'check': {
      const r = h * 0.44, cxp = rtl ? w / 2 - r : -w / 2 + r;
      ctx.fillStyle = el.fill;
      ctx.beginPath();
      ctx.arc(cxp, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.24;
      ctx.beginPath();
      ctx.moveTo(cxp - r * 0.42, r * 0.02);
      ctx.lineTo(cxp - r * 0.1, r * 0.34);
      ctx.lineTo(cxp + r * 0.44, -r * 0.3);
      ctx.stroke();
      ctx.fillStyle = el.color;
      ctx.textAlign = rtl ? 'right' : 'left';
      fitText(ctx, el, lines[0] || '', w - r * 2.7, h * 0.52, 600);
      ctx.fillText(lines[0] || '', rtl ? cxp - r * 1.5 : cxp + r * 1.5, h * 0.03);
      break;
    }
    case 'arrow': {
      ctx.strokeStyle = el.fill;
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.07);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, y + h * 0.12);
      ctx.quadraticCurveTo(x + w * 0.95, y + h * 0.15, x + w * 0.72, y + h * 0.86);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y + h * 0.66);
      ctx.lineTo(x + w * 0.72, y + h * 0.88);
      ctx.lineTo(x + w * 0.93, y + h * 0.62);
      ctx.stroke();
      break;
    }
    case 'underline': {
      ctx.strokeStyle = el.fill;
      ctx.lineWidth = Math.max(2, h * 0.28);
      ctx.beginPath();
      ctx.moveTo(x + h * 0.2, y + h * 0.35);
      ctx.quadraticCurveTo(0, y - h * 0.1, x + w - h * 0.2, y + h * 0.3);
      ctx.quadraticCurveTo(w * 0.1, y + h * 0.5, x + w * 0.3, y + h * 0.82);
      ctx.stroke();
      break;
    }
    default: {
      // emoji
      ctx.font = `${Math.min(w, h) * 0.86}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillStyle = el.color;
      ctx.fillText(lines[0] || '', 0, h * 0.05);
    }
  }
  return { w, h };
}

// Draws one slide and returns the on-canvas box of every element (used for selection and hit tests).
export function renderSlide(ctx, project, slide, options) {
  const opts = { lang: 'en', languages: project.languages, getImage: () => null, final: false, ...options };
  const env = makeEnv(opts.W, opts.H, opts.device || 'phone');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, env.W, env.H);
  drawBackground(ctx, slide.background, env, opts);
  const boxes = [];
  slide.elements.forEach((el, index) => {
    // Motion: an optional per-element offset, scale and fade for video frames.
    const m = opts.anim ? opts.anim(el, index, slide.elements) : null;
    const cx = toCanvasX(env, el.x) + (m ? m.dx * env.s : 0), cy = toCanvasY(env, el.y) + (m ? m.dy * env.s : 0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    if (m && m.scale !== 1) ctx.scale(m.scale, m.scale);
    ctx.globalAlpha = el.opacity * (m ? m.alpha : 1);
    let box;
    if (el.type === 'text') box = drawText(ctx, el, env, opts);
    else if (el.type === 'screenshot') box = drawScreenshot(ctx, el, env, opts);
    else if (el.type === 'image') box = drawImageEl(ctx, el, env, opts);
    else if (el.type === 'sticker') box = drawSticker(ctx, el, env);
    else box = drawShape(ctx, el, env);
    ctx.restore();
    boxes.push({ id: el.id, cx, cy, w: box.w, h: box.h, rot: el.rotation });
  });
  ctx.restore();
  return { boxes, env };
}

export function hitTest(boxes, px, py) {
  for (let i = boxes.length - 1; i >= 0; i -= 1) {
    const b = boxes[i];
    const a = (-b.rot * Math.PI) / 180;
    const dx = px - b.cx, dy = py - b.cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= Math.max(b.w / 2, 8) && Math.abs(ly) <= Math.max(b.h / 2, 8)) return b;
  }
  return null;
}

export function imageSources(project) {
  const set = new Set();
  for (const s of project.slides) {
    if (s.background.type === 'image' && s.background.src) set.add(s.background.src);
    for (const e of s.elements) {
      if (e.src) set.add(e.src);
      if (e.srcTablet) set.add(e.srcTablet);
    }
  }
  return [...set];
}

// [font spec, sample text] pairs. The text matters: bundled fonts are split by script, and the
// browser only loads the Arabic part when it is asked about Arabic characters.
export function fontsUsed(project) {
  const map = new Map();
  for (const s of project.slides) {
    for (const e of s.elements) {
      if (e.type === 'sticker') { const spec = stickerFont(e, 48); map.set(spec, (map.get(spec) || 'Aa') + (e.text || '')); continue; }
      if (e.type !== 'text') continue;
      const spec = fontSpec(e, 48);
      map.set(spec, (map.get(spec) || 'Aa') + Object.values(e.text || {}).join(' '));
    }
  }
  return [...map.entries()];
}
