#!/usr/bin/env bash
# Check for required development dependencies
set -euo pipefail

REQUIRED="git node pnpm uv magick ffmpeg ffprobe exiftool vale sass rclone"

missing=()
for cmd in $REQUIRED; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
done

if [[ ${#missing[@]} -eq 0 ]]; then
    echo "All required tools installed."
else
    echo "Missing: ${missing[*]}"
    echo ""
    echo "Install on macOS:  brew install imagemagick ffmpeg exiftool vale sass rclone"
    echo "Install on Debian: sudo apt install imagemagick ffmpeg libimage-exiftool-perl vale dart-sass rclone"
    echo ""
    echo "Install uv:   curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo "Install pnpm: npm install -g pnpm"
fi

echo ""
echo "Then run:"
echo "  pnpm install && uv sync"
echo "  git config core.hooksPath .hooks"
