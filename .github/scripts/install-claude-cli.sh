#!/usr/bin/env bash
# Install @anthropic-ai/claude-code globally, pinned to the version one
# package.json names, so every job that reaches for the CLI runs the same build.
#
# Two pins, read in this order:
#   .github/claude-cli/package.json          the repo's own override; not synced,
#                                            and that repo's Dependabot bumps it.
#   .github/claude-cli-default/package.json  the template's default; synced, and
#                                            the template's Dependabot bumps it.
# Neither is a pnpm workspace member: nothing here imports the CLI, and listing
# it in the root package.json makes `pnpm install` refuse the whole workspace
# over its unapproved install scripts (ERR_PNPM_IGNORED_BUILDS).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/retry.bash disable=SC1091
source "$SCRIPT_DIR/lib/retry.bash"

# allow-unsynced: .github/claude-cli/package.json — consumer-owned override; absent, the synced default applies.
override="${SCRIPT_DIR}/../claude-cli/package.json"
default="${SCRIPT_DIR}/../claude-cli-default/package.json"
if [[ -f "$override" ]]; then
  pin_file="$override"
elif [[ -f "$default" ]]; then
  pin_file="$default"
else
  echo "no Claude CLI pin: neither ${override} nor ${default} exists." >&2
  exit 1
fi
command -v jq >/dev/null 2>&1 || {
  echo "jq is required to read ${pin_file}" >&2
  exit 1
}
if ! version="$(jq -r '.dependencies["@anthropic-ai/claude-code"]' "$pin_file")"; then
  echo "jq could not read ${pin_file}." >&2
  exit 1
fi
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "could not read an exact @anthropic-ai/claude-code version from .dependencies in ${pin_file}, got '${version}'." >&2
  exit 1
fi
echo "Installing @anthropic-ai/claude-code@${version} from ${pin_file}"
# Bound + retry: a bare `npm install -g` has no timeout, so a hung registry
# connection (intermittent on GitHub egress) would stall here until the whole
# job's timeout cancels it. `timeout` caps a stuck attempt; retry_cmd rides out a
# transient blip rather than failing the run.
retry_cmd 3 10 timeout --kill-after=10 180 npm install -g "@anthropic-ai/claude-code@${version}"
claude --version
