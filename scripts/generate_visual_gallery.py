#!/usr/bin/env python3
"""
Build a single-page screenshot gallery from Playwright trace artifacts.

Usage: generate_visual_gallery.py <traces-dir> <report-dir>        [--run-id N]
[--pr-number N]

Walks ``traces-dir`` for ``*-actual.png`` (skipping ``*-retry*`` dirs), pairs
each with sibling ``*-expected.png`` / ``*-diff.png``, copies them into
``<report-dir>/gallery-images/``, and writes the gallery to ``<report-
dir>/index.html``. Any existing Playwright ``index.html`` is moved aside to
``report.html`` and linked from the gallery header.

When ``--run-id`` is supplied the gallery includes an "Approve baselines" button
that POSTs to the same-origin Cloudflare Pages Function at ``/api/approve-
baselines``. The function validates the run (still-open PR or current main HEAD)
and dispatches ``update-visual-baselines.yaml`` using a PAT stored as a CF Pages
preview-env secret — the browser never sees it.

Each row shows expected / actual / diff side-by-side at full natural height.
Loading is strictly sequential: row N's images don't start fetching until every
image in row N-1 has finished loading (or errored). Keeps fetch parallelism
predictable on multi-hundred-row diffs.
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

ACTUAL_SUFFIX = "-actual.png"
EXPECTED_SUFFIX = "-expected.png"
DIFF_SUFFIX = "-diff.png"

_CSS = """
:root { color-scheme: light dark; }
body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 1.25rem; }
h1 { margin: 0 0 .25rem; }
.sub { color: #666; margin: 0 0 1.25rem; }
.row { margin: 0 0 2.5rem; padding-bottom: 1.5rem;
       border-bottom: 1px solid rgba(127,127,127,0.25); }
.row h3 { margin: 0 0 .75rem; font-size: 1rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          word-break: break-all; color: #333; }
.row h3 a { color: inherit; text-decoration: none; }
.row h3 a:hover { text-decoration: underline; }
.cells { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
         gap: 1rem; align-items: start; }
.cell { margin: 0; min-width: 0; display: flex; flex-direction: column; gap: .35rem; }
.cell figcaption { font-size: .7rem; text-transform: uppercase;
                   letter-spacing: .05em; color: #888; }
.cell img { width: 100%; height: auto; display: block; cursor: zoom-in;
            border: 1px solid rgba(127,127,127,0.3);
            background: rgba(127,127,127,0.06); }
.cell.missing .placeholder { display: flex; align-items: center; justify-content: center;
                             height: 6rem; color: #888; font-size: .8rem;
                             border: 1px dashed rgba(127,127,127,0.4);
                             background: rgba(127,127,127,0.05); }
.empty { color: #888; }
.approve { margin: 0 0 1.25rem; padding: .75rem 1rem;
           border: 1px solid rgba(127,127,127,0.3); border-radius: .5rem;
           background: rgba(127,127,127,0.06); display: flex;
           align-items: center; gap: .75rem; flex-wrap: wrap; }
.approve button { font: inherit; padding: .4rem .9rem; border-radius: .35rem;
                  border: 1px solid rgba(127,127,127,0.4); cursor: pointer;
                  background: #f6f6f6; color: #111; }
.approve button:disabled { opacity: .55; cursor: progress; }
.approve .ok { color: #1c7c1c; }
.approve .err { color: #b21010; }
@media (prefers-color-scheme: dark) {
  .approve button { background: #2a2a2a; color: #eee;
                    border-color: rgba(255,255,255,0.18); }
  .approve .ok { color: #6ad26a; }
  .approve .err { color: #ff7373; }
}
.lb { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.92);
      z-index: 9999; cursor: zoom-out; padding: 1rem; overflow: auto; }
.lb.show { display: block; }
.lb img { display: block; margin: 0 auto; max-width: 100%; }
@media (prefers-color-scheme: dark) {
  .row h3 { color: #ddd; }
  .row { border-color: rgba(255,255,255,0.15); }
}
"""

_APPROVE_JS = """
// POSTs to the same-origin /api/approve-baselines proxy; server validates
// the run and dispatches update-visual-baselines.yaml with a held secret.
(() => {
  const cfg = window.__APPROVE_CFG__;
  if (!cfg || !cfg.runId) return;
  const btn = document.getElementById('approve-btn');
  const status = document.getElementById('approve-status');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'Dispatching…';
    status.className = '';
    const payload = { runId: String(cfg.runId) };
    if (cfg.prNumber) payload.prNumber = String(cfg.prNumber);
    try {
      const res = await fetch('/api/approve-baselines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body && body.ok) {
        status.textContent = 'Dispatched. Watch the Actions tab for the run.';
        status.className = 'ok';
      } else {
        status.textContent = `Failed: ${(body && body.error) || 'HTTP ' + res.status}`;
        status.className = 'err';
      }
    } catch (err) {
      status.textContent = `Network error: ${err.message}`;
      status.className = 'err';
    } finally {
      btn.disabled = false;
    }
  });
})();
"""

_JS = """
// Sequential row loading: row N's <img> elements only get their src set
// once every <img> in row N-1 has either finished loading or errored.
// Keeps fetch parallelism predictable on multi-hundred-row diffs.
(() => {
  const rows = Array.from(document.querySelectorAll('.row'));
  function loadRow(idx) {
    if (idx >= rows.length) return;
    const imgs = Array.from(rows[idx].querySelectorAll('img[data-src]'));
    if (imgs.length === 0) { loadRow(idx + 1); return; }
    let pending = imgs.length;
    const done = () => { if (--pending === 0) loadRow(idx + 1); };
    imgs.forEach(img => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
  loadRow(0);

  const lb = document.getElementById('lb'), lbi = document.getElementById('lbi');
  document.querySelectorAll('.cell a').forEach(a => a.addEventListener('click', e => {
    const img = a.querySelector('img');
    if (!img || !img.src) return;
    e.preventDefault();
    lbi.src = img.src;
    lb.scrollTop = 0;
    lb.classList.add('show');
  }));
  lb.addEventListener('click', () => lb.classList.remove('show'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('show'); });
})();
"""


@dataclass(frozen=True)
class Tile:
    """One failing screenshot: expected vs actual vs diff."""

    label: str
    expected: str | None
    actual: str | None
    diff: str | None


@dataclass(frozen=True)
class ApproveConfig:
    """
    CI metadata that wires up the gallery's approve-baselines button.

    The browser only needs ``run_id`` (and ``pr_number`` for PR galleries); the
    proxy infers the repo from its own ``GITHUB_REPO`` env var.
    """

    run_id: str
    pr_number: str | None = None


def _copy_if_exists(src: Path, dest_dir: Path, dest_name: str) -> str | None:
    """Convert src PNG to AVIF in dest_dir; return the AVIF filename."""
    if not src.exists():
        return None
    avif_name = Path(dest_name).with_suffix(".avif").name
    with Image.open(src) as img:
        img.save(dest_dir / avif_name, "AVIF", quality=50, speed=6)
    return avif_name


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
        # `data-src` (not `src`) is set up-front; the gallery JS swaps it
        # in row-by-row so the next row only starts loading once the
        # previous row finishes. `loading="lazy"` would defeat that.
        inner = f'<a href="{src}"><img data-src="{src}" alt="{kind}"></a>'
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
    approve: ApproveConfig | None = None,
    environment: str | None = None,
) -> str:
    """
    Build the gallery HTML page.

    If ``has_playwright_report`` is False, the header link to the full
    Playwright report is omitted to avoid a dead link.

    When ``approve`` is supplied AND there's at least one failing tile, the page
    includes a one-click "Approve baselines" button that dispatches the
    ``update-visual-baselines.yaml`` workflow.

    ``environment`` is a free-text provenance note (trigger event, per-platform
    rendering environment) shown under the header so a reader can tell
    environment-drift diffs from code-change diffs at a glance.
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
    # Only show the approve button when there's actually something to
    # adopt as baselines — a tile-less gallery means visual-testing passed.
    show_approve = approve is not None and bool(tiles)
    approve_panel = (
        '<div class="approve">'
        '<button type="button" id="approve-btn">Approve these as baselines</button>'
        '<span id="approve-status"></span>'
        "</div>\n"
        if show_approve
        else ""
    )
    approve_cfg_script = (
        "<script>window.__APPROVE_CFG__ = "
        f"{json.dumps({'runId': approve.run_id, 'prNumber': approve.pr_number})};"
        "</script>\n"
        if show_approve and approve is not None
        else ""
    )
    approve_script = f"<script>{_APPROVE_JS}</script>\n" if show_approve else ""
    environment_note = (
        f'<p class="sub">{html.escape(environment)}</p>\n'
        if environment
        else ""
    )
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        "<title>Visual diff gallery</title>\n"
        f"<style>{_CSS}</style>\n</head>\n<body>\n"
        "<h1>Visual diff gallery</h1>\n"
        f'<p class="sub">{count} failing screenshot{plural} · '
        f"expected / actual / diff side-by-side · click any image to enlarge"
        f"{report_link}</p>\n"
        f"{environment_note}"
        f"{approve_panel}"
        f"{body}\n"
        '<div class="lb" id="lb"><img id="lbi" alt=""></div>\n'
        f"{approve_cfg_script}"
        f"{approve_script}"
        f"<script>{_JS}</script>\n"
        "</body>\n</html>\n"
    )


def install_as_index(report_dir: Path, gallery_html: str) -> None:
    """Make the gallery the landing page; preserve Playwright at report.html."""
    playwright_index = report_dir / "index.html"
    if playwright_index.exists():
        playwright_index.replace(report_dir / "report.html")
    (report_dir / "index.html").write_text(gallery_html, encoding="utf-8")


def main(
    traces_dir: Path,
    report_dir: Path,
    *,
    approve: ApproveConfig | None = None,
    environment: str | None = None,
) -> None:
    """Build the gallery and install it as index.html."""
    tiles = collect_tiles(traces_dir, report_dir / "gallery-images")
    page = render_html(
        tiles,
        has_playwright_report=(report_dir / "index.html").exists(),
        approve=approve,
        environment=environment,
    )
    # Keep gallery.html for backward-compatible deep links.
    (report_dir / "gallery.html").write_text(page, encoding="utf-8")
    install_as_index(report_dir, page)
    print(f"Wrote {report_dir / 'index.html'} with {len(tiles)} tiles")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a screenshot diff gallery from Playwright traces.",
    )
    parser.add_argument("traces_dir", type=Path)
    parser.add_argument("report_dir", type=Path)
    parser.add_argument(
        "--run-id",
        default=None,
        help="visual-testing run ID — required for the approve-baselines button",
    )
    parser.add_argument(
        "--pr-number",
        default=None,
        help="PR number, if this gallery is for a PR run (omit on main)",
    )
    parser.add_argument(
        "--environment",
        default=None,
        help="Provenance note (trigger event, per-platform rendering "
        "environment) shown under the gallery header",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args(sys.argv[1:])
    approve_cfg = (
        ApproveConfig(run_id=args.run_id, pr_number=args.pr_number)
        if args.run_id
        else None
    )
    main(
        args.traces_dir,
        args.report_dir,
        approve=approve_cfg,
        environment=args.environment,
    )
