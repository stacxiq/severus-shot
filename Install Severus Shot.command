#!/bin/zsh
# Builds Severus Shot from this folder and installs it into Applications.
# Double-click this file in Finder. The first run takes several minutes.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

say_step() { print -P "\n%F{cyan}==> $1%f"; }
fail() { print -P "\n%F{red}$1%f"; read -k 1 "?Press any key to close."; exit 1; }

say_step "Checking tools"
xcode-select -p >/dev/null 2>&1 || { xcode-select --install; fail "Apple's command line tools are being installed. Run this file again when that finishes."; }
command -v npm >/dev/null 2>&1 || fail "Node.js was not found. Install it from https://nodejs.org and run this file again."

if ! command -v cargo >/dev/null 2>&1; then
  say_step "Installing Rust (official rustup installer, into your home folder)"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal || fail "Rust could not be installed."
  source "$HOME/.cargo/env"
fi

say_step "Installing build tools"
npm install --no-audit --no-fund || fail "npm install failed."

say_step "Building the app (this is the slow part)"
npx tauri build --bundles app || fail "The build failed. Scroll up for the first error."

APP="src-tauri/target/release/bundle/macos/Severus Shot.app"
[ -d "$APP" ] || fail "The build finished but the app was not found at $APP."

say_step "Installing"
DEST="/Applications"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
rm -rf "$DEST/Severus Shot.app"
cp -R "$APP" "$DEST/" || fail "Could not copy the app into $DEST."

# Command-line shortcut: severus-shot export … / severus-shot mcp
BIN="$(find "$DEST/Severus Shot.app/Contents/MacOS" -type f -perm +111 | head -1)"
if [ -n "$BIN" ]; then
  mkdir -p "$HOME/.local/bin"
  ln -sf "$BIN" "$HOME/.local/bin/severus-shot"
fi

command -v ffmpeg >/dev/null 2>&1 || print -P "\n%F{yellow}Tip: motion-video export needs ffmpeg. Install it with: brew install ffmpeg%f"
print -P "\n%F{green}Severus Shot is installed in $DEST.%f"
open "$DEST/Severus Shot.app"
read -k 1 "?Press any key to close."
