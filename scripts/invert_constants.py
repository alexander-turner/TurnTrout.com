"""
Python-only constants shared between the dark-mode invert labeler
(``scripts/label_invert.py``) and the built-site validator
(``scripts/built_site_checks.py``).

The CSS class itself lives in ``config/constants.json`` (key
``invertInDarkModeClass``) so TS, Python, and SCSS can all reach it without an
extra layer of re-export.
"""

from typing import Final

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
