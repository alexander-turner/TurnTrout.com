"""
Shared constants for the dark-mode invert pipeline.

Used by both the labeling tool (``scripts/label_invert.py``) and the built-site
validator (``scripts/built_site_checks.py``). Lives in its own module so the
validator doesn't have to import the labeler's heavy CV dependencies (Flask,
PIL, numpy) just to reuse a few constants.
"""

import json
from pathlib import Path
from typing import Final

_CONSTANTS_JSON_PATH: Final[Path] = (
    Path(__file__).resolve().parent.parent / "config" / "constants.json"
)
with open(_CONSTANTS_JSON_PATH, encoding="utf-8") as _f:
    _SHARED_CONSTANTS = json.load(_f)

# CSS class the build pipeline applies to elements that should be inverted in
# dark mode. Canonical source: config/constants.json.
INVERT_CLASS: Final[str] = _SHARED_CONSTANTS["invertInDarkModeClass"]

# Tuples (not sets) so we can pass directly to ``str.endswith``.
RASTER_EXTENSIONS: Final[tuple[str, ...]] = (
    ".avif",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
)

# Inline looping muted videos (GIF-replacements). Each format is its own URL on
# R2; the rendered ``<video>`` tries each ``<source>`` in order, but we ask the
# labeler for a verdict per URL.
VIDEO_EXTENSIONS: Final[tuple[str, ...]] = (".mp4", ".webm", ".mov")

LABELABLE_EXTENSIONS: Final[tuple[str, ...]] = (
    RASTER_EXTENSIONS + VIDEO_EXTENSIONS
)

# URL path segments whose media bypass invert-labeling (favicons, emoji, etc.).
EXCLUDED_SEGMENTS: Final[frozenset[str]] = frozenset(
    {
        "external-favicons",
        "twemoji",
        "turntrout-favicons",
        "card_images",
        "avatars",
    }
)
