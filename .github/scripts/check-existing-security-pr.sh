#!/usr/bin/env bash
# Locate the open security rollup PR (if any) by label, check out its branch,
# and merge the default branch into it. Writes outputs consumed by the
# security-vulnerability-scan workflow.
#
# The rollup is regenerated from live alert data every run, so a branch that
# conflicts with the default branch carries nothing worth resolving by hand:
# the stale PR is closed and the run starts a fresh one from the default
# branch. A conflicted rollup must never block the weekly job, or alerts
# accumulate unremediated.
#
# Inputs (env):
#   GH_TOKEN          GitHub token for `gh`
#   DEFAULT_BRANCH    Repository default branch (e.g. "main")
#   GITHUB_OUTPUT     Path to GitHub Actions output file (optional)

set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set}"
: "${DEFAULT_BRANCH:?DEFAULT_BRANCH must be set}"
GITHUB_OUTPUT="${GITHUB_OUTPUT:-/dev/null}"

# Runners have no committer identity, and `git merge` refuses to create a merge
# commit without one.
BOT_IDENTITY=(-c "user.name=github-actions[bot]" -c "user.email=41898282+github-actions[bot]@users.noreply.github.com")

# shellcheck disable=SC2016 # jq string interpolation, not shell expansion
EXISTING=$(gh pr list --label "security-scan" --state open \
  --json number,headRefName --jq '.[0] // empty | "\(.number) \(.headRefName)"')

if [[ -z "$EXISTING" ]]; then
  echo "No existing security PR found, will create new branch"
  echo "exists=false" >>"$GITHUB_OUTPUT"
  exit 0
fi

read -r EXISTING_PR EXISTING_BRANCH <<<"$EXISTING"
echo "Found existing security PR #$EXISTING_PR on branch: $EXISTING_BRANCH"
git fetch origin "$EXISTING_BRANCH"
git checkout "$EXISTING_BRANCH"

if git "${BOT_IDENTITY[@]}" merge "origin/$DEFAULT_BRANCH" --no-edit; then
  {
    echo "branch=$EXISTING_BRANCH"
    echo "exists=true"
  } >>"$GITHUB_OUTPUT"
  exit 0
fi

# Any merge failure other than a content conflict is unexpected: fail loudly.
if ! git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  echo "::error::git merge of origin/$DEFAULT_BRANCH into $EXISTING_BRANCH failed without a conflict."
  exit 1
fi

git merge --abort
echo "::warning::Security PR #$EXISTING_PR conflicts with $DEFAULT_BRANCH; closing it and starting a fresh rollup."
gh pr close "$EXISTING_PR" --delete-branch \
  --comment "Closing: this rollup conflicts with \`$DEFAULT_BRANCH\`. The weekly security scan regenerates fixes from current alert data and opens a fresh PR."
git checkout -B "$DEFAULT_BRANCH" "origin/$DEFAULT_BRANCH"
echo "exists=false" >>"$GITHUB_OUTPUT"
