// MCP (Model Context Protocol) tools. The Rust side only transports JSON-RPC; all behaviour lives here.
import * as M from './model.js';
import { bridge } from './bridge.js';
import { LocalAI, translateProject } from './ai.js';
import { aiSettings, captureInto } from './extras.js';

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const numb = (description) => ({ type: 'number', description });
const bool = (description) => ({ type: 'boolean', description });
const SLIDE = { description: 'Slide number (1-based) or slide id. Defaults to the current slide.', type: ['number', 'string'] };
const POS = {
  x: numb(`Centre X in design units (canvas is ${M.BASE.w} wide)`),
  y: numb(`Centre Y in design units (canvas is ${M.BASE.h} tall)`),
  w: numb('Width in design units'),
  h: numb('Height in design units'),
  rotation: numb('Rotation in degrees'),
  opacity: numb('0 to 1'),
  name: str('Optional label, usable instead of the id later'),
};
const TEXT_PROPS = {
  fontFamily: str('Font family name: an installed system font or one added with load_font'),
  fontSize: numb('Font size in design units (title ≈ 130, subtitle ≈ 60)'),
  fontWeight: numb('100 to 900'),
  italic: bool('Italic'),
  color: str('CSS colour, e.g. #ffffff'),
  align: str('Text alignment', { enum: ['left', 'center', 'right', 'start'] }),
  dir: str('Text direction; auto detects Arabic/Hebrew', { enum: ['auto', 'ltr', 'rtl'] }),
  lineHeight: numb('Line height multiplier'),
  letterSpacing: numb('Extra letter spacing in design units'),
  shadow: bool('Soft drop shadow'),
};
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

function summary(studio) {
  const p = studio.project;
  return {
    name: p.name,
    file: studio.filePath,
    unsaved: studio.dirty,
    languages: p.languages,
    currentSlide: studio.slideIndex + 1,
    customFonts: p.fonts,
    motion: p.motion,
    slides: p.slides.map((s, i) => ({
      slide: i + 1,
      id: s.id,
      background: s.background.type === 'image' ? { ...s.background, src: trim(s.background.src) } : s.background,
      elements: s.elements.map((e) => {
        const c = { ...e };
        for (const k of ['src', 'srcTablet']) if (c[k]) c[k] = trim(c[k]);
        return c;
      }),
    })),
  };
}
const trim = (s) => (String(s).startsWith('data:') ? `${String(s).slice(0, 30)}…(embedded)` : s);

export function buildTools(studio) {
  const add = async (slideRef, type, props) => {
    let created;
    await studio.mutate(() => {
      const slide = studio.resolveSlide(slideRef);
      created = M.makeElement(type, { ...props, lang: props.lang || studio.lang });
      slide.elements.push(created);
    });
    if ((type === 'screenshot' || type === 'image') && created.src && props.h === undefined) {
      await studio.mutate(() => studio.fitToImage(created), { history: false });
    }
    const fail = created.src && studio.failedImages.get(created.src);
    return { added: created, ...(fail ? { warning: `Image could not be loaded: ${fail}` } : {}) };
  };

  return [
    {
      name: 'get_project',
      description: 'Return the whole project: slides, backgrounds, every element with its id and properties, languages and fonts. Call this first.',
      inputSchema: obj({}),
      run: async () => summary(studio),
    },
    {
      name: 'list_options',
      description: 'List valid values: store export sizes, templates, colour themes, device frames and custom fonts.',
      inputSchema: obj({}),
      run: async () => ({
        designCanvas: M.BASE,
        sizes: M.STORE_SIZES.map(({ id, label, w, h, store }) => ({ id, label, w, h, store })),
        customSize: 'Any size can also be given as WIDTHxHEIGHT, e.g. 1242x2688',
        templates: M.TEMPLATES,
        themes: Object.fromEntries(Object.entries(M.THEMES).map(([k, v]) => [k, v.label])),
        frames: M.FRAME_LABELS,
        shapes: M.SHAPE_LABELS,
        stickers: M.STICKER_LABELS,
        motionTemplates: Object.fromEntries(Object.keys(M.MOTION_CATS).map((c) => [c, Object.fromEntries(M.MOTION_TABLE.filter((r) => r[2] === c).map((r) => [r[0], r[1]]))])),
        cameras: M.CAMERAS,
        musicTracks: M.MUSIC_TRACKS,
        googleFonts: M.GOOGLE_FONTS,
        iconCount: studio.iconList.length,
        transitions: M.TRANSITIONS,
        videoSizes: M.VIDEO_SIZES.map(({ id, label }) => ({ id, label })),
        videoExportAvailable: studio.hasFfmpeg,
        customFonts: studio.project.fonts,
        systemFontCount: studio.systemFonts.length,
      }),
    },
    {
      name: 'list_fonts',
      description: 'List font families that can be used in text. Optional case-insensitive filter.',
      inputSchema: obj({ query: str('Filter, e.g. "arab" or "sf"') }),
      run: async ({ query }) => {
        const q = String(query || '').toLowerCase();
        const all = studio.fontFamilies().filter((f) => f.toLowerCase().includes(q));
        return { count: all.length, fonts: all.slice(0, 400) };
      },
    },
    {
      name: 'load_font',
      description: 'Register a font file (.ttf, .otf, .woff, .woff2) from disk so it can be used as fontFamily.',
      inputSchema: obj({ path: str('Absolute path to the font file'), family: str('Optional family name override') }, ['path']),
      run: async ({ path, family }) => ({ family: await studio.addFontFile(path, family) }),
    },
    {
      name: 'set_font',
      description: 'Set the font family on one text element, on all text of a slide, or (with all=true) on all text in the project.',
      inputSchema: obj({ fontFamily: TEXT_PROPS.fontFamily, slide: SLIDE, id: str('Text element id'), all: bool('Apply to every slide') }, ['fontFamily']),
      run: async ({ fontFamily, slide, id, all }) => {
        let n = 0;
        await studio.mutate((p) => {
          const slides = all ? p.slides : [studio.resolveSlide(slide)];
          for (const s of slides) {
            const targets = id ? [studio.resolveElement(s, id)] : s.elements;
            for (const e of targets) if (e.type === 'text') { e.fontFamily = String(fontFamily); n += 1; }
          }
        });
        const known = studio.fontFamilies().includes(fontFamily);
        return { updated: n, ...(known ? {} : { warning: `"${fontFamily}" is not among the known fonts; the system fallback font is used if it is not installed.` }) };
      },
    },
    {
      name: 'list_projects',
      description: 'List the projects in the Severus Shot library (name, file path, slide count, last modified). Open one with open_project.',
      inputSchema: obj({}),
      run: async () => ({ folder: studio.projectsDir, current: studio.filePath, projects: (await studio.listProjects()).map(({ thumb, ...p }) => p) }),
    },
    {
      name: 'set_motion',
      description: 'Set how the slides animate in the video: motion template, transition between slides, camera move, seconds per slide, frame rate and music.',
      inputSchema: obj({ preset: str('Motion template id (50 available, see list_options motionTemplates). Choosing one also applies its designed transition, float and camera unless you pass them', { enum: Object.keys(M.MOTIONS) }), camera: str('Slow move of the whole frame', { enum: Object.keys(M.CAMERAS) }), transition: str('Between slides', { enum: Object.keys(M.TRANSITIONS) }), seconds: numb('Seconds each slide stays (1 to 15)'), fps: numb('24, 30 or 60'), float: bool('Keep elements drifting gently after they arrive'), music: str(`Background music: none, a built-in track (${Object.keys(M.MUSIC_TRACKS).join(', ')}) or an absolute path to an audio file`), musicVolume: numb('Music volume 0 to 1') }),
      run: async ({ music, musicVolume, ...a }) => {
        await studio.mutate((p) => {
          const cur = p.motion.music;
          let next = cur;
          if (music !== undefined) next = music === 'none' || music === '' ? { type: 'none' } : M.MUSIC_TRACKS[music] ? { type: 'builtin', id: music, volume: cur.volume } : { type: 'file', path: String(music), volume: cur.volume };
          if (musicVolume !== undefined) next = { ...next, volume: musicVolume };
          const base = a.preset ? M.applyMotionTemplate(p.motion, a.preset) : p.motion;
          p.motion = M.makeMotion({ ...base, ...a, music: next });
        });
        return { motion: studio.project.motion };
      },
    },
    {
      name: 'export_video',
      description: 'Render the slides as an animated H.264 MP4 (for an app preview or social post). Needs ffmpeg on the computer; list_options reports videoExportAvailable.',
      inputSchema: obj({ path: str('Absolute output path ending in .mp4'), size: str('video-1080 (default), video-886, video-ipad, video-square, or WIDTHxHEIGHT'), lang: str('Caption language') }, ['path']),
      run: async (a) => studio.exportVideo(a),
    },
    {
      name: 'new_project',
      description: 'Create a new project with one slide. It is saved in the project library and becomes the current project.',
      inputSchema: obj({ name: str('Project name'), template: str('Template id'), theme: str('Theme id'), languages: { type: 'array', items: { type: 'string' }, description: 'Language codes, first is the default' } }),
      run: async ({ name, template, theme, languages }) => {
        await studio.createProject(name, template, theme, languages);
        return summary(studio);
      },
    },
    {
      name: 'open_project',
      description: 'Open a project file from disk.',
      inputSchema: obj({ path: str('Absolute path to a .severus / .json project') }, ['path']),
      run: async ({ path }) => { await studio.open(path); return summary(studio); },
    },
    {
      name: 'save_project',
      description: 'Save the project. A path is required the first time.',
      inputSchema: obj({ path: str('Absolute path; omit to save to the current file') }),
      run: async ({ path }) => ({ saved: await studio.save(path) }),
    },
    {
      name: 'add_slide',
      description: 'Add a slide built from a template and theme.',
      inputSchema: obj({ template: str('Template id (see list_options)'), theme: str('Theme id'), index: numb('Position to insert at (1-based). Default: end') }),
      run: async ({ template, theme, index }) => {
        if (template && !M.TEMPLATES[template]) throw new Error(`Unknown template "${template}". Options: ${Object.keys(M.TEMPLATES).join(', ')}`);
        if (theme && !M.THEMES[theme]) throw new Error(`Unknown theme "${theme}". Options: ${Object.keys(M.THEMES).join(', ')}`);
        await studio.mutate((p) => {
          const at = index ? Math.min(Math.max(1, index), p.slides.length + 1) - 1 : p.slides.length;
          p.slides.splice(at, 0, M.makeSlide(template, theme));
          studio.slideIndex = at;
        });
        return { slide: studio.slideIndex + 1, id: studio.slide.id, elements: studio.slide.elements };
      },
    },
    {
      name: 'duplicate_slide',
      description: 'Duplicate a slide; the copy is placed right after it.',
      inputSchema: obj({ slide: SLIDE }),
      run: async ({ slide }) => {
        await studio.mutate((p) => {
          const src = studio.resolveSlide(slide);
          const copy = M.clone(src);
          copy.id = M.uid('s');
          copy.elements.forEach((e) => { e.id = M.uid(); });
          const at = p.slides.indexOf(src) + 1;
          p.slides.splice(at, 0, copy);
          studio.slideIndex = at;
        });
        return { slide: studio.slideIndex + 1, id: studio.slide.id };
      },
    },
    {
      name: 'delete_slide',
      description: 'Delete a slide. The last remaining slide cannot be deleted.',
      inputSchema: obj({ slide: SLIDE }),
      run: async ({ slide }) => {
        await studio.mutate((p) => {
          if (p.slides.length <= 1) throw new Error('Cannot delete the only slide');
          p.slides.splice(p.slides.indexOf(studio.resolveSlide(slide)), 1);
        });
        return { slides: studio.project.slides.length };
      },
    },
    {
      name: 'select_slide',
      description: 'Make a slide the current one (also shows it in the app window).',
      inputSchema: obj({ slide: SLIDE }, ['slide']),
      run: async ({ slide }) => {
        studio.slideIndex = studio.project.slides.indexOf(studio.resolveSlide(slide));
        studio.selectedId = null;
        studio.emit();
        return { currentSlide: studio.slideIndex + 1 };
      },
    },
    {
      name: 'set_background',
      description: 'Set a slide background: a solid colour, a linear gradient, or an image file. Use all=true for every slide.',
      inputSchema: obj({
        slide: SLIDE,
        all: bool('Apply to every slide'),
        type: str('Background type', { enum: ['solid', 'gradient', 'image'] }),
        color: str('Solid colour (CSS), e.g. #0b1020'),
        colors: { type: 'array', items: { type: 'string' }, description: 'Gradient colours in order (2 to 6)' },
        angle: numb('Gradient angle in degrees; 180 runs top to bottom'),
        path: str('Image file path for type=image'),
        dim: numb('Image darkening 0 to 1'),
        blur: numb('Image blur in design units, 0 to 200'),
      }, ['type']),
      run: async (a) => {
        await studio.mutate((p) => {
          const bg = M.makeBackground({ ...a, src: a.path });
          for (const s of a.all ? p.slides : [studio.resolveSlide(a.slide)]) s.background = M.clone(bg);
        });
        const fail = a.type === 'image' && studio.failedImages.get(a.path);
        return { background: studio.resolveSlide(a.all ? undefined : a.slide).background, ...(fail ? { warning: `Image could not be loaded: ${fail}` } : {}) };
      },
    },
    {
      name: 'apply_template',
      description: 'Rebuild a slide layout from a template, keeping its existing captions and screenshots. Optionally switch theme.',
      inputSchema: obj({ slide: SLIDE, template: str('Template id'), theme: str('Theme id') }, ['template']),
      run: async ({ slide, template, theme }) => {
        if (!M.TEMPLATES[template]) throw new Error(`Unknown template "${template}". Options: ${Object.keys(M.TEMPLATES).join(', ')}`);
        if (theme && !M.THEMES[theme]) throw new Error(`Unknown theme "${theme}". Options: ${Object.keys(M.THEMES).join(', ')}`);
        const s = studio.resolveSlide(slide);
        await studio.mutate(() => M.applyTemplate(s, template, theme));
        return { elements: s.elements };
      },
    },
    {
      name: 'apply_theme',
      description: 'Recolour a slide (background, text, frames) with a theme. Use all=true for every slide.',
      inputSchema: obj({ slide: SLIDE, theme: str('Theme id'), all: bool('Apply to every slide') }, ['theme']),
      run: async ({ slide, theme, all }) => {
        await studio.mutate((p) => { for (const s of all ? p.slides : [studio.resolveSlide(slide)]) M.applyTheme(s, theme); });
        return { ok: true };
      },
    },
    {
      name: 'add_text',
      description: 'Add a text caption. Arabic and other right-to-left text is shaped and aligned automatically.',
      inputSchema: obj({ slide: SLIDE, text: str('The caption; use \\n for line breaks'), lang: str('Language code this text is for (default: current language)'), ...POS, ...TEXT_PROPS }, ['text']),
      run: async ({ slide, ...props }) => add(slide, 'text', props),
    },
    {
      name: 'add_screenshot',
      description: 'Add an app screenshot inside a device frame. Height is fitted to the image unless h is given.',
      inputSchema: obj({
        slide: SLIDE,
        path: str('Absolute path to the screenshot image (png/jpg/webp)'),
        tabletPath: str('Optional separate screenshot used on tablet-sized exports'),
        frame: str('Device frame; auto = phone on phone sizes, tablet on tablet sizes', { enum: M.FRAMES }),
        frameColor: str('Frame colour (CSS)'),
        shadow: bool('Drop shadow'),
        glare: bool('Diagonal light reflection on the screen'),
        ...POS,
      }, ['path']),
      run: async ({ slide, tabletPath, ...props }) => add(slide, 'screenshot', { ...props, src: props.path, srcTablet: tabletPath }),
    },
    {
      name: 'add_image',
      description: 'Add a plain image (logo, badge, sticker).',
      inputSchema: obj({ slide: SLIDE, path: str('Absolute image path'), radius: numb('Corner radius'), ...POS }, ['path']),
      run: async ({ slide, ...props }) => add(slide, 'image', { ...props, src: props.path }),
    },
    {
      name: 'add_sticker',
      description: 'Add a ready-made component: star rating, award laurel, feature pill, speech bubble, burst badge, notification card, check-mark line, curved arrow, underline stroke or emoji. Text uses \\n for a second line where the kind has one (laurel, notification, bubble).',
      inputSchema: obj({ slide: SLIDE, kind: str('Sticker kind', { enum: M.STICKERS }), text: str('Text shown in the sticker (an emoji for kind=emoji)'), fill: str('Main colour'), color: str('Text colour'), fontFamily: TEXT_PROPS.fontFamily, ...POS }, ['kind']),
      run: async ({ slide, ...props }) => add(slide, 'sticker', props),
    },
    {
      name: 'add_icon',
      description: 'Add a line icon from the built-in library (about 2,000 icons). Find names with search_icons. Optionally put it on a circle or rounded-square backdrop.',
      inputSchema: obj({ slide: SLIDE, icon: str('Icon name, e.g. shopping-cart, shield-check, bell'), color: str('Line colour'), stroke: numb('Line weight 0.5 to 4 (default 2)'), bg: str('Backdrop', { enum: ['none', 'circle', 'square'] }), bgColor: str('Backdrop colour'), ...POS }, ['icon']),
      run: async ({ slide, ...props }) => {
        await studio.loadIcons().catch(() => null);
        const r = await add(slide, 'icon', props);
        return studio.icons.size && !studio.icons.has(r.added.icon) ? { ...r, warning: `No icon is named "${r.added.icon}". Use search_icons to find a valid name.` } : r;
      },
    },
    {
      name: 'search_icons',
      description: 'Search the icon library by name or keyword and return matching icon names.',
      inputSchema: obj({ query: str('Keywords, e.g. "cart", "lock", "chart up"'), limit: numb('Maximum results (default 40)') }, ['query']),
      run: async ({ query, limit }) => { await studio.loadIcons(); const icons = studio.searchIcons(query, Math.min(200, Math.max(1, limit || 40))); return { count: icons.length, icons }; },
    },
    {
      name: 'add_google_font',
      description: 'Download a font family from Google Fonts (needs internet once) so it can be used as fontFamily. Arabic families such as Cairo, Tajawal and Almarai are supported.',
      inputSchema: obj({ family: str('Exact Google Fonts family name, e.g. Cairo or Poppins') }, ['family']),
      run: async ({ family }) => studio.addGoogleFont(family),
    },
    {
      name: 'add_shape',
      description: 'Add a decorative shape: big soft shapes behind the device, rings, blobs, glows, sparkles, dot grids, squiggles. Put background shapes behind other elements with reorder_element to=back.',
      inputSchema: obj({ slide: SLIDE, shape: str('Shape', { enum: M.SHAPES }), fill: str('Fill colour (CSS)'), fill2: str('Optional second colour: makes a top-to-bottom gradient'), radius: numb('Corner radius for rect'), stroke: numb('Line thickness for ring, arc and squiggle; dot size for dots'), seed: numb('Blob outline variation (any whole number)'), ...POS }),
      run: async ({ slide, ...props }) => add(slide, 'shape', props),
    },
    {
      name: 'update_element',
      description: 'Change any properties of an element (position, size, rotation, text, font, colour, frame, image path…). Only the given fields change.',
      inputSchema: {
        type: 'object',
        properties: {
          slide: SLIDE, id: str('Element id or name'),
          text: str('New caption (text elements)'), lang: str('Language of the new caption'),
          ...POS, ...TEXT_PROPS,
          path: str('New image path (screenshot/image)'), srcTablet: str('Tablet screenshot path'),
          frame: str('Device frame', { enum: M.FRAMES }), frameColor: str('Frame colour'),
          shape: str('Shape type', { enum: M.SHAPES }), fill: str('Shape fill'), fill2: str('Second gradient colour; empty string removes it'), radius: numb('Corner radius'),
          kind: str('Sticker kind', { enum: M.STICKERS }), icon: str('Icon name (icon elements)'), bg: str('Icon backdrop', { enum: ['none', 'circle', 'square'] }), bgColor: str('Icon backdrop colour'),
          stroke: numb('Line thickness / dot size'), seed: numb('Blob variation'), glare: bool('Screen reflection (screenshots)'), shadow: bool('Drop shadow'),
        },
        required: ['id'],
      },
      run: async ({ slide, id, ...patch }) => {
        const s = studio.resolveSlide(slide);
        const el = studio.resolveElement(s, id);
        await studio.mutate(() => M.updateElement(el, patch, patch.lang || studio.lang));
        const fail = el.src && studio.failedImages.get(el.src);
        return { element: el, ...(fail ? { warning: `Image could not be loaded: ${fail}` } : {}) };
      },
    },
    {
      name: 'set_text',
      description: 'Set the caption of a text element for one language (used for translations).',
      inputSchema: obj({ slide: SLIDE, id: str('Text element id or name'), lang: str('Language code'), text: str('Caption in that language') }, ['id', 'lang', 'text']),
      run: async ({ slide, id, lang, text }) => {
        const el = studio.resolveElement(studio.resolveSlide(slide), id);
        if (el.type !== 'text') throw new Error('That element is not text');
        await studio.mutate((p) => {
          if (!p.languages.includes(lang)) p.languages.push(lang);
          el.text[lang] = String(text);
        });
        return { text: el.text };
      },
    },
    {
      name: 'set_languages',
      description: 'Set the project languages (e.g. ["en","ar"]). Each text element keeps one caption per language; exports produce one set per language.',
      inputSchema: obj({ languages: { type: 'array', items: { type: 'string' }, minItems: 1 }, current: str('Language to show in the app') }, ['languages']),
      run: async ({ languages, current }) => {
        await studio.mutate((p) => { p.languages = [...new Set(languages.map(String))]; });
        if (current && studio.project.languages.includes(current)) { studio.lang = current; studio.emit(); }
        return { languages: studio.project.languages, current: studio.lang };
      },
    },
    {
      name: 'delete_element',
      description: 'Remove an element from a slide.',
      inputSchema: obj({ slide: SLIDE, id: str('Element id or name') }, ['id']),
      run: async ({ slide, id }) => {
        const s = studio.resolveSlide(slide);
        const el = studio.resolveElement(s, id);
        await studio.mutate(() => { s.elements.splice(s.elements.indexOf(el), 1); });
        return { remaining: s.elements.length };
      },
    },
    {
      name: 'reorder_element',
      description: 'Change stacking order of an element.',
      inputSchema: obj({ slide: SLIDE, id: str('Element id or name'), to: str('Where to move it', { enum: ['front', 'back', 'forward', 'backward'] }) }, ['id', 'to']),
      run: async ({ slide, id, to }) => {
        const s = studio.resolveSlide(slide);
        const el = studio.resolveElement(s, id);
        await studio.mutate(() => {
          const i = s.elements.indexOf(el);
          s.elements.splice(i, 1);
          const j = to === 'front' ? s.elements.length : to === 'back' ? 0 : to === 'forward' ? Math.min(s.elements.length, i + 1) : Math.max(0, i - 1);
          s.elements.splice(j, 0, el);
        });
        return { order: s.elements.map((e) => e.id) };
      },
    },
    {
      name: 'render_preview',
      description: 'Render a slide and return it as an image so you can see the result. Use after edits to check layout.',
      inputSchema: obj({ slide: SLIDE, size: str('Size id or WIDTHxHEIGHT (default: iphone-6.9)'), lang: str('Language code'), maxWidth: numb('Preview width in pixels (default 480, max 1600)') }),
      run: async ({ slide, size, lang, maxWidth }) => {
        const r = await studio.preview({ slide, size, lang, maxWidth: Math.min(1600, Math.max(120, maxWidth || 480)) });
        return { __image: r };
      },
    },
    {
      name: 'export',
      description: 'Export slides as flat RGB PNG (or JPG) files for the app stores: outDir/[language/]size/01.png … Returns the file list. layout "fastlane" writes the folders that `fastlane deliver` and `fastlane supply` upload from, and returns the commands to run.',
      inputSchema: obj({
        outDir: str('Absolute output folder (created if missing)'),
        sizes: { type: 'array', items: { type: 'string' }, description: 'Size ids or WIDTHxHEIGHT. Default: all store sizes' },
        languages: { type: 'array', items: { type: 'string' }, description: 'Default: all project languages' },
        slides: { type: 'array', items: { type: ['number', 'string'] }, description: 'Slide numbers/ids. Default: all' },
        format: str('File format', { enum: ['png', 'jpg'] }),
        zip: bool('Also write outDir.zip'),
        layout: str('Folder layout', { enum: M.EXPORT_LAYOUTS }),
      }, ['outDir']),
      run: async (a) => studio.exportAll(a),
    },
    {
      name: 'list_devices',
      description: 'List running iOS simulators and connected Android emulators or phones that capture_device can take a screenshot from.',
      inputSchema: obj({}),
      run: async () => bridge.captureDevices(),
    },
    {
      name: 'capture_device',
      description: 'Take a screenshot from a running iOS simulator or Android device and put it on a slide as a framed screenshot. With no id, the only available device is used.',
      inputSchema: obj({ id: str('Device id from list_devices'), slide: SLIDE }),
      run: async (a) => {
        if (a.slide !== undefined) { studio.slideIndex = studio.project.slides.indexOf(studio.resolveSlide(a.slide)); studio.selectedId = null; }
        const { devices } = await bridge.captureDevices();
        const device = a.id ? devices.find((d) => d.id === a.id) : devices.length === 1 ? devices[0] : null;
        if (!device) throw new Error(devices.length ? `Pass an id. Devices: ${devices.map((d) => `${d.id} (${d.name})`).join(', ')}` : 'No running simulator or connected Android device was found');
        const path = await captureInto(studio, device);
        return { device, path, slide: studio.slideIndex + 1 };
      },
    },
    {
      name: 'install_ffmpeg',
      description: 'Download ffmpeg into the app folder so export_video works. Only needed when list_options reports videoExportAvailable false.',
      inputSchema: obj({}),
      run: async () => { const r = await bridge.ffmpegInstall(); studio.hasFfmpeg = true; return r; },
    },
    {
      name: 'translate_captions',
      description: 'Translate every caption from one project language to another with the local AI model configured in the app (free, offline; default Ollama gemma3:1b). Adds the target language to the project. An agent that can translate well itself should prefer set_text.',
      inputSchema: obj({ from: str('Source language code. Default: the first project language'), to: str('Target language code, e.g. ar'), overwrite: bool('Also replace captions that already have a translation') }, ['to']),
      run: async (a) => translateProject(studio, new LocalAI(bridge.aiRequest, aiSettings()), a),
    },
  ];
}

export function createRpcHandler(studio, info = {}) {
  const tools = buildTools(studio);
  const byName = new Map(tools.map((t) => [t.name, t]));
  // Tool calls run one at a time so two agents cannot interleave edits.
  let queue = Promise.resolve();

  async function call(params) {
    const tool = byName.get(params && params.name);
    if (!tool) return { content: [{ type: 'text', text: `Unknown tool: ${params && params.name}` }], isError: true };
    try {
      const out = await tool.run(params.arguments || {});
      if (out && out.__image) {
        return { content: [{ type: 'image', data: out.__image.b64, mimeType: out.__image.mime }, { type: 'text', text: `${out.__image.width}×${out.__image.height} preview` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err && err.message ? err.message : err}` }], isError: true };
    }
  }

  return async function handle(msg) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return { jsonrpc: '2.0', id: msg && msg.id !== undefined ? msg.id : null, error: { code: -32600, message: 'Invalid request' } };
    }
    const isNotification = msg.id === undefined || msg.id === null;
    const ok = (result) => (isNotification ? null : { jsonrpc: '2.0', id: msg.id, result });
    switch (msg.method) {
      case 'initialize':
        return ok({
          protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'severus-shot', version: info.version || '0.1.0' },
          instructions: 'Severus Shot makes App Store / Google Play screenshots. Call get_project first, edit with the add_/update_ tools, check your work with render_preview, then export.',
        });
      case 'ping':
        return ok({});
      case 'tools/list':
        return ok({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case 'tools/call': {
        const run = queue.then(() => call(msg.params));
        queue = run.catch(() => null);
        return ok(await run);
      }
      default:
        if (isNotification) return null;
        return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
    }
  };
}
