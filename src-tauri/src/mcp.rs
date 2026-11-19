//! Agent control. The editor serves MCP (JSON-RPC over HTTP) on 127.0.0.1 only and hands every
//! message to the web view, where the tools are implemented. `severus-shot mcp` is a small stdio
//! bridge to that endpoint for agents that launch servers as child processes.
use std::io::{BufRead, Read, Write};
use std::sync::atomic::Ordering;
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tiny_http::{Header, Method, Request, Response, Server};

use crate::AppState;

const MAX_BODY: usize = 32 * 1024 * 1024;
const CALL_TIMEOUT: Duration = Duration::from_secs(600);

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("static header")
}

fn reply(req: Request, status: u16, body: String) {
    let res = Response::from_string(body).with_status_code(status).with_header(header("Content-Type", "application/json"));
    let _ = req.respond(res);
}

fn rpc_error(id: Value, code: i64, message: &str) -> String {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }).to_string()
}

pub fn serve(app: AppHandle, state: Arc<AppState>) {
    let server = match Server::http(("127.0.0.1", state.port)) {
        Ok(s) => s,
        Err(e) => {
            *state.mcp_status.lock().unwrap() = format!("port {} is unavailable ({e}). Is Severus Shot already open?", state.port);
            return;
        }
    };
    *state.mcp_status.lock().unwrap() = "on".into();
    std::thread::spawn(move || {
        for req in server.incoming_requests() {
            let (app, state) = (app.clone(), state.clone());
            std::thread::spawn(move || handle(req, app, state));
        }
    });
}

fn handle(mut req: Request, app: AppHandle, state: Arc<AppState>) {
    // Browsers attach an Origin header to cross-site requests; agents and CLIs do not.
    // Refusing it stops a web page from driving the editor through this local port.
    if req.headers().iter().any(|h| h.field.equiv("Origin")) {
        return reply(req, 403, json!({ "error": "Browser requests are not accepted" }).to_string());
    }
    let path = req.url().split('?').next().unwrap_or("").to_string();
    if *req.method() == Method::Get && path == "/health" {
        return reply(req, 200, json!({ "ok": true, "name": "severus-shot", "version": env!("CARGO_PKG_VERSION") }).to_string());
    }
    if path != "/mcp" && path != "/" {
        return reply(req, 404, json!({ "error": "Use POST /mcp" }).to_string());
    }
    if *req.method() != Method::Post {
        let res = Response::from_string("").with_status_code(405).with_header(header("Allow", "POST"));
        let _ = req.respond(res);
        return;
    }
    let mut body = Vec::new();
    if req.as_reader().take(MAX_BODY as u64 + 1).read_to_end(&mut body).is_err() || body.len() > MAX_BODY {
        return reply(req, 413, rpc_error(Value::Null, -32600, "Request too large"));
    }
    let message: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return reply(req, 400, rpc_error(Value::Null, -32700, "Parse error")),
    };
    let request_id = message.get("id").cloned().unwrap_or(Value::Null);

    // Wait for the editor UI to finish loading (matters right after launch).
    {
        let (lock, cvar) = &state.ready;
        let guard = lock.lock().unwrap();
        let (guard, _) = cvar.wait_timeout_while(guard, Duration::from_secs(45), |ready| !*ready).unwrap();
        if !*guard {
            return reply(req, 503, rpc_error(request_id, -32000, "Severus Shot is still starting"));
        }
    }

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = mpsc::channel();
    state.pending.lock().unwrap().insert(id, tx);
    if app.emit("rpc", json!({ "id": id, "message": message })).is_err() {
        state.pending.lock().unwrap().remove(&id);
        return reply(req, 500, rpc_error(request_id, -32603, "Editor window is not available"));
    }
    match rx.recv_timeout(CALL_TIMEOUT) {
        Ok(Value::Null) => {
            let _ = req.respond(Response::from_string("").with_status_code(202));
        }
        Ok(response) => reply(req, 200, response.to_string()),
        Err(_) => {
            state.pending.lock().unwrap().remove(&id);
            reply(req, 504, rpc_error(request_id, -32000, "Timed out waiting for the editor"));
        }
    }
}

fn post(url: &str, line: &str) -> Result<(u16, String), ureq::Error> {
    let res = ureq::post(url).set("Content-Type", "application/json").timeout(CALL_TIMEOUT + Duration::from_secs(30)).send_string(line);
    match res {
        Ok(r) => {
            let status = r.status();
            Ok((status, r.into_string().unwrap_or_default()))
        }
        Err(ureq::Error::Status(code, r)) => Ok((code, r.into_string().unwrap_or_default())),
        Err(e) => Err(e),
    }
}

fn editor_running(port: u16) -> bool {
    ureq::get(&format!("http://127.0.0.1:{port}/health")).timeout(Duration::from_secs(2)).call().is_ok()
}

fn start_editor(port: u16) -> bool {
    use std::process::{Command, Stdio};
    let Ok(exe) = std::env::current_exe() else { return false };
    // Detach from our pipes so the editor can never write into the MCP stream.
    if Command::new(exe).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().is_err() {
        return false;
    }
    let deadline = Instant::now() + Duration::from_secs(40);
    while Instant::now() < deadline {
        if editor_running(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    false
}

/// Reads newline-delimited JSON-RPC from stdin, forwards each message to the editor, and
/// writes the answers to stdout. Returns the process exit code.
pub fn stdio_bridge(port: u16) -> i32 {
    let url = format!("http://127.0.0.1:{port}/mcp");
    if !editor_running(port) && !start_editor(port) {
        eprintln!("severus-shot: could not reach or start the editor on port {port}");
    }
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let id = serde_json::from_str::<Value>(line).ok().and_then(|v| v.get("id").cloned());
        let mut result = post(&url, line);
        if result.is_err() && start_editor(port) {
            result = post(&url, line);
        }
        let out = match result {
            Ok((202, _)) | Ok((204, _)) => None,
            Ok((_, body)) if !body.trim().is_empty() => {
                // Re-serialise so the answer is always exactly one line.
                Some(serde_json::from_str::<Value>(&body).map(|v| v.to_string()).unwrap_or_else(|_| rpc_error(id.clone().unwrap_or(Value::Null), -32603, "Editor returned an invalid response")))
            }
            Ok(_) => None,
            Err(e) => id.clone().map(|id| rpc_error(id, -32000, &format!("Severus Shot editor is not reachable: {e}"))),
        };
        if let Some(text) = out {
            if writeln!(stdout, "{text}").and_then(|_| stdout.flush()).is_err() {
                break;
            }
        }
    }
    0
}
