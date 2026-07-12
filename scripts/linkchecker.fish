#!/usr/bin/env fish

set -l LOCAL_SERVER "http://localhost:8080"
set -x no_proxy $LOCAL_SERVER

# Internal links should NEVER 404! Check links which start with a dot or slash
linkchecker $LOCAL_SERVER --threads 50 
set -l INTERNAL_STATUS $status

# Check external links which I control
set -l GIT_ROOT (git rev-parse --show-toplevel)
set TARGET_FILES_EXTERNAL $GIT_ROOT/public/**html
linkchecker $TARGET_FILES_EXTERNAL \
    --ignore-url="!^https://(assets\.turntrout\.com|github\.com/alexander-turner/TurnTrout\.com)" \
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
