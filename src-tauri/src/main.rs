// Severus Shot: desktop screenshot maker. One binary, three modes:
//   severus-shot                      -> the editor window (also serves MCP on 127.0.0.1)
//   severus-shot mcp                  -> stdio MCP bridge for AI agents (starts the editor if needed)
//   severus-shot export <project> ... -> render a project to files without showing the window
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod cli;
mod commands;
mod mcp;
mod tools;

use std::collections::HashMap;
use std::sync::atomic::AtomicU64;
use std::sync::{mpsc, Arc, Condvar, Mutex};

use serde_json::Value;
use tauri::Manager;

pub const DEFAULT_PORT: u16 = 47821;

pub fn mcp_port() -> u16 {
    std::env::var("SEVERUS_SHOT_MCP_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_PORT)
}

pub struct AppState {
    pub port: u16,
    /// "on", "off", or a human-readable reason why the MCP endpoint is not running.
    pub mcp_status: Mutex<String>,
    pub job: Option<cli::ExportJob>,
    pub ready: (Mutex<bool>, Condvar),
    pub pending: Mutex<HashMap<u64, mpsc::Sender<Value>>>,
    pub next_id: AtomicU64,
    pub fonts: Mutex<Option<Vec<String>>>,
    pub videos: Mutex<HashMap<u64, std::process::Child>>,
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("mcp") => std::process::exit(mcp::stdio_bridge(mcp_port())),
        Some("export") | Some("video") => match cli::parse_export(&args[1..], args[0] == "video") {
            Ok(job) => run(Some(job)),
            Err(e) => {
                eprintln!("{e}\n\n{}", cli::USAGE);
                std::process::exit(2);
            }
        },
        Some("-h") | Some("--help") | Some("help") => println!("{}", cli::USAGE),
        Some("-V") | Some("--version") => println!("severus-shot {}", env!("CARGO_PKG_VERSION")),
        _ => run(None),
    }
}

fn run(job: Option<cli::ExportJob>) {
    let headless = job.is_some();
    let state = Arc::new(AppState {
        port: mcp_port(),
        mcp_status: Mutex::new("off".into()),
        job,
        ready: (Mutex::new(false), Condvar::new()),
        pending: Mutex::new(HashMap::new()),
        next_id: AtomicU64::new(1),
        fonts: Mutex::new(None),
        videos: Mutex::new(HashMap::new()),
    });

    let setup_state = state.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::read_file_b64,
            commands::read_text,
            commands::write_text,
            commands::save_image,
            commands::zip_dir,
            commands::list_fonts,
            commands::font_info,
            commands::rpc_reply,
            commands::frontend_ready,
            commands::cli_done,
            commands::list_projects,
            commands::delete_project,
            commands::write_file_b64,
            commands::video_start,
            commands::video_frame,
            commands::video_finish,
            tools::ffmpeg_install,
            tools::check_update,
            tools::open_url,
            tools::capture_devices,
            tools::capture_screenshot,
            tools::ai_request,
            tools::ai_local_status,
            tools::ai_local_setup,
            tools::ai_local_start,
            tools::update_install,
            tools::app_restart,
            tools::publish_run,
            tools::iconify_get,
        ])
        .setup(move |app| {
            if let Ok(docs) = app.path().document_dir().or_else(|_| app.path().home_dir()) {
                let _ = tools::BIN_DIR.set(docs.join("Severus Shot").join("bin"));
            }
            if headless {
                // Export mode: keep the window hidden and do not open the agent port.
                #[cfg(target_os = "macos")]
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            } else {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
                mcp::serve(app.handle().clone(), setup_state.clone());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to start Severus Shot")
        .run(|_app, event| {
            // The built-in AI server is a child process; do not leave it running after the window closes.
            if let tauri::RunEvent::Exit = event {
                tools::ai_stop();
            }
        });
}
