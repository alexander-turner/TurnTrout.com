#!/usr/bin/env python3
"""
Find which DOM content on a page causes axe-core (pa11y's primary runner) to
hang. Bisects in three escalating passes:

  1. **Section pass.** Slice the page at the chosen anchor tag (default
     ``<h2>``). For each section, generate a variant with that section removed
     and check whether axe still hangs. Sections whose removal "unbreaks" the
     page contain the trigger.

  2. **Within-section pass** (``--drill <section-idx>``). Same idea, but cut
     points are the more permissive ``<p|figure|pre|ul|ol|blockquote>`` set.

  3. **CSS rule pass** (``--bisect-css``). Same idea, but the cuts are
     top-level CSS rules in the stylesheet linked from ``<link rel="stylesheet"
     href="/index.css">``. Stripping rules that combine pathologically with
     the page can pinpoint the offending selector family.

Each test is repeated ``--trials`` times because Chrome's style/layout work
near a perf cliff is non-deterministic; we report ``pass/N`` per variant.

Usage::

    # Step 1: identify the slow section
    uv run python scripts/bisect_axe_hang.py \\
        --url http://localhost:8080/elk-proposal-thinking-via-a-human-imitator.html \\
        --pa11y-config /tmp/pa11y_axe.json \\
        --serve-dir public

    # Step 2: drill into a specific section that bisection flagged
    uv run python scripts/bisect_axe_hang.py ... --drill 6

    # Step 3: bisect the linked stylesheet
    uv run python scripts/bisect_axe_hang.py ... --bisect-css /index.css

Pa11y config file should enable only the axe runner so you isolate axe-core::

    {
      "timeout": 60000,
      "chromeLaunchConfig": {
        "executablePath": "...chrome...",
        "args": ["--no-sandbox", "--disable-setuid-sandbox",
                 "--disable-dev-shm-usage",
                 "--blink-settings=imagesEnabled=false",
                 "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"]
      },
      "standard": "WCAG2AA",
      "runners": ["axe"],
      "useIncognitoBrowserContext": true
    }
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

_DEFAULT_ANCHOR = "<h2"
_FINE_ANCHORS = ("<p", "<figure", "<pre", "<ul", "<ol", "<blockquote")


def _label(html: str, start: int, anchor: str) -> str:
    snippet = html[start : start + 300]
    if anchor.startswith("<h"):
        m = re.search(r"<h\d[^>]*>(.*?)</h\d>", snippet, re.DOTALL)
        if m:
            return re.sub(r"<[^>]+>", "", m.group(1)).strip()[:50] or "?"
    tag_m = re.match(r"<(\w+)", snippet)
    text = re.sub(r"<[^>]+>", " ", snippet[:200]).strip()
    return f"<{tag_m.group(1) if tag_m else '?'}> {text[:50]}"


def _find_anchors(html: str, anchors: tuple[str, ...]) -> list[int]:
    positions: list[int] = []
    for anchor in anchors:
        positions.extend(
            m.start()
            for m in re.finditer(re.escape(anchor), html, re.IGNORECASE)
        )
    return sorted(set(positions))


def _sections(html: str, anchors: tuple[str, ...]) -> list[tuple[int, int]]:
    positions = _find_anchors(html, anchors)
    if not positions:
        return []
    bounds = []
    for i, p in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(html)
        bounds.append((p, end))
    return bounds


def _parse_css_rules(css: str) -> list[tuple[str, int, int]]:
    rules: list[tuple[str, int, int]] = []
    i = 0
    while i < len(css):
        j = css.find("{", i)
        if j == -1:
            break
        depth = 1
        k = j + 1
        while depth and k < len(css):
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        rules.append((css[i:j].strip(), i, k))
        i = k
    return rules


def _run_pa11y(url: str, config: Path, timeout_s: float) -> tuple[bool, float]:
    start = time.monotonic()
    try:
        proc = subprocess.run(
            ["pnpm", "exec", "pa11y", "--config", str(config), url],
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return True, time.monotonic() - start
    elapsed = time.monotonic() - start
    out = (proc.stdout + proc.stderr)[-400:]
    hung = "TargetCloseError" in out or "Target closed" in out
    return hung, elapsed


def _passes(
    url: str, config: Path, timeout_s: float, trials: int
) -> tuple[int, list[float]]:
    """Return (pass_count, times)."""
    times: list[float] = []
    passes = 0
    for _ in range(trials):
        hung, elapsed = _run_pa11y(url, config, timeout_s)
        times.append(elapsed)
        if not hung:
            passes += 1
    return passes, times


def _parse_args() -> argparse.Namespace:
    """Build the CLI and parse argv."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--url", required=True)
    parser.add_argument("--pa11y-config", type=Path, required=True)
    parser.add_argument(
        "--serve-dir",
        type=Path,
        required=True,
        help="Directory served at the URL's host:port.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Per-trial subprocess timeout in seconds (default 30).",
    )
    parser.add_argument(
        "--trials", type=int, default=3, help="Trials per variant (default 3)."
    )
    parser.add_argument(
        "--anchor",
        default=_DEFAULT_ANCHOR,
        help='Element start that delimits sections (default "<h2").',
    )
    parser.add_argument(
        "--drill",
        type=int,
        default=None,
        help="Section index to bisect with fine-grained anchors.",
    )
    parser.add_argument(
        "--bisect-css",
        default=None,
        help='Stylesheet href to bisect (e.g. "/index.css").',
    )
    return parser.parse_args()


def _drill_sections(
    src: str, outer_anchor: str, drill_idx: int
) -> list[tuple[int, int]]:
    """Return fine-grained section bounds inside one outer section."""
    outer = _sections(src, (outer_anchor,))
    if drill_idx >= len(outer):
        return []
    outer_start, outer_end = outer[drill_idx]
    inner = [
        outer_start + m.start()
        for m in re.finditer(
            r"<(?:p|figure|pre|ul|ol|blockquote)\b", src[outer_start:outer_end]
        )
    ]
    bounds: list[tuple[int, int]] = []
    for i, p in enumerate(inner):
        end = inner[i + 1] if i + 1 < len(inner) else outer_end
        bounds.append((p, end))
    return bounds


def _select_sections(
    args: argparse.Namespace, src: str
) -> list[tuple[int, int]] | None:
    """Pick sections to bisect; ``None`` on user error (already logged)."""
    if args.drill is None:
        sections = _sections(src, (args.anchor,))
        print(f"\nfound {len(sections)} sections by {args.anchor!r}.")
        return sections
    outer = _sections(src, (args.anchor,))
    if args.drill >= len(outer):
        print(
            f"section {args.drill} out of range (0..{len(outer)-1})",
            file=sys.stderr,
        )
        return None
    sections = _drill_sections(src, args.anchor, args.drill)
    print(
        f"\ndrilling section {args.drill}: {len(sections)} fine-grained chunks"
    )
    return sections


def _label_for_cut(src: str, start: int, drill: int | None, anchor: str) -> str:
    return _label(src, start, anchor if drill is None else "<")


def _bisect_dom(args: argparse.Namespace, src: str, base_url: str) -> int:
    """Run the section-strip bisection over ``src``."""
    sections = _select_sections(args, src)
    if sections is None:
        return 2
    variant_prefix = Path(urlparse(args.url).path).stem
    for i, (s, e) in enumerate(sections):
        out_path = args.serve_dir / f"{variant_prefix}_cut_{i}.html"
        out_path.write_text(
            src[:s] + f"<!--cut [{i}] {e-s}B-->" + src[e:], encoding="utf-8"
        )
        passes, times = _passes(
            f"{base_url}/{out_path.name}",
            args.pa11y_config,
            args.timeout,
            args.trials,
        )
        marker = " ← culprit" if passes >= args.trials // 2 + 1 else ""
        label = _label_for_cut(src, s, args.drill, args.anchor)
        print(
            f"  cut [{i:2d}] {label!r:50s} "
            f"{passes}/{args.trials} pass, times={[round(t,1) for t in times]}{marker}"
        )
        out_path.unlink(missing_ok=True)
    return 0


def _css_cut_plan(n: int, trials: int) -> list[tuple[str, tuple[int, int]]]:
    """Return labeled (lo, hi) chunks to drop from the rule list."""
    if trials >= 3:
        return [
            ("q1", (0, n // 4)),
            ("q2", (n // 4, n // 2)),
            ("q3", (n // 2, 3 * n // 4)),
            ("q4", (3 * n // 4, n)),
        ]
    return [("a", (0, n // 2)), ("b", (n // 2, n))]


def main() -> int:
    """CLI entry point: run baseline pa11y, then dispatch to DOM/CSS bisect."""
    args = _parse_args()
    base_url = args.url.rsplit("/", 1)[0]
    src = subprocess.check_output(["curl", "-s", args.url], text=True)
    print(f"fetched {args.url}: {len(src)} bytes")

    passes, times = _passes(
        args.url, args.pa11y_config, args.timeout, args.trials
    )
    print(
        f"baseline: {passes}/{args.trials} passes; times={[round(t,1) for t in times]}"
    )

    if args.bisect_css:
        return _bisect_css(args, src, base_url)
    return _bisect_dom(args, src, base_url)


@dataclass(frozen=True)
class _CssBisectCtx:
    """Shared context for one CSS bisect run."""

    args: argparse.Namespace
    html: str
    css: str
    rules: list[tuple[str, int, int]]
    css_url_path: str
    variant_prefix: str
    base_url: str


def _css_drop_variant(ctx: _CssBisectCtx, label: str, lo: int, hi: int) -> None:
    """Write a stylesheet variant with rules[lo..hi) dropped and run pa11y."""
    keep = "".join(ctx.css[s:e] for _, s, e in ctx.rules[:lo]) + "".join(
        ctx.css[s:e] for _, s, e in ctx.rules[hi:]
    )
    css_out = ctx.args.serve_dir / f"_bisect_{label}.css"
    html_out = ctx.args.serve_dir / f"{ctx.variant_prefix}_drop_{label}.html"
    css_out.write_text(keep, encoding="utf-8")
    html_out.write_text(
        ctx.html.replace(ctx.css_url_path, f"/_bisect_{label}.css"),
        encoding="utf-8",
    )
    try:
        passes, times = _passes(
            f"{ctx.base_url}/{html_out.name}",
            ctx.args.pa11y_config,
            ctx.args.timeout,
            ctx.args.trials,
        )
        marker = (
            " ← drop unbreaks" if passes >= ctx.args.trials // 2 + 1 else ""
        )
        print(
            f"  drop rules[{lo:4d}..{hi:4d}) ({hi-lo:4d}): "
            f"{passes}/{ctx.args.trials} pass, "
            f"times={[round(t,1) for t in times]}{marker}"
        )
    finally:
        html_out.unlink(missing_ok=True)
        css_out.unlink(missing_ok=True)


def _bisect_css(args: argparse.Namespace, html: str, base_url: str) -> int:
    """Drop chunks of a stylesheet and check whether the page now passes."""
    parsed = urlparse(args.url)
    css = subprocess.check_output(
        ["curl", "-s", f"{parsed.scheme}://{parsed.netloc}{args.bisect_css}"],
        text=True,
    )
    rules = _parse_css_rules(css)
    print(
        f"\nstylesheet {args.bisect_css}: {len(css)}B, "
        f"{len(rules)} top-level rules"
    )
    ctx = _CssBisectCtx(
        args=args,
        html=html,
        css=css,
        rules=rules,
        css_url_path=args.bisect_css,
        variant_prefix=Path(parsed.path).stem,
        base_url=base_url,
    )
    for label, (lo, hi) in _css_cut_plan(len(rules), args.trials):
        _css_drop_variant(ctx, label, lo, hi)
    return 0


if __name__ == "__main__":
    sys.exit(main())
