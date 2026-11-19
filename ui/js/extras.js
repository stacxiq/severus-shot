// Integrations around the editor: device capture, local AI, ffmpeg download and the update check.
import * as M from './model.js';
import { bridge, isTauri } from './bridge.js';
import { t, localize } from './i18n.js';
import { icon } from './icons.js';
import { AI_DEFAULTS, LANG_NAMES, LocalAI, langName, normalizeSettings, translateProject } from './ai.js';

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
    $('#capList').innerHTML = devices.map((d, i) => `<div class="capItem">${icon(d.kind === 'ios' ? 'phone' : 'phone')}<div><b>${esc(d.name)}</b><small>${esc(d.kind === 'ios' ? `iOS simulator · ${d.detail}` : d.detail)}</small></div><button type="button" class="primary" data-cap="${i}">${esc(t('Capture'))}</button></div>`).join('')
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
  let update = null;
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
      'update-open': () => bridge.openUrl((update && update.url) || 'https://github.com/stacxiq/severus-shot/releases/latest'),
    },
  };
}
