#!/usr/bin/env fish

# Process multiple favicons with different background colors
set -l BASE_URL "https://assets.turntrout.com/static/images/external-favicons"

# White background removal (default)
fish scripts/make_favicon_transparent.fish \
    "$BASE_URL/amazon_com.avif" \
    "$BASE_URL/proton_me.avif" \
    "$BASE_URL/proton_vpn_com.avif" \
    "$BASE_URL/playwright_dev.avif" \
    "$BASE_URL/smile_amazon_com.avif" \
    "$BASE_URL/overleaf_com.avif" \
    "$BASE_URL/bitwarden_com.avif" \
    "$BASE_URL/predictionbook_com.avif" \
    "$BASE_URL/developers_googleblog_com.avif" \
    "$BASE_URL/jmlr_org.avif" \
    "$BASE_URL/quartz_jhao_xyz.avif" \
    "$BASE_URL/investopedia_com.avif"

# Black background removal
fish scripts/make_favicon_transparent.fish --color black \
    "$BASE_URL/gwern_net.avif" \
    "$BASE_URL/openai_com.avif"

# Dark gray background removal for obsidian
fish scripts/make_favicon_transparent.fish --color "#161618" \
    "$BASE_URL/obsidian_md.avif"

echo "Success! All favicons processed."

