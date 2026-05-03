#!/usr/bin/env python3
"""
Generate a single-page screenshot gallery from Playwright trace artifacts.

The Playwright HTML report buries each shot behind a click-into-a-test panel,
which is painful to skim for ~100 bootstrap shots. This emits a self-contained
`gallery.html` next to it: one tile per failed-comparison screenshot, click-to-
enlarge lightbox, sorted by test label.

Usage: generate-visual-gallery.py <traces-dir> <report-dir>   traces-dir  Root
of downloaded `playwright-traces-*` artifacts. Globbed               recursively
for `*-actual.png` files, skipping `*-retry*`               dirs to avoid
duplicates from Playwright's retry pass.   report-dir  Existing playwright-
report directory. The script writes               `<report-dir>/gallery.html`
and copies images to               `<report-dir>/gallery-images/`.
"""

from __future__ import annotations

import html
import shutil
import sys
from pathlib import Path


def main(traces_dir: Path, report_dir: Path) -> None:
    images_dir = report_dir / "gallery-images"
    images_dir.mkdir(parents=True, exist_ok=True)

    seen: set[str] = set()
    tiles: list[tuple[str, str]] = []  # (label, copied filename)

    for actual in sorted(traces_dir.rglob("*-actual.png")):
        parent = actual.parent.name
        # Playwright re-runs failed tests in *-retry<N>/ subdirs; skip those
        # so each test contributes one tile.
        if "-retry" in parent:
            continue
        # Use parent dir as the test label — Playwright already sanitizes
        # it to a (somewhat) human-readable form.
        if parent in seen:
            continue
        seen.add(parent)

        dest_name = f"{parent}__{actual.name}"
        shutil.copy(actual, images_dir / dest_name)
        tiles.append((parent, dest_name))

    tiles.sort(key=lambda t: t[0])

    tile_html = "\n".join(
        f'<a class="tile" href="gallery-images/{html.escape(name)}" '
        f'data-label="{html.escape(label)}">'
        f'<img src="gallery-images/{html.escape(name)}" loading="lazy" '
        f'alt="{html.escape(label)}">'
        f"<p>{html.escape(label)}</p>"
        f"</a>"
        for label, name in tiles
    )

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visual screenshot gallery</title>
<style>
:root {{ color-scheme: light dark; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 1.25rem; }}
h1 {{ margin: 0 0 .25rem; }}
.sub {{ color: #666; margin: 0 0 1.25rem; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }}
.tile {{ display: block; text-decoration: none; color: inherit; padding: .5rem; border-radius: 4px;
        background: rgba(127,127,127,0.06); border: 1px solid rgba(127,127,127,0.2); }}
.tile:hover {{ background: rgba(127,127,127,0.12); }}
.tile img {{ width: 100%; height: auto; display: block; border: 1px solid rgba(127,127,127,0.2); cursor: zoom-in; }}
.tile p {{ font-size: .8rem; word-break: break-all; margin: .35rem 0 0; }}
.lb {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,.9); z-index: 9999;
       align-items: center; justify-content: center; cursor: zoom-out; padding: 1rem; }}
.lb.show {{ display: flex; }}
.lb img {{ max-width: 100%; max-height: 100%; }}
</style>
</head>
<body>
<h1>Visual screenshot gallery</h1>
<p class="sub">{len(tiles)} screenshot{'s' if len(tiles) != 1 else ''} · click any tile to enlarge · <a href="index.html">back to Playwright report</a></p>
<div class="grid">
{tile_html}
</div>
<div class="lb" id="lb"><img id="lbi" alt=""></div>
<script>
const lb = document.getElementById('lb'); const lbi = document.getElementById('lbi');
document.querySelectorAll('.tile').forEach(t => t.addEventListener('click', e => {{
  e.preventDefault(); lbi.src = t.querySelector('img').src; lb.classList.add('show');
}}));
lb.addEventListener('click', () => lb.classList.remove('show'));
document.addEventListener('keydown', e => {{ if (e.key === 'Escape') lb.classList.remove('show'); }});
</script>
</body>
</html>
"""

    (report_dir / "gallery.html").write_text(page, encoding="utf-8")
    print(f"Wrote {report_dir / 'gallery.html'} with {len(tiles)} tiles")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            f"usage: {sys.argv[0]} <traces-dir> <report-dir>", file=sys.stderr
        )
        sys.exit(2)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
