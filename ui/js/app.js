import * as M from './model.js';
import { hitTest, toCanvasX, toCanvasY } from './render.js';
import { Studio } from './core.js';
import { createRpcHandler } from './agent.js';
import { bridge, isTauri, IMAGE_FILTERS, FONT_FILTERS, PROJECT_FILTERS } from './bridge.js';
import { t, localize, setUiLang, uiLang } from './i18n.js';
import { applyIcons } from './icons.js';
import { initPanels } from './panels.js';
import { initExtras } from './extras.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const studio = new Studio();
window.severus = studio; // handy for debugging in dev tools
let info = { version: 'dev', port: 0, mcp: 'off', job: null, exportDir: '', exe: 'severus-shot' };
let view = { boxes: [], env: null, dpr: 1 };
let quiet = false; // true while an inspector field is being typed in, so the panel is not rebuilt under the cursor

function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = isErr ? 'err' : '';
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 2600);
}
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (err) { console.error(err); toast(String(err && err.message ? err.message : err), true); return undefined; } };

/* ---------- stage ---------- */
function drawStage() {
  const stage = $('#stage'), canvas = $('#canvas');
  const z = studio.previewSize;
  const k = Math.min((stage.clientWidth - 64) / z.w, (stage.clientHeight - 84) / z.h);
  const cssW = Math.max(60, Math.floor(z.w * k)), cssH = Math.max(60, Math.floor(z.h * k));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = studio.render(canvas, studio.slide, { W: Math.round(cssW * dpr), H: Math.round(cssH * dpr), device: z.device, placeholder: t('Drop a screenshot') });
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  view = { boxes: r.boxes, env: r.env, dpr };
  drawSelection();
}

function drawSelection() {
  const sel = $('#sel');
  const b = view.boxes.find((x) => x.id === studio.selectedId);
  if (!b) { sel.hidden = true; return; }
  const d = view.dpr;
  sel.hidden = false;
  sel.style.width = `${b.w / d}px`;
  sel.style.height = `${b.h / d}px`;
  sel.style.left = `${(b.cx - b.w / 2) / d}px`;
  sel.style.top = `${(b.cy - b.h / 2) / d}px`;
  sel.style.transform = `rotate(${b.rot}deg)`;
}

function drawThumbs() {
  const host = $('#thumbs');
  const z = studio.previewSize;
  while (host.children.length > studio.project.slides.length) host.lastChild.remove();
  studio.project.slides.forEach((slide, i) => {
    let btn = host.children[i];
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'thumb';
      btn.innerHTML = '<canvas></canvas><span></span>';
      host.appendChild(btn);
    }
    btn.dataset.i = i;
    btn.classList.toggle('active', i === studio.slideIndex);
    btn.querySelector('span').textContent = i + 1;
    const W = 240;
    studio.render(btn.querySelector('canvas'), slide, { W, H: Math.round((W * z.h) / z.w), device: z.device, placeholder: t('Drop a screenshot') });
  });
}

/* ---------- inspector ---------- */
const field = (label, html) => `<div class="f"><span>${label}</span><div class="inline">${html}</div></div>`;
const numIn = (scope, k, v, step = 1, extra = '') => `<input type="number" data-scope="${scope}" data-k="${k}" value="${Math.round(v * 100) / 100}" step="${step}" ${extra}>`;
const colorIn = (scope, k, v) => `<input type="color" data-scope="${scope}" data-k="${k}" value="${esc(toHex(v))}"><input type="text" data-scope="${scope}" data-k="${k}" value="${esc(v)}" spellcheck="false">`;
const selIn = (scope, k, v, options) => `<select data-scope="${scope}" data-k="${k}">${options.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
const seg = (scope, k, v, options) => `<div class="seg">${options.map(([val, lab]) => `<button type="button" data-scope="${scope}" data-k="${k}" data-v="${esc(val)}" class="${val === v ? 'on' : ''}">${esc(lab)}</button>`).join('')}</div>`;
const checkIn = (scope, k, v, label) => `<label><input type="checkbox" data-scope="${scope}" data-k="${k}" ${v ? 'checked' : ''}> ${label}</label>`;
const fileName = (p) => (p ? (String(p).startsWith('data:') ? t('embedded image') : p) : t('none'));

function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillStyle = c;
  return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : '#000000';
}

function drawInspector() {
  const s = studio.slide, bg = s.background, el = studio.selected;
  let h = '<h3>Slide</h3>';
  h += field('Template', selIn('slide', 'template', '', [['', 'Apply a layout…'], ...Object.entries(M.TEMPLATES)]));
  h += field('Theme', selIn('slide', 'theme', '', [['', 'Apply colours…'], ...Object.entries(M.THEMES).map(([k, v]) => [k, v.label])]));
  h += '<h3>Background</h3>';
  h += seg('bg', 'type', bg.type, [['solid', 'Colour'], ['gradient', 'Gradient'], ['image', 'Image']]);
  h += '<div style="height:8px"></div>';
  if (bg.type === 'solid') h += field('Colour', colorIn('bg', 'color', bg.color));
  if (bg.type === 'gradient') {
    bg.stops.forEach((st, i) => { h += field(`Colour ${i + 1}`, colorIn('bg', `stop${i}`, st.color)); });
    h += field('Angle', `<input type="range" min="0" max="360" data-scope="bg" data-k="angle" value="${bg.angle}">`);
    h += `<div class="btnrow"><button data-act="bg-add-stop" ${bg.stops.length >= 6 ? 'disabled' : ''}>+ Colour</button><button data-act="bg-del-stop" ${bg.stops.length <= 2 ? 'disabled' : ''}>− Colour</button><button data-act="bg-swap">Reverse</button></div>`;
  }
  if (bg.type === 'image') {
    h += `<div class="btnrow"><button data-act="bg-image">Choose image…</button></div><div class="path">${esc(fileName(bg.src))}</div>`;
    h += field('Darken', `<input type="range" min="0" max="1" step="0.01" data-scope="bg" data-k="dim" value="${bg.dim}">`);
    h += field('Blur', `<input type="range" min="0" max="200" step="1" data-scope="bg" data-k="blur" value="${bg.blur}">`);
  }
  h += '<div class="btnrow"><button data-act="bg-all">Use on all slides</button></div>';

  if (!el) {
    h += '<h3>Selection</h3><div class="empty">Click an element on the canvas to edit it.</div>';
  } else {
    h += `<h3>${{ text: 'Text', screenshot: 'Screenshot', image: 'Image', shape: 'Shape', sticker: 'Sticker', icon: 'Icon' }[el.type]}</h3>`;
    if (el.type === 'text') {
      const txt = el.text[studio.lang] ?? '';
      const rtl = M.isRtlText(txt) || el.dir === 'rtl';
      h += `<textarea id="textBox" data-scope="el" data-k="text" dir="${rtl ? 'rtl' : 'auto'}" placeholder="${esc(M.elementText(el, studio.lang, studio.project.languages))}">${esc(txt)}</textarea><div style="height:8px"></div>`;
      h += field('Font', `<input type="text" list="fontList" data-scope="el" data-k="fontFamily" data-commit="1" value="${esc(el.fontFamily)}" spellcheck="false">`);
      h += '<div class="btnrow"><button data-act="tab-fonts">Browse fonts</button><button data-act="font-load">Load font file…</button></div><div class="btnrow"><button data-act="font-all">Use on all text</button></div>';
      h += field('Size', numIn('el', 'fontSize', el.fontSize, 2, 'min="8"'));
      h += field('Weight', selIn('el', 'fontWeight', el.fontWeight, [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => [w, { 100: 'Thin', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Heavy', 900: 'Black' }[w] ? `${w} ${{ 100: 'Thin', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Heavy', 900: 'Black' }[w]}` : String(w)])));
      h += field('Colour', colorIn('el', 'color', el.color));
      h += field('Align', seg('el', 'align', el.align, [['left', 'Left'], ['center', 'Centre'], ['right', 'Right'], ['start', 'Auto']]));
      h += field('Direction', selIn('el', 'dir', el.dir, [['auto', 'Auto-detect'], ['ltr', 'Left to right'], ['rtl', 'Right to left']]));
      h += field('Line height', numIn('el', 'lineHeight', el.lineHeight, 0.02, 'min="0.7" max="3"'));
      h += field('Spacing', numIn('el', 'letterSpacing', el.letterSpacing, 0.5));
      h += `<div class="grid2">${checkIn('el', 'italic', el.italic, 'Italic')}${checkIn('el', 'shadow', el.shadow, 'Shadow')}</div>`;
    }
    if (el.type === 'screenshot') {
      h += `<div class="btnrow"><button data-act="el-image">Phone image…</button><button data-act="el-image-tablet">Tablet image…</button></div>`;
      h += `<div class="path">${esc(fileName(el.src))}</div>`;
      h += field('Device', selIn('el', 'frame', el.frame, Object.entries(M.FRAME_LABELS)));
      h += field('Frame colour', colorIn('el', 'frameColor', el.frameColor));
      h += `<div class="grid2">${checkIn('el', 'shadow', el.shadow, 'Shadow')}${checkIn('el', 'glare', el.glare, 'Reflection')}</div>`;
    }
    if (el.type === 'image') {
      h += `<div class="btnrow"><button data-act="el-image">Replace image…</button><button data-act="el-cutout">Remove background</button></div><div class="path">${esc(fileName(el.src))}</div>`;
      h += field('Corners', numIn('el', 'radius', el.radius, 2, 'min="0"'));
    }
    if (el.type === 'icon') {
      h += `<div class="btnrow"><button data-act="tab-icons">${esc(el.icon)} · ${esc(t('Change icon'))}</button></div>`;
      h += field('Colour', colorIn('el', 'color', el.color));
      h += field('Line weight', `<input type="range" min="0.5" max="4" step="0.25" data-scope="el" data-k="stroke" value="${el.stroke}">`);
      h += field('Backdrop', seg('el', 'bg', el.bg, [['none', 'None'], ['circle', 'Circle'], ['square', 'Square']]));
      if (el.bg !== 'none') h += field('Backdrop colour', colorIn('el', 'bgColor', el.bgColor));
    }
    if (el.type === 'icon') {
      h += `<div class="btnrow"><button data-act="tab-icons">${esc(el.icon)} · ${esc(t('Change icon'))}</button></div>`;
      h += field('Colour', colorIn('el', 'color', el.color));
      h += field('Line weight', `<input type="range" min="0.5" max="4" step="0.25" data-scope="el" data-k="stroke" value="${el.stroke}">`);
      h += field('Backdrop', seg('el', 'bg', el.bg, [['none', 'None'], ['circle', 'Circle'], ['square', 'Square']]));
      if (el.bg !== 'none') h += field('Backdrop colour', colorIn('el', 'bgColor', el.bgColor));
    }
    if (el.type === 'sticker') {
      h += field('Kind', selIn('el', 'kind', el.kind, Object.entries(M.STICKER_LABELS)));
      if (!['arrow', 'underline'].includes(el.kind)) h += `<textarea id="textBox" data-scope="el" data-k="text" dir="auto">${esc(el.text)}</textarea><div style="height:8px"></div>`;
      h += field('Colour', colorIn('el', 'fill', el.fill));
      if (!['arrow', 'underline', 'emoji'].includes(el.kind)) {
        h += field('Text colour', colorIn('el', 'color', el.color));
        h += field('Font', `<input type="text" list="fontList" data-scope="el" data-k="fontFamily" data-commit="1" value="${esc(el.fontFamily)}" spellcheck="false">`);
      }
    }
    if (el.type === 'shape') {
      h += field('Shape', selIn('el', 'shape', el.shape, Object.entries(M.SHAPE_LABELS)));
      h += field('Colour', colorIn('el', 'fill', el.fill));
      if (el.shape !== 'glow') {
        h += el.fill2 ? field('Colour 2', colorIn('el', 'fill2', el.fill2)) : '';
        h += `<div class="btnrow"><button data-act="shape-grad">${el.fill2 ? 'Remove gradient' : 'Add gradient'}</button></div>`;
      }
      if (el.shape === 'rect') h += field('Corners', numIn('el', 'radius', el.radius, 2, 'min="0"'));
      if (['ring', 'arc', 'squiggle', 'dots'].includes(el.shape)) h += field(el.shape === 'dots' ? 'Dot size' : 'Thickness', numIn('el', 'stroke', el.stroke, 2, 'min="1"'));
      if (el.shape === 'blob') h += '<div class="btnrow"><button data-act="shape-reroll">New outline</button></div>';
    }
    h += '<h3>Position</h3>';
    h += `<div class="grid2"><label>X ${numIn('el', 'x', el.x)}</label><label>Y ${numIn('el', 'y', el.y)}</label><label>W ${numIn('el', 'w', el.w, 1, 'min="4"')}</label>${el.type === 'text' ? '<span></span>' : `<label>H ${numIn('el', 'h', el.h, 1, 'min="4"')}</label>`}</div>`;
    h += field('Rotation', numIn('el', 'rotation', el.rotation, 1));
    h += field('Opacity', `<input type="range" min="0" max="1" step="0.01" data-scope="el" data-k="opacity" value="${el.opacity}">`);
    h += '<div class="btnrow"><button data-act="el-front">To front</button><button data-act="el-back">To back</button><button data-act="el-center">Centre</button></div>';
    h += '<div class="btnrow"><button data-act="el-dup">Duplicate</button><button data-act="el-del" class="danger">Delete</button></div>';
  }

  h += '<h3>Languages</h3><div class="chips">';
  for (const l of studio.project.languages) h += `<span class="chip">${esc(l)}<button data-act="lang-del" data-v="${esc(l)}" title="Remove" ${studio.project.languages.length < 2 ? 'disabled' : ''}>×</button></span>`;
  h += '</div><div class="inline" style="display:flex;gap:6px"><input type="text" id="langNew" placeholder="Add code, e.g. ar" maxlength="12"><button data-act="lang-add">Add</button></div>';
  h += `<datalist id="fontList">${studio.fontFamilies().map((f) => `<option value="${esc(f)}">`).join('')}</datalist>`;
  const scroll = $('#inspector').scrollTop;
  $('#inspector').innerHTML = h;
  localize($('#inspector'));
  $('#inspector').scrollTop = scroll;
}

function drawBar() {
  const sizeSel = $('#sizeSel'), langSel = $('#langSel');
  if (!sizeSel.options.length || sizeSel.dataset.ui !== uiLang()) sizeSel.innerHTML = M.STORE_SIZES.map((z) => `<option value="${z.id}">${esc(t(z.label))} · ${z.w}×${z.h}</option>`).join('');
  sizeSel.dataset.ui = uiLang();
  sizeSel.value = studio.previewSize.id;
  $('#uiLang span').textContent = uiLang() === 'ar' ? 'English' : 'العربية';
  $('#stage').dataset.drop = t('Drop to add');
  langSel.innerHTML = studio.project.languages.map((l) => `<option${l === studio.lang ? ' selected' : ''}>${esc(l)}</option>`).join('');
  document.querySelector('[data-act=undo]').disabled = !studio.undoStack.length;
  document.querySelector('[data-act=redo]').disabled = !studio.redoStack.length;
  const name = studio.filePath ? studio.filePath.split(/[\\/]/).pop() : studio.project.name;
  bridge.setTitle(`${studio.dirty ? '• ' : ''}${name} — Severus Shot`);
  const title = $('#projTitle');
  if (document.activeElement !== title) title.value = studio.project.name;
  $('#saveState').textContent = !isTauri ? '' : studio.dirty ? t('Saving…') : t('Saved');
  const badge = $('#mcpBadge');
  badge.className = `badge ${info.mcp === 'on' ? 'on' : info.mcp === 'off' ? '' : 'err'}`;
}

let raf = 0;
function repaint(reason) {
  if (reason === 'drag') { drawStage(); return; }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    drawStage();
    drawThumbs();
    drawBar();
    if (!quiet) refreshPanel();
    if (typeof panels !== 'undefined') panels.refreshFonts();
  });
}
studio.onChange(repaint);
new ResizeObserver(() => drawStage()).observe($('#stage'));

/* ---------- inspector events ---------- */
let typing = false; // one undo step per focused field
// Rebuilding the panel while the mouse is pressed on it would swallow the click, so wait for release.
let pressing = false, pendingPanel = false;
function refreshPanel() {
  if (pressing) { pendingPanel = true; return; }
  pendingPanel = false;
  drawInspector();
}
$('#inspector').addEventListener('pointerdown', () => { pressing = true; });
window.addEventListener('pointerup', () => { pressing = false; if (pendingPanel) setTimeout(() => { if (!quiet) refreshPanel(); }, 0); });
$('#inspector').addEventListener('focusin', () => { typing = false; });
$('#inspector').addEventListener('focusout', () => { if (quiet) { quiet = false; refreshPanel(); } });

async function applyField(t, live) {
  const { scope, k } = t.dataset;
  if (!scope) return;
  let v = t.type === 'checkbox' ? t.checked : t.dataset.v !== undefined ? t.dataset.v : t.value;
  if (t.type === 'number' || t.type === 'range') { if (t.value === '' || !Number.isFinite(+t.value)) return; v = +t.value; }
  if (live && t.dataset.commit) return; // font field: apply when committed, not per keystroke
  // Half-typed colours ("#ff0") are ignored instead of resetting the colour.
  if (t.type === 'text' && t.previousElementSibling?.type === 'color' && !M.normalizeColor(v, '')) return;
  quiet = live;
  const history = !(live && typing);
  typing = live;
  if (scope === 'slide') {
    if (!v) return;
    await studio.mutate(() => (k === 'template' ? M.applyTemplate(studio.slide, v) : M.applyTheme(studio.slide, v)));
    studio.selectedId = null;
  } else if (scope === 'bg') {
    await studio.mutate(() => {
      const bg = studio.slide.background;
      let next = { ...bg, [k]: v };
      if (k === 'type' && v !== bg.type) {
        const first = bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.stops[0].color : '#101218';
        next = { type: v, color: first, stops: [{ pos: 0, color: first }, { pos: 1, color: '#0a0b14' }], src: '' };
      }
      const m = /^stop(\d)$/.exec(k);
      if (m) { next.stops = bg.stops.map((s, i) => (i === +m[1] ? { ...s, color: v } : s)); }
      studio.slide.background = M.makeBackground(next);
    }, { history });
  } else if (scope === 'el') {
    const el = studio.selected;
    if (!el) return;
    await studio.mutate(() => M.updateElement(el, { [k]: v }, studio.lang), { history });
  }
  // keep the paired colour picker / text box in step without rebuilding the panel
  if (live && (t.type === 'color' || t.previousElementSibling?.type === 'color')) {
    const twin = t.type === 'color' ? t.nextElementSibling : t.previousElementSibling;
    if (twin) twin.value = t.type === 'color' ? t.value : toHex(t.value);
  }
}
$('#inspector').addEventListener('input', guard((e) => applyField(e.target, true)));
$('#inspector').addEventListener('change', guard(async (e) => { if (!e.target.dataset.scope) return; await applyField(e.target, false); quiet = false; refreshPanel(); }));
$('#inspector').addEventListener('click', guard(async (e) => {
  const b = e.target.closest('button[data-scope]');
  if (b) { await applyField(b, false); return; }
}));

/* ---------- pointer editing on the canvas ---------- */
function canvasPoint(e) {
  const r = $('#canvas').getBoundingClientRect();
  return { x: (e.clientX - r.left) * view.dpr, y: (e.clientY - r.top) * view.dpr };
}
function startGesture(e, onMove) {
  const before = JSON.stringify(studio.project);
  const target = e.currentTarget;
  target.setPointerCapture(e.pointerId);
  const move = (ev) => { onMove(ev); studio.emit('drag'); };
  const up = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    if (JSON.stringify(studio.project) !== before) {
      studio.undoStack.push(before);
      studio.redoStack.length = 0;
      studio.dirty = true;
    }
    studio.emit();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

$('#canvas').addEventListener('pointerdown', (e) => {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  const p = canvasPoint(e);
  const hit = hitTest(view.boxes, p.x, p.y);
  studio.selectedId = hit ? hit.id : null;
  studio.emit();
  const el = studio.selected;
  if (!el) return;
  const x0 = el.x, y0 = el.y;
  startGesture(e, (ev) => {
    const q = canvasPoint(ev);
    let nx = x0 + (q.x - p.x) / view.env.sx, ny = y0 + (q.y - p.y) / view.env.sy;
    if (Math.abs(nx - M.BASE.w / 2) < 14) nx = M.BASE.w / 2; // snap to the centre line
    el.x = Math.round(nx);
    el.y = Math.round(ny);
  });
});
$('#canvas').addEventListener('dblclick', () => { const t = $('#textBox'); if (t) { t.focus(); t.select(); } });

for (const h of document.querySelectorAll('#sel [data-h]')) {
  h.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const el = studio.selected;
    const box = view.boxes.find((b) => b.id === studio.selectedId);
    if (!el || !box) return;
    const p = canvasPoint(e);
    const start = { w: el.w, h: el.h, fs: el.fontSize, rot: el.rotation, stroke: el.stroke || 1 };
    const d0 = Math.hypot(p.x - box.cx, p.y - box.cy) || 1;
    const a0 = Math.atan2(p.y - box.cy, p.x - box.cx);
    const rotating = h.dataset.h === 'rot';
    startGesture(e, (ev) => {
      const q = canvasPoint(ev);
      if (rotating) {
        let deg = start.rot + ((Math.atan2(q.y - box.cy, q.x - box.cx) - a0) * 180) / Math.PI;
        deg = ((deg + 540) % 360) - 180;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        else for (const s of [0, 90, -90, 180, -180]) if (Math.abs(deg - s) < 2.5) deg = s;
        el.rotation = Math.round(deg * 10) / 10;
      } else {
        const f = Math.max(0.05, Math.hypot(q.x - box.cx, q.y - box.cy) / d0);
        el.w = Math.max(8, Math.round(start.w * f));
        el.h = Math.max(8, Math.round(start.h * f));
        if (el.type === 'text') el.fontSize = Math.max(8, Math.round(start.fs * f));
        if (el.type === 'shape') el.stroke = Math.max(1, Math.round(start.stroke * f));
      }
    });
  });
}

/* ---------- actions ---------- */
async function pickImages(multiple) {
  if (isTauri) {
    const r = await bridge.pickOpen(IMAGE_FILTERS, multiple);
    return multiple ? r : r ? [r] : [];
  }
  return new Promise((resolve) => {
    const input = $('#filePick');
    input.accept = 'image/*';
    input.multiple = multiple;
    input.onchange = async () => resolve(await Promise.all([...input.files].map(fileToDataUrl)));
    input.value = '';
    input.click();
  });
}
const fileToDataUrl = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });

async function addScreenshots(sources) {
  for (const src of sources) {
    const sel = studio.selected;
    const empty = studio.slide.elements.find((e) => e.type === 'screenshot' && !e.src);
    const target = sel && sel.type === 'screenshot' && sources.length === 1 ? sel : empty;
    if (target) {
      await studio.mutate(() => { target.src = src; });
      await studio.mutate(() => studio.fitToImage(target), { history: false });
      studio.selectedId = target.id;
    } else {
      const el = M.makeElement('screenshot', { src, x: M.BASE.w / 2, y: 1750, w: 900 });
      await studio.mutate(() => { studio.slide.elements.push(el); });
      await studio.mutate(() => studio.fitToImage(el), { history: false });
      studio.selectedId = el.id;
    }
  }
  studio.emit();
}

async function handleDroppedPaths(paths) {
  const images = paths.filter((p) => /\.(png|jpe?g|webp)$/i.test(p));
  const fonts = paths.filter((p) => /\.(ttf|otf|woff2?)$/i.test(p));
  const proj = paths.find((p) => /\.(severus|shotforge|json)$/i.test(p));
  if (proj) { if (await confirmDiscard()) await studio.open(proj); return; }
  for (const f of fonts) toast(t('Font added: {0}', await studio.addFontFile(f)));
  if (images.length) await addScreenshots(images);
}

async function confirmDiscard() {
  if (!studio.dirty || studio.inLibrary()) return true;
  if (isTauri && window.__TAURI__.dialog.ask) return window.__TAURI__.dialog.ask(t('Discard unsaved changes?'), { title: 'Severus Shot', kind: 'warning' });
  return window.confirm(t('Discard unsaved changes?'));
}

async function saveProject(forcePick) {
  let path = studio.filePath;
  if (!path || forcePick) path = await bridge.pickSave(`${studio.project.name || 'screenshots'}.severus`, PROJECT_FILTERS);
  if (!path) return;
  await studio.save(path);
  toast(t('Saved'));
}

function openExport() {
  $('#exSizes').innerHTML = M.STORE_SIZES.map((z) => `<label class="check"><input type="checkbox" value="${z.id}" checked> ${esc(t(z.label))} <span style="color:var(--muted)">${z.w}×${z.h}</span></label>`).join('');
  $('#exLangs').innerHTML = studio.project.languages.map((l) => `<label class="check"><input type="checkbox" value="${esc(l)}" checked> ${esc(l)}</label>`).join('');
  if (!$('#exDir').value && info.exportDir) $('#exDir').value = `${info.exportDir}/${(studio.project.name || 'screenshots').replace(/[^\w.-]+/g, '-')}`;
  $('#exStatus').textContent = isTauri ? '' : t('Export needs the desktop app.');
  $('#exportDlg').showModal();
}

async function runExport() {
  const sizes = [...document.querySelectorAll('#exSizes input:checked')].map((i) => i.value);
  const languages = [...document.querySelectorAll('#exLangs input:checked')].map((i) => i.value);
  const outDir = $('#exDir').value.trim();
  if (!sizes.length || !languages.length) throw new Error(t('Pick at least one size and one language'));
  if (!outDir) throw new Error(t('Choose an output folder'));
  const status = $('#exStatus');
  const r = await studio.exportAll({
    outDir, sizes, languages, format: $('#exFmt').value, zip: $('#exZip').checked, layout: $('#exLayout').value,
    slides: $('#exOnly').checked ? [studio.slideIndex + 1] : undefined,
    onProgress: (n, total) => { status.textContent = t('Rendering {0} of {1}…', n, total); },
  });
  status.textContent = `${t('Done: {0} file(s) in {1}', r.count, r.outDir)}${r.zip ? `\nZIP: ${r.zip}` : ''}${r.next ? `\n${t('To upload, run in a terminal:')}\n${r.next.join('\n')}` : ''}${r.warnings.length ? `\n${t('Warnings:')}\n- ${r.warnings.join('\n- ')}` : ''}`;
}

const actions = {
  new: async () => { if (isTauri) { await studio.createProject(); toast(t('Project created')); } else if (await confirmDiscard()) await studio.setProject(M.newProject()); },
  open: async () => {
    if (!(await confirmDiscard())) return;
    const p = await bridge.pickOpen(PROJECT_FILTERS);
    if (p) await studio.open(p);
  },
  save: () => saveProject(false),
  undo: () => studio.undo(),
  redo: () => studio.redo(),
  'add-text': async () => {
    const el = M.makeElement('text', { text: { [studio.lang]: M.isRtlLang(studio.lang) ? 'نص جديد' : 'New caption' }, y: 420 });
    await studio.mutate(() => { studio.slide.elements.push(el); });
    studio.selectedId = el.id; studio.emit();
  },
  'add-screenshot': async () => addScreenshots(await pickImages(true)),
  'add-image': async () => {
    for (const src of await pickImages(false)) {
      const el = M.makeElement('image', { src, w: 360, y: 500 });
      await studio.mutate(() => { studio.slide.elements.push(el); });
      await studio.mutate(() => studio.fitToImage(el), { history: false });
      studio.selectedId = el.id;
    }
    studio.emit();
  },
  'add-shape': async () => {
    const el = M.makeElement('shape', { shape: 'blob', w: 800, h: 800, opacity: 0.5, seed: Math.floor(Math.random() * 1000) });
    await studio.mutate(() => { studio.slide.elements.unshift(el); });
    studio.selectedId = el.id; studio.emit();
  },
  'slide-add': () => studio.mutate((p) => { p.slides.splice(studio.slideIndex + 1, 0, M.makeSlide()); studio.slideIndex += 1; studio.selectedId = null; }),
  'slide-dup': () => studio.mutate((p) => {
    const copy = M.clone(studio.slide);
    copy.id = M.uid('s');
    copy.elements.forEach((e) => { e.id = M.uid(); });
    p.slides.splice(studio.slideIndex + 1, 0, copy);
    studio.slideIndex += 1; studio.selectedId = null;
  }),
  'slide-del': () => studio.mutate((p) => { if (p.slides.length > 1) { p.slides.splice(studio.slideIndex, 1); studio.selectedId = null; } else toast(t('A project needs at least one slide')); }),
  'bg-image': async () => { const [src] = await pickImages(false); if (src) await studio.mutate(() => { studio.slide.background = M.makeBackground({ ...studio.slide.background, type: 'image', src }); }); },
  'bg-add-stop': () => studio.mutate(() => { const bg = studio.slide.background; const colors = [...bg.stops.map((s) => s.color), bg.stops[bg.stops.length - 1].color]; studio.slide.background = M.makeBackground({ type: 'gradient', angle: bg.angle, colors }); }),
  'bg-del-stop': () => studio.mutate(() => { const bg = studio.slide.background; studio.slide.background = M.makeBackground({ type: 'gradient', angle: bg.angle, colors: bg.stops.slice(0, -1).map((s) => s.color) }); }),
  'bg-swap': () => studio.mutate(() => { const bg = studio.slide.background; studio.slide.background = M.makeBackground({ type: 'gradient', angle: bg.angle, colors: bg.stops.map((s) => s.color).reverse() }); }),
  'bg-all': async () => { await studio.mutate((p) => { for (const s of p.slides) s.background = M.clone(studio.slide.background); }); toast(t('Background applied to all slides')); },
  'el-image': async () => { const el = studio.selected; const [src] = await pickImages(false); if (el && src) { await studio.mutate(() => { el.src = src; }); await studio.mutate(() => studio.fitToImage(el), { history: false }); } },
  'el-cutout': async (b) => { const el = studio.selected; if (!el) return; b.disabled = true; toast(t('Removing the background…')); try { await studio.cutout(el); toast(t('Background removed. Undo brings it back.')); } finally { b.disabled = false; } },
  'el-image-tablet': async () => { const el = studio.selected; const [src] = await pickImages(false); if (el && src) await studio.mutate(() => { el.srcTablet = src; }); },
  'el-front': () => studio.mutate(() => { const a = studio.slide.elements, el = studio.selected; a.splice(a.indexOf(el), 1); a.push(el); }),
  'el-back': () => studio.mutate(() => { const a = studio.slide.elements, el = studio.selected; a.splice(a.indexOf(el), 1); a.unshift(el); }),
  'el-center': () => studio.mutate(() => { studio.selected.x = M.BASE.w / 2; }),
  'el-dup': async () => {
    const copy = M.clone(studio.selected);
    copy.id = M.uid(); copy.x += 40; copy.y += 40;
    await studio.mutate(() => { studio.slide.elements.push(copy); });
    studio.selectedId = copy.id; studio.emit();
  },
  'el-del': () => studio.mutate(() => { const a = studio.slide.elements; const i = a.indexOf(studio.selected); if (i >= 0) a.splice(i, 1); studio.selectedId = null; }),
  'shape-grad': () => studio.mutate(() => M.updateElement(studio.selected, { fill2: studio.selected.fill2 ? '' : '#ffffff' })),
  'shape-reroll': () => studio.mutate(() => { studio.selected.seed = Math.floor(Math.random() * 100000); }),
  'font-load': async () => {
    const p = await bridge.pickOpen(FONT_FILTERS);
    if (!p) return;
    const family = await studio.addFontFile(p);
    const el = studio.selected;
    if (el && el.type === 'text') await studio.mutate(() => { el.fontFamily = family; });
    toast(t('Font added: {0}', family));
  },
  'font-all': async () => { const f = studio.selected.fontFamily; await studio.mutate((p) => { for (const s of p.slides) for (const e of s.elements) if (e.type === 'text') e.fontFamily = f; }); toast(t('All text now uses {0}', f)); },
  'lang-add': async () => {
    const code = $('#langNew').value.trim();
    if (!/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})?$/.test(code)) throw new Error(t('Use a language code such as en, ar or pt-BR'));
    await studio.mutate((p) => { if (!p.languages.includes(code)) p.languages.push(code); });
    studio.lang = code; studio.emit();
  },
  'lang-del': (b) => studio.mutate((p) => { if (p.languages.length > 1) p.languages = p.languages.filter((l) => l !== b.dataset.v); }),
  'ui-lang': () => { setUiLang(uiLang() === 'ar' ? 'en' : 'ar'); localize(document.body); quiet = false; repaint(); panels.redrawOpen(); },
  export: openExport,
  'export-pick': async () => { const d = await bridge.pickFolder(); if (d) $('#exDir').value = d; },
  'export-run': runExport,
};
const panels = initPanels({ studio, toast, guard, getInfo: () => info, addScreenshots, pickImages, confirmDiscard, api: { run: (name) => (actions[name] ? actions[name]() : null) } });
Object.assign(actions, panels.actions);
const extras = initExtras({ studio, toast, guard, addScreenshots });
Object.assign(actions, extras.actions);

document.addEventListener('click', guard(async (e) => {
  const b = e.target.closest('[data-act]');
  if (b && actions[b.dataset.act]) await actions[b.dataset.act](b);
  const th = e.target.closest('.thumb');
  if (th) { studio.slideIndex = +th.dataset.i; studio.selectedId = null; studio.emit(); }
}));
$('#projTitle').addEventListener('change', guard(async (e) => { const v = e.target.value.trim().slice(0, 80); if (v) await studio.mutate((p) => { p.name = v; }); else e.target.value = studio.project.name; }));
$('#projTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('#sizeSel').addEventListener('change', (e) => { studio.previewSize = M.resolveSize(e.target.value); studio.emit(); });
$('#langSel').addEventListener('change', (e) => { studio.lang = e.target.value; studio.emit(); });

document.addEventListener('keydown', guard(async (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.querySelector('dialog[open]');
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); await saveProject(e.shiftKey); return; }
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); await actions.projects(); return; }
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); await actions.palette(); return; }
  if (document.querySelector('dialog[open]')) return;
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); await actions.new(); return; }
  if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); await actions.chat(); return; }
  if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); await actions.capture(); return; }
  if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); await (e.shiftKey ? actions.video() : actions.export()); return; }
  if (mod && e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); await actions[e.key === 'ArrowRight' ? 'proj-next' : 'proj-prev'](); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); await actions['slide-add'](); return; }
  if (editing) return;
  if (!mod && !e.altKey) {
    const single = { g: 'templates', e: 'elements', i: 'icons', f: 'fonts', t: 'add-text', s: 'add-screenshot', l: 'add-logo', '?': 'shortcuts' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (single) { e.preventDefault(); await actions[single](); return; }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      studio.slideIndex = Math.min(studio.project.slides.length - 1, Math.max(0, studio.slideIndex + (e.key === 'PageDown' ? 1 : -1)));
      studio.selectedId = null; studio.emit(); return;
    }
    if (studio.selected && (e.key === ']' || e.key === '[')) { e.preventDefault(); await actions[e.key === ']' ? 'el-front' : 'el-back'](); return; }
  }
  const el = studio.selected;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); await (e.shiftKey ? studio.redo() : studio.undo()); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); await studio.redo(); }
  else if (mod && e.key.toLowerCase() === 'c' && el) { studio.clipboard = M.clone(el); toast(t('Copied. Paste on any slide.')); }
  else if (mod && e.key.toLowerCase() === 'v' && studio.clipboard) {
    const copy = M.clone(studio.clipboard);
    copy.id = M.uid();
    if (studio.slide.elements.some((x) => x.x === copy.x && x.y === copy.y)) { copy.x += 40; copy.y += 40; }
    await studio.mutate(() => { studio.slide.elements.push(copy); });
    studio.selectedId = copy.id; studio.emit();
  }
  else if (mod && e.key.toLowerCase() === 'd' && el) { e.preventDefault(); await actions['el-dup'](); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && el) { e.preventDefault(); await actions['el-del'](); }
  else if (e.key === 'Escape') { studio.selectedId = null; studio.emit(); }
  else if (el && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? 20 : 2;
    await studio.mutate(() => {
      if (e.key === 'ArrowLeft') el.x -= step; if (e.key === 'ArrowRight') el.x += step;
      if (e.key === 'ArrowUp') el.y -= step; if (e.key === 'ArrowDown') el.y += step;
    });
  }
}));

// Browser-only drag and drop (the desktop app gets real file paths from the backend instead).
if (!isTauri) {
  const stage = $('#stage');
  window.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dropping'); });
  window.addEventListener('dragleave', () => stage.classList.remove('dropping'));
  window.addEventListener('drop', guard(async (e) => {
    e.preventDefault();
    stage.classList.remove('dropping');
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    await addScreenshots(await Promise.all(files.map(fileToDataUrl)));
  }));
}

/* ---------- command-line export job ---------- */
async function runJob(job) {
  try {
    await studio.open(job.project);
    if (job.video) {
      const v = await studio.exportVideo({ path: job.out, size: job.sizes[0], lang: job.langs[0] });
      await bridge.cliDone(0, `Video saved: ${v.path} (${v.width}x${v.height}, ${v.seconds}s, ${v.frames} frames)`);
      return;
    }
    const r = await studio.exportAll({ outDir: job.out, sizes: job.sizes, languages: job.langs, format: job.format, zip: job.zip, layout: job.layout || 'folders' });
    const warn = r.warnings.length ? `\nWarnings:\n- ${r.warnings.join('\n- ')}` : '';
    await bridge.cliDone(0, `Exported ${r.count} file(s) to ${r.outDir}${r.zip ? `\nZIP: ${r.zip}` : ''}${warn}`);
  } catch (err) {
    await bridge.cliDone(1, `Export failed: ${err && err.message ? err.message : err}`);
  }
}

/* ---------- start ---------- */
(async function start() {
  setUiLang(uiLang());
  applyIcons();
  localize(document.body);
  try { info = { ...info, ...(await bridge.info()) }; } catch (err) { console.error(err); }
  await studio.ensureAssets();
  repaint();
  const handle = createRpcHandler(studio, info);
  bridge.onRpc(async ({ id, message }) => {
    let response;
    try {
      response = Array.isArray(message) ? (await Promise.all(message.map(handle))).filter(Boolean) : await handle(message);
      if (Array.isArray(response) && !response.length) response = null;
    } catch (err) {
      response = { jsonrpc: '2.0', id: message && message.id !== undefined ? message.id : null, error: { code: -32603, message: String(err && err.message ? err.message : err) } };
    }
    bridge.rpcReply(id, response);
  });
  bridge.onFileDrop(guard(handleDroppedPaths));
  studio.projectsDir = info.projectsDir || '';
  studio.dataDir = info.dataDir || '';
  studio.loadIcons().catch((err) => console.warn('icons unavailable', err));
  studio.hasFfmpeg = !!info.ffmpeg;
  if (info.job) { await bridge.frontendReady(); runJob(info.job); return; }
  if (isTauri && studio.projectsDir) {
    // Resume the most recent project, or start the first one, so work is always saved in the library.
    try {
      const list = await studio.listProjects();
      if (list[0]) await studio.open(list[0].path); else await studio.createProject();
    } catch (err) { console.error(err); }
  }
  await bridge.frontendReady();
  extras.checkUpdate(true);
  extras.diagnosticsOnRequest().catch((err) => console.warn('diagnostics failed', err));
  bridge.listFonts().then((fonts) => { studio.systemFonts = fonts; if (!quiet) refreshPanel(); }).catch(() => null);
})();
