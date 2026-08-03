#!/usr/bin/env bash
# Sync template files into the current repo, producing outputs consumed by
# .github/workflows/template-sync.yaml.
#
# Inputs (env):
#   SYNC_PATHS        Space-separated paths to sync from the template
#                     (path names containing spaces are NOT supported)
#   EXCLUDE_PATHS     Space-separated paths to exclude (whole SYNC_PATHS entries
#                     or individual file paths within synced directories)
#   GITHUB_OUTPUT     Path to GitHub Actions output file
#
# Assumes a sibling `_template/` directory containing a checkout of the
# template repository at the desired ref. Reads `.template-version` (if
# present) for the previously synced SHA and overwrites it with the new one.
#
# Side effects:
#   - Creates/updates files inside the current repo to match the template
#   - Writes /tmp/conflict_files.txt, /tmp/conflict_report.md,
#     /tmp/deleted_files.txt, /tmp/auto_merged_files.txt
#   - Writes .template-sync-conflicts if there are unresolved conflicts
#   - Appends key=value lines to $GITHUB_OUTPUT

set -euo pipefail

# Re-exec from an immutable copy outside any synced path. This script lives
# under .github/scripts, a synced path, so mid-run the sync overwrites its own
# file. bash reads a running script incrementally and, after the trailing
# `main "$@"` returns, resumes reading top-level input at a saved byte offset;
# a longer replacement shifts that offset into the new file's bytes and bash
# executes a truncated fragment ("unexpected EOF while looking for matching
# quote"). The main() wrapper below defers execution but NOT that post-main
# resume, so it is not sufficient on its own. Running from a $TMPDIR copy the
# sync never touches removes the hazard entirely. The re-exec'd pass removes
# its own copy on exit (guard: only when $0 is the copy we created).
if [[ -z "${TEMPLATE_SYNC_REEXEC:-}" ]]; then
  _self_copy="$(mktemp)"
  cat "$0" >"$_self_copy"
  TEMPLATE_SYNC_REEXEC="$_self_copy" exec bash "$_self_copy" "$@"
fi
[[ "${TEMPLATE_SYNC_REEXEC:-}" == "$0" ]] && trap 'rm -f "$0"' EXIT

<<<<<<< local
# Wrap all logic in main(), called as the final line. bash reads a running
# script incrementally from disk, not all at once — this script overwrites
# its own file when SYNC_PATHS includes the directory it lives in, so any
# top-level statement below the self-overwrite would read shifted bytes.
# Deferring everything behind main() forces bash to parse through this
# file's closing brace and the trailing `main "$@"` call before executing
# any of it.
=======
# All logic lives in main(), called as the final line, so bash parses through
# this file's closing brace before executing any of it.
>>>>>>> template
main() {

  SYNC_PATHS="${SYNC_PATHS:-}"
  EXCLUDE_PATHS="${EXCLUDE_PATHS:-}"
  : "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"

  # Allow tests to point at alternative temp dirs.
  WORK_DIR="${TEMPLATE_SYNC_WORK_DIR:-/tmp}"
  CONFLICT_FILES="$WORK_DIR/conflict_files.txt"
  CONFLICT_REPORT="$WORK_DIR/conflict_report.md"
  DELETED_FILES="$WORK_DIR/deleted_files.txt"
  AUTO_MERGED_FILES="$WORK_DIR/auto_merged_files.txt"
  DOWNGRADE_FILES="$WORK_DIR/downgrade_files.txt"
  DOWNGRADE_REPORT="$WORK_DIR/downgrade_report.md"
  PREV_TEMPLATE_FILES="$WORK_DIR/prev_template_files.txt"

  : >"$CONFLICT_FILES"
  : >"$CONFLICT_REPORT"
  : >"$DELETED_FILES"
  : >"$AUTO_MERGED_FILES"
  : >"$DOWNGRADE_FILES"
  : >"$DOWNGRADE_REPORT"

  is_excluded() {
    local candidate="$1" exclude
    for exclude in $EXCLUDE_PATHS; do
      [[ "$candidate" = "$exclude" ]] && return 0
    done
    return 1
  }

  # Generate a random sentinel suffix. Prefers /proc/sys/kernel/random/uuid
  # (always present on Linux runners and inside containers) but falls back to
  # `uuidgen` or $RANDOM so the script works in stripped-down environments.
  random_token() {
    if [[ -r /proc/sys/kernel/random/uuid ]]; then
      cat /proc/sys/kernel/random/uuid
    elif command -v uuidgen >/dev/null 2>&1; then
      uuidgen
    else
      printf '%s_%s_%s' "$$" "$RANDOM" "$RANDOM"
    fi
  }

  # Emit a multi-line GITHUB_OUTPUT block using a random-suffixed sentinel so
  # user-controlled content can't accidentally terminate the block early.
  emit_multiline_output() {
    local key="$1" content="$2" sentinel
    sentinel="EOF_$(random_token)"
    {
      echo "${key}<<${sentinel}"
      printf '%s\n' "$content"
      echo "$sentinel"
    } >>"$GITHUB_OUTPUT"
  }

  # Count non-blank lines present in the pre-sync local file but absent from a
  # candidate result. A clean 3-way merge should preserve every adopter line; a
  # nonzero count means the merge REMOVED content the adopter had — the silent
  # downgrade this report exists to surface. Order-insensitive (sorted comm) so a
  # merely-moved line does not count. grep -c exits 1 with "0" when nothing
  # matches, so the ||-default keeps set -e from aborting on an all-preserved file.
  count_dropped_lines() {
    local local_f="$1" result_f="$2" n
    n=$(comm -23 <(sort "$local_f") <(sort "$result_f") |
      grep -cv '^[[:space:]]*$') || n=0
    printf '%s' "${n:-0}"
  }

  #############################################
  # Version tracking
  #############################################

  TEMPLATE_SHA=$(git -C _template rev-parse HEAD)
  TEMPLATE_SHA_SHORT="${TEMPLATE_SHA:0:7}"
  {
    echo "template_sha=$TEMPLATE_SHA"
    echo "template_sha_short=$TEMPLATE_SHA_SHORT"
  } >>"$GITHUB_OUTPUT"

  PREV_SHA=""
  if [[ -f .template-version ]]; then
    PREV_SHA=$(cat .template-version)
    echo "Previous template version: $PREV_SHA"
  else
    echo "No previous template version found (first sync)"
  fi
  echo "Current template version: $TEMPLATE_SHA"

  if [[ -n "$PREV_SHA" ]] && [[ "$PREV_SHA" != "$TEMPLATE_SHA" ]]; then
    if git -C _template cat-file -e "$PREV_SHA" 2>/dev/null; then
      CHANGELOG=$(git -C _template log --oneline "$PREV_SHA..$TEMPLATE_SHA")
    else
      echo "::warning::Previous template SHA $PREV_SHA not found in template history (likely rewritten by force-push or rebase)"
      CHANGELOG="Previous SHA \`$PREV_SHA\` no longer exists in template history (force-push/rebase). Showing last 20 commits instead:"$'\n'
      CHANGELOG+=$(git -C _template log --oneline -20 "$TEMPLATE_SHA")
    fi
    [[ -n "$CHANGELOG" ]] && emit_multiline_output "changelog" "$CHANGELOG"
  fi

  echo "$TEMPLATE_SHA" >.template-version

  #############################################
  # File processing
  #############################################

  # Resolve a single file's sync outcome using a 3-way merge strategy:
  #
  #   base     = the file at PREV_SHA in the template (last known common ancestor)
  #   local    = the current file in the child repo
  #   template = the file at HEAD in the template
  #
  # Decision tree:
  #   1. File is new in template → copy it in.
  #   2. Files are already identical → no-op.
  #   3. No merge base (first sync or lost history) → apply template, record conflict.
  #   4. Template is unchanged since base → local diverged alone; keep local.
  #   5. Local is unchanged since base → template advanced alone; adopt template.
  #   6. Both sides changed → attempt a 3-way merge:
  #      a. Clean merge → write merged result.
  #      b. Conflict → write conflict markers for Claude to resolve.
  process_file() {
    local rel_path="$1"
    local template_file="_template/$rel_path"

    # Case 0: the child deliberately made this path a symlink (e.g. a dotfiles
    # repo pointing .claude/settings.json at another repo it clones at runtime).
    # Never overwrite it — cp through a dangling symlink errors out, and cp
    # through a live one would clobber the link's target instead of the link.
    # Leave the local structure alone.
    if [[ -L "$rel_path" ]]; then
      echo "Skipping symlink: $rel_path (local structure preserved)"
      return
    fi

    local parent_dir
    parent_dir=$(dirname "$rel_path")

    # Case 0: the child deliberately made this path — or an ancestor directory —
    # a symlink (e.g. a dotfiles repo pointing .claude/settings.json or
    # .claude/hooks/ at another repo it clones at runtime). Never write it: cp
    # through a dangling link errors out, through a live one it escapes into the
    # link target, and mkdir -p on a symlinked directory fails outright. Leave
    # the local structure alone; checked before the mkdir below.
    if [[ -L "$rel_path" ]]; then
      echo "Skipping symlink: $rel_path (local structure preserved)"
      return
    fi
    local ancestor="$parent_dir"
    while [[ "$ancestor" != "." && "$ancestor" != "/" && -n "$ancestor" ]]; do
      if [[ -L "$ancestor" ]]; then
        echo "Skipping under symlinked dir: $rel_path ($ancestor is a symlink)"
        return
      fi
      ancestor=$(dirname "$ancestor")
    done

    [[ "$parent_dir" != "." ]] && mkdir -p "$parent_dir"

    # Case 1: new file in template.
    if [[ ! -f "$rel_path" ]]; then
      cp "$template_file" "$rel_path"
      echo "Added: $rel_path"
      return
    fi

    # Case 2: already identical.
    if diff -q "$rel_path" "$template_file" >/dev/null 2>&1; then
      return
    fi

    # Case 3: no merge base — first sync or history unavailable.
    if [[ -z "$PREV_SHA" ]]; then
      record_no_base_conflict "$rel_path" "$template_file"
      return
    fi

    local safe_name
    safe_name=$(echo "$rel_path" | tr '/' '_')
    local base_file="$WORK_DIR/merge_base_${safe_name}"

    if ! git -C _template show "${PREV_SHA}:${rel_path}" >"$base_file" 2>/dev/null; then
      rm -f "$base_file"
      record_no_base_conflict "$rel_path" "$template_file"
      return
    fi

    # Case 4: template unchanged since base — local diverged alone; keep local.
    if diff -q "$base_file" "$template_file" >/dev/null 2>&1; then
      echo "Unchanged in template: $rel_path (keeping local version)"
      rm -f "$base_file"
      return
    fi

    # Case 5: local unchanged since base — template advanced alone; adopt it.
    if diff -q "$base_file" "$rel_path" >/dev/null 2>&1; then
      cp "$template_file" "$rel_path"
      echo "Updated: $rel_path (local was unmodified)"
      rm -f "$base_file"
      return
    fi

    # Case 6: both sides changed — attempt a 3-way merge.
    local merge_result="$WORK_DIR/merge_result_${safe_name}"
    cp "$rel_path" "$merge_result"

    if git merge-file -L "local" -L "base" -L "template" \
      "$merge_result" "$base_file" "$template_file" 2>/dev/null; then
      # Detect a silent downgrade: the merge base here is the single repo-wide
      # PREV_SHA, which can be STALE for a file first synced at a different
      # template SHA. A stale base makes git report a "clean" merge while
      # actually dropping adopter-modified lines. Measure that against the
      # pre-sync local ($rel_path, not yet overwritten) and surface it loudly so
      # the reviewer never trusts "auto-merged" to mean "nothing lost".
      local dropped
      dropped=$(count_dropped_lines "$rel_path" "$merge_result")
      cp "$merge_result" "$rel_path"
      echo "Auto-merged: $rel_path (clean 3-way merge)"
      echo "$rel_path" >>"$AUTO_MERGED_FILES"
      if [[ "${dropped:-0}" -gt 0 ]]; then
        echo "$rel_path" >>"$DOWNGRADE_FILES"
        # %s are printf specifiers, not shell expansions; single quotes are correct.
        # shellcheck disable=SC2016
        printf -- '- `%s` — auto-merge dropped %s line(s) present in the local copy\n' \
          "$rel_path" "$dropped" >>"$DOWNGRADE_REPORT"
      fi
      rm -f "$base_file" "$merge_result"
      return
    fi

    # Case 6b: conflict markers produced — keep them for Claude to resolve.
    cp "$merge_result" "$rel_path"
    echo "CONFLICT (merge markers): $rel_path"
    echo "$rel_path" >>"$CONFLICT_FILES"
    {
      echo "### \`$rel_path\`"
      echo ""
      echo "3-way merge produced **conflict markers** (\`<<<<<<<\`/\`=======\`/\`>>>>>>>\`)."
      echo "Resolve them: keep local customizations, adopt template improvements."
      echo ""
      echo "<details>"
      echo "<summary>View file with conflict markers</summary>"
      echo ""
      echo "\`\`\`"
      head -500 "$rel_path"
      echo "\`\`\`"
      echo "</details>"
      echo ""
    } >>"$CONFLICT_REPORT"
    rm -f "$base_file" "$merge_result"
  }

  record_no_base_conflict() {
    local rel_path="$1" template_file="$2"
    echo "CONFLICT (no base): $rel_path"
    echo "$rel_path" >>"$CONFLICT_FILES"
    {
      echo "### \`$rel_path\`"
      echo ""
      echo "No merge base available (first sync or file history unavailable)."
      echo "Template version has been applied. Restore any important local customizations."
      echo ""
      echo "<details>"
      echo "<summary>Diff (old local → new template)</summary>"
      echo ""
      echo "\`\`\`diff"
      # diff exits 0 (identical) or 1 (differs); anything higher is a real error.
      # Capture into a variable so truncating with `head` can't SIGPIPE the diff.
      diff_rc=0
      diff_out=$(diff -u "$rel_path" "$template_file") || diff_rc=$?
      [[ "${diff_rc:-0}" -le 1 ]] || exit "${diff_rc}"
      head -500 <<<"$diff_out"
      echo "\`\`\`"
      echo "</details>"
      echo ""
    } >>"$CONFLICT_REPORT"
    cp "$template_file" "$rel_path"
  }

  #############################################
  # Detect deleted files + process sync paths
  #############################################

  # A path is "deleted" only if it existed in the template at PREV_SHA but no
  # longer exists at the current template HEAD. This avoids false positives for
  # project-specific files that were never in the template.
  if [[ -n "$PREV_SHA" ]]; then
    if ! git -C _template ls-tree -r --name-only "$PREV_SHA" 2>/dev/null >"$PREV_TEMPLATE_FILES"; then
      : >"$PREV_TEMPLATE_FILES" # PREV_SHA not in template history; treat as no prior files
    fi
  fi

  for path in $SYNC_PATHS; do
    is_excluded "$path" && continue

    if [[ -n "$PREV_SHA" ]]; then
      while IFS= read -r prev_file; do
        case "$prev_file" in "$path" | "$path/"*) ;; *) continue ;; esac
        is_excluded "$prev_file" && continue
        if [[ ! -f "_template/$prev_file" ]]; then
          echo "DELETED in template: $prev_file"
          echo "$prev_file" >>"$DELETED_FILES"
        fi
      done <"$PREV_TEMPLATE_FILES"
    fi

    if [[ ! -e "_template/$path" ]]; then
      echo "Warning: $path not found in template, skipping"
      continue
    fi

    if [[ -d "_template/$path" ]]; then
      while IFS= read -r template_file; do
        rel_path="${template_file#_template/}"
        is_excluded "$rel_path" && continue
        process_file "$rel_path"
      done < <(find "_template/$path" -type f)
    else
      process_file "$path"
    fi
  done

  rm -rf _template

  #############################################
  # Set outputs
  #############################################

  if [[ -s "$AUTO_MERGED_FILES" ]]; then
    auto_merged=$(tr '\n' ' ' <"$AUTO_MERGED_FILES")
    echo "auto_merged_files=$auto_merged" >>"$GITHUB_OUTPUT"
  fi

  # Downgrade risk: files whose "clean" auto-merge dropped adopter content. This
  # is the loud counterpart to the silent regression the sync used to ship — the
  # PR body renders it as a prominent "adopter is ahead" section so the reviewer
  # eyeballs exactly these files instead of trusting the auto-merge.
  if [[ -s "$DOWNGRADE_FILES" ]]; then
    downgrade=$(tr '\n' ' ' <"$DOWNGRADE_FILES")
    {
      echo "has_downgrades=true"
      echo "downgrade_files=$downgrade"
    } >>"$GITHUB_OUTPUT"
    emit_multiline_output "downgrade_report" "$(cat "$DOWNGRADE_REPORT")"
  else
    echo "has_downgrades=false" >>"$GITHUB_OUTPUT"
  fi

  if [[ -s "$CONFLICT_FILES" ]]; then
    conflicts=$(tr '\n' ' ' <"$CONFLICT_FILES")
    {
      echo "has_conflicts=true"
      echo "conflict_files=$conflicts"
    } >>"$GITHUB_OUTPUT"
    # Cap the total conflict report before it becomes the PR body. GitHub passes
    # the body to the create-pull-request action through the environment, and a
    # body over the exec arg/env limit aborts PR creation with E2BIG ("Argument
    # list too long") before it starts -- reached when many files have no merge
    # base (each contributes a full old->new diff). The complete conflicted-file
    # list is preserved in .template-sync-conflicts, so truncating the narrative
    # detail here loses nothing load-bearing.
    max_report_bytes=60000
    if [[ "$(wc -c <"$CONFLICT_REPORT")" -gt "$max_report_bytes" ]]; then
      capped="${CONFLICT_REPORT}.capped"
      head -c "$max_report_bytes" "$CONFLICT_REPORT" | sed '$d' >"$capped"
      printf '\n\n_Conflict report truncated at %d KB. Every conflicted file is listed in .template-sync-conflicts._\n' "$((max_report_bytes / 1000))" >>"$capped"
      mv "$capped" "$CONFLICT_REPORT"
    fi
    emit_multiline_output "conflict_report" "$(cat "$CONFLICT_REPORT")"
    echo "Template updates available for: $conflicts" >.template-sync-conflicts
  else
    echo "has_conflicts=false" >>"$GITHUB_OUTPUT"
    rm -f .template-sync-conflicts
  fi

  if [[ -s "$DELETED_FILES" ]]; then
    deleted=$(tr '\n' ' ' <"$DELETED_FILES")
    {
      echo "has_deletions=true"
      echo "deleted_files=$deleted"
    } >>"$GITHUB_OUTPUT"
  else
    echo "has_deletions=false" >>"$GITHUB_OUTPUT"
  fi

  if git diff --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
    echo "has_changes=false" >>"$GITHUB_OUTPUT"
  else
    changed_paths=$({
      git diff --name-only
      git ls-files --others --exclude-standard
    } | tr '\n' ' ')
    {
      echo "has_changes=true"
      echo "changed_paths=$changed_paths"
    } >>"$GITHUB_OUTPUT"
  fi
}

main "$@"
