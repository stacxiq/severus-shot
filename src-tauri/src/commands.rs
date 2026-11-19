use std::fs;
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use base64::Engine;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

use crate::AppState;

type Shared<'a> = State<'a, Arc<AppState>>;
const MAX_FILE: u64 = 200 * 1024 * 1024;

fn err<'a, E: std::fmt::Display>(what: &'a str, path: &'a str) -> impl FnOnce(E) -> String + 'a {
    move |e| format!("{what} {path}: {e}")
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("Cannot create folder {}: {e}", parent.display()))?;
        }
    }
    Ok(())
}

fn projects_dir(app: &AppHandle) -> String {
    app.path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map(|p| p.join("Severus Shot").join("Projects").to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}

#[tauri::command]
pub fn app_info(app: AppHandle, state: Shared) -> Value {
    let export_dir = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map(|p| p.join("Severus Shot").join("Exports").to_string_lossy().replace('\\', "/"))
        .unwrap_or_default();
    json!({
        "version": env!("CARGO_PKG_VERSION"),
        "port": state.port,
        "mcp": state.mcp_status.lock().unwrap().clone(),
        "job": state.job,
        "exportDir": export_dir,
        "projectsDir": projects_dir(&app),
        "dataDir": projects_dir(&app).trim_end_matches("/Projects").to_string(),
        "ffmpeg": find_ffmpeg().is_some(),
        "exe": std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| "severus-shot".into()),
    })
}

#[tauri::command(async)]
pub fn read_file_b64(path: String) -> Result<String, String> {
    let meta = fs::metadata(&path).map_err(err("Cannot read", &path))?;
    if meta.len() > MAX_FILE {
        return Err(format!("File is too large: {path}"));
    }
    let bytes = fs::read(&path).map_err(err("Cannot read", &path))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command(async)]
pub fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(err("Cannot read", &path))
}

#[tauri::command(async)]
pub fn write_text(path: String, text: String) -> Result<(), String> {
    ensure_parent(Path::new(&path))?;
    fs::write(&path, text).map_err(err("Cannot write", &path))
}

/// Receives a PNG rendered by the web view and writes a flat RGB file (no alpha channel),
/// which is what App Store Connect expects.
#[tauri::command(async)]
pub fn save_image(path: String, data_b64: String, format: String, quality: Option<u8>) -> Result<Value, String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(data_b64.as_bytes()).map_err(|e| format!("Bad image data: {e}"))?;
    let rgb = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png).map_err(|e| format!("Bad image data: {e}"))?.to_rgb8();
    let (w, h) = rgb.dimensions();
    let mut out = Vec::new();
    match format.to_lowercase().as_str() {
        "jpg" | "jpeg" => {
            let q = quality.unwrap_or(92).clamp(40, 100);
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, q)
                .encode(rgb.as_raw(), w, h, image::ExtendedColorType::Rgb8)
                .map_err(|e| format!("JPG encoding failed: {e}"))?;
        }
        "png" => {
            use image::ImageEncoder;
            image::codecs::png::PngEncoder::new(Cursor::new(&mut out))
                .write_image(rgb.as_raw(), w, h, image::ExtendedColorType::Rgb8)
                .map_err(|e| format!("PNG encoding failed: {e}"))?;
        }
        other => return Err(format!("Unsupported format: {other}")),
    }
    let target = PathBuf::from(&path);
    ensure_parent(&target)?;
    fs::write(&target, &out).map_err(err("Cannot write", &path))?;
    Ok(json!({ "path": path, "width": w, "height": h, "bytes": out.len() }))
}

fn collect(dir: &Path, base: &Path, out: &mut Vec<(PathBuf, String)>) -> std::io::Result<()> {
    let mut entries: Vec<_> = fs::read_dir(dir)?.collect::<Result<_, _>>()?;
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, base, out)?;
        } else if path.is_file() {
            let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
            out.push((path, rel));
        }
    }
    Ok(())
}

#[tauri::command(async)]
pub fn zip_dir(dir: String, zip_path: String) -> Result<Value, String> {
    let base = PathBuf::from(&dir);
    let mut files = Vec::new();
    collect(&base, &base, &mut files).map_err(err("Cannot read folder", &dir))?;
    let target = PathBuf::from(&zip_path);
    ensure_parent(&target)?;
    let file = fs::File::create(&target).map_err(err("Cannot write", &zip_path))?;
    let mut zip = zip::ZipWriter::new(file);
    // Images are already compressed, so store them as-is.
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    for (path, rel) in &files {
        zip.start_file(rel.as_str(), options).map_err(|e| format!("ZIP failed: {e}"))?;
        let bytes = fs::read(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
        zip.write_all(&bytes).map_err(|e| format!("ZIP failed: {e}"))?;
    }
    zip.finish().map_err(|e| format!("ZIP failed: {e}"))?;
    Ok(json!({ "path": zip_path, "files": files.len() }))
}

#[tauri::command(async)]
pub fn list_fonts(state: Shared) -> Vec<String> {
    let mut cache = state.fonts.lock().unwrap();
    if let Some(list) = cache.as_ref() {
        return list.clone();
    }
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    let mut names: Vec<String> = db
        .faces()
        .filter_map(|f| f.families.first().map(|(name, _)| name.clone()))
        .filter(|n| !n.starts_with('.'))
        .collect();
    names.sort_by_key(|n| n.to_lowercase());
    names.dedup();
    *cache = Some(names.clone());
    names
}

#[tauri::command(async)]
pub fn font_info(path: String) -> Result<Value, String> {
    let mut db = fontdb::Database::new();
    db.load_font_file(&path).map_err(err("Cannot read font", &path))?;
    let family = db.faces().next().and_then(|f| f.families.first().map(|(n, _)| n.clone()));
    // WOFF/WOFF2 are not parsed here; the web view can still load them, so fall back to the file name.
    let fallback = Path::new(&path).file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(json!({ "family": family.unwrap_or(fallback) }))
}

#[tauri::command]
pub fn rpc_reply(state: Shared, id: u64, response: Value) {
    if let Some(tx) = state.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(response);
    }
}

#[tauri::command]
pub fn frontend_ready(state: Shared) {
    let (lock, cvar) = &state.ready;
    *lock.lock().unwrap() = true;
    cvar.notify_all();
}

#[tauri::command]
pub fn cli_done(app: AppHandle, code: i32, message: String) {
    if code == 0 {
        println!("{message}");
    } else {
        eprintln!("{message}");
    }
    let _ = std::io::stdout().flush();
    app.exit(code);
}

// ---------- project library ----------

/// Lists the projects in a folder with the details the library screen shows.
#[tauri::command(async)]
pub fn list_projects(dir: String) -> Result<Vec<Value>, String> {
    let base = PathBuf::from(&dir);
    fs::create_dir_all(&base).map_err(err("Cannot create folder", &dir))?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&base).map_err(err("Cannot read folder", &dir))?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("severus") || !path.is_file() {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let parsed: Option<Value> = fs::read_to_string(&path).ok().and_then(|t| serde_json::from_str(&t).ok());
        let Some(p) = parsed else { continue };
        out.push(json!({
            "path": path.to_string_lossy().replace('\\', "/"),
            "name": p.get("name").and_then(Value::as_str).unwrap_or("Untitled"),
            "thumb": p.get("thumb").and_then(Value::as_str).unwrap_or(""),
            "slides": p.get("slides").and_then(Value::as_array).map(Vec::len).unwrap_or(0),
            "modified": modified,
        }));
    }
    out.sort_by_key(|v| std::cmp::Reverse(v["modified"].as_u64().unwrap_or(0)));
    Ok(out)
}

/// Deletes one project file. Only `.severus` files are accepted.
#[tauri::command(async)]
pub fn delete_project(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.extension().and_then(|e| e.to_str()) != Some("severus") || !p.is_file() {
        return Err(format!("Not a project file: {path}"));
    }
    fs::remove_file(p).map_err(err("Cannot delete", &path))
}

#[tauri::command(async)]
pub fn write_file_b64(path: String, data_b64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(data_b64.as_bytes()).map_err(|e| format!("Bad data: {e}"))?;
    ensure_parent(Path::new(&path))?;
    fs::write(&path, bytes).map_err(err("Cannot write", &path))
}

// ---------- video (frames are piped into ffmpeg) ----------

pub fn find_ffmpeg() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    // Apps started from the Dock do not inherit the shell PATH, so check the usual install places too.
    for extra in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/opt/local/bin"] {
        dirs.push(PathBuf::from(extra));
    }
    if let Some(custom) = std::env::var_os("SEVERUS_SHOT_FFMPEG") {
        let p = PathBuf::from(custom);
        if p.is_file() {
            return Some(p);
        }
    }
    dirs.into_iter().map(|d| d.join(exe)).find(|p| p.is_file())
}

#[tauri::command(async)]
#[allow(clippy::too_many_arguments)]
pub fn video_start(
    state: Shared,
    path: String,
    fps: u32,
    width: u32,
    height: u32,
    audio: Option<String>,
    volume: Option<f32>,
    duration: Option<f64>,
    loop_audio: Option<bool>,
) -> Result<u64, String> {
    use std::process::{Command, Stdio};
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg was not found on this computer")?;
    if width % 2 != 0 || height % 2 != 0 {
        return Err("Video width and height must be even numbers".into());
    }
    ensure_parent(Path::new(&path))?;
    let fps = fps.clamp(1, 60).to_string();
    let mut cmd = Command::new(ffmpeg);
    cmd.args(["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", &fps, "-c:v", "mjpeg", "-i", "-"]);
    let audio = audio.filter(|a| Path::new(a).is_file());
    if let Some(track) = &audio {
        // Music: optionally looped, set to the chosen volume, faded out, and cut to the video's length.
        if loop_audio.unwrap_or(false) {
            cmd.args(["-stream_loop", "-1"]);
        }
        cmd.arg("-i").arg(track);
        let length = duration.unwrap_or(0.0).max(0.5);
        let fade = (length - 1.0).max(0.0);
        let filter = format!("volume={:.2},afade=t=out:st={fade:.2}:d=1", volume.unwrap_or(0.8).clamp(0.0, 1.0));
        cmd.args(["-map", "0:v:0", "-map", "1:a:0", "-af", &filter, "-c:a", "aac", "-b:a", "160k", "-t", &format!("{length:.3}")]);
    }
    cmd.args(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", "-movflags", "+faststart", "-r", &fps])
        .arg(&path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // no console window
    }
    let child = cmd.spawn().map_err(|e| format!("Could not start ffmpeg: {e}"))?;
    let id = state.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    state.videos.lock().unwrap().insert(id, child);
    Ok(id)
}

#[tauri::command(async)]
pub fn video_frame(state: Shared, id: u64, data_b64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(data_b64.as_bytes()).map_err(|e| format!("Bad frame: {e}"))?;
    let mut videos = state.videos.lock().unwrap();
    let child = videos.get_mut(&id).ok_or("Unknown video job")?;
    let stdin = child.stdin.as_mut().ok_or("Video job is already closed")?;
    stdin.write_all(&bytes).map_err(|e| format!("ffmpeg stopped accepting frames: {e}"))
}

#[tauri::command(async)]
pub fn video_finish(state: Shared, id: u64, cancel: Option<bool>) -> Result<(), String> {
    let Some(mut child) = state.videos.lock().unwrap().remove(&id) else { return Err("Unknown video job".into()) };
    drop(child.stdin.take()); // closing the pipe tells ffmpeg the input is complete
    if cancel.unwrap_or(false) {
        let _ = child.kill();
        let _ = child.wait();
        return Ok(());
    }
    let out = child.wait_with_output().map_err(|e| format!("ffmpeg failed: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}
