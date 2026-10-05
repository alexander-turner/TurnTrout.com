#!/usr/bin/env bash
# Cancel the queued/in-progress Actions runs still executing on a closed PR's
# head SHA. Invoked by pr-meta-privileged.yaml's cancel job with REPO, HEAD_REF, HEAD_SHA,
# GH_TOKEN in the environment; RUN_SWEEP_LIMIT (default 100) caps how many runs
# on that branch one call lists. Reclaims runner slots a merge/close would
# otherwise leave held — GitHub cancels superseded runs only when a newer push
# arrives, never on close.
set -euo pipefail

# shellcheck source=.github/scripts/lib-ci-retry.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-ci-retry.sh"

: "${REPO:?}" "${HEAD_REF:?}" "${HEAD_SHA:?}" "${GH_TOKEN:?}"

# gh treats --branch as a literal filter, so the attacker-supplied branch name is
# data, not code; a `set -e` failure here reds the job rather than silently
# cancelling nothing. Match on HEAD_SHA too: a reused branch name can carry runs
# from an unrelated head we must not touch. retry_stdout in a command
# substitution rides out a transient list-API blip on this idempotent GET.
RUN_SWEEP_LIMIT="${RUN_SWEEP_LIMIT:-100}"
runs_json="$(retry_stdout gh run list --repo "$REPO" --branch "$HEAD_REF" --limit "$RUN_SWEEP_LIMIT" \
  --json databaseId,status,headSha)"
# gh run list returns a branch's runs newest-first, so a full page means only
# the RUN_SWEEP_LIMIT newest runs were seen; any in-flight run on HEAD_SHA older
# than those (own push exceeding the limit, or a later push to the same branch
# racing the close event) was never listed and so never cancelled.
if [[ "$(jq 'length' <<<"$runs_json")" -eq "$RUN_SWEEP_LIMIT" ]]; then
  echo "::warning::run sweep for ${HEAD_REF} listed only the ${RUN_SWEEP_LIMIT} newest runs on the branch; any in-flight run on ${HEAD_SHA:0:8} older than those was not cancelled."
fi

ids=()
while IFS= read -r id; do
  [[ -n "$id" ]] && ids+=("$id")
done < <(printf '%s' "$runs_json" | jq -r --arg sha "$HEAD_SHA" \
  '.[] | select(.headSha == $sha and (.status == "in_progress" or .status == "queued")) | .databaseId')

if [[ "${#ids[@]}" -eq 0 ]]; then
  echo "No in-flight runs on ${HEAD_SHA:0:8} to cancel."
  exit 0
fi

echo "Cancelling ${#ids[@]} in-flight run(s) on ${HEAD_SHA:0:8}:"
# A cancel can lose a benign race (the run just finished → gh exits non-zero);
# that is the one recovery we swallow, and only with a reported reason, so a real
# permission/API failure is still visible in the log.
for id in "${ids[@]}"; do
  if gh run cancel "$id" --repo "$REPO"; then
    echo "  cancelled ${id}"
  else
    echo "  ${id}: could not cancel (already completed?)"
  fi
done
