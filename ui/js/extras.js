// Integrations around the editor: device capture, local AI, ffmpeg download and the update check.
import * as M from './model.js';
import { bridge, isTauri } from './bridge.js';
import { t, localize } from './i18n.js';
import { icon } from './icons.js';
import { AI_DEFAULTS, LANG_NAMES, LocalAI, langName, normalizeSettings, translateProject, draftListing, translateListing } from './ai.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const AI_KEY = 'severus.ai';

export function aiSettings() {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(AI_KEY) || '{}')); } catch (_) { return normalizeSettings(); }
}
function saveAiSettings(s) {
  const clean = normalizeSettings(s);
  try { localStorage.setItem(AI_KEY, JSON.stringify(clean)); } catch (_) { /* private mode: keep going */ }
  return clean;
}

// The model client to use right now: the built-in model (started on demand) or the user's own server.
export async function aiClient(settings = aiSettings()) {
  if (settings.mode === 'server') return new LocalAI(bridge.aiRequest, settings);
  const st = await bridge.aiLocalStatus();
  if (!st.engine || !st.model) {
    const err = new Error('The built-in AI is not set up yet. Open AI (Ctrl+J) in the app and press "Set up" once.');
    err.code = 'setup';
    throw err;
  }
  const run = st.running ? st : await bridge.aiLocalStart();
  return new LocalAI(bridge.aiRequest, { base: run.base, model: run.modelName });
}

// Take a screenshot from a device and place it on the current slide. Returns the saved file path.
export async function captureInto(studio, device, addScreenshots) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const path = `${studio.dataDir}/Captures/${device.kind}-${stamp}.png`;
  await bridge.captureScreenshot(device.kind, device.id, path);
  if (addScreenshots) await addScreenshots([path]);
  else {
    const slide = studio.slide;
    const empty = slide.elements.find((e) => e.type === 'screenshot' && !e.src);
    let target = empty;
    await studio.mutate(() => {
      if (target) target.src = path;
      else { target = M.makeElement('screenshot', { src: path, x: M.BASE.w / 2, y: 1750, w: 900 }); slide.elements.push(target); }
    });
    await studio.mutate(() => studio.fitToImage(target), { history: false });
  }
  return path;
}

export function initExtras({ studio, toast, guard, addScreenshots }) {
  const show = (id) => { const d = $(id); localize(d); if (!d.open) d.showModal(); };

  /* ---------- capture ---------- */
  let devices = [];
  async function drawCapture() {
    const status = $('#capStatus');
    status.textContent = t('Looking for devices…');
    const r = await bridge.captureDevices();
    devices = r.devices;
    $('#capList').innerHTML = devices.map((d, i) => `<div class="capItem">${icon('phone')}<div><b>${esc(d.name)}</b><small>${esc(d.kind === 'ios' ? `iOS simulator · ${d.detail}` : d.detail)}</small></div><div class="two"><button type="button" data-series="${i}" title="${esc(t('Makes a new slide every time the screen on the device changes'))}">${esc(t('Series'))}</button><button type="button" class="primary" data-cap="${i}">${esc(t('Capture'))}</button></div></div>`).join('')
      || `<div class="capEmpty">${esc(t('No running simulator or connected Android device was found.'))}</div>`;
    const hints = [];
    if (!r.simulators) hints.push(t('iOS simulators are only available on a Mac.'));
    if (!r.adb) hints.push(t('Android capture needs adb (Android platform-tools).'));
    status.textContent = devices.length ? '' : [t('Start a simulator or plug in a phone with USB debugging on, then press Refresh.'), ...hints].join('\n');
  }
  $('#capList').addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-cap]');
    if (!b) return;
    const device = devices[+b.dataset.cap];
    b.disabled = true;
    $('#capStatus').textContent = t('Capturing {0}…', device.name);
    try {
      await captureInto(studio, device, addScreenshots);
      $('#capStatus').textContent = t('Added to slide {0}. Change the screen on the device and capture again for the next slide.', studio.slideIndex + 1);
    } finally { b.disabled = false; }
  }));

  // A series watches the device and adds a slide each time a new, settled screen appears.
  let series = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function signature(path) {
    const img = new Image();
    img.src = `data:image/png;base64,${await bridge.readFileB64(path)}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 24, height: 48 });
    const ctx = c.getContext('2d', { willReadFrequently: true });
    // Skip the top strip, so the clock in the status bar does not count as a new screen.
    ctx.drawImage(img, 0, img.naturalHeight * 0.07, img.naturalWidth, img.naturalHeight * 0.93, 0, 0, 24, 48);
    const d = ctx.getImageData(0, 0, 24, 48).data, out = new Uint8Array(24 * 48);
    for (let i = 0; i < out.length; i += 1) out[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
    return out;
  }
  const distance = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]); return sum / a.length; };
  async function runSeries(device) {
    const state = { stop: false, count: 0 };
    series = state;
    $('#capStop').hidden = false;
    const tmp = `${studio.dataDir}/Captures/series-check.png`;
    let prev = null, last = null;
    try {
      while (!state.stop) {
        await bridge.captureScreenshot(device.kind, device.id, tmp);
        const sig = await signature(tmp);
        const settled = prev && distance(sig, prev) < 1.5, fresh = !last || distance(sig, last) > 5;
        if (settled && fresh && !state.stop) {
          const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
          const path = `${studio.dataDir}/Captures/${device.kind}-${stamp}-${state.count + 1}.png`;
          await bridge.captureScreenshot(device.kind, device.id, path);
          await studio.addCaptureSlide(path, state.count > 0);
          last = sig;
          state.count += 1;
        }
        prev = sig;
        $('#capStatus').textContent = t('Series running: {0} screen(s) captured. Move through your app; each new screen becomes a slide.', state.count);
        await sleep(700);
      }
    } finally {
      if (series === state) series = null;
      $('#capStop').hidden = true;
      $('#capStatus').textContent = t('Series finished: {0} slide(s) added.', state.count);
    }
  }
  $('#capList').addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-series]');
    if (!b || series) return;
    await runSeries(devices[+b.dataset.series]);
  }));
  $('#captureDlg').addEventListener('close', () => { if (series) series.stop = true; });

  /* ---------- online icons (Iconify) ---------- */
  const iconColor = () => { const el = studio.slide.elements.find((x) => x.type === 'text'); return (el && /^#[0-9a-f]{6}$/i.test(el.color || '') ? el.color : '#ffffff'); };
  async function searchIconify() {
    const q = $('#icofySearch').value.trim();
    if (q.length < 2) { $('#icofyGrid').innerHTML = ''; return; }
    $('#icofyNote').textContent = t('Searching…');
    try {
      const r = JSON.parse(await bridge.iconifyGet(`search?query=${encodeURIComponent(q)}&limit=96`));
      const names = (r.icons || []).filter((n) => /^[a-z0-9-]+:[a-z0-9-]+$/.test(n));
      $('#icofyGrid').innerHTML = names.map((n) => `<button type="button" data-icofy="${n}" title="${n}"><img loading="lazy" alt="" src="https://api.iconify.design/${n.replace(':', '/')}.svg?color=%23e8eaf0&height=22"></button>`).join('');
      $('#icofyNote').textContent = names.length ? t('{0} result(s). Click one to add it to the slide.', names.length) : t('No icon matches that search.');
    } catch (err) { $('#icofyNote').textContent = String(err && err.message ? err.message : err); }
  }
  $('#icofySearch').addEventListener('input', () => { clearTimeout(searchIconify.timer); searchIconify.timer = setTimeout(searchIconify, 350); });
  $('#icofyGrid').addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-icofy]');
    if (!b) return;
    const name = b.dataset.icofy;
    const svg = await bridge.iconifyGet(`${name.replace(':', '/')}.svg?color=${encodeURIComponent(iconColor())}&height=512`);
    if (!svg.trim().startsWith('<svg')) throw new Error(t('That icon could not be downloaded.'));
    const path = `${studio.dataDir}/Icons/${name.replace(':', '-')}-${iconColor().slice(1)}.svg`;
    await bridge.writeText(path, svg);
    const el = M.makeElement('image', { src: path, x: M.BASE.w / 2, y: 1200, w: 360, name });
    await studio.mutate(() => { studio.slide.elements.push(el); });
    await studio.mutate(() => studio.fitToImage(el), { history: false });
    studio.selectedId = el.id;
    studio.emit();
  }));

  /* ---------- publish with fastlane ---------- */
  const PUB_KEY = 'severus.publish';
  const pub = () => { try { return JSON.parse(localStorage.getItem(PUB_KEY) || '{}'); } catch (_) { return {}; } };
  const savePub = (patch) => { const next = { ...pub(), ...patch }; try { localStorage.setItem(PUB_KEY, JSON.stringify(next)); } catch (_) { /* ignore */ } return next; };
  function drawPublish() {
    const p = pub();
    if (!$('#pubIosId').value) $('#pubIosId').value = p.iosId || '';
    if (!$('#pubAndId').value) $('#pubAndId').value = p.androidId || '';
    $('#pubIosKey').textContent = p.iosKey || t('No App Store Connect API key file chosen (a .json file).');
    $('#pubAndKey').textContent = p.androidKey || t('No Google Play service account key chosen (a .json file).');
  }
  $('#pubBox').addEventListener('toggle', drawPublish);
  bridge.onPublishLog((line) => { const log = $('#pubLog'); log.hidden = false; log.textContent += `${line}\n`; log.scrollTop = log.scrollHeight; });
  async function pickKey(which) {
    const path = await bridge.pickOpen([{ name: 'JSON key', extensions: ['json'] }]);
    if (path) { savePub({ [which]: path }); drawPublish(); }
  }
  async function publish(store, b) {
    const dir = $('#exDir').value.trim();
    const id = (store === 'ios' ? $('#pubIosId') : $('#pubAndId')).value.trim();
    const p = savePub(store === 'ios' ? { iosId: id } : { androidId: id });
    const key = store === 'ios' ? p.iosKey : p.androidKey;
    const name = store === 'ios' ? 'App Store Connect' : 'Google Play';
    if (!dir) throw new Error(t('Choose an output folder'));
    if (!key) throw new Error(t('Choose the key file first.'));
    if (!id) throw new Error(t('Enter the bundle id or package name first.'));
    if (!(await bridge.confirm(t('Upload the exported screenshots and store text for {0} to {1}? This replaces what is on the store listing now.', id, name)))) return;
    $('#pubLog').textContent = '';
    b.disabled = true;
    $('#exStatus').textContent = t('Publishing to {0}…', name);
    try {
      await bridge.publishRun(dir, store, key, id);
      $('#exStatus').textContent = t('Published to {0}. Check the listing in the store console.', name);
    } catch (err) {
      $('#exStatus').textContent = String(err && err.message ? err.message : err).split('\n')[0];
    } finally { b.disabled = false; }
  }

  /* ---------- store listing text ---------- */
  const lsLang = () => $('#lsLang').value || studio.project.languages[0];
  function drawListing() {
    const langs = studio.project.languages, cur = langs.includes($('#lsLang').value) ? $('#lsLang').value : studio.lang;
    $('#lsLang').innerHTML = langs.map((l) => `<option value="${esc(l)}"${l === cur ? ' selected' : ''}>${esc(l)} · ${esc(langName(l))}</option>`).join('');
    const others = langs.filter((l) => l !== cur);
    $('#lsFrom').innerHTML = others.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
    $('#lsFrom').disabled = !others.length;
    const entry = (studio.project.listing || {})[cur] || {};
    $('#lsFields').innerHTML = M.LISTING_FIELDS.map((f) => {
      const v = entry[f.id] || '';
      const input = f.long ? `<textarea data-ls="${f.id}" maxlength="${f.max}" dir="auto">${esc(v)}</textarea>` : `<input type="text" data-ls="${f.id}" maxlength="${f.max}" dir="auto" value="${esc(v)}">`;
      return `<label class="${f.long ? 'long' : ''}"><span>${esc(t(f.label))}<small data-count="${f.id}">${v.length} / ${f.max}</small></span>${input}</label>`;
    }).join('');
  }
  async function saveListing(lang, fields) {
    await studio.mutate((p) => { p.listing = M.sanitizeListing({ ...p.listing, [lang]: { ...((p.listing || {})[lang] || {}), ...fields } }); });
  }
  $('#lsLang').addEventListener('change', drawListing);
  $('#lsFields').addEventListener('input', (e) => { const f = e.target.dataset.ls; if (f) $(`[data-count="${f}"]`).textContent = `${e.target.value.length} / ${e.target.maxLength}`; });
  $('#lsFields').addEventListener('change', guard(async (e) => { if (e.target.dataset.ls) await saveListing(lsLang(), { [e.target.dataset.ls]: e.target.value }); }));
  const lsStatus = (m) => { $('#lsStatus').textContent = m; };
  async function lsBusy(b, label, fn) {
    b.disabled = true; lsStatus(label);
    try { await fn(); } catch (err) { lsStatus(err && err.code === 'setup' ? t('Set up the local AI first: press Ctrl+J, then “Set up”.') : String(err && err.message ? err.message : err)); } finally { b.disabled = false; }
  }
  const draft = (b) => lsBusy(b, t('Writing the store text… this takes a minute on a small model.'), async () => {
    const about = $('#lsAbout').value.trim();
    if (!about) throw new Error(t('Describe the app in a sentence first.'));
    const lang = lsLang(), name = ((studio.project.listing || {})[lang] || {}).name || studio.project.name;
    await saveListing(lang, await draftListing(await ai(), about, lang, name));
    drawListing();
    lsStatus(t('Draft ready. Edit it before you publish: small models make mistakes.'));
  });
  const translateLs = (b) => lsBusy(b, t('Translating…'), async () => {
    const from = $('#lsFrom').value, to = lsLang();
    if (!from) throw new Error(t('Add a second language to the project first.'));
    const fields = await translateListing(await ai(), (studio.project.listing || {})[from], from, to, M.LISTING_FIELDS);
    if (!Object.keys(fields).length) throw new Error(t('There is no store text in {0} to translate yet.', from));
    await saveListing(to, fields);
    drawListing();
    lsStatus(t('Translated from {0}. Read it through before you publish.', from));
  });

  /* ---------- local AI ---------- */
  const own = () => saveAiSettings({ mode: $('#aiOwn').checked ? 'server' : 'builtin', base: $('#aiBase').value, model: $('#aiModel').value });
  const ai = () => aiClient(own());
  const aiStatus = (msg) => { $('#aiStatus').textContent = msg; };
  const mb = (n) => Math.round(n / 1048576);
  let settingUp = false;
  async function drawBuiltin() {
    if (!isTauri) { $('#aiState').textContent = t('Local AI needs the desktop app.'); $('#aiHint').textContent = ''; $('#aiSetupBtn').hidden = true; return null; }
    const st = await bridge.aiLocalStatus();
    const ready = st.engine && st.model;
    $('#aiSetupBtn').hidden = ready || !st.supported || settingUp;
    $('#aiState').textContent = !st.supported ? t('The built-in model is not available on this computer.') : ready ? t('Ready: Gemma 3 1B, running on this computer.') : settingUp ? t('Setting up…') : t('Not set up yet');
    $('#aiHint').textContent = !st.supported ? t('Use your own model server below.') : ready ? t('Works offline. Small models make mistakes, so read the result.') : t('One download of about {0} MB. After that it works offline, with nothing else to install.', st.downloadMb);
    return st;
  }
  function drawAi() {
    const s = aiSettings();
    $('#aiOwn').checked = s.mode === 'server';
    $('#aiAdv').open = s.mode === 'server';
    $('#aiBase').value = s.base;
    $('#aiModel').value = s.model;
    $('#aiBase').placeholder = AI_DEFAULTS.base;
    $('#aiModel').placeholder = AI_DEFAULTS.model;
    const langs = studio.project.languages;
    $('#aiFrom').innerHTML = langs.map((l) => `<option value="${esc(l)}"${l === studio.lang ? ' selected' : ''}>${esc(l)} · ${esc(langName(l))}</option>`).join('');
    const other = langs.find((l) => l !== $('#aiFrom').value);
    if (!$('#aiTo').value) $('#aiTo').value = other || ($('#aiFrom').value === 'ar' ? 'en' : 'ar');
    $('#aiLangs').innerHTML = Object.entries(LANG_NAMES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    aiStatus('');
    drawBuiltin().catch((err) => aiStatus(String(err && err.message ? err.message : err)));
  }
  bridge.onAiProgress(({ step, done, total }) => {
    const bar = $('#aiBar');
    bar.hidden = false;
    if (total) { bar.max = total; bar.value = done; } else bar.removeAttribute('value');
    const what = step === 'engine' ? t('Downloading the AI engine…') : t('Downloading the model…');
    aiStatus(total ? `${what} ${mb(done)} / ${mb(total)} MB (${Math.floor((done / total) * 100)}%)` : `${what} ${mb(done)} MB`);
  });
  async function setupAi(b) {
    settingUp = true;
    b.hidden = true;
    $('#aiState').textContent = t('Setting up…');
    aiStatus(t('Starting the download…'));
    try {
      await bridge.aiLocalSetup();
      $('#aiBar').hidden = true;
      aiStatus(t('Starting the model…'));
      await bridge.aiLocalStart();
      aiStatus(t('Local AI is ready. Choose a language and press Translate.'));
    } catch (err) {
      aiStatus(String(err && err.message ? err.message : err));
    } finally {
      settingUp = false;
      $('#aiBar').hidden = true;
      await drawBuiltin().catch(() => null);
    }
  }
  async function busy(button, label, fn) {
    if (button) button.disabled = true;
    aiStatus(label);
    try { return await fn(); } catch (err) {
      aiStatus(err && err.code === 'setup' ? t('Press “Set up” above first. It is a one-time download.') : String(err && err.message ? err.message : err));
      return undefined;
    } finally { if (button) button.disabled = false; }
  }
  async function testAi(b) {
    await busy(b, t('Connecting…'), async () => {
      const client = new LocalAI(bridge.aiRequest, own());
      const models = await client.models();
      $('#aiModels').innerHTML = models.map((m) => `<option value="${esc(m)}">`).join('');
      const has = models.includes(client.model) || models.includes(`${client.model}:latest`);
      aiStatus(has ? t('Connected. The model "{0}" is ready.', client.model) : t('Connected, but "{0}" is not installed. Press Download, or pick one of: {1}', client.model, models.join(', ') || '—'));
    });
  }
  async function pullAi(b) {
    await busy(b, t('Downloading "{0}". This can take several minutes; keep this window open.', $('#aiModel').value || AI_DEFAULTS.model), async () => {
      const client = new LocalAI(bridge.aiRequest, own());
      await client.pull();
      aiStatus(t('Connected. The model "{0}" is ready.', client.model));
    });
  }
  async function translate(b) {
    await busy(b, t('Translating…'), async () => {
      aiStatus(t('Starting the model…'));
      const client = await ai();
      aiStatus(t('Translating…'));
      const r = await translateProject(studio, client, {
        from: $('#aiFrom').value, to: $('#aiTo').value.trim(), overwrite: $('#aiOver').checked,
        onProgress: (n, total) => aiStatus(t('Translating {0} of {1}…', n, total)),
      });
      if (r.translated) { studio.lang = r.to; studio.emit('project'); }
      aiStatus(r.translated ? t('Translated {0} caption(s) into {1}. Read them through: small models make mistakes.', r.translated, langName(r.to)) : t('Nothing to translate: every caption already has a translation.'));
    });
  }
  async function suggest(b) {
    const about = $('#aiAbout').value.trim() || studio.project.name;
    await busy(b, t('Writing ideas…'), async () => {
      const ideas = await (await ai()).suggest(about, studio.lang, 4);
      $('#aiIdeas').innerHTML = ideas.map((s) => `<button type="button" data-idea="${esc(s)}" dir="auto">${esc(s)}</button>`).join('');
      aiStatus(ideas.length ? t('Click an idea to use it for the selected caption.') : t('The model did not return usable ideas. Try again or describe the app in more detail.'));
    });
  }
  $('#aiIdeas').addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-idea]');
    if (!b) return;
    const sel = studio.selected;
    const el = sel && sel.type === 'text' ? sel : studio.slide.elements.find((x) => x.type === 'text');
    if (!el) throw new Error(t('Add a caption to the slide first.'));
    await studio.mutate(() => { el.text[studio.lang] = b.dataset.idea; });
    studio.selectedId = el.id;
    studio.emit();
    aiStatus(t('Caption updated.'));
  }));

  /* ---------- ffmpeg ---------- */
  async function installFfmpeg(b) {
    const status = $('#vidStatus');
    b.disabled = true;
    status.dataset.busy = '1';
    status.textContent = t('Downloading ffmpeg… this happens once.');
    try {
      await bridge.ffmpegInstall();
      studio.hasFfmpeg = true;
      b.hidden = true;
      status.textContent = t('ffmpeg is ready. You can export the video now.');
    } catch (err) {
      status.textContent = String(err && err.message ? err.message : err);
    } finally { b.disabled = false; delete status.dataset.busy; }
  }

  /* ---------- updates ---------- */
  let update = null, updating = false;
  const RELEASES = 'https://github.com/stacxiq/severus-shot/releases/latest';
  async function checkUpdate(silent = false) {
    if (!isTauri) return null;
    try {
      update = await bridge.checkUpdate();
    } catch (err) {
      if (!silent) toast(String(err && err.message ? err.message : err), true);
      return null;
    }
    const badge = $('#updBadge');
    badge.hidden = !update.newer;
    if (update.newer) {
      badge.querySelector('span').textContent = t('Update {0}', update.latest);
      toast(t('Version {0} is available. Click “Update” at the top to get it.', update.latest));
    } else if (!silent) toast(t('You have the latest version ({0}).', update.current));
    return update;
  }
  bridge.onUpdateProgress(({ done, total }) => { if (total) $('#updBadge').querySelector('span').textContent = `${Math.floor((done / total) * 100)}%`; });
  // Install the signed update in place. Releases built without a signing key have none, so fall back to the download page.
  async function installUpdate() {
    if (updating) return;
    updating = true;
    toast(t('Downloading the update…'));
    try {
      const r = await bridge.updateInstall();
      if (r.installed) {
        $('#updBadge').hidden = true;
        await studio.flushSave();
        if (await bridge.confirm(t('Version {0} is installed. Restart Severus Shot now?', r.version))) await bridge.appRestart();
        else toast(t('The update will be used the next time you open the app.'));
        return;
      }
    } catch (err) { console.warn('in-app update unavailable', err); } finally { updating = false; }
    if (update && update.newer) $('#updBadge').querySelector('span').textContent = t('Update {0}', update.latest);
    await bridge.openUrl((update && update.url) || RELEASES);
  }

  return {
    checkUpdate,
    actions: {
      capture: async () => { if (!isTauri) throw new Error(t('Capture needs the desktop app.')); show('#captureDlg'); await drawCapture(); },
      'capture-refresh': drawCapture,
      ai: () => { drawAi(); show('#aiDlg'); },
      'ai-setup': setupAi,
      'ai-test': testAi,
      'ai-pull': pullAi,
      'ai-translate': translate,
      'ai-suggest': suggest,
      'ffmpeg-install': installFfmpeg,
      'update-check': () => checkUpdate(false),
      'update-open': installUpdate,
      'capture-stop': () => { if (series) series.stop = true; },
      'pub-key-ios': () => pickKey('iosKey'),
      'pub-key-android': () => pickKey('androidKey'),
      'pub-ios': (b) => publish('ios', b),
      'pub-android': (b) => publish('android', b),
      listing: () => { lsStatus(''); drawListing(); show('#listingDlg'); },
      'listing-draft': draft,
      'listing-translate': translateLs,
    },
  };
}
