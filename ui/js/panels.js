// Dialogs around the editor: template gallery, element library, projects, video, shortcuts, agents.
import * as M from './model.js';
import { bridge, isTauri, IMAGE_FILTERS, PROJECT_FILTERS, VIDEO_FILTERS, AUDIO_FILTERS, mimeOf } from './bridge.js';
import { renderTrack } from './music.js';
import { renderVideoFrame, videoDuration } from './motion.js';
import { t, localize } from './i18n.js';
import { icon } from './icons.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initPanels({ studio, toast, guard, getInfo, addScreenshots, pickImages, confirmDiscard, api }) {
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
    for (const card of $('#tplGrid').children) slideThumb(card.querySelector('canvas'), M.makeSlide(card.dataset.tpl, tplTheme, carry), 130);
    localize($('#tab-templates'));
  }
  $('#tab-templates').addEventListener('click', guard(async (e) => {
    const sw = e.target.closest('[data-theme]');
    if (sw) { tplTheme = sw.dataset.theme; drawTemplates(); return; }
    const use = e.target.closest('[data-use]'), add = e.target.closest('[data-add]');
    if (use) {
      await studio.mutate(() => M.applyTemplate(studio.slide, use.dataset.use, tplTheme));
      studio.selectedId = null; studio.emit();
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
    const tone = (k) => (k === 'rating' ? { fill: '#ffc83d' } : ['notification', 'bubble', 'stat', 'tooltip'].includes(k) ? { fill: '#ffffff', color: '#14161b' } : k === 'highlight' ? { fill: '#ffe14d' } : {});
    $('#elStickers').innerHTML = M.STICKERS.map((k) => `<button type="button" class="tile" data-sticker="${k}" title="${esc(M.STICKER_LABELS[k])}"><canvas></canvas><span>${esc(M.STICKER_LABELS[k])}</span></button>`).join('');
    for (const b of $('#elStickers').children) {
      const k = b.dataset.sticker;
      elementThumb(b.querySelector('canvas'), M.makeElement('sticker', { kind: k, ...theme, ...tone(k) }));
    }
    $('#elShapes').innerHTML = M.SHAPES.map((k) => `<button type="button" class="tile" data-shape="${k}" title="${esc(M.SHAPE_LABELS[k])}"><canvas></canvas><span>${esc(M.SHAPE_LABELS[k])}</span></button>`).join('');
    for (const b of $('#elShapes').children) {
      const k = b.dataset.shape, wide = ['pill', 'squiggle', 'wave'].includes(k);
      elementThumb(b.querySelector('canvas'), M.makeElement('shape', { shape: k, fill: '#7c6cff', w: 600, h: wide ? 170 : 600, stroke: 40 }));
    }
    localize($('#tab-elements'));
  }
  async function insert(el) {
    await studio.mutate(() => { studio.slide.elements.push(el); });
    studio.selectedId = el.id; studio.emit();
  }
  async function addLogo() {
    const [src] = await pickImages(false);
    if (!src) return;
    const el = M.makeElement('image', { src, w: 260, x: M.BASE.w / 2, y: 190, radius: 56, name: 'Logo' });
    await studio.mutate(() => { studio.slide.elements.push(el); });
    await studio.mutate(() => studio.fitToImage(el), { history: false });
    studio.selectedId = el.id; studio.emit();
  }
  $('#tab-elements').addEventListener('click', guard(async (e) => {
    const s = e.target.closest('[data-sticker]'), sh = e.target.closest('[data-shape]');
    if (s) {
      const k = s.dataset.sticker;
      const tone = k === 'rating' ? { fill: '#ffc83d' } : ['notification', 'bubble', 'stat', 'tooltip'].includes(k) ? { fill: '#ffffff', color: '#14161b' } : k === 'highlight' ? { fill: '#ffe14d' } : {};
      await insert(M.makeElement('sticker', { kind: k, y: 1100, ...tone }));
    } else if (sh) {
      const k = sh.dataset.shape, wide = ['pill', 'squiggle', 'wave'].includes(k);
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
  let playing = 0, cancelled = false, vt = 0, vPlaying = true, vLast = 0, vCat = 'essentials', vHover = null;
  const opts = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const CAT_ICON = { essentials: 'star', slide: 'export', zoom: 'search', bounce: 'download', spin: 'redo', device: 'phone', cinematic: 'play', playful: 'sticker' };
  const previewMotion = () => (vHover ? M.applyMotionTemplate(studio.project.motion, vHover) : studio.project.motion);
  function drawVideo() {
    const m = studio.project.motion;
    $('#vidPreset').innerHTML = opts(M.MOTIONS, m.preset);
    $('#vidTransition').innerHTML = opts(M.TRANSITIONS, m.transition);
    $('#vidCamera').innerHTML = opts(M.CAMERAS, m.camera);
    $('#vidSeconds').value = m.seconds;
    $('#vidFps').value = String(m.fps);
    $('#vidFloat').checked = m.float;
    $('#vidCats').innerHTML = Object.entries(M.MOTION_CATS).map(([k, v]) => `<button type="button" data-cat="${k}" class="${k === vCat ? 'on' : ''}">${esc(v)} <small>${M.MOTION_TABLE.filter((r) => r[2] === k).length}</small></button>`).join('');
    $('#vidGrid').innerHTML = M.MOTION_TABLE.filter((r) => r[2] === vCat).map((r) => `<button type="button" class="mcard ${r[0] === m.preset ? 'on' : ''}" data-motion="${r[0]}"><i>${icon(CAT_ICON[r[2]])}</i><span>${esc(r[1])}</span></button>`).join('');
    const mv = m.music.type === 'builtin' ? `b:${m.music.id}` : m.music.type;
    const tracks = [['none', t('No music')], ...Object.entries(M.MUSIC_TRACKS).map(([k, v]) => [`b:${k}`, t(v)]), ['file', t('My own audio file…')]];
    $('#vidMusic').innerHTML = tracks.map(([k, v]) => `<option value="${k}"${k === mv ? ' selected' : ''}>${esc(v)}</option>`).join('');
    $('#vidTracks').innerHTML = tracks.map(([k, v]) => `<button type="button" class="track ${k === mv ? 'on' : ''}" data-track="${k}" data-no-i18n>${icon(k === 'none' ? 'pause' : k === 'file' ? 'open' : 'music')}<span>${esc(v)}</span></button>`).join('');
    $('#vidFileRow').hidden = mv !== 'file';
    $('#vidVolRow').hidden = m.music.type === 'none';
    $('#vidVolume').value = m.music.volume;
    $('#vidFile').textContent = m.music.path || t('none');
    if (!$('#vidSize').options.length) $('#vidSize').innerHTML = M.VIDEO_SIZES.map((z) => `<option value="${z.id}">${esc(z.label)}</option>`).join('');
    const langNow = $('#vidLang').value || studio.lang;
    $('#vidLang').innerHTML = studio.project.languages.map((l) => `<option${l === langNow ? ' selected' : ''}>${esc(l)}</option>`).join('');
    $('#vidSummary').textContent = `${studio.project.slides.length} × ${m.seconds}s · ${videoDuration(studio.project).toFixed(1)}s · ${m.fps} fps`;
    if (!$('#vidStatus').dataset.busy) $('#vidStatus').textContent = studio.hasFfmpeg ? '' : t('Video export needs ffmpeg, a free video encoder. Download it once here; the preview works without it.');
    $('#vidFfmpeg').hidden = studio.hasFfmpeg || !isTauri;
    localize($('#videoDlg'));
  }
  // Live preview with a scrubber. Hovering a template previews it before you commit to it.
  function play() {
    cancelAnimationFrame(playing);
    const z = M.VIDEO_SIZES.find((v) => v.id === $('#vidSize').value) || M.VIDEO_SIZES[0];
    const canvas = $('#vidCanvas');
    const H = 880, W = Math.round((H * z.w) / z.h);
    const mk = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    const scratch = { a: mk(), b: mk() };
    vLast = 0;
    const tick = (now) => {
      if (!$('#videoDlg').open) return;
      const motion = previewMotion();
      const total = videoDuration(studio.project, motion);
      if (vPlaying && vLast) vt += (now - vLast) / 1000;
      vLast = now;
      if (vt > total + 0.7) vt = 0;
      const time = Math.max(0, Math.min(vt, total));
      renderVideoFrame(studio, canvas, time, { W, H, device: z.device, lang: $('#vidLang').value, motion }, scratch);
      if (document.activeElement !== $('#vidScrub')) $('#vidScrub').value = Math.round((time / total) * 1000);
      $('#vidTime').textContent = `${time.toFixed(1)} / ${total.toFixed(1)} s`;
      playing = requestAnimationFrame(tick);
    };
    playing = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    vPlaying = on;
    const b = $('#vidToggle');
    b.dataset.icon = on ? 'pause' : 'play';
    b.innerHTML = icon(b.dataset.icon);
  }
  $('#vidScrub').addEventListener('input', (e) => { setPlaying(false); vt = (e.target.value / 1000) * videoDuration(studio.project, previewMotion()); });
  $('#vidGrid').addEventListener('pointerover', (e) => { const c = e.target.closest('[data-motion]'); if (c && vHover !== c.dataset.motion) { vHover = c.dataset.motion; vt = 0; setPlaying(true); } });
  $('#vidGrid').addEventListener('pointerleave', () => { if (vHover) { vHover = null; vt = 0; } });
  $('#videoDlg').addEventListener('click', guard(async (e) => {
    const cat = e.target.closest('[data-cat]'), card = e.target.closest('[data-motion]'), track = e.target.closest('[data-track]');
    if (cat) { vCat = cat.dataset.cat; drawVideo(); }
    else if (card) {
      vHover = null;
      await studio.mutate((p) => { p.motion = M.applyMotionTemplate(p.motion, card.dataset.motion); });
      vt = 0; setPlaying(true); drawVideo();
    } else if (track) { $('#vidMusic').value = track.dataset.track; $('#vidMusic').dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  $('#videoDlg').addEventListener('change', guard(async (e) => {
    if (e.target.id === 'vidScrub') return;
    if (!e.target.closest('#vidMotion') && e.target.id !== 'vidVolume') { play(); return; }
    const pick = $('#vidMusic').value, old = studio.project.motion.music;
    const music = pick === 'none' ? { type: 'none' } : pick === 'file' ? { type: 'file', path: old.path, volume: $('#vidVolume').value } : { type: 'builtin', id: pick.slice(2), volume: $('#vidVolume').value };
    if (pick === 'file' && !old.path) { $('#vidFileRow').hidden = false; $('#vidVolRow').hidden = true; for (const b of document.querySelectorAll('.track')) b.classList.toggle('on', b.dataset.track === 'file'); return; }
    stopMusic();
    await studio.mutate((p) => { p.motion = M.makeMotion({ ...p.motion, transition: $('#vidTransition').value, camera: $('#vidCamera').value, seconds: $('#vidSeconds').value, fps: $('#vidFps').value, float: $('#vidFloat').checked, music }); });
    drawVideo();
  }));
  async function exportVideo() {
    const path = await bridge.pickSave(`${(studio.project.name || 'preview').replace(/[^\p{L}\p{N}._-]+/gu, '-')}.mp4`, VIDEO_FILTERS);
    if (!path) return;
    const status = $('#vidStatus'), btn = $('[data-act=video-run]');
    cancelled = false; btn.disabled = true; $('[data-act=video-cancel]').hidden = false; status.dataset.busy = '1';
    setPlaying(false); stopMusic();
    try {
      const r = await studio.exportVideo({ path, size: $('#vidSize').value, lang: $('#vidLang').value, isCancelled: () => cancelled, onProgress: (n, total) => { status.textContent = `${t('Rendering frame {0} of {1}…', n, total)}  ${Math.round((n / total) * 100)}%`; } });
      status.textContent = r.cancelled ? t('Cancelled') : `${t('Saved')}: ${r.path} (${r.width}×${r.height}, ${r.seconds} s)`;
    } finally { btn.disabled = false; $('[data-act=video-cancel]').hidden = true; }
  }

  /* ---------- docked library (templates, elements, icons, fonts) ---------- */
  const TAB_TITLES = { templates: 'Templates', elements: 'Elements', icons: 'Icons', fonts: 'Fonts' };
  let tab = '';
  function openTab(name) {
    if (tab === name) { closeTab(); return; }
    tab = name;
    $('#library').hidden = false;
    $('#libTitle').textContent = t(TAB_TITLES[name]);
    for (const sec of document.querySelectorAll('#library section')) sec.hidden = sec.id !== `tab-${name}`;
    for (const b of document.querySelectorAll('.rail [data-tab]')) b.classList.toggle('on', b.dataset.tab === name);
    ({ templates: drawTemplates, elements: drawElements, icons: drawIcons, fonts: drawFonts })[name]();
    if (name === 'icons') setTimeout(() => $('#iconSearch').focus(), 30);
    if (name === 'fonts') setTimeout(() => $('#fontSearch').focus(), 30);
    window.dispatchEvent(new Event('resize'));
  }
  function closeTab() {
    tab = '';
    $('#library').hidden = true;
    for (const b of document.querySelectorAll('.rail [data-tab]')) b.classList.remove('on');
    window.dispatchEvent(new Event('resize'));
  }
  document.querySelector('.rail').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) openTab(b.dataset.tab); });

  /* ---------- icons ---------- */
  const svgFor = (nodes) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${nodes.map(([tag, a]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('')}</svg>`;
  async function drawIcons() {
    if (!studio.icons.size) { $('#iconNote').textContent = t('Loading icons…'); try { await studio.loadIcons(); } catch (err) { $('#iconNote').textContent = String(err.message || err); return; } }
    const q = $('#iconSearch').value;
    const hits = studio.searchIcons(q, 240);
    $('#iconGrid').innerHTML = hits.map((n) => `<button type="button" data-icon-name="${n}" title="${n}">${svgFor(studio.icons.get(n))}</button>`).join('');
    $('#iconNote').textContent = hits.length ? (hits.length >= 240 ? t('Showing the first 240. Type to narrow the list.') : '') : t('No icon matches that search.');
  }
  $('#iconSearch').addEventListener('input', () => { clearTimeout(drawIcons.timer); drawIcons.timer = setTimeout(drawIcons, 90); });
  $('#iconGrid').addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-icon-name]');
    if (!b) return;
    const sel = studio.selected;
    if (sel && sel.type === 'icon') { await studio.mutate(() => M.updateElement(sel, { icon: b.dataset.iconName })); return; }
    const el = M.makeElement('icon', { icon: b.dataset.iconName, y: 1200, bg: 'circle' });
    await studio.mutate(() => { studio.slide.elements.push(el); });
    studio.selectedId = el.id; studio.emit();
  }));

  /* ---------- fonts ---------- */
  function fontTargets() {
    const sel = studio.selected;
    if (sel && (sel.type === 'text' || sel.type === 'sticker')) return { els: [sel], label: t('Applies to the selected text.') };
    return { els: studio.project.slides.flatMap((s) => s.elements.filter((e) => e.type === 'text')), label: t('Nothing is selected, so a font applies to all captions.') };
  }
  function drawFonts() {
    const q = $('#fontSearch').value.trim().toLowerCase();
    const cur = fontTargets().els[0]?.fontFamily;
    const have = new Set(studio.project.fonts.map((f) => f.family));
    const row = (name, kind) => `<button type="button" class="fontRow ${name === cur ? 'on' : ''}" data-font="${esc(name)}" data-kind="${kind}"><b style="${kind === 'google' && !have.has(name) ? '' : `font-family:'${esc(name)}'`}">${esc(name)}</b><small>${kind === 'google' && !have.has(name) ? `${icon('download')}Google` : name === cur ? icon('check') : ''}</small></button>`;
    const match = (n) => !q || n.toLowerCase().includes(q);
    let h = '';
    const mine = [...have].filter(match);
    if (mine.length) h += `<h3>${esc(t('In this project'))}</h3>${mine.map((n) => row(n, 'project')).join('')}`;
    const bundled = M.BUNDLED_FONTS.filter(match);
    if (bundled.length) h += `<h3>${esc(t('Included'))}</h3>${bundled.map((n) => row(n, 'bundled')).join('')}`;
    let googleShown = 0;
    for (const [g, list] of Object.entries(M.GOOGLE_FONTS)) {
      const items = list.filter((n) => match(n) && !have.has(n));
      if (!items.length) continue;
      googleShown += items.length;
      h += `<h3>Google Fonts · ${esc(t(M.GOOGLE_FONT_GROUPS[g]))}</h3>${items.map((n) => row(n, 'google')).join('')}`;
    }
    const typed = $('#fontSearch').value.trim();
    if (typed.length > 2 && !googleShown && !have.has(typed)) h += `<h3>Google Fonts</h3><button type="button" class="fontRow" data-font="${esc(typed)}" data-kind="google"><b>${esc(t('Get "{0}" from Google Fonts', typed))}</b><small>${icon('download')}</small></button>`;
    const system = studio.systemFonts.filter(match).slice(0, q ? 80 : 40);
    if (system.length) h += `<h3>${esc(t('Installed on this computer'))}</h3>${system.map((n) => row(n, 'system')).join('')}`;
    $('#fontList').innerHTML = h || `<p class="empty">${esc(t('No font matches that search.'))}</p>`;
    $('#fontTarget').textContent = fontTargets().label;
  }
  $('#fontSearch').addEventListener('input', () => { clearTimeout(drawFonts.timer); drawFonts.timer = setTimeout(drawFonts, 90); });
  $('#fontList').addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-font]');
    if (!b) return;
    let family = b.dataset.font;
    if (b.dataset.kind === 'google' && !studio.project.fonts.some((f) => f.family === family)) {
      b.querySelector('small').textContent = t('Downloading…');
      family = (await studio.addGoogleFont(family)).family;
    }
    const { els } = fontTargets();
    await studio.mutate(() => { for (const el of els) el.fontFamily = family; });
    toast(t('Font: {0}', family));
    drawFonts();
  }));

  /* ---------- command palette ---------- */
  const COMMANDS = [
    ['New project', 'new', 'Ctrl N'], ['Open the project list', 'projects', 'Ctrl O'], ['Save', 'save', 'Ctrl S'], ['Export images', 'export', 'Ctrl E'], ['Motion video', 'video', 'Ctrl Shift E'],
    ['Templates', 'tab:templates', 'G'], ['Elements', 'tab:elements', 'E'], ['Icons', 'tab:icons', 'I'], ['Fonts', 'tab:fonts', 'F'],
    ['Add text', 'add-text', 'T'], ['Add screenshot', 'add-screenshot', 'S'], ['Add logo or image', 'add-logo', 'L'], ['New slide', 'slide-add', 'Ctrl Enter'],
    ['Duplicate slide', 'slide-dup', ''], ['Delete slide', 'slide-del', ''], ['Undo', 'undo', 'Ctrl Z'], ['Redo', 'redo', 'Ctrl Shift Z'],
    ['Capture from a simulator or phone', 'capture', 'Ctrl Shift S'], ['Local AI: translate and write captions', 'ai', 'Ctrl J'], ['Check for updates', 'update-check', ''], ['Connect an AI agent', 'agents', ''], ['Keyboard shortcuts', 'shortcuts', '?'], ['Switch interface language', 'ui-lang', ''],
  ];
  let palIndex = 0, palHits = [];
  function drawPalette() {
    const q = $('#palInput').value.trim().toLowerCase();
    palHits = COMMANDS.filter(([label]) => !q || label.toLowerCase().includes(q) || t(label).toLowerCase().includes(q));
    palIndex = Math.min(palIndex, Math.max(0, palHits.length - 1));
    $('#palList').innerHTML = palHits.map(([label, , keys], i) => `<button type="button" class="palItem ${i === palIndex ? 'on' : ''}" data-i="${i}"><span>${esc(t(label))}</span><small>${esc(keys)}</small></button>`).join('') || `<p class="sub" style="padding:8px 12px">${esc(t('No command matches.'))}</p>`;
  }
  async function runCommand(i) {
    const cmd = palHits[i];
    if (!cmd) return;
    close('#paletteDlg');
    if (cmd[1].startsWith('tab:')) { if (tab !== cmd[1].slice(4)) openTab(cmd[1].slice(4)); } else await api.run(cmd[1]);
  }
  $('#palInput').addEventListener('input', () => { palIndex = 0; drawPalette(); });
  $('#palInput').addEventListener('keydown', guard(async (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); palIndex = (palIndex + (e.key === 'ArrowDown' ? 1 : -1) + palHits.length) % Math.max(1, palHits.length); drawPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); await runCommand(palIndex); }
  }));
  $('#palList').addEventListener('click', guard(async (e) => { const b = e.target.closest('[data-i]'); if (b) await runCommand(+b.dataset.i); }));

  /* ---------- music preview ---------- */
  let audioCtx = null, audioNode = null, audioEl = null;
  function stopMusic() {
    if (audioNode) { try { audioNode.stop(); } catch (_) { /* already stopped */ } audioNode = null; }
    if (audioEl) { audioEl.pause(); audioEl = null; }
  }
  async function listen() {
    if (audioNode || audioEl) { stopMusic(); return; }
    const m = studio.project.motion.music;
    if (m.type === 'builtin') {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const buf = await renderTrack(m.id, Math.max(4, videoDuration(studio.project)));
      const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
      src.buffer = buf; src.loop = true; g.gain.value = m.volume;
      src.connect(g); g.connect(audioCtx.destination); src.start();
      audioNode = src;
    } else if (m.type === 'file') {
      audioEl = new Audio(`data:${{ mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac' }[m.path.split('.').pop().toLowerCase()] || mimeOf(m.path)};base64,${await bridge.readFileB64(m.path)}`);
      audioEl.volume = m.volume; audioEl.loop = true;
      await audioEl.play();
    }
  }
  $('#videoDlg').addEventListener('close', stopMusic);

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
      templates: () => openTab('templates'),
      elements: () => openTab('elements'),
      icons: () => openTab('icons'),
      fonts: () => openTab('fonts'),
      'add-logo': addLogo,
      projects: async () => { await studio.flushSave(); await drawProjects(); show('#projectsDlg'); setTimeout(() => $('#projName').focus(), 50); },
      'proj-new': newProject,
      'proj-open-file': async () => {
        const p = await bridge.pickOpen(PROJECT_FILTERS);
        if (p) { await studio.open(p); close('#projectsDlg'); }
      },
      'proj-next': () => stepProject(1),
      'proj-prev': () => stepProject(-1),
      video: () => { delete $('#vidStatus').dataset.busy; vt = 0; vHover = null; const cur = M.MOTION_TABLE.find((r) => r[0] === studio.project.motion.preset); if (cur) vCat = cur[2]; drawVideo(); show('#videoDlg'); setPlaying(true); play(); },
      'video-toggle': () => setPlaying(!vPlaying),
      'video-run': exportVideo,
      'video-cancel': () => { cancelled = true; },
      'video-listen': listen,
      'video-audio': async () => {
        const path = await bridge.pickOpen(AUDIO_FILTERS);
        if (!path) return;
        stopMusic();
        await studio.mutate((p) => { p.motion = M.makeMotion({ ...p.motion, music: { type: 'file', path, volume: $('#vidVolume').value || 0.8 } }); });
        drawVideo();
      },
      'lib-close': closeTab,
      palette: () => { $('#palInput').value = ''; palIndex = 0; drawPalette(); show('#paletteDlg'); setTimeout(() => $('#palInput').focus(), 30); },
      'tab-icons': () => { if (tab !== 'icons') openTab('icons'); },
      'tab-fonts': () => { if (tab !== 'fonts') openTab('fonts'); },
      shortcuts: () => show('#shortcutsDlg'),
      agents: () => { drawAgents(); show('#agentDlg'); },
      'agent-copy': async () => { try { await navigator.clipboard.writeText($('#agentSnippet').textContent); toast(t('Copied')); } catch (_) { toast(t('Select the text and copy it'), true); } },
    },
    redrawOpen() { if (tab) { $('#libTitle').textContent = t(TAB_TITLES[tab]); ({ templates: drawTemplates, elements: drawElements, icons: drawIcons, fonts: drawFonts })[tab](); } if ($('#projectsDlg').open) drawProjects(); },
    refreshFonts() { if (tab === 'fonts') drawFonts(); },
  };
}
export { IMAGE_FILTERS };
