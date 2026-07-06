"""
Generate measurement harness pages inside public/.

`index.html`: one cell per mined bigram, rendered exactly as the site does
(same nudge classes), glyph painted pure red and favicon pure blue so a
pixel pass can measure ink-to-ink clearance. `icons.html`: each favicon
alone, for per-icon ink-inset measurement.

If FAVICON_MIRROR_DIR is set, its SVGs are copied to public/mirror/ and icon
URLs are rewritten to it (for sandboxes that cannot reach the CDN).
"""

import html
import json
import os
import re
import shutil
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PUBLIC = REPO / "public"
DATA = Path("/tmp/favicon_kerning_audit/bigrams.json")
MIRROR = os.environ.get("FAVICON_MIRROR_DIR")

STYLE = """
<style>
  body { background: #fff; margin: 2rem; }
  .bigram-cell, .icon-cell {
    margin: 6px; padding: 10px 16px 10px 6px; display: inline-block;
    line-height: 1; background: #fff;
  }
  .bg-char { color: #f00 !important; }
  svg.favicon { background: #00f !important; }
  img.favicon { filter: brightness(0) sepia(1) saturate(30) hue-rotate(200deg); }
</style>
"""


def production_head() -> str:
    """A real page's <head> (scripts and redirects stripped) so fonts/CSS
    match."""
    ref = (PUBLIC / "welcome.html").read_text(encoding="utf-8")
    head = re.search(r"<head[ >].*?</head>", ref, re.S).group(0)
    head = re.sub(r"<script\b.*?</script>", "", head, flags=re.S)
    return re.sub(r"<meta http-equiv=.refresh.[^>]*>", "", head)


def icon_url(fav: dict) -> str:
    if MIRROR:
        name = fav["url"].rsplit("/", 1)[-1].split("?")[0]
        return f"/mirror/{name}"
    return fav["url"]


def icon_markup(domain: str, fav: dict, nudge_class: str = "") -> str:
    url = icon_url(fav)
    if fav["tag"] == "svg":
        return (
            f'<svg class="favicon{nudge_class}" data-domain="{domain}" '
            f'style="--mask-url:url({url});" aria-hidden="true"></svg>'
        )
    return f'<img class="favicon{nudge_class}" data-domain="{domain}" src="{url}" alt="">'


def page(body: str) -> str:
    return (
        f'<!DOCTYPE html>\n<html lang="en">\n{production_head()}\n<body>\n'
        f"{STYLE}\n<article>\n{body}\n</article>\n</body>\n</html>"
    )


def main() -> None:
    data = json.loads(DATA.read_text())

    if MIRROR:
        dest = PUBLIC / "mirror"
        dest.mkdir(exist_ok=True)
        for f in Path(MIRROR).iterdir():
            shutil.copy(f, dest / f.name)

    cells = []
    bigrams = sorted(data["bigrams"], key=lambda b: (b["domain"], b["char"]))
    for i, b in enumerate(bigrams):
        char, domain = b["char"], b["domain"]
        if not char:
            continue  # nothing precedes the favicon; no bigram to measure
        # Reproduce what the site actually rendered (majority vote per pair).
        majority = Counter(b["nudges"]).most_common(1)[0][0]
        nudge = f" {majority}" if majority else ""
        esc = html.escape(char)
        cells.append(
            f'<p class="bigram-cell" id="cell-{i}" data-char="{esc}" '
            f'data-domain="{html.escape(domain)}" data-nudge="{majority}">'
            f'<span class="bg-char">{esc}</span>{icon_markup(domain, data["favicons"][domain], nudge)}</p>'
        )

    out = PUBLIC / "bigram-harness"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page("\n".join(cells)), encoding="utf-8")
    print(f"wrote {out / 'index.html'} with {len(cells)} cells")

    icons = [
        f'<p class="icon-cell" data-domain="{domain}">'
        f"{icon_markup(domain, fav).replace('favicon', 'favicon icon-probe', 1)}</p>"
        for domain, fav in sorted(data["favicons"].items())
    ]
    (out / "icons.html").write_text(page("\n".join(icons)), encoding="utf-8")
    print(f"wrote {out / 'icons.html'} with {len(icons)} icons")


if __name__ == "__main__":
    main()
