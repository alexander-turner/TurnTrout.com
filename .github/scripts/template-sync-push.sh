#!/usr/bin/env bash
# Commit the sync-conflict resolutions onto the template-sync branch and push.
#
# Stages EXACTLY the files the resolver reported, never `git add -A`: the run
# that produced these resolutions also ran a model over the working tree, and a
# blanket add would sweep up anything else it touched.
#
# Env: DETERMINISTIC, BY_MODEL (whitespace-separated paths), GITHUB_TOKEN.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$(cd "${SCRIPT_DIR}/lib" && pwd)"
# CONFLICT_MARKER_RE from one place; git_auth_header from another.
# shellcheck source=.github/scripts/lib/merge-conflict.bash
source "${LIB_DIR}/merge-conflict.bash"
# shellcheck source=.github/scripts/lib/git-auth.bash
source "${LIB_DIR}/git-auth.bash"

: "${GITHUB_TOKEN:?GITHUB_TOKEN required}"

read -ra resolved <<<"${DETERMINISTIC:-} ${BY_MODEL:-}"
[[ ${#resolved[@]} -gt 0 ]] || {
  echo "template-sync-push: nothing resolved; nothing to push."
  exit 0
}

# A marker that survived means the resolver's own sweep and this staging step
# disagree. Refuse rather than push a file that still carries a conflict.
for f in "${resolved[@]}"; do
  if grep -qE "$CONFLICT_MARKER_RE" "$f" 2>/dev/null; then
    echo "::error::template-sync-push: '${f}' still carries conflict markers; refusing to push."
    exit 1
  fi
done

git_auth_header "$GITHUB_TOKEN"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add -- "${resolved[@]}"
git diff --cached --quiet && {
  echo "template-sync-push: resolutions already match the branch; nothing to commit."
  exit 0
}

deterministic_count=$(wc -w <<<"${DETERMINISTIC:-}")
model_count=$(wc -w <<<"${BY_MODEL:-}")
git commit -q -m "chore: resolve template-sync conflicts

${deterministic_count} resolved structurally (mergiraf), ${model_count} by the model."
timeout --kill-after=10 60 git push origin HEAD:template-sync
echo "Pushed resolutions for ${#resolved[@]} file(s)."
