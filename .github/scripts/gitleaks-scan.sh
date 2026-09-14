#!/usr/bin/env bash
# Run gitleaks scoped to this PR's commits (merge-base..HEAD) on pull_request,
# or main's full history (--log-opts=HEAD) on push. Env: BASE_SHA
<<<<<<< local
set -eo pipefail
# Gitleaks only auto-discovers a config named .gitleaks.toml at the scan root,
# so the allowlist under config/gitleaks/ must be pointed to explicitly.
CONFIG="config/gitleaks/.gitleaks.toml"
if [[ -n "$BASE_SHA" ]]; then
=======
set -euo pipefail
if [[ -n "${BASE_SHA:-}" ]]; then
>>>>>>> template
  MERGE_BASE=$(git merge-base HEAD "$BASE_SHA")
  ./gitleaks detect --config "$CONFIG" --no-banner --redact --verbose --log-opts="${MERGE_BASE}..HEAD"
else
  ./gitleaks detect --config "$CONFIG" --no-banner --redact --verbose --log-opts="HEAD"
fi
