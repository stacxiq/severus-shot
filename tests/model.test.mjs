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
