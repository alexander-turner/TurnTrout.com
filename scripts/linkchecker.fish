#!/usr/bin/env fish

# If there are no arguments passed, use the live server to resolve relative links
# Otherwise use the provided files
set -l TARGET_FILES $argv
if test -z "$TARGET_FILES"
    set TARGET_FILES "http://localhost:8080"
    set -x no_proxy "http://localhost:8080"
end

# Ignore about: URLs
set -l ABOUT_IGNORE_PATTERNS --ignore-url="about:.*" --ignore-url="https?://about:.*"

# Internal links should NEVER 404! Check links which start with a dot or slash
linkchecker $TARGET_FILES --threads 50 $ABOUT_IGNORE_PATTERNS
set -l INTERNAL_STATUS $status

# Check external links which I control
linkchecker $TARGET_FILES \
    --ignore-url="!^https://(assets\.turntrout\.com|github\.com/alexander-turner/TurnTrout\.com)" \
    $ABOUT_IGNORE_PATTERNS \
    --no-warnings \
    --check-extern \
    --threads 30 \
    --user-agent "linkchecker" \
    --timeout 40 
set -l EXTERNAL_STATUS $status

# If any of the checks failed, exit with a non-zero status
if test $INTERNAL_STATUS -ne 0 -o $EXTERNAL_STATUS -ne 0
    echo "Link checks failed: " >&2
    echo "Internal linkchecker: $INTERNAL_STATUS" >&2
    echo "External linkchecker: $EXTERNAL_STATUS" >&2
    exit 1
end

exit 0
