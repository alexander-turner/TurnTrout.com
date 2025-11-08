#!/usr/bin/env python3
"""
Script to integrate new favicons from ~/Pictures/new_favicons into the project.

Maps favicon filenames to domain-based naming convention and moves them to the
correct location.
"""

import shutil
from pathlib import Path
from typing import Final

# Mapping from source filename to target domain-based filename
# Format: source_filename -> target_filename (domain_com.ext)
FAVICON_MAPPING: Final[dict[str, str]] = {
    "abcnews_go_com.svg": "abcnews_go_com.svg",
    "ai_alignment_com.svg": "ai-alignment_org.svg",
    "amazon_com.svg": "amazon_com.svg",
    "anthropic.svg": "anthropic_com.svg",
    "apple.svg": "apple_com.svg",
    "arbital_com.svg": "arbital_com.svg",
    "arxiv.svg": "arxiv_org.svg",
    "cnn.svg": "cnn_com.svg",
    "deepmind.svg": "deepmind_com.svg",
    "discord.svg": "discord_gg.svg",  # Based on whitelist entry
    "drive.google.svg": "drive_google_com.svg",
    "forum_effectivealtruism_org.svg": "forum_effectivealtruism_org.svg",
    "github.svg": "github_com.svg",
    "google.svg": "google_com.svg",
    # Based on whitelist normalization
    "googlecolab.svg": "colab_research_google_com.svg",
    "googledocs.svg": "docs_google_com.svg",
    "googlescholar.svg": "scholar_google_com.svg",
    "gwern_net.svg": "gwern_net.svg",
    "huggingface.svg": "huggingface_co.svg",
    "intelligence_org.svg": "intelligence_org.svg",
    "lesswrong_com.svg": "lesswrong_com.svg",
    "matsprogram_org.svg": "matsprogram_org.svg",
    "msnbc.svg": "msnbc_com.svg",
    "nytimes.svg": "nytimes_com.svg",  # Based on whitelist entry
    "open.spotify.svg": "open_spotify_com.svg",  # Based on whitelist entry
    "openai.svg": "openai_com.svg",
    "overleaf.svg": "overleaf_com.svg",
    "play.google.svg": "play_google_com.svg",
    "playwright_com.svg": "playwright_dev.svg",
    "proton.svg": "proton_me.svg",  # Based on hostname replacement
    "readthesequences_com.svg": "readthesequences_com.svg",
    "reddit.svg": "reddit_com.svg",
    "sfchronicle_com.svg": "sfchronicle_com.svg",
    "slatestarcodex_com.svg": "slatestarcodex_com.svg",
    "turntrout_com.svg": "turntrout_com.svg",
    "whitehouse_gov.svg": "whitehouse_gov.svg",
    "wikipedia.svg": "wikipedia_org.svg",
    "x.svg": "x_com.svg",
    "youtube.svg": "youtube_com.svg",
}

SOURCE_DIR = Path.home() / "Pictures" / "new_favicons"
TARGET_DIR = Path("quartz/static/images/external-favicons")


def main() -> None:
    """Move and rename favicons according to mapping."""
    if not SOURCE_DIR.exists():
        print(f"Error: Source directory not found: {SOURCE_DIR}")
        return

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    moved_count = 0
    skipped_count = 0
    missing_count = 0

    for source_name, target_name in FAVICON_MAPPING.items():
        source_path = SOURCE_DIR / source_name
        target_path = TARGET_DIR / target_name

        if not source_path.exists():
            print(f"Warning: Source file not found: {source_name}")
            missing_count += 1
            continue

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
    print(f"  Missing: {missing_count}")
    print(f"\nTarget directory: {TARGET_DIR.absolute()}")


if __name__ == "__main__":
    main()
