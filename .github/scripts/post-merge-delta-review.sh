#!/usr/bin/env bash
# Fold the Sonnet merge-delta reviewer's findings INTO the remerge-diff
# supervision comment (the "Hand-authored merge-resolution deltas" sticky) so a
# reviewer reads the deltas and their review in ONE comment instead of two. The
# review is a delimited block ($STICKY_REVIEW_START..$STICKY_REVIEW_END) appended to that
# comment; the remerge-diff renderer (remerge-diff-comment.sh) preserves the
# block when it refreshes the deltas, so the two workflows cooperate on one
# comment without clobbering each other.
#
# The model's text is derived from the untrusted merge delta, so it is run
# through the SAME agent-input-sanitizer as the input before it reaches a posted
# comment — a hidden payload the model echoed from the delta can't ride into the
# comment.
#
# Advisory only: this posts/patches a comment, never a REQUEST_CHANGES review, so
# a finding never hard-blocks the merge (a human decides).
#
# Runs on every push where the prepare step SUCCEEDED (not only when there were
# deltas), so the review block stays truthful across transitions:
#   - merge-review.md present → the model's findings (or its clean verdict);
#   - merge-review.md absent  → the current head has no hand-authored merge
#     deltas; the block says so, so a concern about a since-removed merge stops
#     showing stale.
#
# Fallback: when the remerge-diff comment is absent — a fork PR (whose remerge
# comment step is skipped for lack of a write token) or a rare race where the
# review finishes before the deltas are posted — the review lives on its OWN
# sticky comment so the findings are never lost. A concern creates that
# fallback; a clean verdict only updates an existing one.
#
# Requires: GH_TOKEN, GH_REPO, PR, PR_INPUT_DIR; node with the sanitizer on the
# module path.
set -euo pipefail

: "${PR:?PR number required}"
: "${GH_REPO:?GH_REPO required}"
: "${PR_INPUT_DIR:?PR_INPUT_DIR required}"

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/lib" && pwd)"
# shellcheck source=.github/scripts/lib/merge-delta-verdict.bash
source "${LIB_DIR}/merge-delta-verdict.bash"
# shellcheck source=.github/scripts/lib/sticky-comment.bash
source "${LIB_DIR}/sticky-comment.bash"

review="${PR_INPUT_DIR}/merge-review.md"

had_deltas=true
[[ -s "$review" ]] || had_deltas=false

# The review BLOCK, delimited and sanitized. This is spliced into the
# remerge-diff comment, or posted standalone in the fallback.
block="$(mktemp)"
{
  printf '%s\n' "$STICKY_REVIEW_START"
  printf '## Merge-resolution review (Sonnet 5)\n\n'
  if [[ "$had_deltas" == "true" ]]; then
    # Clean the model output before it reaches the comment: a `<!--` it echoed from the
    # merge deltas could otherwise close this block early with a forged $STICKY_REVIEW_END.
    node .github/scripts/sanitize-pr-input.mjs --model-text <"$review"
  else
    printf 'No merge-resolution deltas on the current head.\n'
  fi
  printf '\n<sub>Advisory review of this PR'\''s hand-authored merge-resolution deltas (git show --remerge-diff) — the one channel an evil merge can hide in. Non-blocking.</sub>\n'
  printf '%s\n' "$STICKY_REVIEW_END"
} >"$block"

# Only a *findings* body warrants CREATING the standalone fallback; a clean
# verdict (model found nothing, or there are no deltas) only ever UPDATES an
# existing one — so a fork PR that never had a concern stays silent. The verdict
# is read through the shared predicate, so a review that merely mentions or
# quotes the all-clear among findings is a concern here, exactly as it is to the
# resolver's self-review.
is_concern=false
if [[ "$had_deltas" == "true" ]] && ! review_is_clean "$review"; then
  is_concern=true
fi

# Capture each listing on its own line so an auth/list failure is
# distinguishable from "no such comment" — masking both would double-post.
delta_list="$(sticky_comment_ids "$GH_REPO" "$PR" "$STICKY_DELTA_MARKER")"
delta_id="${delta_list%%$'\n'*}"

if [[ -n "$delta_id" ]]; then
  # Fold: splice the fresh review block onto the remerge-diff comment, replacing
  # any prior block. A single blank line separates the deltas from the review;
  # $(cat) trims trailing blanks so repeated refreshes never accumulate them.
  stripped="$(mktemp)"
  merged="$(mktemp)"
  gh api "repos/${GH_REPO}/issues/comments/${delta_id}" --jq .body |
    sticky_strip_review_block >"$stripped"
  {
    printf '%s\n\n' "$(cat "$stripped")"
    cat "$block"
  } >"$merged"
  gh api -X PATCH "repos/${GH_REPO}/issues/comments/${delta_id}" -F body=@"$merged" >/dev/null
  rm -f "$stripped" "$merged"

  # Clean up any orphan standalone review sticky left by a pre-fold run so the
  # review shows in exactly one place.
  orphans="$(sticky_comment_ids "$GH_REPO" "$PR" "$STICKY_REVIEW_START")"
  while IFS= read -r orphan; do
    [[ -n "$orphan" ]] || continue
    gh api -X DELETE "repos/${GH_REPO}/issues/comments/${orphan}" >/dev/null
  done <<<"$orphans"
  rm -f "$block"
  exit 0
fi

# Fallback: no remerge-diff comment (fork PR / race). Keep the review on its own
# sticky so the findings are never lost.
review_list="$(sticky_comment_ids "$GH_REPO" "$PR" "$STICKY_REVIEW_START")"
existing="${review_list%%$'\n'*}"

if [[ -n "$existing" ]]; then
  gh api -X PATCH "repos/${GH_REPO}/issues/comments/${existing}" -F body=@"$block" >/dev/null
elif [[ "$is_concern" == "true" ]]; then
  gh api -X POST "repos/${GH_REPO}/issues/${PR}/comments" -F body=@"$block" >/dev/null
fi
rm -f "$block"
