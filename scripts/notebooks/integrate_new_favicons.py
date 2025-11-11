#!/usr/bin/env python3
"""
Script to integrate new favicons from ~/Pictures/new_favicons into the project.

Maps favicon filenames to domain-based naming convention and moves them to the
correct location.
"""

import shutil
import sys
from pathlib import Path
from typing import Iterable

import requests

# Add parent scripts directory to path for imports
_SCRIPTS_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_SCRIPTS_DIR))

from normalize_svg_viewbox import (  # type: ignore  # noqa: E402
    normalize_svg_viewbox,
)

# Mapping from source filename to target domain-based filename
# Format: source_filename -> target_filename (domain_com.ext)
FAVICON_MAPPING: dict[str, str] = {
    "ai_alignment_com.svg": "ai-alignment_org.svg",
    "arxiv.svg": "arxiv_org.svg",
    "cnn.svg": "cnn_com.svg",
    "deepmind.svg": "deepmind_com.svg",
    "discord.svg": "discord_gg.svg",  # Based on whitelist entry
    "drive.google.svg": "drive_google_com.svg",
    "forum_effectivealtruism_org.svg": "forum_effectivealtruism_org.svg",
    "github.svg": "github_com.svg",
    "google.svg": "google_com.svg",
    "googlecolab.svg": "colab_research_google_com.svg",
    "googledocs.svg": "docs_google_com.svg",
    "googlescholar.svg": "scholar_google_com.svg",
    "huggingface.svg": "huggingface_co.svg",
    "msnbc.svg": "msnbc_com.svg",
    "nytimes.svg": "nytimes_com.svg",  # Based on whitelist entry
    "open.spotify.svg": "open_spotify_com.svg",  # Based on whitelist entry
    "openai.svg": "openai_com.svg",
    "overleaf.svg": "overleaf_com.svg",
    "play.google.svg": "play_google_com.svg",
    "playwright_com.svg": "playwright_dev.svg",
    "proton.svg": "proton_me.svg",  # Based on hostname replacement
    "reddit.svg": "reddit_com.svg",
    "wikipedia.svg": "wikipedia_org.svg",
    "x.svg": "x_com.svg",
    "youtube.svg": "youtube_com.svg",
    "wordpress.svg": "wordpress_com.svg",
}

SOURCE_DIR = Path.home() / "Pictures" / "new_favicons"
TARGET_DIR = Path("quartz/static/images/external-favicons")

# Special favicon paths from constants.ts that should also be normalized
special_svgs = [
    "mail.svg",
    "anchor.svg",
    "rss.svg",
    "turntrout_com.svg",
    "substack_com.svg",
    "lesswrong_com.svg",
]
SPECIAL_FAVICON_PATHS = [TARGET_DIR / svg for svg in special_svgs]


def check_exists_on_cdn(target_path: Path) -> bool:
    """Check if a favicon file already exists on the remote CDN."""
    # Remove "quartz/" prefix from path for CDN URL
    path_str = str(target_path)
    if path_str.startswith("quartz/"):
        path_str = path_str[7:]  # Remove "quartz/" prefix
    cdn_url = f"https://assets.turntrout.com/{path_str}"
    try:
        response = requests.head(cdn_url, timeout=10)
        return response.status_code == 200
    except requests.RequestException:
        return False


def normalize_svg_files(svg_paths: Iterable[Path]) -> None:
    """Normalize a list of SVG files to 24x24 viewBox."""
    if not svg_paths:
        return

    print("\nNormalizing SVG files to 24x24...")
    for svg_path in svg_paths:
        if not svg_path.exists():
            continue
        normalize_svg_viewbox(svg_path, target_size=24)


def main() -> None:
    """Move and rename favicons according to mapping."""
    # Add all unspecified files to the mapping
    for source_file in SOURCE_DIR.glob("*.svg"):
        str_source_name = str(source_file.name)
        if str_source_name not in FAVICON_MAPPING:
            FAVICON_MAPPING[str_source_name] = str_source_name

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    moved_files: list[Path] = []
    for source_name, target_name in FAVICON_MAPPING.items():
        source_path = SOURCE_DIR / source_name
        target_path = TARGET_DIR / target_name

        if not source_path.exists() or target_path.exists():
            continue

        if check_exists_on_cdn(target_path):
            print(f"Skipped (exists on CDN): {source_name} -> {target_name}")
            continue

        shutil.copy2(source_path, target_path)
        print(f"Moved: {source_name} -> {target_name}")
        moved_files.append(target_path)

    # Normalize all SVG files: newly moved + special paths + existing
    all_svgs = (
        moved_files
        + SPECIAL_FAVICON_PATHS
        + [p for p in TARGET_DIR.glob("*.svg") if p not in moved_files]
    )
    normalize_svg_files(all_svgs)


if __name__ == "__main__":
    main()
