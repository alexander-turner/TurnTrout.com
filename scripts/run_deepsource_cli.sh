#!/usr/bin/env bash
set -euo pipefail

# Checks DeepSource issues for the current commit using the CLI.
# Returns exit code 1 if issues found.
# Requires DEEPSOURCE_PAT environment variable.

if [[ -z "${DEEPSOURCE_PAT:-}" ]]; then
    echo "Error: DEEPSOURCE_PAT not set"
    exit 1
fi

# Authenticate with PAT
if ! deepsource auth login --with-token "$DEEPSOURCE_PAT" 2>/dev/null; then
    echo "Error: DeepSource authentication failed"
    exit 1
fi

commit_sha=$(git rev-parse HEAD)
echo "Checking DeepSource issues for commit $commit_sha..."

output=$(deepsource issues list --commit "$commit_sha" 2>&1) || {
    echo "Error: DeepSource CLI failed"
    echo "$output"
    exit 1
}

if [[ -z "$output" ]]; then
    echo "No DeepSource issues found."
    exit 0
fi

printf "\n=== DeepSource Issues ===\n"
echo "$output"
printf "\n✗ Issues found - see above for details\n"
exit 1
