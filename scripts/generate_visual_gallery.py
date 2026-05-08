#!/usr/bin/env python3
"""
Generate a single-page screenshot gallery from Playwright trace artifacts.

The Playwright HTML report buries each shot behind a click-into-a-test panel,
which is painful to skim for many failures. This emits a self-contained gallery:
one row per failed screenshot with expected, actual, and diff side-by-side,
click-to-enlarge lightbox.

Usage: generate_visual_gallery.py <traces-dir> <report-dir>   traces-dir  Root
of downloaded `playwright-traces-*` artifacts. Globbed               recursively
for `*-actual.png` files, skipping `*-retry*`               dirs to avoid
duplicates from Playwright's retry pass.   report-dir  Existing playwright-
report directory. The script writes               `<report-dir>/index.html`
(replacing Playwright's index, which               is preserved at
`report.html`) and copies images to               `<report-dir>/gallery-
images/`.
"""

from __future__ import annotations

import html
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

ACTUAL_SUFFIX = "-actual.png"
EXPECTED_SUFFIX = "-expected.png"
DIFF_SUFFIX = "-diff.png"


@dataclass(frozen=True)
class Tile:
    """One failing screenshot: expected vs actual vs diff."""

    label: str
    expected: str | None
    actual: str | None
    diff: str | None


def _copy_if_exists(src: Path, dest_dir: Path, dest_name: str) -> str | None:
    """Copy src into dest_dir as dest_name; return the copied filename."""
    if not src.exists():
        return None
    shutil.copy(src, dest_dir / dest_name)
    return dest_name


def collect_tiles(traces_dir: Path, images_dir: Path) -> list[Tile]:
    """Walk traces_dir for failing screenshots and copy them into images_dir."""
    images_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    tiles: list[Tile] = []

    for actual in sorted(traces_dir.rglob(f"*{ACTUAL_SUFFIX}")):
        # Playwright re-runs failed tests in *-retry<N>/ subdirs; skip those
        # so each test contributes one tile.
        if "-retry" in actual.parent.name:
            continue
        stem = actual.name[: -len(ACTUAL_SUFFIX)]
        key = f"{actual.parent.name}/{stem}"
        if key in seen:
            continue
        seen.add(key)

        prefix = f"{actual.parent.name}__{stem}"
        expected_src = actual.with_name(f"{stem}{EXPECTED_SUFFIX}")
        diff_src = actual.with_name(f"{stem}{DIFF_SUFFIX}")

        tiles.append(
            Tile(
                label=stem,
                expected=_copy_if_exists(
                    expected_src, images_dir, f"{prefix}-expected.png"
                ),
                actual=_copy_if_exists(
                    actual, images_dir, f"{prefix}-actual.png"
                ),
                diff=_copy_if_exists(
                    diff_src, images_dir, f"{prefix}-diff.png"
                ),
            )
        )

    tiles.sort(key=lambda t: t.label)
    return tiles


def _figure(images_subdir: str, kind: str, name: str | None) -> str:
    """Render one image cell, or a placeholder if the file is missing."""
    if name is None:
        return (
            f'<figure class="cell missing">'
            f"<figcaption>{kind}</figcaption>"
            f'<div class="placeholder">not captured</div>'
            f"</figure>"
        )
    src = f"{images_subdir}/{html.escape(name)}"
    return (
        f'<figure class="cell">'
        f"<figcaption>{kind}</figcaption>"
        f'<a href="{src}"><img src="{src}" loading="lazy" alt="{kind}"></a>'
        f"</figure>"
    )


def render_html(
    tiles: list[Tile], images_subdir: str = "gallery-images"
) -> str:
    """Build the gallery HTML page."""
    rows = "\n".join(
        f'<section class="row" id="{html.escape(t.label)}">'
        f'<h3><a href="#{html.escape(t.label)}">{html.escape(t.label)}</a></h3>'
        f'<div class="cells">'
        f'{_figure(images_subdir, "expected", t.expected)}'
        f'{_figure(images_subdir, "actual", t.actual)}'
        f'{_figure(images_subdir, "diff", t.diff)}'
        f"</div>"
        f"</section>"
        for t in tiles
    )

    body = rows or '<p class="empty">No failing screenshots found.</p>'
    count = len(tiles)
    plural = "" if count == 1 else "s"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visual diff gallery</title>
<style>
:root {{ color-scheme: light dark; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 1.25rem; }}
h1 {{ margin: 0 0 .25rem; }}
.sub {{ color: #666; margin: 0 0 1.25rem; }}
.row {{ margin: 0 0 2rem; padding: .75rem; border-radius: 6px;
       background: rgba(127,127,127,0.06); border: 1px solid rgba(127,127,127,0.2); }}
.row h3 {{ margin: 0 0 .5rem; font-size: .95rem; word-break: break-all; }}
.row h3 a {{ color: inherit; text-decoration: none; }}
.row h3 a:hover {{ text-decoration: underline; }}
.cells {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: .75rem; align-items: start; }}
.cell {{ margin: 0; }}
.cell figcaption {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
                    color: #888; margin: 0 0 .25rem; }}
.cell img {{ width: 100%; height: auto; display: block; cursor: zoom-in;
             border: 1px solid rgba(127,127,127,0.25); border-radius: 3px; }}
.cell.missing .placeholder {{ display: flex; align-items: center; justify-content: center;
                              height: 6rem; color: #888; font-size: .8rem;
                              border: 1px dashed rgba(127,127,127,0.4); border-radius: 3px; }}
.empty {{ color: #888; }}
.lb {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,.92); z-index: 9999;
       align-items: center; justify-content: center; cursor: zoom-out; padding: 1rem; }}
.lb.show {{ display: flex; }}
.lb img {{ max-width: 100%; max-height: 100%; }}
</style>
</head>
<body>
<h1>Visual diff gallery</h1>
<p class="sub">{count} failing screenshot{plural} · click any image to enlarge · <a href="report.html">open full Playwright report</a></p>
{body}
<div class="lb" id="lb"><img id="lbi" alt=""></div>
<script>
const lb = document.getElementById('lb'); const lbi = document.getElementById('lbi');
document.querySelectorAll('.cell a').forEach(a => a.addEventListener('click', e => {{
  e.preventDefault(); lbi.src = a.querySelector('img').src; lb.classList.add('show');
}}));
lb.addEventListener('click', () => lb.classList.remove('show'));
document.addEventListener('keydown', e => {{ if (e.key === 'Escape') lb.classList.remove('show'); }});
</script>
</body>
</html>
"""


def install_as_index(report_dir: Path, gallery_html: str) -> None:
    """Make the gallery the landing page; preserve Playwright at report.html."""
    playwright_index = report_dir / "index.html"
    if playwright_index.exists():
        playwright_index.replace(report_dir / "report.html")
    (report_dir / "index.html").write_text(gallery_html, encoding="utf-8")


def main(traces_dir: Path, report_dir: Path) -> None:
    """Build the gallery and install it as index.html."""
    images_dir = report_dir / "gallery-images"
    tiles = collect_tiles(traces_dir, images_dir)
    page = render_html(tiles)
    # Keep gallery.html for backward-compatible deep links.
    (report_dir / "gallery.html").write_text(page, encoding="utf-8")
    install_as_index(report_dir, page)
    print(f"Wrote {report_dir / 'index.html'} with {len(tiles)} tiles")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            f"usage: {sys.argv[0]} <traces-dir> <report-dir>", file=sys.stderr
        )
        sys.exit(2)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
