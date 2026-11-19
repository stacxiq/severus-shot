// Local AI: talks to a small model running on this computer through any
// OpenAI-compatible server (Ollama, LM Studio, llama.cpp). Nothing here needs the cloud.
export const AI_DEFAULTS = { base: 'http://127.0.0.1:11434/v1', model: 'gemma3:1b' };

export const LANG_NAMES = {
  en: 'English', ar: 'Arabic', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish',
  fa: 'Persian', ku: 'Kurdish', ckb: 'Central Kurdish (Sorani)', ur: 'Urdu', he: 'Hebrew', hi: 'Hindi', id: 'Indonesian', ja: 'Japanese',
  ko: 'Korean', zh: 'Chinese (Simplified)', nl: 'Dutch', sv: 'Swedish', pl: 'Polish', uk: 'Ukrainian', vi: 'Vietnamese', th: 'Thai', ms: 'Malay',
};
export const langName = (code) => LANG_NAMES[String(code).toLowerCase()] || LANG_NAMES[String(code).toLowerCase().split('-')[0]] || String(code);

export function normalizeSettings(s = {}) {
  const base = String(s.base || AI_DEFAULTS.base).trim().replace(/\/+$/, '');
  // 'builtin' = the model the app downloads and runs itself; 'server' = the user's own Ollama / LM Studio.
  return { mode: s.mode === 'server' ? 'server' : 'builtin', base, model: String(s.model || AI_DEFAULTS.model).trim() };
}

// Small models like to wrap answers in quotes, labels or "thinking" blocks. Keep only the answer.
export function cleanReply(text) {
  let s = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^```[a-z]*\n?|```$/gi, '').trim();
  s = s.replace(/^(translation|ترجمة|الترجمة|output|answer)\s*[:：]\s*/i, '').trim();
  const pairs = [['"', '"'], ['“', '”'], ['«', '»'], ["'", "'"], ['`', '`']];
  for (const [a, b] of pairs) if (s.length > 1 && s.startsWith(a) && s.endsWith(b)) { s = s.slice(a.length, -b.length).trim(); break; }
  return s;
}

export function translateMessages(text, from, to) {
  return [
    { role: 'system', content: `You translate short captions for mobile app store screenshots from ${langName(from)} to ${langName(to)}. Keep it short, natural and persuasive, the way a native marketer would write it. Keep app and brand names unchanged. Keep the same line breaks. Reply with the translation only, with no quotes and no notes.` },
    { role: 'user', content: text },
  ];
}

export function suggestMessages(about, lang, count) {
  return [
    { role: 'system', content: `You write captions for mobile app store screenshots. Write ${count} different captions in ${langName(lang)}. Each caption is at most 6 words, benefit-led, with no emoji, no numbering and no quotes. Reply with one caption per line and nothing else.` },
    { role: 'user', content: about },
  ];
}

export function parseIdeas(text, count) {
  const seen = new Set();
  return cleanReply(text).split(/\n+/)
    .map((l) => cleanReply(l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')))
    .filter((l) => l && l.length <= 80 && !seen.has(l) && seen.add(l))
    .slice(0, count);
}

// `request(url, body, timeoutSeconds)` resolves to parsed JSON; the desktop app supplies it.
export class LocalAI {
  constructor(request, settings) {
    this.request = request;
    Object.assign(this, normalizeSettings(settings));
  }
  get origin() { return this.base.replace(/\/v1$/, ''); }
  async models() {
    const r = await this.request(`${this.base}/models`, null, 15);
    return (r.data || []).map((m) => m.id).filter(Boolean);
  }
  async chat(messages, { temperature = 0.2, maxTokens = 300, schema = null } = {}) {
    const body = { model: this.model, messages, temperature, max_tokens: maxTokens, stream: false };
    let r;
    if (schema) {
      // Ask the server to hold the answer to a JSON shape. Servers that do not support it get a plain request.
      try { r = await this.request(`${this.base}/chat/completions`, { ...body, response_format: { type: 'json_schema', json_schema: { name: 'reply', strict: true, schema } } }, 180); } catch (_) { r = null; }
    }
    if (!r || !r.choices) r = await this.request(`${this.base}/chat/completions`, body, 180);
    const text = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : '';
    if (!text) throw new Error(r && r.error ? `The model answered with an error: ${r.error.message || r.error}` : 'The model returned an empty answer');
    return text;
  }
  async translate(text, from, to) { return cleanReply(await this.chat(translateMessages(text, from, to))); }
  async suggest(about, lang, count = 4) {
    return parseIdeas(await this.chat(suggestMessages(about, lang, count), { temperature: 0.8 }), count);
  }
  // Ollama only: download the model. Other servers manage models themselves.
  async pull() {
    const r = await this.request(`${this.origin}/api/pull`, { model: this.model, stream: false }, 3600);
    if (r && r.error) throw new Error(r.error);
    return r;
  }
}

// Every caption that has text in `from` and still needs one in `to`.
export function captionsToTranslate(project, from, to, overwrite = false) {
  const out = [];
  project.slides.forEach((slide, i) => {
    for (const el of slide.elements) {
      const text = el.text && typeof el.text === 'object' ? el.text : null;
      if (!text) continue;
      const src = String(text[from] || '').trim();
      if (src && (overwrite || !String(text[to] || '').trim())) out.push({ slide: i + 1, id: el.id, el, text: src });
    }
  });
  return out;
}

export async function translateProject(studio, ai, { from, to, overwrite = false, onProgress } = {}) {
  const project = studio.project;
  from = String(from || project.languages[0]).trim();
  to = String(to || '').trim();
  if (!to) throw new Error('Choose a language to translate to');
  if (from === to) throw new Error('Pick two different languages');
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(to)) throw new Error(`"${to}" is not a language code (examples: ar, en, fr, pt-BR)`);
  const todo = captionsToTranslate(project, from, to, overwrite);
  const done = [];
  for (const item of todo) {
    done.push({ item, text: await ai.translate(item.text, from, to) });
    if (onProgress) onProgress(done.length, todo.length);
  }
  if (done.length || !project.languages.includes(to)) {
    await studio.mutate((p) => {
      if (!p.languages.includes(to)) p.languages.push(to);
      for (const { item, text } of done) if (text) item.el.text[to] = text;
    });
  }
  return { from, to, translated: done.length, captions: done.map(({ item, text }) => ({ slide: item.slide, id: item.id, from: item.text, to: text })) };
}

// ----- store listing text -----
const LISTING_ASKS = {
  subtitle: [30, 'a subtitle of at most 30 characters'],
  short: [80, 'a single-sentence short description of at most 80 characters'],
  promo: [170, 'one or two sentences of promotional text, at most 170 characters'],
  keywords: [100, 'ten search keywords separated by commas, with no space after the commas, at most 100 characters in total'],
  description: [4000, 'a store description: one opening sentence, then four short benefit lines each starting with "• ", then one closing sentence'],
};

// Cut text to a store limit without ending in the middle of a word (or keyword).
export function fitLimit(text, max, keywords = false) {
  let s = String(text || '').trim();
  if (keywords) {
    const kept = [];
    for (const k of s.split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean)) { if ([...kept, k].join(',').length > max) break; kept.push(k); }
    return kept.join(',');
  }
  if (s.length <= max) return s;
  s = s.slice(0, max);
  const cut = s.lastIndexOf(' ');
  return (cut > max * 0.6 ? s.slice(0, cut) : s).replace(/[\s,;:،-]+$/, '');
}

export async function draftListing(ai, about, lang, name = '') {
  const out = {};
  for (const [field, [max, ask]] of Object.entries(LISTING_ASKS)) {
    const text = await ai.chat([
      { role: 'system', content: `You write app store listing text in ${langName(lang)}. Write ${ask}. Be concrete and benefit-led, with no emoji and no hype words. Reply with the text only, with no quotes and no notes.` },
      { role: 'user', content: `${name ? `App name: ${name}\n` : ''}What the app does: ${about}` },
    ], { temperature: 0.6, maxTokens: field === 'description' ? 500 : 120 });
    out[field] = fitLimit(cleanReply(text), max, field === 'keywords');
  }
  return out;
}

export async function translateListing(ai, entry, from, to, fields) {
  const out = {};
  for (const f of fields) {
    const text = String((entry || {})[f.id] || '').trim();
    if (!text) continue;
    const reply = await ai.chat([
      { role: 'system', content: `You translate app store listing text from ${langName(from)} to ${langName(to)}. Keep the meaning, the line breaks and any "• " bullets. Keep the app and brand names unchanged. Stay within ${f.max} characters. Reply with the translation only, with no quotes and no notes.` },
      { role: 'user', content: text },
    ], { maxTokens: f.long ? 700 : 150 });
    out[f.id] = fitLimit(cleanReply(reply), f.max, f.id === 'keywords');
  }
  return out;
}

// ----- design assistant: the model answers with a short reply plus actions the app carries out -----
export const CHAT_LAYOUTS = ['hero', 'tilted', 'multi', 'stage', 'proof', 'text', 'floating', 'minimal'];
export const CHAT_BADGES = { rating: 'rating', award: 'laurel', pill: 'pill', check: 'check' };
const CHAT_DOS = ['set_title', 'set_subtitle', 'add_text', 'change_layout', 'change_colors', 'set_background', 'polish', 'add_badge', 'add_slide', 'translate'];
// Every action has its own shape, so a server that enforces the schema can only pick real layouts, looks and badges.
export function chatSchema(looks) {
  const one = (name, props = {}) => ({ type: 'object', properties: { do: { type: 'string', enum: [name] }, ...props }, required: ['do', ...Object.keys(props)] });
  const text = { type: 'string' };
  return {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      actions: {
        type: 'array',
        maxItems: 4,
        items: { anyOf: [
          one('set_title', { text }), one('set_subtitle', { text }), one('add_text', { text }),
          one('change_layout', { style: { type: 'string', enum: CHAT_LAYOUTS } }),
          one('change_colors', { style: { type: 'string', enum: looks } }),
          one('add_badge', { kind: { type: 'string', enum: Object.keys(CHAT_BADGES) } }),
          one('set_background', { color: { type: 'string' } }), one('polish'),
          one('add_slide'), one('translate', { lang: { type: 'string' } }),
        ] },
      },
    },
    required: ['reply', 'actions'],
  };
}
export const CHAT_SCHEMA = chatSchema(['noir', 'cream', 'aurora']);

export function chatSystem(ctx) {
  return `You are the design assistant inside Severus Shot, an app for making App Store screenshots. The user asks for a change to the current slide. You answer with JSON only: a short reply and a list of actions. The app carries the actions out.

Actions:
set_title: a new headline. At most 5 words. It must be different from the current headline.
set_subtitle: a new line under the headline. At most 12 words.
add_text: one more line of text.
change_layout: style is one of: ${CHAT_LAYOUTS.join(', ')}.
change_colors: a whole ready-made palette. style is one of: ${ctx.looks.join(', ')}.
set_background: one plain background colour. color is a colour name in English (blue, navy, red, green, yellow, orange, pink, purple, black, white, grey, teal, beige) or a hex code like #1e40af.
polish: tidies the slide: readable caption colours, a soft glow behind the device, shadow and reflection.
add_badge: kind is one of: rating, award, pill, check.
add_slide: adds a copy of this slide.
translate: lang is a language code such as ar, en or fr.
Only use the actions the user asked for. Never say you changed something unless you return the action for it. Use an empty list when the user only asks a question.

Examples:
User: make the headline shorter and add stars
{"reply":"Shorter headline and a star rating added.","actions":[{"do":"set_title","text":"Dinner in minutes"},{"do":"add_badge","kind":"rating"}]}
User: I want a dark look with the phone tilted
{"reply":"Switched to a dark look and a tilted phone.","actions":[{"do":"change_layout","style":"tilted"},{"do":"change_colors","style":"noir"}]}
User: change the background from yellow to blue
{"reply":"The background is blue now.","actions":[{"do":"set_background","color":"blue"}]}
User: polish it
{"reply":"Polished the slide.","actions":[{"do":"polish"}]}
User: translate to Arabic
{"reply":"Translating the captions into Arabic.","actions":[{"do":"translate","lang":"ar"}]}
User: is this headline good?
{"reply":"It is clear, but a number or a time would make it stronger.","actions":[]}

Write new captions and the reply in ${langName(ctx.lang)}. Never invent app features.
Project: "${ctx.project}". Slide ${ctx.slide} of ${ctx.slides}.
Current headline: "${ctx.title}"
Current subtitle: "${ctx.subtitle}"`;
}

// Models sometimes wrap the JSON in prose or a code fence; dig it out and keep only known actions.
export function parseChatReply(text) {
  const raw = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  let data = null;
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) { try { data = JSON.parse(raw.slice(start, end + 1)); } catch (_) { data = null; } }
  if (!data || typeof data !== 'object') return { reply: cleanReply(raw) || '…', actions: [] };
  const allowed = new Set(CHAT_DOS);
  const pick = (v) => (v === undefined || v === null ? undefined : String(v).toLowerCase().split(/[|,\s]+/).filter(Boolean)[0]);
  const actions = (Array.isArray(data.actions) ? data.actions : []).filter((a) => a && allowed.has(a.do)).slice(0, 4)
    .map((a) => ({ do: a.do, text: a.text === undefined ? undefined : cleanReply(String(a.text)).slice(0, 300), style: pick(a.style), kind: pick(a.kind), color: a.color === undefined ? undefined : String(a.color).toLowerCase().trim(), lang: a.lang && String(a.lang).trim() }));
  return { reply: cleanReply(String(data.reply || '')) || '…', actions };
}

export function chatContext(studio, M) {
  const texts = studio.slide.elements.filter((e) => e.type === 'text');
  const say = (el) => (el ? String((el.text || {})[studio.lang] || Object.values(el.text || {})[0] || '') : '');
  return { lang: studio.lang, project: studio.project.name, slide: studio.slideIndex + 1, slides: studio.project.slides.length, title: say(texts[0]), subtitle: say(texts[1]), looks: [...Object.keys(M.LOOKS), ...Object.keys(M.THEMES)] };
}

const COLOR_NAMES = { blue: '#2563eb', navy: '#0f1e4d', red: '#dc2626', green: '#16a34a', yellow: '#facc15', orange: '#f97316', pink: '#f472b6', purple: '#7c3aed', violet: '#7c3aed', black: '#0b0b0d', white: '#ffffff', grey: '#6b7280', gray: '#6b7280', teal: '#0d9488', beige: '#f3e7d3', cream: '#f6f0e4', brown: '#7c4a21', gold: '#d4a017', cyan: '#06b6d4', 'light blue': '#bfdbfe', 'dark blue': '#0f1e4d', 'pastel blue': '#bfdbfe', 'sky blue': '#7dd3fc', 'dark green': '#14532d', 'light green': '#bbf7d0' };
export function colorOf(value) {
  const v = String(value || '').toLowerCase().trim();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (COLOR_NAMES[v]) return COLOR_NAMES[v];
  const word = Object.keys(COLOR_NAMES).sort((a, b) => b.length - a.length).find((k) => v.includes(k));
  return word ? COLOR_NAMES[word] : null;
}

// Chat templates such as Gemma's reject two turns in a row from the same speaker.
export function alternating(history, keep = 6) {
  const out = [];
  for (const m of history) { if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = m; else out.push(m); }
  let tail = out.slice(-keep);
  while (tail.length && tail[0].role !== 'user') tail = tail.slice(1);
  return tail;
}

// Carry out the assistant's actions as one undo step. Returns what was done, in plain words.
export async function runChatActions(studio, M, actions, ai) {
  const done = [];
  let translateTo = null;
  if (actions.some((a) => a.do !== 'translate')) {
    // Layout and colours first, so new captions and badges land on the final design.
    const order = ['change_layout', 'change_colors', 'set_background', 'polish', 'set_title', 'set_subtitle', 'add_text', 'add_badge', 'add_slide'];
    const sorted = actions.filter((a) => a.do !== 'translate').sort((x, y) => order.indexOf(x.do) - order.indexOf(y.do));
    await studio.mutate((p) => {
      for (const a of sorted) {
        const slide = studio.slide, lang = studio.lang;
        const texts = slide.elements.filter((e) => e.type === 'text');
        const accent = (slide.elements.find((e) => e.type === 'shape' || (e.type === 'sticker' && e.kind !== 'rating')) || {}).fill || '#7c6cff';
        const same = (el) => el && String((el.text || {})[lang] || '').trim() === String(a.text || '').trim();
        if ((a.do === 'set_title' && same(texts[0])) || (a.do === 'set_subtitle' && same(texts[1]))) continue; // the model repeated what is already there
        if (a.do === 'set_title' && a.text) {
          if (texts[0]) texts[0].text[lang] = a.text; else slide.elements.push(M.makeElement('text', { text: { [lang]: a.text }, x: M.BASE.w / 2, y: 330, fontSize: 132, fontWeight: 800, name: 'Title' }));
          done.push(`Headline: “${a.text}”`);
        } else if ((a.do === 'set_subtitle' || a.do === 'add_text') && a.text) {
          const target = a.do === 'set_subtitle' ? texts[1] : null;
          if (target) target.text[lang] = a.text;
          else slide.elements.push(M.makeElement('text', { text: { [lang]: a.text }, x: M.BASE.w / 2, y: a.do === 'set_subtitle' ? 600 : 2560, w: 1040, fontSize: 60, fontWeight: 500, lineHeight: 1.25, color: (texts[1] || texts[0] || {}).color || '#ffffff', name: a.do === 'set_subtitle' ? 'Subtitle' : 'Text' }));
          done.push(`${a.do === 'set_subtitle' ? 'Subtitle' : 'Added text'}: “${a.text}”`);
        } else if (a.do === 'change_layout') {
          const cat = CHAT_LAYOUTS.includes(a.style) ? a.style : 'hero';
          const ids = Object.keys(M.DESIGNS).filter((id) => M.TEMPLATE_INFO[id].cat === cat);
          const id = ids[Math.floor(Math.random() * ids.length)];
          M.applyTemplate(slide, id);
          done.push(`Layout: ${M.TEMPLATES[id]}`);
        } else if (a.do === 'change_colors') {
          const pal = M.LOOKS[a.style] || M.THEMES[a.style];
          if (pal) { M.applyPalette(slide, pal); done.push(`Colours: ${pal.label}`); }
        } else if (a.do === 'set_background') {
          const hex = colorOf(a.color);
          if (hex) {
            slide.background = M.makeBackground({ type: 'solid', color: hex });
            const ink = M.inkOn(hex);
            texts.forEach((e, i) => { e.color = i === 0 ? ink : (ink === '#ffffff' ? '#dfe5f2' : '#3d4350'); });
            done.push(`Background: ${a.color}`);
          }
        } else if (a.do === 'polish') {
          const bg = slide.background;
          const base = bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.stops[Math.floor(bg.stops.length / 2)].color : null;
          if (base) { const ink = M.inkOn(base); texts.forEach((e, i) => { e.color = i === 0 ? ink : (ink === '#ffffff' ? '#dfe5f2' : '#3d4350'); }); }
          const shots = slide.elements.filter((e) => e.type === 'screenshot');
          shots.forEach((e) => { e.shadow = true; e.glare = true; });
          if (shots[0] && !slide.elements.some((e) => e.type === 'shape')) slide.elements.unshift(M.makeElement('shape', { shape: 'glow', fill: accent, x: shots[0].x, y: shots[0].y, w: 1900, h: 1900, opacity: 0.45, name: 'Glow' }));
          done.push('Polished: readable captions, glow, shadow and reflection');
        } else if (a.do === 'add_badge') {
          const kind = CHAT_BADGES[a.kind] || 'pill';
          const spot = { rating: { y: 200 }, laurel: { y: 380, w: 560, h: 420 }, pill: { y: 200, w: 360 }, check: { y: 1040, w: 760, h: 110 } }[kind];
          // A badge above the headline needs room: move the captions at the top down a little.
          if ((kind === 'rating' || kind === 'pill') && texts[0] && texts[0].y < 700) for (const e of texts) if (e.y < 1100) e.y += 170;
          slide.elements.push(M.makeElement('sticker', { kind, x: M.BASE.w / 2, ...spot, ...(a.text ? { text: a.text } : {}), fill: kind === 'rating' ? '#ffc83d' : accent, color: kind === 'pill' ? M.inkOn(accent) : (texts[0] || {}).color || '#ffffff' }));
          done.push(`Added a ${a.kind || 'pill'} badge`);
        } else if (a.do === 'add_slide') {
          const copy = M.clone(slide);
          copy.id = M.uid('s');
          copy.elements.forEach((e) => { e.id = M.uid(); });
          p.slides.splice(studio.slideIndex + 1, 0, copy);
          studio.slideIndex += 1;
          done.push('Added a slide');
        }
      }
      studio.selectedId = null;
    });
  }
  for (const a of actions) if (a.do === 'translate' && a.lang) translateTo = a.lang;
  if (translateTo) {
    const r = await translateProject(studio, ai, { from: studio.lang, to: translateTo });
    studio.lang = r.to;
    studio.emit('project');
    done.push(`Translated ${r.translated} caption(s) into ${langName(r.to)}`);
  }
  return done;
}
