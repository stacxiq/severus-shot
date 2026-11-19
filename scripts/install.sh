#!/bin/sh
# Installs the latest released Severus Shot on macOS or Linux.
#   curl -fsSL https://raw.githubusercontent.com/stacxiq/severus-shot/main/scripts/install.sh | sh
# Set REPO below (or pass REPO=owner/name) to the GitHub repository that hosts the releases.
set -eu
REPO="${REPO:-stacxiq/severus-shot}"


need() { command -v "$1" >/dev/null 2>&1 || { echo "This installer needs '$1'." >&2; exit 1; }; }
need curl

api="https://api.github.com/repos/$REPO/releases/latest"
assets=$(curl -fsSL "$api" | grep '"browser_download_url"' | sed 's/.*"\(https[^"]*\)".*/\1/')
[ -n "$assets" ] || { echo "No published release found for $REPO." >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

case "$(uname -s)" in
  Darwin)
    url=$(printf '%s\n' "$assets" | grep '\.dmg$' | head -n 1)
    [ -n "$url" ] || { echo "No macOS download in the latest release." >&2; exit 1; }
    echo "Downloading $url"
    curl -fL --progress-bar -o "$tmp/severus-shot.dmg" "$url"
    mount=$(hdiutil attach -nobrowse -readonly "$tmp/severus-shot.dmg" | tail -n 1 | sed 's/.*\(\/Volumes\/.*\)/\1/')
    dest="/Applications"; [ -w "$dest" ] || dest="$HOME/Applications"
    mkdir -p "$dest"
    rm -rf "$dest/Severus Shot.app"
    cp -R "$mount/Severus Shot.app" "$dest/"
    hdiutil detach "$mount" >/dev/null
    # The app is not signed with an Apple developer certificate, so macOS would refuse to open a
    # downloaded copy. Removing the download flag is what "right-click > Open" does by hand.
    xattr -dr com.apple.quarantine "$dest/Severus Shot.app" 2>/dev/null || true
    mkdir -p "$HOME/.local/bin"
    ln -sf "$dest/Severus Shot.app/Contents/MacOS/severus-shot" "$HOME/.local/bin/severus-shot"
    echo "Installed in $dest. Open it from Launchpad or run: open \"$dest/Severus Shot.app\""
    ;;
  Linux)
    url=$(printf '%s\n' "$assets" | grep '\.AppImage$' | head -n 1)
    [ -n "$url" ] || { echo "No Linux AppImage in the latest release." >&2; exit 1; }
    echo "Downloading $url"
    mkdir -p "$HOME/.local/bin"
    curl -fL --progress-bar -o "$HOME/.local/bin/severus-shot" "$url"
    chmod +x "$HOME/.local/bin/severus-shot"
    echo "Installed as ~/.local/bin/severus-shot (make sure ~/.local/bin is on your PATH)."
    ;;
  *) echo "Unsupported system. On Windows, download the -setup.exe from the Releases page." >&2; exit 1 ;;
esac
echo "Optional: install ffmpeg to export motion videos."
