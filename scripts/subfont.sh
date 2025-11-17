#!/usr/bin/env bash

set -e

# Only subset files that are larger than 1100 bytes
html_files=$(find public -type f -size +1100c -name "*.html")

# Count number of files
num_files=$(echo "$html_files" | wc -l)
echo "Subsetting fonts in $num_files files"

# Run subfont on all files with increased heap size (6GB)
# GitHub Actions ubuntu-22.04 runners have 7GB RAM available
# shellcheck disable=SC2086
NODE_OPTIONS="--max-old-space-size=6144" subfont --root public/ $html_files --formats woff2 --in-place --instance --inline-css --no-recursive

