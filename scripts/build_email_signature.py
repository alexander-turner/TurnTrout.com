"""
Build the self-contained turntrout.com email signature page.

Email clients cannot fetch `@font-face` sources reliably and strip most
external references, so the signature carries its own faces: each font is
subset down to the exact characters the signature renders and inlined as a
base64 `data:` URL. Both subsets together weigh a few kilobytes.

The characters to keep are read out of `template.html` — an element tagged
`data-tt-font="<key>"` declares that its text is rendered in that face. The
attribute is a build-time annotation and is stripped from the output.

Usage:
    uv run python scripts/build_email_signature.py
"""

from __future__ import annotations

import base64
import io
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Final, NamedTuple

from bs4 import BeautifulSoup
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

_REPO_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
_FONT_DIR: Final[Path] = _REPO_ROOT / "quartz" / "static" / "styles" / "fonts"
_SIGNATURE_DIR: Final[Path] = _REPO_ROOT / "scripts" / "email_signature"
TEMPLATE_PATH: Final[Path] = _SIGNATURE_DIR / "template.html"
SCRIPT_PATH: Final[Path] = _SIGNATURE_DIR / "page.js"
OUTPUT_PATH: Final[Path] = _SIGNATURE_DIR / "signature.html"

_BUILD_ATTRIBUTE: Final[str] = "data-tt-font"
_BUILD_ATTRIBUTE_PATTERN: Final[re.Pattern[str]] = re.compile(
    rf'\s*{_BUILD_ATTRIBUTE}="[^"]*"'
)


class FontSpec(NamedTuple):
    """A face to subset and inline, keyed by its `data-tt-font` value."""

    key: str
    family: str
    source: Path
    # Variable-font axis positions to pin before subsetting, or None for a
    # static face. Emails have no use for the extra axis machinery.
    pin: Mapping[str, float] | None


FONT_SPECS: Final[tuple[FontSpec, ...]] = (
    FontSpec(
        key="serif",
        family="EBGaramondSig",
        source=_FONT_DIR / "EBGaramond" / "EBGaramond08-Regular.woff2",
        pin=None,
    ),
    FontSpec(
        key="mono",
        family="FiraCodeSig",
        source=_FONT_DIR / "firacode-vf.woff2",
        # The site renders inline code at the normal weight; FiraCode's
        # variable default is 300.
        pin={"wght": 400},
    ),
)


# Dark-background overrides, keyed by the class the template puts on each part.
# The inline styles carry the light palette, so these need `!important` to win.
# Clients without `prefers-color-scheme` fall back to the inline colors, which
# their own dark-mode heuristics invert.
DARK_RULES: Final[tuple[tuple[str, str], ...]] = (
    ("tt-sig-name", "color: #eff2ff !important;"),
    ("tt-sig-link", "color: #b4c7f5 !important;"),
    ("tt-sig-rule", "border-left-color: #333540 !important;"),
)


def collect_font_text(template_html: str) -> dict[str, str]:
    """Map each `data-tt-font` key to the concatenated text it renders."""
    soup = BeautifulSoup(template_html, "html.parser")
    per_key: dict[str, str] = {}
    for element in soup.select(f"[{_BUILD_ATTRIBUTE}]"):
        key = str(element[_BUILD_ATTRIBUTE])
        per_key[key] = per_key.get(key, "") + element.get_text()
    return per_key


def subset_font(spec: FontSpec, text: str) -> bytes:
    """Return a WOFF2 subset of `spec` covering exactly the glyphs in `text`."""
    # `recalcTimestamp` would stamp `head.modified` with the build time, making
    # the checked-in page churn on every rebuild.
    font = TTFont(spec.source, recalcTimestamp=False)
    if spec.pin is not None:
        font = instancer.instantiateVariableFont(
            font, dict(spec.pin), inplace=True
        )

    options = Options()
    options.layout_features = ["kern", "liga", "calt", "locl", "ccmp"]
    options.desubroutinize = True
    options.name_IDs = []
    options.name_legacy = False
    options.notdef_outline = False
    options.drop_tables += ["DSIG", "FFTM"]

    subsetter = Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)

    font.flavor = "woff2"
    buffer = io.BytesIO()
    font.save(buffer)
    return buffer.getvalue()


def render_font_face(spec: FontSpec, payload: bytes) -> str:
    """Render a single `@font-face` rule with the subset inlined."""
    encoded = base64.b64encode(payload).decode("ascii")
    return (
        "@font-face {\n"
        f"  font-family: {spec.family};\n"
        "  font-style: normal;\n"
        "  font-weight: 400;\n"
        "  font-display: swap;\n"
        f'  src: url("data:font/woff2;base64,{encoded}") format("woff2");\n'
        "}"
    )


def build_font_faces(template_html: str) -> str:
    """Render the `@font-face` block for every spec used by the template."""
    per_key = collect_font_text(template_html)
    missing = sorted({spec.key for spec in FONT_SPECS} - per_key.keys())
    if missing:
        raise ValueError(
            f"template has no {_BUILD_ATTRIBUTE} element for: {', '.join(missing)}"
        )
    return "\n".join(
        render_font_face(spec, subset_font(spec, per_key[spec.key]))
        for spec in FONT_SPECS
    )


def render_dark_rules(prefix: str = "") -> str:
    """Render the dark-background overrides, optionally scoped by `prefix`."""
    return "\n".join(
        f"{prefix}.{class_name} {{ {declarations} }}"
        for class_name, declarations in DARK_RULES
    )


def build_page(template_html: str, page_script: str) -> str:
    """Substitute the generated fonts, overrides, and script into the
    template."""
    page = template_html.replace(
        "{{FONT_FACES}}", build_font_faces(template_html)
    )
    page = page.replace("{{DARK_RULES}}", render_dark_rules())
    page = page.replace(
        "{{DARK_PREVIEW_RULES}}", render_dark_rules(".card.dark ")
    )
    page = page.replace("{{COPY_SCRIPT}}", page_script)
    return _BUILD_ATTRIBUTE_PATTERN.sub("", page)


def main() -> None:
    """Regenerate `signature.html` from the template, script, and fonts."""
    template_html = TEMPLATE_PATH.read_text(encoding="utf-8")
    page_script = SCRIPT_PATH.read_text(encoding="utf-8")
    OUTPUT_PATH.write_text(
        build_page(template_html, page_script), encoding="utf-8"
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
