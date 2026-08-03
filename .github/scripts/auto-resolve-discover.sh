#!/usr/bin/env bash
# Auto-resolve merge conflicts — DISCOVER step.
#
# Emits the set of PRs the resolve job should process, as a compact JSON array of
# {number, head_ref, base_ref} written to $GITHUB_OUTPUT as `prs=...`.
#
# Scope mirrors the merge-conflict labeler, because the same event set creates
# the conflicts: with PR_NUMBER set (a pull_request event) it considers that one
# PR; unset (a push to the base branch) it scans every open PR. A base-branch
# advance emits NO pull_request event and does NOT re-fire the `labeled` event for
# a PR that already carries the label, so the push scan is the only thing that
# reaches a PR whose conflict was introduced from underneath it.
#
# Only PRs the resolver is allowed to touch are emitted — the same rails the
# workflow's declarative `if` used to enforce, moved here so they hold for the
# push scan too: open, not draft, non-bot author, same-repo head (a fork's token
# is read-only and its author is untrusted), and mergeability CONFLICTING.
#
# Two further filters bound what the resolver spends, and both are keyed to the
# PR's OWN activity rather than to the clock: a PR whose newest commit is older
# than AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS is out of scope, and a PR whose current
# head commit the resolver already ran against is skipped
# (lib/auto-resolve-attempt.bash). Together they mean a base-branch push can
# trigger at most ONE resolve per PR head, and only on branches someone is
# actively pushing to. Both are overridable for a human-dispatched catch-up over
# a backlog: AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS=0 disables the window,
# AUTO_RESOLVE_IGNORE_ATTEMPT_MARK=true drops the per-head mark.
#
# GitHub computes mergeability lazily (a fresh query can report UNKNOWN), so a
# candidate that is neither MERGEABLE nor CONFLICTING is re-queried up to
# MAX_PASSES times before it is dropped for this run — the next event or the
# labeler's own cron retries it.
# Env: GH_TOKEN, REPO; PR_NUMBER scopes to one PR; MAX_PASSES (default 3) caps the
# retry loop; RETRY_DELAY_SECS overrides the between-pass wait.
set -euo pipefail

: "${REPO:?REPO required}"
: "${GH_TOKEN:?GH_TOKEN required}"
out="${GITHUB_OUTPUT:?GITHUB_OUTPUT required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/lib-ci-retry.sh
source "$SCRIPT_DIR/lib-ci-retry.sh"
# shellcheck source=.github/scripts/lib/auto-resolve-attempt.bash
source "$SCRIPT_DIR/lib/auto-resolve-attempt.bash"

fields="number,mergeable,isDraft,isCrossRepository,author,headRefName,headRefOid,baseRefName,state,labels"

# Only PRs whose newest COMMIT landed within this window are auto-resolved. The
# window measures the branch's activity, not its birthday: a conflict on a branch
# someone pushed to today is usually the base moving under active work, which is
# what the resolver is good at, while a branch nobody has touched in a day has a
# conflict that will still be there — and still need the human judgment the
# resolver cannot supply — after another paid attempt. Widen or narrow it here;
# 0 disables the window.
MAX_COMMIT_AGE_HOURS="${AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS:-24}"
[[ "$MAX_COMMIT_AGE_HOURS" =~ ^[0-9]+$ ]] ||
  {
    echo "::error::AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS must be a whole number of hours, got '${MAX_COMMIT_AGE_HOURS}'." >&2
    exit 1
  }

# One JSON object per candidate PR, unfiltered — mergeability is decided by the
# caller so an UNKNOWN can be retried. `pr view` yields one object; `pr list`
# yields an array; normalize both to a stream of objects.
raw_prs() {
  if [[ -n "${PR_NUMBER:-}" ]]; then
    retry_stdout gh pr view "$PR_NUMBER" --repo "$REPO" --json "$fields" --jq '.'
  else
    retry_stdout gh pr list --repo "$REPO" --state open --limit 100 \
      --json "$fields" --jq '.[]'
  fi
}

# Attach `.commits` (the field the age window reads) to each candidate that could
# still be emitted, one `pr view` per PR, and default it to `[]` on the rest.
#
# It is NOT in the listing's `--json` set, and cannot be: `commits` pulls each
# commit's `authors` connection, so GitHub's node estimate for the listing is
# PRs x commits x authors — which blows past the API's node ceiling on a busy
# repo and takes every push-scan discovery down with it. Per PR the estimate is
# orders of magnitude under the ceiling, and the extra calls are bounded by the
# number of conflicted/undecided PRs, not by the repo's open-PR count: a
# MERGEABLE PR is dropped before the window is ever read, so it is not fetched.
with_commit_dates() {
  local candidates="$1" numbers number commits
  # Assigned on its own line, not in the `local` above: a `local x="$(cmd)"`
  # swallows cmd's exit status, and a jq failure here would silently degrade to
  # "no PR needs commit dates" — an empty scan that looks like a clean repo.
  numbers="$(jq -r '.[] | select(.mergeable != "MERGEABLE") | .number' <<<"$candidates")"
  while IFS= read -r number; do
    # An empty candidate set reads as one empty line here; nothing else is blank.
    [[ -n "$number" ]] || continue
    commits="$(retry_stdout gh pr view "$number" --repo "$REPO" --json commits --jq '.commits')"
    candidates="$(jq -c --argjson number "$number" --argjson commits "$commits" \
      'map(if .number == $number then .commits = $commits else . end)' <<<"$candidates")"
  done <<<"$numbers"
  # The window's jq iterates `.commits[]`, which errors on a null — so every
  # candidate carries a list, and a PR with no fetched dates reads as no evidence
  # of recent activity (the `//` arm of within_age_window spends that doubt on
  # NOT resolving it).
  jq -c 'map(.commits //= [])' <<<"$candidates"
}

# Shared by the emit filter and the undecided-retry gate below: a PR outside the
# window is not going to be emitted however its mergeability settles, so waiting
# on one would just burn the retry passes. $max_age_secs == 0 means no window.
# A PR with no commit dates at all (an empty or unreadable list) has no evidence
# of recent activity, and the `//` arm spends the doubt on NOT resolving it.
# $max_age_secs below is a jq --argjson variable, not a shell expansion.
# shellcheck disable=SC2016
within_age_window='($max_age_secs == 0
  or ((([.commits[].committedDate] | max) // "1970-01-01T00:00:00Z"
       | fromdateiso8601) > (now - $max_age_secs)))'

# An emittable PR: open, not draft, non-bot, same-repo, CONFLICTING, inside the
# activity window, and not opted out via the auto-resolve-blocked label (land
# applies it when a resolution cannot be pushed — e.g. the token can't carry
# workflow-file changes — so every base push doesn't re-run a paid resolve into
# the same wall; a human removes the label to re-enable). head_sha rides along
# for the attempt-mark filter below and is stripped before the list is emitted.
emit_filter='select(.state == "OPEN" and .isDraft == false
  and .isCrossRepository == false and ((.author.is_bot) | not)
  and .mergeable == "CONFLICTING"
  and (any(.labels[]; .name == "auto-resolve-blocked") | not)
  and '"$within_age_window"')
  | {number, head_ref: .headRefName, base_ref: .baseRefName, head_sha: .headRefOid}'

max_age_secs=$((MAX_COMMIT_AGE_HOURS * 3600))
prs='[]'
candidates='[]'
for ((pass = 1; pass <= ${MAX_PASSES:-3}; pass++)); do
  [[ "$pass" == "1" ]] || sleep "${RETRY_DELAY_SECS:-10}"
  candidates="$(with_commit_dates "$(raw_prs | jq -s '.')")"
  prs="$(jq -c --argjson max_age_secs "$max_age_secs" "[.[] | $emit_filter]" <<<"$candidates")"
  # Retry only while an eligible-but-undecided PR could still flip to CONFLICTING.
  undecided="$(jq --argjson max_age_secs "$max_age_secs" \
    '[.[] | select(.state == "OPEN" and .isDraft == false
    and .isCrossRepository == false and ((.author.is_bot) | not)
    and '"$within_age_window"'
    and .mergeable != "MERGEABLE" and .mergeable != "CONFLICTING")] | length' \
    <<<"$candidates")"
  [[ "$undecided" == "0" ]] && break
done

# Second filter, and the reason it is not part of the jq above: it costs one API
# call per surviving candidate, so it runs only on the few PRs everything else
# already accepted. A head the resolver has already run against is dropped —
# whatever that run concluded, re-running it against the same tree reaches the
# same conclusion at the same price.
#
# AUTO_RESOLVE_IGNORE_ATTEMPT_MARK=true drops that filter for one run. A mark the
# marking run never gets to release — it crashed, or a resolver defect made it
# conclude nothing without reaching prepare's no-op exit — suppresses this PR for
# the whole TTL, and across a backlog that is hours of waiting for a fix already
# on the base ref. Set it only on a human-dispatched catch-up: on an automatic
# trigger it restores the per-push resolve cost the mark exists to bound.
IGNORE_ATTEMPT_MARK="${AUTO_RESOLVE_IGNORE_ATTEMPT_MARK:-false}"
if [[ "$IGNORE_ATTEMPT_MARK" == "true" ]]; then
  echo "AUTO_RESOLVE_IGNORE_ATTEMPT_MARK=true — re-running against heads the resolver already attempted."
fi

attempted=()
eligible='[]'
rows="$(jq -c '.[]' <<<"$prs")" ||
  {
    echo "::error::could not read the emitted PR list back for the attempted-mark filter." >&2
    exit 1
  }
while IFS= read -r row; do
  # An empty emit list reads as one empty line here; nothing else can be blank.
  [[ -n "$row" ]] || continue
  if [[ "$IGNORE_ATTEMPT_MARK" != "true" ]] &&
    auto_resolve_attempted "$REPO" "$(jq -r '.head_sha' <<<"$row")"; then
    attempted+=("$(jq -r '.number' <<<"$row")")
    continue
  fi
  eligible="$(jq -c --argjson row "$row" '. + [$row | del(.head_sha)]' <<<"$eligible")"
done <<<"$rows"
prs="$eligible"
# echo-fallback-ok: informational skip notice; the eligible-list filter above is the decision, not this echo
[[ ${#attempted[@]} -eq 0 ]] ||
  echo "Skipping PR(s) [$(
    IFS=,
    echo "${attempted[*]}"
  )] — auto-resolve already ran against the current head commit; push a new commit to re-enable it."

blocked="$(jq -c '[.[] | select(.state == "OPEN" and .mergeable == "CONFLICTING"
  and any(.labels[]; .name == "auto-resolve-blocked")) | .number]' <<<"$candidates")"
# echo-fallback-ok: informational skip notice; the empty-list branch is the decision, not this echo
[[ "$blocked" == "[]" ]] || echo "Skipping auto-resolve-blocked PR(s) ${blocked} — remove the label to re-enable auto-resolve for them."

echo "Auto-resolve will process: ${prs}"
echo "prs=${prs}" >>"$out"
