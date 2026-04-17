#!/usr/bin/env bash

set -e

# Only subset files that are larger than 1100 bytes
html_files=$(find public -type f -size +1100c -name "*.html")

# Count number of files
num_files=$(echo "$html_files" | wc -l)
echo "Subsetting fonts in $num_files files"

# Run subfont on all files with increased heap size (6GB)
# GitHub Actions ubuntu-22.04 runners have 7GB RAM available
# Note: this fork only emits woff2 and doesn't support font instancing, so
# --formats and --instance are unused and intentionally omitted.
start_time=$(date +%s)
# shellcheck disable=SC2086
NODE_OPTIONS="--max-old-space-size=6144" subfont --root public/ $html_files --in-place --inline-css --no-recursive --debug
end_time=$(date +%s)
elapsed=$((end_time - start_time))
echo "Subfont completed in ${elapsed}s"

# Refresh config/font_stats.md from the just-emitted subset woff2s so the
# design page picks up current sizes on the next build.
echo "Regenerating config/font_stats.md"
npx tsx scripts/gen_font_stats.ts

