#!/usr/bin/env bash
# Auto-resolve merge conflicts — LAND step. Takes the git bundle the BUNDLE step
# produced, REPLAYS the same merge itself in a tree no model ever touched, and
# pushes the bundled commit only when it differs from that replay exclusively in
# paths git's own merge left conflicted.
#
# This is the job that holds the push credential, and it is deliberately the job
# that runs none of the pull request's code: no local `uses: ./…` composite (a
# local action's manifest is read from the workspace, which is the PR's own
# copy), no dependency install, no model. Everything it runs is staged from the
# base ref, and the one thing that crosses from the resolving job is a git
# bundle carrying a single commit.
#
# The bundle is treated as UNTRUSTED. It transmits no manifest and no claim,
# because every claim it could make is one this script would have to re-derive
# anyway.
set -euo pipefail

# shellcheck source=.github/scripts/auto-resolve-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/auto-resolve-lib.sh"

: "${HEAD_REF:?HEAD_REF required}"
: "${BASE_REF:?BASE_REF required}"
: "${PR:?PR required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN required}"
: "${BUNDLE_DIR:?BUNDLE_DIR required}"

fail() {
  echo "::error::$1"
  # echo-fallback-ok: best-effort failure comment; the run is already failing loudly via exit
  gh pr comment "$PR" --body "⚠️ **Auto-resolve could not finish** — $2 ${3:-Leaving the conflict for a human to resolve.}" || echo "[auto-resolve] failed to post failure comment on PR #${PR}" >&2
  exit 1
}

bundle="${BUNDLE_DIR}/merge.bundle"
if [[ ! -f "$bundle" ]]; then
  echo "No bundle for PR #${PR} — its resolve produced nothing to land."
  exit 0
fi

export GIT_AUTHOR_NAME="github-actions[bot]"
export GIT_AUTHOR_EMAIL="41898282+github-actions[bot]@users.noreply.github.com"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

git_auth_header "$GITHUB_TOKEN"
git fetch --no-tags origin \
  "+refs/heads/${BASE_REF}:refs/remotes/origin/${BASE_REF}" \
  "+refs/heads/${HEAD_REF}:refs/remotes/origin/${HEAD_REF}"

# Unbundling fails closed when a prerequisite object is missing — the branch was
# force-pushed since the resolution was computed, so the merge it describes is
# against a tree that no longer exists.
if ! git fetch "$bundle" "+${AUTO_RESOLVE_RESULT_REF}:${AUTO_RESOLVE_RESULT_REF}"; then
  fail "the resolved merge bundle does not apply to the current branches" \
    "the branch moved after the resolution was computed." "The next conflict scan will retry."
fi

merge_sha="$(git rev-parse "$AUTO_RESOLVE_RESULT_REF")"
parents=()
while IFS= read -r p; do
  [[ -n "$p" ]] && parents+=("$p")
done < <(git rev-list --parents -n 1 "$merge_sha" | tr ' ' '\n' | tail -n +2)
if [[ ${#parents[@]} -ne 2 ]]; then
  fail "the bundled commit has ${#parents[@]} parent(s), not 2" "the resolution did not produce an ordinary two-parent merge commit."
fi
head_sha="${parents[0]}"
base_sha="${parents[1]}"

# Both parents must be the tips this job fetched for itself, and THIS is what
# keeps the replay below from being vacuous: it is replayed from two commits the
# resolving job named, so without pinning them that job also chooses the size of
# the "may differ" set. An ancestor check is not enough for the base side — an
# ANCIENT commit on the base branch passes it, conflicts against most of the
# tree, and the conflicted set that licenses differences swells to match.
#
# The base tip moving mid-resolution is a race, not a fault: the resolution
# merged a base that is no longer current, so landing it would not clear the
# PR's conflict anyway. Stand down and let the next scan redo it.
base_tip="$(git rev-parse "refs/remotes/origin/${BASE_REF}")"
if [[ "$base_sha" != "$base_tip" ]]; then
  if git merge-base --is-ancestor "$base_sha" "$base_tip"; then
    echo "PR #${PR}'s base moved to ${base_tip} while this resolution was computed against ${base_sha} — standing down; the next scan resolves against the current base."
    exit 0
  fi
  fail "the bundled merge's base parent is not on ${BASE_REF}" "the resolution merged something other than the base branch."
fi
if ! git merge-base --is-ancestor "$head_sha" "refs/remotes/origin/${HEAD_REF}"; then
  fail "the bundled merge's head parent is not on ${HEAD_REF}" "the resolution was computed against a head this branch never had."
fi

# Replay the same merge in a clean worktree, then require the bundled tree to
# differ from the replay ONLY where git itself gave up. Every byte outside the
# conflicted set is therefore git's own merge result, whatever the model did.
replay="${RUNNER_TEMP:?RUNNER_TEMP required}/auto-resolve-replay"
git worktree add --detach --quiet "$replay" "$head_sha"
merge_rc=0
git -C "$replay" merge --no-commit --no-ff "$base_sha" >/dev/null || merge_rc=$?
# rc 1 is "merged, left conflicts", the expected case. Anything higher is a
# merge that never ran, which would leave an EMPTY conflicted set and turn this
# check into a blanket refusal of a faithful resolution.
if [[ "$merge_rc" -gt 1 ]]; then
  fail "replaying the merge of ${BASE_REF} into this branch failed (git exit ${merge_rc})" "the resolution could not be independently re-derived."
fi

conflicted=()
while IFS= read -r f; do
  [[ -n "$f" ]] && conflicted+=("$f")
done < <(git -c core.quotePath=false -C "$replay" diff --name-only --diff-filter=U)
declare -A conflicted_set=()
for f in "${conflicted[@]}"; do conflicted_set["$f"]=1; done

git -C "$replay" add -A
replay_tree="$(git -C "$replay" write-tree)"

# --no-renames is load-bearing: with rename detection a moved file prints only
# its destination, hiding the deletion of its source from this comparison.
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ -z "${conflicted_set["$f"]:-}" ]]; then
    fail "the resolved merge changes path(s) git never left conflicted ('${f}')" \
      "the resolution altered \`${f}\`, which merged cleanly on its own — content in neither side of the merge."
  fi
done < <(git -c core.quotePath=false diff --no-renames --name-only "$replay_tree" "$merge_sha")

# Markers are checked on the COMMITTED object, not on any working tree, and only
# over the paths this job's own replay found conflicted — a whole-tree scan would
# hit a Markdown setext underline (`=======`) in unrelated committed docs.
if [[ ${#conflicted[@]} -gt 0 ]]; then
  marker_rc=0
  marker_hits="$(git grep -nE "$CONFLICT_MARKER_RE" "$merge_sha" -- "${conflicted[@]}")" || marker_rc=$?
  [[ "$marker_rc" -le 1 ]] || fail "scanning the resolved merge for conflict markers failed (git exit ${marker_rc})" "the resolution could not be checked for leftover conflict markers."
  if [[ -n "$marker_hits" ]]; then
    printf '%s\n' "$marker_hits"
    fail "the resolved merge still carries conflict markers" "the resolution left conflict markers behind."
  fi
fi

# Another run — or the PR's own author — may have resolved this branch while
# this resolution was being computed. Landing on top of that would re-conflict
# whoever pushed second, so stand down when the head moved AND the branch now
# merges cleanly. Every uncertain case falls through to the normal path, so this
# can only suppress a wrong red, never a real one.
stand_down_if_already_resolved() {
  # A fetch that fails leaves this unable to tell, which is not evidence to
  # stand down on — fall through to the caller's normal failure path.
  git fetch --no-tags origin "+refs/heads/${HEAD_REF}:refs/remotes/origin/${HEAD_REF}" \
    "+refs/heads/${BASE_REF}:refs/remotes/origin/${BASE_REF}" || return 0
  [[ "$(git rev-parse "refs/remotes/origin/${HEAD_REF}")" == "$head_sha" ]] && return 0
  if git merge-tree --write-tree "refs/remotes/origin/${HEAD_REF}" "refs/remotes/origin/${BASE_REF}" >/dev/null 2>&1; then
    echo "PR #${PR}'s head moved and no longer conflicts with ${BASE_REF} — standing down."
    exit 0
  fi
  return 0
}
stand_down_if_already_resolved

# The merge is pushed with TEMPLATE_SYNC_TOKEN — the template's workflow-capable
# PAT. It is the only sanctioned push token here for two reasons: (1) as a PAT it
# RETRIGGERS the PR's checks so the resolved head is re-validated before it can
# auto-merge (a default GITHUB_TOKEN push does not retrigger — GitHub's recursion
# guard — which would strand stale green checks on a tree they never ran against);
# and (2) when the merge commit changes files under .github/workflows/, GitHub
# refuses the push from any token lacking the workflow scope, which the Actions
# GITHUB_TOKEN can never hold. Absent, there is no token that can reliably push
# this merge, so fail closed and label the PR — discover excludes the label, so
# every base push does not re-run a paid resolve into the same wall.
if [[ -z "${TEMPLATE_SYNC_TOKEN:-}" ]]; then
  apply_blocked_label "$PR"
  fail "no push token configured (TEMPLATE_SYNC_TOKEN is unset)" \
    "the resolution was computed but cannot be pushed: no \`TEMPLATE_SYNC_TOKEN\` secret is set (a PAT with the \`workflow\` scope is required to push a merge that may touch workflow files and to retrigger CI). Set it, then remove the \`auto-resolve-blocked\` label to let auto-resolve retry — while it is present this PR is skipped."
fi

git_auth_header "$TEMPLATE_SYNC_TOKEN"

# A normal (non-force) push: this ADDS a merge commit on top of the PR head, so
# it fast-forwards the branch. A concurrent author push makes it non-ff and the
# push rejects — the run fails loud rather than clobbering their work. The
# branch tip is the lock; there is no other reconciliation.
push_rc=0
push_out="$(git push origin "${merge_sha}:${HEAD_REF}" 2>&1)" || push_rc=$?
if [[ "$push_rc" -ne 0 ]]; then
  printf '%s\n' "$push_out" >&2
  if grep -qE 'refusing to allow .* workflow' <<<"$push_out"; then
    apply_blocked_label "$PR"
    fail "push rejected: the merge touches .github/workflows/ and the push token lacks the workflow scope" \
      "the resolved merge carries workflow-file changes from \`${BASE_REF}\`, and the \`TEMPLATE_SYNC_TOKEN\` push token lacks the \`workflow\` scope. Grant it the \`workflow\` scope (or resolve the conflict locally), then remove the \`auto-resolve-blocked\` label to let auto-resolve retry — while it is present this PR is skipped."
  fi
  stand_down_if_already_resolved
  fail "push to ${HEAD_REF} rejected" \
    "the resolved merge could not be pushed — most likely the branch moved while resolving." "The next conflict scan will retry."
fi

# The protected-path warning is re-derived from the conflicts this job computed,
# never from a list the resolving job handed over.
protected_note=""
protected_hits="$(protected_matches "${conflicted[@]}" | tr '\n' ' ')"
protected_hits="${protected_hits% }"
if [[ -n "$protected_hits" ]]; then
  protected_note=" ⚠️ This resolution touched protected path(s) (\`${protected_hits}\`) — review the merge-resolution delta before merging."
fi

# echo-fallback-ok: best-effort success comment; the pushed merge commit is the actual outcome
gh pr comment "$PR" --body "🤖 **Auto-resolved the merge conflict with \`${BASE_REF}\`** — deterministic regeneration of generated files (when configured) plus LLM resolution of the remaining source conflicts, independently re-verified against a replay of the same merge, then merged in. CI will re-run; this PR still needs its normal review and green checks before it can merge.${protected_note}" || echo "[auto-resolve] failed to post success comment on PR #${PR}" >&2
echo "Landed ${merge_sha} on ${HEAD_REF} for PR #${PR}."
