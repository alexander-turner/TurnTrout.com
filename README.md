# Favicon bigram kerning audit

Every (preceding character, favicon) pair — "bigram" — that actually occurs on the
built site, rendered with production CSS/fonts and measured pixel-by-pixel.

- `bigrams.json` — 613 real bigrams mined from the built HTML (char, favicon domain,
  usage count, whether `close-text` spacing was applied, example pages/contexts).
- `results.json` — per-bigram measurements:
  - `hgapCss`: horizontal ink gap (rightmost text pixel → leftmost icon pixel), CSS px.
  - `min2dCss`: minimum 2-D ink-to-ink distance, CSS px (catches diagonal crowding).
- `gallery.html` — all 613 rendered cells sorted worst-first (self-contained; download and open).
- `sheets/tightest-40.png` — the 40 tightest pairs.
- `sheets/loosest-hgap-20.png` — the 20 most over-spaced pairs.
- `sheets/anchor-all.png` — every pair involving the same-page anchor icon.
- `sheets/real-context-semicolon-anchor.png` — the reported `;`+anchor case rendered in situ.
- `mine_bigrams.py` / `gen_harness.py` / `measure.mjs` / `gen_gallery.py` — the pipeline.
- `local-analysis-patches.diff` — uncommitted build patches used to run the site build
  inside the sandbox (favicon existence check against a local mirror, asset-dimension
  and tweet-snapshot fallbacks). Not intended to land.

Reference distribution of `min2dCss` across all pairs:
median 3.81px · p10 2.06px · p25 2.75px · p75 5.32px · p90 6.72px.
