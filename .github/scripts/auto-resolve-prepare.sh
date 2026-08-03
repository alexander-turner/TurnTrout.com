#!/usr/bin/env bash
# Auto-resolve merge conflicts — PREPARE step.
#
# Merges the PR's base branch into the checked-out PR head, runs an OPTIONAL
# deterministic generated-file pre-pass (`pnpm resolve-generated`, only when the
# repo defines that script), then partitions the remaining conflicted paths so
# the LLM only ever sees hand-mergeable text conflicts (written to
# $GITHUB_OUTPUT):
#   conflict_list=...   hand-mergeable text conflicts, for the LLM prompt
#   deferred_regen=...  generator-owned outputs whose source also conflicted;
#                       FINALIZE regenerates them after the LLM resolves the
#                       sources — the LLM never sees a generated artifact
#                       (always empty in a repo with no resolve-generated script)
#   unresolvable=...    `-merge`-attributed (lockfile) or binary conflicts not
#                       owned by a generator: git leaves NO text markers and the
#                       working tree at "ours", so neither an LLM edit nor a
#                       regen can produce a correct resolution — the workflow
#                       hands off to a human BEFORE any LLM cost
#   modify_delete=...   the subset of conflict_list git left with NO markers
#                       because one side DELETED the path and the other modified
#                       it. Still resolved by the LLM, but under a keep-or-delete
#                       prompt: the only decision available is which side wins,
#                       and it is invisible in the PR's own diff once it lands
#   needs_llm=true      conflict_list is non-empty
#   needs_commit=true   there is a resolution (deterministic and/or LLM) to commit
#   no_op_head=...      set only on the clean-merge no-op exit: the pre-merge
#                       head SHA, so the workflow can hand that head's attempt
#                       mark back (this run resolved nothing)
#
# A conflict touching a PROTECTED path (by default this repo's Claude config or
# its CI machinery — override with AUTO_RESOLVE_PROTECTED_RE) is handed to the LLM
# like any other, and logged here. The LAND step re-derives the protected set from
# the conflicts it computed itself, so nothing is carried across for it to
# believe. Prepare itself never talks to
# GitHub — a run that ends up resolving nothing must say nothing. A clean merge
# is a no-op.
#
# The checkout runs `persist-credentials: false`, so git is authenticated
# out-of-band via an HTTP extraheader (the token is never written to .git/config).
set -euo pipefail

# shellcheck source=.github/scripts/auto-resolve-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/auto-resolve-lib.sh"

# True when one side DELETED the path and the other MODIFIED it (git's
# modify/delete): stage 1 (the merge base) exists, but only one of stage 2
# (ours) / stage 3 (theirs) does. `git ls-files -u` prints
# "<mode> <object> <stage>\t<path>" per stage.
#
# This classification is what stops the resolver from silently reverting a
# deletion. Git writes NO conflict markers for a modify/delete — it leaves the
# surviving side's content in the worktree verbatim — so an LLM given the
# ordinary marker-driven prompt reads the file, finds nothing to resolve, and
# exits successfully; the downstream leftover-marker check then sees a clean
# file and the run reports success, having resurrected a file the branch
# deliberately deleted. Naming these paths lets the rest of the pipeline demand
# an explicit keep-or-delete verdict per path instead.
# Callable only mid-merge (reads the index's unmerged stages).
is_modify_delete() {
  local stages
  stages="$(git ls-files -u -- "$1" | awk '{print $3}' | sort -u)"
  [[ "$stages" == *1* ]] && [[ "$stages" != *2* || "$stages" != *3* ]]
}

: "${BASE_REF:?BASE_REF required}"
: "${HEAD_REF:?HEAD_REF required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN required}"
out="${GITHUB_OUTPUT:?GITHUB_OUTPUT required}"

git_auth_header "$GITHUB_TOKEN"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git fetch --no-tags origin "$BASE_REF"

# Captured before the merge: a clean merge (or fast-forward) moves HEAD, and the
# no-op exit must report the commit the mark-attempt step recorded, not the tip
# the merge produced — the release script hands the attempt back on exactly the
# SHA that was marked.
premerge_head="$(git rev-parse HEAD)"

if git merge --no-edit "origin/${BASE_REF}"; then
  echo "No conflicts merging ${BASE_REF} into ${HEAD_REF} — nothing to resolve."
  {
    echo "needs_llm=false"
    echo "needs_commit=false"
    echo "no_op_head=${premerge_head}"
  } >>"$out"
  exit 0
fi

# Optional deterministic pre-pass: when the repo defines a `resolve-generated`
# script, regenerate + stage conflicted fully-generated files so Claude only ever
# sees genuine source conflicts. Non-fatal on its own; skipped entirely (and the
# whole generated-file classification collapses to empty) when the repo has no
# such script.
if has_resolve_generated; then
  # echo-fallback-ok: regeneration is best-effort by design; the bundle step's unmerged check is the real gate
  pnpm resolve-generated || echo "resolve-generated made no change (or errored) — continuing."
else
  echo "no resolve-generated script defined — skipping deterministic generated-file pre-pass."
fi

mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
declare -A unmerged=()
for f in "${conflicts[@]}"; do unmerged["$f"]=1; done

# A resolve-generated pre-pass may also rewrite UNOWNED splice outputs in the
# working tree. Those bytes are not part of the deterministic resolution —
# restore them to the merged index state so the bundle step's out-of-set guard sees
# only the LLM's edits. (A worktree diff lists unmerged paths too; those are the
# conflicts themselves, not regen noise.) A no-op with no resolve-generated
# script, since then git diff --name-only lists only the conflicts.
while IFS= read -r f; do
  [[ -z "$f" || -n "${unmerged["$f"]:-}" ]] && continue
  git checkout -- "$f"
done < <(git diff --name-only)

if [[ ${#conflicts[@]} -eq 0 ]]; then
  echo "All conflicts resolved deterministically — committing without Claude."
  {
    echo "needs_llm=false"
    echo "needs_commit=true"
  } >>"$out"
  exit 0
fi

# Generator-owned paths (empty with no resolve-generated script, or when the head
# branch's resolve-generated predates `--owned`; those conflicts then fall
# through to the LLM/unresolvable classes).
declare -A owned=()
if has_resolve_generated; then
  while IFS= read -r f; do
    [[ -n "$f" ]] && owned["$f"]=1
  done < <(pnpm -s resolve-generated --owned 2>/dev/null || true) # allow-double-swallow: best-effort — an older head branch's resolve-generated lacks --owned, so the empty owned map is the documented, intended fallthrough to the LLM/unresolvable classes
fi

# Partition. An owned conflict means its source ALSO conflicted (the pre-pass
# already resolved the clean-source ones) — the bundle step regenerates it after the
# LLM resolves the source. A `-merge`-attributed or binary conflict has no
# markers to resolve and no generator to rerun: only a human (relocking,
# re-exporting the asset) can produce the right content.
#
# A modify/delete conflict also has no markers, but it DOES have a resolution an
# LLM can reach — keep the file or honour the deletion — so it stays in
# conflict_list and is ALSO named in `modify_delete`, so the rest of the pipeline
# can demand an explicit verdict per path. Left in the ordinary marker-driven
# class alone it would be the pipeline's most dangerous case, because the
# marker-free file git leaves behind LOOKS resolved.
llm_list=()
deferred_regen=()
unresolvable=()
modify_delete=()
for f in "${conflicts[@]}"; do
  if [[ -n "${owned["$f"]:-}" ]]; then
    deferred_regen+=("$f")
  elif is_unmergeable "$f"; then
    unresolvable+=("$f")
  else
    if is_modify_delete "$f"; then
      modify_delete+=("$f")
    fi
    llm_list+=("$f")
  fi
done

if [[ ${#unresolvable[@]} -gt 0 ]]; then
  echo "Unmergeable conflict(s) '${unresolvable[*]}' — no textual resolution exists; handing off to a human."
  {
    echo "needs_llm=false"
    echo "needs_commit=false"
    echo "unresolvable=${unresolvable[*]}"
  } >>"$out"
  exit 0
fi

# A conflict in any of these touches something sensitive — this repo's Claude
# configuration (.claude/: hooks, skills, settings) or ALL of its CI machinery
# (.github/ — workflows, scripts, and the composite actions that run with the
# job's write token). These are still handed to the LLM; the land step flags them for
# human review in the comment posted with the pushed resolution.
#
# Override the protected set with AUTO_RESOLVE_PROTECTED_RE (an ERE tested against
# each conflicted path): a repo with more sensitive trees widens it (e.g.
# '^(\.claude/|\.github/|infra/|secrets/)'); the default keeps this template's two
# areas. The predicate is shared with the land step, so both read one definition.
protected_hits=()
while IFS= read -r f; do
  [[ -n "$f" ]] && protected_hits+=("$f")
done < <(protected_matches "${conflicts[@]}")
if [[ ${#protected_hits[@]} -gt 0 ]]; then
  echo "Conflict in protected path(s) '${protected_hits[*]}' — the land step will flag for human review; still auto-resolving."
fi

needs_llm=false
[[ ${#llm_list[@]} -gt 0 ]] && needs_llm=true
echo "Handing ${#llm_list[@]} source conflict(s) to Claude: ${llm_list[*]:-<none>}"
if [[ ${#deferred_regen[@]} -gt 0 ]]; then
  echo "Deferring ${#deferred_regen[@]} generated file(s) to post-LLM regeneration: ${deferred_regen[*]}"
fi
if [[ ${#modify_delete[@]} -gt 0 ]]; then
  echo "Modify/delete conflict(s) '${modify_delete[*]}' — each needs an explicit keep-or-delete verdict from the resolver."
fi
{
  echo "needs_llm=${needs_llm}"
  echo "needs_commit=true"
  echo "conflict_list=${llm_list[*]:-}"
  echo "deferred_regen=${deferred_regen[*]:-}"
  echo "modify_delete=${modify_delete[*]:-}"
} >>"$out"
