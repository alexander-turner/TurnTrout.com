#!/usr/bin/env python3
"""Extract dominant colors for favicons and update favicon.scss."""

GOOGLE_BLUE = "#4285f4"

# Manual mapping of known brand colors based on official brand guidelines
# These are the official/commonly recognized colors for each brand
BRAND_COLORS = {
    "abcnews_go_com": "#ffde00",  # ABC News yellow
    "alignmentforum_org": "#5f9b65",  # Alignment Forum green
    # "amazon_com": "#ff9900",  # Amazon orange
    "anthropic_com": "#d97757",  # Anthropic orange/terracotta
    "arbital_com": "#006a3d",  # Arbital dark green
    "arxiv_org": "#b31b1b",  # arXiv red
    "cnn_com": "#cc0000",  # CNN red
    "deepmind_com": "#2151a1",  # DeepMind medium blue
    "discord_gg": "#5865f2",  # Discord blurple
    "drive_google_com": GOOGLE_BLUE,  # Google Drive blue
    "forum_effectivealtruism_org": "#0c869b",  # EA Forum teal
    "google_com": GOOGLE_BLUE,  # Google blue
    "colab_research_google_com": "#f9ab00",  # Google Colab orange
    "docs_google_com": GOOGLE_BLUE,  # Google Docs blue
    "scholar_google_com": GOOGLE_BLUE,  # Google Scholar blue
    "huggingface_co": "#ffb000",  # Hugging Face yellow
    "intelligence_org": "#3498db",  # Intelligence.org blue
    "matsprogram_org": "#e74c3c",  # MATS red
    # "msnbc": "#0b8bd1",  # MSNBC rainbow
    "open_spotify_com": "#1db954",  # Spotify green
    # "openai": "#412991",  # OpenAI purple
    "overleaf_com": "#46a247",  # Overleaf green
    "play_google_com": GOOGLE_BLUE,  # Google Play gray
    # "playwright_com": "#2ead52",  # Playwright green
    "proton_me": "#6d4aff",  # Proton purple
    "reddit_com": "#ff4500",  # Reddit orange-red
    "rss": "#ee802f",  # RSS orange
    "substack_com": "#ff6719",  # Substack orange
    "youtube_com": "#ff0000",  # YouTube red
}


def main() -> None:
    """Generate SCSS color variables for favicons."""
    scss_file = (
        "/Users/turntrout/Downloads/turntrout.com/quartz/styles/favicon.scss"
    )

    # Read the existing file to find where to insert the colors
    with open(scss_file, encoding="utf-8") as file:
        content = file.read()

    # Generate the SCSS map and @each loop
    color_vars = []
    color_vars.append(
        "// Per-domain SVG colors (consolidated into SCSS map and @each)"
    )
    color_vars.append("$domain-svg-colors: (")

    # Add all domain-color pairs to the map
    sorted_items = sorted(BRAND_COLORS.items())
    for i, (domain, color) in enumerate(sorted_items):
        # Format hex colors: #cc0000 -> #c00, #ff0000 -> #f00
        formatted_color = color
        if (
            len(color) == 7
            and color[1] == color[2]
            and color[3] == color[4]
            and color[5] == color[6]
        ):
            formatted_color = f"#{color[1]}{color[3]}{color[5]}"

        comma = "," if i < len(sorted_items) - 1 else ""
        color_vars.append(f'  "{domain}": {formatted_color}{comma}')

    color_vars.append(");")
    color_vars.append("")
    color_vars.append("@each $domain, $color in $domain-svg-colors {")
    color_vars.append(
        '  .favicon-span > svg.favicon[data-domain="#{$domain}"] {'
    )
    color_vars.append("    --svg-color: #{$color};")
    color_vars.append("  }")
    color_vars.append("}")

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
