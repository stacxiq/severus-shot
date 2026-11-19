import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../ui/js/model.js';
import { Studio } from '../ui/js/core.js';
import { createRpcHandler } from '../ui/js/agent.js';

// The Studio loads images and fonts through the web view; tests replace that with no-ops.
class TestStudio extends Studio {
  async ensureAssets() {}
  async preview() { return { mime: 'image/jpeg', b64: 'AAAA', width: 10, height: 20 }; }
}
const rpc = (handle, method, params, id = 1) => handle({ jsonrpc: '2.0', id, method, params });
const call = async (handle, name, args = {}) => {
  const r = await rpc(handle, 'tools/call', { name, arguments: args });
  const text = r.result.content.find((c) => c.type === 'text').text;
  return { isError: !!r.result.isError, text, data: r.result.isError ? null : safeParse(text), content: r.result.content };
};
const safeParse = (t) => { try { return JSON.parse(t); } catch { return t; } };

test('new project is valid and survives sanitizing', () => {
  const p = M.newProject('Demo');
  const again = M.sanitizeProject(JSON.parse(JSON.stringify(p)));
  assert.equal(again.slides.length, 1);
  assert.deepEqual(again.slides[0].elements.map((e) => e.type), ['text', 'text', 'screenshot']);
});

test('sanitizeProject rejects junk and repairs bad values', () => {
  assert.throws(() => M.sanitizeProject({ nope: true }), /Not a Severus Shot project/);
  const p = M.sanitizeProject({ slides: [{ background: { type: 'weird' }, elements: [{ type: 'text', fontSize: 'x', color: 'javascript:alert(1)' }, { type: 'bogus' }] }] });
  const el = p.slides[0].elements[0];
  assert.equal(p.slides[0].elements.length, 1);
  assert.equal(p.slides[0].background.type, 'solid');
  assert.equal(el.fontSize, 120);
  assert.equal(el.color, '#ffffff');
});

test('resolveSize handles ids, custom sizes and bad input', () => {
  assert.equal(M.resolveSize('ipad-13').w, 2064);
  assert.deepEqual([M.resolveSize('1242x2688').w, M.resolveSize('1242x2688').h], [1242, 2688]);
  assert.equal(M.resolveSize('2048x2732').device, 'tablet');
  assert.throws(() => M.resolveSize('huge'), /Unknown size/);
  assert.throws(() => M.resolveSize('10x99999'), /out of range/);
});

test('right-to-left detection', () => {
  assert.ok(M.isRtlText('مرحبا بالعالم'));
  assert.ok(!M.isRtlText('Hello'));
  assert.ok(M.isRtlLang('ar-IQ') && M.isRtlLang('ckb') && !M.isRtlLang('en'));
});

test('gradient background accepts a plain colour list', () => {
  const bg = M.makeBackground({ type: 'gradient', colors: ['#ff0000', '#00ff00', '#0000ff'], angle: 90 });
  assert.deepEqual(bg.stops.map((s) => s.pos), [0, 0.5, 1]);
});

test('applyTemplate keeps captions and screenshots', () => {
  const s = M.makeSlide('caption-top', 'ocean');
  s.elements[0].text = { en: 'Keep me', ar: 'احتفظ بي' };
  s.elements[2].src = '/tmp/a.png';
  M.applyTemplate(s, 'tilted', 'grape');
  assert.deepEqual(s.elements.find((e) => e.type === 'text').text, { en: 'Keep me', ar: 'احتفظ بي' });
  assert.equal(s.elements.find((e) => e.type === 'screenshot').src, '/tmp/a.png');
});

test('MCP handshake and tool list', async () => {
  const handle = createRpcHandler(new TestStudio(), { version: '9.9.9' });
  const init = await rpc(handle, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  assert.equal(init.result.protocolVersion, '2025-03-26');
  assert.equal(init.result.serverInfo.name, 'severus-shot');
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const list = await rpc(handle, 'tools/list');
  const names = list.result.tools.map((t) => t.name);
  for (const n of ['get_project', 'add_text', 'add_screenshot', 'set_background', 'set_font', 'load_font', 'render_preview', 'export']) assert.ok(names.includes(n), n);
  for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object');
  const unknown = await rpc(handle, 'nope/nope');
  assert.equal(unknown.error.code, -32601);
});

test('agent edits: slides, background, text, fonts, languages, undo', async () => {
  const studio = new TestStudio();
  const handle = createRpcHandler(studio);
  await call(handle, 'new_project', { name: 'Agent demo', template: 'hero-text', theme: 'paper', languages: ['en', 'ar'] });
  assert.equal(studio.project.languages.length, 2);

  let r = await call(handle, 'add_slide', { template: 'duo', theme: 'ocean' });
  assert.equal(r.data.slide, 2);
  r = await call(handle, 'set_background', { slide: 2, type: 'gradient', colors: ['#111111', '#222222'], angle: 45 });
  assert.equal(studio.project.slides[1].background.angle, 45);
  r = await call(handle, 'set_background', { slide: 1, type: 'solid', color: '#ff8800' });
  assert.equal(studio.project.slides[0].background.color, '#ff8800');

  r = await call(handle, 'add_text', { slide: 1, text: 'Hello', fontFamily: 'Georgia', fontSize: 90, color: '#123456', name: 'tagline' });
  const id = r.data.added.id;
  r = await call(handle, 'set_text', { slide: 1, id, lang: 'ar', text: 'مرحبا' });
  assert.deepEqual(r.data.text, { en: 'Hello', ar: 'مرحبا' });
  r = await call(handle, 'update_element', { slide: 1, id: 'tagline', x: 100, rotation: 12, fontWeight: 300 });
  assert.deepEqual([r.data.element.x, r.data.element.rotation, r.data.element.fontWeight], [100, 12, 300]);
  assert.deepEqual(r.data.element.text, { en: 'Hello', ar: 'مرحبا' }, 'unrelated fields are untouched');

  r = await call(handle, 'set_font', { fontFamily: 'Noto Naskh Arabic', all: true });
  assert.ok(r.data.updated >= 5);
  assert.ok(studio.project.slides.every((s) => s.elements.filter((e) => e.type === 'text').every((e) => e.fontFamily === 'Noto Naskh Arabic')));

  r = await call(handle, 'reorder_element', { slide: 1, id, to: 'back' });
  assert.equal(r.data.order[0], id);
  r = await call(handle, 'delete_element', { slide: 1, id });
  assert.ok(!studio.project.slides[0].elements.some((e) => e.id === id));
  await studio.undo();
  assert.ok(studio.project.slides[0].elements.some((e) => e.id === id), 'undo restores the element');

  r = await call(handle, 'duplicate_slide', { slide: 1 });
  assert.equal(studio.project.slides.length, 3);
  r = await call(handle, 'delete_slide', { slide: 3 });
  assert.equal(r.data.slides, 2);
});

test('agent errors are reported, not thrown', async () => {
  const handle = createRpcHandler(new TestStudio());
  let r = await call(handle, 'update_element', { id: 'missing', x: 1 });
  assert.ok(r.isError && /No element "missing"/.test(r.text));
  r = await call(handle, 'add_slide', { template: 'does-not-exist' });
  assert.ok(r.isError && /Unknown template/.test(r.text));
  r = await call(handle, 'select_slide', { slide: 99 });
  assert.ok(r.isError && /No slide 99/.test(r.text));
  r = await call(handle, 'delete_slide', {});
  assert.ok(r.isError && /only slide/.test(r.text));
  r = await call(handle, 'no_such_tool', {});
  assert.ok(r.isError);
});

test('render_preview returns an image block', async () => {
  const handle = createRpcHandler(new TestStudio());
  const r = await call(handle, 'render_preview', { slide: 1 });
  assert.equal(r.content[0].type, 'image');
  assert.equal(r.content[0].mimeType, 'image/jpeg');
});

test('every template builds in every theme', () => {
  for (const tpl of Object.keys(M.TEMPLATES)) for (const th of Object.keys(M.THEMES)) {
    const slide = M.makeSlide(tpl, th);
    assert.ok(slide.elements.length > 0, `${tpl}/${th}`);
    assert.ok(M.sanitizeProject({ slides: [JSON.parse(JSON.stringify(slide))] }).slides[0].elements.length === slide.elements.length);
  }
  assert.ok(Object.keys(M.TEMPLATES).length >= 20);
});

test('stickers and motion through the agent tools', async () => {
  const studio = new TestStudio();
  const handle = createRpcHandler(studio);
  let r = await call(handle, 'add_sticker', { kind: 'rating', text: '4.8', x: 660, y: 200 });
  assert.equal(r.data.added.kind, 'rating');
  r = await call(handle, 'update_element', { id: r.data.added.id, kind: 'pill' });
  assert.deepEqual([r.data.element.kind, r.data.element.w, r.data.element.text], ['pill', 460, 'New feature']);
  r = await call(handle, 'set_motion', { preset: 'pop', transition: 'push', seconds: 99, fps: 25 });
  assert.deepEqual([r.data.motion.preset, r.data.motion.transition, r.data.motion.seconds, r.data.motion.fps], ['pop', 'push', 15, 30]);
  r = await call(handle, 'set_motion', { preset: 'pan-side' });
  assert.deepEqual([r.data.motion.transition, r.data.motion.camera], ['push', 'pan-left'], 'a template brings its transition and camera');
  r = await call(handle, 'set_motion', { preset: 'party', transition: 'wipe' });
  assert.deepEqual([r.data.motion.transition, r.data.motion.float], ['wipe', true], 'explicit values win over the template defaults');
  r = await call(handle, 'set_motion', { music: 'lofi', musicVolume: 0.4, float: true });
  assert.deepEqual(r.data.motion.music, { type: 'builtin', id: 'lofi', path: '', volume: 0.4 });
  assert.equal(r.data.motion.float, true);
  r = await call(handle, 'set_motion', { music: '/tmp/song.mp3' });
  assert.deepEqual([r.data.motion.music.type, r.data.motion.music.path, r.data.motion.music.volume], ['file', '/tmp/song.mp3', 0.4]);
  r = await call(handle, 'add_icon', { icon: 'shopping-cart', bg: 'circle' });
  assert.deepEqual([r.data.added.type, r.data.added.icon, r.data.added.bg], ['icon', 'shopping-cart', 'circle']);
  r = await call(handle, 'export_video', { path: '/tmp/x.mp4' });
  assert.ok(r.isError && /ffmpeg/.test(r.text), 'reports the missing encoder instead of failing silently');
  r = await call(handle, 'list_projects', {});
  assert.deepEqual(r.data.projects, []);
});

test('Google Fonts stylesheet parsing keeps Latin and Arabic files only', () => {
  const css = `/* cyrillic */\n@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 200 1000; src: url(https://fonts.gstatic.com/s/cairo/v1/a.woff2) format('woff2'); unicode-range: U+0400-045F; }\n/* arabic */\n@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 200 1000; src: url(https://fonts.gstatic.com/s/cairo/v1/b.woff2) format('woff2'); unicode-range: U+0600-06FF; }\n/* latin */\n@font-face { font-family: 'Cairo'; font-style: italic; font-weight: 400; src: url(https://fonts.gstatic.com/s/cairo/v1/i.woff2) format('woff2'); unicode-range: U+0000-00FF; }\n/* latin */\n@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 700; src: url(https://evil.example/x.woff2) format('woff2'); }\n/* latin */\n@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 700; src: url(https://fonts.gstatic.com/s/cairo/v1/c.woff2) format('woff2'); unicode-range: U+0000-00FF; }`;
  const files = M.parseGoogleCss(css);
  assert.deepEqual(files.map((f) => [f.label, f.url.split('/').pop(), f.weight]), [['arabic', 'b.woff2', '200 1000'], ['latin', 'c.woff2', '700']]);
});

test('at least 40 motion templates, all with labels and categories', () => {
  assert.ok(M.MOTION_TABLE.length >= 40);
  assert.equal(new Set(M.MOTION_TABLE.map((r) => r[0])).size, M.MOTION_TABLE.length, 'ids are unique');
  for (const [id, label, cat] of M.MOTION_TABLE) { assert.ok(label && M.MOTION_CATS[cat], id); assert.equal(M.applyMotionTemplate(M.makeMotion(), id).preset, id); }
  assert.throws(() => M.applyMotionTemplate(M.makeMotion(), 'nope'), /Unknown motion template/);
});

// ----- 0.5: fastlane layout and local AI helpers -----
import { LocalAI, cleanReply, parseIdeas, translateProject, captionsToTranslate } from '../ui/js/ai.js';

test('fastlane paths match what deliver and supply read', () => {
  const size = (id) => M.resolveSize(id);
  assert.deepEqual(M.fastlanePath(size('iphone-6.9'), 'en', 1), ['fastlane', 'screenshots', 'en-US', '01_iphone-6.9.png']);
  assert.deepEqual(M.fastlanePath(size('ipad-13'), 'ar', 3, 'jpg'), ['fastlane', 'screenshots', 'ar-SA', '03_ipad-13.jpg']);
  assert.deepEqual(M.fastlanePath(size('android-phone'), 'ar', 2), ['fastlane', 'metadata', 'android', 'ar', 'images', 'phoneScreenshots', '02.png']);
  assert.deepEqual(M.fastlanePath(size('android-tablet-10'), 'en', 1).slice(-2), ['tenInchScreenshots', '01.png']);
  assert.equal(M.fastlanePath(size('800x600'), 'en', 1), null);
  assert.equal(M.storeLocale('pt-BR', 'ios'), 'pt-BR');
});

test('model replies are cleaned up', () => {
  assert.equal(cleanReply('<think>hmm</think>\n"مرحبا بالعالم"'), 'مرحبا بالعالم');
  assert.equal(cleanReply('Translation: Hello'), 'Hello');
  assert.deepEqual(parseIdeas('1. Track every order\n- Pay in one tap\n\n"Track every order"\n* Fast delivery', 3), ['Track every order', 'Pay in one tap', 'Fast delivery']);
});

test('translate_captions fills the target language through the local model', async () => {
  const studio = new TestStudio();
  const first = studio.project.slides[0].elements.find((e) => e.type === 'text');
  first.text = { en: 'Order in seconds' };
  const calls = [];
  const request = async (url, body) => {
    calls.push({ url, body });
    return { choices: [{ message: { content: `"AR:${body.messages[1].content}"` } }] };
  };
  const ai = new LocalAI(request, { base: 'http://127.0.0.1:11434/v1/', model: 'gemma3:1b' });
  const todo = captionsToTranslate(studio.project, 'en', 'ar');
  assert.ok(todo.length >= 1);
  const r = await translateProject(studio, ai, { from: 'en', to: 'ar' });
  assert.equal(r.translated, todo.length);
  assert.equal(first.text.ar, 'AR:Order in seconds');
  assert.ok(studio.project.languages.includes('ar'));
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(calls[0].body.model, 'gemma3:1b');
  // A second run has nothing left to do unless overwrite is set.
  assert.equal((await translateProject(studio, ai, { from: 'en', to: 'ar' })).translated, 0);
  await assert.rejects(() => translateProject(studio, ai, { from: 'en', to: 'en' }));
  await assert.rejects(() => translateProject(studio, ai, { from: 'en', to: 'not a code' }));
});

test('the new agent tools are listed', async () => {
  const handle = createRpcHandler(new TestStudio(), {});
  const r = await rpc(handle, 'tools/list', {});
  const names = r.result.tools.map((x) => x.name);
  for (const n of ['list_devices', 'capture_device', 'install_ffmpeg', 'setup_local_ai', 'translate_captions']) assert.ok(names.includes(n), n);
  assert.deepEqual(r.result.tools.find((x) => x.name === 'export').inputSchema.properties.layout.enum, ['folders', 'fastlane']);
});

// ----- 0.6: store listing text -----
import { fitLimit, draftListing, translateListing } from '../ui/js/ai.js';

test('listing text is sanitized, limited and written as fastlane files', async () => {
  const p = M.sanitizeProject({ ...M.newProject('Shop'), languages: ['en', 'ar'], listing: { en: { name: 'x'.repeat(50), subtitle: 'Fast delivery', bogus: 'no', description: 'Long text' }, ar: { name: 'متجر' }, zz: 'bad' } });
  assert.equal(p.listing.en.name.length, 30);
  assert.equal(p.listing.en.bogus, undefined);
  assert.equal(p.listing.zz, undefined);
  const files = M.listingFiles(p, ['en', 'ar']).map((f) => f.parts.join('/'));
  for (const f of ['fastlane/metadata/en-US/name.txt', 'fastlane/metadata/en-US/subtitle.txt', 'fastlane/metadata/android/en-US/title.txt', 'fastlane/metadata/android/en-US/full_description.txt', 'fastlane/metadata/ar-SA/name.txt', 'fastlane/metadata/android/ar/title.txt']) assert.ok(files.includes(f), f);
  assert.ok(!files.some((f) => f.includes('android') && f.endsWith('subtitle.txt')));
  assert.equal(fitLimit('one,two , three,four', 9, true), 'one,two');
  assert.ok(fitLimit('Order food from every restaurant near you', 30).length <= 30);

  const handle = createRpcHandler(new TestStudio(), {});
  const ok = await call(handle, 'set_listing', { lang: 'en', name: 'Shop', keywords: 'food,delivery' });
  assert.equal(ok.data.listing.name, 'Shop');
  assert.ok((await call(handle, 'set_listing', { lang: 'en', subtitle: 'y'.repeat(31) })).isError);
  assert.equal((await call(handle, 'get_project')).data.listing.en.keywords, 'food,delivery');

  const ai = { chat: async (m) => (m[0].content.includes('translate') ? `"T:${m[1].content}"` : 'A very long generated answer that goes on and on past any short limit there is') };
  const d = await draftListing(ai, 'food delivery', 'en', 'Shop');
  assert.ok(d.subtitle.length <= 30 && d.short.length <= 80 && d.description.length > 0);
  const tr = await translateListing(ai, { name: 'Shop', subtitle: 'Fast' }, 'en', 'ar', M.LISTING_FIELDS);
  assert.deepEqual(tr, { name: 'T:Shop', subtitle: 'T:Fast' });
});

// ----- design library -----
test('the design library has 150+ templates that all build cleanly', () => {
  const ids = Object.keys(M.TEMPLATES), designs = Object.keys(M.DESIGNS);
  assert.ok(designs.length >= 150, `only ${designs.length} designs`);
  assert.equal(new Set(ids).size, ids.length);
  const seen = new Set();
  for (const id of designs) {
    const slide = M.makeSlide(id);
    assert.ok(slide.elements.length >= 2, id);
    const look = M.LOOKS[M.DESIGNS[id].look];
    assert.deepEqual(slide.background, M.makeBackground(look.bg), id);
    for (const e of slide.elements) {
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y) && e.w > 0 && e.h > 0, `${id} ${e.type}`);
      if (e.type === 'shape') assert.ok(M.SHAPES.includes(e.shape), `${id} shape ${e.shape}`);
      if (e.type === 'sticker') assert.ok(M.STICKERS.includes(e.kind), `${id} sticker ${e.kind}`);
      if (e.type === 'screenshot') assert.ok(M.FRAMES.includes(e.frame), `${id} frame ${e.frame}`);
    }
    const again = M.sanitizeProject({ ...M.newProject('x'), slides: [slide] });
    assert.equal(again.slides[0].elements.length, slide.elements.length, id);
    seen.add(JSON.stringify(slide.elements.map((e) => [e.type, e.x, e.y, e.w, e.rotation, e.fill, e.color])) + JSON.stringify(slide.background));
    assert.ok(M.TEMPLATE_CATEGORIES[M.TEMPLATE_INFO[id].cat], id);
  }
  assert.equal(seen.size, designs.length, 'every design should look different');
  // A theme the user picks recolours a design; captions and screenshots carry over.
  const s = M.makeSlide(Object.keys(M.DESIGNS).find((id) => id.startsWith('halo--')));
  s.elements.find((e) => e.type === 'text').text = { en: 'Mine' };
  s.elements.find((e) => e.type === 'screenshot').src = '/a.png';
  const tl = Object.keys(M.DESIGNS).find((id) => id.startsWith('tilt-left--'));
  M.applyTemplate(s, tl, 'ocean');
  assert.ok(s.elements.some((e) => e.type === 'screenshot' && e.rotation === -12));
  assert.deepEqual(s.background, M.makeBackground(M.THEMES.ocean.bg));
  assert.equal(s.elements.find((e) => e.type === 'text').text.en, 'Mine');
  assert.equal(s.elements.find((e) => e.type === 'screenshot').src, '/a.png');
  assert.equal(M.inkOn('#c6f432'), '#141414');
  assert.equal(M.inkOn('#18181b'), '#ffffff');
});

// ----- design assistant -----
import { parseChatReply, runChatActions, chatContext, chatSystem } from '../ui/js/ai.js';

test('the design assistant parses replies and carries out actions', async () => {
  const messy = 'Sure!\n```json\n{"reply":"Done.","actions":[{"do":"set_title","text":"\\"Order in seconds\\""},{"do":"format_disk"},{"do":"change_colors","style":"Noir"},{"do":"add_badge","kind":"rating"},{"do":"change_layout","style":"tilted"}]}\n```';
  const { reply, actions } = parseChatReply(messy);
  assert.equal(reply, 'Done.');
  assert.deepEqual(actions.map((a) => a.do), ['set_title', 'change_colors', 'add_badge', 'change_layout']);
  assert.equal(actions[0].text, 'Order in seconds');
  assert.deepEqual(parseChatReply('just words').actions, []);

  const studio = new TestStudio();
  const before = studio.slide.elements.length;
  const done = await runChatActions(studio, M, actions.slice(0, 3), null);
  assert.equal(done.length, 3);
  assert.equal(studio.slide.elements.find((e) => e.type === 'text').text.en, 'Order in seconds');
  assert.deepEqual(studio.slide.background, M.makeBackground(M.LOOKS.noir.bg));
  assert.equal(studio.slide.elements.length, before + 1);
  assert.ok(studio.slide.elements.some((e) => e.type === 'sticker' && e.kind === 'rating'));
  await runChatActions(studio, M, [{ do: 'change_layout', style: 'tilted' }, { do: 'add_slide' }], null);
  assert.equal(studio.project.slides.length, 2);
  assert.equal(studio.slide.elements.find((e) => e.type === 'text').text.en, 'Order in seconds');
  const sys = chatSystem(chatContext(studio, M));
  assert.ok(sys.includes('Order in seconds') && sys.includes('noir') && sys.includes('Slide 2 of 2'));
  // Small models echo the menu of choices or the current caption; both are handled.
  assert.equal(parseChatReply('{"reply":"ok","actions":[{"do":"change_layout","style":"hero|tilted|stage"}]}').actions[0].style, 'hero');
  const title = studio.slide.elements.find((e) => e.type === 'text').text.en;
  assert.deepEqual(await runChatActions(studio, M, [{ do: 'set_title', text: title }], null), []);
});
