# Favicon kerning audit

Measures the actual ink-to-ink clearance between every preceding glyph and
favicon ("bigram") that occurs on the built site, so spacing rules in
`quartz/styles/favicon.scss` (`$domain-left-insets`) and
`quartz/plugins/transformers/favicons.ts` (`charsToSpace` /
`charsToSpaceMost`) can be derived from data instead of eyeballing.

## How it works

The spacing model is `gap(glyph, icon) = glyph right-side bearing + margin +
icon left-ink inset`. The audit measures both unknowns:

1. `mine_bigrams.py` scans `public/**/*.html` for every favicon and records
   the last visible character before it → `bigrams.json`.
2. `gen_harness.py` renders each pair into `public/bigram-harness/` with
   production CSS/fonts, glyph painted red and favicon blue; it also writes
   `icons.html` with each favicon alone.
3. `measure.mjs` screenshots each cell at 4x and computes per-pair `hgapCss`
   (horizontal ink gap) and `min2dCss` (closest 2-D ink distance), plus each
   icon's ink insets → `results.json`, `icon_insets.json`.
4. `gen_gallery.py` emits `gallery.html` (all pairs, worst-first) and
   `summary.md`.

## Running

```bash
pnpm build                                # favicons only attach in online builds
python scripts/notebooks/favicon_kerning_audit/mine_bigrams.py
python scripts/notebooks/favicon_kerning_audit/gen_harness.py
python -m http.server 8917 --directory public &
node scripts/notebooks/favicon_kerning_audit/measure.mjs
python scripts/notebooks/favicon_kerning_audit/gen_gallery.py
```

Outputs land in `/tmp/favicon_kerning_audit/`.

If the CDN is unreachable (sandboxes), set `FAVICON_MIRROR_DIR` to a
directory of the favicon SVGs; `gen_harness.py` copies it to
`public/mirror/` and rewrites icon URLs to it.

## Updating the spacing rules

- `$domain-left-insets` (favicon.scss): `min(leftInset px, 2) / box px` from
  `icon_insets.json`. The 2px cap keeps round-left glyphs from landing inside
  deeply inset icon boxes.
- `charsToSpace(Most)` (favicons.ts): from per-char median clearance in
  `results.json` — chars whose ink runs ≥ ~1px past a round letter's right
  bearing get `close-text`; extreme overhangs (`f`, `Q`, `/`) get
  `closer-text`.
