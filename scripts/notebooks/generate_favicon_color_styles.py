#!/usr/bin/env python3
"""Extract dominant colors for favicons and update favicon.scss."""

GOOGLE_BLUE = "#4285f4"

# Manual mapping of known brand colors based on official brand guidelines
# These are the official/commonly recognized colors for each brand
BRAND_COLORS = {
    "abcnews_go_com": "#ffde00",  # ABC News yellow
    "alignmentforum_org": "#5f9b65",  # Alignment Forum green
    # "amazon_com": "#ff9900",  # Amazon orange
    "anthropic": "#d97757",  # Anthropic orange/terracotta
    "arbital_com": "#006a3d",  # Arbital dark green
    "arxiv": "#b31b1b",  # arXiv red
    "cnn": "#cc0000",  # CNN red
    "deepmind": "#2151a1",  # DeepMind medium blue
    "discord": "#5865f2",  # Discord blurple
    "drive_google": GOOGLE_BLUE,  # Google Drive blue
    "forum_effectivealtruism_org": "#0c869b",  # EA Forum teal
    "google": GOOGLE_BLUE,  # Google blue
    "googlecolab": "#f9ab00",  # Google Colab orange
    "googledocs": GOOGLE_BLUE,  # Google Docs blue
    "googlescholar": GOOGLE_BLUE,  # Google Scholar blue
    "huggingface": "#ffb000",  # Hugging Face yellow
    "intelligence_org": "#3498db",  # Intelligence.org blue
    "matsprogram_org": "#e74c3c",  # MATS red
    # "msnbc": "#0b8bd1",  # MSNBC rainbow
    "open_spotify": "#1db954",  # Spotify green
    # "openai": "#412991",  # OpenAI purple
    "overleaf": "#46a247",  # Overleaf green
    "play_google": GOOGLE_BLUE,  # Google Play gray
    # "playwright_com": "#2ead52",  # Playwright green
    "proton": "#6d4aff",  # Proton purple
    "reddit": "#ff4500",  # Reddit orange-red
    "rss": "#ee802f",  # RSS orange
    "slatestarcodex_com": "#0066cc",  # Slate Star Codex blue
    "substack_com": "#ff6719",  # Substack orange
    "whitehouse_gov": "#002868",  # White House blue
    "youtube": "#ff0000",  # YouTube red
}


def main() -> None:
    """Generate SCSS color variables for favicons."""
    scss_file = (
        "/Users/turntrout/Downloads/turntrout.com/quartz/styles/favicon.scss"
    )

    # Read the existing file to find where to insert the colors
    with open(scss_file, encoding="utf-8") as file:
        content = file.read()

    # Generate the color variables section
    color_vars = []
    color_vars.append("  // Per-domain SVG colors")

    for domain, color in sorted(BRAND_COLORS.items()):
        color_vars.append(
            f'\n  .favicon-span > svg.favicon[data-domain="{domain}"] {{'
        )
        color_vars.append(f"    --svg-color: {color};")
        color_vars.append("  }")

    # Insert at the end of the file
    insertion_point = len(content)

    new_content = (
        content[:insertion_point] + "\n\n" + "\n".join(color_vars) + "\n"
    )

    with open(scss_file, "w", encoding="utf-8") as file:
        file.write(new_content)

    print(f"Added {len(BRAND_COLORS)} color definitions to {scss_file}")


if __name__ == "__main__":
    main()
