#!/usr/bin/env fish

set -l LOCAL_SERVER "http://localhost:8080"
set -x no_proxy $LOCAL_SERVER

# Internal links should NEVER 404! Check links which start with a dot or slash
linkchecker $LOCAL_SERVER --threads 50 
set -l INTERNAL_STATUS $status

# Check external links which I control. Crawl the running site so every page's
# external links are checked; the allowlist keeps localhost (crawled) plus the
# two hosts I control and drops all other external links. --check-extern makes
# linkchecker fetch the allowlisted external URLs instead of skipping them.
linkchecker $LOCAL_SERVER \
    --config config/linkchecker/linkcheckerrc \
    --ignore-url="!^(http://localhost:8080|https://assets\.turntrout\.com|https://github\.com/alexander-turner/TurnTrout\.com)" \
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
