#!/usr/bin/env bash
# Post the automated-review gate's verdict as a COMMIT STATUS on the PR head.
#
# PROBLEM CLASS — auto-merge landing a pull request before the reviewer has
# spoken. The cheap checks finish in about ninety seconds while an LLM review
# takes minutes, so a PR whose ruleset lists only the cheap checks merges first
# and the reviewer's REQUEST_CHANGES arrives on a merged PR. Nothing is red; the
# review simply was not part of the merge gate.
#
# The predicate is one line and stateless: a pull request is clear when at least
# one undismissed review of it was written BY THE REVIEWER and carries a body.
# It needs no memory of which reviews have been seen, and it re-derives the same
# answer on every event. Both halves of "by the reviewer, with a body" are load-
# bearing — see the filter below.
#
# PR-SCOPED, NOT HEAD-SCOPED, and that is load-bearing. Requiring a review OF THE
# CURRENT HEAD looks stricter and strands the pull request instead:
# the reviewer skips a plain `synchronize` once it has spent its read, so
# once the reviewer has approved, the next push produces a head nothing will ever
# review, and a head-scoped gate would hold that pull request at `pending`
# forever with no event able to clear it. Whether a later push still satisfies
# the reviewer is a question the reviewer already owns: a non-approving verdict
# makes every push re-run the cheap recheck, and the review-required ruleset
# holds the merge meanwhile. This gate answers only the question nothing else
# did — has the reviewer spoken about this pull request at all?
#
# A COMMIT STATUS, not this job's own check run. Under `pull_request_target` the
# job's check run is reported against the BASE commit, so it never satisfies a
# requirement evaluated on the pull request's head. A status posted explicitly on
# `HEAD_SHA` does.
#
# Can't-verify is RED, never green: an API failure propagates through `set -e`,
# because a gate that fails open lets a PR merge past a review nobody read.
#
# Env: GH_TOKEN, GH_REPO (owner/name), PR, HEAD_SHA, RUN_URL; REVIEWER_LOGIN
# optional.
set -euo pipefail

: "${GH_REPO:?GH_REPO required}"
: "${PR:?PR number required}"
: "${HEAD_SHA:?HEAD_SHA required}"
: "${GH_TOKEN:?GH_TOKEN required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/reviewer-login.bash disable=SC1091
source "$SCRIPT_DIR/lib/reviewer-login.bash"
reviewer_login_init

# MUST stay byte-identical to the `name:` of the job in review-gate.yaml: that
# job name is what sync-required-checks registers as the ruleset's required
# context, and the status posted here has to carry the same context or the head
# never satisfies it.
GATE_CONTEXT="Automated review posted"

# Every review that still stands, paginated: a long-lived PR accumulates more
# than one page. A DISMISSED review is dropped here, which is what makes the
# workflow's `dismissed` trigger do something — dismissing the only review
# returns the PR to `pending`.
#
# The filter is per-element (`.[] | select(…)`), never a reducer: `gh api
# --paginate --jq` applies the filter to EACH page, so a `first`/`max_by` would
# silently run once per page and answer from the last one.
#
# ONLY THE REVIEWER'S OWN reviews count, and only ones carrying a body. The
# gate's whole claim is "an automated review of this pull request exists", so
# every actor it credits has to be one that actually reviews:
#
#   * Any actor at all is a self-clearing gate. The PR author can open their own
#     pull request, submit a COMMENT review on it with one word, and the required
#     "Automated review posted" context goes green with no reviewer having run.
#     The reviewer identity filter closes that: the author's review is not the
#     reviewer's, so it credits nothing.
#   * A body-less review is not a review. GitHub SYNTHESIZES a body-less
#     COMMENTED review around a standalone review comment, and this repo posts
#     those under the reviewer's own identity whenever something replies
#     in-thread with addPullRequestReviewThreadReply. Without the body filter,
#     that reply alone greens the gate for a pull request the reviewer is still
#     holding. Every writer of a
#     REAL review here sends a non-empty body: the reviewer falls back to
#     "Automated review." when the model returns nothing, auto-approve-skipped-pr.sh
#     and approve-if-reviewer-hold-clear.sh both hardcode theirs.
#
# The approval that auto-approve-skipped posts for a PR the reviewer skips by
# title or author still clears the gate: it is posted with GITHUB_TOKEN, so it
# carries the reviewer identity. Reading that OUTCOME beats re-deriving the skip
# predicate, which would be a second copy of the reviewer's own skip rules.
reviewers="$(gh api --paginate "repos/${GH_REPO}/pulls/${PR}/reviews" \
  --jq ".[] | select(.state != \"DISMISSED\") | ${REVIEWER_MATCH_USER} | select((.body // \"\") != \"\") | .user.login // \"\"")"
reviewer="$(head -n 1 <<<"$reviewers")"

if [[ -n "$reviewer" ]]; then
  state=success
  description="Reviewed by ${reviewer}"
else
  state=pending
  description="Waiting for the automated review of this pull request"
fi

# `pending`, not `failure`, for the not-yet-reviewed case: the review is coming,
# and a red would tell a reader to go diagnose something. Both hold the merge.
gh api -X POST "repos/${GH_REPO}/statuses/${HEAD_SHA}" \
  -f "state=${state}" \
  -f "context=${GATE_CONTEXT}" \
  -f "description=${description}" \
  -f "target_url=${RUN_URL:-}" >/dev/null

echo "posted ${state} status '${GATE_CONTEXT}' on ${HEAD_SHA}: ${description}" >&2
