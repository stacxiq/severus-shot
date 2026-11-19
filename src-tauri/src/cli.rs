use std::path::PathBuf;

use serde::Serialize;

pub const USAGE: &str = "Severus Shot

USAGE:
  severus-shot                         Open the editor
  severus-shot mcp                     Run as a stdio MCP server for AI agents
  severus-shot export <project> --out <dir> [options]
  severus-shot video <project> --out <file.mp4> [--size video-1080] [--langs en] (needs ffmpeg)

EXPORT OPTIONS:
  --out <dir>        Output folder (required)
  --sizes <list>     Comma-separated size ids or WIDTHxHEIGHT (default: all store sizes)
                     iphone-6.9, iphone-6.7, iphone-6.5, iphone-5.5, ipad-13, ipad-12.9,
                     android-phone, android-tablet-7, android-tablet-10
  --langs <list>     Comma-separated language codes (default: all project languages)
  --format <fmt>     png (default) or jpg
  --zip              Also write <dir>.zip

ENVIRONMENT:
  SEVERUS_SHOT_MCP_PORT   Port for the local MCP endpoint (default 47821)";

#[derive(Clone, Debug, Serialize)]
pub struct ExportJob {
    pub project: String,
    pub out: String,
    pub sizes: Vec<String>,
    pub langs: Vec<String>,
    pub format: String,
    pub zip: bool,
    pub video: bool,
}

fn absolute(p: &str) -> Result<String, String> {
    let path = PathBuf::from(p);
    let full = if path.is_absolute() {
        path
    } else {
        std::env::current_dir().map_err(|e| e.to_string())?.join(path)
    };
    Ok(full.to_string_lossy().into_owned())
}

fn list(v: &str) -> Vec<String> {
    v.split(',').map(str::trim).filter(|s| !s.is_empty()).map(String::from).collect()
}

pub fn parse_export(args: &[String], video: bool) -> Result<ExportJob, String> {
    let mut project: Option<String> = None;
    let mut out: Option<String> = None;
    let (mut sizes, mut langs) = (Vec::new(), Vec::new());
    let mut format = String::from("png");
    let mut zip = false;
    let mut it = args.iter();
    while let Some(a) = it.next() {
        let mut value = |name: &str| it.next().cloned().ok_or_else(|| format!("{name} needs a value"));
        match a.as_str() {
            "--out" | "-o" => out = Some(value("--out")?),
            "--sizes" | "--size" => sizes = list(&value("--sizes")?),
            "--langs" => langs = list(&value("--langs")?),
            "--format" => format = value("--format")?.to_lowercase(),
            "--zip" => zip = true,
            s if s.starts_with('-') => return Err(format!("Unknown option: {s}")),
            s if project.is_none() => project = Some(s.to_string()),
            s => return Err(format!("Unexpected argument: {s}")),
        }
    }
    let project = absolute(&project.ok_or("Missing <project> file")?)?;
    if !std::path::Path::new(&project).is_file() {
        return Err(format!("Project file not found: {project}"));
    }
    if format != "png" && format != "jpg" && format != "jpeg" {
        return Err(format!("Unsupported format: {format}"));
    }
    Ok(ExportJob { project, out: absolute(&out.ok_or("Missing --out")?)?, sizes, langs, format, zip, video })
}
