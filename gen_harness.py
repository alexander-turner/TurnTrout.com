"""Generate a bigram harness page inside public/.

Each cell renders `<char><favicon>` exactly as the site does (including the
close-text class for chars in charsToSpace), but paints the glyph pure red
and the favicon pure blue so a pixel pass can measure ink-to-ink clearance.
"""

import html
import json
import re
import shutil
from pathlib import Path

REPO = Path("/home/user/TurnTrout.com")
PUBLIC = REPO / "public"
DATA = Path("/tmp/favicon_bigrams/bigrams.json")
MIRROR = Path("/tmp/favicon_bigrams/mirror")
CDN = "https://assets.turntrout.com"


def chars_to_space() -> list[str]:
    src = (REPO / "quartz/plugins/transformers/favicons.ts").read_text()
    m = re.search(r"export const charsToSpace = \[(.*)\]", src)
    assert m, "charsToSpace not found"
    return [s[1:-1] for s in re.findall(r"'[^']*'|\"[^\"]*\"", m.group(1))]


def localize(url: str) -> str:
    """Rewrite a CDN favicon URL to the locally served mirror copy."""
    name = url.rsplit("/", 1)[-1].split("?")[0]
    return f"/mirror/{name}"


def main() -> None:
    data = json.loads(DATA.read_text())
    close_chars = chars_to_space()

    # Copy mirror into public so one static server serves everything.
    dest = PUBLIC / "mirror"
    dest.mkdir(exist_ok=True)
    for f in MIRROR.iterdir():
        shutil.copy(f, dest / f.name)

    # Steal the real page head so fonts/CSS match production exactly.
    ref = (PUBLIC / "welcome.html").read_text(encoding="utf-8")
    head = re.search(r"<head[ >].*?</head>", ref, re.S).group(0)
    head = re.sub(r"<script\b.*?</script>", "", head, flags=re.S)
    head = re.sub(r"<script\b[^>]*/>", "", head)
    head = re.sub(r"<meta http-equiv=.refresh.[^>]*>", "", head)

    cells = []
    bigrams = sorted(data["bigrams"], key=lambda b: (b["domain"], b["char"]))
    for i, b in enumerate(bigrams):
        char, domain = b["char"], b["domain"]
        if not char:
            continue  # nothing precedes the favicon; no bigram to measure
        fav = data["favicons"][domain]
        close = " close-text" if b["close_text"] * 2 > b["count"] else ""
        esc = html.escape(char)
        url = localize(fav["url"])
        if fav["tag"] == "svg":
            icon = (
                f'<svg class="favicon{close}" data-domain="{domain}" '
                f'style="--mask-url:url({url});" aria-hidden="true"></svg>'
            )
        else:
            icon = f'<img class="favicon{close}" src="{url}" alt="">'
        cells.append(
            f'<p class="bigram-cell" id="cell-{i}" data-char="{esc}" '
            f'data-domain="{html.escape(domain)}" data-close="{1 if close else 0}">'
            f'<span class="bg-char">{esc}</span>{icon}</p>'
        )

    html_doc = f"""<!DOCTYPE html>
<html lang="en">
{head}
<body>
<style>
  body {{ background: #fff; margin: 2rem; }}
  .bigram-cell {{
    margin: 6px; padding: 10px 16px 10px 6px; display: inline-block;
    line-height: 1; background: #fff;
  }}
  .bg-char {{ color: #f00 !important; }}
  svg.favicon {{ background: #00f !important; }}
  img.favicon {{ filter: brightness(0) sepia(1) saturate(30) hue-rotate(200deg); }}
</style>
<article>
{chr(10).join(cells)}
</article>
</body>
</html>"""
    out = PUBLIC / "bigram-harness" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html_doc, encoding="utf-8")
    print(f"wrote {out} with {len(cells)} cells")


if __name__ == "__main__":
    main()
