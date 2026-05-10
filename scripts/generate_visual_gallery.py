#!/usr/bin/env python3
"""
Generate a single-page diff gallery from Playwright trace artifacts.

For each failed visual comparison Playwright drops `*-actual.png`,
`*-expected.png`, and `*-diff.png` into a per-test directory under the test-
results tree. This emits a `gallery.html` showing one row per failed test with
the three images side-by-side at full natural height.

Loading is strictly sequential: row N's images don't start fetching until every
image in row N-1 has finished loading (or errored). Keeps the network steady on
big runs and lets you scroll without intermediate-state flicker.

Usage: generate-visual-gallery.py <traces-dir> <report-dir>     traces-dir  Root
of downloaded `playwright-traces-*` artifacts.     report-dir  Existing
playwright-report directory. The script writes                 `<report-
dir>/gallery.html` and copies images to                 `<report-dir>/gallery-
images/`.
"""

from __future__ import annotations

import html
import shutil
import sys
from pathlib import Path

ImageTriple = tuple[str | None, str | None, str | None]


def _image_for(actual: Path, suffix: str) -> Path | None:
    """Return the sibling PNG with `-actual` swapped for `-<suffix>`, or
    None."""
    candidate = actual.with_name(
        actual.name.replace("-actual.png", f"-{suffix}.png")
    )
    return candidate if candidate.exists() else None


def _collect_rows(
    traces_dir: Path, images_dir: Path
) -> list[tuple[str, ImageTriple]]:
    """Copy each test's expected/actual/diff PNGs into images_dir; return
    rows."""
    seen: set[str] = set()
    rows: list[tuple[str, ImageTriple]] = []

    for actual_path in sorted(traces_dir.rglob("*-actual.png")):
        parent = actual_path.parent.name
        if "-retry" in parent or parent in seen:
            continue
        seen.add(parent)

        triple: list[str | None] = []
        for path in (
            _image_for(actual_path, "expected"),
            actual_path,
            _image_for(actual_path, "diff"),
        ):
            if path is None:
                triple.append(None)
                continue
            dest_name = f"{parent}__{path.name}"
            shutil.copy(path, images_dir / dest_name)
            triple.append(dest_name)

        rows.append((parent, (triple[0], triple[1], triple[2])))

    rows.sort(key=lambda r: r[0])
    return rows


def _render_cell(kind: str, name: str | None, label: str) -> str:
    if name is None:
        return (
            f'<div class="cell missing"><span class="kind">{kind}</span>'
            f'<p class="placeholder">not produced</p></div>'
        )
    return (
        f'<div class="cell"><span class="kind">{kind}</span>'
        f'<img data-src="gallery-images/{html.escape(name)}" '
        f'alt="{html.escape(label)} {kind}"></div>'
    )


def _render_rows_html(rows: list[tuple[str, ImageTriple]]) -> str:
    parts: list[str] = []
    for label, (expected, actual, diff) in rows:
        cells = "".join(
            _render_cell(kind, name, label)
            for kind, name in (
                ("expected", expected),
                ("actual", actual),
                ("diff", diff),
            )
        )
        parts.append(
            f'<section class="row" data-label="{html.escape(label)}">'
            f"<h2>{html.escape(label)}</h2>"
            f'<div class="triple">{cells}</div>'
            f"</section>"
        )
    return "\n".join(parts)


def main(traces_dir: Path, report_dir: Path) -> None:
    """Build a static side-by-side diff gallery from Playwright artifacts."""
    images_dir = report_dir / "gallery-images"
    images_dir.mkdir(parents=True, exist_ok=True)

    rows = _collect_rows(traces_dir, images_dir)
    row_html = _render_rows_html(rows)

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visual diff gallery</title>
<style>
:root {{ color-scheme: light dark; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 1.25rem; }}
h1 {{ margin: 0 0 .25rem; }}
.sub {{ color: #666; margin: 0 0 1.25rem; }}
.row {{ margin: 0 0 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(127,127,127,0.25); }}
.row h2 {{ font-size: 1rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; margin: 0 0 .75rem; color: #333; }}
.triple {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; align-items: start; }}
.cell {{ display: flex; flex-direction: column; gap: .35rem; min-width: 0; }}
.cell .kind {{ font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: #888; }}
.cell img {{ width: 100%; height: auto; display: block; border: 1px solid rgba(127,127,127,0.3);
            background: rgba(127,127,127,0.06); cursor: zoom-in; }}
.cell.missing {{ background: rgba(127,127,127,0.05); border: 1px dashed rgba(127,127,127,0.3);
                padding: 1.25rem; text-align: center; min-height: 6rem;
                display: flex; flex-direction: column; align-items: center; justify-content: center; }}
.cell .placeholder {{ color: #888; font-size: .8rem; margin: 0; }}
.lb {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,.92); z-index: 9999;
       align-items: center; justify-content: center; cursor: zoom-out; padding: 1rem; overflow: auto; }}
.lb.show {{ display: flex; }}
.lb img {{ max-width: 100%; max-height: 100%; }}
@media (prefers-color-scheme: dark) {{
  .row h2 {{ color: #ddd; }}
  .row {{ border-color: rgba(255,255,255,0.15); }}
}}
</style>
</head>
<body>
<h1>Visual diff gallery</h1>
<p class="sub">{len(rows)} failing comparison{'s' if len(rows) != 1 else ''} · expected / actual / diff side-by-side · click any image to enlarge · <a href="report.html">Playwright report</a></p>
{row_html}
<div class="lb" id="lb"><img id="lbi" alt=""></div>
<script>
// Sequential row loading: row N's <img> elements only get their src set
// once every <img> in row N-1 has either finished loading or errored.
// Keeps fetch parallelism predictable on multi-hundred-row diffs.
(() => {{
  const rows = Array.from(document.querySelectorAll('.row'));

  function loadRow(idx) {{
    if (idx >= rows.length) return;
    const imgs = Array.from(rows[idx].querySelectorAll('img[data-src]'));
    if (imgs.length === 0) {{
      loadRow(idx + 1);
      return;
    }}
    let pending = imgs.length;
    const done = () => {{ if (--pending === 0) loadRow(idx + 1); }};
    imgs.forEach(img => {{
      img.addEventListener('load', done, {{ once: true }});
      img.addEventListener('error', done, {{ once: true }});
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }});
  }}
  loadRow(0);

  const lb = document.getElementById('lb');
  const lbi = document.getElementById('lbi');
  document.addEventListener('click', e => {{
    const img = e.target.closest('.cell img');
    if (!img) return;
    e.preventDefault();
    lbi.src = img.src;
    lb.classList.add('show');
  }});
  lb.addEventListener('click', () => lb.classList.remove('show'));
  document.addEventListener('keydown', e => {{ if (e.key === 'Escape') lb.classList.remove('show'); }});
}})();
</script>
</body>
</html>
"""

    (report_dir / "gallery.html").write_text(page, encoding="utf-8")
    print(f"Wrote {report_dir / 'gallery.html'} with {len(rows)} rows")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            f"usage: {sys.argv[0]} <traces-dir> <report-dir>", file=sys.stderr
        )
        sys.exit(2)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
