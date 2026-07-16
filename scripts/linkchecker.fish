#!/usr/bin/env fish

set -l LOCAL_SERVER "http://localhost:8080"
set -x no_proxy $LOCAL_SERVER

# Internal links should NEVER 404! Check links which start with a dot or slash
linkchecker $LOCAL_SERVER --threads 50 
set -l INTERNAL_STATUS $status

# Check external links which I control
set -l GIT_ROOT (git rev-parse --show-toplevel)
set TARGET_FILES_EXTERNAL $GIT_ROOT/public/**html
# Archived-snapshot URLs (assets.turntrout.com/static/link-archive/...) are
# skipped: once the manifest is populated, checking them would make every build
# GET thousands of multi-hundred-KB snapshots and hammer R2. Their liveness is
# guaranteed instead by scripts/check_link_archive_integrity.py in the weekly
# archive job.
linkchecker $TARGET_FILES_EXTERNAL \
    --ignore-url="!^https://(assets\.turntrout\.com|github\.com/alexander-turner/TurnTrout\.com)" \
    --ignore-url="^https://assets\.turntrout\.com/static/link-archive/" \
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
