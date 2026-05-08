#!/usr/bin/env python3
"""
Build a single-page screenshot gallery from Playwright trace artifacts.

Usage: generate_visual_gallery.py <traces-dir> <report-dir>

Walks ``traces-dir`` for ``*-actual.png`` (skipping ``*-retry*`` dirs), pairs
each with sibling ``*-expected.png`` / ``*-diff.png``, copies them into
``<report-dir>/gallery-images/``, and writes the gallery to ``<report-
dir>/index.html``. Any existing Playwright ``index.html`` is moved aside to
``report.html`` and linked from the gallery header.
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

_CSS = """
:root { color-scheme: light dark; }
body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 1.25rem; }
h1 { margin: 0 0 .25rem; }
.sub { color: #666; margin: 0 0 1.25rem; }
.row { margin: 0 0 2rem; padding: .75rem; border-radius: 6px;
       background: rgba(127,127,127,0.06); border: 1px solid rgba(127,127,127,0.2); }
.row h3 { margin: 0 0 .5rem; font-size: .95rem; word-break: break-all; }
.row h3 a { color: inherit; text-decoration: none; }
.row h3 a:hover { text-decoration: underline; }
.cells { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
         gap: .75rem; align-items: start; }
.cell { margin: 0; max-height: 600px; overflow: auto;
        border: 1px solid rgba(127,127,127,0.25); border-radius: 3px;
        background: rgba(0,0,0,0.02); }
.cell figcaption { position: sticky; top: 0; z-index: 1;
                   font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
                   color: #888; padding: .25rem .5rem;
                   background: rgba(255,255,255,0.85);
                   backdrop-filter: blur(4px);
                   border-bottom: 1px solid rgba(127,127,127,0.15); }
@media (prefers-color-scheme: dark) {
  .cell figcaption { background: rgba(20,20,20,0.85); }
}
.cell img { width: 100%; height: auto; display: block; cursor: zoom-in; }
.cell.missing { max-height: none; overflow: visible; border: none; background: none; }
.cell.missing .placeholder { display: flex; align-items: center; justify-content: center;
                             height: 6rem; color: #888; font-size: .8rem;
                             border: 1px dashed rgba(127,127,127,0.4); border-radius: 3px; }
.empty { color: #888; }
.lb { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.92); z-index: 9999;
      cursor: zoom-out; padding: 1rem; overflow: auto; }
.lb.show { display: block; }
.lb img { display: block; margin: 0 auto; max-width: 100%; }
"""

_JS = """
const lb = document.getElementById('lb'), lbi = document.getElementById('lbi');
document.querySelectorAll('.cell a').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); lbi.src = a.querySelector('img').src;
  lb.scrollTop = 0; lb.classList.add('show');
}));
lb.addEventListener('click', () => lb.classList.remove('show'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('show'); });
"""


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
        # Playwright re-runs failures under *-retry<N>/; skip so each test
        # contributes one tile.
        parent = actual.parent.name
        if "-retry" in parent:
            continue
        stem = actual.name[: -len(ACTUAL_SUFFIX)]
        key = f"{parent}/{stem}"
        if key in seen:
            continue
        seen.add(key)

        prefix = f"{parent}__{stem}"
        tiles.append(
            Tile(
                label=stem,
                expected=_copy_if_exists(
                    actual.with_name(f"{stem}{EXPECTED_SUFFIX}"),
                    images_dir,
                    f"{prefix}-expected.png",
                ),
                actual=_copy_if_exists(
                    actual, images_dir, f"{prefix}-actual.png"
                ),
                diff=_copy_if_exists(
                    actual.with_name(f"{stem}{DIFF_SUFFIX}"),
                    images_dir,
                    f"{prefix}-diff.png",
                ),
            )
        )

    tiles.sort(key=lambda t: t.label)
    return tiles


def _figure(images_subdir: str, kind: str, name: str | None) -> str:
    """Render one image cell, or a placeholder if the file is missing."""
    if name is None:
        inner = '<div class="placeholder">not captured</div>'
        cls = "cell missing"
    else:
        src = f"{images_subdir}/{html.escape(name)}"
        inner = (
            f'<a href="{src}"><img src="{src}" loading="lazy" alt="{kind}"></a>'
        )
        cls = "cell"
    return (
        f'<figure class="{cls}"><figcaption>{kind}</figcaption>{inner}</figure>'
    )


def _row(t: Tile, images_subdir: str) -> str:
    label = html.escape(t.label)
    cells = "".join(
        _figure(images_subdir, kind, name)
        for kind, name in (
            ("expected", t.expected),
            ("actual", t.actual),
            ("diff", t.diff),
        )
    )
    return (
        f'<section class="row" id="{label}">'
        f'<h3><a href="#{label}">{label}</a></h3>'
        f'<div class="cells">{cells}</div></section>'
    )


def render_html(
    tiles: list[Tile],
    images_subdir: str = "gallery-images",
    *,
    has_playwright_report: bool = True,
) -> str:
    """
    Build the gallery HTML page.

    If ``has_playwright_report`` is False, the header link to the full
    Playwright report is omitted to avoid a dead link.
    """
    body = "\n".join(_row(t, images_subdir) for t in tiles) or (
        '<p class="empty">No failing screenshots found.</p>'
    )
    count = len(tiles)
    plural = "" if count == 1 else "s"
    report_link = (
        ' · <a href="report.html">open full Playwright report</a>'
        if has_playwright_report
        else ""
    )
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        "<title>Visual diff gallery</title>\n"
        f"<style>{_CSS}</style>\n</head>\n<body>\n"
        "<h1>Visual diff gallery</h1>\n"
        f'<p class="sub">{count} failing screenshot{plural} · click any image '
        f"to enlarge · scroll within a cell to see tall screenshots"
        f"{report_link}</p>\n"
        f"{body}\n"
        '<div class="lb" id="lb"><img id="lbi" alt=""></div>\n'
        f"<script>{_JS}</script>\n"
        "</body>\n</html>\n"
    )


def install_as_index(report_dir: Path, gallery_html: str) -> None:
    """Make the gallery the landing page; preserve Playwright at report.html."""
    playwright_index = report_dir / "index.html"
    if playwright_index.exists():
        playwright_index.replace(report_dir / "report.html")
    (report_dir / "index.html").write_text(gallery_html, encoding="utf-8")


def main(traces_dir: Path, report_dir: Path) -> None:
    """Build the gallery and install it as index.html."""
    tiles = collect_tiles(traces_dir, report_dir / "gallery-images")
    page = render_html(
        tiles, has_playwright_report=(report_dir / "index.html").exists()
    )
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
