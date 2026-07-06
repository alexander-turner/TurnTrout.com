"""
Mine the built site for favicon bigrams.

A "bigram" is (preceding visible character, favicon domain). For every favicon
occurrence in public/**/*.html, find the last non-whitespace text character
rendered before it, and record the pair with counts, whether a spacing nudge
class was applied, and example pages/contexts.
"""

import json
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

REPO = Path(__file__).resolve().parents[3]
PUBLIC = REPO / "public"
OUT = Path("/tmp/favicon_kerning_audit/bigrams.json")

SKIP_PARENTS = frozenset(("script", "style", "noscript", "template"))
BLOCK_TAGS = (
    "p",
    "li",
    "dt",
    "dd",
    "td",
    "th",
    "caption",
    "figcaption",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "div",
)


def preceding_char(el: Tag) -> tuple[str, str, bool]:
    """
    Last non-space char before el within its block, plus context, plus whether
    whitespace renders between that char and el (a spaced pair has a visible gap
    already and is not a kerning bigram).

    A line break separates the favicon from any earlier block's text, so the
    walk stops at the nearest block ancestor instead of crossing into it.
    """
    context = ""
    spaced = False
    block = el.find_parent(BLOCK_TAGS)
    node = el.previous
    while node is not None and node is not block:
        if isinstance(node, NavigableString):
            parent = node.parent.name if node.parent else ""
            if parent not in SKIP_PARENTS:
                text = str(node)
                stripped = text.rstrip()
                if stripped:
                    context = (stripped + context)[-20:]
                    return stripped[-1], context, spaced or stripped != text
                spaced = spaced or bool(text)
                context = text + context
        node = node.previous
    return "", context, spaced


def favicon_key(el: Tag) -> tuple[str, str]:
    """(domain key, mask url or img src) for a favicon element."""
    if el.name == "svg":
        domain = el.get("data-domain", "")
        style = el.get("style", "")
        mask = ""
        if "--mask-url:" in style:
            mask = style.split("--mask-url:", 1)[1].strip()
            if mask.startswith("url("):
                mask = mask[4:].split(")", 1)[0]
        return domain, mask
    src = el.get("src", "")
    domain = src.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    return domain, src


def main() -> None:
    bigrams: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"count": 0, "pages": [], "nudges": [], "contexts": []}
    )
    favicons: dict[str, dict] = {}

    html_files = sorted(
        p
        for p in PUBLIC.rglob("*.html")
        # gen_harness.py writes its own favicon-laden pages into public/.
        if "bigram-harness" not in p.parts
    )
    print(f"scanning {len(html_files)} html files")
    for path in html_files:
        rel = str(path.relative_to(PUBLIC))
        soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
        for el in soup.select(".favicon"):
            if el.name not in ("svg", "img"):
                continue
            domain, url = favicon_key(el)
            if not domain:
                continue
            classes = el.get("class", [])
            nudge = next(
                (c for c in ("closer-text", "close-text") if c in classes), ""
            )
            favicons.setdefault(domain, {"url": url, "tag": el.name})
            char, ctx, spaced = preceding_char(el)
            if spaced:
                continue
            entry = bigrams[(char, domain)]
            entry["count"] += 1
            entry["nudges"].append(nudge)
            if len(entry["pages"]) < 3 and rel not in entry["pages"]:
                entry["pages"].append(rel)
            if len(entry["contexts"]) < 2 and ctx not in entry["contexts"]:
                entry["contexts"].append(ctx)

    out = {
        "favicons": favicons,
        "bigrams": [
            {"char": char, "domain": domain, **data}
            for (char, domain), data in sorted(
                bigrams.items(), key=lambda kv: -kv[1]["count"]
            )
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    chars = sorted({b["char"] for b in out["bigrams"]})
    print(
        f"{len(out['bigrams'])} bigrams, {len(favicons)} favicons, "
        f"{len(chars)} distinct chars"
    )


if __name__ == "__main__":
    main()
