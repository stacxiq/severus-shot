// Integrations with things outside the app: ffmpeg download, update check,
// simulator / device capture, and a local AI model server.
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use std::time::Duration;

use serde_json::{json, Value};

/// `<Documents>/Severus Shot/bin`, where a downloaded ffmpeg is kept.
pub static BIN_DIR: OnceLock<PathBuf> = OnceLock::new();

const REPO: &str = "stacxiq/severus-shot";
const FFMPEG_BASE: &str = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0";
const MAX_DOWNLOAD: u64 = 300 * 1024 * 1024;

fn http(seconds: u64) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout(Duration::from_secs(seconds))
        .user_agent(concat!("severus-shot/", env!("CARGO_PKG_VERSION")))
        .build()
}

fn http_error(what: &str, e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(code, resp) => {
            let body = resp.into_string().unwrap_or_default();
            let detail: String = body.trim().chars().take(300).collect();
            format!("{what}: HTTP {code} {detail}")
        }
        ureq::Error::Transport(t) => format!("{what}: {t}"),
    }
}

// ---------- ffmpeg ----------

pub fn local_ffmpeg() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    BIN_DIR.get().map(|d| d.join(exe)).filter(|p| p.is_file())
}

fn ffmpeg_asset() -> Result<&'static str, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Ok("ffmpeg-darwin-arm64"),
        ("macos", "x86_64") => Ok("ffmpeg-darwin-x64"),
        ("linux", "x86_64") => Ok("ffmpeg-linux-x64"),
        ("linux", "aarch64") => Ok("ffmpeg-linux-arm64"),
        ("windows", "x86_64") => Ok("ffmpeg-win32-x64"),
        (os, arch) => Err(format!("There is no ready-made ffmpeg for {os} {arch}. Install ffmpeg yourself and restart.")),
    }
}

/// Download a static ffmpeg build into the app's own folder, so video export works
/// without Homebrew or any other package manager.
#[tauri::command(async)]
pub fn ffmpeg_install() -> Result<Value, String> {
    let dir = BIN_DIR.get().ok_or("The app data folder is not available")?;
    fs::create_dir_all(dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    let exe = dir.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
    let part = dir.join("ffmpeg.part");
    let url = format!("{FFMPEG_BASE}/{}", ffmpeg_asset()?);
    let resp = http(900).get(&url).call().map_err(|e| http_error("Could not download ffmpeg", e))?;
    let mut file = fs::File::create(&part).map_err(|e| format!("Cannot write {}: {e}", part.display()))?;
    let bytes = std::io::copy(&mut resp.into_reader().take(MAX_DOWNLOAD), &mut file).map_err(|e| format!("The ffmpeg download stopped: {e}"))?;
    drop(file);
    if bytes < 1024 * 1024 {
        let _ = fs::remove_file(&part);
        return Err("The ffmpeg download was incomplete".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&part, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    let _ = fs::remove_file(&exe);
    fs::rename(&part, &exe).map_err(|e| format!("Cannot install ffmpeg: {e}"))?;
    // Only keep it if it actually runs on this machine.
    let works = Command::new(&exe).arg("-version").output().map(|o| o.status.success()).unwrap_or(false);
    if !works {
        let _ = fs::remove_file(&exe);
        return Err("The downloaded ffmpeg does not run on this computer. Install ffmpeg yourself and restart.".into());
    }
    Ok(json!({ "path": exe.to_string_lossy(), "bytes": bytes }))
}

// ---------- update check ----------

fn version_parts(v: &str) -> Vec<u64> {
    v.trim().trim_start_matches('v').split(|c: char| !c.is_ascii_digit()).filter(|s| !s.is_empty()).map(|s| s.parse().unwrap_or(0)).collect()
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    let (a, b) = (version_parts(latest), version_parts(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    false
}

#[tauri::command(async)]
pub fn check_update() -> Result<Value, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let text = http(20)
        .get(&url)
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| http_error("Could not check for updates", e))?
        .into_string()
        .map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("Unexpected answer from GitHub: {e}"))?;
    let latest = v["tag_name"].as_str().unwrap_or("").trim_start_matches('v').to_string();
    let current = env!("CARGO_PKG_VERSION");
    Ok(json!({
        "current": current,
        "latest": latest,
        "newer": !latest.is_empty() && is_newer(&latest, current),
        "url": format!("https://github.com/{REPO}/releases/latest"),
        "notes": v["body"].as_str().unwrap_or("").chars().take(1200).collect::<String>(),
    }))
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || c == '"' || c == '\'') {
        return Err("Only https links can be opened".into());
    }
    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = Command::new("open");
        c.arg(&url);
        c
    } else if cfg!(windows) {
        let mut c = Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", &url]);
        c
    } else {
        let mut c = Command::new("xdg-open");
        c.arg(&url);
        c
    };
    cmd.spawn().map(|_| ()).map_err(|e| format!("Could not open the browser: {e}"))
}

// ---------- capture from a simulator, emulator or phone ----------

fn find_adb() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "adb.exe" } else { "adb" };
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    for var in ["ANDROID_HOME", "ANDROID_SDK_ROOT"] {
        if let Some(v) = std::env::var_os(var) {
            dirs.push(PathBuf::from(v).join("platform-tools"));
        }
    }
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from) {
        dirs.push(home.join("Library/Android/sdk/platform-tools"));
        dirs.push(home.join("Android/Sdk/platform-tools"));
        dirs.push(home.join("AppData/Local/Android/Sdk/platform-tools"));
    }
    dirs.push(PathBuf::from("/opt/homebrew/bin"));
    dirs.push(PathBuf::from("/usr/local/bin"));
    dirs.into_iter().map(|d| d.join(exe)).find(|p| p.is_file())
}

fn ios_devices(out: &mut Vec<Value>) {
    if !cfg!(target_os = "macos") {
        return;
    }
    let Ok(o) = Command::new("xcrun").args(["simctl", "list", "devices", "booted", "-j"]).output() else { return };
    let Ok(v) = serde_json::from_slice::<Value>(&o.stdout) else { return };
    let Some(runtimes) = v["devices"].as_object() else { return };
    for (runtime, list) in runtimes {
        let os = runtime.rsplit('.').next().unwrap_or("").replace('-', " ");
        for d in list.as_array().into_iter().flatten() {
            if let (Some(id), Some(name)) = (d["udid"].as_str(), d["name"].as_str()) {
                out.push(json!({ "kind": "ios", "id": id, "name": name, "detail": os }));
            }
        }
    }
}

pub fn parse_adb_devices(text: &str) -> Vec<Value> {
    text.lines()
        .skip(1)
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let (id, state) = (parts.next()?, parts.next()?);
            if state != "device" {
                return None;
            }
            let model = parts.find_map(|p| p.strip_prefix("model:")).unwrap_or(id).replace('_', " ");
            let detail = if id.starts_with("emulator-") { "Android emulator" } else { "Android device" };
            Some(json!({ "kind": "android", "id": id, "name": model, "detail": detail }))
        })
        .collect()
}

#[tauri::command(async)]
pub fn capture_devices() -> Value {
    let mut devices = Vec::new();
    ios_devices(&mut devices);
    let adb = find_adb();
    if let Some(adb) = &adb {
        if let Ok(o) = Command::new(adb).args(["devices", "-l"]).output() {
            devices.extend(parse_adb_devices(&String::from_utf8_lossy(&o.stdout)));
        }
    }
    json!({ "devices": devices, "adb": adb.is_some(), "simulators": cfg!(target_os = "macos") })
}

#[tauri::command(async)]
pub fn capture_screenshot(kind: String, id: String, path: String) -> Result<Value, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || "-._:".contains(c)) {
        return Err("That device id is not valid".into());
    }
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
    }
    match kind.as_str() {
        "ios" => {
            let o = Command::new("xcrun")
                .args(["simctl", "io", &id, "screenshot", "--type=png"])
                .arg(&target)
                .output()
                .map_err(|e| format!("Could not run xcrun (is Xcode installed?): {e}"))?;
            if !o.status.success() {
                return Err(format!("The simulator did not return a screenshot: {}", String::from_utf8_lossy(&o.stderr).trim()));
            }
        }
        "android" => {
            let adb = find_adb().ok_or("adb was not found. Install Android platform-tools.")?;
            let o = Command::new(adb).args(["-s", &id, "exec-out", "screencap", "-p"]).output().map_err(|e| format!("Could not run adb: {e}"))?;
            if !o.status.success() || !o.stdout.starts_with(b"\x89PNG") {
                return Err(format!("The device did not return a screenshot: {}", String::from_utf8_lossy(&o.stderr).trim()));
            }
            fs::write(&target, &o.stdout).map_err(|e| format!("Cannot write {path}: {e}"))?;
        }
        other => return Err(format!("Unknown device kind: {other}")),
    }
    let ok = fs::File::open(&target).ok().map(|mut f| { let mut m = [0u8; 4]; f.read_exact(&mut m).is_ok() && &m == b"\x89PNG" }).unwrap_or(false);
    if !ok {
        return Err("The screenshot file is not a valid PNG".into());
    }
    Ok(json!({ "path": path }))
}

// ---------- local AI model server (Ollama, LM Studio, llama.cpp …) ----------

/// Send JSON to the model server the user configured. GET when there is no body.
#[tauri::command(async)]
pub fn ai_request(url: String, body: Option<Value>, timeout: Option<u64>) -> Result<Value, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("The AI server address must start with http:// or https://".into());
    }
    let agent = http(timeout.unwrap_or(120).clamp(5, 3600));
    let resp = match body {
        Some(b) => agent.post(&url).set("Content-Type", "application/json").send_string(&b.to_string()),
        None => agent.get(&url).call(),
    }
    .map_err(|e| match e {
        ureq::Error::Transport(t) => format!("Could not reach the AI server at {url}. Is it running? ({t})"),
        other => http_error("The AI server answered with an error", other),
    })?;
    let mut text = String::new();
    resp.into_reader().take(16 * 1024 * 1024).read_to_string(&mut text).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|_| format!("The AI server did not answer with JSON: {}", text.chars().take(200).collect::<String>()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_newer("0.5.0", "0.4.0"));
        assert!(is_newer("v1.0", "0.9.9"));
        assert!(is_newer("0.4.10", "0.4.9"));
        assert!(!is_newer("0.4.0", "0.4.0"));
        assert!(!is_newer("0.3.9", "0.4.0"));
    }

    #[test]
    fn reads_adb_device_list() {
        let text = "List of devices attached\nemulator-5554          device product:sdk model:sdk_gphone64_arm64 device:emu\nR58M12345 unauthorized usb:1\n10.0.0.5:5555 device model:Pixel_8\n\n";
        let d = parse_adb_devices(text);
        assert_eq!(d.len(), 2);
        assert_eq!(d[0]["id"], "emulator-5554");
        assert_eq!(d[0]["name"], "sdk gphone64 arm64");
        assert_eq!(d[1]["name"], "Pixel 8");
    }
}
