#!/usr/bin/env bash
# Sticky-upsert the remerge-diff report as a PR comment: PATCH the existing
# marked comment when present, else POST one. When the report is empty (no
# hand-authored resolution deltas remain on the current head), an existing
# comment from an earlier push is PATCHed to say so — deleting it would erase
# the record that a delta was ever flagged, and leaving it stale would claim a
# delta that no longer exists.
#
# The merge-delta review (post-merge-delta-review.sh) folds its findings into
# this same comment as a delimited block, which a refresh carries over.
# Env: GH_TOKEN, REPO, PR_NUMBER, REPORT_FILE.
set -euo pipefail

# shellcheck source=.github/scripts/lib/sticky-comment.bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/lib" && pwd)/sticky-comment.bash"

# A plain assignment, so a listing failure aborts here rather than reading as
# "no existing comment" and POSTing a duplicate every run.
comments=$(sticky_comment_ids "$REPO" "$PR_NUMBER" "$STICKY_DELTA_MARKER")
existing=${comments%%$'\n'*}

if [[ ! -s "$REPORT_FILE" ]]; then
  [[ -n "$existing" ]] || exit 0
  printf '%s\n%s\n' "$STICKY_DELTA_MARKER" \
    "## Hand-authored merge-resolution deltas: none on the current head." \
    >"$REPORT_FILE"
fi

if [[ -n "$existing" ]]; then
  # Carry any folded review block (start..end inclusive) onto the fresh report.
  body_tmp="$(mktemp)"
  review_tmp="$(mktemp)"
  gh api "repos/$REPO/issues/comments/$existing" --jq .body >"$body_tmp"
  sticky_review_block <"$body_tmp" >"$review_tmp"
  if [[ -s "$review_tmp" ]]; then
    printf '\n' >>"$REPORT_FILE"
    cat "$review_tmp" >>"$REPORT_FILE"
  fi
  rm -f "$body_tmp" "$review_tmp"
fi

if [[ -n "$existing" ]]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$existing" -F body=@"$REPORT_FILE" >/dev/null
else
  gh api -X POST "repos/$REPO/issues/$PR_NUMBER/comments" -F body=@"$REPORT_FILE" >/dev/null
fi
