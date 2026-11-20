import { SCENES3D, SCENE_SIZE } from './scenes.js';
// Project model: pure data + mutations. No DOM access, so it also runs in Node tests.

export const BASE = { w: 1320, h: 2868 };

export const STORE_SIZES = [
  { id: 'iphone-6.9', label: 'iPhone 6.9"', w: 1320, h: 2868, store: 'ios', device: 'phone' },
  { id: 'iphone-6.7', label: 'iPhone 6.7"', w: 1290, h: 2796, store: 'ios', device: 'phone' },
  { id: 'iphone-6.5', label: 'iPhone 6.5"', w: 1284, h: 2778, store: 'ios', device: 'phone' },
  { id: 'iphone-5.5', label: 'iPhone 5.5"', w: 1242, h: 2208, store: 'ios', device: 'phone' },
  { id: 'ipad-13', label: 'iPad 13"', w: 2064, h: 2752, store: 'ios', device: 'tablet' },
  { id: 'ipad-12.9', label: 'iPad 12.9"', w: 2048, h: 2732, store: 'ios', device: 'tablet' },
  { id: 'android-phone', label: 'Android phone', w: 1080, h: 1920, store: 'android', device: 'phone' },
  { id: 'android-tablet-7', label: 'Android 7" tablet', w: 1200, h: 1920, store: 'android', device: 'tablet' },
  { id: 'android-tablet-10', label: 'Android 10" tablet', w: 1600, h: 2560, store: 'android', device: 'tablet' },
];

export const FRAMES = ['auto', 'phone', 'phone-notch', 'android', 'tablet', 'clay', 'outline', 'glass', 'none'];
export const FRAME_LABELS = {
  auto: 'Auto (phone / tablet)', phone: 'Phone, island', 'phone-notch': 'Phone, notch', android: 'Android, punch-hole', tablet: 'Tablet',
  clay: 'Clay (soft, flat)', outline: 'Outline', glass: 'Glass', none: 'Frameless',
};
export const SHAPES = ['rect', 'ellipse', 'pill', 'ring', 'rings', 'arc', 'half', 'blob', 'glow', 'star', 'sparkle', 'triangle', 'diamond', 'hexagon', 'heart', 'plus', 'dots', 'stripes', 'wave', 'squiggle'];
export const SHAPE_LABELS = {
  rect: 'Rectangle', ellipse: 'Ellipse', pill: 'Pill', ring: 'Ring', arc: 'Arc', blob: 'Blob', glow: 'Soft glow', star: 'Star',
  sparkle: 'Sparkle', triangle: 'Triangle', dots: 'Dot grid', squiggle: 'Squiggle',
  rings: 'Concentric rings', half: 'Half circle', diamond: 'Diamond', hexagon: 'Hexagon', heart: 'Heart', plus: 'Plus', stripes: 'Stripes', wave: 'Wave',
};

export const STICKERS = ['rating', 'laurel', 'pill', 'cta', 'bubble', 'tooltip', 'burst', 'ribbon', 'tag', 'notification', 'stat', 'chart', 'progress', 'avatars', 'toggle', 'quote', 'check', 'highlight', 'arrow', 'underline', 'confetti', 'emoji'];
export const STICKER_LABELS = {
  rating: 'Star rating', laurel: 'Award laurel', pill: 'Feature pill', bubble: 'Speech bubble', burst: 'Burst badge',
  notification: 'Notification card', check: 'Check mark', arrow: 'Curved arrow', underline: 'Underline stroke', emoji: 'Emoji',
  cta: 'Button', tooltip: 'Callout', ribbon: 'Ribbon', tag: 'Price tag', stat: 'Stat card', chart: 'Chart card', progress: 'Progress ring',
  avatars: 'User avatars', toggle: 'Toggle switch', quote: 'Quote marks', highlight: 'Highlighter', confetti: 'Confetti',
};
// Default size and text for each sticker kind.
export const STICKER_DEFAULTS = {
  rating: { w: 520, h: 110, text: '4.9' },
  laurel: { w: 560, h: 420, text: '#1\nTop rated' },
  pill: { w: 460, h: 110, text: 'New feature' },
  bubble: { w: 620, h: 300, text: 'Love this app!' },
  burst: { w: 300, h: 300, text: 'NEW' },
  notification: { w: 820, h: 210, text: 'Order delivered\nYour package arrived at 2:45 PM' },
  check: { w: 560, h: 100, text: 'Works offline' },
  arrow: { w: 300, h: 260, text: '' },
  underline: { w: 520, h: 60, text: '' },
  emoji: { w: 220, h: 220, text: '🔥' },
  cta: { w: 520, h: 130, text: 'Get started' },
  tooltip: { w: 520, h: 190, text: 'Tap to track' },
  ribbon: { w: 560, h: 120, text: 'Best seller' },
  tag: { w: 360, h: 150, text: '$4.99' },
  stat: { w: 420, h: 300, text: '10M+\nDownloads' },
  chart: { w: 520, h: 360, text: 'Sales\n+24%' },
  progress: { w: 300, h: 300, text: '86%' },
  avatars: { w: 620, h: 130, text: '50k+ happy users' },
  toggle: { w: 240, h: 130, text: '' },
  quote: { w: 220, h: 170, text: '' },
  highlight: { w: 620, h: 120, text: '' },
  confetti: { w: 700, h: 500, text: '' },
};
// Motion templates. Each row: id, label, category, entrance for every element, per-type overrides,
// and the defaults it sets (transition t, idle float, camera move). Entrance values are where an
// element starts from: dx/dy offset, scale, sx (horizontal squash), rot degrees; ease names the curve.
export const MOTION_TABLE = [
  ['none', 'No animation', 'essentials', null, null, { t: 'cut' }],
  ['fade', 'Fade in', 'essentials', {}, null, {}],
  ['rise', 'Rise and fade in', 'essentials', { dy: 140 }, null, {}],
  ['fall', 'Settle from above', 'essentials', { dy: -140 }, null, {}],
  ['pop', 'Pop in', 'essentials', { scale: 0.82 }, null, {}],
  ['soft-zoom', 'Soft zoom', 'essentials', { scale: 1.12, dur: 0.9 }, null, {}],
  ['slide', 'Slide in from the side', 'slide', { dx: 340 }, null, { t: 'push' }],
  ['slide-back', 'Slide in from the other side', 'slide', { dx: -340 }, null, { t: 'push' }],
  ['slide-up', 'Long slide up', 'slide', { dy: 420, ease: 'expo', dur: 0.9 }, null, { t: 'up' }],
  ['slide-down', 'Long slide down', 'slide', { dy: -420, ease: 'expo', dur: 0.9 }, null, {}],
  ['alternate', 'Text and device from opposite sides', 'slide', { dx: -300 }, { screenshot: { dx: 320 } }, {}],
  ['curtain', 'Text from top, device from bottom', 'slide', { dy: -260 }, { screenshot: { dy: 700 } }, {}],
  ['wave', 'Top-to-bottom wave', 'slide', { dy: 200, stag: 0.2, order: 'top' }, null, {}],
  ['cascade', 'Bottom-up cascade', 'slide', { dy: 240, stag: 0.16, order: 'bottom' }, null, { t: 'up' }],
  ['zoom', 'Zoom out into place', 'zoom', { scale: 1.35 }, null, { t: 'zoom' }],
  ['zoom-in', 'Zoom in with overshoot', 'zoom', { scale: 0.5, ease: 'back' }, null, { t: 'zoom' }],
  ['burst', 'Burst from the centre', 'zoom', { scale: 0.2, ease: 'back', stag: 0.08, order: 'center' }, null, {}],
  ['implode', 'Fall into place', 'zoom', { scale: 1.8, order: 'center' }, null, {}],
  ['grow-device', 'Device grows in', 'zoom', {}, { screenshot: { scale: 0.6, ease: 'back', dur: 0.9 } }, {}],
  ['title-punch', 'Title punches in', 'zoom', { dy: 80 }, { text: { scale: 1.45, dur: 0.6 } }, {}],
  ['drop', 'Drop and bounce', 'bounce', { dy: -520, ease: 'bounce', dur: 0.95 }, null, {}],
  ['bounce-up', 'Bounce up', 'bounce', { dy: 420, ease: 'bounce', dur: 0.95 }, null, {}],
  ['elastic-pop', 'Elastic pop', 'bounce', { scale: 0.4, ease: 'elastic', dur: 1.1 }, null, {}],
  ['elastic-slide', 'Elastic slide', 'bounce', { dx: 380, ease: 'elastic', dur: 1.1 }, null, {}],
  ['spring', 'Spring rise', 'bounce', { dy: 200, ease: 'back', dur: 0.8 }, null, {}],
  ['jelly', 'Jelly', 'bounce', { sx: 0.5, scale: 0.9, ease: 'elastic', dur: 1.1 }, null, {}],
  ['swing', 'Swing in', 'spin', { rot: 14, dy: 60, alt: true }, null, {}],
  ['spin', 'Spin in', 'spin', { rot: -120, scale: 0.5, ease: 'back', dur: 0.9 }, null, {}],
  ['twist', 'Twist', 'spin', { rot: 25, scale: 0.85 }, null, {}],
  ['flip', 'Flip in', 'spin', { sx: 0, ease: 'back', dur: 0.8 }, null, {}],
  ['pendulum', 'Pendulum', 'spin', { rot: -30, ease: 'elastic', dur: 1.2 }, null, {}],
  ['roll', 'Roll in', 'spin', { dx: -360, rot: -90, dur: 0.9 }, null, {}],
  ['device', 'Device slides up', 'device', {}, { screenshot: { dy: 900, fade: 3 } }, {}],
  ['device-drop', 'Device drops in', 'device', {}, { screenshot: { dy: -900, ease: 'bounce', dur: 1, fade: 4 } }, {}],
  ['device-tilt', 'Device tilts up', 'device', { dy: 60 }, { screenshot: { rot: 18, dy: 520, dur: 0.9 } }, {}],
  ['device-zoom', 'Device zooms out', 'device', {}, { screenshot: { scale: 1.6, dur: 0.9 } }, {}],
  ['device-side', 'Device from the side', 'device', { dx: -120 }, { screenshot: { dx: 720, dur: 0.9 } }, { t: 'push' }],
  ['device-spin', 'Device spins in', 'device', {}, { screenshot: { rot: -40, scale: 0.6, ease: 'back', dur: 1 } }, {}],
  ['cine-zoom', 'Cinematic push-in', 'cinematic', { dur: 1 }, null, { cam: 'zoom-in' }],
  ['cine-pull', 'Cinematic pull-back', 'cinematic', { dur: 1 }, null, { cam: 'zoom-out' }],
  ['pan-side', 'Sideways pan', 'cinematic', { dy: 100 }, null, { cam: 'pan-left', t: 'push' }],
  ['pan-up', 'Upward pan', 'cinematic', {}, null, { cam: 'pan-up', t: 'up' }],
  ['reveal', 'Slow reveal', 'cinematic', { dy: 60, dur: 1.4, stag: 0.3 }, null, { cam: 'zoom-in' }],
  ['documentary', 'Documentary', 'cinematic', { dur: 1.2 }, null, { cam: 'pan-left' }],
  ['party', 'Party pop', 'playful', { scale: 0.2, ease: 'elastic', dur: 1.1, stag: 0.09, order: 'center' }, null, { float: true }],
  ['wobble', 'Wobble', 'playful', { rot: 10, ease: 'elastic', dur: 1.2, alt: true }, null, { float: true }],
  ['hop', 'Hop', 'playful', { dy: 160, ease: 'bounce', stag: 0.18 }, null, { float: true }],
  ['floaty', 'Floaty', 'playful', { dy: 40, dur: 1 }, null, { float: true }],
  ['tumble', 'Tumble', 'playful', { dy: -400, rot: 60, ease: 'bounce', dur: 1 }, null, {}],
  ['zigzag', 'Zigzag', 'playful', { dx: 320, alt: true, order: 'top' }, null, {}],
];
export const MOTIONS = Object.fromEntries(MOTION_TABLE.map((r) => [r[0], r[1]]));
export const MOTION_CATS = { essentials: 'Essentials', slide: 'Slides', zoom: 'Zoom', bounce: 'Bounce', spin: 'Spin', device: 'Device', cinematic: 'Cinematic', playful: 'Playful' };
export const CAMERAS = { none: 'Still camera', 'zoom-in': 'Slow push-in', 'zoom-out': 'Slow pull-back', 'pan-left': 'Sideways drift', 'pan-up': 'Upward drift' };
// Choosing a template also applies the transition, float and camera it was designed with.
export function applyMotionTemplate(motion, id) {
  const row = MOTION_TABLE.find((r) => r[0] === id);
  if (!row) throw new Error(`Unknown motion template "${id}". Options: ${Object.keys(MOTIONS).join(', ')}`);
  const d = row[5] || {};
  return makeMotion({ ...motion, preset: id, transition: d.t || 'fade', float: !!d.float, camera: d.cam || 'none' });
}
export const TRANSITIONS = { fade: 'Cross-fade', push: 'Push', up: 'Slide up', zoom: 'Zoom through', wipe: 'Wipe', cut: 'Cut' };
export const VIDEO_SIZES = [
  { id: 'video-1080', label: 'Portrait 1080×1920', w: 1080, h: 1920, device: 'phone' },
  { id: 'video-886', label: 'App Store preview 886×1920', w: 886, h: 1920, device: 'phone' },
  { id: 'video-ipad', label: 'iPad preview 1200×1600', w: 1200, h: 1600, device: 'tablet' },
  { id: 'video-square', label: 'Square 1080×1080', w: 1080, h: 1080, device: 'phone' },
];
export const MUSIC_TRACKS = { calm: 'Calm pad', upbeat: 'Upbeat pulse', lofi: 'Lo-fi keys', bright: 'Bright pluck' };
// Background music for the video: none, one of the built-in tracks, or the user's own audio file.
export function makeMusic(m = {}) {
  const src = m || {};
  const type = src.type === 'file' && src.path ? 'file' : src.type === 'builtin' && MUSIC_TRACKS[src.id] ? 'builtin' : 'none';
  const vol = Number.isFinite(+src.volume) && src.volume !== null && src.volume !== '' ? Math.min(1, Math.max(0, +src.volume)) : 0.8;
  return { type, id: type === 'builtin' ? src.id : '', path: type === 'file' ? String(src.path) : '', volume: vol };
}
export function makeMotion(m = {}) {
  const n = (v, d, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) && v !== null && v !== '' ? +v : d));
  return {
    preset: MOTIONS[m.preset] ? m.preset : 'rise',
    transition: TRANSITIONS[m.transition] ? m.transition : 'fade',
    seconds: n(m.seconds, 3, 1, 15),
    fps: [24, 30, 60].includes(+m.fps) ? +m.fps : 30,
    float: !!m.float, // elements keep drifting gently after they arrive
    camera: CAMERAS[m.camera] ? m.camera : 'none', // slow move of the whole frame during each slide
    music: makeMusic(m.music),
  };
}

export const THEMES = {
  midnight: { label: 'Midnight', bg: { type: 'gradient', angle: 160, stops: [{ pos: 0, color: '#1b1f3b' }, { pos: 1, color: '#0a0b14' }] }, title: '#ffffff', sub: '#b9c0e0', accent: '#6c7bff', frame: '#111318' },
  sunrise: { label: 'Sunrise', bg: { type: 'gradient', angle: 150, stops: [{ pos: 0, color: '#ff9a5a' }, { pos: 1, color: '#ff4d7d' }] }, title: '#ffffff', sub: '#ffe9e0', accent: '#ffd166', frame: '#1a1a1a' },
  ocean: { label: 'Ocean', bg: { type: 'gradient', angle: 180, stops: [{ pos: 0, color: '#36c5f0' }, { pos: 1, color: '#1456d8' }] }, title: '#ffffff', sub: '#d9efff', accent: '#9ef0ff', frame: '#0c1220' },
  mint: { label: 'Mint', bg: { type: 'gradient', angle: 170, stops: [{ pos: 0, color: '#d9fbe8' }, { pos: 1, color: '#8fe3c0' }] }, title: '#0c3b2e', sub: '#2b6b57', accent: '#11a37f', frame: '#16201c' },
  paper: { label: 'Paper', bg: { type: 'solid', color: '#f5f1e8' }, title: '#1d1b16', sub: '#5d574a', accent: '#d9482b', frame: '#22201c' },
  peach: { label: 'Peach (soft)', bg: { type: 'gradient', angle: 165, stops: [{ pos: 0, color: '#fff1e6' }, { pos: 1, color: '#ffd3c4' }] }, title: '#3a1f1a', sub: '#7a5148', accent: '#ff8a65', frame: '#2a1d1a' },
  sky: { label: 'Sky (soft)', bg: { type: 'gradient', angle: 175, stops: [{ pos: 0, color: '#eef5ff' }, { pos: 1, color: '#c9dcff' }] }, title: '#12203f', sub: '#47597f', accent: '#5b8cff', frame: '#151b2b' },
  sage: { label: 'Sage (soft)', bg: { type: 'gradient', angle: 170, stops: [{ pos: 0, color: '#f1f5ec' }, { pos: 1, color: '#cfdcc4' }] }, title: '#1f2a1c', sub: '#55654f', accent: '#7fa36b', frame: '#1c211a' },
  grape: { label: 'Grape', bg: { type: 'gradient', angle: 140, stops: [{ pos: 0, color: '#7b2ff7' }, { pos: 1, color: '#f107a3' }] }, title: '#ffffff', sub: '#f3dcff', accent: '#ffe66d', frame: '#150a24' },
};

export const TEMPLATES = {
  'caption-top': 'Caption on top, device below',
  'caption-bottom': 'Device on top, caption below',
  tilted: 'Tilted device',
  duo: 'Two devices',
  spotlight: 'Spotlight: glow and ring behind the device',
  playful: 'Playful: blobs, sparkles and a clay device',
  frameless: 'Frameless screenshot card',
  'left-caption': 'Left-aligned caption',
  zoom: 'Zoomed-in device',
  rating: 'Rating stars and device',
  award: 'Award laurel and device',
  pills: 'Feature pills and device',
  notify: 'Floating notifications',
  'pano-left': 'Panorama, left half',
  'pano-right': 'Panorama, right half',
  card: 'Device on a colour card',
  trio: 'Three devices fan',
  review: 'Customer review',
  checklist: 'Feature checklist',
  'hero-text': 'Big text, no device',
};

// Shipped with the app, so captions look the same on every computer.
export const BUNDLED_FONTS = ['Inter', 'IBM Plex Sans Arabic'];
export const DEFAULT_FONT = 'Inter';
// A starting list for the font browser. Any other Google Fonts family can be typed in by name.
export const GOOGLE_FONTS = {
  arabic: ['Cairo', 'Tajawal', 'Almarai', 'Readex Pro', 'Noto Kufi Arabic', 'Noto Sans Arabic', 'Noto Naskh Arabic', 'Alexandria', 'Changa', 'El Messiri', 'Rubik', 'Vazirmatn', 'Baloo Bhaijaan 2', 'Reem Kufi', 'Amiri', 'Lalezar', 'Markazi Text', 'Mada', 'Kufam', 'Lemonada', 'Aref Ruqaa', 'Harmattan', 'Marhey', 'Rakkas', 'Blaka', 'Katibeh', 'Scheherazade New', 'Gulzar'],
  sans: ['Poppins', 'Montserrat', 'Manrope', 'Plus Jakarta Sans', 'DM Sans', 'Outfit', 'Sora', 'Space Grotesk', 'Urbanist', 'Figtree', 'Lexend', 'Nunito', 'Raleway', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'Onest', 'Geist', 'Be Vietnam Pro', 'Red Hat Display', 'Albert Sans', 'Bricolage Grotesque', 'Instrument Sans'],
  display: ['Bebas Neue', 'Anton', 'Archivo Black', 'Unbounded', 'Syne', 'Righteous', 'Fredoka', 'Baloo 2', 'Paytone One', 'Rubik Mono One', 'Dela Gothic One', 'Bungee'],
  serif: ['Playfair Display', 'DM Serif Display', 'Fraunces', 'Lora', 'Merriweather', 'Instrument Serif', 'Cormorant Garamond', 'Libre Baskerville'],
  handwriting: ['Caveat', 'Pacifico', 'Dancing Script', 'Permanent Marker', 'Kalam', 'Shadows Into Light'],
};
export const GOOGLE_FONT_GROUPS = { arabic: 'Arabic', sans: 'Sans-serif', display: 'Display', serif: 'Serif', handwriting: 'Handwriting' };

let idCounter = 0;
export function uid(prefix = 'e') {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur', 'ckb', 'ps', 'sd', 'ug', 'yi']);
export function isRtlText(s) {
  return RTL_RE.test(String(s || ''));
}
export function isRtlLang(lang) {
  return RTL_LANGS.has(String(lang || '').toLowerCase().split(/[-_]/)[0]);
}

export function normalizeColor(c, fallback = '#000000') {
  if (typeof c !== 'string') return fallback;
  const s = c.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s.toLowerCase();
  if (/^(rgb|rgba|hsl|hsla)\([^()]{3,60}\)$/i.test(s)) return s;
  if (/^[a-z]{3,20}$/i.test(s)) return s.toLowerCase();
  return fallback;
}

export function makeBackground(input = {}) {
  const type = ['solid', 'gradient', 'image'].includes(input.type) ? input.type : 'solid';
  const bg = { type };
  if (type === 'solid') bg.color = normalizeColor(input.color, '#101218');
  if (type === 'gradient') {
    bg.angle = Number.isFinite(+input.angle) ? +input.angle : 160;
    let stops = Array.isArray(input.stops) ? input.stops : null;
    if (!stops && Array.isArray(input.colors)) {
      stops = input.colors.map((color, i, a) => ({ pos: a.length > 1 ? i / (a.length - 1) : 0, color }));
    }
    if (!stops || stops.length < 2) stops = [{ pos: 0, color: '#1b1f3b' }, { pos: 1, color: '#0a0b14' }];
    bg.stops = stops.slice(0, 6).map((s, i, a) => ({
      pos: Math.min(1, Math.max(0, Number.isFinite(+s.pos) ? +s.pos : i / (a.length - 1))),
      color: normalizeColor(s.color, '#000000'),
    }));
  }
  if (type === 'image') {
    bg.src = String(input.src || input.path || '');
    bg.color = normalizeColor(input.color, '#000000');
    bg.dim = Math.min(1, Math.max(0, +input.dim || 0));
    bg.blur = Math.min(200, Math.max(0, +input.blur || 0));
  }
  return bg;
}

const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);

export function makeElement(type, props = {}) {
  const el = {
    id: props.id || uid(),
    type,
    name: props.name || '',
    x: num(props.x, BASE.w / 2),
    y: num(props.y, BASE.h / 2),
    w: num(props.w, 600),
    h: num(props.h, 600),
    rotation: num(props.rotation, 0),
    ...(props.locked ? { locked: true } : {}),
    skewX: Math.max(-50, Math.min(50, num(props.skewX, 0))),
    skewY: Math.max(-50, Math.min(50, num(props.skewY, 0))),
    opacity: Math.min(1, Math.max(0, num(props.opacity, 1))),
  };
  if (type === 'text') {
    let text = props.text;
    if (typeof text === 'string') text = { [props.lang || 'en']: text };
    el.text = text && typeof text === 'object' ? { ...text } : { en: 'Your caption' };
    el.fontFamily = String(props.fontFamily || DEFAULT_FONT);
    el.fontSize = Math.max(8, num(props.fontSize, 120));
    el.fontWeight = Math.min(900, Math.max(100, num(props.fontWeight, 700)));
    el.italic = !!props.italic;
    el.color = normalizeColor(props.color, '#ffffff');
    el.align = ['left', 'center', 'right', 'start'].includes(props.align) ? props.align : 'center';
    el.dir = ['auto', 'ltr', 'rtl'].includes(props.dir) ? props.dir : 'auto';
    el.lineHeight = Math.min(3, Math.max(0.7, num(props.lineHeight, 1.12)));
    el.letterSpacing = num(props.letterSpacing, 0);
    el.shadow = !!props.shadow;
    el.w = num(props.w, 1120);
    el.h = num(props.h, el.fontSize * el.lineHeight);
  } else if (type === 'screenshot') {
    el.src = String(props.src || props.path || '');
    el.srcTablet = String(props.srcTablet || '');
    el.frame = FRAMES.includes(props.frame) ? props.frame : 'auto';
    el.frameColor = normalizeColor(props.frameColor, '#111318');
    el.shadow = props.shadow === undefined ? true : !!props.shadow;
    el.glare = !!props.glare;
    el.depth = Math.max(0, Math.min(120, num(props.depth, 0)));
    // Optional: four corners (relative to the centre) the picture is mapped onto, for rendered 3D scenes.
    if (Array.isArray(props.quad) && props.quad.length === 4 && props.quad.every((q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite))) {
      el.quad = props.quad.map(([qx, qy]) => [Math.round(qx * 100) / 100, Math.round(qy * 100) / 100]);
      el.quadRadius = Math.max(0, Math.min(0.5, num(props.quadRadius, 0.1)));
    }
    el.w = num(props.w, 900);
    el.h = num(props.h, 1950);
    el.y = num(props.y, 1850);
  } else if (type === 'image') {
    el.src = String(props.src || props.path || '');
    el.radius = Math.max(0, num(props.radius, 0));
    el.w = num(props.w, 400);
    el.h = num(props.h, 400);
  } else if (type === 'icon') {
    el.icon = String(props.icon || props.name2 || 'star').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'star';
    el.color = normalizeColor(props.color, '#ffffff');
    el.stroke = Math.min(4, Math.max(0.5, num(props.stroke, 2))); // line weight on the 24-unit icon grid
    el.bg = ['none', 'circle', 'square'].includes(props.bg) ? props.bg : 'none';
    el.bgColor = normalizeColor(props.bgColor, '#7c6cff');
    el.w = num(props.w, 220);
    el.h = num(props.h, 220);
  } else if (type === 'sticker') {
    el.kind = STICKERS.includes(props.kind) ? props.kind : 'pill';
    const d = STICKER_DEFAULTS[el.kind];
    el.text = props.text === undefined || props.text === null ? d.text : String(props.text).slice(0, 300);
    el.fill = normalizeColor(props.fill, '#7c6cff');
    el.color = normalizeColor(props.color, '#ffffff');
    el.fontFamily = String(props.fontFamily || DEFAULT_FONT);
    el.w = num(props.w, d.w);
    el.h = num(props.h, d.h);
  } else if (type === 'shape') {
    el.shape = SHAPES.includes(props.shape) ? props.shape : 'rect';
    el.fill = normalizeColor(props.fill, '#6c7bff');
    el.fill2 = props.fill2 ? normalizeColor(props.fill2, '') : ''; // optional second colour for a gradient fill
    el.radius = Math.max(0, num(props.radius, 40));
    el.stroke = Math.min(400, Math.max(1, num(props.stroke, 36))); // line thickness for ring, arc, squiggle; dot size for dots
    el.seed = Math.max(0, Math.floor(num(props.seed, 7))); // changes the outline of a blob
  } else {
    throw new Error(`Unknown element type: ${type}`);
  }
  return el;
}

const UPDATABLE = {
  common: ['name', 'x', 'y', 'w', 'h', 'rotation', 'skewX', 'skewY', 'opacity'],
  text: ['fontFamily', 'fontSize', 'fontWeight', 'italic', 'color', 'align', 'dir', 'lineHeight', 'letterSpacing', 'shadow'],
  screenshot: ['src', 'srcTablet', 'frame', 'frameColor', 'shadow', 'glare', 'depth'],
  image: ['src', 'radius'],
  shape: ['shape', 'fill', 'fill2', 'radius', 'stroke', 'seed'],
  sticker: ['kind', 'text', 'fill', 'color', 'fontFamily'],
  icon: ['icon', 'color', 'stroke', 'bg', 'bgColor'],
};

// Apply a partial update by rebuilding through makeElement so every value is validated.
export function updateElement(el, patch = {}, lang = 'en') {
  const merged = { ...el };
  for (const k of [...UPDATABLE.common, ...UPDATABLE[el.type]]) {
    if (patch[k] !== undefined) merged[k] = patch[k];
  }
  if (patch.path !== undefined && (el.type === 'screenshot' || el.type === 'image')) merged.src = patch.path;
  if (el.type === 'sticker' && patch.kind && patch.kind !== el.kind && STICKER_DEFAULTS[patch.kind]) {
    // Switching kind also takes that kind's proportions (and sample text, unless new text was given).
    const d = STICKER_DEFAULTS[patch.kind];
    if (patch.w === undefined) merged.w = d.w;
    if (patch.h === undefined) merged.h = d.h;
    if (patch.text === undefined) merged.text = d.text;
  }
  if (el.type === 'text' && patch.text !== undefined) {
    merged.text = typeof patch.text === 'string' ? { ...el.text, [patch.lang || lang]: patch.text } : { ...el.text, ...patch.text };
  }
  const next = makeElement(el.type, merged);
  Object.keys(el).forEach((k) => delete el[k]);
  Object.assign(el, next);
  return el;
}

// The palette a template is drawn with: a theme the user picked, else the design's own look.
export function templateTheme(templateId, themeId) {
  const design = DESIGNS[templateId];
  return (themeId && THEMES[themeId]) || (design && LOOKS[design.look]) || THEMES.midnight;
}

export function buildTemplate(templateId, themeId, carry = {}) {
  const t = templateTheme(templateId, themeId);
  const title = carry.title || { en: 'Say what your app does' };
  const sub = carry.sub || { en: 'One short line that explains why it matters' };
  const shot = (p) => makeElement('screenshot', { src: carry.src || '', srcTablet: carry.srcTablet || '', frameColor: t.frame, ...p });
  const T = (p) => makeElement('text', { color: t.title, text: title, fontSize: 132, fontWeight: 800, name: 'Title', ...p });
  const S = (p) => makeElement('text', { color: t.sub, text: sub, fontSize: 60, fontWeight: 500, name: 'Subtitle', lineHeight: 1.25, ...p });
  const ST = (p) => makeElement('sticker', p);
  // A readable ink colour on top of the theme's title colour (used for inverted pills).
  const bgInk = (th) => (th.bg.type === 'solid' ? th.bg.color : th.bg.stops[0].color);
  const cx = BASE.w / 2;
  const design = DESIGNS[templateId];
  if (design) {
    const SH = (shape, p) => makeElement('shape', { shape, fill: t.accent, ...p });
    return LAYOUTS[design.layout].build({ t, T, S, ST, SH, shot, cx, carry, ink: inkOn(t.accent), paper: bgInk(t) });
  }
  switch (templateId) {
    case 'caption-bottom':
      return [shot({ x: cx, y: 1010, w: 960, h: 2080 }), T({ x: cx, y: 2300 }), S({ x: cx, y: 2560, w: 1040 })];
    case 'tilted':
      return [
        makeElement('shape', { shape: 'ellipse', fill: t.accent, x: cx + 260, y: 1900, w: 1300, h: 1300, opacity: 0.35, name: 'Glow' }),
        T({ x: cx, y: 340 }),
        S({ x: cx, y: 620, w: 1040 }),
        shot({ x: cx + 40, y: 1960, w: 1000, h: 2166, rotation: -8 }),
      ];
    case 'duo':
      return [
        T({ x: cx, y: 320 }),
        S({ x: cx, y: 590, w: 1040 }),
        shot({ x: cx - 250, y: 1960, w: 760, h: 1646, rotation: -6, name: 'Back device' }),
        shot({ x: cx + 230, y: 2060, w: 820, h: 1776, rotation: 5, src: carry.src2 || carry.src || '', name: 'Front device' }),
      ];
    case 'spotlight':
      return [
        makeElement('shape', { shape: 'glow', fill: t.accent, x: cx, y: 1900, w: 1900, h: 1900, opacity: 0.55, name: 'Glow' }),
        makeElement('shape', { shape: 'ring', fill: t.accent, stroke: 10, x: cx, y: 1900, w: 1500, h: 1500, opacity: 0.45, name: 'Ring' }),
        T({ x: cx, y: 330 }),
        S({ x: cx, y: 600, w: 1040 }),
        shot({ x: cx, y: 1900, w: 940, h: 2036, glare: true }),
      ];
    case 'playful':
      return [
        makeElement('shape', { shape: 'blob', fill: t.accent, seed: 3, x: 240, y: 1500, w: 900, h: 900, opacity: 0.5, name: 'Blob left' }),
        makeElement('shape', { shape: 'blob', fill: t.accent, seed: 11, x: 1120, y: 2350, w: 800, h: 800, opacity: 0.35, name: 'Blob right' }),
        makeElement('shape', { shape: 'dots', fill: t.sub, stroke: 22, x: 1090, y: 980, w: 300, h: 300, opacity: 0.5, name: 'Dots' }),
        T({ x: cx, y: 330 }),
        S({ x: cx, y: 600, w: 1040 }),
        shot({ x: cx, y: 1930, w: 960, h: 2080, rotation: 4, frame: 'clay', frameColor: t.title }),
        makeElement('shape', { shape: 'sparkle', fill: t.accent, x: 190, y: 900, w: 150, h: 150, name: 'Sparkle' }),
        makeElement('shape', { shape: 'sparkle', fill: t.title, x: 1150, y: 760, w: 90, h: 90, opacity: 0.8, name: 'Sparkle small' }),
      ];
    case 'frameless':
      return [
        makeElement('shape', { shape: 'arc', fill: t.accent, stroke: 60, x: cx, y: 2868, w: 1700, h: 1700, opacity: 0.35, name: 'Arc' }),
        T({ x: cx, y: 330 }),
        S({ x: cx, y: 600, w: 1040 }),
        shot({ x: cx, y: 1960, w: 1000, h: 2166, frame: 'none' }),
      ];
    case 'left-caption':
      return [
        T({ x: 600, y: 360, w: 1040, align: 'start' }),
        ST({ kind: 'underline', x: 330, y: 556, w: 420, h: 50, fill: t.accent }),
        S({ x: 560, y: 730, w: 960, align: 'start' }),
        shot({ x: cx + 150, y: 2040, w: 940, h: 2036, rotation: 0 }),
      ];
    case 'zoom':
      return [T({ x: cx, y: 300, fontSize: 118 }), shot({ x: cx, y: 2250, w: 1500, h: 3250, glare: true })];
    case 'rating':
      return [
        ST({ kind: 'rating', x: cx, y: 230, fill: '#ffc83d', color: t.title }),
        T({ x: cx, y: 480 }),
        S({ x: cx, y: 750, w: 1040 }),
        shot({ x: cx, y: 2010, w: 940, h: 2036 }),
      ];
    case 'award':
      return [
        ST({ kind: 'laurel', x: cx, y: 380, w: 620, h: 460, fill: t.accent, color: t.title }),
        T({ x: cx, y: 800, fontSize: 104 }),
        shot({ x: cx, y: 2080, w: 900, h: 1950 }),
      ];
    case 'pills':
      return [
        T({ x: cx, y: 330 }),
        shot({ x: cx, y: 1830, w: 900, h: 1950 }),
        ST({ kind: 'pill', x: 310, y: 1200, text: 'Fast', w: 330, fill: t.accent, color: '#ffffff', rotation: -6 }),
        ST({ kind: 'pill', x: 1030, y: 1560, text: 'Secure', w: 380, fill: t.title, color: bgInk(t), rotation: 5 }),
        ST({ kind: 'pill', x: 300, y: 2140, text: 'Offline', w: 380, fill: t.accent, color: '#ffffff', rotation: 4 }),
      ];
    case 'notify':
      return [
        makeElement('shape', { shape: 'glow', fill: t.accent, x: cx, y: 1800, w: 1800, h: 1800, opacity: 0.4, name: 'Glow' }),
        T({ x: cx, y: 330 }),
        shot({ x: cx, y: 1960, w: 900, h: 1950 }),
        ST({ kind: 'notification', x: cx - 90, y: 1180, w: 860, fill: '#ffffff', color: '#14161b', rotation: -3 }),
        ST({ kind: 'notification', x: cx + 110, y: 1480, w: 800, text: 'Payment received\nYou got $48.00 from Sara', fill: '#ffffff', color: '#14161b', rotation: 2 }),
      ];
    case 'pano-left':
      return [T({ x: 560, y: 360, w: 960, align: 'start' }), S({ x: 540, y: 660, w: 920, align: 'start' }), shot({ x: BASE.w, y: 1960, w: 1080, h: 2340, rotation: -4 })];
    case 'pano-right':
      return [shot({ x: 0, y: 1960, w: 1080, h: 2340, rotation: -4 }), T({ x: 800, y: 360, w: 900, align: 'start' }), S({ x: 790, y: 700, w: 880, align: 'start' })];
    case 'card':
      return [
        makeElement('shape', { shape: 'rect', radius: 120, fill: t.accent, x: cx, y: 2060, w: 1120, h: 2000, opacity: 0.9, name: 'Card' }),
        T({ x: cx, y: 330 }),
        S({ x: cx, y: 600, w: 1040 }),
        shot({ x: cx, y: 2140, w: 860, h: 1863 }),
      ];
    case 'trio':
      return [
        T({ x: cx, y: 320 }),
        S({ x: cx, y: 590, w: 1040 }),
        shot({ x: cx - 400, y: 2040, w: 640, h: 1386, rotation: -10, name: 'Left device' }),
        shot({ x: cx + 400, y: 2040, w: 640, h: 1386, rotation: 10, src: carry.src2 || carry.src || '', name: 'Right device' }),
        shot({ x: cx, y: 1960, w: 760, h: 1646, name: 'Centre device' }),
      ];
    case 'review':
      return [
        ST({ kind: 'rating', x: cx, y: 760, text: '', w: 480, fill: '#ffc83d', color: t.title }),
        T({ x: cx, y: 1240, fontSize: 124, w: 1120, text: carry.title || { en: '“The only app I open every single morning.”' } }),
        S({ x: cx, y: 1760, fontSize: 64, text: carry.sub || { en: 'Sara M. · App Store review' } }),
        ST({ kind: 'laurel', x: cx, y: 2260, w: 520, h: 390, text: '4.9\n12k ratings', fill: t.accent, color: t.title }),
      ];
    case 'checklist':
      return [
        T({ x: cx, y: 420, fontSize: 140 }),
        ST({ kind: 'check', x: cx, y: 900, w: 900, h: 120, text: 'Works offline', fill: t.accent, color: t.title }),
        ST({ kind: 'check', x: cx, y: 1100, w: 900, h: 120, text: 'Syncs across devices', fill: t.accent, color: t.title }),
        ST({ kind: 'check', x: cx, y: 1300, w: 900, h: 120, text: 'No ads, ever', fill: t.accent, color: t.title }),
        shot({ x: cx, y: 2520, w: 900, h: 1950 }),
      ];
    case 'hero-text':
      return [
        makeElement('shape', { shape: 'pill', fill: t.accent, x: cx, y: 900, w: 380, h: 28, name: 'Accent bar' }),
        T({ x: cx, y: 1260, fontSize: 190, w: 1160 }),
        S({ x: cx, y: 1760, fontSize: 72, w: 1000 }),
      ];
    case 'caption-top':
    default:
      return [T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1900, w: 980, h: 2123 })];
  }
}

export function makeSlide(templateId = 'caption-top', themeId, carry = {}) {
  const t = templateTheme(templateId, themeId);
  return { id: uid('s'), background: makeBackground(t.bg), elements: buildTemplate(templateId, themeId, carry) };
}

export function newProject(name = 'Untitled') {
  return { app: 'severus-shot', version: 1, name, base: { ...BASE }, languages: ['en'], fonts: [], motion: makeMotion(), listing: {}, slides: [makeSlide()] };
}

// Accepts anything parsed from disk or sent by an agent and returns a safe project.
export function sanitizeProject(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.slides)) throw new Error('Not a Severus Shot project file');
  const p = {
    app: 'severus-shot',
    version: 1,
    name: String(raw.name || 'Untitled').slice(0, 120),
    base: { ...BASE },
    languages: Array.isArray(raw.languages) && raw.languages.length ? [...new Set(raw.languages.map((l) => String(l).slice(0, 16)))] : ['en'],
    motion: makeMotion(raw.motion || {}),
    thumb: typeof raw.thumb === 'string' && raw.thumb.startsWith('data:image/jpeg;base64,') && raw.thumb.length < 90000 ? raw.thumb : '',
    fonts: Array.isArray(raw.fonts) ? raw.fonts.filter((f) => f && f.family && f.path).map((f) => ({ family: String(f.family), path: String(f.path), ...(f.weight ? { weight: String(f.weight).slice(0, 12) } : {}), ...(f.range ? { range: String(f.range).slice(0, 600) } : {}), ...(f.source ? { source: 'google' } : {}) })) : [],
    listing: sanitizeListing(raw.listing),
    slides: raw.slides.map((s) => ({
      id: s.id || uid('s'),
      background: makeBackground(s.background || {}),
      elements: (Array.isArray(s.elements) ? s.elements : []).filter((e) => e && ['text', 'screenshot', 'image', 'shape', 'sticker', 'icon'].includes(e.type)).map((e) => makeElement(e.type, e)),
    })),
  };
  if (!p.slides.length) p.slides.push(makeSlide());
  return p;
}

export function applyTemplate(slide, templateId, themeId) {
  const texts = slide.elements.filter((e) => e.type === 'text');
  const shots = slide.elements.filter((e) => e.type === 'screenshot');
  const carry = { title: texts[0]?.text, sub: texts[1]?.text, src: shots[0]?.src, srcTablet: shots[0]?.srcTablet, src2: shots[1]?.src };
  slide.elements = buildTemplate(templateId, themeId, carry);
  if ((themeId && THEMES[themeId]) || DESIGNS[templateId]) slide.background = makeBackground(templateTheme(templateId, themeId).bg);
  return slide;
}

export function applyTheme(slide, themeId) {
  const t = THEMES[themeId];
  if (!t) throw new Error(`Unknown theme: ${themeId}`);
  return applyPalette(slide, t);
}

// Recolour a slide with any palette of the theme shape (a theme or a design look).
export function applyPalette(slide, t) {
  slide.background = makeBackground(t.bg);
  let n = 0;
  for (const e of slide.elements) {
    if (e.type === 'text') { e.color = n === 0 ? t.title : t.sub; n += 1; }
    if (e.type === 'screenshot') e.frameColor = t.frame;
    if (e.type === 'shape') e.fill = t.accent;
    if (e.type === 'icon') { e.color = e.bg === 'none' ? t.title : '#ffffff'; e.bgColor = t.accent; }
    if (e.type === 'sticker' && !['rating', 'notification', 'emoji'].includes(e.kind)) { e.fill = t.accent; e.color = e.kind === 'pill' || e.kind === 'burst' ? '#ffffff' : t.title; }
  }
  return slide;
}

export function resolveSize(spec) {
  if (spec && typeof spec === 'object' && spec.w && spec.h) return spec;
  const s = String(spec || '').trim();
  const known = STORE_SIZES.find((z) => z.id === s);
  if (known) return known;
  const m = /^(\d{2,5})x(\d{2,5})$/i.exec(s);
  if (m) {
    const w = +m[1], h = +m[2];
    if (w < 64 || h < 64 || w > 8192 || h > 8192) throw new Error(`Size out of range: ${s}`);
    return { id: `${w}x${h}`, label: `${w}×${h}`, w, h, store: 'custom', device: w / h > 0.62 ? 'tablet' : 'phone' };
  }
  throw new Error(`Unknown size "${s}". Use one of: ${STORE_SIZES.map((z) => z.id).join(', ')} or WIDTHxHEIGHT`);
}

export function elementText(el, lang, languages = ['en']) {
  const t = el.text || {};
  if (t[lang] !== undefined && t[lang] !== '') return t[lang];
  for (const l of languages) if (t[l]) return t[l];
  const first = Object.values(t).find(Boolean);
  return first || '';
}

// Reads a Google Fonts stylesheet and returns the font files worth keeping (Latin and Arabic).
export function parseGoogleCss(css) {
  const out = [];
  const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g;
  let m;
  while ((m = re.exec(String(css)))) {
    const label = m[1] || 'all', body = m[2];
    if (!['all', 'latin', 'latin-ext', 'arabic'].includes(label)) continue;
    const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/.exec(body);
    if (!url || /font-style:\s*italic/.test(body)) continue;
    const weight = /font-weight:\s*([\d ]+);/.exec(body);
    const range = /unicode-range:\s*([^;]+);/.exec(body);
    out.push({ label, url: url[1], weight: weight ? weight[1].trim() : '400', range: range ? range[1].trim() : '' });
  }
  return out;
}

// ----- fastlane layout: the folders `fastlane deliver` (App Store) and `fastlane supply` (Google Play) read -----
const IOS_LOCALES = { en: 'en-US', ar: 'ar-SA', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it', ja: 'ja', ko: 'ko', pt: 'pt-BR', ru: 'ru', tr: 'tr', nl: 'nl-NL', zh: 'zh-Hans', he: 'he', hi: 'hi', id: 'id', sv: 'sv', pl: 'pl', uk: 'uk', vi: 'vi', th: 'th', ms: 'ms' };
const ANDROID_LOCALES = { en: 'en-US', ar: 'ar', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-BR', ru: 'ru-RU', tr: 'tr-TR', nl: 'nl-NL', zh: 'zh-CN', he: 'iw-IL', hi: 'hi-IN', id: 'id', sv: 'sv-SE', pl: 'pl-PL', uk: 'uk', vi: 'vi', th: 'th', ms: 'ms', fa: 'fa', ur: 'ur' };
const ANDROID_DIRS = { 'android-phone': 'phoneScreenshots', 'android-tablet-7': 'sevenInchScreenshots', 'android-tablet-10': 'tenInchScreenshots' };
export const EXPORT_LAYOUTS = ['folders', 'fastlane'];

export function storeLocale(lang, store) {
  const code = String(lang);
  if (code.includes('-')) return code;
  return (store === 'android' ? ANDROID_LOCALES : IOS_LOCALES)[code.toLowerCase()] || code;
}

// Path parts below the export folder, or null when the size belongs to neither store.
export function fastlanePath(size, lang, n, fmt = 'png') {
  const nn = String(n).padStart(2, '0');
  if (size.store === 'ios') return ['fastlane', 'screenshots', storeLocale(lang, 'ios'), `${nn}_${size.id}.${fmt}`];
  if (size.store === 'android') return ['fastlane', 'metadata', 'android', storeLocale(lang, 'android'), 'images', ANDROID_DIRS[size.id] || 'phoneScreenshots', `${nn}.${fmt}`];
  return null;
}

// ----- store listing text (name, subtitle, description …), kept per language -----
export const LISTING_FIELDS = [
  { id: 'name', label: 'App name', max: 30, ios: 'name.txt', android: 'title.txt' },
  { id: 'subtitle', label: 'Subtitle (App Store)', max: 30, ios: 'subtitle.txt' },
  { id: 'short', label: 'Short description (Google Play)', max: 80, android: 'short_description.txt' },
  { id: 'promo', label: 'Promotional text (App Store)', max: 170, ios: 'promotional_text.txt' },
  { id: 'keywords', label: 'Keywords (App Store)', max: 100, ios: 'keywords.txt' },
  { id: 'description', label: 'Description', max: 4000, ios: 'description.txt', android: 'full_description.txt', long: true },
];

export function sanitizeListing(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [lang, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue;
    const clean = {};
    for (const f of LISTING_FIELDS) if (typeof entry[f.id] === 'string' && entry[f.id].trim()) clean[f.id] = entry[f.id].slice(0, f.max);
    if (Object.keys(clean).length) out[String(lang).slice(0, 16)] = clean;
  }
  return out;
}

// Text files for the fastlane layout: [{ parts, text }] for every filled field.
export function listingFiles(project, langs) {
  const files = [];
  for (const lang of langs) {
    const entry = (project.listing || {})[lang];
    if (!entry) continue;
    for (const f of LISTING_FIELDS) {
      const text = String(entry[f.id] || '').trim();
      if (!text) continue;
      if (f.ios) files.push({ parts: ['fastlane', 'metadata', storeLocale(lang, 'ios'), f.ios], text: `${text}\n` });
      if (f.android) files.push({ parts: ['fastlane', 'metadata', 'android', storeLocale(lang, 'android'), f.android], text: `${text}\n` });
    }
  }
  return files;
}

// ===== Design library: compositions × colour looks =====
// Each design is one composition (where the devices, captions and decorations sit) drawn in one look
// (background, type colours, accent). Picking a theme in the gallery recolours any of them.
const g = (angle, ...colors) => ({ type: 'gradient', angle, stops: colors.map((color, i) => ({ pos: colors.length === 1 ? 0 : i / (colors.length - 1), color })) });
export const LOOKS = {
  aurora: { label: 'Aurora', bg: g(155, '#0b1026', '#1d2a6b', '#0f766e'), title: '#ffffff', sub: '#bfd3ff', accent: '#5eead4', frame: '#0a0d18' },
  noir: { label: 'Noir', bg: { type: 'solid', color: '#0b0b0d' }, title: '#ffffff', sub: '#a1a1aa', accent: '#c6f432', frame: '#1c1c20' },
  cream: { label: 'Cream', bg: { type: 'solid', color: '#f6f0e4' }, title: '#1c1917', sub: '#6b6257', accent: '#e4572e', frame: '#1f1b18' },
  lilac: { label: 'Lilac', bg: g(165, '#f3ecff', '#d9c8ff'), title: '#24124d', sub: '#5b4a85', accent: '#7c3aed', frame: '#1b1430' },
  sunset: { label: 'Sunset', bg: g(150, '#ffb347', '#ff5e62', '#c2185b'), title: '#ffffff', sub: '#ffe6dc', accent: '#fff176', frame: '#1c1014' },
  deepsea: { label: 'Deep sea', bg: g(170, '#0f2a5c', '#0b6aa8', '#22d3ee'), title: '#ffffff', sub: '#cfeeff', accent: '#fde047', frame: '#07142c' },
  forest: { label: 'Forest', bg: g(165, '#0d2b1f', '#14532d'), title: '#f0fdf4', sub: '#a7d7b8', accent: '#facc15', frame: '#06140e' },
  candy: { label: 'Candy', bg: g(145, '#ffd1e8', '#ff8fc7'), title: '#4a0d2e', sub: '#7d2a55', accent: '#7c3aed', frame: '#2a0f1e' },
  mono: { label: 'Mono', bg: { type: 'solid', color: '#f4f4f5' }, title: '#09090b', sub: '#52525b', accent: '#18181b', frame: '#18181b' },
  neon: { label: 'Neon', bg: g(160, '#12002b', '#2a0a5e'), title: '#ffffff', sub: '#d8c4ff', accent: '#ff3df2', frame: '#0a0118' },
  sand: { label: 'Sand', bg: g(170, '#f3e7d3', '#e2c9a6'), title: '#3b2a1a', sub: '#7a6248', accent: '#b45309', frame: '#2a2018' },
  royal: { label: 'Royal', bg: g(150, '#312e81', '#6d28d9', '#a855f7'), title: '#ffffff', sub: '#e4d9ff', accent: '#fbbf24', frame: '#140f3a' },
  fresh: { label: 'Fresh', bg: g(165, '#e6fff5', '#a7f3d0'), title: '#064e3b', sub: '#2f7d68', accent: '#059669', frame: '#0b2a22' },
  coral: { label: 'Coral', bg: g(155, '#ff7a59', '#ff4f6d'), title: '#ffffff', sub: '#ffe3dc', accent: '#1f2937', frame: '#1a1012' },
  slate: { label: 'Slate', bg: g(170, '#1e293b', '#334155'), title: '#f8fafc', sub: '#b6c2d4', accent: '#38bdf8', frame: '#0b1220' },
  lemon: { label: 'Lemon', bg: { type: 'solid', color: '#ffe14d' }, title: '#141414', sub: '#4a4324', accent: '#141414', frame: '#141414' },
};

// Black or white, whichever reads better on the given colour.
export function inkOn(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!m) return '#ffffff';
  const [r, gr, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return (r * 299 + gr * 587 + b * 114) / 1000 > 150 ? '#141414' : '#ffffff';
}

const D = { w: 980, h: 2123 }; // a phone at its usual size
const dev = (w) => ({ w, h: Math.round(w * 2.166) });
export const TEMPLATE_CATEGORIES = { all: 'All', classic: 'Classic', hero: 'Hero', tilted: 'Tilted', multi: 'Several devices', stage: 'Shapes behind', proof: 'Social proof', text: 'Text first', floating: 'Floating pieces', minimal: 'Minimal', scene: '3D scenes', studio: 'Studio 3D' };

export const LAYOUTS = {
  'top-bleed': { label: 'Device from the top', cat: 'hero', build: ({ T, S, shot, cx }) => [shot({ x: cx, y: 800, ...dev(1040) }), T({ x: cx, y: 2230 }), S({ x: cx, y: 2500, w: 1040 })] },
  'bottom-bleed': { label: 'Device rising from the bottom', cat: 'hero', build: ({ T, S, shot, cx }) => [T({ x: cx, y: 340 }), S({ x: cx, y: 610, w: 1040 }), shot({ x: cx, y: 2300, ...dev(1120) })] },
  giant: { label: 'Edge-to-edge device', cat: 'hero', build: ({ T, shot, cx }) => [T({ x: cx, y: 250, fontSize: 100 }), shot({ x: cx, y: 1830, ...dev(1180), glare: true })] },
  halo: { label: 'Device with a halo', cat: 'hero', build: ({ T, S, SH, shot, cx }) => [SH('glow', { x: cx, y: 1880, w: 2100, h: 2100, opacity: 0.6, name: 'Glow' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1920, ...D, glare: true })] },
  'tilt-left': { label: 'Leaning left, caption at the side', cat: 'tilted', build: ({ T, S, shot, cx }) => [T({ x: 600, y: 370, w: 1040, align: 'start' }), S({ x: 560, y: 690, w: 960, align: 'start' }), shot({ x: cx + 230, y: 2120, ...dev(1120), rotation: -12 })] },
  'tilt-right': { label: 'Leaning right', cat: 'tilted', build: ({ T, S, SH, shot, cx }) => [SH('ellipse', { x: cx - 300, y: 2000, w: 1300, h: 1300, opacity: 0.3, name: 'Disc' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx - 120, y: 2140, ...dev(1100), rotation: 10 })] },
  'tilt-deep': { label: 'Steep tilt', cat: 'tilted', build: ({ T, SH, shot, cx }) => [SH('glow', { x: cx + 200, y: 1900, w: 1900, h: 1900, opacity: 0.5, name: 'Glow' }), T({ x: cx, y: 330 }), shot({ x: cx + 60, y: 1980, ...dev(1060), rotation: -18 })] },
  'tilt-card': { label: 'Tilted card, no frame', cat: 'tilted', build: ({ T, S, SH, shot, cx }) => [SH('blob', { seed: 7, x: cx - 260, y: 2200, w: 1200, h: 1200, opacity: 0.4, name: 'Blob' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx + 30, y: 1990, ...dev(960), frame: 'none', rotation: -7 })] },
  'duo-overlap': { label: 'Two devices, stepped', cat: 'multi', build: ({ T, S, shot, cx, carry }) => [T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx - 230, y: 1800, ...dev(780), name: 'Back device' }), shot({ x: cx + 230, y: 2160, ...dev(780), src: carry.src2 || carry.src || '', name: 'Front device' })] },
  'duo-out': { label: 'Two devices, leaning apart', cat: 'multi', build: ({ T, S, shot, cx, carry }) => [T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx - 340, y: 2220, ...dev(820), rotation: -9, name: 'Left device' }), shot({ x: cx + 340, y: 2220, ...dev(820), rotation: 9, src: carry.src2 || carry.src || '', name: 'Right device' })] },
  'trio-row': { label: 'Three devices in a row', cat: 'multi', build: ({ T, shot, cx, carry }) => [T({ x: cx, y: 330 }), shot({ x: cx - 600, y: 2060, ...dev(700), name: 'Left device' }), shot({ x: cx + 600, y: 2060, ...dev(700), src: carry.src2 || carry.src || '', name: 'Right device' }), shot({ x: cx, y: 1960, ...dev(820), name: 'Centre device' })] },
  'duo-depth': { label: 'Front and back', cat: 'multi', build: ({ T, S, shot, cx, carry }) => [T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx + 300, y: 1820, ...dev(640), rotation: 6, opacity: 0.85, src: carry.src2 || carry.src || '', name: 'Back device' }), shot({ x: cx - 110, y: 2080, ...dev(900), rotation: -4, name: 'Front device' })] },
  'card-stage': { label: 'On a rounded card', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('rect', { radius: 140, x: cx, y: 2080, w: 1160, h: 1960, opacity: 0.25, name: 'Card' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 2060, ...dev(880) })] },
  'circle-stage': { label: 'On a circle', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('ellipse', { x: cx, y: 2000, w: 1500, h: 1500, opacity: 0.3, name: 'Disc' }), SH('ring', { stroke: 8, x: cx, y: 2000, w: 1760, h: 1760, opacity: 0.4, name: 'Ring' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 2020, ...dev(900) })] },
  'arch-stage': { label: 'Under an arch', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('rect', { radius: 560, x: cx, y: 2300, w: 1120, h: 2400, opacity: 0.3, name: 'Arch' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 2140, ...dev(860) })] },
  band: { label: 'Across a diagonal band', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('rect', { x: cx, y: 1980, w: 2400, h: 900, rotation: -12, opacity: 0.35, name: 'Band' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1960, ...D })] },
  'two-tone': { label: 'Two-tone split', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('rect', { x: cx, y: 2168, w: 1320, h: 1400, opacity: 0.92, name: 'Colour block' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1960, ...dev(940) })] },
  rings: { label: 'Rings behind', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('rings', { stroke: 6, x: cx, y: 1920, w: 1800, h: 1800, opacity: 0.45, name: 'Rings' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1940, ...dev(920) })] },
  wave: { label: 'Wave at the bottom', cat: 'stage', build: ({ T, S, SH, shot, cx }) => [SH('wave', { x: cx, y: 2560, w: 1500, h: 700, opacity: 0.5, name: 'Wave' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1900, ...dev(940) })] },
  badge: { label: 'Label above the headline', cat: 'proof', build: ({ t, T, S, ST, shot, cx, ink }) => [ST({ kind: 'pill', x: cx, y: 210, w: 300, text: 'NEW', fill: t.accent, color: ink }), T({ x: cx, y: 470 }), S({ x: cx, y: 740, w: 1040 }), shot({ x: cx, y: 2040, ...dev(920) })] },
  stars: { label: 'Star rating first', cat: 'proof', build: ({ t, T, S, ST, shot, cx }) => [ST({ kind: 'rating', x: cx, y: 230, fill: '#ffc83d', color: t.title }), T({ x: cx, y: 480 }), S({ x: cx, y: 750, w: 1040 }), shot({ x: cx, y: 2300, ...dev(1080) })] },
  quote: { label: 'Review quote over the device', cat: 'proof', build: ({ t, T, S, ST, shot, cx, carry }) => [ST({ kind: 'rating', x: cx, y: 260, text: '', w: 440, fill: '#ffc83d', color: t.title }), T({ x: cx, y: 640, fontSize: 104, w: 1120, text: carry.title || { en: '“I open it every single morning.”' } }), S({ x: cx, y: 1010, text: carry.sub || { en: 'Sara M. · App Store review' } }), shot({ x: cx, y: 2440, ...dev(1000) })] },
  laurels: { label: 'Award and device', cat: 'proof', build: ({ t, T, ST, shot, cx }) => [ST({ kind: 'laurel', x: cx, y: 360, w: 600, h: 440, fill: t.accent, color: t.title }), T({ x: cx, y: 780, fontSize: 104 }), shot({ x: cx, y: 2260, ...dev(1000) })] },
  stat: { label: 'One big number', cat: 'text', build: ({ T, S, SH, shot, cx, carry }) => [SH('pill', { x: cx, y: 260, w: 260, h: 24, name: 'Accent bar' }), T({ x: cx, y: 600, fontSize: 300, text: carry.title || { en: '10M+' } }), S({ x: cx, y: 930, fontSize: 68, w: 1000, text: carry.sub || { en: 'people plan their day with us' } }), shot({ x: cx, y: 2360, ...dev(940) })] },
  peek: { label: 'Big headline, device peeking', cat: 'text', build: ({ T, S, shot, cx }) => [T({ x: cx, y: 760, fontSize: 196, w: 1160 }), S({ x: cx, y: 1330, fontSize: 70, w: 1000 }), shot({ x: cx, y: 2820, ...dev(1000) })] },
  'side-checks': { label: 'Checklist beside the device', cat: 'text', build: ({ t, T, ST, shot, cx }) => [T({ x: 600, y: 380, w: 1040, align: 'start' }), ST({ kind: 'check', x: 350, y: 1180, w: 540, h: 96, text: 'Works offline', fill: t.accent, color: t.title }), ST({ kind: 'check', x: 350, y: 1340, w: 540, h: 96, text: 'Syncs everywhere', fill: t.accent, color: t.title }), ST({ kind: 'check', x: 350, y: 1500, w: 540, h: 96, text: 'No ads, ever', fill: t.accent, color: t.title }), shot({ x: cx + 440, y: 2240, ...dev(820) })] },
  statement: { label: 'Statement, no device', cat: 'text', build: ({ T, S, SH, cx }) => [SH('sparkle', { x: 250, y: 620, w: 170, h: 170, name: 'Sparkle' }), T({ x: cx, y: 1280, fontSize: 210, w: 1160 }), S({ x: cx, y: 1820, fontSize: 74, w: 1000 }), SH('squiggle', { x: cx, y: 2200, w: 520, h: 90, name: 'Squiggle' })] },
  'float-notify': { label: 'Notifications around the device', cat: 'floating', build: ({ T, ST, shot, cx }) => [T({ x: cx, y: 330 }), shot({ x: cx, y: 1980, ...dev(880) }), ST({ kind: 'notification', x: cx - 170, y: 1260, w: 820, fill: '#ffffff', color: '#14161b', rotation: -4 }), ST({ kind: 'notification', x: cx + 170, y: 2300, w: 800, text: 'Payment received\nYou got $48.00 from Sara', fill: '#ffffff', color: '#14161b', rotation: 3 })] },
  'float-pills': { label: 'Feature pills around the device', cat: 'floating', build: ({ t, T, ST, shot, cx, ink, paper }) => [T({ x: cx, y: 330 }), shot({ x: cx, y: 1900, ...dev(880) }), ST({ kind: 'pill', x: 270, y: 1260, w: 340, text: 'Fast', fill: t.accent, color: ink, rotation: -7 }), ST({ kind: 'pill', x: 1060, y: 1640, w: 380, text: 'Secure', fill: t.title, color: paper, rotation: 6 }), ST({ kind: 'pill', x: 280, y: 2280, w: 380, text: 'Offline', fill: t.accent, color: ink, rotation: 5 })] },
  'float-sparkle': { label: 'Clay device with sparkles', cat: 'floating', build: ({ t, T, S, SH, shot, cx }) => [SH('blob', { seed: 5, x: 220, y: 1700, w: 820, h: 820, opacity: 0.45, name: 'Blob' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1940, ...dev(940), frame: 'clay', frameColor: t.title, rotation: 3 }), SH('sparkle', { x: 180, y: 940, w: 150, h: 150, name: 'Sparkle' }), SH('sparkle', { fill: t.title, x: 1150, y: 2500, w: 110, h: 110, opacity: 0.85, name: 'Sparkle small' })] },
  'glass-hero': { label: 'Glass device', cat: 'minimal', build: ({ T, S, SH, shot, cx }) => [SH('ellipse', { x: 1080, y: 1300, w: 700, h: 700, opacity: 0.45, name: 'Disc' }), SH('ellipse', { x: 240, y: 2500, w: 560, h: 560, opacity: 0.3, name: 'Disc small' }), T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1940, ...D, frame: 'glass' })] },
  outline: { label: 'Outline device, quiet page', cat: 'minimal', build: ({ t, T, S, SH, shot, cx }) => [SH('dots', { fill: t.sub, stroke: 20, x: 1090, y: 330, w: 280, h: 280, opacity: 0.5, name: 'Dots' }), T({ x: 560, y: 380, w: 960, align: 'start' }), S({ x: 540, y: 700, w: 920, align: 'start' }), shot({ x: cx, y: 2060, ...dev(900), frame: 'outline', frameColor: t.title })] },
  'plain-card': { label: 'Plain screenshot card', cat: 'minimal', build: ({ T, S, shot, cx }) => [T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }), shot({ x: cx, y: 1980, ...dev(1000), frame: 'none' })] },
};

// 3D-style scenes: a studio floor and light, and devices leaned or laid in space.
const floor = (h) => makeElement('shape', { shape: 'rect', radius: 0, fill: '#000000', x: BASE.w / 2, y: BASE.h - h / 2 + 20, w: BASE.w + 80, h: h + 40, opacity: 0.2, name: 'Floor' });
const light = (x, y, size = 2000) => makeElement('shape', { shape: 'glow', fill: '#ffffff', x, y, w: size, h: size, opacity: 0.28, name: 'Studio light' });
const contact = (x, y, w, opacity = 0.34) => makeElement('shape', { shape: 'glow', fill: '#000000', x, y, w, h: w * 0.2, opacity, name: 'Contact shadow' });
Object.assign(LAYOUTS, {
  'studio-lean': { label: 'Studio, device leaning', cat: 'scene', build: ({ T, S, shot, cx }) => [floor(820), light(cx + 200, 1100), contact(cx + 80, 2500, 1100), T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx + 30, y: 1700, ...dev(800), rotation: 13, skewY: -9, depth: 30 })] },
  'studio-left': { label: 'Studio, leaning the other way', cat: 'scene', build: ({ T, S, shot, cx }) => [floor(820), light(cx - 200, 1100), contact(cx - 60, 2500, 1100), T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx - 30, y: 1700, ...dev(800), rotation: -13, skewY: 9, depth: 30 })] },
  'studio-float': { label: 'Studio, floating device', cat: 'scene', build: ({ T, S, shot, cx }) => [floor(700), light(cx, 1300, 2200), contact(cx, 2620, 760, 0.3), T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx, y: 1640, ...dev(760), depth: 18, glare: true })] },
  podium: { label: 'On a podium', cat: 'scene', build: ({ t, T, S, SH, shot, cx }) => [floor(760), light(cx, 1200, 2200), SH('rect', { x: cx, y: 2560, w: 900, h: 300, opacity: 0.55, name: 'Podium body' }), SH('ellipse', { x: cx, y: 2710, w: 900, h: 190, opacity: 0.55, name: 'Podium base' }), SH('ellipse', { fill: t.title, x: cx, y: 2410, w: 900, h: 190, opacity: 0.22, name: 'Podium top' }), SH('ellipse', { x: cx, y: 2410, w: 900, h: 190, opacity: 0.75, name: 'Podium surface' }), T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx, y: 1560, ...dev(720), depth: 16 })] },
  'iso-single': { label: 'Isometric device', cat: 'scene', build: ({ T, S, shot, cx }) => [light(cx, 1700, 2200), contact(cx + 90, 2440, 1200, 0.3), T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx + 10, y: 1820, ...dev(620), rotation: -28, skewX: 24, depth: 30 })] },
  'iso-duo': { label: 'Two isometric devices', cat: 'scene', build: ({ T, shot, cx, carry }) => [light(cx, 1700, 2200), T({ x: cx, y: 330 }), shot({ x: cx + 250, y: 1400, ...dev(480), rotation: -28, skewX: 24, depth: 24, src: carry.src2 || carry.src || '', name: 'Back device' }), shot({ x: cx - 150, y: 2060, ...dev(540), rotation: -28, skewX: 24, depth: 26, name: 'Front device' })] },
  'iso-cascade': { label: 'Cascade of screens', cat: 'scene', build: ({ T, S, shot, cx, carry }) => [light(cx, 1800, 2400), T({ x: cx, y: 320 }), S({ x: cx, y: 590, w: 1040 }), shot({ x: cx + 330, y: 1330, ...dev(430), frame: 'none', rotation: -26, skewX: 22, depth: 12, src: carry.src2 || carry.src || '', name: 'Screen 3' }), shot({ x: cx + 20, y: 1730, ...dev(430), frame: 'none', rotation: -26, skewX: 22, depth: 12, src: carry.src2 || carry.src || '', name: 'Screen 2' }), shot({ x: cx - 290, y: 2130, ...dev(430), frame: 'none', rotation: -26, skewX: 22, depth: 12, name: 'Screen 1' })] },
  'screen-wall': { label: 'Wall of screens', cat: 'scene', build: ({ t, T, SH, shot, cx, carry, paper }) => [
    shot({ x: cx - 420, y: 700, ...dev(560), frame: 'none', rotation: -10, shadow: false, name: 'Screen 1' }), shot({ x: cx + 190, y: 560, ...dev(560), frame: 'none', rotation: -10, shadow: false, src: carry.src2 || carry.src || '', name: 'Screen 2' }),
    shot({ x: cx - 200, y: 1980, ...dev(560), frame: 'none', rotation: -10, shadow: false, src: carry.src2 || carry.src || '', name: 'Screen 3' }), shot({ x: cx + 410, y: 1840, ...dev(560), frame: 'none', rotation: -10, shadow: false, name: 'Screen 4' }),
    SH('rect', { x: cx, y: BASE.h / 2, w: BASE.w, h: BASE.h, opacity: 0.38, name: 'Tint' }),
    SH('rect', { fill: paper, radius: 70, x: cx, y: 1420, w: 1080, h: 420, opacity: 0.94, name: 'Caption card' }), T({ x: cx, y: 1420, fontSize: 112, w: 960 }),
  ] },
});

const CLASSIC_CAT = { rating: 'proof', award: 'proof', review: 'proof', 'hero-text': 'text', checklist: 'text', pills: 'floating', notify: 'floating', playful: 'floating', tilted: 'tilted', duo: 'multi', trio: 'multi', spotlight: 'stage', card: 'stage', zoom: 'hero', frameless: 'minimal' };
// id -> { layout, look }. Every composition is offered in six looks, spread so neighbours differ.
export const DESIGNS = {};
export const TEMPLATE_INFO = Object.fromEntries(Object.keys(TEMPLATES).map((id) => [id, { cat: 'classic', group: CLASSIC_CAT[id] || 'hero' }]));
{
  const lookIds = Object.keys(LOOKS);
  Object.keys(LAYOUTS).forEach((layout, i) => {
    for (let k = 0; k < 6; k += 1) {
      const look = lookIds[(i * 5 + k * 3) % lookIds.length];
      const id = `${layout}--${look}`;
      DESIGNS[id] = { layout, look };
      TEMPLATES[id] = `${LAYOUTS[layout].label} · ${LOOKS[look].label}`;
      TEMPLATE_INFO[id] = { cat: LAYOUTS[layout].cat, layout, look };
    }
  });
}

// Studio 3D: scenes rendered in Blender. The picture is one locked element; the screenshot is mapped onto the phone's screen.
for (const sc of SCENES3D) {
  const id = `studio3d-${sc.id}`;
  const xs = sc.quad.map((q) => q[0]), ys = sc.quad.map((q) => q[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  LOOKS[id] = { label: 'Studio 3D', bg: { type: 'gradient', angle: 180, stops: [{ pos: 0, color: sc.wall }, { pos: 1, color: sc.floor }] }, title: sc.ink, sub: sc.ink === '#ffffff' ? '#e6e9f2' : '#3a3f4a', accent: sc.ink, frame: '#111318' };
  LAYOUTS[id] = { label: sc.label, cat: 'studio', build: ({ T, S, shot, cx }) => [
    makeElement('image', { src: `builtin:scenes/${sc.id}.jpg`, x: BASE.w / 2, y: BASE.h / 2, w: SCENE_SIZE.w, h: SCENE_SIZE.h, radius: 0, name: 'Scene', locked: true }),
    T({ x: cx, y: 330 }), S({ x: cx, y: 600, w: 1040 }),
    shot({ x: mx, y: my, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), quad: sc.quad.map(([qx, qy]) => [qx - mx, qy - my]), quadRadius: sc.radius, shadow: false, locked: true, name: 'Screen' }),
  ] };
  DESIGNS[id] = { layout: id, look: id };
  TEMPLATES[id] = `${sc.label} · Studio 3D`;
  TEMPLATE_INFO[id] = { cat: 'studio', layout: id, look: id };
}
