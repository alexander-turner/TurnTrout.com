#!/usr/bin/env python3
"""
Script to integrate new favicons from ~/Pictures/new_favicons into the project.

Maps favicon filenames to domain-based naming convention and moves them to the
correct location.
"""

import shutil
from pathlib import Path

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
}

SOURCE_DIR = Path.home() / "Pictures" / "new_favicons"
TARGET_DIR = Path("quartz/static/images/external-favicons")


def main() -> None:
    """Move and rename favicons according to mapping."""
    if not SOURCE_DIR.exists():
        raise FileNotFoundError(f"Source directory not found: {SOURCE_DIR}")

    # Add all nonexistent files to the mapping
    for source_name in SOURCE_DIR.glob("*.svg"):
        str_source_name = str(source_name.name)
        if str_source_name not in FAVICON_MAPPING:
            FAVICON_MAPPING[str_source_name] = str_source_name

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    moved_count = 0
    skipped_count = 0
    for source_name, target_name in FAVICON_MAPPING.items():
        source_path = SOURCE_DIR / str(source_name)
        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_name}")

        target_path = TARGET_DIR / target_name
        if target_path.exists():
            print(f"Skipping {target_name} (already exists)")
            skipped_count += 1
            continue

        shutil.copy2(source_path, target_path)
        print(f"Moved: {source_name} -> {target_name}")
        moved_count += 1

    print("\nSummary:")
    print(f"  Moved: {moved_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"\nTarget directory: {TARGET_DIR.absolute()}")


if __name__ == "__main__":
    main()
