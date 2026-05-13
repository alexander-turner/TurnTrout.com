#!/usr/bin/env bash

set -e

# Only subset files that are larger than 1100 bytes
html_files=$(find public -type f -size +1100c -name "*.html")

# Count number of files
num_files=$(echo "$html_files" | wc -l)
echo "Subsetting fonts in $num_files files"

# Run subfont on all files with increased heap size (12GB).
# ubuntu-24.04 runners have 16GB RAM available. The "inject subset
# font-family into CSS/SVG" pass holds every page in memory at once and
# pushed past the previous 6GB cap (mark-compact OOM at ~6.0/6.2GB).
# Note: this fork only emits woff2 and doesn't support font instancing, so
# shellcheck disable=SC2086
NODE_OPTIONS="--max-old-space-size=12288" pnpm exec subfont --root public/ $html_files --in-place --inline-css --no-recursive --debug

# Refresh config/font_stats.md from the just-emitted subset woff2s so the
# design page picks up current sizes on the next build.
echo "Regenerating config/font_stats.md"
npx tsx scripts/gen_font_stats.ts
