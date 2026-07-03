#!/usr/bin/env bash
# Run gitleaks scoped to this PR's commits (merge-base..HEAD) on pull_request,
# or main's full history (--log-opts=HEAD) on push. Env: BASE_SHA
set -eo pipefail
if [[ -n "$BASE_SHA" ]]; then
  MERGE_BASE=$(git merge-base HEAD "$BASE_SHA")
  ./gitleaks detect --no-banner --redact --verbose --log-opts="${MERGE_BASE}..HEAD"
else
  ./gitleaks detect --no-banner --redact --verbose --log-opts="HEAD"
fi
