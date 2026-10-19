#!/usr/bin/env bash
# Post an approving review on a PR the Claude reviewer deliberately SKIPS
# (low-risk chore/style by title, a machine-cut `release:` PR, or a
# bot-authored PR). Under a
# review-required ruleset the Claude review IS the approval for the PRs it reads
# (looks_good -> APPROVE); a class it never reads would otherwise carry no
# approving review and could never auto-merge. This supplies that approval so the
# ruleset lets it through. The caller (claude-review.yaml's auto-approve-skipped
# job `if:`) has already decided this PR is in the skip set — the script just
# posts the review via the shared retry-as-COMMENT helper
# (lib-post-review-with-retry.sh), since an APPROVE can 422 here the same way it
# does when a review carries a formal vote.
#
# Requires: gh authenticated (GH_TOKEN), GH_REPO, PR.
set -euo pipefail

# shellcheck source=.github/scripts/lib-post-review-with-retry.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-post-review-with-retry.sh"

: "${PR:?PR number required}"
: "${GH_REPO:?GH_REPO required}"

BODY="Automated approval: this PR type isn't Claude-reviewed (low-risk change or bot-authored), so it's approved here to satisfy a review-required ruleset. Add the \`needs-auto-review\` label to have Claude review it anyway."

payload="$(mktemp)"
fallback="$(mktemp)"
trap 'rm -f "$payload" "$fallback"' EXIT
jq -n --arg body "$BODY" '{event: "APPROVE", body: $body}' >"$payload"
printf '%s\n' "$BODY" >"$fallback"

post_review_with_retry "$PR" "$payload" "$fallback"
