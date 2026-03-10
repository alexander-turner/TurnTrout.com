# Subfont CI Performance Investigation

## Problem

Subfont takes **60-90 minutes** on CI (GitHub Actions `ubuntu-24.04` runners with 7GB RAM), making the `prepare-deploy` job in the Deploy workflow take 85-96 minutes total. This blocks deploys to production.

## Root Cause Analysis

Subfont uses [AssetGraph](https://github.com/assetgraph/assetgraph) under the hood to parse all HTML files, build a dependency graph, and then subset fonts based on which glyphs are actually used. The timing breakdown from CI logs shows:

### Phase-by-Phase Timing (from two completed runs)

| Phase | Run 1 (seconds) | Run 2 (seconds) | Description |
|---|---|---|---|
| `loadAssets` | 316 | 346 | Parse all 386 HTML files |
| `populate` | 107 | 117 | Build dependency graph by following relations |
| `checkIncompatibleTypes` | 200 | 210 | Validate asset types |
| `applySourceMaps` | 130 | 126 | Process source maps |
| `populate` (2nd) | 49 | 47 | Re-populate after changes |
| **Silent gap** | **~2700** | **~3048** | **~45-50 minutes of silence** (likely font subsetting/`subsetFonts()`) |
| `populate` (3rd) | 44 | 64 | Post-subsetting populate |
| `serializeSourceMaps` | 159 | 163 | Serialize source maps back |
| `writeAssetsToDisc` | 0.7 | 0.7 | Write output |
| **Total** | ~3706s (~62 min) | ~4122s (~69 min) | End to end subfont time |

### Key Findings

1. **The ~45-50 minute silent gap is the biggest bottleneck.** This happens between the 2nd and 3rd `populate` calls, which corresponds to the `subsetFonts()` call in the subfont source code. During this time, subfont is analyzing every page's CSS, computing which glyphs each font-family uses across 386 HTML pages, and generating subsetted WOFF2 files.

2. **`loadAssets` takes ~5.5 minutes** to parse 386 HTML files. Each file is parsed into a full DOM/AST.

3. **`checkIncompatibleTypes` takes ~3.5 minutes** - this seems disproportionate for what should be a validation step.

4. **Source map processing takes ~5 minutes total** (`applySourceMaps` + `serializeSourceMaps`) - this is wasted work since font subsetting doesn't need source maps.

5. **The existing patch** (`patches/subfont+7.2.1.patch`) already excludes image/media assets from being followed by AssetGraph, which helps but doesn't address the core bottleneck.

## Current Setup

### How subfont is invoked

**Script:** `scripts/subfont.sh`
```bash
#!/usr/bin/env bash
set -e
html_files=$(find public -type f -size +1100c -name "*.html")
num_files=$(echo "$html_files" | wc -l)
echo "Subsetting fonts in $num_files files"
NODE_OPTIONS="--max-old-space-size=6144" subfont --root public/ $html_files --formats woff2 --in-place --instance --inline-css --no-recursive
```

**CI integration:** `.github/workflows/deploy.yaml` (lines 117-125)
- Installs subfont globally: `pnpm add -g subfont`
- Only runs on push events (not PRs)
- Runs after `pnpm build` completes

### Dependencies
- `subfont`: version 6.12.5 in `package.json`, but `pnpm add -g subfont` installs 7.2.1 globally (which is what actually runs)
- `assetgraph`: overridden to 7.12.0 via pnpm overrides
- Custom patch adds image/media exclusions to the `noFollowTypes` list

### What subfont does
- Analyzes all 386 HTML pages to find which font glyphs are used
- Creates subsetted WOFF2 files containing only needed glyphs
- Inlines CSS `@font-face` rules into HTML pages
- Achieves 5x+ reduction in font payload (609KB → 113KB)

### CSS hints for subfont
In `quartz/styles/fonts.scss`:
```scss
-subfont-text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
```
This ensures characters used in CSS pseudo-elements are included in subsets.

## Potential Solutions (Ordered by Impact)

### 1. Process files in batches/parallel (High Impact)

Instead of passing all 386 files to a single subfont invocation, split them into smaller batches and run them in parallel. The font subsetting logic could potentially run on groups of files simultaneously.

**Considerations:**
- Subfont needs to see ALL pages to compute the global glyph set for shared subsets
- A two-pass approach could work: (1) collect all used glyphs across all pages, (2) subset once, (3) inject CSS into pages in parallel
- Alternatively, accept per-page subsets (slightly larger total font payload but much faster)

### 2. Replace subfont with a custom solution (High Impact, High Effort)

Write a lighter-weight font subsetting pipeline:
1. Use a fast HTML parser (like `cheerio`) to extract text content from pages
2. Collect unique codepoints per font-family
3. Use `pyftsubset` (from `fonttools`) or `subset-font` npm package to subset fonts
4. Generate and inject the CSS

This avoids the heavy AssetGraph dependency entirely. AssetGraph parses every CSS file, JavaScript file, and builds a complete dependency graph — far more work than needed for font subsetting.

### 3. Cache subfont output (Medium Impact)

The font subsets only change when:
- Font files change
- Content changes (new glyphs used)
- CSS font-family rules change

Cache the subfont output and only re-run when these inputs change. Use a hash of font files + extracted text content as the cache key.

### 4. Reduce the number of HTML files processed (Medium Impact)

Currently processes 386 files (everything >1100 bytes). Many of these may use the same fonts with the same glyph sets. Options:
- **Deduplicate:** Group pages by their font requirements and only analyze representative pages
- **Pre-compute glyph set:** Extract text from all HTML files quickly (without AssetGraph), merge glyph sets, then run subfont on just one representative page per font configuration

### 5. Disable source map processing (Low-Medium Impact)

Source map handling takes ~5 minutes total. Subfont doesn't need source maps for font subsetting. If AssetGraph has a way to skip source map processing, this saves 5 minutes.

### 6. Use a faster CI runner (Low Impact, Easy)

Switch from `ubuntu-24.04` (2-core, 7GB) to a larger runner. The 6GB heap limit suggests memory pressure may also cause GC pauses during the silent gap.

## Files to Modify

| File | Purpose |
|---|---|
| `scripts/subfont.sh` | Main subfont invocation script |
| `.github/workflows/deploy.yaml` | CI workflow (lines 117-125) |
| `patches/subfont+7.2.1.patch` | AssetGraph relation exclusions |
| `package.json` | subfont dependency (line 157) |
| `scripts/built_site_checks.py` | Font preload validation (must still pass) |

## Constraints

- **Font preload validation must still pass:** `check_preloaded_fonts()` in `scripts/built_site_checks.py` verifies that HTML pages have `<link rel="preload" as="font" href="/subfont/ebgaramond...">` tags
- **Font subsetting quality must not regress:** The site uses EBGaramond, EBGaramondItalic, and several KaTeX fonts. All glyphs used on any page must be included
- **Inline CSS behavior must be preserved:** Subfont currently inlines `@font-face` CSS into pages with `--inline-css`
- **The `-subfont-text` CSS hint** must continue to work (includes characters used in pseudo-elements)
