#!/usr/bin/env bash
# Approve the PR when the automated reviewer's hold is fully cleared, regardless
# of WHO cleared the last thread. This is the single source of truth for "the
# reviewer requested changes (or commented), every one of its threads is now
# resolved, so post the APPROVE that supersedes the hold and satisfies a
# review-required ruleset."
#
# It is deliberately state-based and idempotent: it reads thread and review state
# via the API and decides from that alone, never from who resolved what. It runs
# on a periodic sweep of open PRs (claude-reviewer-hold-clear.yaml), so a
# resolution that fires no workflow event cannot leave the hold stranded.
#
# Approves ONLY when the reviewer's LATEST review is CHANGES_REQUESTED or
# COMMENTED (any other latest state means nothing to clear: APPROVED already
# through, DISMISSED, or "" it never reviewed this PR; the allowlist is stricter
# than "!= APPROVED" on purpose), AND the reviewer opened at least one thread
# with none still unresolved. A hold whose concern lived only in the review body
# opens no thread, so it clears on the reviewer's own re-review instead.
#
# Env: the GH_TOKEN_* ladder rungs (see lib/github-token-ladder.bash), GH_REPO
# (owner/name), PR; REVIEWER_LOGIN optional.
set -euo pipefail

: "${GH_REPO:?GH_REPO required}"
: "${PR:?PR number required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/github-token-ladder.bash disable=SC1091
source "$SCRIPT_DIR/lib/github-token-ladder.bash"

# Every call below spends API quota, so pick a credential that has some before
# the first one rather than discovering it mid-flight. Reddening only once EVERY
# rung is spent is the point: a spent top rung is not a reason to fail a step
# whose posture is to degrade, but nothing left to spend anywhere is a real
# blocker a human has to clear, so it is not swallowed either.
GH_TOKEN="$(github_token_with_quota)" || {
  echo "every configured GitHub credential is out of API quota; cannot read this PR's review state, so the reviewer's hold is left in place. Re-run once quota resets, or provision another TEMPLATE_SYNC_TOKEN." >&2
  exit 1
}
export GH_TOKEN
# Both reviewer lookups below run through `gh api graphql`, which spells an app
# bot's login WITHOUT the `[bot]` suffix the REST API appends (REST
# `github-actions[bot]` ↔ GraphQL `github-actions`). Comparing the REST-shaped
# value against GraphQL's matched zero reviews, so this script always concluded
# "no live hold" and never posted the clearing approval; reviewer_login_init owns
# that normalization now, for every reviewer script (lib/reviewer-login.bash).
# shellcheck source=lib/reviewer-login.bash disable=SC1091
source "$SCRIPT_DIR/lib/reviewer-login.bash"
reviewer_login_init

owner="${GH_REPO%%/*}"
name="${GH_REPO##*/}"

# Read the reviewer's reviews BEFORE the thread evidence below, and pin the hold
# this run may dismiss to what this read sees. INVARIANT — that order keeps the
# dismissal off a hold the reviewer submits mid-run: such a hold postdates the
# resolved-thread snapshot that licenses the dismissal, so nothing here has
# cleared it and it keeps blocking the merge.
# shellcheck disable=SC2016 # GraphQL query + jq program are literal, not shell
reviews_query='query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviews(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { databaseId author { login } state submittedAt }
      }
    }
  }
}'
reviewer_reviews="$(gh api graphql --paginate \
  -f query="$reviews_query" -f owner="$owner" -f name="$name" -F pr="$PR" \
  --jq ".data.repository.pullRequest.reviews.nodes[]
        | ${REVIEWER_MATCH_AUTHOR}
        | {databaseId, state, submittedAt}")"

# Paginated: a long-lived PR can accrue >100 reviews, and an unpaginated
# first:100 returns the OLDEST 100 and would pick a stale state. Each slurp below
# therefore sorts by submittedAt across every page.
latest_state="$(jq -rs \
  'if length == 0 then "" else (sort_by(.submittedAt) | last | .state) end' \
  <<<"$reviewer_reviews")"

# The most recent CHANGES_REQUESTED specifically, NOT the latest review: a
# CHANGES_REQUESTED keeps blocking until dismissed or superseded by an APPROVED
# from the same reviewer, and a later COMMENTED review does not clear it. So the
# blocking review is routinely not the latest one.
blocking_review_id="$(jq -rs '[.[] | select(.state == "CHANGES_REQUESTED")]
  | if length == 0 then "" else (sort_by(.submittedAt) | last | .databaseId) end' \
  <<<"$reviewer_reviews")"

if [[ "$latest_state" != "CHANGES_REQUESTED" && "$latest_state" != "COMMENTED" ]]; then
  echo "reviewer's latest review is '${latest_state:-<none>}' — no live hold to clear; nothing to do" >&2
  exit 0
fi

# Count the reviewer's threads two ways. Paginated: a PR can accrue >100 threads,
# and an unpaginated first:100 would miss a thread on a later page. The per-page
# --jq emits one {total, unresolved} object; the trailing reduce sums them.
# shellcheck disable=SC2016 # GraphQL query + jq program are literal, not shell
remaining_query='query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { isResolved comments(first: 1) { nodes { author { login } } } }
      }
    }
  }
}'
# A thread hold is "demonstrably cleared" only when the reviewer opened at least
# one thread AND none remain unresolved. A CHANGES_REQUESTED / COMMENTED review
# that opened ZERO threads carries no thread resolution signal, so the `total`
# guard below exits on it: auto-clearing a thread-less hold on "unresolved == 0"
# (trivially true with no threads) would merge the reviewer's concern unaddressed.
# shellcheck disable=SC2016 # jq program is literal, not shell ($p is a jq var)
counts="$(gh api graphql --paginate \
  -f query="$remaining_query" -f owner="$owner" -f name="$name" -F pr="$PR" \
  --jq "[.data.repository.pullRequest.reviewThreads.nodes[]
         | ${REVIEWER_MATCH_THREAD_ROOT}]
        | {total: length, unresolved: (map(select(.isResolved == false)) | length)}" |
  jq -s 'reduce .[] as $p ({total: 0, unresolved: 0};
           {total: (.total + $p.total), unresolved: (.unresolved + $p.unresolved)})')"
unresolved="$(jq -r '.unresolved' <<<"$counts")"
total="$(jq -r '.total' <<<"$counts")"

if [[ "${unresolved:-0}" -ne 0 ]]; then
  echo "${unresolved} reviewer thread(s) still open; not approving" >&2
  exit 0
fi

# INVARIANT — an approval needs a RESOLVED thread to rest on. A hold whose
# concern lived only in the review body opens no thread, so nothing here can
# clear it: the reviewer's own re-check on the next push supersedes that verdict.
if [[ "${total:-0}" -eq 0 ]]; then
  echo "reviewer opened no thread, so no resolution signal exists; a thread-less hold clears on the reviewer's own re-review" >&2
  exit 0
fi

cleared_by="every review conversation from the automated reviewer has been resolved"

# Dismiss the stale CHANGES_REQUESTED pinned above. Reached only when that hold
# is already proven clear and the approval was structurally refused, so it is the
# fallback lever for a hold nothing else can clear.
#
# Dismissal is not approval: it needs write access rather than a different actor,
# so it succeeds exactly where the approval cannot — including for GITHUB_TOKEN,
# which GitHub bars from approving at all, so the periodic sweep gains it too.
#
# The selection is what makes this safe: it filters on the reviewer's own login,
# so a HUMAN's CHANGES_REQUESTED is never a candidate. A human hold still blocks
# and still needs that human. Dismissing is also idempotent — a dismissed review's
# state stops being CHANGES_REQUESTED, so a re-run finds nothing and says so.
dismiss_stale_hold() {
  local reason="$1" review_id="$blocking_review_id" dismiss_err now_state

  if [[ -z "$review_id" ]]; then
    echo "${REVIEWER_LOGIN} has no active CHANGES_REQUESTED, so it has none to dismiss: its hold was a COMMENTED review, or it never filed one. A hold from any other reviewer still blocks the merge." >&2
    return 0
  fi

  # Unlike the approval refusals above, a failed dismissal is NOT structural, so
  # it is a real error. One case is not: the pinned hold can be dismissed by a
  # human or another sweep between the pin above and this call, and GitHub then
  # refuses the PUT. Re-read the review to tell those apart — an unreadable state
  # falls through to the loud failure, so a real fault is never swallowed.
  if ! dismiss_err="$(gh api --method PUT \
    "repos/${GH_REPO}/pulls/${PR}/reviews/${review_id}/dismissals" \
    -f message="$reason" -f event=DISMISS 2>&1)"; then
    if now_state="$(gh api "repos/${GH_REPO}/pulls/${PR}/reviews/${review_id}" \
      --jq '.state')" && [[ "$now_state" != "CHANGES_REQUESTED" ]]; then
      echo "review ${review_id} is now '${now_state}', so its hold was cleared by someone else while this run worked; nothing to dismiss." >&2
      return 0
    fi
    echo "failed to dismiss the reviewer's stale hold (review ${review_id}): ${dismiss_err}" >&2
    return 1
  fi
  echo "dismissed the reviewer's stale CHANGES_REQUESTED (review ${review_id}) — ${reason}" >&2
}
# Two refusals here are STRUCTURAL — no permission, retry or configuration on
# this PR makes them succeed, so failing the job on either would red every PR
# whose hold clears, forever, and a check that can only fail teaches nothing.
# GitHub refuses `addPullRequestReview` for an Actions token regardless of
# permissions ("GitHub Actions is not permitted to approve pull requests"), and
# it refuses any approval of a PR the token's own actor authored. Stand down
# LOUDLY on both, naming the remedy. Any OTHER failure is real and exits
# non-zero.
approve_err=""
if ! approve_err="$(gh pr review "$PR" --repo "$GH_REPO" --approve --body \
  "Automated approval: ${cleared_by}, so this satisfies the review-required ruleset. Re-request review if a human should take a closer look." 2>&1)"; then
  if [[ "$approve_err" == *"not permitted to approve pull requests"* ]]; then
    echo "hold is clear, but this token cannot approve: GitHub blocks approvals from GitHub Actions." >&2
    dismiss_stale_hold "${cleared_by}, so this hold no longer reflects the pull request's state." || exit 1
    exit 0
  fi
  if [[ "$approve_err" == *"Can not approve your own pull request"* ]]; then
    echo "hold is clear, but this token's actor authored PR #${PR}, and GitHub refuses a self-approval." >&2
    dismiss_stale_hold "${cleared_by}, so this hold no longer reflects the pull request's state." || exit 1
    exit 0
  fi
  echo "failed to post the clearing approval: ${approve_err}" >&2
  exit 1
fi
echo "${cleared_by} and reviewer was holding (${latest_state}); approved to satisfy the review gate" >&2
