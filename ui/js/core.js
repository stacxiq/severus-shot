// Studio: the single source of truth used by both the editor UI and the agent (MCP) tools.
import * as M from './model.js';
import { renderSlide, imageSources, fontsUsed, FRAME_GEOM } from './render.js';
import { bridge, mimeOf } from './bridge.js';
import { renderVideoFrame, videoDuration } from './motion.js';

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const joinPath = (...parts) => parts.filter(Boolean).join('/').replace(/([^:])\/{2,}/g, '$1/');
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

export class Studio {
  constructor() {
    this.project = M.newProject();
    this.slideIndex = 0;
    this.selectedId = null;
    this.lang = 'en';
    this.previewSize = M.STORE_SIZES[0];
    this.filePath = null;
    this.dirty = false;
    this.images = new Map();
    this.failedImages = new Map();
    this.loadedFonts = new Set();
    this.systemFonts = [];
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.clipboard = null;
    this.projectsDir = '';
    this.hasFfmpeg = false;
    this.saveTimer = null;
    this.saving = Promise.resolve();
  }

  onChange(fn) { this.listeners.add(fn); }
  emit(reason = 'change') { for (const fn of this.listeners) fn(reason); }
  get slide() { return this.project.slides[this.slideIndex]; }
  get selected() { return this.slide.elements.find((e) => e.id === this.selectedId) || null; }

  // Every edit goes through here: snapshot for undo, apply, then load any new assets and repaint.
  async mutate(fn, { history = true } = {}) {
    const before = JSON.stringify(this.project);
    const result = fn(this.project);
    const after = JSON.stringify(this.project);
    if (before !== after) {
      if (history) {
        this.undoStack.push(before);
        if (this.undoStack.length > 100) this.undoStack.shift();
        this.redoStack.length = 0;
      }
      this.dirty = true;
      this.scheduleSave();
    }
    this.clamp();
    await this.ensureAssets();
    this.emit();
    return result;
  }

  clamp() {
    this.slideIndex = Math.min(Math.max(0, this.slideIndex), this.project.slides.length - 1);
    if (!this.project.languages.includes(this.lang)) this.lang = this.project.languages[0];
    if (this.selectedId && !this.selected) this.selectedId = null;
  }

  async restore(json, from, to) {
    from.push(JSON.stringify(this.project));
    this.project = JSON.parse(json);
    this.dirty = true;
    this.scheduleSave();
    this.clamp();
    await this.ensureAssets();
    this.emit();
    void to;
  }
  async undo() { if (this.undoStack.length) await this.restore(this.undoStack.pop(), this.redoStack); }
  async redo() { if (this.redoStack.length) await this.restore(this.redoStack.pop(), this.undoStack); }

  resolveSlide(ref) {
    if (ref === undefined || ref === null || ref === '') return this.slide;
    if (typeof ref === 'number' || /^\d+$/.test(String(ref))) {
      const s = this.project.slides[Number(ref) - 1];
      if (!s) throw new Error(`No slide ${ref}. The project has ${this.project.slides.length} slide(s); numbering starts at 1.`);
      return s;
    }
    const s = this.project.slides.find((x) => x.id === ref);
    if (!s) throw new Error(`No slide with id ${ref}`);
    return s;
  }
  resolveElement(slide, id) {
    const el = slide.elements.find((e) => e.id === id || (e.name && e.name === id));
    if (!el) throw new Error(`No element "${id}" on that slide. Elements: ${slide.elements.map((e) => `${e.id} (${e.type}${e.name ? `, ${e.name}` : ''})`).join('; ') || 'none'}`);
    return el;
  }

  async loadImage(src) {
    if (!src || this.images.has(src) || this.failedImages.has(src)) return;
    try {
      let url = src;
      if (!/^(data:|blob:|https?:)/.test(src)) url = `data:${mimeOf(src)};base64,${await bridge.readFileB64(src)}`;
      const img = new Image();
      img.src = url;
      await img.decode();
      this.images.set(src, img);
    } catch (err) {
      this.failedImages.set(src, String(err && err.message ? err.message : err));
    }
  }

  async registerFont(family, path) {
    const key = `${family}|${path}`;
    if (this.loadedFonts.has(key)) return;
    const bytes = b64ToBytes(await bridge.readFileB64(path));
    const face = new FontFace(family, bytes.buffer);
    await face.load();
    document.fonts.add(face);
    this.loadedFonts.add(key);
  }

  async ensureAssets() {
    await Promise.all(imageSources(this.project).map((s) => this.loadImage(s)));
    for (const f of this.project.fonts) {
      try { await this.registerFont(f.family, f.path); } catch (err) { console.warn('font load failed', f.path, err); }
    }
    await Promise.all(fontsUsed(this.project).map(([spec, text]) => document.fonts.load(spec, text).catch(() => null)));
  }

  async addFontFile(path, familyOverride) {
    const info = await bridge.fontInfo(path);
    const family = String(familyOverride || info.family || path.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''));
    await this.registerFont(family, path);
    await this.mutate((p) => {
      if (!p.fonts.some((f) => f.family === family && f.path === path)) p.fonts.push({ family, path });
    });
    return family;
  }

  fontFamilies() {
    return [...new Set([...this.project.fonts.map((f) => f.family), ...M.BUNDLED_FONTS, ...this.systemFonts])];
  }

  imageSize(src) {
    const img = this.images.get(src);
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  }

  render(canvas, slide, { W, H, lang, device, final = false, placeholder, anim }) {
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    return renderSlide(ctx, this.project, slide, {
      W, H, lang: lang || this.lang, device, final, placeholder, anim,
      getImage: (src) => this.images.get(src) || null,
      createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
    });
  }

  async preview({ slide, size, lang, maxWidth = 480 }) {
    await this.ensureAssets();
    const z = M.resolveSize(size || this.previewSize);
    const k = Math.min(1, maxWidth / z.w);
    const canvas = document.createElement('canvas');
    this.render(canvas, this.resolveSlide(slide), { W: Math.round(z.w * k), H: Math.round(z.h * k), lang, device: z.device, final: true });
    return { mime: 'image/jpeg', b64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], width: canvas.width, height: canvas.height };
  }

  missingAssets() {
    const out = [];
    this.project.slides.forEach((s, i) => {
      for (const e of s.elements) {
        if (e.type === 'screenshot' && !e.src) out.push(`Slide ${i + 1}: screenshot ${e.id} has no image`);
        for (const src of [e.src, e.srcTablet]) if (src && this.failedImages.has(src)) out.push(`Slide ${i + 1}: could not load ${src} (${this.failedImages.get(src)})`);
      }
      if (s.background.type === 'image' && this.failedImages.has(s.background.src)) out.push(`Slide ${i + 1}: could not load background ${s.background.src}`);
    });
    return out;
  }

  async exportAll({ outDir, sizes, languages, slides, format = 'png', zip = false, onProgress } = {}) {
    if (!outDir) throw new Error('outDir is required');
    await this.ensureAssets();
    const fmt = /^jpe?g$/i.test(format) ? 'jpg' : 'png';
    const zs = (sizes && sizes.length ? sizes : M.STORE_SIZES.map((z) => z.id)).map(M.resolveSize);
    const langs = languages && languages.length ? languages : this.project.languages;
    for (const l of langs) if (!this.project.languages.includes(l)) throw new Error(`Language "${l}" is not in the project (${this.project.languages.join(', ')})`);
    const picked = slides && slides.length ? slides.map((r) => this.resolveSlide(r)) : this.project.slides;
    const canvas = document.createElement('canvas');
    const files = [];
    const total = zs.length * langs.length * picked.length;
    for (const lang of langs) {
      for (const z of zs) {
        for (const slide of picked) {
          const n = this.project.slides.indexOf(slide) + 1;
          this.render(canvas, slide, { W: z.w, H: z.h, lang, device: z.device, final: true });
          const path = joinPath(outDir, langs.length > 1 ? safeName(lang) : '', safeName(z.id), `${String(n).padStart(2, '0')}.${fmt}`);
          const saved = await bridge.saveImage(path, canvas.toDataURL('image/png').split(',')[1], fmt, 92);
          files.push(saved.path || path);
          if (onProgress) onProgress(files.length, total);
        }
      }
    }
    let zipPath = null;
    if (zip) zipPath = (await bridge.zipDir(outDir, `${outDir.replace(/[\\/]+$/, '')}.zip`)).path;
    return { outDir, count: files.length, files, zip: zipPath, warnings: this.missingAssets() };
  }

  async setProject(project, filePath = null) {
    this.project = M.sanitizeProject(project);
    this.filePath = filePath;
    this.slideIndex = 0;
    this.selectedId = null;
    this.lang = this.project.languages[0];
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.dirty = false;
    this.failedImages.clear();
    await this.ensureAssets();
    this.emit('project');
  }
  async open(path) { await this.flushSave(); await this.setProject(JSON.parse(await bridge.readText(path)), path); }
  async save(path) {
    const target = path || this.filePath;
    if (!target) throw new Error('No file path yet. Pass a path to save to.');
    clearTimeout(this.saveTimer);
    try { this.project.thumb = (await this.thumbnail()) || this.project.thumb || ''; } catch (_) { /* a thumbnail is optional */ }
    const text = JSON.stringify(this.project, null, 2);
    this.saving = this.saving.catch(() => null).then(() => bridge.writeText(target, text));
    await this.saving;
    this.filePath = target;
    this.dirty = false;
    this.emit('saved');
    return target;
  }
  async thumbnail() {
    const r = await this.preview({ slide: 1, size: 'iphone-6.9', lang: this.project.languages[0], maxWidth: 200 });
    return `data:${r.mime};base64,${r.b64}`;
  }

  // ----- project library: projects kept in one folder are saved automatically -----
  inLibrary(path = this.filePath) {
    return !!(path && this.projectsDir && path.replace(/\\/g, '/').startsWith(`${this.projectsDir}/`));
  }
  scheduleSave() {
    if (!this.inLibrary()) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.save().catch((err) => console.warn('autosave failed', err)); }, 1200);
  }
  async flushSave() {
    if (this.dirty && this.inLibrary()) await this.save().catch((err) => console.warn('autosave failed', err));
  }
  async listProjects() { return this.projectsDir ? bridge.listProjects(this.projectsDir) : []; }
  async createProject(name, template, theme, languages) {
    await this.flushSave();
    const existing = await this.listProjects();
    const taken = new Set(existing.map((p) => p.path.split('/').pop().toLowerCase()));
    let title = String(name || '').trim();
    if (!title) { let n = existing.length + 1; do { title = `Project ${n}`; n += 1; } while (existing.some((p) => p.name === title)); }
    const slug = title.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'project';
    let file = `${slug}.severus`, i = 2;
    while (taken.has(file.toLowerCase())) { file = `${slug}-${i}.severus`; i += 1; }
    const p = M.newProject(title);
    p.slides = [M.makeSlide(template, theme)];
    if (languages && languages.length) p.languages = [...new Set(languages.map(String))];
    await this.setProject(p, this.projectsDir ? `${this.projectsDir}/${file}` : null);
    if (this.filePath) await this.save();
    return this.filePath;
  }
  async deleteProject(path) {
    await bridge.deleteProject(path);
    if (this.filePath === path) { this.filePath = null; this.dirty = false; }
  }

  // ----- motion video -----
  async exportVideo({ path, size, lang, onProgress, isCancelled } = {}) {
    if (!path) throw new Error('path is required (an .mp4 file)');
    if (!this.hasFfmpeg) throw new Error('Video export needs ffmpeg. Install it (macOS: brew install ffmpeg · Windows: winget install ffmpeg · Linux: apt install ffmpeg) and restart Severus Shot.');
    await this.ensureAssets();
    const z = M.VIDEO_SIZES.find((v) => v.id === size) || M.resolveSize(size || 'video-1080');
    const W = z.w - (z.w % 2), H = z.h - (z.h % 2);
    const { fps } = this.project.motion;
    const duration = videoDuration(this.project), frames = Math.max(1, Math.round(duration * fps));
    const mk = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    const canvas = mk(), scratch = { a: mk(), b: mk() };
    const id = await bridge.videoStart(path, fps, W, H);
    try {
      for (let f = 0; f < frames; f += 1) {
        if (isCancelled && isCancelled()) { await bridge.videoFinish(id, true); return { cancelled: true }; }
        renderVideoFrame(this, canvas, f / fps, { W, H, device: z.device, lang: lang || this.lang }, scratch);
        await bridge.videoFrame(id, canvas.toDataURL('image/jpeg', 0.93).split(',')[1]);
        if (onProgress) onProgress(f + 1, frames);
      }
    } catch (err) {
      await bridge.videoFinish(id, true).catch(() => null);
      throw err;
    }
    await bridge.videoFinish(id);
    return { path, width: W, height: H, fps, seconds: Math.round(duration * 100) / 100, frames, warnings: this.missingAssets() };
  }

  // Place a new screenshot/image so its box matches the picture's proportions.
  fitToImage(el) {
    const size = this.imageSize(el.src);
    if (!size) return;
    const aspect = size.w / size.h;
    if (el.type === 'screenshot') {
      const bezel = (FRAME_GEOM[el.frame === 'auto' ? 'phone' : el.frame] || FRAME_GEOM.phone).bezel;
      const inner = el.w * (1 - 2 * bezel);
      el.h = inner / aspect + el.w * 2 * bezel;
    } else {
      el.h = el.w / aspect;
    }
  }
}
