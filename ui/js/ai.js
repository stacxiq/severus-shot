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
  async chat(messages, { temperature = 0.2, maxTokens = 300 } = {}) {
    const r = await this.request(`${this.base}/chat/completions`, { model: this.model, messages, temperature, max_tokens: maxTokens, stream: false }, 180);
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
