# Chart pipeline — handoff notes

> **Status: on hold.** PR #722 (`claude/build-svg-chart-renderer-E3hwk`, the
> chart renderer foundation) is **not ready to merge**, per alex. The three
> chart branches depend on it either directly (renderer) or semantically (the
> Python CLI's output isn't useful without the renderer understanding `data:
> <path>`). Nothing in this pipeline should be merged until #722 is ready.
>
> The tagSmallcaps skip-SVG fix is **independent** and fine to land any time —
> see that row below.

## Branches

| Branch | Tip | Mergeable? | Description |
|---|---|---|---|
| `claude/build-svg-chart-renderer-E3hwk` | — | **on hold** (owned by alex) | PR #722. Chart renderer foundation. Not ready. |
| `claude/chart-renderer-csv-path` | `66039f6` | **blocked by #722** | Adds `data: <csv path>` sidecar support + typed errors. Branched off PR #722. |
| `claude/chart-extract-script` | `d960d11` | blocked on #722 semantically — output presumes a renderer that understands `data: <path>` | Python CLI: CSV + block from a chart image. URL input, TS round-trip validation against `parseChartSpec`, 50 MB download cap. Based on `dev`. |
| `claude/tagsmallcaps-skip-svg` | `92c1b4b` | **yes — independent** | Principled fix: skip smallcaps on all SVG subtrees (same category as `<style>` / `katex`). Also benefits Mermaid diagrams. Based on `dev`. |
| `claude/chart-pipeline-handoff` | this | n/a — scratch | This doc. Based on `dev`. |

If #722 meaningfully restructures, the two `claude/chart-*` branches will
need rebasing (and the typed-error / CSV tests re-running). The script
branch touches only `scripts/` so most conflicts would be on the YAML
schema — small diff either way.

### Sandbox note — OTS stamping

The Anthropic dev sandbox runs a TLS-inspection MITM on outbound traffic
(`sandbox-egress-production TLS Inspection CA` replaces the upstream
cert). Some OTS calendar upstreams reject handshakes coming from this
inspection cert with `SSLV3_ALERT_HANDSHAKE_FAILURE`, which surfaces as
`upstream connect error … DNS cache overflow` at the Envoy layer. The
sandbox isn't blocking OTS — the upstream is refusing the inspected
handshake. This is intermittent; most commits in this pipeline stamped
fine, a handful needed retry. Not actionable from inside the sandbox.

---

## TODOs — immediately implied (definitely do)

1. **When (if) PR #722 is ready**, drop its inline `<tspan>` workaround — the `hasSvgAncestor` check in `quartz/plugins/transformers/tagSmallcaps.ts:254–258` becomes dead code once `claude/tagsmallcaps-skip-svg` lands.
2. **When (if) PR #722 is ready**, rebase `claude/chart-renderer-csv-path` onto its final form and re-run `pnpm test -- quartz/plugins/transformers/charts.test.ts` (should be 75 green).
3. **Merge order, once everything is ready**: #722 first → `chart-renderer-csv-path` second → `chart-extract-script` third. The script's `data: ./foo.csv` blocks won't parse until the renderer understands them; shipping the script in isolation would produce blocks that fail `parseChartSpec`.

## TODOs — judgment calls (discuss first)

4. **Extend pricing in `_MODEL_COSTS`** (`scripts/chart_extract.py:147`) when model prices change or new models are used. Currently covers: claude-sonnet-4-6, claude-opus-4-7, gemini-2.5-pro, gemini-2.5-flash, gpt-5.
5. **Confirm `llm` CLI schema format** against a real model. I tested the pipeline structurally; I haven't proven `llm --schema <file>` works end-to-end against a specific llm-anthropic/llm-gemini version. First real call may need schema tweaks.
6. ~~**Round-trip through `parseChartSpec` in Python**~~ — **DONE in `d960d11`**. `scripts/chart_spec_validator.ts` reads YAML on stdin, runs it through `parseChartSpec`, exits 1 on reject. `validate_spec_via_tsx` in `chart_extract.py` wires it in. Skipped silently when `npx`/`tsx`/`node` are missing.
7. **Markdown-scan driver** — design doc at `scripts/notebooks/convert_existing_graphs.py`. Not implemented; raises `NotImplementedError` only when run as `__main__` so it's safe to import. Four open design questions captured in the module docstring for the next session to resolve with alex.
8. ~~**URL-input support**~~ — **DONE in `d960d11`**. `extract_chart` accepts `http(s)://` URLs; downloads to a tempdir with a 50 MB cap (`_DOWNLOAD_MAX_BYTES`). Same UA as `alt_text_llm.utils.download_asset` so CDNs that reject bare clients still accept ours. No alt-text-llm lib dep re-added.
9. **Symlink confinement** in `hydrateFromCsv` (`quartz/plugins/transformers/charts.ts:147–183`). Current path-traversal check prevents `data: "../../../.env"` but not `data: "./evil.csv"` where `evil.csv` is a symlink to `/etc/passwd`. Acceptable for this site's threat model (single-author) but worth mentioning if external PRs ever become routine.
10. **csv.ts doesn't support RFC 4180 quoting.** Quoted fields (from pandas when a series name has commas) are rejected loudly. A real CSV parser (e.g. `csv-parse`) would accept them. My design says "validate series names in Python, reject quotes loudly" — if you ever want hand-written notebook CSVs to work without renaming, implement RFC 4180 on the TS side.
11. **Multi-series CSV layout.** Currently one CSV per chart in long format (`x,y,series`). Multi-series wide-format (`x,loss,accuracy`) is a reasonable alternative; would need a `from_column` selector in `SeriesSpec`.
12. **Chart types beyond `line`.** Real backfill will need bar, scatter, stacked, possibly with error bars. Schema and `line-renderer.ts` would need extension. Not a drop-in change.
13. **Visual-regression baseline.** No `lost-pixel` test pins the rendered chart's pixels. D3 version bumps could silently shift the output. Add a baseline once a few real charts exist.
14. **DeepSource** flagged `PTC-W0062` on nested `with` blocks; already fixed in `48a7585`. Keep an eye out — autoformatting can reintroduce.

---

## Manual testing instructions

### Prerequisites (one-time)

```bash
# Simon Willison's LLM CLI + a model plugin
uv tool install llm
llm install llm-anthropic    # or llm-gemini, llm-ollama, etc.
llm keys set anthropic       # paste your Anthropic key

# Already installed in this repo: ImageMagick (`magick`), Node, pnpm
```

### Test 1: script produces CSV + block from an image

Prerequisite: a local chart image. You can use any AVIF/PNG from `website_content/`.

```bash
git checkout claude/chart-extract-script
pnpm install
uv sync

# Pick a real chart (the gradient-routing post has many)
cp /path/to/some-chart.avif /tmp/test-chart.avif

python -m scripts.chart_extract /tmp/test-chart.avif \
  -m claude-sonnet-4-6 \
  --print-yaml
```

Expected outputs:
- `/tmp/test-chart.csv` written next to the image, long-format `x,y,series`
- `/tmp/chart-queue.json` work-queue with the result (resumable)
- On stdout: the ```chart fenced block with `data: ./test-chart.csv`

Verify:
```bash
head /tmp/test-chart.csv
cat /tmp/chart-queue.json | jq '.[0] | {source_image, csv_path, error}'
```

### Test 2: renderer consumes the block + CSV

```bash
git checkout claude/chart-renderer-csv-path    # already includes PR #722 foundation
pnpm install

# Drop the block into a real markdown file alongside the CSV
mkdir -p website_content/scratch
cp /tmp/test-chart.csv website_content/scratch/

cat > website_content/scratch/chart-test.md <<'EOF'
---
title: Chart pipeline smoke test
permalink: chart-test
---

# Chart pipeline smoke test

<paste the ```chart block from Test 1 here>
EOF

# Build (offline mode since sandbox egress may block Cloudflare)
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --offline
```

Expected: build succeeds; `public/chart-test.html` contains `<svg class="smart-chart">` with the right number of `<circle class="smart-chart-point">` elements (one per CSV row).

To eyeball:
```bash
pnpm preview    # serves on :8080
# open http://localhost:8080/chart-test
```

### Test 3: error paths fail loudly

Drop a bad block into the markdown file and rebuild:

```markdown
```chart
type: line
x: { label: X }
y: { label: Y }
data: ../../../etc/passwd
series: [ { name: S } ]
```
```

Expected: `ChartDataPathError: chart data path "../../../etc/passwd" escapes the markdown directory`

Other error surfaces to try:
- `data: ./nonexistent.csv` → `ChartDataPathError: chart references data: ... but cannot read ...`
- CSV with a quoted field like `"Loss, normalized"` → `ChartCsvError: quoted CSV fields are not supported`
- Block missing `y.label` → `ChartSpecError: Chart "y" axis must have a string "label"`

### Test 4: run both test suites

```bash
# Python
git checkout claude/chart-extract-script
uv run pytest scripts/tests/test_chart_extract.py   # 57 passed, 100% coverage

# TS
git checkout claude/chart-renderer-csv-path
pnpm test -- quartz/plugins/transformers/charts.test.ts   # 75 passed, 100% coverage
```

### Cleanup after manual testing

```bash
rm -rf website_content/scratch    # or keep as a canary
rm -f /tmp/test-chart.* /tmp/chart-queue.json
rm -rf /tmp/roundtrip              # leftover from my earlier demo
```
