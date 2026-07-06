"""Mine the built site for favicon bigrams.

A "bigram" is (preceding visible character, favicon domain). For every
favicon occurrence in public/**/*.html, find the last non-whitespace text
character rendered before it, and record the pair with counts, whether
close-text spacing was applied, and example pages.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

PUBLIC = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/favicon_bigrams/bigrams.json")

SKIP_PARENTS = {"script", "style", "noscript", "template"}


def preceding_char(el: Tag) -> tuple[str, str]:
    """Last non-space char before el in document order, plus context."""
    context = ""
    node = el.previous
    while node is not None:
        if isinstance(node, NavigableString):
            parent = node.parent.name if node.parent else ""
            if parent not in SKIP_PARENTS:
                text = str(node)
                stripped = text.rstrip()
                if stripped:
                    context = (stripped + context)[-20:]
                    return stripped[-1], context
                context = text + context
        node = node.previous
    return "", context


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
        lambda: {"count": 0, "pages": [], "close_text": 0, "contexts": []}
    )
    favicons: dict[str, dict] = {}

    html_files = sorted(PUBLIC.rglob("*.html"))
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
            is_close = "close-text" in classes
            favicons.setdefault(
                domain, {"url": url, "tag": el.name}
            )
            char, ctx = preceding_char(el)
            entry = bigrams[(char, domain)]
            entry["count"] += 1
            entry["close_text"] += int(is_close)
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
    print(f"{len(out['bigrams'])} bigrams, {len(favicons)} favicons, "
          f"{len(chars)} distinct chars")
    print("chars:", "".join(chars))


if __name__ == "__main__":
    main()
