// Thin wrapper over the Tauri backend, with a limited browser fallback for development.
const T = typeof window !== 'undefined' ? window.__TAURI__ : undefined;
export const isTauri = !!(T && T.core);
const invoke = (cmd, args) => T.core.invoke(cmd, args);
const need = () => { if (!isTauri) throw new Error('This action needs the desktop app'); };

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp' };
export function mimeOf(path) {
  const ext = String(path).split('.').pop().toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export const bridge = {
  isTauri,
  async info() {
    if (!isTauri) return { version: 'dev', port: 0, mcp: 'off', job: null, exportDir: '' };
    return invoke('app_info');
  },
  async readFileB64(path) { need(); return invoke('read_file_b64', { path }); },
  async readText(path) { need(); return invoke('read_text', { path }); },
  async writeText(path, text) { need(); return invoke('write_text', { path, text }); },
  async saveImage(path, dataB64, format = 'png', quality = 92) { need(); return invoke('save_image', { path, dataB64, format, quality }); },
  async zipDir(dir, zipPath) { need(); return invoke('zip_dir', { dir, zipPath }); },
  async listFonts() { return isTauri ? invoke('list_fonts') : ['Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana']; },
  async fontInfo(path) { need(); return invoke('font_info', { path }); },
  async pickOpen(filters, multiple = false) {
    need();
    const r = await T.dialog.open({ multiple, filters });
    if (!r) return multiple ? [] : null;
    return r;
  },
  async pickSave(defaultPath, filters) { need(); return T.dialog.save({ defaultPath, filters }); },
  async pickFolder() { need(); return T.dialog.open({ directory: true }); },
  async listProjects(dir) { return isTauri ? invoke('list_projects', { dir }) : []; },
  async deleteProject(path) { need(); return invoke('delete_project', { path }); },
  async writeFileB64(path, dataB64) { need(); return invoke('write_file_b64', { path, dataB64 }); },
  async videoStart(path, fps, width, height, audio = null) { need(); return invoke('video_start', { path, fps, width, height, audio: audio ? audio.path : null, volume: audio ? audio.volume : null, duration: audio ? audio.duration : null, loopAudio: audio ? !!audio.loop : null }); },
  async videoFrame(id, dataB64) { return invoke('video_frame', { id, dataB64 }); },
  async videoFinish(id, cancel = false) { return invoke('video_finish', { id, cancel }); },
  async ffmpegInstall() { need(); return invoke('ffmpeg_install'); },
  async checkUpdate() { need(); return invoke('check_update'); },
  async openUrl(url) { if (isTauri) return invoke('open_url', { url }); window.open(url, '_blank'); return null; },
  async captureDevices() { need(); return invoke('capture_devices'); },
  async captureScreenshot(kind, id, path) { need(); return invoke('capture_screenshot', { kind, id, path }); },
  async aiRequest(url, body = null, timeout = 120) { need(); return invoke('ai_request', { url, body, timeout }); },
  rpcReply(id, response) { return invoke('rpc_reply', { id, response }); },
  frontendReady() { return isTauri ? invoke('frontend_ready') : null; },
  cliDone(code, message) { return invoke('cli_done', { code, message }); },
  onRpc(handler) { if (isTauri) T.event.listen('rpc', (e) => handler(e.payload)); },
  onFileDrop(handler) {
    if (!isTauri) return;
    try {
      T.webview.getCurrentWebview().onDragDropEvent((e) => {
        if (e.payload.type === 'drop') handler(e.payload.paths || [], e.payload.position);
      });
    } catch (err) { console.warn('drag-drop unavailable', err); }
  },
  setTitle(title) {
    if (isTauri) { try { T.window.getCurrentWindow().setTitle(title); } catch (_) { /* ignore */ } } else document.title = title;
  },
};

export const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
export const FONT_FILTERS = [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }];
export const AUDIO_FILTERS = [{ name: 'Audio', extensions: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'] }];
export const VIDEO_FILTERS = [{ name: 'Video', extensions: ['mp4'] }];
export const PROJECT_FILTERS = [{ name: 'Severus Shot project', extensions: ['severus', 'shotforge', 'json'] }];
