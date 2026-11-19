// Dialogs around the editor: template gallery, element library, projects, video, shortcuts, agents.
import * as M from './model.js';
import { bridge, isTauri, IMAGE_FILTERS, PROJECT_FILTERS, VIDEO_FILTERS } from './bridge.js';
import { renderVideoFrame, videoDuration } from './motion.js';
import { t, localize } from './i18n.js';
import { icon } from './icons.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initPanels({ studio, toast, guard, getInfo, addScreenshots, pickImages, confirmDiscard }) {
  const show = (id) => { const d = $(id); localize(d); if (!d.open) d.showModal(); };
  const close = (id) => { const d = $(id); if (d.open) d.close(); };

  /* ---------- small canvas thumbnails ---------- */
  function slideThumb(canvas, slide, width = 180) {
    studio.render(canvas, slide, { W: width * 2, H: Math.round((width * 2 * M.BASE.h) / M.BASE.w), device: 'phone', final: true });
  }
  // One element drawn large and centred on a neutral tile.
  function elementThumb(canvas, el, tw = 132, th = 96) {
    const scale = Math.min((M.BASE.w * 0.86) / el.w, (M.BASE.w * 0.62) / el.h);
    const copy = { ...el, x: M.BASE.w / 2, y: M.BASE.h / 2, w: el.w * scale, h: el.h * scale, rotation: 0, opacity: 1 };
    if (copy.stroke) copy.stroke = el.stroke * scale;
    if (copy.radius) copy.radius = el.radius * scale;
    const big = document.createElement('canvas');
    const W = tw * 2, H = Math.round((W * M.BASE.h) / M.BASE.w);
    studio.render(big, { background: M.makeBackground({ type: 'solid', color: '#262b36' }), elements: [copy] }, { W, H, device: 'phone', final: true });
    canvas.width = tw * 2; canvas.height = th * 2;
    canvas.getContext('2d').drawImage(big, 0, (H - th * 2) / 2, W, th * 2, 0, 0, tw * 2, th * 2);
  }

  /* ---------- templates ---------- */
  let tplTheme = 'midnight';
  function drawTemplates() {
    const shots = studio.project.slides.flatMap((s) => s.elements.filter((e) => e.type === 'screenshot' && e.src));
    const carry = { src: shots[0]?.src, src2: shots[1]?.src, srcTablet: shots[0]?.srcTablet };
    $('#tplThemes').innerHTML = Object.entries(M.THEMES).map(([id, th]) => {
      const bg = th.bg.type === 'solid' ? th.bg.color : `linear-gradient(160deg, ${th.bg.stops.map((s) => s.color).join(', ')})`;
      return `<button type="button" class="swatch ${id === tplTheme ? 'on' : ''}" data-theme="${id}" title="${esc(th.label)}" style="background:${bg}"></button>`;
    }).join('');
    $('#tplGrid').innerHTML = Object.entries(M.TEMPLATES).map(([id, label]) => `<div class="card" data-tpl="${id}"><button type="button" class="thumbBtn" data-use="${id}" title="Use on this slide"><canvas></canvas></button><div class="cardRow"><span class="cardName">${esc(label)}</span><button type="button" class="mini" data-add="${id}" title="Add as a new slide">${icon('plus')}</button></div></div>`).join('');
    for (const card of $('#tplGrid').children) slideThumb(card.querySelector('canvas'), M.makeSlide(card.dataset.tpl, tplTheme, carry), 150);
    localize($('#templatesDlg'));
  }
  $('#templatesDlg').addEventListener('click', guard(async (e) => {
    const sw = e.target.closest('[data-theme]');
    if (sw) { tplTheme = sw.dataset.theme; drawTemplates(); return; }
    const use = e.target.closest('[data-use]'), add = e.target.closest('[data-add]');
    if (use) {
      await studio.mutate(() => M.applyTemplate(studio.slide, use.dataset.use, tplTheme));
      studio.selectedId = null; studio.emit(); close('#templatesDlg');
    } else if (add) {
      const shots = studio.slide.elements.filter((x) => x.type === 'screenshot');
      await studio.mutate((p) => {
        p.slides.splice(studio.slideIndex + 1, 0, M.makeSlide(add.dataset.add, tplTheme, { srcTablet: shots[0]?.srcTablet }));
        studio.slideIndex += 1; studio.selectedId = null;
      });
      toast(t('Slide added'));
    }
  }));

  /* ---------- elements: stickers, shapes, logo ---------- */
  function drawElements() {
    const theme = { fill: '#7c6cff', color: '#ffffff' };
    $('#elStickers').innerHTML = M.STICKERS.map((k) => `<button type="button" class="tile" data-sticker="${k}" title="${esc(M.STICKER_LABELS[k])}"><canvas></canvas><span>${esc(M.STICKER_LABELS[k])}</span></button>`).join('');
    for (const b of $('#elStickers').children) {
      const k = b.dataset.sticker;
      elementThumb(b.querySelector('canvas'), M.makeElement('sticker', { kind: k, ...theme, ...(k === 'rating' ? { fill: '#ffc83d' } : {}), ...(k === 'notification' || k === 'bubble' ? { fill: '#ffffff', color: '#14161b' } : {}) }));
    }
    $('#elShapes').innerHTML = M.SHAPES.map((k) => `<button type="button" class="tile" data-shape="${k}" title="${esc(M.SHAPE_LABELS[k])}"><canvas></canvas><span>${esc(M.SHAPE_LABELS[k])}</span></button>`).join('');
    for (const b of $('#elShapes').children) {
      const k = b.dataset.shape, wide = k === 'pill' || k === 'squiggle';
      elementThumb(b.querySelector('canvas'), M.makeElement('shape', { shape: k, fill: '#7c6cff', w: 600, h: wide ? 170 : 600, stroke: 40 }));
    }
    localize($('#elementsDlg'));
  }
  async function insert(el) {
    await studio.mutate(() => { studio.slide.elements.push(el); });
    studio.selectedId = el.id; studio.emit();
    close('#elementsDlg');
  }
  async function addLogo() {
    const [src] = await pickImages(false);
    if (!src) return;
    const el = M.makeElement('image', { src, w: 260, x: M.BASE.w / 2, y: 190, radius: 56, name: 'Logo' });
    await studio.mutate(() => { studio.slide.elements.push(el); });
    await studio.mutate(() => studio.fitToImage(el), { history: false });
    studio.selectedId = el.id; studio.emit();
    close('#elementsDlg');
  }
  $('#elementsDlg').addEventListener('click', guard(async (e) => {
    const s = e.target.closest('[data-sticker]'), sh = e.target.closest('[data-shape]');
    if (s) {
      const k = s.dataset.sticker;
      const tone = k === 'rating' ? { fill: '#ffc83d' } : k === 'notification' || k === 'bubble' ? { fill: '#ffffff', color: '#14161b' } : {};
      await insert(M.makeElement('sticker', { kind: k, y: 1100, ...tone }));
    } else if (sh) {
      const k = sh.dataset.shape, wide = k === 'pill' || k === 'squiggle';
      await insert(M.makeElement('shape', { shape: k, w: 600, h: wide ? 160 : 600, opacity: k === 'glow' || k === 'blob' ? 0.5 : 1, seed: Math.floor(Math.random() * 1000) }));
    }
  }));

  /* ---------- projects ---------- */
  async function drawProjects() {
    const list = await studio.listProjects();
    const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    $('#projGrid').innerHTML = list.map((p) => `<div class="card proj ${p.path === studio.filePath ? 'on' : ''}"><button type="button" class="thumbBtn" data-open="${esc(p.path)}">${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : '<div class="noThumb"></div>'}</button><div class="cardRow"><span class="cardName" data-no-i18n title="${esc(p.name)}">${esc(p.name)}</span><button type="button" class="mini danger" data-del="${esc(p.path)}" data-name="${esc(p.name)}" title="Delete project">${icon('trash')}</button></div><div class="cardMeta" data-no-i18n>${p.slides} · ${esc(fmt(p.modified))}</div></div>`).join('') || `<p class="empty">${esc(isTauri ? t('No projects yet. Create your first one.') : t('The project library needs the desktop app.'))}</p>`;
    $('#projPath').textContent = studio.projectsDir;
    localize($('#projectsDlg'));
    return list;
  }
  async function newProject() {
    const name = $('#projName').value.trim();
    await studio.createProject(name);
    $('#projName').value = '';
    close('#projectsDlg');
    toast(t('Project created'));
  }
  $('#projectsDlg').addEventListener('click', guard(async (e) => {
    const open = e.target.closest('[data-open]'), del = e.target.closest('[data-del]');
    if (open) { if (!studio.inLibrary() && !(await confirmDiscard())) return; await studio.open(open.dataset.open); close('#projectsDlg'); }
    else if (del) {
      const msg = t('Delete "{0}"? This cannot be undone.', del.dataset.name);
      const ok = isTauri ? await window.__TAURI__.dialog.ask(msg, { title: 'Severus Shot', kind: 'warning' }) : window.confirm(msg);
      if (!ok) return;
      const wasCurrent = del.dataset.del === studio.filePath;
      await studio.deleteProject(del.dataset.del);
      const rest = await drawProjects();
      if (wasCurrent) { if (rest[0]) await studio.open(rest[0].path); else await studio.createProject(); await drawProjects(); }
    }
  }));
  $('#projName').addEventListener('keydown', guard(async (e) => { if (e.key === 'Enter') { e.preventDefault(); await newProject(); } }));
  async function stepProject(dir) {
    const list = await studio.listProjects();
    if (list.length < 2) return;
    const i = list.findIndex((p) => p.path === studio.filePath);
    const next = list[(i + dir + list.length) % list.length];
    await studio.open(next.path);
    toast(next.name);
  }

  /* ---------- video ---------- */
  let playing = 0, cancelled = false;
  const opts = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  function drawVideo() {
    const m = studio.project.motion;
    $('#vidPreset').innerHTML = opts(M.MOTIONS, m.preset);
    $('#vidTransition').innerHTML = opts(M.TRANSITIONS, m.transition);
    $('#vidSeconds').value = m.seconds;
    $('#vidFps').value = String(m.fps);
    if (!$('#vidSize').options.length) $('#vidSize').innerHTML = M.VIDEO_SIZES.map((z) => `<option value="${z.id}">${esc(z.label)}</option>`).join('');
    $('#vidLang').innerHTML = studio.project.languages.map((l) => `<option${l === studio.lang ? ' selected' : ''}>${esc(l)}</option>`).join('');
    $('#vidStatus').textContent = studio.hasFfmpeg ? `${t('Length')}: ${videoDuration(studio.project).toFixed(1)} s` : t('Video export needs ffmpeg installed (macOS: brew install ffmpeg). The preview works without it.');
    localize($('#videoDlg'));
  }
  function play() {
    cancelAnimationFrame(playing);
    const z = M.VIDEO_SIZES.find((v) => v.id === $('#vidSize').value) || M.VIDEO_SIZES[0];
    const canvas = $('#vidCanvas');
    const H = 720, W = Math.round((H * z.w) / z.h);
    const mk = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    const scratch = { a: mk(), b: mk() };
    const total = videoDuration(studio.project) + 0.8, start = performance.now();
    const tick = (now) => {
      if (!$('#videoDlg').open) return;
      const time = Math.max(0, Math.min(((now - start) / 1000) % total, total - 0.8));
      renderVideoFrame(studio, canvas, time, { W, H, device: z.device, lang: $('#vidLang').value }, scratch);
      playing = requestAnimationFrame(tick);
    };
    playing = requestAnimationFrame(tick);
  }
  $('#videoDlg').addEventListener('change', guard(async (e) => {
    if (!e.target.closest('#vidMotion')) { play(); return; }
    await studio.mutate((p) => { p.motion = M.makeMotion({ preset: $('#vidPreset').value, transition: $('#vidTransition').value, seconds: $('#vidSeconds').value, fps: $('#vidFps').value }); });
    drawVideo(); play();
  }));
  async function exportVideo() {
    const path = await bridge.pickSave(`${(studio.project.name || 'preview').replace(/[^\p{L}\p{N}._-]+/gu, '-')}.mp4`, VIDEO_FILTERS);
    if (!path) return;
    const status = $('#vidStatus'), btn = $('[data-act=video-run]');
    cancelled = false; btn.disabled = true; $('[data-act=video-cancel]').hidden = false;
    try {
      const r = await studio.exportVideo({ path, size: $('#vidSize').value, lang: $('#vidLang').value, isCancelled: () => cancelled, onProgress: (n, total) => { status.textContent = t('Rendering frame {0} of {1}…', n, total); } });
      status.textContent = r.cancelled ? t('Cancelled') : `${t('Saved')}: ${r.path} (${r.width}×${r.height}, ${r.seconds} s)`;
    } finally { btn.disabled = false; $('[data-act=video-cancel]').hidden = true; }
  }

  /* ---------- agents ---------- */
  function drawAgents() {
    const info = getInfo();
    const url = `http://127.0.0.1:${info.port}/mcp`;
    const stdio = { command: info.exe, args: ['mcp'] };
    const json = (o) => JSON.stringify(o, null, 2);
    const clients = {
      'Claude Code': { where: t('Run in a terminal'), text: `claude mcp add --transport http severus-shot ${url}` },
      'Claude Desktop': { where: 'claude_desktop_config.json', text: json({ mcpServers: { 'severus-shot': stdio } }) },
      Cursor: { where: '~/.cursor/mcp.json', text: json({ mcpServers: { 'severus-shot': { url } } }) },
      'VS Code (Copilot)': { where: '.vscode/mcp.json', text: json({ servers: { 'severus-shot': { type: 'http', url } } }) },
      'Codex CLI': { where: '~/.codex/config.toml', text: `[mcp_servers.severus-shot]\ncommand = ${JSON.stringify(info.exe)}\nargs = ["mcp"]` },
      'Gemini CLI': { where: '~/.gemini/settings.json', text: json({ mcpServers: { 'severus-shot': stdio } }) },
      Windsurf: { where: '~/.codeium/windsurf/mcp_config.json', text: json({ mcpServers: { 'severus-shot': stdio } }) },
      [t('Any other MCP client')]: { where: t('HTTP endpoint, or launch this command for stdio'), text: `${url}\n\n${info.exe} mcp` },
    };
    const sel = $('#agentClient');
    const current = sel.value;
    sel.innerHTML = Object.keys(clients).map((k) => `<option${k === current ? ' selected' : ''}>${esc(k)}</option>`).join('');
    const c = clients[sel.value] || Object.values(clients)[0];
    $('#agentWhere').textContent = c.where;
    $('#agentSnippet').textContent = c.text;
    $('#agentState').textContent = info.mcp === 'on' ? t('Listening on {0} (this computer only).', url) : info.mcp === 'off' ? t('Agent control needs the desktop app.') : t('Agent control is not running: {0}', info.mcp);
    localize($('#agentDlg'));
  }
  $('#agentClient').addEventListener('change', drawAgents);

  return {
    actions: {
      templates: () => { drawTemplates(); show('#templatesDlg'); },
      elements: () => { drawElements(); show('#elementsDlg'); },
      'add-logo': addLogo,
      'el-text': async () => { close('#elementsDlg'); document.querySelector('[data-act=add-text]').click(); },
      'el-shot': async () => { close('#elementsDlg'); await addScreenshots(await pickImages(true)); },
      projects: async () => { await studio.flushSave(); await drawProjects(); show('#projectsDlg'); setTimeout(() => $('#projName').focus(), 50); },
      'proj-new': newProject,
      'proj-open-file': async () => {
        const p = await bridge.pickOpen(PROJECT_FILTERS);
        if (p) { await studio.open(p); close('#projectsDlg'); }
      },
      'proj-next': () => stepProject(1),
      'proj-prev': () => stepProject(-1),
      video: () => { drawVideo(); show('#videoDlg'); play(); },
      'video-run': exportVideo,
      'video-cancel': () => { cancelled = true; },
      shortcuts: () => show('#shortcutsDlg'),
      agents: () => { drawAgents(); show('#agentDlg'); },
      'agent-copy': async () => { try { await navigator.clipboard.writeText($('#agentSnippet').textContent); toast(t('Copied')); } catch (_) { toast(t('Select the text and copy it'), true); } },
    },
    redrawOpen() { if ($('#templatesDlg').open) drawTemplates(); if ($('#projectsDlg').open) drawProjects(); },
  };
}
export { IMAGE_FILTERS };
