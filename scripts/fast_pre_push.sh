#!/bin/sh
set -e

# Quote the variable in the trap
trap 'handle_cleanup "$PUSHED_CHANGES"' EXIT

# Main script logic first
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Handle cleanup function separately
# shellcheck disable=SC2317
handle_cleanup() {
  _exit_code=$?

  # Explicitly set error handling
  set +e

  _git_status=$(git status --porcelain | wc -l)
  if [ "$_git_status" -gt 0 ]; then
    echo "Committing changes..."
    git add -A
    git commit -m "chore: updated publication dates and/or requirements.txt" || true
  fi

  _pushed_changes=$1
  if [ "$_pushed_changes" -eq 1 ]; then
    echo "Restoring stashed changes..."
    git stash pop >>/dev/null || true
  fi

  return "$_exit_code"
}

# If there are any changes, stash them and return 1, otherwise return 0.
stash_and_exit() {
  PREV_NUM_STASHES=$(git stash list | wc -l)
  git stash push --include-untracked >>/dev/null
  # Check if anything was stashed
  if [ "$(git stash list | wc -l)" -gt "$PREV_NUM_STASHES" ]; then
    echo "1"
  else
    echo "0"
  fi
}

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT"

PUSHED_CHANGES=$(stash_and_exit)

if [ "$CURRENT_BRANCH" != "main" ]; then
  exit 0
fi

sh "$GIT_ROOT/scripts/update_requirements.sh"
python "$GIT_ROOT/scripts/update_date_on_publish.py"

exit 0
